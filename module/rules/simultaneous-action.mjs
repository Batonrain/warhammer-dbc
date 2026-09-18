// module/rules/simultaneous-action.mjs
//
// Одновременные Действия (core.json, врезка рядом с «Задержка», стр. 12,
// wdbc-1rno.27/.37): «Некоторые действия, вроде Задержки и Караула,
// происходят вне Хода персонажа, как реакция на действие другого персонажа.
// В таком случае первым действует персонаж, у которого выше A, а при её
// равенстве – у кого выше Инициатива. Если побеждает действующий персонаж
// (не реагирующий), он может завершить своё действие... прежде чем наступит
// очередь реагирующего. Если побеждает реагирующий персонаж, его действие
// может прерывать действие действующего персонажа.»
//
// Это ЯДРО общего примитива очерёдности — сравнение характеристик/текущей
// Инициативы в трекере боя, без завязки на конкретное действие (Караул/
// Задержка) и без розыгрыша самого прерывания (что именно «прерывается» —
// решает вызывающий код и/или ГМ, книга сама даёт только пример).
//
// Vigilance/Бдительность (wdbc-1rno.37): «...если действие персонажа —
// стрельба, он может использовать P вместо А» — заменяет ТОЛЬКО сравниваемую
// характеристику РЕАГИРУЮЩЕГО (Караул/Задержка), не действующего. Игрок
// всегда выберет большее — тот же принцип «берётся лучшая из разрешённых»,
// что и в rules/initiative.mjs::initiativeCharKey.
//
// Числа передаются готовыми (total характеристик, значение Инициативы из
// трекера боя) — этот файл не читает game/canvas/Roll, вызывающая сторона
// (module/combat/overwatch.mjs) достаёт их из настоящих Foundry-документов.

/**
 * Кто выигрывает очерёдность одновременного действия.
 * @param {number} actingCharTotal     характеристика ДЕЙСТВУЮЩЕГО (обычно Ag.total)
 * @param {number} reactingCharTotal   характеристика РЕАГИРУЮЩЕГО (Ag.total, либо
 *                                     P.total при Vigilance — выбор до вызова)
 * @param {number} [actingInitiative]  текущая Инициатива действующего в трекере боя
 * @param {number} [reactingInitiative] текущая Инициатива реагирующего в трекере боя
 * @returns {"acting"|"reacting"} кто действует первым
 */
export function simultaneousActionWinner({
  actingCharTotal, reactingCharTotal, actingInitiative, reactingInitiative
} = {}) {
  const a = Number(actingCharTotal) || 0;
  const r = Number(reactingCharTotal) || 0;
  if (r !== a) return r > a ? "reacting" : "acting";
  const ai = Number(actingInitiative) || 0;
  const ri = Number(reactingInitiative) || 0;
  if (ri !== ai) return ri > ai ? "reacting" : "acting";
  // Книга не оговаривает дальнейший тай-брейк при полном равенстве и Ag, и
  // Инициативы — оставляем действующему персонажу как менее спорному исходу
  // (он и так первым начал действие, которое спровоцировало реакцию).
  return "acting";
}

/**
 * Лучшая из разрешённых характеристик РЕАГИРУЮЩЕГО для сравнения очерёдности:
 * Ag.total, либо max(Ag.total, P.total), если у него Vigilance/Бдительность
 * и его реагирующее действие — стрельба (Караул). Задержка произвольным
 * действием сюда не попадает — Vigilance завязана книгой именно на стрельбу.
 * @param {object} chars   actor.system.characteristics реагирующего
 * @param {boolean} hasVigilance
 * @param {boolean} reactingIsShooting
 */
export function reactingOrderCharTotal(chars, hasVigilance, reactingIsShooting) {
  const ag = Number(chars?.ag?.total) || 0;
  if (!hasVigilance || !reactingIsShooting) return ag;
  const per = Number(chars?.per?.total) || 0;
  return Math.max(ag, per);
}
