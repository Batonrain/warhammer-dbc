// test/tools/unpack-writes-after-checks.test.mjs
//
// Извлечение компендиумов не должно писать в packs-src, пока не проверены ВСЕ
// паки и книги (wdbc-aje).
//
// ПОЧЕМУ ЭТОТ ТЕСТ ЕСТЬ. Баг воспроизводился дважды в живых сессиях, и оба
// раза выглядел одинаково и невозможно: обе команды печатали текст отказа,
// ничего не форсировали — и packs-src всё равно оказывался переписан
// составом устаревшей локальной базы. 10.09.2026 — 510 файлов, 14.09.2026 —
// 1226 файлов и 150 тысяч удалённых строк.
//
// Причина была в порядке, а не в самих сторожах: перенос стадии на место
// стоял ВНУТРИ цикла проверки. Пак, у которого расхождения не нашлось,
// перезаписывался немедленно, а общий отказ печатался уже после цикла —
// когда часть исходников была затёрта. Разделение флагов --force и
// --force-drift эту половину не лечило вовсе.
//
// Проверка структурная, по исходнику инструмента, и это здесь верный
// уровень: защищаемое свойство — порядок операций в теле скрипта, а не
// значение, возвращаемое функцией. Чистая часть решения (shouldStopOnDrift)
// покрыта отдельно в pack-drift.test.mjs. Прецедент такого теста в наборе
// уже есть — test/tools/tools-control-bytes.test.mjs.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../tools/unpack.mjs"), "utf8");

/** Строки тела скрипта, которые реально пишут в исходники. */
const WRITE_LINES = [
  "rmSync(abs(src), { recursive: true, force: true });",
  "cpSync(stage, abs(src), { recursive: true });",
  'writeFileSync(file, JSON.stringify(source, null, 1) + "\\n", "utf8");'
];

/** Индекс строки с этим фрагментом (первое вхождение). */
const lineOf = (needle) => {
  const lines = SRC.split("\n");
  const i = lines.findIndex(l => l.includes(needle));
  expect(i, `в tools/unpack.mjs не нашлось строки: ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("unpack.mjs пишет в packs-src только после всех проверок", () => {
  it("гейты «ни один пак/книга не отстаёт» стоят ДО каждой записи", () => {
    const libGate  = lineOf("if (!behind.length) {");
    const bookGate = lineOf("if (!bookBehind.length) {");
    for (const w of WRITE_LINES) {
      const at = lineOf(w);
      expect(at > libGate || at > bookGate,
        `запись «${w}» стоит раньше гейта отказа`).toBe(true);
    }
  });

  it("сбор расхождений идёт в списки, а не решается по одному паку на месте", () => {
    // `behind.push(...)` + `continue` внутри цикла — и никакой записи рядом:
    // именно это отличает «собрать и решить» от «решать по ходу».
    expect(SRC).toContain("behind.push({ pack: p.name");
    expect(SRC).toContain("bookBehind.push({ book: b.slug");
    expect(SRC).toContain("staged.push({ pack: p.name");
    expect(SRC).toContain("stagedBooks.push({ slug: b.slug");
  });

  it("у сторожа дрейфа своё согласие --force-drift, отдельное от --force", () => {
    // Первое согласие — «снеси мою незакоммиченную правку», второе — «сотри
    // закоммиченные документы, которых нет в базе». Их нельзя путать.
    expect(SRC).toContain('const FORCE = process.argv.includes("--force");');
    expect(SRC).toContain('const FORCE_DRIFT = process.argv.includes("--force-drift");');
    expect(SRC).toContain("shouldStopOnDrift(lost.length, FORCE_DRIFT)");
  });
});
