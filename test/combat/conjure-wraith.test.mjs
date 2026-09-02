// test/combat/conjure-wraith.test.mjs
//
// module/combat/conjure-wraith.mjs (wdbc-sk8s) — Conjure Wraith/Вызвать
// Психокость: простой предмет (Редкость −1) или обычное психокостяное
// рукопашное оружие, без Reinforced, до F.b раз за сессию.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, vi, afterEach } from "vitest";

const { openCompendiumBrowser } = vi.hoisted(() => ({ openCompendiumBrowser: vi.fn() }));
vi.mock("../../module/apps/compendium-browser.mjs", () => ({ openCompendiumBrowser }));

import {
  hasConjureWraith, conjureWraithMax, conjureWraithAvailable, applyConjureWraith
} from "../../module/combat/conjure-wraith.mjs";

function bonesinger({ hasTalent = true, felBonus = 2 } = {}) {
  const flags = {};
  const items = hasTalent ? [{ type: "talent", name: "Conjure Wraith / Вызвать Психокость" }] : [];
  const created = [];
  return {
    name: "Певец", items,
    system: { characteristics: { fel: { bonus: felBonus } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    created,
    async createEmbeddedDocuments(type, docs) { created.push(...docs); return docs; }
  };
}

afterEach(() => { resetCaptured(); openCompendiumBrowser.mockReset(); });

describe("hasConjureWraith / conjureWraithMax / conjureWraithAvailable", () => {
  it("определяет владение Талантом (kind:talent)", () => {
    expect(hasConjureWraith(bonesinger({ hasTalent: true }))).toBe(true);
    expect(hasConjureWraith(bonesinger({ hasTalent: false }))).toBe(false);
  });

  it("лимит — F.b, минимум 1", () => {
    expect(conjureWraithMax(bonesinger({ felBonus: 3 }))).toBe(3);
    expect(conjureWraithMax(bonesinger({ felBonus: 0 }))).toBe(1);
  });

  it("доступность требует и Талант, и запас счётчика сессии", () => {
    const actor = bonesinger({ felBonus: 1 });
    expect(conjureWraithAvailable(actor)).toBe(true);
  });
});

describe("applyConjureWraith", () => {
  it("отмена в браузере (null uuid) — ничего не создаёт", async () => {
    openCompendiumBrowser.mockResolvedValue(null);
    const actor = bonesinger();
    await applyConjureWraith(actor, "item");
    expect(actor.created).toEqual([]);
  });

  it("выбор оружия — снимает Reinforced, отмечает грубее по форме, тратит заряд", async () => {
    openCompendiumBrowser.mockResolvedValue("Compendium.warhammer-dbc.weapons.Item.abc");
    globalThis.fromUuid = async () => ({
      toObject: () => ({
        _id: "abc", name: "Психокостяной Меч", type: "weapon",
        system: { notes: "", weaponProps: [{ key: "reinforced" }, { key: "force" }] }
      })
    });
    const actor = bonesinger({ felBonus: 1 });

    await applyConjureWraith(actor, "weapon");

    expect(actor.created).toHaveLength(1);
    const created = actor.created[0];
    expect(created._id).toBeUndefined();
    expect(created.system.weaponProps).toEqual([{ key: "force" }]);
    expect(created.system.notes).toContain("грубее по форме");
    expect(created.name).toContain("Психокостяной Меч");
    expect(conjureWraithAvailable(actor)).toBe(false); // felBonus 1 → максимум 1, потрачено
    expect(captured.chat.at(-1).content).toContain("Психокостяной Меч");
  });

  it("предмет не найден по uuid — предупреждает и ничего не создаёт", async () => {
    openCompendiumBrowser.mockResolvedValue("Compendium.warhammer-dbc.gear.Item.gone");
    globalThis.fromUuid = async () => null;
    const actor = bonesinger();
    await applyConjureWraith(actor, "item");
    expect(actor.created).toEqual([]);
  });
});
