// module/rules/maester-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мейстер — Вирус Жизни, Культивация, Целительный Прожектор и Стадии
//  Пакта. Чистая часть; кнопки — combat/maester.mjs.
//
//  Пулы — данные Конструктора (rules/resource-pools.mjs), как у Вампира:
//    doses       «Инъекции» — Черта Вирус Жизни 7, Стадии +1/+1/+1/+2/+2
//                (таблица книги 7/8/9/10/12/14);
//    cultivation «Культивация» — Черта 3, Стадии 2–5 по +1 (3/3/4/5/6/7).
//
//  Пациент несёт метку lifeVirus = { by, contribution, expiresAt,
//  cultivation, cultivationSince, projected:{combat,round} }; вклад в
//  Аблативные Раны ведётся приёмом replaceAblativeContribution
//  (rules/wounds.mjs). Мейстер — список пациентов lvPatients по давности.
//  Потеря Аблативных Ран вируса (урон, срок) даёт пациенту 1 Культивации
//  (до 3) — preUpdateActor в hooks.mjs через lifeVirusLossPatch.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { shrinkAblativeContributionToFit } from "./wounds.mjs";

export const LIFE_VIRUS_FLAG = "lifeVirus";
export const LV_PATIENTS_FLAG = "lvPatients";
export const DOSES_POOL = "doses";
export const CULTIVATION_POOL = "cultivation";
export const PATIENT_CULTIVATION_MAX = 3;
export const LIFE_VIRUS_SECONDS = 86400;
export const CULTIVATION_SPOIL_SECONDS = 7 * 3600;
export const PROJECTOR_ABLATIVE = 3;
export const ANY_PATIENT_ABLATIVE = 3;
export const REVIVE_ROUNDS = 12;
export const AURA_RADIUS = 7;

/** Таблица Вируса Жизни по Стадии Пакта 0..5 (книга). */
export const LIFE_VIRUS_TABLE = {
  patients:    [3, 3, 4, 5, 6, 7],
  ablative:    [7, 8, 9, 10, 11, 12],
  overcharge:  [0, 14, 16, 18, 20, 22],
  regen:       [1, 1, 2, 2, 3, 3],
  regenBonus:  ["нет", "+10", "+15", "+20", "+30", "автоуспех"],
  doses:       [7, 8, 9, 10, 12, 14],
  cultivation: [3, 3, 4, 5, 6, 7]
};

export const hasLifeVirus = a => hasItemNamed(a, "Life Virus", ["trait"]);
export const hasCultivation = a => hasItemNamed(a, "Cultivation", ["trait"]);

/** Стадия Пакта Мейстера: старшая из купленных «Maester Pact Stage N». */
export function maesterStage(actor) {
  let s = 0;
  for (let n = 1; n <= 5; n++) if (hasItemNamed(actor, `Maester Pact Stage ${n}`, ["talent"])) s = n;
  return s;
}

/** Строка таблицы для Стадии. */
export function lifeVirusRow(stage) {
  const s = Math.max(0, Math.min(5, Math.trunc(Number(stage) || 0)));
  return Object.fromEntries(Object.entries(LIFE_VIRUS_TABLE).map(([k, v]) => [k, v[s]]));
}

const flagOf = (a, k) => a?.flags?.["warhammer-dbc"]?.[k] ?? a?.getFlag?.("warhammer-dbc", k);

/** Метка вируса на пациенте или null. */
export function lifeVirusOf(patient) {
  const f = flagOf(patient, LIFE_VIRUS_FLAG);
  return f && f.by ? f : null;
}

/** Действует ли вирус (есть вклад и срок не вышел). */
export function lifeVirusActive(patient, now = 0) {
  const f = lifeVirusOf(patient);
  return !!f && Number(f.contribution) > 0 && Number(f.expiresAt) > Number(now);
}

/**
 * Новый список пациентов после инъекции: пациент в конец, давние — за
 * пределом лимита — вылетают («самый давний теряет все преимущества»).
 * @returns {{list:string[], dropped:string[]}}
 */
export function admitPatient(list, uuid, cap) {
  const l = (Array.isArray(list) ? list : []).filter(u => u && u !== uuid);
  l.push(uuid);
  const over = Math.max(0, l.length - Math.max(1, Number(cap) || 1));
  return { list: l.slice(over), dropped: l.slice(0, over) };
}

/** Вклад вируса при инъекции: по таблице; «чужому» существу (Стадия 2) — 3. */
export function injectionAblative(stage, { foreign = false } = {}) {
  return foreign ? ANY_PATIENT_ABLATIVE : lifeVirusRow(stage).ablative;
}

/**
 * Прожектор: +3 (за каждое срабатывание) сверх обычного максимума, но не
 * выше Сверхукрепления. На Стадии 0 Прожектора нет.
 */
export function projectorContribution(prev, stage, times = 1) {
  const row = lifeVirusRow(stage);
  const cap = row.overcharge || row.ablative;
  return Math.min(cap, Math.max(0, Number(prev) || 0) + PROJECTOR_ABLATIVE * Math.max(1, Number(times) || 1));
}

/** Спад Сверхукрепления в начале Хода пациента без Прожектора: −3, до обычного максимума. */
export function overchargeDecay(contribution, stage) {
  const c = Math.max(0, Number(contribution) || 0);
  const normal = lifeVirusRow(stage).ablative;
  return c > normal ? Math.max(normal, c - PROJECTOR_ABLATIVE) : c;
}

/** Был ли пациент целью Прожектора в этом или прошлом Раунде этого боя. */
export function projectedRecently(f, combatId, round) {
  const p = f?.projected;
  return !!p && p.combat === combatId && Number(round) - Number(p.round) <= 1;
}

/**
 * preUpdateActor: пациент теряет Аблативные Раны вируса — 1 Культивации
 * (до 3) и вклад сжимается до остатка. `nextAblative` — новое значение.
 * @returns {object|null} доп. поля для changes или null
 */
export function lifeVirusLossPatch(system, f, nextAblative, now = 0) {
  if (!f || !(Number(f.contribution) > 0)) return null;
  const cur = Number(system?.wounds?.ablative) || 0;
  const next = Number(nextAblative);
  if (!Number.isFinite(next) || next >= cur) return null;
  const shrink = shrinkAblativeContributionToFit({ wounds: { ...system?.wounds, ablative: next } }, f.contribution);
  const cult = Math.min(PATIENT_CULTIVATION_MAX, (Number(f.cultivation) || 0) + 1);
  const patch = {
    "flags.warhammer-dbc.lifeVirus.cultivation": cult,
    "flags.warhammer-dbc.lifeVirus.cultivationSince": Number(f.cultivationSince) || Number(now) || 0
  };
  if (shrink) {
    patch["system.wounds.ablativeMax"] = shrink.ablativeMax;
    patch["flags.warhammer-dbc.lifeVirus.contribution"] = shrink.contribution;
  }
  return patch;
}

/** Несобранная Культивация испортилась (7 часов). */
export function cultivationSpoiled(f, now = 0) {
  return !!f && Number(f.cultivation) > 0 && Number(f.cultivationSince) > 0
    && Number(now) - Number(f.cultivationSince) >= CULTIVATION_SPOIL_SECONDS;
}

/**
 * Сбор Культивации с пациента. Стадия 4 без Реакции — не больше 1.
 * @returns {{take:number, left:number}}
 */
export function harvestCultivation(patientCult, room, { capOne = false } = {}) {
  const have = Math.max(0, Number(patientCult) || 0);
  const take = Math.min(capOne ? Math.min(1, have) : have, Math.max(0, Number(room) || 0));
  return { take, left: 0 };
}

/** Можно ли «вернуть к жизни»: умер не более 12 Раундов назад. */
export function reviveWindowOk(roundsSince) {
  return roundsSince != null && Number(roundsSince) >= 0 && Number(roundsSince) <= REVIVE_ROUNDS;
}

/** Цена оживления: Стадия 2 — 2 Культивации и полудействие; Стадия 3 с Избирательным убийством — 1 и свободное. */
export function reviveCost(stage, { selectiveKill = false } = {}) {
  return stage >= 3 && selectiveKill ? { cultivation: 1, ap: 0, doses: 1 } : { cultivation: 2, ap: 1, doses: 1 };
}

/** Аура Стадии 5 против Орды: 1 урона в Магнитуду за каждые полные 10. */
export function auraHordeDamage(magnitude) {
  return Math.floor(Math.max(0, Number(magnitude) || 0) / 10);
}

/** Меню Культивации Стадии 4: цена → эффект. */
export const STAGE4_MENU = [
  { cost: 1, key: "addiction", label: "Снять зависимость от наркотиков" },
  { cost: 2, key: "tempCrit", label: "Снять временный Критический Эффект (бесполезная конечность, длительный штраф)" },
  { cost: 3, key: "permCrit", label: "Снять постоянный Критический Эффект (конечность/орган отрастают)" },
  { cost: 4, key: "disease", label: "Вылечить неизлечимую болезнь / заражение Генокрадами / программирование Нейроманта" },
  { cost: 5, key: "shield", label: "Щит-дефлектор 1-49/7 до начала следующего Хода цели" }
];

/** Меню Прожектора Стадии 3 (вместо +3 Аблативных). */
export const STAGE3_MENU = [
  { key: "regen", label: "Дополнительная попытка Regeneration" },
  { key: "fatigue", label: "−1 Усталости и 1d5 урона Характеристики назад" },
  { key: "poison", label: "Снять Отравление и эффекты ядов/наркотиков" },
  { key: "bleed", label: "Снять Кровотечение и 2 Обескровливания" },
  { key: "crippling", label: "Снять Калечение (Crippling/Piercing)" },
  { key: "senses", label: "Вернуть слух и зрение" },
  { key: "stun", label: "Оглушение −1 Раунд" },
  { key: "burning", label: "Потушить" }
];
