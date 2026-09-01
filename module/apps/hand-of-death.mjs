// module/apps/hand-of-death.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Hand of Death / Рука Смерти» (стр. 46, roll d100 77…78, wdbc-hftn):
//  «Одна из рук персонажа сливается с оружием... Он выбирает одно из оружий,
//  что он носит...» — живой выбор СВОЕГО предмета игрока, не выдача нового
//  из пака (equipMode/kind:"equipment" всегда берут предмет по uuid ИЗ
//  КОМПЕНДИУМА) и не правка предмета, несущего саму запись Механики
//  (kind:"weaponProp" целится только в себя, syncWeaponPropItemEffects).
//  Отдельный вид Механики Конструктора ради одной Мутации заводить не стали
//  (тот же принцип, что у Транса Силовой Брони/Сус-ан Мембраны, см. их
//  файлы) — кнопка на листе Мутации, диалог выбора оружия+руки, и код здесь
//  правит уже ВЫБРАННЫЙ предмет напрямую.
//
//  Что делает слияние:
//   • Оружию: свойства fusedLimb (+10 WS/BS, module/constants/weapon-
//     properties.mjs) и reinforced (Укреплённое) — через его собственный
//     system.weaponProps, тем же движком, что читает любое книжное свойство.
//     Баланс поднимается до 0, если был ниже — прежнее значение запоминается
//     во флаге, чтобы откатить его точно, а не молча обнулить.
//   • Мутации (сама несёт запись): +10 AP выбранной руке — через ОБЫЧНУЮ
//     запись kind:"armour" Конструктора (стабильный id "hand-of-death-ap"),
//     материализуется syncMechanicsEffects тем же путём, что и любая другая
//     долговечная запись — откатывается сам, когда Мутацию снимают с актора
//     (embedded-эффект живёт на ней же).
//
//  НЕ реализовано (см. bd wdbc-hftn, close_reason): «одной рукой, даже если
//  требовало две» и «в рукопашной только Стандартный Хват» — система хватов
//  (module/rules/hands.mjs, module/constants/combat.mjs GRIPS) не даёт точки
//  входа «для ЭТОГО конкретного предмета правило другое», не переделывать
//  ради одной Мутации; «боеприпасы из метаболизма» — расходуемый ресурс,
//  которого в системе нет вовсе (см. bd wdbc-jtqf, тот же класс пробела).
// ════════════════════════════════════════════════════════════════════════

import { isHandOfDeathItem } from "../rules/hand-of-death.mjs";
import { getItemMechanics, blankMechEntry, syncMechanicsEffects } from "./mechanics.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";
const AP_ENTRY_ID = "hand-of-death-ap";
const HAND_LABELS = { leftArm: "Левая рука", rightArm: "Правая рука" };

export { isHandOfDeathItem };

/** Оружие, слитое с этой Мутацией сейчас (по flags.handOfDeathSource), или null. */
function fusedWeaponOf(actor, mutationItem) {
  return [...(actor?.items || [])].find(i =>
    i.type === "weapon" && i.getFlag?.(FLAG, "handOfDeathSource") === mutationItem.id) || null;
}

/** Снимает свойства/пометки слияния с оружия, восстанавливает исходный Баланс. */
async function unfuseWeapon(weapon) {
  if (!weapon) return;
  const props = (weapon.system?.weaponProps || []).filter(p => p.key !== "fusedLimb" && p.key !== "reinforced");
  const origBalance = weapon.getFlag(FLAG, "handOfDeathOrigBalance");
  const update = {
    "system.weaponProps": props,
    [`flags.${FLAG}.-=handOfDeathSource`]: null,
    [`flags.${FLAG}.-=handOfDeathOrigBalance`]: null
  };
  if (origBalance != null) update["system.balance"] = origBalance;
  await weapon.update(update);
}

/** Ставит на оружие свойства/пометки слияния, поднимает Баланс до 0. */
async function fuseWeapon(weapon, mutationItem) {
  const props = (weapon.system?.weaponProps || []).filter(p => p.key !== "fusedLimb" && p.key !== "reinforced");
  props.push({ key: "fusedLimb", rating: 0, rating2: 0 });
  props.push({ key: "reinforced", rating: 0, rating2: 0 });
  const balance = Number(weapon.system?.balance) || 0;
  await weapon.update({
    "system.weaponProps": props,
    "system.balance": Math.max(0, balance),
    [`flags.${FLAG}.handOfDeathSource`]: mutationItem.id,
    [`flags.${FLAG}.handOfDeathOrigBalance`]: balance
  });
}

/** Пишет/обновляет запись kind:"armour" (+10 AP выбранной руке) на самой Мутации. */
async function setApEntry(mutationItem, hand) {
  const groups = foundry.utils.deepClone(getItemMechanics(mutationItem));
  let found = false;
  for (const g of groups) {
    for (const e of g.entries || []) {
      if (e.id === AP_ENTRY_ID) {
        e.armourLocation = hand;
        e.armourValue = 10;
        e.op = "add";
        found = true;
      }
    }
  }
  if (!found) {
    const entry = blankMechEntry("armour");
    entry.id = AP_ENTRY_ID;
    entry.armourLocation = hand;
    entry.armourValue = 10;
    entry.op = "add";
    groups.push({ id: foundry.utils.randomID(), operator: "AND", entries: [entry] });
  }
  await mutationItem.setFlag(FLAG, "mechanics", groups);
  await syncMechanicsEffects(mutationItem);
}

/**
 * Провести слияние: снять со старого оружия (если было другое), поставить на
 * новое, обновить запись АП на руку.
 */
export async function applyHandOfDeathFusion(actor, mutationItem, weaponId, hand) {
  const weapon = actor.items.get(weaponId);
  if (!weapon || weapon.type !== "weapon") return;

  const prevWeapon = fusedWeaponOf(actor, mutationItem);
  const sameWeapon = prevWeapon?.id === weapon.id;
  if (prevWeapon && !sameWeapon) await unfuseWeapon(prevWeapon);
  // Заново то же оружие — переставлять свойства незачем, если они уже там
  // (idempotent re-open диалога не должен дублировать записи в weaponProps).
  const alreadyFused = sameWeapon && (weapon.system?.weaponProps || []).some(p => p.key === "fusedLimb");
  if (!alreadyFused) await fuseWeapon(weapon, mutationItem);

  await mutationItem.setFlag(FLAG, "fusedWeaponId", weapon.id);
  await mutationItem.setFlag(FLAG, "fusedHand", hand);
  await setApEntry(mutationItem, hand);
}

/** Диалог выбора оружия актора + руки. Возвращает {weaponId,hand} или null. */
async function promptWeaponAndHand(actor, currentWeaponId) {
  const weapons = [...(actor?.items || [])].filter(i => i.type === "weapon");
  if (!weapons.length) {
    ui.notifications?.warn("Нет ни одного оружия на листе — сначала возьмите оружие, которое срастётся с рукой.");
    return null;
  }
  const options = weapons.map(w =>
    `<option value="${w.id}" ${w.id === currentWeaponId ? "selected" : ""}>${esc(w.name)}</option>`).join("");
  const content = `<form class="hw-choice-form">
    <div class="form-group">
      <label>Оружие</label>
      <select name="weaponId">${options}</select>
    </div>
    <div class="form-group">
      <label>Рука</label>
      <select name="hand">
        <option value="rightArm">${esc(HAND_LABELS.rightArm)}</option>
        <option value="leftArm">${esc(HAND_LABELS.leftArm)}</option>
      </select>
    </div>
  </form>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Рука Смерти: слияние с оружием" },
    classes: ["warhammer-dbc", "wh-holo", "hw-choice-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Слить", icon: "fas fa-hand-fist", default: true,
        callback: (event, button) => ({
          weaponId: button.form.elements.weaponId.value,
          hand: button.form.elements.hand.value
        })
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки на листе Мутации. */
export async function useHandOfDeath(actor, item) {
  if (!isHandOfDeathItem(item) || !actor) return;
  const current = fusedWeaponOf(actor, item);
  const picked = await promptWeaponAndHand(actor, current?.id);
  if (!picked?.weaponId) return;
  await applyHandOfDeathFusion(actor, item, picked.weaponId, picked.hand);
}

/** Кнопка/статус для листа предмета — пусто, если это не «Рука Смерти» или нет актора. */
export function handOfDeathButtonHtml(item, actor) {
  if (!isHandOfDeathItem(item) || !actor) return "";
  const weapon = fusedWeaponOf(actor, item);
  const hand = item.getFlag(FLAG, "fusedHand");
  const status = weapon
    ? `${rollIcon("bolt", "#ffd24d")}Слито: <b>${esc(weapon.name)}</b>${hand ? ` (${esc(HAND_LABELS[hand] || hand)})` : ""}`
    : "Ещё не выбрано оружие.";
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${status}</div>
    <button type="button" class="hand-of-death-btn" data-item-id="${item.id}">
      ${rollIcon("sword", "#ffd24d")}${weapon ? "Выбрать другое оружие" : "Слить с оружием"}
    </button>
  </div>`;
}

/**
 * Уборка при удалении Мутации/оружия (deleteItem, warhammer-dbc.mjs):
 * если слитое оружие ещё на акторе, а сама Мутация исчезла — снять пометки.
 * Вызывать с actor и id удалённого предмета (может быть Мутацией или тем
 * самым оружием — функция сама разбирается, кого чистить).
 */
export async function cleanupHandOfDeath(actor, deletedItemId) {
  if (!actor) return;
  for (const weapon of actor.items) {
    if (weapon.type !== "weapon") continue;
    const sourceId = weapon.getFlag(FLAG, "handOfDeathSource");
    if (!sourceId) continue;
    // Источник (Мутация) удалён, или удалили само это оружие (тогда чистить
    // уже нечего — Foundry снял embedded-документ сам) — второй случай сюда
    // не попадёт, actor.items больше не содержит его к моменту вызова.
    if (sourceId === deletedItemId && !actor.items.get(sourceId)) await unfuseWeapon(weapon);
  }
}
