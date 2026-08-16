// test/apps/race-library.test.mjs
//
// Библиотека рас: чтение пака с откатом на константы. Пока пак не прочитан
// (мир ещё грузится, тесты вне Foundry), система обязана работать по-старому —
// иначе Мастер создания и шапка листа опустеют на пустом месте.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES, SUBRACES, AELDARI_RACES } from "../../module/constants/races.mjs";
import { raceEntries, raceDef, subracesOf, isAeldariRace, raceGroupList }
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
