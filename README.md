# 스마트 휴게소 — 고속도로 교통정보 앱 개선 제안

휴게소 **실시간 주차 빈 자리**, **메뉴 선결제·픽업(스탬프 10회 → 할인 쿠폰)**, **전기차 충전 현황**을
고속도로 교통정보 앱에 넣자는 제안 프로토타입입니다. 화면의 휴게소 수치는 모두 시연용 가상 데이터입니다.

- 제안서 페이지: `index.html`
- 앱 화면만 전체화면으로 보기: 주소 뒤에 `#app` (예: `https://<아이디>.github.io/restarea/#app`)
- 휴대폰에서는 목업 테두리 없이 화면 전체가 앱으로 동작합니다. 홈 화면에 추가하면 앱처럼 쓸 수 있습니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 제안서 + 앱 시연 화면 |
| `sync.js` | 로그인 · 계정 저장 · 기기 간 동기화 (Firebase Auth + Firestore) |
| `firebase-config.js` | Firebase 웹 설정값 (직접 채워 넣기) |
| `firestore.rules` | Firestore 보안 규칙 (본인 데이터만 읽기/쓰기) |

## 계정 동기화 켜기 (Firebase, 무료 요금제로 충분)

설정 전에는 스탬프·쿠폰·주문 내역이 **그 기기에만** 저장됩니다. 아래를 마치면 로그인한 계정에 저장되어
휴대폰·PC 어디서나 똑같이 보입니다.

1. <https://console.firebase.google.com> 에서 프로젝트 만들기
2. **빌드 → Authentication → 시작하기 → 로그인 방법**에서 `Google`과 `이메일/비밀번호` 사용 설정
3. **Authentication → 설정 → 승인된 도메인**에 `<GitHub 아이디>.github.io` 추가
4. **빌드 → Firestore Database → 데이터베이스 만들기** (프로덕션 모드, 위치 `asia-northeast3 (서울)`)
5. Firestore **규칙** 탭에 `firestore.rules` 내용을 붙여넣고 게시
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가(</>)** 후 나오는 `firebaseConfig` 값을 `firebase-config.js`에 붙여넣기
7. 커밋 후 GitHub Desktop에서 **Push origin**

> `firebase-config.js`의 값은 공개되어도 되는 웹 설정값입니다. 데이터 보호는 `firestore.rules`가 담당합니다.
> 카카오톡 등 인앱 브라우저에서는 Google 로그인이 막힐 수 있으니 이메일 로그인을 쓰거나 기본 브라우저로 여세요.

저장 구조: `users/{uid}` 문서에 `{ stamps, coupons, orders[최근 20건], updatedAt }`.
주문은 트랜잭션으로 저장되어 두 기기에서 동시에 주문해도 스탬프가 누락되지 않고, 쿠폰도 한 번만 쓰입니다.

## GitHub Pages로 공개하기

1. GitHub Desktop에서 **Publish repository** (공개 저장소여야 무료 Pages 사용 가능)
2. GitHub 저장소 → **Settings → Pages → Build and deployment**에서
   Source `Deploy from a branch`, Branch `main` / `/ (root)` 선택 후 Save
3. 1~2분 뒤 `https://<GitHub 아이디>.github.io/<저장소 이름>/` 에서 접속

## 로컬에서 보기

ES 모듈을 쓰기 때문에 파일을 더블클릭하면 동작하지 않습니다. 간단한 서버로 여세요.

```bash
python -m http.server 8000
```
