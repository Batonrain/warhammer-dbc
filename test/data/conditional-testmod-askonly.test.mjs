// test/data/conditional-testmod-askonly.test.mjs
//
// Приёмка #597: «Модификатор теста» с условием, которое видит только стол
// («с паствой», «ремонт», «пытки», «вцепился в опору»), должен быть галочкой
// (askOnly). Без неё бонус едет в КАЖДЫЙ тест Навыка — и в бросках без окна
// (rules/roll-mods.mjs::collectTestMods) складывается сам.
// Скульптурит: Ритуал Лепки Плоти и перераспределение берут +Cor.b×5 кодом
// (combat/flesh-sculptor.mjs::sculpturiteMedicaeBonus) через rollCultTest —
// без askOnly запись Конструктора давала бонус второй раз.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

const TALENTS = "packs-src/talents/Элитные_архетипы";
const DENDRITES = "packs-src/implants/Адептус_Механикус/Мехадендриты";
const CASES = [
  [`${TALENTS}/Скульптор_Плоти`, "4n5Uc4Ay41qklAoJ", ["DBaaBB0w9JeFMZ7y"]],
  [`${TALENTS}/Иерофант`, "upqU10olMjFnoNcx", ["ouzXY93gRVFbS3R2", "I2tRi6HVY6T9qFQa"]],
  [DENDRITES, "NOZ2ncHHVWQMeFQq", ["fycTorchMod00001"]],
  [DENDRITES, "7hJRteMlS8ajbsg1", ["manipDendMod0001"]],
  [DENDRITES, "PSIz8YNULERaJjvo", ["medDendMod000002"]],
  [DENDRITES, "OTqZYyNjmq2jG9Ki", ["optDendMod000002"]],
  [DENDRITES, "o5aM3cZqycWWcYyh", ["plasCutMod000001"]],
  [DENDRITES, "hgZAQtLrDtu7qMRu", ["servoArmMod00001"]],
  [DENDRITES, "RAZMOZEMwIYl8WdV", ["techDendMod00001"]]
];

describe("условные «Модификаторы теста» — галочкой (askOnly)", () => {
  it.each(CASES)("%s / %s", (dir, id, entryIds) => {
    const entries = packDocById(dir, id).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    for (const eid of entryIds) expect(entries.find(e => e.id === eid)?.askOnly, eid).toBe(true);
  });
});
