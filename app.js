import { subscribe, placeOrder, message as syncMessage, STAMP_GOAL, signInGoogle, signInEmail, signUpEmail, resetPassword, signOut } from './sync.js?v=3';

// ---------------- data (시연용 가상 데이터) ----------------
const AREAS = [
  { id: 'an', name: '안성휴게소', short: '안성', dist: 6, target: 0.95, seed: 3 },
  { id: 'ip', name: '입장휴게소', short: '입장', dist: 21, target: 0.55, seed: 7 },
  { id: 'cs', name: '천안삼거리휴게소', short: '천안삼거리', dist: 34, target: 0.78, seed: 11 },
  { id: 'jc', name: '죽암휴게소', short: '죽암', dist: 62, target: 0.38, seed: 17 },
];
const SPEED = 90; // km/h 가정
const ROWS = [
  { key: 'A', n: 12, type: 'car' },
  { key: 'B', n: 12, type: 'car', laneBefore: true },
  { key: 'C', n: 12, type: 'car' },
  { key: 'D', n: 12, type: 'car', laneBefore: true },
  { key: 'E', n: 12, type: 'car' },
  { key: 'L', n: 7, type: 'big', laneBefore: true, label: '대형 · 버스 · 화물' },
];
const MENU = [
  { id: 'udon', name: '가락우동', price: 6500, min: 6, c: '#f3e3c3' },
  { id: 'don', name: '돈가스', price: 9500, min: 9, c: '#f1d6c4' },
  { id: 'ramen', name: '라면', price: 5000, min: 5, c: '#f6d2cf' },
  { id: 'walnut', name: '호두과자 (중)', price: 5000, min: 2, c: '#e6dccd' },
  { id: 'sotteok', name: '소떡소떡', price: 4000, min: 3, c: '#f7dcd2' },
  { id: 'coffee', name: '아메리카노', price: 3500, min: 2, c: '#ddd8d0' },
];

const $ = (s) => document.querySelector(s);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.2 2.3 2.3 4.7-5"/></svg>';

AREAS.forEach((a) => {
  const r = rnd(a.seed * 999 + 1);
  a.spots = [];
  ROWS.forEach((row) => {
    for (let i = 1; i <= row.n; i++) {
      a.spots.push({ id: row.key + '-' + String(i).padStart(2, '0'), row: row.key, col: i, type: row.type, busy: r() < a.target });
    }
  });
  const cr = rnd(a.seed * 31 + 5);
  a.chargers = Array.from({ length: 6 }, (_, i) => {
    const fast = i < 4;
    let state = cr() < a.target * 0.95 ? 'busy' : 'free';
    if (i === 5 && a.seed % 2) state = 'off';
    return { no: i + 1, fast, kw: fast ? (i < 2 ? 200 : 100) : 7, state, pct: Math.floor(30 + cr() * 60), left: Math.floor(5 + cr() * 35) };
  });
});

let cur = AREAS[0];
let picked = null;

const occ = (a) => a.spots.filter((s) => s.busy).length / a.spots.length;
const freeOf = (a, type) => a.spots.filter((s) => !s.busy && (!type || s.type === type)).length;
const eta = (a) => Math.max(1, Math.round((a.dist / SPEED) * 60));
const color = (o) => (o >= 0.9 ? 'var(--busy)' : o >= 0.7 ? 'var(--warn)' : 'var(--free)');
const level = (o) => (o >= 0.9 ? '혼잡' : o >= 0.7 ? '보통' : '여유');
const pct = (o) => Math.round(o * 100) + '%';
function nextBetter(a) {
  const idx = AREAS.indexOf(a);
  return AREAS.slice(idx + 1).find((x) => occ(x) < 0.7) || null;
}
function setNum(el, v) {
  const s = String(v);
  if (el.textContent === s) return;
  el.textContent = s;
  el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
}

// ---------------- hero: route + big lot ----------------
function renderRoute() {
  $('#route').innerHTML = AREAS.map((a) => {
    const o = occ(a);
    return `<button class="stop ${a === cur ? 'active' : ''}" data-id="${a.id}">
      <span class="pin"><i style="background:${color(o)}"></i></span>
      <div class="stop-name">${a.short}</div>
      <div class="stop-sub">${a.dist}km<span class="lvl"> · ${level(o)}</span></div>
      <div class="stop-free">${freeOf(a)}<small>면</small></div>
    </button>`;
  }).join('');
}
$('#route').addEventListener('click', (e) => {
  const b = e.target.closest('.stop');
  if (b) selectArea(AREAS.find((a) => a.id === b.dataset.id));
});

let bigLotArea = null;
function renderBigLot() {
  const a = cur;
  const grid = $('#bigLot');
  const cars = a.spots.filter((s) => s.type === 'car');
  if (bigLotArea !== a) {
    let h = '';
    cars.forEach((s, i) => {
      if (i && i % 20 === 0) h += '<span class="gap"></span>';
      h += `<b data-i="${i}"></b>`;
    });
    grid.innerHTML = h;
    bigLotArea = a;
  }
  grid.querySelectorAll('b').forEach((el) => el.classList.toggle('busy', cars[+el.dataset.i].busy));
  const o = occ(a);
  $('#kpiName').textContent = a.name;
  setNum($('#kpiFree'), freeOf(a));
  $('#kpiTotal').textContent = `빈 자리 / ${a.spots.length}면`;
  $('#kpiBar').style.width = pct(o);
  $('#kpiBar').style.background = color(o);
  $('#kpiOcc').textContent = `${pct(o)} · ${level(o)}`;
  const alt = nextBetter(a);
  $('#kpiAdvice').innerHTML = o >= 0.9 && alt
    ? `혼잡합니다. <b>${alt.dist - a.dist}km 앞 ${alt.short}</b>에 빈 자리 ${freeOf(alt)}면.`
    : `도착까지 약 <b>${eta(a)}분</b>. 추천 칸으로 바로 안내합니다.`;
}

// ---------------- bento ----------------
function renderBento() {
  $('#occList').innerHTML = AREAS.map((a) => {
    const o = occ(a);
    return `<div class="occ-row"><b>${a.short}</b><div class="bar"><i style="width:${pct(o)};background:${color(o)}"></i></div><span class="mono">${pct(o)}</span></div>`;
  }).join('');
  setNum($('#sumFree'), AREAS.reduce((s, a) => s + freeOf(a), 0));
  const full = AREAS.find((a) => occ(a) >= 0.9);
  const alt = full && nextBetter(full);
  $('#divert').innerHTML = full && alt
    ? `<b>${full.short} ${pct(occ(full))} → ${alt.short}</b>${alt.dist - full.dist}km 더 가면 빈 자리 ${freeOf(alt)}면`
    : '<b>경로 전체 여유</b>가까운 휴게소를 이용하세요';
  const ev = AREAS[1];
  $('#evTileName').textContent = `${ev.name} 충전기`;
  const bars = $('#evBars');
  if (!bars.children.length) bars.innerHTML = ev.chargers.map(() => '<i></i>').join('');
  [...bars.children].forEach((el, i) => {
    const c = ev.chargers[i];
    el.style.setProperty('--h', c.state === 'busy' ? c.pct + '%' : c.state === 'free' ? '100%' : '0%');
    el.style.setProperty('--c', c.state === 'free' ? '#4ade80' : '#fff');
  });
}

// ---------------- area selector (app) ----------------
function renderAreas() {
  $('#areaSelect').innerHTML = AREAS.map((a) => {
    const o = occ(a);
    return `<button class="area-btn ${a === cur ? 'active' : ''}" data-id="${a.id}">
      <b>${a.short}</b><small><i class="dot" style="background:${color(o)}"></i>${a.dist}km · ${level(o)}</small></button>`;
  }).join('');
}
$('#areaSelect').addEventListener('click', (e) => {
  const b = e.target.closest('.area-btn');
  if (b) selectArea(AREAS.find((a) => a.id === b.dataset.id));
});
function selectArea(a) {
  cur = a; picked = null;
  renderAll();
  $('#appBody').scrollTop = 0;
}

// ---------------- parking (app) ----------------
function recommend(a) {
  const mid = 6.5;
  const rowIdx = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  let best = null, bestD = Infinity;
  a.spots.forEach((s) => {
    if (s.busy || s.type !== 'car') return;
    const d = rowIdx[s.row] * 3 + Math.abs(s.col - mid);
    if (d < bestD) { bestD = d; best = s; }
  });
  return best;
}

let lotArea = null;
function renderLot() {
  const a = cur;
  if (picked && picked.busy) picked = null;
  const rec = recommend(a);
  const lot = $('#lot');
  if (lotArea !== a) {
    let html = '<div class="building"><span>푸드코트</span><span>화장실</span><span>편의점</span></div>';
    ROWS.forEach((row) => {
      if (row.laneBefore) html += '<div class="lane"></div>';
      if (row.label) html += `<div class="row-label">${row.label}</div>`;
      html += `<div class="row" style="grid-template-columns:repeat(${row.n},1fr)">`;
      a.spots.filter((s) => s.row === row.key).forEach((s) => {
        html += `<button class="spot${s.type === 'big' ? ' big' : ''}" data-id="${s.id}">${s.type === 'big' ? s.id.slice(2) : ''}</button>`;
      });
      html += '</div>';
    });
    html += '<div class="entry"><span>← 출구 · 본선 합류</span><span>입구 ←</span></div>';
    lot.innerHTML = html;
    lotArea = a;
  }
  lot.querySelectorAll('.spot').forEach((el) => {
    const s = a.spots.find((x) => x.id === el.dataset.id);
    el.classList.toggle('busy', s.busy);
    el.classList.toggle('free', !s.busy);
    el.classList.toggle('rec', !!rec && s === rec && !picked);
    el.classList.toggle('pick', picked === s);
    el.title = `${s.id} ${s.busy ? '주차 중' : '빈 자리'}`;
  });
  const target = picked || rec;
  $('#recLabel').textContent = picked ? '선택한 자리' : '건물에서 가장 가까운 빈 자리';
  $('#recSpot').textContent = target ? `${target.id} 구역` : '빈 자리 없음';
  $('#recBox').style.opacity = target ? 1 : 0.6;
}
$('#lot').addEventListener('click', (e) => {
  const b = e.target.closest('.spot');
  if (!b) return;
  const s = cur.spots.find((x) => x.id === b.dataset.id);
  if (s.busy) { toast(`${s.id} 칸은 주차 중입니다`); return; }
  picked = picked === s ? null : s;
  renderLot();
  if (picked) toast(`${s.id} 칸으로 안내를 시작합니다`);
});

function renderPark() {
  const a = cur, o = occ(a);
  $('#parkName').textContent = a.name;
  $('#parkDist').textContent = `${a.dist}KM 앞`;
  setNum($('#sFree'), freeOf(a));
  setNum($('#sBig'), freeOf(a, 'big'));
  $('#sEta').textContent = eta(a) + '분';
  $('#occBar').style.width = pct(o);
  $('#occBar').style.background = color(o);
  $('#occText').textContent = `${pct(o)} · ${level(o)}`;

  const alt = nextBetter(a);
  const show = o >= 0.9;
  $('#fullAlert').classList.toggle('show', show);
  if (show) {
    $('#fullTitle').textContent = `${a.name} 혼잡 ${pct(o)}`;
    $('#fullMsg').textContent = alt
      ? `${alt.dist - a.dist}km 더 가면 ${alt.name}에 빈 자리 ${freeOf(alt)}면이 있습니다.`
      : '경로상 다른 휴게소도 혼잡합니다.';
    $('#fullGo').style.display = alt ? '' : 'none';
    $('#fullGo').onclick = () => { selectArea(alt); toast(`${alt.name}(으)로 안내합니다`); };
  }
  renderLot();
}


// ---------------- 3D scene ----------------
const STALL = { w: 34, h: 54, x0: 160, bands: [318, 410, 512] };
const CAR_COLORS = ['#e9e9e4', '#bfc1ba', '#3b3d38', '#f4f4ef', '#8a8d86', '#1f3b57', '#7b2d26', '#d9d9d3', '#5d6b5f'];
const FACES = '<i class="f-top"></i><i class="f-s"></i><i class="f-n"></i><i class="f-e"></i><i class="f-w"></i>';
const stallPos = (i) => ({ x: STALL.x0 + (i % 20) * STALL.w, y: STALL.bands[Math.floor(i / 20)] });
function buildScene() {
  const pick = rnd(42);
  let h = '';
  for (let i = 0; i < 60; i++) {
    const p = stallPos(i);
    const c = CAR_COLORS[Math.floor(pick() * CAR_COLORS.length)];
    h += `<div class="stall" data-i="${i}" style="left:${p.x}px;top:${p.y}px"><div class="box3d car" style="--c:${c}">${FACES}</div></div>`;
  }
  $('#stalls').innerHTML = h;
  const lanes = [{ y: 5, w: true }, { y: 35, w: true }, { y: 70, w: false }, { y: 100, w: false }];
  let hc = '';
  for (let i = 0; i < 12; i++) {
    const lane = lanes[i % 4];
    const dur = 7 + pick() * 6;
    const c = CAR_COLORS[Math.floor(pick() * CAR_COLORS.length)];
    hc += `<div class="box3d hcar${lane.w ? ' w' : ''}" style="top:${lane.y}px;--c:${c};animation-duration:${dur.toFixed(1)}s;animation-delay:-${(pick() * dur).toFixed(1)}s">${FACES}</div>`;
  }
  $('#highway').insertAdjacentHTML('beforeend', hc);
}
function fitScene() {
  const sc = $('#scene3d');
  const fit = Math.min(sc.clientWidth / 1120, sc.clientHeight / 640);
  $('#world').style.setProperty('--fit', Math.max(0.28, fit).toFixed(3));
}
function renderScene() {
  const a = cur;
  const cars = a.spots.filter((s) => s.type === 'car');
  const rec = recommend(a);
  const recIdx = rec ? cars.indexOf(rec) : -1;
  document.querySelectorAll('#stalls .stall').forEach((el) => {
    const i = +el.dataset.i;
    el.classList.toggle('free', !cars[i].busy);
    el.classList.toggle('rec', i === recIdx);
  });
  const tag = $('#recTag');
  tag.style.opacity = recIdx < 0 ? 0 : 1;
  if (recIdx >= 0) {
    const p = stallPos(recIdx);
    tag.style.setProperty('--tx', p.x + STALL.w / 2 + 'px');
    tag.style.setProperty('--ty', p.y + STALL.h / 2 + 'px');
    $('#recTagId').textContent = rec.id;
  }
  const free = cars.filter((s) => !s.busy).length;
  const o = cars.filter((s) => s.busy).length / cars.length;
  setNum($('#hudFree'), free);
  $('#hudArea').textContent = `${a.name} · 소형 ${cars.length}면`;
  $('#hudOcc').textContent = pct(o);
  $('#hudLevel').textContent = level(o);
}
buildScene();
fitScene();
window.addEventListener('resize', fitScene);

// ---------------- order ----------------
const cart = {};
let acct = { user: null, state: { stamps: 0, coupons: 0, orders: [] }, configured: false, ready: false, error: null };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderStamps() {
  const n = acct.state.stamps;
  let h = '';
  for (let i = 1; i <= STAMP_GOAL; i++) {
    h += `<div class="stamp ${i <= n ? 'on' : ''} ${i === STAMP_GOAL && n < STAMP_GOAL ? 'last' : ''}">${i <= n ? CHECK : i}</div>`;
  }
  $('#stamps').innerHTML = h;
  $('#stampText').textContent = `${n} / ${STAMP_GOAL}`;
  const c = acct.state.coupons;
  $('#coupon').classList.toggle('show', c > 0);
  $('#coupon span').textContent = `2,000원 할인 쿠폰 ${c}장`;
  const line = $('#syncLine');
  if (acct.user) line.innerHTML = '<i class="on"></i><span>계정에 저장 · 모든 기기에서 동기화</span>';
  else if (acct.configured) line.innerHTML = '<i></i><span>이 기기에만 저장됨</span><button data-open-acct>로그인하고 동기화</button>';
  else line.innerHTML = '<i></i><span>이 기기에만 저장됨</span>';
}
function renderHistory() {
  const list = acct.state.orders;
  $('#histNote').textContent = acct.user ? '계정 동기화' : '이 기기';
  $('#history').innerHTML = list.length
    ? list.slice(0, 5).map((o) => {
        const d = new Date(o.at);
        const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `<div class="hist-item"><div><b>${esc(o.area)} · ${esc(o.no)}</b><span>${esc(o.summary)}</span></div><div style="text-align:right"><b>${won(o.total)}</b><span>${when}</span></div></div>`;
      }).join('')
    : '<div style="font-size:12px;color:var(--ink-3)">아직 주문 내역이 없어요.</div>';
}
function renderMenu() {
  $('#menuTitle').textContent = cur.short + ' 메뉴';
  $('#menu').innerHTML = MENU.map((m) => `
    <div class="menu-item">
      <div class="thumb" style="background:${m.c}">${m.name.slice(0, 1)}</div>
      <div class="menu-info"><b>${m.name}</b><span>${won(m.price)} · 조리 ${m.min}분</span></div>
      <div class="qty">
        <button data-m="${m.id}" data-d="-1" aria-label="${m.name} 빼기">−</button>
        <b>${cart[m.id] || 0}</b>
        <button data-m="${m.id}" data-d="1" aria-label="${m.name} 담기">+</button>
      </div>
    </div>`).join('');
  renderCheckout();
}
$('#menu').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-m]');
  if (!b) return;
  const id = b.dataset.m;
  cart[id] = Math.max(0, Math.min(9, (cart[id] || 0) + +b.dataset.d));
  renderMenu();
});
$('#useCoupon').addEventListener('change', renderCheckout);

function totals() {
  const items = MENU.filter((m) => cart[m.id]);
  const sub = items.reduce((s, m) => s + m.price * cart[m.id], 0);
  const disc = acct.state.coupons > 0 && $('#useCoupon').checked && sub > 0 ? Math.min(2000, sub) : 0;
  const cook = items.reduce((mx, m) => Math.max(mx, m.min), 0);
  return { items, sub, disc, total: sub - disc, cook };
}
function renderCheckout() {
  const t = totals();
  $('#subTotal').textContent = won(t.sub);
  $('#discRow').style.display = t.disc ? '' : 'none';
  $('#total').textContent = won(t.total);
  const btn = $('#payBtn');
  btn.disabled = !t.sub;
  btn.textContent = t.sub ? `${won(t.total)} 선결제` : '메뉴를 담아주세요';
  const e = eta(cur);
  const startIn = Math.max(0, e - t.cook);
  $('#orderEta').innerHTML = t.sub
    ? `${cur.name}까지 약 <b>${e}분</b>. 도착 ${t.cook}분 전${startIn ? `(약 ${startIn}분 후)` : ''}부터 조리해 도착하면 바로 픽업할 수 있어요.`
    : `${cur.name}까지 약 <b>${e}분</b>. 이동 중에 주문하고 도착하면 바로 픽업하세요.`;
}

let orderTimer = null;
$('#payBtn').addEventListener('click', async () => {
  const t = totals();
  if (!t.sub) return;
  const btn = $('#payBtn');
  const no = 'A-' + String(100 + Math.floor(Math.random() * 800));
  const order = {
    no, at: Date.now(), area: cur.name, total: t.total, disc: t.disc,
    summary: t.items.map((m) => `${m.name}×${cart[m.id]}`).join(', '),
  };
  let gotCoupon, stampNow;
  btn.disabled = true; btn.textContent = '결제 중…';
  try {
    const r = await placeOrder(order);
    gotCoupon = r.gotCoupon;
    stampNow = r.state.stamps;
  } catch (err) {
    toast(syncMessage(err));
    renderCheckout();
    return;
  }

  $('#orderNo').textContent = no;
  $('#orderWhere').textContent = `${cur.name} 푸드코트 픽업대`;
  $('#orderSummary').innerHTML =
    t.items.map((m) => `<div class="sum-row"><span>${m.name} × ${cart[m.id]}</span><span>${won(m.price * cart[m.id])}</span></div>`).join('') +
    (t.disc ? `<div class="sum-row disc"><span>쿠폰 할인</span><span>-${won(t.disc)}</span></div>` : '') +
    `<div class="sum-row total"><span>결제 완료</span><span>${won(t.total)}</span></div>` +
    `<div style="font-size:12px;color:var(--ink-3);margin-top:8px">스탬프 1개 적립 ${gotCoupon ? '· 10회 달성, 할인 쿠폰이 발급되었어요' : `(${stampNow}/${STAMP_GOAL})`}</div>`;

  $('#orderForm').style.display = 'none';
  $('#orderStatus').classList.add('show');
  $('#appBody').scrollTop = 0;
  const e = eta(cur);
  const startIn = Math.max(0, e - t.cook);
  const steps = [
    ['결제 완료', '주문이 매장에 전달되었어요'],
    ['조리 대기', startIn ? `도착 ${t.cook}분 전 조리 시작 (약 ${startIn}분 후)` : '도착이 가까워 바로 조리를 시작해요'],
    ['조리 중', `예상 조리 시간 ${t.cook}분`],
    ['픽업 대기', '픽업대에서 주문번호를 보여주세요'],
  ];
  let i = 0;
  const draw = () => {
    $('#steps').innerHTML = steps.map((s, k) =>
      `<div class="step ${k < i ? 'done' : k === i ? 'now' : ''}"><i>${k < i ? CHECK : k + 1}</i><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('');
  };
  draw();
  clearInterval(orderTimer);
  orderTimer = setInterval(() => {
    i++; draw();
    if (i >= steps.length - 1) { clearInterval(orderTimer); toast(`주문 ${no} 픽업 준비 완료`); }
  }, 2200);
  toast(gotCoupon ? '10회 이용 달성 · 할인 쿠폰 발급' : '결제가 완료되었습니다');
  for (const k in cart) delete cart[k];
});
$('#newOrder').addEventListener('click', () => {
  clearInterval(orderTimer);
  $('#orderStatus').classList.remove('show');
  $('#orderForm').style.display = '';
  renderMenu();
});

// ---------------- EV ----------------
function renderEV() {
  const a = cur;
  $('#evName').textContent = a.name + ' 충전소';
  const free = a.chargers.filter((c) => c.state === 'free').length;
  const busy = a.chargers.filter((c) => c.state === 'busy');
  setNum($('#evFree'), free);
  setNum($('#evBusy'), busy.length);
  $('#evWait').textContent = free ? '0분' : (Math.min(...busy.map((c) => c.left)) + '분');
  $('#chargers').innerHTML = a.chargers.map((c) => {
    const st = c.state;
    const bg = st === 'free' ? 'background:var(--free-soft);color:#11803b' : st === 'busy' ? 'background:#efefea;color:var(--ink)' : 'background:#efefea;color:var(--ink-3)';
    const badge = st === 'free' ? '<span class="badge b-free">사용 가능</span>'
      : st === 'busy' ? `<span class="badge b-busy">${c.left}분 남음</span>` : '<span class="badge b-off">점검 중</span>';
    return `<div class="charger"><div class="ic" style="${bg}">${c.kw}</div>
      <div class="info"><b>${c.no}번 · ${c.fast ? '급속' : '완속'} ${c.kw}kW</b>
        <span>${st === 'busy' ? `충전 중 ${c.pct}%` : st === 'free' ? 'DC콤보 · 차데모 · AC3상' : '다른 충전기를 이용해 주세요'}</span>
        ${st === 'busy' ? `<div class="mini-bar"><i style="width:${c.pct}%"></i></div>` : ''}
      </div>${badge}</div>`;
  }).join('');
  $('#evAlt').innerHTML = AREAS.filter((x) => x !== a).map((x) => {
    const f = x.chargers.filter((c) => c.state === 'free').length;
    return `<div class="alt-row"><span>${x.name} <span class="mono muted">${x.dist}KM</span></span><b style="color:${f ? 'var(--free)' : 'var(--ink-3)'}">${f}대</b></div>`;
  }).join('');
}

// ---------------- tabs ----------------
function setTab(t) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + t));
  document.querySelectorAll('.feature').forEach((f) => f.classList.toggle('active', f.dataset.go === t));
  $('#appBody').scrollTop = 0;
}
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setTab(b.dataset.tab);
});
document.querySelectorAll('.feature').forEach((f) => f.addEventListener('click', () => {
  setTab(f.dataset.go);
  if (window.innerWidth <= 980) document.querySelector('.phone').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

// ---------------- toast / clock ----------------
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
function tickClock() {
  const d = new Date();
  const s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  $('#clock').textContent = s;
  $('#heroClock').textContent = s;
}

// ---------------- live simulation ----------------
function simulate() {
  AREAS.forEach((a) => {
    for (let k = 0; k < 3; k++) {
      const s = a.spots[Math.floor(Math.random() * a.spots.length)];
      const o = occ(a);
      // 목표 점유율 쪽으로 천천히 수렴
      if (s.busy && (o > a.target || Math.random() < 0.25)) s.busy = false;
      else if (!s.busy && (o < a.target || Math.random() < 0.25)) s.busy = true;
    }
    a.chargers.forEach((c) => {
      if (c.state === 'busy') {
        c.left = Math.max(0, c.left - 1); c.pct = Math.min(100, c.pct + 2);
        if (c.left === 0) c.state = 'free';
      } else if (c.state === 'free' && Math.random() < 0.08) {
        c.state = 'busy'; c.pct = Math.floor(15 + Math.random() * 40); c.left = Math.floor(15 + Math.random() * 25);
      }
    });
  });
  renderAll();
}

function renderAll() {
  renderRoute();
  renderScene();
  renderBigLot();
  renderBento();
  renderAreas();
  renderPark();
  renderEV();
  if (!$('#orderStatus').classList.contains('show')) renderCheckout();
  $('#menuTitle').textContent = cur.short + ' 메뉴';
}

// ---------------- account ----------------
let sheetMode = 'login';
let sheetBusy = false;
const screen = document.querySelector('.screen');
function openSheet(mode) {
  sheetMode = mode || (acct.user ? 'profile' : 'login');
  renderSheet();
  screen.classList.add('sheet-open');
}
function closeSheet() { screen.classList.remove('sheet-open'); }
$('#sheetBg').addEventListener('click', closeSheet);
$('#acctBtn').addEventListener('click', () => openSheet());
document.addEventListener('click', (e) => { if (e.target.closest('[data-open-acct]')) openSheet('login'); });

function renderSheet() {
  const body = $('#sheetBody');
  if (!acct.configured) {
    body.innerHTML = `<h3>계정 동기화 준비 중</h3>
      <p>동기화 서버(Firebase)가 아직 연결되지 않았습니다. 지금은 스탬프·쿠폰·주문 내역이 이 기기에만 저장됩니다.</p>
      <p style="font-size:12px;color:var(--ink-3)">관리자: <code>firebase-config.js</code>에 Firebase 웹 설정을 넣으면 로그인과 기기 간 동기화가 켜집니다.</p>
      <button class="btn btn-ghost" data-close>닫기</button>`;
  } else if (!acct.ready) {
    body.innerHTML = '<h3>연결 중…</h3><p>계정 정보를 불러오고 있습니다.</p>';
  } else if (acct.user) {
    const u = acct.user;
    body.innerHTML = `<h3>내 계정</h3>
      <div class="profile"><div class="avatar">${esc((u.name || '?').slice(0, 1).toUpperCase())}</div>
        <div style="min-width:0"><b style="display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis">${esc(u.name || '')}</b>
        <span style="font-size:12px;color:var(--ink-3)">${esc(u.email || '')}</span></div></div>
      <p>스탬프 ${acct.state.stamps}개 · 쿠폰 ${acct.state.coupons}장 · 주문 ${acct.state.orders.length}건이 계정에 저장되어 있어요. 같은 계정으로 로그인하면 휴대폰·PC 어디서나 똑같이 보입니다.</p>
      <button class="btn btn-ghost" data-act="logout">로그아웃</button>
      <button class="btn btn-ghost" data-close style="border:0">닫기</button>`;
  } else {
    const signup = sheetMode === 'signup';
    const reset = sheetMode === 'reset';
    body.innerHTML = `<h3>${reset ? '비밀번호 재설정' : signup ? '회원가입' : '로그인'}</h3>
      <p>${reset ? '가입한 이메일로 재설정 링크를 보내드립니다.' : '로그인하면 스탬프·쿠폰·주문 내역이 계정에 저장되어 모든 기기에서 동기화됩니다.'}</p>
      ${reset ? '' : `<button class="btn btn-ghost" data-act="google">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Google로 계속하기</button>
      <div class="or">또는 이메일</div>`}
      <form id="authForm" novalidate>
        <input type="email" name="email" placeholder="이메일" autocomplete="email" required>
        ${reset ? '' : `<input type="password" name="pw" placeholder="비밀번호 (6자 이상)" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="6">`}
        <div class="form-err" id="formErr">${esc(acct.error || '')}</div>
        <button class="btn btn-primary" type="submit">${reset ? '재설정 메일 보내기' : signup ? '가입하고 동기화 시작' : '이메일로 로그인'}</button>
      </form>
      <div class="link-row">
        <button data-mode="${signup || reset ? 'login' : 'signup'}">${signup || reset ? '로그인으로 돌아가기' : '처음이신가요? 회원가입'}</button>
        ${signup || reset ? '' : '<button data-mode="reset">비밀번호 찾기</button>'}
      </div>`;
    const form = $('#authForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sheetBusy) return;
      const email = form.email.value.trim();
      const pw = form.pw ? form.pw.value : '';
      const err = $('#formErr');
      if (!email) { err.textContent = '이메일을 입력해 주세요.'; return; }
      if (!reset && pw.length < 6) { err.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
      sheetBusy = true; err.textContent = '';
      try {
        if (reset) { await resetPassword(email); toast('재설정 메일을 보냈습니다'); sheetMode = 'login'; renderSheet(); }
        else if (signup) await signUpEmail(email, pw);
        else await signInEmail(email, pw);
      } catch (ex) { err.textContent = ex.message; }
      sheetBusy = false;
    });
  }
}
$('#sheetBody').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-close')) return closeSheet();
  if (b.dataset.mode) { sheetMode = b.dataset.mode; return renderSheet(); }
  if (b.dataset.act === 'google') {
    try { await signInGoogle(); } catch (ex) { const el = $('#formErr'); if (el) el.textContent = ex.message; }
  }
  if (b.dataset.act === 'logout') { await signOut(); closeSheet(); toast('로그아웃했습니다. 이 기기 저장 모드로 전환됩니다'); }
});

let prevUid;
subscribe((snap) => {
  const uid = snap.user ? snap.user.uid : null;
  const justIn = prevUid === null && uid;
  prevUid = snap.ready ? uid : prevUid;
  acct = snap;
  $('#acctBtn').classList.toggle('on', !!snap.user);
  $('#acctLabel').textContent = snap.user ? (snap.user.name || '내 계정') : '로그인';
  renderStamps();
  renderHistory();
  if (!$('#orderStatus').classList.contains('show')) renderCheckout();
  if (screen.classList.contains('sheet-open')) {
    if (justIn) { closeSheet(); toast('로그인했습니다 · 기기 간 동기화 켜짐'); }
    else if (!document.activeElement || !document.activeElement.closest('#sheet')) renderSheet();
  }
});

// ---------------- app mode (#app) ----------------
function applyMode() {
  const on = location.hash === '#app';
  document.body.classList.toggle('app-mode', on);
  if (on) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', applyMode);
$('#exitApp').addEventListener('click', (e) => { e.preventDefault(); history.pushState('', '', location.pathname + location.search); applyMode(); });
applyMode();

// ---------------- scroll reveal ----------------
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  : null;
document.querySelectorAll('.rv').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

renderMenu();
renderAll();

// ---------------- scroll motion (GSAP) ----------------
const TABS = ['park', 'order', 'ev'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (window.gsap && window.ScrollTrigger && !reduced) {
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  // 3D 모형: 스크롤하면 카메라가 돌아가며 내려다봄
  mm.add('(min-width: 761px)', () => {
    const world = $('#world');
    const cam = { rx: 50, rz: -26, s: 0.9 };
    const apply = () => {
      world.style.setProperty('--rx', cam.rx + 'deg');
      world.style.setProperty('--rz', cam.rz + 'deg');
      world.style.setProperty('--s', cam.s);
    };
    apply();
    gsap.timeline({
      scrollTrigger: { trigger: '#scene', start: 'top top', end: '+=130%', pin: '.scene-pin', scrub: 0.8 },
      onUpdate: apply,
    })
      .to(cam, { rx: 60, rz: -40, s: 1.08, duration: 1, ease: 'none' })
      .to(cam, { rx: 64, rz: -52, s: 1.16, duration: 1, ease: 'none' });
    return () => { cam.rx = 54; cam.rz = -32; cam.s = 1; apply(); };
  });

  // 제품 섹션: 폰을 고정하고, 스크롤에 따라 주차 → 주문 → 충전으로 전환
  mm.add('(min-width: 981px)', () => {
    const phone = $('.phone');
    const tilt = { rx: 12, ry: -18, s: 0.9 };
    let fit = 1, lastTab = -1;
    const measure = () => {
      fit = Math.min(1, (innerHeight - 170) / 782);
      phone.style.transformOrigin = '50% 0';
      phone.style.marginBottom = -(782 * (1 - fit)) + 'px';
    };
    const apply = () => {
      phone.style.transform = `scale(${(fit * tilt.s).toFixed(3)}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;
    };
    measure(); apply();
    ScrollTrigger.addEventListener('refreshInit', measure);
    document.body.classList.add('demo-pinned');
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.demo', start: 'top 84px', end: '+=240%', pin: true, scrub: 0.6,
        onUpdate(self) {
          const i = Math.min(2, Math.floor(self.progress * 3));
          if (i !== lastTab) { lastTab = i; setTab(TABS[i]); }
        },
      },
      onUpdate: apply,
    })
      .to(tilt, { rx: 0, ry: 0, s: 1, duration: 1, ease: 'power2.out' })
      .to(tilt, { rx: 0, ry: 0, s: 1, duration: 0.8 })
      .to(tilt, { rx: 6, ry: 14, s: 0.96, duration: 1, ease: 'power1.in' });
    const st = tl.scrollTrigger;
    const onFeature = (e) => {
      const f = e.target.closest('.feature');
      if (!f) return;
      e.stopImmediatePropagation();
      const i = TABS.indexOf(f.dataset.go);
      window.scrollTo({ top: st.start + ((i + 0.5) / 3) * (st.end - st.start), behavior: 'smooth' });
    };
    $('.steps-list').addEventListener('click', onFeature, true);
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', measure);
      $('.steps-list').removeEventListener('click', onFeature, true);
      document.body.classList.remove('demo-pinned');
      phone.style.transform = phone.style.marginBottom = '';
    };
  });

  // 앱 전용 화면(#app)에서는 스크롤 연출을 끔
  const syncMode = () => ScrollTrigger.getAll().forEach((t) => (document.body.classList.contains('app-mode') ? t.disable(false) : t.enable()));
  window.addEventListener('hashchange', () => setTimeout(() => { syncMode(); ScrollTrigger.refresh(); }, 0));
  syncMode();
}

tickClock();
setInterval(tickClock, 15000);
setInterval(simulate, 2500);
