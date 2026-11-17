import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEliteRequirements } from "../../module/rules/elite-requirements.mjs";

// wdbc-jb0zt, п.2: Умения, Таланты и Трейты Элитных архетипов лежат
// структурными записями требований, а не одной строкой «Другое». Фикстуры —
// настоящие JSON из packs-src (зелёные тесты на выдуманной форме ничего не
// доказывают).

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name);
  return e.isDirectory() ? files(p) : (e.name.endsWith(".json") ? [p] : []);
});
const DOCS = files(join(ROOT, "packs-src/elite-archetypes")).map(p => JSON.parse(readFileSync(p, "utf8"))).filter(d => d.type === "eliteArchetype");
const byName = en => DOCS.find(d => d.name.split(" / ")[0] === en);
const flat = req => [...req.primary, ...req.secondary];
const who = (over = {}) => ({
  race: "", subrace: "", patron: "", traits: [], talents: [], skills: {}, groupSkills: {},
  corruption: 0, infamy: 0, psyRating: 0, chars: {}, spentXP: 0, ...over
});

describe("«Другое» не прячет Умения, Таланты и Трейты", () => {
  const SKILLISH = /[+]\d+|Трейт |Hatred|Lore|Mastery|Mechanicum Implants|Wielder/;
  for (const d of DOCS) {
    it(`${d.name}: ни одной «Другое» со строкой Умения/Таланта`, () => {
      const bad = flat(d.system.requirements)
        .filter(e => e.kind === "other" && !/^Становление/.test(e.text) && SKILLISH.test(e.text));
      // «Техночудеса: ...» у Электрожреца и «1 Scholastic Lore ... Mastery» у
      // Агента Кабала остаются текстом сознательно: модель не знает этих видов.
      const allowed = ["Electro-Priest", "Agent of the Cabal"];
      if (allowed.includes(d.name.split(" / ")[0])) return;
      expect(bad.map(e => e.text)).toEqual([]);
    });
  }

  it("у всех записей требований id уникальны внутри документа", () => {
    for (const d of DOCS) {
      const ids = flat(d.system.requirements).map(e => e.id);
      expect(new Set(ids).size, d.name).toBe(ids.length);
    }
  });
});

describe("Чумной Монах: разнесённые требования работают", () => {
  const monk = () => byName("Plague Monk").system.requirements;
  const entry = (k, pred) => flat(monk()).find(e => e.kind === k && pred(e));

  it("Resistance записан дважды — Disease и Poison", () => {
    const specs = flat(monk()).filter(e => e.kind === "talent" && /^Resistance/.test(e.name)).map(e => e.specialization);
    expect(specs.sort()).toEqual(["Disease", "Poison"]);
  });
  it("Выживание +10 — Тренированное, Запретные знания (Ересь)+10", () => {
    expect(entry("skill", e => e.skillKey === "survival").rank).toBe("trained");
    expect(entry("skill", e => e.skillKey === "forbiddenLore").specKey).toBe("Ересь");
  });
  it("персонаж без Умений и Талантов не проходит, а с ними — проходит", () => {
    const empty = checkEliteRequirements(monk(), who({ patron: "nurgle", chars: { t: 50, wp: 35 } }));
    expect(empty.available).toBe(false);
    expect(empty.primaryUnmet.length).toBeGreaterThan(5);

    const names = ["Tireless / Неутомимый", "True Grit / Настоящая Выдержка", "Unarmed Master / Безоружный Мастер", "Meditation / Медитация"];
    const full = checkEliteRequirements(monk(), who({
      patron: "nurgle", chars: { t: 50, wp: 35 },
      talents: [...names.map(name => ({ name })), { name: "Resistance / Сопротивление", specialization: "Disease" },
        { name: "Resistance / Сопротивление", specialization: "Poison" }],
      skills: { survival: "trained" },
      groupSkills: {
        forbiddenLore: [{ specKey: "heresy", specialty: "Ересь", rank: "trained" }],
        trade: [{ specKey: "chymist", specialty: "Химик", rank: "knows" }]
      }
    }));
    expect(full.primaryUnmet).toEqual([]);
    expect(full.available).toBe(true);
  });
});

describe("Архимагос и Секутор: трейт и Таланты структурно, отрицание — текстом", () => {
  it("Архимагос требует Трейт Mechanicum Implants и Таланты", () => {
    const r = flat(byName("Archmagos").system.requirements);
    expect(r.find(e => e.kind === "trait").name).toMatch(/Mechanicum Implants/);
    expect(r.filter(e => e.kind === "talent").map(e => e.name.split(" / ")[0]).sort())
      .toEqual(["Binary Dominion", "Cybernetic Rebirth"]);
    expect(r.filter(e => e.kind === "other")).toHaveLength(0);
    expect(r.find(e => e.kind === "notElite").text).toBe("Secutor, Malagra, Tech-Assassin");
  });
  it("Секутор: Hatred любые 3 со счётчиком, Two Weapon Wielder (Ranged)", () => {
    const r = flat(byName("Secutor").system.requirements);
    expect(r.find(e => e.kind === "talent" && /^Hatred/.test(e.name)).count).toBe(3);
    expect(r.find(e => e.kind === "talent" && /^Two Weapon/.test(e.name)).specialization).toBe("Ranged");
  });
  it("Агент Кабала: характеристики, Ересь Хоруса +30 и Мастерство (Демоны)", () => {
    const r = flat(byName("Agent of the Cabal").system.requirements);
    expect(r.filter(e => e.kind === "characteristic").map(e => `${e.charKey}${e.value}`)).toEqual(["int60", "wp60", "fel60"]);
    expect(r.find(e => e.kind === "skill").rank).toBe("expert");
    expect(r.find(e => e.kind === "talent").specialization).toBe("Запретные знания (Демоны)");
  });
});

describe("Взаимоисключающие архетипы Механикус — «не взят» вместо текста", () => {
  const NAMES = ["Archmagos", "Malagra", "Secutor", "Tech-Assassin"];
  for (const n of NAMES) {
    it(`${n}: запись notElite перечисляет трёх остальных`, () => {
      const e = flat(byName(n).system.requirements).find(x => x.kind === "notElite");
      expect(e, n).toBeTruthy();
      const listed = e.text.split(",").map(s => s.trim()).sort();
      expect(listed).toEqual(NAMES.filter(x => x !== n).sort());
    });
  }
  it("Малагра закрыта тому, у кого уже есть Секутор; свободна без него", () => {
    const req = byName("Malagra").system.requirements;
    const secutor = { eliteArchetypes: [{ name: "Secutor / Секутор" }] };
    const has = checkEliteRequirements(req, who(secutor)).unmet.some(m => /Не взят архетип/.test(m));
    const none = checkEliteRequirements(req, who({ eliteArchetypes: [] })).unmet.some(m => /Не взят архетип/.test(m));
    expect(has).toBe(true);
    expect(none).toBe(false);
  });
});

describe("Отрицание, психосилы и Раны — структурно, а не текстом ГМу", () => {
  const unmetOf = (en, w) => checkEliteRequirements(byName(en).system.requirements, who(w)).unmet.join("|");
  const manualOf = (en) => checkEliteRequirements(byName(en).system.requirements, who()).manual.join("|");

  it("Медуза: Blunted в Трейтах закрывает архетип, без него — проходит", () => {
    expect(flat(byName("Medusae").system.requirements).find(e => e.kind === "notHas").text).toBe("Blunted");
    expect(unmetOf("Medusae", { items: [{ name: "Blunted / Затупленный (X)" }] })).toMatch(/Нет: Blunted/);
    expect(unmetOf("Medusae", { items: [] })).toBe("");
  });
  it("Броненосец: Латы Скитарии или Импланты Механикум закрывают архетип", () => {
    const base = { chars: { inf: 30 }, corruption: 30, spentXP: 3500 };
    expect(unmetOf("Ironclad", { ...base, items: [{ name: "Mechanicum Implants / Импланты Механикум" }] })).toMatch(/Нет:/);
    expect(unmetOf("Ironclad", { ...base, items: [{ name: "Skitarii War Plate / Боевые Латы Скитари" }] })).toMatch(/Нет:/);
    expect(unmetOf("Ironclad", { ...base, items: [] })).not.toMatch(/Нет:/);
  });
  it("Кенетаи: нужны обе психосилы, одной мало", () => {
    expect(flat(byName("Kenetai").system.requirements).find(e => e.kind === "power").text).toBe("Mind Link, Precognitive Strike");
    expect(unmetOf("Kenetai", { powers: [{ name: "Mind Link / Мысленная Связь" }] })).toMatch(/Изучены силы/);
    expect(unmetOf("Kenetai", { powers: [{ name: "Mind Link / Мысленная Связь" }, { name: "Precognitive Strike / Прекогнитивный Удар" }] }))
      .not.toMatch(/Изучены силы/);
  });
  it("Чумной Десантник: максимум Ран не ниже 21", () => {
    expect(unmetOf("Plague Marine", { maxWounds: 20 })).toMatch(/Ран \(максимум\) 21/);
    expect(unmetOf("Plague Marine", { maxWounds: 21 })).not.toMatch(/Ран \(максимум\)/);
  });
  it("эти четыре больше не ждут руки ГМа по своим пунктам", () => {
    expect(manualOf("Medusae")).toBe("");
    expect(manualOf("Kenetai")).not.toMatch(/Психосилы/);
    expect(manualOf("Plague Marine")).not.toMatch(/Ран:/);
  });
});

describe("Ламия — пол, Когитор — специализации суммарно", () => {
  const unmetOf = (en, w) => checkEliteRequirements(byName(en).system.requirements, who(w)).unmet.join("|");
  const s = (k, spec, rank = "trained") => ({ specKey: spec, specialty: spec, rank });
  it("Ламия: мужской тип тела предупреждает, женский — нет", () => {
    expect(unmetOf("Lhamaean", { race: "drukhari", bodyType: "male" })).toMatch(/Пол: женский/);
    expect(unmetOf("Lhamaean", { race: "drukhari", bodyType: "female" })).toBe("");
  });
  it("Когитор: три специализации складываются из двух Умений", () => {
    const base = { patron: "tzeentch" };
    const two = { ...base, groupSkills: { scholasticLore: [s("scholasticLore", "a"), s("scholasticLore", "b")] } };
    expect(unmetOf("Cogitor", two)).toMatch(/специализации суммарно/);
    const three = { ...base, groupSkills: { scholasticLore: [s("scholasticLore", "a"), s("scholasticLore", "b")], forbiddenLore: [s("forbiddenLore", "c")] } };
    expect(unmetOf("Cogitor", three)).not.toMatch(/специализации суммарно/);
    const weak = { ...base, groupSkills: { scholasticLore: [s("scholasticLore", "a"), s("scholasticLore", "b")], forbiddenLore: [s("forbiddenLore", "c", "knows")] } };
    expect(unmetOf("Cogitor", weak)).toMatch(/специализации суммарно/);
  });
});

describe("Агент Кабала (Mastery) и Электрожрец (Техночудеса)", () => {
  const unmetOf = (en, w) => checkEliteRequirements(byName(en).system.requirements, who(w)).unmet.join("|");
  const m = specialization => ({ name: "Mastery / Мастерство", specialization });
  it("Агент Кабала: нужны два Mastery в Запретных знаниях и один в Ученых", () => {
    const base = { chars: { int: 60, wp: 60, fel: 60 }, groupSkills: { forbiddenLore: [{ specKey: "Ересь Хоруса и Долгая Война", rank: "expert" }] } };
    const one = unmetOf("Agent of the Cabal", { ...base, talents: [m("Запретные знания (Демоны)")] });
    expect(one).toMatch(/Запретные знания/);
    expect(one).toMatch(/Ученые знания/);
    const all = unmetOf("Agent of the Cabal", { ...base, talents: [m("Запретные знания (Демоны)"), m("Forbidden Lore (Xenos)"), m("Ученые знания (Тактика)")] });
    expect(all).not.toMatch(/Mastery/);
  });
  it("Электрожрец: три Техночуда, три силы из пака проходят, две — нет", () => {
    const need = ["Voltagheist Shield / Вольтагейст Щит", "Luminen Shock / Люминен Шок", "Electroepithany / Электропрозрение"];
    expect(unmetOf("Electro-Priest", { powers: need.slice(0, 2).map(name => ({ name })) })).toMatch(/Изучены силы/);
    expect(unmetOf("Electro-Priest", { powers: need.map(name => ({ name })) })).not.toMatch(/Изучены силы/);
  });
});

describe("Агент Кабала: «Не-Хаосит» — по Мировоззрению", () => {
  it("Хаосит не проходит, Лоялист и Ренегат — проходят; «Другое» не осталось", () => {
    const req = byName("Agent of the Cabal").system.requirements;
    expect(flat(req).filter(e => e.kind === "other")).toHaveLength(0);
    const unmet = alignment => checkEliteRequirements(req, who({ alignment })).unmet.join("|");
    expect(unmet("heretic")).toMatch(/не Хаосит/);
    expect(unmet("loyalist")).not.toMatch(/Хаосит/);
    expect(unmet("renegade")).not.toMatch(/Хаосит/);
  });
});

describe("Тёмный Апостол: Становление записано полем", () => {
  it("текст Становления есть и называет обе дороги (ученичество и убийство)", () => {
    const b = byName("Dark Apostle").system.becoming;
    expect(b).toMatch(/обучение у другого Тёмного Апостола/);
    expect(b).toMatch(/убить Апостола/);
  });
});

describe("Становление записано полем у всех архетипов, кроме Шамана Зверолюдей (в книгах текста нет)", () => {
  const NO_BOOK_TEXT = ["Beastman Shaman"];
  for (const d of DOCS) {
    const en = d.name.split(" / ")[0];
    if (NO_BOOK_TEXT.includes(en)) continue;
    it(`${d.name}: поле «Становление» не пустое`, () => {
      expect(String(d.system.becoming || "").trim().length).toBeGreaterThan(20);
    });
  }
  it("текст Ведьмы лежит у Ведьмы, а Инкуба — про испытание Воином Аспекта", () => {
    expect(byName("Wych").system.becoming).toMatch(/Культ Ведьм/);
    expect(byName("Incubus").system.becoming).toMatch(/Воином Аспекта/);
    expect(byName("Incubus").system.becoming).not.toMatch(/Культ Ведьм/);
  });
});
