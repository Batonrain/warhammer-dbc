// test/rules/delegate-test.test.mjs
//
// wdbc-uez7/wdbc-j814: делегирование теста другому игроку (вариант A —
// карточка в чат с кнопкой). Три роли (requester/executor/effectTarget) не
// должны спутаться местами — это и есть основной риск этого модуля, отсюда
// упор тестов именно на то, ЧТО оказывается в payload и в чей адрес уходит
// шёпот, а не только на «функция не падает».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, fakeForm, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activeOwnerOf, myLikelyActor, requestDelegatedTest,
  registerDelegatedTestOpener, openDelegatedTest, showDelegateTestPicker
} from "../../module/rules/delegate-test.mjs";

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

describe("showDelegateTestPicker", () => {
  afterEach(() => {
    game.actors = undefined;
    game.users = { players: [], filter: () => [] };
    globalThis.fromUuid = async () => null;
  });

  it("нет других акторов с активным владельцем — предупреждение, диалог не открывается", async () => {
    const patient = actor("Пациент");
    game.actors = [patient];
    await showDelegateTestPicker(patient);
    expect(captured.warnings.length).toBe(1);
    expect(captured.dialog).toBe(null);
  });

  it("выбор исполнителя в диалоге и отправка запроса — effectTarget остаётся пациентом", async () => {
    const doc = user("doc-user");
    game.users = { players: [doc], filter: () => [] };
    const patient = actor("Пациент");
    const doctor = actor("Доктор", { owners: ["doc-user"] });
    game.actors = [patient, doctor];
    globalThis.fromUuid = async uuid => (uuid === doctor.uuid ? doctor : null);

    showDelegateTestPicker(patient, { kind: "healing", label: "Лечение" }); // не await — открывает диалог и висит на wait()
    await captured.press("go", fakeForm({ "#delegate-executor": doctor.uuid }));

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].flags["warhammer-dbc"].delegatedTest.targetActorUuid).toBe(patient.uuid);
  });
});
