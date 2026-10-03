// test/rules/library/ogryn-traits.test.mjs
//
// Сверка расы Огрин и комплексного Трейта Миньона «Ogryn» с корбуком
// (глава I): паки не дублируют то, что уже выдаёт Brute Physiology.
// Перенесено из PR #528 (451f307ce); сами правила Черт Brute Physiology и
// BONE-Head в main устроены иначе и покрыты своими тестами
// (ogryn-regen, bone-head, ogryn-race-vs-book).

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";

describe("паки Огрина против книги", () => {
  it("у расы нет Черт Сквата (Clever Hands, Hard as Stone)", () => {
    const race = packDocById("packs-src/races/Люди", "tjQaSHFHxbt1tvWU");
    const names = race.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.sourceName);
    expect(names).toContain("Brute Physiology / Физиология Громилы");
    expect(names).toContain("BONE-Head / Костеголов");
    expect(names).not.toContain("Clever Hands / Умные Руки");
    expect(names).not.toContain("Hard as Stone / Крепкий как Камень");
  });

  it("Трейт Миньона «Ogryn»: +15 Ран только через Brute Physiology, без надбавки к Бонусам", () => {
    const t = packDocById("packs-src/traits", "0r0IX0R5hhdJ1gzj");
    const entries = t.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "wounds")).toBe(false);
    const keys = t.effects.flatMap(e => e.system.changes.map(c => c.key));
    expect(keys.some(k => k.endsWith(".bonusFx"))).toBe(false);
    expect(keys).toContain("system.characteristics.s.totalFx");
  });
});
