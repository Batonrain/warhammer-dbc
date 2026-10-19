// test/apps/elite-buy.test.mjs
//
// Покупка Элитного архетипа устроена как покупка Таланта: цена у самого
// архетипа, каждый следующий вдвое дороже, уплаченное лежит на предмете.
//
// Проверяется именно счёт и отбор, а не диалоги: окно «Добавить/Отменить»
// показывается только при невыполненных прочих требованиях, а сам этот признак
// считает правило (rules/elite-requirements.mjs), проверенное отдельно.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { eliteCostFor, buyEliteArchetype } from "../../module/apps/elite-buy.mjs";
import { eliteAvailability } from "../../module/sheets/elite-picker.mjs";
import { grantEliteDiscount, TRAINING_ELITE_DISCOUNT_FLAG } from "../../module/rules/training.mjs";

/** Актор-заглушка: покупке хватает system и items. */
const actor = (over = {}) => ({
  system: { race: "human", subrace: "", patronGod: "", characteristics: {}, skills: {},
            groupSkills: {}, corruption: { value: 0 }, experience: { total: 0, spent: 0, current: 0 },
            ...over.system },
  items: over.items ?? []
});

const elite = (name, system = {}) => ({ name, type: "eliteArchetype", system });

// Klaivex (wdbc-5yafq): скидка вдвое на архетип Инкуб от курса Обучения —
// флаг actor, не experience. Этот актор умеет getFlag/setFlag/
// createEmbeddedDocuments — нужно для buyEliteArchetype (не только для
// превью цены, как голый actor() выше).
function flagActor(over = {}) {
  const flags = { "warhammer-dbc": {} };
  return {
    system: { race: "drukhari", subrace: "", patronGod: "", characteristics: {}, skills: {},
              groupSkills: {}, corruption: { value: 0 }, experience: { total: 1000, spent: 0, current: 1000 },
              ...over.system },
    items: over.items ?? [],
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { (flags[scope] ??= {})[key] = value; },
    update: async () => {},
    createEmbeddedDocuments: async (type, docs) => docs.map(d => ({ ...d, id: "new1" }))
  };
}

const eliteDoc = (name, system = {}) => ({
  name, type: "eliteArchetype", system,
  toObject() { return { name: this.name, type: this.type, system: { ...this.system } }; }
});

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

// Klaivex (wdbc-5yafq): курс Обучения «Искусство Инкубов» при успехе ставит
// скидку вдвое на архетип Инкуб (флаг, не experience) — eliteCostFor её
// читает для превью, buyEliteArchetype снимает ровно одну запись при покупке.
describe("скидка Клэйвекса на Элитный архетип", () => {
  beforeEach(resetCaptured);

  it("eliteCostFor халвит цену, когда есть неиспользованная скидка на это имя", () => {
    const doc = eliteDoc("Incubus / Инкуб", { cost: 2001 });
    const a = flagActor({ system: { experience: { total: 0, current: 0 } } });
    expect(eliteCostFor(a, doc).cost).toBe(2001);

    a.setFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG, grantEliteDiscount([], "Incubus / Инкуб"));
    const discounted = eliteCostFor(a, doc);
    expect(discounted.cost).toBe(1001); // ceil(2001/2)
    expect(discounted.note).toMatch(/Клэйвекс/);
  });

  it("скидка на ДРУГОЙ архетип эту покупку не задевает", () => {
    const doc = eliteDoc("Incubus / Инкуб", { cost: 2000 });
    const a = flagActor();
    a.setFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG, grantEliteDiscount([], "Другой Архетип"));
    expect(eliteCostFor(a, doc).cost).toBe(2000);
  });

  it("buyEliteArchetype берёт со скидкой и снимает ровно одну запись флага", async () => {
    const doc = eliteDoc("Incubus / Инкуб", { cost: 2000, requirements: { primary: [], secondary: [] } });
    const a = flagActor();
    await a.setFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG,
      grantEliteDiscount(grantEliteDiscount([], "Incubus / Инкуб"), "Incubus / Инкуб"));

    const item = await buyEliteArchetype(a, doc);

    expect(item.system.paidCost).toBe(1000); // 2000/2
    expect(captured.chat[0].content).toContain("1000");
    // одна запись скидки осталась (их было две) — покупка снимает ровно одну
    expect(a.getFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG)).toEqual(["Incubus / Инкуб"]);
  });
});

// Предначертанный Путь (Черта Нумена): избранный Элитный архетип — базовая
// цена минус 1000, без множителя за взятые, и сам не удорожает прочие.
describe("Предначертанный Путь", () => {
  const fatedTrait = {
    id: "fp", name: "Fated Path / Предначертанный Путь", type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "trait.fatedPath", label: "" }] }] } }
  };
  const numen = (fated, items = []) => ({
    ...actor({ items: [fatedTrait, ...items] }),
    flags: { "warhammer-dbc": { fatedPath: fated } }
  });

  it("избранный — базовая цена минус 1000, даже вторым", () => {
    const doc = elite("Ведьма Культа", { cost: 2000 });
    expect(eliteCostFor(numen("Ведьма Культа"), doc).cost).toBe(1000);
    expect(eliteCostFor(numen("Ведьма Культа", [elite("A")]), doc).cost).toBe(1000);
    expect(eliteCostFor(numen("Ведьма Культа", [elite("A")]), doc).fated).toBe(true);
  });

  it("скидка не уводит цену ниже нуля", () => {
    expect(eliteCostFor(numen("Дешёвый"), elite("Дешёвый", { cost: 500 })).cost).toBe(0);
  });

  it("взятый избранный не удорожает прочие", () => {
    const other = elite("Другой", { cost: 1500 });
    expect(eliteCostFor(numen("Ведьма Культа", [elite("Ведьма Культа")]), other).cost).toBe(1500);
    expect(eliteCostFor(numen("Ведьма Культа", [elite("Ведьма Культа"), elite("A")]), other).cost).toBe(3000);
  });

  it("без Черты метка ничего не даёт", () => {
    const a = { ...actor(), flags: { "warhammer-dbc": { fatedPath: "Ведьма Культа" } } };
    expect(eliteCostFor(a, elite("Ведьма Культа", { cost: 2000 })).cost).toBe(2000);
  });
});
