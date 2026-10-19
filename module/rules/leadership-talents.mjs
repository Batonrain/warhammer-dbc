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
//  Air of Authority (частично), Frontline Commander, Protege, Radiant
//  Presence (частично), Into the Jaws of Hell (частично), Living Legend,
//  War Chant (частично), Rally.
//  Не реализованы (bd wdbc-3w7lo — каждому нужна НОВАЯ механика/UI, не
//  довесок): Back to Back (блокирован отсутствующим каркасом у самого
//  Трейта Fanatic), Field Execution (новый опосредованный тест + кнопка
//  казни), Bring It Down! (новый выбор в диалоге Короткой Команды).
//
//  ctx.targetActor Команды/Морали — выделенный на сцене токен или источник
//  угрозы теста в момент броска, тем же приёмом, что Тест Страха
//  (sheets/tabs/disorders.mjs::openFearDialog) и Ненависть (rules/hatred.mjs).
//
//  Геометрия сцены (myToken/tokenDistance/inMeleeContact/isTokenInSight) —
//  СВОИ копии, НЕ импорт из combat/facing.mjs / rules/vision-target.mjs /
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
// tokenDocDistance/isTokenInSight (вторых копий в проекте по возможности
// быть не должно, но здесь это единственный способ не замкнуть круг).

const MELEE_REACH_MULT = 1.5;
const FALLBACK_SIGHT_RANGE_M = 30;

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

/** Дальность обзора наблюдателя — sight.range, иначе приближение «человеческое зрение» (rules/vision-target.mjs::sightRangeOf). */
function sightRangeOf(observerDoc) {
  const range = Number(observerDoc?.sight?.range) || 0;
  return range > 0 ? range : FALLBACK_SIGHT_RANGE_M;
}

/** В поле зрения ли targetToken у observerToken — дальность + сектор (rules/vision-target.mjs::isTokenInSight). */
function isTokenInSight(observerToken, targetToken) {
  const observerDoc = observerToken?.document ?? observerToken, targetDoc = targetToken?.document ?? targetToken;
  if (!observerDoc || !targetDoc) return false;
  const { size } = gridOf();
  const distance = tokenDistance(observerToken, targetToken);
  if (distance == null || distance > sightRangeOf(observerDoc)) return false;

  const angle = Number(observerDoc?.sight?.angle);
  if (!angle || angle >= 360) return true;

  const oc = tokenCenterPx(observerDoc, size), tc = tokenCenterPx(targetDoc, size);
  if (oc.x === tc.x && oc.y === tc.y) return true;

  const toTargetDeg = (Math.atan2(tc.y - oc.y, tc.x - oc.x) * 180 / Math.PI + 360) % 360;
  const facingDeg = (((Number(observerDoc?.rotation) || 0) - 90) % 360 + 360) % 360;
  let diff = Math.abs(toTargetDeg - facingDeg);
  if (diff > 180) diff = 360 - diff;
  return diff <= angle / 2;
}

/** Есть ли у актора Талант этой группы по любой половине двуязычного имени. */
function hasLeadershipTalent(actor, names) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "talent" && names.some(n => itemHasName(i, n)));
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
// получают +10 на тесты Морали, кроме вызванных самим персонажем.» —
// «Видеть» проверяется (rules/vision-target.mjs::isTokenInSight); «слышать»
// книга не даёт радиуса — выдумывать число не стали бы и для остальных
// находок (та же честная граница, что у направления атаки/защиты Ненависти),
// поэтому слух остаётся ручной пометкой ГМа.

const RADIANT_PRESENCE_NAMES = ["Radiant Presence", "Блистательное Присутствие"];

export function hasRadiantPresence(actor) {
  return hasLeadershipTalent(actor, RADIANT_PRESENCE_NAMES);
}

function radiantPresenceHoldersInSight(actor, allActors) {
  const token = myToken(actor);
  if (!token) return [];
  return sceneTokensRelatedTo(token, "ally")
    .filter(t => isTokenInSight(token, t))
    .map(t => t.actor)
    .filter(a => a && hasRadiantPresence(a) && allActors.some(x => x.uuid === a.uuid));
}

function radiantPresenceRules(actor, ctx, allActors) {
  if (typeof canvas === "undefined" || !allActors?.length) return [];
  const sourceUuid = ctx?.targetActor?.uuid ?? null;
  const holders = radiantPresenceHoldersInSight(actor, allActors).filter(a => a.uuid !== sourceUuid);
  if (!holders.length) return [];
  return [{
    id: "radiantPresence.morale", label: "Блистательное Присутствие", when: {},
    effects: [{ kind: "rollBonus", target: "morale", value: 10, label: "Блистательное Присутствие" }]
  }];
}

// ── Into the Jaws of Hell / В Самое Пекло ────────────────────────────────────
// Книжный текст: «Если персонаж сражается рядом с подчинёнными, все они
// автоматически проходят тесты Морали, кроме вызванных им самим.» —
// «рядом» = базовый контакт (как «связан в рукопашной» у Frontline
// Commander/Bodyguard — книжный стандарт дистанции, не придуманное число).
// Авто-успех — не эффект реестра (rollBonus/rollMode туда не ложится), а
// прямая проверка в combat/suppression.mjs и combat/intimidate.mjs рядом с
// их собственным sarcophagus.autoPassFear. combat/fear.mjs СОЗНАТЕЛЬНО не
// трогается: у Теста Страха (sheets/tabs/disorders.mjs::openFearDialog) нет
// надёжного источника угрозы в момент _executeFearRoll (та же граница, что
// у galочки-переброса Ненависти там же, см. заголовок rules/hatred.mjs) —
// исключение «кроме вызванных им самим» нечем проверить, а без него
// авто-успех мог бы молча накрыть и тесты, которые должен был исключить.

const INTO_THE_JAWS_NAMES = ["Into the Jaws of Hell", "В Самое Пекло"];

export function hasIntoTheJawsOfHell(actor) {
  return hasLeadershipTalent(actor, INTO_THE_JAWS_NAMES);
}

/**
 * Авто-успех Подавления/Запугивания для actor — рядом (в базовом контакте)
 * сражается командующий с Into the Jaws of Hell, и этот командующий не сам
 * источник теста (sourceActor).
 */
export function intoTheJawsOfHellActive(actor, allActors, sourceActor = null) {
  if (typeof canvas === "undefined") return false;
  const sourceUuid = sourceActor?.uuid ?? null;
  const commanders = commandersOf(actor, allActors).filter(hasIntoTheJawsOfHell).filter(c => c.uuid !== sourceUuid);
  if (!commanders.length) return false;
  const own = myToken(actor);
  if (!own) return false;
  return commanders.some(c => {
    const cToken = myToken(c);
    return cToken && inMeleeContact(own, cToken);
  });
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
// Книжный текст: «В начале Хода Лидер может распевать боевую песнь: раздаёт
// все 3 эффекта Командного Присутствия всем подчинённым, что слышат песнь
// (макс. W.b×2, W.b×20 с Air of Authority), и может перебрасывать тесты
// Морали. Подпевающий подчинённый тоже перебрасывает Мораль, а успешные
// Command против него получают +1 Успех. За каждого поющего Лидер получает
// +3 на Intimidate против слышащих. Поющие не могут общаться устно.»
//
// Реализовано ТОЛЬКО «может перебрасывать тесты Морали» — переключатель
// «распевает» (actor-флаг, ставится/снимается вручную — книжное «в начале
// Хода» не превращено в авто-тик, Командное Присутствие само по себе уже
// ручной выбор на листе) даёт переброс Морали подчинённым, что «видят»
// Лидера — тот же приём, что Radiant Presence/Блистательное Присутствие
// выше (target "morale", effectAppliesTo сам отбирает тесты Морали).
//
// НЕ реализовано (честно, после проверки): «раздаёт все 3 эффекта
// Командного Присутствия» — это НЕ правило общего реестра (rollBonus/
// rollMode/grantFlag), а отдельный путь commandNodesFor (combat/
// command-state.mjs) → effectivePresence (rules/command-effects.mjs:54-63),
// который уже умеет такой трюк для Сознания Стаи (node.pack), но только
// читая ОТРЯД (Squad actor), а не произвольного ближайшего союзника с
// Талантом — подключить сюда ещё один источник узла потребовало бы менять
// саму commandNodesFor, более глубокая правка, чем это правило реестра.
// Лимит W.b×2/×20 получателей, подпевание (отдельный флаг на каждом
// подчинённом, +1 Успех Команде против него, +3 Intimidate Лидеру за
// каждого поющего, запрет устного общения поющим) — тоже не тронуты,
// отдельная находка на будущий проход.

const WAR_CHANT_NAMES = ["War Chant", "Боевая Песнь"];
export const WAR_CHANT_FLAG = "warChantSinging";

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

/** Поющие Лидеры actor (книга: «подчинённым», не любым союзникам) в поле зрения. */
function warChantLeadersInSight(actor, allActors) {
  const token = myToken(actor);
  if (!token) return [];
  const myCommanders = new Set(commandersOf(actor, allActors).map(c => c.uuid));
  return sceneTokensRelatedTo(token, "ally")
    .filter(t => isTokenInSight(token, t))
    .map(t => t.actor)
    .filter(a => a && myCommanders.has(a.uuid) && warChantSinging(a));
}

function warChantRules(actor, ctx, allActors) {
  if (typeof canvas === "undefined" || !allActors?.length) return [];
  const sourceUuid = ctx?.targetActor?.uuid ?? null;
  if (!warChantLeadersInSight(actor, allActors).some(a => a.uuid !== sourceUuid)) return [];
  return [{
    id: "warChant.moraleReroll", label: "Боевая Песнь", when: {},
    effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Боевая Песнь" }]
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
  const livingLegendBonus = livingLegendCommandBonus(actor, ctx);
  if (livingLegendBonus !== 0) {
    rules.push({
      id: "livingLegend.command",
      label: `Живая Легенда: Inf вместо F (${livingLegendBonus >= 0 ? "+" : ""}${livingLegendBonus})`,
      when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: livingLegendBonus, label: "Живая Легенда" }]
    });
  }
  rules.push(...ironDisciplineRerollRules(actor, allActors, ctx));
  rules.push(...frontlineCommanderRerollRules(actor, allActors));
  rules.push(...radiantPresenceRules(actor, ctx, allActors));
  rules.push(...warChantRules(actor, ctx, allActors));
  return rules;
}
