// test/tools/merge-book-pages.test.mjs
//
// Трёхстороннее слияние книги по страницам (tools/merge-book-pages.py). Тест
// гоняет сам скрипт, а не его копию на JS: у инструмента, который ПИШЕТ в файл
// живых данных, проверять надо ровно то, что запускает человек.
//
// Два свойства стоят проверки отдельно:
//  1. решение «применить / конфликт / не трогать» — иначе чужая правка молча
//     затирается;
//  2. формат записи — он обязан совпадать с распаковщиком (tools/unpack.mjs,
//     `JSON.stringify(source, null, 1) + "\n"`), иначе первый же --apply даёт
//     дифф на всю книгу и роняет третий шаг CI.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = join(import.meta.dirname, "../../tools/merge-book-pages.py");

/** Книга из одной главы: три страницы одного физического листа PDF. */
const book = (htmls) => ({
  slug: "t", title: "Т", file: "t.pdf", pdfPages: 1,
  entries: [{
    name: "Глава", pdfPage: 7, pages: htmls.map((html, i) => ({
      name: `Раздел ${i + 1}`, html, checked: false,
      // pdfPage стоит только на первой странице листа — так пишет распаковщик,
      // и именно поэтому слияние протягивает номер вперёд.
      ...(i === 0 ? { pdfPage: 7 } : {})
    }))
  }]
});

let dir;
const path = (name) => join(dir, name);
const write = (name, doc) => writeFileSync(path(name), JSON.stringify(doc, null, 1) + "\n", "utf8");
const read  = (name) => JSON.parse(readFileSync(path(name), "utf8"));
const htmls = (name) => read(name).entries[0].pages.map(p => p.html);

const run = (...args) => {
  const r = spawnSync("python3", [TOOL, "--base", path("base.json"),
    "--edited", path("edited.json"), "--live", path("live.json"), ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "wdbc-merge-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("слияние книги по страницам", () => {
  it("наша правка применяется, чужая на другой странице остаётся", () => {
    write("base.json",   book(["а", "б", "в"]));
    write("edited.json", book(["а", "МОЁ", "в"]));
    write("live.json",   book(["ЧУЖОЕ", "б", "в"]));

    const dry = run();
    expect(dry.code).toBe(0);
    expect(dry.out).toContain("К применению без конфликта: 1");
    expect(htmls("live.json")).toEqual(["ЧУЖОЕ", "б", "в"]);   // dry-run не пишет

    expect(run("--apply").code).toBe(0);
    expect(htmls("live.json")).toEqual(["ЧУЖОЕ", "МОЁ", "в"]);
  });

  it("одна и та же страница, правленная по-разному, — конфликт, live не тронут", () => {
    write("base.json",   book(["а", "б", "в"]));
    write("edited.json", book(["а", "МОЁ", "в"]));
    write("live.json",   book(["а", "ЧУЖОЕ", "в"]));

    const r = run("--apply");
    expect(r.code).toBe(1);
    expect(r.out).toContain("Настоящих конфликтов");
    expect(htmls("live.json")).toEqual(["а", "ЧУЖОЕ", "в"]);
  });

  it("совпавшая правка обеих сторон конфликтом не считается", () => {
    write("base.json",   book(["а", "б", "в"]));
    write("edited.json", book(["а", "ОБА", "в"]));
    write("live.json",   book(["а", "ОБА", "в"]));

    const r = run("--apply");
    expect(r.code).toBe(0);
    expect(r.out).toContain("К применению без конфликта: 0");
  });

  it("новый раздел в live — структурное расхождение, а не тихая перезапись", () => {
    write("base.json",   book(["а", "б"]));
    write("edited.json", book(["а", "МОЁ"]));
    write("live.json",   book(["а", "б", "в"]));

    const r = run("--apply");
    expect(r.code).toBe(1);
    expect(r.out).toContain("СТРУКТУРА");
    expect(htmls("live.json")).toEqual(["а", "б", "в"]);
  });

  it("формат записи совпадает с распаковщиком (отступ 1, перевод строки в конце)", () => {
    write("base.json",   book(["а", "б"]));
    write("edited.json", book(["а", "МОЁ"]));
    write("live.json",   book(["а", "б"]));

    expect(run("--apply").code).toBe(0);

    const text = readFileSync(path("live.json"), "utf8");
    expect(text).toBe(JSON.stringify(read("live.json"), null, 1) + "\n");
  });
});
