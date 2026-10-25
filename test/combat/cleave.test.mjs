// test/combat/cleave.test.mjs
//
// Разрубить / Cleave (Рукопашные, Sahara 3-8dc5): 16+ непоглощённого рукопашного
// урона, выведшего цель из строя, дают кнопку свободной атаки по соседу (−10).
// Логика условия — test/rules/melee-talents.test.mjs; здесь — карточка урона.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { CLEAVE_CARD_FLAG } from "../../module/combat/cleave.mjs";

const ch = total => ({ total, bonus: Math.floor(total / 10) });
const talentItem = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

/** Цель/носитель, достаточные для applyDamageToActor. */
function person({ talents = [], name = "Цель", uuid = "Actor.t1", wounds = 20 } = {}) {
  const store = {};
  const list = talents.map(talentItem);
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner: true, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: wounds, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: list, effects: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async updateEmbeddedDocuments() { return []; }
  };
}

const hit = (over = {}) => ({
  rawDamage: 22, penetration: 0, damageType: "rending", hitLocation: "Тело",
  attackerName: "Рубака", weaponName: "Меч", melee: true,
  attackerUuid: "Actor.atk", weaponUuid: "Item.sword", ...over
});
const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

let registry;
let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  registry = { "Actor.atk": person({ talents: ["Cleave / Разрубить"], name: "Рубака", uuid: "Actor.atk" }) };
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.user = { isGM: false };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; });

describe("Разрубить: кнопка в карточке урона", () => {
  it("22 урона по цели с 10 Ранами (вышла из строя) → кнопка с атакующим и оружием", async () => {
    await applyDamageToActor(person({ wounds: 10 }), hit());
    const text = chatText();
    expect(text).toContain("wh-cleave-btn");
    expect(text).toContain('data-attacker-uuid="Actor.atk"');
    expect(text).toContain('data-weapon-uuid="Item.sword"');
  });

  it("без Таланта у атакующего кнопки нет", async () => {
    registry["Actor.atk"] = person({ name: "Рубака", uuid: "Actor.atk" });
    await applyDamageToActor(person({ wounds: 10 }), hit());
    expect(chatText()).not.toContain("wh-cleave-btn");
  });

  it("цель выдержала (Раны остались > 0) — нет", async () => {
    await applyDamageToActor(person({ wounds: 20 }), hit({ rawDamage: 18 }));
    expect(chatText()).not.toContain("wh-cleave-btn");
  });

  it("мало урона (15 непоглощённого) — нет, даже если цель упала", async () => {
    await applyDamageToActor(person({ wounds: 5 }), hit({ rawDamage: 15 }));
    expect(chatText()).not.toContain("wh-cleave-btn");
  });

  it("стрелковый удар — нет", async () => {
    await applyDamageToActor(person({ wounds: 10 }), hit({ melee: false }));
    expect(chatText()).not.toContain("wh-cleave-btn");
  });

  it("сама дополнительная атака Разрубания (cleaveChild) новой кнопки не даёт", async () => {
    await applyDamageToActor(person({ wounds: 10 }), hit({ cleaveChild: true }));
    expect(chatText()).not.toContain("wh-cleave-btn");
  });

  it("ключ отметки карточки есть в белом списке card-once", () => {
    expect(CARD_ONCE_FLAGS).toContain(CLEAVE_CARD_FLAG);
  });
});
