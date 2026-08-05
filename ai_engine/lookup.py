"""
lookup.py
지자체 차종별 보조금 CSV에서 정확한 금액을 조회한다.

설계 원칙:
  금액은 절대 LLM이 생성하지 않는다. 반드시 이 모듈이 조회한 값만 사용한다.
  (RAG는 "왜 그 금액인지"를 설명하고, 금액 자체는 여기서 나온다)

핵심 기능:
  1) resolve_region() : "성남", "경기 성남시" → (시도, 시군구)
  2) resolve_model()  : "EV6", "아이오닉5" → 실제 모델명 후보
  3) lookup()         : 조회 결과 + 되묻기 필요 여부 판단
  4) calc_extra()     : 추가지원금 계산 (청년/차상위/다자녀 등)

되묻기 설계:
  - 시군구 미지정 → 시도 내 금액 범위로 답하고 시군구를 되물음
  - 트림 미지정   → 트림별 금액 범위로 답하고 트림을 되물음
  평균을 내지 않는다. 평균은 어느 지역에도 존재하지 않는 금액이기 때문.
"""

import re
from pathlib import Path

import pandas as pd

CSV_PATH = Path("../data/ev_subsidy_data_sigungu.csv")

# ---------------------------------------------------------------- 별칭 사전
# 사용자가 입력할 법한 표현 → 모델명에 포함된 핵심 키워드
# (정규화 후 부분일치로 검색하므로 짧은 핵심어만 등록)
MODEL_ALIASES = {
    # 기아
    "ev3": "ev3", "이브이3": "ev3",
    "ev4": "ev4", "이브이4": "ev4",
    "ev5": "ev5", "이브이5": "ev5",
    "ev6": "ev6", "이브이6": "ev6",
    "ev9": "ev9", "이브이9": "ev9",
    "니로": "niro", "니로ev": "niro",
    # 현대
    "아이오닉5": "아이오닉5", "아이오닉파이브": "아이오닉5", "ioniq5": "아이오닉5",
    "아이오닉6": "아이오닉6", "ioniq6": "아이오닉6",
    "아이오닉9": "아이오닉9", "ioniq9": "아이오닉9",
    "코나": "코나", "코나일렉트릭": "코나",
    "gv60": "gv60", "지브이60": "gv60",
    "gv70": "gv70", "지브이70": "gv70",
    "g80": "g80",
    "캐스퍼": "캐스퍼", "캐스퍼일렉트릭": "캐스퍼",
    # 테슬라
    "모델3": "model3", "테슬라모델3": "model3", "model3": "model3",
    "모델y": "modely", "테슬라모델y": "modely", "modely": "modely",
    # KG모빌리티
    "토레스": "토레스", "토레스evx": "토레스",
    # 기타
    "폴스타": "폴스타", "폴스타4": "폴스타4",
    # 모호한 입력 → 되묻기 유도 (여러 모델이 매칭되어 need_trim 으로 빠짐)
    "아이오닉": "아이오닉",
    "ev": "ev",
    "이브이": "ev",
}

# 제조사명 접두어. 모델 매칭 시 제거한다.
# "기아 EV" 처럼 제조사명이 붙으면 모델명과 매칭되지 않아
# 되묻기로 가지 못하고 엉뚱한 답변이 생성되는 문제가 있었다.
# 긴 이름부터 검사해야 "현대"가 "현대자동차"를 가로채지 않는다.
# 입력 표기 → CSV 제조사 컬럼 값
BRAND_MAP = {
    "기아": "기아",
    "현대자동차": "현대자동차", "현대": "현대자동차", "제네시스": "현대자동차",
    "테슬라코리아": "테슬라코리아", "테슬라": "테슬라코리아",
    "케이지모빌리티": "케이지모빌리티", "kg모빌리티": "케이지모빌리티",
    "kgm": "케이지모빌리티", "쌍용": "케이지모빌리티",
    "메르세데스벤츠코리아": "메르세데스벤츠코리아",
    "메르세데스벤츠": "메르세데스벤츠코리아", "벤츠": "메르세데스벤츠코리아",
    "볼보자동차코리아": "볼보자동차코리아", "볼보": "볼보자동차코리아",
    "비와이디코리아": "비와이디코리아", "비와이디": "비와이디코리아",
    "byd": "비와이디코리아",
    "폭스바겐그룹코리아": "폭스바겐그룹코리아", "폭스바겐": "폭스바겐그룹코리아",
    "아우디": "폭스바겐그룹코리아",
    "폴스타오토모티브코리아": "폴스타오토모티브코리아",
    "bmw": "BMW", "미니": "BMW", "mini": "BMW",
}
# 긴 이름부터 검사해야 "현대"가 "현대자동차"를 가로채지 않는다
BRAND_PREFIXES = sorted(BRAND_MAP, key=len, reverse=True)


def strip_brand(norm: str):
    """
    정규화된 문자열에서 제조사명 접두어를 분리한다.
      '기아ev'  → ('ev', '기아')
      '현대코나' → ('코나', '현대자동차')
      '기아'    → ('기아', None)   제조사만 있으면 그대로 두어 not_found 처리
      'ev6'    → ('ev6', None)
    """
    for b in BRAND_PREFIXES:
        if norm.startswith(b) and len(norm) > len(b):
            return norm[len(b):], BRAND_MAP[b]
    return norm, None


# 시도 표기 흔들림 흡수
SIDO_ALIASES = {
    "서울특별시": "서울", "서울시": "서울",
    "부산광역시": "부산", "부산시": "부산",
    "대구광역시": "대구", "대구시": "대구",
    "인천광역시": "인천", "인천시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산",
    "세종특별자치시": "세종", "세종시": "세종",
    "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원",
    "충청북도": "충북", "충청남도": "충남",
    "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남",
    "경상북도": "경북", "경상남도": "경남",
    "제주도": "제주", "제주특별자치도": "제주",
}


def normalize(s: str) -> str:
    """공백/특수문자 제거 + 소문자화. 모델명 매칭의 기준."""
    if not isinstance(s, str):
        return ""
    s = s.lower()
    s = re.sub(r"\(단종\)|\(\d{4}\)|\(\d+만원\)", "", s)   # (단종), (2025), (5999만원)
    s = re.sub(r"[^0-9a-z가-힣]", "", s)                    # 공백·기호 제거
    return s


class SubsidyLookup:
    def __init__(self, csv_path: Path = CSV_PATH):
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV를 찾을 수 없습니다: {csv_path.resolve()}")
        self.df = pd.read_csv(csv_path, encoding="utf-8-sig")

        # 숫자 컬럼 정리 (문자열로 들어온 경우 대비)
        for col in ["국비(만원)", "지방비(만원)", "보조금(만원)",
                    "전환지원금국비(만원)", "전환지원금지방비(만원)"]:
            self.df[col] = pd.to_numeric(self.df[col], errors="coerce")

        # 매칭용 정규화 컬럼 미리 생성
        self.df["_model_norm"] = self.df["모델명"].map(normalize)
        self.df["_sigungu_norm"] = self.df["시군구"].map(normalize)

    # ------------------------------------------------------------ 지역
    def resolve_region(self, text: str):
        """
        '성남', '경기 성남시', '대구' → (시도, 시군구) 또는 (시도, None)
        찾지 못하면 (None, None)
        """
        if not text:
            return None, None
        t = normalize(SIDO_ALIASES.get(text.strip(), text))

        # 1) 시군구 정확/부분 일치
        hit = self.df[self.df["_sigungu_norm"] == t]
        if len(hit):
            r = hit.iloc[0]
            return r["시도"], r["시군구"]

        hit = self.df[self.df["_sigungu_norm"].str.contains(t, na=False)]
        if len(hit):
            cands = hit["시군구"].unique()
            if len(cands) == 1:
                r = hit.iloc[0]
                return r["시도"], r["시군구"]
            # 여러 곳 (예: '광주' → 광주광역시 / 경기 광주시)
            return None, list(cands)

        # 2) 시도만 일치
        sido_hit = self.df[self.df["시도"].map(normalize) == t]
        if len(sido_hit):
            return sido_hit.iloc[0]["시도"], None

        return None, None

    # ------------------------------------------------------------ 모델
    def resolve_model(self, text: str):
        """'EV6' → 해당 키워드를 포함한 실제 모델명 목록. 완전 일치 트림이 존재하면 우선 적용."""
        if not text:
            return []
        norm_text, brand = strip_brand(normalize(text))

        # 제조사가 지정되면 해당 제조사 차량으로 범위를 좁힌다
        # ("기아 EV" 가 토레스 EVX, Niro EV 까지 잡는 것을 방지)
        df = self.df if brand is None else self.df[self.df["제조사"] == brand]
        if df.empty:
            df = self.df

        exact = df[df["_model_norm"] == norm_text]
        if not exact.empty:
            return sorted(exact["모델명"].unique())

        key = MODEL_ALIASES.get(norm_text, norm_text)
        exact_key = df[df["_model_norm"] == key]
        if not exact_key.empty:
            return sorted(exact_key["모델명"].unique())

        hit = df[df["_model_norm"].str.contains(key, na=False)]
        return sorted(hit["모델명"].unique())

    # ------------------------------------------------------------ 조회
    def lookup(self, region: str = None, model: str = None):
        """
        조회 결과를 dict 로 반환.
        status:
          ok           - 금액 특정 완료
          need_region  - 지역 필요
          need_sigungu - 시도만 알고 시군구 필요 (범위 제공)
          need_trim    - 트림 필요 (범위 제공)
          not_found    - 해당 없음
        """
        if not model:
            return {"status": "need_model", "message": "차량 모델명이 필요합니다."}

        models = self.resolve_model(model)
        if not models:
            return {"status": "not_found",
                    "message": f"'{model}' 에 해당하는 지원 대상 차량을 찾지 못했습니다."}

        if not region:
            return {"status": "need_region",
                    "candidates_model": models,
                    "message": "지역에 따라 지방비가 달라집니다. 거주 지역을 알려주세요."}

        sido, sigungu = self.resolve_region(region)

        if sido is None and isinstance(sigungu, list):
            return {"status": "need_region", "candidates_region": sigungu,
                    "message": f"'{region}' 에 해당하는 지역이 여러 곳입니다."}
        if sido is None:
            return {"status": "not_found",
                    "message": f"'{region}' 지역 정보를 찾지 못했습니다."}

        df = self.df[self.df["시도"] == sido]
        if sigungu:
            df = df[df["시군구"] == sigungu]
        df = df[df["모델명"].isin(models)]

        if df.empty:
            return {"status": "not_found",
                    "message": f"{sido} {sigungu or ''} 에서 해당 차량 정보를 찾지 못했습니다."}

        # 시군구 미지정 → 범위 제시 + 되묻기
        if not sigungu and df["시군구"].nunique() > 1:
            return {
                "status": "need_sigungu",
                "sido": sido,
                "min": int(df["보조금(만원)"].min()),
                "max": int(df["보조금(만원)"].max()),
                "sigungu_list": sorted(df["시군구"].unique().tolist()),
                "message": f"{sido}는 시·군·구마다 지방비가 다릅니다. 정확한 지역을 알려주세요.",
            }

        # 트림 미지정 → 범위 제시 + 되묻기
        if df["모델명"].nunique() > 1:
            rows = (df[["모델명", "국비(만원)", "지방비(만원)", "보조금(만원)"]]
                    .drop_duplicates("모델명")
                    .sort_values("보조금(만원)", ascending=False))
            return {
                "status": "need_trim",
                "sido": sido, "sigungu": sigungu,
                "min": int(df["보조금(만원)"].min()),
                "max": int(df["보조금(만원)"].max()),
                "trims": rows.to_dict("records"),
                "message": "트림에 따라 금액이 다릅니다. 어떤 트림인지 알려주세요.",
            }

        r = df.iloc[0]
        return {
            "status": "ok",
            "시도": r["시도"], "시군구": r["시군구"],
            "제조사": r["제조사"], "모델명": r["모델명"], "차종": r["차종"],
            "국비": int(r["국비(만원)"]),
            "지방비": int(r["지방비(만원)"]),
            "총액": int(r["보조금(만원)"]),
            "전환지원금국비": int(r["전환지원금국비(만원)"]),
            "전환지원금지방비": int(r["전환지원금지방비(만원)"]),
        }


# ---------------------------------------------------------------- 추가지원금
def calc_extra(national: int, *, youth_first=False, low_income=False,
               children=0, taxi=False, scrap_ice=False,
               conv_nat=0, conv_local=0):
    """
    지침 4-1-1, 4-1-2 기준 추가지원금 계산.

    지침 규정:
      - 비율 지원(차상위 20%, 청년 20%)을 먼저 적용
      - 정액 지원(다자녀)은 마지막에 더함
      - 계산 예시: 차상위 + 3자녀, 국비 500만원
        → 500 + 500×20% + 200 = 800만원

    주의: 청년/차상위는 중복 가능하나, 실제 적용 여부는 지자체 공고 확인 필요.
    """
    steps = []
    total = national
    steps.append(("기본 국비", national))

    if low_income:
        add = round(national * 0.20)
        total += add
        steps.append(("차상위 이하 계층 (국비 20%)", add))

    if youth_first:
        add = round(national * 0.20)
        total += add
        steps.append(("청년 생애최초 (국비 20%)", add))

    if taxi:
        total += 250
        steps.append(("전기택시", 250))

    if children >= 4:
        total += 300; steps.append(("다자녀 4명 이상", 300))
    elif children == 3:
        total += 200; steps.append(("다자녀 3명", 200))
    elif children == 2:
        total += 100; steps.append(("다자녀 2명", 100))

    if scrap_ice and (conv_nat or conv_local):
        total += conv_nat + conv_local
        steps.append(("전환지원금 (노후 내연기관차 교체)", conv_nat + conv_local))

    return {"total_national_side": total, "steps": steps}


# ---------------------------------------------------------------- 테스트
if __name__ == "__main__":
    lk = SubsidyLookup()
    print(f"데이터: {len(lk.df)}행 / 시도 {lk.df['시도'].nunique()} / "
          f"시군구 {lk.df['시군구'].nunique()} / 모델 {lk.df['모델명'].nunique()}\n")

    cases = [
        ("대구", "EV6"),
        ("성남", "EV6"),
        ("경기", "EV6"),
        (None, "아이오닉5"),
        ("부산", "더뉴EV6 스탠다드"),
        ("광주", "EV6"),
        ("대구", "없는차"),
    ]
    for region, model in cases:
        res = lk.lookup(region, model)
        print(f"[{region} / {model}] → {res['status']}")
        if res["status"] == "ok":
            print(f"   {res['시군구']} {res['모델명']}: "
                  f"국비 {res['국비']} + 지방비 {res['지방비']} = {res['총액']}만원")
        elif res["status"] in ("need_sigungu", "need_trim"):
            print(f"   범위 {res['min']}~{res['max']}만원 | {res['message']}")
        else:
            print(f"   {res['message']}")
        print()

    print("=" * 55)
    print("추가지원금 계산 (지침 예시 검증: 차상위+3자녀, 국비 500 → 800)")
    r = calc_extra(500, low_income=True, children=3)
    for name, amt in r["steps"]:
        print(f"  {name}: {amt:+}만원")
    print(f"  합계: {r['total_national_side']}만원")