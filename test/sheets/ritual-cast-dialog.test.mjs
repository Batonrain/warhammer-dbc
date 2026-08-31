// test/sheets/ritual-cast-dialog.test.mjs
//
// Диалог «Провести ритуал» (кнопка на строке ритуала листа персонажа,
// 29.08.2026) — та же схема теста, что у диалога Навыка (test/sheets/
// skill-roll.test.mjs): DialogV2.wait запоминается заглушкой, кнопка жмётся
// через captured.press(action, fakeForm(...)).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { showRitualCastDialog } = await import("../../module/sheets/ritual-cast-dialog.mjs");

beforeEach(() => { resetCaptured(); globalThis.game.user = {}; });

const actor = () => ({ id: "act-1", name: "Каэль Ворн", type: "character",
  system: { characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} } });

/** Предмет-ритуал: нет навыка (база −20), сложность/тип книги заданы явно. */
const item = (over = {}) => ({
  id: "r1", name: "Зов Малефика",
  system: {
    testSkillScope: "", testSkillKey: "", testChar: "int", testMod: -10,
    aversionPerFail: 5, assistMin: 0, assistMax: 4, failureType: "summon",
    ...over
  },
  getFlag: () => undefined
});

describe("диалог «Провести ритуал»", () => {
  it("открывается с заголовком по имени предмета", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.window.title).toBe("Ритуал: Зов Малефика");
  });

  it("«Провести» бросает и кладёт карточку в чат", async () => {
    const promise = showRitualCastDialog(actor(), item());
    // Нет навыка → база −20, порог всегда отрицателен — гарантированный
    // провал d100, второй кубик уходит на Отвращение Варпа (тип summon).
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Зов Малефика");
  });

  it("присутствие ассистентов без жертвы бонуса не даёт", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "2" }));
    await promise;

    expect(captured.chat[0].content).not.toContain("Жертва ассистентов");
  });

  it("принесённые в жертву ассистенты попадают в разбивку порога", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "2", "#rit-assist-sac": "2" }));
    await promise;

    expect(captured.chat[0].content).toContain("Жертва ассистентов ×2");
  });

  it("жертва клампится к числу присутствующих ассистентов", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "1", "#rit-assist-sac": "5" }));
    await promise;

    expect(captured.chat[0].content).toContain("Жертва ассистентов ×1");
  });

  it("«Отмена» не бросает и не создаёт карточку", async () => {
    const promise = showRitualCastDialog(actor(), item());
    await captured.dismiss();
    const res = await promise;

    expect(res).toBeNull();
    expect(captured.chat).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("невыполненное требование ритуалиста показано в окне", () => {
    const withReq = item({});
    withReq.getFlag = (_scope, key) => (key === "req"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqRace", raceKey: "drukhari" }] }]
      : undefined);
    showRitualCastDialog(actor(), withReq);

    expect(captured.dialog.content).toContain("Требования не выполнены");
    expect(captured.dialog.content).toContain("Раса: Друкхари");
  });

  it("модификаторы призыва видны для summon-типа и скрыты для не-summon", () => {
    showRitualCastDialog(actor(), item({ failureType: "summon" }));
    expect(captured.dialog.content).toContain("Модификаторы призыва");

    showRitualCastDialog(actor(), item({ failureType: "exorcism" }));
    expect(captured.dialog.content).not.toContain("Модификаторы призыва");
  });

  it("один путь проведения — дропдаун не показан", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.content).not.toContain("id=\"rit-path\"");
  });

  it("несколько путей (rollPaths) — дропдаун со всеми вариантами", () => {
    showRitualCastDialog(actor(), item({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Daemons",
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Heresy", char: "wp", mod: -30 }]
    }));
    expect(captured.dialog.content).toContain("id=\"rit-path\"");
    expect(captured.dialog.content).toContain("<option value=\"default\">");
    expect(captured.dialog.content).toContain("<option value=\"alt:0\">");
  });

  it("выбор альтернативного пути меняет Сложность и модификатор в брошенной карточке", async () => {
    const promise = showRitualCastDialog(actor(), item({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Daemons", testMod: -10,
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Heresy", char: "wp", mod: -30 }]
    }));
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-path": "alt:0", "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat[0].content).toContain("-30");
  });

  it("модификаторы ритуала (extraMods) показаны пилюлями и отмеченный уходит в порог", async () => {
    const promise = showRitualCastDialog(actor(), item({
      extraMods: [{ label: "С всадником", value: -20 }, { label: "Ассистент в жертву", value: 10 }]
    }));
    expect(captured.dialog.content).toContain("Модификаторы ритуала");
    expect(captured.dialog.content).toContain("С всадником");

    captured.dice = [50, 50];
    await captured.press("cast", fakeForm(
      { "#rit-assistants": "0" },
      { "[data-extra]": [{ dataset: { extra: "1" }, checked: true }] }
    ));
    await promise;

    expect(captured.chat[0].content).toContain("Модификаторы ритуала: +10");
  });

  it("нет extraMods — блок «Модификаторы ритуала» не показан", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.content).not.toContain("Модификаторы ритуала");
  });

  // Бестиарий скрыт от игрока (ownership.PLAYER:"NONE") — блок «Демон» вписывается
  // вручную (имя+Inf), появляется только у summon-like типов (isSummonLike).
  it("блок «Демон» виден для summon-like типа и скрыт для не-summon-like", () => {
    showRitualCastDialog(actor(), item({ failureType: "summon" }));
    expect(captured.dialog.content).toContain("id=\"rit-demon-name\"");

    showRitualCastDialog(actor(), item({ failureType: "exorcism" }));
    expect(captured.dialog.content).not.toContain("id=\"rit-demon-name\"");
  });

  it("вписанный Inf демона уходит штрафом в порог и подпись демона в карточку", async () => {
    const promise = showRitualCastDialog(actor(), item({ failureType: "summon", testMod: 100 }));
    captured.dice = [1];
    await captured.press("cast", fakeForm({
      "#rit-assistants": "0", "#rit-demon-name": "Кровожад", "#rit-demon-inf": "45"
    }));
    await promise;

    expect(captured.chat[0].content).toContain("Кровожад");
    expect(captured.chat[0].content).toContain("−Inf");
  });

  it("не summon-like тип — блока «Демон» нет и подписи демона в карточке не будет", async () => {
    const promise = showRitualCastDialog(actor(), item({ failureType: "exorcism", testMod: 50 }));
    captured.dice = [1];
    await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat[0].content).not.toContain("Демон:");
  });
});
