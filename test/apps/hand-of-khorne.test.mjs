// test/apps/hand-of-khorne.test.mjs
//
// Дар «Длань Кхорна» (wdbc-1rno): выбор руки пишет флаг на сам Дар и +8 AP
// записью kind:"armour" — тот же приём, что у Hand of Death (setApEntry).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { chooseHandOfKhorneHand } from "../../module/apps/hand-of-khorne.mjs";
import { HAND_FLAG } from "../../module/rules/hand-of-khorne.mjs";

function fakeEffect(data) {
  return {
    id: data.flags?.["warhammer-dbc"]?.mechEntry ?? Math.random().toString(36),
    name: data.name, system: data.system, flags: data.flags, disabled: false,
    getFlag: (ns, key) => data.flags?.[ns]?.[key]
  };
}

function fakeItem({ id = "gift1", name = "Hand of Khorne / Длань Кхорна", flags = {} } = {}) {
  const store = { ...flags };
  const item = {
    id, type: "mutation", name,
    effects: [],
    getFlag: (ns, key) => store[key],
    setFlag: async (ns, key, value) => { store[key] = value; item.flags = { [ns]: { ...store } }; return item; },
    createEmbeddedDocuments: async (docType, docs) => { item.effects.push(...docs.map(d => fakeEffect(d))); return item.effects; },
    deleteEmbeddedDocuments: async (docType, ids) => { item.effects = item.effects.filter(e => !ids.includes(e.id)); return ids; },
    flags: { "warhammer-dbc": { ...flags } }
  };
  return item;
}

beforeEach(() => {});

describe("chooseHandOfKhorneHand", () => {
  it("пишет выбранную руку флагом на Дар", async () => {
    const gift = fakeItem();
    await chooseHandOfKhorneHand(gift, "right");
    expect(gift.getFlag("warhammer-dbc", HAND_FLAG)).toBe("right");
  });

  it("заводит запись kind:armour с +8 AP выбранной руке (rightArm)", async () => {
    const gift = fakeItem();
    await chooseHandOfKhorneHand(gift, "right");
    const groups = gift.getFlag("warhammer-dbc", "mechanics");
    const entry = groups.flatMap(g => g.entries).find(e => e.id === "hand-of-khorne-ap");
    expect(entry).toMatchObject({ kind: "armour", armourLocation: "rightArm", armourValue: 8, op: "add" });
  });

  it("выбор левой руки — armourLocation leftArm", async () => {
    const gift = fakeItem();
    await chooseHandOfKhorneHand(gift, "left");
    const groups = gift.getFlag("warhammer-dbc", "mechanics");
    const entry = groups.flatMap(g => g.entries).find(e => e.id === "hand-of-khorne-ap");
    expect(entry.armourLocation).toBe("leftArm");
  });

  it("перевыбор руки обновляет ТУ ЖЕ запись, не заводит вторую", async () => {
    const gift = fakeItem();
    await chooseHandOfKhorneHand(gift, "right");
    await chooseHandOfKhorneHand(gift, "left");
    const groups = gift.getFlag("warhammer-dbc", "mechanics");
    const entries = groups.flatMap(g => g.entries).filter(e => e.id === "hand-of-khorne-ap");
    expect(entries).toHaveLength(1);
    expect(entries[0].armourLocation).toBe("leftArm");
    expect(gift.getFlag("warhammer-dbc", HAND_FLAG)).toBe("left");
  });

  it("не Дар «Длань Кхорна» — ничего не делает", async () => {
    const other = fakeItem({ name: "Blood Flame / Кровавое Пламя" });
    await chooseHandOfKhorneHand(other, "right");
    expect(other.getFlag("warhammer-dbc", HAND_FLAG)).toBeUndefined();
  });

  it("недопустимое значение руки — ничего не делает", async () => {
    const gift = fakeItem();
    await chooseHandOfKhorneHand(gift, "both");
    expect(gift.getFlag("warhammer-dbc", HAND_FLAG)).toBeUndefined();
  });
});
