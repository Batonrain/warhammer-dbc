// test/rules/xp-shortfall.test.mjs
//
// Нехватка опыта при покупке (сверка «Опыт», стр. 23): когда лист спрашивает
// «Взять всё равно?», а когда молчит. Окно и откат выбора проверяют живьём —
// здесь только решение «спрашивать ли».

import { describe, it, expect } from "vitest";
import { xpShortfall, shortfallMessage } from "../../module/rules/xp-shortfall.mjs";

describe("xpShortfall — спрашивать ли", () => {
  it("опыта хватает — молчит", () => {
    expect(xpShortfall(500, 250)).toBeNull();
    // Ровно впритык — тоже хватает, это не «в долг».
    expect(xpShortfall(250, 250)).toBeNull();
  });

  it("не хватает — называет, сколько не хватает", () => {
    expect(xpShortfall(100, 250)).toEqual({ cost: 250, free: 100, lack: 150, negative: false });
  });

  it("опыт уже в минусе — это случай книги, он помечается отдельно", () => {
    // После смены Покровителя пересчёт увёл «Свободно» в минус.
    expect(xpShortfall(-120, 100)).toEqual({ cost: 100, free: -120, lack: 220, negative: true });
  });

  it("нулевая трата и возврат не спрашивают", () => {
    // Снятие уровня даёт отрицательный прирост цены — это возврат, не покупка.
    expect(xpShortfall(-500, 0)).toBeNull();
    expect(xpShortfall(-500, -250)).toBeNull();
  });

  it("мусор вместо чисел не роняет и не спрашивает зря", () => {
    expect(xpShortfall(undefined, undefined)).toBeNull();
    expect(xpShortfall("100", "250")).toMatchObject({ lack: 150 });
  });
});

describe("shortfallMessage", () => {
  it("называет цену и остаток", () => {
    const text = shortfallMessage({ cost: 250, free: 100, negative: false });
    expect(text).toContain("<b>250</b>");
    expect(text).toContain("<b>100</b>");
    expect(text).toContain("Взять всё равно?");
    expect(text).not.toContain("в минусе");
  });

  it("при минусе напоминает правило книги", () => {
    expect(shortfallMessage({ cost: 100, free: -20, negative: true })).toContain("в минусе");
  });
});
