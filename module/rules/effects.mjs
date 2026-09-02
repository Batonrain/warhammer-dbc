// module/rules/effects.mjs
//
// Реестр видов эффектов: перечень известных `kind` и обязательных полей у
// каждого. Применение эффектов появляется на этапе 2 плана вместе с конвейером
// теста; здесь пока только таблица, и она держится в согласии с
// docs/rules-format.md.

export const EFFECT_KINDS = {
  charBonus:   ["target", "value"],   // плюс к бонусу характеристики (Unnatural)
  charTotal:   ["target", "value"],   // плюс к значению характеристики
  rollBonus:   ["target", "value"],   // модификатор к тесту
  rollMode:    ["target", "mode", "rolls"], // несколько бросков с выбором
  penaltyMul:  ["target", "factor"],  // множитель штрафов, 0.5 = половина
  apBonus:     ["target", "value"],   // броня по локации или all
  damageBonus: ["target", "value"],   // плюс к урону
  damageDice:  ["target", "value"],   // замена формулы урона
  grantValue:  ["target", "value"],   // плюс к производному полю
  grantFlag:   ["target"],            // возможность по имени, см. rules/flags.mjs
  fearRating:  ["value"],             // берётся максимум, не сумма
  grantItem:   ["uuid"],              // выдать предмет; `qty` необязателен
  critRangeMod:["target", "side", "value"], // шире диапазон Крит. Успеха/Провала
  grantWeaponProp: ["target", "propKey"], // доп. Особое Свойство Оружия на эту атаку
  script:      ["code"]               // аварийный выход, см. docs/rules-format.md
};

export function isKnownEffectKind(kind) {
  return Object.hasOwn(EFFECT_KINDS, kind);
}
