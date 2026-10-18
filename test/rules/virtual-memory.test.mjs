// test/rules/virtual-memory.test.mjs
//
// Virtual Memory / Виртуальная Память (technomystic.core.virtualMemory):
// «Подключённый к Ноосфере, его максимум [Когниции] увеличивается на 2.
// Если он отключается от Ноосферы, «лишняя» теряется.» Можно брать до 3-х
// раз. Проверяется через полный конвейер (prepareDerivedData), тот же
// приём, что test/rules/power-cache.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const virtualMemoryItem = id => ({
  id, name: "Virtual Memory / Виртуальная Память", type: "talent", system: {},
  getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "technomystic.core.virtualMemory", label: "" }
  ] }] } }
});

function characterWith(intBase, { noosphereConnected = false, items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.int.base = intBase;
  system.noosphereConnected = noosphereConnected;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Virtual Memory: +2 к максимуму Когниции за взятие, только подключённым к Ноосфере", () => {
  it("подключён, 1 копия — +2", () => {
    const system = characterWith(40, { noosphereConnected: true, items: [virtualMemoryItem("vm1")] });
    expect(system.cognition.max).toBe(4 + 2);
  });

  it("подключён, 2 копии — +4", () => {
    const system = characterWith(40, { noosphereConnected: true, items: [virtualMemoryItem("vm1"), virtualMemoryItem("vm2")] });
    expect(system.cognition.max).toBe(4 + 4);
  });

  it("4 копии — потолок всё равно 3 (+6, не +8)", () => {
    const system = characterWith(40, {
      noosphereConnected: true,
      items: [virtualMemoryItem("vm1"), virtualMemoryItem("vm2"), virtualMemoryItem("vm3"), virtualMemoryItem("vm4")]
    });
    expect(system.cognition.max).toBe(4 + 6);
  });

  it("отключён от Ноосферы — бонус не действует, хоть Талант и есть", () => {
    const system = characterWith(40, { noosphereConnected: false, items: [virtualMemoryItem("vm1")] });
    expect(system.cognition.max).toBe(4);
  });

  it("без Таланта — обычный максимум = I.b", () => {
    const system = characterWith(40, { noosphereConnected: true, items: [] });
    expect(system.cognition.max).toBe(4);
  });
});
