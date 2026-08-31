// test/rules/library/patronage.test.mjs
//
// wdbc-l07y: иммунитет к Грозному Воплю у посвящённых Слаанеш — раньше
// сравнение system.patronGod==='slaanesh' прямо в module/combat/dread-wail.mjs,
// теперь возможность dreadWail.immune, раздаваемая правилом по Покровительству
// (module/rules/library/patronage.mjs, источник "patron" в rules/sources.mjs).

import { describe, it, expect } from "vitest";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { SLAANESH_RULES, PATRON_RULES } from "../../../module/rules/library/patronage.mjs";

const actor = (patronGod) => ({ system: { patronGod }, items: [] });

describe("dreadWail.immune — по Покровительству Бога", () => {
  it("Слаанеш получает иммунитет", () => {
    expect(hasRuleFlag(actor("slaanesh"), "dreadWail.immune")).toBe(true);
  });

  it("другие Боги и Неделимый — нет", () => {
    expect(hasRuleFlag(actor("khorne"), "dreadWail.immune")).toBe(false);
    expect(hasRuleFlag(actor("nurgle"), "dreadWail.immune")).toBe(false);
    expect(hasRuleFlag(actor("tzeentch"), "dreadWail.immune")).toBe(false);
    expect(hasRuleFlag(actor("undivided"), "dreadWail.immune")).toBe(false);
    expect(hasRuleFlag(actor(""), "dreadWail.immune")).toBe(false);
  });

  it("PATRON_RULES.slaanesh — тот же массив, что SLAANESH_RULES", () => {
    expect(PATRON_RULES.slaanesh).toBe(SLAANESH_RULES);
  });
});
