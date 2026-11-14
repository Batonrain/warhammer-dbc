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
