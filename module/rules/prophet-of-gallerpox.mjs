// module/rules/prophet-of-gallerpox.mjs
//
// Дар Нургл «Prophet of Gallerpox / Пророк Гэллерпокса» (d100 92…94, wdbc-1rno.1):
// заражённая техновирусом большая жизнеобеспечивающая машина (система
// жизнеобеспечения/воздушный репроцессор/генератор пустотного щита/поле
// Гэллера) штрафует −30 на тесты против ядов всех не-Нурглитов в зоне её
// обслуживания. В системе нет сущности «подсистема корабля» — заражение
// живёт булевым полем на самом Vehicle/Ship-акторе целиком
// (system.gallerpoxInfected), а «зона обслуживания машины» приближена как
// «вся текущая сцена этого актора» (вариант A, согласован 15.09.2026):
// честная цена — сцена без корабля не даёт штрафа вовсе, а две заражённые
// машины на одной сцене не удваивают его (RAW и не просит удваивать).
//
// Болезни отдельного теста в системе не имеют (type:"disease" — статичные
// данные без броска, см. module/rules/resolve-test.mjs::effectAppliesTo про
// scope "poison") — штраф касается только ядов. Удалённое вкл/выкл машины
// (книга: «в пределах 7 км») не мехнизировано вообще: «включена/выключена»
// машина нигде не имеет игровых последствий (система не считает километры
// между сценами) — честно оставлено вне кода, см. capabilities.mjs.

/** Это Vehicle/Ship-актор, заражённый Гэллерпоксом? */
export function isGallerpoxInfectedMachine(actor) {
  if (actor?.type !== "vehicle" && actor?.type !== "ship") return false;
  return !!actor.system?.gallerpoxInfected;
}

/**
 * Чистое ядро правила: применяется ли штраф тестующему актору, если рядом
 * (на его сцене) есть указанный набор акторов. Отдельно от сбора самих
 * "sceneActors" — тестируется без Foundry.
 *
 * @param {object}   testingActor
 * @param {object[]} sceneActors  прочие акторы на той же сцене, что и testingActor
 */
export function gallerpoxPoisonPenaltyApplies(testingActor, sceneActors) {
  if (testingActor?.system?.patronGod === "nurgle") return false;
  return (sceneActors ?? []).some(isGallerpoxInfectedMachine);
}

/**
 * Foundry-обвязка: прочие акторы на текущей сцене testingActor (по его
 * активному токену). Без активного токена/вне игры — пустой список, то есть
 * штраф молча не сработает (тот же компромисс, что у demonsInHeraldLocus,
 * module/rules/daemon-locus.mjs).
 */
export function actorsOnSameScene(testingActor) {
  const token = testingActor?.getActiveTokens?.(false)?.[0];
  if (!token || !canvas?.scene) return [];
  const out = [];
  for (const other of canvas.scene.tokens) {
    if (other.id === token.id) continue;
    if (other.actor) out.push(other.actor);
  }
  return out;
}

/** Собирает п.выше в одну проверку — то, что реально вызывает источник правил. */
export function gallerpoxPoisonPenaltyActive(testingActor) {
  return gallerpoxPoisonPenaltyApplies(testingActor, actorsOnSameScene(testingActor));
}
