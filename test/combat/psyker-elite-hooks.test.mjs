// Окно манифестации: отложенные кнопками Талантов прибавки (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { eliteManifestEpr, eliteManifestAfter } from "../../module/combat/psyker-elite-hooks.mjs";

const NS = "warhammer-dbc";
const mkActor = (pending, items = []) => {
  const a = {
    items, system: { psyker: { rating: 4, currentRating: 4 } },
    flags: { [NS]: { psyPendingManifest: pending } },
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { this.flags[ns][k] = v; },
    async unsetFlag(ns, k) { delete this.flags[ns][k]; }
  };
  return a;
};

describe("eliteManifestEpr", () => {
  it("Пламя Сердца прибавляет, Мощь Переполняет удваивает после; отложенное забрано", async () => {
    const a = mkActor({ heartFire: 3, overwhelming: 4 });
    const opts = {};
    const lines = [];
    expect(await eliteManifestEpr(a, {}, opts, 4, lines)).toBe(14);
    expect(a.flags[NS].psyPendingManifest).toBeUndefined();
    expect(opts.eliteBoost).toMatchObject({ heartFire: 3, overwhelming: 4 });
    expect(lines.length).toBe(2);
  });
  it("переброс берёт прибавки первой попытки, не трогая отложенное", async () => {
    const a = mkActor({ heartFire: 5 });
    const opts = { reroll: true, eliteBoost: { heartFire: 2 } };
    expect(await eliteManifestEpr(a, {}, opts, 3, [])).toBe(5);
    expect(a.flags[NS].psyPendingManifest).toEqual({ heartFire: 5 });
  });
  it("Высший Магус: строка про свой Феномен", async () => {
    const a = mkActor({}, [{ type: "trait", name: "Magus Supreme / Высший Магус" }]);
    const out = await eliteManifestAfter(a, { system: {} }, {}, { phenomena: true });
    expect(out.join("")).toContain("не действует на самого Архимага");
  });
});
