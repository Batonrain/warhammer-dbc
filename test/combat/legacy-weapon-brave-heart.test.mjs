// test/combat/legacy-weapon-brave-heart.test.mjs
//
// braveHeartLegacyButtonHtml (module/combat/legacy-weapon-brave-heart.mjs) —
// Лучшая Часть Отваги/skilled 5-6, стрелковая ветка (wdbc-1rno.35, стр. 427).

import { describe, it, expect } from "vitest";
import { braveHeartLegacyButtonHtml } from "../../module/combat/legacy-weapon-brave-heart.mjs";

function weapon(mutationName, cls = "basic") {
  return {
    id: "w1", name: "Лазган", type: "weapon",
    system: { weaponClass: cls, legacy: { active: true, mutations: [{ name: mutationName }] } }
  };
}

describe("braveHeartLegacyButtonHtml", () => {
  it("стрелковое с Мутацией и attackerUuid — кнопка есть", () => {
    const html = braveHeartLegacyButtonHtml(weapon("Лучшая Часть Отваги"), "Actor.attacker1");
    expect(html).toContain("wh-legacy-brave-heart-btn");
    expect(html).toContain('data-actor-uuid="Actor.attacker1"');
  });

  it("рукопашное с той же Мутацией — пусто", () => {
    const html = braveHeartLegacyButtonHtml(weapon("Лучшая Часть Отваги", "melee"), "Actor.attacker1");
    expect(html).toBe("");
  });

  it("без Мутации — пусто", () => {
    const w = weapon("Другая");
    expect(braveHeartLegacyButtonHtml(w, "Actor.attacker1")).toBe("");
  });

  it("нет attackerUuid — пусто", () => {
    expect(braveHeartLegacyButtonHtml(weapon("Лучшая Часть Отваги"), "")).toBe("");
  });

  it("нет оружия — пусто", () => {
    expect(braveHeartLegacyButtonHtml(null, "Actor.attacker1")).toBe("");
  });
});
