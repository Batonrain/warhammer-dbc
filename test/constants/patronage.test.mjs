import { describe, it, expect } from "vitest";
import {
  godRelationCat, skillGodOf, skillPatronCat, talentGodKeyOf, talentPatronCat,
  CHAR_STEREOTYPES, charStereotypesFor, charPatronCat, mixedCat, PRICING_MODES,
  worldAdvancePricingMode, effectivePricingMode
} from "../../module/constants/patronage.mjs";

describe("матрица отношений Богов", () => {
  it("Бог сам к себе — Союзный", () => {
    expect(godRelationCat("khorne", "khorne")).toBe("ally");
    expect(godRelationCat("slaanesh", "slaanesh")).toBe("ally");
  });
  it("крест-накрест враждебные пары", () => {
    expect(godRelationCat("khorne", "slaanesh")).toBe("enemy");
    expect(godRelationCat("slaanesh", "khorne")).toBe("enemy");
    expect(godRelationCat("nurgle", "tzeentch")).toBe("enemy");
    expect(godRelationCat("tzeentch", "nurgle")).toBe("enemy");
  });
  it("прочие пары Богов — Нейтральные", () => {
    expect(godRelationCat("khorne", "nurgle")).toBe("neutral");
    expect(godRelationCat("khorne", "tzeentch")).toBe("neutral");
    expect(godRelationCat("slaanesh", "nurgle")).toBe("neutral");
    expect(godRelationCat("slaanesh", "tzeentch")).toBe("neutral");
  });
  it("Неделимый (и пустое значение) всегда Нейтрален — даже сам к себе", () => {
    expect(godRelationCat("undivided", "undivided")).toBe("neutral");
    expect(godRelationCat("", "")).toBe("neutral");
    expect(godRelationCat("khorne", "undivided")).toBe("neutral");
    expect(godRelationCat("khorne", "")).toBe("neutral");
  });
});

describe("Бог Навыка", () => {
  it("прямой Бог по таблице книги", () => {
    expect(skillGodOf("dodge")).toBe("slaanesh");
    expect(skillGodOf("athletics")).toBe("khorne");
    expect(skillGodOf("awareness")).toBe("undivided");
  });
  it("исключение: Forbidden Lore (Heresy) — Нургл вместо Тзинча группы", () => {
    expect(skillGodOf("forbiddenLore")).toBe("tzeentch");
    expect(skillGodOf("forbiddenLore", "Heresy")).toBe("nurgle");
    expect(skillGodOf("forbiddenLore", "Daemons")).toBe("tzeentch");
  });
  it("skillPatronCat считает отношение Бог Навыка ↔ Бог персонажа", () => {
    expect(skillPatronCat("dodge", "", "slaanesh")).toBe("ally");
    expect(skillPatronCat("dodge", "", "khorne")).toBe("enemy");
    expect(skillPatronCat("dodge", "", "nurgle")).toBe("neutral");
  });
});

describe("Бог Таланта (из TALENT_LIBRARY)", () => {
  it("реальные записи библиотеки", () => {
    expect(talentGodKeyOf("Combat Formation / Боевое Построение")).toBe("tzeentch");
    expect(talentGodKeyOf("Combat Sense / Чувство Боя")).toBe("undivided");
    expect(talentGodKeyOf("Lightning Reflexes / Молниеносные Рефлексы")).toBe("slaanesh");
  });
  it("незнакомое имя (Элитный Архетип, руками заведённый ГМом) — Неделимый/Нейтрально", () => {
    expect(talentGodKeyOf("Такого таланта нет")).toBe("undivided");
  });
  it("talentPatronCat", () => {
    expect(talentPatronCat("Lightning Reflexes / Молниеносные Рефлексы", "slaanesh")).toBe("ally");
    expect(talentPatronCat("Lightning Reflexes / Молниеносные Рефлексы", "khorne")).toBe("enemy");
  });
});

describe("стереотипы Покровительства для Характеристик", () => {
  it("12 стереотипов, по 3 на Бога", () => {
    expect(CHAR_STEREOTYPES).toHaveLength(12);
    for (const god of ["slaanesh", "nurgle", "khorne", "tzeentch"]) {
      expect(charStereotypesFor(god)).toHaveLength(3);
    }
  });
  it("союзная и враждебные характеристики по книге (Танцор Клинка)", () => {
    expect(charPatronCat("ag", "slaanesh", "slaanesh-dancer")).toBe("ally");
    expect(charPatronCat("int", "slaanesh", "slaanesh-dancer")).toBe("enemy");
    expect(charPatronCat("t", "slaanesh", "slaanesh-dancer")).toBe("enemy");
    expect(charPatronCat("s", "slaanesh", "slaanesh-dancer")).toBe("neutral");
  });
  it("без Покровителя или без стереотипа — всегда Нейтрально", () => {
    expect(charPatronCat("ag", "", "")).toBe("neutral");
    expect(charPatronCat("ag", "slaanesh", "")).toBe("neutral");
  });
  it("стереотип чужого Бога не действует (защита от рассинхрона данных)", () => {
    expect(charPatronCat("ag", "khorne", "slaanesh-dancer")).toBe("neutral");
  });
});

describe("Смешанная система — таблица комбинаций", () => {
  it("все 9 комбинаций по книге", () => {
    expect(mixedCat("ally", "ally")).toBe("ally");
    expect(mixedCat("ally", "neutral")).toBe("ally");
    expect(mixedCat("ally", "enemy")).toBe("neutral");
    expect(mixedCat("neutral", "ally")).toBe("ally");
    expect(mixedCat("neutral", "neutral")).toBe("neutral");
    expect(mixedCat("neutral", "enemy")).toBe("enemy");
    expect(mixedCat("enemy", "ally")).toBe("neutral");
    expect(mixedCat("enemy", "neutral")).toBe("enemy");
    expect(mixedCat("enemy", "enemy")).toBe("enemy");
  });
});

describe("режим цены — мировой и per-actor", () => {
  it("PRICING_MODES перечисляет три режима", () => {
    expect(Object.keys(PRICING_MODES).sort()).toEqual(["aptitude", "mixed", "patronage"]);
  });
  it("без game.settings — фолбэк на Склонности (прежнее единственное поведение)", () => {
    expect(worldAdvancePricingMode()).toBe("aptitude");
  });
  it("effectivePricingMode: personal-оверрайд важнее мирового", () => {
    const actor = { system: { pricingModeOverride: "patronage" } };
    expect(effectivePricingMode(actor)).toBe("patronage");
    expect(effectivePricingMode({ system: { pricingModeOverride: "" } })).toBe("aptitude");
  });
});
