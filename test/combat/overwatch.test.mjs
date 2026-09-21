// test/combat/overwatch.test.mjs
//
// Караул (wdbc-1rno.27/.37): объявление, реактивный триггер по движению
// врага в сектор, клик по кнопкам карточки (режим очереди, Hair Trigger).
// rollSuppressionTest замокан — его собственное поведение проверяется в
// test/combat/suppression.test.mjs, здесь важно только ЧТО и С ЧЕМ его зовут.

import "../support/foundry-stub.mjs";
import { resetCaptured, captured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";

const rollSuppressionTest = vi.fn(async () => ({ success: false }));
vi.mock("../../module/combat/suppression.mjs", () => ({
  rollSuppressionTest: (...args) => rollSuppressionTest(...args)
}));

import {
  declareOverwatch, overwatchMenuItems, overwatchState, isOverwatchActive, clearOverwatch,
  initOverwatchHooks, resolveOverwatchFireClick, resolveOverwatchHairTriggerClick, offerOverwatchShot
} from "../../module/combat/overwatch.mjs";

const HOSTILE = -1, FRIENDLY = 1;

function fakeActor({ type = "character", flags = {}, uuid = "Actor.stub", name = type, items = [], ...system } = {}) {
  const flagStore = structuredClone(flags);
  const walk = (obj, parts) => parts.reduce((o, k) => o?.[k], obj);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    type, uuid, name, isOwner: true, system, items: list,
    getFlag: (scope, key) => walk(flagStore[scope], String(key).split(".")),
    setFlag: async (scope, key, value) => {
      flagStore[scope] ??= {};
      const parts = String(key).split(".");
      let node = flagStore[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    },
    unsetFlag: async (scope, key) => {
      const bag = flagStore[scope];
      if (!bag) return;
      const parts = String(key).split(".");
      let node = bag;
      for (const k of parts.slice(0, -1)) node = node?.[k];
      if (node) delete node[parts.at(-1)];
    },
    update: async (changes = {}) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    // Тот же поиск, что настоящий Actor#getActiveTokens (foundry-stub.mjs) —
    // без него actorToken() в overwatch.mjs всегда получает null.
    getActiveTokens: (linked = false, document = false) => {
      const placeables = globalThis.canvas?.tokens?.placeables ?? [];
      const tokens = placeables.filter(t => (t.document ?? t).actor?.uuid === actor.uuid);
      return document ? tokens.map(t => t.document ?? t) : tokens;
    }
  };
  return actor;
}

function weaponItem({ id = "w1", name = "Лазган", rof_semi = 3, rof_full = 0, weaponClass = "ranged" } = {}) {
  return { id, name, type: "weapon", system: { equipped: true, weaponClass, rof_semi, rof_full, weaponProps: [] } };
}

function token({ id, x = 0, y = 0, rotation = 0, disposition = HOSTILE, actor = null, name = id } = {}) {
  const uuid = `Scene.s.Token.${id}`;
  const doc = { id, x, y, width: 1, height: 1, rotation, disposition, actor, name, uuid };
  doc.object = { id, uuid, targetedBy: null, setTarget(state, opts = {}) { this.targetedBy = state ? { opts } : null; } };
  actor && (actor._token = doc);
  return { document: doc };
}

beforeEach(() => {
  resetCaptured();
  rollSuppressionTest.mockClear();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] }, ready: true, scene: { grid: { distance: 1 }, tokens: [] } };
  globalThis.game.combat = undefined;
  globalThis.game.user = { id: "u1", targets: new Set() };
});

function place(...toks) {
  globalThis.canvas.tokens.placeables = toks.map(t => t.document ? t : t);
  // Actor#getActiveTokens (foundry-stub) reads canvas.tokens.placeables directly.
  globalThis.canvas.tokens.placeables = toks;
}

describe("declareOverwatch", () => {
  it("спускает 2 ОД, ставит состояние по развороту токена, шлёт карточку", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon] });
    const shooterToken = token({ id: "s", rotation: 90, actor: shooter });
    place(shooterToken);
    globalThis.game.combat = { started: true };

    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45, condition: "войдёт в сектор" });

    expect(shooter.system.actionPoints.value).toBe(0);
    const state = overwatchState(shooter);
    expect(state).toMatchObject({ sectorCenter: 90, arcWidth: 45, condition: "войдёт в сектор", weaponId: "w1", shotsRemaining: 2, maxBudget: 2 });
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Караул");
  });

  it("нет ОД — предупреждает, состояние не ставится", async () => {
    const weapon = weaponItem();
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 0, max: 2 }, items: [weapon] });
    place(token({ id: "s", actor: shooter }));
    globalThis.game.combat = { started: true };

    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    expect(isOverwatchActive(shooter)).toBe(false);
    expect(captured.warnings.some(w => w.includes("ОД"))).toBe(true);
  });
});

describe("overwatchMenuItems", () => {
  it("без экипированного дальнобойного — пусто", () => {
    const actor = fakeActor({ actionPoints: { value: 2, max: 2 } });
    globalThis.game.combat = { started: true };
    expect(overwatchMenuItems(actor)).toEqual([]);
  });

  it("с оружием и активным Encounter — пункт «Караул»", () => {
    const actor = fakeActor({ actionPoints: { value: 2, max: 2 }, items: [weaponItem()] });
    globalThis.game.combat = { started: true };
    const items = overwatchMenuItems(actor);
    expect(items.map(i => i.key)).toEqual(["overwatch"]);
  });

  it("Караул уже активен — пусто", async () => {
    const weapon = weaponItem();
    const actor = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon] });
    place(token({ id: "s", actor }));
    globalThis.game.combat = { started: true };
    await declareOverwatch(actor, { weaponId: "w1", arcWidth: 45 });
    expect(overwatchMenuItems(actor)).toEqual([]);
  });
});

// Хук updateToken в Foundry всегда получает (doc, changes, options, userId),
// и обработчик Караула выходит, если перемещение вызвал не этот клиент, —
// тот же гейт, что у Свободной Атаки (combat/free-attack.mjs). Раньше тест
// звал обработчик без userId, и гейта в коде не было: карточка Караула
// уходила в чат с каждого подключённого клиента разом (приёмка стопки
// #482-#504).
describe("реактивный триггер: враг входит в сектор", () => {
  it("враг спереди в секторе 45° — предлагает карточку с кнопками режима", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    const shooterToken = token({ id: "s", x: 0, y: 0, rotation: 0, disposition: FRIENDLY, actor: shooter });
    const enemyActor = fakeActor({ characteristics: { ag: { total: 30 } }, uuid: "Actor.enemy", name: "Культист" });
    const enemyToken = token({ id: "e", x: 0, y: -5, rotation: 0, disposition: HOSTILE, actor: enemyActor, name: "Культист" });
    place(shooterToken, enemyToken);
    globalThis.game.combat = { started: true, combatants: [{ actor: shooter }] };

    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });
    resetCaptured(); // сбрасываем карточку объявления, интересует только реактивная

    const handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    initOverwatchHooks();

    enemyToken.document.x = 0; enemyToken.document.y = -1;
    await Promise.all((handlers.updateToken || []).map(fn => fn(enemyToken.document, { x: 0, y: -1 }, {}, game.user.id)));

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Культист");
    expect(captured.chat[0].content).toContain("wh-overwatch-fire-btn");
  });

  it("перемещение вызвал другой клиент — карточку не постим (иначе она уйдёт с каждого)", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    const shooterToken = token({ id: "s", x: 0, y: 0, rotation: 0, disposition: FRIENDLY, actor: shooter });
    const enemyActor = fakeActor({ characteristics: { ag: { total: 30 } }, uuid: "Actor.enemy", name: "Культист" });
    const enemyToken = token({ id: "e", x: 0, y: -5, rotation: 0, disposition: HOSTILE, actor: enemyActor, name: "Культист" });
    place(shooterToken, enemyToken);
    globalThis.game.combat = { started: true, combatants: [{ actor: shooter }] };

    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });
    resetCaptured();

    const handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    initOverwatchHooks();

    enemyToken.document.x = 0; enemyToken.document.y = -1;
    await Promise.all((handlers.updateToken || []).map(fn => fn(enemyToken.document, { x: 0, y: -1 }, {}, "чужой-клиент")));

    expect(captured.chat.length).toBe(0);
  });

  it("союзник входит в сектор — не предлагает", async () => {
    const weapon = weaponItem();
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    const shooterToken = token({ id: "s", x: 0, y: 0, rotation: 0, disposition: FRIENDLY, actor: shooter });
    const allyActor = fakeActor({ uuid: "Actor.ally" });
    const allyToken = token({ id: "a", x: 0, y: -5, rotation: 0, disposition: FRIENDLY, actor: allyActor });
    place(shooterToken, allyToken);
    globalThis.game.combat = { started: true, combatants: [{ actor: shooter }] };
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });
    resetCaptured();

    const handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    initOverwatchHooks();

    allyToken.document.y = -1;
    await Promise.all((handlers.updateToken || []).map(fn => fn(allyToken.document, { x: 0, y: -1 }, {}, game.user.id)));

    expect(captured.chat.length).toBe(0);
  });

  it("та же цель дважды — не дублирует карточку", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    const shooterToken = token({ id: "s", x: 0, y: 0, rotation: 0, disposition: FRIENDLY, actor: shooter });
    const enemyActor = fakeActor({ characteristics: { ag: { total: 30 } }, uuid: "Actor.enemy" });
    const enemyToken = token({ id: "e", x: 0, y: -5, rotation: 0, disposition: HOSTILE, actor: enemyActor });
    place(shooterToken, enemyToken);
    globalThis.game.combat = { started: true, combatants: [{ actor: shooter }] };
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });
    resetCaptured();

    const handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    initOverwatchHooks();

    enemyToken.document.y = -1;
    await Promise.all((handlers.updateToken || []).map(fn => fn(enemyToken.document, { x: 0, y: -1 }, {}, game.user.id)));
    enemyToken.document.y = -2;
    await Promise.all((handlers.updateToken || []).map(fn => fn(enemyToken.document, { x: 0, y: -2 })));

    expect(captured.chat.length).toBe(1);
  });
});

describe("resolveOverwatchFireClick", () => {
  it("Одиночный — списывает 1 из бюджета, Караул остаётся активным, катает Подавление+20", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverActor = fakeActor({ uuid: "Actor.mover" });
    const moverDoc = token({ id: "m", actor: moverActor }).document;
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : (uuid === moverDoc.uuid ? moverDoc : null));

    await resolveOverwatchFireClick(shooter.uuid, moverDoc.uuid, "single");

    expect(overwatchState(shooter).shotsRemaining).toBe(1);
    expect(isOverwatchActive(shooter)).toBe(true);
    expect(moverDoc.object.targetedBy).toBeTruthy();
    expect(rollSuppressionTest).toHaveBeenCalledWith(moverActor, expect.objectContaining({ mod: 20, sourceLabel: "Караул", sourceActor: shooter }));
  });

  it("Короткая Очередь — расходует Караул целиком", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverDoc = token({ id: "m", actor: fakeActor({ uuid: "Actor.mover" }) }).document;
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : (uuid === moverDoc.uuid ? moverDoc : null));

    await resolveOverwatchFireClick(shooter.uuid, moverDoc.uuid, "semi");

    expect(isOverwatchActive(shooter)).toBe(false);
  });

  // Терпение/vigilant 3-4, Оружие Наследия, стрелковая ветка (wdbc-1rno.35/
  // wdbc-1rno.41, стр. 427-428): «+30 на выстрелы в Карауле» — заряжается
  // здесь, тратится в attack.mjs на фактическом броске.
  it("Терпение на оружии Караула — заряжает pending-флаг +30", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    weapon.system.legacy = { active: true, mutations: [{ name: "Терпение" }] };
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverDoc = token({ id: "m", actor: fakeActor({ uuid: "Actor.mover" }) }).document;
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : (uuid === moverDoc.uuid ? moverDoc : null));

    await resolveOverwatchFireClick(shooter.uuid, moverDoc.uuid, "single");

    expect(shooter.getFlag("warhammer-dbc", "legacyPatienceOverwatchPending")).toBe(true);
  });

  it("оружие без Терпения — pending-флаг не ставится", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter" });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverDoc = token({ id: "m", actor: fakeActor({ uuid: "Actor.mover" }) }).document;
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : (uuid === moverDoc.uuid ? moverDoc : null));

    await resolveOverwatchFireClick(shooter.uuid, moverDoc.uuid, "single");

    expect(shooter.getFlag("warhammer-dbc", "legacyPatienceOverwatchPending")).toBeUndefined();
  });
});

describe("offerOverwatchShot: Терпение — всегда стреляет первым", () => {
  it("оружие с Терпением — очерёдность безусловно 'reacting' (стрелок), независимо от Ag/Инициативы", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    weapon.system.legacy = { active: true, mutations: [{ name: "Терпение" }] };
    // Инициатива/Ловкость специально в пользу движущегося — без Терпения
    // победил бы он.
    const shooter = fakeActor({
      characteristics: { bs: { bonus: 5 }, ag: { total: 20 } },
      actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter", name: "Стрелок"
    });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverActor = fakeActor({ characteristics: { ag: { total: 80 } }, uuid: "Actor.mover", name: "Бегущий" });
    const moverDoc = token({ id: "m", actor: moverActor }).document;

    await offerOverwatchShot(shooter, moverDoc, { auto: true });

    const card = captured.chat.at(-1).content;
    expect(card).toContain(`первым действует <b>${shooter.name}</b>`);
    expect(card).toContain("Терпение");
  });

  it("оружие без Терпения, та же расстановка Ag — побеждает движущийся", async () => {
    const weapon = weaponItem({ rof_semi: 6 });
    const shooter = fakeActor({
      characteristics: { bs: { bonus: 5 }, ag: { total: 20 } },
      actionPoints: { value: 2, max: 2 }, items: [weapon], uuid: "Actor.shooter", name: "Стрелок"
    });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });

    const moverActor = fakeActor({ characteristics: { ag: { total: 80 } }, uuid: "Actor.mover", name: "Бегущий" });
    const moverDoc = token({ id: "m", actor: moverActor, name: "Бегущий" }).document;

    await offerOverwatchShot(shooter, moverDoc, { auto: true });

    const card = captured.chat.at(-1).content;
    expect(card).toContain(`первым действует <b>${moverDoc.name}</b>`);
  });
});

describe("resolveOverwatchHairTriggerClick", () => {
  it("помечает следующий выстрел Незримым и первым по очерёдности", async () => {
    const shooter = fakeActor({ uuid: "Actor.shooter" });
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : null);

    await resolveOverwatchHairTriggerClick(shooter.uuid);

    expect(shooter.getFlag("warhammer-dbc", "hairTriggerUnseenPending")).toBe(true);
  });

  it("раз в Раунд — второй клик в том же Раунде предупреждает", async () => {
    globalThis.game.combat = { round: 1 };
    const shooter = fakeActor({ uuid: "Actor.shooter" });
    globalThis.fromUuid = async uuid => (uuid === shooter.uuid ? shooter : null);

    await resolveOverwatchHairTriggerClick(shooter.uuid);
    await resolveOverwatchHairTriggerClick(shooter.uuid);

    expect(captured.warnings.some(w => w.includes("уже разыгран"))).toBe(true);
  });
});

describe("clearOverwatch", () => {
  it("снимает состояние", async () => {
    const weapon = weaponItem();
    const shooter = fakeActor({ characteristics: { bs: { bonus: 5 } }, actionPoints: { value: 2, max: 2 }, items: [weapon] });
    place(token({ id: "s", actor: shooter }));
    await declareOverwatch(shooter, { weaponId: "w1", arcWidth: 45 });
    expect(isOverwatchActive(shooter)).toBe(true);

    await clearOverwatch(shooter);

    expect(isOverwatchActive(shooter)).toBe(false);
  });
});
