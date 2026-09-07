// module/apps/gun-arm.mjs
//
// Выбор оружия, вросшего в предплечье Даром «Рука-Пушка» (wdbc-spsd).
// Правило и метка — module/rules/gun-arm.mjs, здесь только окно и кнопка на
// листе Дара. Устроено ровно как выбор оружия у «Руки Смерти»
// (module/apps/hand-of-death.mjs): то же место, тот же вид, чтобы ГМ не
// разбирался в двух разных интерфейсах для одного и того же действия.

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { isGunArmGift, isGunArmWeapon, gunArmWeaponOf, GUN_ARM_CLASSES }
  from "../rules/gun-arm.mjs";

const FLAG = "warhammer-dbc";

/** Оружие актора, которое Дар в принципе может втянуть: пистолет или винтовка. */
function candidates(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i.type === "weapon" && GUN_ARM_CLASSES.includes(i.system?.weaponClass));
}

/** Поставить метку на выбранное оружие, сняв её со старого. */
export async function applyGunArm(actor, giftItem, weaponId) {
  const weapon = actor?.items?.get(weaponId);
  if (!weapon || weapon.type !== "weapon") return;
  const prev = gunArmWeaponOf(actor);
  if (prev && prev.id !== weapon.id) await prev.unsetFlag(FLAG, "gunArmSource");
  await weapon.setFlag(FLAG, "gunArmSource", giftItem.id);
}

/** Диалог выбора оружия. Возвращает id или null. */
async function promptWeapon(actor, currentId) {
  const list = candidates(actor);
  if (!list.length) {
    ui.notifications?.warn(
      "Нет ни пистолета, ни винтовки на листе — Дару нечего втягивать в предплечье.");
    return null;
  }
  const options = list.map(w =>
    `<option value="${w.id}" ${w.id === currentId ? "selected" : ""}>${esc(w.name)}</option>`).join("");
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: "Рука-Пушка: какое оружие вросло" },
    classes: ["warhammer-dbc", "wh-holo", "hw-choice-dialog"],
    content: `<form class="hw-choice-form">
      <div class="form-group">
        <label>Оружие</label>
        <select name="weaponId">${options}</select>
      </div>
    </form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Втянуть", icon: "fas fa-hand-fist", default: true,
        callback: (event, button) => button.form.elements.weaponId.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  return picked || null;
}

/** Нажатие кнопки на листе Дара. */
export async function useGunArm(actor, item) {
  if (!isGunArmGift(item) || !actor) return;
  const weaponId = await promptWeapon(actor, gunArmWeaponOf(actor)?.id);
  if (!weaponId) return;
  await applyGunArm(actor, item, weaponId);
  // Метка живёт на ОРУЖИИ, а показывает её лист ДАРА — сам он об изменении не
  // узнаёт и остаётся с прежней строкой «Оружие не выбрано» (замечено живой
  // проверкой wdbc-qefa). Перерисовываем его руками.
  item.sheet?.render(false);
}

/**
 * Панель для листа Дара — пусто, если это не «Рука-Пушка» или нет актора.
 *
 * Когда оружие ещё не выбрано, панель говорит это прямо: без выбора Дар не
 * действует НИ НА ЧТО, и молчаливое «почему-то тратятся патроны» хуже, чем
 * строка «выберите оружие».
 */
export function gunArmButtonHtml(item, actor) {
  if (!isGunArmGift(item) || !actor) return "";
  const weapon = gunArmWeaponOf(actor);
  const status = weapon
    ? `${rollIcon("bolt", "#ffd24d")}Вросло: <b>${esc(weapon.name)}</b> — не тратит стандартные боеприпасы`
    : "Оружие не выбрано — пока Дар не действует ни на что.";
  return `<div class="gun-arm-panel">
    <div class="gun-arm-status">${status}</div>
    <button type="button" class="gun-arm-btn" data-item-id="${item.id}">
      ${rollIcon("target", "#ffd24d")}${weapon ? "Выбрать другое оружие" : "Выбрать оружие"}
    </button>
  </div>`;
}

/**
 * Уборка при удалении Дара или самого оружия: метка на оружии осталась бы
 * висеть и продолжала бы работать, если Дар вернут другим предметом.
 * Зовётся из хука deleteItem вместе с уборкой «Руки Смерти».
 */
export async function cleanupGunArm(actor, deletedItemId) {
  for (const weapon of actor?.items ?? []) {
    if (!isGunArmWeapon(weapon)) continue;
    const source = weapon.getFlag?.(FLAG, "gunArmSource");
    if (source === deletedItemId || weapon.id === deletedItemId)
      await weapon.unsetFlag(FLAG, "gunArmSource");
  }
}
