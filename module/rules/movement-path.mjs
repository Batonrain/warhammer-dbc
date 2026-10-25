// module/rules/movement-path.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИЗМЕРИТЕЛЬ ПУТИ ТОКЕНА ЗА ХОД — чистая арифметика лимита (wdbc-l2urs).
//
//  Раньше система знала про движение токена только булево «двигался»
//  (flags.warhammer-dbc.movedThisTurn) и верила игроку на слово, сколько он
//  прошёл. Потолок Надёжной Поступи Сквата («не более 3×SPD пешком в Ход»)
//  лишь урезал Бег до Натиска на листе, а перетащить токен можно было куда
//  угодно.
//
//  САМ ПУТЬ МЕРЯЕТ ЯДРО FOUNDRY v14, не мы. Токен в начатом бою пишет историю
//  перемещений (TokenDocument#movementHistory; её же ядро чистит на начале
//  КАЖДОГО Хода — Combat#_clearMovementHistoryOnStartTurn), а хук preMoveToken
//  отдаёт готовые `movement.history.cost` (сколько уже пройдено за Ход) и
//  `movement.passed.cost` (шаг, который сейчас просят). Диагонали, гексы и
//  Gridless считает сетка сцены (в проекте — 1,5 м на диагональ, стр. 31); тут
//  своей геометрии нет и быть не должно. Здесь только то, что ядро решить не
//  может: сколько ЭТОМУ персонажу разрешено и когда лимит вообще действует.
//
//  Лимит за Ход = сумма дистанций объявленных Действий Движения (Полудвижение
//  SPD×1 + Полное SPD×2 + …; каждое объявление дописывает запись, см.
//  combat/movement-actions.mjs::grantMoveAllowance), урезанная потолком
//  Надёжной Поступи. Ничего не объявлено — по умолчанию Полудвижение (режим
//  soft) либо ходить нельзя (strict); решение владельца 24.10.2026: ПОЛИТИКА —
//  БЛОКИРОВАТЬ, а не предупреждать.
//
//  Чистый модуль: ни одного обращения к Foundry.
// ════════════════════════════════════════════════════════════════════════════

/** Ключ мировой настройки (регистрируется в warhammer-dbc.mjs). */
export const PATH_LIMIT_SETTING = "movementPathLimit";

/**
 * off    — лимита нет вовсе;
 * soft   — лимит в бою; пока Движение не объявлено, доступно Полудвижение;
 * strict — лимит в бою; без объявленного Движения ходить нельзя.
 */
export const PATH_LIMIT_MODES = Object.freeze(["off", "soft", "strict"]);
export const PATH_LIMIT_DEFAULT = "soft";

/**
 * Типы акторов, у которых есть и экономика действий, и меню Движения (кнопки
 * объявления). Орда/Техника/Отряд/Формация/Корабль движутся по своим правилам
 * (combat/vehicle.mjs и т.п.) — их лимит не касается.
 */
export const PATH_LIMIT_ACTOR_TYPES = Object.freeze(["character", "daemon", "demonPrince", "minion"]);

/**
 * Какие способы перемещения — «по воле игрока». Foundry сам подписывает
 * перемещение (movement.method): dragging — перетащил мышью, keyboard —
 * клавиши; всё прочее (api — скрипты и ВСЕ принудительные сдвиги системы:
 * Роундхаус, Гравист, толчки, перевозки; hud, undo, paste, config) лимитом
 * не стопорится — токен не по своей воле двигаться обязан.
 */
export const PATH_LIMITED_METHODS = Object.freeze(["dragging", "keyboard"]);

/** Допуск на дробный шум сетки (диагонали 1,5 м), метры. */
export const PATH_EPS = 0.01;

/** Флаг актора с записью объявленных Движений этого Хода (гасит реестр turn-flags.mjs). */
export const MOVE_ALLOWANCE_FLAG = "moveAllowanceThisTurn";

/** Флаг актора «без лимита пути» (ГМ: особые случаи, сломавшаяся история). */
export const PATH_LIMIT_OFF_FLAG = "movementLimitOff";

/**
 * Флаг актора: сколько метров он реально пробежал (токен перетаскивали при
 * флаге «бежит»). История ядра стирается на начале ЛЮБОГО Хода, а Реакции на
 * бегущего (Скоростная Внимательность) приходятся уже на чужие Ходы — поэтому
 * цифру приходится держать флагом до начала своего следующего Хода.
 */
export const RAN_METERS_FLAG = "ranMetersThisTurn";

/** Подписи видов объявленных Движений — для сообщения о блоке. */
export const MOVE_KIND_LABELS = Object.freeze({
  half:        "Полудвижение",
  full:        "Полное Движение",
  charge:      "Натиск",
  run:         "Бег",
  disengage:   "Выход из Боя",
  vault:       "Вольт",
  duck:        "Перебежка",
  halfStep:    "Полушаг",
  breach:      "Прорыв",
  braveHeart:  "Лучшая Часть Отваги",
  reposition:  "Смена Позиции",
  jump:        "Прыжок",
  climb:       "Карабканье",
  swim:        "Плавание",
  altitude:    "Смена Высоты",
  assassin:    "Удар Ассасина",
  scanning:    "Сканирующее Продвижение",
  overpower:   "Пересилить",
  press:       "Давление"
});

const finite = n => (Number.isFinite(Number(n)) ? Number(n) : 0);

/** Строка настройки → один из режимов; неизвестное не отключает лимит молча. */
export function normalizePathLimitMode(raw) {
  return PATH_LIMIT_MODES.includes(raw) ? raw : PATH_LIMIT_DEFAULT;
}

// ── Запись объявленных Движений ─────────────────────────────────────────────

export function emptyAllowance() {
  return { total: 0, entries: [] };
}

/** Значение флага → корректная запись (битое/чужое превращается в пустую). */
export function readAllowance(raw) {
  if (!raw || typeof raw !== "object") return emptyAllowance();
  const entries = Array.isArray(raw.entries)
    ? raw.entries.filter(e => e && Number(e.meters) > 0).map(e => ({ kind: String(e.kind), meters: Number(e.meters) }))
    : [];
  return { total: Math.max(0, finite(raw.total)), entries };
}

/** Дописать объявленное Движение. Не мутирует; мусорная дистанция запись не меняет. */
export function addAllowance(record, kind, meters) {
  const rec = readAllowance(record);
  const m = Number(meters);
  if (!Number.isFinite(m) || m <= 0) return record && typeof record === "object" && record.entries ? record : rec;
  return { total: rec.total + m, entries: [...rec.entries, { kind: String(kind), meters: m }] };
}

/**
 * Дописать объявленное Движение в бюджет пути актора. Лежит здесь, а не в
 * combat/movement-actions.mjs, чтобы любое Действие с движением (Удар
 * Ассасина, Пересилить, Караул…) могло записать свою дистанцию, не втягивая
 * в импорт весь модуль Движений. Foundry не трогает — только методы актора.
 * Звать ПОСЛЕ того, как Движение состоялось (ОД списаны, броски пройдены).
 * @param {string} kind    вид (ключ MOVE_KIND_LABELS)
 * @param {number} meters  дистанция действия в метрах
 */
export async function grantMoveAllowance(actor, kind, meters) {
  if (!actor || typeof actor.setFlag !== "function" || !(Number(meters) > 0)) return;
  const next = addAllowance(actor.getFlag?.("warhammer-dbc", MOVE_ALLOWANCE_FLAG), kind, meters);
  await actor.setFlag("warhammer-dbc", MOVE_ALLOWANCE_FLAG, next);
}

// ── Измерение пройденного по отрезкам ядра ──────────────────────────────────

const samePoint = (a, b) => Math.abs((a?.x ?? 0) - (b?.x ?? 0)) < 0.5 && Math.abs((a?.y ?? 0) - (b?.y ?? 0)) < 0.5;

/**
 * Сколько метров пути токен прошёл САМ. Ядро пишет в историю каждый отрезок
 * (waypoint.cost — стоимость от прошлой точки), но в сумме `history.cost` лежит
 * всё подряд, а лимиту нужно только то, что игрок прошёл ногами:
 *  - отрезки, сделанные ГМ-ом (`isGMUser(userId)`), не едят бюджет игрока;
 *  - телепорт (blink/displace) — не путь;
 *  - чистое изменение высоты на месте (Смена Высоты Летуна, HUD) — не путь
 *    по земле: ядро считает расстояние в 3D, и подъём на 10 м иначе съел бы
 *    10 м бюджета;
 *  - действия ядра с наценкой (climb/crawl/jump — costMultiplier 2) приводятся
 *    обратно к метрам: Карабканье записывает бюджет в метрах дальности броска.
 * @param {Array}  waypoints  отрезки (TokenMeasuredMovementWaypoint)
 * @param {object} [o]
 * @param {object} [o.start]       точка, от которой считается первый отрезок
 *   (иначе первая точка списка — она сама отрезка не даёт)
 * @param {Function} [o.isGMUser]  userId → true для ГМ-а; не задан — не фильтруем
 * @param {object} [o.actions]     CONFIG.Token.movement.actions (teleport, costMultiplier)
 */
export function walkedMeters(waypoints, { start = null, isGMUser = null, actions = {} } = {}) {
  const list = Array.isArray(waypoints) ? waypoints : [];
  let prev = start ?? list[0] ?? null;
  let sum = 0;
  for (let i = start ? 0 : 1; i < list.length; i++) {
    const w = list[i];
    const before = prev;
    prev = w;
    const cfg = actions?.[w?.action] ?? {};
    if (cfg.teleport) continue;
    if (isGMUser && w?.userId && isGMUser(w.userId)) continue;
    if (before && samePoint(before, w)) continue;
    const cost = Number(w?.cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const mult = actionCostMultiplier(cfg);
    sum += mult > 0 ? cost / mult : cost;
  }
  return sum;
}

/**
 * Наценка действия ядра на стоимость шага (climb/crawl/jump — ×2). Ядро при
 * инициализации стирает у действий поле `costMultiplier` и оставляет только
 * функцию `getCostFunction()` (client/game.mjs, #initializeMovementActions),
 * поэтому множитель берётся ею: стоимость единичного шага. Сырое
 * `costMultiplier` — запасной вариант (чистые тесты, не прошедший
 * инициализацию конфиг).
 */
export function actionCostMultiplier(cfg) {
  const raw = Number(cfg?.costMultiplier);
  if (raw > 0) return raw;
  if (typeof cfg?.getCostFunction === "function") {
    try {
      const m = Number(cfg.getCostFunction(undefined, {})?.(1));
      if (m > 0 && Number.isFinite(m)) return m;
    } catch { /* чужая функция стоимости, ждущая токен, — считаем без наценки */ }
  }
  return 1;
}

// ── Бюджет и вердикт ────────────────────────────────────────────────────────

/**
 * Сколько метров разрешено за этот Ход.
 * @param {object} p
 * @param {object} [p.allowance]  запись объявленных Движений
 * @param {object} [p.movement]   system.movement актора (halfMove…)
 * @param {string} p.mode         soft | strict
 * @param {number} [p.ceiling]    абсолютный потолок пешком (Надёжная Поступь: 3×SPD)
 */
export function pathBudget({ allowance = null, movement = null, mode = PATH_LIMIT_DEFAULT, ceiling = Infinity } = {}) {
  const rec = readAllowance(allowance);
  let limit;
  let source;
  if (rec.total > PATH_EPS) { limit = rec.total; source = "declared"; }
  else if (mode === "strict") { limit = 0; source = "none"; }
  else { limit = Math.max(0, finite(movement?.halfMove)); source = "default"; }
  const cap = Number(ceiling);
  const hasCap = Number.isFinite(cap);
  const capped = hasCap && cap < limit - PATH_EPS;
  if (capped) limit = Math.max(0, cap);
  return { limit, source, declared: source === "declared", capped, ceiling: hasCap ? cap : null };
}

/**
 * Решение по одному перемещению. Ничего не знает про Foundry: все входные
 * данные собирает обвязка (combat/path-limit.mjs).
 *
 * @param {object} i
 * @param {string}  i.mode      off | soft | strict
 * @param {boolean} i.gm        инициатор — ГМ (его не блокируем)
 * @param {boolean} i.actorOff  у актора флаг «без лимита»
 * @param {string}  i.method    movement.method из preMoveToken
 * @param {boolean} i.teleport  все пройденные отрезки — телепорт
 * @param {boolean} i.recorded  движение пишется в историю (токен в начатом бою)
 * @param {boolean} i.ownTurn   сейчас Ход именно этого токена
 * @param {number}  i.used      уже пройдено за Ход (movement.history.cost)
 * @param {number}  i.step      просимый отрезок (movement.passed.cost)
 * @param {object}  i.allowance запись объявленных Движений
 * @param {object}  i.movement  system.movement актора
 * @param {boolean} i.speedKnown лист актора сам посчитал Движение (нуль = «не может идти»)
 * @param {number}  i.ceiling   потолок пешком (Infinity — нет)
 * @returns {{applies:boolean, allowed:boolean, gmBypass:boolean, reason:string,
 *   limit?:number, used?:number, step?:number, total?:number, remaining?:number,
 *   over?:number, source?:string, declared?:boolean, capped?:boolean, ceiling?:?number}}
 */
export function evaluatePath(i = {}) {
  const skip = reason => ({ applies: false, allowed: true, gmBypass: false, reason });
  if (i.mode === "off") return skip("off");
  if (i.actorOff) return skip("actorOff");
  if (!PATH_LIMITED_METHODS.includes(i.method)) return skip("method");
  if (i.teleport) return skip("teleport");
  if (!i.recorded) return skip("notRecorded");
  if (!i.ownTurn) return skip("notOwnTurn");

  const rec = readAllowance(i.allowance);
  // Скорость неизвестна (схема существа без производных Движения: нулевое
  // Полудвижение и листа, который его считал, нет) и ничего не объявлено —
  // не знаем, что разрешать, значит не блокируем вслепую: лимит должен
  // ловить превышение, а не ломать сцену. А вот нуль у персонажа, чей лист
  // Движение посчитал (`speedKnown`: без обеих ног, Парализован), — это «не
  // может идти», и лимит нуль соблюдает.
  if (rec.total <= PATH_EPS && !(finite(i.movement?.halfMove) > 0) && !i.speedKnown) return skip("unknownSpeed");

  const budget = pathBudget({ allowance: rec, movement: i.movement, mode: i.mode, ceiling: i.ceiling });
  const used = Math.max(0, finite(i.used));
  const step = Math.max(0, finite(i.step));
  const total = used + step;
  const overRaw = total - budget.limit;
  const within = overRaw <= PATH_EPS;
  return {
    applies: true,
    allowed: within || !!i.gm,
    gmBypass: !within && !!i.gm,
    reason: within ? "ok" : "over",
    ...budget,
    used, step, total,
    remaining: Math.max(0, budget.limit - used),
    over: Math.max(0, overRaw)
  };
}

// ── Категории по измеренному пути ───────────────────────────────────────────

/**
 * Категория перемещения за Ход по честно пройденному пути — для Выстрела
 * Навскидку («подвигался не больше полудвижения», combat/snapshot.mjs).
 * @returns {"half"|"full"|null}  null — не двигался либо скорость неизвестна
 */
export function moveDegreeFromPath(total, halfMove) {
  const t = finite(total);
  const half = finite(halfMove);
  if (t <= PATH_EPS || half <= 0) return null;
  return t <= half + PATH_EPS ? "half" : "full";
}

/** Дальше ли пройдено, чем обычный Бег (SPD×6) — «дальний» Бег Спринта. */
export function exceedsNormalRun(total, run) {
  const r = finite(run);
  return r > 0 && finite(total) > r + PATH_EPS;
}

// ── Тексты ──────────────────────────────────────────────────────────────────

/** 3 → «3», 4.5 → «4,5»; шум дробей сетки обрезан до десятых. */
export function fmtMeters(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return String(Math.round(v * 10) / 10).replace(".", ",");
}

/** Список «Полудвижение 3 м + Бег 18 м» из записи объявленных Движений. */
export function allowanceSummary(allowance) {
  return readAllowance(allowance).entries
    .map(e => `${MOVE_KIND_LABELS[e.kind] ?? e.kind} ${fmtMeters(e.meters)} м`)
    .join(" + ");
}

/** Текст предупреждения при блоке: что исчерпано и что с этим делать. */
export function pathLimitMessage(name, verdict, allowance = null) {
  const v = verdict ?? {};
  const head = `Лимит пути исчерпан: ${name} уже прошёл ${fmtMeters(v.used)} м из ${fmtMeters(v.limit)} м за этот Ход, `
    + `ещё ${fmtMeters(v.step)} м не влезает (осталось ${fmtMeters(v.remaining)} м).`;
  let tail;
  if (v.declared) {
    tail = ` Объявлено: ${allowanceSummary(allowance)}. Объявите ещё Движение в меню токена или попросите ГМа.`;
  } else if (v.source === "none") {
    tail = " Движение не объявлено — объявите его в меню токена («Движение»).";
  } else if (!(v.limit > 0)) {
    tail = " Персонаж не может идти (без обеих ног или Парализован) — спросите ГМа.";
  } else {
    tail = " Движение не объявлено — доступно только Полудвижение; для большего объявите Движение в меню токена.";
  }
  const cap = v.capped
    ? ` Надёжная Поступь: пешком не более 3×SPD (${fmtMeters(v.ceiling)} м) за Ход.`
    : "";
  return head + tail + cap;
}
