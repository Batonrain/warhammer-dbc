// test/migrations/disease-active-all.test.mjs
//
// task-3ab7 (решение владельца 26.10.2026). Чумной Пастырь считает заражёнными
// только болезни с system.active === true, а выдавались они выключенными, и первый
// проход (disease-active) включал лишь болезни с механикой. Этот проход включает
// ВСЕ выданные копии без метки diseaseActiveMigrated. Данные — настоящие JSON
// packs-src/diseases.

import { describe, it, expect, afterEach, vi } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { diseaseActiveAllPatch, diseaseActiveAllUpdates, migrateDiseaseActiveAll } from "../../module/migrations/disease-active-all.mjs";
import { diseaseActivePatch } from "../../module/migrations/disease-active.mjs";
import { isInfected } from "../../module/rules/plague-shepherd.mjs";

afterEach(() => { delete globalThis.game; delete globalThis.ui; vi.restoreAllMocks(); });

const SYS = "warhammer-dbc";
const DISEASES = allPackDocuments("diseases").map(d => d.doc);
const hasEntries = d => (d.flags?.[SYS]?.mechanics ?? []).some(g => (g.entries ?? []).length);
const WITHOUT_MECH = DISEASES.filter(d => !hasEntries(d));
const PATCH = { "system.active": true, [`flags.${SYS}.diseaseActiveMigrated`]: true };
const copy = (doc, id = "d1", patch = {}) => ({
  id, type: doc.type, name: doc.name,
  system: { ...structuredClone(doc.system), ...patch }, flags: structuredClone(doc.flags ?? {}), effects: []
});
const apply = (item, patch) => {
  for (const [path, v] of Object.entries(patch ?? {})) {
    const keys = path.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
};

describe("проход «все выданные болезни»", () => {
  it("в паке есть болезни без механики — ради них проход и нужен", () => {
    expect(WITHOUT_MECH.length).toBeGreaterThan(5);
  }, PACK_SCAN_TIMEOUT);

  it("болезнь БЕЗ механики включается (первый проход её не трогал); идемпотентно", () => {
    for (const d of WITHOUT_MECH) {
      const item = copy(d);
      expect(item.system.active, d.name).toBe(false);
      expect(diseaseActivePatch(item), `${d.name}: первый проход`).toBeNull();
      expect(diseaseActiveAllPatch(item), d.name).toEqual(PATCH);
      apply(item, diseaseActiveAllPatch(item));
      expect(diseaseActiveAllPatch(item), `${d.name} повторно`).toBeNull();
    }
  }, PACK_SCAN_TIMEOUT);

  it("копия, уже прошедшая первый проход (метка), и выключенная ГМом после — не включается", () => {
    const item = copy(DISEASES[0]);
    item.flags[SYS] = { ...(item.flags[SYS] ?? {}), diseaseActiveMigrated: true };
    expect(diseaseActiveAllPatch(item)).toBeNull();
  });

  it("уже включённая и не-болезнь не трогаются", () => {
    expect(diseaseActiveAllPatch(copy(WITHOUT_MECH[0], "a", { active: true }))).toBeNull();
    expect(diseaseActiveAllPatch({ id: "g", type: "gear", system: {} })).toBeNull();
    expect(diseaseActiveAllPatch(null)).toBeNull();
    expect(diseaseActiveAllUpdates(undefined)).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("после прохода Чумной Пастырь видит заражённым носителя болезни без механики (свободная Короткая Команда не пропадает)", () => {
    const item = copy(WITHOUT_MECH[0]);
    const actor = { items: [item] };
    expect(isInfected(actor)).toBe(false);
    apply(item, diseaseActiveAllPatch(item));
    expect(isInfected(actor)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});

describe("migrateDiseaseActiveAll: мировые акторы и несвязанные токены", () => {
  const quietUi = () => { globalThis.ui = { notifications: { info: () => {}, warn: () => {} } }; };
  function fakeActor(items) {
    const a = {
      name: "Нурглит", items,
      updateEmbeddedDocuments: vi.fn(async (_t, updates) => {
        for (const u of updates) apply(a.items.find(i => i.id === u._id), Object.fromEntries(Object.entries(u).filter(([k]) => k !== "_id")));
      })
    };
    a.items.get = id => a.items.find(i => i.id === id);
    return a;
  }

  it("мировой актор: выданные болезни включаются, повтор ничего не делает", async () => {
    const item = copy(WITHOUT_MECH[0]);
    const actor = fakeActor([item]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [], items: [copy(WITHOUT_MECH[1], "world")] };
    quietUi();
    expect(await migrateDiseaseActiveAll()).toEqual({ fixed: 1, failed: 0 });
    expect(item.system.active).toBe(true);
    expect(game.items[0].system.active).toBe(false);            // заготовка папки мира без владельца не трогается
    expect(await migrateDiseaseActiveAll()).toEqual({ fixed: 0, failed: 0 });
  }, PACK_SCAN_TIMEOUT);

  it("несвязанный токен: болезнь базового актора не трогается, своя в дельте — включается", async () => {
    const inherited = copy(WITHOUT_MECH[0], "base");
    const own = copy(WITHOUT_MECH[1], "own");
    const synthetic = fakeActor([inherited, own]);
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "С", tokens: { contents: [
      { id: "t", name: "Т", actorLink: false, actor: synthetic, delta: { _source: { items: [{ _id: "own" }] } } }
    ] } }] };
    quietUi();
    await migrateDiseaseActiveAll({ tokensOnly: true });
    expect(inherited.system.active).toBe(false);
    expect(own.system.active).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});
