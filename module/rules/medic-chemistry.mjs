// module/rules/medic-chemistry.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ МЕДИКА ПОВЕРХ ХИМИИ (остаток Талантов, 20.11.2026). Чистая часть.
//
//  Раньше эти Таланты лежали текстом с причиной «зависимость/пост-эффекты/яды
//  система не ведёт». Ведёт: зависимость — флаг получателя drugWithdrawal
//  (rules/drug-withdrawal.mjs, доза = startWithdrawal), пост-эффект — предмет-
//  препарат с activeEffect.isAfterEffect (sheets/tabs/drugs.mjs), яд — тот же
//  предмет с drugCategory "poison". Не хватало только заготовок и иммунитетов:
//
//  - Cook / Повар: 1 ОБ, 5 минут — I.b смесей против определённого наркотика.
//    Смесь утоляет зависимость получателя как полноценная доза.
//  - Antivenom / Противоядие: 3 дозы Детокса + 1 ОБ + Scholastic Lore
//    (Chymistry)(I)+0 — Успехи доз против известного яда (образец яда — предмет
//    на листе медика). Инъекция гасит действие этого яда и даёт иммунитет к нему
//    на 24 часа (флаг получателя; applyDrug отказывает яду).
//  - Deep Detox / Глубокая Детоксикация: 2 Детокса + 1 Стимм, Trade(Chymist)+0 —
//    доза против определённого наркотика. Введённая страдающему от пост-эффекта —
//    снимает его и Оглушает на 1d5+1−Успехи минут.
//  - Placebo / Плацебо: комбинированный Deceive(I)+0 и Medicae(I)−10 — цель
//    не получает штрафа Усталости Успехи Раундов (раз за сцену на цель).
//  - Triage / Триаж: потолок пациентов на уходе 10×I.b — счётчик на карточке.
//
//  Заготовки медика — флаг MEDIC_STOCK_FLAG: { cook: {drug: n}, antivenom:
//  {poison: n}, deepDetox: {drug: n} }.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
export const MEDIC_STOCK_FLAG = "medicStock";
export const PLACEBO_FLAG = "placebo";
export const ANTIVENOM_FLAG = "antivenomImmunity";
export const PLACEBO_SCENE_FLAG = "placeboUsedScene";
export const ANTIVENOM_SECONDS = 24 * 3600;
export const SECONDS_PER_ROUND = 6;

export const hasCook = a => hasItemNamed(a, "Cook", ["talent"]);
export const hasAntivenom = a => hasItemNamed(a, "Antivenom", ["talent"]);
export const hasDeepDetox = a => hasItemNamed(a, "Deep Detox", ["talent"]);
export const hasPlacebo = a => hasItemNamed(a, "Placebo", ["talent"]);
export const hasTriage = a => hasItemNamed(a, "Triage", ["talent"]);

const flagOf = (a, k) => a?.flags?.[NS]?.[k] ?? null;

/** Ключ заготовки: название препарата без точек (точка расщепила бы путь флага). */
export const stockKey = name => String(name ?? "").trim().replace(/\./g, "·");

export function medicStock(actor) {
  const s = flagOf(actor, MEDIC_STOCK_FLAG) ?? {};
  return { cook: { ...(s.cook ?? {}) }, antivenom: { ...(s.antivenom ?? {}) }, deepDetox: { ...(s.deepDetox ?? {}) } };
}

/** Новый запас после пополнения/расхода (n может быть отрицательным; ноль — запись убирается). */
export function stockAdd(stock, kind, name, n) {
  const next = { cook: { ...stock.cook }, antivenom: { ...stock.antivenom }, deepDetox: { ...stock.deepDetox } };
  const key = stockKey(name);
  const v = Math.max(0, (Number(next[kind][key]) || 0) + n);
  if (v) next[kind][key] = v; else delete next[kind][key];
  return next;
}

/** Смесей за раз: I.b (минимум 1). */
export const cookBatch = actor => Math.max(1, Number(actor?.system?.characteristics?.int?.bonus) || 0);

/** Оглушение Глубокой Детоксикации, минут: 1d5+1−Успехи, не меньше 0. */
export const deepDetoxStunMinutes = (d5, successes) => Math.max(0, (Number(d5) || 0) + 1 - (Number(successes) || 0));

/** Иммунитет к яду по Противоядию. */
export function antivenomImmune(actor, poisonName, now) {
  const map = flagOf(actor, ANTIVENOM_FLAG);
  const until = map?.[stockKey(poisonName)];
  return Number(until) > Number(now);
}

/**
 * Действует ли Плацебо (штраф Усталости не применяется). В бою срок — номер Раунда того же боя
 * ({combatId, round}: последний Раунд действия включительно), вне боя — worldTime ({until}).
 */
export function placeboActive(actor, { now = 0, combat = null } = {}) {
  const f = flagOf(actor, PLACEBO_FLAG);
  if (!f) return false;
  if (f.combatId) return !!combat && combat.id === f.combatId && Number(combat.round) <= Number(f.round);
  const until = Number(f.until);
  return Number.isFinite(until) && until > Number(now);
}

/** Запись Плацебо на Успехи Раундов: в бою — до Раунда текущий+N−1, вне боя — по времени. */
export function placeboFlag(rounds, { now = 0, combat = null } = {}) {
  const n = Math.max(1, Number(rounds) || 1);
  if (combat?.id) return { combatId: combat.id, round: (Number(combat.round) || 0) + n - 1 };
  return { until: Number(now) + n * SECONDS_PER_ROUND };
}

/** Потолок пациентов на уходе у медика с Триажем: 10×I.b. null — Таланта нет. */
export function triageCap(actor) {
  if (!hasTriage(actor)) return null;
  return 10 * Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);
}

/** Значение группового Навыка по специализации (Trade (Chymist), Scholastic Lore (Chymistry)). */
export function groupSkillValue(actor, group, specRe) {
  const list = actor?.system?.groupSkills?.[group];
  const hit = Array.isArray(list) ? list.find(e => specRe.test(String(e?.specialty || e?.name || ""))) : null;
  if (hit && hit.total != null) return { value: Number(hit.total) || 0, trained: true };
  const ch = Number(actor?.system?.characteristics?.int?.total) || 0;
  return { value: ch - 20, trained: false };
}
export const CHYMISTRY_RE = /chym|хим/i;
