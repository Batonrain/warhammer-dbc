// test/rules/capability-registry-complete.test.mjs
//
// Реестр возможностей должен знать ВСЁ, что выдаётся (wdbc-m7we).
//
// module/constants/capabilities.mjs заведён затем, что имя возможности — это
// договор между данными и кодом: запись Конструктора выдаёт имя, код его
// спрашивает, и разойтись они могут молча. Опечатку ловит isKnownCapability().
//
// Но проверка стоит только на ОДНОЙ стороне — на записи Конструктора. Правило
// из библиотеки (module/rules/library/*.mjs) выдаёт возможность прямо эффектом
// grantFlag, минуя её. Так шесть работающих возможностей оказались вне реестра,
// и последствие не косметическое: имени нет в списке Конструктора
// (CAPABILITY_OPTIONS), то есть автор контента не может выдать её данными — а
// ровно ради этого механизм и заводился. Комментарий в rules/flags.mjs приводит
// как пример именно такой случай: Арлекин, который «лечится как космодесантник»,
// должен получать healing.astartes из своих данных.
//
// Здесь договор проверяется с обеих сторон сразу.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITIES, CAPABILITY_OPTIONS, isKnownCapability } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const mjsIn = dir => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".mjs"))
  .map(e => path.join(e.parentPath ?? e.path, e.name));

/**
 * Имена, которые код выдаёт эффектом grantFlag с литеральной строкой.
 * Вычисляемое имя (переменная, цикл по списку) сюда не попадает — за такими
 * сторож не следит, и это честно: проверяются те договоры, что записаны буквой.
 */
function grantedInCode() {
  const found = new Map(); // имя → [«файл:строка», …]
  const patterns = [
    /kind:\s*"grantFlag"\s*,\s*target:\s*"([^"]+)"/g,
    /target:\s*"([^"]+)"\s*,\s*kind:\s*"grantFlag"/g
  ];
  for (const file of mjsIn(path.join(ROOT, "module"))) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      for (const re of patterns) {
        for (const m of line.matchAll(re)) {
          if (!found.has(m[1])) found.set(m[1], []);
          found.get(m[1]).push(`${rel}:${i + 1}`);
        }
      }
    });
  }
  return found;
}

describe("реестр возможностей знает всё, что выдаётся из кода", () => {
  const granted = grantedInCode();

  it("разбор вообще что-то находит", () => {
    // Иначе тест ниже был бы зелёным на пустом множестве.
    expect(granted.size).toBeGreaterThan(10);
  });

  it("каждое имя из grantFlag значится в реестре", () => {
    const missing = [...granted]
      .filter(([name]) => !isKnownCapability(name))
      .map(([name, where]) => `«${name}» — ${where.join(", ")}`);
    expect(missing, [
      "Эти возможности код выдаёт и читает, но реестр про них не знает.",
      "Последствие: имени нет в списке Конструктора, и автор контента не может",
      "выдать эту же возможность данными — только кодом. Чинить в",
      "module/constants/capabilities.mjs: добавить запись с label, source, reader."
    ].join("\n")).toEqual([]);
  });

  it("выданное из кода имеет читателя — иначе выдача бессмысленна", () => {
    // Возможность без читателя, выданная ПРАВИЛОМ из кода, — это код, который
    // сам себе кладёт строку и сам её не читает. У записи Конструктора такое
    // осмысленно (пометка «за столом руками»), у кода — нет.
    const idle = [...granted.keys()]
      .filter(name => isKnownCapability(name))
      .filter(name => !String(CAPABILITIES[name]?.reader ?? "").trim());
    expect(idle, "код выдаёт эти возможности, но ни одна строка их не читает").toEqual([]);
  });

  it("список для Конструктора совпадает с реестром", () => {
    // CAPABILITY_OPTIONS — то, что видит автор контента. Если он разойдётся с
    // реестром, часть имён станет недостижимой из данных незаметно.
    expect(CAPABILITY_OPTIONS.length).toBe(Object.keys(CAPABILITIES).length);
    expect(CAPABILITY_OPTIONS.every(([, label]) => typeof label === "string" && label.trim())).toBe(true);
  });
});
