// module/rules/command-substitution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Подмена базы для теста Командования — выбор ЛУЧШЕЙ из доступных замен
//  (фикс 19.10.2026, независимое ревью диапазона «Таланты Оккультиста гл.3»,
//  Sahara 3-2a39): Living Legend / Живая Легенда (Inf вместо F,
//  leadership-talents.mjs) и Infernal Master / Инфернальный Владыка
//  (Forbidden Lore(Daemons)(W) вместо Command против демона,
//  occultist-talents.mjs) — обе книга формулирует как «может использовать X
//  вместо Command», то есть выбор игрока, а не обязательную замену. У
//  персонажа с обоими Талантами разом, против демона, прежний код СКЛАДЫВАЛ
//  оба rollBonus на один и тот же "skill:command" — Command считался как бы
//  от двух разных характеристик-заменителей одновременно. Здесь — единственный
//  источник правила, выбирающий бо́льшую подмену; каждый из двух файлов
//  больше не пушит собственное "skill:command"-правило для своего Таланта.
// ════════════════════════════════════════════════════════════════════════════

import { hasLivingLegend, livingLegendCommandBonus } from "./leadership-talents.mjs";
import { hasInfernalMaster, infernalMasterCommandBonus } from "./occultist-talents.mjs";
import { isDaemonActor } from "./predicates.mjs";
import { binaryDominionCommandBonus } from "./binary-dominion.mjs";

/**
 * Правило реестра (rules/sources.mjs) — максимум одно rollBonus-правило на
 * "skill:command": от Таланта с бо́льшей подменой из применимых сейчас, или
 * пустой список, если ни один не применим или итог обеих подмен — 0.
 *
 * `imApplicable` считаем явно (Талант есть И цель — демон), а не просто по
 * значению imBonus: иначе 0 «Владыка неприменим сейчас» было бы не отличить
 * от 0 «применим, но тест дал ровно 0», и соло-Живая-Легенда с редким
 * отрицательным итогом (её собственный, принятый отдельно риск) лишилась бы
 * применения там, где Владыки нет вовсе или цель не демон.
 */
export function commandSubstitutionRules(actor, ctx = {}) {
  const hasLL = hasLivingLegend(actor);
  const imApplicable = hasInfernalMaster(actor) && isDaemonActor(ctx?.targetActor);
  const llBonus = hasLL ? livingLegendCommandBonus(actor, ctx) : 0;
  const imBonus = imApplicable ? infernalMasterCommandBonus(actor, ctx) : 0;
  // Binary Dominion / Бинарное Владычество (Sahara 3-cc96 п.1): Tech-Use вместо
  // Command против сервиторов, роботов и Скитариев. Третья подмена за тот же навык —
  // берётся лучшая, а не сумма (тот же довод, что у двух выше). Подмена Владычества
  // «не хуже обычного»: ниже нуля она не опускается (binary-dominion.mjs), поэтому
  // в соревновании с Легендой/Владыкой нулевая не выигрывает у отрицательной.
  const bdBonus = binaryDominionCommandBonus(actor, ctx);

  const useIM = hasLL && imApplicable ? imBonus >= llBonus : imApplicable;
  const best = useIM ? imBonus : llBonus;
  if (bdBonus > 0 && bdBonus > best) {
    return [{
      id: "binaryDominion.command", label: `Бинарное Владычество: Tech-Use вместо Command (+${bdBonus})`, when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: bdBonus, label: "Бинарное Владычество" }]
    }];
  }
  const bonus = best;
  if (!bonus) return [];

  if (useIM) {
    return [{
      id: "infernalMaster.command", label: "Инфернальный Владыка", when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: bonus, label: "Инфернальный Владыка" }]
    }];
  }
  return [{
    id: "livingLegend.command",
    label: `Живая Легенда: Inf вместо F (${bonus >= 0 ? "+" : ""}${bonus})`,
    when: {},
    effects: [{ kind: "rollBonus", target: "skill:command", value: bonus, label: "Живая Легенда" }]
  }];
}
