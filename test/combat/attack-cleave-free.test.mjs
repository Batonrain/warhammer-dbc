// test/combat/attack-cleave-free.test.mjs
//
// Разрубить / Cleave (core.json): «за свободное действие атаковать базовой атакой ещё одного
// персонажа, с модификатором −10». Окно атаки не должно списывать за такую атаку ОД и считать её
// в Лимите Атак Хода; исчерпанный Лимит её не блокирует. То же — для Яростного Штурма.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { freeMeleeFlags, freeAttackLockProblem, CLEAVE_PENALTY } from "../../module/rules/melee-talents.mjs";
import { CLEAVE_CARD_FLAG } from "../../module/combat/cleave.mjs";
import { FURIOUS_ASSAULT_CARD_FLAG } from "../../module/combat/furious-assault.mjs";

const NS = "warhammer-dbc";
const FA_NAME = "Furious Assault / Яростный Штурм";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
});
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.messages = undefined; });

function fighter({ ap = 4, attacks = 0, reactions = 1 } = {}) {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", equipped: true }, { id: "sw" });
  const a = actorFor({ items: [w, { id: "t-fa", name: FA_NAME, type: "talent", system: {} }],
    fatigue: { value: 0 }, aiming: "none",
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) },
    reactions: { value: reactions }, actionPoints: { value: ap, max: 4 } });
  a.type = "character"; a.uuid = "Actor.fighter";
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
  return { a, w, attacksDone: () => flags[`${NS}.attackActionsThisTurn`] };
}
let cardSeq = 0;
function sourceCard() {
  const flags = {};
  const m = { id: `m-src-${++cardSeq}`, isOwner: true, getFlag: (s, k) => flags[k], setFlag: async (s, k, v) => { flags[k] = v; } };
  globalThis.game.messages = new Map([[m.id, m]]);
  return m;
}
const form = () => fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "" });
const attackCards = () => captured.chat.filter(m => /roll-technique-block/.test(m.content ?? ""));
const cleaveOpts = m => ({ modifier: CLEAVE_PENALTY, forceBase: "standard", cleave: true,
  payOnRoll: { label: "Разрубить", cardId: m.id, cardKey: CLEAVE_CARD_FLAG } });

describe("Разрубить: чистые правила окна", () => {
  it("свободная атака: ни ОД, ни Лимита Атак, ни ворот Натиска", () => {
    expect(freeMeleeFlags({ cleave: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
    expect(freeMeleeFlags({})).toEqual({ noAp: false, uncounted: false, skipChargeGate: false });
    // Рипост (1-c9a4): «не тратит реакций или действий»
    expect(freeMeleeFlags({ riposte: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
  it("«базовой атакой»: другая База не выбирается, Стандартная — можно", () => {
    const o = { cleave: true, forceBase: "standard" };
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "standard" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "fullatk", maneuverKey: "standard" })).toContain("Разрубить");
    expect(freeAttackLockProblem(o, { baseKey: "charge", maneuverKey: "standard" })).toContain("Разрубить");
  });
});

describe("Разрубить: окно атаки не списывает ОД и Лимит Атак", () => {
  it("контроль: обычная атака Стандартной Базой ОД тратит и в лимит идёт", async () => {
    const { a, w, attacksDone } = fighter({ ap: 4, attacks: 0 });
    const p = showAttackDialog(a, w, { forceBase: "standard" });
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(attackCards()).toHaveLength(1);
    expect(a.system.actionPoints.value).toBeLessThan(4);
    expect(attacksDone()).toBeGreaterThan(0);
  });

  it("бросок Разрубить: ОД целы, счётчик Атак Хода не растёт, карточка помечена", async () => {
    const { a, w, attacksDone } = fighter({ ap: 4, attacks: 0 });
    const m = sourceCard();
    const p = showAttackDialog(a, w, cleaveOpts(m));
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(attackCards()).toHaveLength(1);
    expect(a.system.actionPoints.value).toBe(4);
    expect(attacksDone()).toBe(0);
    expect(m.getFlag(NS, CLEAVE_CARD_FLAG)).toBe(true);
  });

  it("Лимит Атак Хода исчерпан и ОД нет — Разрубить всё равно проходит", async () => {
    const { a, w, attacksDone } = fighter({ ap: 0, attacks: 1 });
    const m = sourceCard();
    const p = showAttackDialog(a, w, cleaveOpts(m));
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(attackCards()).toHaveLength(1);
    expect(captured.chat.some(c => /Лимит Атак/.test(c.content ?? ""))).toBe(false);
    expect(a.system.actionPoints.value).toBe(0);
    expect(attacksDone()).toBe(1);
  });

  it("контроль: обычная атака при исчерпанном Лимите блокируется", async () => {
    const { a, w } = fighter({ ap: 4, attacks: 1 });
    const p = showAttackDialog(a, w, { forceBase: "standard" });
    await captured.press("roll", form());
    expect(attackCards()).toHaveLength(0);
    expect(captured.chat.some(c => /Лимит Атак/.test(c.content ?? ""))).toBe(true);
    captured.dismiss();
    await p;
  });
});

describe("Яростный Штурм: дочерняя атака тоже не списывает ОД и Лимит", () => {
  it("ОД целы и счётчик Атак Хода не растёт; цена — одна Реакция", async () => {
    const { a, w, attacksDone } = fighter({ ap: 4, attacks: 1, reactions: 1 });
    const m = sourceCard();
    const p = showAttackDialog(a, w, { forceBase: "fullatk", furiousAssault: true,
      payOnRoll: { label: "Яростный Штурм", cardId: m.id, cardKey: FURIOUS_ASSAULT_CARD_FLAG, reaction: true } });
    captured.dice = [10, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(attackCards()).toHaveLength(1);
    expect(a.system.actionPoints.value).toBe(4);
    expect(a.system.reactions.value).toBe(0);
    expect(attacksDone()).toBe(1);
  });
});
