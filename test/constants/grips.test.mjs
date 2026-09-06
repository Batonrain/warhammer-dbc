import { describe, it, expect } from "vitest";
import { parseGrips } from "../../module/constants/combat.mjs";
import { weaponHandsRequired } from "../../module/rules/hands.mjs";

// Разбор строки Хватов из профиля оружия. Строка приходит прямо из карточки
// («2р (1р, Бл)», «1р [Об]»), поэтому разборщик обязан переживать обе формы
// скобок и порядок записи парного хвата — в паке встречаются оба.
describe("parseGrips — токены Хвата из строки профиля", () => {
  it("круглые и квадратные скобки читаются одинаково", () => {
    expect(parseGrips("1р (2р, Об)")).toEqual(["1р", "2р", "Об"]);
    expect(parseGrips("1р [2р, Об]")).toEqual(["1р", "2р", "Об"]);
  });

  it("пустая строка — пустой список, а не «1р» по умолчанию", () => {
    expect(parseGrips("")).toEqual([]);
    expect(parseGrips(null)).toEqual([]);
  });

  it("«Хвост» в карточке читается как токен Хвоста", () => {
    expect(parseGrips("Хвост")).toEqual(["Хв"]);
  });

  // wdbc-4y20: парный хват пишут в обе стороны — GRIPS знает только «П+Л»,
  // но карточки Молниевых Когтей пишут «Л+П». Без синонима строка распадалась
  // на два отдельных токена, и в окне атаки вместо одной пилюли «П+Л»
  // рисовались две — «П» и «Л», будто у парных когтей есть выбор руки.
  it("«Л+П» — тот же парный Хват, что и «П+Л», одним токеном", () => {
    expect(parseGrips("П+Л")).toEqual(["П+Л"]);
    expect(parseGrips("Л+П")).toEqual(["П+Л"]);
  });

  it("«Л+П» внутри профиля не рассыпается на «Л» и «П»", () => {
    expect(parseGrips("Л+П (1р)")).toEqual(["П+Л", "1р"]);
  });

  it("одиночные «П» и «Л» остаются самостоятельными Хватами", () => {
    expect(parseGrips("П")).toEqual(["П"]);
    expect(parseGrips("Л")).toEqual(["Л"]);
  });
});

describe("weaponHandsRequired — парный Хват рук не занимает (обе записи)", () => {
  const claws = grips => ({ type: "weapon", system: { weaponClass: "melee", grips } });

  it("«Л+П» даёт 0 занятых рук, как и «П+Л»", () => {
    expect(weaponHandsRequired(claws("П+Л"))).toBe(0);
    expect(weaponHandsRequired(claws("Л+П"))).toBe(0);
  });
});
