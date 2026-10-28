// test/migrations/drug-addiction-flag.test.mjs
//
// task-9717 (решение владельца 26.10.2026, вариант A). Зависимость от препарата
// переехала из поля предмета system.addiction.isAddicted в флаг актора
// drugWithdrawal. У уже выданных копий поле стоит true — миграция переносит его
// в запись актора и сбрасывает. Данные — настоящие JSON packs-src/chemistry: поле,
// забытое в снимке настроек, пропало бы у зависимого вместе с удалённым флаконом.

import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import {
  drugAddictionFlagPlan, hasLegacyAddiction, migrateDrugAddictionFlag
} from "../../module/migrations/drug-addiction-flag.mjs";
import { addictionRecords, withdrawalPenaltyRules, drugKey } from "../../module/rules/drug-withdrawal.mjs";

afterEach(() => { delete globalThis.game; delete globalThis.ui; vi.restoreAllMocks(); });

const DRUGS = allPackDocuments("chemistry").map(d => d.doc).filter(d => d.type === "drug" && d.system?.addiction?.hasAddiction);
/** Копия на акторе: снимок записи пака, зависимость стоит старым полем. */
const copy = (doc, id = "it1", patch = {}) => ({
  id, type: "drug", name: doc.name,
  system: { ...structuredClone(doc.system), addiction: { ...structuredClone(doc.system.addiction), isAddicted: true, ...patch } }
});

describe("план переноса", () => {
  it("в паке есть препараты с зависимостью (иначе проверка ниже пуста)", () => {
    expect(DRUGS.length).toBeGreaterThan(10);
  }, PACK_SCAN_TIMEOUT);

  it("каждая зависимая копия пака переносится без потери полей настройки; предмет сбрасывается", () => {
    for (const doc of DRUGS) {
      const item = copy(doc);
      const plan = drugAddictionFlagPlan([item], {});
      const key = drugKey(item);
      expect(plan.entries[key], doc.name).toMatchObject({ addicted: true, name: doc.name, lastDose: null, doneTo: 0, tested: 0 });
      // Снимок покрывает ВСЕ ключи настройки пака, кроме устаревшего isAddicted.
      const expected = JSON.parse(JSON.stringify(doc.system.addiction));
      delete expected.isAddicted;
      expect(plan.entries[key].addiction, doc.name).toEqual(expected);
      expect(plan.itemUpdates, doc.name).toEqual([{ _id: "it1", "system.addiction.isAddicted": false }]);
    }
  }, PACK_SCAN_TIMEOUT);

  it("после переноса штраф и урон за период живут и без предмета: настройки читаются из снимка", () => {
    const doc = DRUGS.find(d => d.system.addiction.penaltyMods && d.system.addiction.frequency);
    expect(doc, "в паке нет препарата со штрафом").toBeTruthy();
    const item = copy(doc);
    const { entries } = drugAddictionFlagPlan([item], {});
    // Метка дозы стоит: штраф идёт, когда частота вышла.
    const key = drugKey(item);
    entries[key] = { ...entries[key], lastDose: 1000 };
    const rec = addictionRecords([], entries)[0];                       // предмета на листе нет
    expect(rec).toMatchObject({ key, item: null });
    expect(rec.add.penaltyMods).toBe(doc.system.addiction.penaltyMods);
    expect(rec.add.frequency).toBe(doc.system.addiction.frequency);
    const far = 1000 + 400 * 86400;
    expect(withdrawalPenaltyRules([], entries, far).length).toBeGreaterThan(0);
  }, PACK_SCAN_TIMEOUT);

  it("копия без зависимости (isAddicted:false) и препараты без hasAddiction не трогаются", () => {
    const doc = DRUGS[0];
    expect(drugAddictionFlagPlan([copy(doc, "a", { isAddicted: false })], {})).toEqual({ entries: {}, itemUpdates: [] });
    expect(drugAddictionFlagPlan([copy(doc, "b", { hasAddiction: false })], {})).toEqual({ entries: {}, itemUpdates: [] });
    expect(hasLegacyAddiction({ type: "weapon", system: { addiction: { hasAddiction: true, isAddicted: true } } })).toBe(false);
    expect(drugAddictionFlagPlan(undefined, undefined)).toEqual({ entries: {}, itemUpdates: [] });
  }, PACK_SCAN_TIMEOUT);

  it("метки дозы, оставшиеся от версии wdbc-gyqf2, переносятся: штраф не обнуляется и не наступает задним числом", () => {
    const item = copy(DRUGS[0]);
    const key = drugKey(item);
    const plan = drugAddictionFlagPlan([item], { [key]: { lastDose: 777, doneTo: 888, tested: 2 } });
    expect(plan.entries[key]).toMatchObject({ addicted: true, lastDose: 777, doneTo: 888, tested: 2 });
  }, PACK_SCAN_TIMEOUT);

  it("две стопки одного препарата — одна запись, у обеих сбрасывается устаревшее поле", () => {
    const doc = DRUGS[0];
    const plan = drugAddictionFlagPlan([copy(doc, "s1"), copy(doc, "s2")], {});
    expect(Object.keys(plan.entries)).toHaveLength(1);
    expect(plan.itemUpdates.map(u => u._id)).toEqual(["s1", "s2"]);
  }, PACK_SCAN_TIMEOUT);

  it("идемпотентность: после применения плана повторный план пуст", () => {
    const item = copy(DRUGS[0]);
    const plan = drugAddictionFlagPlan([item], {});
    for (const u of plan.itemUpdates) item.system.addiction.isAddicted = u["system.addiction.isAddicted"];
    expect(drugAddictionFlagPlan([item], plan.entries)).toEqual({ entries: {}, itemUpdates: [] });
  }, PACK_SCAN_TIMEOUT);
});

describe("migrateDrugAddictionFlag: мировые акторы и несвязанные токены", () => {
  const quietUi = () => { globalThis.ui = { notifications: { info: () => {}, warn: () => {} } }; };
  /** Подставной актор: update ведёт флаг, updateEmbeddedDocuments — предметы. */
  function fakeActor(items, flagEntries = {}) {
    const a = {
      name: "Ходок", items, flags: { "warhammer-dbc": { drugWithdrawal: flagEntries } },
      getFlag: (_s, k) => a.flags["warhammer-dbc"][k],
      update: vi.fn(async upd => {
        for (const [path, v] of Object.entries(upd)) {
          if (path === "flags.warhammer-dbc.drugWithdrawal") Object.assign(a.flags["warhammer-dbc"].drugWithdrawal, v);
        }
      }),
      updateEmbeddedDocuments: vi.fn(async (_t, updates) => {
        for (const u of updates) a.items.find(i => i.id === u._id).system.addiction.isAddicted = u["system.addiction.isAddicted"];
      })
    };
    return a;
  }

  it("мировой актор: запись флага пишется, поле предмета сбрасывается; повтор — ничего", async () => {
    const item = copy(DRUGS[0]);
    const actor = fakeActor([item]);
    globalThis.game = { user: { isGM: true }, actors: [actor], scenes: [] };
    quietUi();
    const res = await migrateDrugAddictionFlag();
    expect(res).toEqual({ fixed: 1, failed: 0 });
    expect(actor.flags["warhammer-dbc"].drugWithdrawal[drugKey(item)]).toMatchObject({ addicted: true });
    expect(item.system.addiction.isAddicted).toBe(false);
    actor.update.mockClear();
    expect(await migrateDrugAddictionFlag()).toEqual({ fixed: 0, failed: 0 });
    expect(actor.update).not.toHaveBeenCalled();
  }, PACK_SCAN_TIMEOUT);

  it("несвязанный токен: предмет, унаследованный от базового актора, не трогается; свой в дельте — переносится", async () => {
    const inherited = copy(DRUGS[0], "base");
    const own = copy(DRUGS[1], "own");
    const synthetic = fakeActor([inherited, own]);
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "С", tokens: { contents: [
      { id: "t", name: "Т", actorLink: false, actor: synthetic, delta: { _source: { items: [{ _id: "own" }] } } }
    ] } }] };
    quietUi();
    await migrateDrugAddictionFlag({ tokensOnly: true });
    expect(inherited.system.addiction.isAddicted).toBe(true);       // прошёл вместе с базовым актором
    expect(own.system.addiction.isAddicted).toBe(false);
    expect(Object.keys(synthetic.flags["warhammer-dbc"].drugWithdrawal)).toEqual([drugKey(own)]);
  }, PACK_SCAN_TIMEOUT);

  it("tokensOnly не трогает мировых акторов", async () => {
    const item = copy(DRUGS[0]);
    const world = fakeActor([item]);
    globalThis.game = { user: { isGM: true }, actors: [world], scenes: [] };
    quietUi();
    await migrateDrugAddictionFlag({ tokensOnly: true });
    expect(world.update).not.toHaveBeenCalled();
    expect(item.system.addiction.isAddicted).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("сбой одного актора не останавливает остальных и считается в failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = fakeActor([copy(DRUGS[0], "x")]);
    bad.update = vi.fn(async () => { throw new Error("нет прав"); });
    const good = fakeActor([copy(DRUGS[1], "y")]);
    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [] };
    quietUi();
    expect(await migrateDrugAddictionFlag()).toEqual({ fixed: 1, failed: 1 });
    expect(bad.items[0].system.addiction.isAddicted).toBe(true);    // запись флага не прошла — поле цело, повтор допишет
  }, PACK_SCAN_TIMEOUT);
});

// Foundry не ждёт async-обработчики «ready»: на разных Hooks.once они идут
// параллельно, и перенос снимал бы настройки с копии, которую drug-addiction-fields
// ещё не долил (он сперва долго грузит паки). Поэтому оба гейта — в одном
// обработчике, сначала поля, потом флаг.
describe("проводка в warhammer-dbc.mjs", () => {
  it("гейт флага идёт после гейта полей в одном обработчике ready", () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, "../../warhammer-dbc.mjs"), "utf8");
    const handlers = src.split('Hooks.once("ready"');
    const withFlag = handlers.filter(h => h.includes('key: "drugAddictionFlagVersion"'));
    expect(withFlag).toHaveLength(1);
    const h = withFlag[0];
    expect(h.indexOf('key: "drugAddictionFieldsVersion"')).toBeGreaterThan(-1);
    expect(h.indexOf('key: "drugAddictionFieldsVersion"')).toBeLessThan(h.indexOf('key: "drugAddictionFlagVersion"'));
    expect(h.match(/await runMigrationGate\(/g)).toHaveLength(2);
  });
});
