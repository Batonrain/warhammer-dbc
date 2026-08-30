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
