import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { eliteAvailability } from "../../module/sheets/elite-picker.mjs";
import { checkEliteRequirements, describeEliteReq } from "../../module/rules/elite-requirements.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { CHARACTERISTICS } from "../../module/constants/characteristics.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Структурные требования семи Элитных архетипов Космодесантника, группа 1
// (Sahara 1-54b9): Шумовой, Чумной, Берсерк Кхорна, Колдун Рубрики, Тёмный
// Апостол, Мастер Казней, Варп-Кузнец. До правки system.requirements были пусты,
// и пикер показывал архетип любому Астартес. Фикстуры — настоящие записи пака.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
function jsonFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? jsonFiles(p) : (e.name.endsWith(".json") ? [p] : []);
  });
}

const DIR = "packs-src/elite-archetypes/Космодесантник";
const ID = {
  noise: "i3Uz3OiHGq3UwMcK", plague: "uz6NPu1w7EsBmYM2", khorne: "cCac0hizt00GA6uN",
  rubric: "BTrPWU7VtwJWYItN", apostle: "cQA3YIip1goMsjbY", executions: "kZosh1Bl1kAbFbdE",
  warpsmith: "XvWY6lfVnNdCSJ46"
};
const doc = key => packDocById(DIR, ID[key]);

const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];

/** Актор-снимок так, как его читает eliteWho: подходит под любой из семи при `over`. */
function actor(over = {}) {
  const base = {
    race: "astartes", subrace: "", patronGod: "",
    chars: {}, skills: {}, groupSkills: {}, talents: [], traits: [], psy: 0
  };
  const o = { ...base, ...over };
  const characteristics = {};
  for (const k of Object.keys(CHARACTERISTICS)) characteristics[k] = { value: o.chars[k] ?? 30, total: o.chars[k] ?? 30, bonus: 0 };
  const skills = {};
  for (const [k, rank] of Object.entries(o.skills)) skills[k] = { rank };
  return {
    system: {
      race: o.race, subrace: o.subrace, patronGod: o.patronGod,
      characteristics, skills, groupSkills: o.groupSkills,
      psyker: { rating: o.psy }, corruption: { value: 0 }
    },
    items: [
      ...o.talents.map(t => ({ type: "talent", name: t.name, system: { specialization: t.spec || "" } })),
      ...o.traits.map(name => ({ type: "trait", name, system: {} }))
    ]
  };
}

const who = (over = {}) => ({
  race: "astartes", subrace: "", patron: "", traits: [], talents: [], skills: {},
  groupSkills: {}, corruption: 0, infamy: 0, psyRating: 0, chars: {}, spentXP: 0, ...over
});
const check = (key, w) => checkEliteRequirements(doc(key).system.requirements, who(w));

describe("у всех семи архетипов требования заведены", () => {
  for (const key of Object.keys(ID)) {
    it(`${key}: блок требований непуст, есть характеристики или Навыки`, () => {
      const r = doc(key).system.requirements;
      expect(r.primary.length + r.secondary.length).toBeGreaterThan(0);
      expect(r.secondary.some(e => ["characteristic", "skill", "talent", "trait", "psyRating"].includes(e.kind))).toBe(true);
    });

    it(`${key}: «Становление» из книги лежит в карточке и в требованиях строкой для ГМ`, () => {
      const d = doc(key);
      expect(d.system.notes).toMatch(/^Становление \(книга\):/);
      const manual = d.system.requirements.secondary.filter(e => e.kind === "other" && /^Становление:/.test(e.text));
      expect(manual).toHaveLength(1);
    });

    it(`${key}: записи ссылаются на существующие ключи и ранги`, () => {
      const all = [...doc(key).system.requirements.primary, ...doc(key).system.requirements.secondary];
      const ids = all.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const e of all) {
        if (e.kind === "characteristic") expect(CHARACTERISTICS[e.charKey], e.charKey).toBeTruthy();
        if (e.kind === "skill") {
          expect((e.scope === "group" ? GROUP_SKILLS_DEF : SKILLS_DEF)[e.skillKey], e.skillKey).toBeTruthy();
          expect(RANK_ORDER).toContain(e.rank);
        }
        if (e.kind === "talent" || e.kind === "trait") expect(e.uuid).toMatch(/^Compendium\.warhammer-dbc\.(talents|traits)\.Item\.[A-Za-z0-9]{16}$/);
      }
    });
  }
});

describe("Покровительство — обязательный блок (архетипа нет в списке без него)", () => {
  const CASES = [["noise", "slaanesh"], ["plague", "nurgle"], ["khorne", "khorne"], ["rubric", "tzeentch"]];
  for (const [key, god] of CASES) {
    it(`${key}: нужен ${god}`, () => {
      expect(doc(key).system.requirements.primary).toEqual([expect.objectContaining({ kind: "patron", key: god })]);
      expect(check(key, { patron: god }).available).toBe(true);
      expect(check(key, { patron: "" }).available).toBe(false);
      expect(check(key, { patron: god === "khorne" ? "nurgle" : "khorne" }).available).toBe(false);
    });
  }
  for (const key of ["apostle", "executions", "warpsmith"]) {
    it(`${key}: Покровительства книга не требует`, () => {
      expect(doc(key).system.requirements.primary).toEqual([]);
      expect(check(key, { patron: "" }).available).toBe(true);
    });
  }
});

describe("пикер: eliteAvailability по настоящим записям", () => {
  it("Шумовой Десантник: Астартес без Покровительства Слаанеш его не видит", () => {
    expect(eliteAvailability(actor({ race: "astartes" }), doc("noise")).available).toBe(false);
    expect(eliteAvailability(actor({ race: "astartes", patronGod: "slaanesh" }), doc("noise")).available).toBe(true);
  });

  it("Шумовой Десантник: человек со Слаанеш его не видит (метка расы)", () => {
    expect(eliteAvailability(actor({ race: "human", patronGod: "slaanesh" }), doc("noise")).available).toBe(false);
  });

  it("Тёмный Апостол без Покровительства виден (книга его не требует), но красный", () => {
    const res = eliteAvailability(actor({ race: "astartes" }), doc("apostle"));
    expect(res.available).toBe(true);
    expect(res.check.warn).toBe(true);
    expect(res.check.secondaryUnmet).toEqual(expect.arrayContaining(["Fel 50", "Int 45"]));
  });

  it("Берсерк Кхорна: нехватка WS красит, но не прячет", () => {
    const res = eliteAvailability(actor({ patronGod: "khorne", chars: { ws: 40, s: 50 } }), doc("khorne"));
    expect(res.available).toBe(true);
    expect(res.check.secondaryUnmet).toContain("WS 50");
    expect(res.check.secondaryUnmet).not.toContain("S 45");
  });

  it("Берсерк Кхорна: готовый персонаж не получает красных требований", () => {
    const hatred = ["A", "B", "C"].map(spec => ({ name: "Hatred / Ненависть", spec }));
    const a = actor({
      patronGod: "khorne", chars: { ws: 50, s: 45 },
      talents: [{ name: "Frenzy / Ярость" }, { name: "Fire in Blood / Огонь в Крови" }, ...hatred]
    });
    const res = eliteAvailability(a, doc("khorne"));
    expect(res.available).toBe(true);
    expect(res.check.secondaryUnmet).toEqual([]);
    expect(res.check.warn).toBe(false);
  });

  it("Берсерк Кхорна: две Ненависти вместо трёх — красное", () => {
    const hatred = ["A", "B"].map(spec => ({ name: "Hatred / Ненависть", spec }));
    const a = actor({
      patronGod: "khorne", chars: { ws: 50, s: 45 },
      talents: [{ name: "Frenzy / Ярость" }, { name: "Fire in Blood / Огонь в Крови" }, ...hatred]
    });
    expect(eliteAvailability(a, doc("khorne")).check.secondaryUnmet).toEqual(["Hatred / Ненависть — любые 3"]);
  });

  it("Колдун Рубрики: Трейт Psyker, PR 5 и Command считаются по листу", () => {
    const ready = actor({
      patronGod: "tzeentch", chars: { wp: 50, int: 45 }, psy: 5,
      traits: ["Psyker / Псайкер"], skills: { command: "knows" }
    });
    const res = eliteAvailability(ready, doc("rubric"));
    expect(res.available).toBe(true);
    expect(res.check.secondaryUnmet).toEqual([]);
    const weak = eliteAvailability(actor({ patronGod: "tzeentch", psy: 3, chars: { wp: 50, int: 45 } }), doc("rubric"));
    expect(weak.check.secondaryUnmet).toEqual(expect.arrayContaining(["Психорейтинг 5", "Черта: Psyker / Псайкер"]));
  });

  it("Варп-Кузнец: специализации Навыков считаются каждая отдельно", () => {
    const base = { chars: { int: 45 }, skills: { techUse: "trained" } };
    const ok = actor({
      ...base,
      groupSkills: {
        forbiddenLore: [{ specKey: "daemons", rank: "knows" }],
        trade: [{ specKey: "armourer", rank: "knows" }, { specKey: "weaponsmith", rank: "knows" }]
      }
    });
    expect(eliteAvailability(ok, doc("warpsmith")).check.secondaryUnmet).toEqual([]);
    const half = actor({
      ...base,
      groupSkills: {
        forbiddenLore: [{ specKey: "daemons", rank: "knows" }],
        trade: [{ specKey: "armourer", rank: "knows" }]
      }
    });
    expect(eliteAvailability(half, doc("warpsmith")).check.secondaryUnmet).toEqual([expect.stringMatching(/Оружейник/)]);
  });

  it("Мастер Казней: Awareness+20 — это Опытный, а For.Lore (Warp)+10 — Тренированный", () => {
    const sk = doc("executions").system.requirements.secondary.filter(e => e.kind === "skill");
    expect(sk.find(e => e.skillKey === "awareness").rank).toBe("veteran");
    expect(sk.find(e => e.skillKey === "forbiddenLore")).toMatchObject({ rank: "trained", specKey: "Варп" });
  });

  it("Тёмный Апостол: Charm+10 и обе специализации Запретных знаний", () => {
    const sk = doc("apostle").system.requirements.secondary.filter(e => e.kind === "skill");
    expect(sk.find(e => e.skillKey === "charm").rank).toBe("trained");
    expect(sk.filter(e => e.skillKey === "forbiddenLore").map(e => e.specKey).sort()).toEqual(["Демоны", "Ересь"]);
  });
});

describe("ручные строки: Становление не проверяется машиной, Раны — проверяются", () => {
  it("Становление попадает в manual, 21 Рана — проверяются сами", () => {
    const res = check("plague", { patron: "nurgle", chars: { t: 50 }, maxWounds: 21 });
    expect(res.manual).toEqual([expect.stringMatching(/^Становление:/)]);
    expect(res.unmet).toEqual([]);
    expect(check("plague", { patron: "nurgle", chars: { t: 50 }, maxWounds: 20 }).unmet).toEqual(["Ран (максимум) 21"]);
  });
  it("подпись записи читается человеком", () => {
    const e = doc("rubric").system.requirements.secondary.find(x => x.kind === "psyRating");
    expect(describeEliteReq(e)).toBe("Психорейтинг 5");
  });
  it("Таланты и Трейт ссылаются на настоящие записи пака под тем же именем", () => {
    const named = Object.keys(ID).flatMap(k => doc(k).system.requirements.secondary)
      .filter(e => e.kind === "talent" || e.kind === "trait");
    expect(named.length).toBeGreaterThan(0);
    for (const e of named) {
      const pack = e.kind === "talent" ? "talents" : "traits";
      const id = e.uuid.split(".").pop();
      const found = jsonFiles(join(ROOT, "packs-src", pack)).find(f => f.endsWith(`_${id}.json`));
      expect(found, e.uuid).toBeTruthy();
      expect(JSON.parse(readFileSync(found, "utf8")).name).toBe(e.name);
    }
  });
});
