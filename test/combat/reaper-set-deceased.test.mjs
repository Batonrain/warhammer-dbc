// test/combat/reaper-set-deceased.test.mjs
//
// Жнец: единая точка, где система признаёт смерть (sheets/tabs/body.mjs::setDeceased), выпускает карточку
// «Жнец» после удара рукопашным Натиском носителя Таланта, и только на переходе «жив → мёртв».

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { setDeceased } from "../../module/sheets/tabs/body.mjs";
import { LAST_DAMAGE_CHARGE_FLAG } from "../../module/combat/reaper-chain.mjs";
import { LAST_DAMAGE_WEAPON_FLAG } from "../../module/combat/blood-flame.mjs";

let registry, prevFromUuid, prevCombat;
beforeEach(() => {
  resetCaptured();
  registry = {}; prevFromUuid = globalThis.fromUuid; globalThis.fromUuid = async u => registry[u] ?? null;
  prevCombat = game.combat; game.combat = { id: "cb", round: 2 };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; game.combat = prevCombat; });

function setup({ charge = true, talent = true } = {}) {
  const fstore = {};
  const attacker = {
    uuid: "Actor.f", name: "Боец", type: "character", system: {},
    items: Object.assign(talent ? [{ id: "t", name: "Reaper / Жнец", type: "talent", system: {} }] : [], { get: () => null }),
    getFlag: (s, k) => fstore[k], setFlag: async (s, k, v) => { fstore[k] = v; }
  };
  const weapon = { uuid: "Item.sword", name: "меч", system: { weaponClass: "melee" }, parent: attacker, actor: attacker, getFlag: () => undefined };
  registry["Item.sword"] = weapon; registry["Actor.f"] = attacker;
  const store = { [LAST_DAMAGE_WEAPON_FLAG]: "Item.sword" };
  if (charge) store[LAST_DAMAGE_CHARGE_FLAG] = { attackerUuid: "Actor.f", tokenUuid: "Scene.s.Token.v", combatId: "cb", round: 2 };
  const victim = {
    uuid: "Actor.v", name: "Жертва", type: "character", system: {}, items: [],
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    update: async () => {}
  };
  return { victim, store };
}
const cards = () => captured.chat.filter(m => (m.content ?? "").includes("wh-reaper-btn"));

describe("setDeceased → Жнец", () => {
  it("смерть констатирована после Натиска носителя Таланта — одна карточка с кнопкой", async () => {
    const { victim } = setup();
    await setDeceased(victim, true);
    expect(cards()).toHaveLength(1);
  });
  it("повторная констатация (уже мёртв) — второй карточки нет", async () => {
    const { victim } = setup();
    await setDeceased(victim, true);
    await setDeceased(victim, true);
    expect(cards()).toHaveLength(1);
  });
  it("не Натиск — карточки нет", async () => {
    const { victim } = setup({ charge: false });
    await setDeceased(victim, true);
    expect(cards()).toHaveLength(0);
  });
  it("без Таланта — карточки нет", async () => {
    const { victim } = setup({ talent: false });
    await setDeceased(victim, true);
    expect(cards()).toHaveLength(0);
  });
  it("«оживили» (снять смерть) — карточки нет", async () => {
    const { victim } = setup();
    await setDeceased(victim, false);
    expect(cards()).toHaveLength(0);
  });
});
