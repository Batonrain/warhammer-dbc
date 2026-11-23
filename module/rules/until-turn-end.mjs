// module/rules/until-turn-end.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Состояние «до конца своего следующего Хода» (Sahara 586-8aaf; первый носитель — Варп Вспышка Когтя Варпа:
//  «Ослепнуть до конца своего следующего Хода»).
//
//  Почему не счётчик Раундов Состояния: он тикает в НАЧАЛЕ Хода носителя (combat/condition-ticks.mjs::
//  processConditionTurnStart) — «1 Раунд» снимал Ослепление ещё до Хода цели, и Ход она проводила зрячей.
//  И не штатная Duration ActiveEffect: её «turnEnd» привязан к Ходу НАЛОЖИВШЕГО (rules/condition-duration.mjs).
//
//  Метка на носителе flags.warhammer-dbc.conditionUntilTurnEnd = { <ключ Состояния>: сколько концов своих
//  Ходов осталось }. Наложено в чужой Ход — 1, в свой — 2 (свой текущий «следующим» не считается; тот же
//  счёт, что rules/resilience-talents.mjs::hellishResilienceTurnEnds). Конец Хода носителя (processConditionTurnEnd)
//  уменьшает и снимает Состояние на нуле; начало Хода такие Состояния не декрементирует.
//
//  Чистый модуль: без Foundry.
// ════════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";
export const UNTIL_TURN_END_FLAG = "conditionUntilTurnEnd";

/** Добавить Состояние в метку (повторное наложение не укорачивает). */
export function untilTurnEndAdd(flag, key, { ownTurn = false } = {}) {
  const next = { ...(flag ?? {}) };
  next[key] = Math.max(Number(next[key]) || 0, ownTurn ? 2 : 1);
  return next;
}

/** Конец Хода носителя: { next — метка после шага (null — пусто), expired — ключи Состояний снять }. */
export function untilTurnEndStep(flag) {
  const next = {};
  const expired = [];
  for (const [key, n] of Object.entries(flag ?? {})) {
    const left = (Number(n) || 0) - 1;
    if (left > 0) next[key] = left;
    else expired.push(key);
  }
  return { next: Object.keys(next).length ? next : null, expired };
}

/** Срок этого Состояния ведёт метка (общий счётчик Раундов его пропускает). */
export function untilTurnEndHeld(actor, key) {
  const flag = actor?.flags?.[NS]?.[UNTIL_TURN_END_FLAG] ?? actor?.getFlag?.(NS, UNTIL_TURN_END_FLAG);
  return !!flag && (Number(flag[key]) || 0) > 0;
}
