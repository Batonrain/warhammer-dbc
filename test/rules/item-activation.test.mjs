// test/rules/item-activation.test.mjs
//
// «Потратить Очко Бесчестия — до конца боя/сцены получить X»: флаг activated
// на предмете и гейт when.requireActivated. Сторож того, что записи «пока
// включено» молчат без флага и работают с ним, и что конец ЧУЖОГО боя
// активацию не снимает.

import { describe, it, expect } from "vitest";
import { activationState, isItemActivated, activationData, endsWithCombat, hasActivationGatedEntries,
  activationExpired, endsWithScene }
  from "../../module/rules/item-activation.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const NS = "warhammer-dbc";
const on = (state = { combatId: "c1", at: 0 }) => ({ flags: { [NS]: { activated: state } } });
const actor = { system: { geneSeed: {}, bio: { age: 0 } }, items: [] };

describe("состояние активации", () => {
  it("нет флага — выключено", () => {
    expect(isItemActivated({ flags: {} })).toBe(false);
    expect(activationState(null)).toBeNull();
  });
  it("флаг-объект — включено", () => expect(isItemActivated(on())).toBe(true));
  it("activationData нормализует поля", () => {
    expect(activationData({ combatId: null, at: "5" })).toEqual({ combatId: "", at: 5 });
  });
});

describe("endsWithCombat", () => {
  it("конец своего боя снимает", () => expect(endsWithCombat({ combatId: "c1" }, "c1")).toBe(true));
  it("конец чужого боя — нет", () => expect(endsWithCombat({ combatId: "c1" }, "c2")).toBe(false));
  it("включённое вне боя бой не снимает", () => expect(endsWithCombat({ combatId: "" }, "c1")).toBe(false));
});

describe("гейт when.requireActivated", () => {
  const entry = { when: { requireActivated: true } };
  it("без флага запись молчит", () => expect(entryWhenOk(actor, entry, { flags: {} })).toBe(false));
  it("с флагом — действует", () => expect(entryWhenOk(actor, entry, on())).toBe(true));
  it("запись без гейта от флага не зависит", () => expect(entryWhenOk(actor, {}, { flags: {} })).toBe(true));
});

describe("hasActivationGatedEntries", () => {
  it("находит гейт и во вложенной группе", () => {
    expect(hasActivationGatedEntries([{ entries: [{ kind: "group", group: { entries: [{ when: { requireActivated: true } }] } }] }])).toBe(true);
    expect(hasActivationGatedEntries([{ entries: [{ kind: "testMod" }] }])).toBe(false);
  });
});

// Срок в минутах (Боевая форма Вампира: Cor.b×10 минут, Sahara
// 583-deadly-natural-weapons-fear-flyer): until — момент worldTime. Такую
// активацию снимает ход «Летоисчисления», а не конец боя и не «Новая сцена».
describe("срок по worldTime (until)", () => {
  it("activationData пишет until только при сроке", () => {
    expect(activationData({ combatId: "c1", at: 100, until: 700 })).toEqual({ combatId: "c1", at: 100, until: 700 });
    expect(activationData({ at: 100, until: 0 })).toEqual({ combatId: "", at: 100 });
  });
  it("истекает, когда worldTime дошёл до until", () => {
    const st = { combatId: "", at: 100, until: 700 };
    expect(activationExpired(st, 699)).toBe(false);
    expect(activationExpired(st, 700)).toBe(true);
    expect(activationExpired({ combatId: "c1", at: 0 }, 1e9)).toBe(false);
    expect(activationExpired(null, 1e9)).toBe(false);
  });
  it("срочную активацию не снимают ни конец боя, ни новая сцена", () => {
    expect(endsWithCombat({ combatId: "c1", until: 700 }, "c1")).toBe(false);
    expect(endsWithScene({ combatId: "", until: 700 })).toBe(false);
    expect(endsWithScene({ combatId: "c1", at: 0 })).toBe(true);
  });
});
