// test/data/reactions-migration.test.mjs
//
// system.reactions было свободным текстом («2 (Талант X)» — памятка игрока),
// стало схемой экономики Реакций {value, max, defenseValue, defenseMax}.
// Без миграции SchemaField._cast молча выбрасывал строку — записка пропадала
// навсегда. migrateReactionsString переносит непустой текст в system.notes и
// отдаёт поле схеме под значения по умолчанию.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { migrateReactionsString } from "../../module/data/actor/_creature.mjs";

describe("migrateReactionsString", () => {
  it("непустая строка уезжает в notes, поле очищается под схему", () => {
    const src = { reactions: "2 (Талант Combat Master)", notes: "<p>старое</p>" };
    migrateReactionsString(src);
    expect(src.reactions).toBeUndefined();
    expect(src.notes).toContain("старое");
    expect(src.notes).toContain("2 (Талант Combat Master)");
  });

  it("пустая строка просто очищается, notes не трогается", () => {
    const src = { reactions: "", notes: "" };
    migrateReactionsString(src);
    expect(src.reactions).toBeUndefined();
    expect(src.notes).toBe("");
  });

  it("новый формат (объект) проходит нетронутым", () => {
    const src = { reactions: { value: 1, max: 1 }, notes: "" };
    migrateReactionsString(src);
    expect(src.reactions).toEqual({ value: 1, max: 1 });
  });

  it("без поля — ничего не делает", () => {
    const src = { notes: "" };
    migrateReactionsString(src);
    expect(src.reactions).toBeUndefined();
    expect(src.notes).toBe("");
  });
});
