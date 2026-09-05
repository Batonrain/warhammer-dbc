// module/combat/suppression.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ПОДАВЛЕНИЕ (стр. 32-33): тест на W+0, тест Морали. Провал → состояние
//  «Подавлен» (system.conditions.pinned — уже существовало как флаг, но
//  ничего не читало; теперь есть сам тест, который его накладывает).
//  Снимается тестом W+0 (+30, если стрелок и округа 10м не обстреливались с
//  конца предыдущего Хода стрелка — бонус не автоматизирован, решает ГМ) в
//  конце Хода Подавленного.
// ─────────────────────────────────────────────────────────────────────────────

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";

/** Стрелковая RoF, которой ведётся Стрельба на Подавление, задаёт штраф цели. */
export function suppressionTestMod(sys) {
  return (Number(sys?.rof_full) || 0) > 0 ? -20 : -10;
}

/**
 * Тест на Подавление одной цели. mod — сумма штрафов (RoF-модификатор,
 * Импульсное и т.п.), уже посчитанная снаружи.
 */
export async function rollSuppressionTest(actor, { mod = 0, sourceLabel = "" } = {}) {
  const wpTotal   = actor.system.characteristics?.wp?.total ?? 0;
  const { eff: threshold, parts, roll, rv, rerollNote, success: rolledSuccess, dof, usedReroll } = await rollMoraleTest(actor, wpTotal + mod);
  // Саркофаг Дредноута (стр. 57, wdbc-drn): автоматически проходит тесты
  // Подавления независимо от броска.
  const success   = rolledSuccess || hasRuleFlag(actor, "sarcophagus.autoPassFear");

  if (!success) await actor.update(conditionApplyFields("pinned"));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  // Подписи, а не голая сумма (wdbc-kuun): раньше здесь стояло « +30 -10»
  // без объяснения, откуда −10 — тот же дефект, что живая проверка нашла в
  // Командовании и Ударе Ассасина.
  const modParts = [mod !== 0 ? `модификатор ${mod >= 0 ? "+" : ""}${mod}` : "", ...parts];
  await postTestCard(actor, {
    icon: rollIcon("target","#ff9a4d"),
    title: `Тест Подавления${sourceLabel ? ` — ${esc(sourceLabel)}` : ""} → ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "WP", base: wpTotal, parts: modParts, threshold }),
    rv, rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — сохраняет самообладание</span>`
      : `<span class="roll-failure">Провал — Подавлен (📌)</span>`
  }, { rolls: [roll] });
  return { success, rv, threshold };
}

/**
 * Напоминание в конце Хода Подавленного персонажа (стр. 33) — две кнопки:
 * обычный тест и тест с +30 (округа не обстреливалась — решает ГМ, не
 * автоопределяется). Зовётся из hooks.mjs при смене Хода, если у уходящего
 * актора стоит conditions.pinned.
 */
export async function postSuppressionRecoveryPrompt(actor) {
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#ff9a4d")}${esc(actor.name)} Подавлен(а) — конец Хода</div>
        <div class="roll-threshold">Тест W+0 на преодоление Подавления (+30, если сам и округа 10м не обстреливались с конца предыдущего Хода — решает ГМ).</div>
        <div class="roll-defense-btns">
          <button class="wh-suppression-recovery-btn" type="button" data-actor-uuid="${actor.uuid}" data-bonus="0">Тест (+0)</button>
          <button class="wh-suppression-recovery-btn" type="button" data-actor-uuid="${actor.uuid}" data-bonus="30">Тест (+30, тихо)</button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/**
 * Тест на преодоление Подавления (конец Хода Подавленного). bonus — обычно
 * +30, если решает ГМ (округа не обстреливалась) — передаётся снаружи,
 * авто-определения «обстреливали ли рядом» нет.
 */
export async function rollSuppressionRecovery(actor, { bonus = 0 } = {}) {
  const wpTotal   = actor.system.characteristics?.wp?.total ?? 0;
  const { eff: threshold, parts: ruleParts, roll, rv, rerollNote, success: rolledSuccess, dof, usedReroll } = await rollMoraleTest(actor, wpTotal + bonus);
  // Саркофаг Дредноута (стр. 57, wdbc-drn): та же возможность, что и на самом
  // тесте Подавления выше — практически недостижимо (auto-pass не даёт
  // Подавлению вообще наступить), но на случай ручного наложения ГМом.
  const success   = rolledSuccess || hasRuleFlag(actor, "sarcophagus.autoPassFear");

  if (success) await actor.update(conditionRemoveFields("pinned"));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  const bonusParts = [bonus !== 0 ? `тишина ${bonus >= 0 ? "+" : ""}${bonus}` : "", ...ruleParts];
  await postTestCard(actor, {
    icon: rollIcon("target","#4dffa6"), title: `Преодоление Подавления → ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "WP", base: wpTotal, parts: bonusParts, threshold }),
    rv, rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — Подавление снято</span>`
      : `<span class="roll-failure">Провал — всё ещё Подавлен</span>`
  }, { rolls: [roll] });
  return { success, rv, threshold };
}
