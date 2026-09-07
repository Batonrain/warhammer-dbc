// tools/pr-absorbed.mjs
// ════════════════════════════════════════════════════════════════════════
//  СТОРОЖ ШАГА «ПОГЛОЩЕНИЕ» (wdbc-34v7): можно ли закрывать чужой PR.
//
//  Шаг 11 git-цикла (`.claude/agents/git-scribe.md`) закрывает открытый PR,
//  когда его коммиты целиком вошли в новый. Проверка «предок ли старая ветка
//  новой» (`git merge-base --is-ancestor`) для этого не годится: все сессии
//  коммитят в ОБЩУЮ локальную `main`, ветка есть ссылка на коммит, а не на
//  диапазон — и любая новая ветка физически несёт всех предков, то есть и
//  чужую работу. Ответ «да, предок» приходил всегда, когда сессий больше
//  одной. 06.09.2026 это дважды за час закрыло чужие PR и удалило их ветки
//  на remote (#382, #383).
//
//  Здесь другой вопрос: «ВСЯ ли работа в этой ветке — МОЯ?». Свои коммиты
//  сессия знает — она их только что создала. Сверка идёт по patch-id, а не по
//  SHA: тот же дифф после cherry-pick на `origin/main` получает другой хэш,
//  но тот же patch-id, и такой коммит по-прежнему опознаётся как свой.
//
//  Разбор вынесен в чистую absorptionVerdict — правило проверяется без
//  настоящего репозитория (test/tools/pr-absorbed.test.mjs), как parseDirtyPaths
//  в tools/git-status.mjs.
// ════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { ROOT } from "./packs.mjs";

/**
 * Пути, правка которых сама по себе не считается работой: экспорт трекера
 * задач меняется у каждой сессии и уже давал ложные расхождения там, где код
 * был байт-в-байт одинаков (wdbc-ybob, wdbc-ym75). Коммит, который трогает
 * ТОЛЬКО их, не делает ветку чужой — но и своей не делает.
 */
export const NOISE_PREFIXES = [".beads/"];

/** Коммит, в котором нет ничего, кроме шума трекера. */
export function isNoiseOnly(files) {
  return Array.isArray(files) && files.length > 0
    && files.every(f => NOISE_PREFIXES.some(p => f.startsWith(p)));
}

/**
 * Можно ли закрыть ветку как поглощённую.
 *
 * @param {Array<{sha:string, subject?:string, patchId:string|null, files:string[], merge?:boolean}>} branchCommits
 *        коммиты, которые есть в ветке и которых нет в базе (origin/main)
 * @param {Iterable<string>} minePatchIds patch-id коммитов, созданных ЭТОЙ сессией
 * @returns {{absorbed:boolean, reason:string, foreign:Array, own:Array, noise:Array}}
 */
export function absorptionVerdict(branchCommits, minePatchIds) {
  const mine = new Set(minePatchIds || []);
  const noise = [], own = [], foreign = [];

  for (const c of branchCommits || []) {
    // Слияние diff'ом не описывается, patch-id у него нет — своим его
    // объявить нечем, значит чужой. Осторожность здесь дешевле ошибки:
    // цена ложного «чужой» — лишний открытый PR, цена ложного «свой» —
    // закрытый PR и удалённая ветка соседа.
    if (c.merge)                    { foreign.push(c); continue; }
    if (isNoiseOnly(c.files))       { noise.push(c);   continue; }
    if (c.patchId && mine.has(c.patchId)) own.push(c);
    else                            foreign.push(c);
  }

  if (foreign.length) return {
    absorbed: false, reason: "в ветке есть коммиты, которых ты не делала/делал", foreign, own, noise };
  if (!own.length) return {
    absorbed: false, reason: "в ветке нет ни одного твоего коммита — поглощать нечего", foreign, own, noise };
  return { absorbed: true, reason: "вся работа ветки — твоя", foreign, own, noise };
}

// ── Тонкий слой поверх git ────────────────────────────────────────────────

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

/** patch-id коммита; у слияний его нет — null. */
export function patchIdOf(sha) {
  const diff = git("diff-tree", "-p", "--no-commit-id", sha);
  if (!diff.trim()) return null;
  const out = execFileSync("git", ["patch-id", "--stable"], { cwd: ROOT, encoding: "utf8", input: diff });
  return out.trim().split(/\s+/)[0] || null;
}

/** Коммиты ветки, которых нет в базе, — со списком файлов и patch-id. */
export function branchCommits(branch, base = "origin/main") {
  return git("rev-list", `${base}..${branch}`).split("\n").filter(Boolean).map(sha => {
    const parents = git("rev-list", "--parents", "-n", "1", sha).trim().split(/\s+/).length - 1;
    const subject = git("log", "-1", "--format=%s", sha).trim();
    const files = git("show", "--pretty=format:", "--name-only", sha).split("\n").filter(Boolean);
    return { sha, subject, files, merge: parents > 1, patchId: parents > 1 ? null : patchIdOf(sha) };
  });
}

// ── Запуск из командной строки ────────────────────────────────────────────
//   node tools/pr-absorbed.mjs --branch origin/pr/тема --mine <sha> [--mine <sha>…]
//                              [--base origin/main]
//   Выход 0 — ветку можно закрыть как поглощённую.
//   Выход 1 — НЕЛЬЗЯ (есть чужая работа либо своей нет).
//   Выход 2 — ошибка вызова.

function main(argv) {
  const opts = { mine: [], base: "origin/main", branch: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === "--branch") { opts.branch = v; i++; }
    else if (argv[i] === "--base") { opts.base = v; i++; }
    else if (argv[i] === "--mine") { opts.mine.push(...String(v || "").split(",").filter(Boolean)); i++; }
  }
  if (!opts.branch || !opts.mine.length) {
    console.error("Использование: node tools/pr-absorbed.mjs --branch <ветка> --mine <sha>[,<sha>…] [--base origin/main]");
    console.error("  --mine — SHA коммитов, которые создала ЭТА сессия (шаг 1 git-цикла).");
    return 2;
  }
  const mineIds = opts.mine.map(patchIdOf).filter(Boolean);
  const commits = branchCommits(opts.branch, opts.base);
  const v = absorptionVerdict(commits, mineIds);

  console.log(`Ветка ${opts.branch}: ${commits.length} коммит(ов) сверх ${opts.base}.`);
  for (const c of v.own)     console.log(`  свой   ${c.sha.slice(0, 8)} ${c.subject}`);
  for (const c of v.noise)   console.log(`  шум    ${c.sha.slice(0, 8)} ${c.subject}`);
  for (const c of v.foreign) console.log(`  ЧУЖОЙ  ${c.sha.slice(0, 8)} ${c.subject}`);
  console.log(v.absorbed
    ? `\nМожно закрыть как поглощённый: ${v.reason}.`
    : `\nЗАКРЫВАТЬ НЕЛЬЗЯ: ${v.reason}. Оставь PR и ветку как есть.`);
  return v.absorbed ? 0 : 1;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/pr-absorbed.mjs"))
  process.exit(main(process.argv.slice(2)));
