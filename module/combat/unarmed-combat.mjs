// module/combat/unarmed-combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БЕЗОРУЖНЫЙ БОЙ (core.json, «II. МЕХАНИКА → Безоружный Бой», стр. 40;
//  wdbc-x1nz.2.69/.70/.71).
//
//  «Вооруженный персонаж получает бонус +20 на Парирование безоружных атак и
//  может потратить 2 Успеха в тесте на Парирование, чтобы нанести атакующему
//  урон своего оружия с S.b атакующего вместо своего (в атакующую
//  конечность). Невооруженный персонаж получает штраф –20 на Парирование
//  полноценного рукопашного оружия.
//  Если силовое оружие «уничтожает» безоружную атаку, это считается попаданием
//  этим оружием в атакующую часть тела с 1 Успехом (используя S.b. атакующего
//  при парировании безоружной атаки силовым оружием), но сама безоружная атака
//  остается доступной.
//  Персонажи, вооруженные стрелковым оружием без рукопашных модификаций,
//  считаются безоружными против невооруженных атак, но считаются вооруженными
//  во всех прочих случаях, используя следующие профили...»
//
//  Сам бросок Парирования живёт в combat/defense.mjs::_performParry; здесь —
//  ответы на вопросы, которые он задаёт: чем парирует этот персонаж, куда
//  приходится «попадание в атакующую конечность», и сам бросок урона такого
//  попадания (он одинаков у Силового поля в обе стороны и у ответного удара
//  за 2 Успеха — отличаются только оружие и чей S.b).
//
//  «Безоружная атака» — интегральная атака (flags.warhammer-dbc.integralAttack:
//  Кулак/Пинок/Удар головой и естественное оружие — книга, «Natural Weapons:
//  Безоружные атаки наносят 1d10 урона»), тот же признак, которым defense.mjs
//  уже решал −20 безоружному.
// ════════════════════════════════════════════════════════════════════════════

import { equippedMeleeWeapon, isIntegralAttack } from "./equipped-melee.mjs";
import { improvisedMeleeProfile, IMPROVISED_MELEE_LABEL } from "./weapon-profiles.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { damageFormulaFor, meleeStrengthBonus } from "./attack-outcome.mjs";

/** «+20 на Парирование безоружных атак» вооружённому. */
export const ARMED_VS_UNARMED_PARRY_BONUS = 20;
/** «может потратить 2 Успеха в тесте на Парирование» на ответный удар. */
export const UNARMED_RIPOSTE_COST = 2;
/** Флаг карточки Парирования: ответный удар по ней уже нанесён (wdbc-t3c3t.8). */
export const UNARMED_RIPOSTE_USED_FLAG = "unarmedRiposteUsed";

/** Безоружная ли это атака/защита: нет оружия вовсе или интегральная атака. */
export function isUnarmedWeapon(weapon) {
  return !weapon || isIntegralAttack(weapon);
}

/**
 * «Атакующая конечность / часть тела» — по Хвату безоружного удара: Пинок
 * (Ног) — Нога, Удар головой (Гол) и Укус (Зуб) — Голова, Хвост — Торс
 * (своей зоны попадания у хвоста нет), всё прочее (Кист/1р/П/Л, когти) — Рука.
 * Строки — ключи combat/damage.mjs::LOCATION_TO_ARMOR.
 */
/** «в Руку / в Ногу / в Голову» — для текста карточки. */
export function locationAcc(location) {
  return { "Рука": "Руку", "Нога": "Ногу", "Голова": "Голову" }[location] ?? location;
}

export function strikeLocation(weapon) {
  const g = String(weapon?.system?.grips || "");
  if (/Ног/.test(g)) return "Нога";
  if (/Гол|Зуб/.test(g)) return "Голова";
  if (/Хв/.test(g)) return "Торс";
  return "Рука";
}

/**
 * Надетое стрелковое как рукопашное для Парирования: объект с формой
 * предмета-оружия, в котором system подменён профилем «Ударить оружием»
 * (урон/Баланс/свойства по таблице книги). Собственные свойства ствола
 * (Reliable, Tearing…) в Парирование не протекают — прикладом отбиваются не
 * ими. id — от настоящего ствола: по нему Контратака находит предмет.
 */
export function gunAsParryWeapon(gun, opts = {}) {
  const prof = improvisedMeleeProfile(gun, { isIntegralAttack, ...opts });
  if (!prof) return null;
  return {
    id: gun.id,
    uuid: gun.uuid,
    name: `${gun.name} (${IMPROVISED_MELEE_LABEL})`,
    type: "weapon",
    parent: gun.parent,
    actor: gun.actor ?? gun.parent,
    improvisedFrom: gun,
    improvisedProfile: prof,
    flags: {},
    getFlag: () => undefined,
    system: {
      ...gun.system,
      weaponClass: "melee",
      meleeCategory: prof.meleeCategory,
      balance: prof.balance,
      damage: prof.damage,
      damageType: prof.damageType,
      damageSubtype: prof.damageSubtype,
      penetration: prof.penetration,
      weaponProps: prof.weaponProps,
      profiles: []
    }
  };
}

/**
 * Чем персонаж парирует эту атаку.
 *
 * Настоящее рукопашное — всегда им. Без него: против безоружной атаки
 * стрелок «считается безоружным» — остаётся кулак (интегральная атака или
 * ничего); против всего прочего — «вооружённым» своим стрелковым по профилю
 * книги. Закреплённое тяжёлое (или стрелял из Закреплённого в этом Ходу)
 * профиля не даёт — weapon-profiles.mjs::braceBlocksMelee.
 */
export function parryWeaponFor(actor, { attackerUnarmed = false } = {}) {
  const melee = equippedMeleeWeapon(actor);
  if (melee && !isIntegralAttack(melee)) return melee;
  if (attackerUnarmed) return melee;
  const guns = (actor?.items ?? []).filter(i => i.type === "weapon" && i.system?.equipped
    && i.system.weaponClass !== "melee" && i.system.weaponClass !== "thrown");
  for (const gun of guns) {
    const standIn = gunAsParryWeapon(gun);
    if (standIn) return standIn;
  }
  return melee;
}

/**
 * Формула урона «попадания оружием с S.b атакующего» — общая для трёх
 * случаев правила. `weapon` — чьё оружие бьёт, `sbActor` — чей S.b.
 * Модификаторы S.b (Могучее/Сдержанное) — свойства бьющего оружия.
 */
export function strikeDamageFormula(weapon, sbActor, corruptionBonus = 0) {
  const wp = aggregateAuto(resolveWeaponProps(weapon));
  const sb = Number(sbActor?.system?.characteristics?.s?.bonus) || 0;
  return damageFormulaFor({
    damage: weapon?.system?.damage, flatBonus: meleeStrengthBonus({ sb, wp }),
    chars: sbActor?.system?.characteristics ?? {}, corruptionBonus, wp, isMelee: true
  });
}

/**
 * Бросить и применить такое попадание к `target`.
 * @returns {Promise<{roll: Roll, location: string}>}
 */
export async function rollStrikeOn(target, { weapon, sbActor, location, source, corruptionBonus = 0 }) {
  const wp = aggregateAuto(resolveWeaponProps(weapon));
  const roll = await new Roll(strikeDamageFormula(weapon, sbActor, corruptionBonus)).evaluate();
  const { applyDamageToActor } = await import("./damage.mjs");
  await applyDamageToActor(target, {
    rawDamage: roll.total, penetration: Number(weapon?.system?.penetration) || 0,
    damageType: weapon?.system?.damageType || "impact", damageSubtype: weapon?.system?.damageSubtype || "",
    hitLocation: location, melee: true, primitive: !!wp.primitive, felling: Number(wp.fellingRating) || 0,
    attackerName: source?.name ?? "", attackerUuid: source?.uuid ?? "", weaponName: weapon?.name ?? ""
  });
  return { roll, location };
}

/**
 * Клик по «Ответный удар» в карточке Парирования (wdbc-x1nz.2.69).
 *
 * В бою Успехи уже лежат в пуле Избегания (evasion-pool.mjs, стр. 12) —
 * списываем оттуда: иначе те же 2 Успеха можно было бы потратить и на удар, и
 * на снятие попадания следующей атаки. Пуста/устарела запись — удар не
 * проходит (Успехи уже потрачены или сменился Ход). Вне боя пула нет —
 * повтор сдерживает флаг на самой карточке Парирования (message): он виден
 * всем клиентам, а не только гасит кнопку у нажавшего (wdbc-t3c3t.8).
 */
export async function performUnarmedRiposte(defender, { weaponId, improvised = false, attackerUuid = "",
                                                        attackerWeaponUuid = "", banked = false, message = null } = {}) {
  if (!defender?.isOwner) return ui.notifications.warn("⚠️ Ответный удар наносит владелец парировавшего (или ГМ).");
  if (message?.getFlag("warhammer-dbc", UNARMED_RIPOSTE_USED_FLAG))
    return ui.notifications.warn("⚠️ Ответный удар по этому Парированию уже нанесён.");
  // Флаг на чужую карточку (её бросил ГМ) игрок записать не может — тогда
  // пусть бьёт ГМ: иначе однократность держалась бы лишь на одном клиенте.
  if (message && !message.canUserModify(game.user, "update"))
    return ui.notifications.warn("⚠️ Карточку Парирования бросал ГМ — ответный удар нажимает он.");
  const item = defender?.items?.get(weaponId);
  const weapon = improvised ? (item ? gunAsParryWeapon(item) : null) : item;
  if (!weapon) return ui.notifications.warn("⚠️ Оружие ответного удара не найдено или больше не годится для рукопашной.");
  const attacker = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  if (!attacker) return ui.notifications.warn("⚠️ Атаковавший не найден.");
  const attackerWeapon = attackerWeaponUuid ? await fromUuid(attackerWeaponUuid).catch(() => null) : null;
  if (banked) {
    const { spendPoolSuccesses } = await import("./evasion-pool.mjs");
    if (!await spendPoolSuccesses(defender, attackerUuid, UNARMED_RIPOSTE_COST))
      return ui.notifications.warn("⚠️ Неизрасходованных Успехов уже не хватает (потрачены или сменился Ход).");
  }
  await message?.setFlag("warhammer-dbc", UNARMED_RIPOSTE_USED_FLAG, true);
  const location = strikeLocation(attackerWeapon);
  const { roll } = await rollStrikeOn(attacker, {
    weapon, sbActor: attacker, location, source: defender,
    corruptionBonus: defender.system?.corruptionBonus ?? 0
  });
  const { postTestCard } = await import("../helpers/test-card.mjs");
  const { esc } = await import("../helpers/utils.mjs");
  await postTestCard(defender, {
    title: `Ответный удар — ${esc(defender.name)}`, actorUuid: defender.uuid,
    lines: [`<div class="roll-threshold">${esc(weapon.name)} → ${esc(attacker.name)}, в ${locationAcc(location)}: <b>${roll.total}</b> Dmg (урон оружия с S.b атакующего, −${UNARMED_RIPOSTE_COST} Успеха Парирования).</div>`]
  }, { rolls: [roll] });
}
