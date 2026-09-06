// test/module-parses.test.mjs
//
// СТОРОЖ: каждый файл системы обязан хотя бы РАЗБИРАТЬСЯ.
//
// 06.09.2026 в module/sheets/actor-sheet.mjs попали задвоенные строки импорта
// (одно и то же имя импортировано дважды из одного файла). В ES-модуле это
// SyntaxError, и он ломает разбор ВСЕГО графа модулей системы: Hooks «init» не
// выполняется вовсе, CONFIG.Actor.dataModels остаётся пустым, лист персонажа
// открывается голой формой Foundry без вкладок и характеристик. Играть в таком
// состоянии нельзя вообще.
//
// Почему это не поймали гейты:
//  • npm test — ни один тест не импортирует actor-sheet.mjs (он тянет глобалы
//    Foundry и без стенда не грузится), так что для тестов файла будто нет;
//  • npm run lint — на самом деле ПОЙМАЛ бы, он выдаёт «Parsing error», но
//    ошибку не заметили: итог читали хвостом вывода, а строка с числом ошибок
//    в этот хвост не попала. Инструмент сработал, чтение подвело.
//
// Отсюда этот сторож. Он не заменяет линтер, он закрывает конкретную дыру:
// файл, который никто не импортирует, всё равно обязан быть синтаксически
// целым. Только разбор, без выполнения — ни Foundry, ни стенд не нужны.

import { describe, it, expect } from "vitest";
import { transformSync } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Все .mjs системы: модули, инструменты сборки и точка входа. */
function systemFiles() {
  const out = [];
  for (const dir of ["module", "tools"]) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (entry.isDirectory() || !entry.name.endsWith(".mjs")) continue;
      out.push(path.join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  const entry = path.join(ROOT, "warhammer-dbc.mjs");
  if (fs.existsSync(entry)) out.push(entry);
  return out;
}

/**
 * Разбирается ли файл. Возвращает текст ошибки или "" — БЕЗ выполнения кода.
 *
 * Разбор В ЭТОМ ЖЕ процессе (esbuild и так стоит под vitest), а не запуском
 * `node --check` на каждый файл: файлов около четырёхсот, и отдельный процесс
 * на каждый занимал больше тридцати секунд — тест падал по таймауту, ничего не
 * найдя. Медленный сторож перестают запускать, и он превращается в ложное
 * спокойствие; это ровно та ловушка, которую в тот же день пришлось разбирать
 * в test/tools/packs.test.mjs.
 */
function parseError(file) {
  try {
    transformSync(fs.readFileSync(file, "utf8"), {
      loader: "js", format: "esm", sourcefile: file
    });
    return "";
  } catch (e) {
    const first = e.errors?.[0];
    return first ? `${first.text} (строка ${first.location?.line ?? "?"})` : String(e.message);
  }
}

describe("каждый файл системы разбирается", () => {
  const files = systemFiles();

  it("разбор вообще что-то нашёл — сторож не выключен пустым множеством", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("ни одного синтаксически битого файла", () => {
    const broken = files
      .map(file => ({ file: path.relative(ROOT, file).split(path.sep).join("/"), err: parseError(file) }))
      .filter(x => x.err)
      .map(x => `${x.file}: ${x.err}`);
    expect(broken, [
      "Файл не разбирается. Если это модуль системы, сломан весь граф модулей:",
      "Hooks «init» не выполнится, CONFIG.Actor.dataModels останется пустым, и",
      "лист персонажа откроется голой формой Foundry без вкладок — играть нельзя.",
      "Самая частая причина — задвоенный импорт одного имени из одного файла."
    ].join("\n")).toEqual([]);
  });

  it("сторож действительно ловит задвоенный импорт, а не только пустое множество", () => {
    // Без этой проверки тест остался бы зелёным, даже если бы parseError
    // молча возвращал "" на любой вход.
    // Во ВРЕМЕННЫЙ каталог, а не в рабочую копию: в этом репозитории рядом
    // работают параллельные сессии, и файл, оставшийся от упавшего процесса,
    // всплыл бы у них в `git status` неотслеживаемым мусором неизвестного
    // происхождения.
    const tmp = path.join(os.tmpdir(), `wdbc-parse-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(tmp, 'import { A } from "./x.mjs";\nimport { A } from "./x.mjs";\n');
    try {
      expect(parseError(tmp)).not.toBe("");
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});
