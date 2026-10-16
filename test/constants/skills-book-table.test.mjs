// Сверка Навыков с книгой (Основная книга, «III. ПРОДВИЖЕНИЕ» → «НАВЫКИ»,
// стр. 57-61): сводная таблица Навык/Х-ка/Бог/Скл2 и заголовки «Бог: … | Скл.: …»
// в описаниях. Таблица ниже переписана с книги, а не выведена из кода — иначе
// тест проверял бы код сам по себе. Бог и Склонности решают цену Продвижения
// (patronage.mjs, advancement.mjs), поэтому ошибка здесь тихо меняет цену.
import { describe, it, expect } from "vitest";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { SKILL_GOD, skillGodOf } from "../../module/constants/patronage.mjs";
import { SKILL_SPECIALIZATIONS } from "../../module/constants/skill-specializations.mjs";
import { SKILL_DESCRIPTIONS } from "../../module/constants/skill-descriptions.mjs";
import { SKILL_SPECIALTY_DESCRIPTIONS } from "../../module/constants/skill-specialty-descriptions.mjs";
import { skillActionOf } from "../../module/constants/skill-actions.mjs";

// ключ → [Х-ка, Бог, Скл2]
const BOOK_SKILLS = {
  acrobatics:    ["ag",  "slaanesh",  "general"],
  athletics:     ["s",   "khorne",    "general"],
  awareness:     ["per", "undivided", "fieldcraft"],
  charm:         ["fel", "slaanesh",  "social"],
  command:       ["fel", "khorne",    "social"],
  commerce:      ["int", "undivided", "social"],
  deceive:       ["fel", "slaanesh",  "social"],
  dodge:         ["ag",  "slaanesh",  "defence"],
  inquiry:       ["fel", "undivided", "social"],
  interrogate:   ["wp",  "undivided", "social"],
  intimidate:    ["wp",  "nurgle",    "social"],
  logic:         ["int", "tzeentch",  "knowledge"],
  medicae:       ["int", "nurgle",    "fieldcraft"],
  parry:         ["ws",  "khorne",    "defence"],
  psyniscience:  ["per", "tzeentch",  "psyker"],
  scrutiny:      ["per", "tzeentch",  "general"],
  security:      ["int", "undivided", "tech"],
  sleightOfHand: ["ag",  "undivided", "finesse"],
  stealth:       ["ag",  "undivided", "fieldcraft"],
  survival:      ["per", "nurgle",    "fieldcraft"],
  techUse:       ["int", "undivided", "tech"]
};

// Группы: Common Lore и Trade — «Бог: Всегда Дружественный», Скл2 в книге не указана.
const BOOK_GROUPS = {
  forbiddenLore:  ["int", "tzeentch",  "knowledge"],
  linguistics:    ["int", "undivided", "general"],
  navigation:     ["int", "undivided", "fieldcraft"],
  operate:        ["ag",  "undivided", "fieldcraft"],
  scholasticLore: ["int", "undivided", "knowledge"]
};

describe("Навыки: сводная таблица книги против кода", () => {
  it("в коде ровно те обычные Навыки, что в книге", () => {
    expect(Object.keys(SKILLS_DEF).sort()).toEqual(Object.keys(BOOK_SKILLS).sort());
  });

  for (const [key, [char, god, apt2]] of Object.entries(BOOK_SKILLS)) {
    it(`${key}: Х-ка ${char}, Бог ${god}, Скл2 ${apt2}`, () => {
      expect(SKILLS_DEF[key].char).toBe(char);
      expect(SKILLS_DEF[key].apt2).toBe(apt2);
      expect(SKILL_GOD[key]).toBe(god);
    });
  }

  for (const [key, [char, god, apt2]] of Object.entries(BOOK_GROUPS)) {
    it(`группа ${key}: Х-ка ${char}, Бог ${god}, Скл2 ${apt2}`, () => {
      expect(GROUP_SKILLS_DEF[key].char).toBe(char);
      expect(GROUP_SKILLS_DEF[key].apt2).toBe(apt2);
      expect(skillGodOf(key, "")).toBe(god);
      expect(GROUP_SKILLS_DEF[key].alwaysAlly).toBeFalsy();
    });
  }

  it("Общие Знания и Ремесло — «Всегда Дружественный», Бога у них нет", () => {
    for (const key of ["commonLore", "trade"]) {
      expect(GROUP_SKILLS_DEF[key].alwaysAlly, key).toBe(true);
      expect(SKILL_GOD[key], key).toBeUndefined();
    }
  });

  it("Запретные Знания: «Ересь» — Нургл вместо Тзинча, остальные специализации — Тзинч", () => {
    expect(skillGodOf("forbiddenLore", "Heresy")).toBe("nurgle");
    expect(skillGodOf("forbiddenLore", "Daemons")).toBe("tzeentch");
  });

  it("Вождение: Корабль — на Интеллекте, Наземное и Полёт — на Ловкости", () => {
    const by = Object.fromEntries(SKILL_SPECIALIZATIONS.operate.map(s => [s.key, s.char]));
    expect(by).toEqual({ surface: "ag", aeronautica: "ag", voidship: "int" });
  });

  it("у каждой группы есть описание и оно не перечисляет специализации", () => {
    const groups = Object.keys(GROUP_SKILLS_DEF);
    for (const key of groups) {
      const desc = SKILL_DESCRIPTIONS[key];
      expect(desc, key).toBeTruthy();
      for (const spec of SKILL_SPECIALIZATIONS[key] || []) {
        if (spec.free) continue;
        expect(desc, `${key}: ${spec.label}`).not.toContain(spec.label);
      }
    }
  });

  it("у каждого Навыка и группы есть строка «Действие», у Вождения — на каждую специализацию", () => {
    for (const key of [...Object.keys(SKILLS_DEF), ...Object.keys(GROUP_SKILLS_DEF)]) {
      if (key === "operate") continue;
      expect(skillActionOf(key), key).toMatch(/^Действие: /);
    }
    for (const spec of SKILL_SPECIALIZATIONS.operate) {
      expect(skillActionOf("operate", spec.label), spec.label).toMatch(/^Действие: /);
    }
    expect(skillActionOf("dodge")).toBe("Действие: Реакция.");
    expect(skillActionOf("operate", "Voidship")).not.toBe(skillActionOf("operate", "Surface"));
  });

  it("у каждой специализации каталога есть своё описание", () => {
    for (const [group, list] of Object.entries(SKILL_SPECIALIZATIONS)) {
      for (const spec of list) {
        expect(SKILL_SPECIALTY_DESCRIPTIONS[group]?.[spec.label], `${group}: ${spec.label}`).toBeTruthy();
      }
    }
  });
});
