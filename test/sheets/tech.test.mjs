import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import {
  activateTechListeners,
  activateTechMiracle,
  rollTechScan,
  techGenResource
} from "../../module/sheets/tabs/tech.mjs";

function item({ id = "tech-1", name = "Литания Машины", type = "techPower", system = {} } = {}) {
  const it = {
    id,
    name,
    type,
    system,
    updates: [],
    flags: [],
    update: async data => {
      it.updates.push(data);
      return data;
    },
    setFlag: async (scope, key, value) => {
      it.flags.push({ scope, key, value });
      return value;
    }
  };
  return it;
}

function actor({ items = [], fatigue = 0, system = {} } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    id: "actor-1",
    name: "Техножрец",
    items: list,
    updates: [],
    system: {
      fatigue: { value: fatigue },
      cognition: { value: 5, max: 6, regen: 2 },
      energy: { value: 5, max: 6, maxTotal: 6 },
      skills: { techUse: { total: 50 } },
      techFocus: [],
      techCompBonus: 0,
      corruptionBonus: 0,
      characteristics: {
        int: { total: 45, value: 45, bonus: 4 },
        t: { total: 40, value: 40, bonus: 4 }
      },
      ...system
    },
    update: async data => {
      a.updates.push(data);
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
  Item.create = async (data, options = {}) => {
    captured.created.push({ data, parent: options.parent });
    return { ...data, sheet: { render: () => {} } };
  };
});

describe("activateTechMiracle", () => {
  it("не активирует Техночудо без Когниции", async () => {
    const a = actor({ system: { cognition: { value: 1, max: 6, regen: 2 } } });
    const miracle = item({ system: { cognitionCost: 2, energyCost: 0 } });

    await activateTechMiracle(a, miracle);

    expect(a.updates).toEqual([]);
    expect(captured.chat).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("некомпилированное Славословие пишет карточку компиляции без броска", async () => {
    const miracle = item({ system: { miracleType: "slavoslovie", compiled: false, rating: 3 } });

    await activateTechMiracle(actor(), miracle);

    expect(captured.rolls).toEqual([]);
    expect(captured.chat[0].content).toContain("Компиляция Славословия");
    expect(captured.chat[0].content).toContain("3×5 = 15");
  });

  // wdbc-lp7r: Славословие бывает не primary-типом, а элементом extraTypes на
  // предмете другого типа (напр. Императив (I.b×2), Славословие(1)) — X тогда
  // свой (extraType.x), не sys.rating (тот занят под основной тип).
  it("некомпилированное Славословие как extraTypes у другого primary-типа тоже гейтит компиляцией", async () => {
    const miracle = item({ system: {
      miracleType: "imperative", rating: 1, compiled: false,
      extraTypes: [{ type: "slavoslovie", x: 2 }]
    } });

    await activateTechMiracle(actor(), miracle);

    expect(captured.rolls).toEqual([]);
    expect(captured.chat[0].content).toContain("Компиляция Славословия");
    expect(captured.chat[0].content).toContain("2×5 = 10");
  });

  it("скомпилированное Славословие-extraTypes активируется как обычно (не перегейчивается снова)", async () => {
    const a = actor();
    const miracle = item({ system: {
      miracleType: "imperative", rating: 1, compiled: true,
      extraTypes: [{ type: "slavoslovie", x: 2 }], cognitionCost: 0, energyCost: 0
    } });

    await activateTechMiracle(a, miracle);

    expect(captured.rolls.length).toBeGreaterThan(0);
  });

  it("успех тратит Когницию и Энергию, бросает урон и пишет карточку", async () => {
    const a = actor();
    const miracle = item({ system: {
      cognitionCost: 2,
      energyCost: 3,
      testSkill: "techUse",
      damage: "1d5",
      damageType: "energy",
      penetration: 2,
      effect: "Система активна"
    } });
    captured.nextRoll = 30;

    await activateTechMiracle(a, miracle);

    expect(a.updates[0]).toEqual({
      "system.cognition.value": 3,
      "system.energy.value": 2
    });
    expect(captured.rolls).toEqual(["1d100", "1d5"]);
    expect(captured.chat[0].content).toContain("Порог: <b>50</b>");
    expect(captured.chat[0].content).toContain("Активировано");
    expect(captured.chat[0].content).toContain("Энергия");
  });

  // Раньше у техночудес не было поля для свойств атаки вовсе: Экстремальный
  // урон и Рвущее для них не считались — только текстом в «Эффекте». Теперь
  // sys.weaponProps идёт через тот же движок, что у оружия и психосил
  // (module/combat/attack.mjs: applyDamageDiceMods + rollExtremeDamage).
  it("урон Техночуда подхватывает Рвущее и Экстремальный урон, как у оружия", async () => {
    const a = actor();
    const miracle = item({ system: {
      testSkill: "techUse", damage: "1d10+2", damageType: "energy",
      weaponProps: [{ key: "tearing", rating: 0, rating2: 0 }]
    } });
    // Очередь кубов: тест активации (успех), затем 2 куба Рвущего (10 держим,
    // 3 сбрасываем), затем 1d5 Экстремального урона.
    captured.dice = [10, 10, 3, 4];

    await activateTechMiracle(a, miracle);

    expect(captured.rolls).toContain("2d10kh1+2");
    expect(captured.rolls).toContain("1d5");
    expect(captured.chat[0].content).toContain("Урон (Энергетический, Проб. 0): <b>12</b>");
    expect(captured.chat[0].content).toContain("Экстремальный урон");
    expect(captured.chat[0].content).toContain("d5: 4");
  });

  it("провал тратит Когницию, но не тратит Энергию", async () => {
    const a = actor();
    const miracle = item({ system: { cognitionCost: 2, energyCost: 3, testSkill: "techUse" } });
    captured.nextRoll = 80;

    await activateTechMiracle(a, miracle);

    expect(a.updates[0]).toEqual({ "system.cognition.value": 3 });
    expect(captured.chat[0].content).toContain("Сбой");
  });

  it("Компенсатор снижает цену Энергии перед основным тестом", async () => {
    const a = actor({ system: { energy: { value: 2, max: 6, maxTotal: 6 } } });
    const miracle = item({ system: {
      miracleType: "compensator",
      rating: 1,
      cognitionCost: 1,
      energyCost: 3,
      testSkill: "techUse"
    } });
    captured.dice = [20, 30];

    await activateTechMiracle(a, miracle);

    expect(a.updates[0]).toEqual({
      "system.cognition.value": 4,
      "system.energy.value": 1
    });
    expect(captured.chat[0].content).toContain("Компенсатор");
    expect(captured.chat[0].content).toContain("3→1");
  });

  it("Железо требует установленный технофокус", async () => {
    const a = actor();
    const miracle = item({ system: { iron: "Печь", cognitionCost: 0, energyCost: 0 } });

    await activateTechMiracle(a, miracle);

    expect(a.updates).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("качество Железа меняет порог и попадает в карточку", async () => {
    const a = actor({
      system: { techFocus: [{ name: "Печь Плоти / Flesh Furnace", quality: "best" }] }
    });
    const miracle = item({ system: { iron: "Печь", cognitionCost: 0, energyCost: 0, testSkill: "techUse" } });
    captured.nextRoll = 60;

    await activateTechMiracle(a, miracle);

    expect(captured.chat[0].content).toContain("Железо");
    expect(captured.chat[0].content).toContain("Порог: <b>60</b>");
    expect(captured.chat[0].content).toContain("Активировано");
  });
});

// activateTechMiracle доходит до DialogV2.wait через несколько await'ов (Roll
// активации, infoguardInteractionSection) — макротик (setTimeout 0) надёжно
// дожидается очереди микрозадач, один await Promise.resolve() не гарантирует
// этого (см. test/combat/mount-roll.test.mjs).
const flush = () => new Promise(r => setTimeout(r, 0));

/** Минимальный актор-цель Императива: только то, что читает module/rules/imperative.mjs. */
function imperativeTarget(name = "Цель") {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  let nextId = 1;
  return {
    name, items,
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => {
        const clone = structuredClone(d);
        return { id: `carrier-${nextId++}`, ...clone, getFlag: (s, k) => clone.flags?.[s]?.[k] };
      });
      items.push(...created);
      return created;
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      for (const id of ids) {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      }
    }
  };
}

describe("activateTechMiracle: Императив (wdbc-yu32)", () => {
  beforeEach(() => {
    globalThis.game.user = { targets: [] };
  });

  it("цели не выбраны — предупреждение в карточке, носитель не создаётся", async () => {
    const a = actor();
    const miracle = item({ name: "Evasion Imperative / Императив Избегания", system: { miracleType: "imperative", cognitionCost: 0, energyCost: 0, testSkill: "techUse" } });
    captured.nextRoll = 10;

    await activateTechMiracle(a, miracle);

    expect(captured.chat[0].content).toContain("цели не выбраны");
  });

  it("успех + выбранные цели + подтверждение диалога — накладывает Императив на всех целей", async () => {
    const target = imperativeTarget("Цель 1");
    globalThis.game.user = { targets: [{ actor: target }] };
    const a = actor();
    const miracle = item({ name: "Evasion Imperative / Императив Избегания", system: { miracleType: "imperative", cognitionCost: 0, energyCost: 0, testSkill: "techUse" } });
    captured.nextRoll = 10;

    const promise = activateTechMiracle(a, miracle);
    await flush(); // несколько await'ов (Roll.evaluate, infoguard) до открытия диалога
    await captured.press("apply", fakeForm({ '[name="bonus"]': "30" }));
    await promise;

    expect(target.items).toHaveLength(1);
    expect(target.items[0].type).toBe("trait");
    expect(target.items[0].getFlag("warhammer-dbc", "imperativeBonuses")).toEqual({ evasionBonus: 30, coverApDelta: -8, coverApFloorRatio: 0.5, coverApCeilRatio: undefined });
    expect(captured.chat[0].content).toContain("Императив Избегания: +30 на Избегания → Цель 1");
  });

  it("отмена диалога — Императив не накладывается", async () => {
    const target = imperativeTarget("Цель 1");
    target.createEmbeddedDocuments = async () => { throw new Error("не должен вызываться при отмене"); };
    globalThis.game.user = { targets: [{ actor: target }] };
    const a = actor();
    const miracle = item({ name: "Fortress Imperative / Императив Крепости", system: { miracleType: "imperative", cognitionCost: 0, energyCost: 0, testSkill: "techUse" } });
    captured.nextRoll = 10;

    const promise = activateTechMiracle(a, miracle);
    await flush();
    captured.dismiss();
    await promise;

    expect(captured.chat[0].content).toContain("наложение отменено");
  });
});

describe("tech resources", () => {
  it("techGenResource добавляет Энергию до максимума", async () => {
    const a = actor({ system: { energy: { value: 4, max: 6, maxTotal: 6 } } });
    const implant = item({ name: "Мотивный Банк / Motive Bank", type: "implant", system: { quality: "common" } });

    await techGenResource(a, implant, { res: "energy", amount: 4, fromCognition: 0 });

    expect(a.updates[0]).toEqual({ "system.energy.value": 6 });
    expect(captured.chat[0].content).toContain("Мотивный Банк");
  });

  it("techGenResource конвертирует Когницию в Энергию по качеству", async () => {
    const a = actor({ system: {
      cognition: { value: 6, max: 6, regen: 2 },
      energy: { value: 1, max: 6, maxTotal: 6 }
    } });
    const implant = item({ name: "Двигатель Холодного Синтеза", type: "implant", system: { quality: "poor" } });

    await techGenResource(a, implant, { res: "energy", amount: 0, fromCognition: 1 });

    expect(a.updates[0]).toEqual({
      "system.cognition.value": 2,
      "system.energy.value": 2
    });
    expect(captured.chat[0].content).toContain("Poor.Q");
  });

  it("rollTechScan делегирует общий бросок навыка", () => {
    const calls = [];

    rollTechScan(actor(), (...args) => calls.push(args));

    expect(calls[0]).toEqual(["📡 Ноосферное Сканирование (Tech-Use)", 50, "int", { skill: "techUse" }]);
  });
});

describe("tech sheet listeners", () => {
  it("activateTechListeners привязывает обработчики вкладки к actor-only API", async () => {
    const handlers = {};
    const html = {
      find: selector => ({
        click: fn => { handlers[`${selector}:click`] = fn; },
        change: fn => { handlers[`${selector}:change`] = fn; }
      })
    };
    const implant = item({ id: "implant-1", type: "implant", system: { quality: "common" } });
    const miracle = item({ id: "miracle-1", system: { cognitionCost: 0, energyCost: 0, testSkill: "techUse" } });
    const a = actor({ items: [implant, miracle] });
    const rolls = [];

    activateTechListeners(html, a, { rollSkill: (...args) => rolls.push(args) });

    handlers[".cognition-input:change"]({ currentTarget: { value: "4" } });
    handlers[".energy-input:change"]({ currentTarget: { value: "3" } });
    await handlers[".cognition-rest-btn:click"]({ preventDefault: () => {} });
    handlers[".tech-scan-btn:click"]();
    await handlers[".tech-toggle-cb:change"]({ currentTarget: { dataset: { itemId: "implant-1" }, checked: true } });

    expect(a.updates[0]).toEqual({ "system.cognition.value": 4 });
    expect(a.updates[1]).toEqual({ "system.energy.value": 3 });
    expect(a.updates[2]).toEqual({ "system.cognition.value": 6 });
    expect(rolls[0]).toEqual(["📡 Ноосферное Сканирование (Tech-Use)", 50, "int", { skill: "techUse" }]);
    expect(implant.flags[0]).toEqual({ scope: "warhammer-dbc", key: "techActive", value: true });
  });
});
