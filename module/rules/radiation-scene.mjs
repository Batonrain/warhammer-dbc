// module/rules/radiation-scene.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Радиация сцены (корбук, «Радиация», стр. 484, wdbc-c5vf0). «Персонаж,
//  проводящий время в зоне с повышенным радиационным фоном, через определённые
//  периоды времени получает 1 урона в Т от радиации… Каждый раз, когда
//  персонаж накапливает 10, 20, 30 и т.д. урона в Т от радиации, он должен
//  пройти тест Т+0, при Провале получая лучевую болезнь».
//
//  Интенсивность сцены 1-10 (окно «Окружающая Среда») задаёт частоту; защита
//  снижает эффективную интенсивность, эффекты складываются, а иммунитет
//  отменяет радиацию вовсе. Чистая часть: защита актора, частота, число тиков.
//  Часы и урон — combat/radiation-scene.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { itemHasName } from "./predicates.mjs";
import { SECONDS_PER_ROUND } from "./condition-duration.mjs";

/** Флаг актора: укрытие, в котором он сейчас (ГМ ставит в окне «Окружение»). */
export const RAD_SHELTER_FLAG = "radShelter";
/** Флаг актора: { at: момент последнего тика, seen: до какого момента облучался }. */
export const RAD_CLOCK_FLAG = "radClock";
/** Флаг актора: накопленная доза от радиации сцены (тиков урона). */
export const RAD_DOSE_FLAG = "radDose";

/** Крепкий как Камень (Скват): «защита против радиации –3» (rules/squat-traits.mjs). */
const HARD_AS_STONE = "trait.hardAsStone";

/** Укрытия из таблицы защиты книги: ключ → { label, protect } (immune — иммунитет). */
export const RAD_SHELTERS = {
  "":          { label: "Под открытым небом",           protect: 0 },
  tin:         { label: "Жестяное здание",              protect: 1 },
  rockcrete:   { label: "Рокритовое здание",            protect: 2 },
  bunker:      { label: "Бункер или пещера",            protect: 3 },
  radbunker:   { label: "Радиационный бункер",          immune: true }
};

/** Тиков в сутки не нужно — интервал тика по эффективной интенсивности 1-10, секунды. */
export const RAD_INTERVAL_SECONDS = {
  1: 8 * 3600, 2: 4 * 3600, 3: 2 * 3600, 4: 3600, 5: 1800,
  6: 900, 7: 300, 8: 60, 9: SECONDS_PER_ROUND, 10: SECONDS_PER_ROUND / 5
};

/** Запас прочности цикла: больше тиков за один сдвиг Календаря не считается. */
export const RAD_MAX_TICKS = 100;

const items = actor => [...(actor?.items ?? [])];
const hasTraitNamed = (actor, name) => items(actor).some(i => i?.type === "trait" && itemHasName(i, name));

/**
 * Защита от радиации надетой брони: лучшая из надетых вещей, а не сумма —
 * строки таблицы книги описывают РАЗНЫЕ виды защиты (броня, Черта, здание),
 * между собой они складываются.
 * Терминаторская — иммунитет, силовая −3, пустотная −2, закрытая −1.
 * @returns {{immune:boolean, value:number, label:string}}
 */
export function armourRadProtection(actor) {
  let best = { immune: false, value: 0, label: "" };
  for (const i of items(actor)) {
    if (i?.type !== "armor" || !i?.system?.equipped) continue;
    const props = i.system.properties ?? [];
    if (/terminator|терминатор/i.test(String(i.name))) return { immune: true, value: 0, label: "Терминаторская броня" };
    let value = 0, label = "";
    if (i.system.armorType === "power") { value = 3; label = "Силовая броня"; }
    else if (props.includes("void"))    { value = 2; label = "Пустотная броня"; }
    else if (props.includes("sealed"))  { value = 1; label = "Закрытая броня"; }
    if (value > best.value) best = { immune: false, value, label };
  }
  return best;
}

/**
 * Полная защита актора: броня + Черты + укрытие.
 * @returns {{immune:boolean, total:number, parts:string[]}}
 */
export function radProtectionOf(actor, shelterKey = "") {
  const parts = [];
  let total = 0;
  const armour = armourRadProtection(actor);
  if (armour.immune) return { immune: true, total: 0, parts: [armour.label] };
  if (hasTraitNamed(actor, "Stuff of Nightmares")) return { immune: true, total: 0, parts: ["Существо из Кошмаров"] };
  const shelter = RAD_SHELTERS[shelterKey] ?? RAD_SHELTERS[""];
  if (shelter.immune) return { immune: true, total: 0, parts: [shelter.label] };
  if (armour.value) { total += armour.value; parts.push(`${armour.label} −${armour.value}`); }
  if (hasTraitNamed(actor, "Machine")) { total += 1; parts.push("Машина −1"); }
  if (hasRuleFlag(actor, HARD_AS_STONE)) { total += 3; parts.push("Крепкий как Камень −3"); }
  if (shelter.protect) { total += shelter.protect; parts.push(`${shelter.label} −${shelter.protect}`); }
  return { immune: false, total, parts };
}

/** Эффективная интенсивность 0-10: сцена минус защита (0 — радиации нет). */
export function effectiveRadiation(sceneLevel, protection) {
  if (protection?.immune) return 0;
  return Math.max(0, Math.min(10, (Number(sceneLevel) || 0) - (Number(protection?.total) || 0)));
}

/** Интервал тика, секунды (null — радиации нет). */
export function radIntervalSeconds(effective) {
  return RAD_INTERVAL_SECONDS[Math.round(Number(effective) || 0)] ?? null;
}

/**
 * Сколько тиков набежало к моменту `to` и куда сдвинуть отсчёт.
 * Первый облучённый отрезок только заводит отсчёт (тика сразу нет): тот же
 * приём «первый период отсчитывается от начала», что у лечения. Отсчёт
 * протух (актора не облучало дольше окна `seen`) — начинается заново.
 * @param {{at:number, seen:number}|null} clock  прежний флаг
 * @returns {{ticks:number, clock:{at:number, seen:number}}}
 */
export function radiationTicks(clock, { from, to, interval }) {
  const fresh = !clock || !Number.isFinite(clock.at) || Number(clock.seen) < Number(from);
  const at = fresh ? Number(from) : Number(clock.at);
  const raw = Math.floor((Number(to) - at) / interval);
  const ticks = Math.max(0, Math.min(RAD_MAX_TICKS, raw));
  // Сверх страховочного потолка отсчёт не копится: лишние тики пропадают.
  const newAt = raw > RAD_MAX_TICKS ? Number(to) : at + ticks * interval;
  return { ticks, clock: { at: newAt, seen: Number(to) } };
}

/** Сколько отметок «10, 20, 30…» дозы пройдено при росте от dose до dose+ticks — столько тестов T+0. */
export function doseCrossings(dose, ticks) {
  const d = Math.max(0, Number(dose) || 0);
  return Math.floor((d + Math.max(0, Number(ticks) || 0)) / 10) - Math.floor(d / 10);
}
