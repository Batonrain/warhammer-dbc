// test/rules/corruption-entry.test.mjs
//
// Порча от Архетипа с оговорками (module/rules/corruption-entry.mjs): Одержимый
// — «+3d5 Cor, но не выше Cor 90»; общий случай «если Порчи меньше X, то
// получает Y / Zd5, иначе …». Чистые функции + выдача записи через
// applyItemMechanics (бросок и итог идут в чат, прибавка — в system.corruption.value).

import { captured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  corruptionLimit, planCorruption, capCorruptionGain, corruptionLimitsSuffix
} from "../../module/rules/corruption-entry.mjs";
import { applyItemMechanics, describeMechEntry } from "../../module/apps/mechanics.mjs";

const entry = (extra = {}) => ({ id: "e1", kind: "corruption", op: "add", corruptionValue: "3d5", ...extra });

describe("corruptionLimit", () => {
  it("пусто/мусор — не задано, число — число", () => {
    expect(corruptionLimit("")).toBeNull();
    expect(corruptionLimit(undefined)).toBeNull();
    expect(corruptionLimit("abc")).toBeNull();
    expect(corruptionLimit("90")).toBe(90);
    expect(corruptionLimit(0)).toBe(0);
  });
});

describe("capCorruptionGain: «не выше N»", () => {
  it("Порча 85, выпало 12, предел 90 → прибавка 5", () => {
    expect(capCorruptionGain(entry({ corruptionCap: "90" }), 85, 12)).toBe(5);
  });
  it("Порча уже 90 и выше — прибавка 0 (Порчу не уменьшаем)", () => {
    expect(capCorruptionGain(entry({ corruptionCap: "90" }), 90, 9)).toBe(0);
    expect(capCorruptionGain(entry({ corruptionCap: "90" }), 95, 9)).toBe(0);
  });
  it("прибавка помещается — без изменений; без предела — без изменений", () => {
    expect(capCorruptionGain(entry({ corruptionCap: "90" }), 10, 8)).toBe(8);
    expect(capCorruptionGain(entry(), 85, 12)).toBe(12);
  });
  it("вычитание предел не трогает", () => {
    expect(capCorruptionGain(entry({ corruptionCap: "90" }), 95, -4)).toBe(-4);
  });
});

describe("planCorruption: «если Порчи меньше X, то Y, иначе Z»", () => {
  it("без условия — основная формула", () => {
    expect(planCorruption(entry(), 50)).toEqual({ formula: "3d5", branch: "main" });
  });
  it("Порча < X — основная формула", () => {
    expect(planCorruption(entry({ corruptionIfBelow: "30" }), 29)).toEqual({ formula: "3d5", branch: "main" });
  });
  it("Порча ≥ X — «иначе» (пусто = ничего не получает)", () => {
    expect(planCorruption(entry({ corruptionIfBelow: "30" }), 30)).toEqual({ formula: "", branch: "else" });
    expect(planCorruption(entry({ corruptionIfBelow: "30", corruptionElse: "1d5" }), 31))
      .toEqual({ formula: "1d5", branch: "else" });
  });
});

describe("corruptionLimitsSuffix / describeMechEntry", () => {
  it("старая запись — подпись как раньше", () => {
    expect(describeMechEntry(entry())).toBe("Порча: +3d5");
  });
  it("предел и условие попадают в подпись", () => {
    expect(describeMechEntry(entry({ corruptionCap: "90" }))).toBe("Порча: +3d5, не выше Cor 90");
    expect(corruptionLimitsSuffix(entry({ corruptionIfBelow: "30", corruptionElse: "1d5" })))
      .toBe(", только если Порча < 30, иначе +1d5");
  });
});

function itemOnActor(mechanics, corruption) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = { characteristics: {}, corruptionBonus: 0, corruption: { value: corruption } };
  actor.items = [];
  actor.update = async (patch) => { if ("system.corruption.value" in patch) actor.system.corruption.value = patch["system.corruption.value"]; return actor; };
  actor.createEmbeddedDocuments = async () => [];
  const item = {
    id: "item-1", type: "eliteArchetype", name: "Possessed / Одержимый", system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; return true; },
    update: async () => item,
    createEmbeddedDocuments: async () => [],
    deleteEmbeddedDocuments: async () => []
  };
  return { item, actor, own };
}
const group = (...entries) => ({ id: "g1", operator: "AND", entries });

describe("выдача Порчи через Конструктор (applyItemMechanics)", () => {
  beforeEach(() => {
    globalThis.game.user = { isGM: true };
    globalThis.game.packs = new Map();
    captured.nextRoll = 12;
    captured.dice = null;
    captured.chat.length = 0;
  });

  it("запись без новых полей — прежнее поведение: +12", async () => {
    const { item, actor } = itemOnActor([group(entry())], 85);
    await applyItemMechanics(item);
    expect(actor.system.corruption.value).toBe(97);
  });

  it("Одержимый: Порча 85, 3d5 выпало 12, предел 90 → итог 90, откат знает прибавку 5", async () => {
    const { item, actor, own } = itemOnActor([group(entry({ corruptionCap: "90" }))], 85);
    await applyItemMechanics(item);
    expect(actor.system.corruption.value).toBe(90);
    expect(own.poolApplied).toEqual({ pool: "corruption", amount: 5 });
    expect(captured.chat.at(-1).flavor).toContain("предел Cor 90");
  });

  it("Порча уже 90 — Одержимый не получает Порчи", async () => {
    const { item, actor } = itemOnActor([group(entry({ corruptionCap: "90" }))], 90);
    await applyItemMechanics(item);
    expect(actor.system.corruption.value).toBe(90);
  });

  it("«если Порчи меньше 30, то 3d5, иначе 1»: при Порче 40 бросается «иначе»", async () => {
    captured.nextRoll = 1;
    const { item, actor } = itemOnActor(
      [group(entry({ corruptionIfBelow: "30", corruptionElse: "1" }))], 40);
    await applyItemMechanics(item);
    expect(actor.system.corruption.value).toBe(41);
  });

  it("«если Порчи меньше 30», иначе пусто: при Порче 40 — ничего", async () => {
    const { item, actor } = itemOnActor([group(entry({ corruptionIfBelow: "30" }))], 40);
    await applyItemMechanics(item);
    expect(actor.system.corruption.value).toBe(40);
  });
});

// Данные: книга — Одержимый «+3d5 Cor, но не выше Cor 90».
import { packDocByFileHint } from "../support/pack-doc.mjs";

describe("данные: Одержимый и Рубрикант", () => {
  it("запись Порчи Одержимого — 3d5 с пределом 90", () => {
    const j = packDocByFileHint("packs-src/elite-archetypes/Любая/Possessed___Одержимый_WNBApOiK3LYTHUiX.json");
    const corr = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "corruption");
    expect(corr.map(e => [e.corruptionValue, e.corruptionCap])).toEqual([["3d5", "90"]]);
  });
  it("Черта Голема Рубрики называется «Rubricae / Рубрикант» и у Голема, и в паке Черт", () => {
    const trait = packDocByFileHint("packs-src/traits/Элитные_архетипы/Колдун_Рубрики/Rubricae___Рубрикант_NbQPSgyjd1WdMeoi.json");
    expect(trait.name).toBe("Rubricae / Рубрикант");
    const golem = packDocByFileHint("packs-src/bestiary/Существа_Элитных_архетипов/Rubric_Golem___Голем_Рубрики_iFNQWM17E1eZRbOB.json");
    expect(golem.items.map(i => i.name)).toContain("Rubricae / Рубрикант");
  });
});
