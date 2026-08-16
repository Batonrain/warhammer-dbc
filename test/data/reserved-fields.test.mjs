// test/data/reserved-fields.test.mjs
//
// Имена полей схемы не должны совпадать с собственными свойствами DataModel.
// Foundry объявляет их в конструкторе через Object.defineProperty (writable:
// false), поэтому поле схемы с таким именем НЕ доходит до кода: `doc.system
// .parent` возвращает документ-владельца, а не значение поля.
//
// Так пропали субрасы. Схема субрасы объявляла `parent` с ключом расы-родителя,
// отбор шёл сравнением `s.parent === raceKey`, и в живом Foundry сравнение
// сравнивало документ со строкой — субрас не оказывалось НИ У ОДНОЙ расы.
// Тесты этого поймать не могли: в них `system` — обычный объект из JSON, где
// подмены нет. Отсюда проверка не поведения, а имён: она работает без Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { ITEM_DATA_MODELS, ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

// Свойства, которые DataModel определяет на самом экземпляре (common/abstract/
// data.mjs, Object.defineProperty(this, …) в конструкторе).
const RESERVED = ["parent", "schema", "_schema", "_source"];

const models = { ...ITEM_DATA_MODELS, ...ACTOR_DATA_MODELS };

describe("схемы не занимают служебные имена DataModel", () => {
  it.each(Object.keys(models))("%s", type => {
    const schema = models[type].defineSchema?.();
    if (!schema) return;

    expect(Object.keys(schema).filter(f => RESERVED.includes(f))).toEqual([]);
  });
});
