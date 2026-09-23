// test/apps/mechanics-attack-prop-entry.test.mjs
//
// kind:"attackProp" (wdbc-rmrm9) — «Свойство атаки» в Конструкторе: атаки
// владельца выбранной области (безоружные/рукопашные/стрелковые/любые)
// получают Особое Свойство Оружия из constants/weapon-properties.mjs.
// ЖИВОЙ ЗАПРОС, как counterAttack/reroll — ничего не пишет при получении
// предмета, module/rules/item-rules.mjs собирает правило в момент атаки.
// Здесь проверяется только читаемое описание записи (describeMechEntry) и
// что она не заводит синтетический ActiveEffect на акторе; сама сборка
// правила grantWeaponProp — вне этой правки (item-rules.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { describeMechEntry, DURABLE_MECH_KINDS } from "../../module/apps/mechanics.mjs";

const entry = (over = {}) => ({ id: "e1", kind: "attackProp", apScope: "unarmed", apKey: "", apRating: "", apRating2: "", ...over });

describe("describeMechEntry — kind:attackProp", () => {
  it("Electric Arc — Дуга (7/2d10+T.b) на безоружных атаках", () => {
    expect(describeMechEntry(entry({ apKey: "arc", apRating: "7", apRating2: "2d10+T.b" })))
      .toBe("Свойство атаки: Безоружные атаки (Кулак/Пинок/…, интегральные) — Дуга (7/2d10+T.b)");
  });

  it("без рейтингов — только имя свойства", () => {
    expect(describeMechEntry(entry({ apKey: "shocking" })))
      .toBe("Свойство атаки: Безоружные атаки (Кулак/Пинок/…, интегральные) — Шокирующее");
  });

  it("свойство не выбрано", () => {
    expect(describeMechEntry(entry())).toBe("Свойство атаки: Безоружные атаки (Кулак/Пинок/…, интегральные) — (свойство не выбрано)");
  });

  it("область не выбрана", () => {
    expect(describeMechEntry(entry({ apScope: "" }))).toBe("Свойство атаки: (область не выбрана)");
  });

  it("рукопашная область", () => {
    expect(describeMechEntry(entry({ apScope: "melee", apKey: "tearing" })))
      .toBe("Свойство атаки: Рукопашные атаки — Рвущее");
  });
});

describe("attackProp не участвует в DURABLE_MECH_KINDS", () => {
  it("не создаёт синтетический ActiveEffect на акторе — живой запрос, читается прямо в момент атаки (wdbc-rmrm9)", () => {
    expect(DURABLE_MECH_KINDS.has("attackProp")).toBe(false);
  });
});
