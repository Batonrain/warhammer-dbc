// test/apps/elite-req-builder.test.mjs
//
// Конструктор требований на вкладке «МЕХАНИКА» Элитного архетипа. Проверяется
// разметка: у каждого вида записи свой набор полей, и разъехаться он не должен
// с тем, что читает правило (rules/elite-requirements.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { buildEliteReqHtml, eliteReqOf, blankEntry } from "../../module/apps/elite-req-builder.mjs";
import { REQ_KINDS } from "../../module/rules/elite-requirements.mjs";

const item = (requirements) => ({ system: { requirements } });

describe("Конструктор требований Элитного архетипа", () => {
  it("рисует оба блока даже у пустого архетипа", () => {
    const html = buildEliteReqHtml(item(undefined), true);
    expect(html).toContain('data-block="primary"');
    expect(html).toContain('data-block="secondary"');
    expect(html).toContain("ОБЯЗАТЕЛЬНЫЕ");
    expect(html).toContain("ВТОРИЧНЫЕ");
  });

  // Блоки различаются строгостью, а не тем, что в них можно потребовать.
  it("оба блока предлагают один и тот же набор видов записи", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "a", kind: "race" }], secondary: [{ id: "b", kind: "race" }]
    }), true);
    for (const k of REQ_KINDS) {
      expect(html.split(`value="${k.key}"`).length - 1).toBeGreaterThanOrEqual(2);
    }
  });

  it("раса, субраса, Черта и Талант — зона перетаскивания", () => {
    const html = buildEliteReqHtml(item({
      primary: [
        { id: "a", kind: "race",   name: "" },
        { id: "b", kind: "trait",  name: "Ген Навигатора" }
      ],
      secondary: [{ id: "c", kind: "talent", name: "" }]
    }), true);
    expect(html).toContain("Перетащите Расу сюда");
    expect(html).toContain("Ген Навигатора");
    expect(html).toContain("Перетащите Талант сюда");
  });

  it("Покровительство — выбор, и «не важно» в нём есть", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "a", kind: "patron", key: "khorne" }], secondary: []
    }), true);
    expect(html).toMatch(/<option value="khorne" selected>/);
    expect(html).toContain("— не важно —");
  });

  it("у прочих требований поля по виду: число, строка или Умение с рангом", () => {
    const html = buildEliteReqHtml(item({
      primary: [],
      secondary: [
        { id: "a", kind: "corruption", value: 30 },
        { id: "b", kind: "other", text: "Одобрение Гемункула" },
        { id: "c", kind: "skill", scope: "plain", skillKey: "acrobatics", rank: "veteran" }
      ]
    }), true);
    expect(html).toContain('data-field="value" value="30"');
    expect(html).toContain("Одобрение Гемункула");
    expect(html).toContain('data-field="rank"');
  });

  // Счётчик считает разные специализации, поэтому у записи с уже выбранной
  // специализацией считать нечего — там его и нет.
  it("счётчик появляется только там, где специализация не задана", () => {
    const free = buildEliteReqHtml(item({
      primary: [], secondary: [{ id: "a", kind: "talent", name: "Hatred", count: 3 }]
    }), true);
    const fixed = buildEliteReqHtml(item({
      primary: [], secondary: [{ id: "a", kind: "talent", name: "Hatred", specialization: "Астартес" }]
    }), true);

    expect(free).toContain('data-field="count"');
    expect(free).toContain('value="3"');
    expect(fixed).not.toContain('data-field="count"');
  });

  // «Мастерство» без привязки — не Талант, а пустое место: он владеет
  // конкретным Навыком. Требовать его «вообще» бессмысленно, поэтому у него
  // вместо счётчика обязательный выбор Навыка.
  it("у Мастерства вместо счётчика выбор Навыка со специализациями", () => {
    const html = buildEliteReqHtml(item({
      primary: [], secondary: [{ id: "a", kind: "talent", name: "Mastery / Мастерство" }]
    }), true);

    expect(html).toContain('data-field="specialization"');
    expect(html).toContain("Запретные знания (Демоны)");
    expect(html).toContain("— выберите Навык —");
    expect(html).not.toContain('data-field="count"');
  });

  it("групповой Навык без специализации тоже получает счётчик", () => {
    const html = buildEliteReqHtml(item({
      primary: [], secondary: [
        { id: "a", kind: "skill", scope: "group", skillKey: "forbiddenLore", rank: "knows", count: 2 }
      ]
    }), true);
    expect(html).toContain('data-field="count"');
  });

  it("ИЛИ-группа рисует вложенные строки и кнопку добавления в неё", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "g", kind: "or", items: [
        { id: "s1", kind: "corruption", value: 30 },
        { id: "s2", kind: "infamy", value: 40 }
      ] }],
      secondary: []
    }), true);

    expect(html).toContain("elite-req-group");
    expect(html).toContain('data-path="g/s1"');
    expect(html).toContain('data-path="g/s2"');
    expect(html).toContain("elite-req-add-sub");
  });

  // Вложенность одна: «одно из одного из» никому не нужно, а правку удвоило бы.
  it("внутри ИЛИ-группы вложенной группы не предлагают", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "g", kind: "or", items: [{ id: "s1", kind: "race" }] }], secondary: []
    }), true);
    const sub = html.slice(html.indexOf('data-path="g/s1"'));
    expect(sub.slice(0, sub.indexOf("</div>"))).not.toContain('value="or"');
  });

  it("без права правки поля выключены и кнопок добавления нет", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "a", kind: "patron", key: "any" }], secondary: []
    }), false);
    expect(html).toContain("disabled");
    expect(html).not.toContain("elite-req-add");
  });

  it("требования читаются копией — правка строки не задевает предмет", () => {
    const src = item({ primary: [{ id: "a", kind: "race", key: "human" }], secondary: [] });
    const req = eliteReqOf(src);
    req.primary[0].key = "astartes";
    expect(src.system.requirements.primary[0].key).toBe("human");
  });

  it("заготовка записи заводит поля своего вида", () => {
    expect(blankEntry("skill")).toMatchObject({ kind: "skill", scope: "plain", rank: "knows" });
    expect(blankEntry("or").items).toEqual([]);
    expect(blankEntry("corruption")).toMatchObject({ kind: "corruption", value: 0 });
  });
});
