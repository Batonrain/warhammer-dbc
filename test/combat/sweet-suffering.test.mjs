// test/combat/sweet-suffering.test.mjs
//
// Кнопка «Сладкое Страдание» на карточке Критического Эффекта: когда она
// рисуется и какие кнопки блока гасит. Без Foundry — фиктивные элементы.

import { describe, it, expect } from "vitest";
import { sweetSufferingHtml, dimIgnoredEffects } from "../../module/combat/sweet-suffering.mjs";

const slaanesh = { uuid: "Actor.a1", system: { alignment: "heretic", patronGod: "slaanesh" } };
const khorne   = { uuid: "Actor.a2", system: { alignment: "heretic", patronGod: "khorne" } };

describe("sweetSufferingHtml", () => {
  it("цели со Слаанеш и эффектом, который можно игнорировать, — кнопка", () => {
    const html = sweetSufferingHtml(slaanesh, { pills: [{ key: "fatigued" }] });
    expect(html).toContain("wh-sweet-suffering-btn");
    expect(html).toContain('data-actor-uuid="Actor.a1"');
  });

  it("другому Богу — ничего", () => {
    expect(sweetSufferingHtml(khorne, { pills: [{ key: "fatigued" }] })).toBe("");
  });

  it("если в карточке только то, что способность не отменяет, — кнопки нет", () => {
    // Оглушение и потеря руки с её Кровотечением остаются при любом исходе.
    const keep = [{ key: "stunned" }, { key: "lostArms" }, { key: "bleeding" }];
    expect(sweetSufferingHtml(slaanesh, { pills: keep })).toBe("");
  });

  it("урон в Характеристику или «Выронить» — тоже есть что игнорировать", () => {
    expect(sweetSufferingHtml(slaanesh, { pills: [], hasCharDamage: true })).not.toBe("");
    expect(sweetSufferingHtml(slaanesh, { pills: [], hasDrop: true })).not.toBe("");
  });
});

/** Фиктивная кнопка блока. */
function btn(cls, condKey) {
  const classes = new Set(cls.split(" "));
  return {
    dataset: { condKey }, disabled: false, title: "", classes,
    classList: { add: c => classes.add(c) }
  };
}

/** Фиктивный блок: querySelectorAll понимает список классов через запятую. */
function block(buttons) {
  return {
    querySelectorAll: sel => {
      const wanted = sel.split(",").map(s => s.trim().replace(/^\./, ""));
      return buttons.filter(b => wanted.some(w => b.classes.has(w)));
    }
  };
}

describe("dimIgnoredEffects", () => {
  it("гасит игнорируемое и оставляет потерю конечности, Оглушение, смерть", () => {
    const fat = btn("wh-crit-apply-btn", "fatigued");
    const stun = btn("wh-crit-apply-btn", "stunned");
    const hand = btn("wh-crit-apply-btn", "lostHands");
    const bleed = btn("wh-crit-apply-btn", "bleeding");
    const dmg = btn("wh-char-dmg-btn");
    const drop = btn("wh-crit-drop-btn");
    const death = btn("wh-crit-death-btn");
    const n = dimIgnoredEffects(block([fat, stun, hand, bleed, dmg, drop, death]));
    expect(fat.disabled).toBe(true);
    expect(dmg.disabled).toBe(true);
    expect(drop.disabled).toBe(true);
    // Остаются: Оглушение, потеря кисти и её Кровотечение, «Констатировать смерть».
    expect(stun.disabled).toBe(false);
    expect(hand.disabled).toBe(false);
    expect(bleed.disabled).toBe(false);
    expect(death.disabled).toBe(false);
    expect(n).toBe(3);
    expect(fat.classes.has("wh-crit-ignored")).toBe(true);
  });

  it("пустой или отсутствующий блок не роняет", () => {
    expect(dimIgnoredEffects(null)).toBe(0);
    expect(dimIgnoredEffects(block([]))).toBe(0);
  });
});
