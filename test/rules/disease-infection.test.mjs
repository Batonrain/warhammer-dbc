// test/rules/disease-infection.test.mjs
//
// Тест заражения болезнью (wdbc-dbveg): единого теста книга не даёт (core стр.
// 470 — на откуп ГМу), но у болезней в «Путях передачи» лежат конкретные T±N.
// Чистая часть: какие векторы у болезни, Порог теста, остановка иммунитетом
// Метки Нургла. Бросок и карточка — module/combat/disease-infection.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments } from "../support/pack-docs.mjs";
import {
  diseaseVectors, vectorLabel, infectionPlan, infectionBlockedBy
} from "../../module/rules/disease-infection.mjs";
import { effectAppliesTo } from "../../module/rules/resolve-test.mjs";
import { isItemActive } from "../../module/apps/effects.mjs";

const enName = d => d.name.split("/")[0].trim();
const TRAITS = allPackDocuments("traits").map(d => d.doc);
const DISEASES = allPackDocuments("diseases").map(d => d.doc);

const disease = vectorTests => ({ type: "disease", name: "Болезнь", system: { vectorTests } });

describe("diseaseVectors — структурные векторы болезни", () => {
  it("отдаёт векторы как есть, с T по умолчанию", () => {
    const v = diseaseVectors(disease([{ label: "Кожа-к-коже", mod: 20 }, { label: "Жидкости", char: "t", mod: -10 }]));
    expect(v).toEqual([
      { label: "Кожа-к-коже", char: "t", mod: 20 },
      { label: "Жидкости", char: "t", mod: -10 }
    ]);
  });

  it("мусорные строки отбрасываются: без подписи — «Заражение», нечисловой модификатор — 0", () => {
    const v = diseaseVectors(disease([{ label: "", mod: "abc" }, null, { label: "Дым", mod: "30" }]));
    expect(v).toEqual([
      { label: "Заражение", char: "t", mod: 0 },
      { label: "Дым", char: "t", mod: 30 }
    ]);
  });

  it("поля нет (старая копия на акторе) или это не болезнь — пусто", () => {
    expect(diseaseVectors({ type: "disease", system: {} })).toEqual([]);
    expect(diseaseVectors(null)).toEqual([]);
  });
});

describe("vectorLabel — подпись «Кожа-к-коже T+20»", () => {
  it("знак и величина", () => {
    expect(vectorLabel({ label: "Кожа-к-коже", char: "t", mod: 20 })).toBe("Кожа-к-коже T+20");
    expect(vectorLabel({ label: "Жидкости", char: "t", mod: -10 })).toBe("Жидкости T−10");
    expect(vectorLabel({ label: "Дым", char: "t", mod: 0 })).toBe("Дым T+0");
  });
});

describe("infectionPlan — Порог теста заражения", () => {
  const actor = t => ({ system: { characteristics: { t: { total: t }, wp: { total: 33 } } } });

  it("T плюс модификатор вектора", () => {
    expect(infectionPlan(actor(40), { label: "x", char: "t", mod: 20 })).toMatchObject({ base: 40, mod: 20, threshold: 60, charLabel: "T" });
    expect(infectionPlan(actor(40), { label: "x", char: "t", mod: -30 }).threshold).toBe(10);
  });

  it("другая характеристика вектора берётся с актора", () => {
    expect(infectionPlan(actor(40), { label: "x", char: "wp", mod: 0 })).toMatchObject({ base: 33, threshold: 33 });
  });

  it("нет характеристики — база 0, не NaN", () => {
    expect(infectionPlan({ system: { characteristics: {} } }, { label: "x", char: "t", mod: 10 }).threshold).toBe(10);
  });
});

describe("область теста «disease» в конвейере правил", () => {
  it("срабатывает только на тесте заражения, а не на любом тесте T", () => {
    expect(effectAppliesTo("disease", { diseaseTest: true })).toBe(true);
    expect(effectAppliesTo("disease", { kind: "skill", char: "t" })).toBe(false);
    expect(effectAppliesTo("disease", { poisonTest: true })).toBe(false);
  });
});

describe("infectionBlockedBy — Метка Нургла не заражается", () => {
  const NURGLE = TRAITS.find(d => enName(d) === "Mark of Nurgle");
  const SLAANESH = TRAITS.find(d => enName(d) === "Mark of Slaanesh");
  const ROT = DISEASES.find(d => enName(d) === "Nurgle's Rot");

  const owned = (doc, actor, id) => {
    const item = { id, name: doc.name, type: doc.type, system: structuredClone(doc.system ?? {}), flags: structuredClone(doc.flags ?? {}), parent: actor };
    item.getFlag = (s, k) => item.flags?.[s]?.[k];
    return item;
  };
  const actorWith = docs => {
    const a = { system: { characteristics: {} }, items: [] };
    docs.forEach((d, i) => a.items.push(owned(d, a, `i${i}`)));
    return a;
  };

  it("данные на месте: Метка Нургла и Гниль Нургла из packs-src", () => {
    expect(NURGLE && SLAANESH && ROT).toBeTruthy();
  });

  it("носитель Метки Нургла — заражение остановлено, называется причина", () => {
    const reason = infectionBlockedBy(actorWith([NURGLE]), isItemActive);
    expect(reason).toMatch(/Метка Нургла/);
  });

  it("без Метки (или с чужой) — заражение возможно", () => {
    expect(infectionBlockedBy(actorWith([]), isItemActive)).toBeNull();
    expect(infectionBlockedBy(actorWith([SLAANESH]), isItemActive)).toBeNull();
  });

  it("сама болезнь иммунитета не даёт (Гниль на акторе без Метки)", () => {
    expect(infectionBlockedBy(actorWith([ROT]), isItemActive)).toBeNull();
  });

  it("выключенная Метка (isActive → false) не защищает", () => {
    expect(infectionBlockedBy(actorWith([NURGLE]), () => false)).toBeNull();
  });
});

describe("Струп (core стр. 279) — иммунитет к болезням на время действия препарата", () => {
  const SCAB = allPackDocuments("chemistry").map(d => d.doc).find(d => enName(d) === "Scab");

  const owned = (doc, actor, active) => {
    const item = { id: "s1", name: doc.name, type: doc.type, system: structuredClone(doc.system), flags: structuredClone(doc.flags ?? {}), parent: actor };
    item.system.activeEffect = { ...item.system.activeEffect, ...active };
    item.getFlag = (s, k) => item.flags?.[s]?.[k];
    return item;
  };
  const actorWith = active => {
    const a = { system: { characteristics: {} }, items: [] };
    a.items.push(owned(SCAB, a, active));
    return a;
  };

  it("в паке у Струпа запись иммунитета (Конструктор, defence.diseaseEffectsImmune)", () => {
    const keys = SCAB.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("defence.diseaseEffectsImmune");
  });

  it("препарат принят и действует — заражение остановлено", () => {
    expect(infectionBlockedBy(actorWith({ isActive: true, isAfterEffect: false }), isItemActive)).toMatch(/не заражается/);
  });

  it("препарат лежит в сумке (не принят) — иммунитета нет", () => {
    expect(infectionBlockedBy(actorWith({ isActive: false, isAfterEffect: false }), isItemActive)).toBeNull();
  });

  it("идёт пост-эффект (жидкость вышла рвотой) — иммунитета уже нет", () => {
    expect(infectionBlockedBy(actorWith({ isActive: true, isAfterEffect: true }), isItemActive)).toBeNull();
  });
});
