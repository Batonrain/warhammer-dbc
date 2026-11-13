// test/combat/one-will-go-down-damage.test.mjs
//
// Один Из Нас Падёт (Берсерк, Sahara 3-861e), карточка УРОНА: удар, применённый по цели и выведший её
// из строя (Раны были > 0, стали ≤ 0), сам засчитывает носителю 1 Усталости; цель устояла — Усталость
// не трогается (итог подведёт кнопка на карточке атаки). Атакующего, которого клиент менять не может, —
// не пишем, только напоминание. Условие и цена — combat/one-will-go-down.mjs, вызов — combat/damage.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const ch = total => ({ total, bonus: Math.floor(total / 10) });

function person({ name = "Цель", uuid = "Actor.t1", wounds = 20, isOwner = true } = {}) {
  const store = {};
  const list = [];
  list.contents = list;
  list.get = () => null;
  return {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner, updates: [], _store: store,
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
  attackerName: "Берсерк", weaponName: "Топор", melee: true, oneWillGoDown: true,
  attackerUuid: "Actor.atk", weaponUuid: "Item.axe", sourceMessageId: "msg1", ...over
});
const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

let registry, messages, prevFromUuid, prevMessages;
beforeEach(() => {
  resetCaptured();
  registry = { "Actor.atk": person({ name: "Берсерк", uuid: "Actor.atk" }) };
  messages = new Map();
  prevFromUuid = globalThis.fromUuid;
  prevMessages = globalThis.game.messages;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.messages = { get: id => messages.get(id) };
  globalThis.game.user = { isGM: false };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.game.messages = prevMessages; });

describe("Один Из Нас Падёт: карточка урона засчитывает 1 Усталости", () => {
  it("цель выведена из строя — носитель получил 1 Усталости, в карточке сказано", async () => {
    await applyDamageToActor(person({ wounds: 10 }), hit());
    expect(registry["Actor.atk"].system.fatigue.value).toBe(1);
    expect(chatText()).toContain("получает 1 Усталости");
  });

  it("с карточкой атаки в чате: итог помечается на ней — кнопка «Подвести итог» гаснет", async () => {
    const flags = {};
    messages.set("msg2", { id: "msg2", isOwner: true, getFlag: (s, k) => flags[k], setFlag: async (s, k, v) => { flags[k] = v; } });
    await applyDamageToActor(person({ wounds: 10 }), hit({ sourceMessageId: "msg2" }));
    expect(registry["Actor.atk"].system.fatigue.value).toBe(1);
    expect(flags.oneWillGoDownSettled).toBe(true);
  });

  it("цель устояла — Усталость не трогается", async () => {
    await applyDamageToActor(person({ wounds: 20 }), hit({ rawDamage: 10 }));
    expect(registry["Actor.atk"].system.fatigue.value).toBe(0);
  });

  it("без метки Таланта на кнопке урона — ничего", async () => {
    await applyDamageToActor(person({ wounds: 10 }), hit({ oneWillGoDown: false }));
    expect(registry["Actor.atk"].system.fatigue.value).toBe(0);
  });

  it("итог с карточки атаки уже подведён — второй раз не засчитывается", async () => {
    messages.set("msg1", { id: "msg1", isOwner: true, getFlag: (s, k) => (k === "oneWillGoDownSettled" ? true : undefined), setFlag: async () => {} });
    await applyDamageToActor(person({ wounds: 10 }), hit());
    expect(registry["Actor.atk"].system.fatigue.value).toBe(0);
  });

  it("носитель чужой для этого клиента — не пишем, даём напоминание", async () => {
    registry["Actor.atk"] = person({ name: "Берсерк", uuid: "Actor.atk", isOwner: false });
    await applyDamageToActor(person({ wounds: 10 }), hit());
    expect(registry["Actor.atk"].system.fatigue.value).toBe(0);
    expect(chatText()).toContain("кнопкой на карточке атаки");
  });
});
