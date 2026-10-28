// test/combat/attack-furious-assault.test.mjs
//
// Яростный Штурм / Furious Assault (Берсерк, Sahara 3-861e): после успешной Полной Атаки
// (даже если её отменит Избегание) — ещё одна атака за Реакцию тем же оружием, той же Базой и
// тем же Приёмом. Здесь — кнопка на карточке атаки и метка «дополнительная атака».
// Реприз (Парирование после Штурма) — test/combat/full-attack-lock.test.mjs, шапка combat/furious-assault.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { furiousAssaultOffered } from "../../module/rules/berserker-talents.mjs";
import { freeMeleeFlags, freeAttackLockProblem, RIPOSTE_ROUND_FLAG } from "../../module/rules/melee-talents.mjs";
import { isRoundCapabilityAvailable } from "../../module/apps/game-session.mjs";
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

// Цена дополнительной атаки — Реакция и отметка карточки — по факту «Бросок!» окна, а не по клику:
// закрытое окно ничего не стоит (приёмка #554). Атака «за свободное действие»: ни ОД, ни лимита Атак Хода.
describe("Яростный Штурм: Реакция и отметка карточки — при броске", () => {
  const NS = "warhammer-dbc";
  beforeEach(() => { globalThis.game.combat = { started: true, id: "c1", round: 1 }; });
  afterEach(() => { globalThis.game.combat = undefined; globalThis.game.messages = undefined; });

  function berserk({ reactions = 1, ap = 0, attacks = 1 } = {}) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", equipped: true }, { id: "sw" });
    const a = actorFor({ items: [w, byName(FA.name)], fatigue: { value: 0 }, aiming: "none",
      characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) },
      reactions: { value: reactions }, actionPoints: { value: ap, max: 4 } });
    a.type = "character"; a.uuid = "Actor.berserk";
    const flags = { [`${NS}.attackActionsThisTurn`]: attacks };
    a.getFlag = (s, k) => flags[`${s}.${k}`];
    a.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
    a.unsetFlag = async (s, k) => { delete flags[`${s}.${k}`]; };
    a.update = async data => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split("."); let n = a;
        for (const k of keys.slice(0, -1)) n = (n[k] ??= {});
        n[keys.at(-1)] = value;
      }
    };
    return { a, w };
  }
  function sourceCard() {
    const flags = {};
    const m = { id: "m-fa", isOwner: true, getFlag: (s, k) => flags[k], setFlag: async (s, k, v) => { flags[k] = v; } };
    globalThis.game.messages = new Map([[m.id, m]]);
    return m;
  }
  const pay = m => ({ label: "Яростный Штурм", cardId: m.id, cardKey: FURIOUS_ASSAULT_CARD_FLAG, reaction: true });
  const form = () => fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "" });
  const attackCards = () => captured.chat.filter(m => /roll-technique-block/.test(m.content ?? ""));

  it("окно закрыто — Реакция цела, карточка не помечена", async () => {
    const { a, w } = berserk();
    const m = sourceCard();
    const p = showAttackDialog(a, w, { forceBase: "fullatk", furiousAssault: true, payOnRoll: pay(m) });
    captured.dismiss();
    await p;
    expect(a.system.reactions.value).toBe(1);
    expect(m.getFlag(NS, FURIOUS_ASSAULT_CARD_FLAG)).toBeUndefined();
  });

  it("бросок: Реакция списана, карточка помечена; ОД не тратятся и лимит Атак не мешает", async () => {
    const { a, w } = berserk({ ap: 0, attacks: 1 });
    const m = sourceCard();
    const p = showAttackDialog(a, w, { forceBase: "fullatk", furiousAssault: true, payOnRoll: pay(m) });
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(attackCards()).toHaveLength(1);
    expect(a.system.reactions.value).toBe(0);
    expect(a.system.actionPoints.value).toBe(0);
    expect(m.getFlag(NS, FURIOUS_ASSAULT_CARD_FLAG)).toBe(true);
  });

  it("нет Реакции — отказ без атаки, карточка не помечена", async () => {
    const { a, w } = berserk({ reactions: 0 });
    const m = sourceCard();
    const p = showAttackDialog(a, w, { forceBase: "fullatk", furiousAssault: true, payOnRoll: pay(m) });
    await captured.press("roll", form());
    expect(attackCards()).toHaveLength(0);
    expect(m.getFlag(NS, FURIOUS_ASSAULT_CARD_FLAG)).toBeUndefined();
    captured.dismiss();
    await p;
  });

  it("второе окно с той же карточки — отказ, Реакция не тратится повторно", async () => {
    const { a, w } = berserk({ reactions: 2 });
    const m = sourceCard();
    await m.setFlag(NS, FURIOUS_ASSAULT_CARD_FLAG, true);
    const p = showAttackDialog(a, w, { forceBase: "fullatk", furiousAssault: true, payOnRoll: pay(m) });
    await captured.press("roll", form());
    expect(attackCards()).toHaveLength(0);
    expect(a.system.reactions.value).toBe(2);
    captured.dismiss();
    await p;
  });

  it("Рипост: «раз в Раунд» занимается броском, а не открытием окна", async () => {
    const { a, w } = berserk({ ap: 4, attacks: 0 });
    const ripostePay = { label: "Рипост", roundFlag: RIPOSTE_ROUND_FLAG };
    let p = showAttackDialog(a, w, { forceBase: "standard", riposte: true, payOnRoll: ripostePay });
    captured.dismiss();
    await p;
    expect(isRoundCapabilityAvailable(a, RIPOSTE_ROUND_FLAG)).toBe(true);
    p = showAttackDialog(a, w, { forceBase: "standard", riposte: true, payOnRoll: ripostePay });
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(isRoundCapabilityAvailable(a, RIPOSTE_ROUND_FLAG)).toBe(false);
  });

  it("за свободное действие с той же Базой и Приёмом", () => {
    expect(freeMeleeFlags({ furiousAssault: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
    const o = { furiousAssault: true, forceBase: "fullatk", technique: "sweep" };
    expect(freeAttackLockProblem(o, { baseKey: "fullatk", maneuverKey: "sweep" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "sweep" })).toContain("Яростный Штурм");
    expect(freeAttackLockProblem(o, { baseKey: "fullatk", maneuverKey: "standard" })).toContain("Яростный Штурм");
  });

  it("hooks.mjs: клик по кнопкам Талантов не тратит ничего до окна — цена едет в payOnRoll", () => {
    const src = fs.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    for (const sel of [".wh-furious-assault-btn", ".wh-cleave-btn", ".wh-show-off-attack-btn", ".wh-tenacity-btn", ".wh-riposte-btn"]) {
      const at = src.indexOf(`html.querySelectorAll("${sel}")`);
      const block = src.slice(at, src.indexOf("html.querySelectorAll(", at + 30));
      expect(block, sel).toContain("payOnRoll");
      expect(block, sel).not.toMatch(/spendReaction|runCardOnce|markRoundCapabilityUsed/);
    }
  });
});
