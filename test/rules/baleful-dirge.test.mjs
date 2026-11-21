// Мрачный Плач: −10 ко всему кроме T, пока певец поёт (20.11.2026).
import { describe, it, expect } from "vitest";
import { dirgeSinging, underBalefulDirge } from "../../module/rules/baleful-dirge.mjs";
import { BALEFUL_DIRGE_RULES } from "../../module/rules/library/baleful-dirge.mjs";

const singer = f => ({ flags: { "warhammer-dbc": { balefulDirgeSinging: f } } });
const listener = { flags: { "warhammer-dbc": { balefulDirge: { byUuid: "Actor.s" } } } };

describe("Мрачный Плач", () => {
  it("певец поёт в этом и следующем Раунде, потом замолкает", () => {
    const f = { combatId: "c", round: 3 };
    expect(dirgeSinging(singer(f), { id: "c", round: 3 })).toBe(true);
    expect(dirgeSinging(singer(f), { id: "c", round: 4 })).toBe(true);
    expect(dirgeSinging(singer(f), { id: "c", round: 5 })).toBe(false);
    expect(dirgeSinging(singer(f), { id: "other", round: 3 })).toBe(false);
    expect(dirgeSinging(singer({ at: 0 }), null)).toBe(true);
  });
  it("штраф — только пока певец поёт", () => {
    const resolve = s => u => (u === "Actor.s" ? s : null);
    expect(underBalefulDirge(listener, { combat: { id: "c", round: 4 }, resolve: resolve(singer({ combatId: "c", round: 3 })) })).toBe(true);
    expect(underBalefulDirge(listener, { combat: { id: "c", round: 6 }, resolve: resolve(singer({ combatId: "c", round: 3 })) })).toBe(false);
    expect(underBalefulDirge({ flags: {} }, { combat: null, resolve: () => null })).toBe(false);
  });
  it("правило: −10 ко всему, кроме T", () => {
    expect(BALEFUL_DIRGE_RULES[0].when).toMatchObject({ underBalefulDirge: true, charNotIn: ["t"] });
    expect(BALEFUL_DIRGE_RULES[0].effects[0]).toMatchObject({ target: "all", value: -10 });
  });
});
