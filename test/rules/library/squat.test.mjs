// test/rules/library/squat.test.mjs
//
// Сверка расы Скват с корбуком (глава I). Перенесено из PR #528 (7be36fbc8),
// адаптировано к реализации main (rules/squat-traits.mjs, Void in Veins
// PIbpL2lzqGFcW0LY). Дополняет test/rules/squat-traits.test.mjs: здесь —
// проверки данных паков расы и Черт.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { SURE_TREAD } from "../../../module/rules/squat-traits.mjs";

const RACE = packDocById("packs-src/races/Другие_Ксеносы", "KcqfkjljcbTNVEAW");
const SURE = packDocById("packs-src/traits", "RZ8eDsBa4H4r9l99");
const VOID = packDocById("packs-src/traits", "PIbpL2lzqGFcW0LY");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const actorWith = items => ({ system: { race: "squat", characteristics: {}, conditions: {} }, items });

describe("раса Скват против книги", () => {
  it("Common Lore — любые 4; Trade — любые 2 +10", () => {
    const sk = entries(RACE).filter(e => e.kind === "skill");
    expect(sk.find(e => e.skillKey === "commonLore").specChoiceCount).toBe(4);
    expect(sk.find(e => e.skillKey === "trade")).toMatchObject({ specChoiceCount: 2, rank: "trained" });
  });

  it("Черты: есть Void in Veins, ссылка ведёт на существующий документ", () => {
    const tr = entries(RACE).find(e => (e.sourceName || "").startsWith("Void in Veins"));
    expect(tr.sourceUuid).toBe("Compendium.warhammer-dbc.traits.Item.PIbpL2lzqGFcW0LY");
    expect(VOID.name).toBe("Void in Veins / Пустота в Венах");
  });
});

describe("Черты Сквата", () => {
  it("Надёжная Поступь: −1 SPD один раз (без остатка миграции) и Awareness в ландшафте", () => {
    expect((SURE.effects || []).some(e => e.system.changes.some(c => c.key === "system.speed"))).toBe(false);
    expect(entries(SURE).filter(e => e.kind === "movement").map(e => e.movementValue)).toEqual([-1]);
    expect(hasRuleFlag(actorWith([SURE]), SURE_TREAD)).toBe(true);
  });
});
