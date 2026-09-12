// test/apps/mechanics-absorption-entry.test.mjs
//
// kind:"absorption" (wdbc-q0q8) — «AP против типа/подвида урона» в
// Конструкторе. Заведён потому, что Мутация/Черта/Талант, дающие «+2 AP
// против R Dmg, но −2 против I(Cr) Dmg» (Панцирь, субмутация «Стальной
// Мех»), не являются Бронёй/Модификацией брони и до этой записи не имели
// способа выдать такой бонус вообще — только сырой ActiveEffect без
// поддержки when-гейтов (субмутация, Качество и т.д.).
//
// Та же роль и тот же приём, что у kind:"armour" (system.armorBonus.<loc>),
// но цель — system.absorption.vsType.<тип> или system.absorption.vsSubtype.<подвид>
// (module/combat/damage.mjs читает их при поглощении урона).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { syncMechanicsEffects, describeMechEntry } from "../../module/apps/mechanics.mjs";

function itemDoc({ mechanics = [], fx = [] } = {}) {
  const flags = { mechanics };
  const item = {
    id: "item-1", type: "mutation", name: "Тестовая Мутация", img: "icons/svg/aura.svg",
    system: {},
    effects: fx.map((f, i) => ({
      id: f.id ?? `fx-${i}`, name: f.name, system: f.system, disabled: f.disabled ?? false,
      getFlag: (_s, k) => f.flags?.[k]
    })),
    getFlag: (_scope, key) => flags[key],
    async createEmbeddedDocuments(_type, docs) {
      item.effects.push(...docs.map((d, i) => ({
        id: `new-${i}`, name: d.name, system: d.system, disabled: false,
        getFlag: (_s, k) => d.flags?.["warhammer-dbc"]?.[k]
      })));
      return docs;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      item.effects = item.effects.filter(e => !ids.includes(e.id));
      return ids;
    },
    async updateEmbeddedDocuments(_type, updates) {
      for (const u of updates) {
        const fx2 = item.effects.find(e => e.id === u._id);
        if (fx2) fx2.disabled = u.disabled;
      }
      return updates;
    }
  };
  return item;
}

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const absEntry = (id, absorptionTarget, op, absorptionValue) =>
  ({ id, kind: "absorption", absorptionTarget, op, absorptionValue });

const keysOf = item => item.effects.flatMap(e => e.system.changes.map(c => c.key));
const valuesOf = item => item.effects.flatMap(e => e.system.changes.map(c => c.value));
const typesOf = item => item.effects.flatMap(e => e.system.changes.map(c => c.type));

describe("describeMechEntry — kind:absorption", () => {
  it("широкий тип, сложение — читаемая подпись", () => {
    expect(describeMechEntry(absEntry("e1", "vsType:rending", "add", "2")))
      .toBe("AP против Режущий: +2");
  });

  it("подвид, вычитание — подпись со знаком минус", () => {
    expect(describeMechEntry(absEntry("e1", "vsSubtype:crushing", "subtract", "2")))
      .toBe("AP против Дробящий I(Cr): −2");
  });

  it("цель не выбрана — подпись говорит «не задано»", () => {
    expect(describeMechEntry(absEntry("e1", "", "add", "2"))).toBe("AP против типа/подвида урона (не задано)");
  });
});

describe("syncMechanicsEffects — kind:absorption", () => {
  it("широкий тип: заводит эффект на system.absorption.vsType.<тип>", async () => {
    const item = itemDoc({ mechanics: [andGroup(absEntry("e1", "vsType:rending", "add", "2"))] });
    await syncMechanicsEffects(item);
    expect(keysOf(item)).toEqual(["system.absorption.vsType.rending"]);
    expect(valuesOf(item)).toEqual([2]);
    expect(typesOf(item)).toEqual(["add"]);
  });

  it("подвид: заводит эффект на system.absorption.vsSubtype.<подвид>, вычитание", async () => {
    const item = itemDoc({ mechanics: [andGroup(absEntry("e1", "vsSubtype:crushing", "subtract", "2"))] });
    await syncMechanicsEffects(item);
    expect(keysOf(item)).toEqual(["system.absorption.vsSubtype.crushing"]);
    expect(typesOf(item)).toEqual(["subtract"]);
  });

  it("«Стальной Мех» (Панцирь): две записи одной группой — обе применяются независимо", async () => {
    const item = itemDoc({ mechanics: [andGroup(
      absEntry("e1", "vsType:rending", "add", "2"),
      absEntry("e2", "vsSubtype:crushing", "subtract", "2")
    )] });
    await syncMechanicsEffects(item);
    expect(keysOf(item).sort()).toEqual(["system.absorption.vsSubtype.crushing", "system.absorption.vsType.rending"]);
  });

  it("цель не выбрана — запись не готова, эффект не заводится", async () => {
    const item = itemDoc({ mechanics: [andGroup(absEntry("e1", "", "add", "2"))] });
    await syncMechanicsEffects(item);
    expect(item.effects).toEqual([]);
  });

  it("правка значения доходит до уже существующего эффекта", async () => {
    const item = itemDoc({
      mechanics: [andGroup(absEntry("e1", "vsType:energy", "add", "5"))],
      fx: [{
        id: "fx-e1", name: "старое", flags: { mechEntry: "e1" },
        system: { changes: [{ key: "system.absorption.vsType.energy", type: "add", value: 3, phase: "final", priority: 0 }] }
      }]
    });
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);
    expect(valuesOf(item)).toEqual([5]);
  });
});
