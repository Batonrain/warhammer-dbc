// test/apps/wizard-gear-rules.test.mjs
//
// Два хвоста ревизии стартового снаряжения:
//
// wdbc-27ig — три КАТЕГОРИЙНЫХ потока выдачи («N Стандартные системы»,
// «L. <Категория>», «N элементов до R») выбирают вещь ИЗ КАТЕГОРИИ, а не по
// имени. Сверить их с уже выданным по названию предмета нельзя в принципе,
// поэтому повторный заход в Мастера спрашивал их заново и выдавал вторую
// пачку. Лечится не угадайкой «эта категория уже закрыта», а ведомостью:
// флаг актора помнит, ЧТО именно Мастер выдал по каждой строке.
//
// wdbc-yobj — часть строк gear описывает не предмет, а ПРАВИЛО («+2 очка
// стартового снаряжения», «снаряжение модифицируется под размер Огрина»).
// Мастер пытался разобрать их как предметы и не мог.
//
// Проверяется поведение (что выдано/что спрошено/что записано), а не текст
// регулярок; тексты строк — дословные из module/constants/races.mjs.

import { describe, it, expect, vi } from "vitest";
import "../support/foundry-stub.mjs";
import { CharacterWizard } from "../../module/apps/character-wizard.mjs";
import { openCompendiumBrowser } from "../../module/apps/compendium-browser.mjs";

vi.mock("../../module/apps/compendium-browser.mjs", () => ({ openCompendiumBrowser: vi.fn() }));

const P = CharacterWizard.prototype;

// ── Разбор строк-правил ───────────────────────────────────────────────────

describe("«+N очков стартового снаряжения» — надбавка к пулу, не предмет (wdbc-yobj)", () => {
  it.each([
    ["+2 очка стартового снаряжения", 2],
    ["+1 очко стартового снаряжения", 1],
    ["+3 очка снаряжения", 3]
  ])("«%s» → +%i", (text, n) => {
    expect(P._matchEquipPointsBonus.call(null, text)).toBe(n);
  });

  it.each(["Vox-Bead", "5 элементов до R1 (2 Good.Q)", "2 очка стартового снаряжения потрачено"])(
    "«%s» надбавкой не считается", (text) => {
      expect(P._matchEquipPointsBonus.call(null, text)).toBeNull();
    });
});

describe("«снаряжение модифицируется под размер X» — правило выдачи, не предмет (wdbc-yobj)", () => {
  it("строка Огрина даёт свойство оружия «Огринизированное»", () => {
    const r = P._matchGearSizeRule.call(null, "снаряжение бесплатно модифицируется под размер Огрина");
    expect(r).toEqual({ prop: "ogryned", size: "огрин" });
  });

  it("незнакомая раса в правиле — строка всё равно ПРАВИЛО (в Обозреватель не уедет), просто без автоприменения", () => {
    const r = P._matchGearSizeRule.call(null, "снаряжение модифицируется под размер Крута");
    expect(r).toEqual({ prop: null, size: null });
  });

  it.each(["Vox-Bead", "3 модификации для оружия (до R3)"])(
    "«%s» правилом не считается", (text) => {
      expect(P._matchGearSizeRule.call(null, text)).toBeNull();
    });
});

describe("_gearRuleEquipBonus: сумма надбавок из текста Расы", () => {
  const app = rows => {
    const a = Object.create(P);
    a.gearPicks = {};
    a._gearLayout = () => ({ layout: rows.map(fixed => ({ fixed })), choiceDefs: [] });
    return a;
  };

  it("Скват: «+2 очка стартового снаряжения» уходит в пул", () => {
    expect(P._gearRuleEquipBonus.call(app([
      "5 элементов до R1 (3 Good.Q, 2 Best.Q)", "Vox-Bead", "+2 очка стартового снаряжения"
    ]))).toBe(2);
  });

  it("надбавок нет — 0, пул как был", () => {
    expect(P._gearRuleEquipBonus.call(app(["Vox-Bead", "Hekatrix Blade"]))).toBe(0);
  });
});

// ── Раскладка: строки со своим обработчиком не режутся на «А или Б» ───────

describe("_gearLayout: «/» между КАТЕГОРИЯМИ не выбор между предметами (wdbc-27ig)", () => {
  // Настоящий _gearLayout тянет resolveCreation (Расу/Архетип живого актора);
  // здесь проверяется ровно та часть, что раскладывает уже готовые entries, —
  // порядок проверок «сначала свой обработчик, потом _splitGearChoice».
  const layoutOf = raw => {
    const app = Object.create(P);
    app.gearPicks = {};
    const entries = P._splitGearTopLevel.call(app, raw);
    const layout = [], choiceDefs = [];
    for (const e of entries) {
      if (app._matchStandardSystemsCount(e) != null) { layout.push({ fixed: e }); continue; }
      if (app._matchGearBudget(e)) { layout.push({ fixed: e }); continue; }
      if (app._matchLegionCategoryGear(e)) { layout.push({ fixed: e }); continue; }
      if (app._matchEquipPointsBonus(e) != null) { layout.push({ fixed: e }); continue; }
      if (app._matchGearSizeRule(e)) { layout.push({ fixed: e }); continue; }
      const parts = app._splitGearChoice(e);
      if (parts.length > 1) { layout.push({ ci: choiceDefs.length }); choiceDefs.push(parts); }
      else layout.push({ fixed: e });
    }
    app._gearLayout = () => ({ layout, choiceDefs });
    return P._resolvedGearRows.call(app);
  };

  it("«5 элементов Снаряжения/Инструментов до R1 (…)» остаётся ОДНОЙ бюджетной строкой на 5 предметов", () => {
    const rows = layoutOf("5 элементов Снаряжения/Инструментов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead");
    expect(rows).toEqual(["5 элементов Снаряжения/Инструментов до R1 (2 Good.Q, 1 Best.Q)", "Vox-Bead"]);
    expect(P._matchGearBudget.call(null, rows[0])).toMatchObject({ count: 5, maxAvailability: 1 });
  });

  it("настоящий выбор через «или» по-прежнему разбирается как выбор", () => {
    const rows = layoutOf("Xenomesh Armour (Good.Q) или Kabalite Armour, или Wychsuit");
    expect(rows).toEqual(["Xenomesh Armour (Good.Q)"]); // выбрана первая опция группы
  });
});

// ── Ведомость выданного: повторный заход не выдаёт вторую пачку ───────────

function budgetApp({ gearText, flags = {}, items = [] }) {
  const created = [];
  const setFlagCalls = [];
  const actor = {
    id: "a1", name: "Тест", items, flags,
    system: { characteristics: { inf: { bonus: 0 } } },
    getFlag: (scope, key) => flags?.[scope]?.[key],
    setFlag: async (scope, key, val) => { setFlagCalls.push(val); return val; },
    createEmbeddedDocuments: async (type, docs) => {
      const made = docs.map((d, i) => ({ ...d, id: `new${created.length + i}`, type: d.type ?? "gear" }));
      created.push(...made); items.push(...made); return made;
    },
    updateEmbeddedDocuments: async () => []
  };
  const app = Object.create(P);
  app.gearPicks = {};
  app._gearDone = false;
  app._confirmingGear = false;
  app.render = () => {};
  Object.defineProperty(app, "actor", { get: () => actor });
  app._gearLayout = () => ({ layout: [{ fixed: gearText }], choiceDefs: [], isAstartes: false });
  app._grantStartingAmmo = async () => {};
  globalThis.game.packs = new Map();
  return { app, actor, created, setFlagCalls };
}

describe("_confirmGear: ведомость выданного по КАТЕГОРИЙНЫМ строкам (wdbc-27ig)", () => {
  const GEAR = "3 элемента Снаряжения/Инструментов до R1 (1 Good.Q)";

  const stubBrowser = (uuids) => {
    openCompendiumBrowser.mockReset();
    openCompendiumBrowser.mockResolvedValue(uuids);
    globalThis.fromUuid = async (u) => ({ type: "gear", toObject: () => ({ name: u, type: "gear", system: {} }) });
  };

  it("первый заход: Обозреватель спрашивает, предметы создаются, их id записываются во флаг", async () => {
    stubBrowser(["u1", "u2", "u3"]);
    const { app, created, setFlagCalls } = budgetApp({ gearText: GEAR });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(3);
    expect(setFlagCalls).toHaveLength(1);
    expect(Object.values(setFlagCalls[0])[0]).toEqual(created.map(c => c.id));
  });

  it("повторный заход при живых записанных предметах: НЕ спрашивает и НЕ выдаёт вторую пачку", async () => {
    stubBrowser(["u1", "u2", "u3"]);
    const first = budgetApp({ gearText: GEAR });
    await P._confirmGear.call(first.app);
    const ledger = first.setFlagCalls[0];

    stubBrowser(["u1", "u2", "u3"]);
    const again = budgetApp({
      gearText: GEAR,
      flags: { "warhammer-dbc": { creationGear: ledger } },
      items: first.created.map(c => ({ id: c.id, name: c.name, type: c.type, system: {} }))
    });
    await P._confirmGear.call(again.app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(again.created).toHaveLength(0);
  });

  it("записанные предметы игрок удалил с листа — строка выдаётся честно заново", async () => {
    stubBrowser(["u1", "u2", "u3"]);
    const first = budgetApp({ gearText: GEAR });
    await P._confirmGear.call(first.app);

    stubBrowser(["u1", "u2", "u3"]);
    const again = budgetApp({
      gearText: GEAR,
      flags: { "warhammer-dbc": { creationGear: first.setFlagCalls[0] } },
      items: [] // всё выданное стёрто
    });
    await P._confirmGear.call(again.app);
    expect(openCompendiumBrowser).toHaveBeenCalledTimes(1);
    expect(again.created).toHaveLength(3);
  });

  it("правила («+2 очка», «под размер Огрина») Обозреватель не открывают", async () => {
    openCompendiumBrowser.mockReset();
    const { app, created } = budgetApp({ gearText: "+2 очка стартового снаряжения" });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
});

describe("_applyGearSizeProp: бесплатная подгонка оружия под размер Огрина (wdbc-yobj)", () => {
  it("свойство «Огринизированное» проставляется всему оружию на листе, кроме уже помеченного", async () => {
    const items = [
      { id: "w1", type: "weapon", system: { weaponProps: [] } },
      { id: "w2", type: "weapon", system: { weaponProps: [{ key: "ogryned" }] } },
      { id: "a1", type: "armor",  system: {} }
    ];
    let updates = null;
    const actor = { items, updateEmbeddedDocuments: async (t, u) => { updates = u; return u; } };
    const app = Object.create(P);
    Object.defineProperty(app, "actor", { get: () => actor });
    const n = await P._applyGearSizeProp.call(app, "ogryned");
    expect(n).toBe(1);
    expect(updates).toEqual([{ _id: "w1", "system.weaponProps": [{ key: "ogryned" }] }]);
  });
});
