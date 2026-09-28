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

const FLAG = "warhammer-dbc";
const USED_FLAG = "infamyFailSuccessUsed";

/**
 * Кнопки для карточки проваленного теста — пустая строка, если ни одна
 * Черта актора этот тест не покрывает. `testLabel` уходит в data-атрибут,
 * чтобы карточка-итог назвала тест.
 */
export function infamyFailSuccessButtonsHtml(actor, { skill, char, success, testLabel = "" } = {}) {
  if (!actor || success) return "";
  const options = infamyFailSuccessOptions(flag => hasRuleFlag(actor, flag), { skill, char, success });
  if (!options.length) return "";
  return `<div class="roll-threshold">${options.map(o =>
    `<button type="button" class="wh-infamy-fail-success-btn" data-actor-uuid="${esc(actor.uuid)}"
      data-capability="${esc(o.capability)}" data-test-label="${esc(testLabel)}"
      title="Потратить 1 Очко Бесчестия: тест засчитывается успешным на 1 Успех">⚜ ${esc(o.label)}: Очко Бесчестия → Успех (1)</button>`
  ).join(" ")}</div>`;
}

/**
 * Обработчик кнопки. Возвращает true, если трата состоялась.
 * @param {Actor} actor
 * @param {string} capability имя возможности-источника
 * @param {{testLabel?:string, message?:ChatMessage}} [opts]
 */
export async function spendInfamyForFailSuccess(actor, capability, { testLabel = "", message = null } = {}) {
  const src = infamyFailSuccessSource(capability);
  if (!actor || !src) return false;
  if (!hasRuleFlag(actor, capability)) {
    ui.notifications?.warn(`${actor.name}: нет Черты «${src.label}».`);
    return false;
  }
  if (message?.getFlag?.(FLAG, USED_FLAG)) {
    ui.notifications?.warn("Этот провал уже заменён успехом.");
    return false;
  }
  if (actorInfamyValue(actor) < 1 && tempInfamyAmount(actor) < 1) {
    ui.notifications?.warn(`${actor.name}: нет Очков Бесчестия.`);
    return false;
  }
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return false;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  if (message?.setFlag) await message.setFlag(FLAG, USED_FLAG, true);
  await postTestCard(actor, testCardHtml({
    icon: "⚜ ", title: `${esc(src.label)}${testLabel ? ` — ${esc(testLabel)}` : ""}`,
    lines: [`<div class="roll-threshold" style="font-size:0.85em;">Потрачено Очко Бесчестия${
      spend.tempSpent ? " (из временного запаса)" : ""}. Осталось: <b>${actorInfamyValue(actor) + tempInfamyAmount(actor)}</b>.</div>`],
    outcome: outcomeHtml(true, "Провал заменён: Успех — 1 Успех")
  }), { sound: false, ignoreRollMode: true });
  return true;
}
