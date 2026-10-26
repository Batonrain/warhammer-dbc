// module/rules/requisition.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Реквизиция — тест «достать снаряжение» (Sahara peer-ancient-warrior-lord-of-
//  war-excessive-wealth, часть «б»; решение владельца 24.10.2026).
//
//  Книга, DoomBC — Основная книга, глава «Бесчестие и Порча», «Реквизиция»:
//  «Чтобы добыть что-то с помощью Реквизиции, персонаж должен пройти тест на
//  Inf+0 с модификаторами Редкости, Качества и Количества того, что он хочет
//  добыть. Вполне может быть, что в пределах досягаемости контактов персонажа
//  искомого предмета … может и не быть …» — то есть наличие предмета на
//  планете решает ГМ, а не таблица (отсюда поле «Модификатор ГМа» в окне).
//
//  Таблицы — стр. 165, «Редкость и Качество»:
//    Редкость   −5…+5 → +70, +50, +30, +20, +10, 0, −10, −20, −30, −50, −70;
//    Количество 1 → +10; 2-4 → 0; 5-10 → −10; 11-100 → −20; 101-1000 → −40;
//               1001+ → −60;
//    Качество   Poor +10, Comm 0, Good −10, Best −20 (уже лежит в реестре
//               constants/quality.mjs::ITEM_QUALITY.acqMod — второй копии нет);
//    «При покупке или реквизиции расходного снаряжения, вроде гранат и
//    медикаментов, оно считается на 2 уровня количества выше (т.е. 5-10 гранат
//    реквизируется с +10 вместо −10)». Пример книги однозначен: ступень
//    сдвигается к ЛЁГКОЙ стороне на две, упор — первая ступень (+10).
//
//  Таблица Редкости → сложность одна на реквизицию и крафт: она лежит в
//  constants/craft.mjs (RARITY_DIFFS, rarityDiff) и берётся оттуда. Раньше у
//  крафта стояла формула −10×R, совпадавшая с книгой лишь на −3…+3 (на краях
//  книга даёт +70/+50 и −50/−70); исправлено, расхождение стережёт
//  test/rules/requisition-vs-data.test.mjs.
//
//  Чистая логика без Foundry. Файл НЕ источник правил (sources.mjs его не
//  импортирует): правила-галочки Талантов лежат в rules/requisition-talents.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { ITEM_QUALITY, ITEM_QUALITY_LIST } from "../constants/quality.mjs";
import { RARITY_DIFFS } from "../constants/craft.mjs";
import { EQUIP_SHOP_PACKS } from "./equip-shop.mjs";

/**
 * Паки, из которых окно «Достать снаряжение» предлагает выбор: категории
 * магазина Очков Снаряжения плюс химия, модификации и Записи ритуалов
 * («записи можно добывать реквизицией и торговлей, как любое другое
 * снаряжение» — core.json, «Анатомия ритуала»).
 */
export const REQUISITION_PACKS = Object.freeze([
  ...EQUIP_SHOP_PACKS, "chemistry", "weapon-mods", "armor-mods", "armour-systems", "rituals"
]);

/** Редкость (знаковый модификатор system.availability) → модификатор Порога. */
export const RARITY_MODS = RARITY_DIFFS;

export const RARITY_MIN = -5;
export const RARITY_MAX = 5;

/** Ступени Количества, от лёгкой к тяжёлой. `max: Infinity` — «и больше». */
export const QUANTITY_TIERS = Object.freeze([
  { min: 1,    max: 1,        mod:  10, label: "1 предмет" },
  { min: 2,    max: 4,        mod:   0, label: "2-4 предмета" },
  { min: 5,    max: 10,       mod: -10, label: "5-10 предметов" },
  { min: 11,   max: 100,      mod: -20, label: "11-100 предметов" },
  { min: 101,  max: 1000,     mod: -40, label: "101-1000 предметов" },
  { min: 1001, max: Infinity, mod: -60, label: "1001+ предметов" }
]);

/** На сколько ступеней расходное снаряжение считается легче (стр. 165). */
export const CONSUMABLE_TIER_SHIFT = 2;

/** Оптовый порог Повелителя Войны: «в оптовых объемах (1001+ штук)». */
export const BULK_QUANTITY = 1001;

/**
 * Таланты, которых касается реквизиция. `is` опознаёт Талант по любой половине
 * двуязычного имени. Имя — ЛИТЕРАЛОМ в вызове itemHasName, не переменной:
 * tools/capability-reachability.mjs ищет носителя Возможности именно по
 * литералам, и через таблицу имён Талант выглядел бы «нечем включить».
 */
export const REQUISITION_TALENTS = Object.freeze({
  lordOfWar:       { id: "requisition.lordOfWar",       label: "Повелитель Войны",       is: i => itemHasName(i, "Lord of War") },
  ancientWarrior:  { id: "requisition.ancientWarrior",  label: "Древний Воин",           is: i => itemHasName(i, "Ancient Warrior") },
  ritePuzzler:     { id: "requisition.ritePuzzler",     label: "Разгадыватель Ритуалов", is: i => itemHasName(i, "Rite Puzzler") },
  excessiveWealth: { id: "requisition.excessiveWealth", label: "Чрезмерное Богатство",   is: i => itemHasName(i, "Excessive Wealth") },
  contactNetwork:  { id: "requisition.contactNetwork",  label: "Сеть Контактов",         is: i => itemHasName(i, "Contact Network") },
  factotumCase:    { id: "requisition.factotumCase",    label: "Дело Фактотума",         is: i => itemHasName(i, "The Factotum Case") }
});

/** Есть ли у актора Талант из REQUISITION_TALENTS (по имени, как все Таланты-источники правил). */
export function hasRequisitionTalent(actor, key) {
  const def = REQUISITION_TALENTS[key];
  if (!def) return false;
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && def.is(i));
}

const sgn = v => (v > 0 ? `+${v}` : (v < 0 ? `−${Math.abs(v)}` : "0"));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Модификатор Порога за Редкость; за пределами −5…+5 прижимается к краю таблицы. */
export function rarityMod(rarity) {
  const r = Math.round(Number(rarity));
  if (!Number.isFinite(r)) return 0;
  return RARITY_MODS[String(clamp(r, RARITY_MIN, RARITY_MAX))];
}

/** Модификатор Порога за Качество (ITEM_QUALITY.acqMod); неизвестное — Обычное. */
export function qualityMod(quality) {
  return ITEM_QUALITY[quality]?.acqMod ?? 0;
}

/** Целое число предметов не меньше 1 (мусор и нуль — один предмет). */
export function normQuantity(quantity) {
  const q = Math.floor(Number(quantity));
  return Number.isFinite(q) && q >= 1 ? q : 1;
}

/**
 * Ступень Количества. Расходное снаряжение считается на `CONSUMABLE_TIER_SHIFT`
 * ступени легче (упор — первая ступень).
 * @returns {{index:number, mod:number, label:string, shifted:boolean}}
 */
export function quantityTier(quantity, { consumable = false } = {}) {
  const q = normQuantity(quantity);
  let index = QUANTITY_TIERS.findIndex(t => q >= t.min && q <= t.max);
  if (index < 0) index = QUANTITY_TIERS.length - 1;
  let shifted = false;
  if (consumable) {
    const eased = Math.max(0, index - CONSUMABLE_TIER_SHIFT);
    shifted = eased !== index;
    index = eased;
  }
  const t = QUANTITY_TIERS[index];
  return { index, mod: t.mod, label: t.label, shifted };
}

// ── Что за предмет ──────────────────────────────────────────────────────────

/**
 * Редкость предмета для реквизиции. Ритуал: Редкость Записи — system.record
 * (wdbc-zaesd), record 0 — Записи в обороте нет. Остальные — availability;
 * пустое поле — «нет Редкости» (null), а не R0 (решение r0, 23.10.2026).
 * Тот же смысл, что у compendium-filters.mjs::indexAvailability — здесь для
 * живого документа, а не узла индекса компендиума.
 */
export function itemRarity(item) {
  if (!item) return null;
  if (item.type === "ritual") {
    const record = Number(item.system?.record) || 0;
    return record > 0 ? record : null;
  }
  const av = item.system?.availability;
  if (av == null || av === "") return null;
  return Number(av) || 0;
}

const weaponPropKeys = item => (item?.system?.weaponProps ?? [])
  .map(p => (typeof p === "string" ? p : p?.key));

/**
 * Признаки предмета, на которые смотрят Таланты:
 *  • exotic — Экзотическое оружие (weaponType "exotic");
 *  • cybernetic — «Кибернетика»: предмет типа cybernetic либо Имплант категории
 *    cybernetic (подпись «Кибернетика» в листе). Бионика и Псибернетика — другие
 *    категории и сюда не входят;
 *  • legion — снаряжение с свойством Legion (system.weaponProps). Своего
 *    признака «Легион» у брони и снаряжения в данных нет — только у оружия;
 *  • ritual — Ритуал с Записью (record > 0).
 */
export function itemClass(item) {
  if (!item) return { exotic: false, cybernetic: false, legion: false, ritual: false };
  return {
    exotic: item.system?.weaponType === "exotic",
    cybernetic: item.type === "cybernetic"
      || (item.type === "implant" && item.system?.category === "cybernetic"),
    legion: weaponPropKeys(item).includes("legion"),
    ritual: item.type === "ritual" && (Number(item.system?.record) || 0) > 0
  };
}

/** Папка пака tools с расходниками (Дез-Таблетки, Светопалочка, Хим-Грелки…). */
export const CONSUMABLES_FOLDER = "Расходники";

/**
 * «Расходное снаряжение, вроде гранат и медикаментов»: боеприпасы, препараты,
 * гранаты и предметы из папки «Расходники» пака Инструментов. Прочее (медикаменты
 * в виде снаряжения, расходные Наборы) игрок отмечает галочкой в окне сам.
 */
export function isConsumableItem(item) {
  if (!item) return false;
  if (item.type === "ammo" || item.type === "drug") return true;
  if (item.type === "tool" && item.folder?.name === CONSUMABLES_FOLDER) return true;
  return item.type === "weapon" && item.system?.weaponType === "grenade";
}

// ── Таланты, снижающие Редкость ─────────────────────────────────────────────

/**
 * Сдвиги Редкости от Талантов актора для предмета с признаками `cls`. Каждый
 * Талант даёт не больше одного сдвига; разные Таланты на один предмет
 * складываются (книга о пересечении молчит — вопрос владельцу в отчёте).
 *
 *  • Повелитель Войны — «уменьшает Редкость всего Экзотического снаряжения и
 *    Кибернетики на 1» (стр. 62);
 *  • Древний Воин — «уменьшает Редкость всего Легион снаряжения на 1» (стр. 62);
 *  • Разгадыватель Ритуалов — «может добывать ритуалы, требующие Записи, как
 *    если бы их Редкость была на 1 ниже» (Оккультист).
 * @returns {{id:string, label:string, value:number}[]}
 */
export function rarityShifts(actor, cls = {}) {
  const out = [];
  const T = REQUISITION_TALENTS;
  if ((cls.exotic || cls.cybernetic) && hasRequisitionTalent(actor, "lordOfWar")) {
    out.push({ id: T.lordOfWar.id, value: -1, label: `${T.lordOfWar.label}: Экзотика и Кибернетика на 1 легче` });
  }
  if (cls.legion && hasRequisitionTalent(actor, "ancientWarrior")) {
    out.push({ id: T.ancientWarrior.id, value: -1, label: `${T.ancientWarrior.label}: снаряжение Легиона на 1 легче` });
  }
  if (cls.ritual && hasRequisitionTalent(actor, "ritePuzzler")) {
    out.push({ id: T.ritePuzzler.id, value: -1, label: `${T.ritePuzzler.label}: Запись ритуала на 1 легче` });
  }
  return out;
}

/** Редкость после сдвигов, в границах таблицы (−5…+5). */
export function effectiveRarity(rarity, shifts = []) {
  const base = Number(rarity) || 0;
  const delta = (shifts ?? []).reduce((s, x) => s + (Number(x?.value) || 0), 0);
  return clamp(base + delta, RARITY_MIN, RARITY_MAX);
}

// ── Итоговый модификатор ────────────────────────────────────────────────────

/**
 * Модификатор Порога: Редкость + Количество + Качество (+ поправка ГМа).
 * `rarity` — уже с учётом сдвигов Талантов (effectiveRarity). null — у предмета
 * нет Редкости: в расчёт идёт 0, но `unrated` сообщает окну, что Редкость надо
 * указать вручную (или ГМ решит, что предмета в обороте нет).
 */
export function requisitionModifier({ rarity = 0, quantity = 1, quality = "common", consumable = false, local = 0 } = {}) {
  const unrated = rarity == null;
  const r = unrated ? 0 : Number(rarity) || 0;
  const rMod = rarityMod(r);
  const tier = quantityTier(quantity, { consumable });
  const qMod = qualityMod(quality);
  const lMod = Math.round(Number(local)) || 0;

  const parts = [];
  if (rMod) parts.push(`Редкость R${r}: ${sgn(rMod)}`);
  if (tier.mod) parts.push(`Количество (${tier.label}${tier.shifted ? ", расходное — на 2 ступени легче" : ""}): ${sgn(tier.mod)}`);
  else if (tier.shifted) parts.push(`Количество (${tier.label}, расходное): 0`);
  if (qMod) parts.push(`Качество ${ITEM_QUALITY[quality]?.abbr ?? quality}: ${sgn(qMod)}`);
  if (lMod) parts.push(`ГМ (местная распространённость): ${sgn(lMod)}`);

  return { rarityMod: rMod, quantityMod: tier.mod, qualityMod: qMod, localMod: lMod,
    total: rMod + tier.mod + qMod + lMod, unrated, tier, parts };
}

/** Порог теста Inf: характеристика плюс модификатор таблиц (Таланты-галочки добавляет окно броска). */
export function requisitionThreshold(inf, modifier) {
  return (Number(inf) || 0) + (Number(modifier) || 0);
}

/**
 * Всё, что нужно окну и карточке, одним объектом.
 *
 * @param {object} actor
 * @param {object} o
 * @param {?object} [o.item]        выбранный предмет (документ или запись пака)
 * @param {string}  [o.name]        название, если предмета нет (ручной ввод)
 * @param {?number} [o.rarity]      Редкость до Талантов; не задана — берётся у предмета
 * @param {number}  [o.quantity]
 * @param {string}  [o.quality]
 * @param {?boolean}[o.consumable]  не задано — определяется по предмету
 * @param {object}  [o.cls]         признаки предмета вручную (поверх itemClass)
 * @param {number}  [o.local]       поправка ГМа
 */
export function requisitionPlan(actor, { item = null, name = "", rarity, quantity = 1, quality = "common",
  consumable, cls, local = 0 } = {}) {
  const baseRaw = rarity === undefined ? itemRarity(item) : rarity;
  const unrated = baseRaw == null;
  const baseRarity = unrated ? 0 : Number(baseRaw) || 0;
  const klass = { ...itemClass(item), ...(cls ?? {}) };
  const shifts = rarityShifts(actor, klass);
  const eff = effectiveRarity(baseRarity, shifts);
  const isConsumable = consumable ?? isConsumableItem(item);
  const q = normQuantity(quantity);
  const qual = ITEM_QUALITY_LIST.includes(quality) ? quality : "common";
  const mods = requisitionModifier({ rarity: unrated ? null : eff, quantity: q, quality: qual,
    consumable: isConsumable, local });
  const title = name || item?.name || "снаряжение";
  return {
    label: `${title} ×${q}`,
    cls: klass, shifts, unrated,
    baseRarity, rarity: eff,
    quantity: q, quality: qual, consumable: isConsumable,
    mods, total: mods.total,
    // Теги теста для сбора правил (rules/requisition-talents.mjs, область
    // "requisition" в resolve-test.mjs).
    rollContext: { requisition: true, requisitionRarity: eff, requisitionQuantity: q }
  };
}

/**
 * Строки для карточки в чате (обычный текст, экранирует вызывающий): откуда
 * взялся модификатор таблиц. Порог и исход рисует карточка самого теста Inf —
 * здесь только «почему такое число».
 * @returns {string[]}
 */
export function requisitionSummaryLines(plan) {
  const lines = [];
  if (plan.shifts.length) {
    lines.push(`Редкость R${plan.baseRarity} → R${plan.rarity}: ${plan.shifts.map(s => s.label).join("; ")}`);
  }
  lines.push(...plan.mods.parts);
  lines.push(`Модификатор таблиц книги (стр. 165): ${sgn(plan.total)}`);
  if (plan.unrated) lines.push("У предмета нет Редкости — взята R0; доступность решает ГМ.");
  return lines;
}
