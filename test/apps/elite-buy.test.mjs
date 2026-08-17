// test/apps/elite-buy.test.mjs
//
// Покупка Элитного архетипа устроена как покупка Таланта: цена у самого
// архетипа, каждый следующий вдвое дороже, уплаченное лежит на предмете.
//
// Проверяется именно счёт и отбор, а не диалоги: окно «Добавить/Отменить»
// показывается только при невыполненных прочих требованиях, а сам этот признак
// считает правило (rules/elite-requirements.mjs), проверенное отдельно.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { eliteCostFor } from "../../module/apps/elite-buy.mjs";
import { eliteAvailability } from "../../module/sheets/elite-picker.mjs";

/** Актор-заглушка: покупке хватает system и items. */
const actor = (over = {}) => ({
  system: { race: "human", subrace: "", patronGod: "", characteristics: {}, skills: {},
            groupSkills: {}, corruption: { value: 0 }, experience: { total: 0, spent: 0, current: 0 },
            ...over.system },
  items: over.items ?? []
});

const elite = (name, system = {}) => ({ name, type: "eliteArchetype", system });

describe("цена Элитного архетипа при покупке", () => {
  it("первый — по книге, каждый следующий вдвое дороже", () => {
    const doc = elite("Ведьма Культа", { cost: 2000 });
    expect(eliteCostFor(actor(), doc).cost).toBe(2000);
    expect(eliteCostFor(actor({ items: [elite("A")] }), doc).cost).toBe(4000);
    expect(eliteCostFor(actor({ items: [elite("A"), elite("B")] }), doc).cost).toBe(8000);
  });

  it("подпись множителя появляется только со второго архетипа", () => {
    expect(eliteCostFor(actor(), elite("X", { cost: 100 })).note).toBe("");
    expect(eliteCostFor(actor({ items: [elite("A")] }), elite("X", { cost: 100 })).note)
      .toMatch(/×2/);
  });

  it("считаются только Элитные архетипы, а не любые предметы", () => {
    const items = [{ name: "Cleave", type: "talent", system: {} }];
    expect(eliteCostFor(actor({ items }), elite("X", { cost: 500 })).cost).toBe(500);
  });
});

describe("отбор архетипов для списка", () => {
  it("заведённые основные требования решают, показывать ли архетип", () => {
    const doc = elite("Ведьма Культа", {
      race: "Друкхари",
      requirements: {
        primary: [{ kind: "trait", name: "Mechanicum Implants" }], secondary: [], talents: []
      }
    });
    const withTrait = { items: [{ type: "trait", name: "Mechanicum Implants / Импланты Механикум" }],
                        system: { race: "drukhari" } };
    expect(eliteAvailability(actor(withTrait), doc).available).toBe(true);
    expect(eliteAvailability(actor({ system: { race: "drukhari" } }), doc).available).toBe(false);
  });

  it("без заведённых основных требований отбор идёт по метке расы из книги", () => {
    const doc = elite("Апотекарий", { race: "Космодесантник" });
    expect(eliteAvailability(actor({ system: { race: "astartes" } }), doc).available).toBe(true);
    expect(eliteAvailability(actor({ system: { race: "human" } }), doc).available).toBe(false);
  });

  // Иначе вышла бы ловушка: заведи Лорд-Дисcкорданту одну требуемую Черту — и
  // он открылся бы всем расам, потому что метка «Космодесантник» перестала бы
  // учитываться.
  it("метка расы проверяется и после того, как требования заведены", () => {
    const doc = elite("Лорд-Дискордант", {
      race: "Космодесантник",
      requirements: {
        primary: [{ kind: "trait", name: "Mechanicum Implants" }], secondary: [], talents: []
      }
    });
    const items = [{ type: "trait", name: "Mechanicum Implants / Импланты Механикум" }];
    expect(eliteAvailability(actor({ items, system: { race: "astartes" } }), doc).available).toBe(true);
    expect(eliteAvailability(actor({ items, system: { race: "human" } }), doc).available).toBe(false);
  });

  it("прочие требования не запирают выбор, а только помечают", () => {
    const doc = elite("Мастер Клинка", {
      race: "Любая",
      requirements: {
        primary: [],
        secondary: [{ kind: "corruption", value: 30 }],
        talents: []
      }
    });
    const res = eliteAvailability(actor({ system: { corruption: { value: 0 } } }), doc);
    expect(res.available).toBe(true);
    expect(res.check.warn).toBe(true);
  });
});
