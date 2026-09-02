// test/constants/implant-mechanics.test.mjs
//
// module/constants/implant-mechanics.mjs — роспись механик имплантов по
// regex имени: ironFocus/compensator, «Железо» по Качеству, и миграция
// числового (un/val/ap) в старую форму system.effects (implantTableEffects).

import { describe, it, expect } from "vitest";
import {
  QUALITY_ORDER, ironModForQuality, leastQuality,
  IMPLANT_MECH, implantMech, implantTableEffects
} from "../../module/constants/implant-mechanics.mjs";

describe("ironModForQuality", () => {
  it("отдаёт табличный модификатор по Качеству", () => {
    expect(ironModForQuality("poor")).toBe(-10);
    expect(ironModForQuality("common")).toBe(0);
    expect(ironModForQuality("good")).toBe(5);
    expect(ironModForQuality("best")).toBe(10);
  });

  it("неизвестное Качество — 0", () => {
    expect(ironModForQuality("legendary")).toBe(0);
    expect(ironModForQuality(undefined)).toBe(0);
  });
});

describe("leastQuality", () => {
  it("пустой список — null", () => {
    expect(leastQuality([])).toBeNull();
    expect(leastQuality()).toBeNull();
  });

  it("одиночное значение возвращается как есть", () => {
    expect(leastQuality(["good"])).toBe("good");
  });

  it("выбирает наихудшее (наименьшее по QUALITY_ORDER) из нескольких", () => {
    expect(leastQuality(["good", "poor", "best"])).toBe("poor");
    expect(leastQuality(["best", "common"])).toBe("common");
  });

  it("QUALITY_ORDER монотонно возрастает poor < common < good < best", () => {
    expect(QUALITY_ORDER.poor).toBeLessThan(QUALITY_ORDER.common);
    expect(QUALITY_ORDER.common).toBeLessThan(QUALITY_ORDER.good);
    expect(QUALITY_ORDER.good).toBeLessThan(QUALITY_ORDER.best);
  });
});

describe("implantMech", () => {
  it("находит запись по имени регистронезависимо, включая двуязычный формат пака", () => {
    // Реальные предметы в паке всегда двуязычные («Bionic Arm / Бионическая
    // Рука», см. packs-src/implants/Бионика/) — английская половина имени
    // матчится всегда, отдельно проверять русскую половину без английской
    // не нужно: \w в regex этого файла не видит кириллицу (без флага u),
    // и чисто русское имя без английского эта запись не поймала бы (см.
    // doombc-russian-text-regex-pitfalls) — но такого имени в паке и нет.
    const byEnglish = implantMech("Bionic Arm");
    expect(byEnglish).toBeTruthy();
    expect(implantMech("Bionic Arm / Бионическая Рука (Good.Q)")).toBe(byEnglish);
    expect(implantMech("BIONIC ARM")).toBe(byEnglish);
  });

  it("незнакомое имя — null", () => {
    expect(implantMech("Совершенно неизвестный предмет")).toBeNull();
  });

  it("пустое имя по умолчанию — null (ни один regex не совпадёт с пустой строкой)", () => {
    expect(implantMech()).toBeNull();
  });

  it("первое совпадение в списке побеждает — regex'ы IMPLANT_MECH не должны конфликтовать с более ранними записями", () => {
    for (const name of ["Bionic Heart", "Cortical Implant", "Potentia Coil"]) {
      const direct = IMPLANT_MECH.find(m => m.re.test(name));
      expect(implantMech(name)).toBe(direct);
    }
  });
});

describe("implantTableEffects", () => {
  it("незнакомый имплант — null", () => {
    expect(implantTableEffects("Совершенно неизвестный предмет")).toBeNull();
  });

  it("имплант без числового (un/val/ap) — null, даже если запись механики есть", () => {
    // Bionic Hearing несёт только q:{...}, без un/val/ap.
    expect(implantMech("Bionic Hearing")).toBeTruthy();
    expect(implantTableEffects("Bionic Hearing")).toBeNull();
  });

  it("un{stat} превращается в charBonuses [{stat,value}]", () => {
    // Cortical Implant: un:{int:2}
    expect(implantTableEffects("Cortical Implant")).toEqual({ charBonuses: [{ stat: "int", value: 2 }] });
  });

  it("val{stat} превращается в charValueBonuses [{stat,value}]", () => {
    // Bionic Heart: val:{t:1}
    expect(implantTableEffects("Bionic Heart")).toEqual({ charValueBonuses: [{ stat: "t", value: 1 }] });
  });

  it("ap{location} раскладывается по apHead/apBody/apArms/apLegs, нулевые локации пропускаются", () => {
    // Cranial Armour: ap:{head:1} — только голова.
    expect(implantTableEffects("Cranial Armour")).toEqual({ apHead: 1 });
    // Subdermal Armour: ap:{body:2, arms:2, legs:2} — без головы.
    expect(implantTableEffects("Subdermal Armour")).toEqual({ apBody: 2, apArms: 2, apLegs: 2 });
  });
});
