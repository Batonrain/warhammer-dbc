// module/rules/monodevotant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Monodevotant / Монозависимый (Черта Миньона): «без субстанции 1d10+W.b
//  дней — штраф −10 ко всем Характеристикам (−5 за каждый доп. день); может
//  покинуть хозяина или умереть».
//
//  Как прочитано: Миньон получил субстанцию — с этого момента бросается срок
//  1d10+W.b дней (один раз на дозу). Пока срок не вышел, штрафа нет. В день,
//  когда срок вышел, — −10 ко всем тестам Характеристик; каждый следующий
//  полный день без субстанции — ещё −5. Новая доза снимает штраф и бросает
//  срок заново.
//
//  Состояние — флаги на самой Черте (как Крючок Сывороток Репликанта,
//  rules/replicant.mjs): когда дана субстанция (worldTime, сек) и выпавший
//  срок в днях. Без отметки дозы штрафа нет: Черта, взятая до этой механики,
//  задним числом не наказывается.
//
//  Штраф — автоматический модификатор ко всем броскам (rollBonus "all"),
//  правило от времени мира, тот же приём, что у Зависимости от наркотика.
//  «Покинуть хозяина или умереть» — решение ГМа.
//  Чистые функции, test/rules/monodevotant.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

export const NS = "warhammer-dbc";
export const SUBSTANCE_AT_FLAG = "monodevotantSubstanceAt";
export const GRACE_DAYS_FLAG   = "monodevotantGraceDays";
export const GRACE_FORMULA     = "1d10";
export const BASE_PENALTY      = 10;
export const DAILY_PENALTY     = 5;

const NAME_RE = /^(Monodevotant|Монозависимый)\b/i;

/** Черта «Монозависимый» актора или null. */
export function monodevotantTrait(actor) {
  for (const i of actor?.items ?? []) {
    if (i?.type !== "trait") continue;
    const names = String(i.name ?? "").split(" / ").map(s => s.trim());
    if (names.some(n => NAME_RE.test(n))) return i;
  }
  return null;
}

function flagOf(item, key) {
  return item?.getFlag?.(NS, key) ?? item?.flags?.[NS]?.[key];
}

/**
 * Размер штрафа (положительное число) на момент `now`.
 * @param {number|null} substanceAt  когда дана субстанция (сек)
 * @param {number} graceDays  выпавший срок 1d10+W.b
 * @param {number} now
 */
export function monodevotantPenalty(substanceAt, graceDays, now) {
  const at = Number(substanceAt);
  if (substanceAt === null || substanceAt === undefined || !Number.isFinite(at)) return 0;
  const grace = Math.max(0, Math.trunc(Number(graceDays) || 0));
  const days = Math.floor((Number(now) - at) / SECONDS_PER_DAY);
  if (!(days >= grace)) return 0;
  return BASE_PENALTY + DAILY_PENALTY * (days - grace);
}

/** Сколько дней осталось до ломки (0 — уже ломка, null — субстанцию не отмечали). */
export function monodevotantDaysLeft(substanceAt, graceDays, now) {
  const at = Number(substanceAt);
  if (substanceAt === null || substanceAt === undefined || !Number.isFinite(at)) return null;
  const days = Math.floor((Number(now) - at) / SECONDS_PER_DAY);
  return Math.max(0, Math.trunc(Number(graceDays) || 0) - days);
}

/** Источник правил «monodevotant»: штраф ломки на момент `now`. */
export function monodevotantRules(actor, now) {
  const trait = monodevotantTrait(actor);
  if (!trait) return [];
  const pen = monodevotantPenalty(flagOf(trait, SUBSTANCE_AT_FLAG), flagOf(trait, GRACE_DAYS_FLAG), now);
  if (!pen) return [];
  const label = `Монозависимый: ломка без субстанции −${pen}`;
  return [{
    id: "minion.monodevotant.withdrawal", label, when: {},
    effects: [{ kind: "rollBonus", target: "all", value: -pen, label, auto: true }]
  }];
}

// ── Исход ломки — развилка ГМа (Sahara 582) ─────────────────────────────────
// «От длительной ломки Миньон может покинуть своего хозяина или даже умереть»:
// книга не даёт ни теста, ни срока — решает ГМ. Система не решает за него, но
// и не молчит: каждый раз, когда штраф ломки вырос (наступил новый день без
// дозы), ГМу приходит карточка с тремя кнопками — держится / уходит от
// хозяина / умирает. Последний показанный штраф — флаг на Черте, чтобы одна и
// та же ступень не спрашивалась дважды; новая доза снимает метку.
export const NOTICED_FLAG = "monodevotantNoticedPenalty";
export const WITHDRAWAL_OUTCOMES = ["stay", "leave", "die"];

/**
 * Пора ли спросить ГМа об исходе ломки: штраф > 0 и вырос с прошлого вопроса.
 * @returns {number} текущий штраф, если пора; иначе 0
 */
export function withdrawalNoticeDue(trait, now) {
  if (!trait) return 0;
  const pen = monodevotantPenalty(flagOf(trait, SUBSTANCE_AT_FLAG), flagOf(trait, GRACE_DAYS_FLAG), now);
  if (!pen) return 0;
  return pen > (Number(flagOf(trait, NOTICED_FLAG)) || 0) ? pen : 0;
}

/** Правка Миньона по выбранному исходу (null — ничего не меняется). */
export function withdrawalOutcomeUpdate(outcome) {
  if (outcome === "leave") return { "system.masterUuid": "" };
  if (outcome === "die") return { "flags.warhammer-dbc.deceased": true };
  return null;
}
