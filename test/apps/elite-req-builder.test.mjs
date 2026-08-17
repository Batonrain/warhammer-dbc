// test/apps/elite-req-builder.test.mjs
//
// Конструктор требований на вкладке «ИНФО» Элитного архетипа. Проверяется
// разметка: у каждого вида записи свой набор полей, и разъехаться он не должен
// с тем, что читает правило (rules/elite-requirements.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { buildEliteReqHtml, eliteReqOf } from "../../module/apps/elite-req-builder.mjs";

const item = (requirements) => ({ system: { requirements } });

describe("Конструктор требований Элитного архетипа", () => {
  it("рисует все три блока даже у пустого архетипа", () => {
    const html = buildEliteReqHtml(item(undefined), true);
    expect(html).toContain('data-block="primary"');
    expect(html).toContain('data-block="secondary"');
    expect(html).toContain('data-block="talents"');
  });

  it("раса, субраса и Черта — зона перетаскивания, Покровительство — выбор", () => {
    const html = buildEliteReqHtml(item({
      primary: [
        { id: "a", kind: "race",   name: "" },
        { id: "b", kind: "trait",  name: "Ген Навигатора" },
        { id: "c", kind: "patron", key: "khorne" }
      ], secondary: [], talents: []
    }), true);
    expect(html).toContain("Перетащите Расу сюда");
    expect(html).toContain("Ген Навигатора");
    expect(html).toMatch(/<option value="khorne" selected>/);
  });

  it("у прочих требований поля по виду: число, строка или Умение с рангом", () => {
    const html = buildEliteReqHtml(item({
      primary: [],
      secondary: [
        { id: "a", kind: "corruption", value: 30 },
        { id: "b", kind: "other", text: "Одобрение Гемункула" },
        { id: "c", kind: "skill", scope: "plain", skillKey: "acrobatics", rank: "veteran" }
      ], talents: []
    }), true);
    expect(html).toContain('data-field="value" value="30"');
    expect(html).toContain("Одобрение Гемункула");
    expect(html).toContain('data-field="rank"');
  });

  it("без права правки поля выключены и кнопки добавления нет", () => {
    const html = buildEliteReqHtml(item({
      primary: [{ id: "a", kind: "patron", key: "any" }], secondary: [], talents: []
    }), false);
    expect(html).toContain("disabled");
    expect(html).not.toContain("elite-req-add");
  });

  it("требования читаются копией — правка строки не задевает предмет", () => {
    const src = item({ primary: [{ id: "a", kind: "race", key: "human" }], secondary: [], talents: [] });
    const req = eliteReqOf(src);
    req.primary[0].key = "astartes";
    expect(src.system.requirements.primary[0].key).toBe("human");
  });
});
