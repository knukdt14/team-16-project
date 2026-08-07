"""
load_pdf.py
2026년 전기자동차 보급사업 보조금 업무처리지침 PDF를 파싱하여
RAG용 청크(JSONL)로 변환한다.

핵심 설계:
1) pypdf 대신 pdfplumber 사용
   → pypdf는 한국어 공백을 모두 제거해버려 BM25 토크나이징이 불가능해짐
2) '○' 단위로 청킹
   → 이 문서는 '○'가 하나의 완결된 규정 단위이고,
     하위의 '*', '※', '-' 는 그 규정의 각주/예시이므로 반드시 함께 묶어야 함
     (각주를 떼면 "'27년 기준 강화", "계산 예시" 같은 핵심 정보가 유실됨)
3) 제조사용 섹션(별표 1~4, 별지 서식)은 제외
   → 구매자 질문과 무관한데 표가 커서 검색을 오염시킴

실행: python load_pdf.py
출력: ../data/chunks.jsonl
"""

import json
import re
from pathlib import Path

import pdfplumber

PDF_PATH = Path("../data/2026년 전기자동차 보급사업 보조금 업무처리지침(안).pdf")
OUT_PATH = Path("../data/chunks.jsonl")

# 구매자 상담과 무관한 섹션 (제조사 산정용 / 서식)
EXCLUDE_PATTERNS = [
    r"^\[별표\s*1\]",   # 전기승용차 국비 보조금 산출방식 (계수표)
    r"^\[별표\s*2\]",   # 전기승합차 산출방식
    r"^\[별표\s*3\]",   # 전기화물차 산출방식
    r"^\[별표\s*4\]",   # 배터리 필수정보 제공 기준
    r"^\[별지",         # 신청서 서식, 개인정보 동의서
]

# 대분류 (Ⅰ~Ⅳ)
RE_PART = re.compile(r"^\s*([ⅠⅡⅢⅣ])\s+(.+)$")
# 중분류 (1. 2. / 4-1. / 4-1-2. 등)
RE_SECTION = re.compile(r"^\s*(\d+(?:-\d+)*)\.\s*(.+)$")
# 항목 시작
RE_ITEM = re.compile(r"^\s*○\s*(.+)$")
# 하위 항목 (각주/예시/세부) → 직전 ○에 병합
RE_SUB = re.compile(r"^\s*[\*※\-–□◇①②③④⑤➀➁]\s*")
# 별표 (5번만 포함 대상)
RE_TABLE = re.compile(r"^\[별표\s*(\d+)\]")
# 섹션 제목 뒤에 붙는 각주 (※, * 이후) 제거용
RE_TITLE_NOTE = re.compile(r"\s*[※\*].*$")


def is_excluded(line: str) -> bool:
    return any(re.search(p, line) for p in EXCLUDE_PATTERNS)


def clean_line(line: str) -> str:
    """페이지 번호, 목차 점선 등 노이즈 제거"""
    line = line.strip()
    if re.fullmatch(r"-\s*\d+\s*-", line):      # "- 8 -"
        return ""
    if re.search(r"[·․…]{5,}", line):            # 목차 점선
        return ""
    return line


def is_garbled(line: str) -> bool:
    """
    표지 페이지는 글자가 겹쳐 렌더링되어 '222222000000...' 처럼 추출된다.
    같은 문자가 4번 이상 연속되면 깨진 것으로 판단.
    """
    return bool(re.search(r"(.)\1{3,}", line))


SKIP_PAGES = {1, 2, 58}   # 표지, 목차, 뒷표지


def extract_lines(pdf_path: Path):
    """PDF에서 (페이지번호, 텍스트라인) 목록 추출"""
    out = []
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            if pno in SKIP_PAGES:
                continue
            text = page.extract_text() or ""
            for raw in text.split("\n"):
                line = clean_line(raw)
                if line and not is_garbled(line):
                    out.append((pno, line))
    return out


def chunk_document(lines):
    """
    '○' 단위로 자르되, 하위 항목(*, ※, -)은 같은 청크에 포함.
    각 청크에 상위 제목(part/section)을 헤더로 붙여 검색 정확도를 높인다.
    """
    chunks = []
    part, section = "", ""
    buf, buf_page = [], None
    excluded = False
    in_table5 = False

    def flush():
        nonlocal buf, buf_page
        if not buf:
            return
        body = " ".join(buf).strip()
        if len(body) < 20:          # 너무 짧은 조각은 버림
            buf = []
            return
        header = " > ".join(x for x in ["업무처리지침", part, section] if x)
        chunks.append({
            "id": f"guide_{len(chunks):04d}",
            "text": f"[{header}]\n{body}",
            "metadata": {
                "source": "2026년 전기자동차 보급사업 보조금 업무처리지침",
                "doc_type": "지침",
                "year": 2026,
                "part": part,
                "section": section,
                "page": buf_page,
            },
        })
        buf = []

    for pno, line in lines:
        # ---- 별표 처리 ----
        # [별표 N] 을 만나면 part/section 을 별표 기준으로 새로 설정.
        # 별표 5(지자체별 물량)만 포함하고 1~4(제조사 산정용)는 제외.
        m_tbl = RE_TABLE.match(line)
        if m_tbl:
            flush()
            no = m_tbl.group(1)
            if no == "5":
                excluded = False
                part = "별표"
                rest = RE_TABLE.sub("", line).strip()
                section = f"[별표 5] {rest}" if rest else "[별표 5] 지방자치단체별 지방비 편성 필요 물량"
                in_table5 = True
            else:
                excluded = True
                in_table5 = False
            continue

        if is_excluded(line):        # [별지 ...] 등
            flush()
            excluded = True
            in_table5 = False
            continue

        if excluded:
            continue

        m_part = RE_PART.match(line)
        if m_part:
            flush()
            part = f"{m_part.group(1)}. {m_part.group(2)}"
            section = ""
            in_table5 = False
            continue

        # 별표 5 안에서는 표 안의 "1.", "2." 를 섹션으로 오인하지 않도록 건너뜀
        m_sec = None if in_table5 else RE_SECTION.match(line)
        if m_sec and len(m_sec.group(2)) < 40:      # 제목만 (본문 문장 오탐 방지)
            title = RE_TITLE_NOTE.sub("", m_sec.group(2)).strip()
            # 회수요율표의 "1. 수출을 목적으로..." 처럼 본문 표 항목은 섹션이 아님
            if title and not title.endswith("경우"):
                flush()
                section = f"{m_sec.group(1)}. {title}"
                continue

        m_item = RE_ITEM.match(line)
        if m_item:
            flush()
            buf = [m_item.group(1)]
            buf_page = pno
            continue

        # 하위 항목 또는 이어지는 줄 → 현재 청크에 병합
        if buf:
            buf.append(RE_SUB.sub("", line) if RE_SUB.match(line) else line)
        else:
            # ○ 없이 시작하는 단독 문단
            buf = [RE_SUB.sub("", line)]
            buf_page = pno

    flush()
    return chunks


MIN_CHARS = 300      # 이보다 짧으면 같은 섹션의 다음 청크와 병합 시도
MAX_CHARS = 900      # 병합 상한


def merge_short_chunks(chunks):
    """
    같은 섹션 내 인접한 짧은 청크를 병합한다.

    '○' 단위로만 자르면 한 조항이 지나치게 잘게 쪼개져
    (중앙값 165자) 정답 정보가 여러 청크로 흩어진다.
    같은 section 안에서 연속된 청크를 MAX_CHARS 까지 합쳐
    검색 단위를 의미 단위에 가깝게 만든다.
    """
    merged, buf = [], None

    def flush_buf():
        if buf:
            merged.append(buf)

    for c in chunks:
        if buf is None:
            buf = dict(c)
            continue

        same_section = (
            buf["metadata"]["section"] == c["metadata"]["section"]
            and buf["metadata"]["part"] == c["metadata"]["part"]
        )
        # 헤더를 제외한 본문 길이로 판단
        cur_body = buf["text"].split("\n", 1)[-1]
        add_body = c["text"].split("\n", 1)[-1]

        if (same_section and len(cur_body) < MIN_CHARS
                and len(cur_body) + len(add_body) <= MAX_CHARS):
            buf["text"] = buf["text"] + "\n" + add_body
            continue

        flush_buf()
        buf = dict(c)

    flush_buf()

    # ID 재부여
    for i, c in enumerate(merged):
        c["id"] = f"guide_{i:04d}"
    return merged


def main():
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"PDF를 찾을 수 없습니다: {PDF_PATH.resolve()}")

    lines = extract_lines(PDF_PATH)
    print(f"추출된 라인 수: {len(lines)}")

    chunks = chunk_document(lines)
    print(f"1차 청크 수: {len(chunks)}")

    chunks = merge_short_chunks(chunks)
    print(f"병합 후 청크 수: {len(chunks)}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"저장 완료: {OUT_PATH}")

    # 길이 분포 확인 (청킹이 잘 됐는지 눈으로 검증)
    lens = [len(c["text"]) for c in chunks]
    lens.sort()
    print(f"\n청크 길이 - 최소 {lens[0]} / 중앙 {lens[len(lens)//2]} / 최대 {lens[-1]}")

    print("\n--- 샘플 3개 ---")
    for c in chunks[:3]:
        print(f"\n[{c['id']}] p.{c['metadata']['page']}")
        print(c["text"][:200])


if __name__ == "__main__":
    main()