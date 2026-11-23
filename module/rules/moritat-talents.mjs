// module/rules/moritat-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты Моритата — чистая логика (Foundry-сторона — combat/moritat-talents.mjs).
//
//  Belt Feed / Ленточное Питание — пул «beltFeed» (ранец до 200 припасов) и
//    метка BELT_FED_FLAG на оружии, подключённом к ленте: кнопка набивает его
//    магазин из ранца без Перезарядки (лента подаёт патроны сама).
//  Lightning Fingers / Молниеносные Пальцы — пистолеты (и винтовки Огневой
//    Мощи) выхватываются Quick Draw и из неудобной разгрузки
//    (constants/rig.mjs::inAwkwardRigLocation).
//  Fly-By / Пролётом — метка FLY_BY_FLAG «<бой>:<раунд>|<id оружия,…>»:
//    после оплаты полного действия каждое экипированное стрелковое оружие
//    может сделать один бесплатный Одиночный Выстрел этого Раунда
//    (combat/free-shot.mjs, вид "flyBy").
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const BELT_FEED_POOL = "beltFeed";
export const BELT_FED_FLAG = "beltFed";
export const FLY_BY_FLAG = "flyByPending";

const RANGED = new Set(["pistol", "basic", "heavy"]);

/** Стрелковое оружие с магазином (лента подаёт только патроны, не заряды батарей и не метательное). */
export function beltFeedEligible(item) {
  const s = item?.system ?? {};
  return item?.type === "weapon" && RANGED.has(s.weaponClass) && (Number(s.magazineMax) || 0) > 0;
}

/**
 * Сколько патронов лента подаст в магазин: недостающее до полного, не больше,
 * чем в ранце.
 */
export function beltFeedTransfer(item, poolValue) {
  const s = item?.system ?? {};
  const need = Math.max(0, (Number(s.magazineMax) || 0) - (Number(s.magazineCur) || 0));
  return Math.max(0, Math.min(need, Number(poolValue) || 0));
}

/** Винтовка, которую Огневая Мощь велит считать пистолетом. */
export function outgunRifle(actor, item) {
  return item?.system?.weaponClass === "basic" && hasItemNamed(actor, "Outgun", ["talent"]);
}

/** Молниеносные Пальцы: неудобная разгрузка не мешает Quick Draw этого оружия. */
export function lightningFingersIgnoresRig(actor, item) {
  if (item?.type !== "weapon" || !hasItemNamed(actor, "Lightning Fingers", ["talent"])) return false;
  return item.system?.weaponClass === "pistol" || outgunRifle(actor, item);
}

/** Ключ Раунда для Пролётом: «<бой>:<раунд>», вне боя — "". */
export function flyByRoundKey(combat) {
  return combat?.started && combat?.id ? `${combat.id}:${combat.round}` : "";
}

/** Разбор метки Пролётом. */
export function parseFlyBy(str) {
  const s = String(str ?? "");
  if (!s) return null;
  const [round, ids = ""] = s.split("|");
  return { round, used: ids ? ids.split(",") : [] };
}

/** Почему выстрел Пролётом из этого оружия сейчас нельзя ("" — можно). */
export function flyByBlockReason(flag, itemId, roundKey) {
  const f = parseFlyBy(flag);
  if (!f || f.round !== roundKey) return "Пролётом: манёвр не объявлен в этом Раунде";
  if (f.used.includes(itemId)) return "Пролётом: из этого оружия уже выстрелили";
  return "";
}

/** Метка после выстрела из оружия. */
export function flyByAfterShot(flag, itemId) {
  const f = parseFlyBy(flag) ?? { round: "", used: [] };
  return `${f.round}|${[...new Set([...f.used, itemId])].join(",")}`;
}
