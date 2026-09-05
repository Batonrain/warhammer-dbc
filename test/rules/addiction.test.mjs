// test/rules/addiction.test.mjs
//
// Зависимость (мутация «Addiction», wdbc-5inv/wdbc-1rno) — module/rules/addiction.mjs.
// Штраф −10 к тестам Навыков читается через общий конвейер (resolve-test.mjs,
// scope "anySkill"), здесь проверяются только сами примитивы: поиск
// предметов-носителей (по capabilityKey — addictionItems, и по имени —
// isAddictionItem, нужен apps/addiction.mjs для кнопки на листе Мутации), счёт
// суток, статус-строка, «Удовлетворить».

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  ADDICTION_CAPABILITY, isAddictionItem, addictionItems, addictionDaysSince, isAddictionUnsatisfied,
  addictionStatusLabel, addictionSubstanceLabel, addictionPenaltyRules,
  satisfyAddiction, setAddictionSubstance
} from "../../module/rules/addiction.mjs";
import { buildTestContext, rollModsFromRules } from "../../module/rules/resolve-test.mjs";

const SECONDS_PER_DAY = 86400;

// update() мутирует те же вложенные объекты item.system.*, как это делает
// настоящий Item после document-update — тесты читают item.system.* сразу
// после await satisfyAddiction(item)/setAddictionSubstance(item, …).
function makeItem({ lastSatisfied = null, substance = "", submutationName = "", name = "Addiction / Зависимость" } = {}) {
  const item = {
    id: "addictItem1", type: "mutation", name,
    system: { dependency: { substance, lastSatisfied }, submutation: { name: submutationName } },
    flags: { "warhammer-dbc": { mechanics: [{
      id: "grp1", operator: "AND",
      entries: [{ id: "addiction-cap", kind: "capability", capabilityKey: ADDICTION_CAPABILITY, when: {} }]
    }] } }
  };
  item.update = async (data) => {
    for (const [path, value] of Object.entries(data)) {
      const parts = path.split(".");
      let cur = item;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts.at(-1)] = value;
    }
  };
  return item;
}

describe("isAddictionItem", () => {
  it("совпадает по двуязычному имени, регистронезависимо", () => {
    expect(isAddictionItem(makeItem({ name: "Addiction / Зависимость" }))).toBe(true);
    expect(isAddictionItem(makeItem({ name: "addiction / зависимость" }))).toBe(true);
  });
  it("совпадает по одной английской половине", () => {
    expect(isAddictionItem(makeItem({ name: "Addiction" }))).toBe(true);
  });
  it("другой тип предмета — false", () => {
    expect(isAddictionItem({ ...makeItem({}), type: "trait" })).toBe(false);
  });
  it("ключ сильнее имени: переименованная Мутация всё1 равно опознаётся", () => {
    // Раньше здесь ожидался false — опознание шло только по имени.
    // Теперь решает ключ на самом предмете (wdbc-wdlw), и это и есть цель:
    // переименование в компендиуме больше не выключает механику.
    expect(isAddictionItem(makeItem({ name: "Совсем другое имя" }))).toBe(true);
  });
  it("ни ключа, ни имени — false", () => {
    const other = makeItem({ name: "Vampiric Dependency / Вампирическая Зависимость" });
    other.flags = {};
    expect(isAddictionItem(other)).toBe(false);
  });
  it("нет предмета — false", () => {
    expect(isAddictionItem(null)).toBe(false);
  });
});

describe("addictionItems", () => {
  it("находит мутацию по capabilityKey mutation.addiction", () => {
    const item = makeItem({});
    const actor = { items: [item] };
    expect(addictionItems(actor)).toEqual([item]);
  });

  it("не находит другие типы предметов / другой capabilityKey", () => {
    const other = { id: "x", type: "mutation", flags: { "warhammer-dbc": { mechanics: [{
      entries: [{ kind: "capability", capabilityKey: "mutation.somethingElse" }]
    }] } } };
    const talent = { id: "y", type: "talent", flags: { "warhammer-dbc": { mechanics: [{
      entries: [{ kind: "capability", capabilityKey: ADDICTION_CAPABILITY }]
    }] } } };
    expect(addictionItems({ items: [other, talent] })).toEqual([]);
  });
});

describe("addictionDaysSince / isAddictionUnsatisfied", () => {
  it("lastSatisfied не проставлен — 0 суток, без штрафа задним числом", () => {
    const item = makeItem({ lastSatisfied: null });
    expect(addictionDaysSince(item, 999999)).toBe(0);
    expect(isAddictionUnsatisfied(item, 999999)).toBe(false);
  });

  it("меньше суток с утоления — удовлетворена", () => {
    const item = makeItem({ lastSatisfied: 0 });
    expect(isAddictionUnsatisfied(item, SECONDS_PER_DAY - 1)).toBe(false);
  });

  it("ровно сутки и больше — не удовлетворена", () => {
    const item = makeItem({ lastSatisfied: 0 });
    expect(isAddictionUnsatisfied(item, SECONDS_PER_DAY)).toBe(true);
    expect(addictionDaysSince(item, SECONDS_PER_DAY * 2.5)).toBeCloseTo(2.5);
  });
});

describe("addictionStatusLabel / addictionSubstanceLabel", () => {
  it("до штрафа — показывает остаток", () => {
    const item = makeItem({ lastSatisfied: 0 });
    expect(addictionStatusLabel(item, SECONDS_PER_DAY / 2)).toMatch(/до штрафа/);
  });

  it("просрочено — показывает «не удовлетворена»", () => {
    const item = makeItem({ lastSatisfied: 0 });
    expect(addictionStatusLabel(item, SECONDS_PER_DAY * 3)).toMatch(/не удовлетворена/);
  });

  it("своё поле substance важнее автоподстановки из субмутации", () => {
    const item = makeItem({ substance: "странная еда", submutationName: "Прах ксеноса" });
    expect(addictionSubstanceLabel(item)).toBe("странная еда");
  });

  it("пустое substance — берёт название выпавшей субмутации", () => {
    const item = makeItem({ substance: "", submutationName: "Прах ксеноса" });
    expect(addictionSubstanceLabel(item)).toBe("Прах ксеноса");
  });

  it("ничего не задано — пустая строка", () => {
    const item = makeItem({});
    expect(addictionSubstanceLabel(item)).toBe("");
  });
});

describe("addictionPenaltyRules", () => {
  it("удовлетворена — правил нет", () => {
    globalThis.game.time = { worldTime: SECONDS_PER_DAY };
    const item = makeItem({ lastSatisfied: SECONDS_PER_DAY - 10 });
    expect(addictionPenaltyRules({ items: [item] })).toEqual([]);
  });

  it("не удовлетворена — одно правило −10 на anySkill", () => {
    globalThis.game.time = { worldTime: SECONDS_PER_DAY * 3 };
    const item = makeItem({ lastSatisfied: 0 });
    const rules = addictionPenaltyRules({ items: [item] });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "anySkill", value: -10 });
  });
});

describe("satisfyAddiction / setAddictionSubstance", () => {
  it("сбрасывает таймер на текущий worldTime", async () => {
    globalThis.game.time = { worldTime: 12345 };
    const item = makeItem({ lastSatisfied: 0 });
    await satisfyAddiction(item);
    expect(item.system.dependency.lastSatisfied).toBe(12345);
  });

  it("пустое substance при утолении подставляется из субмутации", async () => {
    globalThis.game.time = { worldTime: 500 };
    const item = makeItem({ substance: "", submutationName: "Слёзы" });
    await satisfyAddiction(item);
    expect(item.system.dependency.substance).toBe("Слёзы");
  });

  it("уже вписанное substance при утолении не перезаписывается", async () => {
    globalThis.game.time = { worldTime: 500 };
    const item = makeItem({ substance: "своё", submutationName: "Слёзы" });
    await satisfyAddiction(item);
    expect(item.system.dependency.substance).toBe("своё");
  });

  it("setAddictionSubstance пишет ровно переданное значение", async () => {
    const item = makeItem({});
    await setAddictionSubstance(item, "новый объект");
    expect(item.system.dependency.substance).toBe("новый объект");
  });
});

describe("scope anySkill (resolve-test.mjs::effectAppliesTo, через rollModsFromRules)", () => {
  const rule = [{ id: "r", label: "Тест", effects: [{ kind: "rollBonus", target: "anySkill", value: -10 }] }];

  it("срабатывает на тесте обычного Навыка", () => {
    expect(rollModsFromRules(rule, buildTestContext({ skill: "medicae" }))).toHaveLength(1);
  });
  it("срабатывает на групповом Навыке", () => {
    expect(rollModsFromRules(rule, buildTestContext({ group: "trade", specialty: "Armourer" }))).toHaveLength(1);
  });
  it("НЕ срабатывает на тесте Характеристики (нет ни skill, ни group)", () => {
    expect(rollModsFromRules(rule, buildTestContext({ char: "t" }))).toHaveLength(0);
  });
  it("НЕ срабатывает на атаке/манифестации", () => {
    expect(rollModsFromRules(rule, buildTestContext({ kind: "attack", isMelee: true }))).toHaveLength(0);
    expect(rollModsFromRules(rule, buildTestContext({ kind: "power" }))).toHaveLength(0);
  });
});
