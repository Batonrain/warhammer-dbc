// test/combat/damage-aiming-reset.test.mjs
//
// wdbc-1rno.5: applyDamageToActor сбрасывает Прицеливание жертвы впустую —
// «любое иное действие» тратит бонус, получение урона в том числе (то же
// решение пользователя, что для Движения/Уклонения/Парирования, см.
// combat/action-economy.mjs::_maybeClearAiming). Tracking Aim/Прицел на
// Упреждение (flags.warhammer-dbc.trackingAimActive) — та же точка.
//
// Фикстура — минимальный работающий актор из maggot-parasite-damage.test.mjs
// (applyDamageToActor трогает много полей ниже по конвейеру, эта форма уже
// проверена, что не падает).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ aiming = "none", trackingAimActive = false } = {}) {
  const flags = {};
  if (trackingAimActive) flags["warhammer-dbc.trackingAimActive"] = true;
  return {
    id: "char1", name: "Жертва", type: "character", uuid: "Actor.victim",
    system: {
      aiming,
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 0, critical: 25, max: 20 }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      if (data["system.aiming"] !== undefined) this.system.aiming = data["system.aiming"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; globalThis.fromUuid = async () => null; });

describe("applyDamageToActor сбрасывает Прицеливание жертвы", () => {
  it("aiming='half' — сброшено в 'none' после получения урона", async () => {
    const actor = characterActor({ aiming: "half" });
    await applyDamageToActor(actor, damage());
    expect(actor.system.aiming).toBe("none");
  });

  it("aiming='none' — update по aiming не трогается (нечего сбрасывать)", async () => {
    const actor = characterActor({ aiming: "none" });
    await applyDamageToActor(actor, damage());
    expect(actor.system.aiming).toBe("none");
  });

  it("trackingAimActive — тоже снимается вместе с Прицеливанием", async () => {
    const actor = characterActor({ aiming: "full", trackingAimActive: true });
    await applyDamageToActor(actor, damage());
    expect(actor.getFlag("warhammer-dbc", "trackingAimActive")).toBeUndefined();
  });
});
