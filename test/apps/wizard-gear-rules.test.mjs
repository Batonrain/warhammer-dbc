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

vi.mock("../../module/apps/compendium-browser.mjs", () => ({
  openCompendiumBrowser: vi.fn(),
  // Ветка оружия раскрывается в листья только у настоящего пака; здесь — как есть.
  weaponTypeFolderIds: vi.fn(id => [id])
}));

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

// ── Выдача по книге: Качество, Легион, количество, ступени, «из них» ───────
//
// Стартовое снаряжение выдаётся само (решение владельца): именная строка —
// предмет из пака с Качеством/Легионом/количеством из текста; категория —
// Обозреватель, уже суженный по книге, а Качество выбранному проставляется
// само. Паки и Обозреватель — подставные, логика Мастера — настоящая.

const weaponDoc = (id, name, extra = {}) => ({
  id, name, type: "weapon", system: { availability: extra.availability ?? 1 },
  toObject: () => ({ name, type: "weapon", system: { quality: "common", weaponProps: [], quantity: 1 } })
});

function deliveryApp({ gearText, layout, packs = {}, uuidDocs = {}, items = [] }) {
  const created = [];
  const actor = {
    id: "a1", name: "Тест", items, flags: {},
    system: { characteristics: { inf: { bonus: 0 } } },
    getFlag: () => undefined,
    setFlag: async () => {},
    createEmbeddedDocuments: async (type, docs) => {
      const made = docs.map((d, i) => ({ ...d, id: `new${created.length + i}` }));
      created.push(...made); return made;
    },
    updateEmbeddedDocuments: async () => []
  };
  const map = new Map();
  for (const [id, docs] of Object.entries(packs)) {
    map.set(`warhammer-dbc.${id}`, {
      getIndex: async () => docs.map(d => ({ _id: d.id, name: d.name, folder: d.folder ?? null })),
      getDocument: async id2 => docs.find(d => d.id === id2) ?? null
    });
  }
  globalThis.game.packs = map;
  globalThis.fromUuid = async u => uuidDocs[u] ?? null;
  const app = Object.create(P);
  app.gearPicks = {};
  app._gearDone = false;
  app._confirmingGear = false;
  app.render = () => {};
  Object.defineProperty(app, "actor", { get: () => actor });
  app._gearLayout = () => ({ layout: layout ?? [{ fixed: gearText }], choiceDefs: [], isAstartes: false });
  app._grantStartingAmmo = async () => {};
  return { app, created };
}

describe("_confirmGear: выдача по книге сама", () => {
  it("«L. Bolter (Good.Q)» — Легионная версия из пака, Качество Хорошее, без Обозревателя", async () => {
    openCompendiumBrowser.mockReset();
    const { app, created } = deliveryApp({
      gearText: "L. Bolter (Good.Q)",
      packs: { weapons: [weaponDoc("b1", "Bolter / Болтер"), weaponDoc("b2", "Bolter / Болтер (Астартес)")] }
    });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "Bolter / Болтер (Астартес)", system: { quality: "good" } });
  });

  it("«6×L. Frag Grenades» — граната «Фраг» ×6 одним предметом и со свойством Legion", async () => {
    openCompendiumBrowser.mockReset();
    const { app, created } = deliveryApp({
      gearText: "6×L. Frag Grenades",
      packs: { weapons: [weaponDoc("r1", "Frag / Ракета: Фраг"), { ...weaponDoc("g1", "Frag / Фраг"), folder: "CiKyTXQv7N6C3J3A" }] }
    });
    await P._confirmGear.call(app);
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Frag / Фраг");
    expect(created[0].system.quantity).toBe(6);
    expect(created[0].system.weaponProps).toEqual([{ key: "legion" }]);
  });

  it("«Knife(+Mono)» — нож и установленная на него модификация Mono", async () => {
    openCompendiumBrowser.mockReset();
    const mono = { id: "m1", name: "Mono / Mono", type: "weaponMod",
      toObject: () => ({ name: "Mono / Mono", type: "weaponMod", system: { installedOn: "" } }) };
    const { app, created } = deliveryApp({
      gearText: "Knife(+Mono)",
      packs: { weapons: [weaponDoc("k1", "Knife / Нож")], "weapon-mods": [mono] }
    });
    await P._confirmGear.call(app);
    expect(created.map(c => c.name)).toEqual(["Knife / Нож", "Mono / Mono"]);
    expect(created[1].system.installedOn).toBe(created[0].id);
  });

  it("«2×L. Chain Weapon (до R1)» — Обозреватель: Цепное, Редкость ≤1, 2 шт.; выбранному — Legion", async () => {
    openCompendiumBrowser.mockReset();
    openCompendiumBrowser.mockResolvedValue(["c1", "c1"]);
    const { app, created } = deliveryApp({
      gearText: "2×L. Chain Weapon (до R1)",
      uuidDocs: { c1: weaponDoc("c1", "Chainsword / Пиломеч", { availability: 0 }) }
    });
    await P._confirmGear.call(app);
    const opts = openCompendiumBrowser.mock.calls[0][1];
    expect(opts).toMatchObject({ pack: "weapons", count: 2, filters: { maxAvailability: 1, folderId: ["MwsAIUuoQBJXbOQA"] } });
    expect(created).toHaveLength(1);
    expect(created[0].system).toMatchObject({ quantity: 2, weaponProps: [{ key: "legion" }] });
  });

  it("ступени «R1(Best.Q) или R2(Good.Q) или R3» — Качество по Редкости выбранного", async () => {
    openCompendiumBrowser.mockReset();
    openCompendiumBrowser.mockResolvedValue(["a", "b"]);
    const { app, created } = deliveryApp({
      gearText: "2 Любых рукопашных оружия R1(Best.Q) или R2(Good.Q) или R3",
      uuidDocs: { a: weaponDoc("a", "A", { availability: 1 }), b: weaponDoc("b", "B", { availability: 3 }) }
    });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser.mock.calls[0][1].filters.maxAvailability).toBe(3);
    expect(created.map(c => [c.name, c.system.quality])).toEqual([["A", "best"], ["B", "common"]]);
  });

  it("«из них 1 Good.Q и 1 Best.Q» — Высшее первому выбранному, Хорошее второму", async () => {
    openCompendiumBrowser.mockReset();
    openCompendiumBrowser.mockResolvedValue(["g1", "g2", "g3", "g4"]);
    const gear = id => ({ id, name: id, type: "gear", system: { availability: 0 },
      toObject: () => ({ name: id, type: "gear", system: { quality: "common", quantity: 1 } }) });
    const { app, created } = deliveryApp({
      gearText: "4 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q и 1 Best.Q",
      uuidDocs: { g1: gear("g1"), g2: gear("g2"), g3: gear("g3"), g4: gear("g4") }
    });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser.mock.calls[0][1]).toMatchObject({ pack: ["gear", "tools"], count: 4, filters: { maxAvailability: 1 } });
    expect(created.map(c => c.system.quality)).toEqual(["best", "good", "common", "common"]);
  });

  it("строка, уже выданная Механикой Архетипа (covered), не выдаётся и не спрашивается второй раз", async () => {
    openCompendiumBrowser.mockReset();
    const { app, created } = deliveryApp({ layout: [{ fixed: "L. Power Weapon (до R3, Good.Q)", covered: true }] });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("Скакун — не предмет: Обозреватель не открывается, строка остаётся ГМу", async () => {
    openCompendiumBrowser.mockReset();
    const { app, created } = deliveryApp({ gearText: "Скакун до R1 и набор брони до R1(базово) для него" });
    await P._confirmGear.call(app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("_constructorEquipGroups: записи Механики берутся с Расы/Субрасы/Архетипа актора", () => {
    const g = { operator: "OR", entries: [{ kind: "equipment", equipMode: "choice", equipCategoryPack: "weapons" }] };
    const app = Object.create(P);
    const actor = { items: [
      { type: "archetype", flags: { "warhammer-dbc": { mechanics: [g] } } },
      { type: "weapon", flags: { "warhammer-dbc": { mechanics: [g] } } }
    ] };
    Object.defineProperty(app, "actor", { get: () => actor });
    expect(P._constructorEquipGroups.call(app)).toEqual([g]);
  });
});
