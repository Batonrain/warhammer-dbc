// module/rules/social-talents.mjs
//
// Peer / Связи, Good Reputation / Хорошая Репутация, Enemy / Враг — три
// «групповых» Таланта главы 3 («Социальные», DoomBC — Основная книга, стр. 62;
// Sahara peer-ancient-warrior-lord-of-war-excessive-wealth, часть «а», и
// 3-5e84). Образец — rules/hatred.mjs: цели лежат в talent.system.targets
// (выбираются игроком при получении, apps/target-choice.mjs, или ГМом на листе
// Таланта), а бросок знает собеседника по ctx.targetActor (выделенный токен;
// rules/talent-targets.mjs::targetMatches).
//
// Книжный текст (packs-src/talents/Социальные, сверен с books/core.json):
//   Peer — «+10 ко всем социальным взаимодействиям с этой группой».
//   Good Reputation — «ещё +10 к тестам при работе с этой группой»; в сводной
//     таблице книги — «+20 на общение с фракцией», то есть те же +10 Связей и
//     +10 Репутации. Требование «Peer (Организация)» книга ставит самому
//     Таланту (поле «Требования», constants/talent-requirements.mjs), а не
//     условием броска: поэтому Репутация считается от СВОИХ целей и на Связи
//     в броске не смотрит.
//   Enemy — «штраф −10 ко всем социальным взаимодействиям с этой группой за
//     уровень Таланта», Уровень 1–3.
//
// Что считается «социальным взаимодействием»: область `social` конвейера —
// семь навыков с apt2:"social" (Очарование, Командование, Торговля, Обман,
// Расспрос, Допрос, Запугивание; resolve-test.mjs::isSocialSkill). Те же
// навыки, что у переброса Ненависти и штрафов Нага/Состояний.
//
// Модификатор — автоматический (`auto: true`, как у Безграничного Тщеславия
// Наги): выбора «уместен ли тут бонус» у игрока нет, собеседник уже выбран
// токеном-целью. Строка показана в окне броска и вошла в Порог.
//
// Складывание (решения по тексту, книга молчит о пересечениях):
//   • Связи и Репутация — по +10 ОДИН раз каждая, сколько бы экземпляров
//     Таланта ни подошло: Талант на «эту группу», а цель, лежащая сразу в двух
//     группах (Ордо Ксенос внутри Инквизиции внутри Империума), от этого не
//     получает двойного бонуса. Связи и Репутация между собой складываются —
//     это и есть «+20» книжной таблицы.
//   • Враг — берётся наибольший Уровень среди подошедших экземпляров, а не
//     сумма: «за уровень Таланта» говорит про Уровень одного Таланта.
//   • Связи и Враг на одну группу складываются алгебраически.
//
// Собеседник без токена на сцене (Sahara task-240a): дерево фракций читает ключ
// из ctx.socialFaction (talent-targets.mjs::targetMatches), и окно броска
// социального Навыка теперь его выставляет — строка «Собеседник» с группами
// Талантов персонажа и всем каталогом (rules/social-faction.mjs,
// sheets/actor-sheet.mjs::_showSkillRollDialog). Выбор работает только когда
// токена-цели нет; цели других видов (раса, признак) по-прежнему требуют токена.
//
// Файл подключён к sources.mjs и потому НЕ импортирует ничего, что ведёт
// обратно к collect.mjs (hasRuleFlag, resolve-test, combat/facing…) —
// см. AGENTS.md → «Источники правил» и test/rules/source-registry-acyclic.test.mjs.

import { peerTargetsOf, goodReputationTargetsOf, enemyTalentsOf, enemyLevel, ENEMY_MAX_LEVEL,
  itemHasName, PREDICATES }
  from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";
import { getFactionIndex, isSameOrDescendant, anySameOrDescendant, actorFactionKeys }
  from "./factions.mjs";

export { enemyLevel, ENEMY_MAX_LEVEL };

// ── Древний Воин (стр. 62) ──────────────────────────────────────────────────
// «+10 на все социальные взаимодействия с персонажами, имеющими этот Талант и
// Космодесантниками Хаоса» (решение владельца 26.10.2026: предикат собеседника
// через выбор фракции в окне броска). Космодесантники Хаоса в данных — фракция
// «Легионы предатели» и её роты (packs-src/factions/Хаос) либо Астартес из
// фракции Хаос; носитель Таланта без токена в сцене выбирается псевдо-пунктом
// «Носитель Таланта» (ключ ниже — не фракция, дереву он неизвестен и ни одну
// другую цель не задевает). Читается по ИМЕНИ Таланта, не через Конструктор:
// запись Конструктора не умеет условия «собеседник из такой-то группы»
// (mech-when.mjs держит гейты про актора и предмет, не про цель).
export const ANCIENT_WARRIOR_BONUS = 10;
export const ANCIENT_WARRIOR_PEER_KEY = "talent:ancient-warrior";
export const CHAOS_ASTARTES_FACTION = "traitor-legions";
const CHAOS_FACTION = "chaos";

/** Есть ли у актора Талант «Ancient Warrior / Древний Воин». */
export function hasAncientWarrior(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Ancient Warrior"));
}

/**
 * Собеседник ЭТОГО броска — носитель Таланта или Космодесантник Хаоса. Выбор
 * фракции в окне (ctx.socialFaction) главнее токена — как у Связей
 * (talent-targets.mjs::targetMatches).
 */
export function isAncientWarriorPartner(ctx = {}, byKey = getFactionIndex()) {
  if (ctx?.socialFaction) {
    return ctx.socialFaction === ANCIENT_WARRIOR_PEER_KEY
      || isSameOrDescendant(ctx.socialFaction, CHAOS_ASTARTES_FACTION, byKey);
  }
  const target = ctx?.targetActor;
  if (!target) return false;
  if (hasAncientWarrior(target)) return true;
  const keys = actorFactionKeys(target);
  if (anySameOrDescendant(keys, CHAOS_ASTARTES_FACTION, byKey)) return true;
  // Астартес с принадлежностью к Хаосу, но без записи своего легиона.
  return PREDICATES.targetIsAstartes(null, ctx, true) && anySameOrDescendant(keys, CHAOS_FACTION, byKey);
}

/** Связи: «+10 ко всем социальным взаимодействиям с этой группой». */
export const PEER_BONUS = 10;
/** Хорошая Репутация: «ещё +10» сверх Связей. */
export const GOOD_REPUTATION_BONUS = 10;
/** Враг: «−10 … за уровень Таланта». */
export const ENEMY_PENALTY_PER_LEVEL = 10;

// Подпись строки в окне броска берётся у правила (resolve-test.mjs: effect.label ?? rule.label).
const social = value => ({ kind: "rollBonus", target: "social", value, auto: true });

/**
 * Правила трёх Талантов для ТЕКУЩЕГО теста — источник sources.mjs::"socialTalents".
 * Правила безусловные (`when: {}`): единственный гейт — подошла ли цель ЭТОГО
 * броска (ctx.targetActor) под цели Таланта, проверено здесь. Без совпадения
 * источник молчит; несоциальные тесты отсекает область `social` самого эффекта.
 */
export function socialTalentRules(actor, ctx = {}) {
  const rules = [];

  const peer = peerTargetsOf(actor);
  if (peer.length && anyTargetMatches(peer, ctx)) {
    rules.push({
      id: "social.peer", label: "Связи: общение с этой группой", when: {},
      effects: [social(PEER_BONUS)]
    });
  }

  const reputation = goodReputationTargetsOf(actor);
  if (reputation.length && anyTargetMatches(reputation, ctx)) {
    rules.push({
      id: "social.goodReputation", label: "Хорошая Репутация: общение с этой группой", when: {},
      effects: [social(GOOD_REPUTATION_BONUS)]
    });
  }

  let level = 0;
  for (const e of enemyTalentsOf(actor)) {
    if (e.targets.length && anyTargetMatches(e.targets, ctx)) level = Math.max(level, e.level);
  }
  if (level > 0) {
    rules.push({
      id: "social.enemy", label: `Враг (ур. ${level}): общение с этой группой`, when: {},
      effects: [social(-ENEMY_PENALTY_PER_LEVEL * level)]
    });
  }

  if (hasAncientWarrior(actor) && isAncientWarriorPartner(ctx)) {
    rules.push({
      id: "social.ancientWarrior", label: "Древний Воин: носитель Таланта / Космодесантник Хаоса", when: {},
      effects: [social(ANCIENT_WARRIOR_BONUS)]
    });
  }

  return rules;
}
