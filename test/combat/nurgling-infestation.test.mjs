// test/combat/nurgling-infestation.test.mjs
//
// Заражение Нурглингами (Дар Нургла, wdbc-1rno): пропущенный удар выпускает
// Нурглингов — 1 / 1d5 (урон 3+) / 1d10 (урон 7+).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  nurglingCountFormula, processNurglingInfestation, NURGLING_INFESTATION
} from "../../module/combat/nurgling-infestation.mjs";

function bearer(key = NURGLING_INFESTATION) {
  const items = key ? [{
    id: "gift", type: "mutation", name: "Nurgling Infestation",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }] : [];
  return { name: "Чемпион", type: "character", system: {},
           items: Object.assign(items.slice(), { contents: items }) };
}

describe("nurglingCountFormula", () => {
  it("урона не было — манифестации нет", () => {
    expect(nurglingCountFormula(0)).toBe(null);
    expect(nurglingCountFormula(-3)).toBe(null);
  });
  it("1-2 непоглощённых — ровно один, без броска", () => {
    expect(nurglingCountFormula(1)).toBe("1");
    expect(nurglingCountFormula(2)).toBe("1");
  });
  it("порог 3 включительно — 1d5", () => {
    expect(nurglingCountFormula(3)).toBe("1d5");
    expect(nurglingCountFormula(6)).toBe("1d5");
  });
  it("порог 7 включительно — 1d10", () => {
    expect(nurglingCountFormula(7)).toBe("1d10");
    expect(nurglingCountFormula(40)).toBe("1d10");
  });
});

describe("processNurglingInfestation", () => {
  beforeEach(() => { resetCaptured(); captured.dice = []; });

  it("лёгкий удар — карточка без броска", async () => {
    await processNurglingInfestation(bearer(), 2);
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("<b>1</b>");
  });

  it("удар 3+ — бросок 1d5", async () => {
    captured.dice = [4];
    await processNurglingInfestation(bearer(), 5);
    expect(captured.rolls).toEqual(["1d5"]);
    expect(captured.chat[0].content).toContain("<b>4</b>");
  });

  it("удар 7+ — бросок 1d10", async () => {
    captured.dice = [9];
    await processNurglingInfestation(bearer(), 12);
    expect(captured.rolls).toEqual(["1d10"]);
    expect(captured.chat[0].content).toContain("<b>9</b>");
  });

  it("урон поглощён целиком — ничего не происходит", async () => {
    await processNurglingInfestation(bearer(), 0);
    expect(captured.chat).toEqual([]);
  });

  it("нет Дара — ничего не происходит даже при тяжёлом ударе", async () => {
    await processNurglingInfestation(bearer(null), 20);
    expect(captured.chat).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });
});
