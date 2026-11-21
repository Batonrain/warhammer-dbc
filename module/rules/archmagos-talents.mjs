// module/rules/archmagos-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АРХИМАГОС (Элитный архетип, корбук «Элитные архетипы») — чистая арифметика
//  Черт и Талантов, без Foundry. Кнопки и запись в акторов —
//  module/combat/archmagos.mjs.
//
//  «Машинный слуга» — актор с Чертой Machine (X) или с Имплантами Механикум.
//  Демоническая машина (Machine + Daemonic) считается демоном, а не машиной,
//  пока у Архимагоса нет Инфернакса («считает демонические машины машинами, а
//  не демонами, в расчёте Командования и Миньонов»).
//
//  Таланты опознаются по английской половине имени литералом (их ищет
//  tools/capability-reachability.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { isMachineTrait } from "./flesh-is-weak.mjs";
import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
const num = v => Number(v) || 0;

/** Категории имплантов Механикум (module/data/item/implant.mjs → category). */
export const MECHANICUS_IMPLANT_CATEGORIES = ["mechanicus", "mechOther", "mechFocus", "mechEnergy", "mechadendrite", "skitarii"];

export const hasArchDominus = a => hasItemNamed(a, "Arch-Dominus", ["talent"]);
export const hasAvatarOfMetal = a => hasItemNamed(a, "Avatar of Metal", ["talent"]);
export const hasConcordax = a => hasItemNamed(a, "Concordax", ["talent"]);
export const hasDogmatix = a => hasItemNamed(a, "Dogmatix", ["talent"]);
export const hasInfernax = a => hasItemNamed(a, "Infernax", ["talent"]);
export const hasVisioIrae = a => hasItemNamed(a, "Visio Irae", ["talent"]);
export const hasDoctrinaImperative = a => hasItemNamed(a, "Doctrina Imperative", ["trait"]);
export const hasMasterpieceFrame = a => hasItemNamed(a, "Masterpiece Frame", ["trait"]);

/** Есть ли у актора хоть один Имплант Механикум. */
export function hasMechanicusImplants(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "implant"
    && MECHANICUS_IMPLANT_CATEGORIES.includes(String(i.system?.category ?? "mechanicus")));
}

const hasMachineTrait = actor => [...(actor?.items ?? [])].some(isMachineTrait);
const isDaemonic = actor => actor?.type === "daemon" || actor?.type === "demonPrince"
  || [...(actor?.items ?? [])].some(i => i?.type === "trait" && (itemHasName(i, "Daemonic") || itemHasName(i, "Демонический")));

/**
 * Машинный слуга для Талантов Архимагоса.
 * @param {object} actor подчинённый
 * @param {{infernax?:boolean}} o есть ли у Архимагоса Инфернакс
 */
export function isMachineServant(actor, { infernax = false } = {}) {
  if (!actor) return false;
  const machine = hasMachineTrait(actor);
  if (machine && isDaemonic(actor) && !infernax) return false;
  return machine || hasMechanicusImplants(actor);
}

/**
 * Конкордакс: «Все машины и персонажи с Имплантами Механикум под его Командным
 * Присутствием, а также сам Архимагос, получают бонус к любым тестам, кроме
 * тестов T, равный их количеству». Количество — машинные слуги под
 * Присутствием плюс сам Архимагос (решение по тексту: «их» — весь хор).
 */
export function concordaxBonus(servantCount) {
  return Math.max(0, Math.trunc(num(servantCount))) + 1;
}

/** Тест Стойкости? Конкордакс на них не действует. */
export const isToughnessTest = ctx => String(ctx?.char ?? "").toLowerCase() === "t";

// ── Доктрина Императив: калибровка прицелов и актуаторов ────────────────────

/**
 * «+3×I.b к тесту WS/BS/S/A за счёт такого же штрафа к BS/WS/A/S
 * соответственно» — пары книги: WS↔BS, S↔A (A — Ловкость).
 */
export const CALIBRATION_PAIRS = {
  ws: { plus: "ws", minus: "bs", label: "+WS / −BS" },
  bs: { plus: "bs", minus: "ws", label: "+BS / −WS" },
  s:  { plus: "s",  minus: "ag", label: "+S / −A" },
  ag: { plus: "ag", minus: "s",  label: "+A / −S" }
};

/** Величина калибровки: 3×I.b Архимагоса. */
export const calibrationValue = intBonus => 3 * Math.max(0, Math.trunc(num(intBonus)));

/** Изменения ActiveEffect калибровки (итог Характеристики — тест по ней). */
export function calibrationChanges(pairKey, intBonus) {
  const p = CALIBRATION_PAIRS[pairKey];
  if (!p) return [];
  const v = calibrationValue(intBonus);
  if (!v) return [];
  return [
    { key: `system.characteristics.${p.plus}.totalFx`, type: "add", value: v },
    { key: `system.characteristics.${p.minus}.totalFx`, type: "add", value: -v }
  ];
}

/** Доктрина Императив удваивает максимум ассистентов, если все они — машинные слуги. */
export function doctrinaAssistantCap(baseCap, assistants = [], { infernax = false } = {}) {
  const all = assistants.length > 0 && assistants.every(a => isMachineServant(a, { infernax }));
  return all ? num(baseCap) * 2 : num(baseCap);
}

// ── Архи-Доминус и Аватар Металла: цены в Когниции ──────────────────────────

/** «За 2/4 Когниции давать Команды» вместо полудействия/полного действия. */
export const ARCH_DOMINUS_COMMAND_COST = { short: 2, presence: 2, detail: 4 };

/** Аватар Металла: «цена и Процесс 2 Когниции»; Архи-Доминус снижает на 1. */
export function avatarOfMetalCost(actor) {
  return Math.max(0, 2 - (hasArchDominus(actor) ? 1 : 0));
}

/** Метка «Аватар Металла держится» на Архимагосе: { uuid, name }. */
export const AVATAR_FLAG = "avatarOfMetal";

/** Цена Процесса Аватара в ⚙ за Ход (0 — Аватар не держится). Читает rules/technomystic-talents.mjs::processCostTotal. */
export function avatarProcessCost(actor) {
  const f = actor?.flags?.[NS]?.[AVATAR_FLAG] ?? actor?.getFlag?.(NS, AVATAR_FLAG);
  return f?.uuid ? avatarOfMetalCost(actor) : 0;
}

/** Лик Гнева: рейтинг Страха до конца боя/сцены. */
export const VISIO_IRAE_FEAR = 3;
