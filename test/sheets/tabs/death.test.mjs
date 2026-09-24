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
import { doMiraculousSave, doDivineProtection, doSusAnimation, doSundering, doResurrect, showDeathSaveDialog, doToyOfGodsTest }
  from "../../../module/sheets/tabs/death.mjs";
import { eternalWarriorFreeSaveAvailable } from "../../../module/combat/eternal-warrior.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../../module/rules/sources.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined (не
// нужна остальным тестам, см. test/apps/infamy-points-gods.test.mjs) —
// spendFromInfamyPool читает через неё текущий пул, поэтому здесь нужна
// настоящая реализация по пути через точку.
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

// inf — характеристика Inf (цена Спасения у хаосита, rules/death-save.mjs),
// fate — пул Очков Бесчестия (тратит только Вечный Воин «flat» и Разделение).
function berserker({ fate = 30, corruption = 10, inf = 30 } = {}) {
  const flags = {};
  const updates = [];
  return {
    id: "a1", name: "Берсерк", type: "character",
    system: {
      alignment: "heretic", inRage: true,
      fate: { value: fate }, corruption: { value: corruption },
      characteristics: { inf: { base: inf, total: inf, bonus: Math.floor(inf / 10) } },
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
  it("0 стоимость, Порча не растёт, отмечает разовый заряд сессии", async () => {
    const actor = berserker({ fate: 30, corruption: 10, inf: 30 });
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true);
    await doMiraculousSave(actor, { eternalWarrior: "free" });

    expect(captured.rolls).toEqual([]); // никаких костей — путь бесплатный
    const upd = actor.updates.at(-1);
    expect(upd).not.toHaveProperty("system.characteristics.inf.base"); // Inf не тронуто
    expect(upd).not.toHaveProperty("system.fate.value"); // и пул тоже
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
    const actor = berserker({ inf: 40, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    captured.dice = [5, 3]; // fateDie 1d10 → 5, corDie 1d10 → 3
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    // (5+10)=15 без метки, ×2 с меткой = 30 → Inf 40-30=10
    expect(upd["system.characteristics.inf.base"]).toBe(10);
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBeNull();
    expect(captured.chat.at(-1).content).toContain("×2 Поцелуй Смерти");
  });

  it("метка стоит — цена удвоена и на провале, метка тоже снимается", async () => {
    const actor = berserker({ inf: 10, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    captured.dice = [5]; // (5+10)×2 = 30 > 10 в пуле → провал
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBeNull();
    expect(captured.chat.at(-1).content).toContain("Провал");
  });

  it("метки нет — цена обычная, без удвоения", async () => {
    const actor = berserker({ inf: 30, corruption: 10 });
    captured.dice = [5, 3];
    await doMiraculousSave(actor);

    const upd = actor.updates.at(-1);
    expect(upd["system.characteristics.inf.base"]).toBe(15); // 30 - 15, без ×2
    expect(upd).not.toHaveProperty("flags.warhammer-dbc.-=killedByKissOfDeath");
    expect(captured.chat.at(-1).content).not.toContain("Поцелуй Смерти");
  });

  it("Вечный Воин free/flat — метка не удваивает фиксированную цену", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    await doDivineProtection(actor, { eternalWarrior: "flat" });

    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(29); // 30 - 1, не 30 - 2
    // wdbc-zye1: метка одноразовая и здесь — иначе удвоит СЛЕДУЮЩЕЕ,
    // уже не связанное с Поцелуем Спасение.
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBe(null);
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
    await actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    captured.dice = [50]; // W 40 + 30 = 70 порог, 50 <= 70 → успех
    await doSusAnimation(actor);

    const upd = actor.updates[0];
    expect(upd["system.conditions.unconscious"]).toBe(true);
    // wdbc-zye1: смерть разрешилась — метка Поцелуя Смерти не должна дожить до
    // следующей, уже не связанной с ним.
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBe(null);
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

describe("doResurrect снимает метку Поцелуя Смерти (wdbc-zye1)", () => {
  it("воскрешённый больше не платит вдвое при следующей смерти", async () => {
    const actor = berserker();
    await actor.setFlag("warhammer-dbc", "killedByKissOfDeath", true);
    await doResurrect(actor);
    const upd = actor.updates.at(-1);
    expect(upd["flags.warhammer-dbc.deceased"]).toBe(false);
    expect(upd["flags.warhammer-dbc.-=killedByKissOfDeath"]).toBe(null);
  });
});

// ── Сверка с книгой (wdbc-x1nz.2, 24.09.2026, глава «Смерть») ────────────────

/** Умирающий хаосит: Inf-характеристика, флаги читаются/пишутся как у актора. */
function dying({ inf = 40, corruption = 10, flags = {}, conditions = {}, items = [], subrace = "", wp = 40, patronGod = "" } = {}) {
  const f = Object.fromEntries(Object.entries(flags).map(([k, v]) => [`warhammer-dbc.${k}`, v]));
  f["warhammer-dbc.deceased"] = true;
  const updates = [];
  return {
    id: "d1", uuid: "Actor.d1", name: "Чемпион", type: "character",
    system: {
      alignment: "heretic", subrace, patronGod,
      fate: { value: 4 }, corruption: { value: corruption },
      characteristics: { inf: { base: inf, total: inf, bonus: Math.floor(inf / 10) }, wp: { total: wp }, t: { bonus: 5 } },
      wounds: { value: 0, critical: 12, max: 14 },
      conditions
    },
    items, updates,
    getFlag: (scope, key) => f[`${scope}.${key}`],
    async setFlag(scope, key, value) { f[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete f[`${scope}.${key}`]; },
    async update(data) { updates.push(data); }
  };
}
const MEMBRANE = { type: "implant", name: "Сус-ан Мембрана", getFlag: (s, k) => k === "installed" };
const HERO_SLEEP = { type: "talent", name: "Hero's Sleep / Сон Героя" };

describe("Чудесное Спасение — цена из Inf и откат смертельного удара", () => {
  it("Inf 40 − (10+4) → inf.base 26, Раны возвращены к снимку до удара", async () => {
    const actor = dying({ inf: 40, flags: { preHitWounds: { value: 7, critical: 0 } } });
    captured.dice = [4, 3];
    await doMiraculousSave(actor);
    const upd = actor.updates.at(-1);
    expect(upd["system.characteristics.inf.base"]).toBe(26);
    expect(upd).not.toHaveProperty("system.fate.value"); // пул Очков не тронут
    expect(upd["system.corruption.value"]).toBe(13);
    expect(upd["system.wounds.value"]).toBe(7);
    expect(upd["system.wounds.critical"]).toBe(0);
    expect(upd["flags.warhammer-dbc.deceased"]).toBe(false);
    expect(upd["flags.warhammer-dbc.-=preHitWounds"]).toBeNull();
  });

  it("Inf 12 − 14 → провал, персонаж мёртв", async () => {
    const actor = dying({ inf: 12 });
    captured.dice = [4];
    await doMiraculousSave(actor);
    expect(captured.chat.at(-1).content).toContain("Провал");
    expect(actor.updates.at(-1)).not.toHaveProperty("flags.warhammer-dbc.deceased");
  });

  it("смерть от Кровотечения — рана закрыта и кровь восполнена, Раны без отката", async () => {
    const actor = dying({ flags: { deathCause: "bleeding", preHitWounds: { value: 9, critical: 0 } },
      conditions: { bleeding: true, haemorrhaging: true, haemorrhagingLevel: 3 } });
    captured.dice = [4, 3];
    await doMiraculousSave(actor);
    const upd = actor.updates.at(-1);
    expect(upd["system.conditions.bleeding"]).toBe(false);
    expect(upd["system.conditions.haemorrhaging"]).toBe(false);
    expect(upd["system.wounds.value"]).not.toBe(9); // не откат к старому снимку
    expect(upd["flags.warhammer-dbc.-=deathCause"]).toBeNull();
  });
});

describe("Божественная Защита — неуязвимость до конца сессии", () => {
  it("ставит флаг, Без сознания и снимает смертельные Состояния", async () => {
    const actor = dying({ inf: 40, conditions: { burning: true, bleeding: true } });
    captured.dice = [2, 1];
    await doDivineProtection(actor);
    const upd = actor.updates.at(-1);
    expect(upd["system.characteristics.inf.base"]).toBe(33); // 40 − (5+2)
    expect(upd["flags.warhammer-dbc.divineProtection"]).toBe(true);
    expect(upd["system.conditions.unconscious"]).toBe(true);
    expect(upd["system.conditions.burning"]).toBe(false);
    expect(upd["system.conditions.bleeding"]).toBe(false);
    expect(captured.chat.at(-1).content).toContain("wh-divine-protection-lift");
  });

  it("Inf после потери 50+ — строка о переносе на базу, ниже — нет", async () => {
    const rich = dying({ inf: 60 });
    captured.dice = [1, 1];
    await doDivineProtection(rich);
    expect(captured.chat.at(-1).content).toContain("безопасная база");

    resetCaptured();
    const poor = dying({ inf: 40 });
    captured.dice = [1, 1];
    await doDivineProtection(poor);
    expect(captured.chat.at(-1).content).not.toContain("безопасная база");
  });
});

describe("Астартес: отмена Спасения ради Замедленной Анимации (стр. 233)", () => {
  it("провал по Inf — отмена ничего не списывает, идёт тест W+30", async () => {
    const actor = dying({ inf: 12, items: [MEMBRANE], wp: 40 });
    captured.confirmAnswer = true;
    captured.dice = [4, 50]; // потеря 14 ≥ 12 → провал; W+30=70, 50 → успех
    await doMiraculousSave(actor);
    expect(actor.updates.some(u => "system.characteristics.inf.base" in u)).toBe(false);
    expect(actor.updates.at(-1)["system.conditions.unconscious"]).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Замедленную Анимацию");
  });

  it("Cor дошла бы до 100 — тоже можно отменить", async () => {
    const actor = dying({ inf: 40, corruption: 95, items: [MEMBRANE] });
    captured.confirmAnswer = true;
    captured.dice = [2, 9, 30]; // потеря 12, Порча +9 → 104; затем W-тест 30
    await doMiraculousSave(actor);
    expect(actor.updates.some(u => "system.characteristics.inf.base" in u)).toBe(false);
  });

  it("отказ от отмены — Спасение проходит как обычно", async () => {
    const actor = dying({ inf: 40, corruption: 95, items: [MEMBRANE] });
    captured.confirmAnswer = false;
    captured.dice = [2, 9];
    await doMiraculousSave(actor);
    expect(actor.updates.at(-1)["system.corruption.value"]).toBe(100);
  });
});

describe("Наследник — кубы Спасения дважды, берётся меньший", () => {
  it("потеря 10+min(8,3), Порча min(6,2)", async () => {
    const actor = dying({ inf: 40, subrace: "inheritor" });
    captured.dice = [8, 3, 6, 2];
    await doMiraculousSave(actor);
    const upd = actor.updates.at(-1);
    expect(upd["system.characteristics.inf.base"]).toBe(27); // 40 − 13
    expect(upd["system.corruption.value"]).toBe(12);
  });
});

describe("Замедленная Анимация — одна попытка, Сон Героя перебрасывает", () => {
  it("провал ставит метку попытки", async () => {
    const actor = dying({ items: [MEMBRANE], wp: 10 });
    captured.dice = [90];
    await doSusAnimation(actor);
    expect(actor.getFlag("warhammer-dbc", "susAnAttempted")).toBe(true);
  });

  it("Сон Героя: провал 90 → переброс 20 → успех", async () => {
    const actor = dying({ items: [MEMBRANE, HERO_SLEEP], wp: 40 });
    captured.dice = [90, 20];
    await doSusAnimation(actor);
    expect(actor.updates.at(-1)["system.conditions.unconscious"]).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Сон Героя");
  });
});

describe("Игрушка Богов — диалог и тест Inf+30", () => {
  it("Покровитель Кхорн, первая смерть сессии — диалог называет обязанность и тест", () => {
    const actor = dying({ patronGod: "khorne", corruption: 20 });
    showDeathSaveDialog(actor);
    expect(captured.dialog.content).toContain("Игрушка Богов");
    expect(captured.dialog.content).toContain("data-action=\"toy\"");
  });

  it("Неделимый — правило не действует", () => {
    const actor = dying({ patronGod: "undivided" });
    showDeathSaveDialog(actor);
    expect(captured.dialog.content).not.toContain("Игрушка Богов");
  });

  it("успех теста снимает обязанность до конца сессии", async () => {
    const actor = dying({ patronGod: "khorne", inf: 40 });
    captured.dice = [60]; // 40+30=70
    expect(await doToyOfGodsTest(actor)).toBe(true);
    showDeathSaveDialog(actor);
    expect(captured.dialog.content).not.toContain("Игрушка Богов");
  });
});
