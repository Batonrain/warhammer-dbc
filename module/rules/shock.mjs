// module/rules/shock.mjs
// ════════════════════════════════════════════════════════════════════════
//  Шок (стр. 53): что делает выпавшая строка таблицы, пока персонаж «В Шоке».
//
//  Раньше строка Шока была только текстом в чате, а Состояние «В Шоке» —
//  голым флагом: штраф −10/−20, запрет действовать и «в первый Ход
//  оправиться нельзя» ГМ держал в голове. Теперь выпавшая строка
//  запоминается на акторе (флаг SHOCK_FLAG), и эти правила читают её:
//    • штраф к тестам — rules/situational.mjs (единый сбор модификаторов);
//    • запрет действовать — combat/action-economy.mjs;
//    • первый Ход и «только вдали от источника» — combat/fear.mjs
//      (напоминание о выходе из Шока).
//  Что строка делает — данные SHOCK_TABLE[].effect (constants/fear-tables.mjs).
//
//  Здесь только чтение, без записи и без Foundry: функции зовутся на каждый
//  тест и на каждую трату ОД.
// ════════════════════════════════════════════════════════════════════════

/** Флаг актора: действующая строка Шока — { penalty, apLock, fleeing, firstTurn }. */
export const SHOCK_FLAG = "shock";
/** Флаг актора: штраф Шока до конца сцены — { value, allTests }. */
export const SHOCK_SCENE_FLAG = "shockScenePenalty";
/** Флаг актора: в следующий Ход только одно Полудействие (строка 1–20). */
export const SHOCK_HALF_ACTION_FLAG = "shockHalfAction";
/** Возможность: машина без свободы воли — Страх и Шок на Int вместо W. */
export const MACHINE_MIND_FLAG = "fear.machineMind";

function flag(actor, key) {
  return actor?.getFlag?.("warhammer-dbc", key) ?? actor?.flags?.["warhammer-dbc"]?.[key];
}

/** Действующая строка Шока, пока персонаж «В Шоке»; иначе null. */
export function activeShock(actor) {
  if (!actor?.system?.conditions?.shocked) return null;
  const s = flag(actor, SHOCK_FLAG);
  return s && typeof s === "object" ? s : null;
}

/**
 * Штраф Шока к тесту этой характеристикой: пока «В Шоке» — штраф строки
 * (кроме T); после выхода — штраф «до конца сцены» (кроме T, если строка не
 * говорит «на все тесты»). Если действуют оба, книга не говорит, складываются
 * ли они; берём более тяжёлый — две строки одной таблицы описывают одно
 * состояние испуга, а не два разных источника.
 */
export function shockPenalty(actor, charKey) {
  const isT = String(charKey ?? "").toLowerCase() === "t";
  const cur = activeShock(actor);
  const live = (!isT && Number(cur?.penalty)) || 0;
  const scene = flag(actor, SHOCK_SCENE_FLAG);
  const sceneVal = (scene && (!isT || scene.allTests)) ? (Number(scene.value) || 0) : 0;
  return Math.min(live, sceneVal, 0);
}

/** Бежит в панике (строка 81–100): штраф −20 без пути к побегу — галочкой. */
export function shockFleeing(actor) {
  return !!activeShock(actor)?.fleeing;
}

/** Замер от ужаса (строка 61–80): не может совершать действий, пока «В Шоке». */
export function shockApLocked(actor) {
  return !!activeShock(actor)?.apLock;
}

/** В следующий Ход только одно Полудействие (строка 1–20). */
export function shockHalfAction(actor) {
  return !!flag(actor, SHOCK_HALF_ACTION_FLAG);
}

/**
 * Что записать на актора по строке таблицы. Чистая функция: вызывающая
 * сторона (combat/fear.mjs) сама кидает кубики сроков и пишет патч.
 * Штраф сцены не ослабляется более лёгкой строкой позже в той же сцене.
 */
export function shockFlagPatch(actor, effect = {}) {
  const patch = {};
  if (effect.shocked) {
    patch[`flags.warhammer-dbc.${SHOCK_FLAG}`] = {
      penalty: Number(effect.penalty) || 0,
      apLock: !!effect.apLock,
      fleeing: !!effect.fleeing,
      firstTurn: effect.noFirstTurn ? "pending" : ""
    };
  }
  if (effect.scenePenalty) {
    const prev = flag(actor, SHOCK_SCENE_FLAG);
    const prevVal = Number(prev?.value) || 0;
    if (effect.scenePenalty < prevVal || !prev) {
      patch[`flags.warhammer-dbc.${SHOCK_SCENE_FLAG}`] = { value: effect.scenePenalty, allTests: !!effect.sceneAllTests };
    } else if (effect.sceneAllTests && !prev.allTests && effect.scenePenalty === prevVal) {
      patch[`flags.warhammer-dbc.${SHOCK_SCENE_FLAG}`] = { value: prevVal, allTests: true };
    }
  }
  if (effect.halfActionNextTurn) patch[`flags.warhammer-dbc.${SHOCK_HALF_ACTION_FLAG}`] = true;
  return patch;
}

/**
 * Можно ли сейчас пытаться оправиться. Возвращает причину отказа или "".
 * Без сознания/Беспомощный тест не проходит — он «не реагирует ни на что».
 */
export function shockRecoveryBlock(actor) {
  const c = actor?.system?.conditions ?? {};
  if (c.unconscious) return "без сознания";
  if (c.helpless) return "беспомощен";
  if (activeShock(actor)?.firstTurn) return "первый Ход Шока — оправиться нельзя";
  return "";
}

