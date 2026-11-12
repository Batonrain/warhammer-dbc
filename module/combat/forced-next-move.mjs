// module/combat/forced-next-move.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТУМБЛЕР «СЛЕДУЮЩИЙ СДВИГ — ВЫНУЖДЕННЫЙ» (wdbc-98xsv).
//
//  Толчок Роундхауса, перевозка, Пересилить партнёра и подобные сдвиги стол
//  делает ручным перетаскиванием токена (Foundry пишет method «dragging»), а
//  от хода самого игрока такой шаг система отличить не может. Поэтому игрок
//  (или ГМ) заранее включает тумблер на актора: ровно ОДНО следующее
//  перетаскивание (все его отрезки) не блокируется лимитом пути, не метит
//  «подвигался» и не лежит в пройденном пути для следующих шагов Хода
//  (combat/path-limit.mjs).
//
//  Состояние живёт в памяти клиента и нигде не пишется: хук preMoveToken
//  исполняется на клиенте того, кто двигает токен, так что другим клиентам оно
//  не нужно, а забытый тумблер не переживёт перезагрузку страницы. Ещё он
//  гаснет сам — после одного сдвига и на любой смене Хода/Раунда (риск: забытый
//  тумблер был бы обходом лимита). Цена: если страницу перезагрузить посреди
//  Хода после вынужденного сдвига, запомненные сдвиги теряются, и тот сдвиг
//  снова считается в путь (ГМ снимает лимит актору — меню Движения).
//
//  Файл без Foundry и без импортов: им пользуются и меню Движения
//  (movement-actions.mjs), и обвязка лимита (path-limit.mjs, импортирующая
//  movement-actions), — свой лист-модуль разрывает круг.
// ════════════════════════════════════════════════════════════════════════════

const armed = new Map();          // ключ актора → имя для индикатора
const forcedMoves = new Map();    // ключ актора → Set movementId уже сделанных вынужденных сдвигов
const listeners = new Set();

const MAX_REMEMBERED = 20;

function emit() {
  const entries = nextMoveForcedEntries();
  for (const fn of [...listeners]) {
    try { fn(entries); } catch (err) { console.error("warhammer-dbc | forced-next-move listener", err); }
  }
}

/** Включённые тумблеры для индикатора: [{key, name}]. */
export function nextMoveForcedEntries() {
  return [...armed].map(([key, name]) => ({ key, name }));
}

/** Подписка на любое изменение состояния; возвращает функцию отписки. */
export function onNextMoveForcedChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isNextMoveForced(key) {
  return !!key && armed.has(key);
}

/** Включить/выключить тумблер актора. Без ключа — ничего. */
export function setNextMoveForced(key, on, name = "") {
  if (!key) return false;
  const had = armed.has(key);
  if (on) armed.set(key, name || armed.get(key) || "");
  else armed.delete(key);
  if (had !== armed.has(key) || on) emit();
  return armed.has(key);
}

/** Переключить; возвращает новое состояние. */
export function toggleNextMoveForced(key, name = "") {
  return setNextMoveForced(key, !isNextMoveForced(key), name);
}

/** Запомнить movementId вынужденного сдвига: его отрезки в истории ядра пути не считаются. */
export function rememberForcedMovement(key, movementId) {
  if (!key || !movementId) return;
  const set = forcedMoves.get(key) ?? new Set();
  set.add(movementId);
  while (set.size > MAX_REMEMBERED) set.delete(set.values().next().value);
  forcedMoves.set(key, set);
}

/** movementId вынужденных сдвигов актора за этот Ход. */
export function forcedMovementIds(key) {
  return forcedMoves.get(key) ?? new Set();
}

/** Общий сброс: смена Хода/Раунда (история пути ядра тоже стирается) — гаснут тумблеры и память. */
export function clearNextMoveForced() {
  const had = armed.size > 0;
  armed.clear();
  forcedMoves.clear();
  if (had) emit();
}
