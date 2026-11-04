
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import {
  syncMechanicumImplants, warpforgedRegenClock, useIronCage, ironCageClock, releaseCagesOnMove, forgeSigil, useCellOfShame,
  releaseCellDemon, useEmpyreanWhip, clearWhipOnCombatEnd, useForgeOfOne, useRunDown, runDownTurnStart, performWarpsmithWrite,
  confirmDominionOver, findBrokenDominionDemon, warpsmithStatus, whipCandidates
} from "../../module/combat/warpsmith.mjs";
import { checkTargetWrite, performTargetWrite } from "../../module/combat/gm-relay.mjs";
import { castRitual } from "../../module/apps/ritual-cast.mjs";
import { ammoIsFree } from "../../module/rules/ammo-free.mjs";
import { CONDITION_CLOCK_HANDLERS } from "../../module/combat/condition-clock.mjs";
import { BROKEN_FLAG, SIGIL_FLAG, CELL_FLAG, WHIP_FLAG, RUN_DOWN_FLAG, REGEN_CARRY_FLAG } from "../../module/rules/warpsmith.mjs";
import { MECHANICUS_IMPLANTS } from "../../module/constants/implants.mjs";
import { warpforgedBurningAp } from "../../module/combat/condition-ticks.mjs";
import { isImmuneToCondition } from "../../module/rules/condition-guards.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const NS = "warhammer-dbc";
const TRAITS = "packs-src/traits/Элитные_архетипы/Варп_Кузнец";
const TALENTS = "packs-src/talents/Элитные_архетипы/Варп_Кузнец";
const CAGE = packDocById(TRAITS, "mqxtrmWBRyXWJVbK");
const PLATE = packDocById(TRAITS, "gjtQQj1JT1qmI7r0");
const IMPLANTS_TRAIT = packDocById(TRAITS, "mIHNU8mi5oBaNDpR");
const SIGIL = packDocById(TALENTS, "HomKz0NcpyFEF5VS");
const CELL = packDocById(TALENTS, "ChFKmUcfnSd12E8t");
const WHIP = packDocById(TALENTS, "uQd6TF9OQmWbwU9x");
const FORGE = packDocById(TALENTS, "R474RGCtmYO0eZQh");
const RUN = packDocById(TALENTS, "1O3S4uusfAoIFnNq");

let seq = 0;
const itemOf = (doc, extra = {}, flagsExtra = {}) => {
  const flags = JSON.parse(JSON.stringify(doc.flags ?? {}));
  flags[NS] = { ...(flags[NS] ?? {}), ...flagsExtra };
  const self = { id: `i${++seq}`, uuid: `Item.i${seq}`, type: doc.type, name: doc.name, img: doc.img,
    system: { ...doc.system, equipped: true, ...extra }, flags,
    getFlag: (s, k) => flags[s]?.[k],
    setFlag: async (s, k, v) => { (flags[s] ??= {})[k] = v; return self; },
    unsetFlag: async (s, k) => { delete flags[s]?.[k]; return self; } };
  return self;
};

function hero({ items = [], uuid = "Actor.smith", name = "Кузнец", type = "character", infamy = 3, wounds = 20, woundsMax = 20, flags = {},
  owner = true, techUse = 60, command = 35, lore = 55, int = 50, wp = 40, tb = 5 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.characteristics.int.base = int;
  system.characteristics.wp.base = wp;
  system.characteristics.inf.base = 50;
  system.wounds.max = woundsMax;
  system.wounds.value = wounds;
  system.fate.value = infamy;
  system.fate.max = 5;
  system.alignment = "heretic";
  system.actionPoints = { ...(system.actionPoints ?? {}), value: 2, max: 2 };
  system.groupSkills = { forbiddenLore: [{ specialty: "Daemons", rank: "known", total: lore }] };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const store = { ...flags };
  const effects = Object.assign([], { contents: [] });
  const self = {
    id: uuid.split(".").at(-1), uuid, name, type, system, items: list, isOwner: owner, effects, isToken: false, created: [], deleted: [],
    getFlag: (scope, key) => (scope === NS ? store[key] : undefined),
    setFlag: async (scope, key, value) => { store[key] = value; return self; },
    unsetFlag: async (scope, key) => { delete store[key]; return self; },
    getActiveTokens: () => [],
    update: async patch => {
      captured.updates.push(patch);
      for (const [p, value] of Object.entries(patch)) {
        if (p.startsWith("system.")) {
          const keys = p.slice("system.".length).split(".");
          let node = self.system;
          for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
          node[keys.at(-1)] = value;
        } else if (p.startsWith(`flags.${NS}.-=`)) delete store[p.slice(`flags.${NS}.-=`.length)];
        else if (p.startsWith(`flags.${NS}.`)) store[p.slice(`flags.${NS}.`.length)] = value;
      }
      return self;
    },
    createEmbeddedDocuments: async (kind, docs) => {
      self.created.push(...docs.map(d => ({ kind, ...d })));
      const made = docs.map(d => kind === "ActiveEffect"
        ? { id: `e${++seq}`, ...d, getFlag: (s, k) => d.flags?.[s]?.[k] }
        : itemOf(d, {}, d.flags?.[NS] ?? {}));
      (kind === "ActiveEffect" ? effects : list).push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (kind, ids) => {
      self.deleted.push(...ids);
      const arr = kind === "ActiveEffect" ? effects : list;
      for (const id of ids) { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); }
      return [];
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(self);
  self.system.groupSkills.forbiddenLore[0].total = lore;
  self.system.skills.techUse.total = techUse;
  self.system.skills.command.total = command;
  self.system.characteristics.wp.bonus = Math.floor(wp / 10);
  self.system.characteristics.t.bonus = tb;
  self.store = store;
  return self;
}

const cards = () => captured.chat.map(c => String(c.content));
const lastCard = () => cards().at(-1) ?? "";
const prompt = answer => { foundry.applications.api.DialogV2.prompt = async () => answer; };
const target = actors => { globalThis.game.user.targets = new Set(actors.map(a => ({ actor: a }))); };
const inCombat = (actor = null, id = "c1", round = 1) => {
  globalThis.game.combat = { id, round, started: true, combatant: actor ? { actor } : null, combatants: actor ? [{ actor }] : [] };
  globalThis.game.combats = [globalThis.game.combat];
};
const fate = a => a.system.fate.value;

const brokenFlag = (over = {}) => ({ smithUuid: "Actor.smith", smithUuids: ["Actor.smith"], smithName: "Кузнец", state: "broken", since: 0, until: 0, freeWill: false, ...over });
const demonOf = (flag = null, over = {}) => hero({ uuid: "Actor.demon", name: "Bloodletter / Кровопуск", type: "daemon", infamy: 0, wp: 60, flags: flag ? { [BROKEN_FLAG]: flag } : {}, ...over });

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  globalThis.game.time = { worldTime: 1000 };
  globalThis.game.user = { isGM: true, targets: new Set(), id: "u1" };
  globalThis.game.actors = [];
  globalThis.game.combat = undefined;
  globalThis.game.combats = [];
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.game.combats;
  globalThis.game.actors = [];
  delete globalThis.canvas.scene;
  delete foundry.applications.api.DialogV2.prompt;
  delete globalThis.game.packs;
});

describe("Импланты Механикум", () => {
  it("Черта выдаёт семь имплантов комплекта, уже установленными", async () => {
    const a = hero({ items: [itemOf(IMPLANTS_TRAIT)] });
    expect(await syncMechanicumImplants(a)).toBe(MECHANICUS_IMPLANTS.length);
    const made = a.created.filter(d => d.kind === "Item");
    expect(made).toHaveLength(7);
    expect(made.map(d => d.name).sort()).toEqual(MECHANICUS_IMPLANTS.map(i => i.name).sort());
    for (const d of made) expect(d.flags[NS].installed).toBe(true);
  });

  it("повторно ничего не выдаёт, у кого уже стоят импланты Механикум", async () => {
    const a = hero({ items: [itemOf(IMPLANTS_TRAIT)] });
    await syncMechanicumImplants(a);
    a.created.length = 0;
    expect(await syncMechanicumImplants(a)).toBe(0);
    expect(a.created).toHaveLength(0);
  });

  it("если импланты уже выданы (Еретех, Технодесантник) — не задваивает", async () => {
    const existing = MECHANICUS_IMPLANTS.map(i => itemOf({ type: "implant", name: i.name, img: "", system: { category: "mechanicus" }, flags: {} }));
    const a = hero({ items: [itemOf(IMPLANTS_TRAIT), ...existing] });
    expect(await syncMechanicumImplants(a)).toBe(0);
  });

  it("без Черты и не у персонажа — ничего", async () => {
    expect(await syncMechanicumImplants(hero())).toBe(0);
    expect(await syncMechanicumImplants(hero({ items: [itemOf(IMPLANTS_TRAIT)], type: "daemon" }))).toBe(0);
  });
});

describe("Закалённые Варпом Латы: регенерация", () => {
  it("раз в 20−T.b минут возвращает Рану, остаток копится", async () => {
    const a = hero({ items: [itemOf(PLATE)], wounds: 10 });
    await warpforgedRegenClock(a, { from: 0, to: 14 * 60 });
    expect(a.system.wounds.value).toBe(10);
    expect(a.getFlag(NS, REGEN_CARRY_FLAG)).toBe(14 * 60);
    await warpforgedRegenClock(a, { from: 14 * 60, to: 14 * 60 + 60 });
    expect(a.system.wounds.value).toBe(11);
    expect(a.getFlag(NS, REGEN_CARRY_FLAG)).toBeUndefined();
    expect(lastCard()).toContain("+1 Ран");
  });

  it("за долгий отрезок — несколько Ран, не больше недостающего", async () => {
    const a = hero({ items: [itemOf(PLATE)], wounds: 17 });
    await warpforgedRegenClock(a, { from: 0, to: 600 * 60 });
    expect(a.system.wounds.value).toBe(20);
  });

  it("здоровый и без Лат — ничего не лечится и не пишется", async () => {
    const healthy = hero({ items: [itemOf(PLATE)] });
    await warpforgedRegenClock(healthy, { from: 0, to: 9999 });
    expect(captured.chat).toHaveLength(0);
    const plain = hero({ wounds: 5 });
    await warpforgedRegenClock(plain, { from: 0, to: 99999 });
    expect(plain.system.wounds.value).toBe(5);
  });

  it("часы Календаря подключены в список обработчиков", () => {
    expect(CONDITION_CLOCK_HANDLERS.map(h => h.id)).toEqual(expect.arrayContaining(["ironCage", "warpforgedRegen"]));
  });
});

describe("Закалённые Варпом Латы: иммунитеты и броня против варп-оружия", () => {
  it("Конструктор Черты даёт иммунитет к ядам, Кровотечению и бесполезным конечностям, но не к Обескровливанию", () => {
    const a = hero({ items: [itemOf(PLATE)] });
    for (const key of ["poisoned", "bleeding", "uselessArm", "uselessLeg"]) expect(isImmuneToCondition(a, key, () => true), key).toBe(true);
    expect(isImmuneToCondition(a, "haemorrhaging", () => true)).toBe(false);
    expect(isImmuneToCondition(hero(), "bleeding", () => true)).toBe(false);
  });

  it("возможности: яды, болезни, AP брони целиком против варп-оружия, регенерация", () => {
    const a = hero({ items: [itemOf(PLATE)] });
    for (const flag of ["poison.immune", "immunity.disease", "armor.apVsWarpFull", "warpforged.regeneration", "ability.warpforgedPlate"]) {
      expect(hasRuleFlag(a, flag), flag).toBe(true);
    }
    expect(hasRuleFlag(hero(), "armor.apVsWarpFull")).toBe(false);
  });
});

describe("Закалённые Варпом Латы: Горение", () => {
  it("AP торса (без T.b) вычитается из тика Горения; без Лат — 0", () => {
    const a = hero({ items: [itemOf(PLATE)] });
    a.system.absorption = { body: 17, toughnessBonus: 5 };
    expect(warpforgedBurningAp(a)).toBe(12);
    const plain = hero();
    plain.system.absorption = { body: 17, toughnessBonus: 5 };
    expect(warpforgedBurningAp(plain)).toBe(0);
    a.system.absorption = { body: 3, toughnessBonus: 5 };
    expect(warpforgedBurningAp(a)).toBe(0);
  });
});

describe("Железная Клеть", () => {
  it("победа в Tech-Use−10 против W+0 ставит метку клети на срок W.b часов", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const demon = demonOf();
    target([demon]);
    captured.dice = [10, 90];
    expect(await useIronCage(smith, demon)).toBe(true);
    const flag = demon.getFlag(NS, BROKEN_FLAG);
    expect(flag).toMatchObject({ smithUuid: "Actor.smith", state: "caged", since: 1000, freeWill: false });
    expect(flag.until).toBe(1000 + 6 * 3600);
    expect(lastCard()).toContain("заарканен");
  });

  it("поражение — метки нет", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const demon = demonOf();
    captured.dice = [95, 5];
    expect(await useIronCage(smith, demon)).toBe(false);
    expect(demon.getFlag(NS, BROKEN_FLAG)).toBeUndefined();
    expect(lastCard()).toContain("вырвался");
  });

  it("в бою тратит полное действие; отказ подтвердить Истинную Форму — ничего", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    inCombat(smith);
    const demon = demonOf();
    captured.confirmAnswer = false;
    expect(await useIronCage(smith, demon)).toBe(false);
    expect(smith.system.actionPoints.value).toBe(2);
    captured.confirmAnswer = true;
    captured.dice = [10, 90];
    expect(await useIronCage(smith, demon)).toBe(true);
    expect(smith.system.actionPoints.value).toBe(0);
  });

  it("без таргета, без Черты, на себя — ничего", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    expect(await useIronCage(smith, null)).toBe(false);
    expect(await useIronCage(smith, smith)).toBe(false);
    expect(await useIronCage(hero(), demonOf())).toBe(false);
  });

  it("уже заарканенного им демона не арканит заново", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const demon = demonOf(brokenFlag({ state: "caged" }));
    expect(await useIronCage(smith, demon)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("дальше I.b метров не достаёт", async () => {
    const smith = hero({ items: [itemOf(CAGE)], int: 50 });
    smith.system.characteristics.int.bonus = 5;
    const demon = demonOf();
    const mk = (actor, x) => ({ id: actor.id, x, y: 0, width: 1, height: 1, elevation: 0, hidden: false, actor, parent: null });
    const tokens = [mk(smith, 0), mk(demon, 1000)];
    tokens.contents = tokens;
    const scene = { tokens, grid: { size: 100, distance: 1 } };
    tokens.forEach(t => { t.parent = scene; });
    globalThis.canvas.scene = scene;
    expect(await useIronCage(smith, demon)).toBe(false);
    expect(captured.warnings.join(" ")).toContain("достаёт на I.b = 5 м");
  });

  it("часы Календаря: срок пытки вышел — Сломлен; рано — нет", async () => {
    const demon = demonOf(brokenFlag({ state: "caged", until: 5000 }));
    await ironCageClock(demon, { from: 0, to: 4999 });
    expect(demon.getFlag(NS, BROKEN_FLAG).state).toBe("caged");
    await ironCageClock(demon, { from: 4999, to: 5000 });
    expect(demon.getFlag(NS, BROKEN_FLAG).state).toBe("broken");
    expect(lastCard()).toContain("Сломлен");
  });

  it("Кузнец сдвинулся — заарканенный демон высвобождается, Сломленный остаётся", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const caged = demonOf(brokenFlag({ state: "caged" }));
    const broken = hero({ uuid: "Actor.broken", name: "Сломленный", type: "daemon", infamy: 0, flags: { [BROKEN_FLAG]: brokenFlag() } });
    const tokens = [{ actor: smith }, { actor: caged }, { actor: broken }];
    const released = await releaseCagesOnMove({ actor: smith, parent: { tokens } });
    expect(released).toBe(1);
    expect(caged.getFlag(NS, BROKEN_FLAG)).toBeUndefined();
    expect(broken.getFlag(NS, BROKEN_FLAG).state).toBe("broken");
    expect(lastCard()).toContain("сдвинулся с места");
  });
});

describe("Сломленный демон: Владычество и встречные тесты", () => {
  const ritualOf = over => ({
    name: "", type: "dominion", skillValue: "", testChar: "int", gmMod: -20, assistants: 0, assistBonus: 10, summon: {}, curseFam: "close",
    curseSymp: {}, numerology: {}, numMod: 0, psyker: false, psykerBonus: 0, aversionPerFail: 5, ...over
  });

  it("Владычество над Сломленным демоном Кузнеца — без броска; свобода воли снимается", async () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const demon = demonOf(brokenFlag({ freeWill: true }));
    globalThis.game.actors = [demon];
    const res = await castRitual(ritualOf({ demonName: "Кровопуск" }), smith);
    expect(res).toEqual({ success: true, deg: 1, threshold: null, roll: null });
    expect(captured.rolls).toEqual([]);
    expect(lastCard()).toContain("Сломленный демон");
    expect(demon.getFlag(NS, BROKEN_FLAG).freeWill).toBe(false);
  });

  it("чужой Кузнец не получает автопобеды — обычный бросок", async () => {
    const stranger = hero({ uuid: "Actor.stranger", name: "Чужак" });
    globalThis.game.actors = [demonOf(brokenFlag())];
    captured.dice = [1];
    const res = await castRitual(ritualOf({ demonName: "Кровопуск", gmMod: 50 }), stranger);
    expect(res.roll).toBe(1);
    expect(captured.rolls.length).toBe(1);
  });

  it("держатель Печати Владычества проходит Владычество без броска", async () => {
    const holder = hero({ uuid: "Actor.holder", name: "Держатель",
      items: [itemOf({ type: "gear", name: "Печать", img: "", system: {}, flags: { [NS]: { [SIGIL_FLAG]: { demonUuid: "Actor.demon" } } } })] });
    globalThis.game.actors = [demonOf(brokenFlag())];
    const res = await castRitual(ritualOf({ demonName: "Кровопуск" }), holder);
    expect(res.success).toBe(true);
    expect(captured.rolls).toEqual([]);
  });

  it("поиск цели: Кузнец находит своего Сломленного по имени, только в Сломлен-статусе", () => {
    const smith = hero();
    globalThis.game.actors = [demonOf(brokenFlag({ state: "caged" }))];
    expect(findBrokenDominionDemon(smith, "Кровопуск")).toBeNull();
    globalThis.game.actors = [demonOf(brokenFlag())];
    expect(findBrokenDominionDemon(smith, "Кровопуск")?.uuid).toBe("Actor.demon");
  });

  it("подтверждение Владычества снимает только свободу воли", async () => {
    const free = demonOf(brokenFlag({ freeWill: true }));
    expect(await confirmDominionOver(free)).toBe(true);
    expect(free.getFlag(NS, BROKEN_FLAG)).toMatchObject({ state: "broken", freeWill: false });
    expect(await confirmDominionOver(free)).toBe(false);
  });
});

describe("Печать Владычества", () => {
  it("Очко Бесчестия и печать в снаряжении для Сломленного демона", async () => {
    const smith = hero({ items: [itemOf(SIGIL)], infamy: 2 });
    const demon = demonOf(brokenFlag());
    expect(await forgeSigil(smith, demon)).toBeTruthy();
    expect(fate(smith)).toBe(1);
    const made = smith.created.find(d => d.type === "gear");
    expect(made.name).toContain("Кровопуск");
    expect(made.flags[NS][SIGIL_FLAG]).toMatchObject({ demonUuid: "Actor.demon", smithUuid: "Actor.smith" });
    expect(lastCard()).toContain("Печать выкована");
  });

  it("не Сломленный демон, нет Очка, нет Таланта — печати нет", async () => {
    const smith = hero({ items: [itemOf(SIGIL)], infamy: 2 });
    expect(await forgeSigil(smith, demonOf())).toBe(false);
    expect(await forgeSigil(smith, demonOf(brokenFlag({ state: "caged" })))).toBe(false);
    expect(fate(smith)).toBe(2);
    const empty = hero({ items: [itemOf(SIGIL)], infamy: 0 });
    expect(await forgeSigil(empty, demonOf(brokenFlag()))).toBe(false);
    expect(await forgeSigil(hero(), demonOf(brokenFlag()))).toBe(false);
  });
});

describe("Ячейка Позора", () => {
  it("успех: демон навсегда теряет 10 W и 15 Inf, устройство помечено и не тратит боезапас", async () => {
    const device = itemOf({ type: "weapon", name: "Плазменный реактор", img: "", system: {}, flags: {} });
    const smith = hero({ items: [itemOf(CELL), device] });
    const demon = demonOf(brokenFlag(), { wp: 60 });
    demon.system.characteristics.inf.total = 40;
    demon.system.characteristics.wp.total = 60;
    prompt(device.id);
    captured.nextRoll = 10;
    expect(await useCellOfShame(smith, demon)).toBe(true);
    const portions = demon.system.charLossPortions;
    expect(portions.find(p => p.key === "wp")).toMatchObject({ amount: 10, hours: 0 });
    expect(portions.find(p => p.key === "inf")).toMatchObject({ amount: 15, hours: 0 });
    expect(demon.getFlag(NS, BROKEN_FLAG).cell).toMatchObject({ deviceName: "Плазменный реактор" });
    expect(device.getFlag(NS, CELL_FLAG)).toMatchObject({ demonUuid: "Actor.demon", demonName: demon.name });
    expect(ammoIsFree(device, smith)).toBe(true);
    expect(lastCard()).toContain("заключён в ячейку");
  });

  it("провал теста — демон цел, устройство не помечено", async () => {
    const device = itemOf({ type: "gear", name: "Батарея", img: "", system: {}, flags: {} });
    const smith = hero({ items: [itemOf(CELL), device] });
    const demon = demonOf(brokenFlag());
    prompt(device.id);
    captured.nextRoll = 99;
    expect(await useCellOfShame(smith, demon)).toBe(false);
    expect(demon.system.charLossPortions ?? []).toHaveLength(0);
    expect(device.getFlag(NS, CELL_FLAG)).toBeUndefined();
  });

  it("не Сломленный демон, уже в ячейке, нет Навыка, отмена диалога — ничего", async () => {
    const smith = hero({ items: [itemOf(CELL)] });
    expect(await useCellOfShame(smith, demonOf())).toBe(false);
    expect(await useCellOfShame(smith, demonOf(brokenFlag({ cell: { deviceName: "x" } })))).toBe(false);
    const noLore = hero({ items: [itemOf(CELL)] });
    noLore.system.groupSkills = { forbiddenLore: [] };
    expect(await useCellOfShame(noLore, demonOf(brokenFlag()))).toBe(false);
    prompt(null);
    expect(await useCellOfShame(smith, demonOf(brokenFlag()))).toBe(false);
  });

  it("устройство уничтожено: демон на свободе, Сломлен со свободой воли", async () => {
    const smith = hero({ items: [itemOf(CELL)] });
    const demon = demonOf(brokenFlag({ cell: { deviceName: "Реактор", at: 1 } }));
    globalThis.fromUuid = async uuid => (uuid === "Actor.demon" ? demon : null);
    const device = itemOf({ type: "gear", name: "Реактор", img: "", system: {}, flags: {} }, {}, { [CELL_FLAG]: { demonUuid: "Actor.demon", smithUuid: "Actor.smith", deviceName: "Реактор" } });
    device.actor = smith;
    expect(await releaseCellDemon(device)).toBe(true);
    expect(demon.getFlag(NS, BROKEN_FLAG)).toMatchObject({ state: "broken", freeWill: true, cell: null });
    expect(lastCard()).toContain("вырывается на свободу");
    expect(await releaseCellDemon(itemOf({ type: "gear", name: "x", img: "", system: {}, flags: {} }))).toBe(false);
  });
});

describe("Эмпирейная Плеть", () => {
  function sceneWith(smith, machines, { far = [] } = {}) {
    const mk = (actor, x) => ({ id: actor.id, x, y: 0, width: 1, height: 1, elevation: 0, hidden: false, actor, parent: null });
    const tokens = [mk(smith, 0), ...machines.map((m, i) => mk(m, 200 + i * 100)), ...far.map((m, i) => mk(m, 5000 + i * 100))];
    tokens.contents = tokens;
    const scene = { tokens, grid: { size: 100, distance: 1 } };
    tokens.forEach(t => { t.parent = scene; });
    globalThis.canvas.scene = scene;
    return scene;
  }

  it("кандидаты — Сломленные этим Кузнецом машины в радиусе I.b м", () => {
    const smith = hero({ items: [itemOf(WHIP)] });
    smith.system.characteristics.int.bonus = 5;
    const near = demonOf(brokenFlag());
    const far = hero({ uuid: "Actor.far", name: "Далёкая", type: "daemon", infamy: 0, flags: { [BROKEN_FLAG]: brokenFlag() } });
    const free = hero({ uuid: "Actor.free", name: "Свободная", type: "daemon", infamy: 0 });
    sceneWith(smith, [near, free], { far: [far] });
    expect(whipCandidates(smith).map(a => a.uuid)).toEqual(["Actor.demon"]);
  });

  it("успех: машины становятся Миньонами, конец боя возвращает прежнего хозяина", async () => {
    const smith = hero({ items: [itemOf(WHIP)] });
    smith.system.characteristics.int.bonus = 5;
    const machine = demonOf(brokenFlag());
    machine.system.masterUuid = "Actor.old";
    sceneWith(smith, [machine]);
    inCombat(smith);
    captured.nextRoll = 5;
    expect(await useEmpyreanWhip(smith)).toBe(true);
    expect(smith.system.actionPoints.value).toBe(0);
    expect(machine.system.masterUuid).toBe("Actor.smith");
    expect(machine.getFlag(NS, WHIP_FLAG)).toMatchObject({ smithUuid: "Actor.smith", prevMasterUuid: "Actor.old" });
    globalThis.game.actors = [machine];
    await clearWhipOnCombatEnd();
    expect(machine.system.masterUuid).toBe("Actor.old");
    expect(machine.getFlag(NS, WHIP_FLAG)).toBeUndefined();
  });

  it("провал — машины не твои; вне боя и без машин — не работает", async () => {
    const smith = hero({ items: [itemOf(WHIP)] });
    smith.system.characteristics.int.bonus = 5;
    const machine = demonOf(brokenFlag());
    sceneWith(smith, [machine]);
    expect(await useEmpyreanWhip(smith)).toBe(false);
    expect(captured.chat).toHaveLength(0);
    inCombat(smith);
    captured.nextRoll = 99;
    expect(await useEmpyreanWhip(smith)).toBe(false);
    expect(machine.getFlag(NS, WHIP_FLAG)).toBeUndefined();
    sceneWith(smith, []);
    captured.nextRoll = 5;
    expect(await useEmpyreanWhip(smith)).toBe(false);
  });
});

describe("Кузница Одного", () => {
  it("Очко Бесчестия, запись сборки и карточка", async () => {
    const a = hero({ items: [itemOf(FORGE)], infamy: 2 });
    prompt({ what: "Оболочка Кузнизверга", rarity: "3", source: "обломки танка" });
    expect(await useForgeOfOne(a)).toBe(true);
    expect(fate(a)).toBe(1);
    expect(a.getFlag(NS, "forgeOfOneLog")).toEqual([{ what: "Оболочка Кузнизверга", rarity: 3, source: "обломки танка", at: 1000 }]);
    expect(lastCard()).toContain("Оболочка Кузнизверга");
    expect(lastCard()).toContain("сутки непрерывной работы");
  });

  it("Редкость выше R3, нет Очка, отмена — ничего не тратится", async () => {
    const a = hero({ items: [itemOf(FORGE)], infamy: 2 });
    prompt({ what: "Титан", rarity: "5", source: "" });
    expect(await useForgeOfOne(a)).toBe(false);
    prompt(null);
    expect(await useForgeOfOne(a)).toBe(false);
    expect(fate(a)).toBe(2);
    const empty = hero({ items: [itemOf(FORGE)], infamy: 0 });
    expect(await useForgeOfOne(empty)).toBe(false);
  });
});

describe("Загнать", () => {
  it("тратит Очко, даёт машине +30 ко всем Характеристикам и временное Очко Бесчестия", async () => {
    const smith = hero({ items: [itemOf(RUN)], infamy: 3 });
    const machine = demonOf(brokenFlag());
    inCombat(smith);
    expect(await useRunDown(smith, machine)).toBe(true);
    expect(fate(smith)).toBe(2);
    expect(machine.getFlag(NS, "tempInfamy")).toMatchObject({ amount: 1, source: "Загнать" });
    expect(machine.getFlag(NS, RUN_DOWN_FLAG)).toMatchObject({ smithUuid: "Actor.smith", combatId: "c1" });
    const effect = machine.created.find(d => d.kind === "ActiveEffect");
    expect(effect.system.changes).toHaveLength(10);
    expect(effect.system.changes.every(c => c.value === 30 && c.type === "add")).toBe(true);
    expect(lastCard()).toContain("Узы впились");
  });

  it("раз в Ход: второй раз в том же Раунде нельзя", async () => {
    const smith = hero({ items: [itemOf(RUN)], infamy: 3 });
    inCombat(smith);
    expect(await useRunDown(smith, demonOf(brokenFlag()))).toBe(true);
    const second = hero({ uuid: "Actor.m2", name: "Вторая", type: "daemon", infamy: 0, flags: { [BROKEN_FLAG]: brokenFlag() } });
    expect(await useRunDown(smith, second)).toBe(false);
    expect(fate(smith)).toBe(2);
  });

  it("вне боя, не Сломленная, уже загнанная — ничего", async () => {
    const smith = hero({ items: [itemOf(RUN)], infamy: 3 });
    expect(await useRunDown(smith, demonOf(brokenFlag()))).toBe(false);
    inCombat(smith);
    expect(await useRunDown(smith, demonOf())).toBe(false);
    expect(await useRunDown(smith, demonOf(brokenFlag(), { flags: { [BROKEN_FLAG]: brokenFlag(), [RUN_DOWN_FLAG]: { smithUuid: "Actor.smith" } } }))).toBe(false);
    expect(fate(smith)).toBe(3);
  });

  it("начало следующего Хода Кузнеца: Структура, Беспомощность, потеря W; эффект и бонусное Очко сняты", async () => {
    const smith = hero({ items: [itemOf(RUN)], infamy: 3 });
    const machine = demonOf(brokenFlag());
    inCombat(smith);
    await useRunDown(smith, machine);
    globalThis.game.actors = [machine];
    captured.dice = [10, 10, 10, 3, 2];
    const before = machine.system.wounds.value;
    expect(await runDownTurnStart(smith)).toBe(1);
    expect(machine.getFlag(NS, RUN_DOWN_FLAG)).toBeUndefined();
    expect(machine.getFlag(NS, "tempInfamy")).toBeUndefined();
    expect(machine.effects.filter(e => e.getFlag(NS, RUN_DOWN_FLAG))).toHaveLength(0);
    expect(before).toBe(20);
    expect(machine.system.wounds.value).toBe(0);
    expect(machine.system.wounds.critical).toBe(10);
    expect(machine.system.charLossPortions.find(p => p.key === "wp")).toMatchObject({ amount: 2, hours: 0 });
    expect(lastCard()).toContain("теряет <b>30</b> Структуры");
  });

  it("у техники (vehicle) расплата — Структура", async () => {
    const smith = hero({ items: [itemOf(RUN)], infamy: 3 });
    const vehicle = demonOf(brokenFlag());
    vehicle.type = "vehicle";
    delete vehicle.system.characteristics;
    vehicle.system.structure = { value: 55, max: 55 };
    inCombat(smith);
    await useRunDown(smith, vehicle);
    globalThis.game.actors = [vehicle];
    captured.dice = [10, 10, 5, 1, 1];
    await runDownTurnStart(smith);
    expect(vehicle.system.structure.value).toBe(55 - 25);
    expect(vehicle.created.filter(d => d.kind === "ActiveEffect")).toHaveLength(0);
  });

  it("Кузнец без Таланта или без загнанных машин — ничего не бросает", async () => {
    expect(await runDownTurnStart(hero())).toBe(0);
    expect(await runDownTurnStart(hero({ items: [itemOf(RUN)] }))).toBe(0);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("ГМ-релей: запись warpsmith", () => {
  const ctx = (initiator, target) => ({ initiatorOwned: true, initiator, target });
  const smith = () => hero({ items: [itemOf(CAGE), itemOf(CELL), itemOf(WHIP), itemOf(RUN)] });

  it("принимает узкие записи с верной меткой", () => {
    const me = smith();
    const broken = demonOf(brokenFlag());
    expect(checkTargetWrite({ kind: "warpsmith", action: "cage" }, ctx(me, demonOf())).ok).toBe(true);
    expect(checkTargetWrite({ kind: "warpsmith", action: "cageRelease" }, ctx(me, demonOf(brokenFlag({ state: "caged" })))).ok).toBe(true);
    expect(checkTargetWrite({ kind: "warpsmith", action: "cell", deviceName: "Реактор" }, ctx(me, broken)).ok).toBe(true);
    expect(checkTargetWrite({ kind: "warpsmith", action: "whip" }, ctx(me, broken)).ok).toBe(true);
    expect(checkTargetWrite({ kind: "warpsmith", action: "runDown" }, ctx(me, broken)).ok).toBe(true);
    const marked = demonOf(brokenFlag(), { flags: { [BROKEN_FLAG]: brokenFlag(), [RUN_DOWN_FLAG]: { smithUuid: "Actor.smith", smithUuids: ["Actor.smith"] } } });
    expect(checkTargetWrite({ kind: "warpsmith", action: "runDownPay", structure: 30, helpless: 5, wp: 5 }, ctx(me, marked)).ok).toBe(true);
  });

  it("отклоняет чужое: нет Таланта, чужая метка, лишние поля, числа вне потолка — и каждый раз по своей причине", () => {
    const me = smith();
    const plain = hero({ uuid: "Actor.plain" });
    const broken = demonOf(brokenFlag());
    const marked = demonOf(brokenFlag(), { flags: { [BROKEN_FLAG]: brokenFlag(), [RUN_DOWN_FLAG]: { smithUuid: "Actor.smith", smithUuids: ["Actor.smith"] } } });
    const why = (op, initiator, target) => checkTargetWrite({ kind: "warpsmith", ...op }, ctx(initiator, target));
    expect(why({ action: "cage" }, plain, demonOf())).toEqual({ ok: false, reason: "у инициатора нет Iron Cage" });
    expect(why({ action: "runDown" }, me, demonOf(brokenFlag({ smithUuid: "Actor.other", smithUuids: ["Actor.other"] })))).toEqual({ ok: false, reason: "цель не Сломлена инициатором" });
    expect(why({ action: "runDown" }, me, demonOf(brokenFlag({ state: "caged" })))).toEqual({ ok: false, reason: "цель не Сломлена инициатором" });
    expect(why({ action: "cage", extra: 1 }, me, demonOf())).toEqual({ ok: false, reason: "warpsmith: лишние поля" });
    expect(why({ action: "nuke" }, me, broken).reason).toContain("действие вне списка");
    expect(why({ action: "cell" }, me, demonOf(brokenFlag({ cell: { deviceName: "x" } }))).reason).toContain("уже в ячейке");
    expect(why({ action: "cellFree" }, me, broken)).toEqual({ ok: false, reason: "цель не в ячейке" });
    expect(why({ action: "cageRelease" }, me, broken)).toEqual({ ok: false, reason: "цель не заарканена инициатором" });
    expect(why({ action: "runDownPay", structure: 31, helpless: 1, wp: 1 }, me, marked)).toEqual({ ok: false, reason: "runDownPay: число вне потолка" });
    expect(why({ action: "runDownPay", structure: 5, helpless: 6, wp: 1 }, me, marked).reason).toContain("вне потолка");
    expect(why({ action: "runDownPay", structure: 5, helpless: 1, wp: 1 }, me, broken)).toEqual({ ok: false, reason: "цель не загнана инициатором" });
    expect(checkTargetWrite({ kind: "warpsmith", action: "cage" }, { initiatorOwned: false, initiator: me, target: demonOf() }).ok).toBe(false);
  });

  it("performTargetWrite ведёт запись в исполнитель", async () => {
    const me = smith();
    const demon = demonOf();
    await performTargetWrite(demon, { kind: "warpsmith", action: "cage" }, me);
    expect(demon.getFlag(NS, BROKEN_FLAG).state).toBe("caged");
    await performTargetWrite(demon, { kind: "warpsmith", action: "cageRelease" }, me);
    expect(demon.getFlag(NS, BROKEN_FLAG)).toBeUndefined();
  });

  it("исполнитель: неизвестное действие — ничего", async () => {
    expect(await performWarpsmithWrite(demonOf(), { action: "nuke" }, smith())).toBeNull();
  });
});

describe("сводка для листа", () => {
  it("считает заарканенных и Сломленных этим Кузнецом", () => {
    const smith = hero({ items: [itemOf(CAGE)] });
    const a = demonOf(brokenFlag({ state: "caged" }));
    const b = hero({ uuid: "Actor.b", name: "Б", type: "daemon", flags: { [BROKEN_FLAG]: brokenFlag() } });
    const c = hero({ uuid: "Actor.c", name: "В", type: "daemon", flags: { [BROKEN_FLAG]: brokenFlag({ smithUuid: "Actor.other", smithUuids: ["Actor.other"] }) } });
    globalThis.game.actors = [a, b, c];
    expect(warpsmithStatus(smith)).toMatchObject({ caged: 1, broken: 1, inCombat: false });
  });
});
