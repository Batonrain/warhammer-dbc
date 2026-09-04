// tools/git-status.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разбор `git status --porcelain` для сторожа несохранённых правок
//  packs-src (tools/unpack.mjs). Разбор вынесен в чистую функцию отдельно
//  от вызова git — чтобы проверять правило без реального репозитория, как
//  test/tools/pack-stamp.test.mjs проверяет packsChangedSince без файлов.
// ════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { ROOT } from "./packs.mjs";

/**
 * Пути из вывода `git status --porcelain`. Формат строки — двухбуквенный код
 * статуса, пробел, путь (при переименовании — `старый -> новый`, берём
 * новый). Пустые строки (конечный перевод строки) отбрасываются.
 */
export function parseDirtyPaths(porcelain) {
  return porcelain
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").pop());
}

/**
 * Незакоммиченные (в т.ч. неотслеживаемые) пути под packs-src. `roots` — один
 * путь или несколько (сужение до конкретных паков, см. --pack в
 * tools/unpack.mjs) — сторож видит только их, не весь packs-src.
 */
export function uncommittedPacksSrc(roots) {
  const paths = Array.isArray(roots) ? roots : [roots];
  const out = execFileSync("git", ["status", "--porcelain", "--", ...paths], {
    cwd: ROOT,
    encoding: "utf8"
  });
  return parseDirtyPaths(out);
}
