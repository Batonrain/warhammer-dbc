// module/rules/pact-disorder.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Неизлечимые расстройства Пактов (корбук, Глава 3, «Пакты и проклятья»):
//
//    Когитор, «Гоняющийся за Мечтой»: «Психопатия» на Тяжести −1 (не может
//    опуститься ниже −1); «с каждой следующей Стадией Пакта минимальная
//    тяжесть поднимается на 1».
//    Мейстер, «Несмертная Клятва»: «Сноб» на Тяжести 0, тот же рост.
//    Ревенант, «Мстительный»: «Ненависть» на Тяжести 0, тот же рост.
//    Вампир, «Высшая Алчность»: «Перфекционизм» на Тяжести −2, не ниже −2
//    (роста по Стадиям книга не называет).
//
//  Черта приходит вместе с Архетипом (Стадия 0), поэтому предел — книжное
//  число плюс номер самой старшей купленной Стадии: Стадия 1 даёт +1 и так
//  далее. Стадия Пакта в системе — Талант «Pact Stage N / Стадия Пакта N»
//  (или «<Пакт> Pact Stage N / Стадия Пакта N (<Пакт>)»), см.
//  constants/advancement.mjs.
//
//  Выданное расстройство помнит книжное число во флаге pactFloorBase; покупка
//  следующей Стадии подтягивает предел (hooks.mjs → raisePactDisorderFloors).
//  Предел только растёт: ручную правку ГМа вверх не откатываем.
//  Чистые функции, test/rules/pact-disorder.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const PACT_FLOOR_FLAG = "pactFloorBase";

const STAGE_RE = /(?:Pact Stage|Стадия Пакта)\s*([1-5])(?!\d)/i;

/** Номер Стадии Пакта, которую даёт предмет (0 — не Стадия). */
export function pactStageOf(item) {
  if (item?.type !== "talent") return 0;
  const m = STAGE_RE.exec(String(item?.name ?? ""));
  return m ? Number(m[1]) : 0;
}

/** Самая старшая купленная Стадия Пакта актора (0 — только взят Пакт). */
export function pactStage(actor) {
  let max = 0;
  for (const i of actor?.items ?? []) max = Math.max(max, pactStageOf(i));
  return max;
}

/** Нижний предел Тяжести: книжное число + Стадия, не выше 5. */
export function pactDisorderFloor(base, stage) {
  if (base === null || base === undefined || base === "") return null;
  const b = Number(base);
  if (!Number.isFinite(b)) return null;
  return Math.min(5, b + Math.max(0, Number(stage) || 0));
}

/**
 * Какие расстройства актора поднять после покупки Стадии: [{item, floor}].
 * Берутся только выданные Пактом (с флагом pactFloorBase) и только там, где
 * новый предел выше нынешнего.
 */
export function pactFloorUpdates(actor) {
  const stage = pactStage(actor);
  const out = [];
  for (const i of actor?.items ?? []) {
    if (i?.type !== "mentalDisorder") continue;
    const base = i.flags?.["warhammer-dbc"]?.[PACT_FLOOR_FLAG];
    if (base === undefined || base === null) continue;
    const floor = pactDisorderFloor(base, stage);
    const cur = i.system?.severityMin;
    if (floor !== null && (cur === null || cur === undefined || Number(cur) < floor)) out.push({ item: i, floor });
  }
  return out;
}
