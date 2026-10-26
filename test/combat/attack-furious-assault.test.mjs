// test/combat/attack-furious-assault.test.mjs
//
// Яростный Штурм / Furious Assault (Берсерк, Sahara 3-861e): после успешной Полной Атаки
// (даже если её отменит Избегание) — ещё одна атака за Реакцию тем же оружием, той же Базой и
// тем же Приёмом. Здесь — кнопка на карточке атаки и метка «дополнительная атака».
// Реприз (Парирование после Штурма) — test/combat/full-attack-lock.test.mjs, шапка combat/furious-assault.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { furiousAssaultOffered } from "../../module/rules/berserker-talents.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { FURIOUS_ASSAULT_CARD_FLAG } from "../../module/combat/furious-assault.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const FA = { key: "berserker.core.furiousAssault", name: "Furious Assault / Яростный Штурм" };

beforeEach(() => { resetCaptured(); setTargets([]); });

async function swing(items, { baseKey = "fullatk", roll = 20, technique = "", extra = {} } = {}) {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
  w.uuid = "Item.sword";
  const actor = actorFor({ items: [w, ...items],
    characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
  actor.uuid = "Actor.berserk";
  captured.dice = [roll, 5];
  await _executeAttackRoll(actor, w, "ws", 45, "melee", null,
    { baseKey, techniqueOpts: technique ? { technique } : undefined, ...extra });
}

describe("Яростный Штурм: кнопка на карточке успешной Полной Атаки", () => {
  it("по ключу: кнопка несёт атакующего, оружие и Приём", async () => {
    await swing([byKey(FA.key)], { technique: "sweep" });
    expect(card()).toContain("wh-furious-assault-btn");
    expect(card()).toContain('data-attacker-uuid="Actor.berserk"');
    expect(card()).toContain('data-weapon-uuid="Item.sword"');
    expect(card()).toContain('data-technique="sweep"');
  });

  it("по имени (Талант без записи Конструктора) — то же", async () => {
    await swing([byName(FA.name)]);
    expect(card()).toContain("wh-furious-assault-btn");
  });

  it("промах — кнопки нет (атака не успешна)", async () => {
    await swing([byName(FA.name)], { roll: 90 });
    expect(card()).not.toContain("wh-furious-assault-btn");
  });

  it("не Полная Атака — кнопки нет", async () => {
    await swing([byName(FA.name)], { baseKey: "standard" });
    expect(card()).not.toContain("wh-furious-assault-btn");
  });

  it("без Таланта — кнопки нет", async () => {
    await swing([]);
    expect(card()).not.toContain("wh-furious-assault-btn");
  });

  it("сама дополнительная атака Штурма новой не порождает", async () => {
    await swing([byName(FA.name)], { technique: "standard", extra: { techniqueOpts: { furiousAssault: true } } });
    expect(card()).not.toContain("wh-furious-assault-btn");
  });
});

describe("Яростный Штурм: чистое условие и белый список card-once", () => {
  it("furiousAssaultOffered требует рукопашную успешную Полную Атаку, не дочернюю, и Талант", () => {
    const a = actorFor({ items: [byKey(FA.key)] });
    const ok = { isMelee: true, baseKey: "fullatk", hit: true, furiousChild: false };
    expect(furiousAssaultOffered(a, ok)).toBe(true);
    expect(furiousAssaultOffered(a, { ...ok, isMelee: false })).toBe(false);
    expect(furiousAssaultOffered(a, { ...ok, hit: false })).toBe(false);
    expect(furiousAssaultOffered(a, { ...ok, baseKey: "charge" })).toBe(false);
    expect(furiousAssaultOffered(a, { ...ok, furiousChild: true })).toBe(false);
    expect(furiousAssaultOffered(actorFor({}), ok)).toBe(false);
  });

  it("ключ отметки карточки есть в белом списке", () => {
    expect(CARD_ONCE_FLAGS).toContain(FURIOUS_ASSAULT_CARD_FLAG);
  });
});
