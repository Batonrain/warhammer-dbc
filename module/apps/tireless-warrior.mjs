// module/apps/tireless-warrior.mjs
//
// UI/действие Дара Кхорн «Tireless Warrior / Неутомимый Воин» (wdbc-1rno) —
// см. module/rules/tireless-warrior.mjs про арифметику и про то, почему
// момент «убил рукопашной» подтверждает игрок, а не автодетект.

import { isTirelessWarriorItem, tirelessWarriorFatigueRelief, tirelessWarriorDamagedCharacteristics,
         tirelessWarriorHealWounds, tirelessWarriorHealCharacteristic } from "../rules/tireless-warrior.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export { isTirelessWarriorItem };

/**
 * Диалог выбора, что лечить: «Раны» (по умолчанию) или одна из повреждённых
 * Характеристик (только те, что реально несут урон — system.charDamage < 0).
 * @returns {Promise<string|null>} "wounds" | ключ характеристики | null (отмена)
 */
async function promptHealTarget(damaged) {
  const options = [`<option value="wounds">Раны</option>`,
    ...damaged.map(d => `<option value="${d.key}">${esc(d.label)} (сейчас ${d.current})</option>`)].join("");
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-row">
      <label>Восстановить:</label>
      <select id="tw-target">${options}</select>
    </div>
    <div class="sq-hint">1d5−1, по выбору — Раны или урон в одну Характеристику.</div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Tireless Warrior: убийство рукопашной" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Применить", icon: "fas fa-heart", default: true,
        callback: (event, button) => button.form.querySelector("#tw-target").value
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки «Убил рукопашной» на листе Дара. */
export async function useTirelessWarriorKill(actor, item) {
  if (!isTirelessWarriorItem(item) || !actor) return;

  const damaged = tirelessWarriorDamagedCharacteristics(actor.system);
  const target = await promptHealTarget(damaged);
  if (!target) return; // отменено

  const roll = await new Roll("1d5-1").evaluate();
  const healAmount = Math.max(0, roll.total);
  const newFatigue = tirelessWarriorFatigueRelief(actor.system);

  const update = { "system.fatigue.value": newFatigue };
  let healLine;
  if (target === "wounds") {
    const newWounds = tirelessWarriorHealWounds(actor.system, healAmount);
    update["system.wounds.value"] = newWounds;
    healLine = `Раны: <b>${newWounds}</b> (+${healAmount})`;
  } else {
    const newDamage = tirelessWarriorHealCharacteristic(actor.system, target, healAmount);
    update[`system.charDamage.${target}`] = newDamage;
    const label = CHARACTERISTICS[target]?.label || target.toUpperCase();
    healLine = `${esc(label)}: мод. <b>${newDamage}</b> (+${healAmount})`;
  }

  await actor.update(update);
  // Бросок есть (1d5−1 — размер восстановления), но Порога нет: это не тест,
  // сравнивать не с чем. Общая строка «Бросок: N» карточке не нужна — число
  // уже стоит в строке восстановления.
  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: "Tireless Warrior — убийство рукопашной",
    lines: [
      `<div class="roll-threshold">Усталость: <b>${newFatigue}</b> (−1)</div>`,
      `<div class="roll-threshold">${healLine} — 1d5−1 = ${roll.total < 0 ? 0 : roll.total}</div>`,
      `<div class="roll-threshold" style="opacity:.8;">Считается получившим 1 час здорового сна (нарративно, часы сна система не отслеживает).</div>`
    ]
  }, { rolls: [roll] });
}

/** Кнопка на листе предмета — пусто, если это не «Tireless Warrior» или нет актора. */
export function tirelessWarriorButtonHtml(item, actor) {
  if (!isTirelessWarriorItem(item) || !actor) return "";
  return `<div class="tireless-warrior-panel">
    <div class="tireless-warrior-hint">Убил другого персонажа рукопашной атакой в бою — нажмите.</div>
    <button type="button" class="tireless-warrior-kill-btn" data-item-id="${item.id}">
      ${rollIcon("blood","#8b1a1a")}Убил рукопашной
    </button>
  </div>`;
}
