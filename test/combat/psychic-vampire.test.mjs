// test/combat/psychic-vampire.test.mjs
//
// Психический Вампир (Псайкана, Sahara 3-28, пачка I2): кнопка в карточке урона и её обработчик.
// Правила условия — test/rules/psychic-vampire.test.mjs; здесь — карточка урона и клик по кнопке.
// Талант берётся из настоящего пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { VAMPIRE_CARD_FLAG, handleVampireClick } from "../../module/combat/psychic-vampire.mjs";
import { VAMPIRE_USAGE_KEY, VAMPIRE_DRUG_NAME } from "../../module/rules/psychic-vampire.mjs";
import { WITHDRAWAL_FLAG } from "../../module/rules/drug-withdrawal.mjs";
import { DRUG_DOSES_FLAG } from "../../module/rules/drug-doses.mjs";

const NS = "warhammer-dbc";
const ch = total => ({ total, bonus: Math.floor(total / 10) });
const vampireDoc = () => packDocById("packs-src/talents/Псайкана", "nDoZKGwoQb1n6OdK");
const vampireTalent = () => { const d = vampireDoc(); return { type: "talent", name: d.name, system: { ...d.system }, flags: {}, getFlag: () => undefined }; };

function person({ items = [], name = "Цель", uuid = "Actor.t1", wounds = 20, wp = 60 } = {}) {
  const store = {};
  const list = [...items];
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner: true, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(50), t: ch(40), wp: ch(wp), ag: ch(40), int: ch(40) },
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
  // Заглушка не наследует Actor: fromUuid-обвязка берёт .actor у не-Actor (как у токена) — отдаём себя.
  a.actor = a;
  return a;
}

const psyHit = (over = {}) => ({
  rawDamage: 22, penetration: 0, damageType: "energy", hitLocation: "Тело",
  attackerName: "Псайкер", weaponName: "Психический Шторм", attackerUuid: "Actor.atk",
  psychicPowerType: "attack", ...over
});
const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

let registry;
let prev;
beforeEach(() => {
  resetCaptured();
  registry = { "Actor.atk": person({ items: [vampireTalent()], name: "Псайкер", uuid: "Actor.atk" }) };
  prev = { fromUuid: globalThis.fromUuid, game: globalThis.game.user, combat: globalThis.game.combat };
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.user = { isGM: false };
});
afterEach(() => {
  globalThis.fromUuid = prev.fromUuid; globalThis.game.user = prev.game; globalThis.game.combat = prev.combat;
});

describe("Психический Вампир: кнопка в карточке урона", () => {
  it("психосила вывела цель из строя — кнопка несёт атакующего и имя цели", async () => {
    await applyDamageToActor(person({ wounds: 10, name: "Жертва" }), psyHit());
    const text = chatText();
    expect(text).toContain("wh-vampire-btn");
    expect(text).toContain('data-attacker-uuid="Actor.atk"');
    expect(text).toContain('data-target-name="Жертва"');
  });
  it("психосиловое оружие (свойство Force) — тоже", async () => {
    registry["Item.staff"] = { type: "weapon", name: "Посох", system: { weaponProps: [{ key: "force" }] } };
    await applyDamageToActor(person({ wounds: 10 }), psyHit({ psychicPowerType: undefined, weaponUuid: "Item.staff" }));
    expect(chatText()).toContain("wh-vampire-btn");
  });
  it("без Таланта у атакующего кнопки нет", async () => {
    registry["Actor.atk"] = person({ name: "Псайкер", uuid: "Actor.atk" });
    await applyDamageToActor(person({ wounds: 10 }), psyHit());
    expect(chatText()).not.toContain("wh-vampire-btn");
  });
  it("цель устояла — кнопки нет", async () => {
    await applyDamageToActor(person({ wounds: 40 }), psyHit());
    expect(chatText()).not.toContain("wh-vampire-btn");
  });
  it("обычный (не психический) урон — кнопки нет", async () => {
    registry["Item.sword"] = { type: "weapon", name: "Меч", system: { weaponProps: [] } };
    await applyDamageToActor(person({ wounds: 10 }), psyHit({ psychicPowerType: undefined, weaponUuid: "Item.sword" }));
    expect(chatText()).not.toContain("wh-vampire-btn");
  });
  it("отметка карточки входит в белый список сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain(VAMPIRE_CARD_FLAG);
  });
});

describe("Психический Вампир: клик по кнопке", () => {
  // Отметка «уже сделано» держится в памяти клиента по id сообщения — у каждого теста своя карточка.
  let seq = 0;
  const message = () => { const flags = {}; return { id: `m${++seq}`, isOwner: true, flags,
    getFlag: (s, k) => flags[k], async setFlag(s, k, v) { flags[k] = v; } }; };
  const button = () => ({ dataset: { attackerUuid: "Actor.atk", targetName: "Жертва" } });
  let dialogs;
  const prevDialog = globalThis.foundry.applications.api.DialogV2;
  const stubDialogs = ({ soul = true, benefit = "heal" } = {}) => {
    dialogs = [];
    globalThis.foundry.applications.api.DialogV2 = {
      confirm: async opts => { dialogs.push(["confirm", opts.window.title]); return soul; },
      wait: async opts => { dialogs.push(["wait", opts.window.title]); return benefit; }
    };
  };
  afterEach(() => { globalThis.foundry.applications.api.DialogV2 = prevDialog; });

  it("успех, лечение: 1d5 Ран на себя, доза «наркотика» в недельном журнале", async () => {
    stubDialogs();
    const psy = registry["Actor.atk"];
    psy.system.wounds.value = 5;
    captured.dice = [20, 4];           // d100 = 20 ≤ 60 — успех; 1d5 = 4
    const ok = await handleVampireClick(message(), button());
    expect(ok).toBe(true);
    expect(psy.system.wounds.value).toBe(9);
    const doses = psy._store[`${NS}.${DRUG_DOSES_FLAG}`];
    expect(JSON.stringify(doses)).toContain(VAMPIRE_DRUG_NAME);
    expect(chatText()).toContain("Психический Вампир");
  });
  it("успех, Усталость: вся Усталость снимается", async () => {
    stubDialogs({ benefit: "fatigue" });
    const psy = registry["Actor.atk"];
    psy.system.fatigue.value = 3;
    captured.dice = [10];
    await handleVampireClick(message(), button());
    expect(psy.system.fatigue.value).toBe(0);
  });
  it("провал теста — ни лечения, ни дозы", async () => {
    stubDialogs();
    const psy = registry["Actor.atk"];
    psy.system.wounds.value = 5;
    captured.dice = [95];
    await handleVampireClick(message(), button());
    expect(psy.system.wounds.value).toBe(5);
    expect(psy._store[`${NS}.${DRUG_DOSES_FLAG}`]).toBeUndefined();
  });
  it("«нет души» — не бросает и не помечает карточку", async () => {
    stubDialogs({ soul: false });
    const msg = message();
    captured.dice = [10];
    expect(await handleVampireClick(msg, button())).toBe(false);
    expect(captured.dice).toEqual([10]);
    expect(msg.flags[VAMPIRE_CARD_FLAG]).toBeUndefined();
  });
  it("раз в Раунд: во втором применении в том же Раунде отказ", async () => {
    stubDialogs();
    globalThis.game.combat = { id: "c1", round: 3 };
    const psy = registry["Actor.atk"];
    psy._store[`${NS}.usageLimits.psyker-core-psychicVampire`] = { scope: "round", used: true, round: 3 };
    captured.dice = [10];
    expect(VAMPIRE_USAGE_KEY).toBe("psyker.core.psychicVampire");
    expect(await handleVampireClick(message(), button())).toBe(false);
    expect(dialogs).toEqual([]);
  });
  it("не владелец актора — отказ", async () => {
    stubDialogs();
    registry["Actor.atk"].isOwner = false;
    expect(await handleVampireClick(message(), button())).toBe(false);
    expect(dialogs).toEqual([]);
  });
  it("на шестой дозе за неделю открывается тест Зависимости (механизм наркотиков)", async () => {
    stubDialogs();
    const psy = registry["Actor.atk"];
    const now = 0;
    // пять доз уже записано за последнюю неделю
    psy._store[`${NS}.${DRUG_DOSES_FLAG}`] = { [VAMPIRE_DRUG_NAME]: [now, now, now, now, now] };
    captured.dice = [10, 3, 80];      // успех; лечение 3; тест Зависимости: 80 > 60 — провал, зависимость
    await handleVampireClick(message(), button());
    expect(chatText()).toContain("Тест Зависимости");
    const entry = psy._store[`${NS}.${WITHDRAWAL_FLAG}`]?.[VAMPIRE_DRUG_NAME];
    expect(entry?.addicted).toBe(true);
    expect(entry?.addiction?.frequency).toBe("6 дней");
    // «Агрессия 2» едет вместе с зависимостью: через 6 дней без дозы её выдадут часы Календаря сами.
    expect(entry?.addiction?.penaltyDisorder).toEqual({ name: "Агрессия", severity: 2 });
  });
});
