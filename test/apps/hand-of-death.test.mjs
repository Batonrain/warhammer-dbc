// test/apps/hand-of-death.test.mjs
//
// Мутация «Рука Смерти» (wdbc-hftn): слияние с выбранным оружием актора.
// Реальный module/apps/mechanics.mjs используется как есть (тот же приём,
// что в mechanics-sync.test.mjs/mechanics-initiative-entry.test.mjs) —
// мокаются только сам актор/предметы, не движок Конструктора.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyHandOfDeathFusion, cleanupHandOfDeath } from "../../module/apps/hand-of-death.mjs";

function fakeItem({ id, type, name = "Предмет", flags = {}, system = {} }) {
  const store = { ...flags };
  const item = {
    id, type, name,
    system: { weaponProps: [], balance: 0, ...system },
    effects: [],
    getFlag: (ns, key) => store[key],
    setFlag: async (ns, key, value) => { store[key] = value; item.flags = { [ns]: { ...store } }; return item; },
    update: async (data) => {
      for (const [path, value] of Object.entries(data)) {
        if (path.startsWith("flags.warhammer-dbc.-=")) { delete store[path.split(".-=")[1]]; continue; }
        if (path.startsWith("flags.warhammer-dbc.")) { store[path.split("flags.warhammer-dbc.")[1]] = value; continue; }
        if (path === "system.weaponProps") item.system.weaponProps = value;
        if (path === "system.balance") item.system.balance = value;
      }
      return item;
    },
    createEmbeddedDocuments: async (docType, docs) => { item.effects.push(...docs.map(d => fakeEffect(d))); return item.effects; },
    deleteEmbeddedDocuments: async (docType, ids) => { item.effects = item.effects.filter(e => !ids.includes(e.id)); return ids; },
    flags: { "warhammer-dbc": { ...flags } }
  };
  return item;
}

function fakeEffect(data) {
  let disabled = false;
  return {
    id: data.flags?.["warhammer-dbc"]?.mechEntry ?? Math.random().toString(36),
    name: data.name,
    system: data.system,
    flags: data.flags,
    disabled,
    getFlag: (ns, key) => data.flags?.[ns]?.[key]
  };
}

function actorWith(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", items: list };
  for (const it of list) it.parent = actor;
  return actor;
}

describe("applyHandOfDeathFusion", () => {
  let mutation, sword, axe, actor;
  beforeEach(() => {
    mutation = fakeItem({ id: "mut1", type: "mutation", name: "Hand of Death / Рука Смерти" });
    sword = fakeItem({ id: "w1", type: "weapon", name: "Меч", system: { balance: -2 } });
    axe = fakeItem({ id: "w2", type: "weapon", name: "Топор", system: { balance: 1 } });
    actor = actorWith([mutation, sword, axe]);
  });

  it("ставит fusedLimb+reinforced на выбранное оружие и поднимает Баланс до 0", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    const keys = sword.system.weaponProps.map(p => p.key);
    expect(keys).toContain("fusedLimb");
    expect(keys).toContain("reinforced");
    expect(sword.system.balance).toBe(0); // было -2
  });

  it("не трогает Баланс, если он уже был не ниже 0", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w2", "leftArm");
    expect(axe.system.balance).toBe(1);
  });

  it("запоминает выбранное оружие и руку на самой Мутации", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    expect(mutation.getFlag("warhammer-dbc", "fusedWeaponId")).toBe("w1");
    expect(mutation.getFlag("warhammer-dbc", "fusedHand")).toBe("rightArm");
  });

  it("помечает оружие ссылкой на источник (handOfDeathSource) и хранит исходный Баланс для отката", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    expect(sword.getFlag("warhammer-dbc", "handOfDeathSource")).toBe("mut1");
    expect(sword.getFlag("warhammer-dbc", "handOfDeathOrigBalance")).toBe(-2);
  });

  it("перевыбор ДРУГОГО оружия снимает свойства/метку со старого", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    await applyHandOfDeathFusion(actor, mutation, "w2", "leftArm");

    expect(sword.system.weaponProps.some(p => p.key === "fusedLimb")).toBe(false);
    expect(sword.getFlag("warhammer-dbc", "handOfDeathSource")).toBeUndefined();
    expect(sword.system.balance).toBe(-2); // откачен к исходному

    expect(axe.system.weaponProps.some(p => p.key === "fusedLimb")).toBe(true);
    expect(axe.getFlag("warhammer-dbc", "handOfDeathSource")).toBe("mut1");
  });

  it("материализует +10 AP выбранной руке эффектом на самой Мутации", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    const fx = mutation.effects.find(e => e.system?.changes?.some(c => c.key === "system.armorBonus.rightArm"));
    expect(fx).toBeTruthy();
    expect(fx.system.changes[0].value).toBe(10);
  });

  it("повторный выбор ТОЙ ЖЕ руки при перевыборе оружия переставляет АП-эффект на новую локацию", async () => {
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");
    await applyHandOfDeathFusion(actor, mutation, "w2", "leftArm");
    const rightFx = mutation.effects.find(e => e.system?.changes?.some(c => c.key === "system.armorBonus.rightArm"));
    const leftFx  = mutation.effects.find(e => e.system?.changes?.some(c => c.key === "system.armorBonus.leftArm"));
    expect(rightFx).toBeFalsy();
    expect(leftFx).toBeTruthy();
  });
});

describe("cleanupHandOfDeath", () => {
  it("снимает метки с оружия, если Мутации-источника больше нет на акторе", async () => {
    const mutation = fakeItem({ id: "mut1", type: "mutation", name: "Hand of Death / Рука Смерти" });
    const sword = fakeItem({ id: "w1", type: "weapon", name: "Меч" });
    const actor = actorWith([mutation, sword]);
    await applyHandOfDeathFusion(actor, mutation, "w1", "rightArm");

    // Мутация «удалена» — убираем из списка предметов актора, как после deleteItem.
    actor.items = actor.items.filter(i => i.id !== "mut1");
    actor.items.get = id => actor.items.find(i => i.id === id) ?? null;

    await cleanupHandOfDeath(actor, "mut1");

    expect(sword.system.weaponProps.some(p => p.key === "fusedLimb")).toBe(false);
    expect(sword.getFlag("warhammer-dbc", "handOfDeathSource")).toBeUndefined();
    expect(sword.system.balance).toBe(0); // исходный Баланс восстановлен
  });

  it("ничего не делает, если оружие ничем не помечено", async () => {
    const actor = actorWith([fakeItem({ id: "w1", type: "weapon", name: "Меч" })]);
    await expect(cleanupHandOfDeath(actor, "mut1")).resolves.toBeUndefined();
  });
});
