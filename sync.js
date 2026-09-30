// 계정 기반 저장 · 기기 간 동기화 (Firebase Auth + Firestore)
// 로그인 전이거나 firebase-config.js가 비어 있으면 이 기기(localStorage)에만 저장합니다.
import { firebaseConfig } from './firebase-config.js?v=3';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LOCAL_KEY = 'restarea-state-v2';
const MAX_ORDERS = 20;
export const STAMP_GOAL = 10;
const DEFAULT_STATE = { stamps: 7, coupons: 0, orders: [] };

export const configured = !!(firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR'));

let fb = null;
let user = null;
let ready = !configured;
let error = null;
let state = loadLocal();
let unsubDoc = null;
const listeners = new Set();

function snapshot() {
  return { user, state, configured, ready, error };
}
function emit() {
  listeners.forEach((fn) => fn(snapshot()));
}
export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

function normalize(d) {
  return {
    stamps: Math.max(0, d.stamps | 0),
    coupons: Math.max(0, d.coupons | 0),
    orders: Array.isArray(d.orders) ? d.orders.slice(0, MAX_ORDERS) : [],
  };
}
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    if (s) return normalize(s);
    const old = JSON.parse(localStorage.getItem('restarea-stamps') || 'null'); // 이전 버전 데이터
    if (old) return normalize({ stamps: old.n, coupons: old.c ? 1 : 0 });
  } catch (e) {}
  return normalize(DEFAULT_STATE);
}
function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch (e) {}
}

// 주문 1건 반영: 스탬프 적립, 10개마다 쿠폰 발급, 쿠폰 사용 차감
export function applyOrder(cur, order) {
  const s = normalize(cur);
  if (order.disc) {
    if (s.coupons < 1) throw new Error('coupon-used');
    s.coupons -= 1;
  }
  s.stamps += 1;
  let gotCoupon = false;
  if (s.stamps >= STAMP_GOAL) { s.stamps = 0; s.coupons += 1; gotCoupon = true; }
  s.orders = [order, ...s.orders].slice(0, MAX_ORDERS);
  return { state: s, gotCoupon };
}

export async function placeOrder(order) {
  if (user && fb) {
    const { db, fs } = fb;
    const ref = fs.doc(db, 'users', user.uid);
    return fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const r = applyOrder(snap.exists() ? snap.data() : state, order);
      tx.set(ref, { ...r.state, updatedAt: fs.serverTimestamp() });
      return r;
    });
  }
  const r = applyOrder(state, order);
  state = r.state;
  saveLocal();
  emit();
  return r;
}

async function init() {
  if (!configured) return;
  try {
    const [appM, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appM.initializeApp(firebaseConfig);
    const a = auth.getAuth(app);
    a.languageCode = 'ko';
    const db = fs.getFirestore(app);
    fb = { auth, a, fs, db };
    auth.getRedirectResult(a).catch((e) => { error = message(e); emit(); });

    auth.onAuthStateChanged(a, (u) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      state = loadLocal();
      user = u ? { uid: u.uid, name: u.displayName || u.email, email: u.email } : null;
      ready = true;
      if (u) {
        const ref = fs.doc(db, 'users', u.uid);
        unsubDoc = fs.onSnapshot(ref, (snap) => {
          if (!snap.exists()) {
            // 첫 로그인: 이 기기에 있던 스탬프·쿠폰을 계정으로 옮김
            fs.setDoc(ref, { ...state, updatedAt: fs.serverTimestamp() }).catch((e) => { error = message(e); emit(); });
            return;
          }
          state = normalize(snap.data());
          error = null;
          emit();
        }, (e) => { error = message(e); emit(); });
      }
      emit();
    });
  } catch (e) {
    ready = true;
    error = '동기화 서버에 연결하지 못했습니다. 이 기기에만 저장됩니다.';
    emit();
  }
}

export async function signInGoogle() {
  const { auth, a } = fb;
  const provider = new auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(a, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return auth.signInWithRedirect(a, provider);
    }
    throw new Error(message(e));
  }
}
export async function signInEmail(email, pw) {
  try { await fb.auth.signInWithEmailAndPassword(fb.a, email, pw); } catch (e) { throw new Error(message(e)); }
}
export async function signUpEmail(email, pw) {
  try { await fb.auth.createUserWithEmailAndPassword(fb.a, email, pw); } catch (e) { throw new Error(message(e)); }
}
export async function resetPassword(email) {
  try { await fb.auth.sendPasswordResetEmail(fb.a, email); } catch (e) { throw new Error(message(e)); }
}
export async function signOut() {
  await fb.auth.signOut(fb.a);
}

export function message(e) {
  const code = (e && e.code) || (e && e.message) || '';
  const map = {
    'coupon-used': '쿠폰이 이미 다른 기기에서 사용되었습니다.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/cancelled-popup-request': '로그인 창이 닫혔습니다.',
    'auth/unauthorized-domain': '이 주소는 Firebase 승인 도메인에 등록되지 않았습니다.',
    'auth/operation-not-allowed': 'Firebase 콘솔에서 이 로그인 방식을 사용 설정해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
    'permission-denied': '저장 권한이 없습니다. firestore.rules 설정을 확인해 주세요.',
    'unavailable': '오프라인 상태입니다. 연결되면 다시 시도해 주세요.',
  };
  for (const k in map) if (code.includes(k)) return map[k];
  return '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

init();
