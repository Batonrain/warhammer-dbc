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
    await _performSwerve(actor, { extraMod: 0 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж успешен");
    expect(card).toContain("Атака промахивается");
    expect(card).not.toContain("снимает");
  });

  it("Успех меньше числа попаданий — снимает часть, остальные проходят", async () => {
    const actor = vehicle();
    await _performSwerve(actor, { extraMod: 0, hitsCount: 3 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж успешен");
    expect(card).toContain("снимает 1 из 3 попадания");
    expect(card).toContain("2 попадания всё ещё проходит");
  });

  it("Провал — все попадания очереди проходят", async () => {
    captured.dice = [96];
    const actor = vehicle();
    await _performSwerve(actor, { extraMod: 0, hitsCount: 4 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вираж провален");
    expect(card).toContain("Все 4 попадания проходят");
  });
});

// wdbc-2ny6 (решение владельца 23.09.2026): по книге Вираж — «Действие:
// Реакция», бросает водитель. Раньше Реакция не тратилась вовсе, и
// бесплатный Вираж был всегда выгоднее платного Уклонения Шагохода.
describe("_performSwerve тратит Реакцию водителя (wdbc-2ny6)", () => {
  const driver = (reactions) => {
    const a = { uuid: "Actor.driver", name: "Мехвод", type: "character",
      system: { reactions: { value: reactions, max: 1 }, conditions: {} },
      getFlag: () => undefined, updates: [] };
    a.update = async u => { a.updates.push(u); if (u["system.reactions.value"] !== undefined) a.system.reactions.value = u["system.reactions.value"]; };
    return a;
  };
  const crewed = () => vehicle({ stations: [{ id: "s1", role: "driver", uuid: "Actor.driver", name: "Мехвод" }] });
  let realFromUuid;
  beforeEach(() => { realFromUuid = globalThis.fromUuid; globalThis.game.combat = { started: true }; });
  const restore = () => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; };

  it("водитель с Реакцией — Реакция списана, бросок идёт", async () => {
    const d = driver(1);
    globalThis.fromUuid = async u => (u === "Actor.driver" ? d : null);
    try { await _performSwerve(crewed()); } finally { restore(); }
    expect(d.system.reactions.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Вираж");
  });

  it("у водителя нет Реакций — Виража нет, броска нет", async () => {
    const d = driver(0);
    globalThis.fromUuid = async u => (u === "Actor.driver" ? d : null);
    try { await _performSwerve(crewed()); } finally { restore(); }
    expect(captured.rolls).toEqual([]);
  });

  it("экипаж не назначен — Вираж по Operate машины, с пометкой, что Реакция не списана", async () => {
    try { await _performSwerve(vehicle()); } finally { restore(); }
    expect(captured.chat.at(-1).content).toContain("Реакция не списана");
  });
});
