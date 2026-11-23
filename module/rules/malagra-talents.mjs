// module/rules/malagra-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МАЛАГРА (Элитный архетип) — чистая арифметика Черт и Талантов:
//
//   • Astral Converter / Астральный Конвертер — «Катушка Потенции с 10
//     зарядами, в начале своего Хода восстанавливает 1 заряд»: база Катушки
//     не ниже 10 (rules/character/final-pools.mjs), +1 — combat/malagra.mjs;
//   • Paragon Coil / Совершенная Катушка — «потратить 1 заряд: бонус к I и I.b
//     для расчёта эффектов Техночудес на ½P / ½P.b (окр.▲) до начала
//     следующего Хода (теряется при израсходовании всех зарядов)»;
//   • Iovex / Йовекс — пока Катушка активирована: Люминен-Техночудеса +1d10
//     урона и +½P.b (окр.▲) Pen, тест Компенсатора на них проваливается сам;
//   • Fell Discharge / Жестокая Разрядка — разряд чужой Катушки: урон и
//     Усталость по числу зарядов;
//   • Magnetomorphosis / Магнитоморфоз — I.b баллов на варианты Ferric
//     Commandment.
//  Вызывают: sheets/tabs/tech.mjs (активация Техночуда), final-pools.mjs,
//  combat/malagra.mjs. Таланты — по имени литералом.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
const num = v => Number(v) || 0;
const half = v => Math.ceil(Math.max(0, num(v)) / 2);

export const hasAstralConverter = a => hasItemNamed(a, "Astral Converter", ["trait"]);
export const hasParagonCoil = a => hasItemNamed(a, "Paragon Coil", ["trait"]);
export const hasDigitalGhost = a => hasItemNamed(a, "Digital Ghost", ["trait"]);
export const hasIovex = a => hasItemNamed(a, "Iovex", ["talent"]);
export const hasFellDischarge = a => hasItemNamed(a, "Fell Discharge", ["talent"]);
export const hasMagnetomorphosis = a => hasItemNamed(a, "Magnetomorphosis", ["talent"]);
export const hasPrescontax = a => hasItemNamed(a, "Prescontax", ["talent"]);
export const hasRogoex = a => hasItemNamed(a, "Rogoex", ["talent"]);
export const hasVenefactor = a => hasItemNamed(a, "Venefactor", ["talent"]);

// ── Астральный Конвертер ────────────────────────────────────────────────────

export const ASTRAL_COIL_BASE = 10;
export const ASTRAL_REGEN = 1;

/** База Катушки Потенции от Конвертера (0 — Черты нет). */
export const astralConverterBase = actor => (hasAstralConverter(actor) ? ASTRAL_COIL_BASE : 0);

/** Сколько зарядов вернуть в начале Хода: 1, не выше максимума. */
export function astralRegen(energy = {}) {
  const max = num(energy.maxTotal ?? energy.max);
  const v = num(energy.value);
  return Math.max(0, Math.min(ASTRAL_REGEN, max - v));
}

// ── Совершенная Катушка и Йовекс ────────────────────────────────────────────

/** Метка «Катушка активирована до начала следующего Хода». */
export const PARAGON_FLAG = "paragonCoilActive";
export const PARAGON_COST = 1;

const paragonFlagOn = actor => !!(actor?.flags?.[NS]?.[PARAGON_FLAG] ?? actor?.getFlag?.(NS, PARAGON_FLAG));

/** Активна ли Катушка: метка стоит и заряды не кончились. */
export function paragonActive(actor) {
  return paragonFlagOn(actor) && num(actor?.system?.energy?.value) > 0;
}

/** Бонус к I и I.b для эффектов Техночудес: ½P и ½P.b (окр.▲). */
export function paragonIntBonus(actor) {
  if (!paragonActive(actor)) return { i: 0, ib: 0 };
  const per = actor?.system?.characteristics?.per ?? {};
  return { i: half(per.total), ib: half(per.bonus) };
}

/** Люминен-Техночудо — по имени («Luminen …», «Люминен …»). */
export const isLuminenPower = item => /luminen|люминен/i.test(String(item?.name ?? ""));

/**
 * Надбавки Малагры к активации Техночуда. iovex:false — игрок отказался от Йовекса.
 * @returns {{ib:number, i:number, extraDice:string, pen:number, autoFailComp:boolean, lines:string[]}}
 */
export function malagraMiracleMods(actor, item, { iovex = true } = {}) {
  const out = { ib: 0, i: 0, extraDice: "", pen: 0, autoFailComp: false, lines: [] };
  const pc = paragonIntBonus(actor);
  if (pc.ib || pc.i) {
    out.ib = pc.ib; out.i = pc.i;
    out.lines.push(`Совершенная Катушка: I +${pc.i}, I.b +${pc.ib} в эффектах Техночуда.`);
  }
  if (iovex && paragonActive(actor) && hasIovex(actor) && isLuminenPower(item)) {
    out.extraDice = "1d10";
    out.pen = half(actor?.system?.characteristics?.per?.bonus);
    out.autoFailComp = true;
    out.lines.push(`Йовекс: урон +1d10, Pen +${out.pen}; тест Компенсатора проваливается сам.`);
  }
  return out;
}

// ── Жестокая Разрядка ───────────────────────────────────────────────────────

export const FELL_DISCHARGE_SUCCESSES = 3;

/** «1 непоглощаемого E(El) Dmg за 1 заряд, 1 Усталости за каждые полные 2 заряда». */
export function fellDischargeEffect(charges) {
  const c = Math.max(0, Math.trunc(num(charges)));
  return { damage: c, fatigue: Math.floor(c / 2) };
}

// ── Магнитоморфоз ───────────────────────────────────────────────────────────

/** Варианты Ferric Commandment: цена в баллах. */
export const MAGNETO_OPTIONS = {
  hand:   { cost: 2, label: "Магнитная рука" },
  cocoon: { cost: 3, label: "Кокон из осколков (+1 AP всем частям тела)" },
  beast:  { cost: 2, label: "Форма чудовищ (рейтинг Страха 2)" },
  lift:   { cost: 4, label: "Поднять и левитировать" }
};

/**
 * Проверка распределения I.b баллов.
 * @param {Record<string, number>} picks сколько раз взят вариант
 * @returns {{ok:boolean, spent:number, reason?:string}}
 */
export function magnetoPlan(picks = {}, intBonus = 0) {
  let spent = 0;
  for (const [k, n] of Object.entries(picks)) spent += (MAGNETO_OPTIONS[k]?.cost ?? 0) * Math.max(0, Math.trunc(num(n)));
  const budget = Math.max(0, Math.trunc(num(intBonus)));
  if (spent > budget) return { ok: false, spent, reason: `Нужно ${spent} баллов, есть ${budget} (I.b).` };
  if (num(picks.beast) > 0 && num(picks.cocoon) < 1) return { ok: false, spent, reason: "Форму чудовищ можно придать только кокону." };
  return { ok: true, spent };
}

/** Подъём: вес до I.b×50 кг, высота I.b м. */
export const magnetoLift = intBonus => ({ kg: Math.max(0, num(intBonus)) * 50, m: Math.max(0, num(intBonus)) });

// ── Вэнефактор ──────────────────────────────────────────────────────────────

/** Доп. Полудействие (1 ОД) и Реакция в Ход — только на Техночудеса и Электу-Индукторы. */
export const VENEFACTOR_AP = 1;
export const VENEFACTOR_REACTION = 1;
