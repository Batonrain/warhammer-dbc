// test/apps/origin-skill-mechanics.test.mjs
//
// Навыки Рас, Субрас и Архетипов переехали из текстовых полей в Конструктор
// Механики. Проверяется не разбор строк (он одноразовый, в tools/), а то, что
// в паках осталось после перегона: записи на месте, строки пусты, и «любые N»
// записаны так, как их читает применение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { SKILL_SPECIALIZATIONS } from "../../module/constants/skill-specializations.mjs";

const FLAG = "warhammer-dbc";
const TYPES = ["race", "subrace", "archetype"];

// packDocuments отдаёт { file, doc } и фильтрует по типу — субрасы лежат в
// том же паке, что и расы, поэтому три захода, а не один.
const origins = TYPES
  .flatMap(t => packDocuments(["races", "archetypes"], t))
  .map(x => x.doc);

/** Все записи всех групп, включая вложенные подгруппы. */
function allEntries(doc) {
  const out = [];
  const walk = list => {
    for (const e of list || []) {
      if (e?.kind === "group") walk(e.group?.entries);
      else out.push(e);
    }
  };
  for (const g of doc.flags?.[FLAG]?.mechanics || []) walk(g.entries);
  return out;
}

const skills = origins.flatMap(d => allEntries(d).filter(e => e?.kind === "skill")
  .map(e => ({ doc: d.name, e })));

describe("навыки Происхождений в Конструкторе", () => {
  it("записи навыков появились", () => {
    expect(skills.length).toBeGreaterThan(200);
  });

  // Строка и записи вместе означали бы двойную выдачу: одну сделал бы
  // Конструктор, вторую — Мастер, если в него когда-нибудь вернут разбор.
  it("у переведённых записей строка навыков пуста", () => {
    const both = origins.filter(d =>
      String(d.system?.skills || "").trim() && allEntries(d).some(e => e?.kind === "skill"));
    expect(both.map(d => d.name)).toEqual([]);
  });

  it("каждая запись ссылается на существующий Навык", () => {
    const bad = skills.filter(({ e }) => e.skillScope === "group"
      ? !GROUP_SKILLS_DEF[e.skillKey] : !SKILLS_DEF[e.skillKey]);
    expect(bad.map(x => `${x.doc}: ${x.e.skillKey}`)).toEqual([]);
  });

  it("ранг из книжного «+N» лёг ступенью, а не остался нетренированным", () => {
    const ranks = new Set(skills.map(x => x.e.rank));
    expect(ranks.has("untrained")).toBe(false);
    expect(ranks.has("knows")).toBe(true);
  });
});

describe("«любые N» специализаций", () => {
  const choice = skills.filter(x => x.e.specKey === "__choice__");

  it("такие записи есть — иначе перегон потерял бы «Общие знания (любые 4)»", () => {
    expect(choice.length).toBeGreaterThan(0);
    expect(choice.some(x => (Number(x.e.specChoiceCount) || 1) > 1)).toBe(true);
  });

  it("кандидатов не меньше, чем нужно выбрать", () => {
    const bad = choice.filter(x =>
      (x.e.specChoiceKeys || []).length < Math.max(1, Number(x.e.specChoiceCount) || 1));
    expect(bad.map(x => `${x.doc}: ${x.e.skillKey}`)).toEqual([]);
  });

  it("каждый кандидат — настоящая специализация своей группы", () => {
    const bad = [];
    for (const { doc, e } of choice) {
      const keys = new Set((SKILL_SPECIALIZATIONS[e.skillKey] || []).map(s => s.key));
      for (const k of e.specChoiceKeys || []) if (!keys.has(k)) bad.push(`${doc}: ${e.skillKey}/${k}`);
    }
    expect(bad).toEqual([]);
  });

  // Свободная заготовка («<Регион>») выбором быть не может: подставить в неё
  // регион в диалоге негде. Касается только «любой из группы»: когда книга
  // называет варианты поимённо («Battle Cant или High Gothic»), она вправе
  // назвать и такую — там подстановку делает ГМ, а не диалог.
  it("в «любой из группы» заготовки с подстановкой не попали", () => {
    const bad = [];
    for (const { doc, e } of choice.filter(x => x.e.specChoiceAny)) {
      const free = new Set((SKILL_SPECIALIZATIONS[e.skillKey] || []).filter(s => s.free).map(s => s.key));
      for (const k of e.specChoiceKeys || []) if (free.has(k)) bad.push(`${doc}: ${e.skillKey}/${k}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("выбор целой записи", () => {
  // «Intimidate или Security» — ИЛИ-группа: актор берёт одно, а не оба.
  it("«A или B» стали ИЛИ-группами", () => {
    const orGroups = origins.flatMap(d => (d.flags?.[FLAG]?.mechanics || [])
      .filter(g => g.operator === "OR" && (g.entries || []).every(e => e?.kind === "skill")));
    expect(orGroups.length).toBeGreaterThan(20);
    for (const g of orGroups) expect(g.entries.length).toBeGreaterThan(1);
  });
});

// Таланты Происхождений переехали тем же перегоном, что и Навыки.
describe("таланты Происхождений в Конструкторе", () => {
  const talents = origins.flatMap(d => allEntries(d).filter(e => e?.kind === "talent")
    .map(e => ({ doc: d.name, e })));

  it("записи талантов появились", () => {
    expect(talents.length).toBeGreaterThan(200);
  });

  it("каждая ссылается на запись пака Талантов", () => {
    const bad = talents.filter(({ e }) =>
      !/^Compendium\.warhammer-dbc\.talents\.Item\.\w+$/.test(e.sourceUuid || ""));
    expect(bad.map(x => `${x.doc}: ${x.e.sourceName || "?"}`)).toEqual([]);
  });
});

// «12 Талантов 1 уровня» и «500хр на Психосилы» — тот же выбор из компендиума с
// фильтром, только бюджет считается штуками и опытом.
describe("выбор с бюджетом", () => {
  const picks = origins.flatMap(d => allEntries(d)
    .filter(e => e?.kind === "equipment" && e.equipMode === "choice")
    .map(e => ({ doc: d.name, e })));

  it("записи с бюджетом появились", () => {
    expect(picks.length).toBeGreaterThan(0);
  });

  it("бюджет штуками ставит фильтр по ступени Таланта", () => {
    const byCount = picks.filter(x => x.e.equipBudgetMode === "count" && x.e.equipCategoryPack === "talents");
    expect(byCount.length).toBeGreaterThan(0);
    for (const { e } of byCount) expect([1, 2, 3]).toContain(Number(e.equipTalentTier));
  });

  it("бюджет опытом смотрит в Психосилы или Техночудеса", () => {
    const byXP = picks.filter(x => x.e.equipBudgetMode === "xp");
    expect(byXP.length).toBeGreaterThan(0);
    for (const { e } of byXP) {
      expect(["psychic-powers", "tech-powers"]).toContain(e.equipCategoryPack);
      expect(Number(e.equipBudgetValue)).toBeGreaterThan(0);
    }
  });
});

// «Minion (Высший, Человек)» и «L. Chain Weapon (до R1)» — тот же выбор с
// фильтром: слот слуги и класс оружия папкой компендиума.
describe("слоты Миньонов и классы оружия", () => {
  it("Талант Миньона несёт пару «группа + сила»", () => {
    const minions = origins.flatMap(d => allEntries(d)
      .filter(e => e?.kind === "talent" && /Minion of Chaos/i.test(e.sourceName || "")));
    expect(minions.length).toBeGreaterThan(0);
    for (const e of minions) {
      // Пустая группа законна: «Minion (Средний)» книга оставляет на выбор, и
      // недостающее спрашивается при выдаче. Сила названа всегда.
      expect(["", "human", "beast", "machine", "daemon"]).toContain(e.minionGroup || "");
      expect(["lesser", "standard", "greater", "horde", "superior"]).toContain(e.minionTier);
    }
  });

  it("класс оружия задан папкой компендиума, а не именем предмета", () => {
    const byFolder = origins.flatMap(d => allEntries(d)
      .filter(e => e?.kind === "equipment" && e.equipMode === "choice"
                && e.equipCategoryPack === "weapons"));
    expect(byFolder.length).toBeGreaterThan(0);
    for (const e of byFolder) expect(e.equipWeaponType).toMatch(/^\w{16}$/);
  });
});
