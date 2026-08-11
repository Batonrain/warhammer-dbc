import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  rollAddictionTest,
  applyEffectExtras,
  applyDrug,
  triggerAfterEffect,
  deactivateDrugEffect,
  removeDrugAddiction,
  activateDrugListeners
} from "../../module/sheets/tabs/drugs.mjs";
import { computeWoundHealing, computeWoundDamage } from "../../module/sheets/tabs/wounds.mjs";

function drug({ id = "drug-1", addicted = false, system = null } = {}) {
  const updates = [];
  const item = {
    id,
    name: "Пыльца",
    type: "drug",
    updates,
    system: system ?? { addiction: { hasAddiction: true, isAddicted: addicted } },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = item;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    },
    toObject: () => ({ _id: id, name: item.name, type: item.type, system: structuredClone(item.system) })
  };
  return item;
}

function actor({ items = [], fatigue = 0, t = 40, wp = 35 } = {}) {
  const updates = [];
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Подставной",
    updates,
    items: list,
    system: {
      fatigue: { value: fatigue },
      conditions: {},
      wounds: { value: 5, max: 10, critical: 0 },
      characteristics: {
        t: { total: t, bonus: Math.floor(t / 10) },
        wp: { total: wp, bonus: Math.floor(wp / 10) },
        int: { total: 40, value: 40, bonus: 4 }
      },
      corruptionBonus: 0
    },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = a;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return a;
}

beforeEach(resetCaptured);

beforeEach(() => {
  game.time = { worldTime: 123 };
  Item.create = async (data, options = {}) => {
    captured.created.push({ data, parent: options.parent });
    return data;
  };
});

describe("drug addiction test", () => {
  it("провал ставит зависимость на препарат и состояние на актора", async () => {
    const item = drug();
    const a = actor({ items: [item], fatigue: 1, t: 40 });
    captured.nextRoll = 50;

    await rollAddictionTest(a, item, "wp", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": true });
    expect(a.updates[0]).toEqual({ "system.conditions.addicted": true });
    expect(captured.chat[0].content).toContain("Порог: <b>25</b>");
    expect(captured.chat[0].content).toContain("Персонаж стал зависим");
  });

  it("успех снимает общее состояние, если других зависимостей нет", async () => {
    const item = drug({ addicted: true });
    const a = actor({ items: [item], t: 40 });
    captured.nextRoll = 20;

    await rollAddictionTest(a, item, "t", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates[0]).toEqual({ "system.conditions.addicted": false });
    expect(captured.chat[0].content).toContain("Зависимость преодолена");
  });

  it("успех не снимает общее состояние, если есть другая активная зависимость", async () => {
    const item = drug({ id: "drug-1", addicted: true });
    const other = drug({ id: "drug-2", addicted: true });
    const a = actor({ items: [item, other], t: 40 });
    captured.nextRoll = 20;

    await rollAddictionTest(a, item, "t", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates).toEqual([]);
  });
});

describe("drug special effects", () => {
  it("computeWoundHealing сначала снимает критический урон, потом лечит Раны", () => {
    expect(computeWoundHealing({
      wounds: { value: 4, max: 10, critical: 3 }
    }, 5)).toEqual({
      "system.wounds.value": 6,
      "system.wounds.critical": 0
    });
  });

  it("computeWoundDamage переносит переполнение в критический урон и сбрасывает First Aid", () => {
    expect(computeWoundDamage({
      wounds: { value: 2, max: 10, critical: 1, firstAidUsed: true }
    }, 5)).toEqual({
      "system.wounds.value": 0,
      "system.wounds.critical": 4,
      "system.wounds.firstAidUsed": false
    });
  });

  it("applyEffectExtras собирает апдейты, строки чата и броски", async () => {
    const a = actor({ fatigue: 1, t: 40 });
    a.system.conditions = { haemorrhaging: true, haemorrhagingLevel: 3 };
    a.system.wounds = { value: 5, max: 10, critical: 0, firstAidUsed: true };
    captured.nextRoll = 2;

    const result = await applyEffectExtras(a, {
      removesHaemorrhagingLevels: 2,
      grantsFatigue: 1,
      healFormula: "1d5",
      woundDamage: "1d5"
    });

    expect(result.updates).toMatchObject({
      "system.conditions.haemorrhagingLevel": 1,
      "system.conditions.haemorrhaging": true,
      "system.fatigue.value": 2,
      "system.wounds.value": 3,
      "system.wounds.critical": 0,
      "system.wounds.firstAidUsed": false
    });
    expect(result.rolls).toHaveLength(2);
    expect(result.lines.join("\n")).toContain("Обескровливания");
  });
});

describe("applyDrug", () => {
  it("самоприменение расходует дозу, активирует эффект, применяет спецэффекты и пишет чат", async () => {
    const item = drug({ system: {
      quantity: 2,
      drugCategory: "medicine",
      deliveryMethod: "injection",
      duration: "1d5",
      effect: "Бодрит",
      statMods: { t: 5 },
      specialEffects: {
        removesBleedingLevels: 1,
        grantsCondition: "stunned",
        grantsConditionLevel: 1
      },
      activeEffect: {}
    } });
    const a = actor({ items: [item] });
    a.system.conditions = { bleeding: true, bleedingLevel: 2, stunned: false };
    captured.nextRoll = 3;

    await applyDrug(a, item);

    expect(item.updates[0]).toMatchObject({
      "system.quantity": 1,
      "system.activeEffect.isActive": true,
      "system.activeEffect.appliedAt": 123,
      "system.activeEffect.roundsRemaining": 3
    });
    expect(a.updates[0]).toMatchObject({
      "system.conditions.bleedingLevel": 1,
      "system.conditions.bleeding": true,
      "system.conditions.stunned": true
    });
    expect(captured.chat[0].content).toContain("Длительность");
    expect(captured.chat[0].content).toContain("Осталось: 1");
  });

  it("применение на цель расходует дозу владельца и создаёт активную копию при длящемся эффекте", async () => {
    const item = drug({ system: {
      quantity: 1,
      drugCategory: "narcotic",
      duration: "1d5",
      statMods: { s: 10 },
      specialEffects: {},
      activeEffect: {}
    } });
    const owner = actor({ items: [item] });
    owner.name = "Медик";
    const target = actor();
    target.name = "Цель";
    captured.nextRoll = 4;

    await applyDrug(owner, item, target);

    expect(item.updates[0]).toEqual({ "system.quantity": 0 });
    expect(captured.created).toHaveLength(1);
    expect(captured.created[0].parent).toBe(target);
    expect(captured.created[0].data.system).toMatchObject({
      quantity: 0,
      activeEffect: {
        isActive: true,
        isAfterEffect: false,
        appliedAt: 123,
        roundsRemaining: 4
      }
    });
    expect(captured.chat[0].content).toContain("Медик");
    expect(captured.chat[0].content).toContain("Цель");
  });

  it("не применяет препарат с нулевым запасом", async () => {
    const item = drug({ system: { quantity: 0, specialEffects: {}, activeEffect: {} } });
    const a = actor({ items: [item] });

    await applyDrug(a, item);

    expect(item.updates).toEqual([]);
    expect(a.updates).toEqual([]);
    expect(captured.chat).toEqual([]);
  });
});

describe("triggerAfterEffect", () => {
  it("не трогает препарат без пост-эффекта", async () => {
    const item = drug({ system: { hasAfterEffect: false, activeEffect: {} } });
    const a = actor({ items: [item] });

    await triggerAfterEffect(a, item);

    expect(item.updates).toEqual([]);
    expect(a.updates).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("активирует пост-эффект, применяет спецэффекты, урон в характеристику и пишет чат", async () => {
    const item = drug({ system: {
      hasAfterEffect: true,
      drugCategory: "poison",
      afterEffect: "Откат",
      afterEffectDice: "1d5",
      afterEffectStatMods: { wp: -5 },
      afterEffectCharDamage: { stat: "int", formula: "1d5" },
      afterEffectSpecial: {
        removesBleedingLevels: 1,
        removesWounds: 2,
        grantsCondition: "stunned",
        customEffect: "Побочный эффект"
      },
      activeEffect: { isActive: true, roundsRemaining: 1 }
    } });
    const a = actor({ items: [item] });
    a.system.conditions = { bleeding: true, bleedingLevel: 2, stunned: false };
    captured.nextRoll = 2;

    await triggerAfterEffect(a, item);

    expect(a.updates[0]).toMatchObject({
      "system.conditions.bleedingLevel": 1,
      "system.conditions.bleeding": true,
      "system.wounds.value": 7,
      "system.wounds.critical": 0,
      "system.conditions.stunned": true
    });
    expect(item.updates[0]).toMatchObject({
      "system.activeEffect.isActive": true,
      "system.activeEffect.isAfterEffect": true,
      "system.activeEffect.roundsRemaining": 0,
      "system.activeEffect.charDamageStat": "int",
      "system.activeEffect.charDamageAmount": 2
    });
    expect(captured.chat[0].content).toContain("Пост-эффект");
    expect(captured.chat[0].content).toContain("Модификаторы");
    expect(captured.chat[0].content).toContain("Урон в характеристику");
    expect(captured.chat[0].content).toContain("Побочный эффект");
    expect(captured.chat[0].rolls).toHaveLength(2);
  });
});

describe("drug sheet listeners", () => {
  it("deactivateDrugEffect завершает активный эффект препарата", async () => {
    const item = drug({ system: {
      activeEffect: {
        isActive: true,
        isAfterEffect: true,
        roundsRemaining: 3,
        charDamageStat: "int",
        charDamageAmount: 2
      }
    } });

    await deactivateDrugEffect(item);

    expect(item.updates[0]).toEqual({
      "system.activeEffect.isActive": false,
      "system.activeEffect.isAfterEffect": false,
      "system.activeEffect.roundsRemaining": 0,
      "system.activeEffect.charDamageStat": "",
      "system.activeEffect.charDamageAmount": 0
    });
  });

  it("removeDrugAddiction снимает общее состояние только если других зависимостей нет", async () => {
    const item = drug({ id: "drug-1", addicted: true });
    const other = drug({ id: "drug-2", addicted: true });
    const a = actor({ items: [item, other] });

    await removeDrugAddiction(a, item);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates).toEqual([]);

    await removeDrugAddiction(a, other);

    expect(other.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates[0]).toEqual({ "system.conditions.addicted": false });
  });

  it("activateDrugListeners привязывает обработчики препаратов к actor-only API", async () => {
    const handlers = {};
    const html = {
      find: selector => ({
        click: fn => { handlers[selector] = fn; }
      })
    };
    const item = drug({ system: { activeEffect: { isActive: true } } });
    const a = actor({ items: [item] });

    activateDrugListeners(html, a);

    await handlers[".effect-deactivate-btn"]({
      preventDefault: () => {},
      currentTarget: { dataset: { itemId: item.id } }
    });

    expect(item.updates[0]).toMatchObject({
      "system.activeEffect.isActive": false,
      "system.activeEffect.isAfterEffect": false
    });
  });
});
