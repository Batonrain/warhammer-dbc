// test/apps/twin-spirit.test.mjs
// Лист демона Двойного Духа — Foundry-обвязка (apps/twin-spirit.mjs): щит
// Ауры Хаоса и Черты Даров-форм сверяются с Проявлением.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { auraOfChaosShieldData, syncAuraOfChaos, syncManifestTraits } from "../../module/apps/twin-spirit.mjs";
import { AURA_OF_CHAOS_FLAG, MANIFEST_GRANT_FLAG } from "../../module/rules/twin-spirit.mjs";

const NS = "warhammer-dbc";
const demon = {
  uuid: "Actor.d1", type: "daemon",
  system: { characteristics: { wp: { total: 38 } } },
  items: [{ type: "trait", name: "Жажда Крови", toObject: () => ({ _id: "x", name: "Жажда Крови", type: "trait", system: {} }) }]
};

function hostWith(items, { manifested = true } = {}) {
  const host = {
    uuid: "Actor.h1", name: "Одержимый", isOwner: true, flags: {},
    system: { possessed: true, possession: { manifested, demonUuid: "Actor.d1", demon: "bloodletter" } },
    items: [...items],
    created: [], deleted: []
  };
  for (const i of host.items) i.getFlag ??= (ns, k) => i.flags?.[ns]?.[k];
  host.createEmbeddedDocuments = async (_t, docs) => {
    host.created.push(...docs);
    host.items.push(...docs.map((d, n) => ({ ...d, id: `new${n}`, getFlag: (ns, k) => d.flags?.[ns]?.[k] })));
  };
  host.deleteEmbeddedDocuments = async (_t, ids) => {
    host.deleted.push(...ids);
    host.items = host.items.filter(i => !ids.includes(i.id));
  };
  return host;
}

describe("Аура Хаоса — предмет-щит", () => {
  it("сквозной чародейский 1-W, не перегружается, включён", () => {
    const d = auraOfChaosShieldData(38);
    expect(d.system).toMatchObject({ shieldNature: "warp", shieldType: "penetrating", ratingMin: 1, ratingMax: 38, overloadThreshold: 0, equipped: true, status: "active" });
    expect(d.flags[NS][AURA_OF_CHAOS_FLAG]).toBe(true);
  });
  it("в Проявлении с Даром щит создаётся, без Проявления — снимается", async () => {
    globalThis.fromUuidSync = u => (u === "Actor.d1" ? demon : null);
    const h = hostWith([{ id: "g", type: "talent", name: "Aura of Chaos / Дар: Аура Хаоса" }]);
    await syncAuraOfChaos(h);
    expect(h.created).toHaveLength(1);
    expect(h.created[0].system.ratingMax).toBe(38);
    h.system.possession.manifested = false;
    await syncAuraOfChaos(h);
    expect(h.deleted).toEqual(["new0"]);
    globalThis.fromUuidSync = () => null;
  });
});

describe("Наслоение — Черты своего демона с его листа", () => {
  it("Жажда Крови берётся с листа демона, метка Дара на копии", async () => {
    globalThis.fromUuidSync = u => (u === "Actor.d1" ? demon : null);
    const h = hostWith([{ id: "g", type: "talent", name: "Stacking / Дар: Наслоение" }]);
    await syncManifestTraits(h);
    const thirst = h.created.find(d => d.name === "Жажда Крови");
    expect(thirst?.flags[NS][MANIFEST_GRANT_FLAG]).toEqual({ gift: "Наслоение", name: "Жажда Крови" });
    globalThis.fromUuidSync = () => null;
  });
});
