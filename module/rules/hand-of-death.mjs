// module/rules/hand-of-death.mjs
//
// Мутация «Hand of Death / Рука Смерти» (wdbc-hftn): сращивание с ВЫБРАННЫМ
// уже носимым оружием, а не выдача нового предмета из пака — Конструктор
// Механики не умеет «выбери свой предмет и модифицируй его на месте»,
// поэтому вся логика живёт здесь и в apps/hand-of-death.mjs, вне общего
// движка (тот же принцип, что у Транса Силовой Брони/Сус-ан Мембраны —
// см. doombc-mutations-mechanics-authoring в памяти агента).
//
// Идентификация по имени предмета (itemHasName), не по капабилити:
// та же причина, что у isCyberneticExcellence — кнопка на листе предмета
// должна показываться независимо от того, собрал ли движок правил Мутацию
// в actor.items уже во что-то (система тестируется без запущенного Foundry).

import { itemHasName } from "./predicates.mjs";

// itemHasName сравнивает с КАЖДОЙ билингвальной половиной имени предмета по
// отдельности (см. её докстринг) — здесь достаточно одной половины, не обеих
// сразу со слэшем.
const NAME = "Hand of Death";
const FLAG = "warhammer-dbc";

/** Это предмет-Мутация «Рука Смерти»? */
export function isHandOfDeathItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Оружие сейчас несёт метку сращивания ОТ этого источника (мутации). */
export function isFusedByHandOfDeath(weaponItem, mutationItemId) {
  return weaponItem?.type === "weapon" && weaponItem.getFlag?.(FLAG, "handOfDeathSource") === mutationItemId;
}
