// module/rules/blood-smith-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Черта и Таланты Кузнеца Крови — чистая логика (Foundry-сторона —
//  combat/blood-smith-talents.mjs).
//
//  Порабощённые Кольцом Крови демоны — список на Кузнеце ENSLAVED_FLAG =
//  [{ name, wb, god }]. Его читают:
//   • Bound by Blood / Связанный Кровью — Призыв порабощённого демона идёт со
//     строкой «Запитан нужной жертвой» (+10) без жертвы (apps/ritual-cast.mjs);
//   • Daemon Plate / Демонические Латы — вселение демона в доспех;
//   • Unforge / Расковать — взрыв демонического оружия 2d10+2×W.b демона.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
export const ENSLAVED_FLAG = "enslavedDaemons";
export const RING_OF_BLOOD_FLAG = "ringOfBlood";
export const DAEMON_PLATE_FLAG = "daemonPlate";
export const UNFORGE_RADIUS = 8;

/** Нормализация имени демона: английская половина двуязычного, без регистра и лишних пробелов. */
export function daemonKey(name) {
  return String(name ?? "").split("/")[0].trim().toLowerCase().replace(/\s+/g, " ");
}

/** Порабощённые Кузнецом демоны. */
export function enslavedList(actor) {
  const raw = actor?.flags?.[NS]?.[ENSLAVED_FLAG] ?? actor?.getFlag?.(NS, ENSLAVED_FLAG);
  return Array.isArray(raw) ? raw.filter(d => d && d.name) : [];
}

/** Список после порабощения ещё одного (по имени — без повторов, W.b обновляется). */
export function addEnslaved(list, demon) {
  const key = daemonKey(demon?.name);
  if (!key) return [...(list ?? [])];
  const rest = (list ?? []).filter(d => daemonKey(d.name) !== key);
  return [...rest, { name: String(demon.name), wb: Math.max(0, Number(demon.wb) || 0), god: String(demon.god ?? "") }];
}

/** Список без демона (освобождён/материализовался). */
export function removeEnslaved(list, name) {
  const key = daemonKey(name);
  return (list ?? []).filter(d => daemonKey(d.name) !== key);
}

/** Связанный Кровью: Призыв однажды порабощённого демона — жертва засчитана каплями крови. */
export function boundByBloodSacrifice(actor, ritualType, demonName) {
  if (ritualType !== "summon" || !daemonKey(demonName)) return false;
  if (!hasItemNamed(actor, "Bound by Blood", ["talent"])) return false;
  const key = daemonKey(demonName);
  return enslavedList(actor).some(d => daemonKey(d.name) === key);
}

/** Демоническое оружие с порабощённым демоном (Расковать). */
export function unforgeable(item) {
  const dw = item?.system?.daemonWeapon;
  return item?.type === "weapon" && !!dw?.bound && !!dw?.subdued;
}

/** Урон Расковать: 2d10 + 2×W.b демона. */
export function unforgeFormula(wb) {
  const n = Math.max(0, Number(wb) || 0);
  return n ? `2d10 + ${2 * n}` : "2d10";
}

/**
 * Обновление оружия при порабощении демона Кольцом Крови (общий пакет
 * демонического оружия: +W.b к Dmg и Pen, Reinforced, без Primitive и
 * Sanctified). Оружие уже демоническое — второй демон: W.b суммируется.
 * @param {object} sys  weapon.system
 * @param {{name:string, wb:number, god?:string}} demon
 * @param {(dmg:string, n:number)=>string} addFlatDamage  constants/demon-weapon.mjs
 */
export function ringOfBloodWeaponUpdate(sys, demon, addFlatDamage) {
  const wb = Math.max(0, Number(demon?.wb) || 0);
  const dw = sys?.daemonWeapon ?? {};
  if (dw.bound) {
    return {
      second: true,
      update: {
        "system.damage": addFlatDamage(sys.damage || "", wb),
        "system.penetration": (Number(sys.penetration) || 0) + wb,
        "system.daemonWeapon.demonWb": (Number(dw.demonWb) || 0) + wb,
        "system.daemonWeapon.demonName": `${dw.demonName || "?"} + ${demon.name}`
      }
    };
  }
  const preProps = Array.isArray(sys?.weaponProps) ? sys.weaponProps.map(p => ({ ...p })) : [];
  const preDamage = sys?.damage || "";
  const prePen = Number(sys?.penetration) || 0;
  const props = preProps.filter(p => p.key !== "primitive" && p.key !== "sanctified")
    .concat(preProps.some(p => p.key === "reinforced") ? [] : [{ key: "reinforced" }]);
  return {
    second: false,
    update: {
      "system.weaponProps": props,
      "system.damage": addFlatDamage(preDamage, wb),
      "system.penetration": prePen + wb,
      "system.daemonWeapon": {
        bound: true, god: demon.god || "undivided", demonName: demon.name, binding: 0, demonWb: wb, demonInf: 0,
        subdued: true, runic: false, properties: [], preProps, preDamage, prePen
      }
    }
  };
}
