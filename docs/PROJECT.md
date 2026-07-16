# NovaClass 참고 문서

프론트엔드/백엔드 구조와 병합 진행 상황을 한 파일에서 확인. 병합 절차 자체는 [`MERGE_GUIDE.md`](../MERGE_GUIDE.md) 참고.

---

## 1. 프로젝트 구조

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

### 새 라우트/페이지 추가하는 법

- 백엔드: `controllers/<이름>/xxx.controller.js` + `routes/<이름>/xxx.routes.js` 작성 →
  `server.js`에 `app.use("/api/xxx", require("./routes/<이름>/xxx.routes"));` 한 줄 추가.
- 프론트엔드: `pages/<이름>/Xxx.jsx` 작성 → `App.jsx`에 import + `<Route>` 한 줄 추가.
- 다른 사람 폴더 안의 파일은 절대 직접 수정하지 않기. 수정이 필요하면 본인에게 요청.

> ⚠️ **확인 필요**: `controllers/victoria/`에는 있는데 `routes/victoria/`에는 없는 것 —
> `assignment`, `attendance`, `grades`, `meeting`, `posts`, `resources`.
> 라우트 연결이 안 됐거나 다른 방식으로 등록돼 있는지 확인 필요.

### 폴더별 규칙

**Backend**
| 폴더 | 용도 | 하지 말 것 |
|---|---|---|
| `config/` | DB/외부 서비스 연결 설정 | 비즈니스 로직 넣기 |
| `controllers/` | 기능별 로직 (`xxx.controller.js`) | 라우팅 코드 넣기 |
| `routes/` | 라우트 등록 (`xxx.routes.js`) | 로직 작성 |
| `middleware/` | 요청 공통 처리 (인증, 업로드 등) | 특정 기능 전용 로직 |
| `scripts/` | 1회성/운영용 스크립트 | 서버 런타임 코드 |

**Frontend**
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

## 2. 병합 로그

`_incoming/`에서 파일을 정식 폴더로 옮기거나, 공용 폴더(`middleware/`, `config/`, `components/`, `services/`)를 수정할 때마다
**한 줄씩** 아래 표에 기록합니다. git blame으로 나중에 확인할 수도 있지만, 명령어 없이 표만 보고 바로
"이 파일 누구 것/왜 이렇게 됐는지"를 알기 위한 문서입니다. 병합이 다 끝나도 표는 지우지 않고 기록으로 남겨둡니다.

**사용법**: 파일 하나 처리할 때마다 (1) 아래 표에 한 줄 추가 (2) 그 파일만 따로 커밋
(여러 파일을 한 커밋에 묶지 않기 — 표와 커밋이 1:1로 안 맞게 됨):
```bash
git add nova-class-backend/controllers/thine/attendance.controller.js
git commit --author="Thine Htike Aung <teammate@email.com>" -m "merge: attendance.controller.js (teammate)"
```

| 날짜 | 파일 경로 | 원작성자 | 처리 방식 | 비고 |
|---|---|---|---|---|
| 2026-07-16 | (예시) `nova-class-backend/controllers/victoria/kmate.controller.js` | 팀원(Thine) | 팀원 버전 채택 | 내 버전보다 예외처리가 더 잘 되어 있어서 |
| 2026-07-16 | (예시) `nova-class-frontend/src/pages/victoria/KMate.jsx` | 나(Victoria) + 팀원 | 수동 병합 | 팀원은 UI만, 나는 로직만 있어서 합침 |

> 표에 없는 파일 = 아직 처리 안 됨. `_incoming/`을 비우기 전에 표와 대조해서 빠진 게 없는지 확인.

---

## 관련 문서
- 병합 절차: [`MERGE_GUIDE.md`](../MERGE_GUIDE.md)
- 프론트엔드 상세(구 문서, 일부 최신 구조와 다를 수 있음): [`nova-class-frontend/CLAUDE.md`](../nova-class-frontend/CLAUDE.md)
