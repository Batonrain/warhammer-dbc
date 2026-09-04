// test/rules/delegate-test-wiring.test.mjs
//
// Делегированный тест (wdbc-uez7/wdbc-j814/wdbc-mhds) собран из двух половин,
// которые ничего не знают друг о друге: rules/delegate-test.mjs умеет только
// ДОСТАВИТЬ запрос («kind» + payload), а какой диалог по этому kind открыть у
// исполнителя — знает исключительно реестр в hooks.mjs. Половины связаны
// строкой-литералом, а не импортом, поэтому при переносе веток реестр однажды
// уже потерялся целиком: все юнит-тесты остались зелёными, а в игре каждая
// кнопка «📨 Делегировать» молча уходила в никуда — карточка в чат приходила,
// клик по ней не делал ничего.
//
// Проверяем ровно эту стыковку по исходникам: у каждого kind с места вызова
// есть регистрация, и кнопка карточки в чате кем-то слушается.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT  = path.resolve(import.meta.dirname, "../..");
const HOOKS = fs.readFileSync(path.join(ROOT, "module/hooks.mjs"), "utf8");

/** Все .mjs модуля системы. */
const moduleFiles = fs.readdirSync(path.join(ROOT, "module"), { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".mjs"))
  .map(e => path.join(e.parentPath ?? e.path, e.name));

/** kind'ы, которые где-то запрашиваются: showDelegateTestPicker / requestDelegatedTest. */
function requestedKinds() {
  const kinds = new Set();
  for (const file of moduleFiles) {
    if (file.endsWith("rules/delegate-test.mjs")) continue;   // сам транспорт
    const src = fs.readFileSync(file, "utf8");
    // Только тот kind, что лежит в самом вызове, — в файлах вроде actor-sheet.mjs
    // слово «kind» встречается десятки раз по другим поводам, поэтому смотрим
    // окно текста сразу после имени функции, а не файл целиком.
    for (const call of src.matchAll(/(?:showDelegateTestPicker|requestDelegatedTest|openDelegatedTestDirect)\s*\(/g)) {
      const window = src.slice(call.index, call.index + 800);
      const m = window.match(/kind:\s*"([^"]+)"/);
      if (m) kinds.add(m[1]);
    }
  }
  return [...kinds];
}

const registered = new Set([...HOOKS.matchAll(/registerDelegatedTestOpener\(\s*"([^"]+)"/g)].map(m => m[1]));

describe("делегированный тест — реестр опенеров не теряется", () => {
  it("места вызова вообще есть (иначе тест сторожит пустоту)", () => {
    expect(requestedKinds().length).toBeGreaterThan(0);
  });

  it.each(requestedKinds())("kind «%s» кто-то умеет открыть", kind => {
    expect([...registered]).toContain(kind);
  });

  it("кнопка карточки запроса в чате слушается", () => {
    expect(HOOKS).toContain(".delegated-test-open");
    expect(HOOKS).toMatch(/openDelegatedTest\(/);
  });
});
