// test/combat/vehicle-swerve.test.mjs
//
// Вираж — Реакция уклонения техникой (module/combat/vehicle.mjs), устроена
// как обычное пешее Уклонение (стр. книги про машины): при Успехе попадание
// становится промахом, без встречной проверки со степенью атакующего.
// Против Очереди (несколько попаданий) Успех снимает их по одному за степень.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _performSwerve } from "../../module/combat/vehicle.mjs";

function vehicle(overrides = {}) {
  return {
    type: "vehicle",
    name: "Chimera",
    system: {
      operate: 45, size: 3, derived: { swerveMod: -30 }, // −Размер×10
      ...overrides
    }
  };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10]; // Порог 45−30=15 по умолчанию → гарантированный успех
});

describe("_performSwerve: несколько попаданий (Очередь)", () => {
  it("одно попадание (по умолчанию) — текст как у обычного Виража", async () => {
    const actor = vehicle();
    await _performSwerve(actor, 0);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж успешен");
    expect(card).toContain("Атака промахивается");
    expect(card).not.toContain("снимает");
  });

  it("Успех меньше числа попаданий — снимает часть, остальные проходят", async () => {
    const actor = vehicle();
    await _performSwerve(actor, 0, 3);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж успешен");
    expect(card).toContain("снимает 1 из 3 попадания");
    expect(card).toContain("2 попадания всё ещё проходит");
  });

  it("Провал — все попадания очереди проходят", async () => {
    captured.dice = [96];
    const actor = vehicle();
    await _performSwerve(actor, 0, 4);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж провален");
    expect(card).toContain("Все 4 попадания проходят");
  });
});
