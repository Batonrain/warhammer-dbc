// module/rules/on-target-fail.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Состояние цели делегированного теста Сопротивления при провале»
//  (kind:"condition" condMode:"onTargetFail", wdbc-tqfj — Choir of Poxes:
//  «...получает 1d10+PR C, Pen 0, и Оглушение до начала своего Хода»).
//
//  ЖИВОЙ запрос, как immunity/mitigate (condition-guards.mjs/item-rules.mjs):
//  предмет ничего не пишет при получении (applyMechEntry — no-op для этого
//  режима), читается здесь, в момент финализации теста. Вызывается ОДИН раз —
//  из module/sheets/actor-sheet.mjs::_runTest, единой точки финализации
//  ЛЮБОГО делегированного теста Навыка/Характеристики (genericTest,
//  hooks.mjs::registerDelegatedTestOpener("genericTest", ...)).
//
//  Payload делегированного теста несёт только itemUuid источника (примитив —
//  delegate-test.mjs::requestDelegatedTest шлёт ChatMessage.flags, туда идут
//  только строки/числа/booleans, не документы). Mechanics самого предмета
//  перечитывается ЗАНОВО здесь, а не кэшируется в payload: источник мог
//  измениться (Механику предмета переделали, сам предмет сняли) за время
//  между запросом теста и ответом исполнителя.
//
//  ВАЖНО (genericTest — общая инфраструктура, не только психосилы
//  Сопротивления): applyOnTargetFailConditions звать ТОЛЬКО когда itemUuid
//  реально пришёл в payload теста — это поле кладёт ИСКЛЮЧИТЕЛЬНО
//  psychic.mjs при запросе теста Сопротивления манифестированной психосилы
//  (см. hooks.mjs, .psy-resist-request-btn). Ни showDelegateTestPicker, ни
//  диалоговая кнопка «Делегировать» такое поле не ставят — обычный тест
//  Навыка/Характеристики эту функцию не вызывает вовсе, поэтому отдельного
//  gate внутри неё не требуется: пустой itemUuid уже отсекается первой же
//  проверкой.
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { applyConditionWithDuration } from "../combat/condition-effects.mjs";
import { conditionEntryTerm, conditionHasLevelInput } from "./condition-duration.mjs";
import { mechFormulaTotalSafe, mechRollData } from "./mech-formula.mjs";
import { entryWhenOk } from "./mech-when.mjs";

const SYSTEM = "warhammer-dbc";

const mechanicsOf = (item) => {
  const raw = item?.flags?.[SYSTEM]?.mechanics;
  return Array.isArray(raw) ? raw : [];
};

/**
 * Записи kind:"condition" condMode:"onTargetFail" ОДНОГО предмета. Тот же
 * обход И/ИЛИ, что у collectMitigations/rulesFromItemMechanics
 * (rules/item-rules.mjs): ИЛИ-ветки не просматриваются — выбор в них делается
 * один раз диалогом при выдаче, а не здесь.
 */
function onTargetFailEntriesOf(item, actor) {
  const out = [];
  const walk = (entries, operator) => {
    if (operator === "OR") return;
    for (const entry of entries || []) {
      if (entry?.kind === "group" && entry.group) {
        walk(entry.group.entries, entry.group.operator);
        continue;
      }
      if (entry?.kind !== "condition" || (entry.condMode || "apply") !== "onTargetFail") continue;
      const key = String(entry.condKey || "").trim();
      if (!key || !CONDITIONS_DEF[key]) continue;
      if (!entryWhenOk(actor, entry, item)) continue;
      out.push(entry);
    }
  };
  for (const group of mechanicsOf(item)) walk(group.entries, group.operator);
  return out;
}

/**
 * Применяет к effectTargetActor (цель, ПРОВАЛИВШАЯ делегированный тест
 * Сопротивления) все onTargetFail-записи предмета itemUuid. Величина/срок —
 * те же формулы mech-formula.mjs, что у обычного «Наложить», но считаются от
 * АКТОРА-ВЛАДЕЛЬЦА предмета (кастера, PR/Cor.b/характеристики каста), не от
 * цели — ровно как книга формулирует «PR» у психосил (эПР кастера).
 *
 * Иммунитет получателя проверяется ВНУТРИ applyConditionWithDuration той же
 * единой точкой, что и остальные пути наложения (wdbc-fejd) — здесь её
 * результат только собирается в заметку для карточки.
 *
 * @returns {Array<{label:string, applied:boolean}>} пусто — либо itemUuid
 *   не дан, либо у предмета нет ни одной onTargetFail-записи (обычный,
 *   не-триггерный genericTest). applied:false у найденной записи означает
 *   иммунитет цели — это нужно показать вслух, не молчать (тот же принцип,
 *   что у остальных «живых запросов» этой системы).
 */
export async function applyOnTargetFailConditions(itemUuid, effectTargetActor) {
  if (!itemUuid || !effectTargetActor) return [];
  const item = await fromUuid(itemUuid).catch(() => null);
  if (!item) return [];
  const casterActor = item.actor ?? null;
  const rd = mechRollData(casterActor);
  const num = (f) => Math.max(1, Math.round(mechFormulaTotalSafe(f ?? "1", rd)));
  const out = [];
  for (const entry of onTargetFailEntriesOf(item, casterActor)) {
    const key = entry.condKey;
    const level = conditionHasLevelInput(key) ? num(entry.condLevel) : null;
    const term = conditionEntryTerm(entry);
    const applied = await applyConditionWithDuration(effectTargetActor, key, {
      level, value: term.unit ? num(term.value) : 0, unit: term.unit
    });
    out.push({ label: CONDITIONS_DEF[key]?.label ?? key, applied });
  }
  return out;
}
