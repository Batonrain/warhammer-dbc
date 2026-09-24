// module/combat/legacy-weapon-reaper.mjs
// ════════════════════════════════════════════════════════════════════════
//  Жнец/merciless 5-6, Оружие Наследия (wdbc-1rno.35, стр. 428): «После
//  получения непоглощённого урона от этого оружия цель должна пройти тест
//  на Т−2×Inf.b [атакующего], или получить Кровотечение.»
//
//  Кнопка на карточке урона (module/combat/damage.mjs, тот же netDamage > 0,
//  что LAST_DAMAGE_WEAPON_FLAG) — не через общий targetEffect-конвейер
//  (module/constants/weapon-properties.mjs): та регистрация универсальна и
//  всплыла бы в пикере свойств оружия ЛЮБОГО предмета, а Жнец — свойство
//  только этой Мутации. Бесподставный модуль по образцу
//  legacy-weapon-stunning.mjs.
// ════════════════════════════════════════════════════════════════════════

import { takenMutationNames } from "../rules/legacy-weapon.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";

/** Кнопка на карточке урона — видна только при непоглощённом уроне от оружия с Мутацией. */
export function reaperLegacyButtonHtml(item, defenderUuid) {
  if (!item || !takenMutationNames(item).has("Жнец")) return "";
  if (!defenderUuid) return "";
  return `<button class="wh-legacy-reaper-btn" type="button" data-item-uuid="${item.uuid}" data-defender-uuid="${defenderUuid}">
    ${rollIcon("blood", "#c0392b")}Жнец: тест Т цели на Кровотечение
  </button>`;
}

/** Т−2×Inf.b атакующего, 1d10 в сотую — провал накладывает Кровотечение. */
export async function rollLegacyReaperTest(item, defenderActor) {
  if (!item?.parent) return ui.notifications?.warn("Оригинальный владелец этого оружия не найден (возможно, удалён).");
  if (!defenderActor) return ui.notifications?.warn("Защищавшийся актор не найден.");

  const infBonus = Number(item.parent.system?.characteristics?.inf?.bonus) || 0;
  const tTotal = Number(defenderActor.system?.characteristics?.t?.total) || 0;
  const threshold = tTotal - 2 * infBonus;
  const roll = await new Roll("1d100").evaluate();
  const passed = roll.total <= threshold;

  if (!passed) {
    const fields = conditionApplyFields("bleeding", null, defenderActor);
    if (Object.keys(fields).length) await defenderActor.update(fields);
  }

  await postTestCard(defenderActor, {
    icon: rollIcon("blood", "#c0392b"),
    title: `${esc(item.name)} — Жнец`,
    threshold: `<div class="roll-threshold">Тест Т${infBonus ? `−2×Inf.b(${infBonus})` : ""}: <b>${threshold}</b> · Бросок: <b>${roll.total}</b></div>`,
    outcome: passed
      ? `<span class="roll-success">Устоял — без Кровотечения.</span>`
      : `<span class="roll-failure">Провален — Кровотечение наложено на ${esc(defenderActor.name)}.</span>`
  }, { rolls: [roll] });
}
