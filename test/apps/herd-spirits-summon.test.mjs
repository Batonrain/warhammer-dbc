// test/apps/herd-spirits-summon.test.mjs
//
// module/apps/herd-spirits-summon.mjs — бюджет успехов Ритуала «Summon Herd
// Spirits / Призыв Духов Стада» (wdbc-xxb7): Минотавр(3)/Тролль(5)/
// Великан(8), лимит 3 активных партий, отзыв освобождает место.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import {
  isHerdSpiritsRitual, herdAllocationCost, herdCreatureNameCandidates,
  getHerdSpiritsBatches, addHerdSpiritsBatch, recallHerdSpiritsBatch,
  HERD_SPIRITS_RITUAL_NAME, MAX_HERD_BATCHES
} from "../../module/apps/herd-spirits-summon.mjs";

function stubActor(flags = {}) {
  const store = { "warhammer-dbc": { ...flags } };
  return {
    system: { patronGod: "" },
    flags: store,
    setFlag: async (scope, key, value) => { store[scope][key] = value; return value; }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { isGM: true };
  globalThis.game.users = { activeGM: null };
  globalThis.game.packs = new Map();
  globalThis.canvas = { scene: null, tokens: { placeables: [] } };
  globalThis.game.scenes = { current: null };
  globalThis.Actor.create = async data => ({
    ...data, name: data.name, uuid: `Actor.${data.name}`,
    getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ name: data.name, x, y }) })
  });
  globalThis.fromUuid = async uuid => {
    const [, name] = String(uuid).split("Actor.");
    return name ? { uuid, delete: async () => {} } : null;
  };
});

describe("isHerdSpiritsRitual", () => {
  it("совпадает по точному имени ритуала", () => {
    expect(isHerdSpiritsRitual({ name: HERD_SPIRITS_RITUAL_NAME })).toBe(true);
  });
  it("не совпадает с другим ритуалом", () => {
    expect(isHerdSpiritsRitual({ name: "Rite of Blood Rebirth / Ритуал Возрождения" })).toBe(false);
  });
  it("нет предмета — false", () => {
    expect(isHerdSpiritsRitual(null)).toBe(false);
  });
});

describe("herdAllocationCost", () => {
  it("считает бюджет по книжной таблице (Минотавр 3 / Тролль 5 / Великан 8)", () => {
    expect(herdAllocationCost({ minotaur: 1 })).toBe(3);
    expect(herdAllocationCost({ troll: 1 })).toBe(5);
    expect(herdAllocationCost({ giant: 1 })).toBe(8);
    expect(herdAllocationCost({ minotaur: 2, troll: 1 })).toBe(11);
  });
  it("пустой/отсутствующий набор — 0", () => {
    expect(herdAllocationCost({})).toBe(0);
  });
});

describe("herdCreatureNameCandidates", () => {
  it("без Покровителя — только базовое имя", () => {
    expect(herdCreatureNameCandidates("minotaur", "")).toEqual(["Minotaur / Минотавр"]);
  });
  it("с Покровителем — сперва вариант субрасы, потом базовое имя как запасной путь", () => {
    const names = herdCreatureNameCandidates("minotaur", "khorne");
    expect(names[0]).toContain("Кхорн");
    expect(names[1]).toBe("Minotaur / Минотавр");
  });
  it("Неделимый не считается Покровителем — только базовое имя", () => {
    expect(herdCreatureNameCandidates("troll", "undivided")).toEqual(["Troll / Тролль"]);
  });
  it("неизвестный вид существа — пустой список", () => {
    expect(herdCreatureNameCandidates("dragon", "")).toEqual([]);
  });
});

describe("партии духов стада: добавление/отзыв/лимит", () => {
  it("новый актор — пустой список партий", () => {
    expect(getHerdSpiritsBatches(stubActor())).toEqual([]);
  });

  it("addHerdSpiritsBatch добавляет партию с существами", async () => {
    const actor = stubActor();
    const batch = await addHerdSpiritsBatch(actor, [{ key: "minotaur", actorUuid: "Actor.M1", actorName: "M1" }]);
    expect(batch.creatures).toHaveLength(1);
    expect(getHerdSpiritsBatches(actor)).toHaveLength(1);
  });

  it("три партии — предел MAX_HERD_BATCHES", async () => {
    const actor = stubActor();
    for (let i = 0; i < 3; i++) await addHerdSpiritsBatch(actor, [{ key: "minotaur", actorUuid: `Actor.M${i}`, actorName: `M${i}` }]);
    expect(getHerdSpiritsBatches(actor)).toHaveLength(MAX_HERD_BATCHES);
  });

  it("recallHerdSpiritsBatch удаляет Акторов партии и снимает её из флага", async () => {
    const actor = stubActor();
    const batch = await addHerdSpiritsBatch(actor, [
      { key: "minotaur", actorUuid: "Actor.M1", actorName: "M1" },
      { key: "troll", actorUuid: "Actor.T1", actorName: "T1" }
    ]);
    const res = await recallHerdSpiritsBatch(actor, batch.id);
    expect(res.ok).toBe(true);
    expect(getHerdSpiritsBatches(actor)).toEqual([]);
  });

  it("отзыв несуществующей партии — честный ok:false, флаг не трогается", async () => {
    const actor = stubActor();
    await addHerdSpiritsBatch(actor, [{ key: "minotaur", actorUuid: "Actor.M1", actorName: "M1" }]);
    const res = await recallHerdSpiritsBatch(actor, "нет-такой-партии");
    expect(res.ok).toBe(false);
    expect(getHerdSpiritsBatches(actor)).toHaveLength(1);
  });

  it("отзыв освобождает место — после него снова можно добавить партию до предела", async () => {
    // foundry.utils.randomID() в стенде всегда возвращает одно и то же
    // значение (test/support/foundry-stub.mjs) — здесь нужны РАЗЛИЧНЫЕ id
    // партий, чтобы отзыв снял ровно одну, а не все сразу по совпадению.
    let n = 0;
    globalThis.foundry.utils.randomID = () => `batch-${n++}`;
    const actor = stubActor();
    const batches = [];
    for (let i = 0; i < 3; i++) batches.push(await addHerdSpiritsBatch(actor, [{ key: "minotaur", actorUuid: `Actor.M${i}`, actorName: `M${i}` }]));
    await recallHerdSpiritsBatch(actor, batches[0].id);
    expect(getHerdSpiritsBatches(actor)).toHaveLength(2);
    await addHerdSpiritsBatch(actor, [{ key: "giant", actorUuid: "Actor.G1", actorName: "G1" }]);
    expect(getHerdSpiritsBatches(actor)).toHaveLength(3);
  });
});
