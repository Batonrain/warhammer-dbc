// test/rules/new-men.test.mjs
//
// Черта «New Men / Новые Люди» (Йигори, сверка главы I): чистые правила
// восьми пунктов книги — какие из них считает система и как именно.
// Фикстура — настоящая Черта из packs-src: зелёный тест доказывает, что
// возможности действительно едут с Чертой, а не только что функции верны.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  NEW_MEN, bleedingDieFormula, halveDown, newMenDrugDuration, newMenInstantMedicine,
  newMenSurgeryPenalty, newMenRecoveryDays, splintDays, sleepGraceDays, diseaseCreateBlocked
} from "../../module/rules/new-men.mjs";

const NEW_MEN_DOC = packDocById("packs-src/traits", "19uFabkoKRxyMcRN");

/** Актор с Чертой из пака (любой аргумент) или без неё (без аргументов). */
function actorWith(...flags) {
  const items = flags.length
    ? [{ id: "t1", name: NEW_MEN_DOC.name, type: NEW_MEN_DOC.type, system: NEW_MEN_DOC.system, flags: NEW_MEN_DOC.flags }]
    : [];
  return { id: "a1", type: "character", system: {}, items: Object.assign([...items], { contents: items }) };
}

describe("New Men: Черта из пака несёт все свои возможности", () => {
  it.each(Object.values(NEW_MEN))("%s", key => {
    const keys = NEW_MEN_DOC.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(key);
  });

  it("и лечится как космодесантник (готовая возможность Астартес)", () => {
    const keys = NEW_MEN_DOC.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("healing.astartes");
  });
});

describe("New Men: Кровотечение", () => {
  it("d20 вместо d10 у носителя, d10 у прочих", () => {
    expect(bleedingDieFormula(actorWith(NEW_MEN.bleeding))).toBe("1d20");
    expect(bleedingDieFormula(actorWith())).toBe("1d10");
    expect(bleedingDieFormula(null)).toBe("1d10");
  });
});

describe("New Men: яды, наркотики, медикаменты", () => {
  it("ополовинивание с округлением вниз", () => {
    expect(halveDown(7)).toBe(3);
    expect(halveDown(1)).toBe(0);
    expect(halveDown(-3)).toBe(0);
    expect(halveDown("x")).toBe(0);
  });

  it("срок препарата вдвое (окр.▼) только у носителя", () => {
    expect(newMenDrugDuration(actorWith(NEW_MEN.drugs), 9)).toBe(4);
    expect(newMenDrugDuration(actorWith(), 9)).toBe(9);
  });

  it("разовый эффект МЕДИКАМЕНТА вдвое: лечение и снятие уровней", () => {
    const fx = { removesWounds: 5, removesBleedingLevels: 3, removesFatigueLevels: 1,
                 removesHaemorrhagingLevels: 2, removesConditionLevel: 4, grantsFatigue: 2 };
    const half = newMenInstantMedicine(actorWith(NEW_MEN.drugs), "medicine", fx);
    expect(half).toMatchObject({ removesWounds: 2, removesBleedingLevels: 1, removesFatigueLevels: 0,
                                 removesHaemorrhagingLevels: 1, removesConditionLevel: 2 });
    // Вред — не «эффект медикамента»: Усталость от препарата не режется.
    expect(half.grantsFatigue).toBe(2);
    expect(fx.removesWounds).toBe(5); // исходник не тронут
  });

  it("наркотик и яд разовый эффект не режут, прочие актёры — тоже", () => {
    const fx = { removesWounds: 5 };
    expect(newMenInstantMedicine(actorWith(NEW_MEN.drugs), "narcotic", fx)).toBe(fx);
    expect(newMenInstantMedicine(actorWith(), "medicine", fx)).toBe(fx);
  });
});

describe("New Men: операции и регенерация", () => {
  it("штраф Пришивания/бионики −30 → −15 у носителя", () => {
    expect(newMenSurgeryPenalty(actorWith(NEW_MEN.surgery), -30)).toBe(-15);
    expect(newMenSurgeryPenalty(actorWith(), -30)).toBe(-30);
  });

  it("восстановление после операции вдвое (окр.▼), не меньше суток", () => {
    expect(newMenRecoveryDays(actorWith(NEW_MEN.surgery), 9)).toBe(4);
    expect(newMenRecoveryDays(actorWith(NEW_MEN.surgery), 1)).toBe(1);
    expect(newMenRecoveryDays(actorWith(), 9)).toBe(9);
  });

  it("лубок после перелома — вчетверо короче, не меньше суток", () => {
    expect(splintDays(actorWith(NEW_MEN.regeneration), 13)).toBe(3);
    expect(splintDays(actorWith(NEW_MEN.regeneration), 2)).toBe(1);
    expect(splintDays(actorWith(), 13)).toBe(13);
  });
});

describe("New Men: сон и болезни", () => {
  it("до 3 суток без сна без штрафа", () => {
    expect(sleepGraceDays(actorWith(NEW_MEN.sleep))).toBe(2);
    expect(sleepGraceDays(actorWith())).toBe(0);
  });

  it("болезнь не ложится на иммунного актора — любая, и сверхъестественная", () => {
    const immune = actorWith(NEW_MEN.diseaseImmunity);
    expect(diseaseCreateBlocked(immune, "disease")).toBe(true);
    expect(diseaseCreateBlocked(immune, "drug")).toBe(false);
    expect(diseaseCreateBlocked(actorWith(), "disease")).toBe(false);
    expect(diseaseCreateBlocked(null, "disease")).toBe(false);
  });
});
