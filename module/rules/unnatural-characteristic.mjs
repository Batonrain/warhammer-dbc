// module/rules/unnatural-characteristic.mjs
//
// Сверхъестественная Характеристика (корбук, стр. 26): рейтинг X трейта
// «Unnatural <Характеристика> (X)» даёт не только +X к самому Бонусу — это
// уже считает module/rules/character.mjs::traitCharBonus для листа — но и
// +⌊X/2⌋ Успехов на КАЖДЫЙ успешный тест этой Характеристики. Второе нигде
// не было подключено (capability trait.unnaturalCharacteristic, reader
// пуст, wdbc-y9i8) — здесь чистая логика без Foundry, wiring в
// rules/kind-outcome.mjs.
//
// «Это Unnatural-трейт» определяем по названию (англ. часть перед « / »), а
// не по одному факту наличия charBonuses: то же поле используют и другие
// Черты БЕЗ этого правила — «Daemonic (X)» по собственному тексту пака даёт
// только +X к Бонусу Стойкости и иммунитеты демона, без бонуса степени;
// бионические импланты (Bionic Arm, Flesh-Crafted Cortex) — просто плоский
// бонус. Единый признак — имя, начинающееся с «Unnatural » (все книжные
// экземпляры трейта, включая шаблонные «Unnatural Strength (X)»).

const UNNATURAL_PREFIX = /^unnatural\s/i;

function englishName(name) {
  return String(name ?? "").split(" / ")[0].trim();
}

/**
 * Список {stat, value} с одного предмета — поддерживает и мигрированный вид
 * (charBonuses[], каноничный на живом Foundry-акторе после migrateData), и
 * досрочную пару charBonusStat/charBonusValue (её тесты строят голыми
 * объектами, минуя DataModel).
 */
function charBonusEntries(effects) {
  const fx = effects || {};
  const list = Array.isArray(fx.charBonuses) ? [...fx.charBonuses] : [];
  if (fx.charBonusStat && fx.charBonusValue) list.push({ stat: fx.charBonusStat, value: fx.charBonusValue });
  return list;
}

/**
 * Суммарный рейтинг X Unnatural-трейтов актора для одной Характеристики.
 * Складывает несколько источников — та же логика стекания, что уже применена
 * к +X Бонуса в character.mjs, не «последний/наибольший побеждает».
 *
 * @param {object} actor   документ актора (нужен только .items)
 * @param {?string} charKey ключ Характеристики ("s", "t", "wp", …)
 * @returns {number}
 */
export function unnaturalRating(actor, charKey) {
  if (!charKey) return 0;
  let total = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "trait") continue;
    if (!UNNATURAL_PREFIX.test(englishName(item.name))) continue;
    for (const cb of charBonusEntries(item.system?.effects)) {
      if (cb?.stat === charKey) total += Number(cb.value) || 0;
    }
  }
  return total;
}

/** +1 Успех за каждые полные 2 рейтинга (стр. 26) — целочисленное деление вниз. */
export function unnaturalDegreeBonus(rating) {
  return Math.floor((Number(rating) || 0) / 2);
}

/**
 * Владеет ли актор этим Трейтом для данной Характеристики вообще — для
 * тай-брейка встречного теста (стр. 26) важен сам факт, не величина рейтинга.
 */
export function hasUnnaturalCharacteristic(actor, charKey) {
  return unnaturalRating(actor, charKey) > 0;
}
