// dbc-262: «Имеет X Очков Судьбы» (core, Трейт Touched by the Fates (X)) — обе
// записи максимума пула (Судьба и Бесчестие) читают рейтинг Черты, а не +1.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

describe("Избранный Судьбой (X)", () => {
  it("записи poolMax считают рейтинг X", () => {
    const doc = packDocById("packs-src/traits", "7Tz0S9YauS3p9iKN");
    const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "poolMax");
    expect(entries.length).toBe(2);
    for (const e of entries) expect(e.value).toBe("rating");
  });
});
