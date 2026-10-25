// module/combat/path-limit.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЛИМИТ ПУТИ ТОКЕНА ЗА ХОД (wdbc-l2urs) — тонкая обвязка хуков Foundry v14
//  поверх чистого правила rules/movement-path.mjs.
//
//  Что делает:
//   1. preMoveToken — токен в начатом бою, на СВОЁМ Ходу, просит перемещение
//      по воле игрока (перетащил/клавиши): считаем итог = уже пройдено за Ход
//      (movement.history.cost, историю пишет и сбрасывает сам Foundry) + этот
//      отрезок (movement.passed.cost) и сверяем с суммой объявленных Действий
//      Движения (Полудвижение/Полное/Натиск/Бег…, combat/movement-actions.mjs::
//      grantMoveAllowance) с потолком Надёжной Поступи Сквата. Не влезает —
//      возвращаем false с уведомлением «Лимит пути исчерпан»: токен остаётся
//      на месте (решение владельца 24.10.2026: БЛОКИРОВАТЬ, не предупреждать).
//   2. moveToken (после перемещения, только у инициатора) — по тому же пути
//      выставляет категорию Хода для Выстрела Навскидку: прошёл дальше
//      Полудвижения → moveDegreeThisTurn="full" (раньше её ставили только
//      кнопки объявления, а сырое перетаскивание мышью — нет).
//
//  Что НЕ блокируется (чтобы не ломать сцену): ГМ (перебор только отмечается
//  уведомлением); перемещение не по воле игрока — Foundry подписывает такое
//  method="api" (телепорт, принудительные сдвиги Роундхауса/Грависта/толчки,
//  перевозки, макросы), "hud", "undo", "paste"; не-свой Ход (Реакции: Фанатик,
//  Отскок…); вне боя; Орда/Техника/Отряд; верховые (идут на скорости скакуна,
//  которой лист всадника не знает); актор с флагом movementLimitOff.
//  Настройка мира movementPathLimit (off/soft/strict) выключает или ужесточает.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { SURE_TREAD, sureTreadWalkCeiling } from "../rules/squat-traits.mjs";
import {
  PATH_LIMIT_SETTING, PATH_LIMIT_DEFAULT, PATH_LIMIT_ACTOR_TYPES, PATH_LIMITED_METHODS,
  MOVE_ALLOWANCE_FLAG, PATH_LIMIT_OFF_FLAG, RAN_METERS_FLAG,
  normalizePathLimitMode, evaluatePath, moveDegreeFromPath, fmtMeters, pathLimitMessage, walkedMeters
} from "../rules/movement-path.mjs";
import { IN_FLIGHT_ALTITUDES, markMoveDegreeThisTurn } from "./movement-actions.mjs";

const NS = "warhammer-dbc";

/** Текущий режим лимита из настройки мира (сбой чтения = умолчание, не «выключено»). */
export function pathLimitMode() {
  try { return normalizePathLimitMode(game.settings.get(NS, PATH_LIMIT_SETTING)); }
  catch { return PATH_LIMIT_DEFAULT; }
}

/** Попадает ли актор под лимит: тип с экономикой и меню Движения, не верхом. */
export function isPathLimitedActor(actor) {
  if (!actor || !PATH_LIMIT_ACTOR_TYPES.includes(actor.type)) return false;
  // Всадник движется со скоростью скакуна (system.mount.speed) — лист всадника
  // её не знает, поэтому лимит вслепую только мешал бы.
  return !actor.system?.mount?.uuid;
}

/** Расход пути отрезка: стоимость ядра, а при бесконечной (непроходимо) — дистанция. */
function pathCost(part) {
  const cost = Number(part?.cost);
  if (Number.isFinite(cost)) return cost;
  const distance = Number(part?.distance);
  return Number.isFinite(distance) ? distance : 0;
}

/** Все пройденные отрезки — телепорт (blink/displace): путь не меряется. */
function isTeleportOnly(movement, actions) {
  const waypoints = movement?.passed?.waypoints ?? [];
  return waypoints.length > 0 && waypoints.every(w => !!actions?.[w.action]?.teleport);
}

/**
 * Сколько метров токен прошёл САМ: уже за Ход (`used`) и просимый отрезок
 * (`step`). Сумму `history.cost` ядра брать нельзя — в ней и телепорт, и
 * сдвиги ГМ-а, и подъём по высоте на месте (ядро считает расстояние в 3D), и
 * удвоенная цена climb/crawl/jump; разбор по отрезкам — rules/movement-path.mjs::
 * walkedMeters. Нет отрезков в movement (старая форма) — запасной путь по
 * итоговой стоимости.
 * @param {{skipGM?:boolean, actions?:object}} o  skipGM — отрезки ГМ-а не едят бюджет игрока
 */
export function measureMovement(movement, { skipGM = false, actions = {} } = {}) {
  const passedWps = movement?.passed?.waypoints;
  const perSegment = Array.isArray(passedWps) && passedWps.some(w => w && w.cost !== undefined);
  if (!perSegment) return { used: pathCost(movement?.history), step: pathCost(movement?.passed) };
  const history = [...(movement.history?.recorded?.waypoints ?? []), ...(movement.history?.unrecorded?.waypoints ?? [])];
  const isGMUser = skipGM ? (id => !!globalThis.game?.users?.get?.(id)?.isGM) : null;
  return {
    used: walkedMeters(history, { isGMUser, actions }),
    step: walkedMeters(passedWps, { start: history.at(-1) ?? movement.origin ?? null, actions })
  };
}

// Токен → ключ Хода, на котором ГМ-у уже сказали о переборе: на пачке NPC
// уведомление на каждое перетаскивание было бы потоком.
const _gmNoticed = new Map();
export function _resetPathLimitNotices() { _gmNoticed.clear(); }
function gmNoticeDue(tokenDoc) {
  const combat = tokenDoc?.combatant?.parent;
  const key = `${combat?.id}:${combat?.round}:${combat?.turn}`;
  if (_gmNoticed.get(tokenDoc.id) === key) return false;
  _gmNoticed.set(tokenDoc.id, key);
  return true;
}

/** Токен в начатом бою: его бой и идёт ли сейчас его Ход. */
function turnState(tokenDoc) {
  const combat = tokenDoc?.combatant?.parent ?? null;
  const started = !!combat?.started;
  return { started, ownTurn: started && combat.combatant?.tokenId === tokenDoc.id };
}

/** Потолок «пешком» для актора: Надёжная Поступь, если он не в полёте. */
function walkCeilingOf(actor) {
  if (!hasRuleFlag(actor, SURE_TREAD)) return Infinity;
  if (IN_FLIGHT_ALTITUDES.includes(actor.system?.movement?.altitude)) return Infinity;
  return sureTreadWalkCeiling(actor.system?.movement);
}

/**
 * Вердикт по просимому перемещению токена. null — токен вне лимита вообще
 * (не тот тип актора, верхом, нет актора).
 * @param {TokenDocument} tokenDoc
 * @param {object} movement  TokenPreMovementOperation
 * @param {{mode?:string, gm?:boolean, actions?:object}} [env]
 */
export function checkPreMove(tokenDoc, movement, env = {}) {
  const actor = tokenDoc?.actor;
  if (!isPathLimitedActor(actor) || !movement) return null;
  const { ownTurn } = turnState(tokenDoc);
  const allowance = actor.getFlag?.(NS, MOVE_ALLOWANCE_FLAG) ?? null;
  const actions = env.actions ?? globalThis.CONFIG?.Token?.movement?.actions;
  const { used, step } = measureMovement(movement, { skipGM: true, actions });
  const verdict = evaluatePath({
    mode: env.mode ?? pathLimitMode(),
    gm: !!env.gm,
    actorOff: !!actor.getFlag?.(NS, PATH_LIMIT_OFF_FLAG),
    method: movement.method,
    teleport: isTeleportOnly(movement, actions),
    recorded: !!movement.recorded,
    ownTurn,
    used,
    step,
    allowance,
    movement: actor.system?.movement,
    // Лист посчитал Движение сам (есть разбор SPD) — нуль у него значит «не может идти».
    speedKnown: Array.isArray(actor.system?.movement?.spdBreakdown),
    ceiling: walkCeilingOf(actor)
  });
  return { ...verdict, allowance, actorName: tokenDoc.name || actor.name };
}

/** Хук preMoveToken: false — перемещение запрещено (лимит пути исчерпан). */
export function onPreMoveToken(tokenDoc, movement) {
  const mode = pathLimitMode();
  if (mode === "off") return;
  const verdict = checkPreMove(tokenDoc, movement, { mode, gm: !!game.user?.isGM });
  if (!verdict?.applies) return;
  if (verdict.gmBypass) {
    // ГМ не блокируется (двигает за игрока, обходит правило намеренно), но
    // перебор не должен проходить молча — иначе ГМ не узнает о нём вовсе.
    if (gmNoticeDue(tokenDoc)) {
      ui.notifications.info(`Лимит пути превышен на ${fmtMeters(verdict.over)} м (${verdict.actorName}) — ГМ, пропущено. Дальше на этом Ходу не напоминаю.`);
    }
    return;
  }
  if (verdict.allowed) return;
  ui.notifications.warn(`⚠️ ${pathLimitMessage(verdict.actorName, verdict, verdict.allowance)}`);
  return false;
}

/**
 * Хук moveToken (после перемещения; у всех клиентов, пишет только инициатор):
 * категория Хода для Выстрела Навскидку по честно пройденному пути.
 */
export async function onMoveToken(tokenDoc, movement, operation, user) {
  if (!user || user.id !== game.user?.id) return;
  if (!PATH_LIMITED_METHODS.includes(movement?.method) || !movement.recorded) return;
  const actor = tokenDoc?.actor;
  if (!isPathLimitedActor(actor)) return;
  if (!turnState(tokenDoc).ownTurn) return;
  // Здесь отрезки ГМ-а не отфильтровываем: ГМ двигает NPC своей рукой, и
  // «подвигался дальше Полудвижения» для Выстрела Навскидку это всё равно.
  const { used, step } = measureMovement(movement, { actions: globalThis.CONFIG?.Token?.movement?.actions });
  const total = used + step;
  if (moveDegreeFromPath(total, actor.system?.movement?.halfMove) === "full") {
    await markMoveDegreeThisTurn(actor, "full");
  }
  // Бегущий: сколько реально пробежал (Скоростная Внимательность, combat/
  // defense.mjs). Ядро стирает историю пути на начале любого Хода, а Реакции
  // на бегущего приходятся на чужие Ходы — поэтому цифра живёт флагом.
  if (actor.getFlag?.(NS, "running")) {
    const ran = Math.round(total * 10) / 10;
    if (ran > (Number(actor.getFlag(NS, RAN_METERS_FLAG)) || 0)) await actor.setFlag(NS, RAN_METERS_FLAG, ran);
  }
}

export function initPathLimitHooks() {
  Hooks.on("preMoveToken", onPreMoveToken);
  Hooks.on("moveToken", onMoveToken);
}
