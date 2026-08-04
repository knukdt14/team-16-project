"""
pipeline.py
질문 하나를 받아 최종 답변까지 만드는 전체 흐름.
backend/main.py 는 이 파일의 answer() 만 호출하면 된다.

흐름:
    질문
     ↓  extract()            지역/모델/트림/자격조건 추출 (규칙 기반)
     ↓  classify()           금액 질문 / 규정 질문 판별
     ↓  lookup()             금액이면 CSV 조회 → 되묻기 필요하면 여기서 종료
     ↓  Retriever.search()   하이브리드 검색
     ↓  Generator.generate() 답변 생성 (금액은 조회값 그대로 사용)
     ↓  결과 반환

되묻기 설계:
    지역/트림이 특정되지 않으면 LLM 을 부르지 않고 즉시 되묻는다.
    (모르는 상태로 답변을 만들면 그럴듯한 오답이 나오기 때문)
    프론트에서 사이드바 필터값을 함께 보내면 그 값으로 보완된다.
"""

import re

from lookup import SubsidyLookup, calc_extra, normalize
from rag_chain import Generator, Retriever, build_prompt

# ---------------------------------------------------------------- 질문 분류
# 금액을 묻는 신호
MONEY_PAT = re.compile(
    r"얼마|금액|보조금이?\s*(얼마|몇)|가격|비용|받을\s*수\s*있|지원금|몇\s*만원"
)
# 자격/절차를 묻는 신호
RULE_PAT = re.compile(
    r"자격|조건|요건|거주|신청|절차|서류|기간|제한|환수|반납|의무|가능한가|되나요|되는지"
)

# 구매자 특성 키워드
YOUTH_PAT = re.compile(r"청년|생애\s*첫|생애최초|첫\s*차")
LOW_INCOME_PAT = re.compile(r"차상위|기초생활|저소득")
TAXI_PAT = re.compile(r"택시")
SCRAP_PAT = re.compile(r"폐차|노후차|전환지원|바꾸려|교체")
AGE_PAT = re.compile(r"(\d{2})\s*살|(\d{2})\s*세")
CHILD_PAT = re.compile(r"(\d)\s*자녀|자녀\s*(\d)\s*명|애가?\s*(\d)\s*명")


class Pipeline:
    def __init__(self, load_llm: bool = True, device: str = None):
        self.lookup = SubsidyLookup()
        self.retriever = Retriever(device=device)
        self.generator = Generator(device=device) if load_llm else None

        # 추출용 사전 (긴 이름부터 매칭해야 '광주' 보다 '광주시' 가 먼저 잡힘)
        self.sigungu_list = sorted(
            self.lookup.df["시군구"].unique(), key=len, reverse=True
        )
        self.sido_list = sorted(
            self.lookup.df["시도"].unique(), key=len, reverse=True
        )
        self.model_list = sorted(
            self.lookup.df["모델명"].unique(), key=len, reverse=True
        )

    # ------------------------------------------------------------ 추출
    def extract(self, question: str, region_hint: str = None,
                model_hint: str = None) -> dict:
        """
        질문에서 지역/모델/자격조건을 뽑는다.
        질문에 명시된 값이 힌트(프론트 필터)보다 우선한다.
        """
        q_norm = normalize(question)
        out = {}

        # ---- 지역 ----
        region = None
        for s in self.sigungu_list:              # 시군구 우선
            if normalize(s) in q_norm:
                region = s
                break
        if not region:
            for s in self.sido_list:
                if normalize(s) in q_norm:
                    region = s
                    break
        out["region"] = region or region_hint

        # ---- 모델 ----
        model = None
        for m in self.model_list:                # 전체 모델명 (트림까지) 우선
            if normalize(m) in q_norm:
                model = m
                break
        if not model:                            # 별칭 사전으로 재시도
            for alias in sorted(
                __import__("lookup").MODEL_ALIASES, key=len, reverse=True
            ):
                if alias in q_norm:
                    model = alias
                    break
        out["model"] = model or model_hint

        # ---- 구매자 특성 ----
        age_m = AGE_PAT.search(question)
        age = int(next(g for g in age_m.groups() if g)) if age_m else None
        out["age"] = age

        is_youth = bool(YOUTH_PAT.search(question))
        # 청년 요건: 19~34세. 나이가 명시되면 검증에 사용
        if age is not None:
            is_youth = is_youth and (19 <= age <= 34)
        out["youth_first"] = is_youth

        out["low_income"] = bool(LOW_INCOME_PAT.search(question))
        out["taxi"] = bool(TAXI_PAT.search(question))
        out["scrap_ice"] = bool(SCRAP_PAT.search(question))

        ch = CHILD_PAT.search(question)
        out["children"] = int(next(g for g in ch.groups() if g)) if ch else 0

        return out

    # ------------------------------------------------------------ 분류
    @staticmethod
    def classify(question: str, ent: dict) -> str:
        """money | rule | both"""
        money = bool(MONEY_PAT.search(question)) or bool(ent.get("model"))
        rule = bool(RULE_PAT.search(question))
        if money and rule:
            return "both"
        return "money" if money else "rule"

    # ------------------------------------------------------------ 메인
    def answer(self, question: str, region: str = None, model: str = None,
               top_k: int = 4, mode: str = "hybrid") -> dict:
        """
        반환:
          status   : answered | need_info
          answer   : 답변 문자열
          sources  : 근거 청크 목록
          subsidy  : 조회된 금액 (있는 경우)
          need     : 되물을 항목과 선택지 (need_info 인 경우)
        """
        ent = self.extract(question, region_hint=region, model_hint=model)
        kind = self.classify(question, ent)

        result = {
            "status": "answered",
            "question": question,
            "entities": ent,
            "kind": kind,
            "subsidy": None,
            "sources": [],
            "need": None,
        }

        # ---- 금액 조회 ----
        lk = None
        if kind in ("money", "both") and ent.get("model"):
            lk = self.lookup.lookup(ent.get("region"), ent.get("model"))
            result["lookup_status"] = lk["status"]

            # 되묻기가 필요하면 LLM 을 부르지 않고 즉시 반환
            if lk["status"] in ("need_region", "need_sigungu", "need_trim"):
                result["status"] = "need_info"
                result["need"] = lk
                result["answer"] = self._format_need(lk)
                return result

            if lk["status"] == "ok":
                result["subsidy"] = lk
                # 추가지원금 계산 (해당하는 경우)
                if any([ent["youth_first"], ent["low_income"],
                        ent["taxi"], ent["children"]]):
                    result["extra"] = calc_extra(
                        lk["국비"],
                        youth_first=ent["youth_first"],
                        low_income=ent["low_income"],
                        children=ent["children"],
                        taxi=ent["taxi"],
                        scrap_ice=ent["scrap_ice"],
                        conv_nat=lk["전환지원금국비"],
                        conv_local=lk["전환지원금지방비"],
                    )

        # ---- 검색 ----
        docs = self.retriever.search(question, k=top_k, mode=mode)
        result["sources"] = [
            {
                "id": d["id"],
                "section": d["metadata"]["section"],
                "page": d["metadata"]["page"],
                "score": round(float(d["score"]), 4),
                "text": d["text"],
            }
            for d in docs
        ]

        # ---- 생성 ----
        if self.generator is None:
            result["answer"] = "(LLM 미로드 - 검색 결과만 반환)"
            return result

        msgs = build_prompt(question, docs, lk if lk and lk["status"] == "ok" else None)
        result["answer"] = self.generator.generate(msgs)
        return result

    # ------------------------------------------------------------ 되묻기 문구
    @staticmethod
    def _format_need(lk: dict) -> str:
        st = lk["status"]
        if st == "need_region":
            if "candidates_region" in lk:
                opts = ", ".join(lk["candidates_region"])
                return f"{lk['message']} 어느 곳인가요? ({opts})"
            return "지역에 따라 지방비가 달라집니다. 거주하시는 지역을 알려주세요."
        if st == "need_sigungu":
            return (f"{lk['sido']} 기준 {lk['min']}~{lk['max']}만원 범위입니다. "
                    f"시·군·구마다 지방비가 달라 정확한 지역을 알려주시면 "
                    f"금액을 확인해드릴게요.")
        if st == "need_trim":
            lines = [f"  · {t['모델명']}: {int(t['보조금(만원)'])}만원"
                     for t in lk["trims"][:6]]
            return ("트림에 따라 금액이 다릅니다.\n" + "\n".join(lines) +
                    "\n어떤 트림인지 알려주세요.")
        return lk.get("message", "추가 정보가 필요합니다.")


# ---------------------------------------------------------------- 테스트
if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--device", default=None)
    args = ap.parse_args()

    p = Pipeline(load_llm=not args.no_llm, device=args.device)
    print("파이프라인 준비 완료\n")

    tests = [
        ("부산에서 더뉴EV6 스탠다드 사면 얼마예요?", None, None),
        ("EV6 얼마예요?", None, None),
        ("경기도에서 EV6 사려는데 얼마나 받나요?", None, None),
        ("34살인데 첫 차로 대구에서 아이오닉5 사려고요", None, None),
        ("대구에 얼마나 살아야 신청할 수 있나요?", None, None),
        ("전에 보조금 받았는데 또 받을 수 있나요?", None, None),
        ("EV6 얼마예요?", "성남시", None),          # 프론트 필터 보완 케이스
    ]

    for q, region, model in tests:
        print("=" * 66)
        print(f"Q. {q}" + (f"   [필터: {region}]" if region else ""))
        r = p.answer(q, region=region, model=model)
        e = r["entities"]
        print(f"   추출 → 지역={e['region']} 모델={e['model']} "
              f"청년={e['youth_first']} 자녀={e['children']} | 분류={r['kind']}")
        if r["subsidy"]:
            s = r["subsidy"]
            print(f"   조회 → {s['시군구']} {s['모델명']}: "
                  f"{s['국비']}+{s['지방비']}={s['총액']}만원")
        if r.get("extra"):
            print(f"   추가 → {r['extra']['total_national_side']}만원 (국비측)")
        print(f"   상태 → {r['status']}")
        print(f"\n   [답변]\n   {r['answer']}")
        if r["sources"]:
            print(f"\n   [근거] " + " / ".join(
                s["section"] for s in r["sources"][:3]))
        print()