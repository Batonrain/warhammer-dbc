// test/combat/climb-rope.test.mjs
//
// Карабканье — спуск на верёвке (стр. 29), раньше отсутствовал целиком:
// Athletics+10, 10+3×Усп. м. На 1 Провал — 5м без падения. На 2+ Провала —
// отдельный тест на S+0 (сырая Сила) или падение со стартовой позиции.
// wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _resolveClimb } from "../../module/combat/movement-actions.mjs";

function actor({ fatigue = 0, sTotal = 35 } = {}) {
  return {
    name: "Подставной", items: [],
    system: { fatigue: { value: fatigue, max: 0 }, characteristics: { s: { total: sTotal } } }
  };
}

beforeEach(resetCaptured);

describe("_resolveClimb: спуск на верёвке (стр. 29)", () => {
  it("успех — спускается на 10+3×Усп. м", async () => {
    captured.dice = [35]; // порог Athletics+10 = 50, diff 15 → 2 ст. успеха
    await _resolveClimb(actor(), "rope", 40, 0, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Успех");
    expect(html).toContain("16м"); // 10 + 3×2
  });

  it("провал на 1 ст. — спускается на 5м, не падает", async () => {
    captured.dice = [55]; // порог 50, diff 5 → 1 ст. провала
    await _resolveClimb(actor(), "rope", 40, 0, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Провал (1 ст.)");
    expect(html).toContain("5м, не падает");
    expect(captured.rolls.length).toBe(1); // второй тест (S+0) не бросался
  });

  it("провал на 2+ ст., тест S+0 успешен — удержался, не упал", async () => {
    captured.dice = [71, 20]; // порог 50, diff 21 → 3 ст.; S-тест 20 ≤ 35
    await _resolveClimb(actor({ sTotal: 35 }), "rope", 40, 0, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Провал (3 ст.)");
    expect(html).toContain("удержался");
    expect(html).not.toContain("падает со стартовой позиции");
  });

  it("провал на 2+ ст., тест S+0 тоже провален — падает со стартовой позиции", async () => {
    captured.dice = [71, 90]; // порог 50, diff 21 → 3 ст.; S-тест 90 > 35
    await _resolveClimb(actor({ sTotal: 35 }), "rope", 40, 0, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("падает со стартовой позиции!");
  });
});
