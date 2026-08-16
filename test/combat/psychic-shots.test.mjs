// test/combat/psychic-shots.test.mjs
//
// Число попаданий Психострельбы (стр. 290). Считается по ПОДТИПУ силы, а не по
// её типу: в книге такие силы помечены «Атака · Психический Шторм · Стрельба»,
// то есть powerType у них «Атака», и привязка счёта к powerType оставляла и
// Обстрел, и Шторм с одним-единственным попаданием.

import { describe, it, expect } from "vitest";
import { psychicHitCount } from "../../module/combat/attack-outcome.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

describe("psychicHitCount", () => {
  it("Обстрел бьёт по разу за нечётный Успех", () => {
    expect(psychicHitCount("barrage", 1).count).toBe(1);
    expect(psychicHitCount("barrage", 4).count).toBe(2);
    expect(psychicHitCount("barrage", 5).count).toBe(3);
  });

  it("Шторм бьёт по разу за каждый Успех", () => {
    expect(psychicHitCount("storm", 1).count).toBe(1);
    expect(psychicHitCount("storm", 4).count).toBe(4);
  });

  it("Снаряд, Взрыв и Дыхание — одно попадание", () => {
    for (const sub of ["projectile", "blast", "breath", "", undefined])
      expect(psychicHitCount(sub, 5).count).toBe(1);
  });

  it("подпись есть только у очередей — по ней рисуется строка в карточке", () => {
    expect(psychicHitCount("storm", 2).label).toBe("Психический Шторм");
    expect(psychicHitCount("barrage", 2).label).toBe("Психический Обстрел");
    expect(psychicHitCount("projectile", 2).label).toBe("");
  });

  it("меньше одного попадания не бывает даже при нулевых Успехах", () => {
    expect(psychicHitCount("storm", 0).count).toBe(1);
    expect(psychicHitCount("barrage", 0).count).toBe(1);
  });
});

// Подтип живёт в данных, и только там: разойдись он с тегом из книги — сила
// снова стреляла бы одним попаданием, а тест бы этого не заметил.
describe("психосилы packs-src", () => {
  const TAGS = [
    [/Психический\s+Снаряд/i,  "projectile"],
    [/Психический\s+Обстрел/i, "barrage"],
    [/Психический\s+Шторм/i,   "storm"],
    [/Психический\s+Взрыв/i,   "blast"],
    [/Психическое\s+Дыхание/i, "breath"]
  ];
  const docs = packDocuments("psychic-powers", "psychicPower");

  it("у каждой силы с тегом Психострельбы проставлен подтип", () => {
    const wrong = [];
    for (const { file, doc } of docs) {
      const head = String(doc.system?.effect || "").split(".")[0];
      const tag  = TAGS.find(([re]) => re.test(head))?.[1];
      if (!tag) continue;
      if (doc.system.shootSubtype !== tag)
        wrong.push(`${file}: ожидался «${tag}», стоит «${doc.system.shootSubtype}»`);
    }
    expect(wrong).toEqual([]);
  });

  it("Обстрелы и Штормы в паке вообще есть", () => {
    const subtypes = docs.map(d => d.doc.system?.shootSubtype);
    expect(subtypes.filter(s => s === "barrage").length).toBeGreaterThan(0);
    expect(subtypes.filter(s => s === "storm").length).toBeGreaterThan(0);
  });
});
