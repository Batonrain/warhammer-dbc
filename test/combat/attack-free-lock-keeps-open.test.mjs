import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { CLEAVE_PENALTY } from "../../module/rules/melee-talents.mjs";
import { CLEAVE_CARD_FLAG } from "../../module/combat/cleave.mjs";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
});
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.messages = undefined; });

function fighter() {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", equipped: true }, { id: "sw" });
  const a = actorFor({ items: [w], fatigue: { value: 0 }, aiming: "none",
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) },
    reactions: { value: 1 }, actionPoints: { value: 4, max: 4 } });
  a.type = "character"; a.uuid = "Actor.fighter";
  const flags = {};
  a.getFlag = (s, k) => flags[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
  a.update = async () => {};
  return { a, w };
}

function textNode() {
  let text = "";
  return {
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    style: {}, classList: { add: () => {}, remove: () => {} }
  };
}

function htmlNode() {
  let out = "";
  return { get innerHTML() { return out; }, set innerHTML(v) { out = String(v); } };
}

function formWithRollButton(baseKey) {
  const handlers = [];
  const rollBtn = { addEventListener: (type, fn, capture) => handlers.push({ type, fn, capture }), dataset: {} };
  const form = fakeForm({
    "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "",
    "#atk-total-display": textNode(), "#atk-threshold-breakdown": htmlNode(), ".av-adv-hint": textNode(),
    "input[name='atk-base']:checked": { value: baseKey, dataset: {} },
    "button[data-action='roll']": rollBtn
  });
  return { form, handlers };
}

function clickRoll(handlers) {
  const ev = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  for (const h of handlers.filter(x => x.type === "click")) h.fn(ev);
  return ev;
}

function openCleave() {
  const { a, w } = fighter();
  const m = { id: "m1", isOwner: true, getFlag: () => undefined, setFlag: async () => {} };
  globalThis.game.messages = new Map([[m.id, m]]);
  showAttackDialog(a, w, { modifier: CLEAVE_PENALTY, forceBase: "standard", cleave: true,
    payOnRoll: { label: "Разрубить", cardId: m.id, cardKey: CLEAVE_CARD_FLAG } });
}

describe("свободная атака с закреплённой Базой: отказ не закрывает окно", () => {
  it("Разрубить + другая База: клик по «Бросок!» гасится до отправки формы, предупреждение выходит", () => {
    openCleave();
    const { form, handlers } = formWithRollButton("fullatk");
    captured.rerender(form);
    const ev = clickRoll(handlers);
    expect(ev.prevented).toBe(true);
    expect(ev.stopped).toBe(true);
    expect(captured.warnings.join(" ")).toContain("Разрубить: свободная атака — Стандартная База");
  });

  it("Разрубить + Стандартная База: клик проходит как обычно", () => {
    openCleave();
    const { form, handlers } = formWithRollButton("standard");
    captured.rerender(form);
    const ev = clickRoll(handlers);
    expect(ev.prevented).toBe(false);
    expect(captured.warnings).toHaveLength(0);
  });

  it("обычная атака (не свободная): клик не перехватывается", () => {
    const { a, w } = fighter();
    showAttackDialog(a, w, {});
    const { form, handlers } = formWithRollButton("fullatk");
    captured.rerender(form);
    const ev = clickRoll(handlers);
    expect(ev.prevented).toBe(false);
  });
});
