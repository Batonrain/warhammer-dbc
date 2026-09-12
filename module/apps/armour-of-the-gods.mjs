// module/apps/armour-of-the-gods.mjs
// ════════════════════════════════════════════════════════════════════════
//  Armour of the Gods / Доспехи Богов (wdbc-1rno) — Foundry-обвязка поверх
//  module/rules/armour-of-the-gods.mjs. Сестра-функция apps/elite-buy.mjs::
//  buyEliteArchetype: тот же грант предмета Архетипа + запись в шапку, но
//  БЕЗ проверки требований и БЕЗ списания опыта (книга: «без траты опыта»).
//  Создание предмета Архетипа само по себе уже достаточно — Hooks.on
//  ("createItem", ...) → apps/mechanics.mjs::applyItemMechanics выдаёт
//  Size(1)/Unnatural S(4)/T(4)/Divine Plate/9 Талантов АВТОМАТИЧЕСКИ, тем
//  же трактом, что и обычная покупка (см. шапку rules/armour-of-the-gods.mjs).
// ════════════════════════════════════════════════════════════════════════

import { hasIroncladArchetype, divinePlateArmourData, IRONCLAD_ARCHETYPE_NAME }
  from "../rules/armour-of-the-gods.mjs";

const PACK = "warhammer-dbc.elite-archetypes";

/**
 * @param {Actor} actor
 * @returns {Promise<{ok:boolean, reason?:string, corGain?:number}>}
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

  // «+1d10 Cor» (charBonus архетипа) — не автоматизирована для обычной
  // покупки нигде (см. шапку rules/armour-of-the-gods.mjs), здесь — только
  // для этой находки.
  const corRoll = await new Roll("1d10").evaluate();
  upd["system.corruption.value"] = Math.min(100, (Number(actor.system?.corruption?.value) || 0) + corRoll.total);
  await actor.update(upd);

  // Второй предмет — реальные AP Божественных Лат (Черта архетипа сама по
  // себе нулевая, см. шапку файла) — «слияние, если лучше» через уже
  // существующий max-между-бронями конвейер, без единой строчки нового кода.
  await actor.createEmbeddedDocuments("Item", [divinePlateArmourData()]);

  return { ok: true, corGain: corRoll.total };
}
