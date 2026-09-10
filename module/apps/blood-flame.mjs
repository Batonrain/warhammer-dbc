// module/apps/blood-flame.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дар «Blood Flame / Кровавое Пламя» (Кхорн, wdbc-1rno, d100 Дары Кхорна):
//  «Если персонаж вооружён рукопашным оружием, наносящим R Dmg, за
//  полудействие он может нанести себе 1 непоглощаемого R Dmg в руку и дать
//  этому оружию свойства Power Field и Flame. Оружие получает +2 Dmg за
//  каждого убитого им с начала этого усиления персонажа до максимума в +8.
//  По окончании боя или сцены оружие ломается и бесполезно, пока не будет
//  починено.»
//
//  Живой выбор СВОЕГО оружия игроком, не выдача нового из пака — тот же
//  принцип, что у Hand of Death (apps/hand-of-death.mjs): кнопка на листе
//  Дара, диалог выбора оружия, код здесь правит уже выбранный предмет
//  напрямую через собственный system.weaponProps.
//
//  Три момента жизненного цикла:
//   • Активация (activateBloodFlame) — самоурон, добавление Power
//     Field/Flame (только те, которых ещё не было — не задваивает книжные
//     свойства настоящего Пламенного оружия), флаги bloodFlameActive/
//     bloodFlameKills:0.
//   • Убийство этим оружием (registerBloodFlameKill) — дёргается из
//     module/hooks.mjs, когда кнопка «Констатировать смерть»
//     (crit-effect-parser.mjs::deathButtonHtml) кликается по цели,
//     известной ударенной ИМЕННО этим оружием (weaponUuid уже протянут
//     через боевой конвейер, module/combat/attack.mjs). Бонус +2/+8
//     читается на каждый бросок (bloodFlameDamageBonus, module/rules/
//     blood-flame.mjs), не хранится отдельным числом урона.
//   • Конец боя/сцены (clearBloodFlameBuffs, module/hooks.mjs::deleteCombat)
//     — снимает добавленные свойства И ломает оружие (system.destroyed) —
//     в отличие от Reformation Song (reformation-song.mjs), которая
//     destroyed сознательно не трогает, здесь это и есть книжный исход.
// ════════════════════════════════════════════════════════════════════════

import {
  isBloodFlameItem, isBloodFlameActive,
  ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG
} from "../rules/blood-flame.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "warhammer-dbc";

export { isBloodFlameItem, isBloodFlameActive };

/** Рукопашное оружие актора, наносящее урон R — годится для Кровавого Пламени. */
function eligibleWeapons(actor) {
  return [...(actor?.items || [])].filter(i =>
    i.type === "weapon"
    && (i.system?.weaponClass === "melee" || i.system?.weaponClass === "thrown")
    && i.system?.damageType === "rending");
}

/** Диалог выбора оружия. Возвращает id предмета или null. */
async function promptWeapon(actor) {
  const weapons = eligibleWeapons(actor);
  if (!weapons.length) {
    ui.notifications?.warn("Нет рукопашного оружия с уроном R (Рвущий) — Кровавому Пламени не на чем гореть.");
    return null;
  }
  const options = weapons.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  const content = `<form class="hw-choice-form">
    <div class="form-group">
      <label>Оружие</label>
      <select name="weaponId">${options}</select>
    </div>
    <div class="atk-range-info" style="font-size:0.82em;">
      Себе: 1 непоглощаемый R Dmg в руку. Оружию: Power Field + Flame, +2 Dmg за
      каждого убитого им до +8. Ломается по концу боя/сцены.
    </div>
  </form>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Кровавое Пламя" },
    classes: ["warhammer-dbc", "wh-holo", "hw-choice-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Разжечь", icon: "fas fa-fire", default: true,
        callback: (event, button) => button.form.elements.weaponId.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Активация: самоурон + Power Field/Flame + флаги. */
export async function activateBloodFlame(actor, weapon) {
  if (!actor || !weapon) return;
  if (weapon.type !== "weapon" || (weapon.system?.weaponClass !== "melee" && weapon.system?.weaponClass !== "thrown")) {
    return ui.notifications?.warn("⚠️ Кровавое Пламя — только рукопашное оружие.");
  }
  if (weapon.system?.damageType !== "rending") {
    return ui.notifications?.warn("⚠️ Кровавое Пламя — только оружие с уроном R (Рвущий).");
  }
  if (weapon.system?.destroyed) {
    return ui.notifications?.warn("⚠️ Оружие уничтожено — сначала почините.");
  }
  if (isBloodFlameActive(weapon)) {
    return ui.notifications?.warn("⚠️ Кровавое Пламя уже горит на этом оружии.");
  }

  const { currentWounds, newWounds, gotCritical, newCritical } = await applyWoundLoss(actor, 1);

  const props = Array.isArray(weapon.system?.weaponProps) ? weapon.system.weaponProps : [];
  const addedKeys = ["powerField", "flame"].filter(key => !props.some(p => p?.key === key));

  await weapon.update({
    ...(addedKeys.length ? { "system.weaponProps": [...props, ...addedKeys.map(key => ({ key }))] } : {}),
    [`flags.${FLAG}.${ACTIVE_FLAG}`]: true,
    [`flags.${FLAG}.${KILLS_FLAG}`]: 0,
    [`flags.${FLAG}.${ADDED_PROPS_FLAG}`]: addedKeys
  });

  await postTestCard(actor, {
    icon: rollIcon("burst", "#ff6b6b"), title: `Кровавое Пламя — ${esc(weapon.name)}`,
    outcome: `<div class="roll-outcome"><span class="roll-failure">Самоурон: 1 непоглощаемый R Dmg в руку — Раны ${currentWounds} → ${newWounds}${gotCritical ? ` (крит. ${newCritical})` : ""}.</span></div>`,
    sections: [`<div class="roll-allout-note">${esc(weapon.name)} горит Power Field${addedKeys.includes("powerField") ? "" : " (уже было)"} и Flame${addedKeys.includes("flame") ? "" : " (уже было)"}. +2 Dmg за каждого убитого им (до +8). Ломается по концу боя/сцены.</div>`]
  }, { sound: false });
}

/** Нажатие кнопки на листе Дара. */
export async function useBloodFlame(actor, item) {
  if (!isBloodFlameItem(item) || !actor) return;
  const weaponId = await promptWeapon(actor);
  if (!weaponId) return;
  const weapon = actor.items.get(weaponId);
  await activateBloodFlame(actor, weapon);
}

/** Кнопка/статус для листа предмета — пусто, если это не «Кровавое Пламя» или нет актора. */
export function bloodFlameButtonHtml(item, actor) {
  if (!isBloodFlameItem(item) || !actor) return "";
  const burning = eligibleWeapons(actor).filter(isBloodFlameActive);
  const status = burning.length
    ? burning.map(w => `${rollIcon("burst", "#ff6b6b")}Горит: <b>${esc(w.name)}</b> (${Number(w.getFlag(FLAG, KILLS_FLAG)) || 0} убито)`).join("<br/>")
    : "Не разожжено.";
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${status}</div>
    <button type="button" class="blood-flame-btn" data-item-id="${item.id}">
      ${rollIcon("burst", "#ff6b6b")}Разжечь на оружии
    </button>
  </div>`;
}
