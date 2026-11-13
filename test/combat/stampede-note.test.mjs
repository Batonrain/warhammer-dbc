// test/combat/stampede-note.test.mjs
//
// dbc-114 / 55-15 (13.11.2026): Stampede / Затоптать — подсказка Мастеру в карточке
// ПРОВАЛЕННОГО теста Страха у носителя Трейта (сам сдвиг и Напролом — вручную).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { hasStampede, stampedeNoteHtml } from "../../module/rules/stampede.mjs";

const trait = name => ({ type: "trait", name, system: {} });

function makeActor(items = []) {
  return {
    id: "a1", name: "Зверь", items,
    system: { characteristics: { wp: { total: 40 } }, fatigue: { value: 0, max: 0 }, fate: { value: 0 } },
    getFlag: () => undefined, update: async () => {}, effects: [], createEmbeddedDocuments: async () => []
  };
}

beforeEach(resetCaptured);

describe("опознание Трейта", () => {
  it("по любой половине двуязычного имени; Талант того же имени — нет", () => {
    expect(hasStampede(makeActor([trait("Stampede / Затопот")]))).toBe(true);
    expect(hasStampede(makeActor([trait("Затопот")]))).toBe(true);
    expect(hasStampede(makeActor([{ type: "talent", name: "Stampede", system: {} }]))).toBe(false);
    expect(stampedeNoteHtml(makeActor())).toBe("");
  });
});

describe("карточка теста Страха", () => {
  it("провал у носителя — есть подсказка «Затоптать»", async () => {
    captured.nextRoll = 99;     // гарантированный провал
    await _executeFearRoll(makeActor([trait("Stampede / Затоптать")]), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("Затоптать");
  });
  it("провал у существа без Трейта — подсказки нет", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("Затоптать");
  });
  it("успех у носителя — подсказки нет", async () => {
    captured.nextRoll = 1;      // гарантированный успех
    await _executeFearRoll(makeActor([trait("Stampede / Затоптать")]), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("Затоптать");
  });
});
