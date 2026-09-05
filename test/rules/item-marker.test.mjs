// test/rules/item-marker.test.mjs
//
// «Этот ли предмет X» — по ключу, а не по названию (wdbc-wdlw).
//
// Полтора десятка мест спрашивают не актора, а КОНКРЕТНЫЙ предмет: «эта ли
// Мутация — Освежёванный», «этот ли Талант — Пластина Короля». Возможность
// (rules/ability-by-key.mjs) сюда не годится — она живёт на акторе и вернуть
// сам предмет не может, а половина этих мест читает у найденного предмета его
// же поля.
//
// Ключ берётся из того же реестра, что и у возможностей актора: одно имя, два
// читателя — itemHasKey (этот предмет и есть X) и hasRuleFlag (у актора есть
// X). Это не совпадение, а одно утверждение с разных сторон.

import { describe, it, expect } from "vitest";
import { itemHasKey, itemIs } from "../../module/rules/item-marker.mjs";

/** Предмет с записью Конструктора «Возможность». */
const withKey = (item, key, extra = {}) => ({
  ...item,
  flags: { "warhammer-dbc": { mechanics: [{
    id: "g1", operator: "AND",
    entries: [{ id: "e1", kind: "capability", capabilityKey: key,
                when: { negate: false, conditions: [] }, ...extra }]
  }] } }
});

describe("itemHasKey", () => {
  it("находит ключ в записи предмета", () => {
    expect(itemHasKey(withKey({ type: "mutation", name: "Flayed" }, "mutation.flayed"), "mutation.flayed")).toBe(true);
  });

  it("чужой ключ не находит", () => {
    expect(itemHasKey(withKey({ type: "mutation" }, "mutation.flayed"), "mutation.janus")).toBe(false);
  });

  it("предмет без механики — нет ключа, и не падает", () => {
    expect(itemHasKey({ type: "mutation", name: "Flayed" }, "mutation.flayed")).toBe(false);
    expect(itemHasKey(null, "mutation.flayed")).toBe(false);
    expect(itemHasKey(undefined, "x")).toBe(false);
  });

  it("пустой ключ не находится никогда", () => {
    expect(itemHasKey(withKey({ type: "mutation" }, "mutation.flayed"), "")).toBe(false);
    expect(itemHasKey(withKey({ type: "mutation" }, "mutation.flayed"), null)).toBe(false);
  });

  it("читает и живой документ (getFlag), и сырые данные пака (flags)", () => {
    const raw = withKey({ type: "mutation" }, "mutation.flayed");
    const doc = { type: "mutation", getFlag: (ns, k) => (ns === "warhammer-dbc" && k === "mechanics"
      ? raw.flags["warhammer-dbc"].mechanics : undefined) };
    expect(itemHasKey(doc, "mutation.flayed")).toBe(true);
  });

  it("АКТИВНОСТЬ не проверяется: не вставленный имплант — всё ещё он сам", () => {
    // Вопрос про личность предмета, а не про то, работает ли он сейчас.
    const implant = withKey({ type: "implant", system: { equipped: false } }, "implant.blackCarapace");
    expect(itemHasKey(implant, "implant.blackCarapace")).toBe(true);
  });

  it("находит ключ во вложенной И-подгруппе", () => {
    const item = { type: "mutation", flags: { "warhammer-dbc": { mechanics: [{
      id: "g1", operator: "AND", entries: [
        { id: "e0", kind: "group", group: { id: "g2", operator: "AND", entries: [
          { id: "e1", kind: "capability", capabilityKey: "mutation.flayed" }] } }]
    }] } } };
    expect(itemHasKey(item, "mutation.flayed")).toBe(true);
  });

  it("записи ИЛИ-ветки не считаются — выбор в них делается при выдаче", () => {
    // Та же причина, что в rules/item-rules.mjs: личность предмета не может
    // зависеть от того, что игрок выбрал в диалоге при получении.
    const item = { type: "mutation", flags: { "warhammer-dbc": { mechanics: [{
      id: "g1", operator: "OR",
      entries: [{ id: "e1", kind: "capability", capabilityKey: "mutation.flayed" }]
    }] } } };
    expect(itemHasKey(item, "mutation.flayed")).toBe(false);
  });
});

describe("itemIs — тип плюс ключ, с именем как запасным путём", () => {
  it("опознаёт по ключу даже с чужим названием", () => {
    const renamed = withKey({ type: "mutation", name: "Совсем другое имя" }, "mutation.flayed");
    expect(itemIs(renamed, "mutation", "mutation.flayed", "Flayed")).toBe(true);
  });

  it("опознаёт по имени, пока ключа на предмете нет", () => {
    // Приём проекта «новое живёт рядом со старым»: пока паки не несут ключ,
    // старый путь обязан работать.
    expect(itemIs({ type: "mutation", name: "Flayed / Освежёванный" }, "mutation", "mutation.flayed", "Flayed")).toBe(true);
  });

  it("тип решает: та же Мутация под видом Таланта — не она", () => {
    const wrongType = withKey({ type: "talent", name: "Flayed" }, "mutation.flayed");
    expect(itemIs(wrongType, "mutation", "mutation.flayed", "Flayed")).toBe(false);
  });

  it("ни ключа, ни имени — не она", () => {
    expect(itemIs({ type: "mutation", name: "Другое" }, "mutation", "mutation.flayed", "Flayed")).toBe(false);
  });

  it("нет предмета — не падает", () => {
    expect(itemIs(null, "mutation", "mutation.flayed", "Flayed")).toBe(false);
  });
});
