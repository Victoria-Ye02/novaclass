# NovaClass 프로젝트 구조 참고 문서

프론트엔드/백엔드 전체 구조 레퍼런스. 새 기능을 어디에 넣을지 헷갈릴 때 이 문서를 먼저 확인.
병합 작업 절차/규칙은 [`MERGE_GUIDE.md`](../MERGE_GUIDE.md) 참고.

---

## 전체 트리

`routes/`, `controllers/`, `pages/`는 **작성자 이름별 하위 폴더**로 나뉩니다.
새 파일은 반드시 자기 이름 폴더 안에만 추가하고, 다른 사람 폴더는 건드리지 않습니다.
전체를 불러 쓰는 지점(central place)은 백엔드는 `server.js`, 프론트엔드는 `App.jsx` 하나뿐입니다 — 새 라우트/페이지를 추가하면 이 두 파일에서만 import/require를 추가하면 됩니다.

```
NovaClass/
├── nova-class-backend/     (Node.js / Express)
│   ├── config/
│   │   └── db.js                       ← MySQL 연결 풀 (공용)
│   ├── controllers/
│   │   ├── victoria/                   ← Victoria가 작성한 컨트롤러만
│   │   │   ├── ai.controller.js
│   │   │   ├── assignment.controller.js
│   │   │   ├── attendance.controller.js
│   │   │   ├── auth.controller.js
│   │   │   ├── classroom.controller.js
│   │   │   ├── grades.controller.js
│   │   │   ├── kmate.controller.js
│   │   │   ├── meeting.controller.js
│   │   │   ├── multimodal.controller.js
│   │   │   ├── posts.controller.js
│   │   │   ├── progress.controller.js
│   │   │   └── resources.controller.js
│   │   └── thine/                      ← Thine이 작성한 컨트롤러만 (현재 비어있음)
│   ├── routes/
│   │   ├── victoria/
│   │   │   ├── ai.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── classroom.routes.js
│   │   │   ├── kmate.routes.js
│   │   │   ├── multimodal.routes.js
│   │   │   └── progress.routes.js
│   │   └── thine/                      ← 현재 비어있음
│   ├── middleware/                     ← 공용 (auth.middleware.js, upload.js)
│   ├── scripts/                        ← 공용
│   ├── uploads/                        ← 업로드된 파일 (git-ignored 대상, 현재 커밋되어 있음 — 확인 필요)
│   └── server.js                       ← ★ 모든 라우트를 불러 마운트하는 유일한 지점
│
└── nova-class-frontend/    (React.js / Vite)
    └── src/
        ├── App.jsx                     ← ★ 모든 페이지를 불러 라우팅하는 유일한 지점
        ├── main.jsx
        ├── index.css / App.css
        ├── i18n.js                     ← 다국어 문자열 (공용)
        ├── LanguageContext.jsx         ← 언어 상태 Context (공용)
        ├── pages/
        │   ├── victoria/                ← Victoria가 작성한 화면만
        │   │   ├── Login.jsx
        │   │   ├── Dashboard.jsx
        │   │   ├── Classroom.jsx
        │   │   ├── ClassDetail.jsx
        │   │   ├── KMate.jsx
        │   │   ├── Exam.jsx
        │   │   └── Settings.jsx
        │   └── thine/                   ← Thine이 작성한 화면만 (현재 비어있음)
        ├── components/                 ← 공용 (Sidebar.jsx, NovaAssistant.jsx)
        ├── services/
        │   └── api.js                  ← axios 인스턴스 (공용, JWT 자동 첨부)
        └── assets/
```

## 새 라우트/페이지 추가하는 법

- 백엔드: `controllers/<이름>/xxx.controller.js` + `routes/<이름>/xxx.routes.js` 작성 →
  `server.js`에 `app.use("/api/xxx", require("./routes/<이름>/xxx.routes"));` 한 줄 추가.
- 프론트엔드: `pages/<이름>/Xxx.jsx` 작성 → `App.jsx`에 import + `<Route>` 한 줄 추가.
- 다른 사람 폴더 안의 파일은 절대 직접 수정하지 않기. 수정이 필요하면 본인에게 요청.

> ⚠️ **확인 필요**: `controllers/victoria/`에는 있는데 `routes/victoria/`에는 없는 것 —
> `assignment`, `attendance`, `grades`, `meeting`, `posts`, `resources`.
> 라우트 연결이 안 됐거나 다른 방식으로 등록돼 있는지 확인 필요.

---

## 폴더별 규칙

### Backend
| 폴더 | 용도 | 하지 말 것 |
|---|---|---|
| `config/` | DB/외부 서비스 연결 설정 | 비즈니스 로직 넣기 |
| `controllers/` | 기능별 로직 (`xxx.controller.js`) | 라우팅 코드 넣기 |
| `routes/` | 라우트 등록 (`xxx.routes.js`) | 로직 작성 |
| `middleware/` | 요청 공통 처리 (인증, 업로드 등) | 특정 기능 전용 로직 |
| `scripts/` | 1회성/운영용 스크립트 | 서버 런타임 코드 |

### Frontend
| 폴더 | 용도 | 하지 말 것 |
|---|---|---|
| `src/pages/` | URL 경로 1개당 화면 1개 | 재사용 UI 조각 두기 |
| `src/components/` | 2곳 이상에서 재사용되는 UI | 특정 페이지 전용 로직 |
| `src/services/` | API 호출 래퍼 | UI 코드 |
| `src/assets/` | 이미지 등 정적 파일 | 코드 파일 |

### 네이밍 규칙
같은 기능은 레이어를 넘나들며 이름을 통일합니다.
예: `kmate` 기능 → `kmate.controller.js` + `kmate.routes.js` + `pages/KMate.jsx`

---

## 관련 문서
- 병합 절차: [`MERGE_GUIDE.md`](../MERGE_GUIDE.md)
- 프론트엔드 상세(구 문서, 일부 최신 구조와 다를 수 있음): [`nova-class-frontend/CLAUDE.md`](../nova-class-frontend/CLAUDE.md)
