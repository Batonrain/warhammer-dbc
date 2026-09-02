// Лик Богов / Countenance of <God> (Дары Богов, wdbc-1rno): базовый социальный
// бонус лика мигрирован из capability-заглушки в реальные kind:"testMod".
// Слаанеш — book: "получает бонус +10 на все тесты социальных взаимодействий"
// (blanket, modScope:"social"). Тзинч — book: "бонус +10 на все тесты Deceive
// и Scrutiny" (два отдельных навыка, не общий "social"). Кхорн/Нургл НЕ
// мигрированы тем же способом: их базовый бонус адресован конкретному типу
// цели (солдаты/больные), а не всем — плоский testMod переоценил бы его
// (дал бы бонус против ЛЮБОГО), это не безопасное приближение, а ошибка;
// остаются capability-заглушкой до появления распознавания типа цели.
// Верхний ярус (+30 с единоверцами/против союзников), Страх и признание
// демонами — сознательно НЕ смоделированы (нет распознавания цели), остаются
// текстом в capabilities.mjs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";
const asItem = (name, mechanics) => ({ id: name, name, flags: { [SYSTEM]: { mechanics } } });
const readMechanics = path => JSON.parse(readFileSync(path, "utf8")).flags[SYSTEM].mechanics;

describe("Лик Богов: базовый социальный бонус механизирован (wdbc-1rno)", () => {
  it("Слаанеш: kind:\"testMod\" даёт rollBonus target:social +10", () => {
    const mechanics = readMechanics(
      "packs-src/mutations/Дары_Богов/Слаанеш/Countenance_of_Slaanesh___Лик_Слаанеш_YXV2wWWT2P8KrasN.json");
    expect(mechanics.length).toBeGreaterThan(1);
    const rules = rulesFromItemMechanics([asItem("Countenance of Slaanesh", mechanics)]);
    const bonus = rules.find(r => r.effects[0]?.kind === "rollBonus" && r.effects[0]?.target === "social");
    expect(bonus).toBeDefined();
    expect(bonus.effects[0]).toMatchObject({ kind: "rollBonus", target: "social", value: 10 });
  });

  it("Тзинч: kind:\"testMod\" даёт rollBonus skill:deceive +10 и skill:scrutiny +10", () => {
    const mechanics = readMechanics(
      "packs-src/mutations/Дары_Богов/Тзинч/Countenance_of_Tzeentch___Лик_Тзинча_Lci03nSWXLRbQ8ys.json");
    expect(mechanics.length).toBeGreaterThan(1);
    const rules = rulesFromItemMechanics([asItem("Countenance of Tzeentch", mechanics)]);
    const deceive = rules.find(r => r.effects[0]?.target === "skill:deceive");
    const scrutiny = rules.find(r => r.effects[0]?.target === "skill:scrutiny");
    expect(deceive.effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:deceive", value: 10 });
    expect(scrutiny.effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:scrutiny", value: 10 });
  });
});
