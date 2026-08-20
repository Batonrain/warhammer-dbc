// test/rules/submutations.test.mjs
//
// Субмутации (корбук, стр. 440). Foundry здесь не нужен: таблица разбирается из
// текста мутации, а выбор строки — чистый расчёт.
//
// Главная проверка — разбор: таблица живёт в тексте книги, и если разбор
// разойдётся с текстом хоть на одной мутации, бросок молча выдаст не ту строку.
// Поэтому сверяемся не с придуманным примером, а со ВСЕМИ таблицами библиотеки
// и со всеми документами пака.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSubmutations, hasSubmutations, subShiftLimit, submutationByRoll,
         subShiftOptions, isSubBlocked, patronSubmutation, needsReroll }
  from "../../module/rules/submutations.mjs";
import { MUTATIONS, MUTATION_LIBRARY } from "../../module/constants/mutations.mjs";
import { opposedGod, areGodsHostile, CHAOS_PATRONS } from "../../module/constants/chaos-patron.mjs";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src", "mutations");

/** Все документы пака мутаций (без файлов папок). */
function packMutations() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name !== "_Folder.json") out.push(JSON.parse(fs.readFileSync(p, "utf8")));
    }
  };
  walk(ROOT);
  return out;
}

/** Таблица «Животного Гибрида» — d10, 10 строк, четыре отмечены цветами Богов. */
const HYBRID = MUTATION_LIBRARY.find(i => i.name === "Животный Гибрид").system.benefit;

describe("разбор таблицы субмутаций", () => {
  it("читает строки, названия и цвета Богов", () => {
    const t = parseSubmutations(HYBRID);
    expect(t.die).toBe(10);
    expect(t.rollable).toBe(true);
    expect(t.entries).toHaveLength(10);
    expect(t.entries[0]).toMatchObject({ label: "1", lo: 1, hi: 1, name: "Насекомое", god: "" });
    expect(t.entries[7]).toMatchObject({ label: "8", name: "Бык", god: "khorne" });
    // Пометка «[только для последователей: …]» уходит в поле god, а не в текст.
    expect(t.entries[7].text).not.toContain("только для последователей");
  });

  it("диапазон строки — «2-3», а не два отдельных числа", () => {
    const t = parseSubmutations(MUTATION_LIBRARY.find(i => i.name === "Странные Руки").system.benefit);
    expect(t.entries[1]).toMatchObject({ label: "2-3", lo: 2, hi: 3, name: "Мускулистые Руки" });
  });

  it("таблица без бросков: строки именованы Богами", () => {
    const t = parseSubmutations(MUTATION_LIBRARY.find(i => i.name === "Стальное Сердце").system.benefit);
    expect(t.rollable).toBe(false);
    expect(t.entries.map(e => e.god)).toEqual(["slaanesh", "nurgle", "khorne", "tzeentch"]);
  });

  it("мутация без блока субмутаций даёт пустую таблицу", () => {
    expect(hasSubmutations("Просто текст мутации без таблицы.")).toBe(false);
    expect(parseSubmutations("").entries).toEqual([]);
  });

  it("все таблицы библиотеки читаются обратно строка в строку", () => {
    for (const m of MUTATIONS) {
      if (!m.sub.length) continue;
      const benefit = MUTATION_LIBRARY.find(i => i.name === m.name).system.benefit;
      const got = parseSubmutations(benefit).entries;
      expect(got, m.name).toHaveLength(m.sub.length);
      for (let i = 0; i < m.sub.length; i++) {
        expect(got[i].name, `${m.name} / ${m.sub[i].roll}`).toBe(m.sub[i].name);
        expect(got[i].text, `${m.name} / ${m.sub[i].roll}`).toBe(m.sub[i].text);
        expect(got[i].god,  `${m.name} / ${m.sub[i].roll}`).toBe(m.sub[i].god ?? "");
      }
    }
  });

  it("в паке таблицы читаются у тех же 30 мутаций, и все строки именованы", () => {
    const withTable = packMutations().filter(d => hasSubmutations(d.system?.benefit || ""));
    expect(withTable).toHaveLength(MUTATIONS.filter(m => m.sub.length).length);
    for (const doc of withTable) {
      for (const e of parseSubmutations(doc.system.benefit).entries) {
        expect(e.name, doc.name).not.toBe("");
        // Строка либо бросается, либо принадлежит Богу — «ни то ни сё» значит,
        // что подпись не разобралась и строка потерялась бы при броске.
        expect(e.lo !== null || !!e.god, `${doc.name} / ${e.label}`).toBe(true);
      }
    }
  });
});

describe("сдвиг результата на ⅓Inf.b", () => {
  it("округляется вниз", () => {
    expect(subShiftLimit(0)).toBe(0);
    expect(subShiftLimit(2)).toBe(0);
    expect(subShiftLimit(3)).toBe(1);
    expect(subShiftLimit(5)).toBe(1);
    expect(subShiftLimit(9)).toBe(3);
  });

  it("мутация от Порчи за Провал сдвига не даёт", () => {
    expect(subShiftLimit(9, { fromFailure: true })).toBe(0);
  });

  it("участок таблицы — это все значения в пределах сдвига", () => {
    const { entries } = parseSubmutations(HYBRID);
    const opts = subShiftOptions(entries, 5, 1);
    expect(opts.map(o => o.total)).toEqual([4, 5, 6]);
    expect(opts.map(o => o.entry.name)).toEqual(["Кошка", "Волк", "Змея"]);
  });
});

describe("строка по броску", () => {
  const { entries } = parseSubmutations(HYBRID);

  it("берётся по диапазону", () => {
    expect(submutationByRoll(entries, 4).name).toBe("Кошка");
  });

  it("за краями таблицы берётся крайняя строка", () => {
    expect(submutationByRoll(entries, -3).name).toBe("Насекомое");
    expect(submutationByRoll(entries, 14).name).toBe("Осьминог");
  });

  it("у таблицы без бросков строки по значению не берутся", () => {
    const steel = parseSubmutations(MUTATION_LIBRARY.find(i => i.name === "Стальное Сердце").system.benefit);
    expect(submutationByRoll(steel.entries, 5)).toBeNull();
  });
});

describe("извечные соперники", () => {
  it("Боги враждебны парами и взаимно", () => {
    expect(opposedGod("khorne")).toBe("slaanesh");
    expect(opposedGod("slaanesh")).toBe("khorne");
    expect(opposedGod("tzeentch")).toBe("nurgle");
    expect(opposedGod("nurgle")).toBe("tzeentch");
    expect(areGodsHostile("khorne", "nurgle")).toBe(false);
  });

  it("Неделимый не враждебен никому, и пара есть у каждого из четырёх", () => {
    expect(opposedGod("undivided")).toBe("");
    expect(areGodsHostile("undivided", "khorne")).toBe(false);
    for (const p of CHAOS_PATRONS) {
      if (p.key === "undivided") continue;
      expect(areGodsHostile(p.key, opposedGod(p.key)), p.key).toBe(true);
    }
  });
});

describe("цвета Богов", () => {
  const { entries } = parseSubmutations(HYBRID);
  // Таблица с полным набором цветов: 6 Слаанеш, 7 Нургл, 8 Кхорн, 9 Тзинч.
  const full = parseSubmutations(
    MUTATION_LIBRARY.find(i => i.name === "Странная Неуязвимость").system.benefit).entries;

  it("закрыта строка ВРАЖДЕБНОГО Бога, а не любого чужого", () => {
    const bull = entries.find(e => e.name === "Бык");          // khorne
    // Слаанеш — извечный соперник Кхорна, Нургл — нет.
    expect(isSubBlocked(bull, "slaanesh")).toBe(true);
    expect(isSubBlocked(bull, "nurgle")).toBe(false);
    expect(isSubBlocked(bull, "khorne")).toBe(false);
    expect(isSubBlocked(entries[0], "slaanesh")).toBe(false);  // строка без цвета
  });

  it("вторая пара соперников — Тзинч и Нургл", () => {
    const snake = entries.find(e => e.name === "Змея");        // nurgle
    expect(isSubBlocked(snake, "tzeentch")).toBe(true);
    expect(isSubBlocked(snake, "khorne")).toBe(false);
  });

  it("Неделимым и беспокровительственным не закрыто ничего", () => {
    const bull = entries.find(e => e.name === "Бык");
    expect(isSubBlocked(bull, "undivided")).toBe(false);
    expect(isSubBlocked(bull, "")).toBe(false);
  });

  it("строку своего Бога можно взять не бросая", () => {
    expect(patronSubmutation(entries, "nurgle").name).toBe("Змея");
    expect(patronSubmutation(entries, "undivided")).toBeNull();
  });

  it("переброс нужен, когда закрыт весь доступный участок", () => {
    // Кхорнит выбросил 6 — «Щит Тщеславия» Слаанеш, без сдвига деваться некуда.
    expect(needsReroll(subShiftOptions(full, 6, 0, "khorne"))).toBe(true);
    // С ⅓Inf.b = 1 рядом открытая пятёрка («Текучая Плоть») — переброс не нужен.
    expect(needsReroll(subShiftOptions(full, 6, 1, "khorne"))).toBe(false);
    // Нурглиту та же шестёрка не закрыта вовсе: Слаанеш ему не соперник.
    expect(needsReroll(subShiftOptions(full, 6, 0, "nurgle"))).toBe(false);
  });
});
