// test/templates/blank-zero-mods.test.mjs
//
// Поля-модификаторы на листе («+N к Итогу Характеристики», «+N к Инициативе»,
// постоянный модификатор Навыка) рисовались с напечатанным нулём внутри.
// Ноль не исчезал при вводе, а прилипал к набранному: игрок печатал 12 и
// получал 120, печатал 5 — получал 50 (wdbc-mgh6). Правильное поведение:
// пустое поле, пока модификатора нет, ноль — подсказкой (placeholder).
//
// Тест держит обе половины починки:
//   • статически — что ни одно поле-модификатор не печатает значение мимо
//     хелпера blankZero и не забыло placeholder/data-blank-zero;
//   • по существу — что blankZero гасит именно ноль (а не всё подряд) и что
//     пустое поле складывается ОБРАТНО в 0, а не в null: схема этих полей —
//     NumberField({nullable:false}), а пустой <input type="number"> приходит
//     из формы как null (Foundry, applications/ux/form-data-extended.mjs).
//
// Счётчики (Раны, Очки Судьбы, Опыт, Усталость) сюда не входят намеренно: там
// ноль — осмысленное значение, и прятать его нельзя.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { blankZero, zeroBlankNumbers } from "../../module/helpers/blank-zero.mjs";

const ROOT   = path.resolve(import.meta.dirname, "../..");
const DIRS   = [
  path.join(ROOT, "templates", "actor", "parts"),
  path.join(ROOT, "templates", "apps")
];

// Поля, где ноль означает «модификатора нет» и печатать его вредно.
// Ключ — как имя выглядит в шаблоне (вместе с подстановкой Handlebars).
//
// Метку data-blank-zero требуем только у полей СХЕМЫ (name="system.…"): её
// читает _processFormData листа, возвращая очищенному полю ноль вместо null.
// «Модификатор ГМа» в КРАФТе схемой не хранится — его читает свой обработчик
// вкладки (module/sheets/tabs/craft.mjs, num(v, 0)), и пустая строка там уже
// складывается в ноль сама.
//
// Сюда НЕ входят счётчики (Раны, Очки Судьбы, Опыт, Усталость, Очки Действия)
// и AP укрытия — там ноль осмысленное значение, прятать его нельзя
// (решение владельца 06.09.2026 по AP укрытия).
const MOD_FIELDS = [
  "system.charDamage.{{char.key}}",
  "system.initiativeMod",
  "system.skills.{{sk.key}}.mod",
  "gmmod"
];

/** Все теги <input …> из партиалов листа актора и окон системы. */
function actorInputs() {
  const out = [];
  for (const dir of DIRS) {
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".hbs"))) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      for (const m of text.matchAll(/<input\b[^>]*>/g)) out.push({ file, tag: m[0] });
    }
  }
  return out;
}

function nameOf(tag) {
  return tag.match(/\bname="([^"]*)"/)?.[1] ?? null;
}

describe("поля-модификаторы не печатают ноль", () => {
  const inputs = actorInputs().filter(i => /type="number"/.test(i.tag));

  it("в партиалах листа есть числовые поля (тест не разбирает пустоту)", () => {
    expect(inputs.length).toBeGreaterThan(10);
  });

  for (const field of MOD_FIELDS) {
    const found = inputs.filter(i => nameOf(i.tag) === field);

    it(`${field} — поле найдено в шаблонах`, () => {
      expect(found.length).toBeGreaterThan(0);
    });

    for (const { file, tag } of found) {
      it(`${field} (${file}) — значение через blankZero, ноль подсказкой`, () => {
        expect(tag).toMatch(/value="\{\{blankZero /);
        expect(tag).toMatch(/placeholder="0"/);
        // Метка для листа: по ней _processFormData возвращает пустому полю 0.
        if (field.startsWith("system.")) expect(tag).toMatch(/data-blank-zero/);
      });
    }
  }
});

describe("blankZero", () => {
  it("ноль в любом виде становится пустой строкой", () => {
    expect(blankZero(0)).toBe("");
    expect(blankZero("0")).toBe("");
    expect(blankZero(null)).toBe("");
    expect(blankZero(undefined)).toBe("");
    expect(blankZero("")).toBe("");
  });

  it("настоящий модификатор остаётся числом, в том числе отрицательный", () => {
    expect(blankZero(12)).toBe(12);
    expect(blankZero(5)).toBe(5);
    expect(blankZero(-3)).toBe(-3);
    expect(blankZero("7")).toBe("7");
  });
});

describe("zeroBlankNumbers — пустое поле сохраняется нулём, а не null", () => {
  it("null у отмеченного поля превращается в 0", () => {
    const obj = { "system.charDamage.ws": null, "system.initiativeMod": null };
    zeroBlankNumbers(obj, ["system.charDamage.ws", "system.initiativeMod"]);
    expect(obj["system.charDamage.ws"]).toBe(0);
    expect(obj["system.initiativeMod"]).toBe(0);
  });

  it("набранное число не трогается", () => {
    const obj = { "system.charDamage.ws": 12, "system.skills.dodge.mod": -3 };
    zeroBlankNumbers(obj, ["system.charDamage.ws", "system.skills.dodge.mod"]);
    expect(obj["system.charDamage.ws"]).toBe(12);
    expect(obj["system.skills.dodge.mod"]).toBe(-3);
  });

  it("поля не из списка не трогаются, даже если там null", () => {
    const obj = { "system.wounds.value": null };
    zeroBlankNumbers(obj, ["system.charDamage.ws"]);
    expect(obj["system.wounds.value"]).toBe(null);
  });

  it("имени нет в отправке — ключ не появляется", () => {
    const obj = {};
    zeroBlankNumbers(obj, ["system.charDamage.ws"]);
    expect(Object.prototype.hasOwnProperty.call(obj, "system.charDamage.ws")).toBe(false);
  });
});
