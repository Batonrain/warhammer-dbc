// module/combat/reformation-song.mjs
// ════════════════════════════════════════════════════════════════════════
//  Reformation Song/Песня Изменений (Талант Певцов Кости, wdbc-vwfk, найден
//  при аудите wdbc-sk8s): «За Полное действие — до F.b психокостяных вещей
//  в радиусе W м получают Восстановление или Разрушение (на выбор, per-
//  target; цели — Оружие, Снаряжение, Броня). До 3 раз за сессию.»
//
//  Не ложится на общий диалог module/apps/wraithbone-song-dialog.mjs
//  (тот — бинарный выбор «одна техника / вся техника в радиусе», один
//  эффект на всех) — здесь наоборот: до F.b РАЗНЫХ предметов, каждый со
//  своим режимом. Свой диалог — module/apps/reformation-song-dialog.mjs.
//
//  «Психокостяная природа» предмета и «иммунное снаряжение (сложный принцип
//  работы или мистическая/божественная природа)» — реальные флаги схемы
//  (weapon/armor/gear .mjs: wraithbone/wraithboneImmune), не текстовая
//  договорённость: apps/reformation-song-dialog.mjs фильтрует кандидатов по
//  ним. Засеяны true только там, где книга/название предмета однозначны
//  (см. комментарий у поля в data/item/weapon.mjs) — на новом/самодельном
//  предмете их выставляет тот, кто его завёл, читается как есть.
//
//  Заклинивание оружия (wdbc-vwfk) впервые в проекте стало РЕАЛЬНЫМ
//  состоянием (weapon.system.jammed) — combat/attack.mjs пишет его при
//  срабатывании существующего jamThreshold(), UI блокирует «Атака» тем же
//  приёмом, что magEmpty, снимается кнопкой «Расклинить»
//  (combat/weapon-properties.mjs::clearWeaponJam, доступной всегда — тот же
//  паттерн «без теста/времени», что у Ремонта Разъедания в damage.mjs).
//  «Не расклинивается 1 раунд» от Разрушения — jamLockedRound.
//
//  «Доп. AP от других модов/талантов» и аблативные раны при Разрушении
//  брони — тоже реальны: getInstalledArmorMods (combat/armor-mods.mjs)
//  глушит на этой броне все моды, кроме собственных модов Reformation Song,
//  пока стоит флаг reformationSongSuppressMods; актёрский пул Аблативных
//  Ран (system.wounds.ablativeMax/ablative) обнуляется на то же «до конца
//  боя». Оба откатываются в clearReformationSongBuffs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { normQuality, ITEM_QUALITY } from "../constants/quality.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "reformationSong";
const REVERT_FLAG = "reformationSongRevert";
const MOD_ICON = "systems/warhammer-dbc/assets/item-icons/armormod.svg";
const MELEE_CLASSES = new Set(["melee", "thrown"]);
const QUALITY_STEP_UP   = { poor: "common", common: "good", good: "best", best: "best" };
const QUALITY_STEP_DOWN = { best: "good", good: "common", common: "poor", poor: "poor" };

/** Владеет ли актор Талантом Reformation Song / Песня Изменений. */
export function hasReformationSong(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Reformation Song"));
}

/** Лимит использований за сессию — фиксированный, 3 (не зависит от F.b). */
export function reformationSongMax() { return 3; }

export function reformationSongAvailable(actor) {
  return hasReformationSong(actor) && isThrottleCountAvailable(actor, FLAG, "session", reformationSongMax());
}

/** До скольки предметов за один каст — F.b (минимум 1). */
export function reformationSongTargetCount(actor) {
  return Math.max(1, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

/** Радиус выборки кандидатов — W.b (Сила Воли) метров, минимум 0. */
export function reformationSongRadius(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.wp?.bonus) || 0);
}

async function spendAndCount(actor) {
  await incrementThrottleCount(actor, FLAG, "session", reformationSongMax());
}

// ─── Броня ───────────────────────────────────────────────────────────────

async function applyToArmor(item, mode, felBonus) {
  const owner = item.parent;
  const half = Math.ceil(felBonus / 2);
  const rsFlags = { "warhammer-dbc": { reformationSongMod: true } };

  if (mode === "restore") {
    const created = await owner.createEmbeddedDocuments("Item", [
      {
        name: "Reformation Song — Восстановление", type: "armorMod", img: MOD_ICON, flags: rsFlags,
        system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
          activatable: false, active: true, effects: { apAll: felBonus } }
      },
      {
        name: "Reformation Song — Аблативный слой", type: "armorMod", img: MOD_ICON, flags: rsFlags,
        system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
          activatable: false, active: true, effects: { apAll: half } }
      }
    ]);
    await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "armorMod", modIds: created.map(c => c.id) });
    return `<div>${esc(item.name)} (Броня, ${esc(owner.name)}): <b>Восстановление</b> — +${felBonus} AP всем зонам, +${half} аблативных AP (как мод. «Аблативная»), до конца боя.</div>`;
  }

  const created = await owner.createEmbeddedDocuments("Item", [
    {
      name: "Reformation Song — Разрушение", type: "armorMod", img: MOD_ICON, flags: rsFlags,
      system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
        activatable: false, active: true, effects: { apAll: -felBonus } }
    }
  ]);
  // «Доп. AP от других модов/талантов на эту броню» — глушим ВСЕ чужие моды
  // ИМЕННО ЭТОЙ брони: флаг стоит на самой броне (item), не на акторе —
  // combat/armor-mods.mjs::getInstalledArmorMods читает его так же, кроме
  // только что созданного мода «Разрушение» — тот отмечен reformationSongMod
  // и не глушится собственной проверкой.
  await item.setFlag("warhammer-dbc", "reformationSongSuppressMods", true);

  // «Аблативные раны нивелируются» — актёрский пул (не привязан к конкретной
  // броне), обнуляем целиком, пока не 0 уже; восстанавливаем по концу боя.
  const ablativeMax = Number(owner.system?.wounds?.ablativeMax) || 0;
  let ablativeNote = "";
  const revert = { kind: "armorMod", modIds: created.map(c => c.id), unsuppressMods: true };
  if (ablativeMax > 0) {
    revert.originalAblativeMax = ablativeMax;
    await owner.update({ "system.wounds.ablativeMax": 0, "system.wounds.ablative": 0 });
    ablativeNote = `, Аблативные Раны (${ablativeMax}) нивелированы`;
  }
  await item.setFlag("warhammer-dbc", REVERT_FLAG, revert);

  return `<div>${esc(item.name)} (Броня, ${esc(owner.name)}): <b>Разрушение</b> — −${felBonus} AP всем зонам (не уничтожается), доп. AP от других модов на этой броне нивелированы${ablativeNote}, до конца боя.</div>`;
}

// ─── Оружие ──────────────────────────────────────────────────────────────

async function applyToWeapon(item, mode, felBonus) {
  const isMelee = MELEE_CLASSES.has(item.system?.weaponClass);
  const props = Array.isArray(item.system?.weaponProps) ? item.system.weaponProps : [];
  const hasReinforced = props.some(p => p?.key === "reinforced");

  if (mode === "restore") {
    const updates = {};
    const wasDestroyed = !!item.system?.destroyed;
    if (wasDestroyed) updates["system.destroyed"] = false;
    const wasJammed = !!item.system?.jammed;
    if (wasJammed) { updates["system.jammed"] = false; updates["system.jamLockedRound"] = 0; }
    let addedReinforced = false;
    if (!hasReinforced) {
      updates["system.weaponProps"] = [...props, { key: "reinforced" }];
      addedReinforced = true;
    }
    if (Object.keys(updates).length) await item.update(updates);
    if (addedReinforced) await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "weaponReinforcedAdded" });
    return `<div>${esc(item.name)} (Оружие): <b>Восстановление</b> — ${wasJammed ? "расклинено" : "заклинивания не было"}${wasDestroyed ? ", восстановлено из уничтоженного" : ""}${addedReinforced ? ", +Reinforced до конца боя" : " (Reinforced уже было)"}.</div>`;
  }

  if (!isMelee) {
    // «Не расклинивается 1 раунд» — только пока идёт бой (canClearJam сам
    // не блокирует ничего вне боя, раунд посчитать не от чего).
    const lockedRound = game.combat ? game.combat.round + 1 : 0;
    await item.update({ "system.jammed": true, "system.jamLockedRound": lockedRound });
    return `<div>${esc(item.name)} (Оружие, стрелковое): <b>Разрушение</b> — заклинило${lockedRound ? ", не расклинивается 1 раунд" : ""}.</div>`;
  }
  if (hasReinforced) {
    const idx = props.findIndex(p => p?.key === "reinforced");
    const removed = props[idx];
    const newProps = props.slice(0, idx).concat(props.slice(idx + 1));
    await item.update({ "system.weaponProps": newProps });
    await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "weaponReinforcedRemoved", prop: removed });
    return `<div>${esc(item.name)} (Оружие, рукопашное): <b>Разрушение</b> — теряет Reinforced до конца боя.</div>`;
  }
  await item.update({ "system.destroyed": true });
  return `<div>${esc(item.name)} (Оружие, рукопашное, без Reinforced): <b>Разрушение</b> — предмет уничтожен.</div>`;
}

// ─── Снаряжение ──────────────────────────────────────────────────────────

async function applyToGear(item, mode) {
  const q = normQuality(item.system?.quality);

  if (mode === "restore") {
    const updates = {};
    const wasMalfunctioning = !!item.system?.malfunctioning;
    if (wasMalfunctioning) updates["system.malfunctioning"] = false;
    const newQ = QUALITY_STEP_UP[q];
    const stepped = newQ !== q;
    if (stepped) updates["system.quality"] = newQ;
    if (Object.keys(updates).length) await item.update(updates);
    if (stepped) await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "gearQuality", originalQuality: q });
    return `<div>${esc(item.name)} (Снаряжение): <b>Восстановление</b> — работа восстановлена${stepped ? `, качество ${ITEM_QUALITY[q].label} → ${ITEM_QUALITY[newQ].label} до конца боя` : " (уже Высшее качество)"}.</div>`;
  }

  const newQ = QUALITY_STEP_DOWN[q];
  const stepped = newQ !== q;
  const updates = { "system.malfunctioning": true };
  if (stepped) updates["system.quality"] = newQ;
  await item.update(updates);
  if (stepped) await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "gearQuality", originalQuality: q });
  return `<div>${esc(item.name)} (Снаряжение): <b>Разрушение</b> — не работает до начала следующего Хода владельца${stepped ? `, качество ${ITEM_QUALITY[q].label} → ${ITEM_QUALITY[newQ].label} до конца боя` : " (уже Низкое качество)"}.</div>`;
}

/**
 * Применяет Reformation Song к набору выбранных предметов.
 * @param {Actor} actor — кастер (Певец Кости).
 * @param {Array<{item: Item, mode: "restore"|"destroy"}>} picks — до
 *   reformationSongTargetCount(actor) предметов, каждый типа weapon/armor/gear.
 */
export async function applyReformationSong(actor, picks) {
  await spendAndCount(actor);
  const felBonus = Number(actor.system?.characteristics?.fel?.bonus) || 0;

  const lines = [];
  for (const { item, mode } of picks) {
    if (item.type === "armor") lines.push(await applyToArmor(item, mode, felBonus));
    else if (item.type === "weapon") lines.push(await applyToWeapon(item, mode, felBonus));
    else if (item.type === "gear") lines.push(await applyToGear(item, mode));
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warp", "#7fd3ff")}Reformation Song / Песня Изменений</div>
      ${lines.length ? lines.join("") : "<div><i>Ничего не выбрано</i></div>"}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Снимает эффекты «до конца боя» (моды AP брони + глушение чужих модов на
 * ней, аблативный пул актора, временный Reinforced, временное качество
 * Снаряжения) со всех актёров боя — звать в module/hooks.mjs::deleteCombat,
 * тем же тактом, что и clearSongOfSwiftnessBuffs. Постоянные изменения
 * (destroyed/jammed у оружия — заклинивание и «уничтожено» книгой не
 * привязаны к «до конца боя») сознательно НЕ трогает.
 */
export async function clearReformationSongBuffs(combat) {
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    if (!actor?.items) continue;
    for (const item of [...actor.items]) {
      const revert = item.getFlag?.("warhammer-dbc", REVERT_FLAG);
      if (!revert) continue;

      if (revert.kind === "armorMod") {
        const ids = (revert.modIds || []).filter(id => actor.items.get(id));
        if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        if (revert.unsuppressMods) await item.unsetFlag("warhammer-dbc", "reformationSongSuppressMods");
        if (revert.originalAblativeMax != null) {
          await actor.update({ "system.wounds.ablativeMax": revert.originalAblativeMax });
        }
      } else if (revert.kind === "weaponReinforcedAdded") {
        const props = (item.system?.weaponProps || []).filter(p => p?.key !== "reinforced");
        await item.update({ "system.weaponProps": props });
      } else if (revert.kind === "weaponReinforcedRemoved") {
        await item.update({ "system.weaponProps": [...(item.system?.weaponProps || []), revert.prop] });
      } else if (revert.kind === "gearQuality") {
        await item.update({ "system.quality": revert.originalQuality });
      }
      await item.unsetFlag("warhammer-dbc", REVERT_FLAG);
    }
  }
}

/**
 * Снимает malfunctioning со Снаряжения актора в начале его Хода («не
 * работает на раунд» читается как «до начала следующего Хода владельца» —
 * тот же идиоматический приём, что Грозный Вопль/Поклон Публике в
 * module/hooks.mjs. Звать оттуда же, тем же тактом.
 */
export async function clearExpiredGearMalfunction(actor) {
  if (!actor?.items) return;
  for (const item of actor.items) {
    if (item.type === "gear" && item.system?.malfunctioning) {
      await item.update({ "system.malfunctioning": false });
    }
  }
}
