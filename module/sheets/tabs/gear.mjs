// module/sheets/tabs/gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снаряжение на листе персонажа: экипировка, ручные щиты, ammo/reload.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { syncItemEffectsDisabled, syncOrphanedModEffects } from "../../apps/effects.mjs";
import { _reloadWeapon } from "../../combat/reload.mjs";
import { _toggleShield, _rollShieldActivation, _repairShield } from "../../combat/shield.mjs";
import { on } from "../../helpers/utils.mjs";
import { canEquipInHands, handsOccupied, getHeldHand, setHeldHand } from "../../rules/hands.mjs";
import { rollInfoguard as _rollInfoguard } from "../../apps/infoguard.mjs";
import { showDelegateTestPicker as _showDelegateTestPicker } from "../../rules/delegate-test.mjs";
import { openGearModPicker as _openGearModPicker } from "../gear-mod-picker.mjs";

const ARMOR_LOCS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/**
 * Hard / Жёсткая (стр. 228, wdbc-8b5): «нельзя носить два жёстких элемента
 * брони на одной части тела». Проверяется по базовому AP предмета (head/body/…
 * > 0, без модов/качества — правило про сам элемент комплекта, не про
 * итоговое число), не по флагам поглощения (armor-properties.mjs) — та схема
 * читается только в бою, на попадание, а не при экипировке.
 */
function _conflictingHardArmor(actor, item) {
  const s = item.system;
  const myLocs = ARMOR_LOCS.filter(k => (s[k] || 0) > 0);
  if (!myLocs.length) return null;
  return (actor.items ?? []).find(other =>
    other.id !== item.id && other.type === "armor" && other.system.equipped
    && (other.system.properties || []).includes("hard")
    && myLocs.some(k => (other.system[k] || 0) > 0));
}

/**
 * Экипировка. Надевание оружия/щита (не брони — она рук не занимает)
 * блокируется, если рук не хватает (wdbc-3xqh) — только на ПРИРОСТ занятости,
 * старые «нелегальные» связки на существующих листах не трогает и не рвёт.
 */
export async function equipItem(item, equipped) {
  if (!item) return;
  if (equipped && item.type === "weapon" && item.parent && !canEquipInHands(item.parent, item)) {
    const { free, max } = handsOccupied(item.parent, { exclude: item.id });
    ui.notifications?.warn(`${item.name}: не хватает рук (свободно ${free} из ${max}) — сначала снимите что-то с рук.`);
    return;
  }
  // Hard (wdbc-8b5): блокируем только НОВОЕ надевание — существующие
  // «нелегальные» связки на старых листах не трогаем (тот же принцип, что
  // и у занятости рук выше).
  if (equipped && item.type === "armor" && item.parent
      && (item.system.properties || []).includes("hard")) {
    const conflict = _conflictingHardArmor(item.parent, item);
    if (conflict) {
      ui.notifications?.warn(`${item.name}: нельзя носить два жёстких элемента брони на одной части тела (конфликт с «${conflict.name}»).`);
      return;
    }
  }
  await item.update({ "system.equipped": equipped });
  await syncItemEffectsDisabled(item, equipped);
  // Эффекты установленных модификаций гаснут вместе с носителем (isItemActive),
  // но update пришёл не им — пересчитываем сами.
  await syncOrphanedModEffects(item.parent, item.id);
}

export async function setShieldHand(item, hand) {
  await setHeldHand(item, hand);
}

// В какой руке оружие (для карточек «правая/левая» на HUD, module/apps/hud.mjs) —
// без дефолта, в отличие от щита: большинство персонажей носят одно
// оружие, форсировать руку незачем. Повторный клик по уже активной руке снимает.
export async function setWeaponHand(item, hand) {
  if (!item) return;
  const current = getHeldHand(item);
  await setHeldHand(item, current === hand ? "" : hand);
}

export async function toggleShieldRaised(item) {
  if (!item) return;
  const on = !item.getFlag("warhammer-dbc", "shieldRaised");
  await item.setFlag("warhammer-dbc", "shieldRaised", on);
  ui.notifications.info(on
    ? `${item.name}: щит поднят — прикрыты дополнительные зоны.`
    : `${item.name}: щит опущен.`);
}

export async function setWeaponLoadedAmmo(item, ammoId) {
  if (!item) return;
  await item.update({ "system.loadedAmmoId": ammoId });
}

/** Установка модификации/системы на носителя (оружие или броню). */
export async function installGearMod(item, hostId) {
  if (!item || !hostId) return;
  await item.update({ "system.installedOn": hostId });
  await syncItemEffectsDisabled(item);
}

/** Снятие с носителя: заодно выключает включаемую систему — бонусы не должны висеть. */
export async function uninstallGearMod(item) {
  if (!item) return;
  await item.update({ "system.installedOn": "", "system.active": false });
  await syncItemEffectsDisabled(item, false);
}

/** Вкл/выкл включаемой системы: её бонусы учитываются только во включённом состоянии. */
export async function toggleGearModActive(item) {
  if (!item) return;
  await item.update({ "system.active": !item.system.active });
  await syncItemEffectsDisabled(item);
}

export function activateGearListeners(root, actor, {
  reloadWeapon = _reloadWeapon,
  toggleShield = _toggleShield,
  rollShieldActivation = _rollShieldActivation,
  repairShield = _repairShield,
  rollInfoguard = _rollInfoguard,
  showDelegateTestPicker = _showDelegateTestPicker,
  openGearModPicker = _openGearModPicker
} = {}) {
  on(root, ".weapon-equip-cb", "change", async ev => {
    const itemId   = ev.currentTarget.dataset.itemId;
    const equipped = ev.currentTarget.checked;
    await equipItem(actor.items.get(itemId), equipped);
  });

  on(root, ".armor-equip-cb", "change", async ev => {
    const itemId   = ev.currentTarget.dataset.itemId;
    const equipped = ev.currentTarget.checked;
    await equipItem(actor.items.get(itemId), equipped);
  });

  // Носимое снаряжение (wdbc-9h7g) — тот же тумблер и тот же equipItem, что у
  // оружия и брони: противогаз, плащ, откатная перчатка дают свою механику
  // только надетыми. Проверки рук и жёсткой брони внутри equipItem снаряжения
  // не касаются — они смотрят на тип предмета.
  on(root, ".gear-equip-cb", "change", async ev => {
    const itemId   = ev.currentTarget.dataset.itemId;
    const equipped = ev.currentTarget.checked;
    await equipItem(actor.items.get(itemId), equipped);
  });

  // ── Ручные щиты (стр. 215) ───────────────────────────────────────────
  // Рука определяет, какая «Р1» в зонах защиты; «поднять щит» включает зоны,
  // указанные в скобках (они прикрываются лишь осознанным движением).
  on(root, ".shield-hand-btn", "click", async ev => {
    ev.preventDefault();
    const el = ev.currentTarget;
    await setShieldHand(actor.items.get(el.dataset.itemId), el.dataset.hand);
  });
  // Рука оружия (module/apps/hud.mjs читает weaponHand для карточек правая/левая).
  on(root, ".weapon-hand-btn", "click", async ev => {
    ev.preventDefault();
    const el = ev.currentTarget;
    await setWeaponHand(actor.items.get(el.dataset.itemId), el.dataset.hand);
  });
  on(root, ".shield-raise-btn", "click", async ev => {
    ev.preventDefault();
    await toggleShieldRaised(actor.items.get(ev.currentTarget.dataset.itemId));
  });

  on(root, ".weapon-reload-btn", "click", async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await reloadWeapon(actor, item);
  });

  on(root, ".weapon-ammo-select", "change", async ev => {
    const itemId = ev.currentTarget.dataset.itemId;
    const ammoId = ev.currentTarget.value;
    await setWeaponLoadedAmmo(actor.items.get(itemId), ammoId);
  });

  on(root, ".shield-row", "dblclick", ev => {
    if (ev.target?.closest?.("button")) return;
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  on(root, ".shield-toggle-btn, .shield-roll-btn, .shield-repair-btn", "contextmenu", ev => {
    ev.stopPropagation();
  });

  on(root, ".shield-toggle-btn", "click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await toggleShield(actor, item);
  });

  on(root, ".shield-roll-btn", "click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await rollShieldActivation(actor, item);
  });

  on(root, ".shield-repair-btn", "click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await repairShield(actor, item);
  });

  // ── Улучшения и системы на носителе (инлайн-выпадашка в строке носителя) ──
  on(root, ".gear-mod-install", "change", async ev => {
    ev.stopPropagation();
    await installGearMod(actor.items.get(ev.currentTarget.dataset.itemId), ev.currentTarget.value);
  });

  on(root, ".gear-mod-uninstall", "click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    await uninstallGearMod(actor.items.get(ev.currentTarget.dataset.itemId));
  });

  on(root, ".armormod-active-toggle", "click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    await toggleGearModActive(actor.items.get(ev.currentTarget.dataset.itemId));
  });

  // Инфограждение прямо из строки таблицы (wdbc-0rka) — та же пара кнопок,
  // что уже на вкладке ТЕХ (tabs/tech.mjs) и на листе предмета
  // (infoguard.hbs), просто третья точка входа к тем же функциям.
  on(root, ".gear-infoguard-roll-btn", "click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) rollInfoguard(item);
  });
  on(root, ".gear-infoguard-delegate-btn", "click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    showDelegateTestPicker(actor, {
      title: `Делегировать Инфограждение: ${item.name}`, kind: "infoguard",
      label: `Инфограждение: ${item.name}`, buttonLabel: "Наложить Инфограждение",
      extra: { itemId: item.id }
    });
  });

  // «Улучшить» (wdbc-7td8): кнопка на строке оружия/брони открывает пикер
  // уже имеющихся у актора модификаций, совместимых с этим предметом.
  on(root, ".gear-mod-picker-btn", "click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) openGearModPicker(actor, item);
  });
}
