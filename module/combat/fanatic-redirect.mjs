// module/combat/fanatic-redirect.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BACK TO BACK / СПИНОЙ К СПИНЕ (Талант Лидерства, Sahara 3-ac78, bd
//  wdbc-3w7lo): «Успешно совершив Команду, персонаж может получить Трейт
//  Fanatic и дать его до ½F.b (окр.▲) подчинённых до конца боя (или до
//  повторного использования). Получивший Fanatic персонаж в базовом
//  контакте с целью атаки может раз в Раунд использовать его без траты
//  Реакции.»
//
//  Fanatic/Фанатик (packs-src/traits/Fanatic___Фанатик_unN0w9BzbfYfiEXK.json):
//  «...может потратить Реакцию, чтобы передвинуться на дистанцию до
//  полудвижения, и если это позволяет встать на пути атаки — получает это
//  попадание и урон от него вместо союзника.»
//
//  УРЕЗАННАЯ ВЕРСИЯ (решение владельца 19.10.2026): движение и геометрия
//  «встал на пути атаки» не моделируются — но и не нужны отдельным кодом.
//  module/combat/attack-card.mjs::applyDamageSection уже умеет применять
//  урон НЕ той цели, по которой стреляли: кнопка «Применить урон» (кроме
//  случаев с data-force-target — Орда/рикошет/встречная атака, где цель
//  известна на 100%) резолвит актора из нацеленных/выделенных токенов СЦЕНЫ
//  В МОМЕНТ КЛИКА (hooks.mjs, тот же общий механизм, что у любого применения
//  урона). Поэтому «перенести попадание на Fanatic» ничем не отличается от
//  обычного ручного решения ГМа: выделить токен носителя Fanatic вместо
//  исходной цели и нажать существующую кнопку — то же самое, что стол решал
//  бы и без Таланта, только показывает, у кого сейчас есть Fanatic (ниже).
//  Здесь — только раздача самого Трейта (grantFanaticTrait) и опознание
//  носителей; «раз в Раунд без траты Реакции» не отслеживается — перехват в
//  этой версии вообще не завязан на экономику действий.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasBackToBack, backToBackGrantCap } from "../rules/leadership-talents.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const NS = "warhammer-dbc";
const FANATIC_GRANT_FLAG = "fanaticGrant";
const FANATIC_TRAIT_COMPENDIUM_ID = "unN0w9BzbfYfiEXK";
const FANATIC_NAMES = ["Fanatic", "Фанатик"];

export function hasFanatic(actor) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "trait" && FANATIC_NAMES.some(n => itemHasName(i, n)));
}

/** Отряды, которыми actor командует (Командир ИЛИ Лидер) — тот же лёгкий обход, что field-execution.mjs. */
function squadsLedBy(actor, allActors) {
  const uuid = actor?.uuid;
  if (!uuid) return [];
  return (allActors ?? []).filter(a => a?.type === "squad"
    && (a.system?.posts?.commander?.uuid === uuid || a.system?.posts?.leader?.uuid === uuid));
}

/** Подчинённые во всех Отрядах, которыми командует actor (без дублей, кроме него самого). */
function subordinatesLedBy(actor, allActors) {
  const seen = new Set(), out = [];
  const index = new Map();
  for (const a of allActors ?? []) if (a?.uuid) index.set(a.uuid, a);
  for (const squad of squadsLedBy(actor, allActors)) {
    for (const m of squad.system?.members ?? []) {
      if (!m.uuid || m.uuid === actor.uuid || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      const doc = index.get(m.uuid);
      if (doc) out.push(doc);
    }
  }
  return out;
}

/** Снять предыдущий грант этого источника (книга: «до повторного использования»). */
async function clearPreviousGrant(commanderActor, allActors) {
  const candidates = [commanderActor, ...subordinatesLedBy(commanderActor, allActors)];
  for (const doc of candidates) {
    const ids = (doc.items ?? [])
      .filter(i => i.flags?.[NS]?.[FANATIC_GRANT_FLAG]?.source === commanderActor.uuid)
      .map(i => i.id);
    if (ids.length && doc.isOwner) await doc.deleteEmbeddedDocuments("Item", ids);
  }
}

/**
 * Конец боя (книга: Fanatic — «до конца боя»): снять все розданные Fanatic.
 * ponytail: снимает гранты любого источника на конце любого боя — при двух
 * боях разом сгорят и гранты второго; станет важно — сверять source с комбатантами.
 */
export async function clearFanaticGrants(allActors) {
  for (const doc of allActors ?? []) {
    const ids = [...(doc.items ?? [])].filter(i => i.flags?.[NS]?.[FANATIC_GRANT_FLAG]).map(i => i.id);
    if (ids.length && doc.isOwner) await doc.deleteEmbeddedDocuments("Item", ids);
  }
}

/**
 * Раздать Fanatic себе и до backToBackGrantCap(commanderActor) подчинённых.
 * @returns {string[]} имена, кто получил
 */
export async function grantFanaticTrait(commanderActor, allActors) {
  const trait = await fromUuid(`Compendium.warhammer-dbc.traits.Item.${FANATIC_TRAIT_COMPENDIUM_ID}`).catch(() => null);
  if (!trait) { ui.notifications?.warn("Трейт «Fanatic» не найден в компендиуме."); return []; }

  await clearPreviousGrant(commanderActor, allActors);

  const cap = backToBackGrantCap(commanderActor);
  const recipients = [commanderActor, ...subordinatesLedBy(commanderActor, allActors).slice(0, cap)];
  const given = [];
  for (const doc of recipients) {
    if (!doc.isOwner) continue;
    if (doc.items?.some(i => i.type === "trait" && itemHasName(i, "Fanatic"))) { given.push(doc.name); continue; }
    const data = trait.toObject();
    delete data._id;
    data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}), [FANATIC_GRANT_FLAG]: { source: commanderActor.uuid } } };
    await doc.createEmbeddedDocuments("Item", [data]);
    given.push(doc.name);
  }
  return given;
}

/** Кнопка на карточке результата Команды: видна у отдающего с Back to Back после успеха. */
export function backToBackGrantSectionHtml(rollerActor) {
  if (!hasBackToBack(rollerActor)) return "";
  const cap = backToBackGrantCap(rollerActor);
  return `<div class="sq-chat-note">${rollIcon("shield", "#ffb347")}Спиной к Спине: можно раздать Трейт Fanatic себе и до ${cap} подчинённых (до конца боя или следующей раздачи).
    <button type="button" class="wh-back-to-back-grant" data-commander-uuid="${rollerActor.uuid}">Раздать Фанатик</button></div>`;
}

/** Акторы (кроме excludeUuids), у кого сейчас есть Fanatic — справочно, кто МОЖЕТ принять удар на себя. */
export function fanaticCandidates(allActors, { excludeUuids = [] } = {}) {
  const exclude = new Set(excludeUuids.filter(Boolean));
  return (allActors ?? []).filter(a => a?.uuid && !exclude.has(a.uuid) && hasFanatic(a));
}
