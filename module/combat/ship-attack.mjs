// module/combat/ship-attack.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ДВИЖОК АВТОМАТИЗАЦИИ БОЕВЫХ СВОЙСТВ УЗЛОВ КОРАБЛЯ (wdbc-jr93)
//  Читает system.shipProps узла (массив {key,rating,rating2}, как и у оружия
//  персонажей), сопоставляет с реестром SHIP_PROPERTIES
//  (module/constants/ship-properties.mjs) и сворачивает боевые auto-директивы
//  ОДНОГО узла в плоский набор — читает module/sheets/ship-sheet.mjs::
//  _resolveShipAttack при резолве одного выстрела.
//
//  Отдельно от module/rules/ship.mjs::prepareShipDerived — тот считает
//  ХАРАКТЕРИСТИКИ корабля (всегда, не только в бою: SP/Энергия/Пространство/
//  Скорость/Манёвренность и т.п. — там же теперь и ship-wide боевые директивы
//  вроде deadlyRamming/devastating/orbitalStrike, они не про ОДИН выстрел),
//  этот файл — только то, что меняет ОДИН бросок атаки: крит, урон, попадания
//  сквозь щиты, CP цели. Первый проход (wdbc-jr93, 30.08.2026) —
//  havoc/terminalPenetration/volkite. Второй проход (wdbc-qhwb) добавил
//  lifetaker/penetrating сюда же (тот же per-shot hook-point на предмете-
//  оружии); slowReload — троттлинг через module/rules/cooldown.mjs, читается
//  прямо в ship-sheet.mjs::_resolveShipAttack, не здесь. chainReaction/
//  vapourisation — косметическая пометка в тексте крита (выбор узлов остаётся
//  текстовым решением ГМа по дизайну всей таблицы критов). integral(X) и
//  deathFromSky сознательно не автоматизированы — см. ship-properties.mjs.
// ─────────────────────────────────────────────────────────────────────────────

import { SHIP_PROPERTIES } from "../constants/ship-properties.mjs";
import { getShipCrit } from "../constants/ship-combat.mjs";

/** Разрешает system.shipProps узла/Корпуса в список с .def из реестра. */
export function resolveShipProps(item) {
  const props = item?.system?.shipProps;
  if (!Array.isArray(props)) return [];
  return props
    .map(p => ({ ...p, def: SHIP_PROPERTIES[p.key] }))
    .filter(p => p.def);
}

/**
 * Сворачивает боевые auto-директивы свойств ОДНОГО узла в плоский набор,
 * который читает _resolveShipAttack при резолве этого конкретного выстрела.
 */
export function aggregateShipAttackAuto(props) {
  const a = { havocBonus: 0, terminalPenetration: 0, volkiteDouble: false,
    lifetakerCP: 0, penetrating: new Set() };
  for (const p of props) {
    const au = p.def.auto;
    if (!au) continue;
    const r = Number(p.rating) || 0;
    if (au.havocBonus)           a.havocBonus = Math.max(a.havocBonus, r);
    if (au.terminalPenetration)  a.terminalPenetration = Math.max(a.terminalPenetration, r);
    if (au.volkiteDouble)        a.volkiteDouble = true;
    // Забирающее жизни (wdbc-qhwb): урон CP цели за каждое непоглощённое попадание.
    if (au.lifetakerPer)         a.lifetakerCP = Math.max(a.lifetakerCP, r);
  }
  // Пробивное (wdbc-qhwb): X — набор защит через запятую ("armour,voidShields");
  // не auto-директива (нет числового rating для суммирования), читаем rating
  // свойства penetrating напрямую.
  const pen = props.find(p => p.key === "penetrating");
  if (pen?.rating) for (const code of String(pen.rating).split(",").map(s => s.trim()).filter(Boolean)) a.penetrating.add(code);
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ПРИМЕНЯЮЩАЯ АРИФМЕТИКА ОДНОГО ВЫСТРЕЛА (wdbc-eja)
//  aggregateShipAttackAuto() выше только СВОРАЧИВАЕТ директивы узла в набор
//  чисел/флагов — сам расчёт урона/попаданий/крита раньше жил прямо в
//  module/sheets/ship-sheet.mjs::_resolveShipAttack (UI-слой), без единого
//  теста. Здесь — то же разделение, что у наземного боя в attack-outcome.mjs:
//  ни Roll, ни чата, ни документов, только правила книги (packs-src/books/
//  void.json) над уже готовыми числами. Сама генерация случайных чисел
//  (Roll.evaluate) остаётся в листе — оркестратор.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Попадания, реально доходящие до урона: щиты снимают часть (если вообще
 * действуют против этого типа оружия — лэнс/торпеда их не считают), Волкитное
 * (стр. 73) удваивает то, что ЩИТЫ ПРОШЛО — не сырые попадания.
 *
 * @returns {{shieldsUsed: number, hitsAfter: number}}
 */
export function hitsAfterShields({ hitsRaw, shields, shieldsApply, volkiteDouble }) {
  const shieldsUsed = shieldsApply ? Math.min(Number(shields) || 0, hitsRaw) : 0;
  let hitsAfter = Math.max(0, hitsRaw - shieldsUsed);
  if (volkiteDouble) hitsAfter *= 2;
  return { shieldsUsed, hitsAfter };
}

/**
 * Глубокое Пробитие (стр. 65): «При броске на урон перебрасывайте результат
 * равный значению в скобках ИЛИ МЕНЕЕ» — т.е. условие «≤ X», не «< X», и
 * действует на КАЖДЫЙ кубик группы урона по отдельности, не на сумму.
 *
 * Чистая часть решения «что перебросить» — сам переброс (случайное число)
 * делает вызывающий код (Roll), передавая результат в
 * terminalPenetrationAdjustment ниже.
 *
 * Известное ограничение (не бага, а неохваченный случай): если формула урона
 * несёт множитель — «(1d10+5)*2» — поправка от переброса добавляется к dr.total
 * БЕЗ этого множителя (реролл идёт по одному кубику из dr.dice[0], множитель
 * формулы на него не переприменяется). У боеголовок с Terminal Penetration в
 * текущих данных такого множителя нет (wdbc-eja), так что на практике не
 * стреляет — но если такая боеголовка появится, поправка будет заниженной.
 *
 * @param {number[]} dieResults  значения кубиков одной группы урона
 * @param {number}   threshold   X свойства; 0/отсутствует — не перебрасывать
 * @returns {number[]} индексы кубиков (в dieResults), которые нужно перебросить
 */
export function terminalPenetrationTargets(dieResults, threshold) {
  const x = Number(threshold) || 0;
  if (x <= 0) return [];
  return dieResults.reduce((acc, v, i) => { if (v <= x) acc.push(i); return acc; }, []);
}

/**
 * Суммарная поправка к урону от уже выполненных перебросов Terminal
 * Penetration. «Результаты повторного броска окончательны» (стр. 65) —
 * поправка складывается как есть, даже если новое значение оказалось МЕНЬШЕ
 * старого (переброс не подстрахован «бери лучшее из двух»).
 *
 * @param {number[]} dieResults исходные значения (как в terminalPenetrationTargets)
 * @param {number[]} targets    индексы, вернувшиеся из terminalPenetrationTargets
 * @param {number[]} rerolled   новые значения, по одному на каждый target (тот же порядок)
 * @returns {number} дельта к итоговому урону (может быть отрицательной)
 */
export function terminalPenetrationAdjustment(dieResults, targets, rerolled) {
  return targets.reduce((sum, idx, i) => sum + ((Number(rerolled[i]) || 0) - dieResults[idx]), 0);
}

/**
 * Итог урона Прочности одного залпа: броня (если не игнорируется), плюс
 * Разрушительное (Devastating, стр. 19) — «Все атаки из узлов типа Y получают
 * +X к урону». В книге не сказано «за попадание» — бонус прибавляется ОДИН
 * раз ко всему залпу, а не за каждое отдельное попадание в очереди, и уже
 * ПОСЛЕ вычета брони (бонус не защищается броневым порогом, как и сама
 * броня — вычитается из голого урона кубиков, а не из финального числа).
 *
 * `sumDamage` — лэнсы/макробатареи складывают все кубики и вычитают броню
 * один раз из суммы; торпеды/нова считают броню отдельно по каждому попаданию
 * (нет общего порога) — оба случая уже были в ship-sheet.mjs, здесь только
 * перенесены как есть.
 */
export function resolveShipAttackDamage({ dmgParts, ignoreArmour, effArmour, sumDamage, devastatingBonus = 0, hitsAfter }) {
  let totalHI;
  if (sumDamage) {
    const sum = dmgParts.reduce((a, b) => a + b, 0);
    totalHI = ignoreArmour ? sum : Math.max(0, sum - effArmour);
  } else {
    totalHI = dmgParts.reduce((a, b) => a + (ignoreArmour ? b : Math.max(0, b - effArmour)), 0);
  }
  if (devastatingBonus && hitsAfter > 0) totalHI += devastatingBonus;
  return totalHI;
}

/**
 * Критический результат одного крита: Опустошительное (Havoc X, стр. 34)
 * прибавляется К «критическому результату» ДО поиска по таблице — и это
 * тот же «критический результат», от которого Цепная реакция/Испарение
 * (стр. 11, 70) считают «выпало 1 или 2»: обе директивы читают одно и то же
 * число, книга не разводит «сырой бросок» и «результат после Havoc» на два
 * разных значения. Поэтому высокий Havoc, вопреки первому впечатлению, не
 * складывается с Цепной реакцией — а РЕЖЕ её включает, отодвигая результат
 * от порога ≤2 (сверено с книгой, а не только с уже написанным кодом).
 *
 * @param {number} rawCritRoll  результат 1d5 (или иного источника крита)
 * @param {number} havocBonus   X Havoc; 0 — нет свойства
 * @param {object[]} shipProps  resolveShipProps(item) — для chainReaction/vapourisation
 * @returns {{critRollVal: number, entry: object|null, multiNode: {type: string, count: number}|null}}
 */
export function resolveShipCritRoll(rawCritRoll, havocBonus, shipProps = []) {
  const critRollVal = Number(rawCritRoll) + (Number(havocBonus) || 0);
  const entry = getShipCrit(critRollVal);
  let multiNode = null;
  if (critRollVal <= 2) {
    const chain = shipProps.find(p => p.key === "chainReaction");
    if (chain)                                                multiNode = { type: "chainReaction", count: Number(chain.rating) || 2 };
    else if (shipProps.some(p => p.key === "vapourisation"))  multiNode = { type: "vapourisation", count: 2 };
  }
  return { critRollVal, entry, multiNode };
}

/**
 * Забирающее жизни (Lifetaker X, стр. 42): урон CP цели за КАЖДОЕ
 * непоглощённое попадание (т.е. hitsAfter — уже после щитов/Волкитного), «в
 * дополнение к нормальному урону макробатарей» — независимо от того, пробила
 * ли броня Прочность корпуса.
 */
export function lifetakerDamage(lifetakerCP, hitsAfter) {
  const x = Number(lifetakerCP) || 0;
  return (x > 0 && hitsAfter > 0) ? x * hitsAfter : 0;
}
