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
import { hasRuleFlag } from "../rules/flags.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";

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
  const { eff: threshold, bonus, roll, rv, rerollNote, success: rolledSuccess, dof: rolledDof, usedReroll }
    = await rollMoraleTest(actor, wpTotal + mod);
  // Саркофаг Дредноута (стр. 57, wdbc-drn): автоматически проходит тесты
  // Подавления независимо от броска.
  const sarcophagusAutoPass = hasRuleFlag(actor, "sarcophagus.autoPassFear");
  const success = rolledSuccess || sarcophagusAutoPass;
  const dof = sarcophagusAutoPass ? 0 : rolledDof;
  const rollMode  = game.settings.get("core", "rollMode");

  if (!success) await actor.update({ "system.conditions.pinned": true });
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  const modLine = mod !== 0 || bonus !== 0
    ? ` ${mod >= 0 ? "+" : ""}${mod}${bonus ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : ""}` : "";
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#ff9a4d")}Тест Подавления${sourceLabel ? ` — ${esc(sourceLabel)}` : ""} → ${esc(actor.name)}</div>
        <div class="roll-threshold">WP: <b>${wpTotal}</b>${modLine} → Порог: <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        ${rerollNote}
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех — сохраняет самообладание</span>`
          : `<span class="roll-failure">Провал — Подавлен (📌)</span>`}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);
  await ChatMessage.create(messageData);
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
  const { eff: threshold, bonus: ruleBonus, roll, rv, rerollNote, success: rolledSuccess, dof: rolledDof, usedReroll }
    = await rollMoraleTest(actor, wpTotal + bonus);
  // Саркофаг Дредноута (стр. 57, wdbc-drn): та же возможность, что и на самом
  // тесте Подавления выше — практически недостижимо (auto-pass не даёт
  // Подавлению вообще наступить), но на случай ручного наложения ГМом.
  const sarcophagusAutoPass = hasRuleFlag(actor, "sarcophagus.autoPassFear");
  const success = rolledSuccess || sarcophagusAutoPass;
  const dof = sarcophagusAutoPass ? 0 : rolledDof;
  const rollMode  = game.settings.get("core", "rollMode");

  if (success) await actor.update({ "system.conditions.pinned": false });
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  const bonusLine = bonus !== 0 || ruleBonus !== 0
    ? ` ${bonus >= 0 ? "+" : ""}${bonus}${ruleBonus ? ` ${ruleBonus >= 0 ? "+" : ""}${ruleBonus}` : ""}` : "";
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#4dffa6")}Преодоление Подавления → ${esc(actor.name)}</div>
        <div class="roll-threshold">WP: <b>${wpTotal}</b>${bonusLine} → Порог: <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        ${rerollNote}
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех — Подавление снято</span>`
          : `<span class="roll-failure">Провал — всё ещё Подавлен</span>`}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);
  await ChatMessage.create(messageData);
  return { success, rv, threshold };
}
