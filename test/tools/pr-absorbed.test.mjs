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

import { describe, it, expect } from "vitest";
import { absorptionVerdict, isNoiseOnly } from "../../tools/pr-absorbed.mjs";

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
