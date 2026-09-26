// test/data/loss-of-limb-submutations.test.mjs
//
// wdbc-1rno.6.1: «Потеря Конечности» — выпавшая субмутация сама накладывает
// Состояние потери части тела (Конструктор, kind:"condition" apply,
// гейт when.submutations). «Пальцы» (1/6) — ждут решения владельца.
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

// Loss_of_Limb___Потеря_Конечности_MmNCVwTHcWDFFzGa.json
const doc = () => packDocById("packs-src/mutations/Общие_мутации", "MmNCVwTHcWDFFzGa");

describe("Потеря Конечности: Состояние по субмутации", () => {
  it("ладонь/рука/нога/стопа — по обе стороны, по одной записи на строку", () => {
    const entries = doc().flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    const bySub = Object.fromEntries(entries.map(e => [e.when.submutations[0], e]));
    expect(Object.keys(bySub).sort((a, b) => a - b)).toEqual(["2", "3", "4", "5", "7", "8", "9", "10"]);
    expect([bySub["2"].condKey, bySub["3"].condKey, bySub["4"].condKey, bySub["5"].condKey])
      .toEqual(["lostHands", "lostArms", "lostLegs", "lostFeet"]);
    expect([bySub["7"].condKey, bySub["8"].condKey, bySub["9"].condKey, bySub["10"].condKey])
      .toEqual(["lostHands", "lostArms", "lostLegs", "lostFeet"]);
    for (const e of entries) {
      expect(e).toEqual(expect.objectContaining({ kind: "condition", condMode: "apply", condDurationUnit: "" }));
    }
  });
});
