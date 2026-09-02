// module/rules/adjutant.mjs
// ════════════════════════════════════════════════════════════════════════
//  Adjutant / Адъютант (Талант Лидерства, wdbc-sk8s): «Командир персонажа
//  может до ½I.b (окр.▲) раз за бой перебросить тест Командования и раз в
//  Раунд — любой тест Lore для распознания событий на поле боя, если у
//  персонажа этот Навык продвинут хотя бы на уровень ниже, чем у
//  Командира. Эффекты нескольких Адъютантов не складываются (берётся
//  наибольший I.b), но расширяют список Lore.»
//
//  Даёт способность НЕ себе, а СВОЕМУ КОМАНДИРУ — поэтому это не обычная
//  Черта/Талант-правило на предмете (module/rules/item-rules.mjs, действует
//  на владельца), а отдельный источник правил (module/rules/sources.mjs,
//  тот же приём, что «пилот Дредноута» — cross-actor проверка вне самого
//  актора-владельца находки).
//
//  СЧЁТЧИКА ИСПОЛЬЗОВАНИЙ ЗДЕСЬ НЕТ НАМЕРЕННО — та же архитектурная
//  политика, что у всех остальных «раз в Раунд/бой перебросить X» от
//  Локусов и подобных находок (см. module/rules/roll-mods.mjs::
//  ruleRerollsHtml: «Сколько перебросов уже потрачено... здесь не
//  считается: система не ведёт учёт Раундов на акторе, и молчаливый
//  счётчик соврал бы. Это остаётся за столом»). «До ½I.b раз за бой» —
//  лимит, который стол считает сам, как и остальные.
//
//  Условие ранга Lore (по решению пользователя, wdbc-sk8s) — только для
//  переброса Lore, не для Командования: у Адъютанта должна найтись
//  специализация Знаний (Common/Forbidden/Scholastic Lore), совпадающая по
//  ключу с одной из специализаций Командира, рангом хотя бы на 1 ниже.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const LORE_GROUPS = ["commonLore", "forbiddenLore", "scholasticLore"];
const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];

function hasAdjutant(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Adjutant"));
}

/** Все Отряды (squad), где commanderActor занимает пост Командира. */
export function squadsCommandedBy(commanderActor, allActors) {
  const uuid = commanderActor?.uuid;
  if (!uuid) return [];
  return (allActors ?? []).filter(a => a?.type === "squad" && a.system?.posts?.commander?.uuid === uuid);
}

/** Все подчинённые (любой пост/членство) во ВСЕХ Отрядах commanderActor, кроме него самого. */
export function subordinatesOf(commanderActor, allActors) {
  const myUuid = commanderActor?.uuid;
  const out = [];
  const seen = new Set();
  for (const squad of squadsCommandedBy(commanderActor, allActors)) {
    const uuids = [
      squad.system?.posts?.leader?.uuid, squad.system?.posts?.coordinator?.uuid,
      ...(squad.system?.members ?? []).map(m => m.uuid)
    ].filter(Boolean);
    for (const uuid of uuids) {
      if (uuid === myUuid || seen.has(uuid)) continue;
      seen.add(uuid);
      const actor = (allActors ?? []).find(a => a.uuid === uuid);
      if (actor) out.push(actor);
    }
  }
  return out;
}

/** Все Адъютанты среди подчинённых commanderActor (может быть пусто). */
export function adjutantsOf(commanderActor, allActors) {
  return subordinatesOf(commanderActor, allActors).filter(hasAdjutant);
}

function rankIndex(rank) {
  const i = RANK_ORDER.indexOf(rank);
  return i < 0 ? 0 : i;
}

/** Есть ли у adjutant специализация Знаний той же специализации, что у commander, но рангом хотя бы на 1 ниже. */
function hasLoreBelow(adjutant, commander) {
  for (const group of LORE_GROUPS) {
    const mine   = adjutant?.system?.groupSkills?.[group] ?? [];
    const theirs = commander?.system?.groupSkills?.[group] ?? [];
    for (const entry of mine) {
      const match = theirs.find(t => t.specKey && t.specKey === entry.specKey);
      if (match && rankIndex(entry.rank) < rankIndex(match.rank)) return true;
    }
  }
  return false;
}

/**
 * Правила Adjutant/Адъютант для commanderActor — пусто, если среди его
 * подчинённых нет ни одного владельца Таланта.
 */
export function adjutantRerollRules(commanderActor, allActors) {
  const adjutants = adjutantsOf(commanderActor, allActors);
  if (!adjutants.length) return [];

  const rules = [{
    id: "adjutant.command", label: "Адъютант", when: {},
    effects: [{ kind: "rollMode", target: "skill:command", mode: "keepBest", rolls: 2, label: "Адъютант" }]
  }];

  if (adjutants.some(a => hasLoreBelow(a, commanderActor))) {
    for (const group of LORE_GROUPS) {
      rules.push({
        id: `adjutant.lore.${group}`, label: "Адъютант (Знания)", when: {},
        effects: [{ kind: "rollMode", target: `skill:${group.toLowerCase()}`, mode: "keepBest", rolls: 2, label: "Адъютант" }]
      });
    }
  }
  return rules;
}
