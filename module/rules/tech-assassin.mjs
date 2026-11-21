// module/rules/tech-assassin.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тех Ассасин (Элитные архетипы) — «модульный фрейм» как состояние актора.
//  Чистая часть без Foundry; кнопки и карточки — combat/tech-assassin.mjs.
//
//  Таланты архетипа говорят об одном и том же теле, собранном из модулей на
//  магнитных замках, поэтому состояние одно на всех:
//    flags.warhammer-dbc.modularFrame = {
//      detached:  { leftArm, rightArm, leftLeg, rightLeg, torso }  // отсоединено, цело
//      destroyed: { … }                                             // уничтожено (отрастить Куколкой)
//      regrow:    { part, wounds }                                  // копилка Куколки
//    }
//  Читатели:
//    • Размер — rules/character/movement.mjs → frameSizeShift (Скорпион −1,
//      голова без торса −2 у Модульной Автономии);
//    • Вуаль Парадокса — paradoxVeilRules (источник «techAssassin» в sources.mjs):
//      полностью кибернетический наблюдатель (Черта Machine) проваливает
//      Внимательность против носителя с включённой Вуалью;
//    • кнопки Рассечения/Разделения/Модульной Автономии/Скорпиона/Куколки.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
export const FRAME_FLAG = "modularFrame";
export const VEIL_FLAG = "paradoxVeil";

/** Части фрейма: подпись и цена отращивания Куколкой (книга: конечность 7, торс 20). */
export const FRAME_PARTS = {
  leftArm:  { label: "Левая рука", limb: true, regrow: 7 },
  rightArm: { label: "Правая рука", limb: true, regrow: 7 },
  leftLeg:  { label: "Левая нога", limb: true, leg: true, regrow: 7 },
  rightLeg: { label: "Правая нога", limb: true, leg: true, regrow: 7 },
  torso:    { label: "Торс", limb: false, regrow: 20 }
};

/** Рассечение: Уклонение за 2 Когниции вместо Реакции. */
export const BISECTION_COST = 2;
/** Разделение: присоединить конечность обратно — 1 Когниция; отсоединённая конечность имеет 3 Раны. */
export const DISJOINT_ATTACH_COST = 1;
export const DISJOINT_LIMB_WOUNDS = 3;
/** Куколка: Regeneration (2) на 1 Раунд. */
export const CHRYSALIS_REGEN = 2;
/** Скорпион: Pen жала в расчёте Трейта Parasite. */
export const SCORPIO_PEN = 8;
/** Черепная Мантия: два мехадендрита на голове. */
export const CRANIAL_MANTLE_DENDRITES = 2;

export const hasBisection = actor => hasItemNamed(actor, "Bisection", ["talent"]);
export const hasChrysalis = actor => hasItemNamed(actor, "Chrysalis", ["talent"]);
export const hasCranialMantle = actor => hasItemNamed(actor, "Cranial Mantle", ["talent"]);
export const hasDisjoint = actor => hasItemNamed(actor, "Disjoint", ["talent"]);
export const hasModularAutonomy = actor => hasItemNamed(actor, "Modular Autonomy", ["talent"]);
export const hasScorpio = actor => hasItemNamed(actor, "Scorpio", ["talent"]);
export const hasParadoxVeil = actor => hasItemNamed(actor, "Paradox Veil", ["trait"]);

const flagOf = (actor, key) => actor?.flags?.[NS]?.[key] ?? actor?.getFlag?.(NS, key) ?? null;

/** Нормализованное состояние фрейма (сырые флаги могут быть неполными). */
export function frameState(actor) {
  const raw = flagOf(actor, FRAME_FLAG) ?? {};
  const pick = obj => Object.fromEntries(Object.keys(FRAME_PARTS).map(k => [k, !!obj?.[k]]));
  const regrow = raw.regrow && FRAME_PARTS[raw.regrow.part]
    ? { part: raw.regrow.part, wounds: Math.max(0, Number(raw.regrow.wounds) || 0) } : null;
  return { detached: pick(raw.detached), destroyed: pick(raw.destroyed), regrow };
}

/** Часть отсутствует на теле (отсоединена или уничтожена). */
export const partMissing = (state, part) => !!(state.detached[part] || state.destroyed[part]);

/** Голова без торса (Модульная Автономия): Hoverer, Размер −2. */
export const headOnly = state => partMissing(state, "torso");

/** Обе ноги отсоединены (Скорпион выпускает жало). Уничтоженные ноги — тоже «нет ног». */
export const legsGone = state => partMissing(state, "leftLeg") && partMissing(state, "rightLeg");

/** Скорпион действует: Талант и обе ноги отсоединены, торс на месте. */
export function scorpioActive(actor, state = frameState(actor)) {
  return hasScorpio(actor) && !headOnly(state) && legsGone(state);
}

/**
 * Сдвиг Размера от состояния фрейма: голова без торса −2 (Модульная
 * Автономия), иначе жало Скорпиона −1. Без Таланта — 0 (метка могла остаться
 * от снятого Таланта).
 */
export function frameSizeShift(actor) {
  const state = frameState(actor);
  if (headOnly(state) && hasModularAutonomy(actor)) return -2;
  if (scorpioActive(actor, state)) return -1;
  return 0;
}

/**
 * Сколько мехадендритов остаётся в деле: без торса — только головные
 * (Черепная Мантия, два), иначе все.
 */
export function usableDendrites(actor, total, state = frameState(actor)) {
  const n = Math.max(0, Number(total) || 0);
  if (!headOnly(state)) return n;
  return hasCranialMantle(actor) ? Math.min(CRANIAL_MANTLE_DENDRITES, n) : 0;
}

/**
 * Отсоединить/присоединить часть. Возвращает новое состояние и цену в
 * Когниции (присоединение конечности — 1 у Разделения), или отказ.
 * @param {"detach"|"attach"|"destroy"} action
 */
export function frameChange(state, part, action) {
  if (!FRAME_PARTS[part]) return { ok: false, reason: "нет такой части" };
  const next = { detached: { ...state.detached }, destroyed: { ...state.destroyed }, regrow: state.regrow };
  if (action === "detach") {
    if (partMissing(state, part)) return { ok: false, reason: "уже отсоединена" };
    next.detached[part] = true;
    return { ok: true, state: next, cost: 0 };
  }
  if (action === "attach") {
    if (!state.detached[part]) return { ok: false, reason: state.destroyed[part] ? "уничтожена — только Куколкой" : "и так на месте" };
    next.detached[part] = false;
    return { ok: true, state: next, cost: FRAME_PARTS[part].limb ? DISJOINT_ATTACH_COST : 0 };
  }
  if (action === "destroy") {
    next.detached[part] = false;
    next.destroyed[part] = true;
    return { ok: true, state: next, cost: 0 };
  }
  return { ok: false, reason: "неизвестное действие" };
}

/**
 * Куколка: прибавить восстановленные Раны к копилке отращивания части.
 * Набрав цену (7/20), часть отрастает (снимается «уничтожена»), остаток копилки
 * пропадает.
 */
export function chrysalisProgress(state, part, healed) {
  const meta = FRAME_PARTS[part];
  if (!meta) return { state, wounds: 0, done: false, need: 0 };
  const prev = state.regrow?.part === part ? state.regrow.wounds : 0;
  const wounds = prev + Math.max(0, Number(healed) || 0);
  const next = { detached: { ...state.detached }, destroyed: { ...state.destroyed }, regrow: { part, wounds } };
  if (wounds >= meta.regrow) {
    next.destroyed[part] = false;
    next.detached[part] = false;
    next.regrow = null;
    return { state: next, wounds: meta.regrow, done: true, need: meta.regrow };
  }
  return { state: next, wounds, done: false, need: meta.regrow };
}

/** Прервал контакт с материалами — накопленное пропадает. */
export const chrysalisReset = state => ({ ...state, regrow: null });

// ── Вуаль Парадокса ──────────────────────────────────────────────────────────

/** Режимы Вуали: выключена, полная, частичная (невидим для визуальных сенсоров, но слышим/тепловизор). */
export const VEIL_MODES = { off: "выключена", full: "полностью", partial: "частично (только визуальные сенсоры)" };

export function veilMode(actor) {
  const m = flagOf(actor, VEIL_FLAG);
  return m === "full" || m === "partial" ? m : "off";
}

/** Наблюдатель — полностью кибернетический Механикум (Черта Machine). */
export const fullyCybernetic = actor => hasItemNamed(actor, "Machine", ["trait"]);

/**
 * Правила для наблюдателя: если цель теста — носитель включённой Вуали, а сам
 * наблюдатель полностью кибернетический, его Внимательность против цели
 * проваливается («невидим, неслышим и неощутим»). Частичная Вуаль оставляет
 * его слышимым — тогда провал только у зрения не отделить от слуха в одном
 * тесте, и правило молчит (решает ГМ).
 */
export function paradoxVeilRules(actor, ctx = {}) {
  const target = ctx?.targetActor;
  if (!target || target === actor || !hasParadoxVeil(target) || veilMode(target) !== "full") return [];
  if (!fullyCybernetic(actor)) return [];
  return [{
    id: "techAssassin.paradoxVeil", label: "Вуаль Парадокса",
    when: {},
    effects: [{ kind: "autoFail", target: ["skill:awareness"], label: "🫥 Вуаль Парадокса: цель невидима для Механикум" }]
  }];
}
