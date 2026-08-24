// test/combat/mount-roll.test.mjs
//
// Раскатка «Вида теста» на Верховую езду (см. память doombc-test-kind-rollout):
// Поворот/Ландшафт/Ремонт байка — полный набор через старый Dialog V1; Занос/
// Седло — новый DialogV2 (диалога не было вовсе); Уклонение верхом — только
// Крит, встречная+комбинированная механика не тронута. Фикстуры beast/rider —
// тот же приём, что в test/rules/mount.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml, fakeForm } from "../support/foundry-stub.mjs";
import {
  showTurnDialog, showSkidDialog, showMountTerrainDialog, saddleTest,
  showBikeRepairDialog, showMountedDodgeDialog
} from "../../module/combat/mount.mjs";

const beast = ({ items = [], size = 1, spd = 8, wounds = 14 } = {}) => ({
  type: "character", uuid: "Actor.beast", items, name: "Скакун",
  system: {
    size, initiative: 3,
    movement: { halfMove: spd },
    wounds: { value: wounds, max: wounds, critical: 0 }
  }
});

const bikeMount = ({ items = [], structure = 6, critical = 0 } = {}) => ({
  type: "vehicle", uuid: "Actor.bike", items, name: "Байк",
  system: {
    size: 1, initiative: 0, chassis: { type: "wheeled", spd: 8 },
    structure: { value: structure, max: 6, critical }
  }
});

const rider = ({ ag = 40, per = 30, survival = "trained", items = [], speed = "half", mountUuid = "Actor.beast" } = {}) => ({
  type: "character", uuid: "Actor.rider", items, name: "Всадник",
  system: {
    size: 0, initiative: 5,
    characteristics: { ag: { total: ag } },
    skills: { survival: { rank: survival, total: per - 20 } },
    groupSkills: { operate: [] },
    mount: { uuid: mountUuid, role: "rider", speed }
  },
  getFlag: () => undefined,
  setFlag: async () => {},
  update: async () => {}
});

const realFromUuid = globalThis.fromUuid;
const resolveMountAs = doc => { globalThis.fromUuid = async () => doc; };

/**
 * `mountContext` идёт через `await mountOf(rider)` → `await fromUuid(...)` —
 * два уровня промисов до того, как диалог вообще откроется и `captured.dialog`
 * станет доступен. Макротик (setTimeout 0) гарантированно дожидается очереди
 * микрозадач, в отличие от одного `await Promise.resolve()`.
 */
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuid = realFromUuid; });

describe("Поворот: полный Вид теста через старый Dialog", () => {
  it("Сложность и Крит доходят до карточки", async () => {
    resolveMountAs(beast());
    const r = rider({ speed: "half" }); // half → 180° (idx 1) требует теста
    showTurnDialog(r);
    await flush();
    expect(captured.dialog).toBeTruthy();

    captured.nextRoll = 4; // натуральный крит-успех
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#mt-angle": "1", "#mt-mod": "0", "#test-difficulty": "-10" }));

    expect(captured.chat[0].content).toContain("Критический Успех");
    expect(captured.chat[0].content).toContain("Сложность");
  });

  it("Кубик (Помеха) катает дважды и берёт худший", async () => {
    resolveMountAs(beast());
    const r = rider({ speed: "half" });
    showTurnDialog(r);
    await flush();

    captured.dice = [20, 80];
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#mt-angle": "1", "#mt-mod": "0", ".dice-mode-opt:checked": "disadvantage"
    }));

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Помеха: отброшено 20");
  });
});

describe("Занос: новый DialogV2 там, где диалога не было", () => {
  it("диалог открывается и предлагает Вид теста/Кубик", async () => {
    resolveMountAs(beast());
    const r = rider({ speed: "charge" }); // MOUNT_SKID.afterSpeeds
    const promise = showSkidDialog(r);
    await flush();
    expect(captured.dialog).toBeTruthy();
    expect(captured.dialog.content).toContain("test-kind");
    expect(captured.dialog.content).toContain("dice-mode-opt");

    captured.nextRoll = 30;
    await captured.press("roll", fakeForm());
    await promise;
    expect(captured.chat[0].content).toContain("Занос");
  });
});

describe("Удержаться в седле: новый DialogV2", () => {
  it("Комбинированный: итоговый Порог — наименьший из двух", async () => {
    resolveMountAs(beast());
    const r = rider();
    const promise = saddleTest(r, { kind: "agility", mod: 0, reason: "проверка" });
    await flush();
    expect(captured.dialog).toBeTruthy();

    captured.nextRoll = 25;
    await captured.press("roll", fakeForm({
      "#test-kind": "combined", "#combined-char-select": "ag", "#combined-target": "20"
    }));
    await promise;

    expect(captured.chat[0].content).toContain("Комбинированный");
    expect(captured.chat[0].content).toContain("Выпадает из седла");
  });
});

describe("Ремонт байка: полный Вид теста через старый Dialog", () => {
  it("Расширенный: банк пишется во флаг байка", async () => {
    const bk = bikeMount();
    bk.getFlag = () => undefined;
    const flags = {};
    bk.getFlag = (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]);
    bk.setFlag = async (scope, key, value) => {
      flags[scope] ??= {};
      const parts = key.split(".");
      let node = flags[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    };
    bk.update = async () => {};

    showBikeRepairDialog(bk);
    expect(captured.dialog).toBeTruthy();

    captured.nextRoll = 10;
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#br-skill": "50", "#br-parts": "0", "#br-mod": "0",
      "#test-kind": "extended", "#extended-label": "Ремонт", "#extended-goal": "10"
    }));

    expect(captured.chat[0].content).toContain("Расширенный");
    expect(bk.getFlag("warhammer-dbc", "extendedTests.ремонт").accumulated).toBeGreaterThan(0);
  });
});

describe("Уклонение верхом: не трогаем встречную механику, только Крит", () => {
  it("диалог НЕ предлагает Вид теста/Кубик", async () => {
    resolveMountAs(beast());
    const r = rider();
    const promise = showMountedDodgeDialog(r, 0, null);
    await flush();
    expect(captured.dialog).toBeTruthy();
    expect(captured.dialog.content).not.toContain("test-kind");
    expect(captured.dialog.content).not.toContain("dice-mode-opt");

    captured.nextRoll = 3; // крит на броске Уклонения
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#md-target": "rider" }));
    await promise;

    expect(captured.chat[0].content).toContain("Критический Успех");
  });
});
