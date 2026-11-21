// module/rules/obliterator-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Черта и Таланты Облитератора — чистая логика (Foundry-сторона —
//  combat/obliterator-talents.mjs).
//
//  Living Arsenal / Живой Арсенал — ассимилированное оружие помечено флагом
//    ARSENAL_FLAG на самом предмете. У носителя Черты такое оружие:
//    никогда не Заклинивает (combat/attack.mjs — jamAt, Распыление),
//    не тратит стандартные боеприпасы (rules/ammo-free.mjs; заряженный
//    спецбоеприпас тратится как обычно), винтовка и тяжёлое — в одной руке
//    (rules/hands.mjs, окно атаки).
//  Mutilator / Расчленитель — переключатель «режим ближнего боя»: включён —
//    Auto-Stabilized не действует, успешные BS и проваленные WS
//    перебрасываются (записи Конструктора «Когда включено»).
//  To the Teeth / До Зубов — наплечное оружие: метка SHOULDER_FLAG, не больше 2.
//  Shredder / Измельчитель — попадания по Орде: полные 5 Магнитуды, ≤ 6.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { parseBoon, boonAlive, boonNow } from "./astartes-elite-common.mjs";
import { isItemActivated } from "./item-activation.mjs";

const NS = "warhammer-dbc";
export const ARSENAL_FLAG = "livingArsenal";
export const SHOULDER_FLAG = "toTheTeeth";
export const SHOULDER_MAX = 2;

const flagOf = (item, key) => item?.flags?.[NS]?.[key] ?? item?.getFlag?.(NS, key);

/** Можно ли ассимилировать предмет (книга: не гранаты/ракеты/их пусковые, не Демоническое/Руническое, не Наследие, не психосиловое). */
export function assimilable(item) {
  if (item?.type !== "weapon") return false;
  const s = item.system ?? {};
  if (s.weaponClass === "thrown" || s.weaponClass === "launcher") return false;
  if (["grenade", "explosive", "rocket", "launcher", "missile"].includes(s.weaponType)) return false;
  if (s.daemonWeapon?.bound || s.daemonWeapon?.runic || s.legacy?.active) return false;
  const name = String(item.name ?? "");
  if (/\bforce\b|психосил/i.test(name)) return false;
  return true;
}

/** Оружие Живого Арсенала (метка на предмете и Черта у владельца). */
export function livingArsenalWeapon(actor, item) {
  if (!item || !flagOf(item, ARSENAL_FLAG)) return false;
  return hasItemNamed(actor, "Living Arsenal", ["trait"]);
}

/** Бесплатный стандартный боеприпас Живого Арсенала: без заряженного спецбоеприпаса. */
export function livingArsenalAmmoFree(actor, item) {
  return livingArsenalWeapon(actor, item) && !item.system?.loadedAmmoId;
}

/** Хват «1р» Живого Арсенала: винтовки и тяжёлое. */
export function livingArsenalOneHand(actor, item) {
  return ["basic", "heavy"].includes(item?.system?.weaponClass) && livingArsenalWeapon(actor, item);
}

/**
 * Наплечное ли оружие (До Зубов) — метка «бой|сцена» (rules/astartes-elite-common.mjs),
 * живёт до конца боя/сцены. `now` — для тестов; по умолчанию текущие бой и сцена владельца.
 */
export function isShoulderWeapon(item, now = null) {
  const str = flagOf(item, SHOULDER_FLAG);
  if (!str) return false;
  return boonAlive(parseBoon(String(str)), now ?? boonNow(item?.parent ?? item?.actor ?? null));
}

/** Сколько ещё наплечного можно отрастить. */
export function shoulderSlotsLeft(actor, now = null) {
  const used = [...(actor?.items ?? [])].filter(i => i?.type === "weapon" && isShoulderWeapon(i, now)).length;
  return Math.max(0, SHOULDER_MAX - used);
}

/** Измельчитель: попаданий по Орде — по 1 за полные 5 Магнитуды, не больше 6. */
export function shredderHordeHits(magnitude) {
  return Math.min(6, Math.floor(Math.max(0, Number(magnitude) || 0) / 5));
}

/**
 * Расчленитель включён (Талант активирован): успешные BS перебрасываются
 * (Помеха — худший из двух: Успех остаётся, только если Успешны оба броска,
 * та же вероятность, что у «перебросить Успех»), проваленные WS — лучший из двух.
 */
export function mutilatorRules(actor) {
  const item = [...(actor?.items ?? [])].find(i => i?.type === "talent" && String(i.name ?? "").startsWith("Mutilator"));
  if (!item || !isItemActivated(item)) return [];
  const lb = "🪚 Расчленитель: переброс успешного BS";
  const lw = "🪚 Расчленитель: переброс проваленного WS";
  return [
    { id: "astartes.mutilator.bs", label: lb, effects: [{ kind: "rollMode", target: ["weapon:ranged", "char:bs"], mode: "keepWorst", rolls: 2, label: lb }] },
    { id: "astartes.mutilator.ws", label: lw, effects: [{ kind: "rollMode", target: ["weapon:melee", "char:ws"], mode: "keepBest", rolls: 2, label: lw }] }
  ];
}
