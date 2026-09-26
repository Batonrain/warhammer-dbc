// module/constants/creation-method.mjs
// Настройка мира «Метод стартовых Характеристик» (корбук, глава I, стр. 3):
// «Бонусные Характеристики по выбору ГМа игроки могут получать либо
// Генерацией, либо Сборкой». Третье значение — «оба»: тогда метод выбирает
// игрок на Этапе 2 Мастера создания. Сами правила — rules/starting-characteristics.mjs.

import { CREATION_METHODS } from "../rules/starting-characteristics.mjs";

const SYSTEM_ID = "warhammer-dbc";

export function registerCreationMethodSetting() {
  game.settings.register(SYSTEM_ID, "creationCharMethod", {
    name: "Метод стартовых Характеристик",
    hint: "Как игроки получают бонусные Характеристики при создании персонажа (стр. 3): Генерацией (броски 2d10), Сборкой (распределение очков) или любым из двух на выбор игрока.",
    scope: "world", config: true, type: String,
    choices: CREATION_METHODS, default: "generation"
  });
}

export function worldCreationMethod() {
  try { return game.settings.get(SYSTEM_ID, "creationCharMethod") || "generation"; }
  catch (e) { return "generation"; }
}
