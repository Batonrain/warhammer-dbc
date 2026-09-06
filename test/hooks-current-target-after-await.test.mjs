// test/hooks-current-target-after-await.test.mjs
//
// СТОРОЖ ОДНОЙ ОШИБКИ, которая стоила игре двух главных кнопок защиты.
//
// Живая проверка 06.09.2026: кнопки «Уклонение» и «Парирование» в карточке
// атаки не работали ВООБЩЕ — клик не давал ни карточки, ни траты Реакции, ни
// сообщения об ошибке. Причина: обработчик асинхронный, и после первого же
// await браузер обнуляет ev.currentTarget. Дальше строка вида
// «ev.currentTarget.dataset.melee» падала с «Cannot read properties of null»,
// исключение уходило в необработанный промис — на экране НИЧЕГО. Тихо сломанная
// кнопка хуже громко сломанной: за столом это выглядит как «система не
// отвечает», и искать нечего.
//
// Ошибка не ловится ни линтером, ни юнит-тестами: обработчики привязываются к
// живой разметке чата, стенда для них в проекте нет. Поэтому сторож читает сам
// исходник.
//
// ПРАВИЛО: внутри addEventListener("click", async …) читать ev.currentTarget
// можно только ДО первого await. Всё, что нужно после, снимается заранее:
//   const el = ev.currentTarget;
//   const ds = { ...el.dataset };
//
// Что НЕ нарушение: await f(ev.currentTarget.dataset.x) в одной строке —
// аргументы вычисляются синхронно, до того как await отдаст ход.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = ["module/hooks.mjs"];

const HANDLER_RE = /addEventListener\(\s*["'`]\w+["'`]\s*,\s*async/;

/** Строки, читающие ev.currentTarget ПОСЛЕ завершившегося await. */
function offendersIn(source) {
  const raw = source.split(/\r?\n/);
  // Комментарии выкусываются: в них ev.currentTarget упоминается как раз там,
  // где объясняется, почему его нельзя читать после await.
  const lines = raw.map(line => line.replace(/\/\/.*$/, ""));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!HANDLER_RE.test(lines[i])) continue;
    const indent = lines[i].match(/^\s*/)[0].length;
    const end = new RegExp(`^\\s{${indent}}\\}\\)`);
    let awaited = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      // Конец обработчика: «});» на той же глубине — либо начало следующего,
      // если закрывающая скобка написана иначе, чем ждёт шаблон выше.
      if (end.test(line) || HANDLER_RE.test(line)) break;
      if (awaited && line.includes("ev.currentTarget")) {
        out.push({ line: j + 1, text: raw[j].trim() });
      }
      // await на ЭТОЙ же строке ход ещё не отдал — аргументы уже вычислены
      if (line.includes("await ")) awaited = true;
    }
  }
  return out;
}

describe("обработчики кликов не читают ev.currentTarget после await", () => {
  it("разбор вообще находит обработчики — сторож не выключен пустым множеством", () => {
    const src = fs.readFileSync(path.join(ROOT, FILES[0]), "utf8");
    const handlers = src.split(/\r?\n/).filter(line => HANDLER_RE.test(line));
    expect(handlers.length).toBeGreaterThan(20);
  });

  it("ни одного чтения ev.currentTarget после await", () => {
    const offenders = [];
    for (const file of FILES) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const o of offendersIn(src)) offenders.push(`${file}:${o.line}: ${o.text}`);
    }
    expect(offenders, [
      "ev.currentTarget обнуляется, как только обработчик отдаёт ход на await.",
      "Такое чтение падает с «Cannot read properties of null», исключение уходит",
      "в необработанный промис, и кнопка МОЛЧА не делает ничего — ровно так были",
      "сломаны Уклонение и Парирование. Снимите нужное до первого await:",
      "  const el = ev.currentTarget;",
      "  const ds = { ...el.dataset };"
    ].join("\n")).toEqual([]);
  });

  it("сторож отличает нарушение от безопасного вызова", () => {
    // Безопасно: аргумент вычисляется синхронно, до отдачи хода.
    const safe = [
      '      btn.addEventListener("click", async (ev) => {',
      "        await doThing(ev.currentTarget.dataset.x);",
      "      });"
    ].join("\n");
    expect(offendersIn(safe)).toEqual([]);

    // Нарушение: чтение уже после завершённого await.
    const broken = [
      '      btn.addEventListener("click", async (ev) => {',
      "        if (!await confirm()) return;",
      "        await doThing(ev.currentTarget.dataset.x);",
      "      });"
    ].join("\n");
    expect(offendersIn(broken).length).toBe(1);
  });

  it("комментарий про ev.currentTarget нарушением не считается", () => {
    const commented = [
      '      btn.addEventListener("click", async (ev) => {',
      "        if (!await confirm()) return;",
      "        // ev.currentTarget здесь уже null — читать нельзя",
      "        await doThing(ds.x);",
      "      });"
    ].join("\n");
    expect(offendersIn(commented)).toEqual([]);
  });
});
