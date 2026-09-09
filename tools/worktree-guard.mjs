// tools/worktree-guard.mjs
// ════════════════════════════════════════════════════════════════════════
//  СТОРОЖ МЕСТА ДЛЯ WORKTREE (wdbc-ncm7): не завелась ли рабочая копия
//  прямо внутри Data/systems/.
//
//  И `git-scribe` (шаг 7 git-цикла), и раздел «Git и трекер» скилла
//  `dbc-workflow` создают временный worktree командой
//  `git worktree add <path> -b pr/<тема> origin/main` — БЕЗ абсолютного
//  пути в примере. cwd сессии — это и есть Data/systems/warhammer-dbc
//  (сама система лежит прямо в папке, которую Foundry сканирует на
//  системы), поэтому относительный `<path>` вроде `wt-bookdiff` ложится
//  туда же. Foundry находит там system.json с id "warhammer-dbc", но имя
//  папки другое, и на каждом старте пишет в консоль
//  `Invalid system "warhammer-dbc" detected in directory "wt-bookdiff"`.
//  Игре это не мешает (дубля в списке систем не появляется), но выглядит
//  тревожно и повторяется — 08.09.2026 нашлось сразу два случая
//  (wt-bookdiff, wt-x7a-mystics) плюс два осиротевших остатка без
//  git-регистрации (wt-legion, wdbc-ks1r-pr).
//
//  Проверка воспроизводит ровно тот сигнал, по которому спотыкается сам
//  Foundry: он сравнивает "id" из <папка>/system.json с именем самой
//  папки. Несовпадение — вот и всё условие "Invalid system" в его логах.
//  Так сторож ловит не только worktree, а любую причину той же ошибки
//  (осиротевшую копию, ручной unzip не в ту папку и т.п.) — не только
//  git-worktree-регистрацию.
//
//  Разбор вынесен в чистые findMismatched/isMismatchedSystemDir (проверяется
//  без Foundry и без git — test/tools/worktree-guard.test.mjs), как
//  absorptionVerdict в tools/pr-absorbed.mjs.
// ════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ROOT } from "./packs.mjs";

/** Папка своей системы (ROOT — .../Data/systems/warhammer-dbc/). */
export const SYSTEMS_DIR = dirname(ROOT.replace(/[/\\]+$/, ""));
export const OWN_DIR_NAME = basename(ROOT.replace(/[/\\]+$/, ""));

/**
 * Ровно та проверка, которую делает сам Foundry при сканировании Data/systems:
 * "id" из system.json подпапки обязан совпадать с именем самой подпапки.
 *
 * @param {string} dirName имя подпапки Data/systems
 * @param {string|undefined} manifestId "id" из её system.json
 */
export function isMismatchedSystemDir(dirName, manifestId) {
  return typeof manifestId === "string" && manifestId.length > 0 && manifestId !== dirName;
}

/**
 * Подпапки systemsDir, у которых есть system.json, но его "id" не совпадает
 * с именем папки — то есть Foundry на старте напишет про них
 * `Invalid system "<id>" detected in directory "<папка>"`.
 *
 * @param {string} systemsDir Data/systems (по умолчанию — свой)
 * @returns {Array<{dir:string, id:string, path:string}>}
 */
export function findMismatched(systemsDir = SYSTEMS_DIR) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(systemsDir, { withFileTypes: true });
  } catch {
    return found; // нет такой папки — сверять нечего, не ошибка сторожа
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(systemsDir, entry.name);
    const manifestPath = join(dirPath, "system.json");
    if (!existsSync(manifestPath)) continue;
    let id;
    try {
      id = JSON.parse(readFileSync(manifestPath, "utf8")).id;
    } catch {
      continue; // битый/нечитаемый manifest — не по адресу этого сторожа
    }
    if (isMismatchedSystemDir(entry.name, id)) found.push({ dir: entry.name, id, path: dirPath });
  }
  return found;
}

// ── Подсказка к находке: зарегистрирован ли путь как git worktree ─────────

/**
 * Пути worktree'ев своего репозитория (`git worktree list --porcelain`),
 * чтобы отличить "это временный worktree — можно `git worktree remove`" от
 * "это осиротевшая копия без git-регистрации — проверь и удали руками".
 *
 * @param {string} [cwd] откуда спрашивать git (по умолчанию свой ROOT)
 * @returns {string[]} абсолютные пути, как их вернул git
 */
export function registeredWorktreePaths(cwd = ROOT) {
  let out;
  try {
    out = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd, encoding: "utf8" });
  } catch {
    return [];
  }
  return out.split("\n")
    .filter(l => l.startsWith("worktree "))
    .map(l => l.slice("worktree ".length).trim());
}

// ── Запуск из командной строки ────────────────────────────────────────────
//   node tools/worktree-guard.mjs
//   Выход 0 — в Data/systems/ нет папок, на которые ругнётся Foundry.
//   Выход 1 — есть; список и подсказка, что с ними делать.

function main() {
  const mismatched = findMismatched();
  if (!mismatched.length) {
    console.log(`В Data/systems/ (${SYSTEMS_DIR}) нет подпапок с чужим system.json — Foundry не будет ругаться на старте.`);
    return 0;
  }

  const worktrees = new Set(registeredWorktreePaths().map(p => p.replace(/\\/g, "/").toLowerCase()));
  console.error(`Foundry на старте напишет "Invalid system" про ${mismatched.length} подпапк${mismatched.length === 1 ? "у" : "и"} в Data/systems/:\n`);
  for (const { dir, id, path } of mismatched) {
    const isWorktree = worktrees.has(path.replace(/\\/g, "/").toLowerCase());
    console.error(`  ${dir}/  (system.json id="${id}")`);
    console.error(isWorktree
      ? `    это git worktree — убрать: git worktree remove "${path}"`
      : `    НЕ зарегистрирован как git worktree (осиротевшая копия?) — проверь содержимое и удали руками, если это точно мусор`);
  }
  console.error(`\nНовый worktree под сессию — не сюда: относительный путь ляжет прямо в эту же папку (cwd сессии — Data/systems/${OWN_DIR_NAME}). Абсолютный путь вида C:/Users/Derbius/AppData/Local/Temp/claude/<имя> — источник истины см. .claude/skills/dbc-workflow/SKILL.md, раздел «Git и трекер».`);
  return 1;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/worktree-guard.mjs"))
  process.exit(main());
