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

const TOOLS_DIR = join(import.meta.dirname, "..", "..", "tools");
const ALLOWED_CODES = new Set([0x09, 0x0a, 0x0d]); // \t \n \r

// Разрешённое исключение №1 (wdbc-gap5, эта задача): разделитель stableId() в
// tools/book-docs.mjs — живые _id глав/страниц книжных паков вычислены именно
// с этим байтом, менять нельзя. Экранирован явным `\x00` в исходнике, поэтому
// сырого control-байта в самом файле больше нет; вторая проверка ниже следит,
// чтобы явный escape-литерал не выветрился при будущих правках.
const STABLE_ID_LINE = /createHash\("sha256"\)\.update\(parts\.join\("\\x00"\)\)\.digest\(\);/;

// Разрешённые исключения №2 (та же природа, но НЕ трогались в этой задаче —
// wdbc-gap5 касается только book-docs.mjs; заведён отдельный тикет на их
// очистку по тому же образцу). tools/pack-fingerprint.mjs использует NUL и
// SOH (0x00, 0x01) как разделители при подсчёте отпечатка пака —
// authored()/stable() и rowsFingerprint(); байты сырые, не через явный
// escape, с тем же риском случайной порчи копипастом/автоформатированием.
// Раз уж этот сторож ищет ИМЕННО такие байты по всему tools/ — эти три
// известные строки перечислены явно, а не молчаливым исключением всего
// файла, чтобы новый непредвиденный control-байт в pack-fingerprint.mjs
// сторож всё равно поймал.
// Внимание: здесь single-backslash \x00/\x01 — это регэксп-эскейпы,
// матчащие настоящий сырой байт (0x00 / 0x01) внутри строки `line`, а НЕ
// текст "\x00". В pack-fingerprint.mjs, в отличие от book-docs.mjs, байт
// до сих пор лежит сырым, без явного escape-литерала в исходнике.
const KNOWN_ISSUE_LINES = [
  /`\$\{key\}\x00\$\{stable\(authored\(key, value\)\)\}`/,
  /h\.update\(`\$\{rows\.length\}\x01`\);/,
  /h\.update\(row \+ "\x01"\);/
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
      const known =
        (fileName === "book-docs.mjs" && STABLE_ID_LINE.test(line)) ||
        (fileName === "pack-fingerprint.mjs" && KNOWN_ISSUE_LINES.some(re => re.test(line)));
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

  it("известные строки-исключения в pack-fingerprint.mjs реально на месте — иначе список исключений устарел", () => {
    const text = readFileSync(join(TOOLS_DIR, "pack-fingerprint.mjs"), "utf8").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    for (const re of KNOWN_ISSUE_LINES) {
      expect(lines.some(l => re.test(l))).toBe(true);
    }
  });
});
