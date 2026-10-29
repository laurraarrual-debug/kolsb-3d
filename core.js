/* KOLSB core: модель колодца по строке листа «Экспорт», лоток, разрезы, 3D-сцена (three.js), шаги сборки, упаковка данных для QR.
   Общий для паспорта (kolsb_passport.html) и 3D-страницы (index.html). Координаты: метры, Z — вверх, z=0 — верх плиты днища. */
(function (G) {
'use strict';
const KC = G.KC = {};

/* ---------------- утилиты ---------------- */
const num = v => typeof v === 'number' ? v : (v !== undefined && v !== null && v !== '' && !isNaN(parseFloat(String(v).replace(',', '.'))) ? parseFloat(String(v).replace(',', '.')) : 0);
const N = KC.N = (w, k) => num(w[k]);
KC.num = num;
// 0.14: строка элемента «марка|код|кол.|кг» — в русском Excel число в тексте с запятой («15,3» у решётки) → num, не «+»;
// у решётки без массы — масса по её спецификации (15,3 кг)
KC.rowOf = (i, m, c, q, kg) => { const r = {pos: i + 1, mark: m, code: c, q: num(q), kg: num(kg)}; if (/^Решётка/.test(m) && !(r.kg > 0)) r.kg = 15.3; return r; };
const S = KC.S = (w, k) => (w[k] === undefined || w[k] === null) ? '' : String(w[k]);
KC.fmt = (x, d = 2) => (x < -0.0005 ? '−' : '') + Math.abs(x).toFixed(d).replace('.', ',');
KC.sgn = (x, d = 3) => (x > 0.0005 ? '+' : x < -0.0005 ? '−' : '±') + Math.abs(x).toFixed(d).replace('.', ',');
KC.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = KC.fmt, sgn = KC.sgn, mmS = x => String(Math.round(x * 1000));   // размеры — в мм, отметки — в м
// 0.15: mm() вызывался в шагах грунта III (просадочные), но не был объявлен → паспорт и сборка К1 в просадочных падали
const mm = v => Math.round(v * 1000);
const dir = t => [Math.cos(t), Math.sin(t)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];

/* ---------------- справочные данные ---------------- */
KC.PPA = {'ПП10-1': .15, 'ПП10-2': .15, '1ПП15-1': .40, '1ПП15-2': .40, '2ПП15-1': .20, '2ПП15-2': .20, '1ПП20-1': .20, '1ПП20-2': .20, '4ПП20-2': .65};
// люк: наружный радиус корпуса, квадратный корпус, описание
KC.HATCH = {'ТМ': [.425, false, 'ТМ (D400) плавающий'], 'Т': [.435, false, 'Т (С250) с шарниром и замком'], 'Т кв.': [.36, true, 'Т (С250) в квадратном корпусе'], 'Л': [.385, false, 'Л (А15) с шарниром и замком']};
KC.SEAM = 0.01;
// соединительные элементы, ТПР 902-09-22.84 Альбом VIII, КЖИ 10.0.0 (МС-1…4) и КЖИ 11.0.0 (МС-5…8): B — длина стенки, мм
KC.MS = {'МС-1': {B: 90, kg: 1.94, asym: false}, 'МС-2': {B: 100, kg: 1.98, asym: false}, 'МС-3': {B: 110, kg: 2.01, asym: false}, 'МС-4': {B: 120, kg: 2.05, asym: false},
         'МС-5': {B: 90, kg: 1.56, asym: true}, 'МС-6': {B: 100, kg: 1.60, asym: true}, 'МС-7': {B: 110, kg: 1.63, asym: true}, 'МС-8': {B: 120, kg: 1.67, asym: true}};
KC.OTM_B = 0.50;           // ширина асфальтовой отмостки вокруг люка, м — СНиП РК 4.01-02-2009, п. 17.3.10
KC.OTM_S = Math.PI * KC.OTM_B * (0.84 + KC.OTM_B);   // её площадь на 1 люк, м² (как в «Авто Колодцах»: кольцо вокруг горловины Ø840)
// защитная решётка (своя разработка, чертёж «Защитная решётка (смотровые колодцы)»): рамка из полосы 50×10 — квадрат 620×620 в шве
// под первым элементом горловины, 4 анкера ⌀12 L=100 в плите перекрытия (отв. ⌀20 на эпоксидном клее); решётка — кольцо ⌀12
// (развёртка 1730 мм) и 10 прутков ⌀12 через 50 мм, на двух петлях ⌀6 со стороны центра колодца; 15,3 кг
KC.GRATE = {a: .31, w: .05, t: .01, anc: .285, ancL: .10, R: .2753, r: .006, bars: [-.225, -.175, -.125, -.075, -.025, .025, .075, .125, .175, .225], kg: 15.3};
// решётка: кольцо, прутья, петли (в осях лаза; петли — на стороне −x); open — то же, откинутое на 75° вокруг оси петель
KC.gratePieces = function (THREE, G, zr) {
  const closed = [new THREE.TorusGeometry(G.R, G.r, 8, 72).translate(0, 0, zr)];
  for (const x of G.bars) { const h = Math.sqrt(Math.max(0, (G.R - G.r) ** 2 - x * x)) * 2; closed.push(new THREE.CylinderGeometry(G.r, G.r, h, 8).translate(x, 0, zr)); }
  for (const y of [-.07, .07]) closed.push(new THREE.TorusGeometry(.018, .003, 6, 16, Math.PI).rotateX(Math.PI / 2).translate(-G.R + .005, y, zr));
  const hx = -G.R + .005, a = 75 * Math.PI / 180;
  return {closed, open: closed.map(g => g.clone().translate(-hx, 0, -zr).rotateY(-a).translate(hx, 0, zr))};
};
KC.SHELF_I = 0.02;         // уклон полок к лотку
KC.hex = n => '#' + n.toString(16).padStart(6, '0');
KC.TAPE_TEXT = 'ГИДРОИЗОЛЯЦИОННАЯ ЛЕНТА';   // надпись на ленте в 3D
KC.PLACE = {'Г': 'газон', 'Т': 'тротуар', 'Д': 'проезжая часть', 'Н': 'незастроенная территория'};

/* ---------------- модель ---------------- */
KC.model = function (w, angs) {
  const M = {w, angs};
  M.D = N(w, 'D'); M.Rin = M.D / 2; M.Rout = N(w, 'Dout') / 2 || M.Rin + .09; M.V = N(w, 'V'); M.hpp = N(w, 'hpp');
  M.hv = N(w, 'hv'); M.hl = N(w, 'hl'); M.hb = M.hv + M.hl; M.Du = (N(w, 'Du') || 200) / 1000; M.pd6 = N(w, 'pd6') === 1;
  M.Hl = N(w, 'Hl'); M.per = N(w, 'per') === 1; M.zin = N(w, 'zin'); M.Hst = N(w, 'Hst'); M.pod = N(w, 'pod');
  // 0.16: перепад до 0,5 м на трубах до 600 мм — без перепадного колодца, сливом в смотровом (СП 32.13330.2012, п. 6.4.1, прим.):
  // колодец обычный, вход выше лотка выпуска на перепад; канал лотка под входом — от стены, как у обычного входа
  M.sliv = !M.per && N(w, 'sl') === 1 && M.zin > 0;
  M.zg = N(w, 'H1') - M.pod; M.ztop = M.V + N(w, 'Wfact'); M.a = KC.PPA[S(w, 'pp')] ?? .4;
  M.hat = KC.HATCH[S(w, 'hatch')] || KC.HATCH['Т']; M.go = angs[0]; M.place = S(w, 'mesto') || 'Г';
  M.gx = M.a * Math.cos(M.go); M.gy = M.a * Math.sin(M.go);
  M.pnR = (N(w, 'pnD') || M.D + .5) / 2; M.pnH = N(w, 'pnH') || .12;
  // каталог по строке «Элементы»: марка|код|кол|кг (позиции — по порядку)
  M.cat = {}; M.rows = [];
  S(w, 'els').split(';').filter(Boolean).forEach((it, i) => {
    const [m, c, q, kg] = it.split('|'); const r = KC.rowOf(i, m, c, q, kg); M.rows.push(r); M.cat[m] = r; });
  M.dims = {};
  // «2500×1750»: через AutoCAD (ANSI-1251) знак × приходит как «?» или «x» - возвращаем ×
  S(w, 'dims').split(';').filter(Boolean).forEach(it => { const [m, a, b, h] = it.split('|'); M.dims[m] = {din: a, dout: String(b || '').replace(/(\d)\s*[x×х?]\s*(\d)/gi, '$1×$2'), h: num(h)}; });
  const pos = m => (M.cat[m] || {}).pos || '';
  const els = []; let z = 0;
  const addE = o => { o.id = els.length; o.key = 'e' + o.id; o.pos = pos(o.mark); els.push(o); return o; };
  addE({kind: 'ПН', mark: S(w, 'pn'), z0: -M.pnH, z1: 0, rin: 0, rout: M.pnR, cx: 0, cy: 0});
  const rings = [];
  for (let i = 0; i < N(w, 'n9'); i++) rings.push([S(w, 'ring9'), N(w, 'h9')]);
  for (let i = 0; i < N(w, 'n6'); i++) rings.push([S(w, 'ring6'), N(w, 'h6')]);
  M.rings = [];
  rings.forEach(([m, h], i) => { M.rings.push(addE({kind: 'КС', mark: m, z0: z, z1: z + h, rin: M.Rin, rout: M.Rout, cx: 0, cy: 0, first: i === 0, idx: i})); z += h + KC.SEAM; });
  M.ppE = addE({kind: 'ПП', mark: S(w, 'pp'), z0: M.V, z1: M.V + M.hpp, rin: 0, rout: M.Rout, cx: 0, cy: 0});
  // защитная решётка: рамка лежит на плите перекрытия в шве под горловиной, решётка — на рамке внутри лаза
  M.reshE = addE({kind: 'РШ', mark: 'Решётка защитная', z0: M.V + M.hpp, z1: M.V + M.hpp + KC.GRATE.t + 2 * KC.GRATE.r, rin: 0, rout: KC.GRATE.a, cx: M.gx, cy: M.gy});
  z = M.V + M.hpp + KC.SEAM;
  M.gorl = [];
  for (let i = 0; i < N(w, 'n76'); i++) { M.gorl.push(addE({kind: 'КГ', mark: 'КС7.6', z0: z, z1: z + .59, rin: .35, rout: .42, cx: M.gx, cy: M.gy})); z += .6; }
  for (let i = 0; i < N(w, 'n73'); i++) { M.gorl.push(addE({kind: 'КГ', mark: 'КС7.3', z0: z, z1: z + .29, rin: .35, rout: .42, cx: M.gx, cy: M.gy})); z += .3; }
  // добор набетонкой («Условия» → «Добор горловины» = набетонка): бетон М100 по кольцу КС7 (Ø700/840) — прямо на верх КС7 или плиты, без шва;
  // остаток до 20 мм — утолщение шва раствора под КО6 (ПД6), в «Авто Колодцах» — «Остаток в шов»
  M.nabH = N(w, 'nabH'); M.nabJ = N(w, 'nabJ') / 1000; M.nabV = N(w, 'nabV'); M.dobor = S(w, 'dobor') || (M.nabH > 0 || M.nabJ > 0 ? 'набетонка' : 'кольца');
  if (M.nabH > .0005) { const z0 = z - KC.SEAM; M.nabE = addE({kind: 'НБ', mark: 'Набетонка М100', z0, z1: z0 + M.nabH, rin: .35, rout: .42, cx: M.gx, cy: M.gy, mono: true}); z = M.nabE.z1 + KC.SEAM; }
  z += M.nabJ;
  const nko = N(w, 'nKO');
  if (nko > 0) { M.koE = addE({kind: 'КО', mark: 'КО6', q: nko, z0: z, z1: z + nko * .08 - KC.SEAM, rin: .29, rout: .42, cx: M.gx, cy: M.gy}); z += nko * .08; }
  if (M.pd6) M.pdE = addE({kind: 'ПД', mark: 'ПД6', z0: z, z1: z + .22, rin: .29, rout: 1.25, cx: M.gx, cy: M.gy});
  M.hatchE = addE({kind: 'ЛЮК', mark: 'Люк ' + S(w, 'hatch'), z0: M.ztop - M.Hl, z1: M.ztop, rin: .31, rout: M.hat[0], cx: M.gx, cy: M.gy});
  // постель из раствора под корпусом люка (в «Авто Колодцах» на люк — свой шов сверх шва над КО6: обычно 20 мм)
  if (!M.pd6 && M.hatchE.z0 - (z - KC.SEAM) > .005) M.hatchE.bed = [z - KC.SEAM, M.hatchE.z0];
  M.els = els;
  // стенка-растекатель (перепадные): снизу вверх
  M.wall = [];
  if (M.per && M.Hst > 0 && S(w, 'wall')) {
    let zz = 0; S(w, 'wall').split(';').forEach((p, i) => { const [m, mm] = p.split('|'); const h = +mm / 1000; M.wall.push({mark: m, z0: zz, z1: zz + h, pos: pos(m), key: 'w' + i}); zz += h; }); }
  M.tw = .1; M.dw = M.Rin - (M.D >= 2 ? .5 : .35); M.bw = M.D >= 2 ? 1.6 : 1.2;
  // проём внизу нижней панели СР-11 (ТПР 902-09-22.84, Альбом VII, КЖИ СР-11): ширина c по центру, высота 150 — проток из приямка в лоток
  M.wcut = {c: M.bw >= 1.6 ? 1.0 : .6, h: .15};
  // скобы
  M.steps = [];
  for (let k = 0; k < N(w, 'sk'); k++) { const zz = M.ztop - .42 - k * .3; if (zz < .35) break; M.steps.push(zz); }
  // трубы: первая — выпуск; у перепадного вторая — перепадный вход
  M.pipes = angs.map((t, i) => ({ang: t, role: i === 0 ? 'выпуск' : 'вход', z: ((M.per || M.sliv) && i === 1) ? M.zin : M.hv, drop: M.per && i === 1, sliv: M.sliv && i === 1, key: 'pipe'}));
  // 0.16: слив Ду 500–600 при перепаде больше ~0,2 м — проём входа выходит за верх нижнего кольца (по шву колец):
  //       вход ставится после кольца, которым проём закрывается (свой ключ pipeD, как у перепадного)
  if (M.sliv && M.pipes[1]) { const h = KC.pipeHoles(M)[1], hit = M.rings.filter(e => h.zc + h.r > e.z0 && h.zc - h.r < e.z1);
    if (hit.length > 1 || (hit[0] && hit[0] !== M.rings[0])) { M.pipes[1].late = true; M.slivE = hit[hit.length - 1]; M.slivHit = hit; } }
  M.heavy = M.rows.filter(r => !/^Люк/.test(r.mark)).reduce((a, r) => (!a || r.kg > a.kg) ? r : a, null);
  M.total = M.rows.reduce((s, r) => s + r.q * r.kg, 0);
  buildSeams(M);
  buildLotok(M);
  buildBase(M);
  M.otmR = Math.max(M.hat[0], .42) + KC.OTM_B;   // асфальтовая отмостка шириной 0,5 м вокруг люка (СНиП РК 4.01-02-2009, п. 17.3.10)
  buildTapes(M);
  M.surfR = M.place === 'Д' && M.pd6 ? 1.75 : Math.max(M.otmR + .35, 1.5);
  KC.water(M);
  return M;
};
// грунтовые воды и гидроизоляция по строке «Экспорта»: УГВ (м от земли) → отметка воды в осях колодца; оклеечная — если вода выше низа перекрытия
KC.water = function (M) {
  const w = M.w, u = S(w, 'ugv').trim();
  M.gtype = S(w, 'gtype') || 'обмазочная'; M.okl = M.gtype === 'оклеечная';
  M.ugv = u !== '' && !isNaN(parseFloat(u.replace(',', '.'))) ? N(w, 'ugv') : null;
  M.zU = M.ugv !== null ? M.zg - M.ugv : null;              // уровень воды (z от дна) — расчётный (максимальный ожидаемый)
  // 0.13: установившийся УГВ (лист «Условия»): на разрезах — две линии, синяя (установившийся) и magenta (максимальный ожидаемый)
  { const u0 = S(w, 'ugv0').trim(); M.ugv0 = u0 !== '' && !isNaN(parseFloat(u0.replace(',', '.'))) ? N(w, 'ugv0') : null; }
  M.zU0 = M.ugv0 !== null ? M.zg - M.ugv0 : null;
  M.ugv2 = M.ugv !== null && M.ugv0 !== null && M.ugv0 > M.ugv + .005;   // две разные линии УГВ
  M.wetV = M.zU !== null && M.zU > M.zBase + .005;           // вода выше низа основания — показываем в 3D
  M.zOkl = M.zU !== null ? Math.min(M.ztop - .1, M.zU + .5) : null;   // оклеечная — на 0,5 м выше уровня воды
  M.beton = [S(w, 'cem'), N(w, 'Wb') ? 'W' + N(w, 'Wb') : '', S(w, 'Fb')].filter(Boolean).join(', ');
  // 0.11: гидроизоляция по грунтовым условиям (ТПР 901-09-11.84, Альбом I, п. 3.2) — битум снаружи только в зонах:
  // вода — от низа колодца до УГВ + запас (пески 0,5 м, глины — капиллярная кайма), пучение — от земли до глубины промерзания;
  // лента — на стыках в зоне воды; вода выше перекрытия — всё (оклеечная). Строка без «zw» (данные до 0.11, старые QR) — как раньше, всё
  M.gzOld = w.zw === undefined;
  // 0.12: «Условия» — гидроизоляция «полностью» у всех колодцев (как до 0.11): всё снаружи, асфальт днища, лента на всех стыках, Битрон внутри
  M.gfull = !M.gzOld && N(w, 'gfull') === 1;
  M.gzAll = M.gzOld || M.gfull;
  const zs = String(w.zw ?? '').trim(), zn = parseFloat(zs.replace(',', '.'));
  M.gzWet = M.gzAll || M.okl || (N(w, 'wet') === 1 && zs !== '' && !isNaN(zn));
  // 0.12: грунт мокрый (защитный слой арматуры 25 мм, ТПР АС-2) — по воде, не по режиму «полностью»
  M.wetSoil = M.gzOld || M.okl || (N(w, 'wet') === 1 && zs !== '' && !isNaN(zn));
  M.zW = M.gzAll || M.okl ? Infinity : M.gzWet ? M.zg - zn : -Infinity;      // верх зоны воды (z от верха днища)
  M.fz = M.gzAll ? 0 : N(w, 'fz');
  M.zF = !M.gzAll && !M.okl && M.fz > 0 ? M.zg - M.fz : Infinity;              // низ зоны пучения
  M.pII = N(w, 'pII') === 1; M.gzap = N(w, 'gzap') || .5;
  M.gzOut = M.gzAll || N(w, 'gout') > 0; M.gzIn = M.gzAll || N(w, 'gin') > 0;
  M.gzAny = M.gzOut || M.gzIn || N(w, 'lenta') > 0;
  if (!M.gzOld && M.tapes && !M.okl) {   // ленты — столько, сколько стыков в зоне воды по таблице (снизу), по частям колодца и горловинам
    const kept = [];
    for (const [part, key] of [['r', 'jrW'], ['g', 'jgW'], ['gA', 'jgA'], ['gB', 'jgB']]) {
      const ts = M.tapes.filter(t => t.part === part);
      for (const h of [...new Set(ts.map(t => t.hatch || 0))]) kept.push(...ts.filter(t => (t.hatch || 0) === h).slice(0, N(w, key))); }
    M.tapes = kept; }
};
// части отрезка [z0, z1], которые покрываются битумом снаружи (зоны воды и пучения)
// 0.12: проёмы в кольцах под трубы (ось — горизонтально через ось колодца): труба видна насквозь
KC.pipeHoles = M => (M.pipes || []).map(p => ({ang: p.ang, zc: p.z + M.Du / 2, r: M.Du * .56 + .025}));
KC.coatSpans = function (M, z0, z1) {
  if (M.gzAll || M.okl) return [[z0, z1]];
  const out = [], a = Math.min(z1, M.zW), b = Math.max(z0, M.zF);
  if (a > z0 + 1e-4) out.push([z0, a]);
  if (b < z1 - 1e-4) { if (out.length && b <= out[0][1] + 1e-4) out[0][1] = z1; else out.push([b, z1]); }
  return out;
};
KC.coated = (M, z0, z1) => KC.coatSpans(M, z0, z1).length > 0;
// 0.13: линии УГВ на разрезе [z, подпись, класс линии, класс текста]: при двух уровнях — синий (установившийся) и magenta (максимальный
// ожидаемый, по нему гидроизоляция); при одном — синий «УГВ». Только выше низа основания и не выше земли
KC.ugvName = M => M.ugv2 ? 'УГВ макс.' : 'УГВ';   // 0.13: при двух уровнях гидроизоляция — по максимальному ожидаемому
KC.ugvLines = function (M) {
  const ok = z => z !== null && z > M.zBase + .005 && z <= M.zg + 1e-6, out = [];
  if (M.ugv2) { if (ok(M.zU0)) out.push([M.zU0, 'УГВ уст.', 'ugvl', 'ugvb']); if (ok(M.zU)) out.push([M.zU, 'УГВ макс.', 'ugvm', 'ugvp']); }
  else if (ok(M.zU)) out.push([M.zU, 'УГВ', 'ugvl', 'ugvb']);
  return out;
};
// тексты о гидроизоляции для паспорта и актов: что, где и почему (одинаково для К1 и В1)
KC.gzWhy = function (M) {
  const w = M.w, H = z => sgn(z - M.zg), u = M.ugv;
  if (M.gzOld) return {zone: '', why: ''};
  if (M.gfull && !M.okl) return {zone: 'по всей наружной поверхности', dry: ''};   // 0.12: «полностью»
  const parts = [];
  if (M.okl) parts.push(`вода выше низа перекрытия (${KC.ugvName(M)} ${fmt(u)} м)`);
  else {
    if (M.gzWet) parts.push(`в зоне воды — до ${H(M.zW)} м (${KC.ugvName(M)} ${fmt(u)} м + ${fmt(M.gzap, 1)})`);
    if (M.fz > 0) parts.push(`в зоне промерзания — до ${fmt(M.fz)} м от земли (пучинистые грунты)`);
  }
  const dry = !M.gzAny ? (S(w, 'ugv').trim() === '' ? 'воды нет (УГВ не задан или «не вскрыты»)' : `${KC.ugvName(M)} ${fmt(u)} м — ниже низа колодца`) : '';
  return {zone: parts.join('; '), dry};
};
// скобы ходовые — в отверстиях стеновых колец (серия 3.900.1-14, п. 2.5, 4.9): ставятся вместе с кольцом, в котором стоят
KC.skOwner = function (M, z) { let ow = null; for (const e of M.els) if ((e.kind === 'КС' || e.kind === 'ПП' || e.kind === 'КГ' || e.kind === 'НБ' || e.kind === 'КО') && e.z0 <= z + .02) ow = e; return ow; };
KC.skCount = (M, e) => M.steps.filter(z => (KC.skOwner(M, z) || {}).key === e.key).length;
KC.stepRadius = function (M, z) {
  for (const e of M.els) if ((e.kind === 'КГ' || e.kind === 'НБ' || e.kind === 'КО') && z >= e.z0 - .005 && z <= e.z1 + .005) return M.a + e.rin;
  return z > M.V + M.hpp ? M.a + .35 : M.Rin;
};

/* ---------------- сейсмика: швы и МС ----------------
   По ТПР 902-09-22.84 Альбом VIII (лист АС-5): МС на каждом шве колец рабочей части, под плитой перекрытия, на стыке ПП с горловиной,
   на швах горловины. Шов «плита днища — нижнее кольцо» — без МС: обойма из бетона (у нас бетон лотка), по ТПР 901-09-11.84 Альбом VI.88 (АС-3 п.2, АС-5). */
function buildSeams(M) {
  const w = M.w; M.k = N(w, 'msk'); M.seis = M.k > 0; M.seams = [];
  if (!M.seis) return;
  const S2 = KC.SEAM / 2, k = M.k;
  const ringMark = M.D >= 2 ? 'МС-4' : M.D >= 1.5 ? 'МС-3' : 'МС-2', ppMark = M.D >= 2 ? 'МС-8' : M.D >= 1.5 ? 'МС-7' : 'МС-6';
  // по ТПР 902-09-22.84, Альбом VIII (лист с разрезами 1-1…5-5): МС равномерно по окружности от оси труб (оси выпуска):
  // 4 шт. (7 б.) — по диагоналям, 6 шт. (8 б.) — через 60° начиная с 30°, 8 шт. (9 б.) — на осях и диагоналях;
  // горловина — 4 шт. на осях. №1 — первая против часовой от оси выпуска
  const even = (n, off) => Array.from({length: n}, (_, j) => M.go + off + j * 2 * Math.PI / n);
  const offR = n => n === 4 ? Math.PI / 4 : n === 6 ? Math.PI / 6 : n % 4 === 0 ? 0 : Math.PI / n;
  M.rings.forEach((r, i) => {
    if (i < M.rings.length - 1) M.seams.push({kind: 'ring', z: r.z1 + S2, mark: ringMark, n: k, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, angs: even(k, offR(k)), asym: false, below: r, above: M.rings[i + 1], name: `над ${r.mark}`});
  });
  const last = M.rings[M.rings.length - 1];
  if (last) M.seams.push({kind: 'pp', z: last.z1 + S2, mark: ppMark, n: k, cx: 0, cy: 0, rin: M.Rin, rout: M.Rout, angs: even(k, offR(k)), asym: true, longOut: true, below: last, above: M.ppE, name: 'под ПП'});
  const g0 = M.gorl[0];   // МС-5 на стык ПП — горловина встаёт только под кольцо КС7 (под КО6 мешает его свес над лазом)
  if (g0) M.seams.push({kind: 'ppg', z: M.V + M.hpp + S2, mark: 'МС-5', n: 4, cx: M.gx, cy: M.gy, rin: .35, rout: .42, angs: even(4, 0), asym: true, longOut: false, below: M.ppE, above: g0, name: 'ПП — горловина'});
  // швы горловины — только между кольцами КС7 (в ТПР МС стоят между кольцами горловины; опорные кольца КО6 под люком
  // в сейсмическом альбоме не предусмотрены, и полка МС 160 мм выше самого КО6 — 70 мм): КО6 ставятся на раствор без МС
  for (let i = 0; i < M.gorl.length - 1; i++) { const g = M.gorl[i];
    M.seams.push({kind: 'gorl', z: g.z1 + S2, mark: 'МС-1', n: 4, cx: M.gx, cy: M.gy, rin: .35, rout: .42, angs: even(4, 0), asym: false, below: g, above: M.gorl[i + 1], name: `${g.mark} — ${M.gorl[i + 1].mark}`}); }
  // стык КС7 — нижнее КО6: КО6 нависает внутрь на 60 мм (Ø580 против Ø700), поэтому только МС-5 —
  // короткой полкой внутрь вниз по КС7, длинной снаружи (наружные грани обоих колец Ø840 в одну линию); дополнительно к ТПР
  const gl = M.gorl[M.gorl.length - 1], gb = M.nabE || gl;
  if (gl && M.koE) M.seams.push({kind: 'gko', z: (gb.z1 + M.koE.z0) / 2, mark: 'МС-5', n: 4, cx: M.gx, cy: M.gy, rin: .35, rout: .42, angs: even(4, 0), asym: true, longOut: true, below: gb, above: M.koE, name: `${M.nabE ? 'набетонка' : gl.mark} — КО6`});
  M.seams.forEach((s, i) => { s.key = 'ms' + i; });
}

/* ---------------- основание под колодец ----------------
   ТПР 902-09-22.84, Альбом II, лист АС-1 (для колодцев с горловиной 700): I — сухие непросадочные грунты: песчаная подготовка 100 мм;
   II — мокрые: бетон М50 100 мм, гидроизоляция 10 мм, плита днища на цементно-песчаном растворе 20 мм;
   III — просадочные: уплотнённый грунт (на глубину 1 м, лист АС-2), бетон М50 100 мм, раствор 20 мм, водоупорный замок 600×400. */
function buildBase(M) {
  const g = String(S(M.w, 'grunt') || 'I').trim().toUpperCase().replace(/[^IV]/g, '') || 'I';
  M.grunt = g === 'III' ? 'III' : g === 'II' ? 'II' : 'I';
  const z0 = -M.pnH, R = M.pnR + .1;
  if (M.grunt === 'I') M.base = [{n: 'песчаная подготовка 100 мм', z0: z0 - .10, z1: z0, r: R, cls: 'sand', col: 'sand'}];
  else if (M.grunt === 'II') M.base = [{n: 'раствор 20 мм', z0: z0 - .02, z1: z0, r: M.pnR, cls: 'mort', col: 'mortar'}, {n: 'гидроизоляция 10 мм', z0: z0 - .03, z1: z0 - .02, r: R, cls: 'bitl', col: 'coat'},
    {n: 'бетон М50 — 100 мм', z0: z0 - .13, z1: z0 - .03, r: R, cls: 'lean', col: 'lean'}];
  else M.base = [{n: 'раствор 20 мм', z0: z0 - .02, z1: z0, r: M.pnR, cls: 'mort', col: 'mortar'}, {n: 'бетон М50 — 100 мм', z0: z0 - .12, z1: z0 - .02, r: R, cls: 'lean', col: 'lean'},
    {n: 'уплотнённый грунт (1 м)', z0: z0 - 1.12, z1: z0 - .12, r: M.pnR + .6, cls: 'comp', col: 'comp'}];
  M.zamok = M.grunt === 'III' ? {z0: z0 - .12, z1: .4, rin: M.Rout, rout: M.Rout + .6} : null;
  M.zBase = Math.min(...M.base.map(b => b.z0));
  M.zBaseTop = Math.min(...M.base.filter(b => b.cls !== 'comp').map(b => b.z0));
}

/* ---------------- лента на стыки и битумная гидроизоляция ----------------
   Лента: полоса 0,30 м (по 0,15 м выше и ниже шва), нахлёст 0,10 м — как в «Авто Колодцах» (Лента_ширина, Лента_запас).
   Стыки рабочей части: ПН–кольцо, между кольцами, кольцо–ПП (n+1); горловины: под каждым КС7 и КО6. */
function buildTapes(M) {
  M.tapes = []; const S2 = KC.SEAM / 2;
  M.tapes.push({z: 0, lo: 0, cx: 0, cy: 0, r: M.Rout, part: 'r', below: M.els[0]});
  M.rings.forEach(r => M.tapes.push({z: r.z1 + S2, lo: -1, cx: 0, cy: 0, r: M.Rout, part: 'r', below: r}));
  const gb = [], onPlate = M.gorl.length > 0 || !M.nabE;   // набетонка на плите — стык монолитный, ленты нет
  M.gorl.forEach(g => gb.push({z: g.z0 - S2, el: g}));
  if (M.koE) for (let i = 0; i < M.koE.q; i++) gb.push({z: i ? M.koE.z0 + i * .08 - S2 : M.koE.z0 - (KC.SEAM + (M.nabJ || 0)) / 2, el: M.koE});
  gb.forEach((g, i) => M.tapes.push({z: g.z, lo: i === 0 && onPlate ? M.V + M.hpp : -1, cx: M.gx, cy: M.gy, r: .42, part: 'g', below: i === 0 ? (onPlate ? M.ppE : M.nabE) : g.el}));
  M.tapeW = N(M.w, 'lentaW') || .30; M.tapeN = N(M.w, 'lentaN') || 1; M.tapeAdd = .10; M.bitron = N(M.w, 'bitron') || 1.5;
}

/* ---------------- лоток ----------------
   Канал: низ — полукруг Ду, выше — вертикальные стенки до полки (hл из таблицы); полки с уклоном 0,02 к каналу;
   повороты и боковые входы — плавной кривой к выпуску (СП 32.13330.2012 п.6.2.1, 6.3.3; ТПР 902-09-22.84 Альбом II, лист АС-3). */
function bez(p0, p1, p2, p3, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t;
    pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
  return pts;
}
function distPoly(pts, x, y) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L > 0 ? ((x - ax) * dx + (y - ay) * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - x, ey = ay + t * dy - y, d = ex * ex + ey * ey; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function buildLotok(M) {
  const R = M.Rin, w = M.Du / 2, k = .55 * R, o = M.pipes[0], uo = dir(o.ang), Po = mul(uo, R + .06), ch = [];
  // 0.15: перепадный вход без стенки-растекателя (перепад до 0,35 м) — канал от стены под входом, как у обычного входа
  //       (раньше канала не было: у колодца без других входов — короткий обрубок от середины, паспорт падал на стрелке)
  M.hasWall = M.per && M.wall.length > 0 && M.pipes[1];
  M.pipes.forEach((p, i) => {
    if (i === 0 || (p.drop && M.hasWall)) return;
    const ui = dir(p.ang), Pi = mul(ui, R + .06);
    ch.push({pts: bez(Pi, add(Pi, mul(ui, -k - .06)), add(Po, mul(uo, -k - .06)), Po), from: i});
  });
  if (M.hasWall) {
    const ui = dir(M.pipes[1].ang), Q = mul(ui, M.dw - M.tw);
    ch.push({pts: bez(Q, add(Q, mul(ui, -k * .5)), add(Po, mul(uo, -k)), Po), from: 1, wall: true});
  }
  if (!ch.length) { const Q = mul(uo, -R * .35); ch.push({pts: [Q, Po], from: -1}); }
  M.ch = ch; M.chW = w; M.uin = M.hasWall ? dir(M.pipes[1].ang) : null;
}
// расстояние до ближайшего канала
KC.chDist = function (M, x, y) { let d = 1e9; for (const c of M.ch) { const v = distPoly(c.pts, x, y); if (v < d) d = v; } return d; };
// приямок за стенкой (перепадные): >0 — за стенкой
KC.behindWall = (M, x, y) => M.hasWall ? (x * M.uin[0] + y * M.uin[1]) - M.dw : -1;
// поперёк стенки: смещение вдоль стенки от её середины
KC.alongWall = (M, x, y) => M.hasWall ? -x * M.uin[1] + y * M.uin[0] : 1e9;
// отметка поверхности лотка
KC.lotZ = function (M, x, y) {
  if (M.hasWall && KC.behindWall(M, x, y) > -M.tw) return KC.behindWall(M, x, y) > 0 || Math.abs(KC.alongWall(M, x, y)) < M.wcut.c / 2 ? 0 : M.hb;
  const w = M.chW, d = KC.chDist(M, x, y);
  if (d < w) return M.hv + w - Math.sqrt(w * w - d * d);
  return M.hb + KC.SHELF_I * (d - w);
};

/* marching squares: заполнение области f>0 (треугольники) и линии f=0 (отрезки) */
KC.marchFill = function (f, x0, y0, x1, y1, h) {
  const nx = Math.ceil((x1 - x0) / h), ny = Math.ceil((y1 - y0) / h), V = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = f(x0 + i * h, y0 + j * h);
  const tris = [], segs = [];
  const P = (i, j) => [x0 + i * h, y0 + j * h];
  const lerp = (a, b, fa, fb) => { const t = fa / (fa - fb); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
    const v = [V[j * (nx + 1) + i], V[j * (nx + 1) + i + 1], V[(j + 1) * (nx + 1) + i + 1], V[(j + 1) * (nx + 1) + i]];
    const ins = v.map(x => x > 0);
    if (ins.every(x => x)) { tris.push(c[0], c[1], c[2], c[0], c[2], c[3]); continue; }
    if (!ins.some(x => x)) continue;
    const poly = [], cut = [];
    for (let q = 0; q < 4; q++) { const a = q, b = (q + 1) % 4;
      if (ins[a]) poly.push(c[a]);
      if (ins[a] !== ins[b]) { const p = lerp(c[a], c[b], v[a], v[b]); poly.push(p); cut.push(p); } }
    for (let q = 1; q < poly.length - 1; q++) tris.push(poly[0], poly[q], poly[q + 1]);
    for (let q = 0; q + 1 < cut.length; q += 2) segs.push([cut[q], cut[q + 1]]);
  }
  return {tris, segs};
};

/* ---------------- разрез вертикальной плоскостью через ось колодца ----------------
   phi — направление оси разреза в плане; s — координата вдоль оси; видимая половина — слева от оси (n = (−sin φ, cos φ)). */
function lineCircle(cx, cy, r, phi) {
  const ux = Math.cos(phi), uy = Math.sin(phi), sc = cx * ux + cy * uy, dc = -cx * uy + cy * ux;
  if (Math.abs(dc) >= r) return null; const h = Math.sqrt(r * r - dc * dc); return [sc - h, sc + h];
}
function minus(iv, hole) { // [a,b] минус [c,d]
  if (!hole || hole[1] <= iv[0] || hole[0] >= iv[1]) return [iv];
  const out = []; if (hole[0] > iv[0]) out.push([iv[0], hole[0]]); if (hole[1] < iv[1]) out.push([hole[1], iv[1]]); return out;
}
function lineBox(cx, cy, hx, hy, rot, phi) { // прямоугольник 2hx×2hy, повёрнут на rot
  const ux = Math.cos(phi), uy = Math.sin(phi), c = Math.cos(-rot), s = Math.sin(-rot);
  const ox = -cx, oy = -cy, lox = ox * c - oy * s, loy = ox * s + oy * c, ldx = ux * c - uy * s, ldy = ux * s + uy * c;
  let t0 = -1e9, t1 = 1e9;
  for (const [o, d, hh] of [[lox, ldx, hx], [loy, ldy, hy]]) {
    if (Math.abs(d) < 1e-12) { if (Math.abs(o) > hh) return null; continue; }
    let a = (-hh - o) / d, b = (hh - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  return t0 < t1 ? [t0, t1] : null;
}
function cutAt(M, phi, ox, oy) {  // плоскость через точку (ox, oy), направление φ; s — вдоль φ
  const LC = (x, y, r) => lineCircle(x - ox, y - oy, r, phi), LB = (x, y, hx, hy, rot) => lineBox(x - ox, y - oy, hx, hy, rot, phi);
  const out = [], view = [];
  const ann = (e, z0, z1, rin, rout, key, cls) => {
    const o = LC(e.cx, e.cy, rout);
    if (!o) { const sc = e.cx * Math.cos(phi) + e.cy * Math.sin(phi); view.push({s0: sc - rout, s1: sc + rout, z0, z1, key}); return; }
    const i = rin > 0 ? LC(e.cx, e.cy, rin) : null;
    for (const iv of minus(o, i)) out.push({s0: iv[0], s1: iv[1], z0, z1, key, cls});
  };
  for (const e of M.els) {
    if (e.kind === 'ПН') ann(e, e.z0, e.z1, 0, e.rout, e.key, 'conc');
    else if (e.kind === 'КС') {   // 0.12: проёмы под трубы — в разрезе стены пустые
      const o = LC(e.cx, e.cy, e.rout);
      if (!o) ann(e, e.z0, e.z1, e.rin, e.rout, e.key, 'conc');
      else for (const iv of minus(o, LC(e.cx, e.cy, e.rin))) { const sd = (iv[0] + iv[1]) / 2 > 0 ? phi : phi + Math.PI;
        for (const [z0, z1] of KC._.wallCutZ(KC.pipeHoles(M), sd, (e.rin + e.rout) / 2, e.z0, e.z1)) out.push({s0: iv[0], s1: iv[1], z0, z1, key: e.key, cls: 'conc'}); } }
    else if (e.kind === 'КГ') ann(e, e.z0, e.z1, e.rin, e.rout, e.key, 'conc');
    else if (e.kind === 'КО') for (let i = 0; i < e.q; i++) ann(e, e.z0 + i * .08, e.z0 + i * .08 + .07, e.rin, e.rout, e.key, 'conc');
    else if (e.kind === 'НБ') ann(e, e.z0, e.z1, e.rin, e.rout, e.key, 'mono');
    else if (e.kind === 'ПП') { const o = LC(0, 0, e.rout), h = LC(M.gx, M.gy, .35); if (o) for (const iv of minus(o, h)) out.push({s0: iv[0], s1: iv[1], z0: e.z0, z1: e.z1, key: e.key, cls: 'conc'}); }
    else if (e.kind === 'РШ') {
      const G = KC.GRATE, fr = LB(M.gx, M.gy, G.a, G.a, M.go), fi = LB(M.gx, M.gy, G.a - G.w, G.a - G.w, M.go), gr = LC(M.gx, M.gy, G.R + G.r);
      if (fr) for (const iv of minus(fr, fi)) out.push({s0: iv[0], s1: iv[1], z0: e.z0, z1: e.z0 + G.t, key: e.key, cls: 'iron'});
      if (gr) out.push({s0: gr[0], s1: gr[1], z0: e.z0 + G.t, z1: e.z0 + G.t + 2 * G.r, key: e.key, cls: 'iron'});
    }
    else if (e.kind === 'ПД') {
      const b = LB(M.gx, M.gy, 1.25, .875, M.go);
      if (b) { for (const [r, z0, z1] of [[.29, e.z0, e.z0 + .11], [.47, e.z0 + .11, e.z1]]) for (const iv of minus(b, LC(M.gx, M.gy, r))) out.push({s0: iv[0], s1: iv[1], z0, z1, key: e.key, cls: 'conc'}); }
      else { const sc = M.gx * Math.cos(phi) + M.gy * Math.sin(phi); view.push({s0: sc - 1.25, s1: sc + 1.25, z0: e.z0, z1: e.z1, key: e.key}); }
    } else if (e.kind === 'ЛЮК') {
      if (M.hat[1]) { const b = LB(M.gx, M.gy, .36, .36, M.go); if (b) for (const iv of minus(b, LC(M.gx, M.gy, .31))) out.push({s0: iv[0], s1: iv[1], z0: e.z0, z1: e.z1, key: e.key, cls: 'iron'}); }
      else ann(e, e.z0, e.z1, e.rin, e.rout, e.key, 'iron');
      const lid = LC(M.gx, M.gy, .305); if (lid) out.push({s0: lid[0], s1: lid[1], z0: e.z1 - .035, z1: e.z1 - .005, key: e.key, cls: 'iron'});
    }
  }
  return {out, view};
}
/* разрез по φ; st = {off, sJ} — ступенчатый: при |s| < sJ плоскость смещена по нормали n = (−sin φ, cos φ) на off
   (так разрез поперёк оси выпуска проходит через ось горловины, а стенки колодца режутся по центру) */
KC.stepOf = function (M, phi) {
  const off = -M.gx * Math.sin(phi) + M.gy * Math.cos(phi);
  return Math.abs(off) > .05 ? {off, sJ: Math.max(.45, Math.min(.6, M.Rin - .06))} : null;
};
KC.cutParts = function (M, phi, st) {
  const base = cutAt(M, phi, 0, 0);
  if (!st) return base;
  const sh = cutAt(M, phi, -Math.sin(phi) * st.off, Math.cos(phi) * st.off), J = st.sJ, out = [];
  for (const p of base.out) for (const [a, b] of [[p.s0, Math.min(p.s1, -J)], [Math.max(p.s0, J), p.s1]]) if (b - a > 1e-6) out.push({...p, s0: a, s1: b});
  for (const p of sh.out) { const a = Math.max(p.s0, -J), b = Math.min(p.s1, J); if (b - a > 1e-6) out.push({...p, s0: a, s1: b}); }
  // склеить куски одного элемента на границе ступени (переход в разрезе не показывается)
  out.sort((p, q) => p.key < q.key ? -1 : p.key > q.key ? 1 : p.z0 - q.z0 || p.s0 - q.s0);
  const m = [];
  for (const p of out) { const l = m[m.length - 1]; if (l && l.key === p.key && Math.abs(l.z0 - p.z0) < 1e-6 && Math.abs(l.z1 - p.z1) < 1e-6 && l.cls === p.cls && p.s0 - l.s1 < 1e-6) l.s1 = Math.max(l.s1, p.s1); else m.push({...p}); }
  const keys = new Set(m.map(p => p.key));
  return {out: m, view: base.view.filter(v => !keys.has(v.key))};
};
// профиль лотка вдоль линии разреза (от стенки до стенки)
KC.lotProfile = function (M, phi, step = .004, st = null) {
  const ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux, pts = [];
  for (let s = -M.Rin; s <= M.Rin + 1e-9; s += step) { const o = st && Math.abs(s) < st.sJ ? st.off : 0; pts.push([s, KC.lotZ(M, s * ux + o * nx, s * uy + o * ny)]); }
  return pts;
};

/* ---------------- шаги сборки ---------------- */
// расстановка МС словами: «на осях», «по диагоналям», «через 60°, от оси 30°»
KC.msLay = function (M, s) {
  const o = Math.round(((s.angs[0] - M.go) * 180 / Math.PI % 360 + 360) % 360) % Math.round(360 / s.n);
  return o === 0 ? (s.n > 4 ? 'на осях и диагоналях' : 'на осях') : o === 45 && s.n === 4 ? 'по диагоналям' : `через ${Math.round(360 / s.n)}°, от оси ${o}°`;
};
KC.stepsOf = function (M) {
  const w = M.w, out = [], k = M.k, seis = M.seis;
  const kgs = m => M.cat[m] ? `${M.cat[m].code !== '-' ? M.cat[m].code + ' · ' : ''}${fmt(M.cat[m].kg / 1000, 2)} т` : '';
  const H = z => sgn(z - M.zg);
  const seamOf = (kind, el) => M.seams.filter(s => s.kind === kind && (s.above === el || (kind === 'gorl' && s.below === el)));
  const msLay = s => KC.msLay(M, s);
  const msTxt = s => `${s.mark} — ${s.n} шт. ${msLay(s)}`;
  const lastRing = M.rings[M.rings.length - 1], gout0 = N(w, 'gout'), gpn0 = N(w, 'gpn');
  const wallStep = (p, i) => ({els: [p.key].concat(i === 0 ? ['wall0'] : []), t: `Стенка-растекатель ${p.mark}`, fc: `${M.cat[p.mark] ? M.cat[p.mark].kg + ' кг · ' : ''}т.пр. 902-09-22.84`,
    todo: [/СР-11/.test(p.mark) ? `Нижняя панель, проёмом вниз: ${Math.round(M.wcut.c * 1000)}×150 — проток из приямка в лоток.` : /СР-12/.test(p.mark) ? 'Верхняя панель — ставится последней.' : 'Средняя панель.', 'Крепление к кольцам — по Альбому VI этой т.пр.'],
    chk: i === 0 ? 'За стенкой на днище — лист водобоя.' : i === M.wall.length - 1 ? `Вход на ${mmS(M.Hst - M.zin)} мм ниже верха стенки.` : 'Панель в плоскости стенки.'});
  // как на стройке: битум — на привезённые элементы до сборки, на земле; лента — на стык в зоне воды сразу после установки элемента над ним.
  // 0.11: битум только в зонах (вода — снизу до УГВ + запас, пучение — сверху до промерзания); сухо и без пучения — шага нет
  const tapeAt = z => M.tapes.some(t => Math.abs(t.z - z) < .03), tUnder = e => e.first ? M.tapes.some(t => t.lo === 0) : tapeAt(e.z0 - KC.SEAM / 2);
  const zTxt = [M.gzWet ? `снизу до ${H(M.zW)} м (УГВ + ${fmt(M.gzap, 1)})` : '', M.fz > 0 ? `сверху до ${fmt(M.fz)} м от земли` : ''].filter(Boolean).join(', ');
  if (M.okl) out.push({els: ['coat'], pre: true, nohi: true, t: 'Мастика — до сборки', fc: `снаружи ${fmt(gout0)} м² · оклеечная`,
    todo: ['На земле: огрунтовка и битумная мастика.', 'Гидроизол наклеивается после сборки, 2–3 слоя.', 'Днище снизу — до укладки, в 2–3 слоя.'], chk: 'Без пропусков; кромки — для нахлёста.'});
  else if (M.gzOut) out.push({els: ['coat'], pre: true, nohi: true, t: 'Битум — до сборки', fc: gout0 ? `снаружи ${fmt(gout0)} м²` : `${fmt(N(w, 'gidro'))} м²`,
    todo: M.gzAll ? ['На земле: огрунтовка, горячий битум 2 слоя, 5 мм.', 'Днище снизу и с торцов — асфальт 10 мм.', 'Остыл — в котлован.']
      : ['На земле: огрунтовка, горячий битум 2 слоя, 5 мм.', `Снаружи ${zTxt}.`, M.gzWet ? 'Днище снизу и с торцов — асфальт 10 мм.' : 'Пучинистые грунты: меньше смерзание.'],
    chk: M.gzAll ? 'Без пропусков.' : 'Без пропусков; граница зоны — по отметке.'});
  for (const e of M.els) {
    const base = {els: [e.key], fc: kgs(e.mark), kind: e.kind};
    if (e.kind === 'ПН') {
      const bt = M.grunt === 'I' ? ['Дно котлована выровнять, грунт не нарушать.', 'Песок 100 мм — разровнять, уплотнить.', `Низ подготовки — ${H(M.zBaseTop)} м.`]
        : M.grunt === 'II' ? ['Бетонная подготовка М50 — 100 мм.', 'По ней гидроизоляция 10 мм.', `Низ подготовки — ${H(M.zBaseTop)} м от земли.`]
        : ['По уплотнённому грунту — бетон М50, 100 мм.', `Ø${mm(2 * (M.pnR + .1))} — на 100 мм шире плиты днища.`, `Низ подготовки — ${H(M.zBaseTop)} м от земли.`];
      // 0.12: просадочные — уплотнение грунта отдельным шагом (вид сверху), водоупорный замок — после труб
      if (M.grunt === 'III') out.push({els: ['baseC'], kind: 'BASE', top: true, t: 'Уплотнение основания', fc: `грунт III · на 1 м · Ø${mm(2 * (M.pnR + .6))} · ТПР 902-09-22.84, Альбом II, АС-1`,
        todo: ['Грунт под колодцем — уплотнить на глубину 1 м.', 'Слоями, с поливом — до плотности по проекту.', 'Площадь — шире плиты днища.'], chk: 'Плотность — по акту.'});
      out.push({els: ['base'], ...(M.grunt === 'III' ? {kind: 'BASE', top: true} : {}), t: M.grunt === 'III' ? 'Бетонная подготовка' : 'Основание под колодец', fc: `грунт ${M.grunt}${N(w, 'v50k') ? ` · бетон М50 ${fmt(N(w, 'v50k'))} м³` : ''} · ТПР 902-09-22.84, Альбом II, АС-1`, todo: bt, chk: 'Отметка и горизонт основания.'});
      out.push({...base, t: `Плита днища ${e.mark}`, todo: [M.grunt === 'I' ? 'Уложить на песчаную подготовку строго горизонтально.' : 'На цементно-песчаный раствор 20 мм, строго горизонтально.', `Верх плиты — ${H(0)} м от земли: от него считаются все высоты.`], chk: 'Горизонтальность плиты.'});
    }
    else if (e.kind === 'КС') {
      const nLow = M.pipes.filter(p => !p.drop).length;
      const hasIn = (M.per && M.pipes[1] && M.zin >= e.z0 - .005 && M.zin < e.z1 + KC.SEAM) || (M.slivE === e && !e.first);
      const sm = seamOf('ring', e)[0];
      const els2 = sm ? [e.key, sm.key] : [e.key];
      let todo;
      // скобы ходовые — отдельной строкой, сразу после установки кольца (в отверстия кольца, на растворе); если строк уже три — в проверку
      const nsk = KC.skCount(M, e), skT = `Скобы ×${nsk} — в отверстия, на растворе, под лазом.`, top = `Верх кольца — ${H(e.z1)} м.`, inL = M.slivE === e ? `Проём под вход со сливом — по шву: лоток ${H(M.zin)} м.` : `Проём под перепадный вход: лоток ${H(M.zin)} м.`;
      let skChk = false;
      if (e.first) todo = [tUnder(e) ? 'На раствор М100, шов 10 мм; стык — лентой.' : 'На раствор М100, шов 10 мм, швы заполнить.', hasIn ? `Проёмы у дна — ${nLow} шт.; вход перепада — на ${H(M.zin)} м.` : `Проёмы под трубы — ${nLow} шт., по направлениям с плана.`,
        nsk ? `Скобы ×${nsk} — в отверстия; следом — трубы и лоток.` : 'Следом — трубы и лоток, до остальных колец.'];
      else if (!nsk) todo = sm ? [`На верх нижнего кольца — ${sm.mark} ×${sm.n} ${msLay(sm)}.`, 'Раствор М100, шов 10 мм; затем кольцо.', hasIn ? inL : top] : ['На раствор М100, шов 10 мм.', 'Кольцо — соосно нижнему, швы заполнить.', hasIn ? inL : top];
      else if (sm && hasIn) { todo = [`На верх нижнего кольца — ${sm.mark} ×${sm.n} ${msLay(sm)}; шов — раствор М100, 10 мм.`, inL]; skChk = true; }   // 0.15: короче — не вылезало за карточку
      else if (sm) todo = [`На нижнее кольцо — ${sm.mark} ×${sm.n} ${msLay(sm)}.`, `Раствор М100, шов 10 мм; верх — ${H(e.z1)} м.`, skT];
      else todo = ['На раствор М100, шов 10 мм, соосно нижнему.', hasIn ? inL : top, skT];
      out.push({...base, els: els2, t: `Кольцо ${e.mark}${e.first ? ' — нижнее' : ''}`, todo,
        chk: e.first ? (tUnder(e) ? (seis ? 'Лента Г-образно на выступ плиты; МС нет.' : 'Лента Г-образно на выступ плиты.') : (seis ? 'Горизонтальность; шов с днищем без МС.' : 'Горизонтальность и соосность с плитой.'))
          : skChk ? `Вертикальность; скобы ×${nsk} под лазом${tUnder(e) ? '; стык — лентой' : ''}.` : tUnder(e) ? 'Вертикальность; стык снизу — лентой.' : 'Вертикальность, швы заполнены.'});
    } else if (e.kind === 'ПП') {
      const sm = seamOf('pp', e)[0];
      out.push({...base, els: sm ? [e.key, sm.key] : [e.key], t: `Плита перекрытия ${e.mark}`,
        todo: (sm ? [KC.skCount(M, e) ? `На кольцо — ${sm.mark} ×${sm.n} ${msLay(sm)}.` : `На верх кольца — ${msTxt(sm)}, длинная полка снаружи.`] : ['На раствор М100, шов 10 мм.']).concat([KC.skCount(M, e) ? `Лаз над скобами, скобы ×${KC.skCount(M, e)}.` : 'Лаз Ø700 — над скобами.', `Верх ${H(e.z1)} м${tapeAt(e.z0 - KC.SEAM / 2) || tapeAt(e.z0 + KC.SEAM / 2) ? '; стык лентой' : ''}.`]),
        chk: sm ? `${sm.mark}: ${2 * sm.n} шт., ${sm.n} — запас.` : 'Лаз над скобами.'});
    } else if (e.kind === 'КГ' || e.kind === 'КО') {
      const first = (M.gorl[0] || M.koE) === e, sp = first ? seamOf('ppg', e)[0] : null, sg = M.seams.filter(s => s.kind === 'gorl' && s.below === e);
      const sk = e.kind === 'КО' ? M.seams.find(s => s.kind === 'gko') : null;
      const els2 = [e.key].concat(sp ? [sp.key] : [], sk ? [sk.key] : [], sg.map(s => s.key));
      const lines = [];
      if (sp) lines.push(`На стыке с ПП — ${msTxt(sp)} (длинная полка внутрь, по краю лаза).`);
      if (sk) lines.push(`На верх ${sk.below.kind === 'НБ' ? 'набетонки' : sk.below.mark} — МС-5 ×4 на осях: короткая полка внутрь вниз, длинная снаружи.`);
      if (e.kind === 'КО' && M.dobor === 'набетонка') lines.push(`На раствор М100${M.nabJ > .0005 ? `, шов под КО6 — ${mmS(KC.SEAM + M.nabJ)} мм (добор)` : ''}${seis && e.q > 1 ? ', между КО6 без МС' : ''}.`,
        M.nabE ? 'Добор — набетонкой ниже: КО6 только под люк.' : 'Без округления: люк — точно на отметке.');
      else if (e.kind === 'КО') lines.push(`Добор до отметки люка; каждое кольцо — на раствор М100${seis ? ', между КО6 без МС' : ''}.`, 'Количество округлено вверх: люк чуть выше, а не ниже.');
      else lines.push('На раствор М100, соосно лазу.');
      if (sg.length) lines.push(`На шов сверху — ${sg[0].mark} ×4 на осях.`);
      else if (e.kind === 'КГ') lines.push('Высокие кольца ставятся первыми.');
      // скобы — строкой вместо второстепенной; если места нет — в проверку
      const nsk = KC.skCount(M, e); let skc = nsk ? `; скобы ×${nsk} под лазом` : '';
      if (nsk) { const skT = `Скобы ×${nsk} — в отверстия, на растворе, под лазом.`, j = lines.findIndex(l => /^Высокие кольца|^Количество округлено/.test(l));
        if (lines.length < 3) { lines.push(skT); skc = ''; } else if (j >= 0) { lines[j] = skT; skc = ''; } }
      if (e.kind === 'КО' && M.dobor === 'набетонка') { const j = lines.findIndex(l => /^Добор — набетонкой|^Без округления/.test(l)); if (lines.length > 3 && j >= 0) lines.splice(j, 1); }
      out.push({...base, els: els2, t: e.kind === 'КО' ? `Кольца опорные КО6${e.q > 1 ? ' ×' + e.q : ''}` : `Кольцо горловины ${e.mark}`,
        fc: e.kind === 'КО' ? kgs('КО6') + (e.q > 1 ? ` · ${e.q} шт.` : '') : kgs(e.mark), todo: lines.slice(0, 3),
        chk: e.kind === 'КО' ? `Отметка под люк${skc}${M.tapes.some(t => t.part === 'g' && t.z > e.z0 - .03 && t.z < e.z1) ? '; горловину — в ленту' : ''}.` : `Соосность с лазом${skc}${tUnder(e) ? '; стык — лентой' : ''}.`});
    } else if (e.kind === 'НБ') {
      const nsk = KC.skCount(M, e), on = M.gorl.length ? 'верх КС7' : 'плиту перекрытия';
      out.push({...base, t: 'Набетонка горловины', fc: `бетон М100 · ${fmt(M.nabV, 3)} м³ · h ${mmS(e.z1 - e.z0)} мм`,
        todo: ['Опалубка по кольцу КС7: снаружи Ø840, внутри Ø700.', `Бетон М100 — на ${on}, уплотнить; верх — ${H(e.z1)} м, горизонтально.`,
          nsk ? `Скобы ×${nsk} — в бетон при бетонировании, под лазом.` : M.koE ? 'Набрал прочность — КО6 на раствор.' : 'Набрал прочность — дальше по шагам.'],
        chk: 'Отметка верха — под КО6 и люк.'});
    } else if (e.kind === 'РШ') out.push({...base, t: 'Защитная решётка', fc: `своя разработка · ${fmt(M.cat[e.mark] ? M.cat[e.mark].kg : KC.GRATE.kg, 1)} кг`,
      todo: ['В плите у лаза — 4 отверстия Ø20, глубиной 100 (по углам рамки).', 'Рамку 620×620 — анкерами Ø12 на эпоксидный клей.', 'Решётку на рамку; 2 петли — приварить, шов 5 мм.'],
      chk: 'Рамка — в шве под горловиной; решётка на петлях.'});
    else if (e.kind === 'ПД') out.push({...base, t: 'Плита дорожная ПД6', todo: ['Укладывается вокруг горловины на дороге.', 'Люк садится в нишу плиты Ø940.'], chk: 'Люк выступает над ПД6 на 70 мм — под слой покрытия.'});
    else if (e.kind === 'ЛЮК') {
      const sur = M.place === 'Д' ? 'Покрытие дороги — вровень с люком.' : M.place === 'Т' ? 'Плитка тротуара вокруг люка.' : `Асфальтовая отмостка вокруг люка, ≈Ø${mmS(2 * M.otmR)} мм.`;
      out.push({...base, els: [e.key, 'surf'], t: `Люк ${S(w, 'hatch')}`, fc: `${M.cat[e.mark] ? M.cat[e.mark].code + ' · ' + M.cat[e.mark].kg + ' кг' : ''}`,
        todo: [`${M.hat[2]}.`, `Верх люка — ${H(M.ztop)} м от земли.`, sur], chk: N(w, 'over') > 0 ? `Выше расчётной отметки на ${N(w, 'over')} мм — за счёт округления КО6.` : 'Отметка люка.'});
    }
    // лоток — сразу после нижнего кольца: кольцо служит опалубкой, трубы уже в его проёмах, шов с плитой днища сразу в обойме,
    // бетонировать и железнить удобно из открытого кольца (а не на дне готового колодца); у перепадных до лотка — нижняя панель стенки
    if (e === M.rings[0]) {
      const low = M.pipes.filter(p => !p.drop && !p.late);
      out.push({els: ['pipe'], t: `Трубы Ду${Math.round(M.Du * 1000)}`, fc: `заделка — бетон В15, ${fmt(N(w, 'zad'))} м³`,
        todo: [M.sliv && M.pipes[1] && M.pipes[1].late ? `${low.length > 2 ? `Выпуск и ${low.length - 1} входа` : low.length > 1 ? 'Выпуск и вход' : 'Выпуск'} — в проём${low.length > 1 ? 'ы' : ''} нижнего кольца; вход-слив — после 2-го кольца.`
               : M.sliv && M.pipes[1] ? `${low.length > 2 ? `Выпуск и ${low.length - 1} входа` : 'Выпуск и вход'} — в проёмы нижнего кольца; вход — на ${mmS(N(w, 'drop'))} мм выше лотка (слив).`
               : `${low.length > 2 ? `Выпуск и ${low.length - 1} входа` : low.length > 1 ? 'Выпуск и вход' : 'Выпуск'} — в проёмы нижнего кольца, на отметке лотка.`, M.per ? 'Зазор — прядь или жгут, проём — бетон В15; перепадный вход — после колец.' : 'Зазор — смоляная прядь или резиновый жгут, проём — бетон В15 (Альбом VIII, АС-22).'],
        chk: 'Зазор уплотнён; уклоны и отметки лотков труб.'});
      if (M.hasWall) out.push(wallStep(M.wall[0], 0));
      out.push({els: ['lot'], t: 'Лоток', fc: `бетон В15 · ${fmt(N(w, 'lot'))} м³`,
        todo: ['Сразу после нижнего кольца — оно опалубка.', `Канал — полукруг Ду; полки ${mmS(M.hl)} мм, уклон 0,02.`,
               M.hasWall ? 'Проём СР-11 не бетонировать — проток.' : seis ? 'Бетон у стенки — обойма шва с ПН.' : 'Затирка, железнение.'],
        chk: 'Гладко; до монтажа колец — укрыть.'});
      // 0.12: водоупорный замок (просадочные) — снаружи у низа после заделки труб, при обратной засыпке; вид сверху
      if (M.zamok) out.push({els: ['zamok'], kind: 'ZAM', top: true, t: 'Водоупорный замок', fc: 'мятая глина · 600×400 · ТПР 902-09-22.84, Альбом II, АС-1',
        todo: ['Снаружи у низа, после заделки труб.', 'Мятая глина — слоями, с трамбованием.', 'Дальше — засыпка пазух местным грунтом.'], chk: 'Плотно у труб, без пустот.'});
    }
    if (M.slivE === e && M.pipes[1] && M.pipes[1].late) out.push({els: ['pipeD'], t: 'Вход со сливом', fc: `Ду${Math.round(M.Du * 1000)} · лоток ${H(M.zin)} м · перепад ${mmS(N(w, 'drop'))} мм`,
      todo: ['Проём — по шву нижнего и следующего кольца.', `Труба — лотком на ${H(M.zin)} м: на ${mmS(N(w, 'drop'))} мм выше лотка выпуска.`, 'Зазор — прядь или жгут, проём — бетон В15.'],
      chk: 'Слив — в канал лотка (СП 32.13330.2012, п. 6.4.1).'});
    if (e === lastRing) {
      M.wall.forEach((p, i) => { if (i > 0) out.push(wallStep(p, i)); });
      if (M.per && M.pipes[1]) out.push({els: ['pipeD'], t: 'Перепадный вход', fc: `Ду${Math.round(M.Du * 1000)} · лоток ${H(M.zin)} м`,
        todo: [`Труба — в проём кольца, лоток входа ${H(M.zin)} м от земли.`, M.hasWall ? 'Вход — за стенку-растекатель, в приямок.' : 'Вход — над лотком колодца.', 'Заделать проём бетоном В15.'],
        chk: `На ${mmS(N(w, 'drop'))} мм выше лотка выпуска.`});
    }
  }
  const gin = N(w, 'gin'), jr = M.tapes.filter(t => t.part === 'r').length, jg = M.tapes.length - jr;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c; };
  const inTxt = M.pII ? 'Внутри стены и днище — горячий битум 4–5 мм.' : `Внутри${M.gzAll ? '' : ` до ${H(M.zW)} м`} — Битрон-11, ${fmt(M.bitron, 1)} кг/м².`;
  if (M.okl) out.push({els: ['coatfin'], nohi: true, fin: true, t: 'Гидроизоляция оклеечная', fc: `снаружи ${fmt(gout0)} м² · вода выше перекрытия`,
    todo: [`Гидроизол 2–3 слоя на мастике — до ${H(M.zOkl)} м (УГВ + 0,5 м).`, `Защитная стенка; лента на стыки — ${jr + jg} ${plural(jr + jg, 'стык', 'стыка', 'стыков')}.`, `Внутри — Битрон-11, ${fmt(M.bitron, 1)} кг/м².`],
    chk: 'Вне ТПР: прочность и всплытие — КЖ.'});
  else if (M.gzWet || M.gzIn || jr + jg > 0) out.push({els: ['coatfin'], nohi: true, fin: true, t: 'Гидроизоляция — доделка',
    fc: [jr + jg ? `лента ${fmt(N(w, 'lenta'))} м²` : '', gin ? `внутри ${fmt(gin)} м²` : ''].filter(Boolean).join(' · ') || `снаружи ${fmt(gout0)} м²`,
    todo: [M.gzWet ? `Проходы труб${seis ? ', МС' : ''} и сколы — горячим битумом.` : '', gin ? inTxt : '',
      jr + jg ? `Лента: рабочая часть — ${jr}, горловина — ${jg} ${plural(jg, 'стык', 'стыка', 'стыков')}.` : ''].filter(Boolean),
    chk: jr + jg ? 'Лента без складок; скобы — одной вертикалью, крепко.' : 'Покрытие без пропусков; скобы — крепко.'});
  return out;
};

/* ---------------- упаковка данных колодца в ссылку (для QR) ---------------- */
KC.PACK_KEYS = ['nom', 'per', 'mark', 'H', 'D', 'Du', 'drop', 'mesto', 'hatch', 'placeName', 'Hl', 'pod', 'pd6', 'hl', 'hv', 'H1', 'V', 'Wfact', 'over', 'ppd', 'hpp',
  'pn', 'ring9', 'ring6', 'n9', 'n6', 'pp', 'n76', 'n73', 'nKO', 'sk', 'zad', 'lot', 'gidro', 'Dout', 'pnD', 'pnH', 'h9', 'h6', 'Hst', 'zin', 'wall', 'els', 'dims', 'seism', 'msk', 'msg', 'grunt', 'lenta', 'gin', 'gout', 'gpn', 'lentaW', 'lentaN', 'bitron',
  'nabH', 'nabJ', 'nabV', 'gtype', 'ugv', 'v50k',   // 0.9: набетонка, вода (в конец — старые QR читаются как раньше; gtype — 1/0/2)
  'wet', 'zw', 'fz', 'pII', 'jrW', 'jgW', 'gzap', 'kzh',   // 0.11: гидроизоляция по грунтам (у старых QR этих полей нет — «как раньше»)
  'gfull',   // 0.12: «Условия» — гидроизоляция «полностью» (у QR 0.11 поля нет — по ТПР)
  'ugv0',   // 0.13: установившийся УГВ (у старых QR нет — одна линия УГВ)
  'sl'];   // 0.16: перепад до 0,5 м — сливом в смотровом (у старых QR нет — как раньше)
const b64u = {
  enc: u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
};
async function zip(u8, mode) {
  const cs = mode === 'c' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer());
}
KC.pack = async function (w, angsDeg, obj) {
  const arr = KC.PACK_KEYS.map(k => { const v = w[k]; if (typeof v === 'number') return Math.round(v * 1000) / 1000; return v === undefined || v === null ? '' : v; });
  // в els коды АГСК не нужны для 3D — короче ссылка
  const ie = KC.PACK_KEYS.indexOf('els'); arr[ie] = String(arr[ie]).split(';').map(x => { const p = x.split('|'); return [p[0], p[2], p[3]].join('|'); }).join(';');
  const ig = KC.PACK_KEYS.indexOf('gtype'); arr[ig] = arr[ig] === 'оклеечная' ? 1 : arr[ig] === 'нет' ? 2 : 0;   // короче ссылка
  const json = JSON.stringify({v: 1, a: angsDeg, o: obj || '', d: arr});
  return 'k1' + b64u.enc(await zip(new TextEncoder().encode(json), 'c'));
};
KC.unpack = async function (s) {
  if (!s || s.slice(0, 2) !== 'k1') throw new Error('нет данных колодца');
  const j = JSON.parse(new TextDecoder().decode(await zip(b64u.dec(s.slice(2)), 'd')));
  const w = {}; KC.PACK_KEYS.forEach((k, i) => { w[k] = j.d[i]; });
  w.els = String(w.els).split(';').filter(Boolean).map(x => { const p = x.split('|'); return [p[0], '-', p[1], p[2]].join('|'); }).join(';');
  w.msk = num(w.msk); w.gtype = w.gtype === 1 ? 'оклеечная' : w.gtype === 0 ? 'обмазочная' : w.gtype === 2 ? 'нет' : w.gtype;
  return {w, angsDeg: j.a, obj: j.o};
};

/* ---------------- 3D-сцена (three.js) ---------------- */
KC.COL = {ring: 0xc9c5bb, ring2: 0xbfbbb0, plate: 0xaaa69c, gorl: 0xd5cfc2, ko: 0xe0dacc, lot: 0xbdb8ad, chan: 0x7f95a4, pipe: 0xd0712f, pipeIn: 0x9c4f1d,
  iron: 0x34383d, lid: 0x4e555c, step: 0xd9a21b, wall: 0x8d77bd, steel: 0x4a5560, ms: 0x2f6f9f, hi: 0xf2a516, coat: 0x50555b, tape: 0x16181b, cap: 0xe9e4d8,
  grass: 0x76a650, soil: 0x9a7b5a, lean: 0xb0aca2, mortar: 0xc9c1b0, clay: 0x8f6a4a, comp: 0xa48a6c, asph: 0x3f4348, gravel: 0x9d978c, tile: 0xb8b1a5, sand: 0xd9c9a3, edge: 0x4a4a4a,
  form: 0xc58c55, waler: 0xe2ad1c, fresh: 0x8c8c86, nab: 0xb4ab98, ugv: 0x3d8fd6, ugvMax: 0xc2188f, sleeve: 0x7d878f, sleeveIn: 0x4a5056, sleeveEnd: 0xa3abb2, seal: 0x2f2c29,
  pe: 0x1f2226, peIn: 0x0d0e10, corrIn: 0xe9e4d9, rebar: 0x8a4b2d, beam: 0xa88a70, mono: 0xb9b3a7};   // 0.10: ПЭ (В1), внутренний слой гофры (К1), арматура
KC.buildScene = function (M, THREE) {
  const C = KC.COL, scene = new THREE.Scene(), meshes = [], mats = new Map(), xmats = [];
  const mat = (col, o = {}) => { const key = col + JSON.stringify(o); if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({color: col, roughness: .88, metalness: 0, side: THREE.DoubleSide}, o))); return mats.get(key); };
  const edgeMat = new THREE.LineBasicMaterial({color: C.edge, transparent: true, opacity: .35});
  const order = new Map(); // ключ -> индекс этажа (для разнесённого вида)
  const put = (geo, col, key, opt = {}) => {
    if (opt.mat && !xmats.includes(opt.mat)) xmats.push(opt.mat);   // свои материалы (лента с надписью) — тоже режутся плоскостью разреза
    const m = new THREE.Mesh(geo, opt.mat || mat(col, opt.m || {})); m.userData = {key, cap: !!opt.cap, lvl: opt.lvl ?? 0, base: m.material, of: opt.of, part: opt.part};
    if (opt.pos) m.position.set(...opt.pos); if (opt.rotz) m.rotation.z = opt.rotz;
    scene.add(m); meshes.push(m);
    if (opt.edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat); e.userData = {key, line: true, lvl: opt.lvl ?? 0, cap: false, of: opt.of}; if (opt.pos) e.position.set(...opt.pos); if (opt.rotz) e.rotation.z = opt.rotz; scene.add(e); meshes.push(e); }
    return m;
  };
  const ringGeo = (rin, rout, h, seg = 72) => {
    const sh = new THREE.Shape(); sh.absarc(0, 0, rout, 0, Math.PI * 2, false);
    if (rin > 0) { const hole = new THREE.Path(); hole.absarc(0, 0, rin, 0, Math.PI * 2, true); sh.holes.push(hole); }
    return new THREE.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false, curveSegments: seg});
  };
  const shapeGeo = (shape, h, seg = 64) => new THREE.ExtrudeGeometry(shape, {depth: h, bevelEnabled: false, curveSegments: seg});
  // уровни для разнесённого вида: по порядку элементов снизу вверх
  M.els.forEach((e, i) => order.set(e.key, i));
  const lvlAt = z => { let L = 0; M.els.forEach((e, i) => { if (z >= e.z0 - .02) L = i; }); return L; };
  let ri = 0;
  const holes = KC.pipeHoles(M);   // 0.12: проёмы под трубы
  for (const e of M.els) {
    const L = order.get(e.key);
    if (e.kind === 'ПН') put(new THREE.CylinderGeometry(e.rout, e.rout, e.z1 - e.z0, 96).rotateX(Math.PI / 2).translate(0, 0, (e.z0 + e.z1) / 2), C.plate, e.key, {lvl: L, edges: true});
    else if (e.kind === 'КС') { const hs = holes.filter(q => q.zc + q.r > e.z0 && q.zc - q.r < e.z1).map(q => ({...q, zc: q.zc - e.z0}));
      put(hs.length ? KC._.ringHolesGeo(THREE, e.rin, e.rout, e.z1 - e.z0, hs) : ringGeo(e.rin, e.rout, e.z1 - e.z0, 96), (ri++ % 2) ? C.ring2 : C.ring, e.key, {pos: [0, 0, e.z0], lvl: L, edges: true}); }
    else if (e.kind === 'КГ') put(ringGeo(e.rin, e.rout, e.z1 - e.z0), C.gorl, e.key, {pos: [e.cx, e.cy, e.z0], lvl: L, edges: true});
    else if (e.kind === 'КО') for (let i = 0; i < e.q; i++) put(ringGeo(e.rin, e.rout, .07), i % 2 ? C.gorl : C.ko, e.key, {pos: [e.cx, e.cy, e.z0 + i * .08], lvl: L, edges: true});
    else if (e.kind === 'НБ') put(ringGeo(e.rin, e.rout, e.z1 - e.z0), C.nab, e.key, {pos: [e.cx, e.cy, e.z0], lvl: L, edges: true, m: {roughness: .95}});
    else if (e.kind === 'ПП') {
      const sh = new THREE.Shape(); sh.absarc(0, 0, e.rout, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(M.gx, M.gy, .35, 0, Math.PI * 2, true); sh.holes.push(hole);
      put(shapeGeo(sh, e.z1 - e.z0, 96), C.plate, e.key, {pos: [0, 0, e.z0], lvl: L, edges: true});
    } else if (e.kind === 'РШ') {
      // в локальных осях лаза: x — от центра колодца к лазу, y — поперёк; поворот на M.go
      const G = KC.GRATE, o = {pos: [e.cx, e.cy, e.z0], rotz: M.go, lvl: L, m: {metalness: .45, roughness: .5}}, zr = G.t + G.r, c = G.a - G.w / 2;
      for (const [x, y, lx, ly] of [[0, c, 2 * G.a, G.w], [0, -c, 2 * G.a, G.w], [c, 0, G.w, 2 * G.a - 2 * G.w], [-c, 0, G.w, 2 * G.a - 2 * G.w]])
        put(new THREE.BoxGeometry(lx, ly, G.t).translate(x, y, G.t / 2), C.steel, e.key, {...o, part: 'frame'});
      for (const [x, y] of [[G.anc, G.anc], [G.anc, -G.anc], [-G.anc, G.anc], [-G.anc, -G.anc]])
        put(new THREE.CylinderGeometry(G.r, G.r, G.ancL, 10).rotateX(Math.PI / 2).translate(x, y, G.t - G.ancL / 2), C.steel, e.key, {...o, part: 'frame'});
      // решётка и её копия «откинута на петлях» (ключ grOpen — видна только в виде изнутри): поворот 75° вокруг оси петель
      const gp = KC.gratePieces(THREE, G, zr);
      for (const g of gp.closed) put(g, C.steel, e.key, {...o, part: 'grate'});
      for (const g of gp.open) put(g, C.steel, 'grOpen', {...o, part: 'grateOpen', of: e.key});
    } else if (e.kind === 'ПД') {
      for (const [r, z0, h] of [[.29, e.z0, .11], [.47, e.z0 + .11, .11]]) {
        const sh = new THREE.Shape(); sh.moveTo(-1.25, -.875); sh.lineTo(1.25, -.875); sh.lineTo(1.25, .875); sh.lineTo(-1.25, .875); sh.lineTo(-1.25, -.875);
        const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); sh.holes.push(hole);
        put(shapeGeo(sh, h), C.plate, e.key, {pos: [e.cx, e.cy, z0], rotz: M.go, lvl: L, edges: true});
      }
    } else if (e.kind === 'ЛЮК') {
      if (M.hat[1]) { const sh = new THREE.Shape(); sh.moveTo(-.36, -.36); sh.lineTo(.36, -.36); sh.lineTo(.36, .36); sh.lineTo(-.36, .36); sh.lineTo(-.36, -.36);
        const hole = new THREE.Path(); hole.absarc(0, 0, .31, 0, Math.PI * 2, true); sh.holes.push(hole); put(shapeGeo(sh, e.z1 - e.z0), C.iron, e.key, {pos: [e.cx, e.cy, e.z0], rotz: M.go, lvl: L, m: {roughness: .6, metalness: .3}}); }
      else put(ringGeo(e.rin, e.rout, e.z1 - e.z0), C.iron, e.key, {pos: [e.cx, e.cy, e.z0], lvl: L, m: {roughness: .6, metalness: .3}});
      put(new THREE.CylinderGeometry(.305, .305, .03, 64).rotateX(Math.PI / 2), C.lid, e.key, {pos: [e.cx, e.cy, e.z1 - .02], lvl: L, part: 'lid', m: {roughness: .55, metalness: .35}});
      for (let r = .08; r < .3; r += .07) put(new THREE.TorusGeometry(r, .006, 6, 64), C.iron, e.key, {pos: [e.cx, e.cy, e.z1 - .004], lvl: L, part: 'lid'});
      if (e.bed) put(ringGeo(.29, .42, e.bed[1] - e.bed[0]), C.mortar, e.key, {pos: [e.cx, e.cy, e.bed[0]], lvl: L, part: 'bed', m: {roughness: .95}});
    }
  }
  const L0 = order.get(M.rings[0] ? M.rings[0].key : M.els[0].key);
  // трубы
  // трубы — гофрированные ПП (оранжевый гофр, светлый гладкий внутренний слой), полые; торец — у лотка внутри кольца.
  // Ввод — проём в кольце без гильзы: зазор — смоляная прядь (жгут) и цементный раствор, снаружи видна полоса раствора заподлицо с кольцом
  M.pipes.forEach(p => {
    const ro = M.Du * .56, rv = M.Du * .525, ri2 = M.Du / 2, x0 = M.Rin - .04, x1 = M.Rout + .9, len = x1 - x0;
    const L = lvlAt(p.z), pk = p.drop || p.late ? 'pipeD' : 'pipe', o = {pos: [0, 0, p.z + ri2], rotz: p.ang, lvl: L};   // перепадный вход ставится позже — свой ключ
    put(KC._.corrGeo(THREE, rv, ro, x0, x1, Math.max(.025, .16 * M.Du)), C.pipe, pk, {...o, m: {roughness: .5}});
    put(new THREE.CylinderGeometry(ri2, ri2, len, 40, 1, true).rotateZ(Math.PI / 2).translate(x0 + len / 2, 0, 0), C.corrIn, pk, {...o, m: {roughness: .7}});
    for (const x of [x0, x1]) put(new THREE.RingGeometry(ri2, rv, 40).rotateY(Math.PI / 2).translate(x, 0, 0), C.pipe, pk, {...o, m: {roughness: .5}});
    // 0.12: проём в кольце сквозной — заделка (раствор между трубой и проёмом) видна кольцами по наружной и внутренней поверхности
    const rz = ro + .025, hq = {ang: p.ang, zc: p.z + ri2, r: rz};
    for (const [R, sd] of [[M.Rout + .002, 1], [M.Rin - .002, -1]]) put(KC._.bufOf(THREE, [KC._.holeCap(hq, ro - .003, rz, R, sd, 48)]), C.mortar, pk, {lvl: L, part: 'seal'});
  });
  // лоток: полки (заполнение marching squares) + каналы (развёртка профиля вдоль кривой)
  {
    const R = M.Rin - .004, w = M.chW;
    const fShelf = (x, y) => { const r = Math.hypot(x, y); if (r > R) return R - r; if (M.hasWall && KC.behindWall(M, x, y) > -M.tw) return -1; return KC.chDist(M, x, y) - w; };
    const fill = KC.marchFill(fShelf, -R, -R, R, R, .012);
    const pos = new Float32Array(fill.tris.length * 3);
    fill.tris.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = M.hb + KC.SHELF_I * Math.max(0, KC.chDist(M, p[0], p[1]) - w); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
    put(g, C.lot, 'lot', {lvl: L0});
    // стенки каналов и дно
    for (const c of M.ch) {
      const pts = c.pts, n = pts.length, segA = 20, vb = [], vw = [];
      const tang = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
      const inOther = (x, y) => { if (Math.hypot(x, y) > R + .001) return true; for (const o of M.ch) if (o !== c && distPoly(o.pts, x, y) < w - .002) return true; return false; };
      const zb = (x, y, own) => { let z = own; for (const o of M.ch) if (o !== c) { const d = distPoly(o.pts, x, y); if (d < w) z = Math.min(z, M.hv + w - Math.sqrt(w * w - d * d)); } return z; };
      for (let i = 0; i < n - 1; i++) {
        const t0 = tang(i), t1 = tang(i + 1), n0 = [-t0[1], t0[0]], n1 = [-t1[1], t1[0]];
        for (let a = 0; a < segA; a++) {
          const th0 = Math.PI * a / segA, th1 = Math.PI * (a + 1) / segA;
          // 0.12: квад за внутренней гранью кольца — обрезка по окружности R (раньше отбрасывался: через проём под трубу был виден рваный край)
          const P = (pt, nn, th) => { const x = pt[0] + nn[0] * w * Math.cos(th), y = pt[1] + nn[1] * w * Math.cos(th); return [x, y, zb(x, y, M.hv + w - w * Math.sin(th))]; };
          const q = [P(pts[i], n0, th0), P(pts[i + 1], n1, th0), P(pts[i + 1], n1, th1), P(pts[i], n0, th1)];
          const fr = v => R - Math.hypot(v[0], v[1]);
          if (q.every(v => fr(v) >= 0)) { vb.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); continue; }
          if (!q.some(v => fr(v) > 0)) continue;
          const cp = [];
          for (let k = 0; k < 4; k++) { const A = q[k], B = q[(k + 1) % 4], fa = fr(A), fb = fr(B);
            if (fa >= 0) cp.push(A);
            if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); cp.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); } }
          for (let k = 1; k < cp.length - 1; k++) vb.push(...cp[0], ...cp[k], ...cp[k + 1]);
        }
        for (const side of [1, -1]) {
          let a = [pts[i][0] + n0[0] * w * side, pts[i][1] + n0[1] * w * side], b = [pts[i + 1][0] + n1[0] * w * side, pts[i + 1][1] + n1[1] * w * side];
          // 0.12: отрезок, пересекающий внутреннюю грань кольца, — обрезать по окружности R
          { const ra = Math.hypot(a[0], a[1]), rb = Math.hypot(b[0], b[1]);
            if (ra > R && rb > R) continue;
            if ((ra > R) !== (rb > R)) { const fa = R - ra, fb = R - rb, t = fa / (fa - fb), m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (ra > R) a = m; else b = m; } }
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          if (inOther(mx, my) || (M.hasWall && KC.behindWall(M, mx, my) > -M.tw)) continue;
          const za = M.hb + 0, zc = M.hv + w;
          vw.push(a[0], a[1], zc, b[0], b[1], zc, b[0], b[1], za, a[0], a[1], zc, b[0], b[1], za, a[0], a[1], za);
        }
      }
      for (const [arr, col] of [[vb, C.chan], [vw, C.lot]]) { if (!arr.length) continue; const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); gg.computeVertexNormals(); put(gg, col, 'lot', {lvl: L0}); }
    }
    // слой под каналом (hv>0) — заполнение
    if (M.hv > .001) { const sh = new THREE.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false); put(shapeGeo(sh, M.hv * .98), C.lot, 'lot', {lvl: L0}); }
  }
  // стенка-растекатель и стальной лист
  if (M.hasWall) {
    const ux = M.uin[0], uy = M.uin[1], ang = M.pipes[1].ang;
    // нижняя панель — с проёмом c×150 по центру низа; остальные — сплошные
    const perm = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);   // (u, v, глубина) → (по радиусу, вдоль стенки, вверх)
    M.wall.forEach((p, i) => {
      const hh = p.z1 - p.z0 - .006, b = M.bw / 2, sh = new THREE.Shape();
      if (i === 0) { const c = M.wcut.c / 2, h = M.wcut.h; sh.moveTo(-b, 0); sh.lineTo(-c, 0); sh.lineTo(-c, h); sh.lineTo(c, h); sh.lineTo(c, 0); sh.lineTo(b, 0); sh.lineTo(b, hh); sh.lineTo(-b, hh); sh.closePath(); }
      else { sh.moveTo(-b, 0); sh.lineTo(b, 0); sh.lineTo(b, hh); sh.lineTo(-b, hh); sh.closePath(); }
      const g = new THREE.ExtrudeGeometry(sh, {depth: M.tw, bevelEnabled: false}).applyMatrix4(perm).translate(M.dw - M.tw, 0, p.z0);
      put(g, C.wall, p.key, {rotz: ang, lvl: lvlAt(p.z0), edges: true}); });
    const ch = d => Math.sqrt(Math.max(.0001, (M.Rin - .01) ** 2 - d * d));
    const sh = new THREE.Shape(); sh.moveTo(M.dw, -ch(M.dw));
    for (let i = 0; i <= 24; i++) { const y = -ch(M.dw) + 2 * ch(M.dw) * i / 24; sh.lineTo(Math.max(M.dw, Math.sqrt(Math.max(0, (M.Rin - .01) ** 2 - y * y))), y); }
    sh.lineTo(M.dw, ch(M.dw));
    put(shapeGeo(sh, .012), C.steel, 'wall0', {rotz: ang, lvl: L0, m: {metalness: .4, roughness: .5}});
    void ux; void uy;
  }
  // скобы
  M.steps.forEach(zz => {
    const up = zz > M.V + M.hpp, r = KC.stepRadius(M, zz) - (up ? M.a : 0), cx = up ? M.gx : 0, cy = up ? M.gy : 0, L = lvlAt(zz), of = (KC.skOwner(M, zz) || {}).key;   // скоба — вместе со своим кольцом
    for (const yy of [-.15, .15]) put(new THREE.BoxGeometry(.12, .022, .022).translate(r - .06, yy, 0), C.step, 'sk', {pos: [cx, cy, zz], rotz: M.go, lvl: L, of, m: {metalness: .4, roughness: .45}});
    put(new THREE.BoxGeometry(.022, .32, .022).translate(r - .12, 0, 0), C.step, 'sk', {pos: [cx, cy, zz], rotz: M.go, lvl: L, of, m: {metalness: .4, roughness: .45}});
  });
  // МС на швах
  M.seams.forEach(s => {
    const B = KC.MS[s.mark].B / 1000, L = (order.get(s.below.key) ?? 0) + .5;
    for (const a of s.angs) {
      const r0 = s.rin - .012, parts = [];
      parts.push(new THREE.BoxGeometry(B, .08, .006).translate(r0 + B / 2, 0, 0));                         // стенка в шве
      const fl = (r, z0, z1) => parts.push(new THREE.BoxGeometry(.008, .08, z1 - z0).translate(r, 0, (z0 + z1) / 2));
      const rIn = r0 - .004, rOut = r0 + B + .004;
      if (!s.asym) { fl(rIn, -.08, .08); fl(rOut, -.08, .08); }
      else if (s.longOut) { fl(rOut, -.08, .08); fl(rIn, -.078, .006); }   // под ПП: длинная полка снаружи, короткая — вниз по кольцу
      else { fl(rIn, -.08, .08); fl(rOut, -.006, .078); }                 // ПП–горловина: длинная внутрь (кольцо + край лаза), короткая — вверх
      for (const g of parts) put(g, C.ms, s.key, {pos: [s.cx, s.cy, s.z], rotz: a, lvl: L, m: {metalness: .5, roughness: .4}});
    }
  });
  // основание
  // 0.12: уплотнённый грунт — свой ключ baseC (свой шаг, на общих видах не показывается)
  // 0.14: верх каждого слоя основания — на 2 мм ниже низа того, что на нём лежит: без совпадающих граней (в разрезе на телефоне
  // совпадающие низ плиты днища и верх подготовки давали «лучи» — z-fighting)
  for (const b of M.base) put(new THREE.CylinderGeometry(b.r, b.r, b.z1 - b.z0 - .002, 96).rotateX(Math.PI / 2).translate(0, 0, (b.z0 + b.z1 - .002) / 2), C[b.col], b.cls === 'comp' ? 'baseC' : 'base', {lvl: -1, edges: b.cls !== 'bitl', part: b.cls});
  if (M.zamok) put(ringGeo(M.zamok.rin + .003, M.zamok.rout, M.zamok.z1 - M.zamok.z0), C.clay, 'zamok', {pos: [0, 0, M.zamok.z0], lvl: -1, edges: true});   // 0.12: свой шаг — после труб
  // уровень грунтовых вод: полупрозрачная гладь вокруг колодца (только в обзоре)
  // 0.16: два уровня — ожидаемый (максимальный, расчётный) пурпурный и установившийся синий (как в AutoCAD и на чертежах паспорта)
  const water = (zU, col, part) => { const sh = new THREE.Shape(); sh.absarc(0, 0, M.surfR + .5, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); if (zU > M.V + M.hpp) hole.absarc(M.gx, M.gy, .43, 0, Math.PI * 2, true); else hole.absarc(0, 0, zU < 0 ? M.pnR + .1 : M.Rout + .006, 0, Math.PI * 2, true); sh.holes.push(hole);
    put(new THREE.ShapeGeometry(sh, 96).translate(0, 0, zU), col, 'ugv', {lvl: -1, part, m: {transparent: true, opacity: .3, depthWrite: false, roughness: .2, metalness: .1}}); };
  if (M.wetV) {
    water(M.zU, M.ugv2 ? C.ugvMax : C.ugv, 'water');
    if (M.ugv2 && M.zU0 !== null && M.zU0 > M.zBase + .005) water(M.zU0, C.ugv, 'water0');
  }
  // битумная гидроизоляция снаружи (тонкая оболочка) и лента на стыках
  // у каждой оболочки и ленты — свой элемент (of): битум наносят на элементы до сборки, ленту — на стык сразу после установки элемента над ним
  let of = null;
  const shell = (cx, cy, r, z0, z1, key, col, L, seg = 96) => put((!cx && !cy && KC._.shellHolesGeo(THREE, r, z0, z1, holes)) || new THREE.CylinderGeometry(r, r, z1 - z0, seg, 1, true).rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2), col, key, {pos: [cx, cy, 0], lvl: L, of, edges: col === C.tape, m: col === C.tape ? {roughness: .5, metalness: 0} : {roughness: .45, metalness: .05}});
  const spans = (cx, cy, r, z0, z1, L, seg) => { for (const [a, b] of KC.coatSpans(M, z0, z1)) shell(cx, cy, r, a, b, 'coat', C.coat, L, seg); };
  for (const e of M.els) {
    const L = order.get(e.key); of = e.key;
    if (e.kind === 'КС') spans(0, 0, M.Rout + .003, e.z0, e.z1, L);
    else if (e.kind === 'ПП') { if (!KC.coated(M, e.z0, e.z1)) continue;
      shell(0, 0, M.Rout + .003, e.z0, e.z1, 'coat', C.coat, L);
      // верх плиты перекрытия вокруг горловины — тоже под битумом (входит в площадь «снаружи» по справочнику)
      const sh = new THREE.Shape(); sh.absarc(0, 0, M.Rout + .003, 0, Math.PI * 2, false); const hl = new THREE.Path(); hl.absarc(M.gx, M.gy, .425, 0, Math.PI * 2, true); sh.holes.push(hl);
      put(shapeGeo(sh, .003).translate(0, 0, e.z1 + .001), C.coat, 'coat', {lvl: L, of, m: {roughness: .45, metalness: .05}}); }
    else if (e.kind === 'ПН') { if (!M.gzWet) continue;
      shell(0, 0, e.rout + .003, e.z0, e.z1, 'coat', C.coat, L);
      const sh = new THREE.Shape(); sh.absarc(0, 0, e.rout + .003, 0, Math.PI * 2, false); const hl = new THREE.Path(); hl.absarc(0, 0, M.Rout + .003, 0, Math.PI * 2, true); sh.holes.push(hl);
      put(shapeGeo(sh, .003).translate(0, 0, e.z1 + .001), C.coat, 'coat', {lvl: L, of, m: {roughness: .45, metalness: .05}}); }
    else if (e.kind === 'КГ') spans(e.cx, e.cy, .423, e.z0, e.z1, L, 64);
    else if (e.kind === 'КО') for (let i = 0; i < e.q; i++) spans(e.cx, e.cy, .423, e.z0 + i * .08, e.z0 + i * .08 + .07, L, 64);
    else if (e.kind === 'НБ') spans(e.cx, e.cy, .423, e.z0, e.z1, L, 64);
    else if (e.kind === 'ЛЮК' && e.bed) spans(e.cx, e.cy, .423, e.bed[0], e.bed[1], L, 64);   // постель под люком — снаружи тоже под битумом (в зонах)
  }
  // ленты: перекрывающиеся полосы (на горловине швы КО6 через 80 мм) показываем одной полосой
  const gTop = M.koE ? M.koE.z1 : M.gorl.length ? M.gorl[M.gorl.length - 1].z1 : 1e9, tb = [];
  for (const t of M.tapes) {
    const z0 = Math.max(t.z - M.tapeW / 2, t.lo >= 0 ? t.lo : -1e9), z1 = t.part === 'g' ? Math.min(t.z + M.tapeW / 2, gTop) : t.z + M.tapeW / 2, L = (order.get(t.below.key) ?? 0) + .5;
    const pool = M.els.filter(e => t.part === 'g' ? (e.kind === 'КГ' || e.kind === 'КО') : (e.kind === 'КС' || e.kind === 'ПП'));
    let ow = null; for (const e of pool) if (e.z1 > t.z && (!ow || e.z0 < ow.z0)) ow = e;   // элемент над стыком (или кольцо КО6, в котором шов)
    const pv = tb.find(q => q.cx === t.cx && q.cy === t.cy && q.r === t.r && z0 <= q.z1 + .005 && z1 >= q.z0 - .005);
    if (pv) { pv.z0 = Math.min(pv.z0, z0); pv.z1 = Math.max(pv.z1, z1); if (ow && (!pv.of || ow.z0 > pv.ofz)) { pv.of = ow.key; pv.ofz = ow.z0; } }
    else tb.push({cx: t.cx, cy: t.cy, r: t.r, z0, z1, L, seg: t.part === 'r' ? 96 : 64, of: ow ? ow.key : null, ofz: ow ? ow.z0 : -1e9});
  }
  const tapeMat = (h, r) => tapeMatOf(THREE, M, h, r);
  for (const q of tb) { const r = q.r + .007, mt = tapeMat(q.z1 - q.z0, r);
    put((!q.cx && !q.cy && KC._.shellHolesGeo(THREE, r, q.z0, q.z1, holes)) || new THREE.CylinderGeometry(r, r, q.z1 - q.z0, q.seg, 1, true).rotateX(Math.PI / 2).translate(0, 0, (q.z0 + q.z1) / 2), C.tape, 'tape', Object.assign({pos: [q.cx, q.cy, 0], lvl: q.L, edges: true, of: q.of}, mt ? {mat: mt} : {m: {roughness: .32}})); }
  // стык с днищем — угловой: полоса Г-образно, половина на кольцо, половина на выступ плиты днища (остаток — на её торец)
  { const pn = M.els[0], half = M.tapeW / 2;
    if (pn && pn.kind === 'ПН' && pn.rout > M.Rout + .02 && M.tapes.some(t => t.lo === 0)) {
      const ledge = pn.rout - M.Rout, r1 = M.Rout + Math.min(half, ledge) + .004, L = (order.get(pn.key) ?? 0) + .5, rest = half - ledge;
      const sh = new THREE.Shape(); sh.absarc(0, 0, r1, 0, Math.PI * 2, false); const hl = new THREE.Path(); hl.absarc(0, 0, M.Rout + .004, 0, Math.PI * 2, true); sh.holes.push(hl);
      const ofr = M.rings[0] ? M.rings[0].key : null, zt = pn.z1 + .005, hz = holes.filter(q => Math.abs(q.zc - zt) < q.r);
      // 0.12: под трубами полоса вырезана (труба насквозь)
      put(hz.length ? KC._.bufOf(THREE, [KC._.holeSurf({kind: 'face', rin: M.Rout + .004, rout: r1, zf: zt + .003, holes: hz, side: 1})]) : shapeGeo(sh, .003, 96).translate(0, 0, zt), C.tape, 'tape', {lvl: L, edges: true, of: ofr, m: {roughness: .32}});
      if (rest > .005) put(new THREE.CylinderGeometry(pn.rout + .008, pn.rout + .008, rest, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, pn.z1 - rest / 2), C.tape, 'tape', {lvl: L, edges: true, of: ofr, m: {roughness: .32}}); } }
  // покрытие у люка
  buildSurface(M, THREE, put, shapeGeo, C, M.els.length);
  // свет
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f94, .62));
  const dl = new THREE.DirectionalLight(0xffffff, .72); dl.position.set(-3, -5, 8); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, .25); dl2.position.set(4, 2, 3); scene.add(dl2);
  const SCo = {scene, meshes, mats: [...mats.values(), ...xmats, edgeMat], THREE, M, maxLvl: M.els.length + 1};
  { const lv = new Map(); for (const m of meshes) if (!lv.has(m.userData.key)) lv.set(m.userData.key, m.userData.lvl);   // 0.16: зазоры разнесённого вида
    SCo.expOf = KC.expLevels(M.els.map(e => ({lvl: lv.get(e.key), R: e.kind === 'ПД' ? 1.25 : e.kind === 'РШ' ? .44 : e.rout || 0}))); }
  return SCo;
};
function buildSurface(M, THREE, put, shapeGeo, C, L) {
  const cx = M.gx, cy = M.gy, Rs = M.surfR, zg = M.zg, rh = M.hat[0] + .005;
  const disc = (r, holes) => { const sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, Math.PI * 2, false); for (const h of holes) sh.holes.push(h); return sh; };
  const circ = r => { const p = new THREE.Path(); p.absarc(0, 0, r, 0, Math.PI * 2, true); return p; };
  const rect = (hx, hy) => { const p = new THREE.Path(); p.moveTo(-hx, -hy); p.lineTo(-hx, hy); p.lineTo(hx, hy); p.lineTo(hx, -hy); p.lineTo(-hx, -hy); return p; };
  const holeG = M.hat[1] ? rect(.365, .365) : circ(rh);
  if (M.place === 'Д') {
    put(shapeGeo(disc(Rs, [holeG]), .07, 96), C.asph, 'surf', {pos: [cx, cy, zg - .07], rotz: M.go, lvl: L, m: {roughness: .95}});
    if (M.pd6) put(shapeGeo(disc(Rs, [rect(1.255, .88)]), .25, 96), C.gravel, 'surf', {pos: [cx, cy, zg - .32], rotz: M.go, lvl: L});
    else put(shapeGeo(disc(Rs, [circ(.43)]), .25, 96), C.gravel, 'surf', {pos: [cx, cy, zg - .32], lvl: L});
  } else if (M.place === 'Т') {
    const g = shapeGeo(disc(Rs, [holeG]), .06, 96);
    put(g, C.tile, 'surf', {pos: [cx, cy, zg - .06], rotz: M.go, lvl: L, m: {map: tileTexture(THREE), roughness: .9}});
    put(shapeGeo(disc(Rs, [circ(.43)]), .1, 96), C.sand, 'surf', {pos: [cx, cy, zg - .16], lvl: L});
  } else {
    // газон / незастроенная: грунт с травой, асфальтовая отмостка вокруг люка с уклоном от люка
    const top = M.place === 'Н' ? C.soil : C.grass;
    put(shapeGeo(disc(Rs, [circ(M.otmR)]), .15, 96), M.place === 'Н' ? C.soil : C.soil, 'surf', {pos: [cx, cy, zg - .17], lvl: L});
    put(shapeGeo(disc(Rs, [circ(M.otmR)]), .02, 96), top, 'surf', {pos: [cx, cy, zg - .02], lvl: L, m: {roughness: 1}});
    const zi = M.ztop - .015, zo = zg + .0;
    const prof = [new THREE.Vector2(rh, zi - .03 - .12), new THREE.Vector2(M.otmR, zo - .03 - .12), new THREE.Vector2(M.otmR, zo - .03), new THREE.Vector2(rh, zi - .03)];
    put(new THREE.LatheGeometry(prof.concat([prof[0]]), 96).rotateX(Math.PI / 2), C.gravel, 'surf', {pos: [cx, cy, 0], lvl: L});
    const pa = [new THREE.Vector2(rh, zi - .03), new THREE.Vector2(M.otmR, zo - .03), new THREE.Vector2(M.otmR, zo), new THREE.Vector2(rh, zi)];
    put(new THREE.LatheGeometry(pa.concat([pa[0]]), 96).rotateX(Math.PI / 2), C.asph, 'surf', {pos: [cx, cy, 0], lvl: L, m: {roughness: .95}});
  }
}
// труба ПЭ (В1): чёрная с синими полосами вдоль трубы (u — по окружности цилиндра)
function peTexture(THREE) {
  if (peTexture.t || typeof document === 'undefined') return peTexture.t || null;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 4; const g = cv.getContext('2d');
  g.fillStyle = '#1f2226'; g.fillRect(0, 0, 512, 4); g.fillStyle = '#2a7bd4';
  for (const u of [.04, .29, .54, .79]) g.fillRect(Math.round(u * 512), 0, 11, 4);
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; peTexture.t = t; return t;
}
// монолитный бетон (стены В1): отпечатки щитов опалубки 1,2×0,6 м и отверстия от стяжек; UV у ExtrudeGeometry — в метрах
function monoTexture(THREE) {
  if (monoTexture.t || typeof document === 'undefined') return monoTexture.t || null;
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 192; const g = cv.getContext('2d');
  g.fillStyle = '#bdb7ab'; g.fillRect(0, 0, 384, 192);
  for (let i = 0; i < 900; i++) { const v = 170 + Math.floor(Math.random() * 30); g.fillStyle = `rgba(${v},${v - 4},${v - 12},.35)`; g.fillRect(Math.random() * 384, Math.random() * 192, 2, 2); }
  g.strokeStyle = 'rgba(95,90,80,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 382, 190);
  g.fillStyle = 'rgba(60,58,54,.75)'; for (const [x, y] of [[96, 96], [288, 96]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / .6); t.anisotropy = 4; monoTexture.t = t; return t;
}
// гофрированная труба ПП (К1) вдоль оси x от x0 до x1: наружный гофр между rv (впадина) и ro (гребень)
function corrGeo(THREE, rv, ro, x0, x1, pitch) {
  const n = Math.max(2, Math.round((x1 - x0) / pitch)), p = (x1 - x0) / n, V = (r, y) => new THREE.Vector2(r, y), pts = [V(rv, x0)];
  for (let i = 0; i < n; i++) { const y = x0 + i * p; pts.push(V(rv, y + .12 * p), V(ro, y + .32 * p), V(ro, y + .68 * p), V(rv, y + .88 * p), V(rv, y + p)); }
  return new THREE.LatheGeometry(pts, 40).rotateZ(-Math.PI / 2);
}
function tileTexture(THREE) {
  if (tileTexture.t) return tileTexture.t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#c9c2b6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#8f887c'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); tileTexture.t = t; return t;
}

/* крышки разреза: сечения элементов плоскостью и профиль лотка; лежат в плоскости разреза со сдвигом в видимую сторону */
KC.addCaps = function (SC, phi) {
  const {scene, M, THREE} = SC, ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux, eps = .0015, list = [];
  const capMat = new THREE.MeshStandardMaterial({color: KC.COL.cap, roughness: .95, side: THREE.DoubleSide});
  const ironMat = new THREE.MeshStandardMaterial({color: 0x2a2d31, roughness: .8, side: THREE.DoubleSide});
  const lvlOf = key => { const m = SC.meshes.find(x => x.userData.key === key); return m ? m.userData.lvl : 0; };
  const quad = (s0, s1, z0, z1, mat, key) => {
    const g = new THREE.BufferGeometry(), P = (s, z) => [s * ux + nx * eps, s * uy + ny * eps, z];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...P(s0, z0), ...P(s1, z0), ...P(s1, z1), ...P(s0, z0), ...P(s1, z1), ...P(s0, z1)]), 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.userData = {key, cap: true, lvl: lvlOf(key), base: mat}; scene.add(m); SC.meshes.push(m); list.push(m);
  };
  const {out} = KC.cutParts(M, phi);
  for (const p of out) quad(p.s0, p.s1, p.z0, p.z1, p.cls === 'iron' ? ironMat : capMat, p.key);
  // лоток
  const prof = KC.lotProfile(M, phi, .006), pos = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [s0, z0] = prof[i], [s1, z1] = prof[i + 1], P = (s, z) => [s * ux + nx * eps, s * uy + ny * eps, z];
    pos.push(...P(s0, 0), ...P(s1, 0), ...P(s1, z1), ...P(s0, 0), ...P(s1, z1), ...P(s0, z0));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.computeVertexNormals();
  const lm = new THREE.MeshStandardMaterial({color: 0xcfcac0, roughness: .95, side: THREE.DoubleSide}); const m = new THREE.Mesh(g, lm);
  m.userData = {key: 'lot', cap: true, lvl: lvlOf('lot'), base: lm}; scene.add(m); SC.meshes.push(m); list.push(m);
  SC.mats.push(capMat, ironMat, lm);
  return list;
};
// разнести элементы по высоте: t от 0 до 1
KC.explode = function (SC, t, gap = .32) { const f = SC.expOf; for (const m of SC.meshes) { const base = m.userData.z0 ?? (m.userData.z0 = m.position.z); m.position.z = base + t * (f ? f(m.userData.lvl || 0) : gap * (m.userData.lvl || 0)); } };
// 0.16: разнесённый вид — зазоры по размерам элементов: широкий над узким (ПД6 над КО6, плита над кольцом горловины) поднимается
//       выше, чтобы нижний был виден целиком (камера ~20° над горизонтом). items: [{lvl, R}]; возвращает lvl → подъём при t = 1
KC.expLevels = function (items, gap = .32, el = .36) {
  const by = new Map(); for (const it of items) { if (!(it.lvl >= 0)) continue; by.set(it.lvl, Math.max(by.get(it.lvl) || 0, it.R || 0)); }
  const Ls = [...by.keys()].sort((a, b) => a - b), off = new Map(), tn = Math.tan(el);
  let z = 0, prev = null;
  for (const L of Ls) {
    if (prev === null) z = gap * L;
    else { const Ra = by.get(prev), Rb = by.get(L), need = Rb > Ra + .05 ? (Rb - Ra) * tn + .8 * Ra * tn + .06 : 0; z += Math.max(gap * (L - prev), need); }
    off.set(L, z); prev = L; }
  return lvl => { if (off.has(lvl)) return off.get(lvl); if (!Ls.length || lvl < Ls[0]) return gap * lvl;
    let a = Ls[0]; for (const L of Ls) { if (L <= lvl) a = L; else return off.get(a) + (off.get(L) - off.get(a)) * (lvl - a) / (L - a); }
    return off.get(a) + gap * (lvl - a); };
};
// точки привязки подписей (центр элемента по высоте, справа от элемента в направлении «вправо» камеры)
KC.labelAnchors = function (M, right2) {
  const out = [], rx = right2[0], ry = right2[1];
  for (const e of M.els) {
    const r = e.kind === 'ПД' ? 1.0 : e.rout;
    const hmm = M.dims[e.mark] ? M.dims[e.mark].h : Math.round((e.z1 - e.z0) * 1000);
    const zc = (e.z0 + e.z1) / 2, pts = Array.from({length: 16}, (_, i) => { const t = i / 16 * 2 * Math.PI; return [e.cx + r * Math.cos(t), e.cy + r * Math.sin(t), zc]; });   // 0.16: контур — для подписей 3D
    out.push({key: e.key, keys: [e.key], pts, kind: e.kind, mark: e.mark, p: [e.cx + rx * r, e.cy + ry * r, (e.z0 + e.z1) / 2], text: `${e.pos ? e.pos + '. ' : ''}${e.kind === 'РШ' ? 'Решётка' : e.mark}${e.q > 1 ? ' ×' + e.q : ''}`, sub: e.kind === 'ЛЮК' ? `h ${Math.round(M.Hl * 1000)}` : e.kind === 'РШ' ? 'защитная\n620×620' : `h ${hmm}${e.q > 1 ? ' ×' + e.q : ''}`, lvlKey: e.key});
  }
  return out;
};
// внутренние помощники — для модели водопроводных колодцев (corevv.js)
// лента как на стройке: чёрная, глянцевая, с синей надписью «ЛЕНТА» по кругу и светлыми кромками (К1 и В1)
function tapeMatOf(THREE, M, h, r) {
  if (typeof document === 'undefined') return null;
  const rows = Math.max(1, Math.round(h / .3)), c = document.createElement('canvas'); c.width = 2048; c.height = Math.max(48, Math.round(2048 / (2 * Math.PI * r) * h));
  const g = c.getContext('2d'); g.fillStyle = KC.TAPE_BG || '#16181b'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#5d6772'; g.fillRect(0, 0, c.width, 5); g.fillRect(0, c.height - 5, c.width, 5);
  const circ = 2 * Math.PI * r, pxm = c.width / circ;   // пикселей на метр по окружности
  g.font = 'bold 100px Arial, sans-serif';
  const size = txt => {   // длинная надпись — в две строки, дуга до 1,2 м; короткая — одной строкой крупно
    const lng = txt.length > 8, lines = lng && txt.includes(' ') ? [txt.slice(0, txt.lastIndexOf(' ')), txt.slice(txt.lastIndexOf(' ') + 1)] : [txt];
    const arc = Math.min(lng ? 1.2 : .55, r * 1.4), fit = arc * pxm / Math.max(...lines.map(l => g.measureText(l).width)) * 100;
    return {txt, lng, lines, fs: Math.round(Math.min((c.height - 10) / rows * (lines.length > 1 ? .33 : .55), fit))}; };
  let S = size(KC.TAPE_TEXT || 'ЛЕНТА');
  if (S.lng && S.fs / pxm < .075) S = size('ЛЕНТА');   // узкая полоса (у днища) и горловина: буквы мельче 75 мм — пишем коротко и крупно
  const {txt, lines, fs} = S, n = Math.max(2, Math.round(circ / (S.lng ? 2.4 : 1.6))), segW = c.width / n;
  g.font = `bold ${fs}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2f86e0';
  for (let i = 0; i < rows; i++) { const y = c.height * (i + .5) / rows + 2;
    for (let j = 0; j < n; j++) lines.forEach((l, k) => g.fillText(l, segW * (j + .5), y + (k - (lines.length - 1) / 2) * fs * 1.12)); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  // первая надпись — по центру к смотрящему: угол φ на кольце ↔ u = (φ + π/2) / 2π
  const fr = M.go - Math.PI / 2 - .4, uc = (((fr + Math.PI / 2) / (2 * Math.PI)) % 1 + 1) % 1; t.offset.x = ((.5 / n - uc) % 1 + 1) % 1;
  return new THREE.MeshStandardMaterial({map: t, roughness: .32, metalness: .05, side: THREE.DoubleSide});
}
/* 0.12: проёмы под трубы в кольцах — труба видна насквозь (в трубе не видно стенки колодца). Поверхности — по развёртке:
   стены (θ, z), торцы (θ, r); у отверстий мелкая сетка, граница — marching squares; стенки проёма — между внутренней и наружной поверхностью.
   holes: [{ang, zc, r}] — ось горизонтальна и проходит через ось колодца, zc — высота оси от низа поверхности, r — радиус проёма */
// сетка по углу: равномерно seg + мелко (шаг ds по радиусу Rmax) у отверстий; общая для всех поверхностей кольца — вершины на кромках совпадают
function holeTh(H, Rmin, Rmax, ds = .01, seg = 96) {
  const TAU = Math.PI * 2; let th = []; for (let i = 0; i <= seg; i++) th.push(i * TAU / seg);
  for (const q of H) { const hw = Math.asin(Math.min(.999, q.r / Rmin)) + .06, n = Math.max(4, Math.ceil(2 * hw * Rmax / ds));
    for (let k = 0; k <= n; k++) { const a = q.ang - hw + 2 * hw * k / n; th.push(((a % TAU) + TAU) % TAU); } }
  th.sort((a, b) => a - b); th = th.filter((a, i) => i === 0 || a - th[i - 1] > 1e-7);
  if (TAU - th[th.length - 1] > 1e-7) th.push(TAU); else th[th.length - 1] = TAU;
  return th;
}
function holeSurf(o) {
  const TAU = Math.PI * 2, H = o.holes || [], ds = o.ds || .01, wall = o.kind === 'wall';
  const th = o.th || holeTh(H, wall ? o.R : o.rin, wall ? o.R : o.rout, ds, o.seg || 96);
  const v0 = wall ? 0 : o.rin, v1 = wall ? o.h : o.rout, nv = Math.max(1, Math.ceil((v1 - v0) / (wall ? (o.dz || .02) : ds) - 1e-9)), vs = [];
  for (let j = 0; j <= nv; j++) vs.push(v0 + (v1 - v0) * j / nv);
  const f = (t, v) => { let m = 1e9;
    for (const q of H) { const d = t - q.ang, c = Math.cos(d); if (c <= 0) continue; const sn = Math.sin(d);
      if (wall) m = Math.min(m, Math.hypot(o.R * sn, v - q.zc) - q.r);
      else { const dz = o.zf - q.zc; if (Math.abs(dz) >= q.r) continue; m = Math.min(m, Math.abs(v * sn) - Math.sqrt(q.r * q.r - dz * dz)); } }
    return m; };
  const P = (t, v) => wall ? [o.R * Math.cos(t), o.R * Math.sin(t), v] : [v * Math.cos(t), v * Math.sin(t), o.zf];
  const Nv = t => wall ? [o.side * Math.cos(t), o.side * Math.sin(t), 0] : [0, 0, o.side];
  const pos = [], nor = [], uv = [];
  const tri = (a, b, c) => { const A = P(a[0], a[1]), B = P(b[0], b[1]), C = P(c[0], c[1]), n = Nv((a[0] + b[0] + c[0]) / 3);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const pts = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0 ? [a, c, b] : [a, b, c];
    for (const p of pts) { const X = P(p[0], p[1]), Nn = Nv(p[0]); pos.push(X[0], X[1], X[2]); nor.push(Nn[0], Nn[1], Nn[2]); uv.push((p[0] + Math.PI / 2) / TAU, (p[1] - v0) / (v1 - v0)); } };
  const F = vs.map(v => th.map(t => f(t, v)));
  for (let j = 0; j < nv; j++) for (let i = 0; i < th.length - 1; i++) {
    const c = [[th[i], vs[j]], [th[i + 1], vs[j]], [th[i + 1], vs[j + 1]], [th[i], vs[j + 1]]], val = [F[j][i], F[j][i + 1], F[j + 1][i + 1], F[j + 1][i]], ins = val.map(x => x > 0);
    if (ins[0] && ins[1] && ins[2] && ins[3]) { tri(c[0], c[1], c[2]); tri(c[0], c[2], c[3]); continue; }
    if (!(ins[0] || ins[1] || ins[2] || ins[3])) continue;
    const poly = [];
    for (let q = 0; q < 4; q++) { const a = q, b = (q + 1) % 4; if (ins[a]) poly.push(c[a]);
      if (ins[a] !== ins[b]) { const tt = val[a] / (val[a] - val[b]); poly.push([c[a][0] + (c[b][0] - c[a][0]) * tt, c[a][1] + (c[b][1] - c[a][1]) * tt]); } }
    for (let q = 1; q < poly.length - 1; q++) tri(poly[0], poly[q], poly[q + 1]);
  }
  return {pos, nor, uv};
}
// стенка проёма (цилиндр отверстия) между внутренней и наружной поверхностью кольца, по высоте — в пределах [0, h]
function holeTunnel(q, rin, rout, h, nA = 64) {
  const TAU = Math.PI * 2, ca = Math.cos(q.ang), sa = Math.sin(q.ang), al = [];
  for (let k = 0; k <= nA; k++) al.push(TAU * k / nA);
  for (const zl of [0, h]) { const sn = (zl - q.zc) / q.r; if (Math.abs(sn) < 1) { const a1 = Math.asin(sn); for (const a of [a1, Math.PI - a1]) al.push(((a % TAU) + TAU) % TAU); } }
  al.sort((a, b) => a - b);
  const pt = (a, R) => { const lat = q.r * Math.cos(a), x = Math.sqrt(Math.max(0, R * R - lat * lat)); return [x * ca - lat * sa, x * sa + lat * ca, q.zc + q.r * Math.sin(a)]; };
  const nr = a => [Math.cos(a) * sa, -Math.cos(a) * ca, -Math.sin(a)];   // к оси отверстия
  const pos = [], nor = [], uv = [];
  for (let k = 0; k < al.length - 1; k++) {
    const a = al[k], b = al[k + 1]; if (b - a < 1e-9) continue;
    const zm = q.zc + q.r * Math.sin((a + b) / 2); if (zm < 0 || zm > h) continue;
    const A = pt(a, rin), B = pt(a, rout), C = pt(b, rout), D = pt(b, rin), na = nr(a), nb = nr(b), nm = nr((a + b) / 2);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const flip = (uy * vz - uz * vy) * nm[0] + (uz * vx - ux * vz) * nm[1] + (ux * vy - uy * vx) * nm[2] < 0;
    for (const [p, n] of flip ? [[A, na], [C, nb], [B, na], [A, na], [D, nb], [C, nb]] : [[A, na], [B, na], [C, nb], [A, na], [C, nb], [D, nb]]) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); uv.push(0, 0); }
  }
  return {pos, nor, uv};
}
// кольцо заделки между трубой (r0) и проёмом (r1) по поверхности цилиндра радиуса R (side: 1 — наружу, −1 — внутрь колодца); q.zc — абсолютная
function holeCap(q, r0, r1, R, side, nA = 64) {
  const TAU = Math.PI * 2, ca = Math.cos(q.ang), sa = Math.sin(q.ang), pos = [], nor = [], uv = [];
  const pt = (a, rr) => { const lat = rr * Math.cos(a), x = Math.sqrt(Math.max(0, R * R - lat * lat)); return [x * ca - lat * sa, x * sa + lat * ca, q.zc + rr * Math.sin(a)]; };
  const nn = p => { const L = Math.hypot(p[0], p[1]) || 1; return [side * p[0] / L, side * p[1] / L, 0]; };
  for (let k = 0; k < nA; k++) {
    const a = TAU * k / nA, b = TAU * (k + 1) / nA, A = pt(a, r0), B = pt(a, r1), C = pt(b, r1), D = pt(b, r0), nm = nn(B);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const flip = (uy * vz - uz * vy) * nm[0] + (uz * vx - ux * vz) * nm[1] + (ux * vy - uy * vx) * nm[2] < 0;
    for (const p of flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D]) { const n = nn(p); pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); uv.push(0, 0); }
  }
  return {pos, nor, uv};
}
function bufOf(THREE, parts) {
  let n = 0; for (const p of parts) n += p.pos.length;
  const P = new Float32Array(n), N = new Float32Array(n), U = new Float32Array(n / 3 * 2); let i = 0, j = 0;
  for (const p of parts) { P.set(p.pos, i); N.set(p.nor, i); U.set(p.uv, j); i += p.pos.length; j += p.uv.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  return g;
}
// кольцо высотой h (от 0) с проёмами
function ringHolesGeo(THREE, rin, rout, h, holes) {
  const th = holeTh(holes, rin, rout);
  return bufOf(THREE, [holeSurf({kind: 'wall', R: rout, h, holes, side: 1, th}), holeSurf({kind: 'wall', R: rin, h, holes, side: -1, th}),
    holeSurf({kind: 'face', rin, rout, zf: 0, holes, side: -1, th}), holeSurf({kind: 'face', rin, rout, zf: h, holes, side: 1, th})].concat(holes.map(q => holeTunnel(q, rin, rout, h))));
}
// оболочка (битум, лента) радиуса r от z0 до z1 с проёмами: holes — с абсолютной zc; null — проёмов нет
function shellHolesGeo(THREE, r, z0, z1, holes) {
  const hs = (holes || []).filter(q => q.zc + q.r > z0 && q.zc - q.r < z1).map(q => ({...q, zc: q.zc - z0}));
  if (!hs.length) return null;
  return bufOf(THREE, [holeSurf({kind: 'wall', R: r, h: z1 - z0, holes: hs, side: 1})]).translate(0, 0, z0);
}
// полосы по высоте [z0, z1] за вычетом проёмов в разрезе: стена на стороне phiS (направление от оси), средний радиус Rm
function wallCutZ(holes, phiS, Rm, z0, z1) {
  let iv = [[z0, z1]];
  for (const q of holes || []) { const d = phiS - q.ang; if (Math.cos(d) <= 0) continue; const lat = Rm * Math.abs(Math.sin(d)); if (lat >= q.r) continue;
    const hh = Math.sqrt(q.r * q.r - lat * lat), a = q.zc - hh, b = q.zc + hh, nx = [];
    for (const [p, w] of iv) { if (b <= p || a >= w) { nx.push([p, w]); continue; } if (a > p) nx.push([p, a]); if (b < w) nx.push([b, w]); }
    iv = nx; }
  return iv.filter(([p, w]) => w - p > 1e-6);
}
KC._ = {lineCircle, lineBox, minus, tileTexture, peTexture, monoTexture, corrGeo, tapeMatOf, b64u, zip, dir, ringHolesGeo, shellHolesGeo, holeCap, holeSurf, bufOf, wallCutZ};
})(typeof window !== 'undefined' ? window : globalThis);
