// module/rules/bronenosets-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты Броненосца — чистая логика (Foundry-сторона —
//  combat/bronenosets-talents.mjs).
//
//  Chaos Greatbow / Великий Лук Хаоса: преображённый лук (метка CHAOS_GREATBOW_FLAG
//    на оружии ставит кнопка Таланта) — S.b к урону без верхнего предела,
//    +½Cor.b (окр.▲) к Dmg и Pen, без Primitive. Обычные луки в системе S.b к
//    урону не получают вовсе (он записан только текстом «Урон 1d10+S.b»),
//    поэтому полный S.b здесь — и есть «нет верхнего предела».
//  Chosen Flame / Избранное Пламя: пока Талант включён (Очко Бесчестия, до
//    конца боя/сцены — rules/item-activation.mjs) — всё рукопашное оружие
//    +½Cor.b к Dmg и Pen, без Primitive.
//  Sorcerer's Plate / Латы Чародея: +½ AP торса (окр.▲) к Успехам успешного
//    встречного теста W против психосилы (rules/kind-outcome.mjs).
//  Sin Eater / Пожиратель Греха: рост Unnatural Cor — правило сравнения.
//  Hedgehog / Дикобраз: Калечащее (½Cor.b) у встречной атаки шипов.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed, itemsNamed } from "./req-atom.mjs";
import { isItemActivated } from "./item-activation.mjs";
import { halfCorB, charBonus } from "./astartes-elite-common.mjs";
import { parseGrips } from "../constants/combat.mjs";

const NS = "warhammer-dbc";
export const CHAOS_GREATBOW_FLAG = "chaosGreatbow";
export const DIVINE_SHIELD_FLAG = "divineShield";
export const SIN_EATER_FLAG = "sinEater";

const BOW_RE = /bow|лук/i;

/** Лук ли это (стрелковое с «Bow»/«Лук» в имени). */
export function isBowWeapon(item) {
  if (item?.type !== "weapon") return false;
  const cls = String(item.system?.weaponClass ?? "");
  if (cls === "melee") return false;
  return BOW_RE.test(String(item.name ?? ""));
}

/** Несёт ли оружие метку Великого Лука Хаоса. */
export function isChaosGreatbow(item) {
  return !!(item?.flags?.[NS]?.[CHAOS_GREATBOW_FLAG] ?? item?.getFlag?.(NS, CHAOS_GREATBOW_FLAG));
}

/** Включено ли Избранное Пламя у актора. */
export function chosenFlameOn(actor) {
  return itemsNamed(actor, "Chosen Flame", ["talent"]).some(i => isItemActivated(i));
}

/**
 * Прибавки Броненосца к атаке этим оружием.
 * @returns {{dmg:number, pen:number, losesPrimitive:boolean, note:string}}
 */
export function bronenosetsWeaponBonus(actor, item, { isMelee = false } = {}) {
  const none = { dmg: 0, pen: 0, losesPrimitive: false, note: "" };
  if (!actor || !item) return none;
  const half = halfCorB(actor);
  if (!isMelee && isChaosGreatbow(item) && hasItemNamed(actor, "Chaos Greatbow", ["talent"])) {
    const sb = charBonus(actor, "s");
    return { dmg: sb + half, pen: half, losesPrimitive: true,
      note: `🏹 Великий Лук Хаоса: +${sb} S.b и +${half} ½Cor.b к урону, +${half} к Pen, без Primitive (уже в формуле).` };
  }
  if (isMelee && chosenFlameOn(actor)) {
    return { dmg: half, pen: half, losesPrimitive: true,
      note: `🔥 Избранное Пламя: +${half} к урону и Pen, без Primitive (уже в формуле); Трейты Daemonic и Stuff of Nightmares цели игнорируются — ГМ не применяет их защиту.` };
  }
  return none;
}

/** AP торса без T.b (как у Варп-Оружия в combat/damage.mjs). */
export function torsoAP(actor) {
  const abs = actor?.system?.absorption ?? {};
  return Math.max(0, (Number(abs.body) || 0) - (Number(abs.toughnessBonus) || 0));
}

/**
 * Латы Чародея: доп. Успехи успешного встречного теста W против психосилы.
 * Демонические дары как отдельный вид теста система не размечает — их
 * добавляет стол.
 */
export function sorcerersPlateDeg(actor, { success = false, ctx = {}, charKey = "" } = {}) {
  if (!success || ctx?.psychicThreat !== true) return 0;
  if (String(charKey || ctx?.char || "").toLowerCase() !== "wp") return 0;
  if (!hasItemNamed(actor, "Sorcerer's Plate", ["talent"])) return 0;
  return Math.ceil(torsoAP(actor) / 2);
}

/** Пожиратель Греха: новый рейтинг Unnatural Cor после победы над чемпионом. */
export function sinEaterNext(rating, championCor) {
  const r = Math.max(0, Number(rating) || 0);
  return (Number(championCor) || 0) > r * 10 ? r + 1 : r;
}

/** Дикобраз: рейтинг Калечащего у встречной атаки шипами. */
export function hedgehogCrippling(actor) {
  return hasItemNamed(actor, "Hedgehog", ["talent"]) ? halfCorB(actor) : 0;
}

/** Божественный Щит: прибавка AP щита. */
export function divineShieldAP(actor) {
  return halfCorB(actor);
}

// ── Potence / Могущество ────────────────────────────────────────────────
// «Может использовать двуручное рукопашное оружие … одной рукой, но оно
// понижает свой Баланс до −2». Хват «1р» выдаётся оружию, чей основной хват
// «2р» (окно атаки, HUD); штрафа вторичного хвата к WS нет (selection.mjs),
// Баланс при Парировании — −2 (combat/defense.mjs).

/** Даёт ли Могущество этому оружию хват одной рукой. */
export function potenceGripActive(actor, item) {
  const sys = item?.system;
  if (!sys || sys.weaponClass !== "melee") return false;
  if (parseGrips(sys.grips)[0] !== "2р") return false;
  return hasItemNamed(actor, "Potence", ["talent"]);
}

/** Баланс оружия при хвате «1р» по Могуществу (null — Могущество ни при чём). */
export function potenceBalance(actor, item, gripKey) {
  return gripKey === "1р" && potenceGripActive(actor, item) ? -2 : null;
}
