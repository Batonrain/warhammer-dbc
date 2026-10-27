// module/rules/requisition-places.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Место реквизиции узла корабля — расчёт по таблице констант
//  (constants/requisition-places.mjs, Книга Пустоты, «Таблица Модификаторов
//  реквизиции»; Sahara 10-4eac, решение владельца 27.10.2026).
//
//  Чистая логика без Foundry. Файл НЕ источник правил (sources.mjs его не
//  импортирует): считается окном Реквизиции и requisitionPlan.
// ════════════════════════════════════════════════════════════════════════════

import {
  REQUISITION_PLACES, DEFAULT_PLACE, FAITH_FOLDER, PEER_FACTIONS, placeByKey
} from "../constants/requisition-places.mjs";
import { peerTargetsOf } from "./predicates.mjs";

const shipPropKeys = item => (item?.system?.shipProps ?? []).map(p => (typeof p === "string" ? p : p?.key));

/**
 * Признаки узла, на которые смотрит таблица мест: вид, «Необходимый»
 * (system.essential), свойства Археотех/Ксенотех и «дающий Enduring/High
 * Spirit» (system.shipProps), узел веры (папка «Вера» пака).
 */
export function nodeTraits(item) {
  const props = shipPropKeys(item);
  return {
    kind: item?.system?.kind ?? "",
    essential: item?.system?.essential === true,
    archeotech: props.includes("archeotech"),
    xenotech: props.includes("xenotech"),
    spirit: props.includes("highSpirit") || props.includes("enduringSpirit"),
    faith: item?.folder?.name === FAITH_FOLDER
  };
}

/** Какие узлы затрагивает сдвиг (поле `nodes` строки таблицы). */
export const NODE_SELECTORS = Object.freeze({
  all:          () => true,
  essential:    t => t.essential,
  weapon:       t => t.kind === "weapon",
  supplemental: t => t.kind === "supplemental",
  spirit:       t => t.spirit,
  faith:        t => t.faith
});

const TRAIT_LABEL = { archeotech: "Археотех", xenotech: "Ксенотех" };

/**
 * Есть ли у актора Талант Peer ИМЕННО этой фракции. Точное совпадение ключа,
 * без дерева фракций: книга требует «Peer (Imperial Navy)», «Peer (Mechanicus)»,
 * «Peer (Ecclesiarchy)», и Peer Империума (родителя) не годится — решение
 * владельца 27.10.2026 (в отличие от социальных бросков, rules/social-talents.mjs).
 */
export function hasPeerOf(actor, factionKey) {
  return peerTargetsOf(actor).some(t => t?.kind === "faction" && t.ref === factionKey);
}

/** Ключ места из ввода: неизвестное — DEFAULT_PLACE. */
export const normPlace = key => (placeByKey(key) ? key : DEFAULT_PLACE);

/**
 * Что делает место с покупкой ЭТОГО узла этим персонажем.
 *
 * @param {string}  placeKey   ключ строки таблицы
 * @param {object}  o
 * @param {?object} [o.item]   узел (компонент)
 * @param {?object} [o.actor]  покупатель (для Талантов Peer)
 * @param {object}  [o.flags]  отмеченные условия {suzerain: true, …}
 * @returns {{place:object, blocked:?string, shifts:{id:string,value:number,label:string}[],
 *   testMod:number, notes:string[]}}
 *   blocked — причина отказа (узел на этом месте не купить) либо null;
 *   shifts  — сдвиги Редкости в формате rarityShifts (+1 — тяжелее);
 *   testMod — штраф самого теста; notes — пояснения для окна и карточки.
 */
export function placeEffect(placeKey, { item = null, actor = null, flags = {} } = {}) {
  const place = placeByKey(normPlace(placeKey));
  const traits = nodeTraits(item);
  const out = { place, blocked: null, shifts: [], testMod: place.testMod ?? 0, notes: [] };
  const name = item?.name ? `«${item.name}»` : "узел";

  if (place.blocked) {
    out.blocked = `${place.label}: ${place.blocked}.`;
    return out;
  }
  if (place.needs?.peer && !hasPeerOf(actor, place.needs.peer)) {
    out.blocked = `${place.label}: приобрести можно только с Талантом ${PEER_FACTIONS[place.needs.peer].label} именно этой фракции (Peer Империума или другой фракции не годится) — у ${actor?.name ? `«${actor.name}»` : "персонажа"} его нет (проверьте, что в Таланте Peer выбрана цель-фракция).`;
    return out;
  }
  if (place.needs?.flag && !flags[place.needs.flag]) {
    const f = place.flags.find(x => x.key === place.needs.flag);
    out.blocked = `${place.label}: приобрести можно только с Талантом Peer контролирующей фракции — отметьте «${f.label}».`;
    return out;
  }
  for (const trait of place.forbid ?? []) {
    if (traits[trait]) {
      out.blocked = `${place.label}: ${TRAIT_LABEL[trait]} недоступен — узел ${name} не купить.`;
      return out;
    }
  }

  for (const s of place.shifts ?? []) {
    if (!NODE_SELECTORS[s.nodes](traits)) continue;
    if ((s.except ?? []).some(t => traits[t])) {
      out.notes.push(`${place.label}: ${name} — ${(s.except ?? []).map(t => TRAIT_LABEL[t]).join("/")}, сдвиг Редкости не действует.`);
      continue;
    }
    if (s.peer && !hasPeerOf(actor, s.peer)) {
      out.notes.push(`${place.label}: без Таланта ${PEER_FACTIONS[s.peer].label} Редкость не снижается.`);
      continue;
    }
    if (s.flag && !flags[s.flag]) {
      out.notes.push(`${place.label}: условие «${place.flags.find(f => f.key === s.flag).label}» не отмечено — Редкость не меняется.`);
      continue;
    }
    out.shifts.push({
      id: `requisition.place.${place.key}`, value: s.value,
      label: `${place.label}: Редкость на шаг ${s.value > 0 ? "выше" : "ниже"}`
    });
  }
  return out;
}

export { REQUISITION_PLACES, DEFAULT_PLACE };
