// module/apps/armiger-weapon.mjs
// ════════════════════════════════════════════════════════════════════════
//  Демон-Оруженосец в оружии (wdbc-1rno, шаг D: Инфернальный Оруженосец,
//  «...может тем же ритуалом призвать его в своё оружие, превратив его в
//  Демоническое Оружие»).
//
//  НЕ переиспользует полностью Осквернение (module/apps/veil.mjs, вкладка
//  «Осквернение») — та таблица случайных Демонических Свойств завязана на
//  бросок и Связывание (степени успеха), а этот ритуал — noTest, без броска
//  вовсе. Книга не даёт оснований выдумывать случайные свойства там, где
//  сама не бросает кубик, поэтому здесь только ОБЩИЙ пакет демон-оружия
//  (DEMON_WEAPON_COMMON): +W.b к Dmg/Pen, Reinforced, теряет Primitive/
//  Sanctified — без похода по DEMON_WEAPON_TABLES. Оба пути пишут в один и
//  тот же system.daemonWeapon (module/data/item/weapon.mjs), поэтому прочие
//  системы (Blood Shield и т.п.) не видят разницы, откуда взялось связывание.
//
//  Бестиарий скрыт от игрока (ownership.PLAYER:"NONE") — как и в
//  module/apps/demon-summon.mjs, реальный Inf демона узнаёт только ГМ,
//  поэтому здесь тот же приём: ГМ — напрямую, иначе сокет-релей
//  (action:"bindArmigerWeapon", обработчик — warhammer-dbc.mjs).
//
//  W.b демона — не берётся из профиля конкретного бестиарного актора (тот же
//  подход, что у GM-инструмента Осквернения — DEMON_INF_FORMULAS): все четыре
//  демона-Оруженосца книжно — низшие демоны богов, категория "lesser" (W.b 4).
// ════════════════════════════════════════════════════════════════════════

import { DEMON_WEAPON_COMMON, addFlatDamage } from "../constants/demon-weapon.mjs";
import { findBestiaryActor } from "./demon-summon.mjs";

export { DEMON_WEAPON_COMMON };

// DEMON_INF_FORMULAS.lesser.wb (module/constants/demon-weapon.mjs) — «Низшие
// демоны Богов», категория демонов-Оруженосцев книги.
export const ARMIGER_DEMON_WB = 4;

/**
 * Связать демона-Оруженосца с оружием ритуалиста — та же запись, что и у
 * ручного Осквернения (item.system.daemonWeapon), плюс отдельный флаг
 * armigerBound (module/sheets/item-sheet.mjs::onWmsRelease читает его, чтобы
 * при изгнании ВСЕГДА уничтожать оружие, без шанса стать Руническим).
 * @returns {Promise<{ok:boolean, reason?:string, weaponName?:string}>}
 */
export async function bindArmigerWeapon(weaponUuid, demonName, god = "undivided") {
  const weapon = await fromUuid(weaponUuid).catch(() => null);
  if (!weapon) return { ok: false, reason: "Оружие не найдено — демон-Оруженосец остался в Истинной Форме." };
  if (weapon.system?.daemonWeapon?.bound) return { ok: false, reason: "Это оружие уже демоническое." };

  const src = await findBestiaryActor(demonName);
  const demonInf = src?.system?.characteristics?.inf?.total ?? 0;
  const wb = ARMIGER_DEMON_WB;

  const preProps  = foundry.utils.deepClone(weapon.system.weaponProps || []);
  const preDamage = weapon.system.damage || "";
  const prePen    = Number(weapon.system.penetration) || 0;

  const props = preProps
    .filter(p => p.key !== "primitive" && p.key !== "sanctified")
    .concat(preProps.some(p => p.key === "reinforced") ? [] : [{ key: "reinforced" }]);

  await weapon.update({
    "system.weaponProps": props,
    "system.damage": addFlatDamage(preDamage, wb),
    "system.penetration": prePen + wb,
    "system.daemonWeapon": {
      bound: true, god, demonName, binding: 0, demonWb: wb, demonInf,
      // Демон-Оруженосец служит патрону добровольно (проза Дара — «даёт в
      // услужение»), не силой Осквернения — subdued:true (см. module/rules/
      // blood-shield.mjs: «порабощён» = не сопротивляется связи, RAW-условие
      // для Кровавого Щита).
      subdued: true, runic: false, properties: [], preProps, preDamage, prePen
    },
    "flags.warhammer-dbc.armigerBound": true
  });
  return { ok: true, weaponName: weapon.name };
}

/** ГМ — напрямую; иначе сокет-релей (обработчик — warhammer-dbc.mjs, action:"bindArmigerWeapon"). */
export async function defaultBindArmigerWeaponFn(weaponUuid, demonName, god) {
  if (!weaponUuid || !demonName) return;
  if (game.user?.isGM) {
    const res = await bindArmigerWeapon(weaponUuid, demonName, god);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — оружие не осквернено, свяжите демона вручную во вкладке «Осквернение».");
    return;
  }
  game.socket?.emit("system.warhammer-dbc",
    { action: "bindArmigerWeapon", userId: game.user?.id, weaponUuid, demonName, god });
}
