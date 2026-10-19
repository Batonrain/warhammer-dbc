// module/rules/naga-traits.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Черты Наги (DoomBC — Основная книга, глава I «Расы», «Нага») — чистая
//  часть: имена возможностей, числа книги и арифметика без Foundry. Обвязка
//  (диалоги, хуки, часы) — module/apps/naga-traits.mjs и точечные читатели в
//  combat/*, перечислены у каждой возможности в constants/capabilities.mjs.
//
//  Возможности нарочно названы по ПРАВИЛУ, а не по расе (dbc-rules,
//  «Возможность вместо проверки расы»): «иммунитет к ядам», «+1 Рана в сутки»
//  и «затянуть Кровотечение» дословно повторяются у Сслита (Sslyth Physiology)
//  и достанутся ему той же записью Конструктора, без правки кода.
//
//  Модуль ничего не импортирует, кроме talent-targets.mjs (признак «мутант-
//  змея» живёт там — это цель Ненависти), — его читают predicates.mjs и
//  hands-подобные листья, круг импортов недопустим (см. AGENTS.md про
//  source-registry).
// ════════════════════════════════════════════════════════════════════════════

import { hasSnakeMutation } from "./talent-targets.mjs";

// ── Abominable Physiology / Изуверская Физиология ───────────────────────────
/** «Нага иммунна к ядам» — Toxic, яды-препараты и Отравление любым путём. */
export const POISON_IMMUNE_CAPABILITY = "poison.immune";
/** «…пост-эффектам и зависимости от наркотиков, даже откровенно сверхъестественных». */
export const DRUG_AFTERMATH_IMMUNE_CAPABILITY = "drugs.afterEffectAddictionImmune";
/** «…дополнительно вылечивает себе 1 Рану в сутки». */
export const EXTRA_WOUND_DAILY_CAPABILITY = "healing.extraWoundDaily";
/** «…может в начале своего Хода затянуть свое Кровотечение тестом T+0». */
export const SELF_STANCH_CAPABILITY = "bleeding.selfStanchTurnStart";

/** Метка на предмете-дозе «(яд в клыках)» — её кладёт Адаптивная Отрава (apps/naga-traits.mjs). */
export const ADAPTIVE_VENOM_DOSE_FLAG = "adaptiveVenomDose";

/** Атака Укусом: по названию оружия (Bite / Укус, в т.ч. «Смертельное Естественное Оружие»). */
export function isBiteAttack(weaponName) {
  return /\bbite\b|укус/i.test(String(weaponName ?? ""));
}

/** Метка на акторе: worldTime, от которого отсчитываются сутки доп. лечения. */
export const EXTRA_WOUND_DAILY_FLAG = "extraWoundDailyAt";
export const SECONDS_PER_DAY = 86400;

/**
 * Сколько полных суток прошло с метки. Метки нет — 0 (первый проход только
 * ставит её, иначе персонаж с Чертой с начала кампании получил бы разом
 * столько Ран, сколько прошло суток с сотворения мира — тот же приём, что
 * rules/fleshmetal-regen.mjs). Время назад — 0, долг не копим.
 */
export function daysElapsed(lastAt, worldTime) {
  if (lastAt == null) return 0;
  const delta = Number(worldTime) - Number(lastAt);
  if (!Number.isFinite(delta) || delta < SECONDS_PER_DAY) return 0;
  return Math.floor(delta / SECONDS_PER_DAY);
}

/**
 * План доп. лечения за отрезок: сколько Ран выдать и куда сдвинуть метку.
 * Остаток неполных суток не теряется — метка идёт ровно на выданные сутки.
 * Нечего лечить — метка всё равно идёт вперёд: сутки, прожитые здоровым,
 * «в запас» не копятся.
 * @returns {{heal:number, nextAt:number|null, days:number}}
 */
export function extraWoundDailyPlan({ lastAt, worldTime, missing }) {
  if (lastAt == null) return { heal: 0, nextAt: Number(worldTime) || 0, days: 0 };
  const days = daysElapsed(lastAt, worldTime);
  if (!days) return { heal: 0, nextAt: null, days: 0 };
  const heal = Math.max(0, Math.min(days, Number(missing) || 0));
  return { heal, nextAt: Number(lastAt) + days * SECONDS_PER_DAY, days };
}

// ── Adaptive Venom / Адаптивная Отрава ──────────────────────────────────────
/** «Укус Наги использует кубик 1d10 вместо 1d5». */
export const VENOM_BITE_CAPABILITY = "bite.venomD10";

/**
 * Урон Укуса с кубом 1d10 вместо 1d5. Меняется только сам куб «1d5» (не
 * «11d5», не «1d50») — рейтинг Укуса и прочие слагаемые остаются.
 */
export function venomBiteDamage(damage) {
  return String(damage ?? "").replace(/(^|[^0-9])1d5(?![0-9])/i, "$11d10");
}

/** «вектором рана, инъекция или еда» — ключи system.deliveryMethod препарата. */
export const ADAPTIVE_VENOM_VECTORS = ["wound", "injection", "food"];

/**
 * Цена превращения яда в Очках Бесчестия по Редкости яда: «Редкостью не
 * более 2» — 1, «3 Очка Бесчестия для Редкости 3», «5 … для Редкости 4».
 * Реже 4 книга не даёт — null.
 */
export function adaptiveVenomCost(availability) {
  const r = Number(availability) || 0;
  if (r <= 2) return 1;
  if (r === 3) return 3;
  if (r === 4) return 5;
  return null;
}

/**
 * Яды, в которые можно превратить отраву в клыках за `budget` Очков
 * Бесчестия (budget не задан — все доступные вовсе): категория «яд», вектор
 * рана/инъекция/еда, Редкость не выше 4. Сортировка — по Редкости, затем по
 * имени: дешёвые сверху.
 * @param {Array<{name:string, system:object}>} docs
 */
export function adaptiveVenomCandidates(docs, budget = Infinity) {
  return [...(docs ?? [])]
    .filter(d => d?.system?.drugCategory === "poison"
      && ADAPTIVE_VENOM_VECTORS.includes(d.system.deliveryMethod))
    .map(d => ({ doc: d, cost: adaptiveVenomCost(d.system.availability) }))
    .filter(x => x.cost !== null && x.cost <= budget)
    .sort((a, b) => (Number(a.doc.system.availability) || 0) - (Number(b.doc.system.availability) || 0)
      || String(a.doc.name).localeCompare(String(b.doc.name), "ru"));
}

// ── Constrictor / Удав ──────────────────────────────────────────────────────
/** «Нага может использовать свой хвост для совершения Захвата и в Борьбе, освобождая руки». */
export const CONSTRICTOR_CAPABILITY = "grapple.constrictorTail";
/** Флаг на Атакующем: цель держит хвост (ставит combat/grapple.mjs, читает rules/hands.mjs). */
export const GRAPPLE_TAIL_FLAG = "grappleTail";
/** «хвост считается парой рук». */
export const CONSTRICTOR_TAIL_HANDS = 2;
/** «…и получает +20 на все тесты Athletics». */
export const CONSTRICTOR_ATHLETICS_BONUS = 20;
/** «…с Трейтом Unnatural S (6)». */
export const CONSTRICTOR_UNNATURAL_S = 6;

/**
 * S.b хвоста: десятки Силы + Unnatural S (6). Собственный S.b Наги (уже с
 * её Сверхъестественной Силой, если она есть) берётся, если он больше:
 * хвост — не ослабленная часть тела, а отдельно усиленная.
 */
export function constrictorTailSb(sTotal, ownSb = 0) {
  const tail = Math.floor((Number(sTotal) || 0) / 10) + CONSTRICTOR_UNNATURAL_S;
  return Math.max(Number(ownSb) || 0, tail);
}

// ── Dark Prince's Child / Дитя Тёмного Принца ───────────────────────────────
/** «начинает игру с покровительством Слаанеш, и не может потерять его». */
export const LOCKED_SLAANESH_CAPABILITY = "patronage.lockedSlaanesh";
export const LOCKED_PATRON = "slaanesh";
/** «Впервые набирая 30, 60, и 90 Inf…». */
export const DARK_PRINCE_MILESTONE_CAPABILITY = "infamy.darkPrinceMilestones";
export const DARK_PRINCE_THRESHOLDS = [30, 60, 90];
/** Флаг на акторе: пороги, за которые выбор уже сделан ([30, 60]). */
export const DARK_PRINCE_TAKEN_FLAG = "darkPrinceMilestones";
/** «…получить еще 2 пары рук (и Трейт Multiple Arms (+2))». */
export const DARK_PRINCE_ARMS = 2;
/** «…либо получить +2 к максимуму Очков Бесчестия». */
export const DARK_PRINCE_INFAMY_MAX = 2;

/** Пороги Inf, достигнутые, но ещё не отыгранные — по возрастанию. */
export function darkPrinceMilestonesDue(infTotal, taken = []) {
  const inf = Number(infTotal) || 0;
  const done = new Set((taken ?? []).map(Number));
  return DARK_PRINCE_THRESHOLDS.filter(t => inf >= t && !done.has(t));
}

/** Покровитель, которого нельзя сменить: попытка поставить другого откатывается. */
export function patronChangeBlocked(nextPatron) {
  return nextPatron !== undefined && String(nextPatron ?? "") !== LOCKED_PATRON;
}

// ── Vanity Unbound / Безграничное Тщеславие ─────────────────────────────────
/** «Она не может признавать ничьего авторитета и получать преимущества Командования». */
export const NO_COMMAND_CAPABILITY = "command.cannotReceive";
/** «…штраф –20 на социальные взаимодействия» со змееподобными. */
export const VANITY_SOCIAL_PENALTY = -20;

/**
 * Змееподобное существо для «едва может сдерживать гордыню в общении с
 * другими змееподобными»: Нага, Сслит (змееподобные ксеносы) и носитель
 * мутации со змеиной субмутацией (Центавр/Животный Гибрид: Змея).
 */
export function isSerpentine(actor) {
  const race = actor?.system?.race;
  return race === "naga" || race === "sslyth" || hasSnakeMutation(actor);
}
