// test/combat/trophy-kill.test.mjs
//
// Очки Трофеев за убитую цель (Sahara task-bbe1, решение владельца 27.10.2026): смерть констатирована
// (sheets/tabs/body.mjs::setDeceased) убийцей-носителем (Собиратель Трофеев, Туманный Прыжок, Окончательная
// Казнь, Трофеи Триумфа…) — в чат уходит карточка с кнопкой «Трофей». Решает ГМ: достойна ли цель
// (офицер/чемпион/чудовище); сколько очков — считает система (Собиратель Трофеев +1, Трофеи Триумфа по Inf
// цели 2/3/4), максимум P.b. Убийца и цель — настоящие схемы, предметы — документы пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import {
  offerTrophyAfterKill, awardTrophy, trophyKillDecision, TROPHY_CARD_FLAG
} from "../../module/combat/trophy-kill.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const TROPHY_TAKER = () => packDoc("traits", "tsDD6o4bwQ6Nxawy");
const TRIUMPH = () => packDoc("talents", "phgjbXThNP6w7Bhr");

/** Актор из настоящей схемы + настоящий пересчёт листа; оценки без полей схемы не придумываем. */
function actorWith(docs = [], { perBase = 40, infBase = 0, value = 0, name = "Мастер Казней", uuid = "Actor.k" } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.per.base = perBase;
  system.characteristics.inf.base = infBase;
  system.trophyPoints.value = value;
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const store = {};
  const actor = {
    type: "character", name, uuid, system, items, isOwner: true,
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; },
    async update(data) {
      for (const [p, v] of Object.entries(data)) {
        const keys = p.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}
const sword = killer => ({ uuid: "Item.sword", name: "меч", system: { weaponClass: "melee" }, parent: killer, actor: killer });

let registry, prevFromUuid;
beforeEach(() => {
  resetCaptured();
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async u => registry[u] ?? null;
  globalThis.game.user = { id: "gm", isGM: true };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.game.user = {}; });

describe("служебное", () => {
  it("отметка карточки внесена в белый список сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain(TROPHY_CARD_FLAG);
  });
});

describe("offerTrophyAfterKill: карточка после констатации смерти", () => {
  it("убийца — носитель (Собиратель Трофеев): в чат карточка с кнопкой «Трофей», Inf цели на кнопке", async () => {
    const killer = actorWith([TROPHY_TAKER()]);
    const victim = actorWith([], { infBase: 55, name: "Чемпион", uuid: "Actor.v" });
    expect(await offerTrophyAfterKill(victim, sword(killer))).toBe(true);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("wh-trophy-btn");
    expect(html).toContain('data-killer-uuid="Actor.k"');
    expect(html).toContain('data-victim-name="Чемпион"');
    expect(html).toContain('data-victim-inf="55"');
    expect(html).toContain("решает ГМ");
  });

  it("убийца не носитель пула — карточки нет; сам себя убил — нет; без оружия — нет", async () => {
    const plain = actorWith([]);
    const victim = actorWith([], { name: "Жертва", uuid: "Actor.v" });
    expect(await offerTrophyAfterKill(victim, sword(plain))).toBe(false);
    const killer = actorWith([TROPHY_TAKER()]);
    expect(await offerTrophyAfterKill(killer, sword(killer))).toBe(false);
    expect(await offerTrophyAfterKill(victim, null)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("убийца без места в пуле (максимум 0, например вне носителя) — карточка есть только у носителя пула", async () => {
    // носитель Трофеев Триумфа без Собирателя тоже получает карточку (Талант в списке носителей)
    const killer = actorWith([TRIUMPH()]);
    expect(await offerTrophyAfterKill(actorWith([], { uuid: "Actor.v" }), sword(killer))).toBe(true);
  });
});

describe("awardTrophy: начисление ГМом после его решения", () => {
  it("Собиратель Трофеев: +1; пул растёт, не выше P.b", async () => {
    const killer = actorWith([TROPHY_TAKER()], { perBase: 40, value: 0 }); // P.b 4
    expect(await awardTrophy(killer, { inf: 20, decide: async () => true })).toMatchObject({ awarded: true, amount: 1, added: 1 });
    expect(killer.system.trophyPoints.value).toBe(1);
    killer.system.trophyPoints.value = 4;
    expect(await awardTrophy(killer, { inf: 20, decide: async () => true })).toMatchObject({ awarded: false, reason: "full" });
    expect(killer.system.trophyPoints.value).toBe(4);
  });

  it("Трофеи Триумфа: Inf 30–59 → 2, 60–79 → 3, 80+ → 4; упирается в максимум P.b (добавлено меньше)", async () => {
    for (const [inf, expected] of [[45, 2], [70, 3], [95, 4]]) {
      const killer = actorWith([TROPHY_TAKER(), TRIUMPH()], { perBase: 90, value: 0 });
      expect(await awardTrophy(killer, { inf, decide: async () => true })).toMatchObject({ awarded: true, amount: expected, added: expected });
      expect(killer.system.trophyPoints.value).toBe(expected);
    }
    const killer = actorWith([TROPHY_TAKER(), TRIUMPH()], { perBase: 40, value: 3 }); // P.b 4, уже 3
    const res = await awardTrophy(killer, { inf: 95, decide: async () => true });
    expect(res).toMatchObject({ amount: 4, added: 1 });
    expect(killer.system.trophyPoints.value).toBe(4);
  });

  it("ГМ решил «не достойна» — ничего не записано", async () => {
    const killer = actorWith([TROPHY_TAKER()], { value: 1 });
    expect(await awardTrophy(killer, { inf: 50, decide: async () => false })).toMatchObject({ awarded: false, reason: "declined" });
    expect(killer.system.trophyPoints.value).toBe(1);
  });

  it("решению ГМа передаются сумма и Inf цели (диалог показывает, что будет)", async () => {
    const killer = actorWith([TROPHY_TAKER(), TRIUMPH()], { perBase: 90 });
    let seen = null;
    await awardTrophy(killer, { inf: 64, victimName: "Чудовище", decide: async info => { seen = info; return true; } });
    expect(seen).toMatchObject({ amount: 3, inf: 64, victimName: "Чудовище", triumph: true });
  });
});

describe("диалог ГМа", () => {
  it("кнопки «Засчитать» / «Не достойна»: DialogV2 возвращает решение", async () => {
    const info = { amount: 2, inf: 45, victimName: "Чемпион", triumph: true, killerName: "Мастер Казней" };
    const p = trophyKillDecision(info);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("award", {});
    expect(await p).toBe(true);
    const p2 = trophyKillDecision(info);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("decline", {});
    expect(await p2).toBe(false);
  });
});

describe("констатация смерти (setDeceased) выпускает карточку «Трофей»", () => {
  it("последний удар нанесён оружием убийцы-носителя — смерть констатирована — карточка в чате", async () => {
    const { setDeceased } = await import("../../module/sheets/tabs/body.mjs");
    const killer = actorWith([TROPHY_TAKER()]);
    const victim = actorWith([], { infBase: 62, name: "Чемпион", uuid: "Actor.v" });
    const weapon = sword(killer);
    weapon.getFlag = () => undefined;
    registry["Item.sword"] = weapon;
    await victim.setFlag("warhammer-dbc", "lastDamageWeaponUuid", "Item.sword");
    await setDeceased(victim, true);
    expect(captured.chat.some(m => m.content.includes("wh-trophy-btn"))).toBe(true);
    // повторная констатация («мёртв → мёртв») — второй карточки нет
    const before = captured.chat.length;
    await setDeceased(victim, true);
    expect(captured.chat.length).toBe(before);
  });
});
