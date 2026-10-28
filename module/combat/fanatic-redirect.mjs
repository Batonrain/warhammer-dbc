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
//  Перенос самого попадания остаётся ручным решением стола: movement и
//  геометрия «встал на пути атаки» не моделируются — но и не нужны отдельным
//  кодом. module/combat/attack-card.mjs::applyDamageSection уже умеет
//  применять урон НЕ той цели, по которой стреляли: кнопка «Применить урон»
//  (кроме случаев с data-force-target — Орда/рикошет/встречная атака, где
//  цель известна на 100%) резолвит актора из нацеленных/выделенных токенов
//  СЦЕНЫ В МОМЕНТ КЛИКА (hooks.mjs, тот же общий механизм, что у любого
//  применения урона). Поэтому «перенести попадание на Fanatic» ничем не
//  отличается от обычного ручного решения ГМа: выделить токен носителя
//  Fanatic вместо исходной цели и нажать существующую кнопку.
//
//  УСИЛЕННАЯ АВТОМАТИЗАЦИЯ (19.10.2026, решение владельца — «нужно сильнее
//  автоматизировать»): раньше ГМ должен был САМ заметить, что рядом с целью
//  есть носитель Fanatic, и САМ считать «раз в Раунд» на бумаге — теперь
//  обоих не нужно.
//   1. fanaticInterceptCandidates — геометрия базового контакта (своя копия
//      той же арифметики, что combat/rig-steal.mjs::inMeleeContact — НЕ
//      импорт оттуда: rig-steal.mjs тянет rules/roll-mods.mjs →
//      resolve-test.mjs → collect.mjs → sources.mjs, тяжеленный путь, что
//      ломает лёгкие тесты этого файла без foundry-stub.mjs; тот же класс
//      проблемы, что у геометрии в rules/leadership-talents.mjs, см.
//      заголовок того файла) теперь считается автоматически в attack.mjs и
//      показывается прямо в карточке атаки (attack-card.mjs) — список
//      кандидатов не нужно искать на сцене глазами.
//   2. «Раз в Раунд без траты Реакции» — теперь настоящий счётчик
//      (rules/cooldown.mjs::isCapabilityAvailable/markCapabilityUsed, unit
//      "round", тот же механизм, что у Assassin Strike/Соблазнения Стаи).
//      Карточка показывает, свободен ли перехват у каждого кандидата, и
//      даёт кнопку «Отметить перехват» — отмечает счётчик потраченным, когда
//      стол воспользовался бесплатным перехватом (сам перенос урона всё
//      равно через обычную кнопку «Применить урон», см. выше — две кнопки
//      не связаны программно, связь — только в том, что делает стол).
//      Исчерпанный бесплатный перехват НЕ блокирует Трейт Fanatic как
//      таковой — обычная версия (за Реакцию) всегда доступна, это
//      ограничение только добавки от Таланта.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasBackToBack, backToBackGrantCap } from "../rules/leadership-talents.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";

const BACK_TO_BACK_FREE_USE_FLAG = "backToBackFreeUse";
const MELEE_REACH_MULT = 1.5; // combat/rig-steal.mjs::inMeleeContact — своя копия, см. заголовок файла.

/** Евклидова дистанция центров двух токенов в метрах сцены (своя копия combat/facing.mjs::tokenDistance). */
export function tokenDistance(tokenA, tokenB) {
  const docA = tokenA?.document ?? tokenA, docB = tokenB?.document ?? tokenB;
  if (!docA || !docB) return null;
  const size = (typeof canvas !== "undefined" && canvas?.grid?.size) || 100;
  const unit = (typeof canvas !== "undefined" && (canvas?.scene?.grid?.distance ?? canvas?.grid?.distance)) || 1;
  const cx = doc => (Number(doc.x) || 0) + (Number(doc.width) || 1) * size / 2;
  const cy = doc => (Number(doc.y) || 0) + (Number(doc.height) || 1) * size / 2;
  return Math.hypot(cx(docA) - cx(docB), cy(docA) - cy(docB)) / size * unit;
}

/** В базовом контакте ли два токена — 1.5 клетки сцены (своя копия combat/rig-steal.mjs::inMeleeContact). */
function inMeleeContact(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const unit = (typeof canvas !== "undefined" && (canvas?.scene?.grid?.distance ?? canvas?.grid?.distance)) || 1;
  const d = tokenDistance(tokenA, tokenB);
  return d != null && d <= unit * MELEE_REACH_MULT;
}

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

/**
 * Носители Fanatic (кроме excludeUuids), чей активный токен сейчас в
 * базовом контакте с targetToken — геометрия вместо «искать глазами на
 * сцене». Нет targetToken (атака не в рукопашной/токен не выделен) —
 * список пуст: перехват в базовом контакте не книжный случай для дистанции.
 */
export function fanaticInterceptCandidates(targetToken, allActors, { excludeUuids = [] } = {}) {
  if (!targetToken) return [];
  const exclude = new Set(excludeUuids.filter(Boolean));
  return fanaticCandidates(allActors, { excludeUuids: [...exclude] }).filter(a => {
    const token = a.getActiveTokens?.()[0];
    return token && token !== targetToken && inMeleeContact(token, targetToken);
  });
}

/** Свободен ли у actor бесплатный (без Реакции) перехват этим Раундом — Спиной к Спине. */
export function backToBackFreeUseAvailable(actor) {
  return isCapabilityAvailable(actor, BACK_TO_BACK_FREE_USE_FLAG, "round");
}

/** Отметить бесплатный перехват actor потраченным в этом Раунде. */
export async function markBackToBackFreeUseUsed(actor) {
  await markCapabilityUsed(actor, BACK_TO_BACK_FREE_USE_FLAG, "round");
}
