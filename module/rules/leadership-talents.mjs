// module/rules/leadership-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ЛИДЕРСТВА (глава 3).
//
//  Sahara 3-ac78 (разведка 18.10.2026) описала всю группу как «ждёт
//  неисследованной подсистемы Команд/Слаженности» — повторная разведка
//  19.10.2026 нашла эту подсистему полностью реализованной (rules/command.mjs,
//  combat/command-state.mjs, rules/command-effects.mjs, rules/squad.mjs).
//  Итог прохода (тот же день): 16 из 19 Талантов группы — расширение готовых
//  узлов (Risk/riskCap, cohesion.start, group-skills, cross-actor
//  commandersOf, COHESION_EVENTS), без новой подсистемы:
//  Rancor, Bravado, Camaraderie, Eloquence, Duty Above All, Iron Discipline,
//  Air of Authority, Frontline Commander, Protege, Radiant Presence, Into the
//  Jaws of Hell, Living Legend, War Chant (частично — см. ниже), Rally.
//  Ещё 3 реализованы отдельным проходом (bd wdbc-3w7lo, 19.10.2026) — у каждого
//  была новая механика/UI, не довесок: Back to Back (Трейт Fanatic,
//  combat/fanatic-redirect.mjs), Field Execution (combat/field-execution.mjs),
//  Bring It Down! (bringItDownStacks на shortCommand, command-effects.mjs).
//
//  ctx.targetActor Команды/Морали — выделенный на сцене токен или источник
//  угрозы теста в момент броска, тем же приёмом, что Тест Страха
//  (sheets/tabs/disorders.mjs::openFearDialog) и Ненависть (rules/hatred.mjs).
//
//  Геометрия сцены (myToken/tokenDistance/inMeleeContact) — СВОИ копии, НЕ
//  импорт из combat/facing.mjs / rules/vision-target.mjs /
//  combat/rig-steal.mjs: все трое транзитивно тянут обратно до rules/
//  sources.mjs (через regions/auras.mjs → apps/mechanics.mjs → rules/
//  flags.mjs → collect.mjs, либо через rules/roll-mods.mjs напрямую) — этот
//  файл сам импортируется из sources.mjs, так что это замкнуло бы круг (тот
//  же класс проблемы, что у Адъютанта, см. заголовок rules/adjutant.mjs).
//  Пойман test/rules/source-registry-acyclic.test.mjs — держите импорты
//  геометрии локальными при добавлении новых находок сюда.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { relationByDisposition } from "./warp-touched.mjs";

// Геометрия токенов (дистанция центров, рукопашный контакт, поле зрения) —
// НЕ импортируется из combat/facing.mjs / rules/vision-target.mjs /
// combat/rig-steal.mjs: все трое (через regions/auras.mjs::tokenDocDistance
// → apps/mechanics.mjs → rules/flags.mjs → collect.mjs, либо напрямую через
// rules/roll-mods.mjs::collectTestMods → resolve-test.mjs → collect.mjs)
// дотягиваются обратно до collect.mjs → sources.mjs → этот файл — тот же
// класс кругового импорта, что у Адъютанта (см. заголовок rules/adjutant.mjs).
// Поэтому вся нужная здесь геометрия — свои копии той же арифметики, что
// tokenDocDistance (вторых копий в проекте по возможности быть не должно, но
// здесь это единственный способ не замкнуть круг).

const MELEE_REACH_MULT = 1.5;

function gridOf() {
  return {
    size: (typeof canvas !== "undefined" && canvas?.grid?.size) || 100,
    distance: (typeof canvas !== "undefined" && (canvas?.scene?.grid?.distance ?? canvas?.grid?.distance)) || 1
  };
}

/** Центр токена-документа в пикселях сцены. */
function tokenCenterPx(doc, size) {
  return { x: (Number(doc.x) || 0) + (Number(doc.width) || 1) * size / 2,
           y: (Number(doc.y) || 0) + (Number(doc.height) || 1) * size / 2 };
}

/** Плоская дистанция центров двух токенов, в метрах сцены (элевация не учтена — та же 2D-граница, что facing.mjs::tokenDistance). */
function tokenDistance(tokenA, tokenB) {
  const docA = tokenA?.document ?? tokenA, docB = tokenB?.document ?? tokenB;
  if (!docA || !docB) return null;
  const { size, distance } = gridOf();
  const a = tokenCenterPx(docA, size), b = tokenCenterPx(docB, size);
  return Math.hypot(a.x - b.x, a.y - b.y) / size * distance;
}

/** В базовом контакте ли два токена — 1.5 клетки сцены (combat/rig-steal.mjs::inMeleeContact). */
function inMeleeContact(tokenA, tokenB) {
  const d = tokenDistance(tokenA, tokenB);
  return d != null && d <= gridOf().distance * MELEE_REACH_MULT;
}

/** Есть ли у актора Талант этой группы по любой половине двуязычного имени. */
function hasLeadershipTalent(actor, names) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "talent" && names.some(n => itemHasName(i, n)));
}

// ── Air of Authority / Аура Власти ───────────────────────────────────────────
// Книжный текст: «Он может применять Command (и Intimidate на подчинённых)
// на до F.b×20 целей одновременно. Его Миньоны-люди также получают +10
// Лояльности.» Базовый лимит целей Command/Intimidate «на подчинённых» —
// F.b (решение владельца 19.10.2026, тот же приём уже есть в коде —
// exoditeGroupLimit у Lord of the Exodites, sheets/tabs/command.mjs:142);
// Air of Authority не прибавляет, а ЗАМЕНЯЕТ множитель на ×20. Отдельно от
// followerCount/bossCap (F.b×2) — тот лимит про СТРУКТУРНОЕ число
// подчинённых, этот — про сколько из них накрывает ОДНО применение
// Command/Intimidate. Пока только отображается (sheets/tabs/command.mjs::
// commandContext → tab-social.hbs) — само применение Command/Intimidate
// подчинённым сейчас не считает получателей количественно (бьёт по всему
// составу безусловно), поэтому принудительного урезания пока нет.

const AIR_OF_AUTHORITY_NAMES = ["Air of Authority", "Аура Власти"];

export function hasAirOfAuthority(actor) {
  return hasLeadershipTalent(actor, AIR_OF_AUTHORITY_NAMES);
}

/** Лимит целей Command/Intimidate «на подчинённых» — F.b, ×20 с Air of Authority. */
export function commandTargetLimit(actor) {
  const felBonus = Math.max(0, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
  return hasAirOfAuthority(actor) ? felBonus * 20 : felBonus;
}

// ── Rancor / Злопамятность ───────────────────────────────────────────────────
// Книжный текст: «Отдавая Команду против Ненавистных врагов или на защиту от
// них, персонаж получает +10 на эту Команду и +1 к максимуму Успехов от
// Риска.» +10 — rollBonus на target "skill:command", тот же приём, что
// hatred.mjs::hatredRules (ctx.targetActor сверяется с hatredTargetsOf ЭТОГО
// ЖЕ актора). +1 к максимуму Успехов — riskCap не эффект броска
// (resolve-test.mjs его не считает), поэтому не правило реестра, а чистая
// функция rancorRiskCapBonus, вызываемая из sheets/squad-sheet.mjs::_effectiveRisk.
// «Против... или на защиту от них» — направление (атака/защита) система не
// разбирает, как и у самой Ненависти — проверяется только совпадение цели.

const RANCOR_NAMES = ["Rancor", "Злопамятность"];

export function hasRancor(actor) {
  return hasLeadershipTalent(actor, RANCOR_NAMES);
}

function hatredTargetMatches(actor, ctx) {
  const targets = hatredTargetsOf(actor);
  return targets.length > 0 && anyTargetMatches(targets, ctx);
}

/** +1 к максимуму Успехов Команды от Риска — sheets/squad-sheet.mjs::_effectiveRisk. */
export function rancorRiskCapBonus(actor, ctx = {}) {
  return hasRancor(actor) && hatredTargetMatches(actor, ctx) ? 1 : 0;
}

// ── Bravado / Бравада ────────────────────────────────────────────────────────
// Книжный текст: «Персонаж считает свой уровень Риска на 1 выше реального,
// если он не равен 1.» Чистое число — применяется к УРОВНЮ Риска (не к самому
// system.risk Отряда: это восприятие ОТДАЮЩЕГО, не постоянная правка), перед
// тем как sheets/squad-sheet.mjs::_effectiveRisk подставит его в риск-таблицу
// riskCap() — отсюда и +2/+3 скачок потолка Успехов на некоторых уровнях, не
// только +1: таблица RISK_LEVELS нелинейна.

const BRAVADO_NAMES = ["Bravado", "Бравада"];

export function hasBravado(actor) {
  return hasLeadershipTalent(actor, BRAVADO_NAMES);
}

/** Воспринимаемый уровень Риска для sheets/squad-sheet.mjs::_effectiveRisk (1..5). */
export function bravadoRiskLevel(baseLevel, actor) {
  const level = Math.max(1, Math.min(5, Number(baseLevel) || 1));
  if (level === 1 || !hasBravado(actor)) return level;
  return Math.min(5, level + 1);
}

// ── Camaraderie / Дружество ──────────────────────────────────────────────────
// Книжный текст: «В начале миссии персонаж поднимает Слаженность отряда до
// +20, даже если ведёт этих солдат впервые, имеет дурную репутацию или отряд
// имеет внутренние конфликты.» — минимум для system.cohesion.start/.value в
// sheets/squad-sheet.mjs::_startMission, не прибавка: ниже +20 — поднимает,
// выше — не трогает.

const CAMARADERIE_NAMES = ["Camaraderie", "Дружество"];

export function hasCamaraderie(actor) {
  return hasLeadershipTalent(actor, CAMARADERIE_NAMES);
}

export const CAMARADERIE_MIN_COHESION = 20;

/** Слаженность в начале миссии — не ниже CAMARADERIE_MIN_COHESION у Лидера с Талантом. */
export function camaraderieStartCohesion(base, leaderActor) {
  const b = Number(base) || 0;
  return hasCamaraderie(leaderActor) ? Math.max(CAMARADERIE_MIN_COHESION, b) : b;
}

// ── Duty Above All / Долг Превыше Всего ──────────────────────────────────────
// Книжный текст: «Если персонаж — Лидер отряда, Конфликты между членами
// отряда не понижают его Слаженность (постоянную и во время миссии).» —
// «Конфликты между членами отряда» буквально один из пресетов
// constants/squad.mjs::COHESION_EVENTS (delta −5); sheets/squad-sheet.mjs::
// _changeCohesion получает его label как есть с кнопки — сверяем по тексту,
// не заводя отдельный ключ события.

const DUTY_ABOVE_ALL_NAMES = ["Duty Above All", "Долг Превыше Всего"];
export const CONFLICT_COHESION_LABEL = "Конфликт между членами отряда";

export function hasDutyAboveAll(actor) {
  return hasLeadershipTalent(actor, DUTY_ABOVE_ALL_NAMES);
}

/** Блокировать ли этот клик по Слаженности — да, если это пресет «Конфликт» у Лидера с Долгом Превыше Всего. */
export function dutyAboveAllBlocks(delta, label, leaderActor) {
  return Number(delta) < 0 && label === CONFLICT_COHESION_LABEL && hasDutyAboveAll(leaderActor);
}

// ── Eloquence / Красноречие ──────────────────────────────────────────────────
// Книжный текст: «Отдавая Команду на языке с Linguistics +10 и выше, персонаж
// получает +5 на эту Команду за каждый уровень продвижения выше +0, а на +30
// — также +1 к максимуму Успехов от Риска.» Язык Команды не выбирается в
// интерфейсе отдельно — читается НАИЛУЧШАЯ специализация Linguistics актора
// (та же вольность, что у Сопротивления в resilience-talents.mjs: берём то,
// что есть, не заводя выбор языка под каждую Команду).

const ELOQUENCE_NAMES = ["Eloquence", "Красноречие"];

export function hasEloquence(actor) {
  return hasLeadershipTalent(actor, ELOQUENCE_NAMES);
}

/** Лучший ранг Linguistics актора, числом (−20…+30; 0, если специализаций нет). */
export function linguisticsBestRank(actor) {
  const entries = actor?.system?.groupSkills?.linguistics ?? [];
  const bonuses = entries.map(e => SKILL_RANKS[e.rank]?.bonus ?? -20);
  return bonuses.length ? Math.max(...bonuses) : 0;
}

/** +5 на Команду за каждый шаг продвижения Linguistics выше +0 (от +10). */
export function eloquenceCommandBonus(actor) {
  if (!hasEloquence(actor)) return 0;
  const rank = linguisticsBestRank(actor);
  return rank >= 10 ? 5 * Math.floor(rank / 10) : 0;
}

/** +1 к максимуму Успехов Команды от Риска — Linguistics на +30 (эксперт). */
export function eloquenceRiskCapBonus(actor) {
  return hasEloquence(actor) && linguisticsBestRank(actor) >= 30 ? 1 : 0;
}

// ── Iron Discipline / Железная Дисциплина ────────────────────────────────────
// Книжный текст: «Все подчинённые персонажа могут перебрасывать проваленные
// тесты Морали, кроме вызванных самим персонажем. Работает даже без персонажа
// рядом.» Cross-actor источник: обратное направление от Адъютанта
// (rules/adjutant.mjs) — там подчинённый даёт способность СВОЕМУ командиру,
// здесь командующий даёт способность СВОИМ подчинённым. commandersOf — свой
// обход (а не adjutant.mjs::subordinatesOf), потому что он идёт по Отрядам
// ЦЕЛИ (кто ею командует), а не по Отрядам командира (кем он командует).

const IRON_DISCIPLINE_NAMES = ["Iron Discipline", "Железная Дисциплина"];

export function hasIronDiscipline(actor) {
  return hasLeadershipTalent(actor, IRON_DISCIPLINE_NAMES);
}

/** Эффективный командующий Отряда — Командир, если пост занят, иначе Лидер. */
function effectiveCommanderUuid(squad) {
  return squad.system?.posts?.commander?.uuid || squad.system?.posts?.leader?.uuid || null;
}

/** Отряды, где actor состоит — на посту (Лидер/Координатор/Командир) или в составе. */
function squadsOf(actor, allActors) {
  const uuid = actor?.uuid;
  if (!uuid) return [];
  return (allActors ?? []).filter(a => {
    if (a?.type !== "squad") return false;
    const posts = a.system?.posts ?? {};
    if (posts.leader?.uuid === uuid || posts.coordinator?.uuid === uuid || posts.commander?.uuid === uuid) return true;
    return (a.system?.members ?? []).some(m => m.uuid === uuid);
  });
}

/** Командующие над actor (эффективный командующий + Координатор каждого Отряда, где он состоит), кроме него самого. */
export function commandersOf(actor, allActors) {
  const myUuid = actor?.uuid;
  const index = new Map();
  for (const a of allActors ?? []) if (a?.uuid) index.set(a.uuid, a);
  const out = [], seen = new Set();
  for (const squad of squadsOf(actor, allActors)) {
    const uuids = [effectiveCommanderUuid(squad), squad.system?.posts?.coordinator?.uuid].filter(Boolean);
    for (const uuid of uuids) {
      if (uuid === myUuid || seen.has(uuid)) continue;
      seen.add(uuid);
      const found = index.get(uuid);
      if (found) out.push(found);
    }
  }
  return out;
}

// ── Bring It Down! / Валите Это! ─────────────────────────────────────────────
// Книжный текст: «Давая Короткую Команду на бонус к попаданию по цели
// Размером 2+, персонаж может уменьшить бонус на 20, чтобы дать +1d10 Dmg по
// этой цели, в т.ч. несколько раз (40 → +2d10).» — читается как «давая
// Общую Короткую Команду с видом «Атаки», отдающий может пожертвовать 20
// её бонуса за стек +1d10 урона по ОДНОЙ выбранной крупной цели» (не про
// направленность самого бонуса — Общая Команда всегда даётся всему отряду).
//
// Стеки/цель хранятся прямо на system.shortCommand (squad) — bringItDownStacks
// /bringItDownTargetUuid, рядом с остальными полями Короткой Команды,
// заполняются в sheets/squad-sheet.mjs::_commandRoll("short") тем же
// приёмом, что recipientUuid у Личной Команды.
//   1. Срез бонуса попадания — пересчитан прямо в rules/command-effects.mjs::
//      shortCommandBonus (case "general"), не отдельное правило реестра.
//   2. +1d10 урона по цели — bringItDownStacksFor читает shortCommand
//      ОТРЯДА атакующего (squadsOf выше) и сверяет bringItDownTargetUuid с
//      целью ЭТОЙ атаки; дальше идёт как opts.bringItDownDice в
//      module/combat/attack.mjs, тем же способом, что Тирантикос/
//      Концентрация огня (bonusDice).
//
// «Размером 2+» — честно НЕ проверяется кодом автоматически при назначении
// стеков (украшение числом из system.size возможно, но решение оставлено
// игроку/ГМу в моменте выбора цели — та же вольность, что направление
// атаки/защиты у Ненависти).

const BRING_IT_DOWN_NAMES = ["Bring It Down!", "Валите Это!"];
export const BRING_IT_DOWN_PENALTY_PER_STACK = 20;
export const BRING_IT_DOWN_DICE_PER_STACK = 1;

export function hasBringItDown(actor) {
  return hasLeadershipTalent(actor, BRING_IT_DOWN_NAMES);
}

/** Срез бонуса попадания Общей/Атака Короткой Команды — 20 за стек (может уйти ниже нуля, выбор игрока). */
export function bringItDownAccuracyPenalty(short) {
  if (!short?.active || short.key !== "general" || short.testKind !== "attack") return 0;
  const stacks = Math.max(0, Math.floor(Number(short.bringItDownStacks) || 0));
  return stacks > 0 ? -BRING_IT_DOWN_PENALTY_PER_STACK * stacks : 0;
}

/** Максимум стеков, которые можно назначить, не опуская бонус попадания ниже нуля. */
export function bringItDownMaxStacks(successes) {
  return Math.max(0, Math.floor((Number(successes) || 0) * 3 / BRING_IT_DOWN_PENALTY_PER_STACK));
}

/** +1d10×стеки урона по designated-цели этой Общей/Атака Короткой Команды — 0, если атака не по ней. */
export function bringItDownStacksFor(attackerActor, targetActor, allActors) {
  if (!targetActor?.uuid) return 0;
  for (const squad of squadsOf(attackerActor, allActors)) {
    const sc = squad.system?.shortCommand;
    if (sc?.active && sc.key === "general" && sc.testKind === "attack" && sc.bringItDownTargetUuid === targetActor.uuid) {
      return Math.max(0, Math.floor(Number(sc.bringItDownStacks) || 0)) * BRING_IT_DOWN_DICE_PER_STACK;
    }
  }
  return 0;
}

/**
 * Переброс провалов Морали, если хоть один командующий actor (кроме источника
 * угрозы этого теста — ctx.targetActor, тем же приёмом, что hatred.mjs) имеет
 * Iron Discipline. target "morale" — effectAppliesTo сам отбирает тесты Морали.
 */
function ironDisciplineRerollRules(actor, allActors, ctx) {
  const sourceUuid = ctx?.targetActor?.uuid ?? null;
  const has = commandersOf(actor, allActors)
    .some(c => c.uuid !== sourceUuid && hasIronDiscipline(c));
  if (!has) return [];
  return [{
    id: "ironDiscipline.moraleReroll", label: "Железная Дисциплина", when: {},
    effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Железная Дисциплина" }]
  }];
}

// ── Геометрия сцены (общая для Frontline Commander / Into the Jaws of Hell /
//    Radiant Presence) ────────────────────────────────────────────────────────
// Все три читают канву (токены, диспозиции, дистанцию) — чистой эту часть не
// сделать, но сама геометрия собрана в четырёх хелперах здесь же, чтобы не
// плодить три похожих обхода canvas.tokens.placeables по одному на Талант.
// Вне игры (typeof canvas === "undefined", как в тестах ядра) все отдают
// пусто/false — та же граница, что у dreadnought.mjs/adjutant.mjs.

function myToken(actor) {
  if (typeof canvas === "undefined") return null;
  return actor?.getActiveTokens?.(true)?.[0] ?? actor?.getActiveTokens?.()?.[0] ?? null;
}

function sceneTokensRelatedTo(token, relation) {
  if (!token) return [];
  const myDisp = Number(token.document?.disposition ?? 0);
  return (canvas.tokens?.placeables ?? []).filter(t => t !== token && t.actor
    && relationByDisposition(myDisp, Number(t.document?.disposition ?? 0)) === relation);
}

/** Дистанция до ближайшего врага этого токена (сцена/grid); null — нет токена/врагов. */
function nearestEnemyDistance(token) {
  const dists = sceneTokensRelatedTo(token, "enemy").map(e => tokenDistance(token, e)).filter(d => d != null);
  return dists.length ? Math.min(...dists) : null;
}

// ── Frontline Commander / Фронтовой Командир ─────────────────────────────────
// Книжный текст: «Если персонаж не дальше от ближайшего врага, чем любой из
// его подчинённых, он может перебрасывать тесты на Command. Связанный в
// рукопашной, он может провести одну Короткую Команду как свободное
// действие или Детальную Команду как полудействие.»
//   1. Переброс Command — rollMode keepBest на target "skill:command", отбор
//      по сравнению дистанций (subordinatesOfLocal ниже — та же логика, что
//      rules/adjutant.mjs::subordinatesOf, продублированная локально: импорт
//      adjutant.mjs отсюда тянет hasAbility → hasRuleFlag → collect.mjs →
//      sources.mjs, то есть обратно к файлу, который импортирует ЭТОТ —
//      замкнутый круг подвешивает загрузку модулей, см. заголовок
//      rules/adjutant.mjs про ту же причину его самостоятельной регистрации).
//   2. Свободное действие/полудействие — не правило реестра (Короткая
//      Команда списывает ОД напрямую в sheets/squad-sheet.mjs::_commandApCost,
//      тем же местом, что скидка Чумного Пастыря), а чистая функция
//      frontlineCommanderMeleeFree, вызываемая оттуда.

/** Отряды, где actor занимает пост Командира. */
function squadsCommandedByLocal(commanderActor, allActors) {
  const uuid = commanderActor?.uuid;
  if (!uuid) return [];
  return (allActors ?? []).filter(a => a?.type === "squad" && a.system?.posts?.commander?.uuid === uuid);
}

/** Все подчинённые (любой пост/членство) во всех Отрядах, которыми командует actor, кроме него самого. */
function subordinatesOfLocal(commanderActor, allActors) {
  const myUuid = commanderActor?.uuid;
  const out = [], seen = new Set();
  const index = new Map();
  for (const a of allActors ?? []) if (a?.uuid) index.set(a.uuid, a);
  for (const squad of squadsCommandedByLocal(commanderActor, allActors)) {
    const uuids = [
      squad.system?.posts?.leader?.uuid, squad.system?.posts?.coordinator?.uuid,
      ...(squad.system?.members ?? []).map(m => m.uuid)
    ].filter(Boolean);
    for (const uuid of uuids) {
      if (uuid === myUuid || seen.has(uuid)) continue;
      seen.add(uuid);
      const found = index.get(uuid);
      if (found) out.push(found);
    }
  }
  return out;
}

const FRONTLINE_COMMANDER_NAMES = ["Frontline Commander", "Фронтовой Командир"];

export function hasFrontlineCommander(actor) {
  return hasLeadershipTalent(actor, FRONTLINE_COMMANDER_NAMES);
}

/** Не дальше от ближайшего врага, чем ЛЮБОЙ из подчинённых (их дистанция то же посчитана до СВОЕГО ближайшего врага). */
export function frontlineCommanderDistanceOk(selfDist, subordinateDists) {
  if (selfDist == null) return false;
  const dists = (subordinateDists ?? []).filter(d => d != null);
  return dists.length > 0 && dists.every(d => selfDist <= d);
}

function frontlineCommanderRerollRules(actor, allActors) {
  if (!hasFrontlineCommander(actor) || typeof canvas === "undefined") return [];
  const selfDist = nearestEnemyDistance(myToken(actor));
  const subDists = subordinatesOfLocal(actor, allActors).map(s => nearestEnemyDistance(myToken(s)));
  if (!frontlineCommanderDistanceOk(selfDist, subDists)) return [];
  return [{
    id: "frontlineCommander.reroll", label: "Фронтовой Командир", when: {},
    effects: [{ kind: "rollMode", target: "skill:command", mode: "keepBest", rolls: 2, label: "Фронтовой Командир" }]
  }];
}

/** Связан в рукопашной (в базовом контакте с врагом) — для AP-скидки sheets/squad-sheet.mjs::_commandApCost. */
export function frontlineCommanderMeleeFree(actor) {
  if (!hasFrontlineCommander(actor)) return false;
  const token = myToken(actor);
  if (!token) return false;
  return sceneTokensRelatedTo(token, "enemy").some(e => inMeleeContact(token, e));
}

// ── Protege / Протеже ────────────────────────────────────────────────────────
// Книжный текст: «Персонаж может выбрать одного подчинённого/Миньона и раз в
// Ход отдавать ему Личную Команду свободным действием, но тогда до конца боя
// получает −30 на все команды другим. Менять любимчика — проведя сутки с
// новым.»
//
// Выбор любимчика НЕ заводит отдельного UI: любимчик — это тот, на кого
// впервые свободным действием применили Протеже (флаг protegeUuid
// ставится сам, при первом срабатывании), дальше держится до тех пор, пока
// кто-то не поправит флаг руками — «сутки с новым» книга не даёт системе
// отсчитывать (нет календарных часов у Отряда), это и остаётся за столом.
// «Раз в Ход» — turn-scoped флаг protegeFreeCommandUsed (rules/turn-flags.mjs);
// «до конца боя −30» — отдельный флаг protegePenaltyActive, не turn-scoped,
// сбрасывается в sheets/squad-sheet.mjs::_startMission вместе с прочим
// «до конца боя» состоянием (clearVoiceOfGodTemp).

const PROTEGE_NAMES = ["Protege", "Протеже"];
export const PROTEGE_PENALTY = -30;
const NS = "warhammer-dbc";

export function hasProtege(actor) {
  return hasLeadershipTalent(actor, PROTEGE_NAMES);
}

function flagOf(actor, key) {
  return actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key] ?? null;
}

/** Любимчик (uuid) — null, если ещё не выбран (Протеже ни разу не применяли свободным действием). */
export function protegeFavoriteUuid(actor) {
  return flagOf(actor, "protegeUuid");
}

/** Даёт ли Протеже это Личной Команде свободное действие — раз в Ход, только любимчику (или пока любимчик не выбран). */
export function protegeFreeCommandActive(actor, recipientUuid) {
  if (!hasProtege(actor) || !recipientUuid || flagOf(actor, "protegeFreeCommandUsed")) return false;
  const fav = protegeFavoriteUuid(actor);
  return !fav || fav === recipientUuid;
}

/** −30 на Команду НЕ любимчику, если пенальти уже включено этим боем (Протеже хоть раз применён). */
export function protegePenalty(actor, recipientUuid) {
  if (!hasProtege(actor) || !flagOf(actor, "protegePenaltyActive")) return 0;
  const fav = protegeFavoriteUuid(actor);
  return recipientUuid && recipientUuid === fav ? 0 : PROTEGE_PENALTY;
}

/** Патч actor.update после срабатывания свободного действия: закрепляет любимчика (если ещё не выбран) и пенальти. */
export function protegeActivationPatch(actor, recipientUuid) {
  const upd = { [`flags.${NS}.protegeFreeCommandUsed`]: true, [`flags.${NS}.protegePenaltyActive`]: true };
  if (!protegeFavoriteUuid(actor)) upd[`flags.${NS}.protegeUuid`] = recipientUuid;
  return upd;
}

// ── Radiant Presence / Блистательное Присутствие ─────────────────────────────
// Книжный текст: «Все союзники, способные видеть или слышать персонажа,
// получают +10 на тесты Морали, кроме вызванных самим персонажем.»
//
// РЕШЕНИЕ ВЛАДЕЛЬЦА 19.10.2026: вместо автоматического скана поля зрения —
// галочка в самих диалогах тестов Морали (Страх/Подавление/встречная часть
// Запугивания), тем же приёмом, что уже существующие ручные условия там
// («Демон», «Заведомо безопасно» — ГМ решает на глаз, код не переизобретает
// геометрию). «Видит ИЛИ слышит союзника/нейтрального с этим Талантом» —
// целиком решение стола за галочкой, код просто прибавляет +10, когда она
// отмечена. anyRadiantPresenceHolderExists — только чтобы решить, показывать
// ли галочку вообще (нет смысла предлагать её, если ни у кого в мире нет
// этого Таланта).

const RADIANT_PRESENCE_NAMES = ["Radiant Presence", "Блистательное Присутствие"];

export function hasRadiantPresence(actor) {
  return hasLeadershipTalent(actor, RADIANT_PRESENCE_NAMES);
}

/** Есть ли хоть один носитель в мире — только для показа галочки, не для её логики. */
export function anyRadiantPresenceHolderExists(allActors) {
  return (allActors ?? []).some(hasRadiantPresence);
}

/** +10 на тест Морали — вся логика «видит/слышит» уже решена галочкой диалога. */
export function radiantPresenceBonus(checked) {
  return checked ? 10 : 0;
}

// ── Into the Jaws of Hell / В Самое Пекло ────────────────────────────────────
// Книжный текст: «Если персонаж сражается рядом с подчинёнными, все они
// автоматически проходят тесты Морали, кроме вызванных им самим.»
//
// РЕШЕНИЕ ВЛАДЕЛЬЦА 19.10.2026: та же галочка, что у Radiant Presence выше —
// во ВСЕХ трёх диалогах тестов Морали (Страх/Подавление/Запугивание),
// включая Тест Страха, который раньше был честно пропущен за неимением
// надёжного источника угрозы в коде: галочка снимает саму причину пропуска —
// «кроме вызванных им самим» теперь тоже решает ГМ, отмечая галочку, а не
// код, вычисляющий источник.

const INTO_THE_JAWS_NAMES = ["Into the Jaws of Hell", "В Самое Пекло"];

export function hasIntoTheJawsOfHell(actor) {
  return hasLeadershipTalent(actor, INTO_THE_JAWS_NAMES);
}

/** Есть ли хоть один носитель в мире — только для показа галочки. */
export function anyIntoTheJawsOfHellHolderExists(allActors) {
  return (allActors ?? []).some(hasIntoTheJawsOfHell);
}

/** Авто-успех теста Морали — решение стола уже принято галочкой диалога. */
export function intoTheJawsOfHellActive(checked) {
  return !!checked;
}

// ── Living Legend / Живая Легенда ────────────────────────────────────────────
// Книжный текст: «Персонаж может использовать Inf вместо F во всех механиках
// командования и лидерства, если только его цель не имеет соразмерное Inf
// (начиная с на 10 меньше).» — Command считается от system.skills.command.total
// в ШЕСТИ разных местах (sheets/tabs/command.mjs×2, sheets/squad-sheet.mjs×2,
// combat/command-state.mjs, combat/lord-of-exodites.mjs), и total завязан на
// F в rules/character.mjs — переключать char в каждом звонке технически
// возможно, но рискованно трогать эту расчётную цепочку ради одного Таланта.
// Тот же арифметический итог («как будто считали от Inf») безопаснее получить
// ОДНИМ rollBonus-правилом реестра — разницей Inf−F, а не правкой char;
// действует на всех шести местах разом, раз все они собирают модификаторы
// через ту же цепочку collectTestMods → resolveTest → эта функция.
//
// [фикс 19.10.2026, независимое ревью] Само правило реестра переехало из
// leadershipTalentRules в module/rules/command-substitution.mjs — оно
// конкурирует за один навык с той же подменой у Infernal Master
// (occultist-talents.mjs), и обе складывались при обоих Талантах разом.
// livingLegendCommandBonus здесь — чистый расчёт разницы, не её применение.

const LIVING_LEGEND_NAMES = ["Living Legend", "Живая Легенда"];

export function hasLivingLegend(actor) {
  return hasLeadershipTalent(actor, LIVING_LEGEND_NAMES);
}

function charTotal(actor, key) {
  return Number(actor?.system?.characteristics?.[key]?.total) || 0;
}

/** Соразмерный Inf у цели — не меньше Inf актора −10 («начиная с на 10 меньше»); без цели — не соразмерна. */
function targetHasComparableInf(actor, targetActor) {
  return !!targetActor && charTotal(targetActor, "inf") >= charTotal(actor, "inf") - 10;
}

/** Разница Inf−F для теста Командования — 0, если нет Таланта или цель (ctx.targetActor) соразмерна по Inf. */
export function livingLegendCommandBonus(actor, ctx = {}) {
  if (!hasLivingLegend(actor) || targetHasComparableInf(actor, ctx?.targetActor)) return 0;
  return charTotal(actor, "inf") - charTotal(actor, "fel");
}

// ── War Chant / Боевая Песнь ─────────────────────────────────────────────────
// Книжный текст (сверено заново 19.10.2026, Sahara 3-ac78, core.json): «Лидер
// отряда может в начале своего Хода выбрать распевать боевую песнь: пока он
// это делает, он раздаёт все 3 эффекта Командного Присутствия всем
// подчинённым, что слышат песнь (макс. W.b×2, W.b×20 с Air of Authority), и
// может перебрасывать ВСЕ тесты Морали [СВОИ, не чужие — см. ниже]. Каждый
// подчинённый, получающий Командное Присутствие от песни, может выбрать
// подпевать — тогда он тоже может перебрасывать тесты Морали, а все успешные
// тесты Command против него получают +1 Успех (после лимитов от Риска). За
// каждого поющего подчинённого Лидер получает +3 на Intimidate против
// слышащих. Поющие не могут общаться (и отдавать Команды) устно.»
//
// ИСПРАВЛЕНА ошибка предыдущего прохода: переброс Морали раньше выдавался
// ЛЮБОМУ союзнику в поле зрения поющего командующего — книга даёт его только
// (а) самому Лидеру, пока он поёт, и (б) подчинённому, который сам выбрал
// «подпевать» (свой флаг WAR_CHANT_SING_ALONG_FLAG, галочка на листе любого
// актора — см. actor-sheet.mjs::_warChantSingAlongEntry). Геометрия
// «видит/слышит» снова не формализована (та же честная граница, что у
// Radiant Presence/Into the Jaws of Hell выше) — «подпевать» доступно, пока
// у actor есть хоть один командующий, который сейчас поёт, без проверки
// линии видимости/дистанции (решает стол).
//
// Реализовано этим проходом: переброс Морали (Лидеру и подпевающим), +3
// Intimidate Лидеру за каждого подпевающего подчинённого (rollBonus
// "skill:intimidate" — warChantIntimidateRules).
//
// НЕ реализовано (честно, после проверки):
//  1. «Раздаёт все 3 эффекта Командного Присутствия» — не правило общего
//     реестра (rollBonus/rollMode), а отдельный путь commandNodesFor
//     (combat/command-state.mjs) → effectivePresence (rules/command-
//     effects.mjs:54-63), который умеет такой трюк только для Сознания Стаи
//     (node.pack) по ОТРЯДУ (Squad actor), не по произвольному соседнему
//     актору с Талантом — подключение потребовало бы менять саму
//     commandNodesFor, более глубокая правка, чем правило реестра. Как
//     следствие, лимит получателей W.b×2/×20 тоже не считается — «подпевать»
//     доступно без проверки, попал ли actor в этот лимит.
//  2. «+1 Успех Команде против подпевающего» — сама степень успеха (sux)
//     обычного теста Команды считается не через реестр rollBonus/rollMode
//     (которые правят только Порог/переброс), а напрямую в
//     sheets/squad-sheet.mjs::_executeCommand. Добавлена ТАМ отдельной
//     строкой (warChantSingAlongBonus, после капа от Риска — книжный порядок),
//     не как правило этого файла.
//  3. «Не могут общаться устно» — чистое ролевое ограничение, нечего
//     автоматизировать (нет механики «запрет на устную Команду» как таковой).

const WAR_CHANT_NAMES = ["War Chant", "Боевая Песнь"];
export const WAR_CHANT_FLAG = "warChantSinging";
export const WAR_CHANT_SING_ALONG_FLAG = "warChantSingAlong";

export function hasWarChant(actor) {
  return hasLeadershipTalent(actor, WAR_CHANT_NAMES);
}

function flagOn(actor, key) {
  return !!(actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key]);
}

/** Распевает ли Лидер сейчас (переключатель sheets/squad-sheet.mjs). */
export function warChantSinging(actor) {
  return hasWarChant(actor) && flagOn(actor, WAR_CHANT_FLAG);
}

/** Командующие actor, что сейчас поют (подмножество commandersOf). */
function singingCommandersOf(actor, allActors) {
  return commandersOf(actor, allActors ?? []).filter(warChantSinging);
}

/** Подпевает ли actor сейчас — своя галочка + хоть один поющий командующий. Таланта не требует (книга: любой подчинённый). */
export function warChantSingAlongActive(actor, allActors) {
  return !!actor && flagOn(actor, WAR_CHANT_SING_ALONG_FLAG) && singingCommandersOf(actor, allActors).length > 0;
}

/** Подчинённые leaderActor, что сейчас подпевают именно ЕМУ (для +3 Intimidate). */
function warChantSingersOf(leaderActor, allActors) {
  if (!warChantSinging(leaderActor)) return [];
  return (allActors ?? []).filter(a => a?.uuid && a.uuid !== leaderActor?.uuid
    && flagOn(a, WAR_CHANT_SING_ALONG_FLAG)
    && singingCommandersOf(a, allActors).some(c => c.uuid === leaderActor.uuid));
}

/** +3 Intimidate за каждого подпевающего подчинённого, пока actor сам поёт. */
export function warChantIntimidateBonus(actor, allActors) {
  return 3 * warChantSingersOf(actor, allActors ?? []).length;
}

/** +1 Успех Команде против targetActor, если он сейчас подпевает (применяется ПОСЛЕ капа от Риска — sheets/squad-sheet.mjs::_executeCommand). */
export function warChantSingAlongBonus(targetActor, allActors) {
  return targetActor && warChantSingAlongActive(targetActor, allActors) ? 1 : 0;
}

/** Переброс теста Морали: Лидеру, пока поёт, и подпевающему подчинённому, пока подпевает. */
function warChantMoraleRerollRules(actor, allActors) {
  if (!warChantSinging(actor) && !warChantSingAlongActive(actor, allActors)) return [];
  return [{
    id: "warChant.moraleReroll", label: "Боевая Песнь", when: {},
    effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Боевая Песнь" }]
  }];
}

/** +3 Intimidate Лидеру за каждого подпевающего подчинённого. */
function warChantIntimidateRules(actor, allActors) {
  const bonus = warChantIntimidateBonus(actor, allActors);
  if (bonus <= 0) return [];
  return [{
    id: "warChant.intimidate", label: `Боевая Песнь: +${bonus} Intimidate`, when: {},
    effects: [{ kind: "rollBonus", target: "skill:intimidate", value: bonus, label: "Боевая Песнь" }]
  }];
}

// ── Rally / Сплотить ──────────────────────────────────────────────────────────
// Книжный текст: «Когда у отряда падает Слаженность и Лидер имеет Риск 3+, он
// может за Реакцию пройти Command (W)+0, и при Успехе отряд не теряет
// Слаженность.» Не правило реестра (это не модификатор ЧУЖОГО теста, а целая
// Реакция с собственным броском, перехватывающая клик по кнопке Слаженности)
// — чистое условие доступности здесь, сам диалог/бросок/списание Реакции —
// sheets/squad-sheet.mjs::_rallyAttempt, вызванный из _changeCohesion.

const RALLY_NAMES = ["Rally", "Сплотить"];

export function hasRally(actor) {
  return hasLeadershipTalent(actor, RALLY_NAMES);
}

/** Доступен ли Rally прямо сейчас — у Лидера Талант и Риск Отряда 3+. */
export function rallyAvailable(leaderActor, squadRisk) {
  return hasRally(leaderActor) && Number(squadRisk) >= 3;
}

// ── Field Execution / Полевая Казнь ──────────────────────────────────────────
// Книжный текст: «Когда подчинённый в Шоке/Подавлен/запуган/отступает,
// персонаж может пройти Intimidate(W)+0 vs W+0 против него и при успехе
// атаковать его как Беспомощного. Если атака убивает его или опускает в
// Отрицательные Раны, все остальные подчинённые немедленно выходят из
// Шока/Подавления, сбрасывают запугивание/панику и прекращают отступление.»
//
// «Запуган»/«отступает» — НЕ хранимые состояния системы (сам этот же файл,
// Запугивание, уже решает их исход текстом карточки «решает ГМ», см.
// module/combat/intimidate.mjs::_postIntimidateMsg) — eligibility и снятие
// статусов честно ограничены двумя РЕАЛЬНЫМИ полями, Шоком и Подавлением.
// Сам встречный тест и бросок — module/combat/field-execution.mjs (Intimidate
// характеристикой W вместо обычного F — книжное исключение этого Таланта).

const FIELD_EXECUTION_NAMES = ["Field Execution", "Полевая Казнь"];

export function hasFieldExecution(actor) {
  return hasLeadershipTalent(actor, FIELD_EXECUTION_NAMES);
}

/** Подчинённый сейчас в Шоке или Подавлен — проверяемая половина книжного условия. */
export function fieldExecutionEligible(target) {
  const c = target?.system?.conditions ?? {};
  return !!(c.shocked || c.pinned);
}

// ── Back to Back / Спиной к Спине ────────────────────────────────────────────
// Книжный текст: «Успешно совершив Команду, персонаж может получить Трейт
// Fanatic и дать его до ½F.b (окр.▲) подчинённых до конца боя (или до
// повторного использования). Получивший Fanatic персонаж в базовом контакте
// с целью атаки может раз в Раунд использовать его без траты Реакции.»
//
// Урезанная версия (решение владельца 19.10.2026, bd wdbc-3w7lo): сам Трейт
// Fanatic/Фанатик у этого прохода остался без каркаса «перенаправить атаку
// на себя геометрически» — вместо движения/проверки «встал на пути атаки»
// module/combat/fanatic-redirect.mjs даёт РУЧНУЮ кнопку на карточке
// результата атаки: игрок/ГМ сам решает, достижим ли перехват (как решал бы
// и без кода), кнопка только переносит сам урон на выбранного носителя
// Fanatic. «Раз в Раунд без Реакции» — тоже не отслеживается: перехват не
// привязан к экономике действий в этой версии, решает стол, как и
// достижимость.
//
// Здесь — только опознание Таланта и лимит получателей гранта; сам грант
// (раздача Trait-предмета) и кнопка переноса урона — в
// module/combat/fanatic-redirect.mjs (Foundry-зависимый код, вне rules/).

const BACK_TO_BACK_NAMES = ["Back to Back", "Спиной к Спине"];

export function hasBackToBack(actor) {
  return hasLeadershipTalent(actor, BACK_TO_BACK_NAMES);
}

/** До ½F.b (окр.▲) подчинённых, которым можно дать Fanatic в придачу к самому commander'у. */
export function backToBackGrantCap(actor) {
  return Math.max(0, Math.ceil((Number(actor?.system?.characteristics?.fel?.bonus) || 0) / 2));
}

// ── Источник правил реестра (rules/sources.mjs) ──────────────────────────────

/**
 * Правила Талантов Лидерства для сборки тестов. allActors — только для
 * cross-actor находок (Iron Discipline); пусто вне игры (тесты ядра зовут без
 * третьего параметра) — та же граница, что у rules/adjutant.mjs.
 */
export function leadershipTalentRules(actor, ctx = {}, allActors = []) {
  const rules = [];
  if (hasRancor(actor) && hatredTargetMatches(actor, ctx)) {
    rules.push({
      id: "rancor.command", label: "Злопамятность: Команда против Ненавистной цели",
      when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: 10, label: "Злопамятность" }]
    });
  }
  const eloquenceBonus = eloquenceCommandBonus(actor);
  if (eloquenceBonus > 0) {
    rules.push({
      id: "eloquence.command", label: `Красноречие: +${eloquenceBonus} на Команду`,
      when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: eloquenceBonus, label: "Красноречие" }]
    });
  }
  // Подмена Командования Живой Легендой (Inf вместо F) сюда не входит — она
  // конкурирует с той же заменой у Infernal Master (occultist-talents.mjs) за
  // один навык, и при обоих Талантах разом они СКЛАДЫВАЛИСЬ (фикс 19.10.2026,
  // независимое ревью). Выбор лучшей из двух теперь считает отдельный
  // источник, module/rules/command-substitution.mjs.
  rules.push(...ironDisciplineRerollRules(actor, allActors, ctx));
  rules.push(...frontlineCommanderRerollRules(actor, allActors));
  // Radiant Presence/Блистательное Присутствие: ctx.radiantPresence —
  // галочка диалога теста Морали (Страх/Подавление/Запугивание), не скан
  // сцены. auto:true — галочка САМА и есть подтверждение «видит/слышит»,
  // второй галочки в общем списке модификаторов не нужно.
  const radiantBonus = radiantPresenceBonus(ctx?.radiantPresence);
  if (radiantBonus > 0) {
    rules.push({
      id: "radiantPresence.morale", label: "Блистательное Присутствие", when: {},
      effects: [{ kind: "rollBonus", target: "morale", value: radiantBonus, label: "Блистательное Присутствие", auto: true }]
    });
  }
  rules.push(...warChantMoraleRerollRules(actor, allActors));
  rules.push(...warChantIntimidateRules(actor, allActors));
  return rules;
}
