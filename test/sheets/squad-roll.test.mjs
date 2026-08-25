// test/sheets/squad-roll.test.mjs
//
// Раскатка «Вида теста» на Команды/Брифинг/Приказ/Героический Конец Отряда
// (см. память doombc-test-kind-rollout). Фикстуры squadActor/sheetLike/pers —
// тот же приём, что в test/sheets/squad-v2.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { WarhammerSquadSheet } from "../../module/sheets/squad-sheet.mjs";

function squadActor(over = {}) {
  const flags = {};
  return {
    name: "Копьё Императора", uuid: "Actor.sq1", isOwner: true, img: "sq.png",
    system: {
      posts: {}, members: [], risk: 1,
      cohesion: { value: 0, base: 0, start: 0 },
      derived: { cohesion: 0 },
      ...over
    },
    update: async () => {},
    getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
    setFlag: async (scope, key, value) => {
      flags[scope] ??= {};
      const parts = key.split(".");
      let node = flags[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    }
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerSquadSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "roster" } }, extra);
}

function pers(name, over = {}) {
  return {
    name, img: `${name}.png`, type: "character",
    system: {
      characteristics: { fel: { total: 45, bonus: 4 }, wp: { total: 40 }, int: { total: 38 }, per: { bonus: 3 } },
      skills: { command: { total: 50 }, logic: { total: 40 } },
      wounds: { value: 8, max: 12 },
      ...over
    }
  };
}

const realFromUuidSync = globalThis.fromUuidSync;
const resolveAs = map => { globalThis.fromUuidSync = uuid => map[uuid] ?? null; };

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuidSync = realFromUuidSync; });

describe("_executeCommand: Вид теста/Сложность/Кубик", () => {
  it("Базовый: без tk работает как раньше — Успех/Провал от threshold", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    captured.nextRoll = 30;
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50);

    expect(captured.chat[0].content).toContain("Порог <b>50</b>");
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("Сложность уже сложена в threshold — просто доходит до Порога", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    captured.nextRoll = 45;
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 40,
      {}, { kind: "base", difficulty: 0 });

    expect(captured.chat[0].content).toContain("Провал");
  });

  it("Комбинированный: Порог — наименьший из двух", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    captured.nextRoll = 25;
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50,
      {}, { kind: "combined", difficulty: 0, combined: { charKey: "ag", target: 20 } });

    // 25 <= 50 (был бы успех), но 25 > 20 (итоговый минимум) → провал.
    expect(captured.chat[0].content).toContain("Провал");
    expect(captured.chat[0].content).toContain("Комбинированный");
  });

  it("Кубик: Преимущество даёт два броска и берёт меньший", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    captured.dice = [80, 20];
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50,
      {}, { kind: "base", difficulty: 0, reroll: { rolls: 2, mode: "keepBest", label: "Преимущество" } });

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Бросок: <b>20</b>");
    expect(captured.chat[0].content).toContain("Преимущество: отброшено 80");
  });

  it("Критический Успех/Провал видны в карточке", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    captured.nextRoll = 3;
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50);

    expect(captured.chat[0].content).toContain("Критический Успех");
  });
});

describe("_briefingRoll: своя математика не тронута, Сложность/Кубик/Крит поверх", () => {
  it("Диалог открывается и учитывает выбранную Сложность", async () => {
    resolveAs({ "Actor.a": pers("Крейн") });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.a" } } });
    const sheet = sheetLike(actor);
    const promise = sheet._briefingRoll();
    expect(captured.dialog).toBeTruthy();

    captured.nextRoll = 10;
    // Command(I)-10 и Logic(I)-10 по умолчанию: intTotal 38, cmdRank 50-45=5,
    // logRank 40-38=2 → cmdTarget 33, logTarget 30 (как их предзаполняет сам
    // диалог — тест не трогает эти поля, только Сложность).
    await captured.press("roll", fakeForm({
      "#sq-b1": "33", "#sq-b2": "30", "#sq-mod": "0", "#test-difficulty": "-50"
    }));
    await promise;

    expect(captured.chat[0].content).toContain("Сложность -50");
  });
});
