// Двойная Судьба (Ворон): переброс WS за Очко хуже — остаётся исходный.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { twinFateApplies, twinFateWorse } from "../../module/rules/twin-fate.mjs";

const raven = { items: [{ type: "talent", name: "Twin Fate / Двойная Судьба" }] };

describe("Двойная Судьба", () => {
  it("только свой переброс атаки WS", () => {
    expect(twinFateApplies(raven, { charKey: "ws" })).toBe(true);
    expect(twinFateApplies(raven, { charKey: "bs" })).toBe(false);
    expect(twinFateApplies(raven, { charKey: "ws", champion: true })).toBe(false);
    expect(twinFateApplies({ items: [] }, { charKey: "ws" })).toBe(false);
  });
  it("сравнение исходов", () => {
    const S = d => ({ success: true, deg: d }), F = d => ({ success: false, deg: d });
    expect(twinFateWorse(S(1), F(1))).toBe(true);
    expect(twinFateWorse(F(1), S(1))).toBe(false);
    expect(twinFateWorse(S(3), S(2))).toBe(true);
    expect(twinFateWorse(S(2), S(2))).toBe(false);
    expect(twinFateWorse(F(1), F(3))).toBe(true);
    expect(twinFateWorse(F(3), F(1))).toBe(false);
  });
});

describe("стыковка: исходный бросок Двойной Судьбы не переходит в контекст карточки (приёмка #597)", () => {
  it("attack.mjs выкидывает twinFate из storedOpts, как forcedRoll и updateMessageId", () => {
    const src = fs.readFileSync(new URL("../../module/combat/attack.mjs", import.meta.url), "utf8");
    expect(src).toMatch(/const \{ forcedRoll, updateMessageId, \.\.\.storedOptsBase \} = opts;\s+delete storedOptsBase\.twinFate;/);
  });
});
