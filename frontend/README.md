# frontend-next — Next.js 프론트엔드 (team-16-project)

전기차 보조금 상담 챗봇 프론트엔드. 깔끔한 화이트 테마 + three.js 3D 지도 + framer-motion.
같은 레포의 **`backend`(FastAPI)** 와 HTTP로 통신한다.

## 실행

### 1) 백엔드 먼저 띄우기
```bash
cd ../backend
pip install -r requirements.txt          # 최초 1회
uvicorn main:app --reload --port 8000     # http://localhost:8000/docs
```

### 2) 프론트 실행
```bash
cd frontend-next
cp .env.local.example .env.local          # 최초 1회 (백엔드 주소 설정)
npm install                               # 최초 1회 (몇 분 소요)
npm run dev                               # http://localhost:3000
```

> 백엔드가 아직 안 떠 있으면 챗봇 우측 상단에 `offline` 이 뜨고, 질문 시 안내 메시지를 보여준다.

## 백엔드 계약 (backend/schemas.py 기준)

- `POST /chat` `{ question, region?, model?, top_k?, mode? }`
  → `{ status: "answered"|"need_info", answer, subsidy, sources[], need, extra, entities, elapsed_ms }`
  - `subsidy`: `{ 시도, 시군구, 제조사, 모델명, 차종, 국비, 지방비, 총액, 전환지원금국비, 전환지원금지방비 }` (만원)
  - `sources`: `{ id, section, page, score, text }`
  - `status="need_info"` 면 `need` 의 선택지를 칩으로 표시 → 클릭 시 재질문
- `GET /subsidy/compare?model=&sido=&limit=&order=` — 지역별 비교 (지도/차트용)
- `GET /regions`, `GET /models`, `GET /health`

`lib/api.js` 에 위 엔드포인트가 모두 함수로 있다.

## 구조

```
frontend-next/
├── app/            layout.jsx · page.jsx · globals.css(테마)
├── components/     Dashboard · Map3D(three.js) · Chatbot · KpiCards
└── lib/            api.js(백엔드 연동) · data.js(지도 개요 데이터) · chat.js(지도 명령 분류)
```

## 동작

- **챗봇**: 실제 `/chat` 호출 → 답변 + 보조금 카드(총액·국비·지방비·전환지원금) + 근거(조항·페이지). 되묻기(need_info) 선택지 지원.
- **3D 지도**: 광역시 보조금 개요를 3D 막대로. 2D/3D 토글 + "지도 3D로 보여줘" 챗봇 명령으로 전환.
  - (다음 단계) `lib/api.js`의 `compareSubsidy(model)`로 백엔드 실데이터를 지도에 연결 가능.

## 참고
- 레포에는 Streamlit용 빈 `frontend/` 폴더도 있다. Next.js로 최종 결정되면 팀에서 정리할 것.
- 평가 "Frontend/Streamlit" 항목은 Streamlit 지정이므로, Next.js 사용은 담당 강사 확인 후 진행 권장.
