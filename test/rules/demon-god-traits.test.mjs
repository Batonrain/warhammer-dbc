// dbc-114 (14.11.2026): божественные Трейты демонов — Кровь Богу Крови (Кхорн), Насмешка над Жизнью (Нургл).
// Фикстуры пака — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  bloodGodDamageBonus, isKillingBlow, mockeryAvailable, dropsBelowZero, mockeryCappedDamage
} from "../../module/rules/demon-god-traits.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const dir = path.resolve("packs-src/traits");
const load = prefix => JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(x => x.startsWith(prefix))), "utf8"));
const capsOf = d => d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);

describe("Кровь Богу Крови", () => {
  it("+2 за убийство, не выше +8", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(bloodGodDamageBonus)).toEqual([0, 2, 4, 6, 8, 8, 8]);
  });
  it("мусор в счётчике — ноль", () => {
    expect(bloodGodDamageBonus(undefined)).toBe(0);
    expect(bloodGodDamageBonus(-3)).toBe(0);
  });
  it("убийство — из строя в строй не вернётся: было > 0, стало ≤ 0", () => {
    expect(isKillingBlow(5, 0)).toBe(true);
    expect(isKillingBlow(5, -2)).toBe(true);
    expect(isKillingBlow(5, 1)).toBe(false);
    expect(isKillingBlow(0, -3)).toBe(false);
  });
});

describe("Насмешка над Жизнью", () => {
  it("срабатывает только когда урон опускает Раны ниже 0", () => {
    expect(dropsBelowZero(5, 5)).toBe(false);
    expect(dropsBelowZero(5, 6)).toBe(true);
    expect(dropsBelowZero(0, 1)).toBe(true);
    expect(dropsBelowZero(5, 0)).toBe(false);
  });
  it("при успехе демон остаётся с 0 Ран: урон = текущие Раны", () => {
    expect(mockeryCappedDamage(7)).toBe(7);
    expect(mockeryCappedDamage(0)).toBe(0);
    expect(mockeryCappedDamage(-2)).toBe(0);
  });
  it("раз в Раунд боя; вне боя — без ограничения", () => {
    expect(mockeryAvailable("c1:3", { id: "c1", round: 3 })).toBe(false);
    expect(mockeryAvailable("c1:3", { id: "c1", round: 4 })).toBe(true);
    expect(mockeryAvailable("c1:3", null)).toBe(true);
  });
});

describe("данные Трейтов", () => {
  it("Кровь Богу Крови выдаёт способность с читателем", () => {
    expect(capsOf(load("Blood_for_the_Blood_God___"))).toContain("damage.bloodForTheBloodGod");
    expect(CAPABILITIES["damage.bloodForTheBloodGod"].reader).toBeTruthy();
  });
  it("Насмешка над Жизнью выдаёт способность и иммунитет к ядам", () => {
    const caps = capsOf(load("Mockery_of_Life___"));
    expect(caps).toContain("wounds.mockeryOfLife");
    expect(caps).toContain("poison.immune");
    expect(CAPABILITIES["wounds.mockeryOfLife"].reader).toBeTruthy();
  });
});
