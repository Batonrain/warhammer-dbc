// test/rules/elite-requirements.test.mjs
//
// Требования и цена Элитного архетипа (корбук стр. 114-164).
//
// Требования двух родов, и разница не косметическая: основные — «кто ты есть»
// (раса, субраса, Черта, Покровительство), и не выполнены они — архетипа нет в
// списке вовсе; прочие — «чего ты добился», их провал только красит красным,
// потому что ГМ вправе разрешить исключение.
//
// Цена: каждый следующий Элитный архетип вдвое дороже предыдущего.

import { describe, it, expect } from "vitest";
import {
  eliteCost, eliteCostNote, checkEliteRequirements, describeEliteReq,
  blankEliteReq, PATRON_ANY, PATRON_OPTIONS
} from "../../module/rules/elite-requirements.mjs";

/** Персонаж-снимок: правило не знает про актора и проверяется без Foundry. */
const who = (over = {}) => ({
  race: "drukhari", subrace: "", patron: "",
  traits: ["Безбожник"], talents: [{ name: "Cleave", specialization: "" }],
  skills: { acrobatics: "veteran" }, groupSkills: {},
  corruption: 10, infamy: 20, chars: { ws: 50, a: 60 }, spentXP: 2000,
  ...over
});

describe("цена Элитного архетипа", () => {
  it("первый стоит как написано, каждый следующий вдвое дороже", () => {
    expect(eliteCost(2000, 0)).toBe(2000);
    expect(eliteCost(2000, 1)).toBe(4000);
    expect(eliteCost(2000, 2)).toBe(8000);
    expect(eliteCost(2000, 3)).toBe(16000);
  });

  it("подпись множителя объясняет, почему дороже", () => {
    expect(eliteCostNote(0)).toBe("");
    expect(eliteCostNote(1)).toMatch(/×2/);
    expect(eliteCostNote(2)).toMatch(/×4/);
  });

  it("мусор в цене не ломает счёт", () => {
    expect(eliteCost(undefined, 2)).toBe(0);
    expect(eliteCost(1000, -5)).toBe(1000);
  });
});

describe("основные требования — «кто ты есть»", () => {
  it("раса не та — архетипа нет в списке", () => {
    const req = { ...blankEliteReq(), primary: [{ kind: "race", key: "astartes", name: "Космодесантник" }] };
    expect(checkEliteRequirements(req, who()).available).toBe(false);
    expect(checkEliteRequirements(req, who({ race: "astartes" })).available).toBe(true);
  });

  it("субраса и Черта проверяются так же", () => {
    const req = {
      ...blankEliteReq(),
      primary: [{ kind: "subrace", key: "mandrake" }, { kind: "trait", name: "Безбожник" }]
    };
    expect(checkEliteRequirements(req, who()).available).toBe(false);
    expect(checkEliteRequirements(req, who({ subrace: "mandrake" })).available).toBe(true);
  });

  // «Любое» значит «хоть какое-то»: у безбожника Покровительства нет вовсе.
  it("Покровительство: конкретное и любое", () => {
    const any = { ...blankEliteReq(), primary: [{ kind: "patron", key: PATRON_ANY }] };
    expect(checkEliteRequirements(any, who()).available).toBe(false);
    expect(checkEliteRequirements(any, who({ patron: "khorne" })).available).toBe(true);

    const khorne = { ...blankEliteReq(), primary: [{ kind: "patron", key: "khorne" }] };
    expect(checkEliteRequirements(khorne, who({ patron: "nurgle" })).available).toBe(false);
    expect(checkEliteRequirements(khorne, who({ patron: "khorne" })).available).toBe(true);
  });

  it("в списке Покровительств есть «любое» и все четыре бога с Неделимым", () => {
    expect(PATRON_OPTIONS.map(p => p.key))
      .toEqual([PATRON_ANY, "undivided", "khorne", "nurgle", "tzeentch", "slaanesh"]);
  });
});

describe("прочие требования — «чего ты добился»", () => {
  it("не выполнены — архетип доступен, но помечен", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "corruption", value: 30 }] };
    const res = checkEliteRequirements(req, who());

    expect(res.available).toBe(true);
    expect(res.warn).toBe(true);
    expect(res.secondaryUnmet).toEqual(["Порча 30"]);
  });

  it("Навык считается по рангу, а не по наличию", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "skill", skillKey: "acrobatics", rank: "expert", label: "Акробатика" }] };
    expect(checkEliteRequirements(req, who()).warn).toBe(true);
    expect(checkEliteRequirements(req, who({ skills: { acrobatics: "expert" } })).warn).toBe(false);
  });

  it("групповой Навык — по специализации", () => {
    const req = { ...blankEliteReq(), secondary: [
      { kind: "skill", scope: "group", skillKey: "forbiddenLore", specKey: "Демоны", rank: "knows" }
    ] };
    expect(checkEliteRequirements(req, who()).warn).toBe(true);
    expect(checkEliteRequirements(req, who({
      groupSkills: { forbiddenLore: [{ specialty: "Демоны", rank: "trained" }] }
    })).warn).toBe(false);
  });

  it("Характеристика, Бесчестие и потраченный опыт", () => {
    const req = { ...blankEliteReq(), secondary: [
      { kind: "characteristic", charKey: "ws", value: 50 },
      { kind: "infamy", value: 20 },
      { kind: "xp", value: 2000 }
    ] };
    expect(checkEliteRequirements(req, who()).warn).toBe(false);
    expect(checkEliteRequirements(req, who({ spentXP: 500 })).secondaryUnmet)
      .toEqual(["Потрачено опыта: 2000"]);
  });

  // Свободную строку машина не читает: она не «провалена», но и не выполнена —
  // её показывают ГМу отдельной пометкой.
  it("свободная строка уходит в ручную проверку, а не в провал", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "other", text: "Одобрение Архонта" }] };
    const res = checkEliteRequirements(req, who());

    expect(res.warn).toBe(false);
    expect(res.manual).toEqual(["Одобрение Архонта"]);
  });
});

// Талант — такой же вид записи, как прочие: блоки различаются строгостью, а не
// тем, что в них можно потребовать. Обычно он во вторичном, но «без этого
// Таланта ты не он» тоже бывает — тогда в обязательном.
describe("требуемые Таланты", () => {
  it("нет нужного — красным, но архетип доступен", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "talent", name: "Whirlwind of Death" }] };
    const res = checkEliteRequirements(req, who());

    expect(res.available).toBe(true);
    expect(res.secondaryUnmet).toHaveLength(1);
  });

  it("в обязательном блоке недостающий Талант убирает архетип из списка", () => {
    const req = { ...blankEliteReq(), primary: [{ kind: "talent", name: "Whirlwind of Death" }] };
    expect(checkEliteRequirements(req, who()).available).toBe(false);
  });

  it("специализация учитывается", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "talent", name: "Weapon Training", specialization: "Bolt" }] };
    expect(checkEliteRequirements(req, who({ talents: [{ name: "Weapon Training", specialization: "Las" }] })).warn).toBe(true);
    expect(checkEliteRequirements(req, who({ talents: [{ name: "Weapon Training", specialization: "Bolt" }] })).warn).toBe(false);
  });

  // «Hatred (любые 3)» — три ненависти к РАЗНЫМ целям. Один и тот же Талант,
  // записанный трижды с одной специализацией, требования не закрывает.
  it("счётчик считает разные специализации, а не повторы одной", () => {
    const req = { ...blankEliteReq(), secondary: [{ kind: "talent", name: "Hatred", count: 3 }] };
    const three = ["Имперская Гвардия", "Астартес", "Механикум"]
      .map(specialization => ({ name: "Hatred", specialization }));

    expect(checkEliteRequirements(req, who({ talents: three })).warn).toBe(false);
    expect(checkEliteRequirements(req, who({ talents: three.slice(0, 2) })).warn).toBe(true);
    expect(checkEliteRequirements(req, who({
      talents: [0, 1, 2].map(() => ({ name: "Hatred", specialization: "Астартес" }))
    })).warn).toBe(true);
  });

  it("подпись счётчика читается человеком", () => {
    expect(describeEliteReq({ kind: "talent", name: "Hatred", count: 3 })).toBe("Hatred — любые 3");
  });
});

describe("группа «одно из» (ИЛИ)", () => {
  const or = (...items) => ({ kind: "or", items });

  it("выполнена, если выполнена хоть одна вложенная", () => {
    const req = { ...blankEliteReq(), primary: [
      or({ kind: "race", key: "astartes" }, { kind: "race", key: "drukhari" })
    ] };
    expect(checkEliteRequirements(req, who({ race: "drukhari" })).available).toBe(true);
    expect(checkEliteRequirements(req, who({ race: "human" })).available).toBe(false);
  });

  it("пустая группа никого не запирает", () => {
    const req = { ...blankEliteReq(), primary: [or()] };
    expect(checkEliteRequirements(req, who()).available).toBe(true);
  });

  // Иначе ручное требование внутри группы молча превращалось бы в провал.
  it("ни одна не выполнена, но есть ручная — решает ГМ", () => {
    const req = { ...blankEliteReq(), secondary: [
      or({ kind: "corruption", value: 90 }, { kind: "other", text: "Слово Архонта" })
    ] };
    const res = checkEliteRequirements(req, who());

    expect(res.warn).toBe(false);
    expect(res.manual).toHaveLength(1);
  });

  it("подпись перечисляет варианты", () => {
    expect(describeEliteReq(or({ kind: "corruption", value: 30 }, { kind: "infamy", value: 40 })))
      .toBe("Одно из: Порча 30 / Бесчестие 40");
  });
});

// «Любые 3 Запретных знания» — три разные специализации группы, а не одна,
// прокачанная трижды.
describe("счётчик у групповых Навыков", () => {
  it("считает разные специализации группы", () => {
    const req = { ...blankEliteReq(), secondary: [
      { kind: "skill", scope: "group", skillKey: "forbiddenLore", rank: "knows", count: 3,
        label: "Запретные знания" }
    ] };
    const spec = list => ({ groupSkills: { forbiddenLore: list.map(s => ({ specKey: s, rank: "trained" })) } });

    expect(checkEliteRequirements(req, who(spec(["Демоны", "Ересь", "Варп"]))).warn).toBe(false);
    expect(checkEliteRequirements(req, who(spec(["Демоны", "Ересь"]))).warn).toBe(true);
  });
});

describe("подписи требований", () => {
  it("читаются человеком", () => {
    expect(describeEliteReq({ kind: "race", name: "Друкхари" })).toBe("Раса: Друкхари");
    expect(describeEliteReq({ kind: "patron", key: "khorne" })).toBe("Покровительство: Кхорн");
    expect(describeEliteReq({ kind: "characteristic", charKey: "ws", value: 50 })).toMatch(/50/);
    expect(describeEliteReq({ kind: "other", text: "Своё" })).toBe("Своё");
  });
});

describe("пустые требования", () => {
  it("архетип без требований доступен всем", () => {
    const res = checkEliteRequirements(blankEliteReq(), who());
    expect(res.available).toBe(true);
    expect(res.warn).toBe(false);
    expect(res.unmet).toEqual([]);
  });

  it("отсутствие требований вовсе не роняет проверку", () => {
    expect(checkEliteRequirements(null, who()).available).toBe(true);
    expect(checkEliteRequirements(undefined, {}).available).toBe(true);
  });
});
