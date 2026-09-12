// test/combat/devourer-of-time.test.mjs
//
// Devourer of Time / Пожиратель Времени (wdbc-1rno, Тзинч): чистая логика —
// инициатива «в конец порядка», распознавание доп. Хода находки, список
// накопленных жертв. Списание ОД на жертвах (hooks.mjs::updateCombat) не
// покрыто отдельным тестом — та же граница, что у остальных находок с
// kind:"script" (Пожиратель Знаний, Поцелуй Смерти): Foundry-склейка
// (fromUuid/actor.update) в hooks.mjs тестами не покрывается, только чистые
// модули.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  endOfOrderInitiative, isDevourerOfTimeExtraTurn, devourerOfTimeVictimUuids,
  mergedVictimUuids, DEVOURER_OF_TIME_SOURCE
} from "../../module/combat/devourer-of-time.mjs";

describe("endOfOrderInitiative", () => {
  it("минимум текущих инициатив минус 1", () => {
    expect(endOfOrderInitiative([{ initiative: 40 }, { initiative: 15 }, { initiative: 62 }])).toBe(14);
  });

  it("игнорирует ещё не брошенные (null/не число) инициативы", () => {
    expect(endOfOrderInitiative([{ initiative: 40 }, { initiative: null }, { initiative: 15 }])).toBe(14);
  });

  it("совсем без числовых инициатив — минус 1", () => {
    expect(endOfOrderInitiative([{ initiative: null }])).toBe(-1);
    expect(endOfOrderInitiative([])).toBe(-1);
  });

  it("принимает Foundry-подобную Collection (есть только итератор, не Array)", () => {
    const collection = new Map([["a", { initiative: 30 }], ["b", { initiative: 10 }]]).values();
    expect(endOfOrderInitiative(collection)).toBe(9);
  });
});

describe("isDevourerOfTimeExtraTurn", () => {
  it("да — доп. Combatant с меткой этой находки", () => {
    const combatant = { getFlag: (ns, key) => (key === "extraTurnSource" ? DEVOURER_OF_TIME_SOURCE : undefined) };
    expect(isDevourerOfTimeExtraTurn(combatant)).toBe(true);
  });

  it("нет — обычный Combatant без метки", () => {
    expect(isDevourerOfTimeExtraTurn({ getFlag: () => undefined })).toBe(false);
  });

  it("нет — доп. Combatant ДРУГОЙ находки (Last Actor)", () => {
    const combatant = { getFlag: (ns, key) => (key === "extraTurnSource" ? "lastActor" : undefined) };
    expect(isDevourerOfTimeExtraTurn(combatant)).toBe(false);
  });
});

describe("devourerOfTimeVictimUuids", () => {
  it("без флага — пустой список", () => {
    expect(devourerOfTimeVictimUuids({ getFlag: () => undefined })).toEqual([]);
  });

  it("отдаёт записанный список как есть", () => {
    const actor = { getFlag: () => ["Actor.a", "Actor.b"] };
    expect(devourerOfTimeVictimUuids(actor)).toEqual(["Actor.a", "Actor.b"]);
  });
});

describe("mergedVictimUuids", () => {
  it("объединяет без повторов", () => {
    expect(mergedVictimUuids(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("пустой/отсутствующий существующий список — просто новые", () => {
    expect(mergedVictimUuids(null, ["a"])).toEqual(["a"]);
    expect(mergedVictimUuids(undefined, ["a"])).toEqual(["a"]);
  });

  it("пустые новые — существующий список без изменений", () => {
    expect(mergedVictimUuids(["a"], [])).toEqual(["a"]);
  });
});
