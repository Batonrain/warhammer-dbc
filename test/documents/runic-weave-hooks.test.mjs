// test/documents/runic-weave-hooks.test.mjs
//
// wdbc-unku: три Рунические Вязи с реально существующим hook-point получили
// читателя эффекта (носитель уже работал — не хватало только точки применения
// в целевой подсистеме). Проверяются все три через тот же общий hasRuleFlag()
// (module/rules/flags.mjs), которым уже пользуется остальная библиотека Локусов.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { doMiraculousSave } from "../../module/sheets/tabs/death.mjs";

const SYSTEM = "warhammer-dbc";

/** Предмет-носитель с одной Механикой kind:"capability" — как реальная Вязь. */
function runicWeaveGranting(capabilityKey) {
  return {
    id: "rw1", name: "Тестовая Вязь", type: "runicWeave",
    // installedOnType:"vehicle" — самый короткий путь через isItemActive()
    // (module/apps/effects.mjs): считается активной без host-цепочки.
    system: { installedOnType: "vehicle" },
    flags: { [SYSTEM]: { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey, label: "" }
    ] }] } },
    getFlag: () => undefined
  };
}

beforeEach(resetCaptured);

describe("Руническая Вязь «Стальной Гриммуар» — снимает штраф −1 эPR", () => {
  function psykerWith({ rating = 5, sustained = [], weave = false } = {}) {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.psyker = { rating, currentRating: 0, sustain: 0, ratingFromTalent: false };
    const items = sustained.map((cost, i) => ({
      id: `p${i}`, type: "psychicPower", system: { isSustained: true, sustainCost: cost },
      getFlag: () => undefined
    }));
    if (weave) items.push(runicWeaveGranting("runicWeave.steelGrimoire"));
    const list = [...items];
    list.get = id => items.find(i => i.id === id) ?? null;
    const actor = { type: "character", name: "Псайкер", system, items: list, getFlag: () => undefined };
    WarhammerActor.prototype.prepareDerivedData.call(actor);
    return system;
  }

  it("без Вязи — обычный полный штраф суммарной стоимости поддержания", () => {
    const s = psykerWith({ rating: 5, sustained: [1, 2] });
    expect(s.psyker.sustain).toBe(3);
    expect(s.psyker.currentRating).toBe(2); // 5 − 3
  });

  it("с Вязью — суммарная стоимость поддержания снижена на 1", () => {
    const s = psykerWith({ rating: 5, sustained: [1, 2], weave: true });
    expect(s.psyker.sustain).toBe(2); // 3 − 1
    expect(s.psyker.currentRating).toBe(3); // 5 − 2
  });

  it("ничего не поддерживается — Вязь не создаёт штраф из ничего (не уходит в минус)", () => {
    const s = psykerWith({ rating: 5, sustained: [], weave: true });
    expect(s.psyker.sustain).toBe(0);
    expect(s.psyker.currentRating).toBe(5);
  });
});

describe("Руническая Вязь «Прах Феникса» — Чудесное Спасение тратит только 1d5 Порчи", () => {
  function deceasedActor({ fate = 30, corruption = 0, weave = false } = {}) {
    const items = weave ? [runicWeaveGranting("runicWeave.ashesOfThePhoenix")] : [];
    const list = [...items];
    list.get = id => items.find(i => i.id === id) ?? null;
    const updates = [];
    return {
      id: "a1", name: "Обречённый", type: "character",
      system: {
        alignment: "loyalist",
        fate: { value: fate }, corruption: { value: corruption },
        wounds: { value: -5, critical: 5, max: 10 }
      },
      items: list, updates,
      getFlag: () => undefined,
      async update(data) { updates.push(data); Object.assign(this, {}); }
    };
  }

  it("без Вязи — обычный 1d10 Порчи (второй бросок в цепочке — корРолл)", async () => {
    captured.dice = [3, 4]; // fateRoll(1d10)=3, corRoll(1d10)=4
    const actor = deceasedActor({ fate: 30, corruption: 10, weave: false });
    await doMiraculousSave(actor);
    expect(captured.rolls[1]).toBe("1d10"); // формула corRoll
    const upd = actor.updates.at(-1);
    expect(upd["system.corruption.value"]).toBe(14); // 10 + 4
  });

  it("с Вязью «Прах Феникса» — 1d5 Порчи вместо 1d10", async () => {
    captured.dice = [3, 2]; // fateRoll(1d10)=3, corRoll(1d5)=2
    const actor = deceasedActor({ fate: 30, corruption: 10, weave: true });
    await doMiraculousSave(actor);
    expect(captured.rolls[1]).toBe("1d5"); // формула corRoll сужена Вязью
    const upd = actor.updates.at(-1);
    expect(upd["system.corruption.value"]).toBe(12); // 10 + 2
  });
});
