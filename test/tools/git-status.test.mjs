// test/tools/git-status.test.mjs
//
// Сторож несохранённых правок packs-src перед npm run packs:unpack (wdbc-bncx).
// extractPack идёт с clean:true и переписывает исходники целиком, поэтому
// команда должна остановиться, если под packs-src есть незакоммиченное —
// разбор `git status --porcelain` проверяется как чистая функция, без
// реального репозитория.

import { describe, it, expect } from "vitest";
import { parseDirtyPaths } from "../../tools/git-status.mjs";

describe("parseDirtyPaths", () => {
  it("пустой вывод — нет правок", () => {
    expect(parseDirtyPaths("")).toEqual([]);
  });

  it("изменённый отслеживаемый файл", () => {
    expect(parseDirtyPaths(" M packs-src/weapons/a.json\n")).toEqual(["packs-src/weapons/a.json"]);
  });

  it("новый неотслеживаемый файл (?? — никогда не был в git, unpack сотрёт без возврата)", () => {
    expect(parseDirtyPaths("?? packs-src/weapons/new.json\n")).toEqual(["packs-src/weapons/new.json"]);
  });

  it("несколько путей разом", () => {
    const out = " M packs-src/weapons/a.json\n?? packs-src/weapons/b.json\n";
    expect(parseDirtyPaths(out)).toEqual(["packs-src/weapons/a.json", "packs-src/weapons/b.json"]);
  });

  it("переименование — берёт новый путь", () => {
    expect(parseDirtyPaths("R  packs-src/weapons/old.json -> packs-src/weapons/new.json\n"))
      .toEqual(["packs-src/weapons/new.json"]);
  });

  it("сносит \\r у построчного вывода на Windows", () => {
    expect(parseDirtyPaths(" M packs-src/weapons/a.json\r\n")).toEqual(["packs-src/weapons/a.json"]);
  });
});
