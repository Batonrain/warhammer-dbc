// module/rules/electrovigour.mjs
// ════════════════════════════════════════════════════════════════════════
//  Electrovigour / Электрорвение (wdbc-u0by): «Персонаж получает
//  Преимущество на тесты Т на Техночудеса с типом Компенсатор».
//
//  Безусловна (в отличие от Dancing Among The Fire/One Against A Hundred —
//  нет второго условия, кроме «это тест Компенсатора»), поэтому проверка —
//  просто наличие Таланта. Тест Компенсатора (module/sheets/tabs/tech.mjs,
//  activateTechMiracle) катается без диалога (кнопка активации), тем же
//  путём, что Уклонение/Парирование — авто-обнаружение, не чекбокс.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { hasAbility } from "./ability-by-key.mjs";

export function hasElectrovigour(actor) {
  return hasAbility(actor, "ability.electrovigour", "Electrovigour", "talent");
}
