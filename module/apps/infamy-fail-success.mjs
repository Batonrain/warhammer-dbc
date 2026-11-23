// module/apps/infamy-fail-success.mjs
// ════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка «провал → Очко Бесчестия → Успех на 1 Успех» (отбор —
//  module/rules/infamy-fail-success.mjs). Две вещи:
//    • кнопка в карточке проваленного теста (sheets/actor-sheet.mjs::_runTest);
//    • её обработчик (module/hooks.mjs, renderChatMessageHTML): списать Очко
//      Бесчестия через общую точку spendFromInfamyPool (временный запас
//      первым, Пустота Парии запрещает трату) и объявить исход карточкой.
//  Повтор с той же карточки запрещён флагом на сообщении — один провал
//  заменяется успехом один раз.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { infamyFailSuccessOptions, infamyFailSuccessSource } from "../rules/infamy-fail-success.mjs";
import { actorInfamyPath, actorInfamyValue, spendFromInfamyPool } from "./infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { postTestCard, testCardHtml, outcomeHtml } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { runCardOnce } from "../combat/card-once.mjs";
import { revertCardFailure, failUndoLineHtml } from "../combat/fear.mjs";
import { resourceFailSuccessOptions, resourceAmountLabel } from "../rules/resource-pools.mjs";
import { spendResource, resourceCostGate } from "./resource-pools.mjs";

/**
 * Кнопки для карточки проваленного теста — пустая строка, если ни одна
 * Черта актора этот тест не покрывает. `testLabel` уходит в data-атрибут,
 * чтобы карточка-итог назвала тест.
 */
export function infamyFailSuccessButtonsHtml(actor, { skill, char, success, testLabel = "", regeneration = false } = {}) {
  if (!actor || success) return "";
  // Тест Регенерации — не тест Навыка/Черты для Очков Бесчестия, только пулы.
  const options = regeneration ? [] : infamyFailSuccessOptions(flag => hasRuleFlag(actor, flag), { skill, char, success });
  // Пулы ресурсов архетипов (Очки Вдохновения Когитора: «при Провале любого
  // теста I или W заменить его 1 Успехом», Культивация Мейстера — только
  // Medicae и тест T Регенерации; rules/resource-pools.mjs).
  const pools = resourceFailSuccessOptions(actor, char, { skill, regeneration });
  if (!options.length && !pools.length) return "";
  const poolBtns = pools.map(d => {
    const gate = resourceCostGate(actor, d.key, 1);
    return `<button type="button" class="wh-resource-fail-success-btn" data-actor-uuid="${esc(actor.uuid)}"
      data-pool="${esc(d.key)}" data-test-label="${esc(testLabel)}"${regeneration ? ' data-regeneration="1"' : ""} ${gate.disabled ? "disabled" : ""}
      title="${esc(gate.title || `Потратить ${resourceAmountLabel(d.key, 1, d)}: тест засчитывается успешным на 1 Успех`)}">✦ ${esc(d.label)}: 1 → Успех (1)</button>`;
  });
  return `<div class="roll-threshold">${poolBtns.join(" ")}${options.map(o =>
    `<button type="button" class="wh-infamy-fail-success-btn" data-actor-uuid="${esc(actor.uuid)}"
      data-capability="${esc(o.capability)}" data-test-label="${esc(testLabel)}"
      title="Потратить 1 Очко Бесчестия: тест засчитывается успешным на 1 Успех">⚜ ${esc(o.label)}: Очко Бесчестия → Успех (1)</button>`
  ).join(" ")}</div>`;
}

/**
 * Обработчик кнопки. Возвращает true, если трата состоялась. Раз на карточку
 * `message` (combat/card-once.mjs, wdbc-6rjtc.3): двойной клик не списывает
 * дважды, чужую карточку помечает ГМ.
 * @param {Actor} actor
 * @param {string} capability имя возможности-источника
 * @param {{testLabel?:string, message:ChatMessage}} opts
 */
export async function spendInfamyForFailSuccess(actor, capability, { testLabel = "", message } = {}) {
  const src = infamyFailSuccessSource(capability);
  if (!actor || !src) return false;
  if (!hasRuleFlag(actor, capability)) {
    ui.notifications?.warn(`${actor.name}: нет Черты «${src.label}».`);
    return false;
  }
  return runCardOnce(message, "infamyFailSuccessUsed", async () => {
    if (actorInfamyValue(actor) < 1 && tempInfamyAmount(actor) < 1) {
      ui.notifications?.warn(`${actor.name}: нет Очков Бесчестия.`);
      return false;
    }
    const path = actorInfamyPath(actor);
    const spend = await spendFromInfamyPool(actor, 1, path);
    if (!spend) return false;
    if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
    // Провал заменён успехом — Шок/Ступор, наложенные этим провалом, снимаются (task-e30b).
    const reverted = await revertCardFailure(message);
    await postTestCard(actor, testCardHtml({
      icon: "⚜ ", title: `${esc(src.label)}${testLabel ? ` — ${esc(testLabel)}` : ""}`,
      lines: [`<div class="roll-threshold" style="font-size:0.85em;">Потрачено Очко Бесчестия${
        spend.tempSpent ? " (из временного запаса)" : ""}. Осталось: <b>${actorInfamyValue(actor) + tempInfamyAmount(actor)}</b>.</div>`,
        failUndoLineHtml(reverted)],
      outcome: outcomeHtml(true, "Провал заменён: Успех — 1 Успех")
    }), { sound: false, ignoreRollMode: true });
    return true;
  }, "Этот провал уже заменён успехом.");
}

/**
 * Провал → Успех на 1 Успех за 1 очко пула ресурса архетипа (кнопка
 * .wh-resource-fail-success-btn). Тот же замок карточки, что у траты
 * Бесчестия: один провал заменяется успехом один раз.
 */
export async function spendResourceForFailSuccess(actor, key, { testLabel = "", message } = {}) {
  if (!actor || !key) return false;
  return runCardOnce(message, "infamyFailSuccessUsed", async () => {
    const res = await spendResource(actor, key, 1, { silent: true });
    if (!res) return false;
    const reverted = await revertCardFailure(message);
    await postTestCard(actor, testCardHtml({
      icon: "✦ ", title: `${esc(res.label)}${testLabel ? ` — ${esc(testLabel)}` : ""}`,
      lines: [`<div class="roll-threshold" style="font-size:0.85em;">Потрачено: ${esc(resourceAmountLabel(key, 1))}. Осталось: <b>${res.after}</b> / ${res.max}.</div>`,
        failUndoLineHtml(reverted)],
      outcome: outcomeHtml(true, "Провал заменён: Успех — 1 Успех")
    }), { sound: false, ignoreRollMode: true });
    return true;
  }, "Этот провал уже заменён успехом.");
}
