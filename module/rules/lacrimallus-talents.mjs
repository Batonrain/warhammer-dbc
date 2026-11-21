// module/rules/lacrimallus-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЛАКРИМАЛЛУС (Элитный архетип) — чистая арифметика тех-траллов: сколько
//  трупов уходит на тралла, кто умирает после смены Крафта, бригады и
//  ассистенты Трудовидца, Успехи Сборочной Линии, цена Разгона Траллов и
//  дошли ли Команды Кибер-Пастыря до Орды. Кнопки — combat/lacrimallus.mjs.
//
//  «Тех-тралл» и «сервитор» — по имени актора (Миньон/Орда, «Тех-тралл»,
//  «Thrall», «Сервитор», «Servitor») или по Черте Трудовидец у самого слуги
//  (Цепи Производства дают её аугментированным людям).
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const num = v => Number(v) || 0;
const NS = "warhammer-dbc";

export const hasToilseer = a => hasItemNamed(a, "Toilseer", ["trait"]);
export const hasAssemblyLine = a => hasItemNamed(a, "Assembly Line", ["talent"]);
export const hasChainsOfProductionTalent = a => hasItemNamed(a, "Chains of Production", ["talent"]);
export const hasCyberShepherd = a => hasItemNamed(a, "Cyber-Shepherd", ["talent"]);
export const hasInhumanResources = a => hasItemNamed(a, "Inhuman Resources", ["talent"]);
export const hasRapidEmbrace = a => hasItemNamed(a, "Rapid Embrace", ["talent"]);
export const hasThrallOverclock = a => hasItemNamed(a, "Thrall Overclock", ["talent"]);

const THRALL_RE = /тралл|thrall/i;
const SERVITOR_RE = /сервитор|servitor/i;

/** Тех-тралл (Миньон или Орда). */
export const isTechThrall = actor => !!actor && (THRALL_RE.test(String(actor.name ?? "")) || hasToilseer(actor));
/** Сервитор или тех-тралл — годится в ассистенты Трудовидца. */
export const isToilWorker = actor => !!actor && (isTechThrall(actor) || SERVITOR_RE.test(String(actor.name ?? "")));

export const magnitudeOf = actor => Math.max(0, Math.trunc(num(actor?.system?.magnitude?.value)));
export const isHorde = actor => actor?.type === "horde";

// ── Трупы на тралла: Киберобъятья и Бесчеловечные Ресурсы ───────────────────

/**
 * Сколько трупов уходит на одного тралла по броску 1d10.
 * Киберобъятья: 1-3 — 3, 4-6 — 2, 7+ — 1. Бесчеловечные Ресурсы: 1-5 — 2,
 * 6+ — 1; на трупах ксеносов — как обычно.
 */
export function corpsesPerThrall(roll, { inhuman = false, xenos = false } = {}) {
  const r = num(roll);
  if (inhuman && !xenos) return r <= 5 ? 2 : 1;
  return r <= 3 ? 3 : r <= 6 ? 2 : 1;
}

// ── Цепи Производства ───────────────────────────────────────────────────────

/** Сколько людей можно аугментировать на смену Крафта: P.b. */
export const chainsCap = perBonus => Math.max(0, Math.trunc(num(perBonus)));

/**
 * Итог смены: «бросает 1d10 за каждого: на 1 человек умирает и
 * трансформируется в тех-тралла (улучшенные этим Талантом умирают на 1-3)».
 * @param {number[]} rolls броски улучшенных Талантом
 * @returns {{dead:number, alive:number}}
 */
export function chainsShiftOutcome(rolls = []) {
  const dead = rolls.filter(r => num(r) <= 3).length;
  return { dead, alive: rolls.length - dead };
}

// ── Трудовидец ──────────────────────────────────────────────────────────────

/** Орда как ассистент: 1 за каждые полные 5 Магнитуды. */
export const hordeAssistants = magnitude => Math.floor(Math.max(0, num(magnitude)) / 5);

/**
 * Ассистенты и бригады из слуг: Миньон-сервитор/тралл — 1 ассистент и 1
 * бригада, Орда — по 1 за каждые полные 5 Магнитуды.
 * @param {object[]} workers сервиторы и тех-траллы
 * @param {number} [hecatonPairs] лишние пары конечностей Гекатонхейра (+1 в бригаду за пару)
 */
export function toilseerCrew(workers = [], { hecatonPairs = 0 } = {}) {
  let assistants = 0, brigades = 0;
  for (const w of workers) {
    const n = isHorde(w) ? hordeAssistants(magnitudeOf(w)) : 1;
    assistants += n;
    brigades += n;
  }
  return { assistants, brigades, perBrigadeBonus: Math.max(0, Math.trunc(num(hecatonPairs))) };
}

// ── Сборочная Линия ─────────────────────────────────────────────────────────

/** Успехи в сутки: 1 за каждые 3 Магнитуды каждой Орды тех-траллов. */
export function assemblyLineSuccesses(hordes = []) {
  return hordes.filter(h => isHorde(h) && isTechThrall(h))
    .reduce((s, h) => s + Math.floor(magnitudeOf(h) / 3), 0);
}

/** Потолок Банка изделия, на которое тратятся Успехи Линии. */
export const ASSEMBLY_LINE_BANK_CAP = 60;
export const ASSEMBLY_LINE_POOL = "assemblyLine";

// ── Разгон Траллов ──────────────────────────────────────────────────────────

/** Цена переброса Орде: 1 Магнитуда за каждые полные 10 Магнитуды. */
export const overclockMagnitudeLoss = magnitude => Math.floor(Math.max(0, num(magnitude)) / 10);
export const OVERCLOCK_THRALL_DAMAGE = "1d10";

// ── Кибер-Пастырь ───────────────────────────────────────────────────────────

/**
 * Получает ли Орда Команды как одиночный персонаж: её командир «Под моим
 * Присутствием» владеет Кибер-Пастырем, и Орда — тех-траллы.
 * @param {object} horde
 * @param {(uuid:string)=>object|null} [resolve]
 */
export function cyberShepherdReach(horde, resolve = globalThis.fromUuidSync) {
  if (!isHorde(horde) || !isTechThrall(horde) || typeof resolve !== "function") return false;
  const by = horde.flags?.[NS]?.commandedBy ?? horde.getFlag?.(NS, "commandedBy");
  if (!by?.uuid) return false;
  let boss = null;
  try { boss = resolve(by.uuid); } catch { boss = null; }
  return hasCyberShepherd(boss?.actor ?? boss);
}
