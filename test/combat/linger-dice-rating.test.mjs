// test/combat/linger-dice-rating.test.mjs
//
// Сверка Главы 3 (03.11.2026), решение владельца: рейтинг свойства Linger
// может быть кубиком — «Linger (1d5)» у Даров Одержимого «Демоническое
// Дыхание» и «Демоническая Артиллерия» (книга, раздел «Дары: Стрельба»).
// Раньше движок держал только число и данные несли среднее «3» с пометкой.
//
// Проверяем четыре звена цепочки: агрегат свойств → кнопка на карточке →
// бросок длительности при размещении зоны → данные двух Даров.

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  aggregateAuto, resolveWeaponPropsList, hasLinger, resolveLingerRounds
} from "../../module/combat/weapon-properties.mjs";
import { attackCard } from "../../module/combat/attack-card.mjs";

const props = list => aggregateAuto(resolveWeaponPropsList(list));

describe("Linger — рейтинг-кубик в агрегате свойств", () => {
  it("Linger (1d5) остаётся строкой-кубиком, не схлопывается в NaN/0", () => {
    const wp = props([{ key: "linger", rating: "1d5" }]);
    expect(wp.lingerRating).toBe("1d5");
    expect(hasLinger(wp)).toBe(true);
  });

  it("числовой Linger ведёт себя как раньше: максимум из нескольких записей", () => {
    expect(props([{ key: "linger", rating: 2 }, { key: "linger", rating: 4 }]).lingerRating).toBe(4);
    expect(hasLinger(props([{ key: "linger", rating: 2 }]))).toBe(true);
  });

  it("нет Linger или рейтинг 0 — зоны нет", () => {
    expect(hasLinger(props([]))).toBe(false);
    expect(hasLinger(props([{ key: "linger", rating: 0 }]))).toBe(false);
  });

  it("кубик побеждает число, когда у оружия две записи Linger", () => {
    expect(props([{ key: "linger", rating: 3 }, { key: "linger", rating: "1d5" }]).lingerRating).toBe("1d5");
    expect(props([{ key: "linger", rating: "1d5" }, { key: "linger", rating: 3 }]).lingerRating).toBe("1d5");
  });
});

describe("Linger (1d5) — кнопка зоны на карточке атаки", () => {
  const base = {
    actorName: "Одержимый", weaponName: "Демоническое Дыхание", wp: {},
    threshold: 45, rv: 23, modeLine: "Одиночный", hit: true, deg: 3,
    hitsCount: 2, hits: [{ total: 11, loc: "Торс" }, { total: 8, loc: "Торс" }],
    hitLocLabel: "Торс", locRoll: 32, dtLabel: "Едкий", pen: 2
  };

  it("кнопка «Остаётся» есть, длительность — кубик (data-linger=1d5), общая зона на все попадания", () => {
    const html = attackCard({ ...base, wp: { spray: true, lingerRating: "1d5" } });
    expect(html).toContain("Разместить зону «Остаётся» (1d5 раунд.)");
    expect(html).toContain('data-linger="1d5"');
    expect(html).not.toContain("Разместить шаблон 1");
  });

  it("с Blast и Linger (1d5) по-прежнему одна общая зона, не шаблон на каждое попадание", () => {
    const html = attackCard({ ...base, wp: { blastRating: 5, lingerRating: "1d5" } });
    expect(html).toContain("Разместить зону «Остаётся»");
    expect(html).not.toContain("Разместить шаблон 1");
  });
});

describe("resolveLingerRounds — бросок длительности зоны", () => {
  it("число отдаётся без броска", async () => {
    const roll = vi.fn();
    expect(await resolveLingerRounds("3", roll)).toBe(3);
    expect(roll).not.toHaveBeenCalled();
  });

  it("кубик бросается один раз, результат — число раундов", async () => {
    const roll = vi.fn().mockResolvedValue(4);
    expect(await resolveLingerRounds("1d5", roll)).toBe(4);
    expect(roll).toHaveBeenCalledTimes(1);
    expect(roll).toHaveBeenCalledWith("1d5");
  });

  it("пусто, ноль, мусор и бросок меньше 1 — зоны нет (0)", async () => {
    const roll = vi.fn().mockResolvedValue(0);
    expect(await resolveLingerRounds("", roll)).toBe(0);
    expect(await resolveLingerRounds(undefined, roll)).toBe(0);
    expect(await resolveLingerRounds("0", roll)).toBe(0);
    expect(await resolveLingerRounds("1d5", roll)).toBe(0);
  });
});

describe("данные Даров Одержимого: Linger (1d5), не среднее 3", () => {
  const dir = path.resolve("packs-src/weapons/Интегральные_атаки");
  const load = prefix => {
    const f = fs.readdirSync(dir).find(n => n.startsWith(prefix));
    return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  };

  for (const prefix of ["Daemonic_Breath___", "Daemonic_Artillery___"]) {
    it(`${prefix}: linger с рейтингом 1d5 и без заметки про «среднее»`, () => {
      const j = load(prefix);
      const linger = j.system.weaponProps.find(p => p.key === "linger");
      expect(linger.rating).toBe("1d5");
      expect(j.system.notes || "").not.toMatch(/среднее значение/i);
    });
  }
});

describe("лист оружия: Linger принимает формулу", () => {
  it("у свойства Linger рейтинг — текстовое поле (ratingDice), иначе число в input затёрло бы «1d5» при сохранении", async () => {
    const { WEAPON_PROPERTIES } = await import("../../module/constants/weapon-properties.mjs");
    expect(WEAPON_PROPERTIES.linger.ratingDice).toBe(true);
  });
});
