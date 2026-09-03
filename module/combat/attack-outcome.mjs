// module/combat/attack-outcome.mjs
//
// Фаза 6 конвейера (docs/architecture-plan.md, этап 2) — последствия попадания:
// сколько раз попали, куда, сколько Пробития и по какой формуле бросается урон.
//
// Здесь только правила книги и ни одной глобали Foundry: ни броска, ни чата, ни
// документов. Поэтому фаза проверяется тестом без заглушки
// (test/combat/attack-outcome.test.mjs), а _executeAttackRoll остаётся
// оркестратором — он бросает кубы и собирает карточку из этих чисел.

import { HIT_LOCATIONS }                          from "../constants/combat.mjs";
import { resolveCharFormula }                     from "../helpers/utils.mjs";
import { applyDamageDiceMods }                    from "./weapon-properties.mjs";

/** Подписи режимов стрельбы в карточке. */
const ROF_LABELS = {
  single:      "Одиночный",
  semi:        "Полуавтомат",
  full:        "Автоматический",
  suppression: "Подавление"
};

/** Куда смотрит Избирательная атака (стр. 35). */
const AIM_LOCATIONS = {
  torso: "Торс", leg: "Нога", arm: "Рука",
  head: "Голова", joint: "Сочленение / Шея", eye: "Глаз (Голова)"
};

/**
 * Число попаданий и подпись режима.
 *
 * Очередь (стр. 35): короткая (semi) — одно попадание за каждый НЕЧЁТНЫЙ Успех
 * (1, 3, 5…) до потолка RoF; длинная (full) — одно попадание за КАЖДЫЙ Успех,
 * тоже до потолка RoF (не половины). Рукопашная даёт одно попадание, если его
 * не умножили Стремительная, Молниеносная или Мульти-удар (стр. 169).
 *
 * Мульти-удар (X) считает ТОЙ ЖЕ формулой, что и Стремительная атака — доп.
 * попадание за каждый нечётный Успех после первого (3, 5, 7…) — но с потолком
 * в собственный рейтинг X. Раньше код прибавлял весь рейтинг сразу, независимо
 * от числа Успехов на попадание: оружие с Мульти-ударом(4) било вчетверо даже
 * на голом успехе (deg=1), хотя по книге на deg=1 доп. попаданий не бывает.
 *
 * @returns {{count: number, label: string}}
 */
export function hitCount({ hit, isMelee, rofMode, deg, wp, sys = {}, isSwift = false, isLightning = false, wsBonus = 0 }) {
  const label = isMelee ? "Рукопашная" : (ROF_LABELS[rofMode] ?? "Рукопашная");
  if (!hit) return { count: 0, label };

  if (isMelee) {
    let count = 1;
    // Быстрая (стр. 14): попадание за каждый НЕЧЁТНЫЙ Успех; Молниеносная —
    // за КАЖДЫЙ. Обе — до потолка WS.b атакующего (тексты обоих Талантов,
    // module/constants/combat.mjs). wsBonus 0 — данных нет, потолок не режем.
    if (isSwift)     count = Math.ceil(deg / 2);
    if (isLightning) count = deg;
    if ((isSwift || isLightning) && wsBonus > 0) count = Math.max(1, Math.min(count, wsBonus));
    if (wp.multiStrikeRating > 0)
      count = Math.max(count, Math.min(wp.multiStrikeRating, Math.ceil(deg / 2)));
    return { count, label };
  }

  let count = 0;
  switch (rofMode) {
    case "single":      count = 1; break;
    case "semi":        count = Math.min(Math.ceil(deg / 2), sys.rof_semi); break;
    case "full":        count = Math.min(deg, sys.rof_full); break;
    case "suppression": count = 0; break;
  }
  // Шторм (X) — попадания и потолок RoF умножаются на X; Спаренное/Квад — +1 при успехе.
  if (wp.extraHits === "storm")                          count *= (wp.stormRating || 2);
  else if (wp.extraHits === "twinLinked" && count > 0)   count += 1;
  return { count, label };
}

/**
 * Число попаданий Психострельбы по её подтипу (стр. 290).
 *
 * Снаряд, Взрыв и Дыхание бьют один раз; Обстрел — как короткая очередь, по
 * одному попаданию за нечётный Успех; Шторм — как длинная, по одному за каждый.
 * Подтип живёт в system.shootSubtype, а тип силы при этом обычно «Атака»:
 * «Атака · Психический Шторм · Стрельба» — это её теги из книги, и привязывать
 * счёт к powerType нельзя, иначе Шторм считался бы одним попаданием.
 *
 * @returns {{count: number, label: string}} label пуст, если подтип не бьёт очередью
 */
export function psychicHitCount(shootSubtype, deg) {
  const d = Math.max(1, Number(deg) || 1);
  switch (shootSubtype) {
    case "barrage": return { count: Math.max(1, Math.ceil(d / 2)), label: "Психический Обстрел" };
    case "storm":   return { count: Math.max(1, d),                label: "Психический Шторм" };
    default:        return { count: 1, label: "" };
  }
}

/**
 * Место попадания: бросок читается задом наперёд (23 → 32). `shift` — сдвиг от
 * Таланта или Черты «сдвинуть место попадания» (±A.b).
 *
 * Избирательная атака место не бросает, а называет: там игрок уже выбрал куда.
 *
 * @returns {{locRoll: number, label: string}}
 */
export function hitLocation({ rv, hit, shift = 0, aimTarget = null }) {
  const reversed = parseInt(String(rv).padStart(2, "0").split("").reverse().join(""));
  const locRoll  = Math.min(Math.max(reversed + (Number(shift) || 0), 1), 100);

  // Взрывное «под цель» (underfoot) часть тела не называет: взрыв накрывает
  // область, и место попадания каждому бросается обычным порядком.
  if (aimTarget?.value && aimTarget.value !== "underfoot")
    return { locRoll, label: AIM_LOCATIONS[aimTarget.value] ?? "Торс" };
  if (!hit)             return { locRoll, label: "Торс" };

  const loc = HIT_LOCATIONS.find(l => locRoll >= l.min && locRoll <= l.max);
  return { locRoll, label: loc?.label ?? "Торс" };
}

/**
 * Место конкретного попадания из очереди: у техники первое и второе идут в
 * названную часть, остальные в Корпус; у существа множественные (третье и
 * дальше) сходятся в Торс.
 */
export function locationForHit(index, { label, hitsCount, targetIsVehicle = false, vehiclePart = null }) {
  if (targetIsVehicle) return index < 2 ? vehiclePart : "Корпус";
  return (hitsCount > 1 && index >= 2) ? "Торс" : label;
}

/**
 * Бонус Силы в рукопашной: Могучее ×2, Сдержанное — ноль (стр. 168).
 * `sbHalf` — хват, у которого S.b в расчёте урона считается как ½ (Обратный):
 * половина берётся от того, что иначе ушло бы в урон, и округляется вверх.
 */
export function meleeStrengthBonus({ sb, wp, sbHalf = false }) {
  let bonus = sb;
  if (wp.mightySB)    bonus = sb * 2;
  if (wp.containedSB) bonus = 0;
  return sbHalf ? Math.ceil(bonus / 2) : bonus;
}

/**
 * Пробитие атаки. `base` — Пробитие оружия со всеми плоскими прибавками
 * (боеприпас, модификации, выключение, качество): их сложение правилом не
 * является. Здесь — то, что правилом является:
 *
 *   Бритвенно острое — ×2 от трёх Степеней Успеха;
 *   Мельта           — ×2 в упор;
 *   Максимальный     — +2;
 *   полоса дальности и Психосиловое — после удвоений.
 */
export function attackPenetration({ base, wp, hit, deg, shortRange = false, maximal = false, band = null, forceBonus = 0 }) {
  let pen = base;
  if (wp.razorSharp && hit && deg >= 3) pen *= 2;
  if (wp.meltaShort && shortRange)      pen *= 2;
  if (maximal)                          pen += 2;
  if (wp.prismaAtMax)                   pen += 4;
  if (band?.pen)                        pen += Number(band.pen) || 0;
  return pen + forceBonus;
}

/**
 * Формула броска урона.
 *
 * Тип урона, попавший в поле формулы («1d10+4 R»), отбрасывается: иначе бросок
 * падает на букве. Дальше подставляются бонусы характеристик (S.b, W.b) и
 * применяются модификаторы кубов — Рвущее (лишний куб, оставить лучший) и
 * Проверенное (минимум на кубе).
 */
export function damageFormulaFor({ damage, flatBonus = 0, chars = {}, corruptionBonus = 0, wp, isMelee = false }) {
  const rawDmg  = String(damage || "").replace(/\s+[REIXРЕИ](?:\([^)]*\))?\s*$/i, "").trim();
  const baseDmg = rawDmg || (isMelee ? "" : "1d10");

  const formula = flatBonus !== 0
    ? (baseDmg ? `${baseDmg} + ${flatBonus}` : `${flatBonus}`)
    : (baseDmg || "0");

  return applyDamageDiceMods(resolveCharFormula(formula, chars, corruptionBonus), wp);
}

/**
 * Добавочные кубы урона: Меткое по Степеням Успеха на одиночном выстреле,
 * Рассеивание в упор, Максимальный режим, полоса дальности и боеприпас
 * (стр. 203: Фарос и Осирис — «+1 кубик урона»).
 *
 * Эти кубы не вызывают Экстремальный урон — их бросает отдельный Roll.
 */
export function bonusDamageDice({ wp, rofMode, hit, deg, shortRange = false, maximal = false, band = null, ammoDice = 0 }) {
  let dice = 0;
  if (wp.accurate && rofMode === "single" && hit) {
    if (deg >= 5)      dice += 2;
    else if (deg >= 3) dice += 1;
  }
  if (wp.scatter && shortRange) dice += 1;
  if (maximal)                  dice += 1;
  if (wp.prismaAtMax)           dice += 1;
  if (band?.dice)               dice += Number(band.dice) || 0;
  return dice + (Number(ammoDice) || 0);
}
