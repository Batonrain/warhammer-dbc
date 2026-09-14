import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Сторож на случайные control-байты в исходниках tools/*.mjs (wdbc-gap5):
// в tools/book-docs.mjs однажды затесался буквальный NUL (0x00) вместо
// пробела в разделителе parts.join(...) — в редакторе он неотличим от
// обычного пробела, поэтому дожил незамеченным несколько сессий. Такой байт
// либо ошибка (тест должен покраснеть), либо осознанное решение — тогда оно
// заносится сюда единственным исключением с обоснованием, а не молчаливым
// "ну мало ли".
//
// Разрешённые control-байты в исходнике — только привычные \t \n \r. Всё
// остальное ниже 0x20 в JS-исходнике не нужно: непечатаемые байты внутри
// строковых литералов положено писать явным escape (\x00, \uXXXX), а не
// вставлять сырым байтом.
//
// wdbc-awvf: тот же паттерн нашёлся ещё раз в tools/pack-fingerprint.mjs (NUL
// и SOH как разделители отпечатка пака) и был починен по тому же образцу —
// сырой байт заменён на явный escape-литерал `\x00`/`\x01`, значение байта не
// менялось (иначе разошлись бы уже посчитанные отпечатки). Поэтому у обоих
// файлов теперь одна и та же форма: сырых control-байтов в исходнике нет
// вовсе, а стабильность разделителя проверяется отдельно ниже — по каждому
// файлу своим списком строк, а не перечислением байтов-исключений.

const TOOLS_DIR = join(import.meta.dirname, "..", "..", "tools");
const ALLOWED_CODES = new Set([0x09, 0x0a, 0x0d]); // \t \n \r

// Разделители, экранированные явным escape-литералом в исходнике (не сырым
// байтом) — сторож ниже следит, чтобы они не выветрились при будущих правках.
// tools/book-docs.mjs, stableId() (bd wdbc-gap5): живые _id глав/страниц
// книжных паков вычислены именно с этим байтом, менять нельзя.
const STABLE_ID_LINE = /createHash\("sha256"\)\.update\(parts\.join\("\\x00"\)\)\.digest\(\);/;

// tools/pack-fingerprint.mjs, fingerprintOf() (bd wdbc-awvf): NUL между
// ключом и значением, SOH перед затравкой длины и после каждой строки.
// Смена значения байта пересчитала бы отпечаток у всех паков — сторож здесь
// проверяет только форму записи (явный escape, не сырой байт), не значение.
const FINGERPRINT_SEP_LINES = [
  /`\$\{key\}\\x00\$\{stable\(authored\(key, value\)\)\}`/,
  /h\.update\(`\$\{rows\.length\}\\x01`\);/,
  /h\.update\(row \+ "\\x01"\);/
];

function findControlBytes(fileName) {
  const buf = readFileSync(join(TOOLS_DIR, fileName));
  const text = buf.toString("latin1"); // 1 байт = 1 код, офсеты и код совпадают с буфером
  const lines = text.split(/\r\n|\n/);
  const bad = [];
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code >= 0x20 || ALLOWED_CODES.has(code)) continue;
      const known = fileName === "book-docs.mjs" && STABLE_ID_LINE.test(line);
      if (!known) bad.push({ file: fileName, code, line });
    }
  }
  return bad;
}

describe("tools/*.mjs: нет непреднамеренных control-байтов в исходниках", () => {
  const files = readdirSync(TOOLS_DIR).filter(f => f.endsWith(".mjs"));

  it("ни в одном файле нет НЕОЖИДАННЫХ сырых control-байтов (кроме \\t \\n \\r и известных исключений)", () => {
    const bad = files.flatMap(findControlBytes);
    expect(bad).toEqual([]);
  });

  it("разделитель stableId() в book-docs.mjs остаётся явным литералом \\x00, не сырым байтом", () => {
    const text = readFileSync(join(TOOLS_DIR, "book-docs.mjs"), "utf8");
    expect(text).toMatch(STABLE_ID_LINE);
  });

  it("разделители fingerprintOf() в pack-fingerprint.mjs остаются явными литералами \\x00/\\x01, не сырым байтом", () => {
    const text = readFileSync(join(TOOLS_DIR, "pack-fingerprint.mjs"), "utf8").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    for (const re of FINGERPRINT_SEP_LINES) {
      expect(lines.some(l => re.test(l))).toBe(true);
    }
  });
});
