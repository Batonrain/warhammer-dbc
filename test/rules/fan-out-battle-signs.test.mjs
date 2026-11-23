// Разбежаться! и Боевые Жесты (остаток Талантов, 20.11.2026).
import { describe, it, expect, afterEach } from "vitest";
import { commandBlockReason, battleSignsReach } from "../../module/rules/command.mjs";
import { hasSpeedTalent, FAN_OUT_FLAG } from "../../module/rules/speed-talents.mjs";
import { fanOutCount } from "../../module/combat/fan-out.mjs";

const deaf = { uuid: "Actor.d", type: "character", system: { conditions: { deafened: true } }, items: [] };
const boss = signs => ({ uuid: "Actor.b", type: "character", items: signs ? [{ type: "talent", name: "Battle Signs / Боевые Жесты" }] : [] });
const squad = { type: "squad", system: { posts: { commander: { uuid: "Actor.b" } }, members: [{ uuid: "Actor.d" }] } };

describe("Боевые Жесты", () => {
  it("Оглохший получает Команды, если командир знает Жесты", () => {
    expect(battleSignsReach(deaf, [squad, boss(true), deaf])).toBe(true);
    expect(commandBlockReason(deaf, [squad, boss(true), deaf])).toBe("");
  });
  it("без Таланта — Оглох", () => expect(commandBlockReason(deaf, [squad, boss(false), deaf])).toBe("Оглох"));
});

describe("Разбежаться!", () => {
  afterEach(() => { delete globalThis.game; });
  it("Reposition только в бою, отмеченном меткой", () => {
    const a = { items: [], flags: { "warhammer-dbc": { [FAN_OUT_FLAG]: "c1" } } };
    globalThis.game = { combat: { id: "c1" } };
    expect(hasSpeedTalent(a, "reposition")).toBe(true);
    globalThis.game = { combat: { id: "c2" } };
    expect(hasSpeedTalent(a, "reposition")).toBe(false);
  });
  it("до Успехи, не больше отряда", () => {
    expect(fanOutCount(3, 2)).toBe(2);
    expect(fanOutCount(1, 5)).toBe(1);
  });
});
