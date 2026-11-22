// tools/pr-queue-check.mjs
// ════════════════════════════════════════════════════════════════════════
//  СТОРОЖ «ПРОВЕРКИ И РАЗБОР ИЗ ОПИСАНИЙ PR» (шаг «Конца сессии», 19.11.2026).
//
//  Облачные сессии не видят bd и Sahara, поэтому всё, что надо проверить
//  живьём или разобрать позже, пишут блоками в описание PR:
//    ## Проверить в Foundry (очередь testing)
//    ## Разобрать (не автоматизировано…)
//  Эти блоки должна перенести в bd (метки testing / razobrat,
//  --external-ref gh-<N>) и в Sahara («[Проверить #N] …» / «[Разобрать #N] …»)
//  первая же сессия на машине владельца. 19.11.2026 так остались висеть
//  блоки пяти PR (#571–575), пока владелец не заметил сам.
//
//  Скрипт только находит долг, сам ничего не заводит: Sahara пишется лишь
//  через MCP (createTask), а нарезку пунктов на задачи лучше делает сессия.
//
//    node tools/pr-queue-check.mjs          # открытые PR + влитые за 14 дней
//    node tools/pr-queue-check.mjs --json   # для скриптов
//
//  Код выхода 1 — есть PR, где пунктов в блоках больше, чем задач в bd.
// ════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const HEADS = [
  { kind: "testing", re: /^#{1,4}\s*Проверить в Foundry/i },
  { kind: "razobrat", re: /^#{1,4}\s*Разобрать/i },
];

/**
 * Пункты блоков «Проверить в Foundry» и «Разобрать» в описании PR.
 * Пункт — строка списка верхнего уровня («- », «* », «1. », «- [ ] »);
 * вложенные строки относятся к предыдущему пункту. Блок кончается на
 * следующем заголовке, «Для игры» или «---».
 * @returns {{testing: string[], razobrat: string[]}}
 */
export function parseQueueBlocks(body = "") {
  const out = { testing: [], razobrat: [] };
  let kind = null;
  for (const raw of String(body).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (/^#{1,6}\s/.test(line)) {
      kind = HEADS.find((h) => h.re.test(line))?.kind ?? null;
      continue;
    }
    if (!kind) continue;
    if (/^(\*\*)?Для игры/i.test(line) || /^---+$/.test(line)) { kind = null; continue; }
    const m = line.match(/^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (m) out[kind].push(m[1].trim());
    else if (/^\s+\S/.test(line) && out[kind].length) out[kind][out[kind].length - 1] += " " + line.trim();
  }
  return out;
}

/** Сравнение пунктов PR с задачами bd по gh-<N>. */
export function queueDebt(prs, bdIssues) {
  const rows = [];
  for (const pr of prs) {
    const blocks = parseQueueBlocks(pr.body);
    const ref = `gh-${pr.number}`;
    // Своей задачей PR считается та, что помечена gh-<N> или ссылается на PR
    // в тексте (#N, pull/N) — старые сессии заводили и так.
    const mention = new RegExp(`(?:#|pull/|gh-)${pr.number}(?!\\d)`);
    const mine = bdIssues.filter((i) => i.external_ref === ref || mention.test(`${i.title} ${i.description ?? ""}`));
    // Пункт, где уже назван id bd (wdbc-xxxx), заведён раньше.
    for (const k of ["testing", "razobrat"]) blocks[k] = blocks[k].filter((t) => !/\bwdbc-[a-z0-9]{3,}/.test(t));
    const have = {
      testing: mine.filter((i) => i.labels?.includes("testing")).length,
      razobrat: mine.filter((i) => i.labels?.includes("razobrat")).length,
    };
    const need = { testing: blocks.testing.length, razobrat: blocks.razobrat.length };
    if (!need.testing && !need.razobrat) continue;
    // Пункт можно законно склеить или разбить, поэтому долг — только когда
    // по метке задач нет совсем, а в PR пункты есть.
    const missing = ["testing", "razobrat"].filter((k) => need[k] > 0 && have[k] === 0);
    rows.push({ number: pr.number, title: pr.title, state: pr.state, need, have, missing, items: blocks });
  }
  return rows;
}

function sh(cmd, args) {
  // На Windows bd и gh могут быть .cmd-обёртками npm — их находит только
  // оболочка. Аргументы здесь простые, без пробелов и кавычек.
  return execFileSync(cmd, args, {
    encoding: "utf8", maxBuffer: 64 << 20, shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function main() {
  const json = process.argv.includes("--json");
  const fields = "number,title,body,state,mergedAt";
  const open = JSON.parse(sh("gh", ["pr", "list", "--state", "open", "--limit", "100", "--json", fields]));
  const since = Date.now() - 14 * 864e5;
  const merged = JSON.parse(sh("gh", ["pr", "list", "--state", "merged", "--limit", "60", "--json", fields]))
    .filter((p) => Date.parse(p.mergedAt) >= since);
  const bd = JSON.parse(sh("bd", ["list", "--all", "--limit", "0", "--json"]));
  const rows = queueDebt([...open, ...merged], bd);
  const debt = rows.filter((r) => r.missing.length);
  if (json) {
    console.log(JSON.stringify(rows, null, 1));
  } else if (!debt.length) {
    console.log(`Долга нет: блоки «Проверить/Разобрать» в ${rows.length} PR уже в bd.`);
  } else {
    for (const r of debt) {
      console.log(`#${r.number} [${r.state}] ${r.title}`);
      for (const k of r.missing) {
        console.log(`  нет в bd (${k}, gh-${r.number}): ${r.need[k]} пункт(ов)`);
        for (const it of r.items[k]) console.log(`    • ${it.slice(0, 140)}`);
      }
    }
    console.log("\nПеренести: bd create --type=task --label=<testing|razobrat> --external-ref=gh-<N>, плюс задача Sahara «[Проверить #N] …» / «[Разобрать #N] …».");
  }
  process.exitCode = debt.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
