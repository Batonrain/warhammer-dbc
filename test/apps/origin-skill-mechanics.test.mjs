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
