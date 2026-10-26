// module/rules/social-faction.mjs
// ════════════════════════════════════════════════════════════════════════
//  ФРАКЦИЯ СОБЕСЕДНИКА В ОКНЕ БРОСКА (Sahara task-240a).
//
//  Связи, Хорошая Репутация, Враг и переброс Ненависти работают от цели броска.
//  В бою цель — выделенный токен (ctx.targetActor). В разговоре токена часто
//  нет: «Инквизицию» мышью не выделить, собеседник — NPC без листа или группа.
//  talent-targets.mjs::targetMatches умел читать ключ фракции из
//  ctx.socialFaction, но выставить его было нечему. Теперь окно броска
//  социального Навыка, если у персонажа есть такие Таланты, а токена-цели нет,
//  показывает выбор фракции собеседника (или «никакой»); выбранный ключ
//  уходит в ctx.socialFaction — и в строки окна, и в итоговый бросок.
//
//  Чистый модуль: Foundry не нужен, дерево фракций приходит аргументом.
// ════════════════════════════════════════════════════════════════════════

import { peerTargetsOf, goodReputationTargetsOf, enemyTalentsOf, hatredTargetsOf } from "./predicates.mjs";
import { isSocialSkill } from "./resolve-test.mjs";
import { factionKey, factionDepth } from "./factions.mjs";

/** Ключи фракций среди целей всех Талантов, которым нужен собеседник (без повторов, порядок появления). */
export function socialTalentFactionRefs(actor) {
  const targets = [
    ...peerTargetsOf(actor),
    ...goodReputationTargetsOf(actor),
    ...enemyTalentsOf(actor).flatMap(e => e.targets),
    ...hatredTargetsOf(actor)
  ];
  const out = [];
  for (const t of targets) {
    if (t?.kind === "faction" && t.ref && !out.includes(t.ref)) out.push(t.ref);
  }
  return out;
}

/**
 * Нужно ли показывать выбор фракции собеседника: социальный Навык, токена-цели
 * нет (с токеном работает обычный путь), и у персонажа есть Талант, которому
 * этот выбор что-то даёт.
 */
export function socialFactionPickerShown(actor, ctx = {}) {
  if (!isSocialSkill(ctx.skill)) return false;
  if (ctx.targetActor) return false;
  return socialTalentFactionRefs(actor).length > 0;
}

/**
 * Варианты выбора. Сначала фракции из целей самих Талантов («ваши»), потом весь
 * каталог по алфавиту с отступом по глубине дерева: собеседник бывает из
 * дочерней фракции (рота внутри Хаоса), и правило сработает на неё само.
 *
 * @param {Map} byKey дерево фракций (rules/factions.mjs::getFactionIndex)
 * @returns {{own: {key:string,label:string}[], all: {key:string,label:string}[]}}
 */
export function socialFactionOptions(actor, byKey) {
  const labelOf = key => String(byKey.get(key)?.name ?? key);
  const ownKeys = socialTalentFactionRefs(actor);
  const own = ownKeys.map(key => ({ key, label: labelOf(key) }));
  const all = [...byKey.values()]
    .map(f => ({ key: factionKey(f), name: String(f.name ?? "") }))
    .filter(f => f.key)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    // Глубина 1 у корня: отступ только у детей и ниже.
    .map(f => ({ key: f.key, label: `${"— ".repeat(Math.min(3, Math.max(0, factionDepth(f.key, byKey) - 1)))}${f.name || f.key}` }));
  return { own, all };
}

/** Контекст броска с выбранной фракцией; пустой выбор снимает поле, исходный ctx не меняется. */
export function withSocialFaction(ctx, key) {
  const next = { ...ctx };
  const k = String(key ?? "").trim();
  if (k) next.socialFaction = k;
  else delete next.socialFaction;
  return next;
}
