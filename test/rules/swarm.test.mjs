// dbc-114 (14.11.2026): Рой — половина урона (окр. вверх) до Поглощения от обычных атак.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { swarmDamage, swarmIgnoresHalving } from "../../module/rules/swarm.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

describe("урон по Рою", () => {
  it("обычная атака — половина, округление вверх", () => {
    expect(swarmDamage(10)).toBe(5);
    expect(swarmDamage(11)).toBe(6);
    expect(swarmDamage(1)).toBe(1);
    expect(swarmDamage(0)).toBe(0);
  });
  it("Blast, Flame, Spray, Scatter — полный урон", () => {
    expect(swarmDamage(10, { blast: 2 })).toBe(10);
    expect(swarmDamage(10, { flame: true })).toBe(10);
    expect(swarmDamage(10, { spray: true })).toBe(10);
    expect(swarmDamage(10, { scatter: true })).toBe(10);
  });
  it("нулевой Blast и пустые свойства не отменяют половину", () => {
    expect(swarmIgnoresHalving({ blast: 0, flame: false })).toBe(false);
    expect(swarmDamage(10, { blast: 0 })).toBe(5);
  });
});

describe("данные Роя", () => {
  it("Черта выдаёт способность, у неё есть читатель", () => {
    const dir = path.resolve("packs-src/traits");
    const f = fs.readdirSync(dir).find(x => x.startsWith("Swarm___"));
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const keys = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("damage.swarmHalf");
    expect(CAPABILITIES["damage.swarmHalf"].reader).toBeTruthy();
  });
});
