// test/combat/pounce.test.mjs
//
// Pounce / Наскок (Пугилист, стр. 62; Sahara 3-eddb): Захват с Базы «Натиск»,
// победа в Athletics на 3+ Успеха → свободный Повалить; при 5+ Успехов в
// Повалить — схватить 2+ руками, упасть, свободные Сжать и Заломить.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { resolveGrappleSuccess, pounceAction, GRAPPLE_HANDS_FLAG } from "../../module/combat/grapple.mjs";
import { pounceOffered, pounceGrabOffered } from "../../module/combat/grapple-talents.mjs";

const NS = "warhammer-dbc";
const POUNCE = { id: "pc", name: "Pounce / Наскок", type: "talent", system: {} };

function fighter(name, uuid, { items = [], meleeBase = "standard" } = {}) {
  const flags = {};
  const a = actorFor({ items, meleeBase, conditions: { grappling: false } });
  a.name = name; a.uuid = uuid; a.id = uuid;
  a.updates = [];
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; };
  a.unsetFlag = async (_s, k) => { delete flags[k]; };
  a.update = async changes => {
    a.updates.push(changes);
    for (const [p, v] of Object.entries(changes)) {
      let m = p.match(/^flags\.[^.]+\.-=(.+)$/);
      if (m) { delete flags[m[1]]; continue; }
      m = p.match(/^flags\.[^.]+\.(.+)$/);
      if (m) flags[m[1]] = v;
    }
  };
  a._flags = flags;
  return a;
}

beforeEach(() => resetCaptured());

describe("пороги Наскока", () => {
  it("Захват с Натиска: 3+ Успеха — предложено; 2 или другая База — нет", () => {
    expect(pounceOffered({ baseKey: "charge", margin: 3 })).toBe(true);
    expect(pounceOffered({ baseKey: "charge", margin: 2 })).toBe(false);
    expect(pounceOffered({ baseKey: "standard", margin: 9 })).toBe(false);
  });
  it("вторая часть — 5+ Успехов", () => {
    expect([4, 5].map(pounceGrabOffered)).toEqual([false, true]);
  });
});

describe("resolveGrappleSuccess: кнопка Наскока", () => {
  const cards = () => captured.chat.map(m => m.content).join("\n");
  it("Талант + Натиск + 3 Успеха → кнопка Повалить", async () => {
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", { items: [POUNCE], meleeBase: "charge" }),
      { target: fighter("Жертва", "Actor.b"), margin: 3 });
    expect(cards()).toContain('class="wh-pounce-btn"');
    expect(cards()).toContain('data-stage="knockdown"');
  });
  it("2 Успеха, не Натиск, без Таланта — кнопки нет", async () => {
    const foe = fighter("Жертва", "Actor.b");
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", { items: [POUNCE], meleeBase: "charge" }), { target: foe, margin: 2 });
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", { items: [POUNCE] }), { target: foe, margin: 9 });
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", { meleeBase: "charge" }), { target: foe, margin: 9 });
    expect(cards()).not.toContain("wh-pounce-btn");
  });
});

describe("pounceAction", () => {
  function held() {
    const me = fighter("Борец", "Actor.a", { items: [POUNCE], meleeBase: "charge" });
    const foe = fighter("Жертва", "Actor.b");
    me._flags.grappleRole = "attacker";
    me._flags.grapplePartnerUuid = foe.uuid;
    foe._flags.grappleRole = "target";
    foe._flags.grapplePartnerUuid = me.uuid;
    globalThis.fromUuidSync = uuid => (uuid === foe.uuid ? foe : uuid === me.uuid ? me : null);
    return { me, foe };
  }

  it("stage knockdown: открывается состязание «Наскок: Повалить» без траты ОД", async () => {
    const { me } = held();
    await pounceAction(me, "knockdown");
    expect(captured.dialog?.content ?? "").toContain("Наскок: Повалить");
  });

  it("stage grab: 2+ руки, Ничком у наскочившего, свободное Сжать, затем Заломить (Наскок)", async () => {
    const { me, foe } = held();
    await pounceAction(me, "grab");
    expect(me.getFlag(NS, GRAPPLE_HANDS_FLAG)).toBeGreaterThanOrEqual(2);
    expect(me.updates.some(u => u["system.conditions.prone"] === true)).toBe(true);
    expect(foe.getFlag(NS, "grappleSqueezePending")).toBe(1);
    expect(captured.dialog?.content ?? "").toContain("Заломить (Наскок)");
  });

  it("claim (раз на карточку): knockdown — зовётся по «Бросок!», а не при открытии окна; отказ — броска нет", async () => {
    const { me } = held();
    let claimed = 0;
    await pounceAction(me, "knockdown", { claim: async () => { claimed++; return false; } });
    expect(claimed).toBe(0);                               // окно открыто — карточка ещё не занята
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "s", "#contest-self": "20", "#contest-mod": "0" }));
    expect(claimed).toBe(1);
    expect(captured.chat.length).toBe(0);                  // claim отказал — свободный Повалить не брошен
  });

  it("claim: grab — карточка занята, Ничком и Сжать второй раз не ставятся", async () => {
    const { me, foe } = held();
    await pounceAction(me, "grab", { claim: async () => false });
    expect(me.updates.some(u => u["system.conditions.prone"] === true)).toBe(false);
    expect(foe.getFlag(NS, "grappleSqueezePending")).toBeUndefined();
    expect(captured.dialog).toBeFalsy();
  });

  it("claim: grab — повторный клик по занятой карточке НЕ поднимает число держащих рук (Sahara riding-the-momentum, п. 3)", async () => {
    const { me, foe } = held();
    me._flags[GRAPPLE_HANDS_FLAG] = 1;
    await pounceAction(me, "grab", { claim: async () => false });
    expect(me.getFlag(NS, GRAPPLE_HANDS_FLAG)).toBe(1);
    expect(foe.getFlag(NS, "grappleHeldHands")).toBeUndefined();
  });

  it("claim: grab — карточка свободна, действие проходит", async () => {
    const { me } = held();
    let claimed = 0;
    await pounceAction(me, "grab", { claim: async () => { claimed++; return true; } });
    expect(claimed).toBe(1);
    expect(me.updates.some(u => u["system.conditions.prone"] === true)).toBe(true);
  });

  it("не держащий в Борьбе, без Таланта — ничего не делает", async () => {
    const { me } = held();
    me._flags.grappleRole = "target";
    await pounceAction(me, "grab");
    expect(captured.warnings.some(w => w.includes("держащему"))).toBe(true);
    const plain = fighter("Обычный", "Actor.c");
    resetCaptured();
    await pounceAction(plain, "knockdown");
    expect(captured.dialog).toBeFalsy();
  });
});
