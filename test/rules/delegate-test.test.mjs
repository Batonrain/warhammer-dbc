// test/rules/delegate-test.test.mjs
//
// wdbc-uez7/wdbc-j814: делегирование теста другому игроку (вариант A —
// карточка в чат с кнопкой). Три роли (requester/executor/effectTarget) не
// должны спутаться местами — это и есть основной риск этого модуля, отсюда
// упор тестов именно на то, ЧТО оказывается в payload и в чей адрес уходит
// шёпот, а не только на «функция не падает».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activeOwnerOf, myLikelyActor, requestDelegatedTest,
  registerDelegatedTestOpener, openDelegatedTest, openDelegatedTestDirect, showDelegateTestPicker
} from "../../module/rules/delegate-test.mjs";

/** Реальная диспетчеризация Hooks.on/off/callAll — заглушка в foundry-stub.mjs
 *  ничего не хранит, локальный оверрайд по образцу scene-live-recalc.test.mjs. */
function dispatchingHooks() {
  const map = new Map();
  return {
    on: (event, fn) => { (map.get(event) ?? map.set(event, new Set()).get(event)).add(fn); },
    off: (event, fn) => { map.get(event)?.delete(fn); },
    once: () => {},
    callAll: (event, ...args) => { for (const fn of [...(map.get(event) ?? [])]) fn(...args); }
  };
}

/** globalThis.document не существует в node-окружении тестов — по образцу
 *  test/apps/player-access.test.mjs, только с реальным addEventListener/removeEventListener. */
function dispatchingDocument() {
  const handlers = new Map();
  return {
    addEventListener: (event, fn) => { (handlers.get(event) ?? handlers.set(event, new Set()).get(event)).add(fn); },
    removeEventListener: (event, fn) => { handlers.get(event)?.delete(fn); },
    _fire: (event, ev) => { for (const fn of [...(handlers.get(event) ?? [])]) fn(ev); }
  };
}

/** Подставной открытый лист актора (foundry.applications.sheets.ActorSheetV2 instance) —
 *  только то, что читает pickDelegateActor: .actor и .window.header. */
function fakeOpenSheet(actorObj) {
  const handlers = new Set();
  return {
    actor: actorObj,
    window: { header: {
      addEventListener: (event, fn) => handlers.add(fn),
      removeEventListener: (event, fn) => handlers.delete(fn)
    } },
    _clickHeader: ({ onHeaderButton = false } = {}) => {
      const ev = { target: { closest: sel => (onHeaderButton && sel === ".header-button") ? {} : null } };
      for (const fn of [...handlers]) fn(ev);
    }
  };
}

function user(id, { active = true, isGM = false } = {}) {
  return { id, name: id, active, isGM };
}

function actor(name, { owners = [] } = {}) {
  return {
    id: name,
    name,
    uuid: `Actor.${name}`,
    hasPlayerOwner: owners.length > 0,
    testUserPermission: (u, level) => level === "OWNER" && owners.includes(u.id)
  };
}

beforeEach(resetCaptured);

describe("activeOwnerOf", () => {
  it("находит активного игрока-владельца среди game.users.players", () => {
    const alice = user("alice");
    game.users = { players: [alice, user("bob")], filter: arr => [] };
    const a = actor("Пациент", { owners: ["alice"] });
    expect(activeOwnerOf(a)).toBe(alice);
  });

  it("неактивный владелец не считается", () => {
    const alice = user("alice", { active: false });
    game.users = { players: [alice] };
    const a = actor("Пациент", { owners: ["alice"] });
    expect(activeOwnerOf(a)).toBe(null);
  });

  it("без актора — null, не падает", () => {
    expect(activeOwnerOf(null)).toBe(null);
  });
});

describe("requestDelegatedTest — три роли не путаются местами", () => {
  afterEach(() => { game.users = { players: [], filter: () => [] }; });

  it("без активного владельца-исполнителя — предупреждение, чат не отправлен", async () => {
    game.users = { players: [], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор"); // владельца нет
    const ok = await requestDelegatedTest({
      requesterActor: patient, executorActor: doctor, effectTargetActor: patient, kind: "healing"
    });
    expect(ok).toBe(false);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("шёпот уходит владельцу ИСПОЛНИТЕЛЯ, а payload.targetActorUuid — это ПАЦИЕНТ, не исполнитель", async () => {
    const doc = user("doc-user");
    game.users = { players: [doc], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });

    const ok = await requestDelegatedTest({
      requesterActor: patient, executorActor: doctor, effectTargetActor: patient,
      kind: "healing", label: "Лечение"
    });

    expect(ok).toBe(true);
    expect(captured.chat.length).toBe(1);
    const msg = captured.chat[0];
    expect(msg.whisper).toContain("doc-user");
    expect(msg.flags["warhammer-dbc"].delegatedTest).toEqual({
      kind: "healing",
      targetActorUuid: patient.uuid,   // ← пациент (effectTarget), НЕ Actor.Доктор
      requesterActorUuid: patient.uuid
    });
    expect(msg.content).toContain("Пациент"); // карточка называет ЦЕЛЬ эффекта — за кого просят сделать тест
  });

  it("extra (skillKey/charKey и т.п. для обычного теста, wdbc-uez7) попадает в payload наравне с kind/targetActorUuid", async () => {
    const doc = user("doc-user");
    game.users = { players: [doc], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });

    await requestDelegatedTest({
      requesterActor: patient, executorActor: doctor, effectTargetActor: patient,
      kind: "genericTest", extra: { testKind: "skill", skillKey: "stealth", label: "Скрытность" }
    });

    expect(captured.chat[0].flags["warhammer-dbc"].delegatedTest).toEqual({
      kind: "genericTest",
      targetActorUuid: patient.uuid,
      requesterActorUuid: patient.uuid,
      testKind: "skill", skillKey: "stealth", label: "Скрытность"
    });
  });

  it("ГМ-пользователи тоже получают шёпот (видимость запроса за столом)", async () => {
    const doc = user("doc-user");
    const gm = user("gm-user", { isGM: true });
    game.users = { players: [doc], filter: fn => [doc, gm].filter(fn) };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });

    await requestDelegatedTest({ requesterActor: patient, executorActor: doctor, effectTargetActor: patient, kind: "healing" });

    expect(captured.chat[0].whisper).toEqual(["doc-user", "gm-user"]);
  });
});

describe("openDelegatedTest — диспетчеризация по kind", () => {
  afterEach(() => { globalThis.fromUuid = async () => null; game.user = {}; canvas.tokens = undefined; });

  it("неизвестный kind — предупреждение в консоль, opener не зовётся", async () => {
    const spy = [];
    console.warn = (...args) => spy.push(args.join(" "));
    await openDelegatedTest({ kind: "неизвестно", targetActorUuid: "Actor.x" });
    expect(spy.some(s => s.includes("неизвестный kind"))).toBe(true);
  });

  it("цель не найдена по uuid — предупреждение пользователю", async () => {
    globalThis.fromUuid = async () => null;
    registerDelegatedTestOpener("test-kind-1", () => { throw new Error("не должен вызваться"); });
    await openDelegatedTest({ kind: "test-kind-1", targetActorUuid: "Actor.missing" });
    expect(captured.warnings.some(w => w.includes("не найдена"))).toBe(true);
  });

  it("нет назначенного персонажа/токена — предупреждение, opener не зовётся", async () => {
    const patient = actor("Пациент");
    globalThis.fromUuid = async () => patient;
    game.user = {}; // нет .character
    canvas.tokens = { controlled: [] };
    registerDelegatedTestOpener("test-kind-2", () => { throw new Error("не должен вызваться"); });
    await openDelegatedTest({ kind: "test-kind-2", targetActorUuid: "Actor.pat" });
    expect(captured.warnings.some(w => w.includes("Нет назначенного персонажа"))).toBe(true);
  });

  it("исполнитель и цель эффекта передаются opener'у в правильном порядке (executor, effectTarget)", async () => {
    const patient = actor("Пациент");
    const doctor = actor("Доктор");
    globalThis.fromUuid = async () => patient;
    game.user = { character: doctor };

    let seen = null;
    registerDelegatedTestOpener("test-kind-3", (executorActor, effectTargetActor) => {
      seen = { executorActor, effectTargetActor };
    });
    await openDelegatedTest({ kind: "test-kind-3", targetActorUuid: "Actor.pat" });

    expect(seen.executorActor).toBe(doctor);
    expect(seen.effectTargetActor).toBe(patient);
  });

  it("opener получает третьим параметром весь payload — включая extra-поля (skillKey и т.п.)", async () => {
    const patient = actor("Пациент");
    const doctor = actor("Доктор");
    globalThis.fromUuid = async () => patient;
    game.user = { character: doctor };

    let seenPayload = null;
    registerDelegatedTestOpener("test-kind-4", (executorActor, effectTargetActor, payload) => {
      seenPayload = payload;
    });
    await openDelegatedTest({ kind: "test-kind-4", targetActorUuid: "Actor.pat", skillKey: "stealth", label: "Скрытность" });

    expect(seenPayload).toEqual({ kind: "test-kind-4", targetActorUuid: "Actor.pat", skillKey: "stealth", label: "Скрытность" });
  });
});

// wdbc-mhds: выбор исполнителя — нацеливание (T на токене, тот же способ,
// что и везде в игре), клик по заголовку открытого листа, или уже
// существующий таргет сцены — вместо выпадающего списка кандидатов.
describe("showDelegateTestPicker (wdbc-mhds)", () => {
  const realHooks = globalThis.Hooks;
  const realDocument = globalThis.document;
  let hooks, doc;

  beforeEach(() => {
    hooks = dispatchingHooks();
    doc = dispatchingDocument();
    globalThis.Hooks = hooks;
    globalThis.document = doc;
    game.users = { players: [], filter: () => [] };
    game.user = { targets: new Set() };
  });
  afterEach(() => {
    globalThis.Hooks = realHooks;
    globalThis.document = realDocument;
    game.user = { targets: new Set() };
    globalThis.fromUuid = async () => null;
  });

  it("уже есть таргет сцены (не сама цель эффекта) — резолвит сразу, без ожидания нацеливания", async () => {
    const doc_ = user("doc-user");
    game.users = { players: [doc_], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });
    game.user = { targets: new Set([{ actor: doctor }]) };

    await showDelegateTestPicker(patient, { kind: "healing", label: "Лечение", openSheets: () => [] });

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].flags["warhammer-dbc"].delegatedTest.targetActorUuid).toBe(patient.uuid);
  });

  it("нацеливание (T на токене → Hooks 'targetToken') выбирает исполнителя с активным владельцем", async () => {
    const doc_ = user("doc-user");
    game.users = { players: [doc_], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });

    const promise = showDelegateTestPicker(patient, { kind: "healing", label: "Лечение", openSheets: () => [] });
    hooks.callAll("targetToken", game.user, { actor: doctor }, true);
    await promise;

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].flags["warhammer-dbc"].delegatedTest.targetActorUuid).toBe(patient.uuid);
  });

  it("клик по заголовку открытого листа актора выбирает исполнителя", async () => {
    const doc_ = user("doc-user");
    game.users = { players: [doc_], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });
    const sheet = fakeOpenSheet(doctor);

    const promise = showDelegateTestPicker(patient, { kind: "healing", label: "Лечение", openSheets: () => [sheet] });
    sheet._clickHeader();
    await promise;

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].flags["warhammer-dbc"].delegatedTest.targetActorUuid).toBe(patient.uuid);
  });

  it("клик по кнопке закрытия/сворачивания в шапке (.header-button) НЕ выбирает исполнителя", async () => {
    game.users = { players: [user("doc-user")], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });
    const sheet = fakeOpenSheet(doctor);

    const promise = showDelegateTestPicker(patient, { kind: "healing", openSheets: () => [sheet] });
    sheet._clickHeader({ onHeaderButton: true });
    expect(captured.chat.length).toBe(0); // ничего не резолвилось — промис ещё висит

    sheet._clickHeader(); // обычный клик по шапке — теперь резолвит
    await promise;
    expect(captured.chat.length).toBe(1);
  });

  it("Escape отменяет и снимает слушателей — последующее нацеливание уже ничего не делает", async () => {
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });
    game.users = { players: [user("doc-user")], filter: () => [] };

    const promise = showDelegateTestPicker(patient, { kind: "healing", openSheets: () => [] });
    doc._fire("keydown", { key: "Escape" });
    await promise;
    expect(captured.chat.length).toBe(0);

    hooks.callAll("targetToken", game.user, { actor: doctor }, true); // слушатель уже снят
    expect(captured.chat.length).toBe(0);
  });

  it("выбранный исполнитель без активного владельца (NPC) — тест открывается СРАЗУ локально, без карточки-запроса в чат", async () => {
    const patient = actor("Пациент");
    const npcMedic = actor("Санитар-сервитор"); // owners не задан — активного владельца нет
    let seen = null;
    registerDelegatedTestOpener("test-npc-direct", (executorActor, effectTargetActor, payload) => {
      seen = { executorActor, effectTargetActor, payload };
    });
    game.user = { targets: new Set([{ actor: npcMedic }]) };

    await showDelegateTestPicker(patient, { kind: "test-npc-direct", label: "Лечение", extra: { foo: "bar" }, openSheets: () => [] });

    expect(captured.chat.length).toBe(0); // спрашивать некого — запроса в чат нет
    expect(seen.executorActor).toBe(npcMedic);
    expect(seen.effectTargetActor).toBe(patient);
    expect(seen.payload).toMatchObject({ kind: "test-npc-direct", targetActorUuid: patient.uuid, foo: "bar" });
  });
});

describe("openDelegatedTestDirect (wdbc-mhds)", () => {
  it("неизвестный kind — предупреждение в консоль, opener не зовётся", async () => {
    const spy = [];
    console.warn = (...args) => spy.push(args.join(" "));
    await openDelegatedTestDirect("неизвестно", actor("Икс"), actor("Игрек"));
    expect(spy.some(s => s.includes("неизвестный kind"))).toBe(true);
  });

  it("payload собран из тех же полей, что и у openDelegatedTest, requesterActorUuid — null (никто не просил)", async () => {
    const executor = actor("Исполнитель");
    const target = actor("Цель");
    let seenPayload = null;
    registerDelegatedTestOpener("test-direct-payload", (e, t, payload) => { seenPayload = payload; });
    await openDelegatedTestDirect("test-direct-payload", executor, target, { skillKey: "stealth" });
    expect(seenPayload).toEqual({
      kind: "test-direct-payload", targetActorUuid: target.uuid, requesterActorUuid: null, skillKey: "stealth"
    });
  });
});
