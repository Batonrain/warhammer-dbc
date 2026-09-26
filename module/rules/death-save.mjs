// module/rules/death-save.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть (стр. 232-233 книги, глава «СМЕРТЬ» книги Core): Чудесное Спасение
//  и Божественная Защита — оба варианта доступны любому умирающему без
//  Таланта (просто разная цена/тяжесть), плюс Замедленная Анимация Астартес.
//  Чистые функции — что доступно актору и во что обходится попытка; сам
//  бросок и запись на актора — module/sheets/tabs/death.mjs (там же
//  Foundry-зависимые части).
//
//  Цена у хаосита — ХАРАКТЕРИСТИКА Inf, а не пул Очков Бесчестия (сверка
//  wdbc-x1nz.2, 24.09.2026): книга «перманентно потерять 1d10+10 Бесчестия»,
//  «опускает Inf персонажа до 0», «его Inf 50 или выше после потери
//  Бесчестия», Наследник — «бросает кубик на количество потерянного Inf».
//  Пул Очков (system.fate) у хаосита — Inf.b, 3-6 очков: цена 11-20 из него
//  проваливалась почти всегда. Тот же путь, что награда Бесчестием в конце
//  сессии (rules/session-rewards.mjs::INFAMY_PATH, решение владельца 07.09).
//  Лоялист платит той же характеристикой Inf (у него — Влияние): книга
//  хаоситская и про него молчит, а пул Судьбы мал, и Спасение из него почти
//  всегда проваливалось (решение Сергея 25.09.2026, task-3aa8).
//
//  «Игрушка Богов» (стр. 233) — обязанность первой за сессию смерти
//  Покровительствуемого (только четыре Бога, решение владельца 24.09.2026),
//  с книжными исключениями «Cor может дойти до 100» и тестом Inf+30.
//  «Воскрешение» — кнопка «Воскресить» без формулы вовсе (по прямому
//  решению пользователя — последствия на ГМа).
// ════════════════════════════════════════════════════════════════════════════

import { isSusAnMembraneItem } from "./predicates.mjs";
import { permanentInfamy, INFAMY_PATH } from "./session-rewards.mjs";
import { hasAbility } from "./ability-by-key.mjs";

const NS = "warhammer-dbc";

/** Платит ли актор характеристикой Inf (хаосит), а не пулом Судьбы. */
export function paysWithInfamy(actor) {
  return actor?.system?.alignment === "heretic";
}

/** Пул очков, которым персонаж расплачивается — Судьба у лоялиста, Бесчестье у хаосита. */
export function fatePoolLabel(actor) {
  return paysWithInfamy(actor) ? "Бесчестья" : "Судьбы";
}

/**
 * Откуда списывается цена Спасения/Защиты: постоянное Inf (пишется в
 * inf.base, как награда Бесчестием) — у хаосита это Бесчестие, у лоялиста
 * Влияние (решение Сергея 25.09.2026).
 * @returns {{kind:"inf", current:number, path:string, base:number}}
 */
export function saveCostSource(actor) {
  return {
    kind: "inf", current: permanentInfamy(actor), path: INFAMY_PATH,
    base: Number(actor?.system?.characteristics?.inf?.base) || 0
  };
}

/** Чудесное Спасение: 1d10+10 Бесчестия, 1d10 Порчи (стр. 232). */
export const MIRACULOUS_SAVE = { fateDie: "1d10", fateFlat: 10, corDie: "1d10" };

/** Божественная Защита (стр. 232-233, доступна всем умирающим — без Таланта): 1d5+5 Бесчестия, 1d5 Порчи. */
export const DIVINE_PROTECTION = { fateDie: "1d5", fateFlat: 5, corDie: "1d5" };

/** Божественная Защита: «Inf 50 или выше после потери» — можно чудом перенестись на свою базу. */
export const DIVINE_TELEPORT_MIN_INF = 50;

/** Максимум кубика вида "1dN"/"NdM" — для проверки «может ли Cor дойти до 100». */
export function dieMax(formula) {
  const m = /^(\d*)d(\d+)$/i.exec(String(formula ?? "").trim());
  if (!m) return 0;
  return (Number(m[1]) || 1) * Number(m[2]);
}

/**
 * «если только те не имеют шанса поднять его Cor до 100» (Игрушка Богов) —
 * шанс есть, когда текущая Порча плюс максимум кубика Порчи этого пути ≥ 100.
 */
export function corMayReach100(actor, corDie) {
  const cor = Number(actor?.system?.corruption?.value) || 0;
  return cor + dieMax(corDie) >= 100;
}

/** Наследник (субраса, стр. книги Core): кубы потери Inf и Порчи — дважды, берётся меньший. */
export function rollsTwiceKeepLow(actor) {
  return actor?.system?.subrace === "inheritor";
}

/** Провалилось ли Спасение/Защита: Inf (пул) опустился бы до 0 или ниже. */
export function fateSaveFails(currentFate, loss) {
  return (Number(currentFate) || 0) - loss <= 0;
}

/**
 * Спасение/Защита на эту смерть провалены — «умирает как и положено, забытый
 * Богами» (стр. 232). Цена ложится в inf.base с полом 0, а Продвижение
 * остаётся, поэтому Inf после провала не 0 и сам по себе повтор не запрещает.
 */
export const FATE_SAVE_FAILED_FLAG = "fateSaveFailed";

// ── Причина смерти и что Спасение прекращает ─────────────────────────────────

/** Флаг причины смерти от Состояния — ставит combat/condition-death.mjs::killByCondition. */
export const DEATH_CAUSE_FLAG = "deathCause";

/**
 * Снимок Ран ДО последней потери Ран (rules/wounds.mjs::applyWoundLoss) —
 * Чудесное Спасение «откатывает урон смертельного попадания».
 */
export const PRE_HIT_WOUNDS_FLAG = "preHitWounds";

/**
 * Состояния, которые убивают сами (Кровотечение/Удушье/Гангрена — через
 * killByCondition, Горение — уроном каждый Ход). Божественная Защита
 * прекращает «все потенциально смертельные эффекты» — все эти.
 */
export const LETHAL_CONDITIONS = ["bleeding", "haemorrhaging", "burning", "suffocating", "gangrene"];

/**
 * Какие Состояния снимает путь спасения.
 *  - Божественная Защита — все смертельные (LETHAL_CONDITIONS).
 *  - Чудесное Спасение — только «эффект, что вызвал смерть»: Кровотечение
 *    закрывает рану и восполняет кровь (снимается и Обескровливание),
 *    Удушье сменяется способностью дышать, Гангрена прекращается. Смерть от
 *    попадания (причина не записана) — откат урона; Горение при этом
 *    тушится: оно убивает уроном, и книга прямо его называет.
 * @param {"miraculous"|"divine"} kind
 * @param {string|null} cause
 */
export function conditionsEndedBySave(kind, cause) {
  if (kind === "divine") return [...LETHAL_CONDITIONS];
  if (cause === "bleeding") return ["bleeding", "haemorrhaging"];
  if (cause === "suffocating") return ["suffocating"];
  if (cause === "gangrene") return ["gangrene"];
  // T ≤ 0 от урона в Характеристики (радиация, токсины...) — Состояния-
  // убийцы нет, возврат T — на усмотрение ГМа (карточка напоминает).
  if (cause) return [];
  return ["burning"];
}

/**
 * Раны для отката смертельного попадания: снимок из applyWoundLoss, если
 * смерть была от урона (причина-Состояние не записана). null — откатывать
 * нечего, вызывающий поднимает Раны до 0.
 */
export function rollbackWounds(actor) {
  if (actor?.getFlag?.(NS, DEATH_CAUSE_FLAG)) return null;
  const snap = actor?.getFlag?.(NS, PRE_HIT_WOUNDS_FLAG);
  if (!snap || snap.value == null) return null;
  return { value: Number(snap.value) || 0, critical: Math.max(0, Number(snap.critical) || 0) };
}

// ── Божественная Защита до конца сессии ─────────────────────────────────────

/**
 * «до конца сессии он не может быть ранен или убит никаким образом... и в
 * любом бою до конца сессии он может совершать только полудвижения».
 * Снимается кнопкой ⏻ Конец сессии (apps/game-session.mjs) или ГМом досрочно
 * — книжное исключение «остался во власти врагов без союзников».
 */
export const DIVINE_PROTECTION_FLAG = "divineProtection";

export function divineProtectionActive(actor) {
  return !!actor?.getFlag?.(NS, DIVINE_PROTECTION_FLAG);
}

// ── Замедленная Анимация (Сус-ан Мембрана) ──────────────────────────────────

/** Замедленная Анимация Астартес (Сус-ан Мембрана): тест W+30. */
export const SUS_AN_TEST_MOD = 30;
/** Раны не должны быть ниже −15, иначе десантника уже не спасти этим способом. */
export const SUS_AN_MIN_CRITICAL = 15;
/** «свою попытку входа в замедленную анимацию» — одна попытка на смерть. */
export const SUS_AN_ATTEMPT_FLAG = "susAnAttempted";

/** Hero's Sleep/Сон Героя (Геносемя): переброс проваленного теста и порог −(10+T.b). */
export function hasHeroSleep(actor) {
  return hasAbility(actor, "geneseed.core.heroSSleep", "Hero's Sleep", "talent");
}

/** Порог Критических Ран для Замедленной Анимации: 15, со Сном Героя — 10+T.b. */
export function susAnCriticalLimit(actor) {
  if (!hasHeroSleep(actor)) return SUS_AN_MIN_CRITICAL;
  return 10 + (Number(actor?.system?.characteristics?.t?.bonus) || 0);
}

/** Установленная Сус-ан Мембрана (флаг installed — как у остальных имплантов Хирургеона). */
export function hasSusAnMembrane(actor) {
  return !!actor?.items?.some(i => isSusAnMembraneItem(i) && !!i.getFlag?.("warhammer-dbc", "installed"));
}

/** Раны ещё не ушли ниже порога и попытка на эту смерть не потрачена. */
export function susAnEligible(actor) {
  const crit = Number(actor?.system?.wounds?.critical) || 0;
  if (actor?.getFlag?.(NS, SUS_AN_ATTEMPT_FLAG)) return false;
  return crit <= susAnCriticalLimit(actor);
}

// ── Игрушка Богов ──────────────────────────────────────────────────────────

/** Покровительство «одного из Богов» — только четыре Бога, без Неделимого (решение владельца 24.09.2026). */
export const TOY_OF_GODS_PATRONS = ["khorne", "tzeentch", "nurgle", "slaanesh"];

/** Ключ троттлинга «первое смертельное ранение за сессию» (rules/cooldown.mjs, unit "session"). */
export const TOY_OF_GODS_FLAG = "toyOfGods";

/** Тест Inf+30, чтобы проигнорировать правило, если союзники способны поднять из мёртвых. */
export const TOY_OF_GODS_TEST_MOD = 30;

export function toyOfGodsApplies(actor) {
  return TOY_OF_GODS_PATRONS.includes(actor?.system?.patronGod);
}

/**
 * Какие пути «Игрушка Богов» обязывает использовать: только те, что не
 * могут поднять Cor до 100. Пустой список — обязанности нет.
 * @param {object} actor
 * @param {{miraculousCorDie:string}} opts
 * @returns {string[]} подмножество ["miraculous","divine"]
 */
export function toyOfGodsForcedOptions(actor, { miraculousCorDie = MIRACULOUS_SAVE.corDie } = {}) {
  const out = [];
  if (!corMayReach100(actor, miraculousCorDie)) out.push("miraculous");
  if (!corMayReach100(actor, DIVINE_PROTECTION.corDie)) out.push("divine");
  return out;
}
