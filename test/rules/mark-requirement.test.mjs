// test/rules/mark-requirement.test.mjs
//
// Метка Бога как ТРЕБОВАНИЕ (wdbc-k1q4). Корбук, «V. ПСАЙКАНА → МЕХАНИКА»:
// «Некоторые из этих психосил требуют не только Покровительства, но и Метки
// бога, как для их изучения, так и для манифестации. Если псайкер теряет
// Метку, он также лишается возможности использовать психосилы, требующие её,
// но не забывает их и может в будущем вернуть к ним доступ, если получит
// Метку обратно.»
//
// Метка НЕ равна Покровительству, и это не придирка: та же книга держит их в
// таблице «Модификаторы Призыва» двумя РАЗНЫМИ строками — «персонаж имеет
// метку бога демона +30» и «персонаж имеет покровительство (но не метку) бога
// демона +20». Поэтому проверка идёт по возможности mark.<бог>, которую даёт
// Черта из packs-src/traits/Метки_Богов, а не по system.patronGod.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { parseRequirement, checkRequirement, requiredMarks }
  from "../../module/constants/talent-requirements.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

/** Актор с Меткой (или без) — Метка приходит возможностью, как в паке. */
function hero({ marks = [], patron = "", ...system } = {}) {
  clearRuleSources();
  registerRuleSource("test", () => marks.map(key => ({
    id: `mark.${key}`, label: `Метка ${key}`, when: {},
    effects: [{ kind: "grantFlag", target: `mark.${key}` }]
  })));
  return { system: { patronGod: patron, characteristics: {}, psyker: {}, ...system }, items: [] };
}

describe("разбор требования «Метка Бога»", () => {
  it("узнаёт четырёх богов в любом падеже книги", () => {
    for (const [text, key] of [["Метка Кхорна", "khorne"], ["Метка Нургла", "nurgle"],
                               ["Метка Тзинча", "tzeentch"], ["Метка Слаанеш", "slaanesh"]]) {
      expect(parseRequirement(text)[0].alts[0], text).toMatchObject({ kind: "mark", key });
    }
  });

  it("незнакомого бога не превращает в «не выполнено» — остаётся прозой", () => {
    expect(parseRequirement("Метка Малала")[0].alts[0].kind).toBe("unknown");
  });

  it("не путается с Покровительством — это разные условия", () => {
    expect(parseRequirement("Покровительство Кхорна")[0].alts[0]).toMatchObject({ kind: "patron", key: "khorne" });
    expect(parseRequirement("Метка Кхорна")[0].alts[0]).toMatchObject({ kind: "mark", key: "khorne" });
  });

  it("requiredMarks вынимает ключи Меток из полной строки требований", () => {
    expect(requiredMarks("Метка Слаанеш, PR 4+, T 40+")).toEqual(["slaanesh"]);
    expect(requiredMarks("Метка Нургла, PR 1+, Nurgle's Rot")).toEqual(["nurgle"]);
    expect(requiredMarks("PR 4+, T 40+")).toEqual([]);
    expect(requiredMarks("")).toEqual([]);
  });
});

describe("сверка требования с листом", () => {
  const REQ = "Метка Слаанеш, PR 4+, T 40+";

  it("Метка есть — часть про Метку выполнена", () => {
    const actor = hero({ marks: ["slaanesh"], psyker: { rating: 6 },
                         characteristics: { t: { total: 45 } } });
    expect(checkRequirement(actor, REQ).state).toBe("ok");
  });

  it("Метки нет — требование не выполнено, и названа именно она", () => {
    const actor = hero({ psyker: { rating: 6 }, characteristics: { t: { total: 45 } } });
    const chk = checkRequirement(actor, REQ);
    expect(chk.state).toBe("fail");
    expect(chk.unmet).toEqual(["Метка Слаанеш"]);
  });

  it("Покровительство того же бога Метку НЕ заменяет", () => {
    // Книга различает их прямо: «покровительство (но не метку) — +20» против
    // «метку — +30» в таблице Модификаторов Призыва.
    const actor = hero({ patron: "slaanesh", psyker: { rating: 6 },
                         characteristics: { t: { total: 45 } } });
    expect(checkRequirement(actor, REQ).unmet).toEqual(["Метка Слаанеш"]);
  });

  it("Метка чужого бога не годится", () => {
    const actor = hero({ marks: ["nurgle"], psyker: { rating: 6 },
                         characteristics: { t: { total: 45 } } });
    expect(checkRequirement(actor, REQ).unmet).toEqual(["Метка Слаанеш"]);
  });
});

describe("двенадцать психосил Божественных Дисциплин реально несут требование", () => {
  // Зелёные тесты на подставных данных не доказывают, что фича жива: сверяемся
  // с настоящим JSON из packs-src. Список — из корбука, «V. ПСАЙКАНА →
  // БОЖЕСТВЕННЫЕ ДИСЦИПЛИНЫ»: Слаанеш 4, Нургл 3, Тзинч 5. У Кхорна
  // психосил нет вовсе — он псайкеров не терпит.
  const EXPECTED = {
    "Ecstatic Oblivion": "slaanesh", "Symphony of Pain": "slaanesh",
    "Hellshriek": "slaanesh", "Soul's Secret Unleashed": "slaanesh",
    "Putrefying Embrace": "nurgle", "Vile Contagion": "nurgle", "Leper's Curse": "nurgle",
    "Bolt of Change": "tzeentch", "Storm of Change": "tzeentch", "Vile Revelation": "tzeentch",
    "Protean Form": "tzeentch", "Flicker": "tzeentch"
  };

  const docs = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".json")) docs.push(JSON.parse(fs.readFileSync(full, "utf8")));
    }
  };
  walk(path.resolve(import.meta.dirname, "../../packs-src/psychic-powers"));

  it("у каждой из двенадцати проставлена Метка своего Бога", () => {
    const missing = [];
    for (const [name, god] of Object.entries(EXPECTED)) {
      const doc = docs.find(d => String(d.name || "").toLowerCase().startsWith(name.toLowerCase() + " /"));
      if (!doc) { missing.push(`${name}: карточки нет в паке`); continue; }
      const marks = requiredMarks(doc.system?.requirement);
      if (!marks.includes(god)) missing.push(`${name}: requirement = ${JSON.stringify(doc.system?.requirement)}`);
    }
    expect(missing).toEqual([]);
  });

  it("больше ни одна психосила Метки не требует — иначе список устарел", () => {
    const extra = docs
      .filter(d => requiredMarks(d.system?.requirement).length)
      .map(d => String(d.name || ""))
      .filter(n => !Object.keys(EXPECTED).some(k => n.toLowerCase().startsWith(k.toLowerCase() + " /")));
    expect(extra).toEqual([]);
  });
});
