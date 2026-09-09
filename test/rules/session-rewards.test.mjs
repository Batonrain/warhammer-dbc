// test/rules/session-rewards.test.mjs
//
// Экран итогов Сессии (wdbc-ce8e): опыт по книжной таблице, персонально, плюс
// необязательные Порча и Бесчестие.
//
// Проверяется чистая часть — сложение и разбор ввода. Диалог и запись в актора
// сюда не входят: их проверяют живьём, а арифметику должно быть можно
// проверить без запущенной игры.

import { describe, it, expect } from "vitest";
import { partyXp, actorXp, parseRewardAmount, buildRewardRows,
  infamyRoom, infamyGain, permanentInfamy, INFAMY_PATH, INFAMY_CAP }
  from "../../module/rules/session-rewards.mjs";
import { XP_CATEGORIES, PARTY_KEYS, EACH_KEYS }
  from "../../module/constants/session-rewards.mjs";

describe("книжная таблица разобрана", () => {
  it("категории есть, и они разделены на партийные и личные", () => {
    expect(XP_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(PARTY_KEYS).toContain("hardship");
    expect(EACH_KEYS).toContain("roleplay");
    // Каждая категория — либо общая, либо личная, третьего нет.
    expect(PARTY_KEYS.length + EACH_KEYS.length).toBe(XP_CATEGORIES.length);
  });

  it("у «Преодоления Трудностей» все пять книжных ступеней", () => {
    const hardship = XP_CATEGORIES.find(c => c.key === "hardship");
    expect(hardship.steps.map(s => s.value)).toEqual([0, 100, 250, 500, 750, 1000]);
  });

  it("у каждой категории есть пояснение книги", () => {
    for (const c of XP_CATEGORIES) expect(c.hint, c.key).toBeTruthy();
  });
});

describe("опыт складывается", () => {
  it("партийная часть — сумма общих категорий", () => {
    expect(partyXp({ hardship: 500, unknown: 150, finale: 0 })).toBe(650);
  });

  it("личные категории идут только своему персонажу", () => {
    const party = { hardship: 500 };
    expect(actorXp(party, { roleplay: 50 })).toBe(550);
    expect(actorXp(party, {})).toBe(500);
  });

  it("вписанное руками число заменяет расчёт целиком", () => {
    expect(actorXp({ hardship: 500 }, { roleplay: 50 }, 999)).toBe(999);
  });

  it("пустая строка в поле «руками» расчёт не отменяет", () => {
    // Иначе стоило бы очистить поле — и персонаж молча получил бы ноль.
    expect(actorXp({ hardship: 500 }, {}, "")).toBe(500);
  });

  it("минус в категории не вычитает из общей суммы", () => {
    expect(partyXp({ hardship: 500, unknown: -1000 })).toBe(500);
  });
});

describe("Порча и Бесчестие: число или бросок", () => {
  it("число — плоское начисление", () => {
    expect(parseRewardAmount("3")).toEqual({ kind: "flat", value: 3 });
    expect(parseRewardAmount(" -2 ")).toEqual({ kind: "flat", value: -2 });
  });

  it("формула — бросок", () => {
    expect(parseRewardAmount("1d5")).toEqual({ kind: "roll", formula: "1d5" });
    expect(parseRewardAmount("1d10+2")).toEqual({ kind: "roll", formula: "1d10+2" });
  });

  it("русская «д» и «к» принимаются как d", () => {
    // За столом их набирают, не переключая раскладку.
    expect(parseRewardAmount("1д5")).toEqual({ kind: "roll", formula: "1d5" });
    expect(parseRewardAmount("1к10")).toEqual({ kind: "roll", formula: "1d10" });
  });

  it("пустое поле — не начислять, и это не ноль", () => {
    expect(parseRewardAmount("")).toBeNull();
    expect(parseRewardAmount("   ")).toBeNull();
    expect(parseRewardAmount(undefined)).toBeNull();
    // А осознанный ноль — начисление на ноль, оно попадёт в журнал.
    expect(parseRewardAmount("0")).toEqual({ kind: "flat", value: 0 });
  });

  it("опечатка не превращается молча в ноль", () => {
    expect(parseRewardAmount("много")).toBeNull();
    expect(parseRewardAmount("1д")).toBeNull();
  });
});

describe("Бесчестие наградой — характеристика, а не пул очков", () => {
  const withInf = (total, base = total) =>
    ({ system: { characteristics: { inf: { total, base } } } });

  it("пишется в базу характеристики, а не в пул Очков Бесчестия", () => {
    // Пул (system.fate.value / system.dp.ip) конец сессии всё равно восполняет
    // до максимума — награда туда не пережила бы до следующей игры.
    expect(INFAMY_PATH).toBe("system.characteristics.inf.base");
  });

  it("до потолка остаётся столько, сколько не хватает ИТОГУ", () => {
    expect(infamyRoom(withInf(40))).toBe(60);
    // Считать по базе было бы ошибкой: сверх неё есть Продвижение и надбавки.
    expect(infamyRoom(withInf(95, 30))).toBe(5);
  });

  it("прибавка обрезается потолком, а не проходит целиком", () => {
    expect(infamyGain(withInf(98), 5)).toBe(2);
    expect(infamyGain(withInf(100), 5)).toBe(0);
    expect(infamyGain(withInf(40), 5)).toBe(5);
  });

  it("вычитание потолком не обрезается", () => {
    // Потолок сторожит только верх; ноль снизу ставит уже сама запись.
    expect(infamyGain(withInf(100), -10)).toBe(-10);
  });

  it("у актора без характеристик прибавка упирается в полный потолок", () => {
    expect(infamyRoom({})).toBe(INFAMY_CAP);
    expect(infamyGain({}, 5)).toBe(5);
  });
});

describe("потолок Бесчестия считается от постоянной части (wdbc-xlh1)", () => {
  /** Итог характеристики с разложением на постоянное и временное. */
  const inf = (fields) => ({ system: { characteristics: { inf: fields } } });

  it("наркотик не съедает запас до потолка", () => {
    // Постоянное Бесчестие 90, стимулятор даёт +10 → total 100. Считать
    // потолок от итога значило бы «уже на потолке» и отказ в награде.
    const doped = inf({ total: 100, drugMod: 10 });
    expect(permanentInfamy(doped)).toBe(90);
    expect(infamyRoom(doped)).toBe(10);
    expect(infamyGain(doped, 5)).toBe(5);
  });

  it("ручной Мод. к Итогу не раздвигает потолок", () => {
    // Влияние срезано на 20 вручную: итог 80, но постоянного всё те же 100.
    const hurt = inf({ total: 80, charDamage: -20 });
    expect(permanentInfamy(hurt)).toBe(100);
    expect(infamyGain(hurt, 5)).toBe(0);
  });

  it("дебафф Голода/Жажды тоже не раздвигает потолок", () => {
    // vitalMod вычитается из итога, значит обратно прибавляется здесь.
    const hungry = inf({ total: 95, vitalMod: 5 });
    expect(permanentInfamy(hungry)).toBe(100);
    expect(infamyGain(hungry, 3)).toBe(0);
  });

  it("без временных модификаторов постоянное равно итогу", () => {
    expect(permanentInfamy(inf({ total: 40 }))).toBe(40);
    expect(infamyRoom(inf({ total: 40 }))).toBe(60);
  });
});

describe("итоговые строки на персонажа", () => {
  const actors = [{ id: "a1", name: "Первый" }, { id: "a2", name: "Второй" }];

  it("общая часть у всех, личная — у своего", () => {
    const rows = buildRewardRows(actors, {
      party: { hardship: 500 },
      personal: { a1: { roleplay: 50 }, a2: { creative: 100 } }
    });
    expect(rows.map(r => r.xp)).toEqual([550, 600]);
  });

  it("Порча броском и Бесчестие числом уживаются в одной строке", () => {
    const [row] = buildRewardRows([actors[0]], {
      party: { hardship: 100 },
      corruption: { a1: "1d5" },
      infamy: { a1: "1" }
    });
    expect(row.corruption).toEqual({ kind: "roll", formula: "1d5" });
    expect(row.infamy).toEqual({ kind: "flat", value: 1 });
  });

  it("у кого поля пустые — тому ничего, кроме опыта", () => {
    const [row] = buildRewardRows([actors[0]], { party: { hardship: 100 } });
    expect(row.corruption).toBeNull();
    expect(row.infamy).toBeNull();
    expect(row.xp).toBe(100);
  });
});
