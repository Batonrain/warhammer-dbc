// module/combat/enjoyment.mjs
// ════════════════════════════════════════════════════════════════════════
//  Enjoyment / Наслаждение (Талант друкхари, packs-src/talents/Друкхари/
//  Enjoyment___Наслаждение_Mexd0ysxxzLhPQ8N.json, wdbc-sk8s):
//
//  «Получив выбранный эффект от противника (кроме Наркотика, который
//  применяет сам персонаж), персонаж однократно за бой получает 1 Боли
//  без траты Реакции.» Триггеры (specialization): Усталость, Отравление,
//  Кровотечение, Оглушение, Наркотик, Непоглощённый Урон, Критический Эффект.
//
//  ПАССИВНЫЙ реактивный триггер — не кнопка Конструктора (applyMechEntry
//  выдаёт РОВНО ОДИН РАЗ при получении предмета, не годится для повторно
//  срабатывающего условия), а прямой вызов из трёх мест, где на актора
//  реально накладываются эти эффекты:
//    1. hooks.mjs::_applyWeaponPropEffect — Усталость/Отравление/
//       Кровотечение/Оглушение (свойство оружия атакующего).
//    2. sheets/tabs/drugs.mjs::applyDrug — Наркотик, ТОЛЬКО когда его
//       применил кто-то другой (applyToOther), не сам персонаж.
//    3. combat/damage.mjs::applyDamageToActor — Непоглощённый Урон (любой
//       netDamage > 0) и Критический Эффект (gotCritical) — единая точка
//       резолва урона атаки в проекте (тот же комментарий уже даёт этому
//       файлу pacifism.mjs, см. damage.mjs:263-271).
//
//  Кулдаун «раз за бой» — готовый module/rules/cooldown.mjs (unit:"battle"),
//  не отдельный флаг: сбрасывается сменой game.combat.id, как и остальные
//  battle-throttles в проекте.
//
//  Упрощение (задокументировано, не баг): «от противника» проверяется НЕ
//  сверкой disposition атакующего и цели, а самим фактом, что эффект пришёл
//  ИЗВНЕ (не самолечение/самоприменение) — так же, как applyToOther в
//  drugs.mjs не различает союзника от врага. Реальных сценариев «союзник
//  насильно травит союзника» в правилах нет, разница на практике не всплывёт.
// ════════════════════════════════════════════════════════════════════════

import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { painChange } from "../sheets/tabs/pain.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const FLAG = "enjoyment";

/** Владеет ли актор Талантом Enjoyment / Наслаждение. */
function hasEnjoyment(actor) {
  return hasAbility(actor, "ability.enjoyment", "Enjoyment", "talent");
}

/**
 * Даёт 1 Боли за триггер Enjoyment, если актор владеет Талантом и ещё не
 * использовал его в этом бою. Тихо ничего не делает без Таланта/вне лимита —
 * вызывающему коду не нужно самому проверять условия.
 */
export async function maybeGrantEnjoymentPain(actor) {
  if (!hasEnjoyment(actor)) return;
  if (!isCapabilityAvailable(actor, FLAG, "battle")) return;
  await markCapabilityUsed(actor, FLAG, "battle");
  await painChange(actor, 1, "enjoyment");
}
