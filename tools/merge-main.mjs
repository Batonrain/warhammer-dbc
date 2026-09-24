// tools/merge-main.mjs
// ════════════════════════════════════════════════════════════════════════
//  СТОРОЖ ПЕРЕД MERGE origin/main В ОБЩУЮ РАБОЧУЮ КОПИЮ (wdbc-cwq2f).
//
//  Инцидент 21.09.2026 (сессия «Оружие Наследия», wdbc-1rno.35): в общей
//  рабочей копии `main` (не в изолированном worktree) выполнили `git merge
//  origin/main`, конфликт разобрали чем-то вроде `git checkout -- .` — это
//  откатило ВСЕ несохранённые правки другой сессии до старого коммита.
//  Тот же класс аварии, что wdbc-bncx (`npm run packs:unpack` стирал чужой
//  packs-src) — общая рабочая копия без изоляции, только для всего репо,
//  не только packs-src.
//
//  Тот же fix-vs-symptom, что у tools/unpack.mjs: раньше единственной мерой
//  был текст в памяти/скилле («мерджить только в worktree») — сработал не
//  всегда, потому что читается лишь если агент перечитал именно этот кусок
//  контекста перед действием. Здесь — проверяемый гейт в самом инструменте:
//  .claude/agents/git-scribe.md и .claude/skills/dbc-workflow/SKILL.md,
//  раздел «Git и трекер», используют ЭТОТ скрипт вместо голого `git merge
//  origin/main` на шаге «подтянуть origin/main» общей рабочей копии.
//
//  Порядок после сторожа воспроизводит уже описанный в dbc-workflow: сперва
//  `--ff-only`, не перемотало — сухая проверка конфликтов через
//  `git merge-tree`, конфликтов нет — обычный `git merge origin/main`,
//  конфликты есть — стоп, показать файлы (не разруливать молча/наугад).
// ════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { uncommittedRepoPaths } from "./git-status.mjs";
import { ROOT } from "./packs.mjs";

const FORCE = process.argv.includes("--force");

/** Есть ли в выводе `git merge-tree` реальные конфликтные маркеры. */
export function mergeTreeHasConflicts(output) {
  return /^<{7}/m.test(output || "");
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function main() {
  const dirty = uncommittedRepoPaths();
  if (dirty.length && !FORCE) {
    console.error(`В рабочей копии есть незакоммиченные правки — merge/checkout origin/main может тихо стереть чужую (или свою же ещё не сохранённую) работу:`);
    for (const path of dirty) console.error(`  ${path}`);
    console.error("");
    console.error("Сохраните их первым делом: git add -- <файлы> && git commit");
    console.error("Если точно уверены, что это только ваша WIP и её можно временно накрыть мерджем — git stash, либо повторите с --force.");
    return 1;
  }

  git(["fetch", "origin"]);

  try {
    git(["merge", "--ff-only", "origin/main"]);
    console.log("origin/main подтянут перемоткой (--ff-only).");
    return 0;
  } catch {
    // Не перемоталось — обычное дело (в локальной main есть свои
    // неотправленные коммиты), не расхождение. Дальше — сухая проверка.
  }

  const base = git(["merge-base", "main", "origin/main"]).trim();
  const dryRun = (() => {
    try {
      return git(["merge-tree", base, "main", "origin/main"]);
    } catch (err) {
      return err.stdout ? String(err.stdout) : "";
    }
  })();

  if (mergeTreeHasConflicts(dryRun)) {
    console.error("Конфликт при мердже origin/main — разбирать руками, не молча:");
    console.error(dryRun);
    return 1;
  }

  git(["merge", "origin/main"]);
  console.log("origin/main влит обычным merge (конфликтов не было).");
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/merge-main.mjs"))
  process.exit(main());
