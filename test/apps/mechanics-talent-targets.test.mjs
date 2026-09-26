// test/apps/mechanics-talent-targets.test.mjs
//
// Запись Механики kind:"talent" несёт цели (targets) — они ложатся на
// выданный Талант. Живой случай — Дискордант: «Enemy (Adeptus Mechanicus,
// Dark Mechanicum)»; без целей Талант лежал бы на листе, но предикаты
// (rules/talent-targets.mjs) не срабатывали бы ни против кого. Запись берётся
// из настоящего JSON субрасы.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { applyMechEntry } from "../../module/apps/mechanics.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const realFromUuid = globalThis.fromUuid;
afterEach(() => { globalThis.fromUuid = realFromUuid; });

const DISCORDANT = packDocById("packs-src/races/Субрасы", "T1qnNY6k1t1Mqu7O");
const enemyEntry = DISCORDANT.flags["warhammer-dbc"].mechanics
  .flatMap(g => g.entries).find(e => e.kind === "talent");

function actor() {
  const created = [];
  return {
    created, items: [],
    system: { experience: { total: 0, current: 0, log: [] }, aptitudes: [] },
    createEmbeddedDocuments: async (_t, docs) => { created.push(...docs); return docs; },
    update: async () => {}
  };
}

describe("Механика: цели Таланта из записи", () => {
  it("Дискордант получает Enemy с двумя целями-фракциями", async () => {
    globalThis.fromUuid = async () => ({
      toObject: () => ({ name: "Enemy / Враг", type: "talent",
                         system: { hasRating: true, rating: 1, specialization: "Любая организация", targets: [] } })
    });
    const a = actor();
    await applyMechEntry(a, enemyEntry, { id: "sub1", name: "Discordant / Дискордант" });

    expect(a.created).toHaveLength(1);
    const t = a.created[0];
    expect(t.system.specialization).toBe("Adeptus Mechanicus, Dark Mechanicum");
    expect(t.system.targets.map(x => `${x.kind}:${x.ref}`))
      .toEqual(["faction:adeptus-mechanicus", "faction:dark-mechanicum"]);
  });

  it("запись без целей не затирает цели компендиума", async () => {
    const own = [{ kind: "faction", ref: "x", value: "", name: "X", img: "" }];
    globalThis.fromUuid = async () => ({
      toObject: () => ({ name: "Enemy / Враг", type: "talent", system: { specialization: "", targets: own } })
    });
    const a = actor();
    await applyMechEntry(a, { ...enemyEntry, targets: [], specialization: "" }, { id: "s", name: "s" });
    expect(a.created[0].system.targets).toEqual(own);
  });
});
