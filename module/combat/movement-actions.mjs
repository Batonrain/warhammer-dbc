// module/combat/movement-actions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Движение (стр. 28-30), кроме Трудного Ландшафта (движение-terrain.mjs):
//   A. Боевые типы (Полудвижение/Полное/Натиск/Бег/Выход из Боя, стр. 32) —
//      тратят ОД через action-economy.mjs, Бег ставит флаг
//      flags.warhammer-dbc.running, читаемый в module/sheets/attack-dialog.mjs
//      (модификатор атакующим по бегущему) и в action-economy.mjs (блокирует
//      Реакции бегущего). Выход из Боя ставит disengageActive — гасит
//      Свободную Атаку на следующее движение (module/combat/free-attack.mjs,
//      wdbc-2xku), блокируется Вызовом/Challenge (system.conditions.challenged).
//      Все пять также ставят flags.warhammer-dbc.movedThisTurn — тот же флаг
//      ставит и просто перемещение токена по канвасу (initMovedFlagTracking,
//      конец файла), независимо от того, было ли оно объявлено кнопкой отсюда.
//      Читается Импульсным (wp.impulse, attack-dialog.mjs — бонус к очередям
//      удваивается, пока стрелок НЕ двигался). Снимается resetActionEconomy
//      в начале следующего Хода актора (action-economy.mjs) — тот же приём,
//      что у running/exposedAggressive. НЕ путать с system.movedThisTurn на
//      схеме Техники (data/actor/vehicle.mjs) — другое поле, другой владелец,
//      сбрасывается вручную ГМом, сюда отношения не имеет.
//   B. Отдельные механики кнопками (Карабканье/Прыжки/Плавание/Падение/
//      Полёт) — по образцу showDifficultTerrainDialog из movement-terrain.mjs:
//      Dialog + тест 1d100 + чат-карточка исхода.
//   C. Марш/Бег/Форсированный марш вне боя (нарратив) — кумулятивный тест T
//      каждый час (flags.warhammer-dbc.marchFailStreak), провал → addFatigue
//      (module/sheets/tabs/conditions.mjs), побочный флаг marchPPenalty
//      читает marchPenalty() там же (actor-sheet.mjs, _getMarchPenalty).
//  Кнопка Token HUD — initMovementActionsHud(), по образцу
//  initDifficultTerrainHud из movement-terrain.mjs; та же панель — на
//  вкладке БОЙ (templates/actor/parts/tab-combat.hbs, combat.mjs).
// ════════════════════════════════════════════════════════════════════════

import { FAST_MOVE_FLAG } from "../rules/hard-target.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { rollStatLine } from "../helpers/test-card.mjs";
import { spendActionPoints, isEncounterActive } from "./action-economy.mjs";
import { addFatigue, fatiguePenalty, conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { showMovementRing, clearRangeRings } from "./range-rings.mjs";
import { clearRangeCells } from "./range-cells.mjs";
import { showReachableCells } from "./reachable-cells.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { spendRecoil, recoilRemaining } from "./recoil-pool.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { raceMatches } from "../rules/race.mjs";
import { isGrappled } from "../rules/predicates.mjs";
import { grappleMoveAllowed } from "./grapple.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { enemyContactTokenDocs, offerFreeAttack } from "./free-attack.mjs";
import { equippedLegacyWeaponWithMutation } from "../rules/legacy-weapon.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { MELEE_STANCES } from "../constants/combat.mjs";
import { twoHandedTestPenalty, TWO_HANDED_PENALTY_LABEL } from "../rules/hands.mjs";

// Захват (стр. 12, wdbc-x1nz.2.31): «только действия Борьбы или не-Физические»
// — Движение Физическое (см. тип действия «Физическое», стр. 12), поэтому
// каждое боевое объявление движения ниже сначала спрашивает isGrappled.
// Действия Борьбы (Оторваться и т.п.) живут в combat/grapple.mjs и этот гейт
// не проходят — им сюда не заходить.
function _blockedByGrapple(actor, { move = false } = {}) {
  if (!isGrappled(actor)) return false;
  // «Полудвижение и Движение, если его Размер больше цели» — держащему
  // (wdbc-x1nz.2.75); Бег/Натиск/Вольт и прочее — нет.
  if (move && grappleMoveAllowed(actor)) return false;
  ui.notifications.warn("⚠️ В Захвате: доступны только действия Борьбы или не-Физические (стр. 12).");
  return true;
}

// Локус Стремительности (стр. 29, wdbc-smc): бонусное полудействие, которое
// можно потратить ТОЛЬКО на Движение (не на атаку/что-либо ещё) — раз в
// Раунд, тот же троттлинг, что у technique.baseFullAttack (game-session.mjs).
const BONUS_HALF_MOVE_CAPABILITY = "action.bonusHalfMove";

/**
 * Достижимость SPD×N вокруг токена актора — честная подсветка клеток
 * (wdbc-rgi8), а на Gridless сцене (клетки не применимы) резервный круг
 * showMovementRing (M-ступень wdbc-fb2d). Гасит подсветку/кольца дальности
 * атаки (range-cells.mjs/range-rings.mjs), если прицеливание было активно —
 * один активный канвас-оверлей за раз, как и раньше.
 */
function _showReachRing(actor, meters) {
  const token = actor?.getActiveTokens?.(false)?.[0] ?? null;
  if (!token) return;
  clearRangeRings();
  clearRangeCells();
  if (!showReachableCells(token, meters)) showMovementRing(token, meters);
}

const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;

/** Добавляет к сбору collectTestMods штраф «тест двумя руками» (rules/hands.mjs), если он есть. */
function _withTwoHandedPenalty(mods, actor) {
  const value = twoHandedTestPenalty(actor);
  if (!value) return mods;
  return {
    list:  [...mods.list, { label: TWO_HANDED_PENALTY_LABEL, value }],
    total: mods.total + value,
    parts: [...mods.parts, `${TWO_HANDED_PENALTY_LABEL} ${sgn(value)}`]
  };
}

/** Потеря ОБЕИХ ног (стр. 30-31, wdbc-r5o7.5): «не может ходить» — жёсткий запрет, не тест. */
function _bothLegsLost(actor) {
  return (Number(actor.system.conditions?.lostLegsCount) || 0) >= 2;
}

/** Потеря ОБЕИХ стоп: сам факт не блокирует движение, но требует Acrobatics−10 «просто чтобы идти». */
function _bothFeetLost(actor) {
  return (Number(actor.system.conditions?.lostFeetCount) || 0) >= 2;
}

/**
 * Без обеих стоп «персонаж требует броска на Acrobatics–10 просто чтобы
 * ходить, балансируя на обрубках» («Раны и Урон», стр. 43; wdbc-x1nz.2.97
 * п.4). Раньше это был Dialog.confirm «бросок сделан?» и только у части
 * движений — теперь настоящий бросок на КАЖДОМ боевом движении (Полу/Полное/
 * Натиск/Бег/Выход из Боя/Полушаг/свободное Полудвижение Наследия).
 *
 * Порог — тем же приёмом, что Прыжок (_resolveJump): Навык + общий сбор
 * collectTestMods, поэтому штрафы тела доезжают сами — в том числе −20
 * «на все тесты Движения» той же потери стоп (conditions.lostFeetOrLegs,
 * rules/library/conditions.mjs), итого Acrobatics−30 по книге (−10 броска
 * + −20 Движения). _d100 с actor — Помеха после Полного Движения тоже
 * доезжает. Карточка броска — в чат всегда; вызыватель решает, что значит
 * провал для ОД (см. каждое движение ниже).
 *
 * @returns {Promise<boolean>} true — пошёл, false — не удержался
 */
async function _rollWalkOnStumps(actor, moveLabel) {
  const acro = skillTotal(actor, "acrobatics");
  const bodyMods = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = acro - 10 + bodyMods.total;
  const { rv, passed, deg } = await _d100(threshold, actor);
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Удержался на обрубках: ${esc(moveLabel)}.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Не удержал равновесие: ${esc(moveLabel)} не совершено.</span>`;
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run", passed ? "#b0a080" : "#c0392b")}${esc(actor.name)} — Ходьба без обеих стоп</div>
    ${rollStatLine({ label: "Acrobatics", base: acro, parts: ["−10 (без обеих стоп)", ...bodyMods.parts], threshold, rv })}
    <div class="roll-outcome">${outcome}</div>
  </div>`);
  return passed;
}

/**
 * Флаг «двигался в этом Ходу» — ставят и Действия Движения ниже (раздел A),
 * и реальное перемещение токена по канвасу (initMovedFlagTracking, конец
 * файла). Идемпотентно: повторная постановка уже true — без лишнего update.
 */
export async function markMovedThisTurn(actor) {
  if (!actor || actor.getFlag("warhammer-dbc", "movedThisTurn")) return;
  await actor.setFlag("warhammer-dbc", "movedThisTurn", true);
}

/**
 * Категория «сколько подвигался в этом Ходу» — грубее movedThisTurn (тот
 * только boolean), нужна Snapshot/Выстрелу Навскидку (wdbc-1rno,
 * dodge.core.snapshot: «подвигался не больше полудвижения»). "half" —
 * Полудвижение/Выход из Боя (оба SPD×1, одна физическая дистанция несмотря
 * на разную стоимость ОД); "full" — Полное Движение/Бег/Натиск (SPD×2 и
 * больше). Монотонно: однажды поставленное "full" не откатывается назад на
 * "half" в рамках Хода (declareHalfMove после declareFullMove — тот же Ход,
 * дистанция уже была больше половины). Сырое перемещение токена мышью
 * (initMovedFlagTracking ниже) категорию НЕ ставит — как считать её оттуда,
 * не решено, задокументировано как пробел в capabilities.mjs.
 */
export async function markMoveDegreeThisTurn(actor, degree) {
  if (!actor) return;
  const current = actor.getFlag("warhammer-dbc", "moveDegreeThisTurn");
  if (current === "full" || current === degree) return;
  await actor.setFlag("warhammer-dbc", "moveDegreeThisTurn", degree);
}

// Полёт (стр. 30) доступен только актору с Чертой Flyer/Hoverer (module/rules/
// mount.mjs держит тот же список для скакунов/байков — здесь та же проверка,
// но по Чертам самого актора, а не его скакуна).
const FLIGHT_TRAIT_NAMES = ["Flyer", "Летун", "Летающий", "Hoverer", "Парящий"];
const FLYER_TRAIT_NAMES  = ["Flyer", "Летун", "Летающий"];
const FLIGHT_TRAIT_ITEM_TYPES = new Set(["trait", "vehicleTrait"]);

export function actorCanFly(actor) {
  return (actor?.items ?? []).some(item =>
    FLIGHT_TRAIT_ITEM_TYPES.has(item?.type)
    && FLIGHT_TRAIT_NAMES.some(name => itemHasName(item, name)));
}

// Hoverer БЕЗ Flyer поднимается только на Приземную (стр. 30: «Персонажи с
// Трейтом Flyer или Hoverer могут подниматься на Приземную... а Персонажи с
// Трейтом Flyer — перемещаться... на Низкую» и выше) — Низкая/Высокая требуют
// именно Flyer, отдельно от общего гейта actorCanFly выше.
export function actorHasFlyer(actor) {
  return (actor?.items ?? []).some(item =>
    FLIGHT_TRAIT_ITEM_TYPES.has(item?.type)
    && FLYER_TRAIT_NAMES.some(name => itemHasName(item, name)));
}

// Half-Step/Полушаг (Талант, стр. 12, wdbc-9wvm): доступен только с этим
// Талантом — та же проверка присутствия по имени, что у actorCanFly выше.
export function actorHasHalfStep(actor) {
  return hasAbility(actor, "ability.halfStep", "Half-Step", "talent");
}

/** Итог Навыка (с учётом Тренировки) — умолчание на саму характеристику,
 *  если записи Навыка на акторе нет вовсе. Экспортирована — тем же приёмом
 *  пользуется module/combat/assassin-strike.mjs (wdbc-qpcg), чтобы не
 *  дублировать формулу. */
export function skillTotal(actor, key) {
  const sk = actor.system.skills?.[key];
  if (sk?.total != null) return sk.total;
  const charKey = SKILLS_DEF[key]?.char;
  return actor.system.characteristics?.[charKey]?.total ?? 0;
}

/**
 * 1d100 против порога — степень считает общее ядро module/rules/roll-outcome.mjs
 * (wdbc-5dvx). `actor` — необязателен: если задан и на нём висит
 * fullMoveDisadvantage (стр. 28, wdbc-x1nz.2.34 — «после Полного Движения
 * можно ещё полудействие, не Атаку, но его тесты с Помехой»), бросок берёт
 * ХУДШИЙ из двух d100 (та же общая Помеха, что и «Кубик» диалога атаки —
 * rules/reroll-pick.mjs::pickReroll("keepWorst")) и гасит флаг — на большее,
 * чем один следующий тест, книжная Помеха не рассчитана. Прочие вызыватели
 * _d100 (Падение, Марш) actor не передают — их Полное Движение не касается.
 */
async function _d100(threshold, actor = null) {
  let roll = await new Roll("1d100").evaluate();
  let rv = roll.total;
  if (actor?.getFlag?.("warhammer-dbc", "fullMoveDisadvantage")) {
    const roll2 = await new Roll("1d100").evaluate();
    const picked = pickReroll([rv, roll2.total], "keepWorst");
    if (picked.index === 1) { roll = roll2; rv = picked.value; }
    await actor.unsetFlag("warhammer-dbc", "fullMoveDisadvantage");
  }
  const { success: passed, deg } = testOutcome(rv, threshold);
  return { roll, rv, passed, deg };
}

async function _postCard(actor, content) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ════════════════════════════════════════════════════════════════════════
// A. Боевые типы движения (стр. 32)
// ════════════════════════════════════════════════════════════════════════

export async function declareHalfMove(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor, { move: true })) return;
  // Потеря обеих ног (стр. 30-31, wdbc-r5o7.5): «не может ходить» вообще.
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  const useBonus = hasRuleFlag(actor, BONUS_HALF_MOVE_CAPABILITY)
    && isRoundCapabilityAvailable(actor, BONUS_HALF_MOVE_CAPABILITY);
  if (useBonus) {
    await markRoundCapabilityUsed(actor, BONUS_HALF_MOVE_CAPABILITY);
  } else if (!await spendActionPoints(actor, 1, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД.");
  }
  // wdbc-x1nz.2.97 п.4: бросок ПОСЛЕ оплаты — провал съедает действие, как
  // проваленный Прыжок/Карабканье ниже (попытка была, движения нет).
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Полудвижение")) return;
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "half");
  _showReachRing(actor, actor.system.movement?.halfMove);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Полудвижение</div>
    <div class="roll-threshold">${useBonus
      ? "Бонусное полудействие (Локус Стремительности, 0 ОД)."
      : "Полудействие (1 ОД)."} Перемещение до SPD×1.</div>
  </div>`);
}

/**
 * Лучшая Часть Отваги/skilled 5-6, Оружие Наследия, стрелковая ветка
 * (wdbc-1rno.35, стр. 427): «Если выстрел этого оружия не убил и не
 * обезвредил цель, персонаж может совершить Полудвижение за свободное
 * действие.» Кнопка живёт на карточке урона (combat/legacy-weapon-brave-
 * heart.mjs) — «жива и не обезврежена» стол подтверждает самим кликом, тот
 * же честный уровень, что Kiss of Mimic/Silent Elimination (damage.mjs).
 * Без spendActionPoints вовсе — свободное действие, 0 ОД.
 */
export async function declareLegacyBraveHeartMove(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  // Свободное действие — провал броска просто отменяет шаг, ОД не было.
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Полудвижение")) return;
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "half");
  _showReachRing(actor, actor.system.movement?.halfMove);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Лучшая Часть Отваги</div>
    <div class="roll-threshold">Свободное действие (0 ОД) — выстрел не убил и не обезвредил цель. Перемещение до SPD×1.</div>
  </div>`);
}

export async function declareFullMove(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor, { move: true })) return;
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Полное Движение")) return;
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "full");
  // Стр. 28, wdbc-x1nz.2.34: доп. полудействие после Полного Движения (не
  // Атака) — его тест с Помехой. По решению пользователя автоматизировано
  // только для следующего Карабканья/Прыжка/Плавания этого же Хода (они уже
  // проходят через общий _d100(threshold, actor)) — остальные возможные
  // полудействия разбросаны по десяткам разных диалогов, подключать некуда.
  // Флаг гасится первым же использованием _d100 с actor, а на случай, если
  // не потратится вовсе, есть и turn-scoped safety-net (TURN_SCOPED_FLAGS).
  await actor.setFlag("warhammer-dbc", "fullMoveDisadvantage", true);
  _showReachRing(actor, actor.system.movement?.move);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Полное Движение</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×2.</div>
    <div class="roll-threshold" style="font-size:0.85em;">Можно ещё полудействие (не атаку) — но его тесты, если есть, получают Помеху (стр. 32). Для следующего Карабканья/Прыжка/Плавания в этом Ходу — уже автоматически.</div>
  </div>`);
}

export async function declareCharge(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  // Повален (стр. 30-31, wdbc-r5o7.2): «нельзя Бег и Натиск».
  if (actor.system.conditions?.prone)
    return ui.notifications.warn("⚠️ Повален — нельзя объявить Натиск. Сначала встать (Полудействие).");
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  // Стойки с noCharge (стр. 15: Частокол — древковое оружие мешает Натиску;
  // Защитная, wdbc-x1nz.2.66.6 — «не даёт совершать Натиск») — тот же флаг,
  // что уже гейтит пилюлю Базы «Натиск» в диалоге атаки (module/sheets/
  // attack/selection.mjs::computeBaseOptions), здесь для отдельной HUD-кнопки.
  const stanceKey = actor.system?.meleeStance || "standard";
  if (MELEE_STANCES[stanceKey]?.noCharge) {
    return ui.notifications.warn(`⚠️ Недоступно в Стойке «${MELEE_STANCES[stanceKey].label}».`);
  }
  // wdbc-x1nz.2.97 п.4: без обеих стоп — тот же бросок, что у ходьбы. ОД
  // Натиска обычно списываются на броске атаки; раз до атаки дело не дошло,
  // провал списывает их здесь (Полное действие потрачено на попытку — тот же
  // исход, что у проваленных Полудвижения/Бега). База «Натиск» не ставится.
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Натиск")) {
    await spendActionPoints(actor, 2, { physical: true });
    return;
  }
  await actor.update({ "system.meleeBase": "charge",
                       [`flags.warhammer-dbc.${FAST_MOVE_FLAG}`]: true });
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "full");
  _showReachRing(actor, actor.system.movement?.charge);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("sword","#ff9d4d")}${esc(actor.name)} — Натиск</div>
    <div class="roll-threshold">Перемещение до SPD×3 (не менее 4м), заканчивая в контакте с противником.</div>
    <div class="roll-threshold" style="font-size:0.85em;">База «Натиск» выбрана — рукопашный приём +20, 2 ОД спишутся на броске атаки.</div>
  </div>`);
}

/**
 * Выход из Боя (wdbc-2xku): Полное действие, перемещение до SPD×1, не
 * провоцирует Свободную Атаку (module/combat/free-attack.mjs) — ставит разовый
 * флаг disengageActive, гасящий первое же обнаруженное перемещение этого
 * токена. Вызов/Challenge (X) блокирует добровольный выход из рукопашной,
 * пока наложено system.conditions.challenged (снимается по книге — кроме
 * уклонения от атаки по площади, решает ГМ, поэтому подтверждение, а не
 * жёсткий запрет).
 */
export async function declareDisengage(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  if (actor.system.conditions?.challenged) {
    const confirmed = await Dialog.confirm({
      title: "Вызов (Challenge)",
      content: `<p>${esc(actor.name)} под эффектом Вызова: нельзя добровольно выходить из рукопашной, кроме как чтобы увернуться от атаки по площади.</p><p>Это тот самый случай?</p>`
    });
    if (!confirmed) return;
  }
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Выход из Боя")) return;
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "half");
  _showReachRing(actor, actor.system.movement?.halfMove);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Выход из Боя</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×1, не провоцирует Свободную Атаку.</div>
  </div>`);
}

/**
 * Лучшая Часть Отваги/skilled 5-6, Оружие Наследия, рукопашная ветка
 * (wdbc-1rno.35, стр. 427): «Персонаж может пройти тест на Charm+0 vs P+0
 * или Inf+0 vs P+0, чтобы Выйти из Боя за полудействие.» Тот же эффект, что
 * declareDisengage, но 1 ОД вместо 2 — по выигранному встречному тесту
 * против ОДНОГО выбранного противника из контакта (enemyContactTokenDocs,
 * combat/free-attack.mjs — тот же список, что дал бы Свободную Атаку).
 * Тот же двухшаговый приём, что Вольт (_rollVaultContest/wh-vault-contest-
 * btn): свой бросок катается сразу, кнопка на каждого врага в контакте
 * ждёт клика — второй бросок (их Per) и решение случаются по клику
 * (resolveLegacyBraveDisengageContest, hooks.mjs). Charm или Inf — какая
 * выше у актора СЕЙЧАС, книжное «или» не создаёт стратегической разницы,
 * которую стоило бы отдавать отдельным диалогом. Буквально «+0»: без
 * ситуативных модификаторов — книга не просит больше.
 */
export async function declareLegacyBraveDisengage(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  if (actor.system.conditions?.challenged) {
    const confirmed = await Dialog.confirm({
      title: "Вызов (Challenge)",
      content: `<p>${esc(actor.name)} под эффектом Вызова: нельзя добровольно выходить из рукопашной, кроме как чтобы увернуться от атаки по площади.</p><p>Это тот самый случай?</p>`
    });
    if (!confirmed) return;
  }
  // wdbc-x1nz.2.97 п.4: бросок на обрубках — до встречного теста. ОД здесь
  // списываются только при выигранном встречном (resolveLegacyBraveDisengage-
  // Contest), поэтому и провал ходьбы их не трогает — тот же исход, что у
  // проигранного встречного.
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Выход из Боя")) return;

  const felTotal = Number(actor.system?.characteristics?.fel?.total) || 0;
  const infTotal = Number(actor.system?.characteristics?.inf?.total) || 0;
  const charKey = infTotal > felTotal ? "inf" : "fel";
  const charLabel = charKey === "fel" ? "Charm(Fel)" : "Inf";
  const myTotal = Math.max(felTotal, infTotal);
  const myRoll = await new Roll("1d100").evaluate();

  const tokenDoc = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const contacts = tokenDoc ? enemyContactTokenDocs(tokenDoc) : [];
  const contestBtns = contacts.map(en => {
    const enemyActor = en.actor;
    if (!enemyActor) return "";
    return `<button class="wh-legacy-brave-contest-btn" type="button"
      data-actor-uuid="${actor.uuid}" data-enemy-uuid="${enemyActor.uuid}"
      data-char-key="${charKey}" data-my-roll="${myRoll.total}" data-my-total="${myTotal}">
      Встречный тест: ${esc(enemyActor.name)}
    </button>`;
  }).join("");

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Лучшая Часть Отваги</div>
    ${rollStatLine({ label: charLabel, base: myTotal, threshold: myTotal, rv: myRoll.total })}
    <div class="roll-threshold" style="font-size:0.85em;">Выход из Боя за полудействие (1 ОД вместо 2) — выберите противника для встречного теста Per+0.</div>
    ${contestBtns ? `<div class="roll-defense-btns">${contestBtns}</div>`
      : `<div class="roll-threshold" style="font-size:0.85em;">Нет врагов в рукопашной с ним.</div>`}
  </div>`);
}

/** Клик по кнопке встречного теста выше — их бросок Per+0, решение, применение эффекта. */
export async function resolveLegacyBraveDisengageContest(actorUuid, enemyUuid, charKey, myRollTotal, myTotal) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  const enemyActor = await fromUuid(enemyUuid).catch(() => null);
  if (!actor) return ui.notifications.warn("⚠️ Актор не найден.");
  if (!enemyActor) return ui.notifications.warn("⚠️ Противник не найден.");

  const charLabel = charKey === "fel" ? "Charm(Fel)" : "Inf";
  const theirTotal = Number(enemyActor.system?.characteristics?.per?.total) || 0;
  const theirRoll = await new Roll("1d100").evaluate();
  const mine = { ...testOutcome(Number(myRollTotal) || 0, Number(myTotal) || 0), threshold: Number(myTotal) || 0 };
  const theirs = { ...testOutcome(theirRoll.total, theirTotal), threshold: theirTotal };
  const { winner } = resolveOpposed(mine, theirs);

  if (winner !== "mine") {
    return _postCard(actor, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run","#c0392b")}${esc(actor.name)} — Лучшая Часть Отваги (провал)</div>
      <div class="roll-threshold">Против Per+0 ${esc(enemyActor.name)}: <b>${theirRoll.total}</b> vs <b>${theirTotal}</b> — не вышло. Обычный Выход из Боя (2 ОД) всё ещё доступен.</div>
    </div>`);
  }
  if (!await spendActionPoints(actor, 1, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "half");
  _showReachRing(actor, actor.system.movement?.halfMove);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Лучшая Часть Отваги: Выход из Боя</div>
    <div class="roll-threshold">${charLabel}+0 выигран против Per+0 ${esc(enemyActor.name)}: <b>${theirRoll.total}</b> vs <b>${theirTotal}</b>. Полудействие (1 ОД). Перемещение до SPD×1, не провоцирует Свободную Атаку.</div>
  </div>`);
}

/**
 * Глубокий Контакт: переноска раненого/пленного (wdbc-x1nz.2.19, стр. 31) —
 * тумблер flags.warhammer-dbc.deepContactCarry, который free-attack.mjs::
 * processTokenMove читает на КАЖДОМ перемещении этого токена, пока флаг
 * включён (в отличие от disengageActive выше — это НЕ разовый флаг:
 * переноска обычно занимает несколько перемещений подряд, снимается тем же
 * пунктом меню, когда ГМ/игрок решает, что она закончена).
 */
export async function toggleDeepContactCarry(actor) {
  if (!actor) return;
  const active = !!actor.getFlag("warhammer-dbc", "deepContactCarry");
  await actor.setFlag("warhammer-dbc", "deepContactCarry", !active);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Глубокий Контакт</div>
    <div class="roll-threshold">${!active
      ? "Несёт/держит в Глубоком Контакте — движение не провоцирует Свободную Атаку (стр. 31)."
      : "Переноска закончена — движение снова провоцирует Свободную Атаку как обычно."}</div>
  </div>`);
}

export async function declareRun(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  // Повален (стр. 30-31, wdbc-r5o7.2): «нельзя Бег и Натиск».
  if (actor.system.conditions?.prone)
    return ui.notifications.warn("⚠️ Повален — нельзя объявить Бег. Сначала встать (Полудействие).");
  if (_bothLegsLost(actor))
    return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  // Частокол (стр. 15, wdbc-x1nz.2.66.9): «нельзя Натиск и Бег» — noRun несёт
  // только эта Стойка (Защитная запрещает лишь Натиск, см. noCharge выше).
  const runStanceKey = actor.system?.meleeStance || "standard";
  if (MELEE_STANCES[runStanceKey]?.noRun) {
    return ui.notifications.warn(`⚠️ Недоступно в Стойке «${MELEE_STANCES[runStanceKey].label}».`);
  }
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  // wdbc-x1nz.2.97 п.4: Бег без обеих стоп — тот же бросок (раньше не было).
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Бег")) return;
  await actor.setFlag("warhammer-dbc", "running", true);
  await actor.setFlag("warhammer-dbc", FAST_MOVE_FLAG, true);
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "full");
  _showReachRing(actor, actor.system.movement?.run);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Бег</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×6.</div>
    <div class="roll-threshold" style="font-size:0.85em;">До начала следующего Хода: нельзя Реакции, вся Стрельба по персонажу −20, вся Рукопашная по нему +20.</div>
  </div>`);
}

const HALF_STEP_FLAG = "movement.halfStep";

/**
 * Half-Step/Полушаг (стр. 12, wdbc-9wvm): раз в Ход Свободным действием —
 * движение до ½SPD, но пройденная дистанция отнимается от дистанции Отскока
 * в этот Раунд (module/combat/recoil-pool.mjs). Игрок объявляет дистанцию
 * сам (карта вне проекта, см. заголовок recoil.mjs) — не больше ½SPD и не
 * больше остатка пула Отскока; вне боя пул бесконечен, поэтому запрос всегда
 * проходит как есть.
 */
export async function declareHalfStep(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (!actorHasHalfStep(actor)) return ui.notifications.warn("⚠️ Нужен Талант Half-Step/Полушаг.");
  // Без обеих ног «не может ходить» — Полушаг тоже ходьба (wdbc-x1nz.2.97 п.4,
  // заодно с броском на обрубках ниже: раньше Полушаг не проверял ни то, ни другое).
  if (_bothLegsLost(actor)) return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  if (!isThrottleReady(actor, HALF_STEP_FLAG, "round")) {
    return ui.notifications.warn("⚠️ Полушаг уже использован в этом Ходу.");
  }
  const half = Number(actor.system.movement?.halfMove) || 0;
  const maxMeters = Math.min(half / 2, recoilRemaining(actor));
  if (maxMeters <= 0) {
    return ui.notifications.warn("⚠️ Нет остатка дистанции Отскока в этом Раунде — Полушагом двигаться нечем.");
  }
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Полушаг — ${actor.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 300 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-row"><label>Дистанция (м, до ${maxMeters}):</label>
          <input type="number" name="meters" value="${maxMeters}" min="0" max="${maxMeters}" step="1">
        </div>
      </div>`,
    buttons: [
      {
        action: "go", icon: "fas fa-shoe-prints", label: "Полушаг!", default: true,
        callback: (event, button) => Math.max(0, parseInt(button.form.querySelector('[name="meters"]')?.value) || 0)
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (result == null) return;

  // wdbc-x1nz.2.97 п.4: без обеих стоп — бросок на обрубках. Провал тратит
  // раз-в-Ход Полушага (попытка была), но не дистанцию Отскока (не пошёл).
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Полушаг")) {
    await markThrottleUsed(actor, HALF_STEP_FLAG, "round");
    return;
  }
  const spent = await spendRecoil(actor, Math.min(result, maxMeters));
  await markThrottleUsed(actor, HALF_STEP_FLAG, "round");
  await markMovedThisTurn(actor);
  _showReachRing(actor, spent);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Полушаг</div>
    <div class="roll-threshold">Свободное действие. Перемещение на ${spent}м — списано из дистанции Отскока этого Раунда.</div>
  </div>`);
}

// ── Лечь (стр. 30, wdbc-x1nz.2.36) ─────────────────────────────────────────
/**
 * Лечь: Свободное действие — накладывает Состояние «Повален» (стр. 30-31,
 * все его штрафы уже описаны там же, module/constants/conditions.mjs).
 * conditionApplyFields сама спрашивает иммунитет — пустой патч означает
 * «не наложено», предупреждаем честно, а не молча ничего не делаем.
 */
export async function declareProne(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (actor.system.conditions?.prone) return ui.notifications.warn("⚠️ Уже Повален.");
  const fields = conditionApplyFields("prone", null, actor);
  if (!Object.keys(fields).length) return ui.notifications.warn("⚠️ Иммунитет — Состояние «Повален» не наложено.");
  await actor.update(fields);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#9fb4ff")}${esc(actor.name)} — Лечь</div>
    <div class="roll-threshold">Свободное действие. Состояние «Повален» (стр. 30-31).</div>
  </div>`);
}

// ── Встать (стр. 30, wdbc-x1nz.2.36) ────────────────────────────────────────
/**
 * Встать даёт выбор (стр. 30): обычным способом (Полудействие, безусловно)
 * или прыжком (тест Acrobatics(A)+0 — Успех встаёт Свободным действием,
 * Провал даёт всем врагам в рукопашной с ним Свободную Атаку, после чего он
 * всё равно встаёт Полудействием). Диалог здесь только предлагает выбор —
 * сама логика в _standUpPlain/_standUpJump ниже, чтобы обе ветки были
 * проверяемы тестом по отдельности без поднятия настоящего Dialog.
 */
export async function declareStandUp(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (!actor.system.conditions?.prone) return ui.notifications.warn("⚠️ Персонаж не Повален — вставать не с чего.");
  return new Promise(resolve => {
    new Dialog({
      title: `Встать — ${actor.name}`,
      content: `<div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">
        Обычным способом — Полудействие, всегда удаётся.<br/>
        Прыжком — тест Acrobatics(A)+0: Успех встаёт Свободным действием;
        Провал даёт всем врагам в рукопашной с ним Свободную Атаку, но он
        всё равно встаёт (Полудействием), стр. 30.
      </div>`,
      buttons: {
        plain: { label: "Обычным способом (1 ОД)", callback: () => resolve(_standUpPlain(actor)) },
        jump:  { label: "Прыжком (тест Acrobatics)", callback: () => resolve(_standUpJump(actor)) },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "plain"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
  });
}

export async function _standUpPlain(actor) {
  if (!await spendActionPoints(actor, 1, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await actor.update(conditionRemoveFields("prone"));
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#9fb4ff")}${esc(actor.name)} — Встать</div>
    <div class="roll-threshold">Полудействие (1 ОД). Встал обычным способом.</div>
  </div>`);
}

export async function _standUpJump(actor) {
  const acro = skillTotal(actor, "acrobatics");
  const { rv, passed, deg } = await _d100(acro, actor);
  const statLineHtml = rollStatLine({ label: "Acrobatics", base: acro, threshold: acro, rv });

  if (passed) {
    await actor.update(conditionRemoveFields("prone"));
    return _postCard(actor, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run","#9fb4ff")}${esc(actor.name)} — Встать (прыжком)</div>
      ${statLineHtml}
      <div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Вскочил Свободным действием.</span></div>
    </div>`);
  }

  // Провал (стр. 30): все враги в рукопашной с ним получают Свободную Атаку —
  // тот же примитив, что уже даёт «Выход из Боя» (combat/free-attack.mjs),
  // здесь вызван проактивно (не по перемещению токена, а по факту провала).
  const tokenDoc = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  if (tokenDoc) {
    for (const enemyDoc of enemyContactTokenDocs(tokenDoc)) {
      await offerFreeAttack(enemyDoc, tokenDoc);
    }
  }
  if (!await spendActionPoints(actor, 1, { physical: true })) {
    return _postCard(actor, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run","#9fb4ff")}${esc(actor.name)} — Встать (прыжком)</div>
      ${statLineHtml}
      <div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Враги в рукопашной получают Свободную Атаку. ⚠️ Не хватает ОД встать Полудействием — остаётся Повален.</span></div>
    </div>`);
  }
  await actor.update(conditionRemoveFields("prone"));
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#9fb4ff")}${esc(actor.name)} — Встать (прыжком)</div>
    ${statLineHtml}
    <div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Враги в рукопашной получают Свободную Атаку — но встал Полудействием.</span></div>
  </div>`);
}

// ── Вольт (стр. 30, wdbc-x1nz.2.37) ─────────────────────────────────────────
/**
 * Вольт: Полудействие — выходит из Рукопашной без провоцирования обычной
 * Свободной Атаки, испытывая один встречный тест Acrobatics(A)+0 vs WS+0
 * против всех врагов, что иначе получили бы Свободную Атаку. Книга: «он
 * делает один бросок против всех врагов сразу» — читается как «его сторона
 * теста не перебрасывается на каждого врага заново», а не «враги вовсе не
 * бросают»: у каждого своя Степень WS, поэтому карточка даёт каждому врагу
 * СВОЮ кнопку теста WS+0, сравниваемую с уже готовым (фиксированным) броском
 * вольтующего — hooks.mjs::"wh-vault-contest-btn" сравнивает степени.
 */
/**
 * Ядро Вольта — сам встречный тест и кнопки контеста по врагам в контакте.
 * Общее между самостоятельным Вольтом (declareVault, платит 1 ОД сам) и
 * Отскоком из рукопашной (combat/recoil.mjs::rollRecoilVault — «считается
 * Вольтом», wdbc-zik7/wdbc-x1nz.2.40, но БЕЗ своей цены: уже оплачен
 * состоявшимся Уклонением-Реакцией, второй раз не берём).
 */
async function _rollVaultContest(actor) {
  const acro = skillTotal(actor, "acrobatics");
  const { rv, passed, deg } = await _d100(acro, actor);
  const moverScore = passed ? deg : -deg;
  const tokenDoc = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const contacts = tokenDoc ? enemyContactTokenDocs(tokenDoc) : [];
  const contestBtns = contacts.map(en => {
    const enemyActor = en.actor;
    if (!enemyActor) return "";
    return `<button class="wh-vault-contest-btn" type="button"
      data-mover-uuid="${actor.uuid}" data-mover-score="${moverScore}"
      data-enemy-uuid="${enemyActor.uuid}">
      Проверить WS: ${esc(enemyActor.name)}
    </button>`;
  }).join("");
  const statLineHtml = rollStatLine({ label: "Acrobatics", base: acro, threshold: acro, rv });
  const contestSection = contestBtns
    ? `<div class="roll-defense-btns">${contestBtns}</div>`
    : `<div class="roll-threshold" style="font-size:0.85em;">Нет врагов в рукопашной с ним.</div>`;
  return { statLineHtml, contestSection };
}

/**
 * Дальность Вольта (Отскока) в клетках — Пружинящая Стойка (стр. 15,
 * wdbc-x1nz.2.66.8) даёт ей SPD+2 вместо обычного SPD−2 движения. halfMove
 * уже несёт готовый −2 (module/rules/character/movement.mjs — общий для
 * ЛЮБОГО движения), поэтому здесь нужно снять этот минус и прибавить свою
 * книжную +2 — то есть +4 к уже посчитанному halfMove, только для Вольта.
 */
export function vaultHalfMove(actor) {
  const halfMove = actor.system.movement?.halfMove;
  return actor.system?.meleeStance === "springing" ? (Number(halfMove) || 0) + 4 : halfMove;
}

export async function declareVault(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (!await spendActionPoints(actor, 1, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await markMovedThisTurn(actor);
  // Вольт ЗАМЕНЯЕТ Свободную Атаку встречным тестом WS (стр. 30), а не
  // добавляется к ней — тот же разовый глушитель, что ставит «Выход из Боя»
  // (declareDisengage выше) и Натиск-сбивание (bulldoze.mjs). Без него
  // combat/free-attack.mjs::processTokenMove выдаёт тем же врагам ещё и
  // обычную Свободную Атаку, и одно движение наказывается дважды.
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  _showReachRing(actor, vaultHalfMove(actor));
  const { statLineHtml, contestSection } = await _rollVaultContest(actor);

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#8fd0ff")}${esc(actor.name)} — Вольт</div>
    ${statLineHtml}
    <div class="roll-threshold">Полудействие (1 ОД). Выходит из Рукопашной, перемещение до SPD×1 — без обычной Свободной Атаки.</div>
    <div class="roll-threshold" style="font-size:0.85em;">Каждый враг, что мог бы дать Свободную Атаку, проверяет WS+0 против этого броска: Провал — промахивается, Успех — попадает (стр. 30).</div>
    ${contestSection}
  </div>`);
}

/**
 * Отскок из рукопашной «считается Вольтом» (стр. 12, wdbc-zik7, обновлено
 * wdbc-x1nz.2.40 — раньше это было безусловное disengageActive, до того, как
 * появился настоящий Вольт с тестом): та же механика, что у declareVault,
 * но БЕЗ своей цены ОД (уже оплачена состоявшимся Уклонением-Реакцией от
 * стрелковой атаки, вызвавшим сам Отскок) и без Полудвижения/reach-ring —
 * персонаж и так уже переместился Отскоком. Зовётся из combat/recoil.mjs::
 * performRecoil при volt=true.
 */
export async function rollRecoilVault(actor) {
  // Тот же глушитель обычной Свободной Атаки, что в declareVault: до
  // wdbc-x1nz.2.40 его ставил сам performRecoil безусловно, и при переводе
  // Отскока на Вольт он потерялся — Отскок из рукопашной снова стал
  // провоцировать Свободную Атаку сверх встречного теста.
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  const { statLineHtml, contestSection } = await _rollVaultContest(actor);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#8fd0ff")}${esc(actor.name)} — Вольт (через Отскок)</div>
    ${statLineHtml}
    <div class="roll-threshold" style="font-size:0.85em;">Отскок из рукопашной засчитан как Вольт (стр. 12) — свой ОД не берёт, уже оплачен Уклонением.</div>
    <div class="roll-threshold" style="font-size:0.85em;">Каждый враг, что мог бы дать Свободную Атаку, проверяет WS+0 против этого броска: Провал — промахивается, Успех — попадает (стр. 30).</div>
    ${contestSection}
  </div>`);
}

/**
 * Клик врага по кнопке «Проверить WS» карточки Вольта — бросает WS+0 этого
 * врага и сравнивает Степень со СВОЕЙ (уже готовой) Степенью вольтующего.
 * Строго больше — попадает; ничья или меньше — вольтующий уходит.
 */
export async function resolveVaultContestClick(moverUuid, moverScore, enemyUuid) {
  const enemyActor = enemyUuid ? await fromUuid(enemyUuid).catch(() => null) : null;
  if (!enemyActor) return ui.notifications.warn("⚠️ Проверяющий враг не найден.");
  const moverActor = moverUuid ? await fromUuid(moverUuid).catch(() => null) : null;
  const ws = Number(enemyActor.system?.characteristics?.ws?.total) || 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success: passed, deg } = testOutcome(rv, ws);
  const enemyScore = passed ? deg : -deg;
  const hits = enemyScore > moverScore;
  await _postCard(enemyActor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("sword","#ff9d4d")}Вольт — WS ${esc(enemyActor.name)} vs ${esc(moverActor?.name ?? "?")}</div>
    ${rollStatLine({ label: "WS", base: ws, threshold: ws, rv })}
    <div class="roll-outcome">${hits
      ? `<span class="roll-failure">Попадает по вольтующему — Степень ${enemyScore} против ${moverScore}.</span>`
      : `<span class="roll-success">Промахивается — Степень ${enemyScore} против ${moverScore}.</span>`}</div>
  </div>`);
}

// ── Перебежка (стр. 30, wdbc-x1nz.2.38) ─────────────────────────────────────
/**
 * Перебежка: Полное действие, SPD×2, «начинать и заканчивать в укрытии» —
 * в системе нет автоматического определения укрытия/LOS (см. находки
 * wdbc-x1nz «Стрельба требует линии обзора» — то же честное ограничение),
 * поэтому легальность объявляет сам игрок (тот же приём, что «Скрытая
 * атака»/«Цель Врасплох» — галочка на слово, не автоопределение). Даёт
 * бонус укрытия и переброс Избеганий/Подавления до конца Раунда флагом
 * duckAndCoverActive — читают defense.mjs (Уклонение/Парирование) и
 * suppression.mjs, ОБА через один и тот же турн-скоуп флаг ниже.
 */
export async function declareDuckAndCover(actor) {
  if (!actor) return;
  if (_blockedByGrapple(actor)) return;
  if (_bothLegsLost(actor)) return ui.notifications.warn("⚠️ Нет обеих ног — Движение недоступно.");
  const confirmed = await Dialog.confirm({
    title: "Перебежка",
    content: `<p>Персонаж начинает и заканчивает движение в укрытии (стр. 30) — подтвердите: это действительно так?</p>
      <p style="font-size:0.85em;color:#888;">Система не считает укрытие/линию обзора автоматически — решает стол.</p>`
  });
  if (!confirmed) return;
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  if (_bothFeetLost(actor) && !await _rollWalkOnStumps(actor, "Перебежка")) return; // wdbc-x1nz.2.97 п.4
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "full");
  await actor.setFlag("warhammer-dbc", "duckAndCoverActive", true);
  _showReachRing(actor, actor.system.movement?.move);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#9fe8b0")}${esc(actor.name)} — Перебежка</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×2, старт/финиш в укрытии.</div>
    <div class="roll-threshold" style="font-size:0.85em;">До конца Раунда: бонус укрытия, с которого начал, и переброс тестов Избегания/Подавления.</div>
  </div>`);
}

// ════════════════════════════════════════════════════════════════════════
// B. Отдельные механики — кнопками (стр. 29-30)
// ════════════════════════════════════════════════════════════════════════

// ── Карабканье ──────────────────────────────────────────────────────────
export function showClimbDialog(actor) {
  if (!actor) return;
  const ath  = skillTotal(actor, "athletics");
  const acro = skillTotal(actor, "acrobatics");
  const spd  = Number(actor.system.movement?.halfMove) || 0;

  // Бонусы источников со scopeTarget «climbing» (wdbc-egll) — испольщик
  // жмёт "Тест!", а не отдельная галочка: тот же неопросный приём, что и у
  // Усталости в этом же диалоге ниже (не общий диалог Навыка с чекбоксами).
  // Предзаполнено в «Доп. мод», редактируемо — источник виден подписью.
  const climbMods  = resolveTest({ actor, kind: "skill", skill: "athletics", climbing: true }).mods;
  const climbBonus = climbMods.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const climbNote  = climbMods.length
    ? `<div style="font-size:0.82em;color:#8fd0ff;">${climbMods.map(m => `${sgn(m.value)} ${esc(m.label)}`).join(", ")}</div>`
    : "";

  new Dialog({
    title: "Карабканье",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Склон:</label>
          <select id="cl-type">
            <option value="simple">Простой (Athletics+0)</option>
            <option value="sheer">Отвесный (Athletics−10 и Acrobatics+0, оба)</option>
            <option value="rope">Спуск на верёвке (Athletics+10, только вниз)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Athletics (S):</label><input id="cl-ath" type="number" value="${ath}"/></div>
        <div class="atk-dlg-row"><label>Acrobatics (A):</label><input id="cl-acro" type="number" value="${acro}"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="cl-mod" type="number" value="${climbBonus}"/></div>
        ${climbNote}
        <div class="atk-range-info" style="font-size:0.82em;">
          Простой/Отвесный: SPD/2 (${(spd / 2).toFixed(1)}) + Успехи, м. Провал — падение (стр. 29).
          Верёвка: только спуск, 10+3×Успехи м. Нужны верёвка, костыли и молоток (или надёжная опора).
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const type  = html.find("#cl-type").val();
          const athV  = parseInt(html.find("#cl-ath").val()) || 0;
          const acroV = parseInt(html.find("#cl-acro").val()) || 0;
          const md    = parseInt(html.find("#cl-mod").val()) || 0;
          await _resolveClimb(actor, type, athV, acroV, md, spd);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

export async function _resolveClimb(actor, type, ath, acro, mod, spd) {
  // Стр. 29, wdbc-x1nz.2.34: «Карабканье и Прыжки — Полное действие» — раньше
  // тест катился, а ОД не списывались вовсе (действие было фактически бесплатным).
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  let passed, deg, statLineHtml, extraNote = "";
  // Штрафы состояния тела и снаряжения — общим сбором (wdbc-kuun): раньше
  // здесь считалась одна Усталость вручную, а выключенная броня и Перевес
  // инвентаря до Карабканья не доезжали, хотя это физическое действие.
  // Athletics идёт по S, Acrobatics по Ag — сборы разные.
  // wdbc-x1nz.2.97 п.3: Карабканье — тест двумя руками; без кисти/руки −20
  // («Раны и Урон», стр. 43), обоим Пределам отвесного склона тоже.
  const athMods  = _withTwoHandedPenalty(collectTestMods(actor, { kind: "skill", skill: "athletics",  char: "s"  }), actor);
  const acroMods = _withTwoHandedPenalty(collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" }), actor);
  const modsNote = m => (m.parts.length ? ` (${m.parts.join(", ")})` : "");

  if (type === "rope") {
    // Спуск на верёвке (стр. 29): Athletics+10, 10+3×Усп. м. На 1 Провал —
    // спускается только на 5м (без падения). На 2+ Провала — отдельный тест
    // на S+0 (сырая Сила, не навык — тот же приём, что тест T у Марша) или
    // падение со стартовой позиции.
    const threshold = ath + 10 + mod + athMods.total;
    const r = await _d100(threshold, actor);
    statLineHtml = rollStatLine({
      label: "Athletics", base: ath,
      parts: ["+10 (верёвка)", mod ? sgn(mod) : "", ...athMods.parts],
      threshold, rv: r.rv
    });
    passed = r.passed; deg = r.deg;
    let dist, outcomeText;
    if (passed) {
      dist = 10 + 3 * deg;
      outcomeText = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Спустился на ${dist}м.</span>`;
    } else if (deg === 1) {
      dist = 5;
      outcomeText = `<span class="roll-failure">Провал (1 ст.) — спустился только на ${dist}м, не падает.</span>`;
    } else {
      const sTotal = Number(actor.system.characteristics?.s?.total) || 0;
      const sRoll = await new Roll("1d100").evaluate();
      const sHeld = sRoll.total <= sTotal;
      extraNote = `<div class="roll-threshold">S+0 <b>${sTotal}</b> · 1d100: <b>${sRoll.total}</b> — ${sHeld ? "удержался" : "падает со стартовой позиции!"}</div>`;
      outcomeText = sHeld
        ? `<span class="roll-failure">Провал (${deg} ст.) — не продвинулся, но удержался.</span>`
        : `<span class="roll-failure">Провал (${deg} ст.) — падает со стартовой позиции!</span>`;
    }
    await _postCard(actor, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run","#b0a080")}Карабканье (верёвка) — ${esc(actor.name)}</div>
      ${statLineHtml}
      ${extraNote}
      <div class="roll-outcome">${outcomeText}</div>
    </div>`);
    return;
  }

  if (type === "sheer") {
    const athThreshold  = ath - 10 + mod + athMods.total;
    const acroThreshold = acro + mod + acroMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const passA = rv <= athThreshold;
    const passB = rv <= acroThreshold;
    passed = passA && passB;
    const worstDiff = passed
      ? Math.min(athThreshold - rv, acroThreshold - rv)
      : Math.max(rv - athThreshold, rv - acroThreshold);
    deg = Math.floor(Math.abs(worstDiff) / 10) + 1;
    // Два НЕЗАВИСИМЫХ Предела разом (оба должны пройти) — в одну ячейку
    // Порога (wdbc-fyvv) не сводятся: плашка несёт только Бросок, сама
    // пара Пределов — строкой под ней, как раньше.
    statLineHtml = rollStatLine({ rv });
    extraNote = `<div class="roll-threshold">Athletics−10 <b>${athThreshold}</b>${modsNote(athMods)} и Acrobatics <b>${acroThreshold}</b>${modsNote(acroMods)} (оба)</div>`;
  } else {
    const threshold = ath + mod + athMods.total;
    const r = await _d100(threshold, actor);
    passed = r.passed; deg = r.deg;
    statLineHtml = rollStatLine({
      label: "Athletics", base: ath,
      parts: [mod ? sgn(mod) : "", ...athMods.parts],
      threshold, rv: r.rv
    });
  }

  const dist = (spd / 2 + deg).toFixed(1);
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Взобрался на ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж падает!</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}Карабканье — ${esc(actor.name)}</div>
    ${statLineHtml}
    ${extraNote}
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Прыжки ──────────────────────────────────────────────────────────────
const JUMP_FORMULAS = {
  vplace: { label: "Вертикальный с места",   dist: (sb, deg) => sb / 4 },
  vrun:   { label: "Вертикальный с разбега", dist: (sb, deg) => sb / 2 + deg / 2 },
  hplace: { label: "Горизонтальный с места", dist: (sb, deg) => sb + deg / 2 },
  hrun:   { label: "Горизонтальный с разбега", dist: (sb, deg) => sb + deg }
};

export function showJumpDialog(actor) {
  if (!actor) return;
  const acro = skillTotal(actor, "acrobatics");
  const sb   = Number(actor.system.characteristics?.s?.bonus) || 0;

  new Dialog({
    title: "Прыжок",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип:</label>
          <select id="jp-type">
            <option value="vplace">Вертикальный с места (S.b/4)</option>
            <option value="vrun">Вертикальный с разбега (S.b/2+Усп/2)</option>
            <option value="hplace">Горизонтальный с места (S.b+Усп/2)</option>
            <option value="hrun">Горизонтальный с разбега (S.b+Усп)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Разбег:</label>
          <select id="jp-runup">
            <option value="0">Нет / &lt;8м (+0)</option>
            <option value="10">8м (+10)</option>
            <option value="20">12м (+20)</option>
            <option value="30">16м (+30)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Acrobatics (A):</label><input id="jp-acro" type="number" value="${acro}"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="jp-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">Мин. дистанция разбега 4м (стр. 29-30).</div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const type  = html.find("#jp-type").val();
          const runup = parseInt(html.find("#jp-runup").val()) || 0;
          const acroV = parseInt(html.find("#jp-acro").val()) || 0;
          const md    = parseInt(html.find("#jp-mod").val()) || 0;
          await _resolveJump(actor, type, acroV, runup, md, sb);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

export async function _resolveJump(actor, type, acro, runup, mod, sb) {
  // Стр. 29, wdbc-x1nz.2.34: то же самое — Полное действие, ОД раньше не списывались.
  if (!await spendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");
  // Штрафы состояния тела — общим сбором, как у Карабканья выше (wdbc-kuun).
  const bodyMods = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = acro + runup + mod + bodyMods.total;
  const { rv, passed, deg } = await _d100(threshold, actor);
  const f = JUMP_FORMULAS[type];
  const dist = passed ? f.dist(sb, deg).toFixed(1) : 0;
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. ${f.label}: ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Прыжок не удался.</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}Прыжок — ${esc(actor.name)}</div>
    ${rollStatLine({
      label: "Acrobatics", base: acro,
      parts: [runup ? `+${runup} (разбег)` : "", mod ? sgn(mod) : "", ...bodyMods.parts],
      threshold, rv
    })}
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Плавание ────────────────────────────────────────────────────────────
export function showSwimDialog(actor) {
  if (!actor) return;
  const ath = skillTotal(actor, "athletics");
  const sb  = Number(actor.system.characteristics?.s?.bonus) || 0;

  new Dialog({
    title: "Плавание",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Athletics (S):</label><input id="sw-ath" type="number" value="${ath}"/></div>
        <div class="atk-dlg-row"><label><input id="sw-heavy" type="checkbox"/> Тяж. оружие/броня (−30)</label></div>
        <div class="atk-dlg-row"><label><input id="sw-ext" type="checkbox"/> Свыше T.b часов (кумулятивный тест, как марш)</label></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="sw-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Успех — SPD = ½S.b (${(sb / 2).toFixed(1)}м). Провал — не может двигаться (стр. 30).
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const athV = parseInt(html.find("#sw-ath").val()) || 0;
          const heavy = html.find("#sw-heavy").is(":checked");
          const ext   = html.find("#sw-ext").is(":checked");
          const md    = parseInt(html.find("#sw-mod").val()) || 0;
          await _resolveSwim(actor, athV, heavy, ext, md, sb);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

export async function _resolveSwim(actor, ath, heavy, ext, mod, sb) {
  // Плавание НЕ каталогизировано книгой как отдельное действие со своей
  // ценой ОД (стр. 30 говорит только «требует тест», в отличие от явного
  // «Действие: Полное действие» у Карабканья/Прыжка) — ОД здесь намеренно
  // не списываются, это не тот же пробел. Помеха после Полного Движения
  // (wdbc-x1nz.2.34) применяется — пользователь явно включил Плавание в её
  // список, это не требует своей цены действия.
  const bodyMods = collectTestMods(actor, { kind: "skill", skill: "athletics", char: "s" });
  const threshold = ath + (heavy ? -30 : 0) + mod + bodyMods.total;
  const { rv, passed, deg } = await _d100(threshold, actor);
  const dist = passed ? (sb / 2).toFixed(1) : 0;
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Плывёт, SPD ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Не может двигаться.</span>`;

  // Свыше T.b часов (стр. 30): отдельный кумулятивный тест на сырую Т
  // (не Athletics) — не решает, движется ли персонаж (это выше, по
  // Athletics), только копит Усталость за час, как у Марша (_hourlyTest).
  let staminaLine = "";
  if (ext) {
    const t = Number(actor.system.characteristics?.t?.total) || 0;
    const s = await _hourlyTest(actor, { threshold: t, slow: false });
    staminaLine = `<div class="roll-threshold">Выносливость (T${s.streak ? `, −${s.streak * 10} кумулятив` : ""}) <b>${s.effThreshold}</b> · 1d100: <b>${s.rv}</b> — ${s.passed ? "Успех" : "Провал, +1 Усталость"}</div>`;
  }

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#6fe6ff")}Плавание — ${esc(actor.name)}</div>
    ${rollStatLine({
      label: "Athletics", base: ath,
      parts: [heavy ? "− 30 (тяж.)" : "", mod ? sgn(mod) : "", ...bodyMods.parts],
      threshold, rv
    })}
    ${staminaLine}
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Падение и Группирование ────────────────────────────────────────────
/**
 * Breeze/Бриз (Общие Мутации, wdbc-1rno): «полностью игнорирует
 * сопротивление воздуха, терминальная скорость падения не ограничена» —
 * буквально снимает потолок в 25м этой формулы (единственный мех. стенд-ин
 * терминальной скорости в системе — не физическая модель, просто потолок
 * высоты). Обоюдоострый пункт книги: без сопротивления воздуха урон с
 * ОЧЕНЬ большой высоты становится БОЛЬШЕ, не меньше — Мутация, не только
 * благо.
 */
export async function _resolveFallDamage(actor, height, { tuck = false } = {}) {
  const capped = !hasRuleFlag(actor, "mutation.breeze");
  const cappedHeight = capped ? Math.min(height, 25) : height;
  const dmgRoll = await new Roll(`1d10 + ${cappedHeight}`).evaluate();
  let reduction = 0, tuckLine = "", perfectLanding = false;
  if (tuck) {
    const acro = skillTotal(actor, "acrobatics");
    const { rv, passed, deg } = await _d100(acro);
    reduction = passed ? deg : 0;
    // Стр. 30: «Если на Группировании набрано больше Успехов, чем высота
    // падения, персонаж приземляется на ноги и не получает никакого урона» —
    // отдельная гарантия СВЕРХ обычного «−1 урона за успех» чуть выше: не
    // просто вычесть deg из 1d10+высоты (бросок мог бы всё равно дать урон),
    // а обнулить его целиком.
    perfectLanding = passed && deg > height;
    tuckLine = `<div class="roll-threshold">Группирование (Acrobatics ${acro}) · 1d100: <b>${rv}</b> — ${
      passed
        ? (perfectLanding ? `Успех, ${deg} усп. > высоты — приземлился на ноги без урона!` : `Успех, −${deg} урона`)
        : "Провал, без смягчения"}</div>`;
  }
  const finalDmg = perfectLanding ? 0 : Math.max(0, dmgRoll.total - reduction);
  const outcomeText = perfectLanding
    ? `Приземлился на ноги — урон: <b>0</b> I.`
    : `Урон: <b>${finalDmg}</b> I (Impact), броня не учитывается.`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("skull","#ff6b6b")}Падение — ${esc(actor.name)}</div>
    <div class="roll-threshold">Высота <b>${height}</b>м${(capped && height > 25) ? " (ограничено терминальной скоростью 25)" : ""}${(!capped && height > 25) ? " (Бриз: терминальная скорость не ограничена)" : ""} · 1d10+${cappedHeight}: <b>${dmgRoll.total}</b></div>
    ${tuckLine}
    <div class="roll-outcome"><span class="${finalDmg > 0 ? "roll-failure" : "roll-success"}">${outcomeText}</span></div>
  </div>`);
}

export function showFallDialog(actor) {
  if (!actor) return;
  const ab = Number(actor.system.characteristics?.ag?.bonus) || 0;

  new Dialog({
    title: "Падение",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Высота (м):</label><input id="fl-h" type="number" value="3"/></div>
        <div class="atk-dlg-row"><label><input id="fl-tuck" type="checkbox" checked/> Группирование (Acrobatics+0)</label></div>
        <div class="atk-dlg-row"><label><input id="fl-vol" type="checkbox"/> Добровольный прыжок (Acrobatics+0, отдельное полное действие, успех: −A.b=${ab}м)</label></div>
        <div class="atk-range-info" style="font-size:0.82em;">1d10 + высота I Dmg (потолок 25м), броня не учитывается (стр. 30).</div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Урон!",
        callback: async html => {
          let h = parseInt(html.find("#fl-h").val()) || 0;
          const tuck = html.find("#fl-tuck").is(":checked");
          const vol  = html.find("#fl-vol").is(":checked");
          if (vol) {
            const acro = skillTotal(actor, "acrobatics");
            const { passed } = await _d100(acro);
            if (passed) h = Math.max(0, h - ab);
            ui.notifications.info(passed
              ? `Добровольный прыжок удался — высота падения −${ab}м.`
              : `Добровольный прыжок не удался — падение с исходной высоты.`);
          }
          await _resolveFallDamage(actor, h, { tuck });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

// ── Полёт ───────────────────────────────────────────────────────────────
// «landed» — явное «не летит, стоит на земле», а не отсутствие значения:
// раньше диалог подставлял `|| "ground"` только для UI, но нигде не было
// состояния, отличимого от «летит на Приземной высоте» (это давало бы
// автоигнор Трудного Ландшафта пешему персонажу с Чертой Flyer/Hoverer,
// который прямо сейчас не летит вовсе). wdbc-x1nz.2.
const FLIGHT_ALTITUDES = {
  landed: { label: "Не летит (на земле)" },
  ground: { label: "Приземная (до 2м)" },
  low:    { label: "Низкая" },
  high:   { label: "Высокая" }
};

// Высоты, при которых персонаж реально находится в полёте (не «landed») —
// читает и showFlightDialog (гейт Hoverer/Flyer, синхронизация elevation),
// и movement-terrain.mjs (автоигнор Трудного Ландшафта, стр. 30).
export const IN_FLIGHT_ALTITUDES = ["ground", "low", "high"];

// Порядок уровней Высоты (стр. 30) — соседние индексы дают книжную цену
// перехода. landed↔ground — свободное действие, ground↔low — полудействие,
// low↔high — полное действие. «Низкая↔Приземная — также частью Натиска»
// (без доп. цены сверх самого Натиска) НЕ смоделировано — определять «это
// сейчас часть Натиска» негде (Натиск считается на совсем другом пути,
// combat/movement-actions.mjs::declareCharge, момент клика «Установить
// высоту» с ним никак не связан).
const ALTITUDE_ORDER = ["landed", "ground", "low", "high"];
const ALTITUDE_STEP_COST = [0, 1, 2]; // цена шага landed→ground, ground→low, low→high

/**
 * Цена Смены Высоты (стр. 30, wdbc-x1nz.2.34) между соседними уровнями.
 * Прыжок через уровень (landed→low и т.п.) за одно действие книга не даёт —
 * null означает «недопустимо одним действием».
 */
export function _altitudeChangeCost(from, to) {
  const a = ALTITUDE_ORDER.indexOf(from);
  const b = ALTITUDE_ORDER.indexOf(to);
  if (a < 0 || b < 0 || Math.abs(a - b) !== 1) return null;
  return ALTITUDE_STEP_COST[Math.min(a, b)];
}

// TokenDocument#elevation (нативное поле Foundry, метры сцены) синхронизируется
// с игровым тиром высоты — не заменяет сам тир (боевые правила завязаны на
// категорию, не на метраж — книга не даёт числа для границы Низкая/Высокая),
// а даёт честную видимую высоту токена на канвасе своими средствами Foundry.
// НЕ путать с «уровнями» (отдельные этажи/подземелья) — то модуль Levels,
// здесь только Z-координата самого токена, ничего больше.
//
// Приземная — 0, не 2 (хотя книга буквально даёт «до высоты 2м»): в проекте
// УЖЕ есть механика «Положение выше» (module/combat/tactical-map.mjs::
// hasHighGround, +10 в рукопашной) — она сравнивает elevation атакующего и
// цели БЕЗ разбора источника разницы. Книга явно говорит про Приземную «без
// всяких ограничений» — ненулевая elevation тут дала бы летящему на 2м
// незаслуженный авто-бонус «Положение выше» против наземного противника,
// которого книга не обещает. Низкая/Высокая ненулевые (10/25, те же числа,
// что в FLIGHT_LOC_TABLE) — там рукопашная и так блокируется отдельно
// (sheets/attack/mods.mjs), hasHighGround до них не доходит вовсе.
const FLIGHT_ELEVATION_BY_TIER = { landed: 0, ground: 0, low: 10, high: 25 };

async function _syncFlightElevation(actor, alt) {
  const elevation = FLIGHT_ELEVATION_BY_TIER[alt] ?? 0;
  const tokens = actor.getActiveTokens?.(false, true) ?? [];
  for (const tokenDoc of tokens) await tokenDoc.update?.({ elevation });
}

// Высота падения при потере управления (стр. 30) — по высоте полёта и типу
// движения. Это ВЫСОТА (тот же вход, что у обычного Падения), а не готовый
// урон — раньше здесь дублировался укороченный расчёт «Урон: N» напрямую
// из таблицы, без броска 1d10, без потолка терминальной скорости и без
// Группирования. wdbc-x1nz.2.
const FLIGHT_LOC_TABLE = {
  ground: { none: 0,  half: 0,  full: 3,  charge: 6,  run: 9  },
  low:    { none: 10, half: 12, full: 15, charge: 20, run: 25 },
  high:   { none: 25, half: 25, full: 25, charge: 25, run: 25 }
};
const FLIGHT_MOVE_LABELS = {
  none: "Неподвижен", half: "Полудвижение", full: "Полное движение",
  charge: "Натиск", run: "Бег"
};

export function showFlightDialog(actor) {
  if (!actor) return;
  if (!actorCanFly(actor)) {
    return ui.notifications.warn(`${actor.name}: нет Черты Flyer/Hoverer — полёт недоступен.`);
  }
  const hasFlyer = actorHasFlyer(actor);
  const current = actor.system.movement?.altitude || "landed";
  // Hoverer БЕЗ Flyer (стр. 30) — только Приземная/Не летит, Низкая и
  // Высокая из выбора убираются целиком, не просто дизейблятся.
  const availableAlts = hasFlyer
    ? FLIGHT_ALTITUDES
    : { landed: FLIGHT_ALTITUDES.landed, ground: FLIGHT_ALTITUDES.ground };

  new Dialog({
    title: "Полёт",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Высота:</label>
          <select id="fly-alt">
            ${Object.entries(availableAlts).map(([k, v]) =>
              `<option value="${k}" ${k === current ? "selected" : ""}>${v.label}</option>`).join("")}
          </select>
        </div>
        ${!hasFlyer
          ? `<div class="atk-range-info" style="font-size:0.82em;color:#e0a030;">Только Hoverer — доступна лишь Приземная высота, Низкая/Высокая требуют Flyer (стр. 30).</div>`
          : ""}
        <div class="atk-range-info" style="font-size:0.82em;">
          Flyer/Hoverer: Приземная — свободное действие, на ней игнорирует Трудный Ландшафт.
          ${hasFlyer
            ? `Flyer: Приземная↔Низкая — полудействие, Низкая↔Высокая — полное действие,
               Низкая↔Приземная — также частью Натиска. На Низкой — недосягаема рукопашной,
               стрелковое −10, недоступна в помещениях с потолком &lt;5м.`
            : ""}
          Все тесты Acrobatics/Dodge на любой высоте — комбинированные с Operate (Aeronautica)(A),
          теми же модификаторами (стр. 30).
        </div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Потеря управления — высота падения по типу движения (Неподвиж./Полу/Полное/Натиск/Бег),
          дальше как обычное Падение (1d10+высота, Группирование):<br/>
          Приземная 0/0/3/6/9${hasFlyer ? " · Низкая 10/12/15/20/25 · Высокая 25/25/25/25/25" : ""}.
        </div>
      </form>`,
    buttons: {
      set: { icon: '<i class="fas fa-check"></i>', label: "Установить высоту",
        callback: async html => {
          const alt = html.find("#fly-alt").val();
          if ((alt === "low" || alt === "high") && !actorHasFlyer(actor)) {
            return ui.notifications.warn(`${actor.name}: только Hoverer — доступна лишь Приземная высота (стр. 30).`);
          }
          if (alt === current) {
            // Тот же уровень — не Смена Высоты (нет ни ОД, ни движения),
            // только пересинхронизация TokenDocument#elevation на случай рассхождения.
            await actor.update({ "system.movement.altitude": alt });
            return _syncFlightElevation(actor, alt);
          }
          const cost = _altitudeChangeCost(current, alt);
          if (cost === null) {
            return ui.notifications.warn(
              `${actor.name}: за одно действие можно сменить Высоту только на один уровень (стр. 30) — ` +
              "выберите соседний со «" + FLIGHT_ALTITUDES[current].label + "».");
          }
          if (!await spendActionPoints(actor, cost, { physical: true })) {
            return ui.notifications.warn("⚠️ Не хватает ОД.");
          }
          await actor.update({ "system.movement.altitude": alt });
          await _syncFlightElevation(actor, alt);
          _showReachRing(actor, actor.system.movement?.halfMove);
          ui.notifications.info(
            `${actor.name}: высота полёта — ${FLIGHT_ALTITUDES[alt].label} ` +
            `(${cost === 0 ? "свободное действие" : cost === 1 ? "полудействие" : "полное действие"}). Перемещение до SPD×1.`);
        } },
      loc: { icon: '<i class="fas fa-dice-d10"></i>', label: "Потеря управления",
        callback: html => {
          const alt = html.find("#fly-alt").val();
          _showFlightLocDialog(actor, alt);
        } },
      cancel: { label: "Отмена" }
    },
    default: "set"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

function _showFlightLocDialog(actor, alt) {
  new Dialog({
    title: "Потеря управления — тип движения",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип движения:</label>
          <select id="loc-move">
            ${Object.entries(FLIGHT_MOVE_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}
          </select>
        </div>
        <div class="atk-dlg-row"><label><input id="loc-tuck" type="checkbox" checked/> Группирование (Acrobatics+0)</label></div>
      </form>`,
    buttons: {
      ok: { icon: '<i class="fas fa-dice-d10"></i>', label: "Падение!", callback: async html => {
        const move = html.find("#loc-move").val();
        const tuck = html.find("#loc-tuck").is(":checked");
        const height = FLIGHT_LOC_TABLE[alt]?.[move] ?? 0;
        await _resolveFallDamage(actor, height, { tuck });
      } },
      cancel: { label: "Отмена" }
    },
    default: "ok"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

// ════════════════════════════════════════════════════════════════════════
// C. Марш/Бег/Форсированный марш вне боя (стр. 29)
// ════════════════════════════════════════════════════════════════════════

// ── Базовая нарративная скорость (таблица «Движение в нарративном
//    времени», стр. 29) — используется для строки-подсказки над кнопками
//    маршей на вкладке БОЙ (character-context.mjs::movementNarrative).
//    В минуту точно равно SPD×24м на всех строках таблицы, в день точно
//    равно часу×10 на всех строках — обе зависимости подтверждены по
//    книге. Час — НЕ чистая формула (округления автора книги
//    непоследовательны, см. транскрипт сессии), поэтому опорные точки
//    книги ниже + линейная интерполяция между ними, за пределами
//    последней пары — экстраполяция по наклону последнего отрезка.
const NARRATIVE_HOUR_KM_TABLE = [
  [0.5, 1], [1, 2], [2, 3], [3, 4], [4, 6], [5, 7],
  [6, 9], [7, 10], [8, 12], [9, 13], [10, 14]
];

function _narrativeHourKm(spd) {
  const t = NARRATIVE_HOUR_KM_TABLE;
  if (spd <= t[0][0]) return t[0][1] * (spd / t[0][0]);
  for (let i = 1; i < t.length; i++) {
    const [x0, y0] = t[i - 1], [x1, y1] = t[i];
    if (spd <= x1) return y0 + (y1 - y0) * (spd - x0) / (x1 - x0);
  }
  const [x0, y0] = t[t.length - 2], [x1, y1] = t[t.length - 1];
  return y1 + (y1 - y0) / (x1 - x0) * (spd - x1);
}

/** Базовая (×1, неспешный темп) нарративная скорость по SPD — стр. 29, плюс
 *  готовые значения под множители Ускоренного марша (×2, единица — день,
 *  т.к. держится до T.b часов) и Бега (×3, единица — час, т.к. держится
 *  1 час) — ими подписаны кнопки маршей на вкладке БОЙ. */
export function narrativeSpeed(spd) {
  const s = Number(spd) || 0.5;
  const hourKm = _narrativeHourKm(s);
  const perDay = Number((hourKm * 10).toFixed(1));
  return {
    perMinute: Math.round(s * 24),
    perHour: Number(hourKm.toFixed(1)),
    perDay,
    perDayX2: Number((perDay * 2).toFixed(1)),
    perHourX3: Number((hourKm * 3).toFixed(1))
  };
}

/** Общий кумулятивный тест «час за часом» (Марш/Бег/Форс.марш/длит. Плавание):
 *  штраф −10× уже проваленных часов подряд, провал → +1 к счётчику и Усталость. */
async function _hourlyTest(actor, { threshold, slow = false }) {
  const streak = Number(actor.getFlag("warhammer-dbc", "marchFailStreak")) || 0;
  const effThreshold = threshold - 10 * streak;
  const { rv, passed, deg } = await _d100(effThreshold);
  if (!passed) {
    await actor.setFlag("warhammer-dbc", "marchFailStreak", streak + 1);
    await addFatigue(actor, 1, { slow });
  }
  return { rv, passed, deg, effThreshold, streak };
}

const MARCH_KINDS = {
  accelerated: {
    label: "Ускоренный марш", mult: "×2", pPenalty: -10, trackBonus: 10,
    note: "До T.b часов без теста; тест T+0 при превышении, дальше — каждый час, кумулятивно."
  },
  run: {
    label: "Марафонский бег", mult: "×3", pPenalty: -20, trackBonus: 30,
    note: "1 час; тест T каждый час, кумулятивно."
  },
  forced: {
    label: "Форсированный марш", mult: "как обычный марш", pPenalty: 0, trackBonus: 0,
    note: "После обычных 8ч марша; тест T каждый час, кумулятивно. Усталость от него восстанавливается вдвое медленнее."
  }
};

export function showMarchDialog(actor, kind) {
  if (!actor) return;
  const def = MARCH_KINDS[kind];
  if (!def) return;
  const t = Number(actor.system.characteristics?.t?.total) || 0;
  const streak = Number(actor.getFlag("warhammer-dbc", "marchFailStreak")) || 0;
  const active = actor.getFlag("warhammer-dbc", "marchKind") === kind;
  const astartesExempt = kind === "forced" && raceMatches(actor.system, "astartes");

  new Dialog({
    title: def.label,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Toughness (T):</label><input id="mch-t" type="number" value="${t}"/></div>
        <div class="atk-dlg-row"><label>Текущий кумулятив:</label><span>−${streak * 10}</span></div>
        <div class="atk-range-info" style="font-size:0.82em;">${def.note}</div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Скорость ${def.mult}. Побочно: P ${def.pPenalty !== 0 ? sgn(def.pPenalty) : "+0"}${def.trackBonus ? `, тестам обнаружения персонажа +${def.trackBonus}` : ""}.
        </div>
        ${astartesExempt ? `<div class="atk-range-info" style="font-size:0.82em;color:#4dffa6;">Космодесантник: без теста и без Усталости (стр. 29).</div>` : ""}
      </form>`,
    buttons: {
      test: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест часа",
        callback: async html => {
          const tv = parseInt(html.find("#mch-t").val()) || 0;
          if (!active) {
            await actor.setFlag("warhammer-dbc", "marchKind", kind);
            await actor.setFlag("warhammer-dbc", "marchPPenalty", def.pPenalty);
            // Стр. 29: «тесты на его отслеживание или засекание получают
            // бонус» — читает НАБЛЮДАТЕЛЬ через ctx.targetActor (флаг стоит
            // на этом же акторе, целься в него — rules/situational.mjs::
            // marchTrackBonus), не сам маршируюший.
            await actor.setFlag("warhammer-dbc", "marchTrackBonus", def.trackBonus);
          }
          await _resolveMarchHour(actor, def, tv, kind === "forced");
        } },
      stop: { label: "Закончить марш",
        callback: async () => {
          await actor.unsetFlag("warhammer-dbc", "marchKind");
          await actor.unsetFlag("warhammer-dbc", "marchFailStreak");
          await actor.unsetFlag("warhammer-dbc", "marchPPenalty");
          await actor.unsetFlag("warhammer-dbc", "marchTrackBonus");
          ui.notifications.info(`${actor.name}: марш закончен.`);
        } },
      cancel: { label: "Отмена" }
    },
    default: "test"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

export async function _resolveMarchHour(actor, def, t, slow) {
  // Космодесантники (стр. 29): «в силу своей физиологии не имеют этого
  // ограничения и могут маршировать сутки напролёт без каких-либо негативных
  // последствий» — исключение только у Форсированного марша (slow=true,
  // единственный вызывающий с этим флагом, см. showMarchDialog), не у
  // Ускоренного марша/Бега — те штрафуют P и требуют теста ВСЕМ расам одинаково,
  // книга освобождает Астартес именно от «обычный марш длится 8 часов, дальше
  // форсировать», а не от temp/бега вовсе.
  if (slow && raceMatches(actor.system, "astartes")) {
    await _postCard(actor, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run","#b0a080")}${def.label} — ${esc(actor.name)}</div>
      <div class="roll-outcome"><span class="roll-success">Космодесантник — маршируют сутки напролёт без теста и последствий (стр. 29).</span></div>
    </div>`);
    return;
  }
  const { rv, passed, deg, effThreshold, streak } = await _hourlyTest(actor, { threshold: t, slow });
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. +1 Усталость, кумулятив теперь −${(streak + 1) * 10}.</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${def.label} — ${esc(actor.name)}</div>
    ${rollStatLine({
      label: "T", base: t,
      parts: [streak ? `− ${streak * 10} (кумулятив)` : ""],
      threshold: effThreshold, rv
    })}
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ════════════════════════════════════════════════════════════════════════
// Меню — общее для Token HUD, вкладки БОЙ и вкладки «Движение» боевого HUD
// (module/apps/hud.mjs) — один источник списка пунктов на все три места,
// чтобы гейты (isEncounterActive/actorCanFly/actorHasHalfStep) не разъехались.
// ════════════════════════════════════════════════════════════════════════

/**
 * Пункты меню Движения для актора — общие для Dialog (showMovementMenu) и
 * для вкладки «Движение» боевого HUD. action() вызывает ровно то же, что
 * раньше вызывал callback кнопки Dialog.
 */
export function movementMenuItems(actor) {
  const items = [];
  if (isEncounterActive()) {
    items.push({ key: "halfmove", label: "Полудвижение", cost: "1 ОД", action: () => declareHalfMove(actor) });
    items.push({ key: "fullmove", label: "Полное движение", cost: "2 ОД", action: () => declareFullMove(actor) });
    items.push({ key: "charge", label: "Натиск", cost: "", action: () => declareCharge(actor) });
    items.push({ key: "run", label: "Бег", cost: "2 ОД", action: () => declareRun(actor) });
    items.push({ key: "disengage", label: "Выход из Боя", cost: "2 ОД", action: () => declareDisengage(actor) });
    // Лучшая Часть Отваги/skilled 5-6, Оружие Наследия, рукопашная ветка
    // (wdbc-1rno.35, стр. 427) — только при наличии Мутации на экипированном
    // оружии, тот же приём, что actorHasHalfStep ниже.
    if (equippedLegacyWeaponWithMutation(actor, "Лучшая Часть Отваги")) {
      items.push({ key: "legacyBraveDisengage", label: "Выход из Боя (Лучшая Часть Отваги)", cost: "1 ОД, тест",
        action: () => declareLegacyBraveDisengage(actor) });
    }
    items.push({ key: "vault", label: "Вольт", cost: "1 ОД", action: () => declareVault(actor) });
    items.push({ key: "duckAndCover", label: "Перебежка", cost: "2 ОД", action: () => declareDuckAndCover(actor) });
    if (actorHasHalfStep(actor)) {
      items.push({ key: "halfstep", label: "Полушаг", cost: "Талант", action: () => declareHalfStep(actor) });
    }
    // Лечь/Встать (стр. 30, wdbc-x1nz.2.36) — взаимоисключающие по текущему
    // Состоянию «Повален»: лежачему нет смысла предлагать «Лечь», стоящему —
    // «Встать» (тот же приём, что actorHasHalfStep выше — пункт меню виден,
    // только когда применим).
    if (actor.system.conditions?.prone) {
      items.push({ key: "standup", label: "Встать", cost: "", action: () => declareStandUp(actor) });
    } else {
      items.push({ key: "prone", label: "Лечь", cost: "Своб.", action: () => declareProne(actor) });
    }
  }
  items.push({ key: "climb", label: "Карабканье", cost: "", action: () => showClimbDialog(actor) });
  items.push({ key: "jump", label: "Прыжок", cost: "", action: () => showJumpDialog(actor) });
  items.push({ key: "swim", label: "Плавание", cost: "", action: () => showSwimDialog(actor) });
  items.push({ key: "fall", label: "Падение", cost: "", action: () => showFallDialog(actor) });
  items.push({
    key: "deepContactCarry",
    label: actor.getFlag("warhammer-dbc", "deepContactCarry")
      ? "Глубокий Контакт: закончить переноску" : "Глубокий Контакт: несу/держу",
    cost: "",
    action: () => toggleDeepContactCarry(actor)
  });
  if (actorCanFly(actor)) {
    items.push({ key: "fly", label: "Полёт", cost: "", action: () => showFlightDialog(actor) });
  }
  if (!isEncounterActive()) {
    items.push({ key: "marchA", label: "Ускоренный марш", cost: "", action: () => showMarchDialog(actor, "accelerated") });
    items.push({ key: "marchR", label: "Марафонский бег", cost: "", action: () => showMarchDialog(actor, "run") });
    items.push({ key: "marchF", label: "Форсированный марш", cost: "", action: () => showMarchDialog(actor, "forced") });
  }
  return items;
}

export function showMovementMenu(actor) {
  if (!actor) return;
  const buttons = {};
  for (const it of movementMenuItems(actor)) {
    buttons[it.key] = { label: it.cost ? `${it.label} (${it.cost})` : it.label, callback: it.action };
  }
  buttons.cancel = { label: "Закрыть" };

  new Dialog({
    title: "Движение",
    content: `<div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">Выберите действие (стр. 28-30).</div>`,
    buttons,
    default: "cancel"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 320 }).render(true);
}

// Токены техники/Орды/Отряда/Формации не участвуют в этом разделе —
// у них своя механика движения (module/combat/vehicle.mjs и т.п.).
const MOVEMENT_MENU_EXCLUDED_TYPES = ["vehicle", "ship", "horde", "squad", "formation", "starSystem"];

export function initMovementActionsHud() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const tokenDoc = hud.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor || MOVEMENT_MENU_EXCLUDED_TYPES.includes(actor.type)) return;

    const isGM = game.user.isGM;
    const owns = actor.isOwner;
    if (!isGM && !owns) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-movement-btn")) return;   // без дублей при перерисовке

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-movement-btn";
    btn.dataset.action = "whMovement";
    btn.title = "Движение (стр. 28-30)";
    btn.innerHTML = `<i class="fas fa-person-running"></i>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      showMovementMenu(actor);
    });
    col.appendChild(btn);
  });
}

// ════════════════════════════════════════════════════════════════════════
// Флаг «двигался в этом Ходу» от РЕАЛЬНОГО перемещения токена по канвасу —
// не только от кнопок раздела A выше (drag мышью, macro, любой чужой код,
// меняющий x/y). Тот же приём обнаружения, что у Свободной Атаки
// (module/combat/free-attack.mjs, movesPosition/preUpdateToken), но здесь
// не нужен «before» контактов — только сам факт смещения. Отдельная
// подписка на updateToken, а не довесок к initFreeAttackHooks — система
// уже держит несколько независимых updateToken/updateCombat обработчиков
// под разные задачи, не смешивая их в одну функцию (см. те же зоны Ord/
// graviton, экономику действий в hooks.mjs).
function _movesPosition(changes) {
  return Object.prototype.hasOwnProperty.call(changes, "x")
      || Object.prototype.hasOwnProperty.call(changes, "y");
}

export function initMovedFlagTracking() {
  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    // Только клиент-инициатор перемещения — иначе флаг попытались бы
    // выставить с каждого подключённого клиента разом (тот же приём, что у
    // free-attack.mjs).
    if (userId !== game.user.id) return;
    if (!_movesPosition(changes)) return;
    const actor = tokenDoc.actor;
    if (!actor || MOVEMENT_MENU_EXCLUDED_TYPES.includes(actor.type)) return;
    await markMovedThisTurn(actor);
  });
}
