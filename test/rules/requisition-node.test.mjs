// test/rules/requisition-node.test.mjs
//
// Режим «Узел корабля» окна «Достать снаряжение» (Sahara 10-4eac, решение
// владельца 26.10.2026). Книга Пустоты, «Реквизиция узлов»: обычные
// модификаторы за Редкость и Качество, «а вместо модификатора за количество —
// модификатор из таблицы Реквизиции узлов»: оружейные −30, эфирные −20,
// энергетические −10, структурные +0; спорное — структурным. Срок установки
// не ведётся. «+10» Дела Фактотума цепляется к режиму сам.
//
// Таблица сверяется с текстом книги (void.json), классификация — с НАСТОЯЩИМИ
// компонентами packs-src/ship-components, а не с выдуманными.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  NODE_TYPES, NODE_PACKS, nodeTypeOf, isShipNode, requisitionPlan, requisitionSummaryLines,
  requisitionModifier, rarityMod, qualityMod
} from "../../module/rules/requisition.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { packDocuments, PACKS_SRC, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (...names) => ({ type: "character", items: names.map(talent), system: { characteristics: { inf: { total: 45 } } } });
const FACTOTUM = "The Factotum Case / Дело Фактотума";
const WAR = "Lord of War / Повелитель Войны";
const NETWORK = "Contact Network / Сеть Контактов";
const WEALTH = "Excessive Wealth / Чрезмерное Богатство";

const components = () => packDocuments("ship-components", "component").map(d => d.doc);
const comp = system => ({ type: "component", name: "Узел", system: { kind: "supplemental", rarity: 2, quality: "common", ...system } });

describe("таблица Реквизиции узлов совпадает с текстом книги (void.json)", () => {
  const html = (() => {
    const text = fs.readFileSync(path.join(PACKS_SRC, "books", "void.json"), "utf8");
    // Тело страницы — одна JSON-строка; ищем таблицу по её заголовку.
    const m = text.match(/Таблица Реквизиции узлов<\/strong>[\s\S]*?<\/tbody><\/table>/);
    expect(m, "таблица «Реквизиция узлов» в Книге Пустоты").toBeTruthy();
    return m[0];
  })();
  const rows = [...html.matchAll(/<tr><td>([^<]+)<\/td><td>([-+−–]?\d+)<\/td><\/tr>/g)]
    .map(m => [m[1], Number(m[2].replace(/[−–]/, "-"))]);

  it("четыре строки: оружейные −30, эфирные −20, энергетические −10, структурные 0", () => {
    expect(rows.map(r => r[1])).toEqual([-30, -20, -10, 0]);
    expect(rows[0][0]).toMatch(/^Оружейные/);
    expect(rows[1][0]).toMatch(/^Эфирные/);
    expect(rows[2][0]).toMatch(/^Энергетические/);
    expect(rows[3][0]).toMatch(/^Структурные/);
  });
  it("NODE_TYPES хранит те же числа в том же порядке", () => {
    expect(Object.values(NODE_TYPES).map(t => t.mod)).toEqual(rows.map(r => r[1]));
    expect(Object.keys(NODE_TYPES)).toEqual(["weapon", "ethereal", "energy", "structural"]);
  });
  it("сноска книги: узел вне категорий — структурный", () => {
    expect(html).toMatch(/нельзя отнести к одной из категорий[^<]*структурных/);
    expect(nodeTypeOf(comp({ kind: "что-то-новое" }))).toBe("structural");
    expect(nodeTypeOf(null)).toBe("structural");
    expect(nodeTypeOf({})).toBe("structural");
  });
  it("таблица Качества узлов — те же числа, что у обычного Качества", () => {
    const m = html.length && fs.readFileSync(path.join(PACKS_SRC, "books", "void.json"), "utf8")
      .match(/Таблица Качества узлов<\/strong>[\s\S]*?<\/tbody><\/table>/);
    const q = Object.fromEntries([...m[0].matchAll(/<td>(\w+)\.Q<\/td><td>([-+−–]?\d+)<\/td>/g)]
      .map(r => [r[1].toLowerCase(), Number(r[2].replace(/[−–]/, "-"))]));
    expect(q).toEqual({ poor: qualityMod("poor"), common: qualityMod("common"),
      good: qualityMod("good"), best: qualityMod("best") });
  });
});

describe("классификация настоящих компонентов packs-src/ship-components", () => {
  const SPEC = {
    weapon: "weapon", augur: "ethereal", voidShield: "energy", warp: "energy",
    // спорные (решение владельца 26.10.2026) и прочее — структурные
    astropathic: "structural", gellar: "structural", drive: "structural", occulum: "structural",
    bridge: "structural", hold: "structural", quarters: "structural", lifeSustainer: "structural",
    supplemental: "structural"
  };

  it("каждый вид компонента в паке известен таблице — новый вид без решения краснит тест", () => {
    const kinds = new Set(components().map(c => c.system.kind));
    for (const k of kinds) expect(Object.keys(SPEC), `вид «${k}» не классифицирован`).toContain(k);
    // покрытие: каждая строка SPEC реально встречается в паке (не мёртвая)
    for (const k of Object.keys(SPEC)) expect(kinds.has(k), `вида «${k}» в паке нет`).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("все компоненты попадают в тип по SPEC", () => {
    for (const c of components()) expect(nodeTypeOf(c), `${c.name} (${c.system.kind})`).toBe(SPEC[c.system.kind]);
  }, PACK_SCAN_TIMEOUT);

  it("все орудия — оружейные, включая торпеды, ангары, нову и экзотику", () => {
    const weapons = components().filter(c => c.system.kind === "weapon");
    expect(weapons.length).toBeGreaterThan(60);
    const wTypes = new Set(weapons.map(w => w.system.weapon.wType));
    for (const t of ["macrobattery", "lance", "torpedo", "bay", "nova"]) expect(wTypes.has(t), t).toBe(true);
    expect(weapons.every(w => nodeTypeOf(w) === "weapon")).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("isShipNode: компонент — да; корпус и груз из того же пака — нет", () => {
    expect(components().every(isShipNode)).toBe(true);
    const hulls = packDocuments("ship-components", "shipHull").map(d => d.doc);
    const cargo = packDocuments("ship-components", "cargo").map(d => d.doc);
    expect(hulls.length).toBeGreaterThan(50);
    expect(cargo.length).toBeGreaterThan(5);
    expect([...hulls, ...cargo].some(isShipNode)).toBe(false);
    expect(isShipNode(null)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("NODE_PACKS — пак компонентов, и он есть в system.json", () => {
    expect(NODE_PACKS).toEqual(["ship-components"]);
    const sys = JSON.parse(fs.readFileSync(path.resolve(PACKS_SRC, "../system.json"), "utf8"));
    expect(sys.packs.map(p => p.name)).toContain("ship-components");
  });
});

describe("requisitionPlan для узла: Редкость + Качество + тип узла, без Количества", () => {
  const a = actorWith();
  const macro = components().find(c => c.system.kind === "weapon" && c.system.weapon.wType === "macrobattery" && c.system.rarity === 3);
  const mod = (node, q = "common", rarity = node.system.rarity) => rarityMod(rarity) + qualityMod(q);

  it("макробатарея R3: −30 (R3) −30 (оружейные) = −60", () => {
    expect(macro, "в паке есть макробатарея R3").toBeTruthy();
    const p = requisitionPlan(a, { item: macro, node: true });
    expect(p.node).toBe("weapon");
    expect(p.rarity).toBe(3);
    expect(p.total).toBe(mod(macro) - 30);
    expect(p.total).toBe(-60);
    expect(p.mods.quantityMod).toBe(-30);
  });
  it("Качество добавляется: Good.Q −10, Poor.Q +10", () => {
    expect(requisitionPlan(a, { item: macro, node: true, quality: "good" }).total).toBe(-70);
    expect(requisitionPlan(a, { item: macro, node: true, quality: "poor" }).total).toBe(-50);
    expect(requisitionPlan(a, { item: macro, node: true, quality: "best" }).total).toBe(-80);
  });
  it("Количество и «расходное» узлу не подмешиваются", () => {
    const base = requisitionPlan(a, { item: macro, node: true });
    const withQty = requisitionPlan(a, { item: macro, node: true, quantity: 500, consumable: true });
    expect(withQty.total).toBe(base.total);
    expect(withQty.quantity).toBe(1);
    expect(withQty.consumable).toBe(false);
    expect(withQty.label).not.toMatch(/×/);
  });
  it("структурный узел (Мостик) — ноль за тип; энергетический (пустотный щит) −10; эфирный (авгур) −20", () => {
    const pick = kind => components().find(c => c.system.kind === kind);
    const bridge = pick("bridge"), shield = pick("voidShield"), augur = pick("augur"), warp = pick("warp");
    for (const n of [bridge, shield, augur, warp]) expect(n, "образец в паке").toBeTruthy();
    const total = n => requisitionPlan(a, { item: n, node: true }).total;
    expect(total(bridge)).toBe(rarityMod(bridge.system.rarity) + 0);
    expect(total(shield)).toBe(rarityMod(shield.system.rarity) - 10);
    expect(total(warp)).toBe(rarityMod(warp.system.rarity) - 10);
    expect(total(augur)).toBe(rarityMod(augur.system.rarity) - 20);
  });
  it("спорные виды (двигатель, Поле Геллера, астропатический, окулум) — +0 по сноске книги", () => {
    for (const kind of ["drive", "gellar", "astropathic", "occulum"]) {
      const n = components().find(c => c.system.kind === kind);
      expect(requisitionPlan(a, { item: n, node: true }).mods.quantityMod, kind).toBe(0);
    }
  });
  it("Редкость берётся у узла (system.rarity), включая отрицательную; вручную — поверх", () => {
    expect(requisitionPlan(a, { item: comp({ rarity: -1, kind: "bridge" }), node: true }).total).toBe(10);
    expect(requisitionPlan(a, { item: comp({ rarity: 4, kind: "bridge" }), node: true, rarity: 0 }).total).toBe(0);
  });
  it("тип узла можно задать вручную (ГМ решил по-своему)", () => {
    const p = requisitionPlan(a, { item: comp({ kind: "bridge", rarity: 0 }), node: true, nodeType: "weapon" });
    expect(p.node).toBe("weapon");
    expect(p.total).toBe(-30);
    expect(requisitionPlan(a, { item: comp({ kind: "bridge", rarity: 0 }), node: true, nodeType: "мусор" }).node).toBe("structural");
  });
  it("поправка ГМа и Качество — обычные: местная распространённость прибавляется", () => {
    expect(requisitionPlan(a, { item: comp({ kind: "bridge", rarity: 0 }), node: true, local: -10 }).total).toBe(-10);
  });
  it("без node — обычная реквизиция предмета, ничего не меняется", () => {
    const p = requisitionPlan(a, { item: macro, quantity: 1 });
    expect(p.node).toBeNull();
    expect(p.total).toBe(rarityMod(3) + 10);
    expect(p.rollContext.requisitionNode).toBeUndefined();
  });
  it("Таланты, снижающие Редкость, узлу не мешают (экзотика/Легион/ритуал — признаки предметов, у компонента их нет)", () => {
    const rich = actorWith(WAR, "Ancient Warrior / Древний Воин", "Rite Puzzler / Разгадыватель Ритуалов");
    const p = requisitionPlan(rich, { item: macro, node: true });
    expect(p.shifts).toEqual([]);
    expect(p.rarity).toBe(3);
  });
  it("строки карточки: Редкость, Качество и тип узла, срока установки нет", () => {
    const p = requisitionPlan(a, { item: macro, node: true, quality: "good" });
    const lines = requisitionSummaryLines(p).join("\n");
    expect(lines).toMatch(/Редкость R3: −30/);
    expect(lines).toMatch(/Качество Good\.Q: −10/);
    expect(lines).toMatch(/Тип узла \(оружейные\): −30/);
    expect(lines).not.toMatch(/Количество/);
    expect(lines).not.toMatch(/недел|срок|установк/i);
    expect(lines).toMatch(/−70/);
  });
  it("структурный узел: строка про тип всё равно есть (почему ноль), в сумму не входит", () => {
    const p = requisitionPlan(a, { item: comp({ kind: "bridge", rarity: 0 }), node: true });
    expect(p.mods.parts.join("\n")).toMatch(/Тип узла \(структурные\): 0/);
    expect(p.total).toBe(0);
  });
  it("requisitionModifier напрямую: узел заменяет ступень Количества", () => {
    const m = requisitionModifier({ rarity: 1, quality: "common", node: "energy" });
    expect(m.total).toBe(-10 - 10);
    expect(m.tier).toBeNull();
    const plain = requisitionModifier({ rarity: 1, quantity: 1, quality: "common" });
    expect(plain.total).toBe(-10 + 10);
  });
  it("контекст теста: requisition + requisitionNode + тип; Количества в нём нет", () => {
    const ctx = requisitionPlan(a, { item: macro, node: true }).rollContext;
    expect(ctx).toMatchObject({ requisition: true, requisitionNode: true, requisitionNodeType: "weapon", requisitionRarity: 3 });
    expect("requisitionQuantity" in ctx).toBe(false);
  });
});

describe("Дело Фактотума в режиме «Узел корабля»", () => {
  const macro = comp({ kind: "weapon", rarity: 3, weapon: { wType: "macrobattery" } });
  const run = (actor, item, opts = {}) => {
    const plan = requisitionPlan(actor, { item, ...opts });
    return resolveTest({ actor, kind: "skill", char: "inf", ...plan.rollContext });
  };

  it("при приобретении узла +10 цепляется сам (авто, не галочка)", () => {
    const r = run(actorWith(FACTOTUM), macro, { node: true });
    const m = r.autoMods.find(x => x.ruleId === "requisition.factotumCase");
    expect(m?.value).toBe(10);
    expect(m.label).toMatch(/узл/i);
    expect(r.mods.filter(x => x.ruleId === "requisition.factotumCase")).toEqual([]);
  });
  it("реквизиция обычного снаряжения — по-прежнему галочка, не авто", () => {
    const r = run(actorWith(FACTOTUM), { type: "gear", name: "Лампа", system: { availability: 1 } });
    expect(r.autoMods.some(x => x.ruleId === "requisition.factotumCase")).toBe(false);
    expect(r.mods.find(x => x.ruleId === "requisition.factotumCase")).toMatchObject({ value: 10, askOnly: true });
  });
  it("без Таланта бонуса нет", () => {
    const r = run(actorWith(), macro, { node: true });
    expect(r.autoMods.some(x => x.ruleId?.startsWith("requisition."))).toBe(false);
    expect(r.mods.some(x => x.ruleId?.startsWith("requisition."))).toBe(false);
  });
  it("на тесте Commerce нет, как и раньше", () => {
    const r = resolveTest({ actor: actorWith(FACTOTUM), kind: "skill", skill: "commerce", char: "fel" });
    expect([...r.mods, ...r.autoMods].some(x => x.ruleId === "requisition.factotumCase")).toBe(false);
  });
  it("не задваивается: либо авто, либо галочка", () => {
    const r = run(actorWith(FACTOTUM), macro, { node: true });
    expect([...r.mods, ...r.autoMods].filter(x => x.ruleId === "requisition.factotumCase")).toHaveLength(1);
  });
  it("Повелитель Войны на узле не срабатывает (опт 1001+ — про штуки снаряжения)", () => {
    const r = run(actorWith(WAR), comp({ kind: "bridge", rarity: -3 }), { node: true, quantity: 5000 });
    expect(r.autoMods.some(x => x.ruleId === "requisition.lordOfWar")).toBe(false);
  });
  it("Сеть Контактов и Чрезмерное Богатство остаются галочками и на узле", () => {
    const r = run(actorWith(NETWORK, WEALTH), macro, { node: true });
    expect(r.mods.find(x => x.ruleId === "requisition.contactNetwork")).toMatchObject({ setChar: "fel" });
    expect(r.mods.find(x => x.ruleId === "requisition.excessiveWealth")).toMatchObject({ value: 10, askOnly: true });
  });
});

describe("окно «Достать снаряжение»: режим подключён", () => {
  const src = fs.readFileSync(path.resolve(PACKS_SRC, "../module/apps/requisition.mjs"), "utf8");
  it("третья кнопка «Узел корабля» берёт только компоненты из NODE_PACKS", () => {
    expect(src).toMatch(/action:\s*"node"/);
    expect(src).toMatch(/Узел корабля/);
    expect(src).toMatch(/pack:\s*\[\.\.\.NODE_PACKS\]/);
    expect(src).toMatch(/filters:\s*\{\s*type:\s*"component"\s*\}/);
  });
  it("узел не выдаётся персонажу: ветка выдачи не вызывается для узла", () => {
    expect(src).toMatch(/v\.grant && !node\)/);
    expect(src).toMatch(/item && !node \?/);   // галочка «выдать» в окне узла не рисуется
  });
});
