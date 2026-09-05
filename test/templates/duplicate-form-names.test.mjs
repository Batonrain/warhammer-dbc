// test/templates/duplicate-form-names.test.mjs
//
// Один и тот же name="system.…" дважды в ОДНОЙ форме листа — молчаливая
// потеря правок. FormDataExtended складывает одноимённые поля в МАССИВ, и
// дальше всё зависит от типа поля схемы: NumberField отвергает массив
// («must be a number») и роняет ВСЮ отправку листа — не сохраняется вообще
// ничего, что игрок менял; StringField молча склеит значения через запятую.
//
// Так сломался лист Миньона: счётчик Усталости стоит и в его шапке
// (minion-header.hbs, по просьбе пользователя), и в общей вкладке ТЕЛО
// (tab-effects.hbs) — любая правка листа падала на валидации
// system.fatigue.value/max. Лечится не переименованием поля, а тем, что
// вторая копия перестаёт рисоваться (контекстный флаг fatigueInHeader).
//
// Тест статический: партиалы разворачиваются рекурсивно, условные блоки
// Handlebars не вычисляются. Поэтому повтор, который заведомо сидит во
// ВЗАИМОИСКЛЮЧАЮЩИХ ветках, вносится в KNOWN_CONDITIONAL с причиной — новый
// повтор без такой записи роняет тест.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT   = path.resolve(import.meta.dirname, "../..");
const ACTORS = path.join(ROOT, "templates", "actor");

// "<лист>::<name>" → почему повтор безопасен. `requires` — что именно делает
// его безопасным: если этот кусок из кода/шаблона исчезнет, повтор снова
// станет настоящим, поэтому наличие каждой строки тест проверяет отдельно.
// Без этого исключение молча прикрывало бы вернувшийся баг.
const KNOWN_CONDITIONAL = {
  // Усталость: у Миньона счётчик стоит в шапке, и вкладка ТЕЛО свою копию
  // тогда не рисует.
  "minion-sheet.hbs::system.fatigue.value": {
    why: "вкладка ТЕЛО прячет свою копию под {{#unless fatigueInHeader}}",
    requires: [
      ["templates/actor/parts/tab-effects.hbs", "{{#unless fatigueInHeader}}"],
      ["module/sheets/minion-sheet.mjs",        "context.fatigueInHeader = true"]
    ]
  },
  // Корсарская Банда: блоки {{#if showWorldOrigin}} и {{#if isDrukhari}}
  // взаимоисключающие по построению самого флага.
  ...Object.fromEntries(
    ["character-sheet.hbs", "daemon-sheet.hbs", "demon-prince-sheet.hbs", "minion-sheet.hbs"]
      .map(sheet => [`${sheet}::system.band`, {
        why: "ветки Аэльдари/Друкхари взаимоисключающие",
        requires: [["module/sheets/character-context.mjs",
                    "context.showWorldOrigin = context.isAeldari && !context.isDrukhari"]]
      }]))
};

const PARTIAL_RE = /\{\{>\s*"systems\/warhammer-dbc\/([^"]+)"/g;
const NAME_RE    = /\bname="(system\.[A-Za-z0-9_.]+)"/g;

/** Все name="system.…" листа вместе с его партиалами (рекурсивно, без повторов файлов). */
function collectNames(relPath, seen = new Set()) {
  if (seen.has(relPath)) return [];
  seen.add(relPath);
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, "utf8");
  const out = [...src.matchAll(NAME_RE)].map(m => m[1]);
  for (const m of src.matchAll(PARTIAL_RE)) out.push(...collectNames(m[1], seen));
  return out;
}

describe("формы листов акторов", () => {
  const sheets = fs.readdirSync(ACTORS).filter(f => f.endsWith("-sheet.hbs"));

  it("находит листы акторов", () => expect(sheets.length).toBeGreaterThan(0));

  for (const sheet of sheets) {
    it(`${sheet}: ни одно system.*-поле не встречается дважды`, () => {
      const counts = {};
      for (const n of collectNames(path.join("templates", "actor", sheet).replaceAll("\\", "/")))
        counts[n] = (counts[n] || 0) + 1;
      const dups = Object.keys(counts)
        .filter(n => counts[n] > 1 && !KNOWN_CONDITIONAL[`${sheet}::${n}`]);
      expect(dups, `дубли name= в ${sheet}: ${dups.join(", ")}`).toEqual([]);

      // Каждое исключение держится на конкретной строке кода/шаблона —
      // проверяем, что она на месте, иначе исключение прикроет вернувшийся баг.
      for (const n of Object.keys(counts).filter(n => counts[n] > 1)) {
        for (const [file, needle] of KNOWN_CONDITIONAL[`${sheet}::${n}`].requires)
          expect(fs.readFileSync(path.join(ROOT, file), "utf8"),
            `${sheet}: повтор ${n} разрешён только пока в ${file} есть «${needle}»`).toContain(needle);
      }
    });
  }
});
