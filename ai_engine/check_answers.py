"""
check_answers.py
LLM 답변 품질을 눈으로 점검하기 위한 배치 실행 스크립트.

검색 성능은 evaluate.py 로 수치화했으나, 최종 답변의 품질
(환각, 근거 표기, 되묻기 동작, 길이)은 사람이 읽어야 판단할 수 있다.

점검 항목:
  - 숫자 환각: 조회값에 없는 금액을 만들어내는가
  - 근거 표기: 조항을 명시하는가
  - 되묻기: 정보 부족 시 답을 지어내지 않는가
  - 길이: 3~5문장 지시를 지키는가

실행:
    python check_answers.py
    python check_answers.py --out ../eval/answer_check.md
"""

import argparse
import time
from pathlib import Path

from pipeline import Pipeline

# 유형별로 고르게 배치. 각 질문이 무엇을 검증하는지 명시.
CASES = [
    # (질문, region, model, 점검 포인트)
    ("청년이 첫 차로 사면 얼마나 더 받나요?", None, None,
     "규정 검색 + 근거 표기. 19~34세 조건을 언급하는가"),

    ("부산에서 더뉴EV6 스탠다드 사면 얼마예요?", None, None,
     "금액 정확성. 501/180/681 이 그대로 나오는가"),

    ("경기도에서 EV6 사려는데 얼마나 받나요?", None, None,
     "되묻기. 범위(651~976)를 주고 시군구를 묻는가"),

    ("EV6 얼마예요?", "성남시", None,
     "화면 필터 보완. 질문에 지역이 없어도 답하는가"),

    ("34살인데 첫 차로 대구에서 아이오닉5 사려고요", None, None,
     "복합 조건. 청년 인정 + 지역 추출 + 트림 되묻기"),

    ("이사 온 지 얼마 안 됐는데 신청 가능한가요?", None, None,
     "규정 검색. 거주요건 3개월을 찾는가"),

    ("전에 보조금 받았는데 또 받을 수 있나요?", None, None,
     "규정 검색. 재지원제한 2년을 찾는가"),

    ("차값이 6천만원이면 보조금 다 나오나요?", None, None,
     "가격 구간. 5.3천~8.5천 구간 50% 를 설명하는가"),

    ("차상위인데 애도 셋이면 얼마나 받나요?", None, None,
     "계산 규정. 중복 지원과 계산 순서를 설명하는가"),

    ("충전기 설치 보조금도 여기서 알 수 있나요?", None, None,
     "환각 방지. 문서에 없는 내용에 '확인되지 않음'을 말하는가"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="../eval/answer_check.md")
    ap.add_argument("--device", default=None)
    args = ap.parse_args()

    print("파이프라인 로드 중... (LLM 포함, 수 분 소요 가능)")
    p = Pipeline(load_llm=True, device=args.device)
    print("준비 완료\n")

    lines = ["# LLM 답변 품질 점검", ""]
    lines.append(f"실행: {time.strftime('%Y-%m-%d %H:%M')}")
    lines.append("")

    for i, (q, region, model, point) in enumerate(CASES, 1):
        print("=" * 66)
        print(f"[{i}/{len(CASES)}] {q}")

        t0 = time.time()
        r = p.answer(q, region=region, model=model)
        elapsed = time.time() - t0

        e = r["entities"]
        print(f"  추출: 지역={e['region']} 모델={e['model']} "
              f"청년={e['youth_first']} 자녀={e['children']}")
        print(f"  상태: {r['status']} / {elapsed:.1f}초")
        print(f"\n{r['answer']}\n")

        # 마크다운 기록
        lines.append(f"## {i}. {q}")
        lines.append("")
        lines.append(f"**점검 포인트**: {point}")
        lines.append("")
        if region or model:
            lines.append(f"**화면 필터**: region={region}, model={model}")
            lines.append("")
        lines.append(f"- 추출: 지역 `{e['region']}` / 모델 `{e['model']}` / "
                     f"청년 `{e['youth_first']}` / 자녀 `{e['children']}`")
        lines.append(f"- 상태: `{r['status']}` / {elapsed:.1f}초")

        if r.get("subsidy"):
            s = r["subsidy"]
            lines.append(f"- 조회된 금액: 국비 {s['국비']} + 지방비 {s['지방비']} "
                         f"= **{s['총액']}만원**")
        if r.get("extra"):
            lines.append(f"- 추가지원 계산: {r['extra']['total_national_side']}만원 (국비측)")

        lines.append("")
        lines.append("**답변**")
        lines.append("")
        lines.append("```")
        lines.append(r["answer"])
        lines.append("```")
        lines.append("")

        if r["sources"]:
            srcs = " / ".join(f"{s['section']}(p.{s['page']})"
                              for s in r["sources"][:3])
            lines.append(f"**검색된 근거**: {srcs}")
            lines.append("")

        lines.append("**판정**: <!-- OK / 환각 / 근거누락 / 장황 등 기재 -->")
        lines.append("")
        lines.append("---")
        lines.append("")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print("=" * 66)
    print(f"저장: {out.resolve()}")


if __name__ == "__main__":
    main()