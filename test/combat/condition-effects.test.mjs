// test/combat/condition-effects.test.mjs
//
// Срок Состояния, сторона документов (wdbc-uqco): эффект со штатной Duration
// заводится ВМЕСТЕ с иконкой (а не рядом со своей второй), продлевается вместо
// задвоения, истекает подметанием и зеркалит остаток в прежнее поле-счётчик.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { nowSnapshot, conditionDurationEffects, conditionDurationEffect,
         hasConditionDuration, applyConditionWithDuration, clearConditionDuration,
         sweepConditionDurations, conditionRemainingLabel }
  from "../../module/combat/condition-effects.mjs";

const FLAG = "warhammer-dbc";

function mkEffect(owner, data) {
  const fx = {
    name: data.name, img: data.img, statuses: data.statuses ?? [],
    duration: data.duration ?? {}, flags: data.flags ?? {},
    getFlag: (scope, key) => fx.flags?.[scope]?.[key],
    async update(patch) { Object.assign(fx, patch); },
    async delete() { owner.effects = owner.effects.filter(e => e !== fx); }
  };
  return fx;
}

/** Актор ровно с тем, что трогает этот модуль. */
function makeActor({ conditions = {}, items = [], effects = [] } = {}) {
  const actor = {
    name: "Подставной", items, updates: [],
    system: { conditions: { ...conditions } },
    effects: [],
    async createEmbeddedDocuments(_type, docs) {
      const made = docs.map(d => mkEffect(actor, d));
      actor.effects.push(...made);
      return made;
    },
    async update(data) {
      actor.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = actor;
        for (const p of parts.slice(0, -1)) { t[p] ??= {}; t = t[p]; }
        t[parts.at(-1)] = value;
      }
    }
  };
  actor.effects = effects.map(e => mkEffect(actor, e));
  return actor;
}

/** Предмет с записью «Иммунитет» — тот же приём, что в conditions-immunity.test.mjs. */
const immunityItem = (condKey) => ({
  name: "Оберег",
  flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "condition", condKey, condMode: "immunity" }
  ] }] } }
});

beforeEach(() => {
  globalThis.game.combat = { id: "c1", round: 3, turn: 0 };
  globalThis.game.time = { worldTime: 1000 };
});

describe("nowSnapshot", () => {
  it("берёт Раунд из боя, а время из мира", () => {
    expect(nowSnapshot()).toEqual({ round: 3, turn: 0, combatId: "c1", worldTime: 1000 });
  });

  it("без боя Раунд ноль, а время всё равно идёт", () => {
    globalThis.game.combat = null;
    expect(nowSnapshot()).toEqual({ round: 0, turn: 0, combatId: null, worldTime: 1000 });
  });
});

describe("applyConditionWithDuration: со сроком", () => {
  it("заводит ОДИН эффект — он же иконка, он же срок", async () => {
    const actor = makeActor();
    const ok = await applyConditionWithDuration(actor, "stunned", { level: 2, value: 2, unit: "rounds" });

    expect(ok).toBe(true);
    expect(actor.effects).toHaveLength(1);
    // statuses — то, по чему Foundry рисует иконку на токене; отдельного
    // второго эффекта ради срока не заводится (см. шапку модуля).
    expect(actor.effects[0].statuses).toEqual(["stunned"]);
    expect(actor.effects[0].duration).toEqual({
      rounds: 2, turns: null, combat: "c1", startRound: 3, startTurn: 0
    });
    expect(actor.system.conditions.stunned).toBe(true);
    expect(actor.system.conditions.stunnedRounds).toBe(2);
  });

  it("счётчик-зеркало заполняется СРАЗУ, а не ждёт первого подметания", async () => {
    // Без этого игрок в момент наложения видел бы «0 раундов» до конца Хода.
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 4, unit: "rounds" });
    expect(actor.system.conditions.stunnedRounds).toBe(4);
  });

  it("явная СИЛА важнее зеркала — это про другое", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "bleeding", { level: 2, value: 1, unit: "hours" });
    expect(actor.system.conditions.bleedingLevel).toBe(2);
    expect(actor.effects[0].duration.seconds).toBe(3600);
  });

  it("срок в минутах привязывается к времени мира, а не к бою", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "poisoned", { value: 1, unit: "minutes" });
    expect(actor.effects[0].duration).toEqual({ seconds: 60, startTime: 1000 });
  });

  it("повторное наложение ПРОДЛЕВАЕТ срок, а не заводит второй эффект", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { level: 1, value: 1, unit: "rounds" });
    globalThis.game.combat.round = 5;
    await applyConditionWithDuration(actor, "stunned", { level: 3, value: 3, unit: "rounds" });

    expect(actor.effects).toHaveLength(1);
    expect(actor.effects[0].duration.startRound).toBe(5);
    expect(actor.effects[0].duration.rounds).toBe(3);
  });
});

describe("applyConditionWithDuration: без срока и с иммунитетом", () => {
  it("без срока эффект не заводится вовсе — всё как раньше, через лист", async () => {
    const actor = makeActor();
    const ok = await applyConditionWithDuration(actor, "prone", {});
    expect(ok).toBe(true);
    expect(actor.effects).toEqual([]);
    expect(actor.system.conditions.prone).toBe(true);
  });

  it("иммунитет гасит и Состояние, и эффект — иконки без Состояния не бывает", async () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    const ok = await applyConditionWithDuration(actor, "stunned", { level: 2, value: 2, unit: "rounds" });

    expect(ok).toBe(false);
    expect(actor.effects).toEqual([]);
    expect(actor.updates).toEqual([]);
  });

  it("неизвестное Состояние ничего не делает", async () => {
    const actor = makeActor();
    expect(await applyConditionWithDuration(actor, "нетТакого", { value: 2, unit: "rounds" })).toBe(false);
  });
});

describe("поиск срока", () => {
  it("находит свой эффект и не путается в чужих", async () => {
    const actor = makeActor({ effects: [{ name: "Чужой", statuses: ["stunned"], duration: { rounds: 9 } }] });
    expect(conditionDurationEffects(actor)).toEqual([]);
    expect(hasConditionDuration(actor, "stunned")).toBe(false);

    await applyConditionWithDuration(actor, "stunned", { level: 2, value: 2, unit: "rounds" });
    expect(hasConditionDuration(actor, "stunned")).toBe(true);
    expect(conditionDurationEffect(actor, "stunned")).not.toBeNull();
  });

  it("clearConditionDuration уносит носитель срока", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { level: 2, value: 2, unit: "rounds" });
    await clearConditionDuration(actor, "stunned");
    expect(actor.effects).toEqual([]);
  });
});

describe("sweepConditionDurations", () => {
  it("истёкший срок уносит эффект — гашение Состояния делает мост, не мы", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { level: 2, value: 2, unit: "rounds" });
    globalThis.game.combat.round = 5;   // 3 + 2 = истёк

    const { expired } = await sweepConditionDurations(actor);
    expect(expired).toEqual(["stunned"]);
    expect(actor.effects).toEqual([]);
  });

  it("не истёкший срок зеркалится в прежнее поле-счётчик", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { level: 3, value: 3, unit: "rounds" });
    globalThis.game.combat.round = 4;   // остался 2

    const { expired, refreshed } = await sweepConditionDurations(actor);
    expect(expired).toEqual([]);
    expect(refreshed).toEqual(["stunned"]);
    expect(actor.system.conditions.stunnedRounds).toBe(2);
  });

  it("ничего не изменилось — ничего не пишется", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { level: 3, value: 3, unit: "rounds" });
    actor.updates.length = 0;

    await sweepConditionDurations(actor);
    expect(actor.updates).toEqual([]);
  });

  it("срок в минутах доживает до своего worldTime, а не до конца боя", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "poisoned", { value: 1, unit: "minutes" });

    globalThis.game.combat.round = 99;
    expect((await sweepConditionDurations(actor)).expired).toEqual([]);

    globalThis.game.time.worldTime = 1060;
    expect((await sweepConditionDurations(actor)).expired).toEqual(["poisoned"]);
  });
});

describe("conditionRemainingLabel", () => {
  it("остаток словами, своими единицами", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "poisoned", { value: 1, unit: "hours" });
    globalThis.game.time.worldTime = 1000 + 1800;
    expect(conditionRemainingLabel(actor, "poisoned")).toBe("30 минут");
  });

  it("без срока — пусто", () => {
    expect(conditionRemainingLabel(makeActor(), "stunned")).toBe("");
  });
});
