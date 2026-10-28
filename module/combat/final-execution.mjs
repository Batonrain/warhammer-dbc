// module/combat/final-execution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОКОНЧАТЕЛЬНАЯ КАЗНЬ / Final Execution (Мастер Казней, Талант; Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Текст: «Совершая атаку Казнью, может потратить Очко Трофеев, чтобы первая атака получила свойства
//  Extreme(9) и Proven(5), а каждая следующая атака Казни — накапливающиеся −1 к рейтингу Extreme и +1 к
//  Proven. Если такая атака убивает добычу, получает Трейт Fear(2) (сверхъестественный) на 1 Раунд.»
//
//  Как устроено (по образцу Смертельного Танца, combat/death-dance.mjs): кнопка в окне рукопашной атаки
//  (sheets/attack/markup.mjs + dialog.mjs) ВООРУЖАЕТ намерение, а Очко Трофеев списывается только при
//  подтверждении атаки — закрытый диалог ничего не сжигает. Свойства Extreme/Proven едут в атаку записями
//  `ruleProps` (attack.mjs доливает их в свойства оружия). Серия — Раунд боя (Казнь раз в Раунд, трейт
//  Execution): первая атака серии платит Очко, следующие атаки того же Раунда продолжают её бесплатно, со
//  свойствами сильнее (Extreme на 1 ниже — легче, Proven на 1 выше). Вне боя серий нет.
//  НЕ смоделировано: сам Трейт «Казнь» (доп. атаки при не-убийстве) и Fear(2) за убийство — вручную.
// ════════════════════════════════════════════════════════════════════════════

import { trophyUpdate, trophyValue } from "../rules/trophy-points.mjs";

const NS = "warhammer-dbc";

/** Флаг серии: { combatId, round, n } — сколько атак серии этого Раунда уже сделано. */
export const FINAL_EXECUTION_FLAG = "finalExecution";

/** Текст-напоминание для окна атаки. */
export const FINAL_EXECUTION_TEXT = "Extreme(9) и Proven(5) первой атаке серии; каждая следующая атака Казни: Extreme на 1 ниже, Proven на 1 выше.";

/** Талант опознаётся по имени предмета (по нему же находит носителя tools/capability-reachability.mjs). */
const FINAL_EXECUTION_MATCH = /Final Execution|Окончательная Казнь/i;

/** Владеет ли актор Талантом (Талант, не Черта-тёзка). */
export function hasFinalExecution(actor) {
  return (actor?.items ?? []).some(i => i?.type === "talent" && FINAL_EXECUTION_MATCH.test(i.name));
}

/** Свойства оружия для атаки номер `n` серии (0 — первая): Extreme(9−n), Proven(5+n). Extreme не ниже 2. */
export function finalExecutionProps(n = 0) {
  const k = Math.max(0, Number(n) || 0);
  return [
    { key: "extreme", rating: Math.max(2, 9 - k) },
    { key: "proven", rating: 5 + k }
  ];
}

/** Номер следующей атаки серии и цена: новая серия — 0 и 1 Очко Трофеев, продолжение — n и бесплатно. */
export function finalExecutionStep(actor) {
  const combat = globalThis.game?.combat;
  const rec = actor?.getFlag?.(NS, FINAL_EXECUTION_FLAG);
  const live = !!combat?.id && rec?.combatId === combat.id && Number(rec.round) === (Number(combat.round) || 0);
  return live ? { n: Number(rec.n) || 0, cost: 0 } : { n: 0, cost: 1 };
}

/** Можно ли сейчас применить Окончательную Казнь: Талант и (на новой серии) Очко Трофеев. */
export function finalExecutionGate(actor) {
  if (!hasFinalExecution(actor)) return { ok: false, reason: "Нет Таланта «Окончательная Казнь».", cost: 0, n: 0 };
  const { n, cost } = finalExecutionStep(actor);
  if (cost > 0 && trophyValue(actor) < cost) return { ok: false, reason: "Нет Очка Трофеев.", cost, n };
  return { ok: true, cost, n };
}

/**
 * Подтверждённая атака: списать Очко (новая серия) и записать шаг серии. false — Очка нет, ничего не записано.
 * Звать ПОСЛЕ подтверждения атаки (кнопка «Бросок!»), не по клику вооружения.
 */
export async function commitFinalExecution(actor) {
  const gate = finalExecutionGate(actor);
  if (!gate.ok) return false;
  if (gate.cost > 0) {
    const patch = trophyUpdate(actor, -gate.cost);
    if (!patch) return false;
    await actor.update(patch);
  }
  const combat = globalThis.game?.combat;
  if (combat?.id) {
    await actor.setFlag(NS, FINAL_EXECUTION_FLAG, { combatId: combat.id, round: Number(combat.round) || 0, n: gate.n + 1 });
  }
  return true;
}

/** Строка окна атаки: кнопка-«вооружение» и статус (наполняет dialog.mjs). Пусто — не носителю / не в ближнем бою. */
export function finalExecutionRowHtml(actor, { isMelee = false } = {}) {
  if (!isMelee || !hasFinalExecution(actor)) return "";
  return `<div class="av-row" id="atk-final-execution-row">
      <label>Окончательная Казнь</label>
      <button type="button" id="atk-final-execution-btn" class="av-pill av-pill-disabled" disabled
        title="${FINAL_EXECUTION_TEXT} Очко Трофеев списывается при подтверждении атаки, один раз на серию (Раунд)."><span>Extreme + Proven</span></button>
      <span class="av-opt-note" id="atk-final-execution-status"></span>
    </div>`;
}
