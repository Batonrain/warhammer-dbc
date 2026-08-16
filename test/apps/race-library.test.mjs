// test/apps/race-library.test.mjs
//
// Библиотека рас: чтение пака с откатом на константы. Пока пак не прочитан
// (мир ещё грузится, тесты вне Foundry), система обязана работать по-старому —
// иначе Мастер создания и шапка листа опустеют на пустом месте.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES, SUBRACES, AELDARI_RACES } from "../../module/constants/races.mjs";
import { raceEntries, raceDef, subracesOf, isAeldariRace, raceGroupList, raceKeyOf }
  from "../../module/apps/race-library.mjs";

describe("библиотека рас", () => {

  it("без прочитанного пака отдаёт константы", () => {
    expect(Object.keys(raceEntries()).sort()).toEqual(Object.keys(RACES).sort());
    expect(raceDef("astartes").chars).toEqual(RACES.astartes.chars);
  });

  it("субрасы отбираются по родителю", () => {
    const keys = subracesOf("drukhari").map(s => s.key).sort();

    expect(keys).toEqual([...RACES.drukhari.subraces].sort());
    expect(subracesOf("astartes")).toEqual([]);
  });

  it("метка субрасы берётся из библиотеки", () => {
    expect(subracesOf("drukhari").find(s => s.key === "mandrake").label)
      .toBe(SUBRACES.mandrake);
  });

  // Группа «Аэльдари» посимвольно совпадала с прежней константой — на этом
  // держится замена AELDARI_RACES полем group. Тест сторожит совпадение.
  it("признак аэльдари даёт ровно прежний набор рас", () => {
    const now = Object.keys(raceEntries()).filter(isAeldariRace).sort();

    expect(now).toEqual([...AELDARI_RACES].sort());
  });

  it("группы сохраняют порядок для optgroup", () => {
    expect(raceGroupList().map(g => g.label))
      .toEqual(["Люди", "Отродия", "Аэльдари", "Другие Ксеносы"]);
  });
});

// Находка C1 общего ревью (wdbc-n1k): дроп расы на лист брал ключ отдельно
// (`system.key || ""`) и падал в пустую строку, если ГМ забыл заполнить
// поле — а пустой ключ на пути применения означает «снять расу». Кэш выше
// индексирует ту же запись под doc.id, поэтому раса без заполненного ключа
// работала через пикер и стирала персонажа через дроп. raceKeyOf — единое
// правило для обоих путей.
describe("raceKeyOf — единое правило ключа для кэша и для дропа/хука", () => {
  it("берёт system.key, если он заполнен", () => {
    expect(raceKeyOf({ system: { key: "astartes" }, id: "abc123" })).toBe("astartes");
  });

  it("падает на id документа, если system.key пуст — как кэш выше", () => {
    expect(raceKeyOf({ system: { key: "" }, id: "abc123" })).toBe("abc123");
  });

  it("без документа вовсе отдаёт пустую строку, а не бросает исключение", () => {
    expect(raceKeyOf(null)).toBe("");
    expect(raceKeyOf(undefined)).toBe("");
  });
});

// Пак читается один раз на «ready» и заменяет собой откат на константы. Если
// чтение вернуло расы, но НИ ОДНОЙ субрасы (частично прочитанный пак, пак,
// пересобранный под живым сервером, миграция, сменившая тип документа), пустая
// половина кэша всё равно вставала на место рабочего отката — и субрасы
// пропадали разом у ВСЕХ рас. Половина кэша, в которой ничего не нашлось, — это
// не «субрас нет», а «прочитать не удалось»: откат должен уцелеть.
describe("неполный пак не затирает откат на константы", () => {
  const raceDoc = (key, label) => ({
    type: "race", name: label, id: key, uuid: `Compendium.warhammer-dbc.races.Item.${key}`,
    system: { key, group: "Люди", chars: {}, pastRaces: [] }
  });

  function withPack(docs, fn) {
    const prev = globalThis.game;
    globalThis.game = { ...(prev || {}), packs: { get: () => ({ getDocuments: async () => docs }) } };
    return Promise.resolve(fn()).finally(() => { globalThis.game = prev; });
  }

  it("пак без субрас оставляет субрасы констант", async () => {
    await withPack([raceDoc("drukhari", "Друкхари")], async () => {
      const { refreshRaceCache, subracesOf: sub } = await import("../../module/apps/race-library.mjs");
      await refreshRaceCache();

      expect(sub("drukhari").map(s => s.key).sort()).toEqual([...RACES.drukhari.subraces].sort());
    });
  });
});
