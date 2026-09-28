// module/rules/emergency-maintenance.mjs
// ════════════════════════════════════════════════════════════════════════
//  Emergency Maintenance / Экстренное Обслуживание — Черта Архетипа
//  Технодесантник. Книга: «Технодесантник может потратить Очко Бесчестия и
//  полное действие, чтобы починить повреждения оружия, брони, или
//  снаряжения Легиона, обычно требующие до 1 смены работы.»
//
//  Чистая часть: какие повреждения на акторе система вообще ведёт и чем их
//  чинить. Ровно те состояния, у которых в системе уже есть «обычный»
//  ремонт не дольше смены работы:
//   - разъеденный AP брони (Corrosive, system.armorCorrosion) — «за ½ смены
//     работы» (combat/damage.mjs::repairArmorCorrosion);
//   - заклинившее оружие (system.jammed) — combat/clear-jam.mjs;
//   - сломанное оружие (system.destroyed) — Огрин ломает «до починки за ½
//     смены» (combat/ogryn-weapon-break.mjs); прочие источники поломки тоже
//     ставят это поле — сколько чинить их «обычно», решает стол;
//   - перегруженный/повреждённый силовой щит (status overloaded/damaged) —
//     combat/shield.mjs::_repairShield.
//  НЕ проверяется [допущение]: что вещь именно «Легиона» — у предметов нет
//  признака принадлежности Легиону, отличающего его снаряжение от чужого.
//  Кнопка — kind:"script" на Черте (цена 1 Очко Бесчестия), полное действие
//  списывает combat/emergency-maintenance.mjs.
// ════════════════════════════════════════════════════════════════════════

import { AP_LOCATIONS } from "../constants/effect-keys.mjs";

/** Полное действие — 2 ОД (тот же счёт, что у Загонщика, combat/action-economy.mjs). */
export const EMERGENCY_MAINTENANCE_AP = 2;

const BROKEN_SHIELD = new Set(["overloaded", "damaged"]);

/** Состояние щита предмета: у импланта со встроенным дефлектором — в system.shield. */
function shieldState(item) {
  if (item?.type === "implant") {
    const s = item.system?.shield;
    return s?.enabled ? { sys: s, prefix: "system.shield." } : null;
  }
  if (item?.type === "forcefield") return { sys: item.system || {}, prefix: "system." };
  return null;
}

/**
 * Что на акторе можно починить Экстренным Обслуживанием.
 * @returns {{key:string, kind:"corrosion"|"jam"|"destroyed"|"shield", label:string, itemId?:string, loc?:string}[]}
 */
export function emergencyRepairCandidates(actor) {
  const out = [];
  const corrosion = actor?.system?.armorCorrosion || {};
  for (const [loc, label] of Object.entries(AP_LOCATIONS)) {
    const n = Number(corrosion[loc]) || 0;
    if (n > 0) out.push({ key: `corrosion:${loc}`, kind: "corrosion", loc, label: `Броня — ${label}: разъедено ${n} AP` });
  }
  for (const item of actor?.items ?? []) {
    if (item.type === "weapon") {
      if (item.system?.destroyed) out.push({ key: `destroyed:${item.id}`, kind: "destroyed", itemId: item.id, label: `${item.name}: сломано` });
      if (item.system?.jammed) out.push({ key: `jam:${item.id}`, kind: "jam", itemId: item.id, label: `${item.name}: заклинило` });
    }
    const sh = shieldState(item);
    if (sh && BROKEN_SHIELD.has(sh.sys.status)) {
      const what = sh.sys.status === "damaged" ? "повреждён" : "перегружен";
      out.push({ key: `shield:${item.id}`, kind: "shield", itemId: item.id, label: `${item.name}: щит ${what}` });
    }
  }
  return out;
}

/**
 * Правка для починки: куда писать и что.
 * @returns {{target:"actor"|"item", itemId?:string, update:object}|null}
 */
export function emergencyRepairPatch(actor, candidate) {
  switch (candidate?.kind) {
    case "corrosion":
      return { target: "actor", update: { [`system.armorCorrosion.${candidate.loc}`]: 0 } };
    case "jam":
      return { target: "item", itemId: candidate.itemId, update: { "system.jammed": false, "system.jamLockedRound": 0 } };
    case "destroyed":
      return { target: "item", itemId: candidate.itemId, update: { "system.destroyed": false } };
    case "shield": {
      const item = actor?.items?.get?.(candidate.itemId) ?? [...(actor?.items ?? [])].find(i => i.id === candidate.itemId);
      const p = shieldState(item)?.prefix ?? "system.";
      // Тот же итог, что у обычного ремонта щита (combat/shield.mjs::_repairShield).
      return { target: "item", itemId: candidate.itemId,
               update: { [`${p}status`]: "inactive", [`${p}equipped`]: false, [`${p}currentRating`]: 0 } };
    }
    default: return null;
  }
}
