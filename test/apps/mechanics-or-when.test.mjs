// test/apps/mechanics-or-when.test.mjs
//
// ИЛИ-выбор Конструктора показывает только ветки, чьё «Когда» выполнено.
// Раньше диалог предлагал и ветку, которую applyMechEntry потом молча
// отбрасывала (Божественно Одарённый Нумен выбирал Дар чужого Бога и не
// получал ничего).

import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { orChoiceEntries, applyItemMechanics } from "../../module/apps/mechanics.mjs";

const corr = (id, when = {}) => ({ id, kind: "corruption", corruptionValue: "1", when });
const actor = patronGod => ({ system: { patronGod }, items: [] });

describe("ИЛИ-выбор и «Когда»", () => {
  const entries = [
    corr("mutation"),
    corr("khorne", { patronGod: ["khorne"] }),
    corr("nurgle", { patronGod: ["nurgle"] })
  ];

  it("без Покровителя — только ветка без условия", () => {
    expect(orChoiceEntries(actor(""), entries).map(e => e.id)).toEqual(["mutation"]);
  });

  it("с Покровителем — ветка его Бога и ветка без условия", () => {
    expect(orChoiceEntries(actor("khorne"), entries).map(e => e.id)).toEqual(["mutation", "khorne"]);
  });

  it("незаполненная ветка по-прежнему не предлагается", () => {
    expect(orChoiceEntries(actor(""), [corr("a"), { id: "b", kind: "corruption", corruptionValue: "" }])
      .map(e => e.id)).toEqual(["a"]);
  });
});

// wdbc-6rjtc.5: фильтр «Когда» — только для показа вариантов. «Выбор уже
// сделан» смотрится по ВСЕМ веткам: Дар Кхорна, взятый при Покровителе Кхорн,
// остаётся выбором и после смены Покровителя — иначе правка Механики ГМом
// (updateItem → applyItemMechanics) выдавала второй Дар/мутацию.
const FLAG = "warhammer-dbc";
const wounds = (id, when = {}) => ({ id, kind: "wounds", op: "add", woundsValue: "3", when });
const orGroup = (...entries) => ({ id: "g-or", operator: "OR", entries });

let seq = 0;
/** Предмет на акторе Нумена: столько, сколько трогает applyItemMechanics. */
function numenItem({ patronGod = "", mechanics, applied }) {
  const own = { mechanics, mechanicsApplied: applied };
  const actor = new Actor();
  actor.system = { patronGod, wounds: { max: 10 } };
  actor.items = [];
  actor.update = async data => { actor.system.wounds.max = data["system.wounds.max"]; };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;
  // Свой id на каждый тест: зависший диалог не держит очередь _mechRuns соседям.
  const item = {
    id: `numen-${seq++}`, type: "archetype", name: "Нумен", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => {
      const made = docs.map(d => ({ id: `fx-${item.effects.length}`, name: d.name, system: d.system,
                                    disabled: false, getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
      item.effects.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (_t, ids) => { item.effects = item.effects.filter(f => !ids.includes(f.id)); },
    updateEmbeddedDocuments: async () => []
  };
  return item;
}

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); };

describe("ИЛИ-выбор, сделанный раньше, переживает смену «Когда» (wdbc-6rjtc.5)", () => {
  beforeEach(() => { resetCaptured(); globalThis.game.user = { isGM: true }; });

  it("Покровитель снят — единственная оставшаяся ветка «мутация» НЕ выдаётся вторым выбором", async () => {
    const item = numenItem({
      mechanics: [orGroup(wounds("mutation"), wounds("khorne", { patronGod: ["khorne"] }))],
      applied: ["khorne"]
    });

    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBe(10);
  });

  it("Покровитель сменён — окно выбора заново не открывается", async () => {
    const item = numenItem({
      patronGod: "nurgle",
      mechanics: [orGroup(wounds("mutation"), wounds("khorne", { patronGod: ["khorne"] }),
                          wounds("nurgle", { patronGod: ["nurgle"] }))],
      applied: ["khorne"]
    });

    const run = applyItemMechanics(item);
    await flush();

    expect(captured.dialog).toBeNull();
    await run;
    expect(item.parent.system.wounds.max).toBe(10);
  });

  it("единственная прошедшая «Когда» ветка долговечного вида получает эффект, как выбранная", async () => {
    // Выбор из одного варианта — всё равно ИЛИ-ветка: пересборка эффектов
    // (syncMechanicsEffects) ИЛИ-ветки не собирает, эффект заводит только выдача.
    const item = numenItem({
      mechanics: [orGroup({ id: "str", kind: "characteristic", charKey: "s", field: "bonus", op: "add", value: 1 },
                          wounds("khorne", { patronGod: ["khorne"] }))],
      applied: []
    });

    await applyItemMechanics(item);

    expect(item.effects.map(f => f.getFlag(FLAG, "mechEntry"))).toEqual(["str"]);
  });
});
