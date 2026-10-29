// test/combat/defense-overpower.test.mjs
//
// Пересилить / Overpower (Берсерк, Sahara 3-861e): атаковавший Полной Атакой может
// пройти S+0 vs S+0 после успешного Парирования, чтобы его игнорировать. Здесь —
// кнопка в карточке Парирования (combat/defense.mjs); условие — rules/berserker-talents.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _performParry } from "../../module/combat/defense.mjs";
import { overpowerOffered } from "../../module/rules/berserker-talents.mjs";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const KEY = "berserker.core.overpower";

function sword() {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", balance: 0, equipped: true, hands: 1 }, { id: "w1", name: "Клинок" });
  w.type = "weapon";
  return w;
}
function defender() {
  const a = actorFor({ items: [sword()] });
  a.uuid = "Actor.defender";
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}
function attacker(items) {
  const a = actorFor({ items });
  a.uuid = "Actor.atk";
  a.name = "Берсерк";
  return a;
}

let registry;
let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  captured.dice = [10];                     // Парирование удалось
  globalThis.game.combat = undefined;
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; });

async function parry(atk, attackBaseKey) {
  registry["Actor.atk"] = atk;
  await _performParry(defender(), { extraMod: 0, attackerUuid: "Actor.atk", attackBaseKey });
  return captured.chat.at(-1).content;
}

describe("Пересилить: кнопка на карточке успешного Парирования", () => {
  it("Полная Атака + Талант у атаковавшего (ключ) → кнопка с обоими uuid", async () => {
    const card = await parry(attacker([talentByKey(KEY)]), "fullatk");
    expect(card).toContain("wh-overpower-btn");
    expect(card).toContain('data-attacker-uuid="Actor.atk"');
    expect(card).toContain('data-defender-uuid="Actor.defender"');
  });

  it.each(["standard", "charge", ""])("не Полная Атака (База «%s») — кнопки нет", async baseKey => {
    expect(await parry(attacker([talentByKey(KEY)]), baseKey)).not.toContain("wh-overpower-btn");
  });

  it("у атаковавшего нет Таланта — кнопки нет", async () => {
    expect(await parry(attacker([]), "fullatk")).not.toContain("wh-overpower-btn");
  });

  it("Парирование провалено — игнорировать нечего", async () => {
    captured.dice = [99];
    expect(await parry(attacker([talentByKey(KEY)]), "fullatk")).not.toContain("wh-overpower-btn");
  });
});

describe("Пересилить: чистое условие и белый список card-once", () => {
  it("overpowerOffered требует и Полную Атаку, и успех Парирования, и Талант", () => {
    const a = attacker([talentByKey(KEY)]);
    expect(overpowerOffered(a, { baseKey: "fullatk", parried: true })).toBe(true);
    expect(overpowerOffered(a, { baseKey: "fullatk", parried: false })).toBe(false);
    expect(overpowerOffered(a, { baseKey: "standard", parried: true })).toBe(false);
    expect(overpowerOffered(attacker([]), { baseKey: "fullatk", parried: true })).toBe(false);
  });

});
