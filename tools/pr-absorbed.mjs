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
 * @param {Array<{sha:string, subject?:string, patchId:string|null, patchIdError?:string|null, files:string[], merge?:boolean}>} branchCommits
 *        коммиты, которые есть в ветке и которых нет в базе (origin/main)
 * @param {Iterable<string>} minePatchIds patch-id коммитов, созданных ЭТОЙ сессией
 * @returns {{absorbed:boolean, reason:string, foreign:Array, own:Array, noise:Array, unchecked:Array}}
 */
export function absorptionVerdict(branchCommits, minePatchIds) {
  const mine = new Set(minePatchIds || []);
  const noise = [], own = [], foreign = [], unchecked = [];

  for (const c of branchCommits || []) {
    // Слияние diff'ом не описывается, patch-id у него нет — своим его
    // объявить нечем, значит чужой. Осторожность здесь дешевле ошибки:
    // цена ложного «чужой» — лишний открытый PR, цена ложного «свой» —
    // закрытый PR и удалённая ветка соседа.
    if (c.merge)                    { foreign.push(c); continue; }
    if (isNoiseOnly(c.files))       { noise.push(c);   continue; }
    // patch-id посчитать не удалось (упавший git, переполненный буфер на
    // книжном диффе — wdbc-s1m6). Это не «свой» и не «чужой», это «не знаю»,
    // и «не знаю» обязано блокировать: иначе технический сбой закроет чужой
    // PR. Отдельный ящик нужен, чтобы в отчёте это не выглядело как «сосед
    // накоммитил» — причина совсем другая.
    if (c.patchIdError)             { unchecked.push(c); continue; }
    if (c.patchId && mine.has(c.patchId)) own.push(c);
    else                            foreign.push(c);
  }

  if (foreign.length) return {
    absorbed: false, reason: "в ветке есть коммиты, которых ты не делала/делал", foreign, own, noise, unchecked };
  if (unchecked.length) return {
    absorbed: false, reason: "у части коммитов patch-id не посчитался — сверять нечем", foreign, own, noise, unchecked };
  if (!own.length) return {
    absorbed: false, reason: "в ветке нет ни одного твоего коммита — поглощать нечего", foreign, own, noise, unchecked };
  return { absorbed: true, reason: "вся работа ветки — твоя", foreign, own, noise, unchecked };
}

// ── Тонкий слой поверх git ────────────────────────────────────────────────

/**
 * Сколько вывода git разрешено принять. Node по умолчанию даёт 1 МБ, а дифф
 * ОДНОГО коммита в книгу (`packs-src/books/core.json` — десятки тысяч строк)
 * идёт десятками мегабайт: самый большой в истории этого репозитория — 52 МБ.
 * На таком `git diff-tree` падал с ENOBUFS, и инструмент КРАШИЛСЯ вместо
 * ответа 0/1 — то есть шаг 11 git-цикла по книжным PR не проверялся вообще
 * (wdbc-s1m6: 08.09.2026 так «промолчали» #407, #418, #420, раньше #411).
 */
const MAX_BUFFER = 512 * 1024 * 1024;

// stdio целиком в трубу: иначе git печатает свои ошибки мимо вывода
// инструмента, и в отчёт шага 11 попадает `fatal: ...` без объяснения, чей он.
// Сказать про сбой — дело patchIdOf, она это делает словами.
const gitIn = (cwd, args, extra = {}) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER, stdio: ["pipe", "pipe", "pipe"], ...extra });
const git = (...args) => gitIn(ROOT, args);

/**
 * patch-id коммита. У слияний и пустых коммитов его нет — `patchId: null` без
 * ошибки. Если посчитать НЕ УДАЛОСЬ, ошибка возвращается словами, а не
 * выбрасывается: молчание инструмента шаг 11 читает как «проверить не смогла»,
 * и PR обязан остаться открытым — но сказать об этом должен сам инструмент.
 *
 * @param {string} sha
 * @param {string} [cwd] репозиторий (по умолчанию свой; параметр — для тестов)
 * @returns {{patchId: string|null, error: string|null}}
 */
export function patchIdOf(sha, cwd = ROOT) {
  try {
    // Дифф забираем буфером, без перекодировки в utf8: patch-id считается по
    // байтам, а перекодировка десятков мегабайт — только трата времени.
    const diff = gitIn(cwd, ["diff-tree", "-p", "--no-commit-id", sha], { encoding: "buffer" });
    if (!diff.length) return { patchId: null, error: null };
    const out = gitIn(cwd, ["patch-id", "--stable"], { input: diff });
    const patchId = out.trim().split(/\s+/)[0] || null;
    return { patchId, error: patchId ? null : "git patch-id не вернул хэш" };
  } catch (e) {
    const said = String(e.stderr || "").split("\n").find(l => l.trim()) || String(e.message).split("\n")[0];
    return { patchId: null, error: `${e.code || "ошибка"}: ${said.trim()}` };
  }
}

/** Коммиты ветки, которых нет в базе, — со списком файлов и patch-id. */
export function branchCommits(branch, base = "origin/main") {
  return git("rev-list", `${base}..${branch}`).split("\n").filter(Boolean).map(sha => {
    const parents = git("rev-list", "--parents", "-n", "1", sha).trim().split(/\s+/).length - 1;
    const subject = git("log", "-1", "--format=%s", sha).trim();
    const files = git("show", "--pretty=format:", "--name-only", sha).split("\n").filter(Boolean);
    const merge = parents > 1;
    const { patchId, error } = merge ? { patchId: null, error: null } : patchIdOf(sha);
    return { sha, subject, files, merge, patchId, patchIdError: error };
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
  const mineIds = [];
  for (const sha of opts.mine) {
    const { patchId, error } = patchIdOf(sha);
    if (patchId) mineIds.push(patchId);
    else console.error(`  patch-id своего коммита ${sha} не посчитан — ${error || "у коммита нет диффа (слияние?)"}`);
  }
  // Без своих patch-id сверять не с чем, и «своя работа» опознана не будет:
  // отвечаем «нельзя» прямо, а не через ложное «в ветке всё чужое».
  if (!mineIds.length) {
    console.error(`\nЗАКРЫВАТЬ НЕЛЬЗЯ: ни один свой patch-id не посчитан — сверять нечем. Оставь PR и ветку как есть.`);
    return 1;
  }

  const commits = branchCommits(opts.branch, opts.base);
  const v = absorptionVerdict(commits, mineIds);

  console.log(`Ветка ${opts.branch}: ${commits.length} коммит(ов) сверх ${opts.base}.`);
  for (const c of v.own)     console.log(`  свой    ${c.sha.slice(0, 8)} ${c.subject}`);
  for (const c of v.noise)   console.log(`  шум     ${c.sha.slice(0, 8)} ${c.subject}`);
  for (const c of v.foreign) console.log(`  ЧУЖОЙ   ${c.sha.slice(0, 8)} ${c.subject}`);
  for (const c of v.unchecked) console.log(`  НЕ ЗНАЮ ${c.sha.slice(0, 8)} ${c.subject} — patch-id не посчитан: ${c.patchIdError}`);
  console.log(v.absorbed
    ? `\nМожно закрыть как поглощённый: ${v.reason}.`
    : `\nЗАКРЫВАТЬ НЕЛЬЗЯ: ${v.reason}. Оставь PR и ветку как есть.`);
  return v.absorbed ? 0 : 1;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/pr-absorbed.mjs"))
  process.exit(main(process.argv.slice(2)));
