// module/apps/hand-of-khorne.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дар «Hand of Khorne / Длань Кхорна» (wdbc-1rno, Кхорн) — выбор руки
//  (не оружия — см. шапку module/rules/hand-of-khorne.mjs), тот же приём,
//  что у Hand of Death (apps/hand-of-death.mjs): кнопка на листе Дара,
//  диалог, код здесь пишет выбор на сам Дар и +8 AP выбранной руке через
//  обычную запись kind:"armour" Конструктора (то же, что setApEntry там).
//
//  Три остальных книжных бонуса (×2 S.b, +2 Размера при Парировании,
//  автопровал стрельбы) НЕ материализуются записью — они читаются заново на
//  каждый бросок с ТЕКУЩЕГО оружия в этой руке (module/rules/hand-of-khorne.mjs
//  ::isHandOfKhorneWeapon), подключены в module/combat/attack.mjs и module/
//  combat/defense.mjs напрямую.
// ════════════════════════════════════════════════════════════════════════

import { isHandOfKhorneItem, handOfKhorneHand, HAND_FLAG } from "../rules/hand-of-khorne.mjs";
import { getItemMechanics, blankMechEntry, syncMechanicsEffects } from "./mechanics.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";
const AP_ENTRY_ID = "hand-of-khorne-ap";
const HAND_LABELS = { left: "Левая рука", right: "Правая рука" };
const ARMOUR_LOCATION = { left: "leftArm", right: "rightArm" };

export { isHandOfKhorneItem };

/** Пишет/обновляет запись kind:"armour" (+8 AP выбранной руке) на самом Даре. */
async function setApEntry(item, hand) {
  const groups = foundry.utils.deepClone(getItemMechanics(item));
  let found = false;
  for (const g of groups) {
    for (const e of g.entries || []) {
      if (e.id === AP_ENTRY_ID) {
        e.armourLocation = ARMOUR_LOCATION[hand];
        e.armourValue = 8;
        e.op = "add";
        found = true;
      }
    }
  }
  if (!found) {
    const entry = blankMechEntry("armour");
    entry.id = AP_ENTRY_ID;
    entry.armourLocation = ARMOUR_LOCATION[hand];
    entry.armourValue = 8;
    entry.op = "add";
    groups.push({ id: foundry.utils.randomID(), operator: "AND", entries: [entry] });
  }
  await item.setFlag(FLAG, "mechanics", groups);
  await syncMechanicsEffects(item);
}

/** Выбор руки: пишет флаг на Дар + запись АП. */
export async function chooseHandOfKhorneHand(item, hand) {
  if (!isHandOfKhorneItem(item) || (hand !== "left" && hand !== "right")) return;
  await item.setFlag(FLAG, HAND_FLAG, hand);
  await setApEntry(item, hand);
}

/** Диалог выбора руки. */
async function promptHand(current) {
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Длань Кхорна" },
    classes: ["warhammer-dbc", "wh-holo", "hw-choice-dialog"],
    content: `<form class="hw-choice-form">
      <div class="form-group">
        <label>Какая рука обращается в кровавую бронзу?</label>
        <select name="hand">
          <option value="right" ${current === "right" ? "selected" : ""}>${esc(HAND_LABELS.right)}</option>
          <option value="left" ${current === "left" ? "selected" : ""}>${esc(HAND_LABELS.left)}</option>
        </select>
      </div>
      <div class="atk-range-info" style="font-size:0.82em;">
        +8 AP этой руке, ×2 S.b в атаках ею, +2 Размера атакующего при
        Парировании её атак, стрелковые атаки ею — автопровал. Бонусы едут за
        тем оружием, что сейчас в этой руке (или двуручным).
      </div>
    </form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Выбрать", icon: "fas fa-hand-fist", default: true,
        callback: (event, button) => button.form.elements.hand.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки на листе Дара. */
export async function useHandOfKhorne(actor, item) {
  if (!isHandOfKhorneItem(item) || !actor) return;
  const hand = await promptHand(handOfKhorneHand(actor));
  if (!hand) return;
  await chooseHandOfKhorneHand(item, hand);
}

/** Кнопка/статус для листа предмета — пусто, если это не «Длань Кхорна» или нет актора. */
export function handOfKhorneButtonHtml(item, actor) {
  if (!isHandOfKhorneItem(item) || !actor) return "";
  const hand = handOfKhorneHand(actor);
  const status = hand
    ? `${rollIcon("burst", "#ff6b6b")}Бронзовая рука: <b>${esc(HAND_LABELS[hand])}</b>`
    : "Рука ещё не выбрана.";
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${status}</div>
    <button type="button" class="hand-of-khorne-btn" data-item-id="${item.id}">
      ${rollIcon("burst", "#ff6b6b")}${hand ? "Выбрать другую руку" : "Выбрать руку"}
    </button>
  </div>`;
}
