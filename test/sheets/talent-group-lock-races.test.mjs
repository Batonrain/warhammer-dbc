// test/sheets/talent-group-lock-races.test.mjs
//
// wdbc-sauo: 13 веток talentGroupLock переведены с прямых сравнений
// race/legion/имени предмета на hasRuleFlag (module/rules/flags.mjs). Матрица
// ниже — «раса × папка → вердикт» — снята с ПОВЕДЕНИЯ, а не с реализации: те
// же актор/папка, что и раньше, должны получать то же «открыто»/«закрыто»,
// что и до правки (эталон был снят вручную со старого кода item-picker.mjs
// перед переводом на флаги).

import { describe, it, expect } from "vitest";
import { talentGroupLock } from "../../module/sheets/item-picker.mjs";

const actor = ({ race, geneSeed, psyker, items = [] } = {}) =>
  ({ system: { race, geneSeed, psyker }, items });

const lock = (a, parent, folder) => talentGroupLock(a, "talent", parent, folder);
const OPEN = null;

// ── Расовые папки (было: sys.race === "…" / DRUKHARI_RACES.includes) ────────
describe("расовые папки — матрица раса × папка", () => {
  const RACES = [
    "human", "astartes", "exodite",
    "drukhari", "truebornDrukhari", "mandrake", "wrack",
    "azuriane", "harlequin", "ynnari"
  ];

  // [папка, parent, раса-владелец] — «раса-владелец» пусто для папок без
  // реальной раскладки в паке (Экзодиты/Иннари, см.
  // test/sheets/talent-group-lock-folders.test.mjs — известный пробел контента,
  // гейт по флагу всё равно проверяется).
  const FOLDERS = [
    ["Экзодиты — Тест", "", "exodite"],
    ["Друкхари", "", "drukhari"],
    ["Азуриани", "", "azuriane"],
    ["Арлекины — Тест", "", "harlequin"],
    ["Иннари", "", "ynnari"],
    ["Таланты Боли", "", "drukhari"]
  ];

  for (const [folder, parent, owner] of FOLDERS) {
    describe(`папка «${folder}»`, () => {
      for (const race of RACES) {
        const isDrukhariOwner = owner === "drukhari" &&
          ["drukhari", "truebornDrukhari", "mandrake", "wrack"].includes(race);
        const expectedOpen = race === owner || isDrukhariOwner;

        it(`${race} → ${expectedOpen ? "открыта" : "закрыта"}`, () => {
          const result = lock(actor({ race }), parent, folder);
          if (expectedOpen) expect(result).toBe(OPEN);
          else expect(result).not.toBe(OPEN);
        });
      }
    });
  }
});

// ── Легион (было: sys.geneSeed?.legion === "VIII") ──────────────────────────
describe("папка «Повелители Ночи» — легион VIII Астартес", () => {
  const folder = ["Таланты Астартес", "Повелители Ночи"];

  it("Астартес легиона VIII — открыта", () => {
    expect(lock(actor({ race: "astartes", geneSeed: { legion: "VIII" } }), ...folder)).toBe(OPEN);
  });

  it("Астартес другого легиона — закрыта", () => {
    expect(lock(actor({ race: "astartes", geneSeed: { legion: "I" } }), ...folder)).not.toBe(OPEN);
  });

  it("Астартес без Геносемени вовсе — закрыта", () => {
    expect(lock(actor({ race: "astartes" }), ...folder)).not.toBe(OPEN);
  });

  it("другая раса с тем же значением legion в данных — всё равно закрыта", () => {
    // astartes.nightLords приходит из источника «race» (module/rules/
    // sources.mjs) только при system.race === "astartes" — источник вообще
    // не читает ASTARTES_RULES для другой расы, поэтому подставленный
    // geneSeed.legion у человека ничего не даёт. Проверка нужна именно на
    // случай, если источник race когда-нибудь перестанет фильтровать по
    // расе, — тогда легион в одиночку начал бы отпирать чужую папку.
    expect(lock(actor({ race: "human", geneSeed: { legion: "VIII" } }), ...folder)).not.toBe(OPEN);
  });
});

// ── Пси-Рейтинг (было: Number(sys.psyker?.rating) > 0), две папки ───────────
describe("папки «Псайкер»/«Псайкана» — Пси-Рейтинг больше 0, любая раса", () => {
  it.each([
    ["Книга Пустоты", "Псайкер"],
    ["", "Псайкана"]
  ])("%s/%s: рейтинг 1 — открыта, 0 — закрыта, нет поля — закрыта", (parent, folder) => {
    expect(lock(actor({ race: "human", psyker: { rating: 1 } }), parent, folder)).toBe(OPEN);
    expect(lock(actor({ race: "astartes", psyker: { rating: 3 } }), parent, folder)).toBe(OPEN);
    expect(lock(actor({ race: "human", psyker: { rating: 0 } }), parent, folder)).not.toBe(OPEN);
    expect(lock(actor({ race: "human" }), parent, folder)).not.toBe(OPEN);
  });
});
