// module/rules/warlock-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Чернокнижник (Элитный архетип, «Псайкеры и оккультисты») — чистая часть.
//  Обвязка — module/combat/warlock.mjs; окно манифестации —
//  combat/psyker-elite-hooks.mjs.
//
//  Тёмные Искусства (Черта архетипа): «Может манифестировать психосилы, только
//  используя Пути Силы (Инкантации, Медитация, Жертва, Нечестивые Символы), не
//  может манифестировать без Пути или использовать психосилы-реакции …
//  Манифестирует только в Обычном режиме». Маг-Каннибал и Последнее Эхо на
//  время снимают эти ограничения («как обычный псайкер»), Варп-Танцор
//  разрешает без Пути и реакции ценой второго броска A.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
/** Пути Силы, доступные Тёмным Искусствам. */
export const DARK_ARTS_PATHS = ["incantation", "meditation", "sacrifice", "unholy"];
/** Метка «как обычный псайкер»: { turns, source:"cannibal"|"echo" } — счётчик начал своего Хода. */
export const DARK_ARTS_FREE_FLAG = "darkArtsFree";
/** Тихий Ученик: накопленные Успехи по имени силы. */
export const SILENT_STUDENT_FLAG = "silentStudent";
/** Транскрипция: дни обучения по имени силы { ok, fail }. */
export const TRANSCRIPTION_FLAG = "transcription";

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

export const hasDarkArts = actor => traits(actor).some(i => itemHasName(i, "Dark Arts"));
export const hasTranscription = actor => traits(actor).some(i => itemHasName(i, "Transcription"));
export const hasCannibalMage = actor => hasTalent(actor, "Cannibal Mage");
export const hasFinalEcho = actor => hasTalent(actor, "Final Echo");
export const hasHighRitualist = actor => hasTalent(actor, "High Ritualist");
export const hasInterpreter = actor => hasTalent(actor, "Interpreter");
export const hasListener = actor => hasTalent(actor, "Listener");
export const hasSilentStudent = actor => hasTalent(actor, "Silent Student");
export const hasWarpDancer = actor => hasTalent(actor, "Warp Dancer");

/** Действует ли «как обычный псайкер» (Маг-Каннибал / Последнее Эхо). */
export function darkArtsFree(actor) {
  const st = flagOf(actor, DARK_ARTS_FREE_FLAG);
  return st && (Number(st.turns) || 0) > 0 ? st : null;
}

/**
 * Гейт манифестации Тёмных Искусств.
 * @returns {{ok:boolean, reason:string, warpDance:boolean}}
 */
export function darkArtsGate(actor, { path = "", mode = "normal", action = "half" } = {}) {
  if (!hasDarkArts(actor) || darkArtsFree(actor)) return { ok: true, reason: "", warpDance: false };
  if (mode !== "normal") return { ok: false, reason: "Тёмные Искусства: манифестация только в Обычном режиме.", warpDance: false };
  const reaction = action === "reaction";
  const darkPath = DARK_ARTS_PATHS.includes(path);
  if (darkPath && !reaction) return { ok: true, reason: "", warpDance: false };
  // Варп-Танцор: без Пути и реакции — можно, но сила Физическая и два броска.
  if (hasWarpDancer(actor) && (!path || darkPath)) return { ok: true, reason: "", warpDance: true };
  return {
    ok: false, warpDance: false,
    reason: reaction
      ? "Тёмные Искусства: психосилы-реакции недоступны (снимают Маг-Каннибал, Последнее Эхо; Варп-Танцор — двумя бросками)."
      : "Тёмные Искусства: нужен Путь Силы — Инкантация, Медитация, Жертва или Нечестивые Символы."
  };
}

/**
 * Варп-Танцор: исход двух бросков. Нужно преуспеть в обоих; берётся тот, где
 * меньше Успехов (при провале — провал с большим числом Провалов).
 */
export function warpDanceOutcome(main, ag) {
  if (main.success && ag.success) return { success: true, deg: Math.min(main.deg, ag.deg) };
  const fails = [main, ag].filter(r => !r.success).map(r => r.deg);
  return { success: false, deg: Math.max(...fails) };
}

/** Высший Ритуалист: I вместо W или P в психотесте, если I выше. */
export function highRitualistKey(actor, key) {
  if (!hasHighRitualist(actor) || (key !== "wp" && key !== "per")) return key;
  const c = actor?.system?.characteristics ?? {};
  return (Number(c.int?.total) || 0) > (Number(c[key]?.total) || 0) ? "int" : key;
}

/** Тихий Ученик: хватает ли Успехов (стоимость/50, окр.▲). */
export function silentStudentNeed(cost) {
  return Math.max(1, Math.ceil((Number(cost) || 0) / 50));
}
