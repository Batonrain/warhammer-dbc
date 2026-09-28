// module/rules/single-combat.mjs
//
// Single Combat / Бой Один На Один — Черта архетипа Палач (Космодесант,
// корбук, «Архетипы Космодесантников», стр. 15):
//
//   «Когда Палач связан в рукопашной только с одним противником и без
//   союзников, он получает +1 Успех на все успешные тесты WS, S и A, и если он
//   проводит встречный тест на WS или A и у противника есть Трейт Unnatural
//   Characteristic для его теста, а у Палача – нет, правило форсированной
//   «ничьей» при проигрыше противника не применяется.»
//
// Здесь — чистая логика без Foundry. Геометрия сцены (кто с кем в контакте)
// считается в module/combat/single-combat.mjs и приходит сюда числами.
//
// «Без союзников» [допущение]: ни одного другого противника у ЭТОГО врага в
// Базовом/Глубоком контакте, кроме самого Палача — союзник, дерущийся с тем же
// врагом, делает бой не «один на один». Союзник, стоящий рядом с Палачом, но
// не касающийся его врага, бой не ломает (книга не уточняет; так же прочитан
// «никто не мешает» у Дуэлянтского — combat/tactical-map.mjs::meleeContactCount).

/** Имя возможности (module/constants/capabilities.mjs), выдаёт документ Черты. */
export const SINGLE_COMBAT = "trait.singleCombat";

/** Характеристики, чьи УСПЕШНЫЕ тесты получают +1 Успех. */
export const SINGLE_COMBAT_CHARS = Object.freeze(["ws", "s", "ag"]);

/** Характеристики встречного теста, где гаснет «ничья» Сверхъестественной Характеристики. */
export const SINGLE_COMBAT_OPPOSED_CHARS = Object.freeze(["ws", "ag"]);

/**
 * Бой один на один: ровно один враг в контакте, и у этого врага в контакте нет
 * никого, кроме самого персонажа.
 * @param {{enemiesInContact:number, foeEnemiesInContact:number}} counts
 */
export function isSingleCombatEngagement({ enemiesInContact, foeEnemiesInContact } = {}) {
  return Number(enemiesInContact) === 1 && Number(foeEnemiesInContact) === 1;
}

/**
 * Прибавка к степени успеха: 1, если бой один на один, тест успешен и
 * бросали WS, S или A; иначе 0.
 * @param {{engaged:boolean, success:boolean, charKey:?string}} p
 */
export function singleCombatExtraDeg({ engaged, success, charKey } = {}) {
  return (engaged && success && SINGLE_COMBAT_CHARS.includes(charKey)) ? 1 : 0;
}

/** Гаснет ли во встречном тесте «ничья» из-за Сверхъестественной Характеристики соперника. */
export function singleCombatIgnoresUnnaturalTie({ engaged, charKey } = {}) {
  return !!engaged && SINGLE_COMBAT_OPPOSED_CHARS.includes(charKey);
}
