// test/apps/mechanics-equip-availability-cap.test.mjs
//
// defiance-talents-library-mjs-984, п.2 (решение владельца 24.10.2026): выбор
// «Снаряжение: выбор» Конструктора ставит фильтр потолка Редкости ТОЛЬКО при
// потолке меньше 5. «Любая Редкость» (5, умолчание blankEntry) = без потолка —
// иначе 26 имплантов без Редкости (compendium-filters.mjs::maxAvailability
// отбрасывает «не-рейтинговые» предметы) не попали бы в список выбора.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";

const browser = vi.hoisted(() => ({ opts: [] }));
vi.mock("../../module/apps/compendium-browser.mjs", async importOriginal => {
  const real = await importOriginal();
  return { ...real, openCompendiumBrowser: async (_pick, opts) => { browser.opts.push(opts); return null; } };
});

import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

beforeEach(() => {
  browser.opts = [];
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

const choiceEntry = (maxAvail) => ({
  id: "e1", kind: "equipment", equipMode: "choice", equipCategoryPack: "implants",
  equipQty: 1, equipBudgetMode: "count", equipBudgetValue: 1, equipMaxAvailability: maxAvail
});

function itemOnActor(mechanics) {
  const flags = { mechanics };
  const actor = new Actor();
  actor.system = { characteristics: {}, skills: {}, groupSkills: {}, wounds: { max: 10 } };
  actor.items = [];
  actor.update = async () => {};
  actor.createEmbeddedDocuments = async (_t, docs) => docs;
  const item = {
    id: "item-1", type: "mutation", name: "Выбор", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async () => []
  };
  return item;
}

async function filtersFor(maxAvail) {
  browser.opts = [];
  await applyItemMechanics(itemOnActor([{ id: "g1", operator: "AND", entries: [choiceEntry(maxAvail)] }]));
  expect(browser.opts).toHaveLength(1);
  return browser.opts[0].filters;
}

describe("потолок Редкости в выборе снаряжения", () => {
  it("«Любая» (5): фильтра потолка нет — импланты без Редкости остаются в списке", async () => {
    expect(await filtersFor(5)).not.toHaveProperty("maxAvailability");
  });

  it("потолок ниже 5 ставит фильтр: 0 («Дефицит») и −2", async () => {
    expect((await filtersFor(0)).maxAvailability).toBe(0);
    expect((await filtersFor(-2)).maxAvailability).toBe(-2);
  });

  it("потолок 4 («Уникально» ниже) — тоже фильтр", async () => {
    expect((await filtersFor(4)).maxAvailability).toBe(4);
  });

  it("не число или пусто в записи — фильтра нет (как и прежде)", async () => {
    expect(await filtersFor("abc")).not.toHaveProperty("maxAvailability");
    expect(await filtersFor(undefined)).not.toHaveProperty("maxAvailability");
  });
});
