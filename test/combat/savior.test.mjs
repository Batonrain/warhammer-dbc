// test/combat/savior.test.mjs
//
// Savior / Спаситель (Рукопашные, Sahara 3-8dc5): в базовом контакте с союзником и
// врагом одновременно — Реакция и Давление против врага без действий. Контакт
// замеряется по токенам (combat/free-attack.mjs); здесь — выбор врага, гейт,
// списание Реакции и вызов встречного теста с нужным противником и ценой.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saviorPick, saviorGate, hasSavior } from "../../module/combat/savior.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const KEY = "meleeCore.core.savior";
const enemy = (name, uuid) => ({ actor: { name, uuid } });

describe("данные пака", () => {
  const doc = packDocById("packs-src/talents/Рукопашные", "dtRB7pkRzDVbW7pU");
  it("Талант несёт запись Конструктора с ключом возможности", () => {
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(KEY);
  });
  it("текст Таланта допускает Спасителя посреди другого действия (как в книге)", () => {
    expect(doc.system.benefit).toContain("даже посреди другого действия");
    expect(doc.system.benefit).toContain("Натиска или Верховой Атаки");
  });
});

describe("saviorPick: союзник и враг одновременно", () => {
  it("нет союзника — нельзя", () => {
    const r = saviorPick({ allies: 0, enemies: [enemy("Враг", "A.1")] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("союзник");
  });
  it("нет врага — нельзя", () => {
    expect(saviorPick({ allies: 2, enemies: [] }).ok).toBe(false);
  });
  it("один враг, цель не выбрана — он и есть", () => {
    const e = enemy("Враг", "A.1");
    expect(saviorPick({ allies: 1, enemies: [e] }).enemy).toBe(e);
  });
  it("несколько врагов без цели — просим выцелить", () => {
    const r = saviorPick({ allies: 1, enemies: [enemy("А", "A.1"), enemy("Б", "A.2")] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("выцельте");
  });
  it("несколько врагов, цель выбрана среди них — она", () => {
    const b = enemy("Б", "A.2");
    const r = saviorPick({ allies: 1, enemies: [enemy("А", "A.1"), b], targetActor: b.actor });
    expect(r.ok).toBe(true);
    expect(r.enemy).toBe(b);
  });
  it("цель вне контакта не считается: выбрана посторонняя — как будто не выбрана", () => {
    const r = saviorPick({ allies: 1, enemies: [enemy("А", "A.1"), enemy("Б", "A.2")], targetActor: { uuid: "A.far" } });
    expect(r.ok).toBe(false);
  });
});

describe("hasSavior и гейт", () => {
  it("по ключу и по имени", () => {
    expect(hasSavior(actorFor({ items: [byKey(KEY)] }))).toBe(true);
    expect(hasSavior(actorFor({ items: [{ id: "s", name: "Savior / Спаситель", type: "talent", system: {} }] }))).toBe(true);
    expect(hasSavior(actorFor({}))).toBe(false);
  });
  it("гейт: вне боя кнопка активна; в бою без Реакций — заблокирована", () => {
    const a = actorFor({ items: [byKey(KEY)] });
    a.type = "character"; a.getFlag = () => undefined;
    expect(saviorGate(a).disabled).toBe(false);
    globalThis.game.combat = { started: true };
    a.system.actionPoints = { value: 2, max: 2 };
    a.system.reactions = { value: 0, max: 1, defenseValue: 0 };
    expect(saviorGate(a).disabled).toBe(true);
    a.system.reactions.value = 1;
    expect(saviorGate(a).disabled).toBe(false);
    delete globalThis.game.combat;
  });
});

describe("triggerSavior: вызов Давления", () => {
  let shown;
  beforeEach(() => { shown = []; });
  afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); delete globalThis.canvas; delete globalThis.game.combat; });

  async function run({ allies, enemies, reactions = 1 }) {
    vi.resetModules();
    vi.doMock("../../module/combat/free-attack.mjs", () => ({
      friendlyContactTokenDocs: () => new Array(allies).fill({}),
      enemyContactTokenDocs: () => enemies
    }));
    vi.doMock("../../module/combat/techniques.mjs", () => ({ _showContestDialog: async (a, def) => { shown.push(def); } }));
    const mod = await import("../../module/combat/savior.mjs");
    const spent = [];
    const actor = actorFor({ items: [byKey(KEY)] });
    actor.type = "character";
    actor.getFlag = () => undefined; actor.setFlag = async () => {};
    actor.getActiveTokens = () => [{ document: { id: "me" } }];
    actor.update = async c => { spent.push(c); for (const [p, v] of Object.entries(c)) { const k = p.split(".").slice(1); let n = actor.system; for (const x of k.slice(0, -1)) n = n[x]; n[k.at(-1)] = v; } };
    globalThis.game.combat = { started: true };
    actor.system.actionPoints = { value: 2, max: 2 };
    actor.system.reactions = { value: reactions, max: 1, defenseValue: 0 };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
    await mod.triggerSavior(actor);
    return { actor, spent };
  }

  it("есть союзник и один враг — Давление открыто против врага, цена — Реакция в pay", async () => {
    const foe = { name: "Враг", uuid: "Actor.foe" };
    const { actor, spent } = await run({ allies: 1, enemies: [{ actor: foe }] });
    expect(shown).toHaveLength(1);
    expect(shown[0].opponents()).toEqual([foe]);
    expect(shown[0].label).toContain("Спаситель");
    expect(shown[0].stanceWs).toBe(true);        // это то же Давление: стойка считается
    expect(spent).toEqual([]);                    // до «Бросок!» ничего не списано
    expect(await shown[0].pay()).toBe(true);
    expect(actor.system.reactions.value).toBe(0);
  });

  it("нет Реакции — pay отказывает, Реакция не уходит в минус", async () => {
    const { actor } = await run({ allies: 1, enemies: [{ actor: { name: "В", uuid: "A.1" } }], reactions: 0 });
    expect(await shown[0].pay()).toBe(false);
    expect(actor.system.reactions.value).toBe(0);
  });

  it("нет союзника — окно не открывается", async () => {
    await run({ allies: 0, enemies: [{ actor: { name: "В", uuid: "A.1" } }] });
    expect(shown).toHaveLength(0);
  });
});
