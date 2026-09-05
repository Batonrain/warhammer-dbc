// module/rules/dominator.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dominator / Покоритель (wdbc-u0by, core.json стр. «Талант Purestrain
//  Genestealer» — таблица Оккультиста): «Персонаж получает Преимущество на
//  тесты Демонического Владычества». Владычество — реальный игровой тест
//  (core.json: «тест на W+0 vs W+0», ментальное полное действие), уже
//  проведённый через общий конвейер Ритуала как R.type==="dominion"
//  (module/constants/rituals.mjs::RITUAL_TYPES_MAP, module/apps/
//  ritual-cast.mjs::ritualThreshold — тот же путь порога, что у summon/
//  binding/gate). Безусловна (второго условия, кроме типа ритуала и
//  наличия Таланта, книга не ставит).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { hasAbility } from "./ability-by-key.mjs";

export function hasDominator(actor) {
  return hasAbility(actor, "ability.dominator", "Dominator", "talent");
}
