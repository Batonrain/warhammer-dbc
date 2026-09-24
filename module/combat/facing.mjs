// module/combat/facing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  FACING (wdbc-p5el) — обвязка чистой геометрии rules/facing.mjs под живой
//  Foundry-токен: центр в пиксельных координатах сцены + rotation.
// ════════════════════════════════════════════════════════════════════════════

import { isFrontArcHit as isFrontArcHitPure, bearingDegrees, isWithinMountArc, isWithinArc } from "../rules/facing.mjs";
// tokenDocDistance (wdbc-shr, находка 3): единственное место, где считается
// «пиксели → клетки → игровые единицы сцены» — раньше tokenDistance ниже
// заново реализовывал ТУ ЖЕ формулу (Math.hypot / grid.size × grid.distance)
// вместо того, чтобы позвать уже существующую auras.mjs::tokenDocDistance.
// Два вызывающих контекста разные (тут — живой Token/TokenDocument с canvas
// по умолчанию, там — сырые данные документа + explicit grid для фоновых
// сцен), поэтому обвязка своя, но сама арифметика теперь одна.
import { tokenDocDistance } from "../regions/auras.mjs";

/**
 * Центр токена в пиксельных координатах сцены (не клетках — углу масштаб не
 * важен). Экспортируется отдельно от tokenDistance — Дуга/Выстрел Насквозь
 * (module/combat/arc.mjs, through-shot.mjs, wdbc-wlwf) считают геометрию,
 * которой мало одной дистанции (нужны сами координаты для луча/поиска
 * ближайшего в радиусе).
 */
export function tokenCenter(token) {
  const doc = token?.document ?? token;
  if (!doc) return null;
  const size = canvas?.grid?.size || canvas?.scene?.grid?.size || 100;
  return {
    x: (Number(doc.x) || 0) + ((Number(doc.width)  || 1) * size) / 2,
    y: (Number(doc.y) || 0) + ((Number(doc.height) || 1) * size) / 2
  };
}

/**
 * Разворот токена в градусах (0 = «на север», по часовой) — TokenDocument.rotation.
 * Экспортируется (wdbc-1rno.27, Караул) — модулям, которым нужен разворот
 * стрелка сам по себе, не только внутри isFrontArcHit/isTargetWithinVehicleArc.
 */
export function tokenRotation(token) {
  return Number((token?.document ?? token)?.rotation) || 0;
}

/**
 * Была ли атака на defenderToken нанесена из его передней дуги (Cloak —
 * arcWidthDegrees=90 по умолчанию). Любой из токенов без известной позиции —
 * не фронтальный хит (безопасный дефолт: Плащ защищает, если геометрию
 * посчитать не из чего — не наказываем игрока за отсутствующий токен).
 * @param {Token} defenderToken
 * @param {Token} attackerToken
 * @param {number} [arcWidthDegrees]
 */
export function isFrontArcHit(defenderToken, attackerToken, arcWidthDegrees = 90) {
  const defenderPos = tokenCenter(defenderToken);
  const attackerPos = tokenCenter(attackerToken);
  if (!defenderPos || !attackerPos) return false;
  return isFrontArcHitPure(defenderPos, tokenRotation(defenderToken), attackerPos, arcWidthDegrees);
}

/**
 * Токен атакующего по UUID актора — берёт первый активный токен этого
 * актора на ТЕКУЩЕЙ отображаемой сцене (тот же компромисс, что и в других
 * местах кода при нескольких токенах одного актора: см. armor-mods.mjs
 * getInstalledArmorMods, комментарий про host). null, если не нашёлся —
 * вызывающий сам решает, как трактовать «геометрию посчитать не из чего».
 * @param {string} attackerUuid
 * @returns {Promise<Token|null>}
 */
export async function resolveAttackerToken(attackerUuid) {
  if (!attackerUuid) return null;
  const actor = await fromUuid(attackerUuid).catch(() => null);
  const tokens = actor?.getActiveTokens?.(false, true) ?? [];
  return tokens[0] ?? null;
}

/**
 * Расстояние между центрами двух токенов в игровых единицах сцены (для этой
 * системы — метры), а не в пикселях: пиксельное расстояние делится на
 * canvas.grid.size (px на клетку) и умножается на «сколько единиц в клетке»
 * из настроек СЦЕНЫ (grid.distance) — то же поле, что Foundry показывает в
 * конфигурации сцены как «Grid Distance», а не захардкоженное «1 клетка = 1 м»
 * (wdbc-y33b, Пустотные Щиты — нужна проверка «атака издалека, >5м»).
 *
 * УПРОЩЕНИЕ: считает по прямой (Евклидово), не по правилам диагоналей самого
 * Foundry (5-10-5 и т.п. у сеточных карт) — для порогового «больше X м или
 * нет» разница пренебрежимо мала, а без этого можно не завязываться на точную
 * версию API `canvas.grid.measurePath`.
 *
 * null, если позиция любого токена неизвестна — вызывающий сам решает
 * безопасный дефолт для своего случая (тот же принцип, что у isFrontArcHit/
 * isTargetWithinVehicleArc выше).
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {number|null}
 */
export function tokenDistance(tokenA, tokenB) {
  const docA = tokenA?.document ?? tokenA;
  const docB = tokenB?.document ?? tokenB;
  if (!docA || !docB) return null;
  const gridSize     = canvas?.grid?.size || 100;
  const unitDistance = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  // elevation:0 на обеих сторонах — тот же 2D-компромисс, что был здесь и
  // раньше (см. заголовок функции): tokenDocDistance умеет и высоту, но
  // менять поведение существующих вызывающих (arc.mjs, vehicle.mjs) с 2D на
  // 3D — отдельное решение, не часть этой уборки дублирования.
  return tokenDocDistance(
    { x: Number(docA.x) || 0, y: Number(docA.y) || 0,
      width: Number(docA.width) || 1, height: Number(docA.height) || 1, elevation: 0 },
    { x: Number(docB.x) || 0, y: Number(docB.y) || 0,
      width: Number(docB.width) || 1, height: Number(docB.height) || 1, elevation: 0 },
    { size: gridSize, distance: unitDistance }
  );
}

/**
 * В секторе ли наводки орудия техники цель (wdbc-m38e: vehicleMount.hArc,
 * та же геометрия, что и Cloak, применённая не к броне, а к тому, может ли
 * машина вообще довернуть это орудие на цель). Отсутствующая позиция любого
 * токена — не ограничиваем (тот же безопасный дефолт, что у isFrontArcHit,
 * но в другую сторону: там «нет геометрии» защищает Плащом, здесь «нет
 * геометрии» не мешает выстрелу).
 * @param {Token} vehicleToken
 * @param {string} arcSpec        vehicleMount.hArc (или vArc)
 * @param {Token} targetToken
 */
export function isTargetWithinVehicleArc(vehicleToken, arcSpec, targetToken) {
  const vehiclePos = tokenCenter(vehicleToken);
  const targetPos  = tokenCenter(targetToken);
  if (!vehiclePos || !targetPos) return true;
  return isWithinMountArc(tokenRotation(vehicleToken), bearingDegrees(vehiclePos, targetPos), arcSpec);
}

// ── Скрытная Атака / Sneak Attack (стр. 32, wdbc-1rno.3) ──────────────────────
//
// «Если атакующий весь свой Ход находился вне обзора цели, будь то из-за
// скрытности, невидимости, или просто вне ее поля зрения, эта атака получает
// тип Незримое [...] Обычный персонаж имеет угол обзора (с учетом
// периферийного зрения) в 210°».
//
// Решение чата (wdbc-1rno.3, 20.09.2026): снимок геометрии на МОМЕНТ атаки,
// не слежение за позицией/разворотом защищающегося весь Ход атакующего —
// полная буква правила потребовала бы отдельной подсистемы (буфер пути
// актора по Ходу + перепроверка сектора на каждом шаге), кратно дороже
// одной находки. Тот же уровень приближения, что уже даёт isFrontArcHit у
// Плаща (снимок, не история движения).
//
// Ветка «+30 Врасплох» этого же абзаца («цель вообще не знает о
// возможности атаки») сюда не входит — состояния «знает ли цель о факте
// существования скрытого атакующего» в системе нет нигде (damage.mjs:
// 956-957 — Врасплох остаётся ручной галочкой ГМа в диалоге атаки).
//
// 210° — TokenDocument.sight.angle защищающегося, тот же источник, что
// читает vision-target.mjs у Иконы Богохульства/Взора Неотвратимости
// (ОТДЕЛЬНАЯ функция, не переиспользует isTokenInSight: там незаданный угол
// трактуется как круговой обзор 360° — менять это задним числом означало бы
// незаметно сузить обзор уже двум работающим Дарам, которые на это не
// рассчитаны). Здесь незаданный/дефолтный угол — 210°, через hook ниже,
// который проставляет его КАЖДОМУ новому актору, если он ещё не был задан
// явно иначе (0 или 360 — оба читаются как «Foundry-дефолт, не настроено»,
// тот же принцип, что sightRangeOf в vision-target.mjs). ≥360, заданное
// явно (существо с реально круговым обзором, например Unnatural Senses,
// Конструктор) — никогда не «вне обзора».
export const DEFAULT_SIGHT_ANGLE_DEGREES = 210;

/**
 * Вне поля зрения ли attackerToken у defenderToken — сектор берётся из
 * TokenDocument.sight.angle защищающегося (по умолчанию 210°, см. выше),
 * центрован на его rotation. Любой токен без известной позиции — НЕ вне
 * обзора (безопасный дефолт: не даём Незримое из недостающей геометрии).
 * @param {Token} defenderToken
 * @param {Token} attackerToken
 */
export function isOutsideDefenderView(defenderToken, attackerToken) {
  const defenderPos = tokenCenter(defenderToken);
  const attackerPos = tokenCenter(attackerToken);
  if (!defenderPos || !attackerPos) return false;
  const rawAngle = Number((defenderToken?.document ?? defenderToken)?.sight?.angle);
  if (rawAngle >= 360) return false;
  const angle = rawAngle > 0 ? rawAngle : DEFAULT_SIGHT_ANGLE_DEGREES;
  const bearing = bearingDegrees(defenderPos, attackerPos);
  return !isWithinArc(tokenRotation(defenderToken), bearing, angle);
}

// Решение чата (wdbc-1rno.3): «у токенов уже есть угол обзора — задавать
// всем предзаданный угол 210 системным хуком», а не правкой prototypeToken
// в каждом из сотен акторов packs-src. Необычные существа с реально другими
// чувствами получают отличный от 210° угол отдельной правкой (Конструктор/
// ActiveEffect на самом предмете) в СВОЮ находку — этот хук лишь заполняет
// пустое место, не трогает уже настроенное. Побочный эффект осознан и
// желаем (подтверждено в чате): это меняет и настоящий рендер обзора
// Foundry для акторов, у которых угол раньше не был явно сужен/расширен.
/** Экспортирован отдельно от регистрации — тестируется напрямую, Hooks.on в тестах заглушка (foundry-stub.mjs). */
export function applyDefaultSightAngle(actor, data) {
  const angle = data?.prototypeToken?.sight?.angle ?? actor.prototypeToken?.sight?.angle;
  if (isUnsetSightAngle(angle)) actor.updateSource({ "prototypeToken.sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES });
}

/** Угол не настроен: пусто, 0 или Foundry-дефолт 360. Общий для хука и migrations/sight-angle.mjs. */
export function isUnsetSightAngle(angle) {
  const n = Number(angle);
  return !n || n === 360;
}
Hooks.on("preCreateActor", applyDefaultSightAngle);
