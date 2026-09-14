// test/combat/eater-of-pain-damage.test.mjs
//
// Eater of Pain / Пожиратель Боли (wdbc-1rno, Слаанеш): интеграция в
// combat/damage.mjs — кнопка «бросок 1d10+1» появляется в карточке крита
// для каждого найденного носителя. Геометрия (кто физически рядом) уже
// покрыта test/rules/eater-of-pain.test.mjs — здесь мокается
// eaterOfPainHoldersNear() и проверяется только вывод в карточку.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../critical-tables.mjs", () => ({
  getCriticalEffect: () => "Обычный крит-эффект, ничего особенного."
}));

const holdersMock = vi.fn(() => []);
vi.mock("../../module/rules/eater-of-pain.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, eaterOfPainHoldersNear: (...args) => holdersMock(...args) };
});

import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ wounds = -5, critical = 25 } = {}) {
  const activeToken = { id: "victim-token" };
  return {
    id: "victim", name: "Жертва", type: "character", uuid: "Actor.victim",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 0, critical, max: 20 }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    },
    getActiveTokens: () => [activeToken],
    getFlag: () => undefined,
    async setFlag() {}
  };
}

const damage = (over = {}) => ({
  rawDamage: 50, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(() => { resetCaptured(); holdersMock.mockReset(); game.time = { worldTime: 1000 }; });

describe("Eater of Pain: кнопка в карточке крита", () => {
  it("носитель рядом — кнопка появляется с его UUID и значением крита", async () => {
    holdersMock.mockReturnValue([{ token: {}, actor: { uuid: "Actor.eater", name: "Едок" } }]);
    const actor = characterActor({ critical: 25 });
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-eater-of-pain-btn");
    expect(card).toContain('data-eater-uuid="Actor.eater"');
    expect(card).toMatch(/data-crit-value="\d+"/);
    expect(card).toContain("Едок");
  });

  it("несколько носителей рядом — по кнопке на каждого", async () => {
    holdersMock.mockReturnValue([
      { token: {}, actor: { uuid: "Actor.a", name: "А" } },
      { token: {}, actor: { uuid: "Actor.b", name: "Б" } }
    ]);
    const actor = characterActor();
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).toContain('data-eater-uuid="Actor.a"');
    expect(card).toContain('data-eater-uuid="Actor.b"');
  });

  it("носителей рядом нет — кнопки нет вовсе", async () => {
    holdersMock.mockReturnValue([]);
    const actor = characterActor();
    await applyDamageToActor(actor, damage());
    expect(captured.chat.at(-1).content).not.toContain("wh-eater-of-pain-btn");
  });
});
