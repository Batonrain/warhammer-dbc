// module/rules/beastman-subrace.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Субрасы Зверолюда (корбук, «Расы → Зверолюд», wdbc-gao07) — чистая часть:
//
//   Khorngor / Кхорнгор: «Каждый раз, когда он получает урон, оскорбления, или
//     угрозы, он должен пройти тест на W+10, или впасть в Ярость (он может при
//     желании выбрать намеренно провалить этот тест)».
//   Khorngor Butcher / Кхорнгор Мясник: «Он имеет запас кубиков по 1 за каждый
//     Талант Hatred 2-го уровня и 1 за 2 Таланта Hatred 1-го уровня. Когда он
//     наносит урон атакой, получающей бонус от S.b (после броска урона, до
//     щитов), он может потратить до ½ W.b (окр.▲) кубиков и добавить кубик
//     урона за каждый. Эти кубики могут вызывать Экстремальный урон. Все
//     потраченные кубики восстанавливаются в конце боя».
//   Pestigor Mourner / Пестигор Плакальщик: «Раз за бой или сцену после
//     получения непоглощенного урона он может уменьшить его до 1 и на 1 Раунд
//     удвоить свой T.b в расчете поглощения».
//
//  Обвязка (тест, диалоги, кнопка на карточке, конвейер урона) — combat/
//  beastman-subrace.mjs; возможности выдают записи на субрасе/Талантах.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const KHORNGOR_RAGE_CAPABILITY    = "subrace.khorngor.rage";
export const KHORNGOR_BUTCHER_CAPABILITY = "talent.beastmanSubrace.khorngorButcher";
export const PESTIGOR_MOURNER_CAPABILITY = "talent.beastmanSubrace.pestigorMourner";

/** Флаг актора: { combatId, used } — сколько кубиков Мясника потрачено в этом бою. */
export const BUTCHER_FLAG = "butcherDice";
/** Флаг актора: worldTime, до которого T.b удвоен (Плакальщик). */
export const MOURNER_FLAG = "mournerUntil";
/** Ключ счётчика «раз за бой» Плакальщика (rules/cooldown.mjs). */
export const MOURNER_USAGE = "pestigor.mourner";

/** Тест Кхорнгора на Ярость: W+10. */
export const KHORNGOR_RAGE_MOD = 10;

/** Размер запаса кубиков Мясника: 1 за Hatred 2-го уровня и 1 за каждые 2 Hatred 1-го. */
export function butcherPool(actor) {
  let tier1 = 0, tier2 = 0;
  for (const i of actor?.items ?? []) {
    if (i?.type !== "talent" || !(itemHasName(i, "Hatred") || itemHasName(i, "Ненависть"))) continue;
    const tier = Number(i.system?.tier) || 0;
    if (tier >= 2) tier2++; else if (tier === 1) tier1++;
  }
  return tier2 + Math.floor(tier1 / 2);
}

/** За одно попадание можно потратить до ½ W.b кубиков (окр.▲). */
export function butcherPerHitCap(actor) {
  return Math.ceil((Number(actor?.system?.characteristics?.wp?.bonus) || 0) / 2);
}

/** Сколько кубиков уже потрачено в этом бою (флаг другого боя — 0). */
export function butcherUsed(flag, combatId) {
  return flag && flag.combatId === combatId ? Math.max(0, Number(flag.used) || 0) : 0;
}

/** Сколько кубиков можно потратить на это попадание. */
export function butcherAvailable(pool, used, perHitCap) {
  return Math.max(0, Math.min(Number(perHitCap) || 0, (Number(pool) || 0) - (Number(used) || 0)));
}

/** Размер кубика урона оружия: первый «NdF» формулы, иначе d10. */
export function damageDieFaces(formula) {
  const m = /\d*d(\d+)/i.exec(String(formula ?? ""));
  return m ? Math.max(2, Number(m[1])) : 10;
}

/** Множитель T.b Плакальщика: ×2, пока не истёк срок. */
export function mournerTbFactor(until, now) {
  return Number(until) > Number(now) ? 2 : 1;
}

/** «Уменьшить до 1» — только если непоглощённого больше 1. */
export function mournerCanReduce(netDamage) {
  return Number(netDamage) > 1;
}
