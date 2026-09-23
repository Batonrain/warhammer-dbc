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
  mergedVictimUuids, DEVOURER_OF_TIME_SOURCE,
  apAfterDevourerDebt, processDevourerOfTimeExtraTurn, processDevourerOfTimeRoundChange,
  clearDevourerOfTimeAtCombatEnd, DEVOURER_OF_TIME_AP_DEBT_FLAG, DEVOURER_OF_TIME_USED_ROUND_FLAG
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

// wdbc-xzfp — три беды одного Дара.
// (1) Полудействие жертв списывалось в момент доп. Хода чемпиона — жертвы к
//     тому моменту уже потратили ОД (а застигнутые Врасплох и вовсе пропускают
//     первый Раунд), списание уходило в пустоту. Теперь — долг на следующий Ход.
// (2) Список жертв переживал бой.
// (3) Книга: «свой ПЕРВЫЙ Ход в бою два раза» — доп. Ход был до конца боя.
describe("Пожиратель Времени: долг ОД, один доп. Ход, уборка (wdbc-xzfp)", () => {
  const flagged = (uuid, init = {}) => {
    const flags = { ...init };
    return { uuid, id: uuid, type: "character", flags,
      getFlag: (_s, k) => flags[k],
      setFlag: async (_s, k, v) => { flags[k] = v; },
      unsetFlag: async (_s, k) => { delete flags[k]; } };
  };

  it("долг вычитается из ОД следующего Хода, но не ниже нуля", () => {
    expect(apAfterDevourerDebt(2, 1)).toBe(1);
    expect(apAfterDevourerDebt(0, 1)).toBe(0);
    expect(apAfterDevourerDebt(2, undefined)).toBe(2);
  });

  it("доп. Ход чемпиона записывает жертвам долг 1 ОД и отмечает Раунд", async () => {
    const victim = flagged("Actor.v");
    const champ = flagged("Actor.c", { devourerOfTimeVictims: ["Actor.v"] });
    const realFromUuid = globalThis.fromUuid;
    globalThis.fromUuid = async uuid => (uuid === "Actor.v" ? victim : null);
    try {
      await processDevourerOfTimeExtraTurn({ round: 1 }, { actor: champ });
    } finally { globalThis.fromUuid = realFromUuid; }
    expect(victim.flags[DEVOURER_OF_TIME_AP_DEBT_FLAG]).toBe(1);
    expect(champ.flags[DEVOURER_OF_TIME_USED_ROUND_FLAG]).toBe(1);
  });

  it("со сменой Раунда использованный доп. Ход снимается, неиспользованный — нет", async () => {
    const deleted = [];
    const champUsed = flagged("Actor.c1", { [DEVOURER_OF_TIME_USED_ROUND_FLAG]: 1 });
    const champFresh = flagged("Actor.c2");
    const extra = (actor, id) => ({ id, actorId: actor.id, actor,
      getFlag: (_s, k) => (k === "extraTurnSource" ? "devourerOfTime" : undefined) });
    const combat = { round: 2, combatants: [extra(champUsed, "x1"), extra(champFresh, "x2")],
      deleteEmbeddedDocuments: async (_t, ids) => { deleted.push(...ids); } };
    await processDevourerOfTimeRoundChange(combat);
    expect(deleted).toEqual(["x1"]);
  });

  it("конец боя снимает список жертв, метку Раунда и неиспользованный долг", async () => {
    const champ = flagged("Actor.c", { devourerOfTimeVictims: ["Actor.v"], [DEVOURER_OF_TIME_USED_ROUND_FLAG]: 1 });
    const victim = flagged("Actor.v", { [DEVOURER_OF_TIME_AP_DEBT_FLAG]: 1 });
    await clearDevourerOfTimeAtCombatEnd({ combatants: [{ actor: champ }, { actor: victim }] });
    expect(champ.flags).toEqual({});
    expect(victim.flags).toEqual({});
  });
});

describe("resetActionEconomy гасит долг Пожирателя Времени (wdbc-xzfp)", () => {
  it("жертва с долгом 1 начинает Ход с ОД на 1 меньше, долг снят тем же update", async () => {
    const { resetActionEconomy } = await import("../../module/combat/action-economy.mjs");
    const flags = { [DEVOURER_OF_TIME_AP_DEBT_FLAG]: 1 };
    const updates = [];
    const victim = {
      type: "character", flags: { "warhammer-dbc": flags },
      system: { actionPoints: { value: 0, max: 2 }, reactions: { value: 0, max: 1 }, conditions: {} },
      getFlag: (_s, k) => flags[k],
      update: async u => { updates.push(u); }
    };
    await resetActionEconomy(victim);
    expect(updates[0]["system.actionPoints.value"]).toBe(1);
    expect(updates[0][`flags.warhammer-dbc.-=${DEVOURER_OF_TIME_AP_DEBT_FLAG}`]).toBe(null);
  });
});
