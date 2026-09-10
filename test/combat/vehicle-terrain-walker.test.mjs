// test/combat/vehicle-terrain-walker.test.mjs
//
// wdbc-6wzt (Книга Машин, «Walker / Шагоход»): «Трудный Ландшафт замедляет
// Шагоходы как пехоту, но не повреждает». Замедление (двойная стоимость хода)
// уже безусловно считает движок канваса для любого токена в зоне
// (regions/difficult-terrain.mjs) — здесь проверяется только вторая половина
// правила: Провал теста Трудного Ландшафта НЕ должен наносить урон Ходовой
// Шагохода, в отличие от прочих шасси (Колёсная/Гусеничная/Скиммер).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { showTerrainDialog } from "../../module/combat/vehicle.mjs";

function vehicle(walker, overrides = {}) {
  return {
    type: "vehicle",
    name: walker ? "Ланцелот" : "Саламандра",
    system: {
      operate: 30,
      armour: { side: 10 },
      structure: { value: 20, critical: 0 },
      derived: { walker, traitFlags: {} },
      ...overrides
    },
    id: "veh1",
    getActiveTokens: () => [],
    update: async () => {}
  };
}

beforeEach(() => {
  resetCaptured();
});

describe("Трудный Ландшафт — Шагоход не получает урон (wdbc-6wzt)", () => {
  it("Шагоход, Провал теста — Ходовая НЕ повреждена, кнопки урона нет", async () => {
    captured.dice = [90]; // высокий бросок → Провал против Порога 30-15=15
    const actor = vehicle(true);
    await showTerrainDialog(actor);
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#tr-op": "30", "#tr-terrain": "-15", "#tr-man": "0", "#tr-mod": "0" }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Ходовая не повреждена");
    expect(card).not.toContain("wh-vehicle-track-dmg-btn");
    expect(card).not.toContain("Непоглощаемый урон в Ходовую");
  });

  it("Гусеничная (не Шагоход), тот же Провал — Ходовая получает урон как раньше", async () => {
    captured.dice = [90];
    const actor = vehicle(false);
    await showTerrainDialog(actor);
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#tr-op": "30", "#tr-terrain": "-15", "#tr-man": "0", "#tr-mod": "0" }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-vehicle-track-dmg-btn");
    expect(card).toContain("Непоглощаемый урон в Ходовую");
  });

  it("Шагоход, Успех — как обычно, без урона (совпадает с прочими шасси)", async () => {
    captured.dice = [10]; // низкий бросок → Успех против Порога 15
    const actor = vehicle(true);
    await showTerrainDialog(actor);
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#tr-op": "30", "#tr-terrain": "-15", "#tr-man": "0", "#tr-mod": "0" }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Успех");
    expect(card).toContain("Ходовая не повреждена");
  });
});
