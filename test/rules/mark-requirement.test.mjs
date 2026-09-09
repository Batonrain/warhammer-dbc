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
function hero({ marks = [], patron = "", items = [], ...system } = {}) {
  clearRuleSources();
  registerRuleSource("test", () => marks.map(key => ({
    id: `mark.${key}`, label: `Метка ${key}`, when: {},
    effects: [{ kind: "grantFlag", target: `mark.${key}` }]
  })));
  return { system: { patronGod: patron, characteristics: {}, psyker: {}, ...system }, items };
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

describe("требование-предмет ищется и среди Психосил (ревью 07.09.2026)", () => {
  // «Метка Нургла, PR 1+, Nurgle's Rot» — Nurgle's Rot тут НЕ Талант и не
  // Черта, а ПСИХОСИЛА (packs-src/psychic-powers/.../Nurgle_s_Rot). Книга
  // пишет такие требования просто именем, без слова «психосила», поэтому
  // разборщик читает их как kind:"talent" — и пока сверка смотрела только
  // среди talent/trait, у псайкера, который эту силу изучил, требование
  // показывало «не выполнено». Видно это стало сразу, как строка требования
  // выехала на вкладку ПСИ (та же задача, первая половина).
  const REQ = "Метка Нургла, PR 1+, Nurgle's Rot";
  const power = { id: "p9", type: "psychicPower", name: "Nurgle's Rot / Гниль Нургла", system: {} };
  const base = { marks: ["nurgle"], psyker: { rating: 3 } };

  it("психосила с нужным именем требование закрывает", () => {
    expect(checkRequirement(hero({ ...base, items: [power] }), REQ).state).toBe("ok");
  });

  it("психосилы нет — требование не выполнено, и названа именно она", () => {
    const chk = checkRequirement(hero(base), REQ);
    expect(chk.state).toBe("fail");
    expect(chk.unmet).toEqual(["Nurgle's Rot"]);
  });

  it("совпадение идёт по любой половине двуязычного имени", () => {
    const ru = { ...power, name: "Гниль Нургла / Nurgle's Rot" };
    expect(checkRequirement(hero({ ...base, items: [ru] }), REQ).state).toBe("ok");
  });

  it("Талант и Черта с тем же именем годятся по-прежнему", () => {
    for (const type of ["talent", "trait"]) {
      const item = { ...power, type };
      expect(checkRequirement(hero({ ...base, items: [item] }), REQ).state, type).toBe("ok");
    }
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

describe("три ритуала корбука тоже требуют Метку, а не Покровительство", () => {
  // Корбук, «VI. МИСТИКА → РИТУАЛЫ»: «Метка Слаанеш, Forbidden Lore (Heresy)
  // +0 или Forbidden Lore (Warp) +0» и два таких же у Кхорна и Тзинча —
  // ровно три требования Метки на всю главу Ритуалов (замер по тексту книги
  // 07.09.2026). В паке они были записаны Покровительством (reqPatron), то
  // есть носитель фавора без Метки проходил, хотя книга его не пускает.
  const EXPECTED = {
    "Court of the First Circle": "slaanesh",
    "Taming of the Bronze Steed": "khorne",
    "Transformation of the Disc": "tzeentch"
  };

  const docs = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".json") && e.name !== "_Folder.json")
        docs.push(JSON.parse(fs.readFileSync(full, "utf8")));
    }
  };
  walk(path.resolve(import.meta.dirname, "../../packs-src/rituals"));

  /** Все записи требований документа одним списком — группы тут не важны. */
  const reqEntries = doc => (doc.flags?.["warhammer-dbc"]?.req ?? []).flatMap(g => g.entries ?? []);
  const byName = name => docs.find(d => String(d.name || "").toLowerCase().startsWith(name.toLowerCase() + " /"));

  it("у каждого из трёх стоит возможность mark.<бог>", () => {
    const missing = [];
    for (const [name, god] of Object.entries(EXPECTED)) {
      const doc = byName(name);
      if (!doc) { missing.push(`${name}: карточки нет в паке`); continue; }
      const has = reqEntries(doc).some(e => e.kind === "reqCapability" && e.capabilityKey === `mark.${god}`);
      if (!has) missing.push(`${name}: ${JSON.stringify(reqEntries(doc).map(e => e.kind + ":" + (e.capabilityKey || e.patronKey || e.skillKey)))}`);
    }
    expect(missing).toEqual([]);
  });

  it("Покровительство того же бога у них больше не записано — иначе Метка снова необязательна", () => {
    const stale = [];
    for (const [name, god] of Object.entries(EXPECTED)) {
      const doc = byName(name);
      if (doc && reqEntries(doc).some(e => e.kind === "reqPatron" && e.patronKey === god)) stale.push(name);
    }
    expect(stale).toEqual([]);
  });

  it("больше ни один ритуал Метки не требует — иначе список устарел", () => {
    const extra = docs
      .filter(d => reqEntries(d).some(e => e.kind === "reqCapability" && String(e.capabilityKey).startsWith("mark.")))
      .map(d => String(d.name || ""))
      .filter(n => !Object.keys(EXPECTED).some(k => n.toLowerCase().startsWith(k.toLowerCase() + " /")));
    expect(extra).toEqual([]);
  });
});

describe("лист показывает требование, не дожидаясь нажатия «Манифестировать»", () => {
  // Гейт на манифестации был и раньше, но игрок узнавал о нём только по отказу.
  // В проекте, где «игрок минимально считает и помнит сам», причина обязана
  // стоять там, где силу выбирают (ревью 07.09.2026).
  it("в строке психосилы есть книжное требование и пометка отсутствующей Метки", async () => {
    const { sheetOf } = await import("../support/foundry-stub.mjs");
    const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");
    const { buildGetData } = await import("../../module/sheets/sheet-helpers.mjs");

    clearRuleSources();
    registerRuleSource("test", () => []);   // Метки у персонажа нет

    const power = {
      id: "p1", name: "Адский Вопль", type: "psychicPower",
      system: { requirement: "Метка Слаанеш, PR 5+, T 40+", prRequired: 5, testChar: "wp",
                discipline: "slaanesh", powerType: "attack", cost: 400 },
      getFlag: () => undefined
    };
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [power], characteristics: {}, skills: {}, groupSkills: {}, psyker: { rating: 6 }
    });
    sheet.actor.items.contents = sheet.actor.items;

    const row = buildGetData(sheet.actor).psyPowers?.find(p => p.id === "p1");
    expect(row, "психосила не попала в контекст вкладки ПСИ").toBeTruthy();
    expect(row.requirement).toBe("Метка Слаанеш, PR 5+, T 40+");
    expect(row.missingMark).toBe("Слаанеш");
  });
});
