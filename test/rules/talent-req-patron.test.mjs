// Две формы требований, впервые понадобившиеся Талантам Дредноутов
// (Книга Машин, стр. 58): «Покровительство Кхорна» и «Hatred (любой)».
//
// До них разборщик первую помечал как прозу (unknown), а вторую честно
// проваливал: скобку он читает как конкретную специализацию, и «любой»
// не совпадал ни с одной. Обе формы книжные, обе повторяемые.

import { describe, it, expect } from "vitest";
import { checkRequirement } from "../../module/constants/talent-requirements.mjs";

const actor = ({ patron = "", talents = [] } = {}) => ({
  system: { characteristics: {}, skills: {}, groupSkills: {}, patronGod: patron },
  items: talents.map(t => typeof t === "string"
    ? { type: "talent", name: t, system: {} }
    : { type: "talent", name: t.name, system: { specialization: t.spec } })
});

describe("«Покровительство <Бога>»", () => {
  it("выполнено, когда покровитель совпадает", () => {
    expect(checkRequirement(actor({ patron: "khorne" }), "Покровительство Кхорна").state).toBe("ok");
  });

  it("не выполнено при другом покровителе", () => {
    const r = checkRequirement(actor({ patron: "nurgle" }), "Покровительство Кхорна");
    expect(r.state).toBe("fail");
    expect(r.unmet).toEqual(["Покровительство Кхорна"]);
  });

  it("не выполнено, когда покровителя нет вовсе", () => {
    expect(checkRequirement(actor(), "Покровительство Слаанеш").state).toBe("fail");
  });

  it("понимает всех четверых и Неделимого", () => {
    for (const [key, text] of [["slaanesh", "Слаанеш"], ["nurgle", "Нургла"],
                               ["tzeentch", "Тзинча"], ["undivided", "Неделимого"]]) {
      expect(checkRequirement(actor({ patron: key }), `Покровительство ${text}`).state).toBe("ok");
    }
  });

  it("незнакомого бога прозой не считает выполненным, но и не валит", () => {
    expect(checkRequirement(actor({ patron: "khorne" }), "Покровительство Малала").state)
      .toBe("unknown");
  });
});

describe("«Талант (любой)» — любая специализация", () => {
  it("выполнено при любой специализации", () => {
    expect(checkRequirement(actor({ talents: [{ name: "Hatred", spec: "Псайкеры" }] }),
      "Hatred (любой)").state).toBe("ok");
  });

  it("выполнено и когда специализация записана прямо в имени", () => {
    expect(checkRequirement(actor({ talents: ["Hatred (Трусы)"] }), "Hatred (любой)").state).toBe("ok");
  });

  it("не выполнено, когда таланта нет совсем", () => {
    expect(checkRequirement(actor({ talents: ["Frenzy"] }), "Hatred (любой)").state).toBe("fail");
  });

  it("«любая» и «any» работают так же — книга пишет по-разному", () => {
    const a = actor({ talents: [{ name: "Resistance", spec: "Fear" }] });
    expect(checkRequirement(a, "Resistance (любая)").state).toBe("ok");
    expect(checkRequirement(a, "Resistance (any)").state).toBe("ok");
  });

  it("конкретная специализация по-прежнему спрашивается строго", () => {
    const a = actor({ talents: [{ name: "Hatred", spec: "Псайкеры" }] });
    expect(checkRequirement(a, "Hatred (Трусы)").state).toBe("fail");
  });
});
