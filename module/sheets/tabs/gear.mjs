// module/sheets/tabs/gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снаряжение на листе персонажа: экипировка, ручные щиты, ammo/reload.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { _reloadWeapon } from "../../combat/reload.mjs";
import { _toggleShield, _rollShieldActivation, _repairShield } from "../../combat/shield.mjs";

export async function equipItem(item, equipped) {
  if (!item) return;
  await item.update({ "system.equipped": equipped });
  await syncItemEffectsDisabled(item, equipped);
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

export function activateGearListeners(html, actor, {
  reloadWeapon = _reloadWeapon,
  toggleShield = _toggleShield,
  rollShieldActivation = _rollShieldActivation,
  repairShield = _repairShield
} = {}) {
  html.find(".weapon-equip-cb").change(async ev => {
    const itemId   = ev.currentTarget.dataset.itemId;
    const equipped = ev.currentTarget.checked;
    await equipItem(actor.items.get(itemId), equipped);
  });

  html.find(".armor-equip-cb").change(async ev => {
    const itemId   = ev.currentTarget.dataset.itemId;
    const equipped = ev.currentTarget.checked;
    await equipItem(actor.items.get(itemId), equipped);
  });

  // ── Ручные щиты (стр. 215) ───────────────────────────────────────────
  // Рука определяет, какая «Р1» в зонах защиты; «поднять щит» включает зоны,
  // указанные в скобках (они прикрываются лишь осознанным движением).
  html.find(".shield-hand-btn").click(async ev => {
    ev.preventDefault();
    const el = ev.currentTarget;
    await setShieldHand(actor.items.get(el.dataset.itemId), el.dataset.hand);
  });
  html.find(".shield-raise-btn").click(async ev => {
    ev.preventDefault();
    await toggleShieldRaised(actor.items.get(ev.currentTarget.dataset.itemId));
  });

  html.find(".weapon-reload-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await reloadWeapon(actor, item);
  });

  html.find(".weapon-ammo-select").change(async ev => {
    const itemId = ev.currentTarget.dataset.itemId;
    const ammoId = ev.currentTarget.value;
    await setWeaponLoadedAmmo(actor.items.get(itemId), ammoId);
  });

  html.find(".shield-row").on("dblclick", ev => {
    if (ev.target?.closest?.("button")) return;
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find(".shield-toggle-btn, .shield-roll-btn, .shield-repair-btn").on("contextmenu", ev => {
    ev.stopPropagation();
  });

  html.find(".shield-toggle-btn").on("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await toggleShield(actor, item);
  });

  html.find(".shield-roll-btn").on("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await rollShieldActivation(actor, item);
  });

  html.find(".shield-repair-btn").on("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const itemId = ev.currentTarget.dataset.itemId;
    const item   = actor.items.get(itemId);
    if (item) await repairShield(actor, item);
  });
}
