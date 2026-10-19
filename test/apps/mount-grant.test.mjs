// test/apps/mount-grant.test.mjs
//
// wdbc-zaesd: Скакун из стартового снаряжения Дикаря («Скакун до R1») — выбор из
// Бестиария по Редкости из книги, импорт в мир и посадка в седло.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { mountCandidates, grantMount, MOUNT_RARITY_FLAG } from "../../module/apps/mount-grant.mjs";
import { parseGearEntry } from "../../module/rules/creation-gear.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import fs from "node:fs";
import path from "node:path";

const entry = (id, name, rarity) => ({ _id: id, name, flags: rarity == null ? {} : { "warhammer-dbc": { [MOUNT_RARITY_FLAG]: rarity } } });
const INDEX = [entry("a", "Horse / Лошадь", 0), entry("b", "Grox / Грокс", -1), entry("c", "Marru / Марру", 3),
  entry("d", "Raptor / Раптор", 1), entry("z", "Нага / Не скакун", null)];

describe("mountCandidates", () => {
  it("только с Редкостью из книги, не выше потолка, по возрастанию", () => {
    expect(mountCandidates(INDEX, 1).map(o => o.id)).toEqual(["b", "a", "d"]);
    expect(mountCandidates(INDEX, 3).map(o => o.id)).toEqual(["b", "a", "d", "c"]);
    expect(mountCandidates(INDEX, null)).toHaveLength(4);
    expect(mountCandidates(INDEX, -2)).toEqual([]);
  });
});

describe("grantMount", () => {
  let imported, rider;
  beforeEach(() => {
    resetCaptured();
    imported = [];
    rider = { name: "Дикарь", uuid: "Actor.rider", ownership: { u1: 3 }, updates: [], update: async function (d) { this.updates.push(d); } };
    globalThis.game.actors = { importFromCompendium: async (pack, id, data) => { imported.push({ id, data }); return { name: "Скакун", uuid: "Actor.mount" }; } };
  });
  const pack = { getIndex: async () => INDEX };

  it("выбор → импорт с правами всадника → связь system.mount.uuid", async () => {
    const mount = await grantMount(rider, 1, { pack, pick: async opts => { expect(opts.map(o => o.name)).toContain("Horse / Лошадь"); return 1; } });
    expect(mount.uuid).toBe("Actor.mount");
    expect(imported[0]).toMatchObject({ id: "a", data: { ownership: { u1: 3 } } });
    expect(rider.updates.at(-1)).toMatchObject({ "system.mount.uuid": "Actor.mount" });
  });

  it("отмена или нет подходящих — без импорта и связи", async () => {
    expect(await grantMount(rider, 1, { pack, pick: async () => null })).toBeNull();
    expect(await grantMount(rider, -5, { pack, pick: async () => 0 })).toBeNull();
    expect(imported).toHaveLength(0);
    expect(rider.updates).toHaveLength(0);
  });
});

describe("разбор строки снаряжения «Скакун до R1»", () => {
  it("manual с grant:mount и потолком Редкости", () => {
    const [spec] = parseGearEntry("Скакун до R1");
    expect(spec).toMatchObject({ kind: "manual", grant: "mount", maxAvailability: 1 });
    const [raptor] = parseGearEntry("Любой из Рапторов");
    expect(raptor.grant).toBeUndefined();
  });
});

describe("данные пака: Скакуны несут Редкость из книги", () => {
  it("каждый актёр папки «Скакуны» имеет число-Редкость", () => {
    const dir = path.resolve(import.meta.dirname, "../../packs-src/bestiary/Скакуны");
    const docs = fs.readdirSync(dir).filter(f => !f.startsWith("_")).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    expect(docs.length).toBeGreaterThanOrEqual(11);
    for (const d of docs) expect(Number.isFinite(d.flags?.["warhammer-dbc"]?.[MOUNT_RARITY_FLAG]), d.name).toBe(true);
    expect(docs.find(d => d.name.startsWith("Horse")).flags["warhammer-dbc"][MOUNT_RARITY_FLAG]).toBe(0);
  });
});
