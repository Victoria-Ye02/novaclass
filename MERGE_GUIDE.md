# NovaClass 병합 가이드

이 문서는 Victoria와 Thine이 각자 독립적으로 진행한 NovaClass 코드를
하나의 저장소(`NovaClass`)로 합치기 위한 규칙입니다.
**팀원은 이 문서를 AI에게 그대로 전달해서, `_incoming/` 안의 코드를 아래 규칙에 맞게 정리하도록 시키면 됩니다.**

---

## 1. 최종 폴더 구조 (이미 존재함, 변경 금지)

`routes/`, `controllers/`, `pages/`는 **이름별 하위 폴더**로 나뉘어 있어서
각자 자기 폴더에만 파일을 넣으면 서로 파일이 섞이거나 덮어쓸 일이 없습니다. 상세는 [`docs/PROJECT.md`](docs/PROJECT.md) 참고.

```
NovaClass/
├── nova-class-backend/
│   ├── config/                  ← 공용, 건드리지 않기
│   ├── controllers/
│   │   ├── victoria/            ← Victoria 전용
│   │   └── thine/                ← ★ 팀원은 여기에만 컨트롤러 추가
│   ├── routes/
│   │   ├── victoria/
│   │   └── thine/                ← ★ 팀원은 여기에만 라우트 추가
│   ├── middleware/, scripts/    ← 공용, 건드리지 않기
│   └── server.js                ← ★ 모든 라우트를 불러 마운트하는 유일한 지점
│
├── nova-class-frontend/src/
│   ├── pages/
│   │   ├── victoria/
│   │   └── thine/                ← ★ 팀원은 여기에만 페이지 추가
│   ├── components/, services/   ← 공용, 건드리지 않기
│   └── App.jsx                  ← ★ 모든 페이지를 불러 라우팅하는 유일한 지점
│
└── _incoming/                    ← 위 규칙에 안 맞는 애매한 파일만 임시로 넣는 곳
```

## 2. 파일 배치 규칙

- 새 파일은 **자기 이름 폴더**(`.../thine/`)에만 넣습니다. `victoria/` 폴더는 건드리지 않습니다.
- 기능 이름은 레이어(controller/route/page)에 걸쳐 **동일하게** 맞춥니다.
  - 예: `attendance` 기능 → `controllers/thine/attendance.controller.js` + `routes/thine/attendance.routes.js` + `pages/thine/Attendance.jsx`
- `routes/*.routes.js`에는 라우팅 등록만 두고, 실제 로직은 `controllers/`로.
- `middleware/`, `config/`, `services/`, `components/` 같은 공용 폴더에 새 파일이 필요하면 임의로 넣지 말고
  `_incoming/`에 넣어서 리뷰 후 반영 (공용 파일은 충돌 영향이 크므로).

## 3. 팀원(및 팀원의 AI)이 할 일

1. 본인이 작성한 컨트롤러/라우트/페이지를 각각
   `nova-class-backend/controllers/thine/`, `nova-class-backend/routes/thine/`, `nova-class-frontend/src/pages/thine/` 에 직접 추가합니다.
   (이미 이름별로 폴더가 분리돼 있어서 Victoria 파일과 섞이지 않습니다 — 별도 이동/비교 단계 불필요)
2. `nova-class-backend/server.js`에 본인 라우트를 mount하는 줄을 추가:
   ```js
   app.use("/api/xxx", require("./routes/thine/xxx.routes"));
   ```
3. `nova-class-frontend/src/App.jsx`에 본인 페이지 import + `<Route>` 를 추가.
4. `config/`, `middleware/`, `components/`, `services/` 같은 **공용 폴더를 수정해야 하는 경우만**
   `_incoming/`에 파일을 넣고 AI에게 "기존 파일과 비교해서 충돌 여부 보고" 요청 (자동 덮어쓰기 금지).
5. 새로 추가/수정한 파일은 [`docs/PROJECT.md`](docs/PROJECT.md#2-병합-로그)의 병합 로그 표에 한 줄씩 기록 + 파일 단위로 커밋
   (`--author`로 원작성자 지정). 여러 파일을 한 커밋에 묶지 않습니다.

## 4. 병합 후 (git)

- 두 사람 커밋 기록을 보존하려면 `git remote add teammate <경로>` → `git fetch teammate` →
  `git merge --allow-unrelated-histories teammate/main` 로 진행 (파일 복사가 아니라 git 병합 권장).
- 이후 새 기능은 폴더 분리 대신 **기능별 브랜치**(`feat/기능명`)로 작업하고 PR로 합칩니다.
