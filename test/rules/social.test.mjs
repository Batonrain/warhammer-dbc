// test/rules/social.test.mjs
//
// Что вкладка СОЦИУМ считает «социальным». Отбор идёт по следу в данных, а не
// по списку предметов: правило живёт в эффекте, и любой предмет, что двигает
// Обаяние, Общительность, Лояльность или Сплочённость, попадает в блок
// «Модификаторы» сам, без ручной пометки.

import { describe, it, expect } from "vitest";
import { SOCIAL_SKILL_KEYS, isSocialKey, socialChangeLabel, socialEffectsOf,
         isSocialSource, socialMentions, socialReasons } from "../../module/rules/social.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

describe("социальные Навыки", () => {
  it("это ровно те, у кого вторая склонность «Социальные»", () => {
    expect(SOCIAL_SKILL_KEYS.sort()).toEqual(
      Object.entries(SKILLS_DEF).filter(([, d]) => d.apt2 === "social").map(([k]) => k).sort());
    expect(SOCIAL_SKILL_KEYS).toContain("charm");
    expect(SOCIAL_SKILL_KEYS).toContain("intimidate");
    expect(SOCIAL_SKILL_KEYS).not.toContain("dodge");
  });
});

describe("isSocialKey", () => {
  it("ключи Навыков, Общительности, Лояльности и Сплочённости — социальные", () => {
    expect(isSocialKey("system.skills.charm.total")).toBe(true);
    expect(isSocialKey("system.characteristics.fel.total")).toBe(true);
    expect(isSocialKey("system.loyalty.max")).toBe(true);
    expect(isSocialKey("system.cohesion.value")).toBe(true);
  });

  it("боевое и прочее — нет", () => {
    expect(isSocialKey("system.skills.dodge.total")).toBe(false);
    expect(isSocialKey("system.characteristics.ws.total")).toBe(false);
    expect(isSocialKey("system.wounds.max")).toBe(false);
    expect(isSocialKey("")).toBe(false);
  });
});

describe("socialChangeLabel", () => {
  it("называет правку по-человечески", () => {
    expect(socialChangeLabel("system.skills.charm.total", 10)).toBe("Обаяние +10");
    expect(socialChangeLabel("system.characteristics.fel.total", 5)).toBe("Общительность +5");
    expect(socialChangeLabel("system.loyalty.max", 2)).toBe("Лояльность +2");
    expect(socialChangeLabel("system.cohesion.value", -1)).toBe("Сплочённость -1");
  });
});

// У Талантов, Черт и Мутаций правило почти всегда словами, а не эффектом,
// поэтому социальность видна по упоминанию Навыков и понятий. Без этого на
// вкладку сползал весь лист — вплоть до «Меткого выстрела».
describe("socialMentions", () => {
  it("ловит русские названия в любой форме", () => {
    expect(socialMentions("+10 к Командованию против своей банды")).toEqual(["Командование"]);
    expect(socialMentions("Переброс Запугивания и Обмана")).toEqual(["Обман", "Запугивание"]);
    expect(socialMentions("Лояльность миньонов не падает")).toEqual(["Лояльность"]);
    expect(socialMentions("Сплочённость отряда +1")).toEqual(["Сплочённость"]);
  });

  it("ловит английские и обходит похожие слова", () => {
    expect(socialMentions("Gain +10 to Charm tests")).toEqual(["Обаяние"]);
    expect(socialMentions("Fellowship bonus")).toEqual(["Общительность"]);
    // Felling — свойство оружия, к Общительности отношения не имеет.
    expect(socialMentions("Felling (2) ignores Unnatural Toughness")).toEqual([]);
  });

  it("боевое и пустое не ловит", () => {
    expect(socialMentions("Персонаж бьёт первым и наносит +2 урона")).toEqual([]);
    expect(socialMentions("")).toEqual([]);
    expect(socialMentions(undefined)).toEqual([]);
  });
});

describe("socialReasons", () => {
  it("машинный след важнее текста — он точнее", () => {
    const reasons = socialReasons(
      { changes: [{ key: "system.skills.charm.total", value: 10 }] },
      "Что-то про Командование");
    expect(reasons).toEqual(["Обаяние +10"]);
  });

  it("без машинного следа берётся текст правила", () => {
    expect(socialReasons({}, "Даёт +10 на тесты Дознания")).toEqual(["Дознание"]);
  });

  it("совсем не социальный Талант не попадает никуда", () => {
    expect(socialReasons({}, "Перезарядка оружия становится полудействием")).toEqual([]);
  });
});

describe("socialEffectsOf", () => {
  it("собирает правки эффектов", () => {
    const src = { changes: [
      { key: "system.skills.intimidate.total", value: 10 },
      { key: "system.skills.dodge.total", value: 10 }
    ] };
    expect(socialEffectsOf(src)).toEqual(["Запугивание +10"]);
    expect(isSocialSource(src)).toBe(true);
  });

  it("надбавка Общительности от предмета тоже считается", () => {
    expect(socialEffectsOf({ charBonuses: [{ stat: "fel", value: 3 }] })).toEqual(["Общительность +3"]);
    expect(socialEffectsOf({ charBonuses: [{ stat: "s", value: 3 }] })).toEqual([]);
    expect(socialEffectsOf({ charBonuses: [{ stat: "fel", value: 0 }] })).toEqual([]);
  });

  it("предмет без социального следа в блок не попадает", () => {
    expect(isSocialSource({ changes: [{ key: "system.wounds.max", value: 5 }] })).toBe(false);
    expect(isSocialSource({})).toBe(false);
  });
});
