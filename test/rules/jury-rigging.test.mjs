// На Честном Слове (Разобрать 6wmql).
import { describe, it, expect } from "vitest";
import { qualityStepDown, juryRiggedOriginal, juryRigBreaks, hasJuryRigging } from "../../module/rules/jury-rigging.mjs";

describe("На Честном Слове", () => {
  it("Качество на ступень ниже, Poor.Q остаётся", () => {
    expect(qualityStepDown("good")).toBe("common");
    expect(qualityStepDown("common")).toBe("poor");
    expect(qualityStepDown("poor")).toBe("poor");
  });
  it("ломается только наспех починенное и только на Крит. Провале", () => {
    const rigged = { flags: { "warhammer-dbc": { juryRigged: { quality: "good" } } } };
    expect(juryRiggedOriginal(rigged)).toBe("good");
    expect(juryRigBreaks(rigged, { failure: true })).toBe(true);
    expect(juryRigBreaks(rigged, { failure: false })).toBe(false);
    expect(juryRigBreaks({ flags: {} }, { failure: true })).toBe(false);
  });
  it("Талант узнаётся по имени", () => {
    expect(hasJuryRigging({ items: [{ type: "talent", name: "Jury Rigging / На Честном Слове" }] })).toBe(true);
  });
});
