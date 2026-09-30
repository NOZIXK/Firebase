// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"에서 값을 복사해 붙여넣으세요.
// 이 값들은 공개되어도 괜찮은 웹 설정값입니다. 데이터 보호는 firestore.rules가 담당합니다.
// 값을 채우기 전에는 로그인 없이 "이 기기에만 저장" 모드로 동작합니다.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
