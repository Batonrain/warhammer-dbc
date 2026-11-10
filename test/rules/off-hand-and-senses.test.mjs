// test/rules/off-hand-and-senses.test.mjs
// 1) Штраф −20 за неосновную руку при Парировании (книга, Defensive).
// 2) Необязательный выбор чувства на тестах Внимательности/Восприятия:
//    Оглох — автопровал слуха, Резонанс — −10×уровень к Восприятию и ещё −10×уровень к Слуху.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { offHandParryPenalty, offHandAttackPenalty, mainHandOf } from "../../module/rules/off-hand.mjs";
import { parryProfile } from "../../module/combat/defense.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { sensePickerShown, withSense } from "../../module/rules/awareness-talents.mjs";

function sword({ hand = null, props = [] } = {}) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, damage: "1d10", weaponProps: props }, { id: "sword", name: "Меч" });
  w.type = "weapon";
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "heldHand") ? hand : undefined;
  return w;
}
const user = (extra = {}) => actorFor({ skills: { parry: { rank: "expert" } }, ...extra });

describe("Неосновная рука: Парирование −20", () => {
  it("основная рука по умолчанию — правая; левша — left", () => {
    expect(mainHandOf(user())).toBe("right");
    expect(mainHandOf(user({ mainHand: "left" }))).toBe("left");
  });
  it("оружие в левой руке у правши — −20", () => {
    expect(offHandParryPenalty(user(), sword({ hand: "left" })).value).toBe(-20);
  });
  it("оружие в правой руке у правши — штрафа нет; у левши наоборот", () => {
    expect(offHandParryPenalty(user(), sword({ hand: "right" })).value).toBe(0);
    expect(offHandParryPenalty(user({ mainHand: "left" }), sword({ hand: "right" })).value).toBe(-20);
  });
  it("рука не назначена — штрафа нет", () => {
    expect(offHandParryPenalty(user(), sword({ hand: null })).value).toBe(0);
  });
  it("Защитное снимает штраф", () => {
    expect(offHandParryPenalty(user(), sword({ hand: "left" }), { defensive: true }).value).toBe(0);
  });
  it("порог Парирования в левой руке ниже на 20 и подпись видна в разбивке", () => {
    const main = parryProfile(user({ items: [sword({ hand: "right" })] }));
    const off  = parryProfile(user({ items: [sword({ hand: "left" })] }));
    expect(main.threshold - off.threshold).toBe(20);
    expect(off.modParts.join(" ")).toContain("неосновная рука");
    expect(main.modParts.join(" ")).not.toContain("неосновная рука");
  });
});

describe("Неосновная рука: тесты атаки WS/BS −20", () => {
  it("оружие в неосновной руке — −20; в основной — 0", () => {
    expect(offHandAttackPenalty(user(), sword({ hand: "left" })).value).toBe(-20);
    expect(offHandAttackPenalty(user(), sword({ hand: "right" })).value).toBe(0);
    expect(offHandAttackPenalty(user({ mainHand: "left" }), sword({ hand: "left" })).value).toBe(0);
  });
  it("Защитное штраф атаки НЕ снимает (только штраф Парирования)", () => {
    const w = sword({ hand: "left", props: [{ key: "defensive" }] });
    expect(offHandAttackPenalty(user(), w).value).toBe(-20);
    expect(offHandParryPenalty(user(), w, { defensive: true }).value).toBe(0);
  });
  it("рука не назначена — штрафа нет", () => {
    expect(offHandAttackPenalty(user(), sword({ hand: null })).value).toBe(0);
  });
  it("двуручное оружие штрафа не даёт", () => {
    const w = sword({ hand: "left" });
    w.system.grips = "2р";
    w.system.weaponClass = "basic";
    expect(offHandAttackPenalty(user(), w).value).toBe(0);
  });
});

describe("Чувство в тесте Внимательности", () => {
  beforeEach(() => resetCaptured());
  const test = (a, ctx) => resolveTest({ actor: a, kind: "skill", skill: "awareness", char: "per", ...ctx });

  it("выбор чувства показывается на Внимательности, Пристальности и тестах P", () => {
    expect(sensePickerShown({ skill: "awareness" })).toBe(true);
    expect(sensePickerShown({ skill: "scrutiny" })).toBe(true);
    expect(sensePickerShown({ char: "per" })).toBe(true);
    expect(sensePickerShown({ skill: "athletics", char: "s" })).toBe(false);
  });
  it("withSense принимает только пять чувств и снимается пустым значением", () => {
    expect(withSense({}, "hearing").sense).toBe("hearing");
    expect(withSense({ sense: "hearing" }, "").sense).toBeUndefined();
    expect(withSense({}, "telepathy").sense).toBeUndefined();
  });
  it("Оглох + Слух — автопровал; без выбора чувства или на Зрении — нет", () => {
    const a = actorFor({ conditions: { deafened: true } });
    expect(test(a, { sense: "hearing" }).autoFail.length).toBe(1);
    expect(test(a, {}).autoFail.length).toBe(0);
    expect(test(a, { sense: "sight" }).autoFail.length).toBe(0);
  });
  it("Резонанс 2: −20 к Восприятию всегда, на Слухе — ещё −20", () => {
    const a = actorFor({ conditions: { resonance: true, resonanceLevel: 2 } });
    const total = ctx => test(a, ctx).autoMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
    expect(total({})).toBe(-20);
    expect(total({ sense: "sight" })).toBe(-20);
    expect(total({ sense: "hearing" })).toBe(-40);
  });
});
