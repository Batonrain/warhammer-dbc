// test/rules/source-registry-acyclic.test.mjs
//
// Круг импортов вокруг источников правил (wdbc-795h).
//
// Сборка правил обязана знать список источников, поэтому collect.mjs
// импортирует sources.mjs, а тот тянет всю библиотеку правил и все подсистемы.
// Значит НИ ОДИН модуль из этого графа не может спросить у актора возможность:
// hasRuleFlag ведёт в collect.mjs, а тот через sources.mjs — обратно к
// спрашивающему. Круг не падает с ошибкой, он ВЕШАЕТ загрузку модулей:
// test/rules/scaffold.test.mjs упирался в таймаут 20 секунд и молчал о причине.
//
// Так и вышло с Адъютантом — единственным источником, которому нужно спросить
// возможность (он опознаёт свой Талант по ключу, wdbc-iadw). Решение: его
// регистрация уехала из sources.mjs в него самого, а хранилище реестра
// отделено в файл-лист source-registry.mjs, откуда её и берут.
//
// Цена решения — новая хрупкость: самозарегистрированный модуль обязан быть
// кем-то ЗАГРУЖЕН, иначе источник тихо не появится. Загружает точка входа
// системы. Здесь стерегутся обе стороны сделки.
//
// Тест структурный, а не поведенческий: ломается граф импортов, и ломается
// молча — либо зависанием, либо исчезнувшим источником.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const at = rel => path.join(ROOT, rel);

const importsOf = (file) => [...fs.readFileSync(file, "utf8").matchAll(/from\s+"([^"]+)"|import\s+"([^"]+)"/g)]
  .map(m => m[1] || m[2])
  .filter(s => s.startsWith("."))
  .map(s => path.resolve(path.dirname(file), s));

/** Все файлы, до которых дотягивается граф импортов от `entry`. */
function reachableFrom(entry) {
  const seen = new Set();
  const stack = [at(entry)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    stack.push(...importsOf(f));
  }
  return seen;
}

describe("граф импортов вокруг источников правил", () => {
  it("хранилище реестра — лист: оно не импортирует ничего своего", () => {
    // Один относительный импорт здесь — уже дверь для будущего цикла:
    // хранилище тянут и сборка, и самозарегистрированные источники.
    expect(importsOf(at("module/rules/source-registry.mjs"))).toEqual([]);
  });

  it("файл регистраций не импортирует Адъютанта", () => {
    // Вернуть сюда `import ... from "./adjutant.mjs"` значит вернуть зависание.
    const src = read("module/rules/sources.mjs");
    expect(src).not.toMatch(/from\s+"\.\/adjutant\.mjs"/);
    expect(src).not.toMatch(/import\s+"\.\/adjutant\.mjs"/);
  });

  it("от сборки правил нельзя дойти обратно до Адъютанта", () => {
    // Прямая проверка отсутствия круга: collect.mjs → sources.mjs → … и
    // ни на каком шаге не adjutant.mjs, который сам ходит в collect.mjs.
    const reach = reachableFrom("module/rules/collect.mjs");
    expect(reach.has(at("module/rules/adjutant.mjs"))).toBe(false);
  });

  it("Адъютант регистрирует себя сам и берёт реестр из хранилища", () => {
    const src = read("module/rules/adjutant.mjs");
    expect(src).toContain('registerRuleSource("adjutant"');
    // Именно из хранилища-листа: из sources.mjs круг вернулся бы тем же путём.
    expect(src).toMatch(/from\s+"\.\/source-registry\.mjs"/);
    expect(src).not.toMatch(/from\s+"\.\/sources\.mjs"/);
    // И он действительно опознаёт Талант по ключу — ради этого всё затевалось.
    expect(src).toContain("ability-by-key.mjs");
    expect(src).toContain("ability.adjutant");
  });

  it("точка входа системы загружает Адъютанта", () => {
    // Обратная сторона самозаписи: файл, который никто не импортирует, свой
    // источник не зарегистрирует, и Талант молча перестанет давать Командиру
    // переброс. Ни один другой тест этого не заметит — источник просто пуст.
    expect(read("warhammer-dbc.mjs")).toMatch(/module\/rules\/adjutant\.mjs/);
  });

  it("sources.mjs по-прежнему отдаёт три функции реестра наружу", () => {
    // Три с лишним десятка файлов импортируют их оттуда. Переезд хранилища не
    // должен заставлять править каждый из них.
    const reexport = read("module/rules/sources.mjs")
      .split(/\r?\n/)
      .find(l => l.startsWith("export {") && l.includes("source-registry.mjs"));
    expect(reexport, "строки реэкспорта из хранилища нет вовсе").toBeTruthy();
    for (const fn of ["registerRuleSource", "getRuleSources", "clearRuleSources"])
      expect(reexport).toContain(fn);
  });
});
