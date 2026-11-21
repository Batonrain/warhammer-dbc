// module/rules/fire-dance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Fire Dance / Танец Пламени (Талант Огнемётчика, основная книга; Разобрать 1a371).
//  Книга: «Накрывая цели шаблоном огнемёта, после тестов А на избегание от огня,
//  но до настоящих Избеганий, персонаж может выбрать одну цель и дать ей −20 на
//  тест А, чтобы не Загореться, и −40 на её первый тест против паники от Горения.»
//
//  На карточке атаки шаблоном (Spray + Flame) рядом с обычной кнопкой «Горение»
//  появляется вторая — «Танец Пламени» с −20; её можно нажать один раз на
//  карточку (одна цель). Загоревшаяся так цель получает метку, и первый тест
//  Паники от Горения (combat/condition-ticks.mjs) идёт с −40, после чего метка
//  снимается.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const FIRE_DANCE_BURN_MOD = -20;
export const FIRE_DANCE_PANIC_MOD = -40;
/** Метка на акторе-цели: следующий тест Паники от Горения идёт с −40. */
export const FIRE_DANCE_PANIC_FLAG = "fireDancePanic";
/** Ключ одноразовой отметки карточки (combat/card-once.mjs). */
export const FIRE_DANCE_CARD_KEY = "fireDanceUsed";

export function hasFireDance(actor) {
  return hasAbility(actor, "flamer.core.fireDance", "Fire Dance", "talent");
}

/** Танец Пламени доступен: Талант у стрелка, оружие накрывает шаблоном (Spray) и поджигает (Flame). */
export function fireDanceActive(attacker, { spray, flame } = {}) {
  return !!spray && !!flame && hasFireDance(attacker);
}

/** Штраф первого теста Паники от Горения по метке (0 — метки нет). */
export function fireDancePanicMod(actor) {
  return actor?.getFlag?.("warhammer-dbc", FIRE_DANCE_PANIC_FLAG) ? FIRE_DANCE_PANIC_MOD : 0;
}

//  ── Fire Maze / Лабиринт Пламени ────────────────────────────────────────────
//  «Стреляя из огнемёта, персонаж бросает на свойство Linger 2 раза и выбирает
//  один результат». Linger кубиком (1d5 и т.п.) бросается при размещении шаблона
//  (hooks.mjs, кнопка «Разместить шаблон»); с Талантом там два броска и выбор.
//  Linger числом не бросается — выбирать не из чего.

export function hasFireMaze(actor) {
  return hasAbility(actor, "flamer.core.fireMaze", "Fire Maze", "talent");
}
