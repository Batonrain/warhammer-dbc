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
//  «Психокостяная природа» предмета и «иммунное снаряжение (сложный
//  принцип работы или мистическая/божественная природа)» — не проверяются
//  автоматически (в схеме предметов нет флага «психокость»/«иммунно»),
//  решение оставлено игроку/ГМу при отметке чекбоксов в диалоге, тем же
//  приёмом, что и непроверяемая дальность W м у сиблингов
//  (bone-song/preservation/song-of-swiftness).
//
//  По категориям автоматизировано ЧАСТИЧНО — заклинивание оружия не
//  отслеживается движком нигде в проекте (grep подтверждён, wdbc-vwfk):
//  реален только Reinforced (реальное свойство в weaponProps) и новый флаг
//  destroyed (тот же паттерн, что armor.mjs::breached — чистая метка
//  состояния без даунстрим-автоматизации). Аблативные раны/«доп. AP от
//  талантов» при Разрушении брони — тоже не смоделированы (нет реестра
//  «источников доп. AP», тот же вывод, что doombc-armor-properties-
//  automation про «нет инфраструктуры утраченного AP»); в чат идёт явное
//  напоминание ГМу. Качество Снаряжения — единственная категория, где
//  двигается РЕАЛЬНЫЙ движок (module/constants/quality.mjs).
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

  if (mode === "restore") {
    const created = await owner.createEmbeddedDocuments("Item", [
      {
        name: "Reformation Song — Восстановление", type: "armorMod", img: MOD_ICON,
        system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
          activatable: false, active: true, effects: { apAll: felBonus } }
      },
      {
        name: "Reformation Song — Аблативный слой", type: "armorMod", img: MOD_ICON,
        system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
          activatable: false, active: true, effects: { apAll: half } }
      }
    ]);
    await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "armorMod", modIds: created.map(c => c.id) });
    return `<div>${esc(item.name)} (Броня, ${esc(owner.name)}): <b>Восстановление</b> — +${felBonus} AP всем зонам, +${half} аблативных AP (как мод. «Аблативная»), до конца боя.</div>`;
  }

  const created = await owner.createEmbeddedDocuments("Item", [
    {
      name: "Reformation Song — Разрушение", type: "armorMod", img: MOD_ICON,
      system: { installedOn: item.id, category: "armor", modGroup: "reinforcement",
        activatable: false, active: true, effects: { apAll: -felBonus } }
    }
  ]);
  await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "armorMod", modIds: created.map(c => c.id) });
  return `<div>${esc(item.name)} (Броня, ${esc(owner.name)}): <b>Разрушение</b> — −${felBonus} AP всем зонам (не уничтожается), до конца боя.
    <div style="font-size:0.85em;opacity:.8;">Аблативные раны и доп. AP от других модов/талантов на эту броню — не отслеживаются автоматически, снимите вручную, если применимо.</div></div>`;
}

// ─── Оружие ──────────────────────────────────────────────────────────────

async function applyToWeapon(item, mode, felBonus) {
  const isMelee = MELEE_CLASSES.has(item.system?.weaponClass);
  const props = Array.isArray(item.system?.weaponProps) ? item.system.weaponProps : [];
  const hasReinforced = props.some(p => p?.key === "reinforced");
  const jamNote = `<div style="font-size:0.85em;opacity:.8;">Заклинивание не отслеживается движком нигде в проекте — статус ведите вручную в чате.</div>`;

  if (mode === "restore") {
    const updates = {};
    const wasDestroyed = !!item.system?.destroyed;
    if (wasDestroyed) updates["system.destroyed"] = false;
    let addedReinforced = false;
    if (!hasReinforced) {
      updates["system.weaponProps"] = [...props, { key: "reinforced" }];
      addedReinforced = true;
    }
    if (Object.keys(updates).length) await item.update(updates);
    if (addedReinforced) await item.setFlag("warhammer-dbc", REVERT_FLAG, { kind: "weaponReinforcedAdded" });
    return `<div>${esc(item.name)} (Оружие): <b>Восстановление</b> — расклинено${wasDestroyed ? ", восстановлено из уничтоженного" : ""}${addedReinforced ? ", +Reinforced до конца боя" : " (Reinforced уже было)"}.${jamNote}</div>`;
  }

  if (!isMelee) {
    return `<div>${esc(item.name)} (Оружие, стрелковое): <b>Разрушение</b> — заклинивает и не расклинивается 1 раунд.${jamNote}</div>`;
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
 * Снимает эффекты «до конца боя» (моды AP брони, временный Reinforced,
 * временное качество Снаряжения) со всех актёров боя — звать в
 * module/hooks.mjs::deleteCombat, тем же тактом, что и
 * clearSongOfSwiftnessBuffs. Постоянные изменения (destroyed у оружия при
 * Разрушении без Reinforced) сознательно НЕ трогает — они не были «до
 * конца боя» и в книге не восстанавливаются.
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
