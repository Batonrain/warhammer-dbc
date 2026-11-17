// module/apps/armour-of-the-gods.mjs
// ════════════════════════════════════════════════════════════════════════
//  Armour of the Gods / Доспехи Богов (wdbc-1rno) — Foundry-обвязка поверх
//  module/rules/armour-of-the-gods.mjs. Сестра-функция apps/elite-buy.mjs::
//  buyEliteArchetype: тот же грант предмета Архетипа + запись в шапку, но
//  БЕЗ проверки требований и БЕЗ списания опыта (книга: «без траты опыта»).
//  Создание предмета Архетипа само по себе уже достаточно — Hooks.on
//  ("createItem", ...) → apps/mechanics.mjs::applyItemMechanics выдаёт
//  Size(1)/Unnatural S(4)/T(4)/Divine Plate АВТОМАТИЧЕСКИ, тем же трактом,
//  что и обычная покупка (см. шапку rules/armour-of-the-gods.mjs). Девять
//  Дополнительных Талантов (Hedgehog…Sorcerer's Plate) архетип с 03.11.2026
//  не выдаёт — они покупаются за опыт, как в книге («без траты опыта» в Даре
//  относится к цене самого архетипа, не к его Талантам).
// ════════════════════════════════════════════════════════════════════════

import { hasIroncladArchetype, divinePlateArmourData, hasDivinePlateArmour, IRONCLAD_ARCHETYPE_NAME }
  from "../rules/armour-of-the-gods.mjs";

const PACK = "warhammer-dbc.elite-archetypes";

/**
 * @param {Actor} actor
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function grantArmourOfTheGods(actor) {
  if (!actor) return { ok: false, reason: "Нет актора." };
  if (hasIroncladArchetype(actor.system)) {
    return { ok: false, reason: `${actor.name} уже Броненосец — Дар не выдаёт его повторно.` };
  }

  const pack = game.packs?.get(PACK);
  const index = await pack?.getIndex();
  const hit = index?.find(e => e.name === IRONCLAD_ARCHETYPE_NAME);
  const src = hit ? await pack.getDocument(hit._id) : null;
  if (!src) {
    return { ok: false, reason: `«${IRONCLAD_ARCHETYPE_NAME}» не найден в компендиуме Элитных архетипов.` };
  }

  const data = src.toObject();
  delete data._id;
  // Тот же trigger, что у buyEliteArchetype — createItem запускает
  // applyItemMechanics и выдаёт всё, что несёт Конструктор предмета Архетипа.
  await actor.createEmbeddedDocuments("Item", [data]);

  // Запись в шапку — то же ветвление, что buyEliteArchetype (первый архетип
  // в основное поле, следующие — в дополнительные), без цены/журнала опыта.
  const upd = {};
  if (!String(actor.system?.eliteArchetype || "").trim()) {
    upd["system.eliteArchetype"] = data.name;
  } else {
    const extra = [...(actor.system?.eliteArchetypesExtra || [])];
    if (!extra.includes(data.name)) { extra.push(data.name); upd["system.eliteArchetypesExtra"] = extra; }
  }

  await actor.update(upd);

  // «+1d10 Cor» теперь приходит из Конструктора самого предмета Архетипа
  // (запись kind:"corruption" — её отрабатывает createItem-хук, как и при
  // обычной покупке), поэтому здесь Порчу НЕ бросаем: иначе она удвоилась бы.
  // Божественные Латы (АР 8/10/8/8) выдаёт тот же хук — ensureDivinePlateArmour
  // ниже, по появлению предмета Архетипа на акторе.
  return { ok: true };
}

/**
 * Божественные Латы — отдельная броня AP 8/10/8/8 (Трейт Divine Plate у
 * архетипа сам по себе нулевая заглушка, см. шапку rules/armour-of-the-gods.mjs).
 * Зовётся createItem-хуком (warhammer-dbc.mjs::handleItemCreated), когда на
 * актора попадает предмет «Ironclad / Броненосец»: и обычная покупка (elite-buy),
 * и Мутация «Доспехи Богов», и ручное перетаскивание. Идемпотентно — броня уже
 * лежит (повторная покупка, Мутация поверх купленного) → ничего не создаётся.
 * «Слияние, если лучше» — штатный max-между-бронями (character/armour.mjs).
 * @returns {Promise<boolean>} создана ли броня
 */
export async function ensureDivinePlateArmour(actor) {
  if (!actor || hasDivinePlateArmour(actor.items)) return false;
  await actor.createEmbeddedDocuments("Item", [divinePlateArmourData()]);
  return true;
}
