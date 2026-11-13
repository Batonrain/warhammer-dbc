import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const infection = vi.hoisted(() => ({ calls: [], result: "infected" }));
vi.mock("../../module/combat/disease-infection.mjs", () => ({
  rollInfectionTest: async (actor, item, opts) => {
    infection.calls.push({ actor, item, vector: opts?.vector });
    return infection.result;
  }
}));
const toxic = vi.hoisted(() => ({ calls: [] }));
vi.mock("../../module/hooks.mjs", async importOriginal => ({
  ...(await importOriginal()),
  _applyWeaponPropEffect: async (ds, opts) => { toxic.calls.push({ ds, opts }); }
}));

import { applyDamageToActor } from "../../module/combat/damage.mjs";
import {
  abominableOnHit, activateInfectiousMiasma, processMiasmaTurnStart, plagueMarineOnDamage, resolvePlagueMarineCombatEnd,
  bileSpitPenBonus, processWastelandRequest, onWastelandEnter, rotsmithClock, gloriousRustClock, infectVictims,
  infectiousMiasmaStatus, wastelandZonesOf
} from "../../module/combat/plague-marine.mjs";
import { blessedWithPusDisadvantage, grappleTechDef } from "../../module/combat/grapple.mjs";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

const NS = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
});
const packDoc = (rel, part) => walk(path.join(ROOT, "packs-src", rel))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8"))).find(d => d.name?.includes(part));
const ABOMINABLE = packDoc("traits/Элитные_архетипы/Чумной_Десантник", "Отвратная");
const MIASMA = packDoc("traits/Элитные_архетипы/Чумной_Десантник", "Infectious Miasma");
const TALENT = part => packDoc("talents/Элитные_архетипы/Чумной_Десантник", part);
const ROT = packDoc("diseases", "Nurgle's Rot");
const NAGA = packDoc("traits", "Изуверская Физиология");

let seq = 0;
const item = doc => {
  const id = `i${++seq}`;
  const it = {
    flags: {}, ...JSON.parse(JSON.stringify(doc)), id, system: { ...JSON.parse(JSON.stringify(doc.system ?? {})), equipped: true },
    getFlag: (s, k) => it.flags?.[s]?.[k],
    async setFlag(s, k, v) { it.flags = { ...(it.flags ?? {}), [s]: { ...(it.flags?.[s] ?? {}), [k]: v } }; },
    async unsetFlag(s, k) { delete it.flags?.[s]?.[k]; },
    async delete() { it.parent.items.splice(it.parent.items.indexOf(it), 1); },
    async update(d) { for (const [p, v] of Object.entries(d)) { const ks = p.split("."); let n = it; for (const k of ks.slice(0, -1)) n = (n[k] ??= {}); n[ks.at(-1)] = v; } },
    toObject: () => JSON.parse(JSON.stringify({ ...doc, system: it.system }))
  };
  return it;
};

function body({ name = "Тело", uuid, docs = [], wounds = 20, fate = 2, patron = "", sealed = false, reactions = 1, flags = {} } = {}) {
  const store = { ...flags };
  const list = docs.map(item);
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    id: uuid.replace(/^\w+\./, ""), name, type: "character", uuid, isToken: false, hasPlayerOwner: false, isOwner: true,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { t: { bonus: 6, total: 60 }, wp: { bonus: 3, total: 30 }, int: { bonus: 3, total: 30 }, inf: { total: 30 } },
      wounds: { value: wounds, critical: 0, max: 40 }, fatigue: { value: 0, max: 8 }, corruptionBonus: 4, corruption: { value: 40 },
      fate: { value: fate, max: 5 }, cover: { ap: 0 }, incomingDamageReduction: 0, patronGod: patron, sealedFullSuit: sealed,
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, reactions: { value: reactions, defenseValue: 0, strangeValue: 0 }, conditions: {}
    },
    items: list, effects: Object.assign([], { contents: [] }), _store: store,
    getFlag: (s, k) => store[`${s}.${k}`],
    setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete store[`${s}.${k}`]; },
    getActiveTokens: () => [],
    async update(data) {
      for (const [p, value] of Object.entries(data)) {
        const m = p.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = p.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(_t, data) {
      const made = data.map(d => { const it = item(d); it.parent = a; list.push(it); return it; });
      return made;
    },
    async updateEmbeddedDocuments(_t, updates) {
      for (const u of updates) { const it = list.find(i => i.id === u._id); const rest = { ...u }; delete rest._id; await it.update(rest); }
    },
    async deleteEmbeddedDocuments() {}
  };
  list.forEach(i => { i.parent = a; });
  return a;
}

const combatWith = (...actors) => {
  const c = { id: "c1", round: 1, started: true, combatant: { actor: actors[0] }, combatants: actors.map(actor => ({ actor })) };
  globalThis.game.combat = c;
  globalThis.game.combats = [c];
  return c;
};

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  infection.calls = []; infection.result = "infected"; toxic.calls = [];
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  globalThis.game.user = { isGM: true, targets: new Set() };
  globalThis.game.users = { activeGM: { isSelf: true } };
  globalThis.game.time = { worldTime: 1000 };
  globalThis.fromUuid = async () => null;
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.game.combats; delete globalThis.fromUuid;
});

describe("Отвратная Физиология: реакция на попадание", () => {
  const hit = (over = {}) => ({ rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс",
    attackerName: "Орк", attackerUuid: "Actor.ork", weaponName: "Топор", ...over });

  it("успех T+30: урон от этого противника падает на Успехи, Реакция потрачена, Страх при нуле, следующий удар — без диалога", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ABOMINABLE] });
    combatWith(pm);
    captured.dice = [20];
    await applyDamageToActor(pm, hit());
    expect(captured.dialog.content).toContain("T+30");
    expect(pm.system.reactions.value).toBe(0);
    expect(pm.system.wounds.value).toBe(20);
    const flag = pm._store[`${NS}.abominableGuard`];
    expect(flag).toEqual([{ attacker: "Actor.ork", reduce: 8, combatId: "c1", feared: true }]);
    expect(captured.chat.some(m => String(m.content).includes("wh-pm-fear-btn") && String(m.content).includes('data-target-uuid="Actor.ork"'))).toBe(true);

    captured.dialog = null;
    captured.dice = [];
    await applyDamageToActor(pm, hit({ rawDamage: 12 }));
    expect(captured.dialog).toBeNull();
    expect(pm.system.wounds.value).toBe(16);
  });

  it("чужой противник не прикрыт: у него отдельный тест", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ABOMINABLE], reactions: 2 });
    combatWith(pm);
    captured.dice = [20];
    await applyDamageToActor(pm, hit());
    captured.dice = [95];
    await applyDamageToActor(pm, hit({ attackerUuid: "Actor.other", attackerName: "Другой" }));
    expect(pm.system.reactions.value).toBe(0);
    expect(pm.system.wounds.value).toBe(15);
    expect(pm._store[`${NS}.abominableGuard`]).toHaveLength(1);
  });

  it("провал T+30: Реакция потрачена, урон прежний, защиты нет", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ABOMINABLE] });
    combatWith(pm);
    captured.dice = [95];
    await applyDamageToActor(pm, hit());
    expect(pm.system.reactions.value).toBe(0);
    expect(pm.system.wounds.value).toBe(15);
    expect(pm._store[`${NS}.abominableGuard`]).toBeUndefined();
  });

  it("отказ от Реакции — урон прежний, Реакция цела", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ABOMINABLE] });
    combatWith(pm);
    captured.confirmAnswer = false;
    await applyDamageToActor(pm, hit());
    expect(pm.system.reactions.value).toBe(1);
    expect(pm.system.wounds.value).toBe(15);
  });

  it("нет Реакций — диалога нет; вне боя — диалога нет; одноимённая Черта Наги — диалога нет", async () => {
    const noReaction = body({ uuid: "Actor.a", docs: [ABOMINABLE], reactions: 0 });
    combatWith(noReaction);
    await applyDamageToActor(noReaction, hit());
    expect(captured.dialog).toBeNull();

    globalThis.game.combat = undefined; delete globalThis.game.combats;
    const outside = body({ uuid: "Actor.b", docs: [ABOMINABLE] });
    await applyDamageToActor(outside, hit());
    expect(captured.dialog).toBeNull();
    expect(outside.system.wounds.value).toBe(15);

    const naga = body({ uuid: "Actor.c", docs: [NAGA] });
    combatWith(naga);
    await applyDamageToActor(naga, hit());
    expect(captured.dialog).toBeNull();
    expect(naga.system.wounds.value).toBe(15);
  });

  it("abominableOnHit напрямую: нулевой урон не трогает ничего", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ABOMINABLE] });
    combatWith(pm);
    const data = hit({ rawDamage: 0 });
    expect(await abominableOnHit(pm, data)).toBe(data);
    expect(captured.dialog).toBeNull();
  });
});

describe("Заразные Миазмы", () => {
  const scene = tokens => {
    const sc = { grid: { size: 100, distance: 2 }, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = sc; });
    return sc;
  };
  const tokenOf = (id, actor, x, disposition) => ({ id, uuid: `Scene.s.Token.${id}`, x, y: 0, width: 1, height: 1, hidden: false, actor, disposition, elevation: 0 });

  it("активация: Очко Бесчестия, 1d5+1 Ходов, раз за бой, только в бою", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [MIASMA] });
    expect(await activateInfectiousMiasma(pm)).toBe(false);
    expect(pm.system.fate.value).toBe(2);

    combatWith(pm);
    captured.dice = [3];
    expect(await activateInfectiousMiasma(pm)).toBe(true);
    expect(pm.system.fate.value).toBe(1);
    expect(pm._store[`${NS}.infectiousMiasma`]).toEqual({ combatId: "c1", total: 4, left: 4, victims: [] });
    expect(infectiousMiasmaStatus(pm)).toEqual({ used: true, active: true, left: 4 });

    expect(await activateInfectiousMiasma(pm)).toBe(false);
    expect(pm.system.fate.value).toBe(1);
  });

  it("без Очка Бесчестия миазмы не выпускаются", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [MIASMA], fate: 0 });
    combatWith(pm);
    captured.dice = [3];
    expect(await activateInfectiousMiasma(pm)).toBe(false);
    expect(pm._store[`${NS}.infectiousMiasma`]).toBeUndefined();
  });

  it("тик: урон всем не посвящённым Нурглу в 7 м (без герметичных), Toxic(0) при потере Ран; заражение — только после последнего Хода и только врагов", async () => {
    const pm = body({ name: "Чумной", uuid: "Actor.pm", docs: [MIASMA, ROT], patron: "nurgle" });
    pm.items[1].system.active = true;
    const enemy = body({ name: "Враг", uuid: "Actor.enemy" });
    const merc = body({ name: "Наёмник-союзник", uuid: "Actor.merc" });
    const cultist = body({ name: "Нурглит", uuid: "Actor.cult", patron: "nurgle" });
    const suit = body({ name: "В скафандре", uuid: "Actor.suit", sealed: true });
    const far = body({ name: "Дальний", uuid: "Actor.far" });
    const pmToken = tokenOf("pm", pm, 0, 1);
    const tokens = [pmToken, tokenOf("enemy", enemy, 100, -1), tokenOf("merc", merc, 200, 1), tokenOf("cult", cultist, 200, -1),
      tokenOf("suit", suit, 300, -1), tokenOf("far", far, 3000, -1)];
    scene(tokens);
    const byUuid = Object.fromEntries([...tokens.map(t => [t.uuid, t]), ...tokens.map(t => [t.actor.uuid, t.actor])]);
    globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;
    const combat = combatWith(pm);
    await pm.setFlag(NS, "infectiousMiasma", { combatId: "c1", total: 2, left: 2, victims: [] });

    captured.dice = [4, 6];
    await processMiasmaTurnStart(pm, pmToken, combat);
    expect(enemy.system.wounds.value).toBe(16);
    expect(merc.system.wounds.value).toBe(14);
    expect(cultist.system.wounds.value).toBe(20);
    expect(suit.system.wounds.value).toBe(20);
    expect(far.system.wounds.value).toBe(20);
    expect(toxic.calls.map(c => c.ds.wpForceActorUuid).sort()).toEqual(["Actor.enemy", "Actor.merc"]);
    expect(toxic.calls[0].ds).toMatchObject({ wpKey: "toxic", wpCondition: "poisoned", wpTestChar: "t", wpTestMod: "0" });
    expect(toxic.calls[0].opts).toEqual({ force: true });
    expect(pm._store[`${NS}.infectiousMiasma`]).toMatchObject({ left: 1, victims: ["Actor.enemy"] });
    expect(infection.calls).toHaveLength(0);

    captured.dice = [2, 2];
    await processMiasmaTurnStart(pm, pmToken, combat);
    expect(pm._store[`${NS}.infectiousMiasma`]).toBeUndefined();
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].actor).toBe(enemy);
    expect(infection.calls[0].vector).toEqual({ label: "Заразные Миазмы", char: "t", mod: 0 });
    expect(infection.calls[0].item.name).toBe(ROT.name);
    expect(infection.calls[0].item.system.active).toBe(false);
    expect(enemy.items.some(i => i.type === "disease")).toBe(true);
  });

  it("устоявший враг не оставляет у себя копию болезни; мёртвый не проверяется", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [MIASMA, ROT] });
    pm.items[1].system.active = true;
    const enemy = body({ uuid: "Actor.enemy" });
    const dead = body({ uuid: "Actor.dead", flags: { [`${NS}.deceased`]: true } });
    infection.result = "resisted";
    const out = await infectVictims(pm, [enemy, dead], "Тест");
    expect(out).toHaveLength(1);
    expect(infection.calls).toHaveLength(1);
    expect(enemy.items.filter(i => i.type === "disease")).toHaveLength(0);
  });

  it("у носителя нет болезней — заражать нечем, теста нет", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [MIASMA] });
    const enemy = body({ uuid: "Actor.enemy" });
    expect(await infectVictims(pm, [enemy], "Миазмы")).toEqual([]);
    expect(infection.calls).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("заражать нечем");
  });

  it("Чумной Садовник выбирает болезнь; без Таланта — случайно по броску", async () => {
    const second = { ...ROT, _id: "OtherDisease0001", name: "Другая / Другая", system: { ...ROT.system } };
    const pm = body({ uuid: "Actor.pm", docs: [ROT, second] });
    pm.items.forEach(i => { i.system.active = true; });
    const enemy = body({ uuid: "Actor.enemy" });
    captured.dice = [2];
    await infectVictims(pm, [enemy], "Миазмы");
    expect(infection.calls.at(-1).item.name).toBe("Другая / Другая");

    const gardener = body({ uuid: "Actor.gp", docs: [ROT, second, TALENT("Plague Gardener")] });
    gardener.items.filter(i => i.type === "disease").forEach(i => { i.system.active = true; });
    infection.calls = [];
    captured.dice = [];
    const run = infectVictims(gardener, [body({ uuid: "Actor.e2" })], "Миазмы");
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog.buttons.map(b => b.label)).toEqual([ROT.name, "Другая / Другая", "Случайно"]);
    await captured.press("d1");
    await run;
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].item.name).toBe("Другая / Другая");
  });
});

describe("Жёлчный Плевок и Благословенный Гноем: заражение в конце боя", () => {
  const SPIT = "Кислотный Плевок (Железа Бетчера)";
  const setup = ({ attackerDocs, victim = {} }) => {
    const pm = body({ name: "Чумной", uuid: "Actor.pm", docs: [...attackerDocs, ROT] });
    pm.items.find(i => i.type === "disease").system.active = true;
    const target = body({ name: "Жертва", uuid: "Actor.vic", ...victim });
    globalThis.fromUuid = async uuid => ({ "Actor.pm": pm, "Actor.vic": target })[uuid] ?? null;
    const combat = combatWith(pm, target);
    return { pm, target, combat };
  };
  const spit = (over = {}) => ({ rawDamage: 6, penetration: 0, damageType: "chemical", hitLocation: "Торс",
    attackerName: "Чумной", attackerUuid: "Actor.pm", weaponName: SPIT, ...over });

  it("плевок с непоглощённым уроном метит жертву; в конце боя — тест, метки сняты", async () => {
    const { target, combat } = setup({ attackerDocs: [TALENT("Bile Spit")] });
    await applyDamageToActor(target, spit());
    expect(target.system.wounds.value).toBe(14);
    expect(target._store[`${NS}.plagueInfectionDue`]).toEqual({ combatId: "c1", entries: [{ carrier: "Actor.pm", via: "Жёлчный Плевок" }] });
    expect(captured.chat.some(m => String(m.content).includes("в конце боя"))).toBe(true);

    await resolvePlagueMarineCombatEnd(combat);
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].actor).toBe(target);
    expect(infection.calls[0].vector.label).toBe("Жёлчный Плевок");
    expect(target._store[`${NS}.plagueInfectionDue`]).toBeUndefined();
  });

  it("урон поглощён, чужое оружие, нет Таланта, посвящённая Нурглу жертва — метки нет", async () => {
    const a = setup({ attackerDocs: [TALENT("Bile Spit")] });
    a.target.system.absorption.body = 30;
    await applyDamageToActor(a.target, spit());
    expect(a.target._store[`${NS}.plagueInfectionDue`]).toBeUndefined();

    const b = setup({ attackerDocs: [TALENT("Bile Spit")] });
    await applyDamageToActor(b.target, spit({ weaponName: "Болтер" }));
    expect(b.target._store[`${NS}.plagueInfectionDue`]).toBeUndefined();

    const c = setup({ attackerDocs: [] });
    await applyDamageToActor(c.target, spit());
    expect(c.target._store[`${NS}.plagueInfectionDue`]).toBeUndefined();

    const d = setup({ attackerDocs: [TALENT("Bile Spit")], victim: { patron: "nurgle" } });
    await applyDamageToActor(d.target, spit());
    expect(d.target._store[`${NS}.plagueInfectionDue`]).toBeUndefined();
  });

  it("касание кожи Благословенного Гноем метит так же, но под своим названием", async () => {
    const { target } = setup({ attackerDocs: [TALENT("Blessed with Pus")] });
    await applyDamageToActor(target, spit({ weaponName: "Благословенный Гноем", damageSubtype: "toxic" }));
    expect(target._store[`${NS}.plagueInfectionDue`].entries[0].via).toBe("Благословенный Гноем");
  });

  it("жертва, умершая до конца боя, не проверяется; метки боя гаснут у всех", async () => {
    const { pm, target, combat } = setup({ attackerDocs: [TALENT("Bile Spit")] });
    await applyDamageToActor(target, spit());
    await target.setFlag(NS, "deceased", true);
    await pm.setFlag(NS, "infectiousMiasma", { combatId: "c1", left: 1, victims: [] });
    await pm.setFlag(NS, "infectiousMiasmaUsed", "c1");
    await resolvePlagueMarineCombatEnd(combat);
    expect(infection.calls).toHaveLength(0);
    expect(pm._store[`${NS}.infectiousMiasma`]).toBeUndefined();
    expect(pm._store[`${NS}.infectiousMiasmaUsed`]).toBeUndefined();
  });

  it("плевок без попадания по Ранам ничего не делает: plagueMarineOnDamage на нулевой урон", async () => {
    const { target } = setup({ attackerDocs: [TALENT("Bile Spit")] });
    expect(await plagueMarineOnDamage(target, spit(), 0)).toBe("");
  });

  it("+1d5 к Pen только у плевка и только у носителя Таланта", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Bile Spit")] });
    captured.dice = [3];
    expect(await bileSpitPenBonus(pm, { name: SPIT })).toEqual({ pen: 3 });
    expect(await bileSpitPenBonus(pm, { name: "Болтер" })).toEqual({ pen: 0 });
    expect(await bileSpitPenBonus(body({ uuid: "Actor.x" }), { name: SPIT })).toEqual({ pen: 0 });
  });
});

describe("Ходячая Пустошь", () => {
  const sceneWith = (regions = []) => {
    const sc = { grid: { size: 100, distance: 1 }, regions, created: [], async createEmbeddedDocuments(_t, data) { sc.created.push(...data); return data; } };
    return sc;
  };
  const withToken = (actor, sc) => {
    actor.getActiveTokens = () => [{ x: 1000, y: 1000, width: 1, height: 1, parent: sc }];
  };

  it("непоглощённый урон в бою оставляет заявку; ГМ превращает её в Область 100×100 м на 7 суток", async () => {
    const pm = body({ name: "Чумной", uuid: "Actor.pm", docs: [TALENT("Walking Wasteland"), ROT] });
    pm.items.find(i => i.type === "disease").system.active = true;
    const sc = sceneWith();
    withToken(pm, sc);
    combatWith(pm);
    await applyDamageToActor(pm, { rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс", attackerName: "Орк" });
    expect(pm._store[`${NS}.wastelandRequest`]).toBeTruthy();

    await processWastelandRequest(pm);
    expect(pm._store[`${NS}.wastelandRequest`]).toBeUndefined();
    expect(sc.created).toHaveLength(1);
    const region = sc.created[0];
    expect(region.shapes[0]).toMatchObject({ type: "rectangle", width: 10000, height: 10000, x: -3950, y: -3950 });
    expect(region.behaviors[0]).toMatchObject({ type: "wastelandZone" });
    expect(region.behaviors[0].system).toMatchObject({ carrierUuid: "Actor.pm", expiresAt: 1000 + 7 * 24 * 3600 });
  });

  it("пока старая Область жива, новая не создаётся; без боя заявки нет", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Walking Wasteland")] });
    const live = { behaviors: [{ type: "wastelandZone", system: { carrierUuid: "Actor.pm", expiresAt: 999999 } }] };
    const sc = sceneWith([live]);
    withToken(pm, sc);
    expect(wastelandZonesOf(sc, "Actor.pm")).toHaveLength(1);
    await pm.setFlag(NS, "wastelandRequest", { at: 1 });
    await processWastelandRequest(pm);
    expect(sc.created).toHaveLength(0);

    const quiet = body({ uuid: "Actor.q", docs: [TALENT("Walking Wasteland")] });
    await applyDamageToActor(quiet, { rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс", attackerName: "Орк" });
    expect(quiet._store[`${NS}.wastelandRequest`]).toBeUndefined();
  });

  it("вход в зону: проверка раз, не для Нурглита, не в герметичном комплекте, не после срока", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [ROT] });
    pm.items[0].system.active = true;
    globalThis.fromUuid = async uuid => (uuid === "Actor.pm" ? pm : null);
    const system = { carrierUuid: "Actor.pm", diseaseId: "", expiresAt: 5000, tested: {} };
    const walker = body({ uuid: "Actor.w" });
    await onWastelandEnter(system, { id: "t1", actor: walker }, "Зона");
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].vector.label).toBe("Зона");

    await onWastelandEnter(system, { id: "t2", actor: body({ uuid: "Actor.n", patron: "nurgle" }) }, "Зона");
    await onWastelandEnter(system, { id: "t3", actor: body({ uuid: "Actor.s", sealed: true }) }, "Зона");
    expect(infection.calls).toHaveLength(1);

    globalThis.game.time.worldTime = 6000;
    await onWastelandEnter(system, { id: "t4", actor: body({ uuid: "Actor.late" }) }, "Зона");
    expect(infection.calls).toHaveLength(1);
  });
});

describe("Кузнец Гнили и Славная Ржавчина: часы Календаря", () => {
  const knife = { type: "weapon", name: "Combat Knife / Боевой Нож", system: { meleeCategory: "Нож", equipped: true, quality: "common" } };
  const head = { type: "gear", name: "Severed Head / Отрубленная голова", system: { quantity: 1, quality: "common" } };

  it("через 7 часов нож превращается в чумной нож, голова — в Моровую гранату; раньше — нет", async () => {
    const plagueKnife = packDoc("weapons", "Plague Knife");
    const blight = packDoc("weapons", "Blight");
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Rotsmith"), knife, head] });
    globalThis.fromUuid = async uuid => ({
      "Compendium.warhammer-dbc.weapons.Item.8WsGDqiEojMxFIfa": { name: plagueKnife.name, toObject: () => JSON.parse(JSON.stringify(plagueKnife)) },
      "Compendium.warhammer-dbc.weapons.Item.f4UQUImXaE48h9VT": { name: blight.name, toObject: () => JSON.parse(JSON.stringify(blight)) }
    })[uuid] ?? null;
    const [kn, hd] = [pm.items[1], pm.items[2]];
    await kn.setFlag(NS, "rotsmith", { convertAt: 5000, kind: "plagueKnife" });
    await hd.setFlag(NS, "rotsmith", { convertAt: 5000, kind: "blight" });

    await rotsmithClock(pm, { from: 1000, to: 4999 });
    expect(pm.items.map(i => i.name)).toContain(knife.name);

    await rotsmithClock(pm, { from: 4999, to: 5000 });
    const names = pm.items.map(i => i.name);
    expect(names).toContain(plagueKnife.name);
    expect(names).toContain(blight.name);
    expect(names).not.toContain(knife.name);
    expect(names).not.toContain(head.name);
    expect(pm.items.find(i => i.name === plagueKnife.name).system.equipped).toBe(true);
  });

  it("Ржавчина: первый проход метит, через 7 часов Poor.Q → Good.Q, нормальное через 7 дней → Good.Q, мистическое не трогается", async () => {
    const poor = { type: "armor", name: "Ржавая броня", system: { quality: "poor" } };
    const common = { type: "gear", name: "Ранец", system: { quality: "common" } };
    const mystic = { type: "gear", name: "Амулет", system: { quality: "poor", gearCategory: "mystic" } };
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Glorious Rust"), poor, common, mystic] });
    const [, p, c, m] = pm.items;

    await gloriousRustClock(pm, { from: 0, to: 100 });
    expect(p.flags[NS].gloriousRust).toEqual({ since: 0 });
    expect(m.flags?.[NS]?.gloriousRust).toBeUndefined();
    expect(p.system.quality).toBe("poor");

    await gloriousRustClock(pm, { from: 100, to: 7 * 3600 });
    expect(p.system.quality).toBe("good");
    expect(c.system.quality).toBe("common");
    expect(m.system.quality).toBe("poor");

    await gloriousRustClock(pm, { from: 7 * 3600, to: 7 * 24 * 3600 });
    expect(c.system.quality).toBe("good");
    expect(captured.chat.at(-1).content).toContain("Ранец");
  });

  it("без Таланта часы ничего не делают", async () => {
    const pm = body({ uuid: "Actor.pm", docs: [{ type: "gear", name: "Ранец", system: { quality: "common" } }] });
    await gloriousRustClock(pm, { from: 0, to: 99999999 });
    expect(pm.items[0].system.quality).toBe("common");
  });
});

describe("Помеха на Захват против Благословенного Гноем", () => {
  it("действует на чужого, не на самого носителя; проходит в описание приёма", () => {
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Blessed with Pus")] });
    const orc = body({ uuid: "Actor.orc" });
    expect(blessedWithPusDisadvantage(orc, pm)).toBe(true);
    expect(blessedWithPusDisadvantage(pm, orc)).toBe(false);
    expect(blessedWithPusDisadvantage(orc, null)).toBe(false);
    const def = grappleTechDef(orc, { label: "Заломить", defaultChar: "s", opponent: pm });
    expect(def.forcedRerollMode).toBe("keepWorst");
    expect(grappleTechDef(orc, { label: "Заломить", defaultChar: "s", opponent: body({ uuid: "Actor.o2" }) }).forcedRerollMode).toBe("");
  });
});

describe("Автоматически заражается Гнилью Нургла при покупке архетипа", () => {
  it("запись архетипа выдаёт настоящую болезнь уже включённой", async () => {
    const arch = packDoc("elite-archetypes", "Plague Marine");
    const entry = arch.flags[NS].mechanics.flatMap(g => g.entries).find(e => e.kind === "equipment" && e.equipCategoryPack === "diseases");
    globalThis.fromUuid = async uuid => (uuid === entry.equipSourceUuid ? { name: ROT.name, toObject: () => JSON.parse(JSON.stringify(ROT)) } : null);
    const created = [];
    const actor = new Actor();
    actor.system = { characteristics: {}, skills: {}, groupSkills: {}, wounds: { max: 10 } };
    actor.items = [];
    actor.update = async () => {};
    actor.createEmbeddedDocuments = async (_t, docs) => { created.push(...docs); return docs; };
    const flags = { mechanics: [{ id: "g1", operator: "AND", entries: [entry] }] };
    const source = {
      id: "arch1", type: "eliteArchetype", name: arch.name, system: {}, parent: actor, effects: [],
      getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; }, unsetFlag: async () => {},
      update: async () => source, createEmbeddedDocuments: async (_t, d) => d, deleteEmbeddedDocuments: async () => []
    };
    await applyItemMechanics(source);
    const disease = created.find(d => d.type === "disease");
    expect(disease).toBeTruthy();
    expect(disease.name).toBe(ROT.name);
    expect(disease.system.active).toBe(true);
  });
});

describe("ревью: заражение Миазмами и конец боя", () => {
  const tokenOf = (id, actor, x, disposition) => ({ id, uuid: `Scene.s.Token.${id}`, x, y: 0, width: 1, height: 1, hidden: false, actor, disposition, elevation: 0 });
  const setup = () => {
    const pm = body({ uuid: "Actor.pm", docs: [MIASMA, ROT] });
    pm.items[1].system.active = true;
    const enemy = body({ uuid: "Actor.enemy" });
    const pmToken = tokenOf("pm", pm, 0, 1);
    const tokens = [pmToken, tokenOf("enemy", enemy, 100, -1)];
    const sc = { grid: { size: 100, distance: 2 }, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = sc; });
    const byUuid = { "Actor.enemy": enemy, "Actor.pm": pm };
    globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;
    return { pm, enemy, pmToken, combat: combatWith(pm, enemy) };
  };

  it("враг, у которого T.b поглотил урон Миазмов, не проходит заражение", async () => {
    const { pm, enemy, pmToken, combat } = setup();
    enemy.system.absorption.toughnessBonus = 30;
    enemy.system.absorption.body = 30;
    await pm.setFlag(NS, "infectiousMiasma", { combatId: "c1", total: 1, left: 1, victims: [] });
    captured.dice = [4];
    await processMiasmaTurnStart(pm, pmToken, combat);
    expect(enemy.system.wounds.value).toBe(20);
    expect(toxic.calls).toHaveLength(0);
    expect(infection.calls).toHaveLength(0);
  });

  it("бой кончился раньше облака: задетые выжившие враги всё равно проходят заражение", async () => {
    const { pm, enemy, combat } = setup();
    await pm.setFlag(NS, "infectiousMiasma", { combatId: "c1", total: 3, left: 2, victims: ["Actor.enemy"] });
    await resolvePlagueMarineCombatEnd(combat);
    expect(pm._store[`${NS}.infectiousMiasma`]).toBeUndefined();
    expect(infection.calls).toHaveLength(1);
    expect(infection.calls[0].actor).toBe(enemy);
  });

  it("Кузнец Гнили: из стопки ножей уходит один", async () => {
    const plagueKnife = packDoc("weapons", "Plague Knife");
    const stack = { type: "weapon", name: "Combat Knife / Боевой Нож", system: { meleeCategory: "Нож", quantity: 5, quality: "common" } };
    const pm = body({ uuid: "Actor.pm", docs: [TALENT("Rotsmith"), stack] });
    globalThis.fromUuid = async () => ({ name: plagueKnife.name, toObject: () => JSON.parse(JSON.stringify(plagueKnife)) });
    await pm.items[1].setFlag(NS, "rotsmith", { convertAt: 10, kind: "plagueKnife" });
    await rotsmithClock(pm, { from: 0, to: 10 });
    expect(pm.items.find(i => i.name === stack.name).system.quantity).toBe(4);
    expect(pm.items.find(i => i.name === stack.name).flags[NS].rotsmith).toBeUndefined();
    expect(pm.items.map(i => i.name)).toContain(plagueKnife.name);
  });
});
