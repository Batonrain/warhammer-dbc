// test/rules/terminator-armour.test.mjs
//
// Терминаторская броня (корбук, стр. 235): штраф к A из профиля и запрет
// Уклонения; Черта «Изящный Гигант» (Чемпион-Терминатор): штраф A −10,
// Max.A +10, Уклонение со штрафом −10 (rules/terminator-armour.mjs).

import "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  isTerminatorArmour, hasGracefulGiant, gracefulGiantPenaltyReduction,
  gracefulGiantAgilityBonus, terminatorDodgeVerdict, GRACEFUL_GIANT_KEY
} from "../../module/rules/terminator-armour.mjs";
import { armorAgilityCap } from "../../module/combat/armor-mods.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

function actorWith(...items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { items: list, system: {} };
}

const terminator = (maxAgility = 25, equipped = true) => ({
  id: "t1", type: "armor", name: "Mk I Saturnyne / Мк I Сатурнин",
  system: { equipped, armorType: "power", maxAgility, agilityPenalty: 30 }
});
const plate = (equipped = true) => ({
  id: "p1", type: "armor", name: "Mk VII Aquila / Мк VII Аквила",
  system: { equipped, armorType: "power", maxAgility: 100 }
});
const giant = { type: "trait", name: "Graceful Giant / Изящный Гигант", system: {} };
const giantByKey = {
  type: "trait", name: "Переименованная Черта", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ entries: [{ kind: "capability", capabilityKey: GRACEFUL_GIANT_KEY }] }] } }
};

describe("опознание Терминаторской брони", () => {
  it("пять книжных образцов — терминаторские, обычная силовая — нет", () => {
    for (const n of ["Mk I Saturnyne / Мк I Сатурнин", "Mk II Cataphractii / Мк II Катафракт",
      "Mk III Indominus / Мк III Индомитус", "Mk IV Tartaros / Мк IV Тартарос", "Terminator Aegis / Терминатор Эгида"]) {
      expect(isTerminatorArmour({ type: "armor", name: n })).toBe(true);
    }
    expect(isTerminatorArmour(plate())).toBe(false);
    expect(isTerminatorArmour({ type: "weapon", name: "Terminator Aegis" })).toBe(false);
  });
});

describe("Изящный Гигант", () => {
  it("опознаётся по имени и по ключу Возможности", () => {
    expect(hasGracefulGiant(actorWith(giant))).toBe(true);
    expect(hasGracefulGiant(actorWith(giantByKey))).toBe(true);
    expect(hasGracefulGiant(actorWith())).toBe(false);
  });

  it("−10 к штрафу A только у Терминаторской брони", () => {
    const a = actorWith(giant, terminator(), plate());
    expect(gracefulGiantPenaltyReduction(a, terminator())).toBe(10);
    expect(gracefulGiantPenaltyReduction(a, plate())).toBe(0);
    expect(gracefulGiantPenaltyReduction(actorWith(terminator()), terminator())).toBe(0);
  });

  it("+10 Max.A только там, где потолок есть", () => {
    const a = actorWith(giant);
    expect(gracefulGiantAgilityBonus(a, terminator(25))).toBe(10);
    expect(gracefulGiantAgilityBonus(a, terminator(100))).toBe(0);   // Тартарос, Эгида
    expect(gracefulGiantAgilityBonus(actorWith(), terminator(25))).toBe(0);
  });

  it("потолок Ловкости Сатурнина 25 → 35 с Чертой", () => {
    expect(armorAgilityCap(actorWith(terminator(25)))).toBe(25);
    expect(armorAgilityCap(actorWith(terminator(25), giant))).toBe(35);
  });
});

describe("Уклонение в Терминаторской броне", () => {
  it("без брони и в обычной силовой — как обычно", () => {
    expect(terminatorDodgeVerdict(actorWith())).toEqual({ blocked: false, penalty: 0 });
    expect(terminatorDodgeVerdict(actorWith(plate()))).toEqual({ blocked: false, penalty: 0 });
  });

  it("в надетой терминаторской — запрещено, в снятой — нет", () => {
    expect(terminatorDodgeVerdict(actorWith(terminator())).blocked).toBe(true);
    expect(terminatorDodgeVerdict(actorWith(terminator(25, false))).blocked).toBe(false);
  });

  it("Изящный Гигант разрешает со штрафом −10", () => {
    const v = terminatorDodgeVerdict(actorWith(terminator(), giant));
    expect(v.blocked).toBe(false);
    expect(v.penalty).toBe(-10);
  });
});

describe("данные пака", () => {
  const dir = path.join(ROOT, "packs-src/armor/Астартес/Броня/Терминаторская");
  const docs = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "_Folder.json")
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))).filter(d => d.type === "armor");
  // Книжная таблица стр. 235: колонка A.
  const BOOK = { "Mk I Saturnyne": 30, "Mk II Cataphractii": 25, "Mk III Indominus": 20, "Mk IV Tartaros": 15, "Terminator Aegis": 15 };

  it("у всех пяти доспехов штраф к A по книге", () => {
    expect(docs.length).toBe(5);
    for (const d of docs) {
      const key = Object.keys(BOOK).find(k => d.name.startsWith(k));
      expect(d.system.agilityPenalty, d.name).toBe(BOOK[key]);
      expect(isTerminatorArmour(d), d.name).toBe(true);
    }
  });

  it("Черта несёт ключ Возможности, у ключа есть читатель", () => {
    const d = packDocByFileHint("packs-src/traits/Элитные_архетипы/Чемпион_Терминатор/Graceful_Giant___Изящный_Гигант_TfMgURq3BmpKtdx0.json");
    expect(hasGracefulGiant(actorWith(d))).toBe(true);
    expect(CAPABILITIES[GRACEFUL_GIANT_KEY]?.reader).toMatch(/terminator-armour\.mjs/);
  });
});

describe("Acrobatics в Терминаторской броне (rules/library/core.mjs)", () => {
  const wearer = (...items) => ({
    system: { race: "human", characteristics: {}, conditions: {} },
    items, setFlag: async () => {}, getFlag: () => undefined
  });
  const acro = a => ({ actor: a, kind: "skill", skill: "acrobatics", char: "ag" });

  it("в надетой — тест Acrobatics провален без броска; другие тесты Ag — нет", async () => {
    const { resolveTest } = await import("../../module/rules/resolve-test.mjs");
    const a = wearer(terminator());
    expect(resolveTest(acro(a)).autoFail).toEqual([expect.objectContaining({ ruleId: "core.terminatorNoAcrobatics" })]);
    expect(resolveTest({ ...acro(a), skill: "dodge" }).autoFail).toEqual([]);
  });

  it("снятая броня и обычная силовая — запрета нет", async () => {
    const { resolveTest } = await import("../../module/rules/resolve-test.mjs");
    expect(resolveTest(acro(wearer(terminator(25, false)))).autoFail).toEqual([]);
    expect(resolveTest(acro(wearer(plate()))).autoFail).toEqual([]);
  });
});
