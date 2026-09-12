// test/sheets/tabs/death.test.mjs
//
// module/sheets/tabs/death.mjs::_resolveFateSave — путь Eternal Warrior/
// Вечный Воин (wdbc-sk8s): free (раз за сессию, 0 стоимость) и flat
// (фиксированная 1 Очко Бесчестия, дальнобойная смерть, не трогает заряд
// сессии). Обычный (без Вечного Воина) путь уже покрыт
// test/documents/runic-weave-hooks.test.mjs — здесь только новые ветки.

import "../../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { doMiraculousSave, doDivineProtection, doSusAnimation, doSundering, showDeathSaveDialog }
  from "../../../module/sheets/tabs/death.mjs";
import { eternalWarriorFreeSaveAvailable } from "../../../module/combat/eternal-warrior.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../../module/rules/sources.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined (не
// нужна остальным тестам, см. test/apps/infamy-points-gods.test.mjs) —
// spendFromInfamyPool читает через неё текущий пул, поэтому здесь нужна
// настоящая реализация по пути через точку.
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

function berserker({ fate = 30, corruption = 10 } = {}) {
  const flags = {};
  const updates = [];
  return {
    id: "a1", name: "Берсерк", type: "character",
    system: {
      alignment: "heretic", inRage: true,
      fate: { value: fate }, corruption: { value: corruption },
      wounds: { value: -3, critical: 3, max: 10 }
    },
    items: [{ type: "mutation", name: "Eternal Warrior / Вечный Воин" }],
    updates,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async update(data) { updates.push(data); Object.assign(this.system, {
      ...(data["system.fate.value"] !== undefined ? { fate: { value: data["system.fate.value"] } } : {}),
      ...(data["system.corruption.value"] !== undefined ? { corruption: { value: data["system.corruption.value"] } } : {})
    }); }
  };
}

beforeEach(resetCaptured);

describe("Eternal Warrior — путь free", () => {
  it("0 стоимость пула, Порча не растёт, отмечает разовый заряд сессии", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true);
    await doMiraculousSave(actor, { eternalWarrior: "free" });

    expect(captured.rolls).toEqual([]); // никаких костей — путь бесплатный
    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(30); // не потрачено
    expect(upd["system.corruption.value"]).toBe(10); // не выросла
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(false); // заряд сессии сгорел
  });
});

describe("Eternal Warrior — путь flat", () => {
  it("фиксированная 1 Очко Бесчестия, Порча не растёт, заряд сессии не трогает", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    await doDivineProtection(actor, { eternalWarrior: "flat" });

    expect(captured.rolls).toEqual([]);
    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(29); // 30 − 1
    expect(upd["system.corruption.value"]).toBe(10);
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true); // заряд сессии остался цел
  });

  it("недостаточно пула (fate=0) — провал, как у обычного Спасения", async () => {
    const actor = berserker({ fate: 0, corruption: 10 });
    await doMiraculousSave(actor, { eternalWarrior: "flat" });
    expect(captured.chat.at(-1).content).toContain("Провал");
  });
});

// Kiss of Death/Поцелуй Смерти (wdbc-1rno, Слаанеш): «Спасение от смерти,
// вызванной этой атакой, тратит двойное количество Бесчестия или Очков
// Судьбы» — метка на ЖЕРТВЕ (не на носителе Дара), одноразовая.
describe("Kiss of Death — удвоенная цена Спасения (wdbc-1rno)", () => {
  it("метка стоит — цена Чудесного Спасения удваивается, метка снимается при успехе", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    captured.dice = [5, 3]; // fateDie 1d10 → 5, corDie 1d10 → 3
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    // (5+10)=15 без метки, ×2 с меткой = 30 → 30-30=0
    expect(upd["system.fate.value"]).toBe(0);
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBeNull();
    expect(captured.chat.at(-1).content).toContain("×2 Поцелуй Смерти");
  });

  it("метка стоит — цена удвоена и на провале, метка тоже снимается", async () => {
    const actor = berserker({ fate: 10, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    captured.dice = [5]; // (5+10)×2 = 30 > 10 в пуле → провал
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBeNull();
    expect(captured.chat.at(-1).content).toContain("Провал");
  });

  it("метки нет — цена обычная, без удвоения", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    captured.dice = [5, 3];
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(15); // 30 - 15, без ×2
    expect(upd).not.toHaveProperty("flags.warhammer-dbc.-=killedByKissOfDeath");
    expect(captured.chat.at(-1).content).not.toContain("Поцелуй Смерти");
  });

  it("Вечный Воин free/flat — метка не удваивает фиксированную цену", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    await doDivineProtection(actor, { eternalWarrior: "flat" });

    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(29); // 30 - 1, не 30 - 2
  });
});

function astartesForSusAn({ wp = 40 } = {}) {
  const flags = {};
  const updates = [];
  const actor = {
    id: "a2", name: "Дредноут", type: "character",
    system: { characteristics: { wp: { total: wp } } },
    updates,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async update(data) { updates.push(data); }
  };
  return actor;
}

// Без сознания (стр. 30-31, wdbc-r5o7.7): Замедленная Анимация раньше сама
// выставляла И unconscious, И helpless — дублирование двух флагов вручную.
// Теперь Беспомощность — производное поле (rules/character.mjs, derived
// data), отдельно её здесь ставить не нужно и не должно.
// Sundering/Разделение (Дар Тзинча, wdbc-1rno): опция диалога Спасения
// только у носителя Дара (в отличие от Замедленной Анимации, доступной
// любому Астартес, — Разделения без Дара не существует вовсе, поэтому
// пункт не показывается ВСЕМ отключённой кнопкой, как та).
describe("Sundering/Разделение — видимость опции и списание Бесчестия (wdbc-1rno)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  function withSundering(bearer) {
    clearRuleSources();
    registerRuleSource("test", a => a === bearer
      ? [{ id: "test.sundering", when: {}, effects: [{ kind: "grantFlag", target: "gift.tzeentch.sundering" }] }]
      : []);
  }

  it("Дар есть — пункт «Разделение» присутствует в диалоге", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    await actor.setFlag("warhammer-dbc", "deceased", true);
    withSundering(actor);
    showDeathSaveDialog(actor);
    expect(captured.dialog.content).toContain("Разделение");
  });

  it("Дара нет — пункта в диалоге нет вовсе (не отключённая кнопка, а отсутствует)", async () => {
    clearRuleSources();
    const actor = berserker({ fate: 30, corruption: 10 });
    await actor.setFlag("warhammer-dbc", "deceased", true);
    showDeathSaveDialog(actor);
    expect(captured.dialog.content).not.toContain("Разделение");
  });

  it("doSundering: списывает 1 Очко Бесчестия и публикует карточку", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    // actorInfamyMax (Хаосит) читает Inf.b, не fate.max — berserker() его не
    // задаёт (не нужен остальным тестам файла, идущим через spendFromInfamyPool
    // с фиксированным путём) — без него потолок 0 и changeActorInfamy(-1)
    // клампит РЕЗУЛЬТАТ к 0 независимо от before, не только цену.
    actor.system.characteristics = { inf: { bonus: 99 } };
    await doSundering(actor);

    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(29);
    const card = captured.chat.at(-1);
    expect(card.content).toContain("Разделение");
    expect(card.content).toContain("тело исчезает");
  });
});

describe("doSusAnimation (Замедленная Анимация, wdbc-r5o7.7)", () => {
  it("успех — ставит unconscious, НЕ ставит helpless напрямую (она производная)", async () => {
    const actor = astartesForSusAn({ wp: 40 });
    captured.dice = [50]; // W 40 + 30 = 70 порог, 50 <= 70 → успех
    await doSusAnimation(actor);

    const upd = actor.updates[0];
    expect(upd["system.conditions.unconscious"]).toBe(true);
    expect(upd).not.toHaveProperty("system.conditions.helpless");
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("провал — ничего не ставит", async () => {
    const actor = astartesForSusAn({ wp: 10 });
    captured.dice = [90]; // W 10 + 30 = 40 порог, 90 > 40 → провал
    await doSusAnimation(actor);

    expect(actor.updates).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("Провал");
  });
});
