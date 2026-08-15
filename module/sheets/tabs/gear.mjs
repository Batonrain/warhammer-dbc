// module/sheets/tabs/gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снаряжение на листе персонажа: экипировка, ручные щиты, ammo/reload.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { _reloadWeapon } from "../../combat/reload.mjs";
import { _toggleShield, _rollShieldActivation, _repairShield } from "../../combat/shield.mjs";
import { on } from "../../helpers/utils.mjs";

export async function equipItem(item, equipped) {
  if (!item) return;
  await item.update({ "system.equipped": equipped });
  await syncItemEffectsDisabled(item, equipped);
  // Эффекты установленных модификаций гаснут вместе с носителем (isItemActive),
  // но update пришёл не им — пересчитываем сами.
  for (const mod of item.parent?.items ?? [])
    if (mod.system?.installedOn === item.id) await syncItemEffectsDisabled(mod);
}

export async function setShieldHand(item, hand) {
  if (!item) return;
  await item.setFlag("warhammer-dbc", "shieldHand", hand);
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
  repairShield = _repairShield
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

  // ── Ручные щиты (стр. 215) ───────────────────────────────────────────
  // Рука определяет, какая «Р1» в зонах защиты; «поднять щит» включает зоны,
  // указанные в скобках (они прикрываются лишь осознанным движением).
  on(root, ".shield-hand-btn", "click", async ev => {
    ev.preventDefault();
    const el = ev.currentTarget;
    await setShieldHand(actor.items.get(el.dataset.itemId), el.dataset.hand);
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
}
