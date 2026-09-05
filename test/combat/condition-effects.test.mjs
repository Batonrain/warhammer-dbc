// test/combat/condition-effects.test.mjs
//
// Срок Состояния, сторона документов (wdbc-uqco): эффект со штатной Duration
// заводится ВМЕСТЕ с иконкой (а не рядом со своей второй), продлевается вместо
// задвоения, истекает подметанием и зеркалит остаток в прежнее поле-счётчик.
//
// Подставной эффект повторяет форму Foundry v14: в _source лежит
// {value, units}, а effect.duration — уже ПОДГОТОВЛЕННЫЙ ядром объект с
// remaining/secondsRemaining/expired. Первая версия этих тестов проверяла
// форму v13 ({rounds, startRound, seconds, startTime}) и потому была зелёной
// на коде, который в живой игре не работал вовсе (wdbc-xjce/wdbc-8ij2) —
// стенд обязан повторять ту схему, что реально стоит на диске.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { conditionDurationEffects, conditionDurationEffect,
         hasConditionDuration, applyConditionWithDuration, clearConditionDuration,
         sweepConditionDurations, conditionRemainingLabel }
  from "../../module/combat/condition-effects.mjs";

const FLAG = "warhammer-dbc";

/**
 * Эффект, как его отдаёт Foundry v14: ядро само считает remaining по
 * source-данным. Здесь остаток задаётся тестом напрямую — считать его снова
 * означало бы проверять свою копию ядра, а не свой код.
 */
function mkEffect(owner, data) {
  const fx = {
    name: data.name, img: data.img, statuses: data.statuses ?? [],
    flags: data.flags ?? {},
    duration: { ...(data.duration ?? {}) },
    getFlag: (scope, key) => fx.flags?.[scope]?.[key],
    /** Ядро пересчитало бы remaining само; в стенде это делает тест. */
    setRemaining(remaining, secondsRemaining) {
      fx.duration.remaining = remaining;
      if (secondsRemaining !== undefined) fx.duration.secondsRemaining = secondsRemaining;
    },
    async update(patch) { Object.assign(fx, patch); },
    async delete() { owner.effects = owner.effects.filter(e => e !== fx); }
  };
  // Свежесозданный эффект ядро подготовило бы сразу: остаток равен сроку.
  if (fx.duration.value != null && fx.duration.remaining === undefined) {
    fx.duration.remaining = fx.duration.value;
  }
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

describe("applyConditionWithDuration: со сроком", () => {
  it("заводит ОДИН эффект — он же иконка, он же срок", async () => {
    const actor = makeActor();
    const ok = await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });

    expect(ok).toBe(true);
    expect(actor.effects).toHaveLength(1);
    // statuses — то, по чему Foundry рисует иконку на токене; отдельного
    // второго эффекта ради срока не заводится (см. шапку модуля).
    expect(actor.effects[0].statuses).toEqual(["stunned"]);
    expect(actor.system.conditions.stunned).toBe(true);
  });

  it("duration отдаётся ядру в ЕГО схеме — {value, units}, без своего момента начала", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });
    const { value, units } = actor.effects[0].duration;
    expect({ value, units }).toEqual({ value: 2, units: "rounds" });
    // startRound/startTime не наши — их пишет ядро в effect.start.
    expect(actor.effects[0].duration.startRound).toBeUndefined();
    expect(actor.effects[0].duration.startTime).toBeUndefined();
  });

  it("срок в минутах уходит минутами, а не переведённым в секунды", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "poisoned", { value: 10, unit: "minutes" });
    const { value, units } = actor.effects[0].duration;
    expect({ value, units }).toEqual({ value: 10, units: "minutes" });
  });

  it("счётчик-зеркало заполняется СРАЗУ, а не ждёт первого подметания", async () => {
    // Без этого игрок в момент наложения видел бы «0 раундов» до конца Хода.
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 4, unit: "rounds" });
    expect(actor.system.conditions.stunnedRounds).toBe(4);
  });

  it("время в счётчике-зеркале переводится в Раунды", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 1, unit: "minutes" });
    expect(actor.system.conditions.stunnedRounds).toBe(10);   // 60 сек / 6
  });

  it("явная СИЛА важнее зеркала — это про другое", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "bleeding", { level: 2, value: 1, unit: "hours" });
    expect(actor.system.conditions.bleedingLevel).toBe(2);
    expect(actor.effects[0].duration.units).toBe("hours");
  });

  it("повторное наложение ПРОДЛЕВАЕТ срок, а не заводит второй эффект", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 1, unit: "rounds" });
    await applyConditionWithDuration(actor, "stunned", { value: 3, unit: "rounds" });

    expect(actor.effects).toHaveLength(1);
    expect(actor.effects[0].duration).toEqual({ value: 3, units: "rounds" });
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
    const ok = await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });

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
    const actor = makeActor({ effects: [{ name: "Чужой", statuses: ["stunned"], duration: { value: 9, units: "rounds" } }] });
    expect(conditionDurationEffects(actor)).toEqual([]);
    expect(hasConditionDuration(actor, "stunned")).toBe(false);

    await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });
    expect(hasConditionDuration(actor, "stunned")).toBe(true);
    expect(conditionDurationEffect(actor, "stunned")).not.toBeNull();
  });

  it("clearConditionDuration уносит носитель срока", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });
    await clearConditionDuration(actor, "stunned");
    expect(actor.effects).toEqual([]);
  });
});

describe("sweepConditionDurations", () => {
  it("истёкший срок уносит эффект — гашение Состояния делает мост, не мы", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 2, unit: "rounds" });
    actor.effects[0].setRemaining(0);   // ядро досчитало срок до нуля

    const { expired } = await sweepConditionDurations(actor);
    expect(expired).toEqual(["stunned"]);
    expect(actor.effects).toEqual([]);
  });

  it("не истёкший срок зеркалится в прежнее поле-счётчик", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 3, unit: "rounds" });
    actor.effects[0].setRemaining(2);

    const { expired, refreshed } = await sweepConditionDurations(actor);
    expect(expired).toEqual([]);
    expect(refreshed).toEqual(["stunned"]);
    expect(actor.system.conditions.stunnedRounds).toBe(2);
  });

  it("ничего не изменилось — ничего не пишется", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 3, unit: "rounds" });
    actor.updates.length = 0;

    await sweepConditionDurations(actor);
    expect(actor.updates).toEqual([]);
  });

  it("срок в минутах меряется своими единицами, а зеркалится Раундами", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "stunned", { value: 10, unit: "minutes" });
    actor.effects[0].setRemaining(5, 300);   // осталось 5 минут = 300 сек

    const { expired } = await sweepConditionDurations(actor);
    expect(expired).toEqual([]);
    expect(actor.system.conditions.stunnedRounds).toBe(50);
  });

  it("бессрочный эффект подметание не трогает", async () => {
    const actor = makeActor({ effects: [{
      statuses: ["prone"], duration: { value: null, units: "seconds", expired: true },
      flags: { [FLAG]: { conditionDuration: "prone" } }
    }] });

    const { expired } = await sweepConditionDurations(actor);
    expect(expired).toEqual([]);
    expect(actor.effects).toHaveLength(1);
  });
});

describe("conditionRemainingLabel", () => {
  it("остаток словами, своими единицами", async () => {
    const actor = makeActor();
    await applyConditionWithDuration(actor, "poisoned", { value: 1, unit: "hours" });
    actor.effects[0].setRemaining(30);
    actor.effects[0].duration.units = "minutes";
    expect(conditionRemainingLabel(actor, "poisoned")).toBe("30 минут");
  });

  it("без срока — пусто", () => {
    expect(conditionRemainingLabel(makeActor(), "stunned")).toBe("");
  });
});
