// test/combat/soul-burn-defiance.test.mjs
//
// Defiance / Неповиновение (глава 3, «Пси-Стойкость», Sahara 3-defiance):
// «Преимущество на все встречные тесты против психосил (кроме непрямых),
// выжигания души, атак одержимостью и прочих Варп-эффектов, вызванных
// Ненавистными врагами». Тест Сопротивления психосиле закрыт правилом
// hatred.defiance с радиокнопкой в окне. Выжигание Души (hooks.mjs::
// _executeSoulBurn) диалога не имеет — решение владельца 23.10.2026: переброс
// «лучший из двух» берётся автоматически, когда у цели есть Defiance, а
// псайкер — из целей её Ненависти.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { psychicResistReroll } from "../../module/rules/psychic-resist-reroll.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const { _executeSoulBurn } = await import("../../module/hooks.mjs");

const talent = (name, system = {}) => ({ type: "talent", name, system, flags: {} });
const hatred = targets => talent("Hatred / Ненависть", { targets });
const defiance = () => talent("Defiance / Неповиновение");

/** Псайкер: W 60, ПР 2 → порог 70. race — для сверки с целями Ненависти. */
const caster = race => ({
  id: "psy1", name: "Псайкер", uuid: "Actor.psy1", type: "character", items: [], getFlag: () => undefined,
  system: { race, characteristics: { wp: { total: 60 } }, psyker: { currentRating: 2 } }
});

/** Жертва: W 30, ПР 0 → порог 30. */
function victim(items = []) {
  return {
    id: "vic1", name: "Жертва", uuid: "Actor.vic1", type: "character", items, getFlag: () => undefined,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { total: 30, bonus: 3 }, t: { bonus: 4, total: 40 }, int: { bonus: 5, total: 50 } },
      psyker: { currentRating: 0 }, wounds: { value: 20, critical: 0, max: 20 }
    },
    async update() {}
  };
}

const hated = [raceTarget("ork", "Орк")];
const d100Rolls = () => captured.rolls.filter(f => f === "1d100");

beforeEach(resetCaptured);

describe("psychicResistReroll: переброс цели на тесте Воли против кастера", () => {
  it("Defiance + Ненавистный кастер → «лучший из двух»", () => {
    const r = psychicResistReroll(victim([hatred(hated), defiance()]), caster("ork"));
    expect(r).toMatchObject({ mode: "keepBest", rolls: 2 });
  });

  it("кастер не из Ненавистных — переброса нет", () => {
    expect(psychicResistReroll(victim([hatred(hated), defiance()]), caster("human"))).toBeNull();
  });

  it("без Defiance — переброса нет (одной Ненависти мало)", () => {
    expect(psychicResistReroll(victim([hatred(hated)]), caster("ork"))).toBeNull();
  });

  it("без Ненависти — переброса нет", () => {
    expect(psychicResistReroll(victim([defiance()]), caster("ork"))).toBeNull();
  });

  it("«Непрямая» сила исключена, как и в окне Сопротивления", () => {
    expect(psychicResistReroll(victim([hatred(hated), defiance()]), caster("ork"), { psychicIndirect: true })).toBeNull();
  });
});

describe("Выжигание Души: Неповиновение бросает дважды и берёт лучший", () => {
  // Порог псайкера 70, цели 30. Псайкер выбрасывает 10 → 7 Успехов (6+1).
  it("с Defiance и Ненавистным кастером цель бросает ДВА d100 и берёт меньший", async () => {
    // псайкер 10; цель 90 (провал) и 25 (успех, 1 ст.) → лучший 25
    captured.dice = [10, 90, 25, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster("ork"), victim([hatred(hated), defiance()]));
    expect(d100Rolls()).toHaveLength(3);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Неповиновение");            // подпись переброса в карточке
    expect(card).toContain("25");                       // взят лучший
    // чистых Успехов 7 − 1 = 6 → 6d10
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["6d10"]);
  });

  it("лучший — именно МЕНЬШИЙ бросок, порядок выпадения не важен", async () => {
    captured.dice = [10, 25, 90, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster("ork"), victim([hatred(hated), defiance()]));
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["6d10"]);
  });

  it("без Defiance — один бросок цели, как раньше", async () => {
    captured.dice = [10, 90, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster("ork"), victim([hatred(hated)]));
    expect(d100Rolls()).toHaveLength(2);
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["7d10"]);
  });

  it("Defiance, но кастер не из Ненавистных — один бросок цели", async () => {
    captured.dice = [10, 90, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster("human"), victim([hatred(hated), defiance()]));
    expect(d100Rolls()).toHaveLength(2);
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["7d10"]);
  });

  it("худший из двух не берётся: оба броска цели провальны — результат цели провал, а урон полный", async () => {
    // цель 80 и 95 при пороге 30: переброс не спасает, чистых Успехов 7
    captured.dice = [10, 80, 95, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster("ork"), victim([hatred(hated), defiance()]));
    expect(d100Rolls()).toHaveLength(3);
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["7d10"]);
  });
});
