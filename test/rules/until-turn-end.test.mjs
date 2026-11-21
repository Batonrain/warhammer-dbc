// test/rules/until-turn-end.test.mjs
//
// «Ослеплён до конца своего следующего Хода» (Варп Вспышка Когтя Варпа; Sahara 586-8aaf). Счётчик Раундов
// Состояния тикает в НАЧАЛЕ Хода носителя — 1 Раунд снимал Ослепление ещё до его Хода, и Ход шёл зрячим.
// Теперь срок «до конца своего Хода»: метка на носителе считает концы его Ходов.

import { describe, it, expect } from "vitest";
import {
  UNTIL_TURN_END_FLAG, untilTurnEndAdd, untilTurnEndStep, untilTurnEndHeld
} from "../../module/rules/until-turn-end.mjs";

describe("срок «до конца своего следующего Хода»", () => {
  it("наложено в чужой Ход — снимется в конце ближайшего своего (1 конец)", () => {
    expect(untilTurnEndAdd({}, "blinded", { ownTurn: false })).toEqual({ blinded: 1 });
  });

  it("наложено в свой Ход — этот Ход «следующим» не считается (2 конца)", () => {
    expect(untilTurnEndAdd(null, "blinded", { ownTurn: true })).toEqual({ blinded: 2 });
  });

  it("повторное наложение не укорачивает", () => {
    expect(untilTurnEndAdd({ blinded: 2 }, "blinded", { ownTurn: false })).toEqual({ blinded: 2 });
  });

  it("конец Хода: счётчик −1, на нуле — снять", () => {
    expect(untilTurnEndStep({ blinded: 2, stunned: 1 })).toEqual({ next: { blinded: 1 }, expired: ["stunned"] });
    expect(untilTurnEndStep({ blinded: 1 })).toEqual({ next: null, expired: ["blinded"] });
    expect(untilTurnEndStep(null)).toEqual({ next: null, expired: [] });
  });

  it("Состояние под меткой держит срок само — общий счётчик Раундов его не трогает", () => {
    const actor = { flags: { "warhammer-dbc": { [UNTIL_TURN_END_FLAG]: { blinded: 1 } } } };
    expect(untilTurnEndHeld(actor, "blinded")).toBe(true);
    expect(untilTurnEndHeld(actor, "stunned")).toBe(false);
  });
});

describe("стыковка: Варп Вспышка и кнопка свойства", () => {
  it("кнопка Варп Вспышки несёт срок «до конца своего Хода», обработчик кнопки его читает", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../..");
    expect(fs.readFileSync(path.join(root, "module/combat/warp-talon-talents.mjs"), "utf8")).toContain('data-wp-until-own-turn-end="1"');
    expect(fs.readFileSync(path.join(root, "module/hooks.mjs"), "utf8")).toMatch(/ds\.wpUntilOwnTurnEnd === "1"[\s\S]{0,400}untilTurnEndAdd/);
  });
});
