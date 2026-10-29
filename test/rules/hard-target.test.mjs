// test/rules/hard-target.test.mjs — Трудная Цель (wdbc-1rno.30, стр. 62).
import { describe, it, expect } from "vitest";
import { hardTargetPenalty, FAST_MOVE_FLAG } from "../../module/rules/hard-target.mjs";

const talent = { type: "talent", name: "Hard Target / Трудная Цель", system: {} };
const target = (flags = {}, items = [talent]) => ({ items, flags: { "warhammer-dbc": flags } });

describe("Трудная Цель", () => {
  it("−10 к стрельбе, если цель в этом Ходу бежала, шла в Натиск или Верховую Атаку", () => {
    expect(hardTargetPenalty(target({ [FAST_MOVE_FLAG]: true }))).toBe(-10);
    expect(hardTargetPenalty(target({ running: true }))).toBe(-10);
  });

  it("стояла на месте, рукопашная или нет Таланта — 0", () => {
    expect(hardTargetPenalty(target())).toBe(0);
    expect(hardTargetPenalty(target({ [FAST_MOVE_FLAG]: true }), { isMelee: true })).toBe(0);
    expect(hardTargetPenalty(target({ [FAST_MOVE_FLAG]: true }, []))).toBe(0);
  });

  it("гаситель штрафов за скорость цели снимает −10", () => {
    expect(hardTargetPenalty(target({ running: true }), { speedPenaltyIgnored: true })).toBe(0);
  });

});
