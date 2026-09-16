// test/apps/fruit-of-flesh.test.mjs
//
// Fruit of Flesh/Плод Плоти (wdbc-1rno) — Группа A: Плод Исцеления/Пламя/
// Яд-Радиация. Диспетчер по субмутации и честное предупреждение для
// субмутаций Групп B/C, которых здесь ещё нет.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { activateFruitOfFlesh, eatHealFruit } from "../../module/apps/fruit-of-flesh.mjs";

const SECONDS_PER_DAY = 86400;

function makeActor(name, { wounds = { value: 5, max: 20 }, conditions = {}, corBonus = 4, uuid = `Actor.${name}`,
                            crippledWounds = [], piercingWounds = {} } = {}) {
  const actor = {
    name, uuid,
    items: Object.assign([], { contents: [] }),
    system: { wounds: { ...wounds }, conditions: { ...conditions }, characteristics: { cor: { bonus: corBonus } },
              crippledWounds: [...crippledWounds], piercingWounds: { ...piercingWounds } },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    },
    createEmbeddedDocuments: async (docType, docs) => { actor.items.push(...docs); return docs; }
  };
  actor.items.contents = actor.items;
  return actor;
}

function makeItem(submutationLabel = "", uuid = "Item.fruit1", multi = []) {
  const flags = {};
  return {
    name: "Плод Плоти", uuid,
    system: { submutation: { label: submutationLabel, multi } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; }
  };
}

function tokenOf(actor, x, y) {
  return { id: actor.name, hidden: false, actor, x, y, width: 1, height: 1 };
}

function sceneOf(tokens) {
  const grid = { size: 100, distance: 1, type: 0 };
  const parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid };
  for (const t of tokens) t.parent = parent;
  return parent;
}

function weaponTemplate(name, weaponProps) {
  return { _id: name, name, system: { weaponProps: weaponProps.map(p => ({ ...p })) } };
}

function makePacksStub(templates) {
  const index = templates.map(t => ({ _id: t._id, name: t.name }));
  return {
    get: () => ({
      getIndex: async () => index,
      getDocument: async id => {
        const tpl = templates.find(t => t._id === id);
        return { toObject: () => structuredClone(tpl) };
      }
    })
  };
}

beforeEach(() => {
  resetCaptured();
  Object.assign(globalThis.game, { time: { worldTime: 1000 } });
});
afterEach(() => { delete globalThis.game.time; delete globalThis.game.packs; });

describe("activateFruitOfFlesh — диспетчер по субмутации", () => {
  it("субмутация ещё не брошена — предупреждает, ничего не меняет", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("");
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(captured.warnings.at(-1)).toContain("не брошена");
  });

  it("субмутация Группы C (напр. «8» Пси-атака с уроном) — честное предупреждение, не ошибка", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("8");
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(captured.warnings.at(-1)).toContain("пока не подключена");
  });
});

describe("ЭМИ (\"1\") — самоотчёт рейтинга, создаёт ЭМИ-гранату", () => {
  const HAYWIRE = weaponTemplate("Haywire Grenade / ЭМИ Граната", [{ key: "haywire", rating: 3 }]);

  it("отмена диалога — гранаты нет", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("1");
    Object.assign(globalThis.game, { packs: makePacksStub([HAYWIRE]) });
    const promise = activateFruitOfFlesh(actor, item, null);
    await captured.press("cancel", { querySelector: () => null });
    await promise;
    expect(actor.items.length).toBe(0);
  });

  it("самоотчёт рейтинга 5 — граната Haywire(5)", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("1");
    Object.assign(globalThis.game, { packs: makePacksStub([HAYWIRE]) });
    const promise = activateFruitOfFlesh(actor, item, null);
    await captured.press("ok", { querySelector: sel => sel === "#fof-num" ? { value: "5" } : null });
    await promise;
    const grenade = actor.items.find(i => i.name.includes("ЭМИ"));
    expect(grenade.system.weaponProps.find(p => p.key === "haywire").rating).toBe(5);
  });
});

describe("Дым (\"2-3\") — только в зоне Дыма, создаёт Дымовую гранату, убирает облако", () => {
  const SMOKE = weaponTemplate("Smoke / Дымовая", [{ key: "smoke", rating: 7 }]);

  function smokeBehavior(disabled = false) {
    return { type: "difficultTerrain", disabled, system: { smoke: true } };
  }

  it("не в Дыму — предупреждает, гранаты нет", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("2-3");
    const tokenDoc = { parent: {}, regions: new Set() };
    Object.assign(globalThis.game, { packs: makePacksStub([SMOKE]) });
    await activateFruitOfFlesh(actor, item, tokenDoc);
    expect(captured.warnings.at(-1)).toContain("не в зоне Дыма");
    expect(actor.items.length).toBe(0);
  });

  it("в Дыму — удаляет регион(ы), создаёт гранату с самоотчётным рейтингом", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("2-3");
    let deleted = 0;
    const region = { behaviors: [smokeBehavior()], delete: async () => { deleted++; } };
    const tokenDoc = { parent: {}, regions: new Set([region]) };
    Object.assign(globalThis.game, { packs: makePacksStub([SMOKE]) });
    const promise = activateFruitOfFlesh(actor, item, tokenDoc);
    await captured.press("ok", { querySelector: sel => sel === "#fof-num" ? { value: "4" } : null });
    await promise;
    expect(deleted).toBe(1);
    const grenade = actor.items.find(i => i.name.includes("Дымовая"));
    expect(grenade.system.weaponProps.find(p => p.key === "smoke").rating).toBe(4);
  });
});

describe("Плод Исцеления (\"0\") — активация и поедание", () => {
  it("активация без токена всё равно проходит (диалог/лечение не требуют геометрии)", async () => {
    const actor = makeActor("Носитель", { wounds: { value: 5, max: 20 } });
    const item = makeItem("0");
    captured.confirmAnswer = null; // DialogV2.wait ниже читает форму, не confirmAnswer
    const promise = activateFruitOfFlesh(actor, item, null);
    // Диалог самоотчёта — жмём «Втянуть» с числом 7.
    await captured.press("ok", { querySelector: sel => sel === "#fof-num" ? { value: "7" } : null });
    await promise;
    expect(actor.system.wounds.value).toBe(12); // 5 + 7
    expect(item.getFlag("warhammer-dbc", "fruitOfFleshCapacity")).toBe(7);
    expect(item.getFlag("warhammer-dbc", "fruitOfFleshMaturesAt")).toBe(1000 + 3 * SECONDS_PER_DAY);
  });

  it("съесть незрелый Плод — предупреждает остаток суток, не лечит", async () => {
    const actor = makeActor("Носитель", { wounds: { value: 3, max: 20 } });
    const item = makeItem("0");
    await item.setFlag("warhammer-dbc", "fruitOfFleshCapacity", 7);
    await item.setFlag("warhammer-dbc", "fruitOfFleshMaturesAt", 1000 + 2 * SECONDS_PER_DAY);
    await eatHealFruit(actor, item);
    expect(actor.system.wounds.value).toBe(3);
    expect(captured.warnings.at(-1)).toContain("не созрел");
  });

  it("съесть созревший Плод — лечит min(2d10, вместимость), снимает флаги", async () => {
    const actor = makeActor("Носитель", { wounds: { value: 3, max: 20 } });
    const item = makeItem("0");
    await item.setFlag("warhammer-dbc", "fruitOfFleshCapacity", 5);
    await item.setFlag("warhammer-dbc", "fruitOfFleshMaturesAt", 500); // уже в прошлом
    captured.dice = [8, 9]; // 2d10 = 17, но вместимость 5
    await eatHealFruit(actor, item);
    expect(actor.system.wounds.value).toBe(8); // 3 + min(17,5)
    expect(item.getFlag("warhammer-dbc", "fruitOfFleshCapacity")).toBeUndefined();
    expect(item.getFlag("warhammer-dbc", "fruitOfFleshMaturesAt")).toBeUndefined();
  });

  it("съесть — нет вырощенного Плода вовсе", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("0");
    await eatHealFruit(actor, item);
    expect(captured.warnings.at(-1)).toContain("не выращен");
  });

  it("съесть у не-heal субмутации — предупреждает", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("4-5");
    await eatHealFruit(actor, item);
    expect(captured.warnings.at(-1)).toContain("есть нечего");
  });
});

describe("Пламя (\"4-5\") — тушит Горение, создаёт Зажигательную гранату", () => {
  const INCENDIARY = weaponTemplate("Incendiary / Зажигательная",
    [{ key: "blast", rating: 2 }, { key: "flame" }, { key: "flush" }, { key: "linger" }]);

  it("не Горит — предупреждает, гранаты нет", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("4-5");
    Object.assign(globalThis.game, { packs: makePacksStub([INCENDIARY]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(captured.warnings.at(-1)).toContain("не Горит");
    expect(actor.items.length).toBe(0);
  });

  it("Горит один — тушит себя, Flame(rating) = собственная магнитуда", async () => {
    const actor = makeActor("Носитель", { conditions: { burning: true, burningSourceDamage: 6 } });
    const item = makeItem("4-5");
    Object.assign(globalThis.game, { packs: makePacksStub([INCENDIARY]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(actor.system.conditions.burning).toBe(false);
    expect(actor.system.conditions.burningSourceDamage).toBe(0);
    const grenade = actor.items.find(i => i.name.includes("Зажигательная"));
    expect(grenade).toBeTruthy();
    expect(grenade.system.weaponProps.find(p => p.key === "flame").rating).toBe(6);
  });

  it("Горят несколько в радиусе — тушит всех, Flame = максимум магнитуд", async () => {
    const near = makeActor("Рядом", { conditions: { burning: true, burningSourceDamage: 9 } });
    const caster = makeActor("Кастер", { conditions: { burning: true, burningSourceDamage: 3 } });
    const far = makeActor("Далеко", { conditions: { burning: true, burningSourceDamage: 20 } });
    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    const farToken = tokenOf(far, 1000, 1000);
    sceneOf([casterToken, nearToken, farToken]);
    const item = makeItem("4-5");
    Object.assign(globalThis.game, { packs: makePacksStub([INCENDIARY]) });
    await activateFruitOfFlesh(caster, item, casterToken);

    expect(caster.system.conditions.burning).toBe(false);
    expect(near.system.conditions.burning).toBe(false);
    expect(far.system.conditions.burning).toBe(true); // вне радиуса — не тронут
    const grenade = caster.items.find(i => i.name.includes("Зажигательная"));
    expect(grenade.system.weaponProps.find(p => p.key === "flame").rating).toBe(9); // максимум себя(3) и Рядом(9), Далеко не в радиусе
  });
});

describe("Яд и Радиация (\"7\") — снимает Отравление/Радиацию, создаёт гранату", () => {
  const RAD_GRENADE = weaponTemplate("Rad / Рад", [{ key: "blast", rating: 3 }, { key: "rad" }]);

  it("ни яда, ни радиации — предупреждает", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("7");
    Object.assign(globalThis.game, { packs: makePacksStub([RAD_GRENADE]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(captured.warnings.at(-1)).toContain("нечего втягивать");
  });

  it("только радиация — снимает дозу, Rad-рейтинг = десятки суммы, без Toxic", async () => {
    const actor = makeActor("Носитель", { conditions: { radiation: true, radiationLevel: 35 }, corBonus: 4 });
    const item = makeItem("7");
    Object.assign(globalThis.game, { packs: makePacksStub([RAD_GRENADE]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(actor.system.conditions.radiation).toBe(false);
    expect(actor.system.conditions.radiationLevel).toBe(0);
    const grenade = actor.items.find(i => i.name.includes("Рад"));
    expect(grenade.system.weaponProps.find(p => p.key === "rad").rating).toBe(3);
    expect(grenade.system.weaponProps.find(p => p.key === "blast").rating).toBe(2); // ceil(4/2)
    expect(grenade.system.weaponProps.find(p => p.key === "toxic")).toBeUndefined();
  });

  it("яд + радиация с двумя целями в радиусе — combined dose, Toxic добавлен", async () => {
    const near = makeActor("Рядом", { conditions: { poisoned: true, radiation: true, radiationLevel: 8 } });
    const caster = makeActor("Кастер", { conditions: { poisoned: true, radiation: true, radiationLevel: 7 }, corBonus: 6 });
    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    sceneOf([casterToken, nearToken]);
    const item = makeItem("7");
    Object.assign(globalThis.game, { packs: makePacksStub([RAD_GRENADE]) });
    await activateFruitOfFlesh(caster, item, casterToken);

    expect(caster.system.conditions.poisoned).toBe(false);
    expect(near.system.conditions.poisoned).toBe(false);
    expect(near.system.conditions.radiationLevel).toBe(0);
    const grenade = caster.items.find(i => i.name.includes("Рад"));
    expect(grenade.system.weaponProps.find(p => p.key === "rad").rating).toBe(1); // floor(15/10)
    expect(grenade.system.weaponProps.find(p => p.key === "toxic")).toBeTruthy();
  });
});

describe("Оглушение (\"6\") — Оглушён/Беспомощен/Стазис, три разные гранаты", () => {
  const STUN = weaponTemplate("Stun / Оглушающая", [{ key: "blast", rating: 3 }, { key: "concussive", rating: 2 }]);
  const WEB = weaponTemplate("Web / Паутинная", [{ key: "blast", rating: 3 }, { key: "snare", rating: 2 }]);
  const STASIS_BOMB = weaponTemplate("Stasis Bomb / Стазис Бомба", [{ key: "blast", rating: 2 }]);
  const ALL_TEMPLATES = [STUN, WEB, STASIS_BOMB];

  it("ничего из трёх — предупреждает", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("6");
    Object.assign(globalThis.game, { packs: makePacksStub(ALL_TEMPLATES) });
    await activateFruitOfFlesh(actor, item, null);
    expect(captured.warnings.at(-1)).toContain("нечего втягивать");
    expect(actor.items.length).toBe(0);
  });

  it("Оглушён — снимает stunned, даёт Оглушающую гранату", async () => {
    const actor = makeActor("Носитель", { conditions: { stunned: true } });
    const item = makeItem("6");
    Object.assign(globalThis.game, { packs: makePacksStub(ALL_TEMPLATES) });
    await activateFruitOfFlesh(actor, item, null);
    expect(actor.system.conditions.stunned).toBe(false);
    expect(actor.items.find(i => i.name.includes("Оглушающая"))).toBeTruthy();
  });

  it("Беспомощен — снимает helpless, даёт Паутинную гранату", async () => {
    const actor = makeActor("Носитель", { conditions: { helpless: true } });
    const item = makeItem("6");
    Object.assign(globalThis.game, { packs: makePacksStub(ALL_TEMPLATES) });
    await activateFruitOfFlesh(actor, item, null);
    expect(actor.system.conditions.helpless).toBe(false);
    expect(actor.items.find(i => i.name.includes("Паутинная"))).toBeTruthy();
  });

  it("в Стазисе — снимает stasis, даёт Стазис-Бомбу", async () => {
    const actor = makeActor("Носитель", { conditions: { stasis: true, stasisRounds: 3 } });
    const item = makeItem("6");
    Object.assign(globalThis.game, { packs: makePacksStub(ALL_TEMPLATES) });
    await activateFruitOfFlesh(actor, item, null);
    expect(actor.system.conditions.stasis).toBe(false);
    expect(actor.system.conditions.stasisRounds).toBe(0);
    expect(actor.items.find(i => i.name.includes("Стазис"))).toBeTruthy();
  });
});

describe("Заточение Силы (\"9\") — заточает поддерживаемую психосилу в плоде", () => {
  afterEach(() => { delete globalThis.game.actors; });

  it("нет ни одной психосилы, поддерживаемой на эту жертву — предупреждает", async () => {
    const victim = makeActor("Жертва");
    globalThis.game.actors = [];
    const item = makeItem("9");
    await activateFruitOfFlesh(victim, item, null);
    expect(captured.warnings.at(-1)).toContain("не найдено");
  });

  it("нашла поддерживаемую психосилу, нацеленную на жертву — ставит fruitOfFleshLockUuid", async () => {
    const victim = makeActor("Жертва");
    const powerFlags = {};
    const power = {
      type: "psychicPower", name: "Взгляд Рока",
      system: { isSustained: true, sustainedTargetUuid: victim.uuid },
      setFlag: async (_s, k, v) => { powerFlags[k] = v; }
    };
    const caster = makeActor("Псайкер");
    caster.items.push(power);
    globalThis.game.actors = [victim, caster];

    const item = makeItem("9", "Item.fruit1");
    await activateFruitOfFlesh(victim, item, null);

    expect(powerFlags.fruitOfFleshLockUuid).toBe("Item.fruit1");
  });

  it("психосила, нацеленная на кого-то другого, не заточается", async () => {
    const victim = makeActor("Жертва");
    const other = makeActor("Другой");
    const powerFlags = {};
    const power = {
      type: "psychicPower", name: "Взгляд Рока",
      system: { isSustained: true, sustainedTargetUuid: other.uuid },
      setFlag: async (_s, k, v) => { powerFlags[k] = v; }
    };
    const caster = makeActor("Псайкер");
    caster.items.push(power);
    globalThis.game.actors = [victim, other, caster];

    const item = makeItem("9");
    await activateFruitOfFlesh(victim, item, null);

    expect(powerFlags.fruitOfFleshLockUuid).toBeUndefined();
    expect(captured.warnings.at(-1)).toContain("не найдено");
  });
});

describe("Осколки (\"10\") — растворяет Калечащее/застрявшие снаряды, создаёт Фраг-гранату", () => {
  const FRAG = weaponTemplate("Frag / Фраг", [{ key: "blast", rating: 3 }, { key: "tearing" }]);

  it("ничего застрявшего — предупреждает", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("10");
    Object.assign(globalThis.game, { packs: makePacksStub([FRAG]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(captured.warnings.at(-1)).toContain("нечего растворять");
  });

  it("одна рана Калечащего у себя — снимает, рейтинг = её собственный", async () => {
    const actor = makeActor("Носитель", { crippledWounds: [{ location: "body", rating: 4 }] });
    const item = makeItem("10");
    Object.assign(globalThis.game, { packs: makePacksStub([FRAG]) });
    await activateFruitOfFlesh(actor, item, tokenOf(actor, 0, 0));
    expect(actor.system.crippledWounds).toEqual([]);
    const grenade = actor.items.find(i => i.name.includes("Фраг"));
    expect(grenade.system.weaponProps.find(p => p.key === "crippling").rating).toBe(4);
    expect(grenade.system.weaponProps.find(p => p.key === "tainted")).toBeTruthy();
  });

  it("Piercing считается как Crippling(3); несколько ран/целей в радиусе — максимум среди всех", async () => {
    const near = makeActor("Рядом", { crippledWounds: [{ location: "leftArm", rating: 6 }] });
    const caster = makeActor("Кастер", { piercingWounds: { body: 1 }, corBonus: 6 }); // виртуальный Crippling(3)
    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    sceneOf([casterToken, nearToken]);
    const item = makeItem("10");
    Object.assign(globalThis.game, { packs: makePacksStub([FRAG]) });
    await activateFruitOfFlesh(caster, item, casterToken);

    expect(caster.system.piercingWounds.body).toBe(0);
    expect(near.system.crippledWounds).toEqual([]);
    const grenade = caster.items.find(i => i.name.includes("Фраг"));
    expect(grenade.system.weaponProps.find(p => p.key === "crippling").rating).toBe(6); // максимум(3, 6)
  });
});

describe("Тройной Плод (\"11\") — выбор одного из до-трёх результатов", () => {
  const RAD_GRENADE = weaponTemplate("Rad / Рад", [{ key: "blast", rating: 3 }, { key: "rad" }]);
  const HAYWIRE = weaponTemplate("Haywire Grenade / ЭМИ Граната", [{ key: "haywire", rating: 3 }]);

  it("выбор одного из трёх — активирует именно его (Яд и Радиация, не ЭМИ)", async () => {
    const actor = makeActor("Носитель", { conditions: { radiation: true, radiationLevel: 20 } });
    const multi = [{ label: "1", name: "ЭМИ" }, { label: "7", name: "Яд и Радиация" }];
    const item = makeItem("11", "Item.fruit1", multi);
    Object.assign(globalThis.game, { packs: makePacksStub([RAD_GRENADE, HAYWIRE]) });

    const promise = activateFruitOfFlesh(actor, item, null);
    await captured.press("ok", { querySelector: sel => sel === "#fof-multi" ? { value: "7" } : null });
    await promise;

    expect(actor.system.conditions.radiation).toBe(false);
    expect(actor.items.find(i => i.name.includes("Рад"))).toBeTruthy();
    expect(actor.items.find(i => i.name.includes("ЭМИ"))).toBeFalsy();
  });

  it("отмена диалога выбора — ничего не активируется", async () => {
    const actor = makeActor("Носитель", { conditions: { radiation: true, radiationLevel: 20 } });
    const multi = [{ label: "1", name: "ЭМИ" }, { label: "7", name: "Яд и Радиация" }];
    const item = makeItem("11", "Item.fruit1", multi);
    Object.assign(globalThis.game, { packs: makePacksStub([RAD_GRENADE, HAYWIRE]) });

    const promise = activateFruitOfFlesh(actor, item, null);
    await captured.press("cancel", { querySelector: () => null });
    await promise;

    expect(actor.items.length).toBe(0);
    expect(actor.system.conditions.radiation).toBe(true);
  });

  it("без multi (обычная субмутация) — диалог выбора не открывается", async () => {
    const actor = makeActor("Носитель");
    const item = makeItem("0"); // multi по умолчанию []
    const promise = activateFruitOfFlesh(actor, item, null);
    await captured.press("cancel", { querySelector: () => null }); // диалог самоотчёта Плода Исцеления
    await promise;
    expect(captured.dialog.window.title).toContain("Плод Исцеления");
  });
});
