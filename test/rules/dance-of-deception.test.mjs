// test/rules/dance-of-deception.test.mjs
//
// Dance of Deception / Танец Обмана (wdbc-1rno, Слаанеш): альтернативные
// Навыки для Финта — только те, которыми персонаж реально владеет.

import { describe, it, expect } from "vitest";
import { danceOfDeceptionFeintOptions } from "../../module/rules/dance-of-deception.mjs";

function actor({ acrobatics = -20, trade = [] } = {}) {
  return { system: { skills: { acrobatics: { total: acrobatics } }, groupSkills: { trade } } };
}

describe("danceOfDeceptionFeintOptions", () => {
  it("Acrobatics всегда предложен (даже нетренированный, −20)", () => {
    const opts = danceOfDeceptionFeintOptions(actor());
    expect(opts).toEqual([{ key: "dance:acrobatics", label: "Acrobatics(A)+0", value: -20, skillKey: "acrobatics", charKey: "ag" }]);
  });

  it("Trade(Танцор) появляется, только если specKey==='dancer' заведён, +20 к total", () => {
    const opts = danceOfDeceptionFeintOptions(actor({
      acrobatics: 30,
      trade: [{ specialty: "Танцор", specKey: "dancer", total: 45 }]
    }));
    expect(opts).toContainEqual({ key: "dance:trade:0", label: "Trade (Танцор)+20", value: 65, skillKey: "trade", charKey: "ag" });
  });

  it("другие специализации Ремесла (не Танцор) не предлагаются", () => {
    const opts = danceOfDeceptionFeintOptions(actor({
      trade: [{ specialty: "Ювелир", specKey: "jeweler", total: 40 }]
    }));
    expect(opts.some(o => o.key.startsWith("dance:trade:"))).toBe(false);
  });

  it("несколько специализаций Ремесла — индекс в ключе соответствует позиции в списке", () => {
    const opts = danceOfDeceptionFeintOptions(actor({
      trade: [
        { specialty: "Ювелир", specKey: "jeweler", total: 40 },
        { specialty: "Танцор", specKey: "dancer", total: 50 }
      ]
    }));
    expect(opts).toContainEqual({ key: "dance:trade:1", label: "Trade (Танцор)+20", value: 70, skillKey: "trade", charKey: "ag" });
  });

  it("нет groupSkills.trade вовсе — не падает, только Acrobatics", () => {
    expect(danceOfDeceptionFeintOptions({ system: { skills: {} } })).toEqual([
      { key: "dance:acrobatics", label: "Acrobatics(A)+0", value: 0, skillKey: "acrobatics", charKey: "ag" }
    ]);
  });
});
