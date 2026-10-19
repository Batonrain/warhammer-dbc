// module/combat/eye-of-the-gods.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Eye of the Gods / Взор Богов (Талант Стойкости, глава 3): «Персонаж не может
//  потерять суммарно больше 10 Ран в Раунд (от начала своего Хода до начала
//  следующего) от атак рядовых врагов, а также не может потерять больше 10 Ран
//  в Раунд от атак каждого значимого персонажа. «Лишний» урон игнорируется, как
//  если бы его отразил чародейский щит-дефлектор и, соответственно, методы против
//  таких щитов игнорируют этот Талант.»
//
//  Счёт — по образцу «Бича Чемпионов» (combat/strange-invulnerability.mjs): метка
//  на носителе { combatId, buckets: { general, "notable:<uuid>" } }. Корзин две
//  породы: общая на всех рядовых и своя на каждого значимого (ключ — uuid
//  атакующего). «Значимый» — ГМ отмечает сам: флаг актора-атакующего
//  notableCharacter (пункт «Значимый персонаж» в «Настройках листа»).
//
//  Окно сбрасывается в начале Хода носителя (hooks.mjs, updateCombat →
//  resetEyeOfTheGodsWindow). Вне боя окна нет — Талант тогда не действует
//  (лимит «в Раунд» считать не от чего). Считается то, что реально прошло в Раны
//  после всех слоёв поглощения, в конце конвейера урона (после Настоящей
//  Выдержки), поэтому обходит только игнор щитов/Освящённое, не прочие методы.
// ════════════════════════════════════════════════════════════════════════════

import {
  hasResilienceTalent, isNotableCharacter, EYE_OF_THE_GODS_FLAG, EYE_OF_THE_GODS_LIMIT,
  eyeOfTheGodsBucket, eyeOfTheGodsUsed, eyeOfTheGodsCap, eyeOfTheGodsRecord, eyeOfTheGodsBypassed
} from "../rules/resilience-talents.mjs";
import { combatOfActor } from "./actor-combat.mjs";

const NS = "warhammer-dbc";

async function attackerActorOf(attackerUuid) {
  if (!attackerUuid) return null;
  const doc = await fromUuid(attackerUuid).catch(() => null);
  return doc?.actor ?? doc ?? null;
}

/**
 * Применить лимит Взора Богов к непоглощённому урону попадания.
 * @param {Actor} actor носитель Таланта
 * @param {string} attackerUuid кто бьёт ("" — источника нет, считается рядовым)
 * @param {number} netDamage урон, готовый уйти в Раны
 * @param {{ignoreShield?:boolean, sanctified?:boolean}} bypass признаки метода против щитов
 * @returns {Promise<{net:number, note:string}>}
 */
export async function applyEyeOfTheGods(actor, attackerUuid, netDamage, bypass = {}) {
  const net = Number(netDamage) || 0;
  if (net <= 0 || !hasResilienceTalent(actor, "eyeOfTheGods")) return { net, note: "" };
  if (eyeOfTheGodsBypassed(bypass)) {
    return { net, note: "Взор Богов: метод против щитов-дефлекторов — Талант игнорируется." };
  }
  const combatId = combatOfActor(actor)?.id ?? "";
  if (!combatId) return { net, note: "" };

  const attacker = await attackerActorOf(attackerUuid);
  const notable = isNotableCharacter(attacker);
  const bucket = eyeOfTheGodsBucket(notable, attackerUuid);
  const flag = actor.getFlag?.(NS, EYE_OF_THE_GODS_FLAG);
  const used = eyeOfTheGodsUsed(flag, combatId, bucket);
  const out = eyeOfTheGodsCap(net, used, EYE_OF_THE_GODS_LIMIT);
  if (out.net > 0) await actor.setFlag(NS, EYE_OF_THE_GODS_FLAG, eyeOfTheGodsRecord(flag, combatId, bucket, out.net));
  if (out.ignored <= 0) return { net: out.net, note: "" };
  const who = bucket === "general" ? "рядовых врагов" : `значимого персонажа «${attacker?.name ?? "?"}»`;
  return {
    net: out.net,
    note: `👁 Взор Богов: от ${who} уже потеряно ${used} из ${EYE_OF_THE_GODS_LIMIT} Ран до начала следующего Хода — «лишние» ${out.ignored} Ран отражены, как дефлектором.`
  };
}

/** Начало Хода носителя: окно счёта потерянных Ран начинается заново. */
export async function resetEyeOfTheGodsWindow(actor) {
  if (actor?.getFlag?.(NS, EYE_OF_THE_GODS_FLAG) == null) return;
  await actor.unsetFlag(NS, EYE_OF_THE_GODS_FLAG);
}
