// module/rules/legacy-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОРУЖИЕ НАСЛЕДИЯ — числа (корбук, стр. 426-428).
//
//  Здесь порог Возвышения, счёт положенных Мутаций и то, что Наследие делает с
//  профилем оружия. Ни Foundry, ни бросков: окно (apps/legacy-weapon.mjs) лишь
//  показывает посчитанное и катает кубик.
//
//  Ключевая тонкость Возвышения: тест идёт «на Inf+0 с модификатором Редкости
//  оружия, ИГНОРИРУЯ модификатор Качества». Редкость и Качество в системе
//  лежат рядом (`availability` и `quality`) и оба участвуют в реквизиции, так
//  что соблазн взять готовую сложность велик — но качество сюда не входит, и
//  порог собирается заново.
// ════════════════════════════════════════════════════════════════════════════

import { rarityDiff } from "../constants/craft.mjs";
import { MUTATION_THRESHOLDS, ASCENSION_HEAVY_MOD, ASCENSION_LEGION_BONUS,
         ASCENSION_DEED_MAX, ASCENSION_HARD_PROPS } from "../constants/legacy-weapon.mjs";
import { itemHasName } from "./predicates.mjs";

const num = v => Number(v) || 0;

/** Свойства оружия ключами — они лежат записями {key, rating}. */
function propKeys(weapon) {
  return new Set((weapon?.system?.weaponProps ?? []).map(p => p?.key).filter(Boolean));
}

/** Тяжёлое ли оружие: класс «heavy» — то же, что «Тяжелое» книги. */
export function isHeavyWeapon(weapon) {
  return weapon?.system?.weaponClass === "heavy";
}

/** Свойства из списка «трудных», которые есть у этого оружия. */
export function hardProps(weapon) {
  const keys = propKeys(weapon);
  return ASCENSION_HARD_PROPS.filter(k => keys.has(k));
}

/**
 * Может ли оружие вообще стать Наследием. Демоническое — не может (стр. 426);
 * уже возвышенное возвышать заново незачем.
 * @returns {{ok:boolean, reason:string}}
 */
export function canAscend(weapon) {
  if (weapon?.type !== "weapon") return { ok: false, reason: "Это не оружие." };
  if (weapon.system?.daemonWeapon?.bound)
    return { ok: false, reason: "Демоническое Оружие не может быть Оружием Наследия." };
  if (weapon.system?.legacy?.active)
    return { ok: false, reason: "Это оружие уже является Оружием Наследия." };
  return { ok: true, reason: "" };
}

/**
 * Слагаемые порога Возвышения — списком, чтобы окно показало игроку, из чего
 * тот собран, а не одно готовое число.
 *
 * `legendary` — Легендарное оружие: у него своя легенда, и книга даёт ему
 * максимальный бонус +30 всегда, вместо разбора подвигов.
 * @returns {{rows:{label:string,val:number}[], threshold:number}}
 */
export function ascensionRows(actor, weapon, { deedBonus = 0, legendary = false } = {}) {
  const inf = num(actor?.system?.characteristics?.inf?.total);
  const rows = [{ label: "Бесчестие (Inf)", val: inf, primary: true }];

  // Редкость считается ТОЛЬКО по availability: модификатор Качества книга
  // велит игнорировать, и брать общую сложность реквизиции здесь нельзя.
  const rarity = rarityDiff(num(weapon?.system?.availability));
  if (rarity) rows.push({ label: "Редкость оружия", val: rarity });

  if (isHeavyWeapon(weapon)) rows.push({ label: "Тяжёлое оружие", val: ASCENSION_HEAVY_MOD });
  const hard = hardProps(weapon);
  if (hard.length) rows.push({ label: `Свойства: ${hard.join(", ")}`, val: ASCENSION_HEAVY_MOD });

  // Космодесантник и оружие со свойством Legion — родная пара (стр. 426).
  if (propKeys(weapon).has("legion") && isAstartes(actor))
    rows.push({ label: "Астартес с оружием Legion", val: ASCENSION_LEGION_BONUS });

  const deed = legendary
    ? ASCENSION_DEED_MAX
    : Math.max(0, Math.min(ASCENSION_DEED_MAX, num(deedBonus)));
  if (deed) rows.push({ label: legendary ? "Легендарное оружие" : "Подвиги, достойные легенд", val: deed });

  return { rows, threshold: rows.reduce((s, r) => s + r.val, 0) };
}

/** Космодесантник ли: по расе актора или по Черте «Astartes». */
export function isAstartes(actor) {
  if (String(actor?.system?.race || "") === "astartes") return true;
  return [...(actor?.items ?? [])].some(
    i => i?.type === "trait" && itemHasName(i, "Astartes"));
}

// ── Что Наследие делает с профилем ────────────────────────────────────────

/** Бонус Наследия к Dmg и Pen: ½Inf.b, округление вверх (стр. 426). */
export function legacyBonus(actor) {
  const infBonus = num(actor?.system?.characteristics?.inf?.bonus);
  return Math.ceil(infBonus / 2);
}

/** Качество на ступень выше — «+1 Качество» общих свойств. */
export const QUALITY_LADDER = ["poor", "common", "good", "best"];

export function qualityAfterLegacy(quality) {
  const i = QUALITY_LADDER.indexOf(String(quality || "common"));
  if (i < 0) return "good";
  return QUALITY_LADDER[Math.min(i + 1, QUALITY_LADDER.length - 1)];
}

/**
 * Свойства после Возвышения: прибавляется Reinforced, снимается Primitive.
 * Возвращает НОВЫЙ массив — исходный нужен для отката, если связь порвётся.
 */
export function propsAfterLegacy(props = []) {
  const out = [...props].filter(p => p?.key !== "primitive");
  if (!out.some(p => p?.key === "reinforced")) out.push({ key: "reinforced" });
  return out;
}

// ── Мутации по Порче (стр. 426) ───────────────────────────────────────────

/**
 * Сколько Мутаций положено оружию при этой Порче владельца: по одной за
 * каждый пройденный порог 20/40/60/80.
 */
export function mutationSlots(corruption) {
  const cor = num(corruption);
  return MUTATION_THRESHOLDS.filter(t => cor >= t).length;
}

/** Порча, при которой откроется следующая Мутация; null — все четыре взяты. */
export function nextMutationAt(corruption) {
  const cor = num(corruption);
  return MUTATION_THRESHOLDS.find(t => cor < t) ?? null;
}

/**
 * Сколько Мутаций можно взять прямо сейчас: положено минус уже записанные.
 * Унаследованное оружие сохраняет Мутации, даже если Порчи нового владельца
 * для них не хватает (стр. 428), поэтому отрицательной разницы здесь не
 * бывает — лишние не отбираются.
 */
export function mutationsAvailable(actor, weapon) {
  const taken = (weapon?.system?.legacy?.mutations ?? []).length;
  const slots = mutationSlots(actor?.system?.corruption?.value);
  return Math.max(0, slots - taken);
}

/** Броски, которые в этой таблице уже выпадали, — их перебрасывают. */
export function takenMutationNames(weapon) {
  return new Set((weapon?.system?.legacy?.mutations ?? []).map(m => m?.name).filter(Boolean));
}
