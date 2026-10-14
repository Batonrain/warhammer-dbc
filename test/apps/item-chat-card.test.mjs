// test/apps/item-chat-card.test.mjs
//
// Постинг предмета в чат (wdbc-6rj), по образцу Dark Heresy: карточка с
// ключевыми цифрами по типу предмета + Описание, и короткая — только
// название и Описание.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { postItemFullCard, postItemShortCard } from "../../module/apps/item-chat-card.mjs";

function itemFor(type, system = {}, overrides = {}) {
  return { id: "item-1", name: "Тестовый предмет", img: "icons/test.svg", type, system, actor: null, ...overrides };
}

beforeEach(() => resetCaptured());

describe("postItemFullCard", () => {
  it("оружие: показывает Класс/Дальность/Урон/Пробитие и Описание", async () => {
    const weapon = itemFor("weapon", {
      weaponClass: "basic", range: 100, rof_single: 1, rof_semi: 3, rof_full: 0,
      damage: "1d10+5", damageType: "energy", penetration: 4, magazineMax: 24,
      quality: "good", availability: -1, weight: 4.5, weaponProps: [],
      description: "<p>Лазган.</p>"
    }, { name: "Лазган" });

    await postItemFullCard(weapon);

    const html = captured.chat[0].content;
    expect(html).toContain("Лазган");
    expect(html).toContain("Дальность");
    expect(html).toContain("100");
    expect(html).toContain("1d10+5");
    expect(html).toContain("Пробитие");
    expect(html).toContain("4");
    expect(html).toContain("Лазган.");
  });

  it("талант: показывает Требование/Тир/Польза", async () => {
    const talent = itemFor("talent", {
      requirement: "S 45", tier: 2, benefit: "Снимает штраф.", description: ""
    }, { name: "Bulging Biceps / Бугрящиеся Мышцы" });

    await postItemFullCard(talent);

    const html = captured.chat[0].content;
    expect(html).toContain("Требование");
    expect(html).toContain("S 45");
    expect(html).toContain("Снимает штраф.");
  });

  it("тип без заведённого блока цифр — карточка не падает, просто без цифр", async () => {
    const power = itemFor("psychicPower", { description: "<p>Молния.</p>" }, { name: "Chain Lightning" });

    await postItemFullCard(power);

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Молния.");
  });
});

describe("postItemShortCard", () => {
  it("только название и Описание — без цифр оружия", async () => {
    const weapon = itemFor("weapon", {
      weaponClass: "basic", damage: "1d10+5", penetration: 4,
      description: "<p>Короткое описание.</p>"
    }, { name: "Лазган" });

    await postItemShortCard(weapon);

    const html = captured.chat[0].content;
    expect(html).toContain("Лазган");
    expect(html).toContain("Короткое описание.");
    expect(html).not.toContain("Пробитие");
  });
});
