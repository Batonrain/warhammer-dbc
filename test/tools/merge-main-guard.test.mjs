// test/tools/merge-main-guard.test.mjs
//
// Сторож перед merge origin/main в общую рабочую копию (wdbc-cwq2f, инцидент
// 21.09.2026 — сессия «Оружие Наследия» потеряла несохранённые правки, когда
// параллельная сессия смёрджила origin/main прямо в общий main). Разбор
// вывода git проверяется как чистая функция, без реального репозитория —
// тем же приёмом, что parseDirtyPaths (test/tools/git-status.test.mjs).

import { describe, it, expect } from "vitest";
import { mergeTreeHasConflicts } from "../../tools/merge-main.mjs";
import { uncommittedRepoPaths } from "../../tools/git-status.mjs";

describe("mergeTreeHasConflicts", () => {
  it("пустой вывод — конфликтов нет", () => {
    expect(mergeTreeHasConflicts("")).toBe(false);
  });

  it("вывод без конфликтных маркеров — конфликтов нет", () => {
    expect(mergeTreeHasConflicts("module/foo.mjs\n")).toBe(false);
  });

  it("вывод с маркером <<<<<<< — конфликт есть", () => {
    const out = "module/foo.mjs\n<<<<<<< main\nа\n=======\nб\n>>>>>>> origin/main\n";
    expect(mergeTreeHasConflicts(out)).toBe(true);
  });

  it("undefined/null вывод — не падает, считает 'конфликтов нет'", () => {
    expect(mergeTreeHasConflicts(undefined)).toBe(false);
    expect(mergeTreeHasConflicts(null)).toBe(false);
  });
});

describe("uncommittedRepoPaths — сторож экспортирует функцию для всего репозитория", () => {
  it("реально запускается без падения (свой репозиторий)", () => {
    expect(() => uncommittedRepoPaths()).not.toThrow();
    expect(Array.isArray(uncommittedRepoPaths())).toBe(true);
  });
});
