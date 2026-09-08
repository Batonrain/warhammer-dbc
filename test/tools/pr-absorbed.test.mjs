// test/tools/pr-absorbed.test.mjs
//
// СТОРОЖ ШАГА «ПОГЛОЩЕНИЕ» (wdbc-34v7).
//
// 06.09.2026 дважды за час git-цикл закрыл ЧУЖИЕ пул-реквесты и удалил их
// ветки на remote. Причина не в спешке исполнителя, а в самой проверке: все
// сессии коммитят в общую локальную `main`, ветка есть ссылка на коммит, и
// «предок ли старая ветка новой» отвечает «да» всегда, когда сессий больше
// одной. Словесное предупреждение такое не удержит — правило должно уметь
// сказать «нельзя» само, поэтому оно вынесено в tools/pr-absorbed.mjs и
// закреплено здесь.
//
// Проверяется чистый разбор: настоящий репозиторий с параллельными сессиями
// в тесте не воспроизвести, а вопрос всё равно один — «вся ли работа в ветке
// моя».

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { absorptionVerdict, isNoiseOnly, patchIdOf } from "../../tools/pr-absorbed.mjs";

/** Коммит ветки: свой узнаётся по patch-id, не по SHA. */
const commit = (sha, patchId, files = ["module/x.mjs"], extra = {}) =>
  ({ sha, patchId, subject: `коммит ${sha}`, files, ...extra });

describe("можно ли закрыть чужой PR как поглощённый", () => {
  it("вся ветка — мои коммиты: да, закрывать можно", () => {
    const v = absorptionVerdict([commit("a", "p1"), commit("b", "p2")], ["p1", "p2", "p3"]);
    expect(v.absorbed).toBe(true);
    expect(v.foreign).toEqual([]);
  });

  it("ГЛАВНОЕ: есть хоть один чужой коммит — НЕЛЬЗЯ, даже если мои тоже есть", () => {
    // Ровно случай 06.09.2026: моя ветка-указатель на общей `main` физически
    // несёт и чужую тему. Ancestor-проверка на этом отвечала «поглощён».
    const v = absorptionVerdict([commit("a", "p1"), commit("чужой", "px")], ["p1"]);
    expect(v.absorbed).toBe(false);
    expect(v.foreign.map(c => c.sha)).toEqual(["чужой"]);
  });

  it("ветка целиком чужая — нельзя, и сказано именно про чужие коммиты", () => {
    const v = absorptionVerdict([commit("чужой", "px")], ["p1"]);
    expect(v.absorbed).toBe(false);
    expect(v.reason).toContain("которых ты не делала");
  });

  it("пустая ветка — нельзя (нечего поглощать), а не «да, всё моё»", () => {
    expect(absorptionVerdict([], ["p1"]).absorbed).toBe(false);
  });

  it("тот же дифф после cherry-pick на origin/main опознаётся своим", () => {
    // Ветка теперь ответвляется от origin/main и набирается cherry-pick'ом
    // (шаг 7 git-цикла) — SHA у коммита другой, patch-id прежний. Сверка по
    // SHA сделала бы собственную работу «чужой» и запирала бы шаг навсегда.
    const v = absorptionVerdict([commit("новый-sha", "p1")], ["p1"]);
    expect(v.absorbed).toBe(true);
  });

  it("слияние своим объявить нечем — считается чужим", () => {
    const v = absorptionVerdict(
      [commit("a", "p1"), commit("m", null, ["module/x.mjs"], { merge: true })], ["p1"]);
    expect(v.absorbed).toBe(false);
  });
});

describe("шум трекера не делает ветку ни своей, ни чужой", () => {
  it("коммит только из .beads/ — шум", () => {
    expect(isNoiseOnly([".beads/issues.jsonl"])).toBe(true);
    expect(isNoiseOnly([".beads/issues.jsonl", ".beads/interactions.jsonl"])).toBe(true);
  });

  it("код рядом с .beads/ шумом уже не считается", () => {
    expect(isNoiseOnly([".beads/issues.jsonl", "module/x.mjs"])).toBe(false);
    expect(isNoiseOnly([])).toBe(false);
  });

  it("чужой коммит-шум не мешает закрыть ветку, где остальное — моё", () => {
    // wdbc-ybob: экспорт трекера у каждой сессии свой и уже давал ложные
    // расхождения там, где код был байт-в-байт одинаков.
    const v = absorptionVerdict(
      [commit("a", "p1"), commit("шум", "pz", [".beads/issues.jsonl"])], ["p1"]);
    expect(v.absorbed).toBe(true);
    expect(v.noise.map(c => c.sha)).toEqual(["шум"]);
  });

  it("ветка из ОДНОГО шумового коммита не закрывается — своей работы в ней нет", () => {
    const v = absorptionVerdict([commit("шум", "pz", [".beads/issues.jsonl"])], ["p1"]);
    expect(v.absorbed).toBe(false);
    expect(v.reason).toContain("нет ни одного твоего");
  });
});

describe("несосчитанный patch-id (wdbc-s1m6)", () => {
  it("коммит без patch-id блокирует закрытие, даже если остальное — моё", () => {
    const v = absorptionVerdict(
      [commit("a", "p1"), commit("книга", null, ["packs-src/books/core.json"], { patchIdError: "ENOBUFS" })],
      ["p1"]);
    expect(v.absorbed).toBe(false);
  });

  it("это «не знаю», а не «чужой» — иначе в отчёте видно чужую работу, которой нет", () => {
    // Так и выглядел сбой 08.09.2026: инструмент падал на книжном диффе.
    // Собственная поломка не должна читаться как «сосед накоммитил в ветку».
    const v = absorptionVerdict(
      [commit("книга", null, ["packs-src/books/core.json"], { patchIdError: "ENOBUFS" })], ["p1"]);
    expect(v.foreign).toEqual([]);
    expect(v.unchecked.map(c => c.sha)).toEqual(["книга"]);
    expect(v.reason).toContain("patch-id не посчитался");
  });
});

describe("patch-id считается по-настоящему", () => {
  let dir = null;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  /**
   * Репозиторий, в котором ВТОРОЙ коммит добавляет файл на `mb` мегабайт.
   * Второй, а не первый: у корневого коммита `git diff-tree` без `--root`
   * молчит, и дифф вышел бы пустым вместо большого.
   * @returns {[string, string]} папка и SHA большого коммита
   */
  const repoWithBigCommit = mb => {
    dir = mkdtempSync(join(tmpdir(), "wdbc-absorbed-"));
    const gitq = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    gitq("init", "-q");
    gitq("config", "user.email", "test@example.com");
    gitq("config", "user.name", "test");
    writeFileSync(join(dir, "README.md"), "начало\n");
    gitq("add", "-A");
    gitq("commit", "-qm", "начало");
    // Строки разные: одинаковые git сжал бы, и до буфера дифф бы не дорос.
    const lines = [];
    for (let i = 0; lines.length * 40 < mb * 1024 * 1024; i++) lines.push(`  "строка-${i}": "значение ${i} ${"я".repeat(20)}",`);
    writeFileSync(join(dir, "book.json"), lines.join("\n"));
    gitq("add", "-A");
    gitq("commit", "-qm", "книга");
    return [dir, gitq("rev-parse", "HEAD").trim()];
  };

  it("дифф больше буфера по умолчанию (1 МБ) считается, а не падает с ENOBUFS", () => {
    // Ровно поломка wdbc-s1m6: на книжных PR (#407, #418, #420) инструмент
    // крашился и не отвечал ни 0, ни 1 — то есть шаг 11 их не проверял вообще.
    const [cwd, sha] = repoWithBigCommit(3);
    const { patchId, error } = patchIdOf(sha, cwd);
    expect(error).toBe(null);
    expect(patchId).toMatch(/^[0-9a-f]{40}$/);
  });

  it("несуществующий коммит — ошибка словами, без падения процесса", () => {
    const [cwd] = repoWithBigCommit(0.01);
    const { patchId, error } = patchIdOf("такогокоммитанет", cwd);
    expect(patchId).toBe(null);
    expect(error).toBeTruthy();
  });
});
