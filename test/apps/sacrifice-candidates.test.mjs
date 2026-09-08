// test/apps/sacrifice-candidates.test.mjs
//
// «Пожертвовать за 3 модификации» (стр. 24) берёт с листа оружие, броню и
// кибернетику. Дважды выяснялось, что предметом вещь является, а снаряжением —
// нет, и оба раза это било по игроку:
//
//  • интегральные атаки (Кулак, Пинок) удалить нельзя вовсе — игрок получал
//    три модификации даром, а «пожертвованная» атака оставалась (wdbc-6ry7);
//  • импланты Астартес — девятнадцать органов геносемени (Оккулоб, Ухо
//    Лимана, Прогеноиды, Чёрный Панцирь…). Их не покупают и не снимают, это
//    части тела; предлагать сдать Прогеноидные Железы ради прицела к болтеру
//    бессмыслица, и список из-за них раздувался на два десятка строк
//    (жалоба владельца 07.09.2026).
//
// Остальная кибернетика и биоимпланты Друкхари остаются кандидатами: они как
// раз покупаются за Редкость, и жертвовать ими законно.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { sacrificeCandidates } from "../../module/apps/character-wizard.mjs";

const item = (type, { name = "Предмет", category = "", integral = false } = {}) => ({
  name, type,
  system: { category },
  getFlag: (ns, key) => (key === "integralAttack" ? integral : undefined)
});

describe("что можно пожертвовать за модификации", () => {
  it("берёт оружие, броню и кибернетику", () => {
    const list = [
      item("weapon", { name: "Болтер" }),
      item("armor", { name: "Силовая броня" }),
      item("cybernetic", { name: "Бионическая рука" })
    ];
    expect(sacrificeCandidates(list).map(i => i.name))
      .toEqual(["Болтер", "Силовая броня", "Бионическая рука"]);
  });

  it("не берёт органы геносемени — импланты категории astartes", () => {
    const list = [
      item("implant", { name: "19. Чёрный Панцирь", category: "astartes" }),
      item("implant", { name: "18. Прогеноиды", category: "astartes" }),
      item("weapon", { name: "Болт-пистолет" })
    ];
    expect(sacrificeCandidates(list).map(i => i.name)).toEqual(["Болт-пистолет"]);
  });

  it("но берёт прочие импланты — их покупают за Редкость", () => {
    const list = [
      item("implant", { name: "Клюв-Зажим", category: "bioimplant" }),
      item("implant", { name: "Крукс Механикус", category: "skitarii" }),
      item("implant", { name: "Чёрный Панцирь", category: "astartes" })
    ];
    expect(sacrificeCandidates(list).map(i => i.name)).toEqual(["Клюв-Зажим", "Крукс Механикус"]);
  });

  it("не берёт врождённые атаки: удалить их нельзя, а модификации дались бы даром", () => {
    const list = [
      item("weapon", { name: "Кулак", integral: true }),
      item("weapon", { name: "Цепной меч" })
    ];
    expect(sacrificeCandidates(list).map(i => i.name)).toEqual(["Цепной меч"]);
  });

  it("не берёт то, что снаряжением не является вовсе", () => {
    const list = [item("talent", { name: "Меткий стрелок" }), item("trait", { name: "Геносемя" })];
    expect(sacrificeCandidates(list)).toEqual([]);
  });

  it("пустой лист и мусор не роняют отбор", () => {
    expect(sacrificeCandidates([])).toEqual([]);
    expect(sacrificeCandidates(null)).toEqual([]);
    expect(sacrificeCandidates(undefined)).toEqual([]);
  });
});
