// test/migrations/strange-technique-effect.test.mjs
//
// Странная Техника (Sahara 3-8dc5): общий ActiveEffect «+1 к system.reactions.max»
// снят в паке, а у уже выданных копий снимается этим проходом. Форма эффекта —
// настоящая, из git-истории пака (описание/ключи совпадают с прежним JSON).

import { describe, it, expect, afterEach } from "vitest";
import {
  isLegacyStrangeEffect, strangeTechniqueEffectIds, migrateStrangeTechniqueEffect
} from "../../module/migrations/strange-technique-effect.mjs";

afterEach(() => { delete globalThis.game; delete globalThis.ui; });

/** Эффект в форме, в которой он лежал в паке (поле system.changes). */
const legacyEffect = (id = "e1") => ({
  id, name: "Strange Technique / Странная Техника",
  system: { changes: [{ key: "system.reactions.max", type: "add", value: 1, phase: "initial", priority: 0 }] }
});
const copy = (effects, { name = "Strange Technique / Странная Техника", type = "talent" } = {}) => {
  const item = { id: "i1", type, name, effects, deleted: [] };
  item.deleteEmbeddedDocuments = async (kind, ids) => { item.deleted.push(...ids); };
  return item;
};

describe("опознание старого эффекта", () => {
  it("общий +1 к reactions.max с именем Таланта — старый", () => {
    expect(isLegacyStrangeEffect(legacyEffect())).toBe(true);
  });
  it("эффект ГМа с другим именем не трогается", () => {
    expect(isLegacyStrangeEffect({ ...legacyEffect(), name: "Мой бонус" })).toBe(false);
  });
  it("эффект с именем Таланта, но другим ключом — не старый", () => {
    const e = legacyEffect();
    e.system.changes = [{ key: "system.movement.spdBonus", type: "add", value: 1 }];
    expect(isLegacyStrangeEffect(e)).toBe(false);
  });
  it("эффект, меняющий reactions.max И что-то ещё, не снимается", () => {
    const e = legacyEffect();
    e.system.changes.push({ key: "system.actionPoints.max", type: "add", value: 1 });
    expect(isLegacyStrangeEffect(e)).toBe(false);
  });
});

describe("идентификаторы к удалению", () => {
  it("копия Таланта со старым эффектом — его id; повторно (эффекта нет) — пусто", () => {
    expect(strangeTechniqueEffectIds(copy([legacyEffect("e7")]))).toEqual(["e7"]);
    expect(strangeTechniqueEffectIds(copy([]))).toEqual([]);
  });
  it("не Талант и чужой Талант — пусто", () => {
    expect(strangeTechniqueEffectIds(copy([legacyEffect()], { type: "gear" }))).toEqual([]);
    expect(strangeTechniqueEffectIds(copy([legacyEffect()], { name: "Cleave / Разрубить" }))).toEqual([]);
  });
  it("работает и с коллекцией Foundry (contents)", () => {
    expect(strangeTechniqueEffectIds(copy({ contents: [legacyEffect("c1")] }))).toEqual(["c1"]);
  });
});

describe("проход по миру", () => {
  it("снимает эффект у актора, у предмета мира и в дельте несвязанного токена; негласный повтор — ноль", async () => {
    const onActor = copy([legacyEffect("a1")]);
    const worldItem = copy([legacyEffect("w1")]);
    const deltaItem = copy([legacyEffect("d1")]);
    deltaItem.id = "dl";
    const inheritedItem = copy([legacyEffect("h1")]);  // базового актора токена — унаследован, не трогаем
    inheritedItem.id = "inh";
    const tokenActor = { items: [deltaItem, inheritedItem] };
    const tokenDoc = { name: "Т", actorLink: false, actor: tokenActor, delta: { _source: { items: [{ _id: "dl" }] } } };
    globalThis.ui = { notifications: { warn() {}, info() {} } };
    globalThis.game = {
      user: { isGM: true },
      actors: [{ name: "А", items: [onActor] }],
      items: [worldItem],
      scenes: [{ name: "С", tokens: { contents: [tokenDoc] } }]
    };
    const first = await migrateStrangeTechniqueEffect();
    expect(first).toEqual({ fixed: 3, failed: 0 });
    expect(onActor.deleted).toEqual(["a1"]);
    expect(worldItem.deleted).toEqual(["w1"]);
    expect(deltaItem.deleted).toEqual(["d1"]);
    expect(inheritedItem.deleted).toEqual([]);
  });

  it("не-ГМ ничего не трогает", async () => {
    const onActor = copy([legacyEffect("a1")]);
    globalThis.ui = { notifications: { warn() {}, info() {} } };
    globalThis.game = { user: { isGM: false }, actors: [{ name: "А", items: [onActor] }], items: [], scenes: [] };
    await migrateStrangeTechniqueEffect();
    expect(onActor.deleted).toEqual([]);
  });

  it("ошибка на одном акторе не останавливает остальных и даёт failed", async () => {
    const bad = copy([legacyEffect("b1")]);
    bad.deleteEmbeddedDocuments = async () => { throw new Error("boom"); };
    const good = copy([legacyEffect("g1")]);
    globalThis.ui = { notifications: { warn() {}, info() {} } };
    globalThis.game = { user: { isGM: true }, actors: [{ name: "X", items: [bad] }, { name: "Y", items: [good] }], items: [], scenes: [] };
    const r = await migrateStrangeTechniqueEffect();
    expect(r).toEqual({ fixed: 1, failed: 1 });
    expect(good.deleted).toEqual(["g1"]);
  });
});
