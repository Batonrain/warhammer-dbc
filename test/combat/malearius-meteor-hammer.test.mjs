// test/combat/malearius-meteor-hammer.test.mjs
//
// Элитный архетип «Малеарий» и Метеоритный Молот (wdbc-h1bx).
//
// Талант требует быть вооружённым метеоритным молотом. Код спрашивал у надетого
// оружия имя «Meteor Hammer» — и не находил его НИКОГДА, хотя оружие в
// компендиуме есть. Причина: документ называется «Метеоритный Молот», без
// английской половины, а в этой папке так названы все четырнадцать соседей —
// у оружия здесь принято русское имя, в отличие от Черт и Талантов.
//
// Чинить переименованием пришлось бы против местного соглашения, а чинить
// подстановкой русского имени в код — оставить ту же зависимость от названия,
// только на другом языке. Поэтому связь переведена на ключ Возможности, как и
// остальные тридцать восемь (wdbc-iadw): оружие выдаёт ключ, пока НАДЕТО
// (isItemActive у weapon — это system.equipped), и «вооружён метеоритным
// молотом» становится вопросом к актору, а не к названию предмета.
//
// Побочно чинится вторая, незамеченная половина бага: проверка по имени
// «Meteor Hammer» не признала бы и СИЛОВОЙ Метеоритный Молот, хотя книга
// говорит про метеоритный молот вообще, а требование Таланта — Exotic Weapon
// Training (Meteor Hammer) — покрывает оба.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { recoilItemMultiplier } from "../../module/combat/recoil-item-bonuses.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "packs-src/weapons/Имперское/Рукопашное/Экзотическое__тех__");

const weaponDoc = (file) => JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));

const BASE = "Метеоритный_Молот_Ap5YcNQmlSr6B5bI.json";
const POWER = "Силовой_Метеоритный_Молот_zoamY59yr3OSlraV.json";

/** Актор с этим оружием; equipped решает, действует ли запись Конструктора. */
function wielder(doc, { equipped = true } = {}) {
  return {
    type: "character",
    system: { characteristics: {}, absorption: {} },
    items: [{ id: "w1", type: "weapon", name: doc.name,
              system: { ...doc.system, equipped }, flags: doc.flags }]
  };
}

describe("Метеоритный Молот выдаёт ключ, пока надет", () => {
  it("ключ заведён в реестре и у него есть читатель", () => {
    const c = CAPABILITIES["weapon.meteorHammer"];
    expect(c, "ключа нет в реестре").toBeTruthy();
    expect(String(c.reader ?? "").trim()).not.toBe("");
  });

  it("обычный молот, надетый — ключ есть", () => {
    expect(hasRuleFlag(wielder(weaponDoc(BASE)), "weapon.meteorHammer")).toBe(true);
  });

  it("СИЛОВОЙ молот тоже — книга говорит про метеоритный молот вообще", () => {
    // Прежняя проверка по имени «Meteor Hammer» силовой вариант не признала бы
    // даже с исправленным названием: это отдельный документ.
    expect(hasRuleFlag(wielder(weaponDoc(POWER)), "weapon.meteorHammer")).toBe(true);
  });

  it("молот в рюкзаке, не надетый — ключа нет", () => {
    // Книга требует быть ВООРУЖЁННЫМ им, а не владеть.
    expect(hasRuleFlag(wielder(weaponDoc(BASE), { equipped: false }), "weapon.meteorHammer")).toBe(false);
  });

  it("другое оружие ключа не даёт", () => {
    const other = { type: "character", system: { characteristics: {}, absorption: {} },
                    items: [{ id: "w1", type: "weapon", name: "Цепной Меч",
                              system: { equipped: true }, flags: {} }] };
    expect(hasRuleFlag(other, "weapon.meteorHammer")).toBe(false);
  });
});

describe("числа обоих молотов совпадают с книгой", () => {
  // Сторож против тихой правки: числа выписаны из таблицы рукопашного оружия
  // Основной книги (DoomBC_Core, стр. 55 PDF, глава III. Продвижение).
  it("Метеоритный Молот", () => {
    const s = weaponDoc(BASE).system;
    expect(s.damage).toBe("2d10+2");
    expect(s.damageType).toBe("impact");
    expect(s.penetration).toBe(0);
    expect(s.availability).toBe(1);
    expect(s.weight).toBe(4);
    expect(s.balance).toBe(-2);
    expect(s.range).toBe(4);
    expect(s.weaponProps).toEqual([{ key: "concussive", rating: 4 }, { key: "imprecise" }, { key: "mighty" }]);
  });

  it("Силовой Метеоритный Молот — тот же профиль плюс Силовое Поле", () => {
    const s = weaponDoc(POWER).system;
    expect(s.damage).toBe("2d10+7");
    expect(s.damageType).toBe("energy");
    expect(s.penetration).toBe(5);
    expect(s.availability).toBe(2);
    expect(s.weaponProps.map(p => p.key)).toContain("powerField");
  });
});

describe("множитель Отскока у Малеария считается через ключ, а не имя", () => {
  // Проверка идёт через ЭКСПОРТ (recoilItemMultiplier), а не через флаг: иначе
  // тест зелен даже когда сам Талант по-прежнему смотрит на название оружия.
  const talent = () => ({
    id: "t1", type: "talent", name: "Malearius / Малеарий",
    flags: { "warhammer-dbc": { mechanics: [{
      id: "g1", operator: "AND",
      entries: [{ id: "e1", kind: "capability", capabilityKey: "ability.malearius",
                  when: { negate: false, conditions: [] } }]
    }] } }
  });

  const weapon = (doc, equipped = true) => ({
    id: "w1", type: "weapon", name: doc.name,
    system: { ...doc.system, equipped }, flags: doc.flags
  });

  /** Броня не прочнее AP4 нигде — второе условие Таланта. */
  const gladiator = (...items) => ({
    type: "character",
    system: { characteristics: {}, absorption: { toughnessBonus: 0, head: 2, body: 4, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 } },
    items
  });

  it("обычный молот — Отскок удваивается", () => {
    expect(recoilItemMultiplier(gladiator(talent(), weapon(weaponDoc(BASE))))).toBe(2);
  });

  it("СИЛОВОЙ молот — тоже удваивается", () => {
    // Ровно то, чего проверка по имени «Meteor Hammer» не дала бы никогда.
    expect(recoilItemMultiplier(gladiator(talent(), weapon(weaponDoc(POWER))))).toBe(2);
  });

  it("молот не надет — не удваивается", () => {
    expect(recoilItemMultiplier(gladiator(talent(), weapon(weaponDoc(BASE), false)))).toBe(1);
  });

  it("нет Таланта — не удваивается даже с молотом", () => {
    expect(recoilItemMultiplier(gladiator(weapon(weaponDoc(BASE))))).toBe(1);
  });

  it("броня прочнее AP4 хоть на одной локации — не удваивается", () => {
    const heavy = gladiator(talent(), weapon(weaponDoc(BASE)));
    heavy.system.absorption.leftLeg = 5;
    expect(recoilItemMultiplier(heavy)).toBe(1);
  });
});
