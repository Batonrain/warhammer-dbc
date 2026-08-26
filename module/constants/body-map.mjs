// module/constants/body-map.mjs
// ════════════════════════════════════════════════════════════════════════
//  Медицинский когитатор — вкладка «ТЕЛО».
//  • classifyImplant()  — авто-привязка импланта к части тела по названию.
//  • buildBodyState()   — сводит импланты в состояние регионов/оверлеев.
//                         аугметикой красятся цветом КАТЕГОРИИ импланта.
//  • buildEcg()         — кардиограмма, зависящая от текущих Ран.
//  Механику эта модель НЕ трогает — только визуализирует.
// ════════════════════════════════════════════════════════════════════════
import { esc } from "../helpers/utils.mjs";
import { AELDARI_RACES } from "./races.mjs";

// ── Ключевые слова → тип импланта (ru + en) ─────────────────────────────────
const IMPLANT_KINDS = [
  { kind: "mechadendrite",
    re: /servo-manip|манипул|mechadendr|механодендр|servo-arm|dataspike|даташип|даташп|scribe-tine|писар|prehensile|цепк|gordii|гордий/i },
  { kind: "eye",
    re: /\beye\b|глаз|ocular|окуляр|visor|визор|ranger visor|auspex|ауспекс|target focus|прицельн|оккулоб|occulobe/i },
  // «Сус-ан» и «Железа Бетчера» стоят ИМЕННО здесь, выше кожи: мембрана Сус-ан
  // иначе попала бы в кожу по слову «мембрана», а железы Бетчера — в торс.
  { kind: "cranial",
    re: /cranial|черепн|cortical|кортикал|cerebr|мозж|mind|мысл|разум|memoranc|меморанс|\bmiu\b|миу|neuro|нейро|crown|корон|skull|череп|infoslave|инфораб|marshal|маршал|volitor|волитор|circuitry|цепи|catechism|катехиз|noospher|ноосфер|logic|логик|каталепт|catalepsean|сус-ан|sus-an|бетчер|betcher/i },
  { kind: "heart",
    re: /heart|сердц|autosangu|автосангв|potentia|потенциа|гемастамен|haemastamen|ларраман|larraman/i },
  { kind: "respirator",
    re: /respirator|респират|breath|дыхан|воздух|противогаз|маск|rebreath/i },
  { kind: "lung",
    re: /lung|лёгк|легк/i },
  { kind: "arm",
    re: /\barm\b|рук(а|у|и|е)|weapon brace|оружейн зажим|iron fist|железн кулак|blade tine|когт.?-?лезв|manip(?!ul)|iron hand|servo-manipulator/i },
  { kind: "leg",
    re: /\bleg\b|нога|ноги|ногу|ноге|tracked|гусениц|digitigrad|дигитигр|all-?terrain|вездеход|talon|коготь птер|птераксии|arachnid|арахнид|serpentine|серпентин|repulsor|репульсор/i },
  { kind: "skeleton",
    re: /skeletal|скелет|petrifaction|petrif|укреплен|spined|шипаст|reinforced skel|усиленн\w* скелет|flexible skel|гибк\w* скелет|joint reconfig|реконфиг сустав|\bbone\b|кост(ь|и|ей|ный)|adamant|адамант|sicarian efm|сикарианск|оссмодул|ossmodul/i },
  { kind: "skin",
    re: /subdermal|подкожн|voidskin|пустотн\w* кож|synthmusc|синтемускул|\bdermal\b|slime skin|слизист\w* кож|scale skin|чешу|skin mite|кожн\w* параз|membrane|мембран|reconstructor|реконструктор|меланохром|melanochrom|мукраноид|mucranoid/i },
  { kind: "torso",
    re: /carapace|панцирь|war plate|латы|mantle|мантия|rib|рёбр|ребр|torso|тулов|\bbody\b|тело|internal|внутрен|bio-monitor|биомонитор|gastral|гастрал|sucroregul|сахарорег|waste proc|обработк\w* отход|бископе|biscopea|преомнор|preomnor|омофаге|omophage|оолитическ|oolitic|прогеноид|progenoid/i },
];

/**
 * Возвращает {kind} для импланта или null, если не удалось локализовать.
 * category — system.category импланта: у Механодендритов он уже своё
 * "mechadendrite" (packs-src/implants/Адептус_Механикус/Мехадендриты) —
 * надёжнее regex по названию, которое ловит не все варианты (Мехатендрил/
 * Фуцелиновый Факел/Плазменный Резак вообще не содержат "мехадендрит", а
 * Серво-Коготь по слову "коготь" ложно уезжал в kind:"leg").
 */
export function classifyImplant(name = "", installed = "", category = "") {
  if (category === "mechadendrite") return { kind: "mechadendrite" };
  const hay = `${name} ${installed}`.toLowerCase();
  if (/всё тело|все тело|полностью|whole body|full body|all body/i.test(hay))
    return { kind: "fullbody" };
  for (const def of IMPLANT_KINDS) if (def.re.test(hay)) return { kind: def.kind };
  return null;
}

// ── Цвета категорий (совпадают с реестром аугметики) ────────────────────────
const CAT_COLORS = {
  mechanicus:   "#ff9a3c",
  mechEnergy:   "#ff9a3c",   // семейство Механикус — единый янтарь
  mechFocus:    "#ff9a3c",
  mechOther:    "#ff9a3c",
  mechadendrite:"#ff9a3c",
  bionic:       "#4dd2ff",
  cybernetic:   "#7fe0a8",
  psybernetic:  "#c06fff",
  archeotech:   "#ffd24d",
  skitarii:     "#ff6b3c",
  bioimplant:   "#ff5a8a",   // биоимпланты Друкхари
  astartes:     "#c0392b",   // органы Геносемени — бордовый, «мясо», а не металл
};
export function implantCatColor(cat) { return CAT_COLORS[cat] || "#7fe0a8"; }

/**
 * Сводит импланты в состояние фигуры.
 * @param {Array} implants  [{name, installed, category, side?}]  side: "left"|"right"
 */
export function buildBodyState(implants = []) {
  // Регионы: "flesh" ИЛИ строка-категория (задаёт цвет). Красим только конечности,
  // «кожу» торса и всё-тело; органы/глаза/череп — отдельные светящиеся оверлеи.
  const regions = { head: "flesh", torso: "flesh", armL: "flesh", armR: "flesh", legL: "flesh", legR: "flesh" };
  const overlays = { eyeL: null, eyeR: null, cranial: null, heart: null, lungs: null, respirator: null, skeleton: null, skin: null, spine: false, armored: false };
  let mechadendrites = 0, extraArms = 0;
  let armAuto = "right", legAuto = "right", eyeAuto = "right";
  const placed = new Map(); // implant.name -> {locus, cat}
  const cats = new Set();   // категории, присутствующие на фигуре
  const slots = [];         // по-имплантный список для визуала: {name, kind, cat, side}

  const pick = (imp, base) => {
    let side = imp.side;
    if (side !== "left" && side !== "right") {
      if (base === "arm") { side = armAuto; armAuto = armAuto === "right" ? "left" : "right"; }
      else if (base === "leg") { side = legAuto; legAuto = legAuto === "right" ? "left" : "right"; }
      else { side = eyeAuto; eyeAuto = eyeAuto === "right" ? "left" : "right"; }
    }
    return side;
  };

  for (const imp of implants) {
    const c = classifyImplant(imp.name, imp.installed, imp.category) || { kind: "other" };
    const cat = imp.category || "cybernetic";
    let locus = "", side = null;
    switch (c.kind) {
      case "fullbody":
        for (const r of Object.keys(regions)) if (regions[r] === "flesh") regions[r] = cat;
        overlays.armored = true; locus = "всё тело"; break;
      // Фигура нарисована анфас (лицом к зрителю, см. respiratorGlyph — маска
      // ложится на видимое лицо) — анатомическая сторона персонажа зеркальна
      // экранной: его правая рука приходится на ЛЕВУЮ половину полотна.
      // `anat` — для текста подсказки (говорит правду про персонажа), `side` —
      // экранный регион/ключ рендера (armL/armR и т.д.), зеркальный к `anat`.
      case "arm": { const anat = pick(imp, "arm"); side = anat === "right" ? "left" : "right"; const reg = side === "right" ? "armR" : "armL"; regions[reg] = cat; locus = anat === "right" ? "прав. рука" : "лев. рука"; break; }
      case "leg": { const anat = pick(imp, "leg"); side = anat === "right" ? "left" : "right"; const reg = side === "right" ? "legR" : "legL"; regions[reg] = cat; locus = anat === "right" ? "прав. нога" : "лев. нога"; break; }
      case "eye": { const anat = pick(imp, "eye"); side = anat === "right" ? "left" : "right"; if (side === "right") overlays.eyeR = cat; else overlays.eyeL = cat; locus = anat === "right" ? "прав. глаз" : "лев. глаз"; break; }
      case "cranial": overlays.cranial = cat; locus = "череп"; break;
      case "heart":   overlays.heart = cat;   locus = "сердце"; break;
      case "lung":       overlays.lungs = cat;      locus = "лёгкие"; break;
      case "respirator": overlays.respirator = cat; locus = "дыхание"; break;
      case "torso":    if (regions.torso === "flesh") regions.torso = cat; locus = "торс"; break;
      case "skeleton": overlays.skeleton = cat; locus = "скелет"; break;
      case "skin":     overlays.skin = cat;     locus = "кожа";   break;
      case "mechadendrite": mechadendrites++; overlays.spine = true; locus = "механодендрит"; break;
      default: locus = "прочее"; break;   // «Прочее» — свой глиф на торсе
    }
    if (locus) { placed.set(imp.name, { locus, cat }); cats.add(cat); slots.push({ name: imp.name, kind: c.kind, cat, side }); }
  }
  mechadendrites = Math.min(mechadendrites, 4);
  return { regions, overlays, mechadendrites, extraArms, placed, cats: [...cats], slots };
}

// ════════════════════════════════════════════════════════════════════════
//  ВИЗУАЛ ИМПЛАНТОВ (SVG-оверлей поверх PNG-тела; viewBox 0 0 500 800)
//  Координаты — из bbox PNG-деталей (÷10 от холста 5000×8000).
// ════════════════════════════════════════════════════════════════════════
// Осевые линии конечностей (замерены из PNG: середина контура по высоте).
// path — точки для гладкой кривой; nodes — [x,y,r] суставов.
// Осевые линии конечностей сняты с PNG-масок (центроид непрозрачных пикселей
// по строкам). У женской фигуры руки прижаты, а ноги идут почти вертикально —
// мужские координаты на ней промахивались мимо силуэта.
// Контуры конечностей, обведённые по PNG-маскам (построчный обвод +
// упрощение Дугласа-Пекера). Координаты сразу в системе viewBox 500x800.
const LIMB_OUTLINE = {
  male: {
    armL: "M191 159 L171 167 L160 178 L154 191 L151 208 L130 241 L106 266 L84 309 L73 324 L67 329 L28 341 L35 348 L49 349 L51 352 L39 376 L39 384 L50 386 L51 391 L65 391 L68 386 L77 383 L79 365 L91 338 L152 269 L178 234 L185 217 L147 215 L153 207 L156 189 L165 174 L176 166 L193 161 L193 159 Z",
    armR: "M306 159 L306 161 L323 166 L334 174 L343 189 L346 207 L352 215 L314 217 L321 234 L347 269 L408 338 L420 365 L422 383 L431 386 L434 391 L448 391 L449 386 L460 384 L459 373 L448 352 L450 349 L464 348 L471 341 L432 329 L426 324 L415 309 L393 266 L369 241 L348 208 L345 191 L339 178 L328 167 L308 159 Z",
    legL: "M186 329 L171 369 L164 407 L165 480 L162 507 L154 529 L151 551 L157 615 L156 644 L130 692 L133 707 L140 714 L155 720 L157 720 L164 714 L171 698 L174 676 L183 647 L184 614 L198 566 L200 527 L214 492 L230 429 L239 410 L246 383 L246 377 L171 376 L181 341 L187 329 Z",
    legR: "M312 329 L318 341 L328 376 L253 377 L253 383 L260 410 L269 429 L285 492 L299 527 L301 566 L315 614 L316 647 L325 676 L328 698 L335 714 L342 720 L344 720 L359 714 L366 707 L369 692 L343 644 L342 615 L348 551 L346 533 L337 507 L334 480 L335 407 L328 369 L313 329 Z",
  },
  female: {
    armL: "M202 159 L190 165 L176 183 L164 234 L145 274 L131 315 L115 348 L101 362 L97 370 L95 382 L98 390 L97 398 L101 406 L103 406 L106 400 L115 399 L125 392 L133 365 L133 354 L175 290 L180 270 L193 244 L200 217 L170 216 L173 195 L178 181 L186 170 L204 159 Z",
    armR: "M295 159 L313 170 L321 181 L326 195 L329 216 L299 217 L306 244 L319 270 L324 290 L366 354 L366 365 L374 392 L384 399 L393 400 L396 406 L398 406 L402 398 L401 390 L404 382 L402 370 L398 362 L384 348 L368 315 L354 274 L335 234 L323 183 L309 165 L297 159 Z",
    legL: "M188 319 L181 341 L178 365 L184 404 L195 437 L204 479 L204 507 L198 530 L199 558 L211 620 L232 621 L232 624 L212 625 L214 660 L211 666 L211 709 L217 727 L229 735 L236 735 L244 731 L244 709 L239 692 L212 690 L239 689 L233 613 L234 553 L242 509 L244 376 L180 375 L180 352 L188 319 Z",
    legR: "M311 319 L319 352 L319 375 L255 376 L257 509 L265 553 L266 613 L260 689 L287 690 L260 692 L255 709 L255 731 L263 735 L270 735 L282 727 L288 709 L288 666 L285 660 L287 625 L267 624 L267 621 L288 620 L300 558 L301 530 L295 507 L295 479 L300 452 L315 404 L321 365 L318 341 L311 319 Z",
  },
};

const LIMB_BY_BODY = {
  // Ось = середина строки маски. Прежний «проход вдоль конечности» уходил на
  // кромку силуэта (замер показал смещение −20 у руки), и кости ложились по
  // контуру вместо кости. Середина строки внутри конечности по построению.
  // Ось доводится до запястья/лодыжки; кисть и стопа заданы отдельно.
  male: {
    armL: { path: [[192,160],[155,192],[160,226],[136,259],[112,292],[87,326],[65,358]], hand: [34, 44, -14] },
    armR: { path: [[308,160],[345,192],[340,226],[364,259],[388,292],[413,326],[435,358]], hand: [34, 44, -14] },
    legL: { path: [[187,328],[207,384],[196,440],[188,496],[176,553],[171,609],[161,665]], hand: [50, 44, 6] },
    legR: { path: [[313,328],[293,384],[304,440],[312,496],[324,553],[329,609],[339,665]], hand: [50, 44, 6] }
  },
  female: {
    armL: { path: [[205,159],[174,194],[182,230],[166,265],[153,300],[134,336],[114,371]], hand: [32, 36, -13] },
    armR: { path: [[295,159],[326,194],[318,230],[334,265],[347,300],[366,336],[386,371]], hand: [32, 36, -13] },
    legL: { path: [[188,318],[212,378],[220,438],[223,498],[217,558],[222,618],[225,677]], hand: [54, 38, -1] },
    legR: { path: [[312,318],[288,378],[280,438],[277,498],[283,558],[278,618],[275,677]], hand: [54, 38, -1] }
  }
};
// Индексы сочленений вдоль пути — одинаковы для рук и ног.
const JOINTS = { root: 0, mid: 3, low: 5, tip: 6 };

// Якоря органов — центры соответствующих PNG-масок.
const ORGANS_BY_BODY = {
  male:   { heart: [283, 204], lungsTop: 176, lungsBase: 294, lungHalf: 52,
            brainTop: 56, brainBase: 92, spineTop: 118, spineBase: 300 },
  female: { heart: [276, 196], lungsTop: 172, lungsBase: 262, lungHalf: 41,
            brainTop: 56, brainBase: 92, spineTop: 116, spineBase: 292 }
};

// «Другое» использует мужской комплект — отдельной графики под него нет.
const bodyKey = (t) => (t === "female" ? "female" : "male");
const limbsOf  = (t) => LIMB_BY_BODY[bodyKey(t)];
const outlineOf = (t, k) => LIMB_OUTLINE[bodyKey(t)][k] || "";
const organsOf = (t) => ORGANS_BY_BODY[bodyKey(t)];

const P = (x, y) => `${x} ${y}`;
// Гладкая кривая через точки (Catmull-Rom → cubic bezier).
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${P(pts[0][0], pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${P(p2[0], p2[1])}`;
  }
  return d;
}
// Мелкие глифы --------------------------------------------------------------
function joint(x, y, r) {
  return `<circle class="imp-ring" cx="${x}" cy="${y}" r="${r}"/>`
       + `<circle class="imp-core" cx="${x}" cy="${y}" r="${(r * 0.42).toFixed(1)}"/>`;
}
function tick(x1, y1, x2, y2) { return `<line class="imp-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
function hexPath(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    d += (i ? "L" : "M") + P((cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1));
  }
  return d + "Z";
}
// Тики поперёк кривой (перпендикуляр к касательной в точках пути).
function limbTicks(pts) {
  let t = "";
  for (const i of [1, 3, 5]) {
    if (i <= 0 || i >= pts.length - 1) continue;
    const [x, y] = pts[i], [px, py] = pts[i - 1], [nx2, ny2] = pts[i + 1];
    const dx = nx2 - px, dy = ny2 - py, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * 5, ny = dx / len * 5;
    t += tick((x - nx).toFixed(1), (y - ny).toFixed(1), (x + nx).toFixed(1), (y + ny).toFixed(1));
  }
  return t;
}

// Кибер-конечность: гибкая «спина» по оси + узлы суставов + тики-плитки.
// ── Геометрия вдоль конечности ─────────────────────────────────────────────

// Точка и локальный базис на ломаной: t от 0 (плечо) до 1 (кисть).
function _at(P, t) {
  const fi = Math.max(0, Math.min(1, t)) * (P.length - 1);
  const i0 = Math.floor(fi), i1 = Math.min(P.length - 1, i0 + 1), f = fi - i0;
  const x = P[i0][0] + (P[i1][0] - P[i0][0]) * f;
  const y = P[i0][1] + (P[i1][1] - P[i0][1]) * f;
  const a = P[Math.max(0, i0 - 1)], b = P[Math.min(P.length - 1, i1 + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return { x, y, ux: dx / L, uy: dy / L, nx: -dy / L, ny: dx / L };
}
// Смещение от точки оси: along — вдоль, side — поперёк.
const _off = (q, along, side) =>
  [(q.x + q.ux * along + q.nx * side), (q.y + q.uy * along + q.ny * side)];
const _f = (v) => v.toFixed(1);
const _P = (q, a, o) => { const [x, y] = _off(q, a, o); return `${_f(x)} ${_f(y)}`; };

// Полосы брони рисуем заведомо ШИРЕ конечности, а точную форму по силуэту даёт
// clipPath. Так каждая полоса ровно повторяет сечение руки или ноги — подгонять
// ширину вручную под бедро и лодыжку одновременно всё равно невозможно.
const _BAND = 46;

/** Полоса брони поперёк оси: t0..t1 вдоль конечности. */
function limbBand(P, t0, t1) {
  const q0 = _at(P, t0), q1 = _at(P, t1);
  return `M${_P(q0, 0, _BAND)} L${_P(q1, 0, _BAND)} L${_P(q1, 0, -_BAND)} L${_P(q0, 0, -_BAND)} Z`;
}

/** Привод сустава: шестигранный корпус, кольцо оси, ядро и болты. */
function limbActuator(P, t, r) {
  const q = _at(P, t);
  const hex = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const a = deg * Math.PI / 180;
    const [x, y] = _off(q, Math.cos(a) * r, Math.sin(a) * r);
    return `${i ? "L" : "M"}${_f(x)} ${_f(y)}`;
  }).join(" ") + " Z";
  const bolts = [30, 150, 270].map(deg => {
    const a = deg * Math.PI / 180;
    const [x, y] = _off(q, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    return `<circle class="imp-limb-bolt" cx="${_f(x)}" cy="${_f(y)}" r="1.1"/>`;
  }).join("");
  return `<path class="imp-limb-actuator" d="${hex}"/>`
       + `<circle class="imp-joint-ring" cx="${_f(q.x)}" cy="${_f(q.y)}" r="${_f(r + 2.5)}"/>`
       + `<circle class="imp-joint-core" cx="${_f(q.x)}" cy="${_f(q.y)}" r="${_f(r * 0.3)}"/>`
       + bolts;
}

/** Гидравлический цилиндр вдоль сегмента: корпус, шток, проушины. */
function limbPiston(P, t0, t1, side) {
  const q0 = _at(P, t0), q1 = _at(P, t1), qm = _at(P, (t0 + t1) / 2);
  const o0 = 5.5 * side, om = 6.2 * side, o1 = 5.0 * side;
  return `<path class="imp-limb-rod" d="M${_P(q0, 0, o0)} L${_P(q1, 0, o1)}"/>`
       + `<path class="imp-limb-cyl" d="M${_P(q0, 2, o0 - 2.2)} L${_P(qm, 0, om - 2.2)}`
       + ` L${_P(qm, 0, om + 2.2)} L${_P(q0, 2, o0 + 2.2)} Z"/>`
       + `<circle class="imp-limb-bolt" cx="${_f(_off(q1, 0, o1)[0])}" cy="${_f(_off(q1, 0, o1)[1])}" r="1.4"/>`;
}

/** Жгут кабелей: две волнистые линии по «внутренней» стороне. */
function limbCables(P) {
  let d = "";
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = 0.08 + (i / 12) * 0.8;
      const wobble = Math.sin(i * 0.9) * 1.4;
      pts.push(_off(_at(P, t), 0, (3.4 + wobble) * side));
    }
    d += "M" + pts.map(([x, y]) => `${_f(x)} ${_f(y)}`).join(" L") + " ";
  }
  return `<path class="imp-limb-cable" d="${d}"/>`;
}

/** Кисть или стопа: опорная плита с тремя пальцами-захватами. */
function limbTerminal(P) {
  const q = _at(P, 1), w = 7;
  const digits = [-1, 0, 1].map(k =>
    `M${_P(q, 0, k * w * 0.7)} L${_P(q, 7, k * w * 1.15)} L${_P(q, 11, k * w * 0.95)}`).join(" ");
  return `<path class="imp-limb-plate" d="M${_P(q, -3, w)} L${_P(q, 3, w * 0.9)}`
       + ` L${_P(q, 3, -w * 0.9)} L${_P(q, -3, -w)} Z"/>`
       + `<path class="imp-limb-digit" d="${digits}"/>`;
}

let _clipSeq = 0;

/**
 * Бионическая конечность: силуэт обведён по PNG-маске и служит обрезкой, внутри
 * — бронесегменты, гидравлика, жгут кабелей и приводы на сочленениях.
 */
function limbGlyph(limb, color, outline) {
  const P = limb.path;
  const cid = `whLimb${++_clipSeq}`;

  // Одиннадцать полос с зазорами: чередуем две группы, чтобы соседние читались
  // раздельно, а не сливались в одну плиту.
  const N = 12, GAP = 0.022;
  const bands = ["", ""];
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) + GAP * 0.5, t1 = ((i + 1) / N) - GAP * 0.5;
    bands[i % 2] += limbBand(P, t0, t1) + " ";
  }
  const [bandA, bandB] = bands;

  const inner = `<path class="imp-limb-band" d="${bandA}"/>`
    + `<path class="imp-limb-band alt" d="${bandB}"/>`
    + limbCables(P)
    + limbPiston(P, 0.08, 0.42, 1)
    + limbPiston(P, 0.52, 0.84, -1)
    + limbTerminal(P);

  const joints = limbActuator(P, 0.02, 8.5) + limbActuator(P, 0.47, 7.5) + limbActuator(P, 0.86, 6);

  if (!outline) {
    return `<g class="imp-limb imp-pulse" style="color:${color}">${inner}${joints}</g>`;
  }
  return `<g class="imp-limb imp-pulse" style="color:${color}">`
    + `<defs><clipPath id="${cid}"><path d="${outline}"/></clipPath></defs>`
    + `<path class="imp-limb-fill" d="${outline}"/>`
    + `<g clip-path="url(#${cid})">${inner}</g>`
    + `<path class="imp-limb-edge" d="${outline}"/>`
    + joints
    + `</g>`;
}

function heartGlyph(cx, cy, color) {
  const spokes = [0, 60, 120, 180, 240, 300].map(deg => {
    const t = deg * Math.PI / 180;
    return `M${(cx + 3.5 * Math.cos(t)).toFixed(1)} ${(cy + 3.5 * Math.sin(t)).toFixed(1)}`
         + ` L${(cx + 8 * Math.cos(t)).toFixed(1)} ${(cy + 8 * Math.sin(t)).toFixed(1)}`;
  }).join(" ");
  // Корпус вписан в габарит маски (±22 по X, −26…+28 по Y от центра), чтобы
  // не наползать на лёгкие. Аорту рисует vesselsGlyph — здесь её нет.
  return `<g class="imp-organ" style="color:${color}">`
    + `<path class="imp-ring imp-beat" d="M${cx} ${cy - 26} C${cx - 12} ${cy - 27} ${cx - 20} ${cy - 17} ${cx - 19} ${cy - 4}`
    + ` C${cx - 18} ${cy + 11} ${cx - 7} ${cy + 23} ${cx + 1} ${cy + 28}`
    + ` C${cx + 10} ${cy + 20} ${cx + 19} ${cy + 8} ${cx + 19} ${cy - 5}`
    + ` C${cx + 19} ${cy - 18} ${cx + 10} ${cy - 27} ${cx} ${cy - 26} Z"/>`
    + `<circle class="imp-ringpulse" cx="${cx}" cy="${cy}" r="13"/>`
    + `<circle class="imp-ring imp-beat" cx="${cx}" cy="${cy}" r="8.5"/>`
    + `<path class="imp-tick imp-rotor" d="${spokes}"/>`
    + `<circle class="imp-core imp-beat" cx="${cx}" cy="${cy}" r="3"/>`
    + `</g>`;
}
// Лёгкие — доли с междолевыми щелями и бронхиальное дерево.
// Вырез под сердце справа от зрителя, поэтому правая доля короче, а её бронхи
// обрываются выше — иначе они уходили бы под корпус сердца.
function lungsGlyph(color, bodyType) {
  const OG = organsOf(bodyType);
  const T = OG.lungsTop, B = OG.lungsBase, H = OG.lungHalf;
  const alveoli = [[250 - H + 14, B - 42], [250 - H + 22, B - 22], [250 - H + 36, B - 12]]
    .map(([x, y]) => `<circle class="imp-core" cx="${x}" cy="${y}" r="2.2"/>`).join("");
  return `<g class="imp-organ imp-pulse" style="color:${color}">`
    // Левая от зрителя доля — крупная, три сегмента.
    + `<path class="imp-ring" d="M238 ${T + 14} C${250 - H + 16} ${T + 14} ${250 - H + 2} ${T + 34} ${250 - H} ${T + 62} C${250 - H - 2} ${B - 30} ${250 - H + 6} ${B - 8} ${250 - H + 20} ${B - 2}`
    + ` C${250 - H + 34} ${B + 2} 240 ${B - 8} 241 ${B - 24} Z"/>`
    + `<path class="imp-tick" d="M${250 - H + 3} ${T + 56} L239 ${T + 64} M${250 - H + 2} ${B - 34} L240 ${B - 34}"/>`
    // Контур доли со стороны сердца НЕ рисуем: там вырез, и линия ложилась бы
    // прямо под корпус насоса. Силуэт этой доли даёт PNG-маска.
    // Трахея, бифуркация, долевые бронхи.
    + `<path class="imp-spine" d="M250 ${T} L250 ${T + 30} M250 ${T + 30} L228 ${T + 46} M250 ${T + 30} L266 ${T + 38}`
    + ` M228 ${T + 46} L${250 - H + 10} ${T + 70} M228 ${T + 46} L232 ${T + 76}"/>`
    + `<circle class="imp-core" cx="250" cy="${T + 30}" r="3"/>`
    + alveoli
    + `</g>`;
}
// Респиратор — маска на нижнюю часть лица + гортанный модуль вниз по шее.
function respiratorGlyph(cx, color) {
  const my = 116;
  return `<g class="imp-organ imp-pulse" style="color:${color}">`
    // маска (рот/нос)
    + `<path class="imp-ring" d="M${cx - 15} ${my - 7} Q${cx} ${my - 13} ${cx + 15} ${my - 7} L${cx + 13} ${my + 9} Q${cx} ${my + 14} ${cx - 13} ${my + 9} Z"/>`
    + `<circle class="imp-core" cx="${cx - 10}" cy="${my + 1}" r="3"/><circle class="imp-core" cx="${cx + 10}" cy="${my + 1}" r="3"/>`
    + `<path class="imp-tick" d="M${cx - 3} ${my - 2} L${cx - 3} ${my + 6} M${cx} ${my - 3} L${cx} ${my + 7} M${cx + 3} ${my - 2} L${cx + 3} ${my + 6}"/>`
    // ремешки к ушам
    + `<path class="imp-tick" d="M${cx - 15} ${my - 4} L${cx - 22} ${my - 7} M${cx + 15} ${my - 4} L${cx + 22} ${my - 7}"/>`
    // гортанный модуль (замена гортани) — сегментированная трубка по шее
    + `<rect class="imp-ring" x="${cx - 8}" y="${my + 15}" width="16" height="34" rx="4"/>`
    + `<path class="imp-tick" d="M${cx - 8} ${my + 23} L${cx + 8} ${my + 23} M${cx - 8} ${my + 32} L${cx + 8} ${my + 32} M${cx - 8} ${my + 41} L${cx + 8} ${my + 41}"/>`
    + `<circle class="imp-core" cx="${cx}" cy="${my + 27}" r="2.6"/><circle class="imp-core" cx="${cx}" cy="${my + 37}" r="2.6"/>`
    + `</g>`;
}
function brainGlyph(color, bodyType) {
  const OG = organsOf(bodyType);
  const CXH = 250, top = OG.brainTop, base = OG.brainBase;
  return `<g class="imp-organ imp-pulse" style="color:${color}">`
    // Полушария.
    + `<path class="imp-ring" d="M${CXH} ${top} C${CXH - 20} ${top} ${CXH - 27} ${top + 12} ${CXH - 26} ${top + 26}`
    + ` C${CXH - 25} ${base - 62 + 60} ${CXH - 14} ${base} ${CXH} ${base}`
    + ` C${CXH + 14} ${base} ${CXH + 25} ${base - 2} ${CXH + 26} ${top + 26}`
    + ` C${CXH + 27} ${top + 12} ${CXH + 20} ${top} ${CXH} ${top} Z"/>`
    // Продольная щель и борозды коры.
    + `<path class="imp-tick" d="M${CXH} ${top} L${CXH} ${base}`
    + ` M${CXH - 22} ${top + 14} Q${CXH - 12} ${top + 21} ${CXH - 4} ${top + 14}`
    + ` M${CXH + 22} ${top + 14} Q${CXH + 12} ${top + 21} ${CXH + 4} ${top + 14}`
    + ` M${CXH - 24} ${top + 30} Q${CXH - 13} ${top + 38} ${CXH - 4} ${top + 29}`
    + ` M${CXH + 24} ${top + 30} Q${CXH + 13} ${top + 38} ${CXH + 4} ${top + 29}"/>`
    // Венец интерфейса и порты — это кибернетика, а не голый мозг.
    + `<path class="imp-spine" d="M${CXH - 26} ${top + 24} Q${CXH} ${top - 3} ${CXH + 26} ${top + 24}"/>`
    + `<circle class="imp-core" cx="${CXH - 26}" cy="${top + 24}" r="3"/>`
    + `<circle class="imp-core" cx="${CXH + 26}" cy="${top + 24}" r="3"/>`
    + `<circle class="imp-core" cx="${CXH}" cy="${top - 1}" r="2.6"/>`
    // Ствол к позвоночнику.
    + `<path class="imp-spine" d="M${CXH} ${base} L${CXH} ${base + 14}"/>`
    + `</g>`;
}
function eyeGlyph(cx, cy, color) {
  const b = 7;
  return `<g class="imp-eye imp-pulse" style="color:${color}">`
    // Диафрагма: три кольца и ядро.
    + `<circle class="imp-ring" cx="${cx}" cy="${cy}" r="5.6"/>`
    + `<circle class="imp-tick" cx="${cx}" cy="${cy}" r="3.4"/>`
    + `<circle class="imp-core" cx="${cx}" cy="${cy}" r="1.5"/>`
    // Лепестки диафрагмы.
    + `<path class="imp-tick" d="${[45, 135, 225, 315].map(deg => {
        const t = deg * Math.PI / 180;
        return `M${(cx + 3.4 * Math.cos(t)).toFixed(1)} ${(cy + 3.4 * Math.sin(t)).toFixed(1)}`
             + ` L${(cx + 5.6 * Math.cos(t)).toFixed(1)} ${(cy + 5.6 * Math.sin(t)).toFixed(1)}`;
      }).join(" ")}"/>`
    // Уголки рамки прицела.
    + `<path class="imp-tick" d="M${cx - b} ${cy - b + 2} L${cx - b} ${cy - b} L${cx - b + 2} ${cy - b}`
    + ` M${cx + b - 2} ${cy - b} L${cx + b} ${cy - b} L${cx + b} ${cy - b + 2}`
    + ` M${cx - b} ${cy + b - 2} L${cx - b} ${cy + b} L${cx - b + 2} ${cy + b}`
    + ` M${cx + b - 2} ${cy + b} L${cx + b} ${cy + b} L${cx + b} ${cy + b - 2}"/>`
    + `</g>`;
}
// ── Механодендриты ─────────────────────────────────────────────────────────

// Точка и касательная на кубической кривой Безье — по ним ставим сегменты.
function _bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0];
  const y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1];
  const dx = 3*u*u*(p1[0]-p0[0]) + 6*u*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0]);
  const dy = 3*u*u*(p1[1]-p0[1]) + 6*u*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1]);
  const L = Math.hypot(dx, dy) || 1;
  return { x, y, ux: dx/L, uy: dy/L, nx: -dy/L, ny: dx/L };
}

/**
 * Наконечник: трёхпалая клешня с изогнутыми когтями или инструментальная
 * головка с буром и эмиттером.
 */
function mechTip(pt, kind) {
  const { x, y, ux, uy, nx, ny } = pt;
  const P = (a, b) => `${(x + ux*a + nx*b).toFixed(1)} ${(y + uy*a + ny*b).toFixed(1)}`;
  if (kind === "claw") {
    // Три когтя: два в стороны, один прямо; все с загибом на конце.
    const talon = (side) => `M${P(2, 3*side)} Q${P(11, 8*side)} ${P(17, 4*side)}`;
    return `<g class="imp-mech-tip">`
      + `<path class="imp-mech-claw" d="${talon(1)} ${talon(-1)} M${P(3,0)} Q${P(13,0)} ${P(19,0)}"/>`
      + `<path class="imp-mech-knuckle" d="M${P(-3,5)} L${P(3,4)} L${P(3,-4)} L${P(-3,-5)} Z"/>`
      + `<circle class="imp-mech-core" cx="${(x + ux*-1).toFixed(1)}" cy="${(y + uy*-1).toFixed(1)}" r="2.4"/></g>`;
  }
  // Инструмент: конический бур с витком и эмиттер у основания.
  return `<g class="imp-mech-tip">`
    + `<path class="imp-mech-knuckle" d="M${P(-4,5)} L${P(2,4)} L${P(2,-4)} L${P(-4,-5)} Z"/>`
    + `<path class="imp-mech-claw" d="M${P(2,4)} L${P(16,0)} L${P(2,-4)}"/>`
    + `<path class="imp-mech-thread" d="M${P(5,3)} L${P(7,-2.5)} M${P(9,2)} L${P(11,-1.5)}"/>`
    + `<circle class="imp-mech-core" cx="${(x + ux*-2).toFixed(1)}" cy="${(y + uy*-2).toFixed(1)}" r="2.6"/></g>`;
}

/**
 * Механодендрит: несущий трос, нанизанные бронесегменты (трапеции, сужающиеся
 * к концу) и приводные кольца между ними. Крепление — на хребте за спиной.
 */
function mechArm(c0, c1, c2, c3, kind, idx) {
  const SEG = 9;
  let plates = "", rings = "";
  for (let i = 1; i <= SEG; i++) {
    const t = i / (SEG + 1);
    const b = _bezier(c0, c1, c2, c3, t);
    // Сегмент сужается к наконечнику: ближе к базе — шире.
    const w  = 6.4 - t * 3.4, l = 4.2 - t * 1.6;
    const P = (a, o) => `${(b.x + b.ux*a + b.nx*o).toFixed(1)} ${(b.y + b.uy*a + b.ny*o).toFixed(1)}`;
    plates += `M${P(-l, w)} L${P(l, w*0.82)} L${P(l, -w*0.82)} L${P(-l, -w)} Z `;
    if (i % 3 === 0) rings += `<circle class="imp-mech-ring" cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${(w*0.9).toFixed(1)}"/>`;
  }
  const tip = _bezier(c0, c1, c2, c3, 1);
  const d = `M${c0[0]} ${c0[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c3[0]} ${c3[1]}`;
  return `<g class="imp-mech-arm" style="--sway:${idx % 2 ? 1 : -1};`
    + ` --mech-delay:${(idx * 0.55).toFixed(2)}s; transform-origin:${c0[0]}px ${c0[1]}px">`
    + `<path class="imp-mech-cable" d="${d}"/>`
    + `<path class="imp-mech-plate" d="${plates}"/>`
    + rings
    + mechTip(tip, kind)
    + `</g>`;
}

function mechGlyph(n) {
  const OX = 250, OY = 196;   // крепление на хребте, за телом
  // Пары разведены по высоте: верхние идут через плечи, нижние — под руками.
  const arms = [
    { c: [[250,192],[300,150],[352,126],[392,146]], kind: "claw" },
    { c: [[250,192],[200,150],[148,126],[108,146]], kind: "claw" },
    { c: [[250,202],[306,214],[356,236],[398,252]], kind: "tool" },
    { c: [[250,202],[194,214],[144,236],[102,252]], kind: "tool" }
  ];
  let out = `<g class="imp-mech" style="color:#ff9a3c">`;
  // База: бронированный порт с крепёжными болтами.
  out += `<circle class="imp-mech-ring" cx="${OX}" cy="${OY}" r="9"/>`
       + `<path class="imp-mech-plate" d="M${OX-7} ${OY-5} L${OX+7} ${OY-5} L${OX+5} ${OY+6} L${OX-5} ${OY+6} Z"/>`
       + [[-6,-6],[6,-6],[-6,6],[6,6]].map(([dx,dy]) =>
           `<circle class="imp-mech-core" cx="${OX+dx}" cy="${OY+dy}" r="1.5"/>`).join("")
       + `<circle class="imp-mech-core" cx="${OX}" cy="${OY}" r="3"/>`;
  for (let i = 0; i < Math.min(n, arms.length); i++) {
    const a = arms[i];
    out += mechArm(a.c[0], a.c[1], a.c[2], a.c[3], a.kind, i);
  }
  return out + `</g>`;
}

// ── Под-имплантные адд-он глифы (специфичный вид у некоторых имплантов) ──────
function gFist(x, y, color) {
  return `<g class="imp-addon imp-pulse" style="color:${color}"><rect class="imp-ring" x="${x - 7}" y="${y - 5}" width="14" height="12" rx="2"/>`
    + `<path class="imp-tick" d="M${x - 4} ${y - 5} v-3 M${x - 1} ${y - 5} v-3 M${x + 2} ${y - 5} v-3 M${x + 5} ${y - 5} v-3"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y + 1}" r="2"/></g>`;
}
function gClaws(x, y, color) {
  let d = "";
  for (const dx of [-6, -2, 2, 6]) d += `M${x + dx} ${y - 2} L${(x + dx * 1.5).toFixed(1)} ${y + 14} `;
  return `<g class="imp-addon imp-pulse" style="color:${color}"><path class="imp-blade" d="${d}"/></g>`;
}
function gGun(x, y, side, color) {
  const dir = side === "right" ? 1 : -1;
  return `<g class="imp-addon imp-pulse" style="color:${color}"><rect class="imp-ring" x="${x - 4}" y="${y - 4}" width="8" height="11" rx="1"/>`
    + `<path class="imp-mech-spine" d="M${x} ${y + 7} L${x + dir * 3} ${y + 22}"/><circle class="imp-core" cx="${x}" cy="${y + 1}" r="1.8"/></g>`;
}
function gStylus(x, y, color) {
  return `<g class="imp-addon imp-pulse" style="color:${color}"><path class="imp-blade" d="M${x} ${y - 2} L${x} ${y + 16}"/><circle class="imp-core" cx="${x}" cy="${y + 16}" r="1.6"/></g>`;
}
function gTreads(x, y, color) {
  return `<g class="imp-addon imp-pulse" style="color:${color}"><rect class="imp-ring" x="${x - 10}" y="${y - 4}" width="20" height="10" rx="4"/>`
    + `<circle class="imp-core" cx="${x - 5}" cy="${y + 1}" r="2"/><circle class="imp-core" cx="${x + 5}" cy="${y + 1}" r="2"/></g>`;
}
// Библиотека адд-онов: {re, kinds, fn(ctx)}. ctx={name,side,color,anchor}.
const ADDON_LIB = [
  { re: /iron fist|железн\w* кулак/i,                 kinds: ["arm"], fn: c => gFist(c.anchor[0], c.anchor[1], c.color) },
  { re: /blade tine|когт.?-?лезв|neural tine|нейральн\w* когт/i, kinds: ["arm"], fn: c => gClaws(c.anchor[0], c.anchor[1], c.color) },
  { re: /рука-?оружие|weapon\)|weapon arm|встроен\w* оруж|интегрир\w* оруж/i, kinds: ["arm"], fn: c => gGun(c.anchor[0], c.anchor[1], c.side, c.color) },
  { re: /weapon brace|оружейн\w* зажим/i,             kinds: ["arm"], fn: c => gGun(c.anchor[0], c.anchor[1], c.side, c.color) },
  { re: /scribe|писар/i,                              kinds: ["arm"], fn: c => gStylus(c.anchor[0], c.anchor[1], c.color) },
  { re: /tracked|гусениц/i,                           kinds: ["leg"], fn: c => gTreads(c.anchor[0], c.anchor[1], c.color) },
  { re: /talon|коготь птер|птераксии|blade|лезв/i,    kinds: ["leg"], fn: c => gClaws(c.anchor[0], c.anchor[1], c.color) },
];

/** Слои PNG-фигуры (маска+цвет) для .body-photo. state — из buildBodyState. */
// Пол задаёт набор PNG-масок. «Другое» использует мужской комплект как
// нейтральный — отдельной графики под него нет.
export const BODY_TYPES = { male: "Мужской", female: "Женский", other: "Другое" };
const BODY_DIRS = { male: "sm/", female: "female/sm/", other: "sm/" };
// Расовый набор масок переопределяет пол-набор целиком (шире/уже в плечах/
// руках/ногах, тот же список файлов и та же система координат 500×800 —
// генерируется tools/bulk-race-body.py). AELDARI_RACES — из constants/races.mjs
// (весь блок "Аэльдари" в RACE_GROUPS: azuriane/drukhari/ynnari/halfEldar/
// harlequin/exodite) делит один силуэт, остальные — по одному ключу расы.
const RACE_BODY_DIRS = Object.assign(
  Object.fromEntries(AELDARI_RACES.map(k => [k, "aeldari/"])),
  {
    astartes: "astartes/",
    squat: "squat/",
    ogryn: "ogryn/",
    beastman: "beastman/",
    replicant: "goliath/",   // Голиафы
  }
);
export function bodyDir(bodyType, race) {
  if (race && RACE_BODY_DIRS[race]) return "/systems/warhammer-dbc/assets/body/" + RACE_BODY_DIRS[race];
  return "/systems/warhammer-dbc/assets/body/" + (BODY_DIRS[bodyType] || BODY_DIRS.male);
}

export function buildBodyLayers(state, bodyType = "male", race = "") {
  const R = state.regions, O = state.overlays;
  const FLESH = "#6fe0a8", FLESH_DIM = "#2f8f5e";
  const IMG = bodyDir(bodyType, race);
  const part = (file, key) => ({ mask: IMG + file, key,
    color: R[key] === "flesh" ? FLESH : implantCatColor(R[key]), aug: R[key] !== "flesh" });
  const organ = (file, cat, extra = {}) => ({ mask: IMG + file,
    color: cat ? implantCatColor(cat) : FLESH_DIM, aug: !!cat, organ: true, ...extra });
  const layers = [
    part("left-leg.png", "legL"), part("right-leg.png", "legR"),
    part("left-arm.png", "armL"), part("right-arm.png", "armR"),
    part("body.png", "torso"), part("head.png", "head"),
    organ("lungs.png", O.lungs), organ("heart.png", O.heart, { beat: true }),
  ];
  if (O.cranial) layers.push(organ("brain.png", O.cranial));
  return layers;
}

// Скелетные импланты — «кости» по телу (череп, позвоночник, рёбра, таз, кости конечностей).
function skeletonGlyph(color, bodyType) {
  const LIMB = limbsOf(bodyType), OG = organsOf(bodyType);
  const X = 250;
  let g = `<g class="imp-skel imp-pulse" style="color:${color}">`;

  // ── Череп: свод, глазницы, носовое отверстие, скуловые дуги, челюсть ──
  g += `<path class="imp-bone-f" d="M${X} 58 C${X - 21} 58 ${X - 27} 74 ${X - 26} 90`
     + ` C${X - 25} 104 ${X - 17} 112 ${X - 9} 114 L${X + 9} 114`
     + ` C${X + 17} 112 ${X + 25} 104 ${X + 26} 90 C${X + 27} 74 ${X + 21} 58 ${X} 58 Z"/>`;
  g += `<ellipse class="imp-bone-void" cx="${X - 10}" cy="88" rx="6.5" ry="7"/>`
     + `<ellipse class="imp-bone-void" cx="${X + 10}" cy="88" rx="6.5" ry="7"/>`
     + `<path class="imp-bone-void" d="M${X} 96 L${X - 4} 104 L${X + 4} 104 Z"/>`;
  g += `<path class="imp-bone" d="M${X - 24} 92 L${X - 15} 96 M${X + 24} 92 L${X + 15} 96"/>`;
  // Нижняя челюсть с рядом зубов.
  g += `<path class="imp-bone-f" d="M${X - 16} 110 C${X - 16} 124 ${X - 8} 130 ${X} 130`
     + ` C${X + 8} 130 ${X + 16} 124 ${X + 16} 110 L${X + 11} 110`
     + ` C${X + 11} 122 ${X + 5} 125 ${X} 125 C${X - 5} 125 ${X - 11} 122 ${X - 11} 110 Z"/>`;

  // ── Позвоночник: шейный, грудной, поясничный ──
  const VERT = [];
  for (let i = 0; i < 7; i++)  VERT.push([134 + i * 4.5, 3.4]);          // шейные
  for (let i = 0; i < 12; i++) VERT.push([168 + i * 6.2, 4.6]);          // грудные
  for (let i = 0; i < 5; i++)  VERT.push([245 + i * 7.4, 5.6]);          // поясничные
  for (const [y, w] of VERT) {
    g += `<rect class="imp-bone-f" x="${(X - w).toFixed(1)}" y="${(y - 2.4).toFixed(1)}"`
       + ` width="${(w * 2).toFixed(1)}" height="4.4" rx="1.6"/>`
       + `<path class="imp-bone" d="M${(X - w).toFixed(1)} ${y} l-3.4 -1 M${(X + w).toFixed(1)} ${y} l3.4 -1"/>`;
  }

  // ── Ключицы и лопатки ──
  g += `<path class="imp-bone" d="M${X - 5} 150 Q${X - 24} 143 ${X - 44} 152`
     + ` M${X + 5} 150 Q${X + 24} 143 ${X + 44} 152"/>`;
  for (const sd of [-1, 1]) {
    g += `<path class="imp-bone-f" d="M${X + sd * 30} 154 Q${X + sd * 46} 160 ${X + sd * 42} 182`
       + ` Q${X + sd * 34} 186 ${X + sd * 26} 172 Z"/>`;
  }

  // ── Грудина и рёбра: 12 пар, сужаются книзу ──
  g += `<path class="imp-bone-f" d="M${X - 4} 156 L${X + 4} 156 L${X + 3} 214 L${X} 222 L${X - 3} 214 Z"/>`;
  for (let i = 0; i < 12; i++) {
    const y = 170 + i * 6.2;
    const w = i < 7 ? 29 + i * 2.9 : 49 - (i - 7) * 5.6;      // максимум на 7-й паре
    const drop = 10 + i * 1.6;
    const front = i < 7 ? 6 : 0;                              // ложные рёбра не доходят до грудины
    for (const sd of [-1, 1]) {
      g += `<path class="imp-bone" d="M${(X + sd * 5).toFixed(1)} ${y}`
         + ` Q${(X + sd * w * 0.72).toFixed(1)} ${(y + 1).toFixed(1)}`
         + ` ${(X + sd * w).toFixed(1)} ${(y + drop * 0.55).toFixed(1)}`
         + ` Q${(X + sd * w * 1.02).toFixed(1)} ${(y + drop).toFixed(1)}`
         + ` ${(X + sd * (w - front)).toFixed(1)} ${(y + drop + 8).toFixed(1)}"/>`;
    }
  }

  // ── Таз: крылья подвздошных костей, крестец, седалищные ──
  g += `<path class="imp-bone-f" d="M${X - 6} 300 C${X - 30} 302 ${X - 40} 316 ${X - 36} 316`
     + ` C${X - 33} 344 ${X - 20} 350 ${X - 12} 346 L${X - 6} 322 Z"/>`
     + `<path class="imp-bone-f" d="M${X + 6} 300 C${X + 30} 302 ${X + 40} 316 ${X + 36} 316`
     + ` C${X + 33} 344 ${X + 20} 350 ${X + 12} 346 L${X + 6} 322 Z"/>`
     + `<path class="imp-bone-f" d="M${X - 7} 304 L${X + 7} 304 L${X + 5} 332 L${X} 338 L${X - 5} 332 Z"/>`
     + `<path class="imp-bone" d="M${X - 12} 346 Q${X} 360 ${X + 12} 346"/>`
     // Запирательные отверстия — без них таз выглядел сплошной заливкой.
     + `<ellipse class="imp-bone-void" cx="${X - 17}" cy="316" rx="7" ry="9"/>`
     + `<ellipse class="imp-bone-void" cx="${X + 17}" cy="316" rx="7" ry="9"/>`;

  // ── Кости конечностей по осям масок ──
  for (const k of ["armL", "armR", "legL", "legR"]) {
    const pp = LIMB[k].path;
    const head = _at(pp, 0.12), mid = _at(pp, 0.47), low = _at(pp, 0.86);
    // Проксимальная кость (плечевая / бедренная) с утолщениями на концах.
    // Длинную кость начинаем ниже точки крепления — там она уже полной ширины.
    g += `<path class="imp-bone-th" d="${smoothPath(pp.slice(1, JOINTS.mid + 1))}"/>`;
    // Дистально пара: лучевая с локтевой, большая с малой берцовой.
    const dist = pp.slice(JOINTS.mid, JOINTS.low + 1);
    for (const sd of [-1, 1]) {
      const off = dist.map((_, i) => _off(_at(dist, i / (dist.length - 1)), 0, 3 * sd));
      g += `<path class="imp-bone" d="${smoothPath(off)}"/>`;
    }
    // Кисти и стопы на скелете не рисуем: мелкие фаланги на этом масштабе
    // читались щетиной и спорили с остальными имплантами.
    // Эпифизы на сочленениях.
    for (const q of [head, mid, low]) {
      g += `<ellipse class="imp-bone-f" cx="${_f(q.x)}" cy="${_f(q.y)}"`
         + ` rx="4.6" ry="3.4" transform="rotate(${(Math.atan2(q.uy, q.ux) * 180 / Math.PI).toFixed(0)} ${_f(q.x)} ${_f(q.y)})"/>`;
    }
  }
  return g + `</g>`;
}

// Кровеносная система — разветвлённая сеть сосудов (по осям, внутри контура → без перекрытия).
function vesselsGlyph(color, bodyType) {
  const LIMB = limbsOf(bodyType), OG = organsOf(bodyType);
  let g = `<g class="imp-vessel imp-pulse" style="color:${color}">`;
  // аорта + сонная (к голове) + магистраль вниз
  g += `<path class="imp-vein" d="M${OG.heart[0]} ${OG.heart[1] - 24} C${OG.heart[0] - 5} ${OG.heart[1] - 36} 258 164 250 156 M250 156 L250 118 M250 156 L250 300"/>`;
  // магистрали по конечностям + форк-ветви вдоль
  for (const k of ["armL", "armR", "legL", "legR"]) {
    const p = LIMB[k].path;
    g += `<path class="imp-vein" d="${smoothPath(p)}"/>`;
    let forks = "";
    for (let i = 1; i < p.length - 1; i += 2) {
      const [x, y] = p[i], [px, py] = p[i - 1], [nx, ny] = p[i + 1];
      const dx = nx - px, dy = ny - py, len = Math.hypot(dx, dy) || 1, ox = -dy / len * 6, oy = dx / len * 6;
      forks += `M${x} ${y} l${ox.toFixed(1)} ${oy.toFixed(1)} l${(dx / len * 5).toFixed(1)} ${(dy / len * 5).toFixed(1)}`
             + `M${x} ${y} l${(-ox).toFixed(1)} ${(-oy).toFixed(1)} l${(dx / len * 5).toFixed(1)} ${(dy / len * 5).toFixed(1)}`;
    }
    g += `<path class="imp-vein-fine" d="${forks}"/>`;
  }
  // ключицы (к плечам) + капиллярная сеть торса
  g += `<path class="imp-vein" d="M250 158 Q220 160 196 174 M250 158 Q280 160 304 174"/>`;
  let cap = "";
  for (const [x, y] of [[250, 200], [250, 232], [250, 262], [250, 290]])
    cap += `M${x} ${y} l-15 11 l-4 8 M${x} ${y} l15 11 l4 8 M${x} ${y} l-9 -7 M${x} ${y} l9 -7`;
  g += `<path class="imp-vein-fine" d="${cap}"/>`;
  return g + `</g>`;
}

// ── Уникальные глифы «особых» имплантов (в основном «Прочее») ───────────────
function gBattery(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><rect class="imp-ring" x="${x - 6}" y="${y - 8}" width="12" height="16" rx="2"/><rect class="imp-core" x="${x - 2}" y="${y - 10.5}" width="4" height="2.5"/><path class="imp-tick" d="M${x - 3} ${y - 2} h6 M${x - 3} ${y + 2} h6"/></g>`; }
function gMonitor(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><rect class="imp-ring" x="${x - 8}" y="${y - 6}" width="16" height="12" rx="1.5"/><path class="imp-spine" d="M${x - 6} ${y} l2 0 l1.5 -4 l1.5 7 l1.5 -3 l1.5 0 l2 0"/></g>`; }
function gWaves(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><circle class="imp-core" cx="${x - 6}" cy="${y}" r="2"/><path class="imp-ring" d="M${x - 2} ${y - 4} A5 5 0 0 1 ${x - 2} ${y + 4} M${x + 1} ${y - 6} A8 8 0 0 1 ${x + 1} ${y + 6} M${x + 4} ${y - 8} A11 11 0 0 1 ${x + 4} ${y + 8}"/></g>`; }
function gAntenna(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><path class="imp-spine" d="M${x} ${y + 6} L${x} ${y - 6}"/><circle class="imp-core" cx="${x}" cy="${y - 7}" r="2"/><path class="imp-ring" d="M${x - 4} ${y - 9} A6 6 0 0 1 ${x + 4} ${y - 9}"/></g>`; }
function gEmit(x, y, c) { let d = ""; for (const a of [0, 60, 120, 180, 240, 300]) { const r = a * Math.PI / 180; d += `M${(x + Math.cos(r) * 4).toFixed(1)} ${(y + Math.sin(r) * 4).toFixed(1)} L${(x + Math.cos(r) * 9).toFixed(1)} ${(y + Math.sin(r) * 9).toFixed(1)} `; } return `<g class="imp-special imp-pulse" style="color:${c}"><circle class="imp-core" cx="${x}" cy="${y}" r="2.5"/><path class="imp-tick" d="${d}"/></g>`; }
function gModule(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><path class="imp-hex" d="${hexPath(x, y, 7)}"/><circle class="imp-core" cx="${x}" cy="${y}" r="2"/></g>`; }
function gTank(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><rect class="imp-ring" x="${x - 7}" y="${y - 6}" width="14" height="13" rx="2"/><path class="imp-tick" d="M${x - 7} ${y - 1} h14 M${x - 7} ${y + 3} h14"/><circle class="imp-core" cx="${x}" cy="${y - 3}" r="1.6"/></g>`; }
function gStomach(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><path class="imp-ring" d="M${x - 6} ${y - 6} Q${x + 8} ${y - 8} ${x + 7} ${y + 2} Q${x + 6} ${y + 9} ${x - 2} ${y + 7} Q${x - 8} ${y + 5} ${x - 6} ${y - 6} Z"/></g>`; }
function gShield(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><path class="imp-ring" d="M${x} ${y - 8} L${x + 6} ${y - 5} V${y + 2} Q${x + 6} ${y + 7} ${x} ${y + 9} Q${x - 6} ${y + 7} ${x - 6} ${y + 2} V${y - 5} Z"/><path class="imp-tick" d="M${x} ${y - 3} v6 M${x - 3} ${y} h6"/></g>`; }
function gDrop(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><path class="imp-core" d="M${x} ${y - 8} C${x + 6} ${y - 1} ${x + 5} ${y + 7} ${x} ${y + 7} C${x - 5} ${y + 7} ${x - 6} ${y - 1} ${x} ${y - 8} Z"/></g>`; }
function gSocket(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><circle class="imp-ring" cx="${x}" cy="${y}" r="6"/><circle class="imp-core" cx="${x}" cy="${y}" r="2.4"/><path class="imp-tick" d="M${x - 6} ${y} h-3 M${x + 6} ${y} h3 M${x} ${y - 6} v-3 M${x} ${y + 6} v3"/></g>`; }
function gMaskFace(x, y, c) { return `<g class="imp-special imp-pulse" style="color:${c}"><rect class="imp-ring" x="${x - 8}" y="${y - 7}" width="16" height="16" rx="4"/><path class="imp-tick" d="M${x - 8} ${y} h16 M${x} ${y - 7} v16 M${x - 4} ${y - 3.5} h8"/></g>`; }

// ── Дополнительные глифы: каждый имплант должен читаться силуэтом ──────────
// Лёгкое: мех-респиратор с гофрой.
function gBellows(x, y, c) {
  const ribs = [-4, 0, 4].map(d => `M${x - 7} ${y + d} h14`).join(" ");
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<rect class="imp-ring" x="${x - 7}" y="${y - 7}" width="14" height="15" rx="3"/>`
    + `<path class="imp-tick" d="${ribs}"/>`
    + `<path class="imp-spine" d="M${x} ${y - 7} v-4 M${x} ${y + 8} v4"/></g>`;
}
// Печень/фильтр: реторта с каплей.
function gRetort(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-ring" d="M${x - 7} ${y - 7} h14 l-4 7 v7 a3 3 0 0 1 -6 0 v-7 Z"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y + 4}" r="1.8"/></g>`;
}
// Кость/арматура: двутавр.
function gStrut(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-spine" d="M${x} ${y - 8} v16"/>`
    + `<path class="imp-tick" d="M${x - 5} ${y - 8} h10 M${x - 5} ${y + 8} h10"/></g>`;
}
// Нейросеть: узел с расходящимися связями.
function gNeural(x, y, c) {
  const arms = [30, 90, 150, 210, 270, 330].map(a => {
    const t = a * Math.PI / 180;
    return `M${x} ${y} L${(x + 8 * Math.cos(t)).toFixed(1)} ${(y + 8 * Math.sin(t)).toFixed(1)}`;
  }).join(" ");
  const dots = [30, 150, 270].map(a => {
    const t = a * Math.PI / 180;
    return `<circle class="imp-core" cx="${(x + 8 * Math.cos(t)).toFixed(1)}" cy="${(y + 8 * Math.sin(t)).toFixed(1)}" r="1.6"/>`;
  }).join("");
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-tick" d="${arms}"/><circle class="imp-core" cx="${x}" cy="${y}" r="2.6"/>${dots}</g>`;
}
// Броневая пластина: щиток с заклёпками.
function gPlate(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-ring" d="M${x - 8} ${y - 6} q8 -4 16 0 v10 q-8 4 -16 0 Z"/>`
    + `<circle class="imp-core" cx="${x - 4}" cy="${y}" r="1.3"/>`
    + `<circle class="imp-core" cx="${x + 4}" cy="${y}" r="1.3"/></g>`;
}
// Реактор/генератор: кольцо с сердечником и лучами.
function gReactor(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<circle class="imp-ring" cx="${x}" cy="${y}" r="8"/>`
    + `<circle class="imp-ringpulse" cx="${x}" cy="${y}" r="11"/>`
    + `<path class="imp-tick" d="M${x - 8} ${y} h4 M${x + 4} ${y} h4 M${x} ${y - 8} v4 M${x} ${y + 4} v4"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y}" r="3"/></g>`;
}
// Линза/оптика: объектив с диафрагмой.
function gLens(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<circle class="imp-ring" cx="${x}" cy="${y}" r="7"/>`
    + `<circle class="imp-tick" cx="${x}" cy="${y}" r="4"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y}" r="1.6"/></g>`;
}
// Клинок: убирающееся лезвие.
function gBladeSm(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-spine" d="M${x} ${y + 8} L${x} ${y - 4} L${x + 3} ${y - 9} L${x - 3} ${y - 9} L${x} ${y - 4}"/>`
    + `<path class="imp-tick" d="M${x - 5} ${y + 8} h10"/></g>`;
}
// Скрытый отсек: створки с замком.
function gCache(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<rect class="imp-ring" x="${x - 8}" y="${y - 6}" width="16" height="12" rx="2"/>`
    + `<path class="imp-tick" d="M${x} ${y - 6} v12"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y}" r="1.8"/></g>`;
}
// Аугметическая почка/фильтр крови: спираль.
function gCoil(x, y, c) {
  let d = "";
  for (let i = 0; i < 4; i++) d += `M${x - 6} ${y - 6 + i * 4} q6 3 12 0 `;
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-tick" d="${d}"/>`
    + `<path class="imp-spine" d="M${x - 6} ${y - 8} v18 M${x + 6} ${y - 8} v18"/></g>`;
}


// Дыхательный фильтр: картридж с сеткой.
function gFilter(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<rect class="imp-ring" x="${x - 7}" y="${y - 6}" width="14" height="12" rx="2"/>`
    + `<path class="imp-tick" d="M${x - 4} ${y - 6} v12 M${x} ${y - 6} v12 M${x + 4} ${y - 6} v12"/></g>`;
}
// Инъектор: шприц-картридж с иглой.
function gInjector(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<rect class="imp-ring" x="${x - 4}" y="${y - 8}" width="8" height="11" rx="1.5"/>`
    + `<path class="imp-spine" d="M${x} ${y + 3} v6"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y - 3}" r="1.8"/></g>`;
}
// Вокс/динамик: рупор со звуковыми дугами.
function gVox(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-ring" d="M${x - 7} ${y - 3} h4 l5 -5 v16 l-5 -5 h-4 Z"/>`
    + `<path class="imp-tick" d="M${x + 4} ${y - 4} a5 5 0 0 1 0 8 M${x + 7} ${y - 7} a9 9 0 0 1 0 14"/></g>`;
}
// Датчик/ауспик: пеленг-конус с волной.
function gAuspex(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-ring" d="M${x} ${y + 7} L${x - 7} ${y - 5} A9 9 0 0 1 ${x + 7} ${y - 5} Z"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y + 2}" r="1.8"/></g>`;
}
// Память/архив: стопка пластин данных.
function gArchive(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-tick" d="M${x - 7} ${y - 5} h14 M${x - 7} ${y - 1} h14 M${x - 7} ${y + 3} h14"/>`
    + `<rect class="imp-ring" x="${x - 8}" y="${y - 8}" width="16" height="15" rx="2"/></g>`;
}
// Стабилизатор/гироскоп: наклонённые кольца.
function gGyro(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<ellipse class="imp-ring" cx="${x}" cy="${y}" rx="8" ry="3.4"/>`
    + `<ellipse class="imp-ring" cx="${x}" cy="${y}" rx="3.4" ry="8"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y}" r="1.8"/></g>`;
}
// Сердечный/кровяной насос: улитка с патрубком.
function gPump(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-ring" d="M${x + 2} ${y - 7} a7 7 0 1 0 5 7 h4"/>`
    + `<circle class="imp-core" cx="${x}" cy="${y}" r="2.2"/></g>`;
}
// Экзо-каркас: рама с тягами.
function gExo(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<path class="imp-spine" d="M${x - 6} ${y - 8} v16 M${x + 6} ${y - 8} v16"/>`
    + `<path class="imp-tick" d="M${x - 6} ${y - 3} l12 -3 M${x - 6} ${y + 4} l12 -3"/></g>`;
}
// Варп/пси-модуль: сигил в кольце.
function gWarp(x, y, c) {
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<circle class="imp-ring" cx="${x}" cy="${y}" r="8"/>`
    + `<path class="imp-tick" d="M${x} ${y - 6} L${x + 5} ${y + 4} L${x - 5} ${y + 4} Z M${x} ${y + 6} L${x - 5} ${y - 4} L${x + 5} ${y - 4} Z"/></g>`;
}
// Термо/охлаждение: радиатор с рёбрами.
function gCooler(x, y, c) {
  const fins = [-6, -2, 2, 6].map(d => `M${x + d} ${y - 6} v12`).join(" ");
  return `<g class="imp-special imp-pulse" style="color:${c}">`
    + `<rect class="imp-ring" x="${x - 8}" y="${y - 7}" width="16" height="14" rx="2"/>`
    + `<path class="imp-tick" d="${fins}"/></g>`;
}

// re → {anchor [x,y], fn}. Особые импланты. Остальные «Прочее» → gModule (столбиком).
const SPECIAL_LIB = [
  { re: /filtration|фильтрац|air filt|воздушн\w* фильтр|rebreather|ребризер/i, a: [230, 200], fn: gFilter },
  { re: /injector|инжектор|inject|стим|combat drug|боев\w* препарат|dispenser|диспенсер/i, a: [292, 232], fn: gInjector },
  { re: /vox|вокс|voice|голосов|speaker|динамик|hailer/i,      a: [222, 128], fn: gVox },
  { re: /auspex|ауспик|sensor|сенсор|scanner|сканер|detect|детект/i, a: [280, 140], fn: gAuspex },
  { re: /memory|памят|data ?store|хранилищ\w* данн|archive|архив|lexi|лекси/i, a: [232, 130], fn: gArchive },
  { re: /gyro|гиро|stabiliz|стабилиз|balance|равновес|vestib|вестибул/i, a: [268, 176], fn: gGyro },
  { re: /pump|насос|circulat|кровообращ|haemo|гемо/i,          a: [214, 210], fn: gPump },
  { re: /exoskelet|экзоскелет|frame|каркас|brace|корсет|support|поддержк/i, a: [206, 190], fn: gExo },
  { re: /psy|пси-|warp|варп|daemon|демонич|soul|душ/i,          a: [300, 196], fn: gWarp },
  { re: /cool|охлажд|thermal|термо|heat sink|радиатор|coolant|хладаген/i, a: [296, 258], fn: gCooler },
  { re: /respirator|респиратор|lung|лёгк|легк/i,        a: [232, 214], fn: gBellows },
  { re: /liver|печен|detox|детокс|toxin|токсин/i,       a: [268, 240], fn: gRetort },
  { re: /kidney|почк|dialys|диализ|blood filter|фильтр крови/i, a: [236, 252], fn: gCoil },
  { re: /bone|кост|skeletal|скелет|ossmodul|оссмодул/i, a: [222, 268], fn: gStrut },
  { re: /neural|нейрал|нейронн|cortex|кортек|synapt|синапт/i, a: [264, 120], fn: gNeural },
  { re: /subskin|подкожн|armour plat|бронеплас|carapace|панцирн/i, a: [286, 176], fn: gPlate },
  { re: /reactor|реактор|power plant|энергоблок|generator|генератор/i, a: [250, 232], fn: gReactor },
  { re: /optic|оптик|magnocular|магнокул|augmetic eye|окулярн/i, a: [274, 96],  fn: gLens },
  { re: /hidden blade|скрыт\w* клинок|retractable|выдвижн/i, a: [292, 214], fn: gBladeSm },
  { re: /smuggl|контрабанд|hidden compart|тайник|cache|схрон/i, a: [214, 236], fn: gCache },
  { re: /internal battery|внутрен\w* батар/i,          a: [250, 188], fn: gBattery },
  { re: /bio-?monitor|био-?монитор/i,                  a: [238, 200], fn: gMonitor },
  { re: /sonic shrieker|звуков\w* крикун|крикун/i,     a: [250, 120], fn: gWaves },
  { re: /vox-?bead|вокс-?бус/i,                         a: [266, 110], fn: gAntenna },
  { re: /pheromone|феромон/i,                           a: [250, 218], fn: gEmit },
  { re: /waste proc|обработк\w* отход/i,                a: [250, 278], fn: gTank },
  { re: /gastral|гастрал/i,                             a: [238, 246], fn: gStomach },
  { re: /sucroregul|сахарорег/i,                        a: [270, 244], fn: gModule },
  { re: /pain ward|болеогражд/i,                        a: [250, 162], fn: gShield },
  { re: /autosangu|автосангв/i,                         a: [250, 206], fn: gDrop },
  { re: /interface port|интерфейсн\w* порт|\bmiu\b|миу|neuroconnector|нейроконнектор|servo-?shunt|серво-?шунт/i, a: [264, 108], fn: gSocket },
  { re: /reconstructor|реконструктор/i,                a: [250, 98],  fn: gMaskFace },
];

// Обёртка глифа для тултипа при наведении.
const tipWrap = (tip, inner) => (tip && inner) ? `<g class="imp-tipwrap" data-tip="${esc(tip)}">${inner}</g>` : inner;

/** SVG-оверлеи визуала имплантов: {back} — за телом, {front} — поверх тела. */
export function buildImplantsSvg(state, bodyType = "male") {
  const { regions: R, overlays: O, mechadendrites: nMech } = state;
  const LIMB = limbsOf(bodyType), OG = organsOf(bodyType);
  const col = c => implantCatColor(c);

  // Имя импланта на каждую зону (для тултипов).
  const nm = {};
  for (const s of state.slots || []) {
    if (s.kind === "arm")       nm[s.side === "left" ? "armL" : "armR"] = s.name;
    else if (s.kind === "leg")  nm[s.side === "left" ? "legL" : "legR"] = s.name;
    else if (s.kind === "eye")  nm[s.side === "left" ? "eyeL" : "eyeR"] = s.name;
    else if (s.kind === "cranial") nm.brain = s.name;
    else if (s.kind === "heart")   nm.heart = s.name;
    else if (s.kind === "lung")    nm.lungs = s.name;
    else if (s.kind === "respirator") nm.respirator = s.name;
    else if (s.kind === "skeleton")   nm.skel = s.name;
  }
  const mechNames = (state.slots || []).filter(s => s.kind === "mechadendrite").map(s => s.name).join(", ");

  // ── ЗА ТЕЛОМ: механодендриты (из-за спины) ──
  const back = nMech ? tipWrap(mechNames, mechGlyph(nMech)) : "";

  // ── ПОВЕРХ ТЕЛА ──
  let f = "";
  if (O.skeleton) f += tipWrap(nm.skel, skeletonGlyph(col(O.skeleton), bodyType));
  if (O.heart)    f += tipWrap(nm.heart, vesselsGlyph(col(O.heart), bodyType));
  for (const k of ["armL", "armR", "legL", "legR"])
    if (R[k] !== "flesh") f += tipWrap(nm[k], limbGlyph(LIMB[k], col(R[k]), outlineOf(bodyType, k)));
  if (O.lungs)      f += tipWrap(nm.lungs, lungsGlyph(col(O.lungs), bodyType));
  if (O.respirator) f += tipWrap(nm.respirator, respiratorGlyph(250, col(O.respirator)));
  if (O.heart)      f += tipWrap(nm.heart, heartGlyph(OG.heart[0], OG.heart[1], col(O.heart)));
  if (O.cranial)    f += tipWrap(nm.brain, brainGlyph(col(O.cranial), bodyType));
  if (O.eyeL)       f += tipWrap(nm.eyeL, eyeGlyph(240, 98, col(O.eyeL)));
  if (O.eyeR)       f += tipWrap(nm.eyeR, eyeGlyph(260, 98, col(O.eyeR)));

  for (const s of state.slots || []) {                            // адд-оны конечностей
    let anchor = null;
    if (s.kind === "arm") anchor = LIMB[s.side === "left" ? "armL" : "armR"].path.at(-1);
    else if (s.kind === "leg") anchor = LIMB[s.side === "left" ? "legL" : "legR"].path.at(-1);
    if (!anchor) continue;
    const ctx = { name: s.name, side: s.side || "right", color: col(s.cat), anchor };
    for (const def of ADDON_LIB)
      if (def.kinds.includes(s.kind) && def.re.test(s.name)) { f += tipWrap(s.name, def.fn(ctx)); break; }
  }
  // «Особые» и «Прочие» импланты — уникальные глифы (или generic-модуль столбиком).
  let otherIdx = 0;
  for (const s of state.slots || []) {
    if (s.kind !== "other" && s.kind !== "torso") continue;
    const color = col(s.cat);
    const sp = SPECIAL_LIB.find(d => d.re.test(s.name));
    if (sp) f += tipWrap(s.name, sp.fn(sp.a[0], sp.a[1], color));
    else if (s.kind === "other") { f += tipWrap(s.name, gModule(294, 196 + otherIdx * 20, color)); otherIdx++; }
  }

  const wrap = (cls, inner) => inner
    ? `<svg class="${cls}" viewBox="0 0 500 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>` : "";
  return { back: wrap("body-implants body-implants-back", back), front: wrap("body-implants", f) };
}

// ════════════════════════════════════════════════════════════════════════
//  СОСТОЯНИЕ РАН И КАРДИОГРАММА
// ════════════════════════════════════════════════════════════════════════

// Ступени состояния по доле оставшихся Ран. Ключи совпадают с классами
// ecg--* в actor-body.css и с палитрой WOUND_COLOR в боевом HUD.
const WOUND_STAGES = [
  { key: "healthy",  min: 0.66, label: "СТАБИЛЕН",     bpm: [64, 78] },
  { key: "wounded",  min: 0.34, label: "РАНЕН",        bpm: [86, 104] },
  { key: "nearcrit", min: 0.01, label: "КРИТИЧЕСКИЙ",  bpm: [118, 142] },
  { key: "critical", min: -99,  label: "ПРИ СМЕРТИ",   bpm: [150, 176] }
];

/**
 * Состояние по Ранам: ключ ступени, значения и доля.
 * @param {object} system  system актора-персонажа
 */
export function woundStatus(system = {}) {
  const w    = system.wounds || {};
  const max  = Math.max(0, Number(w.max) || 0);
  const val  = Math.max(0, Number(w.value) || 0);
  const crit = Math.max(0, Number(w.critical) || 0);
  // Раны считаем «сколько осталось»: value — текущее, max — предел.
  const frac = max > 0 ? val / max : 0;
  const st   = WOUND_STAGES.find(s => frac >= s.min) || WOUND_STAGES.at(-1);
  return {
    key: crit > 0 && st.key === "healthy" ? "wounded" : st.key,
    label: st.label, value: val, max, crit,
    pct: max > 0 ? Math.round(frac * 100) : 0,
    bpm: st.bpm
  };
}

/**
 * Кардиограмма для вкладки «ТЕЛО»: путь волны в системе координат 300×80.
 * Чем хуже состояние, тем чаще и рванее комплексы; смерть — ровная линия.
 * @param {object} system    system актора
 * @param {boolean} deceased констатирована ли смерть
 */
export function buildEcg(system = {}, deceased = false) {
  const ws = woundStatus(system);
  const MID = 40, W = 300;

  if (deceased || ws.max === 0 || ws.value <= 0) {
    return {
      key: "dead", label: deceased ? "СМЕРТЬ КОНСТАТИРОВАНА" : "НЕТ СИГНАЛА",
      dead: true, path: `M0 ${MID} L${W} ${MID}`,
      value: ws.value, max: ws.max, pct: ws.pct, crit: ws.crit, bpm: 0
    };
  }

  // Число комплексов на экран растёт вместе с пульсом.
  const beats = { healthy: 3, wounded: 4, nearcrit: 5, critical: 6 }[ws.key] || 3;
  const amp   = { healthy: 1, wounded: 0.92, nearcrit: 0.8, critical: 0.6 }[ws.key] || 1;
  const step  = W / beats;

  let d = `M0 ${MID}`;
  for (let i = 0; i < beats; i++) {
    const x = i * step;
    const P = (dx, dy) => `L${(x + dx).toFixed(1)} ${(MID - dy * amp).toFixed(1)}`;
    d += ` ${P(step * 0.10, 0)}`            // изолиния
       + ` ${P(step * 0.16, 5)}`            // зубец P
       + ` ${P(step * 0.22, 0)}`
       + ` ${P(step * 0.30, -7)}`           // Q
       + ` ${P(step * 0.36, 30)}`           // R — основной пик
       + ` ${P(step * 0.42, -12)}`          // S
       + ` ${P(step * 0.50, 0)}`
       + ` ${P(step * 0.64, 9)}`            // зубец T
       + ` ${P(step * 0.74, 0)}`
       + ` ${P(step * 1.00, 0)}`;
  }

  const [lo, hi] = ws.bpm;
  return {
    key: ws.key, label: ws.label, dead: false, path: d,
    value: ws.value, max: ws.max, pct: ws.pct, crit: ws.crit,
    // Пульс тем выше, чем меньше осталось Ран внутри ступени.
    bpm: Math.round(hi - (hi - lo) * (ws.pct / 100))
  };
}
