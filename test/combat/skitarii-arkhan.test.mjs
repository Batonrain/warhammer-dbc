// test/combat/skitarii-arkhan.test.mjs
// Избавление Аркхана (combat/skitarii-modules.mjs): с одной карточки урона — один раз.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { useDeliveranceOfArkhan } from "../../module/combat/skitarii-modules.mjs";

const prevFromUuid = globalThis.fromUuid;
beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuid = prevFromUuid; });

describe("useDeliveranceOfArkhan", () => {
  it("заряд Катушки списывается один раз, карточка отмечена", async () => {
    const actor = { uuid: "Actor.s", name: "Скитарий", isOwner: true, items: [{ type: "implant", name: "Skitarii War Plate" }],
      system: { energy: { value: 3 } },
      update: async d => { actor.system.energy.value = d["system.energy.value"]; } };
    globalThis.fromUuid = async () => actor;
    const flags = {};
    const message = { id: "m-arkhan", isOwner: true,
      getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; } };
    expect(await useDeliveranceOfArkhan(message, { actorUuid: actor.uuid, pay: "charge" })).toBe(true);
    await useDeliveranceOfArkhan(message, { actorUuid: actor.uuid, pay: "charge" });
    expect(actor.system.energy.value).toBe(2);
    expect(flags.arkhanUsed).toBe(true);
  });
});
