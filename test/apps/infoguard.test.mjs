// test/apps/infoguard.test.mjs
//
// Инфограждение (гл. IV «Арсенал») — Успехи встречного теста у высокотехно-
// логичного снаряжения. Проверяется отбор предметов (supportsInfoguard),
// сам бросок (½ смены, Tech-Use+0, Успехи ÷2 окр.▲) и автоматизация
// Техночудес «vs Инфограждение» (module/sheets/tabs/tech.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { supportsInfoguard, rollInfoguard, infoguardInteractionSection }
  from "../../module/apps/infoguard.mjs";

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = {};
});

function weapon(over = {}) {
  return { type: "weapon", name: "Лазган", system: { weaponProps: [], daemonWeapon: { bound: false }, infoguard: 0, ...over } };
}
function armor(over = {}) {
  return { type: "armor", name: "Флак-броня", system: { properties: [], infoguard: 0, ...over } };
}
function gear(over = {}) {
  return { type: "gear", name: "Ауспик", system: { gearCategory: "misc", infoguard: 0, ...over } };
}
function tool(over = {}) {
  return { type: "tool", name: "Комби-Инструмент", system: { toolCategory: "kits", infoguard: 0, ...over } };
}

describe("supportsInfoguard — отбор высокотехнологичного снаряжения", () => {
  it("обычное оружие/броня/снаряжение/инструмент — да", () => {
    expect(supportsInfoguard(weapon())).toBe(true);
    expect(supportsInfoguard(armor())).toBe(true);
    expect(supportsInfoguard(gear())).toBe(true);
    expect(supportsInfoguard(tool())).toBe(true);
  });

  it("Примитивное оружие/броня — нет", () => {
    expect(supportsInfoguard(weapon({ weaponProps: [{ key: "primitive" }] }))).toBe(false);
    expect(supportsInfoguard(armor({ properties: [{ key: "primitive" }] }))).toBe(false);
  });

  it("связанное Демоническое оружие — нет", () => {
    expect(supportsInfoguard(weapon({ daemonWeapon: { bound: true } }))).toBe(false);
  });

  it("Мистическая категория снаряжения/инструмента — нет", () => {
    expect(supportsInfoguard(gear({ gearCategory: "mystic" }))).toBe(false);
    expect(supportsInfoguard(tool({ toolCategory: "mystic" }))).toBe(false);
  });

  it("Импланты и кибернетика — правило само запрещает их защищать", () => {
    expect(supportsInfoguard({ type: "implant", system: {} })).toBe(false);
    expect(supportsInfoguard({ type: "cybernetic", system: {} })).toBe(false);
  });
});

/** Актор-заглушка с прямым владением предметом (relayItemUpdate пишет сама). */
function actorFor(item, { total = 40, fatigueValue = 0 } = {}) {
  const a = {
    system: {
      skills: { techUse: { total } },
      fatigue: { value: fatigueValue },
      characteristics: {}
    },
    items: []
  };
  item.actor  = a;
  item.isOwner = true;
  item.update = async changes => { Object.assign(item.system, unflatten(changes)); return item; };
  a.items.push(item);
  return a;
}

function unflatten(changes) {
  const out = {};
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split(".").slice(1); // без "system."
    let node = out;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
    node[keys[keys.length - 1]] = value;
  }
  return out.system ?? out;
}

describe("rollInfoguard — накладывание Инфограждения", () => {
  it("успех: Успехи после теста делятся пополам (окр.▲)", async () => {
    const item = weapon();
    actorFor(item, { total: 40 });
    captured.nextRoll = 30; // success, |30-40|/10=1 → deg=2 → ⌈2/2⌉=1
    const successes = await rollInfoguard(item);
    expect(successes).toBe(1);
    expect(item.system.infoguard).toBe(1);
    expect(captured.chat.length).toBe(1);
  });

  it("больший разрыв броска и порога даёт больше Успехов", async () => {
    const item = weapon();
    actorFor(item, { total: 60 });
    captured.nextRoll = 5; // |5-60|/10=5.5 → floor=5 → deg=6 → ⌈6/2⌉=3
    const successes = await rollInfoguard(item);
    expect(successes).toBe(3);
    expect(item.system.infoguard).toBe(3);
  });

  it("провал — Инфограждение снимается (0)", async () => {
    const item = weapon();
    actorFor(item, { total: 40 });
    item.system.infoguard = 2; // уже было наложено раньше
    captured.nextRoll = 95; // провал
    const successes = await rollInfoguard(item);
    expect(successes).toBe(0);
    expect(item.system.infoguard).toBe(0);
  });

  it("Усталость даёт обычный штраф −10 к тесту (int не освобождён)", async () => {
    const item = weapon();
    actorFor(item, { total: 40, fatigueValue: 2 });
    captured.nextRoll = 35; // порог 40−10=30 → провал
    const successes = await rollInfoguard(item);
    expect(successes).toBe(0);
  });

  it("непригодный предмет (Примитив) — предупреждение, без записи", async () => {
    const item = weapon({ weaponProps: [{ key: "primitive" }] });
    actorFor(item, { total: 40 });
    captured.nextRoll = 1;
    const res = await rollInfoguard(item);
    expect(res).toBeUndefined();
    expect(captured.warnings.length).toBe(1);
    expect(item.system.infoguard).toBe(0);
  });
});

describe("infoguardInteractionSection — автоматизация Техночудес vs Инфограждение", () => {
  it("не рисует блок при провале активации", async () => {
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [] };
    const html = await infoguardInteractionSection(caster, { name: "Numerica Curse / Нумерика Проклятье" }, { success: false });
    expect(html).toBe("");
  });

  it("без выбранной цели — просит свериться вручную", async () => {
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [] };
    globalThis.game.user.targets = [];
    const html = await infoguardInteractionSection(caster, { name: "Numerica Curse / Нумерика Проклятье" }, { success: true });
    expect(html).toMatch(/Цель не выбрана/);
  });

  it("с целью — подставляет её Инфограждение как встречный порог", async () => {
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [] };
    const targetItem = weapon({ infoguard: 3 });
    const targetActor = { name: "Скиталец", system: { characteristics: { int: { bonus: 2 } } }, items: [targetItem] };
    globalThis.game.user.targets = [{ actor: targetActor }];

    const html = await infoguardInteractionSection(caster, { name: "Scrapcode Injection / Инъекция Скрапкода" }, { success: true });
    expect(html).toMatch(/Скиталец/);
    expect(html).toMatch(/Лазган/);
    expect(html).toMatch(/>3</);
  });

  it("цель без наложенного Инфограждения — откат на Tech-Use(I)+0 по I.b", async () => {
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [] };
    const targetItem = weapon({ infoguard: 0 });
    const targetActor = { name: "Скиталец", system: { characteristics: { int: { bonus: 2 } } }, items: [targetItem] };
    globalThis.game.user.targets = [{ actor: targetActor }];

    const html = await infoguardInteractionSection(caster, { name: "Numerica Delving / Нумерика Погружение" }, { success: true });
    expect(html).toMatch(/не наложено/);
    expect(html).toMatch(/I\.b 2/);
  });

  it("усиливающее чудо без цели поднимает Инфограждение своих предметов", async () => {
    const item1 = weapon({ infoguard: 1 });
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [item1] };
    item1.actor = caster;
    item1.isOwner = true;
    item1.update = async changes => { Object.assign(item1.system, unflatten(changes)); return item1; };
    globalThis.game.user.targets = [];

    // Techsorcism Ward: +½I.b(окр.▲) = ⌈4/2⌉ = 2 → 1+2=3
    const html = await infoguardInteractionSection(caster, { name: "Techsorcism Ward / Оберег Техзорцизма" }, { success: true });
    expect(item1.system.infoguard).toBe(3);
    expect(html).toMatch(/1 → <b>3<\/b>/);
  });

  it("Vox Warding поднимает Инфограждение до I.b, только если ниже", async () => {
    const alreadyHigh = weapon({ infoguard: 10 });
    const caster = { name: "Жрец", system: { characteristics: { int: { bonus: 4 } } }, items: [alreadyHigh] };
    alreadyHigh.actor = caster;
    alreadyHigh.isOwner = true;
    alreadyHigh.update = async changes => { Object.assign(alreadyHigh.system, unflatten(changes)); return alreadyHigh; };
    globalThis.game.user.targets = [];

    const html = await infoguardInteractionSection(caster, { name: "Vox Warding / Вокс Ограждение" }, { success: true });
    expect(alreadyHigh.system.infoguard).toBe(10); // I.b=4 < 10, не понижаем
    expect(html).toBe("");
  });
});
