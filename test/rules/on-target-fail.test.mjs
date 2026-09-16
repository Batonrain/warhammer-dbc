// test/rules/on-target-fail.test.mjs
//
// wdbc-tqfj: kind:"condition" condMode:"onTargetFail" — «Состояние цели
// делегированного теста Сопротивления при провале» (Choir of Poxes: «...и
// Оглушение до начала своего Хода»). applyOnTargetFailConditions читает
// Mechanics предмета-источника ЖИВЬЁМ (fromUuid), а не из кэша payload —
// поэтому здесь мокается fromUuid, не сам предмет передаётся напрямую.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyOnTargetFailConditions } from "../../module/rules/on-target-fail.mjs";

const FLAG = "warhammer-dbc";

/** Тот же минимальный актор, что в test/combat/condition-effects.test.mjs. */
function mkEffect(owner, data) {
  const fx = {
    name: data.name, statuses: data.statuses ?? [], flags: data.flags ?? {},
    duration: { ...(data.duration ?? {}) },
    getFlag: (scope, key) => fx.flags?.[scope]?.[key],
    updateDuration() { return fx.duration; },
    async update(patch) { Object.assign(fx, patch); },
    async delete() { owner.effects = owner.effects.filter(e => e !== fx); }
  };
  if (fx.duration.value != null && fx.duration.remaining === undefined) {
    fx.duration.remaining = fx.duration.value;
  }
  return fx;
}
function makeActor({ conditions = {}, items = [] } = {}) {
  const actor = {
    name: "Цель", items, updates: [],
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
  return actor;
}

/** Предмет-источник (психосила) с записями kind:"condition". */
function powerItem(uuid, entries, { casterActor = null } = {}) {
  return {
    uuid, actor: casterActor,
    flags: { [FLAG]: { mechanics: [{ id: "g1", operator: "AND", entries }] } }
  };
}
const onTargetFailEntry = (over = {}) =>
  ({ id: "e1", kind: "condition", condMode: "onTargetFail", condKey: "stunned", condLevel: "1", ...over });

beforeEach(() => {
  globalThis.game.combat = { id: "c1", round: 3, turn: 0 };
  globalThis.game.time = { worldTime: 1000 };
});

describe("applyOnTargetFailConditions (wdbc-tqfj)", () => {
  const realFromUuid = globalThis.fromUuid;
  afterEach(() => { globalThis.fromUuid = realFromUuid; });

  it("без itemUuid — пусто, fromUuid не зовётся вовсе", async () => {
    let called = false;
    globalThis.fromUuid = async () => { called = true; return null; };
    const target = makeActor();
    expect(await applyOnTargetFailConditions("", target)).toEqual([]);
    expect(called).toBe(false);
  });

  it("без effectTargetActor — пусто", async () => {
    expect(await applyOnTargetFailConditions("Item.x", null)).toEqual([]);
  });

  it("предмет не найден (fromUuid → null) — пусто, не бросает", async () => {
    globalThis.fromUuid = async () => null;
    const target = makeActor();
    expect(await applyOnTargetFailConditions("Item.missing", target)).toEqual([]);
  });

  it("предмет найден, но нет ни одной onTargetFail-записи — пусто (обычный genericTest-предмет)", async () => {
    const item = powerItem("Item.plain", [{ id: "e1", kind: "condition", condMode: "apply", condKey: "stunned" }]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();
    expect(await applyOnTargetFailConditions("Item.plain", target)).toEqual([]);
  });

  it("запись onTargetFail — накладывает Состояние на effectTargetActor, возвращает applied:true", async () => {
    const item = powerItem("Item.choir", [onTargetFailEntry()]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();

    const result = await applyOnTargetFailConditions("Item.choir", target);

    expect(result).toEqual([{ label: "Оглушение", applied: true }]);
    expect(target.system.conditions.stunned).toBe(true);
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0].duration.units).toBe("rounds");
  });

  it("иммунитет цели (kind:\"condition\" condMode:\"immunity\" на её же предмете) — applied:false, но запись ВИДНА, не молчит", async () => {
    const item = powerItem("Item.choir", [onTargetFailEntry()]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const immunityItem = { name: "Оберег", flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND",
      entries: [{ id: "e", kind: "condition", condKey: "stunned", condMode: "immunity" }] }] } } };
    const target = makeActor({ items: [immunityItem] });

    const result = await applyOnTargetFailConditions("Item.choir", target);

    expect(result).toEqual([{ label: "Оглушение", applied: false }]);
    expect(target.effects).toHaveLength(0);
  });

  it("ИЛИ-ветка не просматривается — тот же обход, что у Смягчения/Наложения (item-rules.mjs)", async () => {
    const item = powerItem("Item.choir", [{
      id: "g2", kind: "group",
      group: { id: "g2", operator: "OR", entries: [onTargetFailEntry()] }
    }]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();

    expect(await applyOnTargetFailConditions("Item.choir", target)).toEqual([]);
  });

  it("И-ветка (вложенная группа) просматривается", async () => {
    const item = powerItem("Item.choir", [{
      id: "g2", kind: "group",
      group: { id: "g2", operator: "AND", entries: [onTargetFailEntry()] }
    }]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();

    const result = await applyOnTargetFailConditions("Item.choir", target);
    expect(result).toEqual([{ label: "Оглушение", applied: true }]);
  });

  it("condLevel — формула mech-formula.mjs от АКТОРА-ВЛАДЕЛЬЦА предмета (кастера), не от цели", async () => {
    const caster = { system: { characteristics: {}, psyker: { rating: 3 } } }; // pr=3
    const item = powerItem("Item.choir", [onTargetFailEntry({ condLevel: "PR-1" })], { casterActor: caster });
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();

    await applyOnTargetFailConditions("Item.choir", target);
    // stunned — counter:"rounds": conditionEntryTerm читает condLevel КАК срок
    // (см. rules/condition-duration.mjs) — PR-1=2 раунда, не 1 по умолчанию.
    expect(target.effects[0].duration.value).toBe(2);
  });

  it("неизвестный condKey в записи — пропускается молча, не бросает", async () => {
    const item = powerItem("Item.choir", [onTargetFailEntry({ condKey: "совсем-не-такое-состояние" })]);
    globalThis.fromUuid = async u => (u === item.uuid ? item : null);
    const target = makeActor();

    expect(await applyOnTargetFailConditions("Item.choir", target)).toEqual([]);
  });
});
