/* KOLSB core В1 — водопроводные колодцы (ТПР 901-09-11.84): модель по строке листа «Экспорт» (метка KOLVV-EXPORT),
   круглые из сборных колец (серия 3.900.1-14) и прямоугольные ПК1Г…ПК13А (Альбом IV: днище Д, монолитные стены М150,
   раскладка плит перекрытия и балок по планам АС-8…АС-12), разрезы, 3D-сцена (three.js), шаги сборки, упаковка для QR.
   Подключается после core.js. Локальные оси колодца: x — вдоль магистрали (1-е направление трубы), y — поперёк,
   z — вверх, z = 0 — дно колодца (верх плиты днища). В сцене всё собрано в группу, повёрнутую на угол магистрали. */
(function (G) {
'use strict';
const KC = G.KC, VV = KC.VV = {};
const {N, S, fmt, sgn} = KC;
const {lineCircle, lineBox, minus, b64u, zip} = KC._;
const SEAM = KC.SEAM, mm = v => Math.round(v * 1000);
const rel = a => { let r = a % (2 * Math.PI); if (r > Math.PI) r -= 2 * Math.PI; if (r < -Math.PI) r += 2 * Math.PI; return r; };

/* ---------------- справочные данные ---------------- */
// лаз (или отверстие Ø1000) у плит перекрытия круглых: смещение от центра, м; радиус отверстия — серия 3.900.1-14, лист НИ
VV.PPA = {'ПП10-1': .15, 'ПП10-2': .15, '1ПП15-1': .40, '1ПП15-2': .40, '2ПП15-1': .20, '2ПП15-2': .20, '3ПП15-1': .24, '3ПП15-2': .24,
  '1ПП20-1': .20, '1ПП20-2': .20, '2ПП20-1': .50, '2ПП20-2': .50, '4ПП20-2': .65};
VV.HOLE = m => /^3ПП15|^2ПП20/.test(m) ? .5 : .35;
// прямоугольные: днища [вдоль A, вдоль Б, h], плиты и балки [ширина, длина (пролёт), h], мм — Альбом V, серия 3.006-2 вып. II-2, III-2
VV.RE = {
  'Д-25-20': [3000, 2500, 120], 'Д-30-20': [3500, 2500, 120], 'Д-35-20': [4000, 2500, 120], 'Д-25-25': [3000, 3000, 120], 'Д-30-25': [3500, 3000, 150],
  'Д-35-25': [4000, 3000, 150], 'Д-40-25': [4500, 3000, 150], 'Д-45-25': [5000, 3000, 150], 'Д-30-30': [3500, 3500, 150], 'Д-35-30': [4000, 3500, 150],
  'Д-40-30': [4500, 3500, 150], 'Д-45-30': [5000, 3500, 150], 'Д-35-35': [4000, 4000, 150], 'Д-40-35': [4500, 4000, 150], 'Д-45-35': [5000, 4000, 150],
  'Д-40-40': [4500, 4500, 150], 'Д-45-40': [5000, 4500, 150],
  'П21Д-5': [740, 2460, 160], 'П21-5А': [1200, 2200, 160], 'П21-5Б': [1350, 2200, 160], 'П21Д-5А': [340, 2200, 160],
  'П24Д-5': [740, 2780, 180], 'П24-5А': [1200, 2700, 180], 'П24-5Б': [1350, 2700, 180], 'П24-5В': [1200, 2700, 180], 'П24Д-5А': [340, 2700, 180],
  'П26Д-5': [740, 3380, 200], 'П26-5А': [1200, 3200, 200], 'П26-5Б': [1350, 3200, 200], 'П26-5В': [1200, 3200, 200], 'П26Д-5А': [340, 3200, 200],
  'П15Д-5': [740, 1840, 120], 'П18Д-5': [740, 2160, 150], 'П11Д-8': [740, 1480, 100],
  'ПО2': [1500, 1450, 120], 'ПО3': [1500, 1750, 160], 'ПО4': [1500, 2300, 200], 'ПО4А': [1500, 2000, 200],
  'Б8': [600, 4250, 450], 'Б4': [300, 2160, 300], 'Б2': [300, 1460, 200]};
VV.DOC = m => /^П\d\dД-5$|^П1[158]Д|^П11Д/.test(m) ? 'серия 3.006-2 вып. II-2' : /^ПО|^Б\d/.test(m) ? 'серия 3.006-2 вып. III-2' : 'т.пр. 901-09-11.84, Альбом V';
/* раскладка плит перекрытия — по планам Альбома IV (АС-8…АС-12).
   Строка — плиты пролётом поперёк колодца (по Б), слева направо; «:c» — лаз по центру плиты (П..-5А), «:bl» / «:tr» — лаз у угла
   (П..-5Б: центр в 550 от края плиты к торцевой стене и в 450 от её конца), «:b» / «:t» — лаз у конца, по оси плиты (П..-5В).
   Объект — колодцы шириной 3,5 и 4 м: плиты пролётом вдоль колодца (по A) между стеной и балкой Б8; cols — колонки плит
   (end — конец плит у балки слева, start — справа, c — средняя колонка между балками), стопка снизу вверх (по Б); «:h» — лаз в ПО;
   «gap:340» — место под полосу, «:s» — плита-полоса через две колонки (от оси левой балки). */
VV.LAY = {
  'ПК1Г': ['П21Д-5', 'П21-5А:c', 'П21Д-5'], 'ПК1': ['П21-5Б:bl', 'П21-5Б:tr'], 'ПК1А': ['П21-5Б:bl', 'П21Д-5', 'П21Д-5А', 'П21Д-5А'],
  'ПК3': ['П21-5Б:bl', 'П21Д-5А', 'П21Д-5А', 'П21-5А:c'], 'ПК3А': ['П21-5Б:bl', 'П21Д-5А', 'П21Д-5А', 'П21-5Б:tr'],
  'ПК6': ['П21-5Б:bl', 'П21Д-5', 'П21Д-5А', 'П21-5Б:tr'],
  'ПК2Г': ['П24Д-5', 'П24-5А:c', 'П24Д-5'], 'ПК2': ['П24-5Б:bl', 'П24-5Б:tr'], 'ПК2А': ['П24-5Б:bl', 'П24Д-5', 'П24Д-5'],
  'ПК4': ['П24-5В:b', 'П24Д-5', 'П24-5В:t'], 'ПК7': ['П24-5Б:bl', 'П24Д-5', 'П24Д-5А', 'П24-5Б:tr'],
  'ПК8': ['П24-5В:b', 'П24Д-5', 'П24Д-5', 'П24Д-5А', 'П24-5В:t'], 'ПК10': ['П24-5Б:bl', 'П24Д-5А', 'П24-5В:t', 'П24Д-5А', 'П24-5Б:tr'],
  'ПК10А': ['П24-5В:b', 'П24Д-5', 'П24Д-5', 'П24Д-5', 'П24-5В:t'],
  'ПК5': ['П26-5Б:bl', 'П26Д-5', 'П26-5В:t'], 'ПК6А': ['П26-5В:b', 'П26Д-5', 'П26Д-5А', 'П26-5В:t'],
  'ПК9': ['П26-5Б:bl', 'П26-5В:t', 'П26Д-5А', 'П26-5А:c'], 'ПК11': ['П26-5В:b', 'П26Д-5', 'П26Д-5', 'П26Д-5', 'П26-5В:t'],
  'ПК14': {beams: [0], cols: [{end: 0, st: ['ПО4А:h', 'П15Д-5', 'П15Д-5', 'П15Д-5']}, {start: 0, st: ['П15Д-5', 'П15Д-5', 'П15Д-5', 'ПО4А:h']}]},
  'ПК15': {beams: [0], cols: [{end: 0, st: ['ПО4:h', 'П18Д-5', 'П18Д-5', 'П18Д-5']}, {start: 0, st: ['П18Д-5', 'П18Д-5', 'П18Д-5', 'ПО4:h']}]},
  'ПК12': {beams: [-.3, .3], cols: [{end: -.3, st: ['ПО4:h', 'П18Д-5', 'П18Д-5', 'П18Д-5']}, {start: .3, st: ['П18Д-5', 'П18Д-5', 'П18Д-5', 'ПО4:h']}]},
  'ПК16': {beams: [0], cols: [{end: 0, st: ['ПО4:h', 'П18Д-5', 'П18Д-5', 'П18Д-5', 'Б4']}, {start: 0, st: ['Б4', 'П18Д-5', 'П18Д-5', 'П18Д-5', 'ПО4:h']}]},
  'ПК13': {beams: [-.3, .3], cols: [{end: -.3, st: ['ПО4:h', 'П18Д-5', 'П18Д-5', 'П18Д-5', 'Б4']}, {start: .3, st: ['Б4', 'П18Д-5', 'П18Д-5', 'П18Д-5', 'ПО4:h']}]},
  'ПК12А': {beams: [-.75, .85], cols: [{end: -.9, st: ['ПО2:h', 'П11Д-8', 'П11Д-8', 'П11Д-8']}, {c: .05, st: ['ПО3:h', 'П15Д-5', 'П15Д-5', 'П15Д-5']},
    {start: 1.0, st: ['П11Д-8', 'П11Д-8', 'П11Д-8', 'ПО2:h']}]},
  'ПК13А': {beams: [-.85, .75], cols: [{end: -1.0, st: ['ПО2:h', 'П11Д-8', 'П11Д-8', 'П11Д-8', 'Б2']}, {c: -.05, st: ['П26Д-5А:s', 'П15Д-5', 'П15Д-5', 'П15Д-5', 'ПО3:h']},
    {start: .9, st: ['gap:340', 'П11Д-8', 'П11Д-8', 'П11Д-8', 'ПО2:h']}]}};
const re = m => { const d = VV.RE[m]; return d ? d.map(v => v / 1000) : null; };

/* раскладка перекрытия: плиты, балки, лазы; z — от верха стен V */
VV.layout = function (pk, A, B, V) {
  const L = VV.LAY[pk], out = {items: [], holes: [], warn: [], type: Array.isArray(L) ? 'S' : 'X'};
  if (!L) { out.warn.push(`нет раскладки для ${pk}`); return out; }
  const add = o => { o.idx = out.items.length; out.items.push(o); return o; };
  if (Array.isArray(L)) {
    const ws = L.map(s => re(s.split(':')[0])[0]), sum = ws.reduce((a, b) => a + b, 0);
    let x = -sum / 2;
    L.forEach((s, i) => {
      const [m, hs] = s.split(':'), [wd, ln, h] = re(m), it = add({mark: m, kind: 'plate', x0: x, x1: x + wd, y0: -ln / 2, y1: ln / 2, z0: V, z1: V + h, h, span: 'y'});
      if (hs) { const xc = x + wd / 2;
        const p = hs === 'c' ? [xc, 0] : hs === 'bl' ? [x + .55, -ln / 2 + .45] : hs === 'tr' ? [x + wd - .55, ln / 2 - .45] : hs === 'b' ? [xc, -ln / 2 + .45] : [xc, ln / 2 - .45];
        it.hole = {x: p[0], y: p[1], r: .35}; out.holes.push({x: p[0], y: p[1], plate: it}); }
      x += wd; void i; });
    out.sum = sum; out.over = (sum - A) / 2;
    // плиты лежат пролётом поперёк (на продольных стенах) — на торцевые стены им опираться не нужно; до 20 мм у торцов — обычный шов
    // раствора (так по ТПР: ПК6А, АС-10 — 3480 при A 3500); больше — нужна монолитная полоса по месту
    if (out.over < -.0205) out.warn.push(`плиты ${mm(sum)} мм на длину ${mm(A)} мм: у торцевых стен по ${mm(-out.over)} мм — монолитная полоса по месту`);
  } else {
    for (const xb of L.beams) { const [bw, bl, bh] = re('Б8'); add({mark: 'Б8', kind: 'beam', x0: xb - bw / 2, x1: xb + bw / 2, y0: -bl / 2, y1: bl / 2, z0: V - bh, z1: V, h: bh, span: 'y', main: true}); }
    L.cols.forEach((c, ci) => {
      const parts = c.st.map(s => { const [m, f] = s.split(':'); return m === 'gap' ? {gap: +f / 1000} : {m, f, d: re(m)}; });
      const T = parts.reduce((a, p) => a + (p.gap || p.d[0]), 0), hMax = Math.max(...parts.filter(p => p.d && !/^Б/.test(p.m)).map(p => p.d[2]));
      let y = -T / 2;
      for (const p of parts) {
        if (p.gap) { y += p.gap; continue; }
        const [wd, ln, h] = p.d;
        let x0 = c.end !== undefined ? c.end - ln : c.start !== undefined ? c.start : c.c - ln / 2;
        if (p.f === 's') x0 = L.beams[0];
        const beam = /^Б/.test(p.m), z1 = beam ? V + hMax : V + h;
        const it = add({mark: p.m, kind: beam ? 'beam' : 'plate', x0, x1: x0 + ln, y0: y, y1: y + wd, z0: z1 - h, z1, h, span: 'x', col: ci});
        if (p.f === 'h') { const hx = c.end !== undefined ? x0 + .6 : c.start !== undefined ? x0 + ln - .6 : x0 + ln / 2;
          it.hole = {x: hx, y: y + wd / 2, r: .35}; out.holes.push({x: hx, y: y + wd / 2, plate: it}); }
        y += wd;
      }
      const yT = T / 2 - B / 2; if (yT < -.002) out.warn.push(`колонка ${ci + 1}: плиты ${mm(T)} мм на ширину ${mm(B)} мм`);
    });
    out.sum = A; out.over = 0;
  }
  return out;
};

/* ---------------- модель ---------------- */
VV.model = function (w, angs) {
  const M = {vv: true, w, angs: (angs && angs.length ? angs : [0, Math.PI]).slice()};
  M.rect = N(w, 'form') === 2;
  M.go = M.angs[0];
  M.place = S(w, 'mesto') || 'Г';
  M.hat = KC.HATCH[S(w, 'hatch')] || KC.HATCH['Т'];
  M.Hl = N(w, 'Hl'); M.pd6 = N(w, 'pd6') === 1; M.V = N(w, 'V'); M.hpp = N(w, 'hpp'); M.pod = N(w, 'pod'); M.W = N(w, 'W');
  M.otst = N(w, 'otst'); M.Hd = N(w, 'Hd') || N(w, 'H') + M.otst; M.zg = M.Hd;
  M.Du = (N(w, 'Du') || 150) / 1000; M.du = N(w, 'du') / 1000; M.nG = Math.max(1, N(w, 'nG'));
  M.pg = N(w, 'pg') === 1; M.g1000 = N(w, 'g1000') === 1; M.Hl = M.Hl || .12;
  M.cat = {}; M.rows = [];
  S(w, 'els').split(';').filter(Boolean).forEach((it, i) => { const [m, c, q, kg] = it.split('|'); const r = {pos: i + 1, mark: m, code: c, q: +q, kg: +kg}; M.rows.push(r); M.cat[m] = r; });
  M.dims = {};
  S(w, 'dims').split(';').filter(Boolean).forEach(it => { const [m, a, b, h] = it.split('|'); M.dims[m] = {din: a, dout: String(b || '').replace(/(\d)\s*[x×х?]\s*(\d)/gi, '$1×$2'), h: +h}; });
  M.els = []; M.steps = []; M.seams = []; M.pipes = []; M.hatches = []; M.warn = [];
  M.k = N(w, 'msk'); M.seis = M.k > 0;
  M.grunt = (() => { const g = String(S(w, 'grunt')).toUpperCase().replace(/[^0-9]/g, ''); return g === '3' ? 'III' : g === '2' ? 'II' : 'I'; })();
  M.gruntName = {'I': 'В1 — сухие грунты', 'II': 'В2 — при наличии грунтовых вод', 'III': 'В3 — просадочные грунты'}[M.grunt];
  if (M.rect) buildRect(M); else buildRound(M);
  pdPlan(M);
  M.els.forEach((e, i) => { e.id = i; e.key = e.key || 'e' + i; e.pos = (M.cat[e.mark] || {}).pos || ''; });
  buildPipes(M);
  M.heavy = M.rows.filter(r => !/^Люк|^Решётка/.test(r.mark)).reduce((a, r) => (!a || r.kg > a.kg) ? r : a, null);
  M.total = M.rows.reduce((s, r) => s + r.q * r.kg, 0);
  M.otmR = Math.max(M.hat[0], .42) + KC.OTM_B;
  M.ztop = Math.max(...M.hatches.map(h => h.ztop));
  M.zBase = Math.min(...M.base.map(b => b.z0)); M.zBaseTop = Math.min(...M.base.filter(b => b.cls !== 'comp').map(b => b.z0));
  M.hb = 0; M.hv = 0; M.wall = []; M.rings = M.rings || []; M.k10 = M.k10 || [];
  buildTapesVV(M);
  M.surfR = M.rect ? Math.hypot(M.A / 2 + M.t + .6, M.B / 2 + M.t + .6) : Math.max(M.Rout + .5, M.la + M.otmR + .35);
  KC.water(M);
  return M;
};
// 3D-разрез: поперёк магистрали через люк 1 (мимо оси ответвления), видна половина x ≥ ox; камера — со стороны −x
VV.cut3d = M => { const pb = Math.max(0, ...M.pipes.filter(p => p.branch).map(p => p.ro)) + .03; return {phi: -Math.PI / 2, ox: M.rect ? M.gx : (M.du > 0 ? pb : 0), oy: 0, side: 1}; };
VV.azCut = M => M.go + Math.PI - .55;
const toW = (M, x, y) => { const c = Math.cos(M.go), s = Math.sin(M.go); return [x * c - y * s, x * s + y * c]; };
VV.toW = toW;

// ПД6 на дороге — плита 2500×1750 вокруг люка; по умолчанию длинная сторона — к стене со скобами (ga).
// Если у близких люков плиты заходят друг на друга, плиты разворачиваем на 90°: из вариантов без перекрытия — сначала тот,
// где все плиты параллельны (как удобнее укладывать), затем — с наименьшим числом разворотов;
// не помещаются никак — M.pdOv (номера люков) и предупреждение в паспорте
VV.pdHalf = a => Math.abs(Math.cos(a || 0)) > .5 ? [1.25, .875] : [.875, 1.25];
VV.pdAng = e => (e.pa !== undefined ? e.pa : e.ga) || 0;
function pdPlan(M) {
  M.pdRot = []; M.pdOv = null;
  const H = M.hatches.filter(g => g.pd), n = H.length;
  if (!M.pd6 || n < 2) return;
  const clash = a => { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const [x1, y1] = VV.pdHalf(a[i]), [x2, y2] = VV.pdHalf(a[j]);
    if (Math.abs(H[i].x - H[j].x) < x1 + x2 - .005 && Math.abs(H[i].y - H[j].y) < y1 + y2 - .005) return [H[i].i + 1, H[j].i + 1]; } return null; };
  let best = null;
  for (let m = 0; m < 1 << n; m++) {
    const a = H.map((g, k) => g.ga + (m >> k & 1 ? Math.PI / 2 : 0)), rot = H.filter((g, k) => m >> k & 1).length;
    const par = new Set(a.map(x => Math.abs(Math.cos(x)) > .5 ? 'x' : 'y')).size === 1, sc = (par ? 0 : 10) + rot;
    if (!clash(a) && (!best || sc < best.sc)) best = {a, rot, m, sc};
  }
  if (!best) { M.pdOv = clash(H.map(g => g.ga)); return; }
  H.forEach((g, k) => { g.pd.pa = best.a[k]; if (best.m >> k & 1) M.pdRot.push(g.i + 1); });
}

// горловина над лазом (cx, cy) с низа z: решётка, КС7.6, КС7.3, КО6, ПД6, люк; hi — номер горловины
function gorl(M, cx, cy, z, hi, ztop, ga) {
  const w = M.w, g = {i: hi, x: cx, y: cy, z0: z, ztop, els: [], ga};
  const add = o => { o.hatch = hi; o.cx = cx; o.cy = cy; o.key = `g${hi}${o.kind}${g.els.length}`; M.els.push(o); g.els.push(o); return o; };
  g.resh = add({kind: 'РШ', mark: 'Решётка защитная', z0: z - SEAM, z1: z - SEAM + KC.GRATE.t + 2 * KC.GRATE.r, shape: 'grate'});
  g.rings = [];
  for (let i = 0; i < N(w, 'n76'); i++) { g.rings.push(add({kind: 'КГ', mark: 'КС7.6', z0: z, z1: z + .59, rin: .35, rout: .42})); z += .6; }
  for (let i = 0; i < N(w, 'n73'); i++) { g.rings.push(add({kind: 'КГ', mark: 'КС7.3', z0: z, z1: z + .29, rin: .35, rout: .42})); z += .3; }
  // добор набетонкой: бетон М100 по кольцу КС7 — прямо на верх КС7 (или плиты), без шва; остаток до 20 мм — в шов раствора под КО6 (ПД6)
  M.nabH = N(w, 'nabH'); M.nabJ = N(w, 'nabJ') / 1000; M.nabV = N(w, 'nabV'); M.dobor = S(w, 'dobor') || (M.nabH > 0 || M.nabJ > 0 ? 'набетонка' : 'кольца');
  if (M.nabH > .0005) { g.nab = add({kind: 'НБ', mark: 'Набетонка М100', z0: z - SEAM, z1: z - SEAM + M.nabH, rin: .35, rout: .42, mono: true}); z = g.nab.z1 + SEAM; }
  z += M.nabJ;
  const nko = N(w, 'nKO');
  if (nko > 0) { g.ko = add({kind: 'КО', mark: 'КО6', q: nko, z0: z, z1: z + nko * .08 - SEAM, rin: .29, rout: .42}); z += nko * .08; }
  if (M.pd6) g.pd = add({kind: 'ПД', mark: 'ПД6', z0: z, z1: z + .22, ga});
  g.hatch = add({kind: 'ЛЮК', mark: 'Люк ' + S(w, 'hatch'), z0: ztop - M.Hl, z1: ztop, rin: .31, rout: M.hat[0]});
  // постель из раствора под корпусом люка (в таблице на люк — свой шов сверх шва над КО6: обычно 20 мм)
  if (!g.pd && g.hatch.z0 - (z - SEAM) > .005) g.hatch.bed = [z - SEAM, g.hatch.z0];
  M.hatches.push(g);
  return g;
}

// 0.11: лента ГИ-Г на стыки сборных колец в мокрых грунтах (ТПР 901-09-11.84, Альбом I, п. 3.2; как в К1 — гидроизол 400 мм в 2 слоя):
// круглые — ПН–кольцо, между кольцами, кольцо–ПП; горловины — под КС10, ПП10, КС7, КО6. Какие стыки в зоне воды — по таблице
// (jrW, jgA, jgB — снизу, у прямоугольных jgB — на каждую горловину), отбор в KC.water. Данные до 0.11 — без ленты (в В1 её не было)
function buildTapesVV(M) {
  const S2 = SEAM / 2, T = [];
  M.tapeW = N(M.w, 'lentaW') || .40; M.tapeN = N(M.w, 'lentaN') || 2; M.tapeAdd = .10; M.bitron = N(M.w, 'bitron') || 1.5;
  M.tapes = T;
  if (M.w.zw === undefined) return;
  if (!M.rect) {
    T.push({z: 0, lo: 0, cx: 0, cy: 0, r: M.Rout, part: 'r', below: M.pnE});
    M.rings.forEach(r => T.push({z: r.z1 + S2, lo: -1, cx: 0, cy: 0, r: M.Rout, part: 'r', below: r}));
    M.k10.forEach((k, i) => T.push({z: k.z0 - S2, lo: -1, cx: k.cx, cy: k.cy, r: .58, part: 'gA', below: i ? M.k10[i - 1] : M.ppE}));
    if (M.p10E) T.push({z: M.p10E.z0 - S2, lo: -1, cx: M.p10E.cx, cy: M.p10E.cy, r: .58, part: 'gA', below: M.k10[M.k10.length - 1] || M.ppE});
  }
  for (const g of M.hatches) {
    const below0 = M.rect ? null : (M.p10E || M.ppE);
    g.rings.forEach((e, i) => T.push({z: e.z0 - S2, lo: -1, cx: g.x, cy: g.y, r: .42, part: 'gB', hatch: g.i, below: i ? g.rings[i - 1] : below0}));
    if (g.ko) for (let i = 0; i < g.ko.q; i++)
      T.push({z: i ? g.ko.z0 + i * .08 - S2 : g.ko.z0 - (SEAM + (M.nabJ || 0)) / 2, lo: -1, cx: g.x, cy: g.y, r: .42, part: 'gB', hatch: g.i, below: g.ko});
  }
}

/* ---- круглые ---- */
function buildRound(M) {
  const w = M.w;
  M.D = N(w, 'D') || 1.5; M.Rin = M.D / 2; M.Rout = N(w, 'Dout') / 2 || M.Rin + .09;
  M.pnR = (N(w, 'pnD') || M.D + .5) / 2; M.pnH = N(w, 'pnH') || .12;
  // лаз — поперёк магистрали, в сторону, где нет ответвления (скобы — на стенке без проёмов)
  const br = M.angs.length > 2 && M.du > 0 ? rel(M.angs[2] - M.go) : null;
  M.ga = br !== null && Math.sin(br) > 0 ? -Math.PI / 2 : Math.PI / 2;
  const u = [Math.cos(M.ga), Math.sin(M.ga)];
  const add = o => { o.key = 'e' + M.els.length; M.els.push(o); return o; };
  M.pnE = add({kind: 'ПН', mark: S(w, 'pn'), z0: -M.pnH, z1: 0, cx: 0, cy: 0, rin: 0, rout: M.pnR});
  const rings = [];
  for (let i = 0; i < N(w, 'n9'); i++) rings.push([S(w, 'ring9'), N(w, 'h9') || .89]);
  for (let i = 0; i < N(w, 'n6'); i++) rings.push([S(w, 'ring6'), N(w, 'h6') || .59]);
  M.rings = []; let z = 0;
  rings.forEach(([m, h], i) => { M.rings.push(add({kind: 'КС', mark: m, z0: z, z1: z + h, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, first: i === 0, idx: i})); z += h + SEAM; });
  const pp = S(w, 'pp'), a = VV.PPA[pp] ?? .4, hr = VV.HOLE(pp);
  M.a = a; M.ppE = add({kind: 'ПП', mark: pp, z0: M.V, z1: M.V + M.hpp, cx: 0, cy: 0, rout: M.Rout, holes: [{x: u[0] * a, y: u[1] * a, r: hr}]});
  z = M.V + M.hpp + SEAM;
  let lx = u[0] * a, ly = u[1] * a;
  M.k10 = [];
  if (M.g1000) {
    for (let i = 0; i < N(w, 'n106'); i++) { M.k10.push(add({kind: 'К10', mark: 'КС10.6', z0: z, z1: z + .59, cx: lx, cy: ly, rin: .5, rout: .58})); z += .6; }
    for (let i = 0; i < N(w, 'n103'); i++) { M.k10.push(add({kind: 'К10', mark: 'КС10.3', z0: z, z1: z + .29, cx: lx, cy: ly, rin: .5, rout: .58})); z += .3; }
    // ПП10 — лазом к стенке со скобами, и в колодце ПГ тоже (иначе скобы упираются в плиту — не выйти);
    // гидрант ПГ — под люком, в 200 мм от оси люка к центру колодца (ТПР 901-09-11.84, Альбом II, НВ-20): сдвиг от центра — M.pgShift
    const c10 = [lx, ly];
    lx = c10[0] + u[0] * .15; ly = c10[1] + u[1] * .15;
    M.p10E = add({kind: 'П10', mark: 'ПП10-2', z0: z, z1: z + .15, cx: c10[0], cy: c10[1], rout: .58, holes: [{x: lx, y: ly, r: .35}]});
    z += .15 + SEAM;
  }
  M.gx = lx; M.gy = ly; M.la = Math.hypot(lx, ly);
  M.pgShift = M.pg ? Math.max(0, M.la - .2) : 0;   // ПГ: гидрант в 200 мм от оси люка — сдвиг от центра колодца к горловине
  gorl(M, lx, ly, z, 0, M.V + M.W, M.ga);
  // скобы ходовые: в отверстиях колец (.3 — 1, .6 — 2, .9 — 3, серия 3.900.1-14), у стенки под лазом, через 300
  const stepRing = (e, cx, cy, r) => { const n = Math.round((e.z1 - e.z0 + SEAM) / .3); for (let k = 0; k < n; k++) M.steps.push({x: cx + u[0] * r, y: cy + u[1] * r, z: e.z0 + .15 + .3 * k, ang: M.ga + Math.PI, of: e.key}); };
  M.rings.forEach(e => stepRing(e, 0, 0, M.Rin));
  M.k10.forEach(e => stepRing(e, e.cx, e.cy, .5));
  M.hatches[0].rings.forEach(e => stepRing(e, e.cx, e.cy, .35));
  buildBaseRound(M);
  buildSeamsRound(M);
}
function buildBaseRound(M) {
  const z0 = -M.pnH, R = M.pnR + .1;
  if (M.grunt === 'I') M.base = [{n: 'песчаная подготовка 100 мм', z0: z0 - .10, z1: z0, r: R, cls: 'sand', col: 'sand'}];
  else if (M.grunt === 'II') M.base = [{n: 'раствор 20 мм', z0: z0 - .02, z1: z0, r: M.pnR, cls: 'mort', col: 'mortar'}, {n: 'гидроизоляция 10 мм', z0: z0 - .03, z1: z0 - .02, r: R, cls: 'bitl', col: 'coat'},
    {n: 'бетон М50 — 100 мм', z0: z0 - .13, z1: z0 - .03, r: R, cls: 'lean', col: 'lean'}];
  else M.base = [{n: 'раствор 20 мм', z0: z0 - .02, z1: z0, r: M.pnR, cls: 'mort', col: 'mortar'}, {n: 'бетон М50 — 100 мм', z0: z0 - .12, z1: z0 - .02, r: R, cls: 'lean', col: 'lean'},
    {n: 'уплотнённый грунт (1 м)', z0: z0 - 1.12, z1: z0 - .12, r: M.pnR + .6, cls: 'comp', col: 'comp'}];
  M.base.forEach(b => { b.shape = 'cyl'; });
  M.zamok = M.grunt === 'III' ? {z0: z0 - .12, z1: .4, rin: M.Rout, rout: M.Rout + .6} : null;
}
// сейсмика (ТПР 901-09-11.84, Альбом VI.88, АС-5): рабочая часть — k шт. на шов колец, на стыках с днищем и с плитой — МС-6…8;
// горловина — по 4 шт.: плита — КС7 и КС7 — КО6 (МС-5), между КС7 (МС-1); горловина 1000 — МС-6 и МС-2
function buildSeamsRound(M) {
  if (!M.seis) return;
  const k = M.k, S2 = SEAM / 2, go = 0;
  const ringMark = M.D >= 2 ? 'МС-4' : M.D >= 1.5 ? 'МС-3' : 'МС-2', endMark = M.D >= 2 ? 'МС-8' : M.D >= 1.5 ? 'МС-7' : 'МС-6';
  const even = (n, off) => Array.from({length: n}, (_, j) => go + off + j * 2 * Math.PI / n);
  const offR = n => n === 4 ? Math.PI / 4 : n === 6 ? Math.PI / 6 : n % 4 === 0 ? 0 : Math.PI / n;
  const rs = M.rings;
  if (rs[0]) M.seams.push({kind: 'pn', z: 0, mark: endMark, n: k, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, angs: even(k, offR(k)), asym: true, up: true, below: M.pnE, above: rs[0], name: 'днище — кольцо'});
  rs.forEach((r, i) => { if (i < rs.length - 1) M.seams.push({kind: 'ring', z: r.z1 + S2, mark: ringMark, n: k, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, angs: even(k, offR(k)), asym: false, below: r, above: rs[i + 1], name: `над ${r.mark}`}); });
  const last = rs[rs.length - 1];
  if (last) M.seams.push({kind: 'pp', z: last.z1 + S2, mark: endMark, n: k, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, angs: even(k, offR(k)), asym: true, longOut: true, below: last, above: M.ppE, name: 'кольцо — плита'});
  const g = M.hatches[0], A4 = (cx, cy) => even(4, 0).map(a => a + M.ga);
  if (M.g1000) {
    const k10 = M.k10, c = [M.ppE.holes[0].x, M.ppE.holes[0].y];
    if (k10[0]) M.seams.push({kind: 'p10', z: M.V + M.hpp + S2, mark: 'МС-6', n: 4, cx: c[0], cy: c[1], rin: .5, rout: .58, angs: A4(), asym: true, longOut: false, below: M.ppE, above: k10[0], name: 'плита — КС10'});
    k10.forEach((r, i) => { if (i < k10.length - 1) M.seams.push({kind: 'g10', z: r.z1 + S2, mark: 'МС-2', n: 4, cx: c[0], cy: c[1], rin: .5, rout: .58, angs: A4(), asym: false, below: r, above: k10[i + 1], name: `${r.mark} — ${k10[i + 1].mark}`}); });
    const lk = k10[k10.length - 1];
    M.seams.push({kind: 'p10t', z: (lk ? lk.z1 : M.V + M.hpp) + S2, mark: 'МС-6', n: 4, cx: c[0], cy: c[1], rin: .5, rout: .58, angs: A4(), asym: true, longOut: true, below: lk || M.ppE, above: M.p10E, name: lk ? 'КС10 — ПП10' : 'плита — ПП10'});
  }
  gorlSeams(M, g, M.g1000 ? M.p10E : M.ppE, A4());
  M.seams.forEach((s, i) => { s.key = 'ms' + i; });
}
function gorlSeams(M, g, plate, angs) {
  const S2 = SEAM / 2, r = g.rings;
  if (r[0]) M.seams.push({kind: 'ppg', z: r[0].z0 - S2, mark: 'МС-5', n: 4, cx: g.x, cy: g.y, rin: .35, rout: .42, angs, asym: true, longOut: false, below: plate, above: r[0], name: 'плита — КС7', hatch: g.i});
  for (let i = 0; i < r.length - 1; i++) M.seams.push({kind: 'gorl', z: r[i].z1 + S2, mark: 'МС-1', n: 4, cx: g.x, cy: g.y, rin: .35, rout: .42, angs, asym: false, below: r[i], above: r[i + 1], name: `${r[i].mark} — ${r[i + 1].mark}`, hatch: g.i});
  const gl = r[r.length - 1];
  const gb = g.nab || gl;
  if (gl && g.ko && N(M.w, 'gko') > 0) M.seams.push({kind: 'gko', z: (gb.z1 + g.ko.z0) / 2, mark: 'МС-5', n: 4, cx: g.x, cy: g.y, rin: .35, rout: .42, angs, asym: true, longOut: true, below: gb, above: g.ko, name: `${g.nab ? 'набетонка' : gl.mark} — КО6`, hatch: g.i});
}

/* ---- прямоугольные ---- */
function buildRect(M) {
  const w = M.w;
  M.pk = S(w, 'pk'); M.A = N(w, 'A') / 1000; M.B = N(w, 'B') / 1000; M.t = (N(w, 't') || 300) / 1000;
  const add = o => { o.key = o.key || 'e' + M.els.length; M.els.push(o); return o; };
  const dm = (M.rows.find(r => /^Д-/.test(r.mark)) || {}).mark || '', dd = re(dm) || [M.A + .5, M.B + .5, .15];
  M.dE = add({kind: 'ДН', mark: dm, z0: -dd[2], z1: 0, shape: 'box', x0: -dd[0] / 2, x1: dd[0] / 2, y0: -dd[1] / 2, y1: dd[1] / 2});
  M.pnH = dd[2]; M.dX = dd[0] / 2; M.dY = dd[1] / 2;
  const ax = M.A / 2, by = M.B / 2, t = M.t;
  M.wallE = add({key: 'wall', kind: 'СТ', mark: `Стены М150, t = ${mm(t)}`, z0: 0, z1: M.V, shape: 'frame', x0: -ax - t, x1: ax + t, y0: -by - t, y1: by + t, ix0: -ax, ix1: ax, iy0: -by, iy1: by, mono: true});
  M.lay = VV.layout(M.pk, M.A, M.B, M.V);
  M.warn.push(...M.lay.warn);
  // сверка раскладки с комплектом из таблицы
  const cnt = {}; M.lay.items.forEach(it => { cnt[it.mark] = (cnt[it.mark] || 0) + 1; });
  M.rows.filter(r => VV.RE[r.mark] && !/^Д-/.test(r.mark)).forEach(r => { if ((cnt[r.mark] || 0) !== r.q) M.warn.push(`${r.mark}: в таблице ${r.q}, на плане ${cnt[r.mark] || 0}`); });
  M.beams = M.lay.items.filter(it => it.kind === 'beam').map(it => add({kind: 'БЛ', mark: it.mark, z0: it.z0, z1: it.z1, shape: 'box', x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1, it}));
  M.plates = M.lay.items.filter(it => it.kind === 'plate').map(it => add({kind: 'ПЛ', mark: it.mark, z0: it.z0, z1: it.z1, shape: 'box', x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1,
    holes: it.hole ? [it.hole] : [], it, hole: !!it.hole}));
  const H = M.lay.holes.length ? M.lay.holes : [{x: 0, y: 0, plate: {z1: M.V + M.hpp, h: M.hpp}}];
  if (H.length !== M.nG) M.warn.push(`лазов на плане ${H.length}, горловин в таблице ${M.nG}`);
  M.go2 = 0;
  H.forEach((h, i) => {
    // скобы — на ближайшей к лазу стене
    const cand = [[Math.abs(h.x + ax), 'x-', -ax, h.y, 0], [Math.abs(ax - h.x), 'x+', ax, h.y, Math.PI], [Math.abs(h.y + by), 'y-', h.x, -by, Math.PI / 2], [Math.abs(by - h.y), 'y+', h.x, by, -Math.PI / 2]].sort((p, q) => p[0] - q[0])[0];
    const ga = cand[4] + Math.PI;   // от центра лаза к стене со скобами
    // горловина считается от плиты толщиной hpp (из таблицы — самая толстая плита с лазом); плита у этого лаза тоньше —
    // разницу добираем выравнивающим слоем раствора под горловиной, чтобы все люки были на одной отметке
    const pl = h.plate, hp = pl.h || M.hpp, dh = M.hpp - hp > .002 ? M.hpp - hp : 0, ztop = M.V + M.W + Math.max(0, hp - M.hpp);
    const g = gorl(M, h.x, h.y, M.V + hp + dh + SEAM, i, ztop, ga);
    if (dh) { g.lev = {kind: 'РВ', mark: 'Раствор М100 (выравнивание)', hatch: i, cx: h.x, cy: h.y, z0: M.V + hp, z1: M.V + hp + dh, rin: .35, rout: .42, mono: true, key: `g${i}РВ`};
      M.els.push(g.lev); g.els.unshift(g.lev); }
    if (hp - M.hpp > .002) M.warn.push(`у люка ${i + 1} плита ${pl.mark} толще расчётной на ${mm(hp - M.hpp)} мм — люк выше`);
    g.plate = pl; g.wall = cand[1]; g.wx = cand[2]; g.wy = cand[3]; g.wang = cand[4];
    const n = Math.floor(M.V / .3 + 1e-6);
    for (let k = 0; k < n; k++) M.steps.push({x: cand[1][0] === 'x' ? cand[2] : Math.max(-ax + .2, Math.min(ax - .2, cand[2])), y: cand[1][0] === 'y' ? cand[3] : Math.max(-by + .2, Math.min(by - .2, cand[3])), z: M.V - .15 - .3 * k, ang: cand[4], of: 'skw', mono: true, hatch: i});
    // скобы в кольцах горловины
    g.rings.forEach(e => { const nn = Math.round((e.z1 - e.z0 + SEAM) / .3); for (let k = 0; k < nn; k++) M.steps.push({x: h.x + Math.cos(ga) * .35, y: h.y + Math.sin(ga) * .35, z: e.z0 + .15 + .3 * k, ang: ga + Math.PI, of: e.key, hatch: i}); });
  });
  // основание (Альбом IV, АС-1): В1 — бетон М50 100 + раствор 20; В2 — + гидроизоляция 10; В3 — уплотнённый грунт, замок
  const fx = Math.max(M.dX, ax + t), fy = Math.max(M.dY, by + t), z0 = -M.pnH;
  const bx = (n, za, zb, ex, cls, col) => ({n, z0: za, z1: zb, x0: -fx - ex, x1: fx + ex, y0: -fy - ex, y1: fy + ex, cls, col, shape: 'box'});
  M.base = [{n: 'раствор 20 мм', z0: z0 - .02, z1: z0, x0: -M.dX, x1: M.dX, y0: -M.dY, y1: M.dY, cls: 'mort', col: 'mortar', shape: 'box'}];
  if (M.grunt === 'II') M.base.push(bx('гидроизоляция 10 мм', z0 - .03, z0 - .02, 0, 'bitl', 'coat'), bx('бетон М50 — 100 мм', z0 - .13, z0 - .03, 0, 'lean', 'lean'));
  else M.base.push(bx('бетон М50 — 100 мм', z0 - .12, z0 - .02, 0, 'lean', 'lean'));
  if (M.grunt === 'III') M.base.push(bx('уплотнённый грунт (1 м)', z0 - 1.12, z0 - .12, .6, 'comp', 'comp'));
  M.zamok = M.grunt === 'III' ? {z0: z0 - .12, z1: .4, x: ax + t, y: by + t, b: .6} : null;
  M.Rout = Math.hypot(ax + t, by + t); M.Rin = Math.min(ax, by); M.D = 0;
  // армирование стен — точно по ТПР (0.11): обычные районы — бетон М150 без арматуры; сейсмика — сетка С3Вр1 (VI.88, АС-12);
  // вне ТПР (КЖ) без сейсмики — сетка условно; отверстия Ду ≥ 500 — обрамление сетками ⌀10 A-I (Альбом IV, АС-2)
  M.kzh = N(w, 'kzh') === 1; M.armKind = M.seis ? 'seis' : M.kzh ? 'kzh' : '';
  const fr = (M.Du >= .5 - 1e-6 || M.du >= .5 - 1e-6) ? '; отверстия Ду ≥ 500 — обрамление сетками ⌀10 A-I (Альбом IV, АС-2)' : '';
  M.armNote = M.seis ? `Стены — рулонная сетка С 3Вр1-150/3Вр1-150 у обеих граней, защитный слой 20 мм (ТПР 901-09-11.84, Альбом VI.88, АС-12)${fr}${M.kzh ? '; колодец вне ТПР — армирование уточняется в разделе КЖ' : ''}`
    : M.kzh ? `Колодец вне ТПР: армирование стен — по разделу КЖ, здесь показано условно${fr}`
    : `Стены — бетон М150 без армирования (ТПР 901-09-11.84, Альбом IV, АС-1, прим. 5)${fr}`;
  if (M.seis) { M.hatches.forEach(g => gorlSeams(M, g, g.plate ? M.plates.find(p => p.it === g.plate) : null, [0, 1, 2, 3].map(j => g.ga + j * Math.PI / 2))); M.seams.forEach((s, i) => { s.key = 'ms' + i; }); }
  M.gx = H[0].x; M.gy = H[0].y;
}

/* ---- трубы: магистраль Ду насквозь, ответвление ду — к магистрали (тройник); низ трубы — на высоте отстойной части.
   Трубы ПЭ SDR17 (стенка Dнар/17); в 3D и на разрезах — только снаружи и в стене, обрезаны у внутренней грани стены:
   внутри колодца трубопровод с фасонными частями (тройники, задвижки, гидрант) — по проекту, пока не показываем ---- */
VV.SDR = 17;
function buildPipes(M) {
  const w = M.w, ro = N(w, 'pOD') > 0 ? N(w, 'pOD') / 2000 : M.Du * .54, z = M.otst + ro, out = M.rect ? Math.max(M.A, M.B) / 2 + M.t + .9 : M.Rout + .9;
  const ang1 = M.angs.length > 1 ? rel(M.angs[1] - M.go) : Math.PI;
  if (M.rect || Math.abs(Math.abs(ang1) - Math.PI) < .09) {
    const L = M.rect ? M.A / 2 + M.t + .9 : out;
    M.pipes.push({role: 'магистраль', ang: 0, x0: -L, x1: L, ro, ri: M.Du / 2, z, Du: M.Du, through: true});
  } else {
    M.pipes.push({role: 'магистраль', ang: 0, x0: 0, x1: out, ro, ri: M.Du / 2, z, Du: M.Du});
    M.pipes.push({role: 'магистраль', ang: ang1, x0: 0, x1: out, ro, ri: M.Du / 2, z, Du: M.Du});
  }
  if (M.du > 0) {
    let a = M.angs.length > 2 ? rel(M.angs[2] - M.go) : -M.ga || -Math.PI / 2;
    if (M.rect) a = Math.sin(a) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const ro2 = N(w, 'pOD2') > 0 ? N(w, 'pOD2') / 2000 : M.du * .54, L = M.rect ? M.B / 2 + M.t + .9 : out;
    M.pipes.push({role: 'ответвление', ang: a, x0: 0, x1: L, ro: ro2, ri: M.du / 2, z, Du: M.du, branch: true});   // тройник: оси совпадают
  }
  M.wallIn = a => M.rect ? (Math.abs(Math.cos(a)) > .5 ? M.A / 2 : M.B / 2) : M.Rin;
  M.wallOut = a => M.rect ? (Math.abs(Math.cos(a)) > .5 ? M.A / 2 + M.t : M.B / 2 + M.t) : M.Rout;
  for (const p of M.pipes) p.ri = p.ro * (1 - 2 / VV.SDR);
  // внутренний торец трубы: у прямоугольных — у стены; у круглых стена кривая — торец ставим там, где отверстие трубы целиком перед стеной
  M.pipeEnd = p => M.rect ? M.wallIn(p.ang) - .003 : Math.sqrt(Math.max(0, M.Rin * M.Rin - p.ri * p.ri)) - .002;
  M.pipeSegs = p => { const e = M.pipeEnd(p); return p.through ? [[-p.x1, -e], [e, p.x1]] : [[e, p.x1]]; };
  // гильзы: стальной футляр на каждом вводе — заподлицо с внутренней гранью стены, длина L (у монолитных стен — на толщину стены)
  M.gilL = N(w, 'gilL') || (M.rect ? M.t : .2);
  for (const p of M.pipes) {
    const D = p.branch ? N(w, 'gilD2') : N(w, 'gilD'), S0 = p.branch ? N(w, 'gilS2') : N(w, 'gilS');
    if (!(D > 0)) continue;
    p.gR = D / 2000; p.gS = (S0 || 7) / 1000; p.gD = D; p.gSmm = S0 || 7;
    // 0.11: в просадочных труба — в нижней части гильзы (снизу 10 см, запас сверху), ось гильзы выше оси трубы на gE (п. 18.11)
    p.gE = Math.max(0, N(w, p.branch ? 'gilE2' : 'gilE')); p.gz = p.z + p.gE;
    const wi = M.wallIn(p.ang) - (M.rect ? .002 : 0);   // у плоской стены торец гильзы чуть перед гранью — видно изнутри
    const gl = M.gilL + (M.rect ? .004 : 0); p.sl = [[wi, wi + gl]].concat(p.through ? [[-wi - gl, -wi]] : []);
  }
  M.gil = M.pipes.filter(p => p.sl).reduce((n, p) => n + p.sl.length, 0);
  // просадочные: труба в нижней части гильзы — зазор снизу (gBot) и сверху (gTop), мм
  const ge = M.pipes.filter(p => p.sl && p.gE > .001);
  M.gilEcc = ge.length ? {bot: Math.round(Math.min(...ge.map(p => p.gR - p.gS - p.ro - p.gE)) * 1000), top: Math.round(Math.min(...ge.map(p => p.gR - p.gS - p.ro + p.gE)) * 1000)} : null;
}

/* 0.12: проёмы под гильзы (трубы) в кольцах круглых колодцев — сквозь трубу виден колодец. Ось проёма горизонтальна и проходит
   через ось колодца (как у труб), zc — абсолютная высота оси, r — по наружной стенке гильзы (без гильзы — труба + 20 мм).
   Монолитные стены прямоугольных — без проёмов (торец трубы — тёмным кругом). */
// 0.13: проёмы под трубы в монолитных стенах прямоугольных: xw — стена с нормалью вдоль x (торцевая), sg — сторона, u — центр вдоль стены,
// z — центр по высоте, r — радиус (гильза или труба + 20 мм); трубы — через центр колодца
VV.wallHoles = M => !M.rect ? [] : (M.pipes || []).flatMap(p => { const r = (p.gR ? p.gR : p.ro + .02) + .001, z = p.gR ? p.gz : p.z, c = Math.cos(p.ang), sn = Math.sin(p.ang), xw = Math.abs(c) > .5,
  sg = Math.sign(xw ? c : sn) || 1; return [{xw, sg, u: 0, z, r}].concat(p.through ? [{xw, sg: -sg, u: 0, z, r}] : []); });
// прямоугольник [u0, u1] × [0, h] без кругов {u, z, r}: круг внутри — отверстие; через низ или верх — вырез; через всю высоту — делит на части
function slabShapes(THREE, u0, u1, h, holes, seg = 40) {
  const hs = holes.filter(q => q.z + q.r > 1e-4 && q.z - q.r < h - 1e-4 && q.u + q.r > u0 && q.u - q.r < u1);
  const split = hs.filter(q => q.z - q.r <= 1e-4 && q.z + q.r >= h - 1e-4).sort((a, b) => a.u - b.u), rest = hs.filter(q => !split.includes(q));
  const asn = v => Math.asin(Math.max(-1, Math.min(1, v)));
  const arc = (q, a0, a1) => { const o = []; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; o.push([q.u + q.r * Math.cos(a), q.z + q.r * Math.sin(a)]); } return o; };
  const xAt = (q, z, side) => q.u + side * Math.sqrt(Math.max(0, q.r * q.r - (z - q.z) ** 2));
  const out = [], bd = [null].concat(split, [null]);
  for (let k = 0; k < bd.length - 1; k++) {
    const L = bd[k], R = bd[k + 1], pts = [];
    const uB0 = L ? xAt(L, 0, 1) : u0, uB1 = R ? xAt(R, 0, -1) : u1, uT0 = L ? xAt(L, h, 1) : u0, uT1 = R ? xAt(R, h, -1) : u1;
    pts.push([uB0, 0]);
    for (const q of rest.filter(q => q.z - q.r < 1e-4 && q.u > uB0 && q.u < uB1).sort((a, b) => a.u - b.u)) { const a = asn(-q.z / q.r); pts.push(...arc(q, Math.PI - a, a)); }   // вырез снизу: через верх круга
    pts.push([uB1, 0]);
    if (R) pts.push(...arc(R, Math.PI - asn(-R.z / R.r), Math.PI - asn((h - R.z) / R.r))); else pts.push([u1, h]);   // справа — левая дуга круга, снизу вверх
    for (const q of rest.filter(q => q.z + q.r > h - 1e-4 && q.u > uT0 && q.u < uT1).sort((a, b) => b.u - a.u)) { const a = asn((h - q.z) / q.r); pts.push(...arc(q, a, -Math.PI - a)); }   // вырез сверху: через низ круга
    pts.push([uT0, h]);
    if (L) pts.push(...arc(L, asn((h - L.z) / L.r), asn(-L.z / L.r)));   // слева — правая дуга круга, сверху вниз
    const cl = []; for (const p of pts) { const q = cl[cl.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) cl.push(p); }
    if (cl.length > 1 && Math.hypot(cl[0][0] - cl[cl.length - 1][0], cl[0][1] - cl[cl.length - 1][1]) < 1e-6) cl.pop();
    if (cl.length < 3) continue;
    const sh = new THREE.Shape(cl.map(([x, y]) => new THREE.Vector2(x, y)));
    const lo = L ? L.u + L.r : u0, hi = R ? R.u - R.r : u1;
    for (const q of rest) if (q.z - q.r > 1e-4 && q.z + q.r < h - 1e-4 && q.u - q.r > lo && q.u + q.r < hi) { const hp = new THREE.Path(); hp.absarc(q.u, q.z, q.r, 0, Math.PI * 2, true); sh.holes.push(hp); }
    out.push(sh);
  }
  return out;
}
VV.pipeHoles = M => M.rect ? [] : (M.pipes || []).flatMap(p => { const r = (p.gR ? p.gR : p.ro + .02) + .001, zc = p.gR ? p.gz : p.z;
  return [{ang: p.ang, zc, r}].concat(p.through ? [{ang: p.ang + Math.PI, zc, r}] : []); });

/* ---------------- разрез: линия в плане (локальные оси) o + s·u ---------------- */
function cutPrim(e, ox, oy, phi) {
  const LC = (x, y, r) => lineCircle(x - ox, y - oy, r, phi), LB = (x0, x1, y0, y1) => lineBox((x0 + x1) / 2 - ox, (y0 + y1) / 2 - oy, (x1 - x0) / 2, (y1 - y0) / 2, 0, phi);
  const holesOut = (iv, holes) => { let r = [iv]; for (const h of holes || []) { const c = LC(h.x, h.y, h.r); if (c) r = r.flatMap(q => minus(q, c)); } return r; };
  if (e.shape === 'box') { const b = LB(e.x0, e.x1, e.y0, e.y1); return b ? holesOut(b, e.holes) : null; }
  if (e.shape === 'frame') { const b = LB(e.x0, e.x1, e.y0, e.y1); if (!b) return null; return minus(b, LB(e.ix0, e.ix1, e.iy0, e.iy1)); }
  if (e.shape === 'cyl' || e.rout) { const o = LC(e.cx || 0, e.cy || 0, e.rout || e.r); if (!o) return null; const i = e.rin > 0 ? LC(e.cx || 0, e.cy || 0, e.rin) : null; return holesOut(o, e.holes).flatMap(q => minus(q, i)); }
  return null;
}
// проекция элемента на линию разреза (для вида за плоскостью): [s0, s1] и сторона (знак нормали)
function viewPrim(e, ox, oy, phi) {
  const ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux;
  if (e.shape === 'box' || e.shape === 'frame') { const pts = [[e.x0, e.y0], [e.x1, e.y0], [e.x1, e.y1], [e.x0, e.y1]].map(([x, y]) => [(x - ox) * ux + (y - oy) * uy, (x - ox) * nx + (y - oy) * ny]);
    return {s0: Math.min(...pts.map(p => p[0])), s1: Math.max(...pts.map(p => p[0])), d: pts.reduce((a, p) => a + p[1], 0) / 4}; }
  const cx = e.cx || 0, cy = e.cy || 0, r = e.rout || e.r || .4, sc = (cx - ox) * ux + (cy - oy) * uy;
  return {s0: sc - r, s1: sc + r, d: (cx - ox) * nx + (cy - oy) * ny};
}
VV.cut = function (M, phi, ox = 0, oy = 0) {
  const out = [], view = [];
  for (const e of M.els) {
    if (e.kind === 'РШ') { const G2 = KC.GRATE, fr = lineBox(e.cx - ox, e.cy - oy, G2.a, G2.a, 0, phi), fi = lineBox(e.cx - ox, e.cy - oy, G2.a - G2.w, G2.a - G2.w, 0, phi), gr = lineCircle(e.cx - ox, e.cy - oy, G2.R + G2.r, phi);
      if (fr) for (const iv of minus(fr, fi)) out.push({s0: iv[0], s1: iv[1], z0: e.z0, z1: e.z0 + G2.t, key: e.key, cls: 'iron'});
      if (gr) out.push({s0: gr[0], s1: gr[1], z0: e.z0 + G2.t, z1: e.z0 + G2.t + 2 * G2.r, key: e.key, cls: 'iron'});
      continue; }
    if (e.kind === 'ПД') { const b = lineBox(e.cx - ox, e.cy - oy, 1.25, .875, VV.pdAng(e), phi);
      if (b) { for (const [r, z0, z1] of [[.29, e.z0, e.z0 + .11], [.47, e.z0 + .11, e.z1]]) for (const iv of minus(b, lineCircle(e.cx - ox, e.cy - oy, r, phi))) out.push({s0: iv[0], s1: iv[1], z0, z1, key: e.key, cls: 'conc'}); }
      else { const v = viewPrim({cx: e.cx, cy: e.cy, rout: 1.25}, ox, oy, phi); view.push({...v, z0: e.z0, z1: e.z1, key: e.key}); }
      continue; }
    if (e.kind === 'ЛЮК') { const iv = cutPrim(e, ox, oy, phi);
      if (iv) { for (const q of iv) out.push({s0: q[0], s1: q[1], z0: e.z0, z1: e.z1, key: e.key, cls: 'iron'}); const lid = lineCircle(e.cx - ox, e.cy - oy, .305, phi); if (lid) out.push({s0: lid[0], s1: lid[1], z0: e.z1 - .035, z1: e.z1 - .005, key: e.key, cls: 'iron'}); }
      else { const v = viewPrim(e, ox, oy, phi); view.push({...v, z0: e.z0, z1: e.z1, key: e.key, cls: 'iron'}); }
      continue; }
    const reps = e.kind === 'КО' ? Array.from({length: e.q}, (_, i) => [e.z0 + i * .08, e.z0 + i * .08 + .07]) : [[e.z0, e.z1]];
    const iv = cutPrim(e, ox, oy, phi), vh = e.kind === 'КС' ? VV.pipeHoles(M) : [], wh = e.kind === 'СТ' ? VV.wallHoles(M) : [];
    if (iv && iv.length) { for (const [z0, z1] of reps) for (const q of iv) if (q[1] - q[0] > 1e-6) {
      if (wh.length) {   // 0.13: монолитная стена на линии разреза — за вычетом проёма под трубу (разрезы вдоль осей — проём прямоугольником)
        const sm = (q[0] + q[1]) / 2, x = ox + sm * Math.cos(phi), y = oy + sm * Math.sin(phi), xw = Math.abs(x) > M.A / 2 - 1e-6 && Math.abs(x) - M.A / 2 >= Math.abs(y) - M.B / 2, sg = Math.sign(xw ? x : y) || 1;
        let zs = [[z0, z1]];
        for (const h of wh) if (h.xw === xw && h.sg === sg) { const d = (xw ? y : x) - h.u; if (Math.abs(d) >= h.r) continue; const hh = Math.sqrt(h.r * h.r - d * d), c0 = h.z - hh, c1 = h.z + hh;
          zs = zs.flatMap(([a, b]) => c1 <= a || c0 >= b ? [[a, b]] : [[a, c0], [c1, b]].filter(([u, v]) => v - u > 1e-4)); }
        for (const [a, b] of zs) out.push({s0: q[0], s1: q[1], z0: a, z1: b, key: e.key, cls: 'mono'});
        continue; }
      if (!vh.length) { out.push({s0: q[0], s1: q[1], z0, z1, key: e.key, cls: e.mono ? 'mono' : 'conc'}); continue; }
      // 0.12: стенка кольца на стороне разреза — за вычетом проёмов под гильзы
      const sm = (q[0] + q[1]) / 2, sd = Math.atan2(oy + sm * Math.sin(phi), ox + sm * Math.cos(phi));
      for (const [a, b] of KC._.wallCutZ(vh, sd, (e.rin + e.rout) / 2, z0, z1)) out.push({s0: q[0], s1: q[1], z0: a, z1: b, key: e.key, cls: 'conc'}); } }
    else { const v = viewPrim(e, ox, oy, phi); for (const [z0, z1] of reps) view.push({...v, z0, z1, key: e.key}); }
  }
  return {out, view};
};

/* ---------------- шаги сборки ---------------- */
VV.skCount = (M, key) => M.steps.filter(s => s.of === key).length;
VV.stepsOf = function (M) {
  const w = M.w, out = [], seis = M.seis;
  const kgs = m => M.cat[m] ? `${M.cat[m].code && M.cat[m].code !== '-' && !/^т\.пр|^серия/.test(M.cat[m].code) ? M.cat[m].code + ' · ' : ''}${fmt(M.cat[m].kg / 1000, 2)} т` : '';
  const H = z => sgn(z - M.zg), nG = M.hatches.length, xN = nG > 1 ? ` ×${nG}` : '';
  const Du = mm(M.Du), du = mm(M.du), skT = n => `Скобы ×${n} — в отверстия, на растворе, под лазом.`;
  const seamOf = (kind, el) => M.seams.filter(s => s.kind === kind && s.above === el);
  const msTxt = s => `${s.mark} ×${s.n} ${s.kind === 'ring' || s.kind === 'pn' || s.kind === 'pp' ? KC.msLay({go: 0}, s) : 'на осях'}`;
  const gout = N(w, 'gout'), gin = N(w, 'gin');
  // гильзы: «Ø530×7» (у ответвления другого диаметра — через «и»)
  const gl = M.pipes.filter(p => p.sl), gilTxt = [...new Set(gl.map(p => `Ø${p.gD}×${p.gSmm}`))].join(' и ');
  // 0.12: просадочные — уплотнение основания и водоупорный замок отдельными шагами, картинка — сверху
  const soilStep = {els: ['baseC'], kind: 'BASE', top: true, t: 'Уплотнение основания', fc: 'В3 — просадочные · на 1 м · ТПР 901-09-11.84, Альбом I',
    todo: ['Грунт под колодцем — уплотнить на глубину 1 м.', 'Слоями, с поливом — до плотности по проекту.', 'Площадь — шире плиты днища.'], chk: 'Плотность — по акту.'};
  const zamStep = {els: ['zamok'], kind: 'ZAM', top: true, t: 'Водоупорный замок', fc: 'мятая глина, слоями · ТПР 901-09-11.84',
    todo: ['Снаружи у проходов труб — после заделки.', 'Глина — слоями, с трамбованием.', 'Пазухи — местным глинистым грунтом, слоями.'], chk: 'Плотно у труб, без пустот.'};
  // 0.13: задвижки и фасонные части (трубопроводная арматура) — по схеме узла из проекта сети; в ТПР их нет, в 3D не показываем
  const fit = `Задвижки, фасонные части — по ${S(w, 'uzel') ? 'схеме узла ' + S(w, 'uzel') : 'проекту'} (в 3D не показаны).`;
  const pipeStep = (after) => ({els: ['pipe'].concat(gl.length && !M.rect ? ['gil'] : []), t: `Трубы Ду${Du}${M.du ? ` и ду${du}` : ''}`, fc: `заделка — бетон ${fmt(N(w, 'zad'))} м³${N(w, 'upr') ? ` · упор ${fmt(N(w, 'upV'))} м³` : ''}`,
    todo: gl.length ? [M.rect ? `В гильзы стен; низ трубы — ${H(M.otst)} м.` : `Гильзы ${gilTxt}, L ${mm(M.gilL)} — заподлицо изнутри.`,
      M.rect ? (M.gilEcc ? 'Труба — в низ гильзы.' : 'Гильзы — по осям труб.') : `Трубы — в ${M.gilEcc ? 'низ гильз' : 'гильзы'}, низ ${H(M.otst)} м.`,
      N(w, 'upr') ? `Упор под фасонные части — бетон М100.` : fit]
      : [`В проёмы ${after}; низ трубы — ${H(M.otst)} м.`,
      fit,
      N(w, 'upr') ? `Упор под фасонные части — бетон М100.` : M.gzWet ? 'Проёмы — бетоном, снаружи битум.' : 'Проёмы — бетоном.'],
    chk: gl.length ? 'Отметки; зазор — прядь и герметик, не раствор.' : 'Отметки и уклоны труб.'});
  // 0.11: гидроизоляция — по грунтовым условиям: битум только в зонах (вода — снизу до УГВ + запас, пучение — сверху до промерзания)
  const zTxt = [M.gzWet ? `снизу до ${H(M.zW)} м (УГВ + ${fmt(M.gzap, 1)})` : '', M.fz > 0 ? `сверху до ${fmt(M.fz)} м от земли` : ''].filter(Boolean).join(', ');
  const tapeAt = z => M.tapes.some(t => Math.abs(t.z - z) < .03);
  if (!M.rect) {
    if (M.okl) out.push({els: ['coat'], pre: true, nohi: true, t: 'Мастика — до сборки', fc: `снаружи ${fmt(gout)} м² · оклеечная`,
      todo: ['На земле: огрунтовка и битумная мастика.', 'Гидроизол наклеивается после сборки, 2–3 слоя.', 'Днище снизу — до укладки, в 2–3 слоя.'], chk: 'Без пропусков; кромки — для нахлёста.'});
    else if (M.gzOut) out.push({els: ['coat'], pre: true, nohi: true, t: 'Битум — до сборки', fc: `снаружи ${fmt(gout)} м²`,
      todo: M.gzAll ? ['На земле: огрунтовка, горячий битум 2 слоя — кольца и плиты снаружи.', 'Днище снизу и с торцов — тоже.', 'Остыл — в котлован.']
        : ['На земле: огрунтовка, горячий битум 2 слоя.', `Снаружи ${zTxt}.`, M.gzWet ? 'Днище снизу и с торцов — асфальт 10 мм.' : 'Пучинистые грунты: меньше смерзание.'],
      chk: M.gzAll ? 'Без пропусков.' : 'Без пропусков; граница зоны — по отметке.'});
    for (const e of M.els) {
      const base = {els: [e.key], fc: kgs(e.mark), kind: e.kind};
      if (e.kind === 'ПН') {
        const bt = M.grunt === 'I' ? ['Дно котлована выровнять, не нарушая грунт.', 'Песчаная подготовка 100 мм — разровнять и уплотнить.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`]
          : M.grunt === 'II' ? ['Бетонная подготовка М50 — 100 мм.', 'По ней гидроизоляция 10 мм.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`]
          : ['По уплотнённому грунту — бетон М50, 100 мм.', 'Поверхность — горизонтально, по отметке.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`];
        if (M.grunt === 'III') out.push(soilStep);
        out.push({els: ['base'], kind: 'BASE', top: M.grunt === 'III', t: M.grunt === 'III' ? 'Бетонная подготовка' : 'Основание под колодец', fc: `${M.gruntName}${N(w, 'v50r') ? ` · М50 ${fmt(N(w, 'v50r'))} м³` : ''} · Альбом II, АС-1`, todo: bt, chk: 'Отметка и горизонтальность.'});
        out.push({...base, t: `Плита днища ${e.mark}`, todo: [M.grunt === 'I' ? 'На песчаную подготовку строго горизонтально.' : 'На цементно-песчаный раствор 20 мм, строго горизонтально.', `Верх плиты — дно колодца: ${H(0)} м от земли.`], chk: 'Горизонтальность плиты.'});
      } else if (e.kind === 'КС') {
        const sm = seamOf(e.first ? 'pn' : 'ring', e)[0], n = VV.skCount(M, e.key);
        const tU = e.first ? M.tapes.some(t => t.lo === 0) : tapeAt(e.z0 - SEAM / 2);
        const todo = [sm ? `${msTxt(sm)} — на ${e.first ? 'днище' : 'кольцо'}, затем раствор.` : 'На раствор М100, шов 10 мм, соосно.',
          e.first ? `Проёмы под трубы — ${M.du ? 3 : 2} шт., низ ${H(M.otst)} м.` : `Верх кольца — ${H(e.z1)} м.`];
        if (n) todo.push(skT(n));
        out.push({...base, els: sm ? [e.key, sm.key] : [e.key], t: `Кольцо ${e.mark}${e.first ? ' — нижнее' : ''}`, todo,
          chk: tU ? (e.first ? 'Вертикальность; стык с днищем — лентой Г-образно.' : 'Вертикальность; стык снизу — лентой.') : 'Вертикальность; швы заполнены.'});
        if (e.first) { out.push(pipeStep('нижнего кольца')); if (M.zamok) out.push(zamStep); }
      } else if (e.kind === 'ПП') {
        const sm = seamOf('pp', e)[0];
        out.push({...base, els: sm ? [e.key, sm.key] : [e.key], t: `Плита перекрытия ${e.mark}`,
          todo: [sm ? `${msTxt(sm)} — на кольцо, полкой наружу.` : 'На раствор М100, шов 10 мм.',
            M.g1000 ? 'Отверстие Ø1000 — над скобами.' : `Лаз Ø700 — над скобами${M.pg ? (M.pgShift > .005 ? `; гидрант — со сдвигом ${mm(M.pgShift)} мм к лазу` : ', гидрант по центру') : ''}.`, `Верх плиты — ${H(e.z1)} м.`],
          chk: M.pg && !M.g1000 ? `Гидрант — в 200 мм от оси люка${M.pgShift > .005 ? '' : ' (в центре)'}.` : 'Лаз над скобами.'});
      } else if (e.kind === 'К10') {
        const sm = M.seams.find(s => s.above === e), n = VV.skCount(M, e.key);
        out.push({...base, els: sm ? [e.key, sm.key] : [e.key], t: `Кольцо горловины ${e.mark}`, todo: [sm ? `${msTxt(sm)} на стыке.` : 'На раствор М100, соосно.', 'Горловина Ø1000 — СНиП РК, п. 11.62.'].concat(n ? [skT(n)] : []), chk: 'Соосность с отверстием плиты.'});
      } else if (e.kind === 'П10') {
        const sm = M.seams.find(s => s.above === e);
        out.push({...base, els: sm ? [e.key, sm.key] : [e.key], t: 'Плита ПП10-2 на горловину 1000', todo: [sm ? `${msTxt(sm)} на стыке.` : 'На раствор М100.', 'Лазом к стенке со скобами — скобы ведут прямо в люк.',
          M.pg ? `Гидрант — в 200 мм от оси люка: сдвиг от центра колодца ${mm(M.pgShift)} мм к горловине.` : `Верх плиты — ${H(e.z1)} м.`], chk: 'Лаз Ø700 — над скобами горловины.'});
      } else gorlStep(M, e, out, base, kgs, H);
    }
  } else {
    const ax = M.A, by = M.B, beams = M.beams, plates = M.plates;
    const plC = M.plates.some(p => KC.coated(M, p.z0, p.z1)), gC = M.hatches.some(g => g.els.some(e => ['КГ', 'КО', 'НБ'].includes(e.kind) && KC.coated(M, e.z0, e.z1)));
    const what = M.gzAll ? 'днище, плиты, кольца горловин' : [M.gzWet ? 'днище' : '', plC ? 'плиты' : '', gC ? 'кольца горловин' : ''].filter(Boolean).join(', ');
    if (M.okl) out.push({els: ['coat'], pre: true, nohi: true, t: 'Мастика — до монтажа', fc: 'днище, плиты, горловины · оклеечная',
      todo: ['На земле: огрунтовка и битумная мастика.', 'Гидроизол — после сборки, 2–3 слоя.', 'Днище снизу — до укладки.'], chk: 'Без пропусков; кромки — под нахлёст.'});
    else if (what) out.push({els: ['coat'], pre: true, nohi: true, t: M.gzAll ? 'Битум на сборные — до монтажа' : 'Битум — до монтажа', fc: what,
      todo: M.gzAll ? ['На земле: огрунтовка, горячий битум 2 слоя.', 'Днище — снизу и с торцов, плиты — сверху и с торцов.', 'Остыл — в котлован.']
        : ['На земле: огрунтовка, горячий битум 2 слоя.', zTxt ? `${zTxt[0].toUpperCase() + zTxt.slice(1)}.` : 'Снаружи — по зонам.', M.gzWet ? 'Днище — снизу и с торцов асфальт 10 мм.' : 'Остыл — в котлован.'], chk: 'Без пропусков.'});
    const bt = M.grunt === 'III' ? ['По уплотнённому грунту — бетон М50, 100 мм.', 'Поверхность — горизонтально, по отметке.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`]
      : ['Бетонная подготовка М50 — 100 мм.', M.grunt === 'II' ? 'По ней гидроизоляция 10 мм.' : 'Поверхность — горизонтально, по отметке.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`];
    if (M.grunt === 'III') out.push(soilStep);
    out.push({els: ['base'], kind: 'BASE', top: M.grunt === 'III', t: M.grunt === 'III' ? 'Бетонная подготовка' : 'Основание под колодец', fc: `${M.gruntName} · бетон М50 ${fmt(N(w, 'v50'))} м³ · Альбом IV, АС-1`, todo: bt, chk: 'Отметка и горизонтальность.'});
    out.push({els: [M.dE.key], t: `Плита днища ${M.dE.mark}`, fc: kgs(M.dE.mark), kind: 'ДН', todo: ['На раствор 20 мм, строго горизонтально.', `${mm(M.dX * 2)}×${mm(M.dY * 2)}×${mm(M.pnH)}; верх — дно, ${H(0)} м.`], chk: 'Горизонтальность плиты.'});
    const nsk = Math.floor(M.V / .3 + 1e-6), set10 = N(w, 'set10'), setR = N(w, 'setR');
    // 0.13: шаг «опалубка и скобы» был перегружен — арматура и гильзы отдельным шагом (сначала арматура и гильзы, потом щиты и скобы)
    const hasArm = !!M.armKind || M.pipes.some(p => p.Du >= .5 - 1e-6), split = hasArm || gl.length > 0;
    if (split) out.push({els: ['arm'].concat(gl.length ? ['gil'] : []), kind: 'ARM', t: hasArm ? (gl.length ? 'Стены: арматура и гильзы' : 'Стены: арматура') : 'Стены: гильзы',
      fc: [M.seis ? `С3Вр1 ${fmt(setR, 0)} кг` : M.kzh ? 'по КЖ, условно' : '', set10 ? `сеток ⌀10 — ${set10}` : '', gl.length && !M.seis && !set10 ? `гильз — ${M.gil}` : ''].filter(Boolean).join(' · '),
      todo: [M.seis ? 'Сетка С3Вр1 у обеих граней, слой 20 мм.' : M.kzh ? 'Арматура стен — по разделу КЖ.' : '',
        set10 ? 'Проёмы Ду ≥ 500 — 2 сетки ⌀10 (АС-2).' : '',
        gl.length ? `Гильзы ${gilTxt}, L ${mm(M.gilL)} — ${M.gilEcc ? 'над осями труб' : 'по осям труб'}.` : ''].filter(Boolean),
      chk: gl.length ? 'Гильзы — по осям и отметкам.' : 'Защитный слой — на фиксаторах.'});
    out.push({els: ['form', 'skw'].concat(split ? [] : ['arm']), kind: 'FORM', split, t: 'Стены: опалубка и скобы', fc: `t = ${mm(M.t)} · Hр ${mm(M.V)}`,
      todo: [`Щиты снаружи и внутри, ${mm(ax)}×${mm(by)} в свету.`, `Скобы ⌀18 — сквозь щит под лазом: ${nsk} шт.${nG > 1 ? ` ×${nG}` : ''}, через 300.`,
        gl.length ? 'Гильзы — заподлицо с гранями стен.' : 'Проёмы под трубы — вкладыши в опалубке.'],
      chk: M.seis ? 'Скобы — заделка 110–120; сетка С3Вр1 — по ТПР VI.88.' : M.kzh ? 'Скобы — заделка 110–120; арматура стен — условно (КЖ).' : 'Скобы — заделка 110–120; стены — бетон без арматуры (ТПР).'});
    out.push({els: ['wall'], kind: 'СТ', t: 'Стены — бетон М150', fc: `${fmt(N(w, 'v150'))} м³ · монолит`,
      todo: ['Из автобетоносмесителя, слоями 0,3–0,5 м, вибрировать.', `Верх стен — ${H(M.V)} м, горизонтально.`,
        M.okl || M.gzAll ? 'Распалубка — по прочности; снаружи битум.' : !KC.coated(M, 0, M.V) ? 'Распалубка — по прочности.'
          : M.gzWet && M.fz > 0 ? 'Распалубка; битум снаружи — по зонам.' : M.gzWet ? `Распалубка; битум снаружи до ${H(M.zW)} м.` : `Распалубка; битум сверху до ${fmt(M.fz)} м.`],
      chk: 'Скобы — одной вертикалью.'});
    out.push(pipeStep('стен'));
    if (M.zamok) out.push(zamStep);
    if (beams.length) out.push({els: beams.map(b => b.key), t: `Балки Б8${beams.length > 1 ? ' ×' + beams.length : ''}`, fc: kgs('Б8'), kind: 'БЛ',
      todo: ['Поперёк колодца, на стены, на раствор.', 'Гнёзда в стенах — заделать бетоном.', 'Верх — в уровень верха стен.'], chk: 'Положение — по плану перекрытия.'});
    const hp = plates.filter(p => p.hole), np = plates.filter(p => !p.hole), cnt = arr => { const o = {}; arr.forEach(p => { o[p.mark] = (o[p.mark] || 0) + 1; }); return Object.entries(o).map(([m, q]) => m + (q > 1 ? ' ×' + q : '')).join(', '); };
    out.push({els: plates.map(p => p.key), t: 'Плиты перекрытия', fc: `${plates.length} шт. · раскладка — лист «План перекрытия»`, kind: 'ПЛ',
      todo: [`С лазами: ${cnt(hp)}.`, `Доборные: ${cnt(np)}.`, M.lay.warn.length ? 'Щели у торцов — заделать (см. план).' : 'На раствор М100, швы — заполнить.'],
      chk: 'Лазы — над скобами в стенах.'});
    M.hatches.forEach(g => g.els.forEach(e => gorlStep(M, e, out, {els: [e.key], fc: kgs(e.mark), kind: e.kind}, kgs, H, nG)));
    // горловины одинаковые: шаги по горловинам объединяем (одна строка на элемент, ×nG)
  }
  const nT = M.tapes.length, inTxt = M.pII ? 'Внутри стены и днище — горячий битум 4–5 мм.' : `Внутри${M.gzAll ? '' : ` до ${H(M.zW)} м`} — Битрон-11, ${fmt(M.bitron, 1)} кг/м².`;
  if (M.okl) out.push({els: ['coatfin'], nohi: true, fin: true, t: 'Гидроизоляция оклеечная', fc: `снаружи ${fmt(gout)} м² · УГВ выше перекрытия`,
    todo: [`Гидроизол 2–3 слоя на мастике до ${H(M.zOkl)} м.`, 'Защитная стенка; проходы труб — на мастике.', `Внутри — ${fmt(gin)} м² (по проекту).`],
    chk: 'Вне ТПР: прочность и всплытие — КЖ.'});
  else if (M.gzOld) out.push({els: ['coatfin'], nohi: true, fin: true, t: 'Гидроизоляция — доделка', fc: `снаружи ${fmt(gout)} м² · внутри ${fmt(gin)} м²`,
    todo: [`Проходы труб${seis ? ', МС' : ''}, сколы — битумом.`, M.rect ? 'Стены снаружи — битум 2 слоя.' : 'Швы снаружи — битумом.', `Внутри — ${fmt(gin)} м² (по проекту).`],
    chk: 'Засыпка — после остывания битума.'});
  else if (M.gzWet || gin > 0 || nT) out.push({els: ['coatfin'], nohi: true, fin: true, t: 'Гидроизоляция — доделка',
    fc: [nT ? `лента ${fmt(N(w, 'lenta'))} м²` : '', gin ? `внутри ${fmt(gin)} м²` : ''].filter(Boolean).join(' · ') || `снаружи ${fmt(gout)} м²`,
    todo: [M.gzWet ? `Проходы труб${seis ? ', МС' : ''}, сколы — битумом.` : '', gin ? inTxt : '', nT ? `Лента ГИ-Г — ${nT} ${nT % 10 === 1 && nT % 100 !== 11 ? 'стык' : nT % 10 >= 2 && nT % 10 <= 4 && (nT % 100 < 12 || nT % 100 > 14) ? 'стыка' : 'стыков'}${M.gzAll || M.okl ? '' : ' в зоне воды'}.` : ''].filter(Boolean),
    chk: M.gzOut ? 'Засыпка — после остывания битума.' : 'Покрытие без пропусков.'});
  // объединить одинаковые шаги горловин (прямоугольные с несколькими люками)
  if (M.rect && nG > 1) {
    const res = [], seen = new Map();
    for (const s of out) { const k = s.gk; if (k && seen.has(k)) { const p = seen.get(k); p.els.push(...s.els); continue; } if (k) seen.set(k, s); res.push(s); }
    return res;
  }
  return out;
};
function gorlStep(M, e, out, base, kgs, H, nG = 1) {
  const xN = nG > 1 ? ` ×${nG}` : '', gk = e.hatch !== undefined ? e.kind + e.mark + (e.z0 - (M.hatches[e.hatch] || {z0: 0}).z0).toFixed(3) : null;
  const sms = M.seams.filter(s => s.above === e || (s.kind === 'gorl' && s.below === e)), nsk = VV.skCount(M, e.key);
  if (e.kind === 'РШ') out.push({...base, gk, t: `Защитная решётка${xN}`, fc: `своя разработка · ${fmt(M.cat[e.mark] ? M.cat[e.mark].kg : KC.GRATE.kg, 1)} кг`,
    todo: ['В плите — 4 отв. Ø20, глубина 100.', 'Рамку 620×620 — анкерами Ø12 на клей.', 'Решётку на рамку; петли — на сварку.'],
    chk: 'Рамка — в шве под горловиной; решётка на петлях.'});
  else if (e.kind === 'РВ') {
    const hs = M.hatches.filter(g => g.lev), dh = mm(e.z1 - e.z0);
    out.push({...base, gk: 'РВ', t: `Выравнивающий слой под горловину${hs.length > 1 ? 'ми' : ''}`, fc: `раствор М100 · ${dh} мм · люк${hs.length > 1 ? 'и' : ''} ${hs.map(g => g.i + 1).join(', ')}`,
      todo: [`Плита у ${hs.length > 1 ? 'этих люков' : 'этого люка'} тоньше на ${dh} мм.`, `Раствор М100 по кольцу Ø700/840, ${dh} мм — под КС7.`, 'Все люки — на одной отметке.'], chk: 'Отметка верха слоя.'});
  }
  else if (e.kind === 'НБ') {
    const g = M.hatches[e.hatch], on = g && g.rings.length ? 'верх КС7' : 'плиту';
    out.push({...base, gk, t: `Набетонка горловины${xN}`, fc: `бетон М100 · ${fmt(M.nabV, 3)} м³ · h ${mm(e.z1 - e.z0)} мм`,
      todo: ['Опалубка по кольцу КС7: снаружи Ø840, внутри Ø700.', `Бетон М100 — на ${on}, уплотнить; верх — горизонтально.`, g && g.ko ? 'Набрал прочность — КО6 на раствор.' : 'Набрал прочность — дальше по шагам.'],
      chk: 'Отметка верха — под КО6 и люк.'});
  }
  else if (e.kind === 'КГ' || e.kind === 'КО') {
    const lines = [];
    const sp = sms.find(s => s.kind === 'ppg'), sk = sms.find(s => s.kind === 'gko'), sg = M.seams.find(s => s.kind === 'gorl' && s.below === e);
    if (sp) lines.push(`На стыке с плитой — ${sp.mark} ×4 (длинная полка внутрь).`);
    if (sk) lines.push(`На верх ${sk.below.kind === 'НБ' ? 'набетонки' : 'КС7'} — МС-5 ×4 на осях: короткая полка внутрь вниз.`);
    if (e.kind === 'КО' && M.dobor === 'набетонка') lines.push(`На раствор М100${M.nabJ > .0005 ? `, шов под КО6 — ${mm(SEAM + M.nabJ)} мм (добор)` : ''}.`, (M.hatches[e.hatch] || {}).nab ? 'Добор — набетонкой ниже: КО6 только под люк.' : 'Без округления: люк — точно на отметке.');
    else if (e.kind === 'КО') lines.push(`Добор до отметки люка; каждое — на раствор М100${M.seis ? ', между КО6 без МС' : ''}.`, 'Количество округлено вверх: люк чуть выше, а не ниже.');
    else lines.push('На раствор М100, соосно лазу.');
    if (sg) lines.push(`На шов сверху — ${sg.mark} ×4 на осях.`);
    if (nsk) { const t = `Скобы ×${nsk} — в отверстия, на растворе, под лазом.`; if (lines.length < 3) lines.push(t); else lines[lines.length - 1] = t; }
    out.push({...base, gk, els: [e.key].concat(sms.map(s => s.key)), t: (e.kind === 'КО' ? `Кольца опорные КО6${e.q > 1 ? ' ×' + e.q : ''}` : `Кольцо горловины ${e.mark}`) + (nG > 1 ? ` (${nG} горл.)` : ''),
      fc: e.kind === 'КО' ? kgs('КО6') + (e.q > 1 ? ` · ${e.q} шт.` : '') : kgs(e.mark), todo: lines.slice(0, 3), chk: e.kind === 'КО' ? 'Отметка под люк.' : 'Соосность с лазом.'});
  } else if (e.kind === 'ПД') out.push({...base, gk, t: `Плита дорожная ПД6${xN}`, todo: ['Укладывается вокруг горловины на дороге.', 'Люк садится в нишу плиты Ø940.']
      .concat(M.pdRot && M.pdRot.length ? [`У люк${M.pdRot.length > 1 ? 'ов' : 'а'} ${M.pdRot.join(' и ')} — развернуть на 90° (см. план).`] : []), chk: 'Люк выступает над ПД6 на 70 мм — под слой покрытия.'});
  else if (e.kind === 'ЛЮК') {
    const sur = M.place === 'Д' ? 'Покрытие дороги — вровень с люком.' : M.place === 'Т' ? 'Плитка тротуара вокруг люка.' : `Асфальтовая отмостка вокруг люка, ≈Ø${mm(2 * M.otmR)} мм.`;
    out.push({...base, gk, els: [e.key, 'surf'], t: `Люк ${S(M.w, 'hatch')}${xN}`, fc: `${M.cat[e.mark] ? M.cat[e.mark].code + ' · ' + M.cat[e.mark].kg + ' кг' : ''}`,
      todo: [`${M.hat[2]}.`, `Верх люка — ${H(M.hatches[e.hatch].ztop)} м от земли.`, sur], chk: N(M.w, 'over') > 0 ? `Выше расчётной отметки на ${N(M.w, 'over')} мм — за счёт округления КО6.` : 'Отметка люка.'});
  }
}

/* ---------------- 3D-сцена ---------------- */
VV.buildScene = function (M, THREE) {
  const C = KC.COL, scene = new THREE.Scene(), meshes = [], mats = new Map(), xmats = [];
  const grp = new THREE.Group(); grp.rotation.z = M.go; scene.add(grp);
  const mat = (col, o = {}) => { const key = col + JSON.stringify(o); if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({color: col, roughness: .88, metalness: 0, side: THREE.DoubleSide}, o))); return mats.get(key); };
  const edgeMat = new THREE.LineBasicMaterial({color: C.edge, transparent: true, opacity: .35});
  const put = (geo, col, key, opt = {}) => {
    const m = new THREE.Mesh(geo, opt.mat || mat(col, opt.m || {})); m.userData = {key, cap: false, lvl: opt.lvl ?? 0, base: m.material, of: opt.of, part: opt.part};
    if (opt.pos) m.position.set(...opt.pos); if (opt.rotz) m.rotation.z = opt.rotz;
    grp.add(m); meshes.push(m);
    if (opt.edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat); e.userData = {key, line: true, lvl: opt.lvl ?? 0, cap: false, of: opt.of}; if (opt.pos) e.position.set(...opt.pos); if (opt.rotz) e.rotation.z = opt.rotz; grp.add(e); meshes.push(e); }
    return m;
  };
  const circ = (x, y, r, cw) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, cw); return p; };
  const rectP = (x0, y0, x1, y1, hole) => { const p = hole ? new THREE.Path() : new THREE.Shape(); if (hole) { p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.lineTo(x0, y0); } else { p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.lineTo(x0, y0); } return p; };
  const ext = (sh, h, seg = 64) => new THREE.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false, curveSegments: seg});
  const ringGeo = (cx, cy, rin, rout, h, seg = 72) => { const sh = new THREE.Shape(); sh.absarc(cx, cy, rout, 0, Math.PI * 2, false); if (rin > 0) sh.holes.push(circ(cx, cy, rin, true)); return ext(sh, h, seg); };
  // уровни разнесённого вида
  const lvl = new Map(); let L = 0;
  const lv = (key, l) => { lvl.set(key, l); return l; };
  for (const e of M.els) {
    if (e.hatch !== undefined) { const g = M.hatches[e.hatch], base = M.rect ? 4 : (M.g1000 ? M.k10.length + 2 : 1) + M.rings.length + 1, gl = g.els.filter(x => x.kind !== 'РВ');
      lvl.set(e.key, e.kind === 'РВ' ? base - .5 : base + gl.indexOf(e)); }
    else if (M.rect) lvl.set(e.key, e.kind === 'ДН' ? 0 : e.kind === 'СТ' ? 1 : e.kind === 'БЛ' ? 2 : 3);
    else lvl.set(e.key, L++);
  }
  M.lvlOf = k => lvl.get(k) ?? 0;
  const vh = VV.pipeHoles(M);   // 0.12: проёмы под гильзы в кольцах круглых
  const wh = VV.wallHoles(M);   // 0.13: проёмы под трубы в стенах прямоугольных
  // 0.13: стены прямоугольных — 4 плиты (продольные — на всю длину, торцевые — между ними); off — от внутренней грани, th — толщина;
  // UV — как у прежней цельной «рамки» (U — вдоль стены, V = 1 − z; сверху — x, y): щиты и стяжки на тех же местах
  const wallUV = g => { const P = g.attributes.position, uv = g.attributes.uv, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i + 2 < P.count; i += 3) { a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2); const n = c.clone().sub(b).cross(a.clone().sub(b)), nx = Math.abs(n.x), ny = Math.abs(n.y), nz = Math.abs(n.z);
      for (let j = 0; j < 3; j++) { const x = P.getX(i + j), y = P.getY(i + j), z = P.getZ(i + j); if (nz >= nx && nz >= ny) uv.setXY(i + j, x, y); else if (ny >= nx) uv.setXY(i + j, x, 1 - z); else uv.setXY(i + j, y, 1 - z); } }
    uv.needsUpdate = true; return g; };
  const wallGeos = (z0, z1, off, th, holes) => { const ax = M.A / 2, by = M.B / 2, out = [];
    for (const xw of [false, true]) for (const sg of [-1, 1]) {
      const L = xw ? by + off : ax + off + th, hl = holes.filter(q => q.xw === xw && q.sg === sg).map(q => ({u: q.u, z: q.z - z0, r: q.r}));
      for (const sh of slabShapes(THREE, -L, L, z1 - z0, hl)) {
        const g = new THREE.ExtrudeGeometry(sh, {depth: th, bevelEnabled: false, curveSegments: 48}).rotateX(Math.PI / 2);   // (u, h, w) → (u, −w, h)
        if (xw) g.rotateZ(Math.PI / 2).translate(sg > 0 ? ax + off : -(ax + off + th), 0, z0);   // → (w, u, h): торцевые
        else g.translate(0, sg > 0 ? by + off + th : -(by + off), z0);
        out.push(wallUV(g)); } }
    return out; };
  for (const e of M.els) {
    const Lv = lvl.get(e.key), h = e.z1 - e.z0;
    if (e.kind === 'ПН') put(new THREE.CylinderGeometry(e.rout, e.rout, h, 96).rotateX(Math.PI / 2).translate(0, 0, (e.z0 + e.z1) / 2), C.plate, e.key, {lvl: Lv, edges: true});
    else if (e.kind === 'КС') { const hs = vh.filter(q => q.zc + q.r > e.z0 && q.zc - q.r < e.z1).map(q => ({...q, zc: q.zc - e.z0}));
      put(hs.length ? KC._.ringHolesGeo(THREE, e.rin, e.rout, h, hs) : ringGeo(0, 0, e.rin, e.rout, h, 96), e.idx % 2 ? C.ring2 : C.ring, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true}); }
    else if (e.kind === 'К10' || e.kind === 'КГ') put(ringGeo(e.cx, e.cy, e.rin, e.rout, h), C.gorl, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true});
    else if (e.kind === 'НБ') put(ringGeo(e.cx, e.cy, e.rin, e.rout, h), C.nab, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true, m: {roughness: .95}});
    else if (e.kind === 'РВ') put(ringGeo(e.cx, e.cy, e.rin, e.rout, h), C.mortar, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true, m: {roughness: .95}});
    else if (e.kind === 'КО') for (let i = 0; i < e.q; i++) put(ringGeo(e.cx, e.cy, e.rin, e.rout, .07), i % 2 ? C.gorl : C.ko, e.key, {pos: [0, 0, e.z0 + i * .08], lvl: Lv, edges: true});
    else if (e.kind === 'ПП' || e.kind === 'П10') { const sh = new THREE.Shape(); sh.absarc(e.cx, e.cy, e.rout, 0, Math.PI * 2, false); for (const o of e.holes) sh.holes.push(circ(o.x, o.y, o.r, true)); put(ext(sh, h, 96), C.plate, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true}); }
    else if (e.kind === 'ДН') put(ext(rectP(e.x0, e.y0, e.x1, e.y1), h), C.plate, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true});
    else if (e.kind === 'СТ') {
      // монолит: отпечатки щитов опалубки и стяжек (текстура в метрах); 0.13: стены — плитами с проёмами под трубы (труба полая — сквозь неё видно камеру)
      const mt = KC._.monoTexture ? KC._.monoTexture(THREE) : null, wm = new THREE.MeshStandardMaterial({color: mt ? 0xffffff : C.mono, map: mt, roughness: .92, side: THREE.DoubleSide}); xmats.push(wm);
      for (const g of wallGeos(e.z0, e.z1, 0, M.t, wh)) put(g, null, e.key, {lvl: Lv, mat: wm});
      // кромки — контур стен (как раньше) и края проёмов с обеих граней
      const fr = rectP(e.x0, e.y0, e.x1, e.y1); fr.holes.push(rectP(e.ix0, e.iy0, e.ix1, e.iy1, true));
      const pos = Array.from(new THREE.EdgesGeometry(ext(fr, h), 30).attributes.position.array).map((v, i) => i % 3 === 2 ? v + e.z0 : v);
      for (const q of wh) for (const side of [0, 1]) { const wp = q.sg * ((q.xw ? M.A : M.B) / 2 + side * M.t), n = 64, P = a => { const z = q.z + q.r * Math.sin(a), u = q.u + q.r * Math.cos(a); return q.xw ? [wp, u, z] : [u, wp, z]; };
        for (let i = 0; i < n; i++) { const a = P(i / n * 2 * Math.PI), b = P((i + 1) / n * 2 * Math.PI); if (Math.min(a[2], b[2]) >= e.z0 && Math.max(a[2], b[2]) <= e.z1) pos.push(...a, ...b); } }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const ln = new THREE.LineSegments(lg, edgeMat); ln.userData = {key: e.key, line: true, lvl: Lv, cap: false}; grp.add(ln); meshes.push(ln); }
    else if (e.kind === 'БЛ' && e.y0 < -M.B / 2 && e.y1 > M.B / 2) {
      // 0.13: концы балки — в гнёздах стен: верх концов на 2 мм ниже верха стены (совпадал с ним — «торчала» текстура балки на верху стен)
      const by = M.B / 2; put(ext(rectP(e.x0, -by, e.x1, by), h), C.beam, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true});
      for (const [ya, yb] of [[e.y0, -by], [by, e.y1]]) put(ext(rectP(e.x0, ya, e.x1, yb), h - .002), C.beam, e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true});
      if (e.it.main) for (const sg of [-1, 1]) { const yo = M.B / 2 + M.t, ye = sg > 0 ? e.y1 : -e.y0;
        if (ye > yo + .005) { const ya = sg > 0 ? yo - .01 : -(ye + .1), yb = sg > 0 ? ye + .1 : -(yo - .01), zb = e.z0 - .1;
          put(ext(rectP(e.x0 - .1, ya, e.x1 + .1, yb), M.V - zb), C.mono, e.key, {pos: [0, 0, zb], lvl: Lv, edges: true, part: 'pad'});
          e.pads = (e.pads || []).concat([[e.x0 - .1, ya, e.x1 + .1, yb, zb, M.V]]); } } }
    else if (e.kind === 'ПЛ' || e.kind === 'БЛ') { const sh = rectP(e.x0, e.y0, e.x1, e.y1); for (const o of e.holes || []) sh.holes.push(circ(o.x, o.y, o.r, true)); put(ext(sh, h), e.kind === 'БЛ' ? C.beam : (e.hole ? C.plate : C.ring), e.key, {pos: [0, 0, e.z0], lvl: Lv, edges: true});
      // концы балки, вышедшие за наружную грань стены, обетонированы по месту (приливы)
      if (e.kind === 'БЛ' && e.it.main) for (const sg of [-1, 1]) { const yo = M.B / 2 + M.t, ye = sg > 0 ? e.y1 : -e.y0;
        if (ye > yo + .005) { const ya = sg > 0 ? yo - .01 : -(ye + .1), yb = sg > 0 ? ye + .1 : -(yo - .01), zb = e.z0 - .1;
          put(ext(rectP(e.x0 - .1, ya, e.x1 + .1, yb), M.V - zb), C.mono, e.key, {pos: [0, 0, zb], lvl: Lv, edges: true, part: 'pad'});
          e.pads = (e.pads || []).concat([[e.x0 - .1, ya, e.x1 + .1, yb, zb, M.V]]); } } }
    else if (e.kind === 'РШ') {
      const G2 = KC.GRATE, o = {pos: [e.cx, e.cy, e.z0], rotz: M.hatches[e.hatch].ga, lvl: Lv, m: {metalness: .45, roughness: .5}}, zr = G2.t + G2.r, c = G2.a - G2.w / 2;
      for (const [x, y, lx, ly] of [[0, c, 2 * G2.a, G2.w], [0, -c, 2 * G2.a, G2.w], [c, 0, G2.w, 2 * G2.a - 2 * G2.w], [-c, 0, G2.w, 2 * G2.a - 2 * G2.w]]) put(new THREE.BoxGeometry(lx, ly, G2.t).translate(x, y, G2.t / 2), C.steel, e.key, {...o, part: 'frame'});
      for (const [x, y] of [[G2.anc, G2.anc], [G2.anc, -G2.anc], [-G2.anc, G2.anc], [-G2.anc, -G2.anc]]) put(new THREE.CylinderGeometry(G2.r, G2.r, G2.ancL, 10).rotateX(Math.PI / 2).translate(x, y, G2.t - G2.ancL / 2), C.steel, e.key, {...o, part: 'frame'});
      const gp = KC.gratePieces(THREE, G2, zr);   // решётка и её копия «откинута на петлях» (grOpen — только в виде изнутри)
      for (const g of gp.closed) put(g, C.steel, e.key, {...o, part: 'grate'});
      for (const g of gp.open) put(g, C.steel, 'grOpen', {...o, part: 'grateOpen', of: e.key});
    } else if (e.kind === 'ПД') {
      for (const [r, z0, hh] of [[.29, e.z0, .11], [.47, e.z0 + .11, .11]]) { const sh = rectP(-1.25, -.875, 1.25, .875); sh.holes.push(circ(0, 0, r, true)); put(ext(sh, hh), C.plate, e.key, {pos: [e.cx, e.cy, z0], rotz: VV.pdAng(e), lvl: Lv, edges: true}); }
    } else if (e.kind === 'ЛЮК') {
      if (M.hat[1]) { const sh = rectP(-.36, -.36, .36, .36); sh.holes.push(circ(0, 0, .31, true)); put(ext(sh, h), C.iron, e.key, {pos: [e.cx, e.cy, e.z0], lvl: Lv, m: {roughness: .6, metalness: .3}}); }
      else put(ringGeo(0, 0, e.rin, e.rout, h), C.iron, e.key, {pos: [e.cx, e.cy, e.z0], lvl: Lv, m: {roughness: .6, metalness: .3}});
      put(new THREE.CylinderGeometry(.305, .305, .03, 64).rotateX(Math.PI / 2), C.lid, e.key, {pos: [e.cx, e.cy, e.z1 - .02], lvl: Lv, part: 'lid', m: {roughness: .55, metalness: .35}});
      for (let r = .08; r < .3; r += .07) put(new THREE.TorusGeometry(r, .006, 6, 64), C.iron, e.key, {pos: [e.cx, e.cy, e.z1 - .004], lvl: Lv, part: 'lid'});
      if (e.bed) put(ringGeo(e.cx, e.cy, .29, .42, e.bed[1] - e.bed[0]), C.mortar, e.key, {pos: [0, 0, e.bed[0]], lvl: Lv, part: 'bed', m: {roughness: .95}});
    }
  }
  // швы у торцевых стен (плиты стоят между торцевыми стенами, ПК6А по ТПР): раствор М100 на толщину плит
  if (M.rect && M.lay.type === 'S' && M.lay.over < -.0005) { const g0 = M.lay.over, xs = M.lay.sum / 2;
    for (const sg of [-1, 1]) for (const p of M.plates.filter(q => Math.abs(sg > 0 ? q.x1 - xs : q.x0 + xs) < .002)) {
      const a = sg > 0 ? xs : -M.A / 2, b = sg > 0 ? M.A / 2 : -xs; put(ext(rectP(a, -M.B / 2, b, M.B / 2), p.z1 - p.z0), C.mortar, p.key, {pos: [0, 0, p.z0], lvl: lvl.get(p.key), part: 'joint'}); } void g0; }
  // трубы ПЭ SDR (в локальных осях; уровень — нижнее кольцо / стены): чёрные с синими полосами, полые,
  // только снаружи и в стене — внутренний торец у стены, отверстие трубы видно изнутри тёмным кругом
  const Lp = M.rect ? 1 : (M.rings[0] ? lvl.get(M.rings[0].key) : 0), peMap = KC._.peTexture ? KC._.peTexture(THREE) : null;
  const peMat = new THREE.MeshStandardMaterial({color: peMap ? 0xffffff : C.pe, map: peMap, roughness: .5, metalness: .05, side: THREE.DoubleSide}); xmats.push(peMat);
  for (const p of M.pipes) {
    const o = {pos: [0, 0, p.z], rotz: p.ang, lvl: Lp}, inner = M.pipeEnd(p);
    for (const [a, b] of M.pipeSegs(p)) {
      const len = b - a, md = (a + b) / 2;
      put(new THREE.CylinderGeometry(p.ro, p.ro, len, 48, 1, true).rotateZ(Math.PI / 2).translate(md, 0, 0), null, 'pipe', {...o, mat: peMat});
      put(new THREE.CylinderGeometry(p.ri, p.ri, len, 48, 1, true).rotateZ(Math.PI / 2).translate(md, 0, 0), C.peIn, 'pipe', {...o, m: {roughness: .95}});
      for (const x of [a, b]) {
        put(new THREE.RingGeometry(p.ri, p.ro, 48).rotateY(Math.PI / 2).translate(x, 0, 0), C.pe, 'pipe', {...o, m: {roughness: .6}});
        // торец у стены: у колец (0.12) и у монолитных стен (0.13) — проём, труба полая, сквозь неё видно колодец
      }
    }
    // гильза — стальной футляр (у круглых — от внутренней грани кольца наружу на L, у монолитных — на толщину стены);
    // зазор между трубой и гильзой на торцах — смоляная прядь и раствор (полоса цвета раствора)
    for (const [a, b] of p.sl || []) {
      const ln = b - a, md = (a + b) / 2, ri = p.gR - p.gS, ge = p.gE || 0, og = {...o, part: 'sleeve', m: {metalness: .55, roughness: .45}};
      put(new THREE.CylinderGeometry(p.gR, p.gR, ln, 48, 1, true).rotateZ(Math.PI / 2).translate(md, 0, ge), C.sleeve, 'gil', og);
      put(new THREE.CylinderGeometry(ri, ri, ln, 48, 1, true).rotateZ(Math.PI / 2).translate(md, 0, ge), C.sleeve, 'gil', og);
      for (const x of [a, b]) { put(new THREE.RingGeometry(ri, p.gR, 48).rotateY(Math.PI / 2).translate(x, 0, ge), C.sleeve, 'gil', og);
        const inn = Math.abs(x) < M.wallIn(p.ang) + .001, xs = x + (x === a ? 1 : -1) * (inn && M.rect ? .0005 : .005);
        // заделка зазора (прядь + герметик): кольцо между трубой и гильзой; у просадочных — несоосное (rotateY: x фигуры → −z)
        const sh = new THREE.Shape(); sh.absarc(-ge, 0, ri - .001, 0, Math.PI * 2, false);
        const hp = new THREE.Path(); hp.absarc(0, 0, p.ro + .001, 0, Math.PI * 2, true); sh.holes.push(hp);
        put(new THREE.ShapeGeometry(sh, 48).rotateY(Math.PI / 2).translate(xs, 0, 0), C.mortar, 'gil', {...o, part: 'seal', m: {roughness: .95}}); }
    }
  }
  // скобы
  M.steps.forEach(s => {
    const o = {pos: [s.x, s.y, s.z], rotz: s.ang, lvl: lvl.get(s.of) ?? (s.mono ? 1 : 0), of: s.of, m: {metalness: .4, roughness: .45}};
    for (const yy of [-.15, .15]) put(new THREE.BoxGeometry(.12, .022, .022).translate(.06, yy, 0), C.step, 'sk', o);
    put(new THREE.BoxGeometry(.022, .32, .022).translate(.12, 0, 0), C.step, 'sk', o);
  });
  // МС
  M.seams.forEach(s => {
    const B = KC.MS[s.mark].B / 1000, Ls = (lvl.get(s.below ? s.below.key : '') ?? 0) + .5;
    for (const a of s.angs) {
      const r0 = s.rin - .012, parts = [new THREE.BoxGeometry(B, .08, .006).translate(r0 + B / 2, 0, 0)];
      const fl = (r, z0, z1) => parts.push(new THREE.BoxGeometry(.008, .08, z1 - z0).translate(r, 0, (z0 + z1) / 2));
      const rIn = r0 - .004, rOut = r0 + B + .004;
      if (s.up) { fl(rIn, -.006, .08); fl(rOut, -.006, .08); }
      else if (!s.asym) { fl(rIn, -.08, .08); fl(rOut, -.08, .08); }
      else if (s.longOut) { fl(rOut, -.08, .08); fl(rIn, -.078, .006); }
      else { fl(rIn, -.08, .08); fl(rOut, -.006, .078); }
      for (const g of parts) put(g, C.ms, s.key, {pos: [s.cx, s.cy, s.z], rotz: a, lvl: Ls, m: {metalness: .5, roughness: .4}});
    }
  });
  // основание
  for (const b of M.base) {
    // 0.12: уплотнённый грунт — свой ключ baseC (свой шаг, на общих видах не показывается)
    const bk = b.cls === 'comp' ? 'baseC' : 'base';
    if (b.shape === 'cyl') put(new THREE.CylinderGeometry(b.r, b.r, b.z1 - b.z0, 96).rotateX(Math.PI / 2).translate(0, 0, (b.z0 + b.z1) / 2), C[b.col], bk, {lvl: -1, edges: b.cls !== 'bitl', part: b.cls});
    else put(ext(rectP(b.x0, b.y0, b.x1, b.y1), b.z1 - b.z0), C[b.col], bk, {pos: [0, 0, b.z0], lvl: -1, edges: b.cls !== 'bitl', part: b.cls});
  }
  if (M.zamok) {
    // 0.12: водоупорный замок — свой ключ и свой шаг: делают после заделки труб, при обратной засыпке
    if (M.rect) { const z = M.zamok, sh = rectP(-z.x - z.b, -z.y - z.b, z.x + z.b, z.y + z.b); sh.holes.push(rectP(-z.x - .003, -z.y - .003, z.x + .003, z.y + .003, true)); put(ext(sh, z.z1 - z.z0), C.clay, 'zamok', {pos: [0, 0, z.z0], lvl: -1, edges: true}); }
    else put(ringGeo(0, 0, M.zamok.rin + .003, M.zamok.rout, M.zamok.z1 - M.zamok.z0), C.clay, 'zamok', {pos: [0, 0, M.zamok.z0], lvl: -1, edges: true});
  }
  // битум снаружи: тонкая оболочка (у каждой — свой элемент of)
  const cm = {roughness: .45, metalness: .05};
  const shellC = (cx, cy, r, z0, z1, of, Lv, seg = 96, hl) => put((hl && KC._.shellHolesGeo(THREE, r, z0, z1, hl)) || new THREE.CylinderGeometry(r, r, z1 - z0, seg, 1, true).rotateX(Math.PI / 2).translate(cx, cy, (z0 + z1) / 2), C.coat, 'coat', {lvl: Lv, of, m: cm});
  const shellB = (x0, y0, x1, y1, z0, z1, of, Lv, top) => { const d = .004, sh = rectP(x0 - d, y0 - d, x1 + d, y1 + d); sh.holes.push(rectP(x0, y0, x1, y1, true)); put(ext(sh, z1 - z0), C.coat, 'coat', {pos: [0, 0, z0], lvl: Lv, of, m: cm});
    if (top) put(ext(rectP(x0, y0, x1, y1), .003), C.coat, 'coat', {pos: [0, 0, z1 + .001], lvl: Lv, of, m: cm}); };
  // верх плит — тоже под битумом (ТПР 901-09-11.84, Альбом I: наружная гидроизоляция стен, лотков и плит перекрытия — горячий битум),
  // кроме места под кольцом горловины (там постель из раствора) и опирания плит на стены
  const topCoat = (outer, holes, z, of, Lv) => { holes.forEach(h => outer.holes.push(h)); put(ext(outer, .003, 96), C.coat, 'coat', {pos: [0, 0, z + .001], lvl: Lv, of, m: cm}); };
  const disc = (cx, cy, r) => { const q = new THREE.Shape(); q.absarc(cx, cy, r, 0, Math.PI * 2, false); return q; };
  const foot = g => circ(g.x, g.y, .426, true);   // след горловины (КС7 / КО6 Ø840) на плите
  // 0.11: битум — только в зонах гидроизоляции (вода — снизу, пучение — сверху); плиты — целиком, если зона до них доходит
  const spC = (cx, cy, r, z0, z1, of, Lv, seg, hl) => { for (const [a, b] of KC.coatSpans(M, z0, z1)) shellC(cx, cy, r, a, b, of, Lv, seg, hl); };
  const spB = (x0, y0, x1, y1, z0, z1, of, Lv) => { for (const [a, b] of KC.coatSpans(M, z0, z1)) shellB(x0, y0, x1, y1, a, b, of, Lv); };
  const plC = e => KC.coated(M, e.z0, e.z1);
  for (const e of M.els) {
    const Lv = lvl.get(e.key);
    if (e.kind === 'КС') spC(0, 0, M.Rout + .003, e.z0, e.z1, e.key, Lv, 96, vh);   // 0.12: с проёмами под гильзы
    else if (e.kind === 'ПП') { if (plC(e)) shellC(0, 0, M.Rout + .003, e.z0, e.z1, e.key, Lv); }
    else if (e.kind === 'ПН') { if (M.gzWet) shellC(0, 0, e.rout + .003, e.z0, e.z1, e.key, Lv); }
    else if (e.kind === 'К10') spC(e.cx, e.cy, e.rout + .003, e.z0, e.z1, e.key, Lv, 64);
    else if (e.kind === 'П10') { if (plC(e)) shellC(e.cx, e.cy, e.rout + .003, e.z0, e.z1, e.key, Lv, 64); }
    else if (e.kind === 'КГ' || e.kind === 'НБ' || e.kind === 'РВ') spC(e.cx, e.cy, .423, e.z0, e.z1, e.key, Lv, 64);
    else if (e.kind === 'КО') for (let i = 0; i < e.q; i++) spC(e.cx, e.cy, .423, e.z0 + i * .08, e.z0 + i * .08 + .07, e.key, Lv, 64);
    else if (e.kind === 'ЛЮК' && e.bed) spC(e.cx, e.cy, .423, e.bed[0], e.bed[1], e.key, Lv, 64);   // постель под люком
    else if (e.kind === 'ДН') { if (M.gzWet) shellB(e.x0, e.y0, e.x1, e.y1, e.z0, e.z1, e.key, Lv); }
    else if (e.kind === 'СТ') { for (const [a, b] of KC.coatSpans(M, e.z0, e.z1)) for (const g of wallGeos(a, b, M.t, .004, wh)) put(g, C.coat, 'coat', {lvl: Lv, of: e.key, m: cm}); }   // 0.13: с проёмами под трубы
    else if (e.kind === 'ПЛ') { if (plC(e)) shellB(e.x0, e.y0, e.x1, e.y1, e.z0, e.z1, e.key, Lv); }
    if (e.pads && plC(e)) for (const [x0, y0, x1, y1, z0, z1] of e.pads) shellB(x0, y0, x1, y1, z0, z1, e.key, Lv, true);
    // верхние поверхности
    if (e.kind === 'ПП') { if (plC(e)) { const h0 = e.holes[0]; topCoat(disc(0, 0, M.Rout + .003), [M.g1000 ? circ(h0.x, h0.y, .586, true) : foot(M.hatches[0])], e.z1, e.key, Lv); } }
    else if (e.kind === 'П10') { if (plC(e)) topCoat(disc(e.cx, e.cy, e.rout + .003), [foot(M.hatches[0])], e.z1, e.key, Lv); }
    else if (e.kind === 'ПН') { if (M.gzWet) topCoat(disc(0, 0, e.rout + .003), [circ(0, 0, M.Rout + .002, true)], e.z1, e.key, Lv); }
    else if (e.kind === 'ДН') { if (M.gzWet) topCoat(rectP(e.x0 - .003, e.y0 - .003, e.x1 + .003, e.y1 + .003), [rectP(M.wallE.x0 - .002, M.wallE.y0 - .002, M.wallE.x1 + .002, M.wallE.y1 + .002, true)], e.z1, e.key, Lv); }
    else if (e.kind === 'СТ') { if (KC.coated(M, e.z1 - .01, e.z1)) topCoat(rectP(e.x0 - .003, e.y0 - .003, e.x1 + .003, e.y1 + .003), [rectP(e.ix0, e.iy0, e.ix1, e.iy1, true)], e.z1, e.key, Lv); }   // под плитами — внутри плит, не видно
    else if (e.kind === 'ПЛ') { if (plC(e)) topCoat(rectP(e.x0, e.y0, e.x1, e.y1), M.hatches.filter(g => g.plate === e.it).map(foot), e.z1, e.key, Lv); }
  }
  // 0.11: лента ГИ-Г на стыках колец в зоне воды (как в К1): перекрывающиеся полосы (КО6 через 80 мм) — одной полосой; у днища — Г-образно
  if (M.tapes.length) {
    const tb = [], tW = M.tapeW, gTop = h => { const g = M.hatches[h] || M.hatches[0]; return g.ko ? g.ko.z1 : g.rings.length ? g.rings[g.rings.length - 1].z1 : 1e9; };
    const own = ['КС', 'ПП', 'К10', 'П10', 'КГ', 'КО', 'НБ'];
    for (const t of M.tapes) {
      const z0 = Math.max(t.z - tW / 2, t.lo >= 0 ? t.lo : -1e9), z1 = t.part === 'gB' ? Math.min(t.z + tW / 2, gTop(t.hatch)) : t.z + tW / 2, L = (lvl.get(t.below ? t.below.key : '') ?? 0) + .5;
      let ow = null; for (const e of M.els) if (own.includes(e.kind) && Math.abs((e.cx || 0) - t.cx) < .01 && Math.abs((e.cy || 0) - t.cy) < .01 && e.z1 > t.z && (!ow || e.z0 < ow.z0)) ow = e;
      const pv = tb.find(q => q.cx === t.cx && q.cy === t.cy && q.r === t.r && z0 <= q.z1 + .005 && z1 >= q.z0 - .005);
      if (pv) { pv.z0 = Math.min(pv.z0, z0); pv.z1 = Math.max(pv.z1, z1); if (ow && (!pv.of || ow.z0 > pv.ofz)) { pv.of = ow.key; pv.ofz = ow.z0; } }
      else tb.push({cx: t.cx, cy: t.cy, r: t.r, z0, z1, L, seg: t.part === 'r' ? 96 : 64, of: ow ? ow.key : null, ofz: ow ? ow.z0 : -1e9});
    }
    for (const q of tb) { const r = q.r + .007, mt = KC._.tapeMatOf ? KC._.tapeMatOf(THREE, M, q.z1 - q.z0, r) : null; if (mt) xmats.push(mt);
      put((!q.cx && !q.cy && KC._.shellHolesGeo(THREE, r, q.z0, q.z1, vh)) || new THREE.CylinderGeometry(r, r, q.z1 - q.z0, q.seg, 1, true).rotateX(Math.PI / 2).translate(q.cx, q.cy, (q.z0 + q.z1) / 2), C.tape, 'tape', Object.assign({lvl: q.L, edges: true, of: q.of}, mt ? {mat: mt} : {m: {roughness: .32}})); }
    const pn = M.pnE, half = tW / 2;
    if (pn && pn.rout > M.Rout + .02 && M.tapes.some(t => t.lo === 0)) {
      const ledge = pn.rout - M.Rout, r1 = M.Rout + Math.min(half, ledge) + .004, L = (lvl.get(pn.key) ?? 0) + .5, rest = half - ledge, ofr = M.rings[0] ? M.rings[0].key : null;
      const sh = new THREE.Shape(); sh.absarc(0, 0, r1, 0, Math.PI * 2, false); sh.holes.push(circ(0, 0, M.Rout + .004, true));
      put(ext(sh, .003, 96), C.tape, 'tape', {pos: [0, 0, pn.z1 + .005], lvl: L, edges: true, of: ofr, m: {roughness: .32}});
      if (rest > .005) put(new THREE.CylinderGeometry(pn.rout + .008, pn.rout + .008, rest, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, pn.z1 - rest / 2), C.tape, 'tape', {lvl: L, edges: true, of: ofr, m: {roughness: .32}}); }
  }
  // армирование стен (прямоугольные) — точно по ТПР; видно в шаге «опалубка и скобы» и в разрезе:
  //  • обычные районы — стены из бетона М150 без арматуры (ТПР 901-09-11.84, Альбом IV, АС-1, прим. 5);
  //  • отверстия Ду ≥ 500 — 2 сетки ⌀10 A-I, у каждой грани: 2 вертикальных стержня по бокам проёма на всю высоту стены и 2 горизонтальных
  //    над и под проёмом от стены до стены («доводить до опор»), в 50 мм от края проёма; защитный слой 20 мм в сухих, 25 — в мокрых (АС-2, прим. 1–3);
  //  • сейсмика — рулонная сетка С 3Вр1-150/3Вр1-150 у обеих граней всех стен, защитный слой 20, нахлёст в углах 250 (Альбом VI.88, АС-12);
  //  • вне ТПР (КЖ) без сейсмики — сетка условно, шаг 200
  if (M.rect && M.wallE) {
    const e = M.wallE, ax = M.A / 2, by = M.B / 2, t = M.t, V = M.V, grid = [], ring = [];
    const B = (arr, x0, y0, z0, x1, y1, z1) => arr.push([x0, y0, z0, x1, y1, z1]);
    if (M.armKind) {
      const sp = M.seis ? .15 : .2, cv = M.seis ? .02 + .0015 : .025 + .005;
      // проёмы под трубы в плоскости стены: проволоку сетки вокруг проёма (гильзы) вырезаем
      const holes = [];
      for (const p of M.pipes) { const xw = Math.abs(Math.cos(p.ang)) > .5;
        for (const sg of p.through ? [1, -1] : [Math.sign(xw ? Math.cos(p.ang) : Math.sin(p.ang)) || 1]) holes.push({xw, sg, z: p.gR ? p.gz : p.z, r: (p.gR || p.ro) + .03}); }
      const cut = (xw, sg, isV, pos, a, b) => { let segs = [[a, b]];
        for (const h of holes) if (h.xw === xw && h.sg === sg) {
          const d = isV ? pos : pos - h.z; if (Math.abs(d) >= h.r) continue;
          const hw = Math.sqrt(h.r * h.r - d * d), c0 = (isV ? h.z : 0) - hw, c1 = (isV ? h.z : 0) + hw;
          segs = segs.flatMap(([s0, s1]) => c1 <= s0 || c0 >= s1 ? [[s0, s1]] : [[s0, c0], [c1, s1]].filter(([x, y]) => y - x > .01)); }
        return segs; };
      const zs = []; for (let z = .1; z < V - .05; z += sp) zs.push(z);
      for (const sg of [-1, 1]) for (const [k, d] of [[0, cv], [1, t - cv]]) {   // k: 0 — у внутренней грани, 1 — у наружной
        const xw = sg * (ax + d), yw = sg * (by + d), lx = ax + (k ? t - cv : cv), ly = by + (k ? t - cv : cv);
        for (let y = -ly; y <= ly + 1e-6; y += sp) for (const [a, b] of cut(true, sg, true, y, .04, V - .03)) B(grid, xw, y, a, xw, y, b);
        for (const z of zs) for (const [a, b] of cut(true, sg, false, z, -ly, ly)) B(grid, xw, a, z, xw, b, z);
        for (let x = -lx; x <= lx + 1e-6; x += sp) for (const [a, b] of cut(false, sg, true, x, .04, V - .03)) B(grid, x, yw, a, x, yw, b);
        for (const z of zs) for (const [a, b] of cut(false, sg, false, z, -lx, lx)) B(grid, a, yw, z, b, yw, z);
      }
    }
    const covF = (M.wetSoil ? .025 : .02) + .005;   // обрамление ⌀10: защитный слой + полдиаметра
    for (const p of M.pipes) { if (p.Du < .5 - 1e-6) continue;
      const Ro = p.gR || p.ro, off = Ro + .05 + .005, c = Math.cos(p.ang), sn = Math.sin(p.ang), wi = M.wallIn(p.ang);
      const Lh = (Math.abs(c) > .5 ? by : ax) + t - covF;
      for (const sx of p.through ? [1, -1] : [1]) for (const d of [covF, t - covF]) {
        const r0 = sx * (wi + d), P = (u, z) => [c * r0 - sn * u, sn * r0 + c * u, z];
        for (const u of [-off, off]) { const a = P(u, .04), b = P(u, V - .03); B(ring, ...a, ...b); }
        const zc = p.gR ? p.gz : p.z;
        for (const z of [zc - off, zc + off]) if (z > .03 && z < V - .03) { const a = P(-Lh, z), b = P(Lh, z); B(ring, ...a, ...b); }
      }
    }
    const geo = (arr, d) => { const pos = [];
      for (const [x0, y0, z0, x1, y1, z1] of arr) { const lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
        for (let i = 0; i < 3; i++) if (hi[i] - lo[i] < d) { lo[i] -= d / 2; hi[i] += d / 2; }
        const [a, b, cc] = lo, [A, Bb, Cc] = hi, v = [[a, b, cc], [A, b, cc], [A, Bb, cc], [a, Bb, cc], [a, b, Cc], [A, b, Cc], [A, Bb, Cc], [a, Bb, Cc]];
        for (const f of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) for (const q of [0, 1, 2, 0, 2, 3]) pos.push(...v[f[q]]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    const Lw = lvl.get(e.key);
    if (grid.length) put(geo(grid, M.seis ? .005 : .007), C.rebar, 'arm', {lvl: Lw, part: 'grid', m: {roughness: .7, metalness: .3, color: 0x9c7a62}});
    if (ring.length) put(geo(ring, .012), C.rebar, 'arm', {lvl: Lw, part: 'ring', m: {roughness: .6, metalness: .35}});
  }
  // опалубка монолитных стен (прямоугольные): щиты снаружи и внутри, стальные ригели снаружи — видна в шагах «опалубка и скобы» и «бетон»
  if (M.rect && M.wallE) {
    const e = M.wallE, tf = .028, gp = .002, hz = M.V + .12, Lw = lvl.get(e.key);
    const fm = mat(C.form, {transparent: true, opacity: 1, roughness: .8}), wm = mat(C.waler, {transparent: true, opacity: 1, metalness: .3, roughness: .5});
    const frame = (x0, y0, x1, y1, d, z0, h, m, part) => { const sh = rectP(x0 - d, y0 - d, x1 + d, y1 + d); sh.holes.push(rectP(x0, y0, x1, y1, true)); put(ext(sh, h), null, 'form', {pos: [0, 0, z0], lvl: Lw, mat: m, part, edges: true}); };
    frame(e.x0 - gp, e.y0 - gp, e.x1 + gp, e.y1 + gp, tf, -.02, hz, fm, 'out');
    frame(e.ix0 + gp + tf, e.iy0 + gp + tf, e.ix1 - gp - tf, e.iy1 - gp - tf, tf, -.02, hz, fm, 'in');
    for (const z of [.3, M.V / 2, M.V - .25]) frame(e.x0 - gp - tf, e.y0 - gp - tf, e.x1 + gp + tf, e.y1 + gp + tf, .06, z - .045, .09, wm, 'waler');
  }
  // уровень грунтовых вод: полупрозрачная гладь вокруг колодца (только в обзоре)
  if (M.wetV) {
    const zU = M.zU, R = M.surfR + .5, sh = M.rect ? rectP(-R, -R, R, R) : (() => { const q = new THREE.Shape(); q.absarc(0, 0, R, 0, Math.PI * 2, false); return q; })();
    if (zU > M.V + M.hpp) M.hatches.forEach(g => sh.holes.push(circ(g.x, g.y, .43, true)));
    else if (M.rect) { const ax = (zU < 0 ? M.dX : M.A / 2 + M.t) + .006, by = (zU < 0 ? M.dY : M.B / 2 + M.t) + .006; sh.holes.push(rectP(-ax, -by, ax, by, true)); }
    else sh.holes.push(circ(0, 0, zU < 0 ? M.pnR + .1 : M.Rout + .006, true));
    put(new THREE.ShapeGeometry(sh, 96).translate(0, 0, zU), C.ugv, 'ugv', {lvl: -1, part: 'water', m: {transparent: true, opacity: .3, depthWrite: false, roughness: .2, metalness: .1}});
  }
  buildSurfaceVV(M, THREE, put, ext, C, circ, rectP, (M.rect ? 5 : M.els.length) + 2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f94, .62));
  const dl = new THREE.DirectionalLight(0xffffff, .72); dl.position.set(-3, -5, 8); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, .25); dl2.position.set(4, 2, 3); scene.add(dl2);
  return {scene, grp, meshes, mats: [...mats.values(), ...xmats, edgeMat], THREE, M, maxLvl: Math.max(...lvl.values()) + 2};
};
// покрытие у люков: дорога / тротуар / газон с отмосткой; у прямоугольных — прямоугольник над колодцем с отверстиями под все люки
function buildSurfaceVV(M, THREE, put, ext, C, circ, rectP, L) {
  const zg = M.zg, rh = M.hat[0] + .005, H = M.hatches;
  let x0, x1, y0, y1;
  if (M.rect) { x0 = -M.A / 2 - M.t - .6; x1 = -x0; y0 = -M.B / 2 - M.t - .6; y1 = -y0; }
  else { const R = Math.max(M.Rout + .5, M.la + M.otmR + .35); x0 = -R; x1 = R; y0 = -R; y1 = R; }
  M.surfBox = [x0, y0, x1, y1];
  const holeOf = (g, r) => M.hat[1] ? rectP(g.x - .365, g.y - .365, g.x + .365, g.y + .365, true) : circ(g.x, g.y, r, true);
  const disc = (holes) => { const sh = M.rect ? rectP(x0, y0, x1, y1) : (() => { const s = new THREE.Shape(); s.absarc(0, 0, x1, 0, Math.PI * 2, false); return s; })(); holes.forEach(h => sh.holes.push(h)); return sh; };
  if (M.place === 'Д') {
    put(ext(disc(H.map(g => holeOf(g, rh))), .07, 96), C.asph, 'surf', {pos: [0, 0, zg - .07], lvl: L, m: {roughness: .95}});
    put(ext(disc(H.map(g => { if (!M.pd6) return circ(g.x, g.y, .43, true); const [hx, hy] = VV.pdHalf(g.pd ? VV.pdAng(g.pd) : 0); return rectP(g.x - hx - .005, g.y - hy - .005, g.x + hx + .005, g.y + hy + .005, true); })), .25, 96), C.gravel, 'surf', {pos: [0, 0, zg - .32], lvl: L});
  } else if (M.place === 'Т') {
    put(ext(disc(H.map(g => holeOf(g, rh))), .06, 96), C.tile, 'surf', {pos: [0, 0, zg - .06], lvl: L, m: {map: KC._.tileTexture(THREE), roughness: .9}});
    put(ext(disc(H.map(g => circ(g.x, g.y, .43, true))), .1, 96), C.sand, 'surf', {pos: [0, 0, zg - .16], lvl: L});
  } else {
    // отмостка: при близких люках радиус уменьшается, чтобы отверстия не пересекались
    let ro = M.otmR; for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) ro = Math.min(ro, Math.hypot(H[i].x - H[j].x, H[i].y - H[j].y) / 2 - .01);
    M.otmRe = ro;
    put(ext(disc(H.map(g => circ(g.x, g.y, ro, true))), .15, 96), C.soil, 'surf', {pos: [0, 0, zg - .17], lvl: L});
    put(ext(disc(H.map(g => circ(g.x, g.y, ro, true))), .02, 96), M.place === 'Н' ? C.soil : C.grass, 'surf', {pos: [0, 0, zg - .02], lvl: L, m: {roughness: 1}});
    for (const g of H) {
      const zi = g.ztop - .015, zo = zg;
      const prof = [new THREE.Vector2(rh, zi - .15), new THREE.Vector2(ro, zo - .15), new THREE.Vector2(ro, zo - .03), new THREE.Vector2(rh, zi - .03)];
      put(new THREE.LatheGeometry(prof.concat([prof[0]]), 96).rotateX(Math.PI / 2), C.gravel, 'surf', {pos: [g.x, g.y, 0], lvl: L});
      const pa = [new THREE.Vector2(rh, zi - .03), new THREE.Vector2(ro, zo - .03), new THREE.Vector2(ro, zo), new THREE.Vector2(rh, zi)];
      put(new THREE.LatheGeometry(pa.concat([pa[0]]), 96).rotateX(Math.PI / 2), C.asph, 'surf', {pos: [g.x, g.y, 0], lvl: L, m: {roughness: .95}});
    }
  }
}
// разнесённый вид: элементы по уровням
VV.explode = function (SC, t, gap = .32) { for (const m of SC.meshes) { const base = m.userData.z0 ?? (m.userData.z0 = m.position.z); m.position.z = base + t * gap * (m.userData.lvl || 0); } };
// крышки разреза (сечения элементов) в плоскости: локальная линия через (ox, oy) по направлению phi; сдвиг eps — в видимую сторону
VV.addCaps = function (SC, phi, ox = 0, oy = 0, side = 1) {
  const {grp, M, THREE} = SC, ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy * side, ny = ux * side, eps = .0015, list = [];
  const capMat = new THREE.MeshStandardMaterial({color: KC.COL.cap, roughness: .95, side: THREE.DoubleSide});
  const monoMat = new THREE.MeshStandardMaterial({color: 0xd9d4c6, roughness: .95, side: THREE.DoubleSide});
  const ironMat = new THREE.MeshStandardMaterial({color: 0x2a2d31, roughness: .8, side: THREE.DoubleSide});
  const lvlOf = key => M.lvlOf ? M.lvlOf(key) : 0;
  const {out} = VV.cut(M, phi, ox, oy);
  for (const p of out) {
    const g = new THREE.BufferGeometry(), P = (s, z) => [ox + s * ux + nx * eps, oy + s * uy + ny * eps, z];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...P(p.s0, p.z0), ...P(p.s1, p.z0), ...P(p.s1, p.z1), ...P(p.s0, p.z0), ...P(p.s1, p.z1), ...P(p.s0, p.z1)]), 3)); g.computeVertexNormals();
    const mt = p.cls === 'iron' ? ironMat : p.cls === 'mono' ? monoMat : capMat, m = new THREE.Mesh(g, mt);
    m.userData = {key: p.key, cap: true, lvl: lvlOf(p.key), base: mt}; grp.add(m); SC.meshes.push(m); list.push(m);
  }
  SC.mats.push(capMat, monoMat, ironMat);
  return list;
};
// плоскость отсечения в мировых координатах: оставляем сторону side от локальной линии (ox, oy, phi)
VV.clipPlane = function (M, THREE, phi, ox = 0, oy = 0, side = 1) {
  const a = M.go + phi, n = new THREE.Vector3(-Math.sin(a) * side, Math.cos(a) * side, 0), [wx, wy] = toW(M, ox, oy);
  return new THREE.Plane(n, -(n.x * wx + n.y * wy));
};
// подписи для разнесённого вида (мировые координаты)
VV.labelAnchors = function (M, right2) {
  const out = [], rx = right2[0], ry = right2[1], seen = new Set();
  for (const e of M.els) {
    if (e.hatch > 0) continue;
    if (e.kind === 'ПЛ' || e.kind === 'БЛ') { const k = e.kind; if (seen.has(k)) continue; seen.add(k);
      const list = M.els.filter(x => x.kind === k), z = (e.z0 + e.z1) / 2, cx = M.A / 2 + M.t, [wx, wy] = toW(M, 0, 0);
      out.push({key: e.key, p: [wx + rx * cx, wy + ry * cx, z], text: k === 'ПЛ' ? `Плиты перекрытия ×${list.length}` : `Балки ×${list.length}`, sub: [...new Set(list.map(x => x.mark))].join(', '), lvlKey: e.key, nomm: true}); continue; }
    const [cx, cy] = toW(M, e.cx || 0, e.cy || 0);
    const r = e.kind === 'ПД' ? 1.0 : e.kind === 'СТ' ? Math.hypot(M.A / 2 + M.t, 0) : e.kind === 'ДН' ? M.dX : e.kind === 'РШ' ? KC.GRATE.a : (e.rout || .4);
    const hmm = M.dims[e.mark] ? M.dims[e.mark].h : Math.round((e.z1 - e.z0) * 1000);
    const nG = M.hatches.length > 1 && e.hatch !== undefined ? ` · ${M.hatches.length} горл.` : '';
    out.push({key: e.key, p: [cx + rx * r, cy + ry * r, (e.z0 + e.z1) / 2], text: `${e.pos ? e.pos + '  ' : ''}${e.kind === 'РШ' ? 'Решётка' : e.kind === 'СТ' ? 'Стены М150' : e.mark}${e.q > 1 ? ' ×' + e.q : ''}`,
      sub: (e.kind === 'ЛЮК' ? `h ${mm(M.Hl)}` : e.kind === 'РШ' ? 'защитная, 620×620' : e.kind === 'СТ' ? `t ${mm(M.t)} · h ${mm(M.V)}` : `h ${hmm}${e.q > 1 ? ' ×' + e.q : ''}`) + nG, lvlKey: e.key, nomm: e.kind === 'РШ' || !!nG});
  }
  return out;
};

/* ---------------- упаковка в ссылку (QR) ---------------- */
VV.PACK_KEYS = ['nom', 'form', 'pg', 'g1000', 'nG', 'D', 'pk', 'A', 'B', 'H', 'otst', 'Hd', 'Du', 'du', 'mesto', 'hatch', 'placeName', 'pod', 'pd6', 'Hl', 'V', 'W', 'over', 'hpp', 'pp',
  'pn', 'ring9', 'ring6', 'n9', 'n6', 'h9', 'h6', 'n106', 'n103', 'npp10', 'n76', 'n73', 'nKO', 'Dout', 'pnD', 'pnH', 't', 'sk', 'zad', 'upr', 'upV', 'gin', 'gout', 'v150', 'v50',
  'set10', 'setR', 'els', 'dims', 'seism', 'msk', 'gko', 'grunt', 'msg', 'uzel',
  'nabH', 'nabJ', 'nabV', 'gtype', 'ugv', 'v50r', 'pOD', 'gilD', 'gilS', 'pOD2', 'gilD2', 'gilS2', 'gilL',   // 0.9: набетонка, вода, гильзы (gtype — 1/0/2)
  'wet', 'zw', 'fz', 'pII', 'jrW', 'jgA', 'jgB', 'gzap', 'kzh', 'lenta', 'lentaW', 'lentaN', 'bitron', 'gpn', 'gilE', 'gilE2',   // 0.11: гидроизоляция по грунтам, лента ГИ-Г, гильза в просадочных
  'gfull',   // 0.12: «Условия» — гидроизоляция «полностью» (у QR 0.11 поля нет — по ТПР)
  'ugv0'];   // 0.13: установившийся УГВ (у старых QR нет — одна линия УГВ)
VV.pack = async function (w, angsDeg, obj) {
  const arr = VV.PACK_KEYS.map(k => { const v = w[k]; if (typeof v === 'number') return Math.round(v * 1000) / 1000; return v === undefined || v === null ? '' : v; });
  const ie = VV.PACK_KEYS.indexOf('els'); arr[ie] = String(arr[ie]).split(';').map(x => { const p = x.split('|'); return [p[0], p[2], p[3]].join('|'); }).join(';');
  const ig = VV.PACK_KEYS.indexOf('gtype'); arr[ig] = arr[ig] === 'оклеечная' ? 1 : arr[ig] === 'нет' ? 2 : 0;
  const json = JSON.stringify({v: 1, a: angsDeg, o: obj || '', d: arr});
  return 'v1' + b64u.enc(await zip(new TextEncoder().encode(json), 'c'));
};
VV.unpack = async function (s) {
  if (!s || s.slice(0, 2) !== 'v1') throw new Error('нет данных колодца');
  const j = JSON.parse(new TextDecoder().decode(await zip(b64u.dec(s.slice(2)), 'd')));
  const w = {}; VV.PACK_KEYS.forEach((k, i) => { w[k] = j.d[i]; });
  w.els = String(w.els).split(';').filter(Boolean).map(x => { const p = x.split('|'); return [p[0], '-', p[1], p[2]].join('|'); }).join(';');
  w.gtype = w.gtype === 1 ? 'оклеечная' : w.gtype === 0 ? 'обмазочная' : w.gtype === 2 ? 'нет' : w.gtype;
  return {w, angsDeg: j.a, obj: j.o};
};
})(typeof window !== 'undefined' ? window : globalThis);
