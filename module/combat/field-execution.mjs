// module/combat/field-execution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  FIELD EXECUTION / ПОЛЕВАЯ КАЗНЬ (Талант Лидерства, Sahara 3-ac78, bd
//  wdbc-3w7lo): «Когда подчинённый в Шоке/Подавлен/запуган/отступает,
//  персонаж может пройти Intimidate(W)+0 vs W+0 против него и при успехе
//  атаковать его как Беспомощного. Если атака убивает его или опускает в
//  Отрицательные Раны, все остальные подчинённые немедленно выходят из
//  Шока/Подавления, сбрасывают запугивание/панику и прекращают отступление.»
//
//  Построено как параллель combat/intimidate.mjs::rollIntimidateContest —
//  тот же встречный тест (Intimidate атакующего vs W+0 цели), но:
//   1. Intimidate считается от W (Воли), не от F — книжное исключение этого
//      Таланта. skills.intimidate.total завязан на F в rules/character.mjs
//      (как и Command у Living Legend, см. заголовок rules/leadership-
//      talents.mjs) — переносить саму расчётную цепочку рискованно ради
//      одного Таланта, поэтому считается здесь же явно: W.total + (то, что
//      skills.intimidate.total добавил сверх F.total — ранг, ситуативные
//      правки).
//   2. Успех не разрешает атаку сам — даёт только «можно атаковать как
//      Беспомощного»: galочки opts.forceHit/opts.doubleDamage в окне атаки
//      (module/combat/attack.mjs) остаются ситуативными, как и для всех
//      прочих Беспомощных целей — не хранимое состояние на акторе.
//   3. «Казнена» — убийство конкретно ЭТОЙ атакой не из чего детектировать
//      автоматически (нет хука «актор умер от атаки N»), поэтому кнопка на
//      карточке результата, которую игрок жмёт сам, когда увидел исход
//      атаки — тем же приёмом, что «Скрыть трусость» у command-state.mjs.
//      Снимает Шок/Подавление («запуган»/«отступает» не хранятся данными —
//      см. заголовок rules/leadership-talents.mjs) — переиспользует
//      applyBraveryNow (то же снятие, что у «Храбрости»), по каждому Отряду,
//      которым командует исполнитель.
// ════════════════════════════════════════════════════════════════════════════

import { moraleThreshold } from "./intimidate.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { applyBraveryNow } from "./command-state.mjs";
import { rootEl } from "../sheets/v2-helpers.mjs";

/** Intimidate(W) исполнителя — та же формула ранга/правок, что обычный Intimidate(F), характеристика заменена на W. */
function fieldExecutionAttackerThreshold(attacker, mod = 0) {
  const skillTotal = Number(attacker?.system?.skills?.intimidate?.total) || 0;
  const felTotal    = Number(attacker?.system?.characteristics?.fel?.total) || 0;
  const wpTotal      = Number(attacker?.system?.characteristics?.wp?.total) || 0;
  return wpTotal + (skillTotal - felTotal) + (Number(mod) || 0);
}

/**
 * Встречный тест Полевой Казни: Intimidate(W)+0 исполнителя vs W+0 цели.
 * Публикует карточку результата с кнопкой «Казнена» при успехе.
 * @returns {Promise<{winner:"mine"|"theirs"|null, margin:number}>}
 */
export async function rollFieldExecutionContest(attacker, target, { attackerMod = 0, targetMod = 0 } = {}) {
  const atkMods = collectTestMods(attacker, { kind: "skill", skill: "intimidate", char: "wp", morale: true });
  const tgtMods = collectTestMods(target, { kind: "skill", char: "wp", morale: true });
  const atkThreshold = fieldExecutionAttackerThreshold(attacker, attackerMod) + atkMods.total;
  const tgtThreshold = moraleThreshold(target, targetMod) + tgtMods.total;
  const atkRoll = await new Roll("1d100").evaluate();
  const tgtRoll = await new Roll("1d100").evaluate();
  const atkOutcome = testOutcome(atkRoll.total, atkThreshold);
  const tgtOutcome = testOutcome(tgtRoll.total, tgtThreshold);
  const { winner, margin } = resolveOpposed(
    { ...atkOutcome, threshold: atkThreshold }, { ...tgtOutcome, threshold: tgtThreshold });
  const success = winner === "mine";

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("skull", "#ff4d4d")}Полевая Казнь — ${esc(attacker.name)} → ${esc(target.name)}</div>
      <div class="roll-threshold">Intimidate(W) (${esc(attacker.name)}): <b>${atkThreshold}</b>${atkMods.parts.length ? ` (${atkMods.parts.join(", ")})` : ""} → бросок <b>${atkRoll.total}</b> —
        ${atkOutcome.success ? "Успех" : "Провал"} ${atkOutcome.deg} ${_degWord(atkOutcome.deg)}</div>
      <div class="roll-threshold">W+0 (${esc(target.name)}): <b>${tgtThreshold}</b>${tgtMods.parts.length ? ` (${tgtMods.parts.join(", ")})` : ""} → бросок <b>${tgtRoll.total}</b> —
        ${tgtOutcome.success ? "Успех" : "Провал"} ${tgtOutcome.deg} ${_degWord(tgtOutcome.deg)}</div>
      <div class="roll-outcome">${success
        ? `<span class="roll-success">Успех, margin ${margin} — цель теперь Беспомощна для этой атаки (отметьте галочку в окне атаки).</span>`
        : winner === "theirs"
        ? `<span class="roll-failure">Провал, margin ${margin} — цель сохраняет самообладание.</span>`
        : `<span>Ничья — решает ГМ.</span>`}</div>
      ${success ? `<div class="sq-chat-note">Если атака убьёт её или опустит в Отрицательные Раны — кнопка снимет Шок/Подавление у остальных подчинённых («запуган»/«отступает» решает стол).
        <button type="button" class="wh-field-execution-clear" data-executioner-uuid="${attacker.uuid}">Казнена — снять Шок/Подавление у отряда</button></div>` : ""}
    </div>`,
    rolls: [atkRoll, tgtRoll], sound: CONFIG.sounds.dice
  }, rollMode));

  return { winner, margin };
}

/** Отряды, которыми actor командует (Командир ИЛИ Лидер) — свой, лёгкий обход, без завязки на adjutant.mjs. */
function squadsLedBy(actor, allActors) {
  const uuid = actor?.uuid;
  if (!uuid) return [];
  return (allActors ?? []).filter(a => a?.type === "squad"
    && (a.system?.posts?.commander?.uuid === uuid || a.system?.posts?.leader?.uuid === uuid));
}

/** Кнопка «Казнена»: снять Шок/Подавление у всех подчинённых во всех Отрядах, которыми командует executionerActor. */
export async function applyFieldExecutionClear(executionerActor, allActors) {
  const freed = [];
  for (const squad of squadsLedBy(executionerActor, allActors ?? [])) {
    freed.push(...(await applyBraveryNow(squad)));
  }
  return freed;
}

/** Диалог: модификаторы обеих сторон, порог уже виден до броска (та же форма, что Запугивание). */
export async function fieldExecutionDialog(actor, target) {
  if (!target) return;
  const base = fieldExecutionAttackerThreshold(actor);
  const targetBase = moraleThreshold(target);

  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Полевая Казнь — ${actor.name} → ${target.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-attack-form cmd-free-form">
      <div class="atk-dlg-row"><label>Intimidate(W) (${esc(actor.name)}):</label><span><b>${base}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор:</label><input id="fex-atk-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row"><label>W+0 (${esc(target.name)}):</label><span><b>${targetBase}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор цели:</label><input id="fex-tgt-mod" type="number" value="0"/></div>
    </div>`,
    ok: {
      label: "Бросок!", icon: "fas fa-dice-d10",
      callback: (event, button) => ({
        attackerMod: parseInt(button.form.querySelector("#fex-atk-mod")?.value) || 0,
        targetMod: parseInt(button.form.querySelector("#fex-tgt-mod")?.value) || 0
      })
    }
  }).catch(() => null);
  if (!picked) return;

  return rollFieldExecutionContest(actor, target, picked);
}

/** Слушатель кнопки «Полевая Казнь» на вкладке СОЦИУМ — та же цель, что у Запугивания. */
export function activateFieldExecutionListeners(root, actor, { resolveOtherTargetActor, editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector || !editable) return;
  el.querySelectorAll("[data-field-execution-roll]").forEach(node =>
    node.addEventListener("click", () => fieldExecutionDialog(actor, resolveOtherTargetActor?.())));
}
