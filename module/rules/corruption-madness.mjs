// module/rules/corruption-madness.mjs
//
// «Считает Cor как Безумие» (Серый Человек, wdbc-gzuf) — под этим правилом
// Порча (Cor) для актора функционально не существует: любое изменение,
// которое иначе легло бы в system.corruption.value, уходит в
// system.insanity.value той же величиной. Cor остаётся неизменным навсегда.
// Широкое прочтение по решению пользователя — не только «снижение Cor
// снижает и Безумие», но и рост Cor становится ростом Безумия.
//
// Вызывается из warhammer-dbc.mjs::Hooks.on("preUpdateActor") — здесь только
// чистая арифметика, без Foundry, ради теста без стенда.

/**
 * @param {number} curCor  текущая system.corruption.value
 * @param {number} newCor  значение, которое пытается записать апдейт
 * @param {number} curIns  текущая system.insanity.value
 * @returns {?{corruption:number, insanity:number}} null — апдейт не менял Cor
 */
export function redirectCorruptionToMadness(curCor, newCor, curIns) {
  const delta = Number(newCor) - Number(curCor);
  if (!delta) return null;
  return {
    corruption: Number(curCor) || 0,
    insanity: Math.max(0, (Number(curIns) || 0) + delta)
  };
}
