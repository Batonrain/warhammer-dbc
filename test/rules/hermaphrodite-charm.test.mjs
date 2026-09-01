// Гермафродит / Hermaphrodite (Дар Слаанеш, wdbc-1rno): +30 Обаяние на тесты
// соблазнения (book: "получая бонус +30 на тесты соблазнения") — миграция из
// capability-заглушки в реальную запись kind:"testMod", skillKey:"charm".
// Остаток (доступ к обычно иммунным целям, возврат либидо) сознательно не
// смоделирован — не число, не тест, см. capabilities.mjs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";

describe("Hermaphrodite: +30 Обаяние механизирован (wdbc-1rno)", () => {
  it("kind:\"testMod\" даёт rollBonus skill:charm +30", () => {
    const data = JSON.parse(readFileSync(
      "packs-src/mutations/Дары_Богов/Слаанеш/Hermaphrodite___Гермафродит_KFkKkRuN2SKahOEh.json", "utf8"));
    const mechanics = data.flags[SYSTEM].mechanics;
    expect(mechanics.length).toBeGreaterThan(1); // capability-заглушка + новая testMod-группа

    const item = { id: "Hermaphrodite", name: "Hermaphrodite", flags: { [SYSTEM]: { mechanics } } };
    const rules = rulesFromItemMechanics([item]);
    const bonusRule = rules.find(r => r.effects[0]?.kind === "rollBonus" && r.effects[0]?.target === "skill:charm");
    expect(bonusRule).toBeDefined();
    expect(bonusRule.effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:charm", value: 30 });
  });
});
