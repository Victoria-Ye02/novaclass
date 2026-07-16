# 병합 로그

`_incoming/`에서 파일을 정식 폴더로 옮길 때마다 **한 줄씩** 여기에 기록합니다.
git blame으로 나중에 확인할 수도 있지만, 명령어 없이 표만 보고 바로 "이 파일 누구 것/왜 이렇게 됐는지"를 알기 위한 문서입니다.
병합이 다 끝나도 지우지 말고 기록으로 남겨둡니다 (`_incoming/`만 삭제).

## 사용법

파일 하나 옮길 때마다:
1. 아래 표에 한 줄 추가
2. 그 파일만 따로 커밋 (여러 파일 한 번에 묶어서 커밋하지 않기 — 그러면 표랑 커밋이 1:1로 안 맞음)
   ```bash
   git add nova-class-backend/controllers/kmate.controller.js
   git commit --author="Thine Htike Aung <teammate@email.com>" -m "merge: kmate.controller.js (teammate)"
   ```

## 기록

| 날짜 | 파일 경로 | 원작성자 | 처리 방식 | 비고 |
|---|---|---|---|---|
| 2026-07-16 | (예시) `nova-class-backend/controllers/kmate.controller.js` | 팀원(Thine) | 팀원 버전 채택 | 내 버전보다 예외처리가 더 잘 되어 있어서 |
| 2026-07-16 | (예시) `nova-class-frontend/src/pages/KMate.jsx` | 나(Victoria) + 팀원 | 수동 병합 | 팀원은 UI만, 나는 로직만 있어서 합침 |

> 표에 없는 파일 = 아직 병합 안 됨. `_incoming/`을 비우기 전에 표와 대조해서 빠진 게 없는지 확인.
