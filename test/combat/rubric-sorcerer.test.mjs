// test/combat/rubric-sorcerer.test.mjs
//
// Колдун Рубрики (Sahara 1-54b9), Foundry-обвязка module/combat/rubric-sorcerer.mjs и места подключения:
// Рубрика Аримана (два Прорыва в психотесте и в Усмирении Варпа), Щит Рубрики, Повелитель Големов (диалог, тест,
// трата снаряжения, профиль «Голем Рубрики» из packs-src), Узы Душ, Регенерация и Психическое Эхо, Возрождён во Прахе,
// Инфернальные Снаряды. Актор — со схемой персонажа; Черты, Таланты и профиль Голема — настоящие документы packs-src.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import {
  rollPeril, rollChoiceTest, rubricShieldPlan, rubricShieldData, syncRubricShield, buildGolemData, spawnGolem,
  startGolemCreation, bindNexus, syncNexusInitiatives, regenerationTurnStart, rollRegeneration, psychicEchoButtonHtml,
  usePsychicEcho, clearRebornStupor, useRebornInDust, useInfernalShells, golemStatus
} from "../../module/combat/rubric-sorcerer.mjs";
import { handleCalmWarpClick } from "../../module/combat/calm-warp.mjs";
import { executePsychotest } from "../../module/sheets/tabs/psychic.mjs";
import { minionCreateDataFrom } from "../../module/apps/minion-convert.mjs";

const NS = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");
const TRAITS = "packs-src/traits/Элитные_архетипы/Колдун_Рубрики";
const TALENTS = "packs-src/talents/Элитные_архетипы/Колдун_Рубрики";
const AHRIMAN = packDocById(TRAITS, "9sJhwVzdna4nEq1K");
const GOLEM_MASTER = packDocById(TRAITS, "eWHbtOowFK4vzpmy");
const SHIELD = packDocById(TRAITS, "A0mnKWWoZCWS3rMv");
const SHELLS = packDocById(TALENTS, "IyT6qQ2kMX84nJHm");
const NEXUS = packDocById(TALENTS, "5xjq1j1WITDdVE1H");
const ECHO = packDocById(TALENTS, "aXp7wMmnaaZK7OdX");
const SEKHMET = packDocById(TALENTS, "5td6Wrh8tp6cYZtc");
const REBORN = packDocById(TALENTS, "BOIQCCgpura5tzWf");
const AEGIS = packDocById("packs-src/armor/Астартес/Броня/Терминаторская", "zWrnp0yUuNetd2cf");
const REGEN = packDocById("packs-src/traits", "6cf11ucGdzYt6ndt");
const STANDARD_BOLTS = packDocById("packs-src/ammunition/Стандартные", "5K23F0Trz1yBJXF2");
const INFERNO = packDocById("packs-src/ammunition/Специальные___Болты", "DXDYD6nYsLS1KnHm");
const GOLEM_DIR = path.join(ROOT, "packs-src/bestiary/Существа_Элитных_архетипов");
const GOLEM_PROFILE = JSON.parse(fs.readFileSync(path.join(GOLEM_DIR, fs.readdirSync(GOLEM_DIR).find(f => f.includes("iFNQWM17E1eZRbOB"))), "utf8"));

let seq = 0;
const itemOf = (doc, extra = {}) => {
  const flags = { ...doc.flags };
  const it = { id: `i${++seq}`, uuid: `Actor.hero.Item.i${seq}`, type: doc.type, name: doc.name,
    system: { ...doc.system, equipped: true, ...extra }, flags, getFlag: (s, k) => flags[s]?.[k],
    toObject: () => ({ name: it.name, type: it.type, system: it.system, flags: it.flags, img: doc.img }),
    update: async patch => { for (const [p, v] of Object.entries(patch)) { const keys = p.split(".").slice(1); let n = it.system; for (const k of keys.slice(0, -1)) n = n[k]; n[keys.at(-1)] = v; } } };
  return it;
};

function hero({ items = [], uuid = "Actor.hero", name = "Колдун", wounds = 20, flags = {}, lore = 60, infamy = 3, type = "character" } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.characteristics.wp.base = 60;
  system.characteristics.t.base = 50;
  system.wounds.max = 30;
  system.wounds.value = wounds;
  system.fate.value = infamy;
  system.fate.max = 5;
  system.groupSkills = { forbiddenLore: [{ specialty: "Warp", rank: "known", total: lore }] };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const store = { ...flags };
  const deleted = [];
  const self = {
    id: uuid.split(".").at(-1), uuid, name, type, system, items: list, isOwner: true, effects: Object.assign([], { contents: [] }),
    isToken: false, ownership: { default: 0 }, created: [], deleted,
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
        }
      }
      return self;
    },
    createEmbeddedDocuments: async (kind, docs) => { self.created.push(...docs); const made = docs.map(d => itemOf(d, {})); list.push(...made); return made; },
    deleteEmbeddedDocuments: async (kind, ids) => { deleted.push(...ids); ids.forEach(id => { const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1); }); return []; }
  };
  WarhammerActor.prototype.prepareDerivedData.call(self);
  self.system.groupSkills.forbiddenLore[0].total = lore;
  self.store = store;
  return self;
}

const cards = () => captured.chat.map(c => String(c.content));
const lastCard = () => cards().at(-1) ?? "";
const prompt = answer => { foundry.applications.api.DialogV2.prompt = async () => answer; };
const realGetProperty = globalThis.foundry.utils.getProperty;
const realDeepClone = globalThis.foundry.utils.deepClone;

beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  globalThis.game.time = { worldTime: 600 };
  globalThis.game.user = { isGM: true, targets: new Set() };
  globalThis.game.actors = [];
  globalThis.game.combat = undefined;
  globalThis.game.combats = [];
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.foundry.utils.deepClone = realDeepClone;
  globalThis.game.combat = undefined; delete globalThis.game.combats;
  globalThis.game.actors = [];
  globalThis.fromUuid = async () => null;
  delete foundry.applications.api.DialogV2.prompt;
});

describe("Рубрика Аримана: Прорыв", () => {
  it("два кубика — берётся меньший, второй показан на карточке", async () => {
    captured.dice = [70, 12];
    const a = hero({ items: [itemOf(AHRIMAN)] });
    const rolls = [];
    const res = await rollPeril(a, rolls);
    expect(res.total).toBe(12);
    expect(rolls).toHaveLength(2);
    expect(res.note).toContain("два броска 70 и 12");
    expect(res.note).toContain("отброшен 70");
  });

  it("без Черты — один кубик, пометки нет", async () => {
    captured.dice = [70, 12];
    const rolls = [];
    const res = await rollPeril(hero(), rolls);
    expect(res.total).toBe(70);
    expect(res.note).toBe("");
    expect(rolls).toHaveLength(1);
  });

  it("в психотесте Усиленного режима Прорыв бросается двумя кубиками (Феномен — одним)", async () => {
    const a = hero({ items: [itemOf(AHRIMAN)] });
    a.system.psyker = { ...a.system.psyker, rating: 9, currentRating: 9, class: "bound" };
    const power = { id: "p1", name: "Взор Варпа / Warp Gaze", type: "psychicPower",
      system: { testChar: "wp", powerType: "utility", testMod: 0 }, updates: [], update: async d => d };
    const opts = { mPR: 9, prMod: 0, mode: "push", path: "", modifier: 0, eldar: false, pushChoice: 1,
      damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };
    captured.dice = [1, 99, 80, 15, 3];
    await executePsychotest(a, power, opts);
    const text = cards().join("\n");
    expect(text).toContain("ВАРП-ПРОРЫВ");
    expect(text).toContain("Рубрика Аримана: два броска 80 и 15");
  });

  it("Усмирение Варпа: переброс таблицы Прорывов тоже двумя кубиками", async () => {
    const a = hero({ items: [itemOf(AHRIMAN)] });
    a.system.corruption.value = 30;
    Object.setPrototypeOf(a, Actor.prototype);
    globalThis.fromUuid = async () => a;
    const message = { isOwner: true, getFlag: () => undefined, setFlag: async () => {} };
    const btn = { dataset: { actorUuid: a.uuid, table: "peril", phenMod: "0" }, disabled: false };
    captured.dice = [90, 10];
    await handleCalmWarpClick(message, btn);
    expect(cards().join("\n")).toContain("Рубрика Аримана: два броска 90 и 10");
    expect(cards().join("\n")).toContain("(бросок 10)");
  });
});

describe("Рубрика Аримана: выбор мутации W−30", () => {
  it("порог W−30: успех открывает выбор, провал — нет", async () => {
    const a = hero({ items: [itemOf(AHRIMAN)] });
    captured.nextRoll = 30;
    expect(await rollChoiceTest(a)).toBe(true);
    expect(lastCard()).toContain("<b>30</b>");
    captured.nextRoll = 31;
    expect(await rollChoiceTest(a)).toBe(false);
  });
});

describe("Щит Рубрики", () => {
  it("есть Черта, нет щита — создать один; щит без Черты снимается", () => {
    expect(rubricShieldPlan(hero({ items: [itemOf(SHIELD)] }))).toEqual({ create: 1, remove: [] });
    const shield = itemOf({ type: "forcefield", name: "Щит", system: {}, flags: { [NS]: { rubricShield: true } } });
    expect(rubricShieldPlan(hero({ items: [itemOf(SHIELD), shield] }))).toEqual({ create: 0, remove: [] });
    expect(rubricShieldPlan(hero({ items: [shield] }))).toEqual({ create: 0, remove: [shield.id] });
    const twin = itemOf({ type: "forcefield", name: "Щит 2", system: {}, flags: { [NS]: { rubricShield: true } } });
    expect(rubricShieldPlan(hero({ items: [itemOf(SHIELD), shield, twin] })).remove).toEqual([twin.id]);
  });

  it("три вызова подряд (архетип выдаёт три Черты разом) создают один щит", async () => {
    const a = hero({ items: [itemOf(SHIELD)] });
    const create = a.createEmbeddedDocuments;
    a.createEmbeddedDocuments = async (kind, docs) => { await Promise.resolve(); await Promise.resolve(); return create(kind, docs); };
    await Promise.all([syncRubricShield(a), syncRubricShield(a), syncRubricShield(a)]);
    expect(a.created).toHaveLength(1);
  });

  it("данные щита — чародейский купол 1-50, не перегружается, включён", () => {
    const d = rubricShieldData();
    expect(d.type).toBe("forcefield");
    expect(d.system).toEqual(expect.objectContaining({
      shieldNature: "warp", shieldType: "dome", ratingMax: 50, overloadThreshold: 0, currentRating: 50, status: "active", equipped: true
    }));
    expect(d.flags[NS].rubricShield).toBe(true);
  });

  it("syncRubricShield создаёт щит владельцу Черты и ничего не делает чужому", async () => {
    const a = hero({ items: [itemOf(SHIELD)] });
    await syncRubricShield(a);
    expect(a.created.map(c => c.type)).toEqual(["forcefield"]);
    await syncRubricShield(a);
    expect(a.created).toHaveLength(1);
    const stranger = hero();
    await syncRubricShield(stranger);
    expect(stranger.created).toHaveLength(0);
  });
});

describe("Профиль Голема: данные нового Миньона", () => {
  const src = () => ({ ...JSON.parse(JSON.stringify(GOLEM_PROFILE)), uuid: "Compendium.warhammer-dbc.bestiary.Actor.iFNQWM17E1eZRbOB" });

  it("Миньон-демон среднего уровня, Лояльность 30, хозяин, слот и метка", () => {
    const d = buildGolemData(src(), { masterUuid: "Actor.hero", slotId: "slot1" });
    expect(d.type).toBe("minion");
    const m = new ACTOR_DATA_MODELS.minion(d.system).toObject();
    expect(m.masterUuid).toBe("Actor.hero");
    expect(m.minionType).toBe("daemon");
    expect(m.minionTier).toBe("standard");
    expect(m.slotTalentId).toBe("slot1");
    expect(m.loyalty).toEqual(expect.objectContaining({ value: 30, max: 30 }));
    expect(m.wounds.max).toBe(30);
    expect(d.flags[NS].rubricGolem).toEqual({ masterUuid: "Actor.hero", terminator: false, nexus: false });
    expect(d.items.find(i => i.type === "forcefield")).toBeTruthy();
    expect(d.items.some(i => i.type === "armor" && /Аквила/.test(i.name))).toBe(true);
  });

  it("Сехмет: Терминаторская броня вместо силовой, +10 WS и S, аблативные Раны в Раны, Regeneration 6", () => {
    const s = src();
    const base = new ACTOR_DATA_MODELS.minion(minionCreateDataFrom(s).system).toObject();
    const d = buildGolemData(s, { masterUuid: "Actor.hero", terminatorArmour: JSON.parse(JSON.stringify(AEGIS)) });
    const m = new ACTOR_DATA_MODELS.minion(d.system).toObject();
    expect(m.characteristics.ws.base).toBe(base.characteristics.ws.base + 10);
    expect(m.characteristics.s.base).toBe(base.characteristics.s.base + 10);
    expect(m.wounds.max).toBe(base.wounds.max + 10);
    expect(m.wounds.value).toBe(base.wounds.value + 10);
    const armours = d.items.filter(i => i.type === "armor");
    expect(armours).toHaveLength(1);
    expect(armours[0].name).toBe(AEGIS.name);
    expect(JSON.stringify(armours[0].flags)).not.toContain("ablativeWounds");
    const regen = d.items.find(i => i.type === "trait" && /Regeneration/.test(i.name));
    expect(regen.system.rating).toBe(6);
    expect(d.flags[NS].rubricGolem.terminator).toBe(true);
    expect(JSON.stringify(s)).toContain("Аквила");
  });
});

describe("Повелитель Големов: создание", () => {
  const fakeBestiary = () => {
    const doc = { name: GOLEM_PROFILE.name, uuid: "Compendium.x.Actor.iFNQWM17E1eZRbOB", toObject: () => JSON.parse(JSON.stringify(GOLEM_PROFILE)) };
    globalThis.game.packs = { get: () => ({ getIndex: async () => [{ _id: "iFNQWM17E1eZRbOB", name: GOLEM_PROFILE.name }], getDocument: async () => doc }) };
  };
  let made;
  beforeEach(() => {
    fakeBestiary();
    made = [];
    globalThis.Actor.create = async data => {
      const actor = hero({ uuid: `Actor.golem${made.length}`, name: data.name, type: "minion" });
      actor.createData = data;
      made.push(actor);
      return actor;
    };
    globalThis.game.scenes = { current: null };
  });
  afterEach(() => { delete globalThis.game.packs; delete globalThis.Actor.create; });

  const bolterBlade = () => itemOf({ type: "weapon", name: "Болтер", system: { weaponClass: "basic" }, flags: {} });
  const armourItem = () => itemOf({ type: "armor", name: "Силовая броня", system: { armorType: "power" }, flags: {} });

  it("успешное вселение: потрачены броня и оружие, Голем создан, карточка с душами", async () => {
    const armour = armourItem();
    const bolter = bolterBlade();
    const a = hero({ items: [itemOf(GOLEM_MASTER), armour, bolter] });
    globalThis.game.actors = [a];
    globalThis.fromUuid = async () => a;
    captured.nextRoll = 50;
    prompt({ armourId: armour.id, terminator: false, weaponIds: [bolter.id] });
    const res = await startGolemCreation(a);
    expect(res.ok).toBe(true);
    expect(a.deleted).toEqual([armour.id, bolter.id]);
    expect(made).toHaveLength(1);
    const data = made[0].createData;
    expect(data.type).toBe("minion");
    expect(data.system.loyalty.value).toBe(30);
    expect(data.system.masterUuid).toBe("Actor.hero");
    expect(data.name).toMatch(/№1$/);
    expect(data.prototypeToken.disposition).toBeGreaterThanOrEqual(0);
    expect(made[0].created.some(i => i.name === "Болтер")).toBe(true);
    expect(lastCard()).toContain("Голем Рубрики встаёт");
    expect(lastCard()).toContain("Свободных душ осталось: <b>7</b> из 8");
  });

  it("Бестиарий без профиля: Голем не создан — броня и оружие не потрачены", async () => {
    const armour = armourItem();
    const a = hero({ items: [itemOf(GOLEM_MASTER), armour] });
    globalThis.game.actors = [a];
    globalThis.fromUuid = async () => a;
    globalThis.game.packs = { get: () => ({ getIndex: async () => [], getDocument: async () => null }) };
    captured.nextRoll = 50;
    prompt({ armourId: armour.id, terminator: false, weaponIds: [] });
    const res = await startGolemCreation(a);
    expect(res.ok).toBe(false);
    expect(a.deleted).toEqual([]);
    expect(lastCard()).toContain("Голем не создан");
  });

  it("провал теста: душа и снаряжение целы, Голема нет", async () => {
    const armour = armourItem();
    const a = hero({ items: [itemOf(GOLEM_MASTER), armour] });
    globalThis.game.actors = [a];
    captured.nextRoll = 99;
    prompt({ armourId: armour.id, terminator: false, weaponIds: [] });
    expect(await startGolemCreation(a)).toBeNull();
    expect(a.deleted).toEqual([]);
    expect(made).toHaveLength(0);
    expect(lastCard()).toContain("Вселение не удалось");
  });

  it("порог теста — For.Lore(Warp)−10", async () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER)], lore: 60 });
    globalThis.game.actors = [a];
    captured.nextRoll = 50;
    prompt({ armourId: "", terminator: false, weaponIds: [] });
    await startGolemCreation(a);
    expect(lastCard()).toContain("<b>50</b>");
    resetCaptured();
    captured.nextRoll = 51;
    prompt({ armourId: "", terminator: false, weaponIds: [] });
    expect(await startGolemCreation(a)).toBeNull();
  });

  it("все 8 душ заняты живыми Големами — создать нельзя, диалога нет", async () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER)] });
    const golems = Array.from({ length: 8 }, (_, i) => hero({ uuid: `Actor.g${i}`, flags: { rubricGolem: { masterUuid: "Actor.hero" } } }));
    globalThis.game.actors = [a, ...golems];
    let asked = false;
    foundry.applications.api.DialogV2.prompt = async () => { asked = true; return null; };
    expect(await startGolemCreation(a)).toBeNull();
    expect(asked).toBe(false);
    expect(captured.warnings.join("\n")).toContain("душ");
  });

  it("разбитый Голем возвращает душу", () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER)] });
    const golems = Array.from({ length: 8 }, (_, i) => hero({ uuid: `Actor.g${i}`, flags: { rubricGolem: { masterUuid: "Actor.hero" }, ...(i === 0 ? { deceased: true } : {}) } }));
    globalThis.game.actors = [a, ...golems];
    const st = golemStatus(a);
    expect(st.free).toBe(1);
    expect(st.fallen).toBe(1);
  });

  it("без Навыка For.Lore(Warp) вселить нельзя", async () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER)] });
    a.system.groupSkills = { forbiddenLore: [] };
    globalThis.game.actors = [a];
    prompt({ armourId: "", terminator: false, weaponIds: [] });
    expect(await startGolemCreation(a)).toBeNull();
    expect(captured.warnings.join("\n")).toContain("Forbidden Lore (Warp)");
  });

  it("Сехмет: выбранная Терминаторская броня уходит Голему", async () => {
    const suit = itemOf(AEGIS);
    const a = hero({ items: [itemOf(GOLEM_MASTER), itemOf(SEKHMET), suit] });
    globalThis.game.actors = [a];
    globalThis.fromUuid = async () => a;
    captured.nextRoll = 10;
    prompt({ armourId: suit.id, terminator: true, weaponIds: [] });
    await startGolemCreation(a);
    const data = made[0].createData;
    expect(data.flags[NS].rubricGolem.terminator).toBe(true);
    expect(data.items.filter(i => i.type === "armor").map(i => i.name)).toEqual([AEGIS.name]);
    expect(lastCard()).toContain("Терминаторский Голем");
  });

  it("Сехмет без выбранной брони — отказ до теста, ничего не потрачено", async () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER), itemOf(SEKHMET)] });
    globalThis.game.actors = [a];
    prompt({ armourId: "", terminator: true, weaponIds: [] });
    expect(await startGolemCreation(a)).toBeNull();
    expect(captured.warnings.join("\n")).toContain("Терминаторскую броню");
    expect(captured.rolls).toEqual([]);
    expect(made).toHaveLength(0);
  });

  it("нет свободного слота Миньона — вопрос; отказ останавливает создание до теста", async () => {
    const a = hero({ items: [itemOf(GOLEM_MASTER)] });
    globalThis.game.actors = [a];
    captured.confirmAnswer = false;
    prompt({ armourId: "", terminator: false, weaponIds: [] });
    expect(await startGolemCreation(a)).toBeNull();
    expect(captured.dialog.window.title).toContain("Повелитель Големов");
    expect(captured.rolls).toEqual([]);
  });

  it("spawnGolem без профиля в Бестиарии сообщает причину", async () => {
    globalThis.game.packs = { get: () => ({ getIndex: async () => [], getDocument: async () => null }) };
    globalThis.fromUuid = async () => hero();
    const res = await spawnGolem({ masterUuid: "Actor.hero" });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Голем Рубрики");
  });
});

describe("Узы Душ", () => {
  const golem = (id, nexus = false) => hero({ uuid: `Actor.${id}`, name: id, flags: { rubricGolem: { masterUuid: "Actor.hero", nexus } } });

  it("связанный Голем получает Инициативу колдуна минус 0,01", async () => {
    const a = hero({ items: [itemOf(NEXUS)] });
    const g = golem("g1", true);
    g.id = "g1"; a.id = "hero";
    const updates = [];
    const combatant = (actor, initiative) => ({ id: actor.id, actorId: actor.id, actor, initiative, update: async p => { updates.push([actor.id, p]); } });
    const combat = { combatants: [combatant(a, 17), combatant(g, 3)] };
    globalThis.fromUuid = async uuid => (uuid === "Actor.hero" ? a : null);
    await syncNexusInitiatives(combat);
    expect(updates).toEqual([["g1", { initiative: 16.99 }]]);
  });

  it("хозяин ещё не бросал Инициативу — Голем не трогается; несвязанный — тоже", async () => {
    const a = hero({ items: [itemOf(NEXUS)] });
    const g = golem("g1", true); g.id = "g1"; a.id = "hero";
    const free = golem("g2", false); free.id = "g2";
    const updates = [];
    const combatant = (actor, initiative) => ({ id: actor.id, actorId: actor.id, actor, initiative, update: async p => { updates.push(p); } });
    globalThis.fromUuid = async uuid => (uuid === "Actor.hero" ? a : null);
    await syncNexusInitiatives({ combatants: [combatant(a, null), combatant(g, 3), combatant(free, 3)] });
    await syncNexusInitiatives({ combatants: [combatant(a, 17), combatant(free, 3)] });
    expect(updates).toEqual([]);
  });

  it("bindNexus помечает выбранного Голема; без свободной копии Таланта — отказ", async () => {
    const a = hero({ items: [itemOf(NEXUS)] });
    const g = golem("g1");
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    await bindNexus(a);
    expect(g.store.rubricGolem.nexus).toBe(true);
    expect(await bindNexus(a)).toBeNull();
    expect(captured.warnings.join("\n")).toContain("Узы Душ");
  });
});

describe("Регенерация и Психическое Эхо", () => {
  const regenGolem = (wounds = 10, flags = {}) => hero({ items: [itemOf(REGEN, { rating: 4 })], wounds, flags: { rubricGolem: { masterUuid: "Actor.hero" }, ...flags }, uuid: "Actor.g1", name: "Голем" });

  it("Принц Демонов карточки Регенерации не получает (авто-активация без тестов)", async () => {
    const g = regenGolem(10);
    g.type = "demonPrince";
    expect(await regenerationTurnStart(g)).toBeNull();
    expect(captured.chat).toEqual([]);
  });

  it("раненый получает карточку с кнопками теста и автоуспеха; здоровый — ничего", async () => {
    await regenerationTurnStart(regenGolem(10));
    expect(lastCard()).toContain("wh-regen-btn");
    expect(lastCard()).toContain('data-auto="1"');
    resetCaptured();
    expect(await regenerationTurnStart(regenGolem(30))).toBeNull();
    expect(captured.chat).toEqual([]);
  });

  it("тест T+0: успех лечит X Ран, провал нет", async () => {
    const g = regenGolem(10);
    captured.nextRoll = 50;
    expect(await rollRegeneration(g)).toBe(true);
    expect(g.system.wounds.value).toBe(14);
    captured.nextRoll = 99;
    expect(await rollRegeneration(g)).toBe(false);
    expect(g.system.wounds.value).toBe(14);
  });

  it("пропуск действий — автоуспех и ОД в ноль", async () => {
    const g = regenGolem(10);
    g.system.actionPoints.value = 2;
    await rollRegeneration(g, { auto: true });
    expect(g.system.wounds.value).toBe(14);
    expect(g.system.actionPoints.value).toBe(0);
  });

  it("Рана не больше максимума", async () => {
    const g = regenGolem(28);
    captured.nextRoll = 10;
    await rollRegeneration(g);
    expect(g.system.wounds.value).toBe(30);
  });

  it("Эхо: следующая Регенерация автоматическая и вдвое сильнее, флаг гаснет", async () => {
    const g = regenGolem(10, { psychicEchoPending: true });
    const res = await regenerationTurnStart(g);
    expect(res.echo).toBe(true);
    expect(g.system.wounds.value).toBe(18);
    expect(g.store.psychicEchoPending).toBeUndefined();
    expect(lastCard()).toContain("Психическое Эхо");
  });

  it("кнопка Эха на карточке манифестации — только у носителя Таланта с живым Големом", () => {
    const a = hero({ items: [itemOf(ECHO)] });
    globalThis.game.actors = [a];
    expect(psychicEchoButtonHtml(a)).toBe("");
    globalThis.game.actors = [a, regenGolem(10)];
    expect(psychicEchoButtonHtml(a)).toContain("wh-psychic-echo-btn");
    expect(psychicEchoButtonHtml(hero())).toBe("");
  });

  it("usePsychicEcho помечает Голема, раз в Раунд", async () => {
    const a = hero({ items: [itemOf(ECHO)] });
    const g = regenGolem(10);
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    expect(await usePsychicEcho(a)).toBe(true);
    expect(g.store.psychicEchoPending).toBe(true);
    expect(lastCard()).toContain("вдвое больше Ран");
  });

  it("карточка успешной манифестации несёт кнопку Эха", async () => {
    const a = hero({ items: [itemOf(ECHO)] });
    globalThis.game.actors = [a, regenGolem(10)];
    a.system.psyker = { ...a.system.psyker, rating: 9, currentRating: 9, class: "bound" };
    const power = { id: "p1", name: "Взор Варпа / Warp Gaze", type: "psychicPower",
      system: { testChar: "wp", powerType: "utility", testMod: 0 }, updates: [], update: async d => d };
    const opts = { mPR: 9, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false, pushChoice: 1,
      damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };
    captured.nextRoll = 5;
    await executePsychotest(a, power, opts);
    expect(cards().join("\n")).toContain("wh-psychic-echo-btn");
  });
});

describe("Возрождён во Прахе", () => {
  const fallen = (deceased = true) => hero({ uuid: "Actor.g1", name: "Голем", wounds: 0, flags: { rubricGolem: { masterUuid: "Actor.hero" }, deceased } });
  const psyker = a => { a.system.psyker = { ...a.system.psyker, rating: 9, currentRating: 9, class: "bound" }; return a; };
  const shownThreshold = () => Number(/<label>Порог<\/label><b>(-?\d+)<\/b>/.exec(cards().join("\n"))?.[1] ?? NaN);

  it("психотест настоящий: порог W−20 плюс 5×эPR Усиленного режима, не голое W−20", async () => {
    const a = psyker(hero({ items: [itemOf(REBORN)], infamy: 3 }));
    const g = fallen();
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    captured.dice = [1, 10, 3];
    await useRebornInDust(a);
    // W 60 − 20 = 40; эPR ≥ 9 даёт ещё ≥ 45.
    expect(shownThreshold()).toBeGreaterThanOrEqual(85);
    expect(cards().join("\n")).toContain("Феномен");
  });

  it("успех: Голем встаёт с Ранами, равными Успехам, в Ступоре; потрачены Очко и ОД", async () => {
    const a = psyker(hero({ items: [itemOf(REBORN)], infamy: 3 }));
    const g = fallen();
    g.system.conditions = {};
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    captured.dice = [1, 10, 3];
    const ok = await useRebornInDust(a);
    expect(ok).toBe(true);
    expect(g.system.wounds.value).toBeGreaterThanOrEqual(1);
    expect(g.store.deceased).toBe(false);
    expect(g.store.rebornStupor).toBe(true);
    expect(g.system.conditions.dazed).toBe(true);
    expect(a.system.fate.value).toBe(2);
    expect(lastCard()).toContain("Голем восстал");
  });

  it("провал: Голем остаётся разбитым, но Очко потрачено", async () => {
    const a = psyker(hero({ items: [itemOf(REBORN)], infamy: 3 }));
    const g = fallen();
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    a.system.characteristics.wp.total = 10;
    a.system.psyker.currentRating = 1;
    captured.dice = [100, 10, 3];
    expect(await useRebornInDust(a)).toBe(false);
    expect(g.store.deceased).toBe(true);
    expect(a.system.fate.value).toBe(2);
  });

  it("нет Очков Бесчестия — отказ, Голем не тронут", async () => {
    const a = psyker(hero({ items: [itemOf(REBORN)], infamy: 0 }));
    const g = fallen();
    globalThis.game.actors = [a, g];
    globalThis.fromUuid = async uuid => (uuid === "Actor.g1" ? g : a);
    prompt("Actor.g1");
    captured.dice = [1, 10, 3];
    expect(await useRebornInDust(a)).toBe(false);
    expect(g.store.deceased).toBe(true);
    expect(captured.rolls).toEqual([]);
  });

  it("нет разбитых Големов или свободной души — отказ", async () => {
    const a = hero({ items: [itemOf(REBORN)] });
    globalThis.game.actors = [a, fallen(false)];
    expect(await useRebornInDust(a)).toBe(false);
    const alive = Array.from({ length: 8 }, (_, i) => hero({ uuid: `Actor.l${i}`, flags: { rubricGolem: { masterUuid: "Actor.hero" } } }));
    globalThis.game.actors = [a, fallen(), ...alive];
    expect(await useRebornInDust(a)).toBe(false);
    expect(captured.warnings.join("\n")).toContain("свободной души");
  });

  it("Ступор снимается в начале Хода колдуна", async () => {
    const a = hero({ items: [itemOf(REBORN)] });
    const g = hero({ uuid: "Actor.g1", flags: { rubricGolem: { masterUuid: "Actor.hero" }, rebornStupor: true } });
    g.system.conditions = { dazed: true };
    globalThis.game.actors = [a, g];
    await clearRebornStupor(a);
    expect(g.store.rebornStupor).toBeUndefined();
    expect(g.system.conditions.dazed).toBe(false);
  });
});

describe("Инфернальные Снаряды", () => {
  const stubPack = () => {
    const doc = { name: INFERNO.name, toObject: () => JSON.parse(JSON.stringify(INFERNO)) };
    globalThis.game.packs = { get: () => ({ getIndex: async () => [{ _id: INFERNO._id, name: INFERNO.name }], getDocument: async () => doc }) };
  };
  afterEach(() => { delete globalThis.game.packs; });

  it("единица обычных болтов превращается в единицу Инферно-болтов", async () => {
    stubPack();
    const bolts = itemOf(STANDARD_BOLTS, { quantity: 3 });
    const a = hero({ items: [itemOf(SHELLS), bolts] });
    expect(await useInfernalShells(a)).toBe(true);
    expect(bolts.system.quantity).toBe(2);
    expect(a.created).toHaveLength(1);
    expect(a.created[0].system.quantity).toBe(1);
    expect(a.created[0].name).toBe(INFERNO.name);
    expect(lastCard()).toContain("Инферно-болтами Тзинча");
  });

  it("при повторе количество Инферно-болтов растёт, а не дублируется", async () => {
    stubPack();
    const bolts = itemOf(STANDARD_BOLTS, { quantity: 2 });
    const infernoItem = itemOf({ ...INFERNO, name: INFERNO.name }, { quantity: 4 });
    const a = hero({ items: [itemOf(SHELLS), bolts, infernoItem] });
    await useInfernalShells(a);
    expect(infernoItem.system.quantity).toBe(5);
    expect(a.created).toHaveLength(0);
  });

  it("нет обычных болтов, нет Таланта, отказ в диалоге — ничего не меняется", async () => {
    stubPack();
    const a = hero({ items: [itemOf(SHELLS)] });
    expect(await useInfernalShells(a)).toBe(false);
    expect(captured.warnings.join("\n")).toContain("обычных болтов");
    const bolts = itemOf(STANDARD_BOLTS, { quantity: 3 });
    const noTalent = hero({ items: [bolts] });
    expect(await useInfernalShells(noTalent)).toBe(false);
    captured.confirmAnswer = false;
    const asks = hero({ items: [itemOf(SHELLS), bolts] });
    expect(await useInfernalShells(asks)).toBe(false);
    expect(bolts.system.quantity).toBe(3);
  });

  it("особые болты не берутся за обычные", async () => {
    stubPack();
    const special = itemOf(INFERNO, { quantity: 5 });
    const a = hero({ items: [itemOf(SHELLS), special] });
    expect(await useInfernalShells(a)).toBe(false);
  });
});
