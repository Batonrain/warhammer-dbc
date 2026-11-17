// test/combat/haymaker-damage.test.mjs
//
// Тяжёлый Хук (Пугилист, Sahara 3-eddb), карточка УРОНА: «если цель получила попадание, она должна пройти
// встречный тест S+0 vs S+0, или ее Сбивает с ног» — применённый урон с меткой Хука даёт кнопку встречного
// теста (combat/pugilist-strikes.mjs, вызов — combat/damage.mjs). Сбитую с ног цель — не предлагаем.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const ch = total => ({ total, bonus: Math.floor(total / 10) });

function person({ name = "Цель", uuid = "Actor.t1", wounds = 20, prone = false } = {}) {
  const store = {};
  const list = [];
  list.contents = list;
  list.get = () => null;
  return {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner: true, updates: [],
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: wounds, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: { prone }, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: list, effects: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) { this.updates.push(data); },
    async updateEmbeddedDocuments() { return []; }
  };
}

const hit = (over = {}) => ({
  rawDamage: 8, penetration: 0, damageType: "impact", hitLocation: "Тело",
  attackerName: "Боксёр", weaponName: "Кулак", melee: true, haymaker: true,
  attackerUuid: "Actor.atk", weaponUuid: "Item.fist", sourceMessageId: "msg1", ...over
});
const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

beforeEach(() => {
  resetCaptured();
  globalThis.fromUuid = async () => null;
  globalThis.game.user = { isGM: false };
});

describe("Тяжёлый Хук: кнопка встречного теста в карточке урона", () => {
  it("урон с меткой Хука — кнопка с атакующим, целью и исходной карточкой", async () => {
    await applyDamageToActor(person(), hit());
    const text = chatText();
    expect(text).toContain("wh-haymaker-btn");
    expect(text).toContain('data-attacker-uuid="Actor.atk"');
    expect(text).toContain('data-target-uuid="Actor.t1"');
    expect(text).toContain('data-source-message-id="msg1"');
  });

  it("урон полностью поглощён — кнопка всё равно есть (попадание состоялось)", async () => {
    await applyDamageToActor(person(), hit({ rawDamage: 0 }));
    expect(chatText()).toContain("wh-haymaker-btn");
  });

  it("без метки Хука кнопки нет", async () => {
    await applyDamageToActor(person(), hit({ haymaker: false }));
    expect(chatText()).not.toContain("wh-haymaker-btn");
  });

  it("цель уже лежит (Ничком) — сбивать нечего, кнопки нет", async () => {
    await applyDamageToActor(person({ prone: true }), hit());
    expect(chatText()).not.toContain("wh-haymaker-btn");
  });
});
