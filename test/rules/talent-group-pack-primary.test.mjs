// test/rules/talent-group-pack-primary.test.mjs
//
// talentGroupOf/altTalentCandidates (module/rules/duplicate-grants.mjs) —
// wdbc-91b. Раньше группу/ступень Таланта для «Альтернативный Талант при
// дубле» брали ТОЛЬКО из статической TALENT_LIBRARY (611 записей), а реальный
// компендиум warhammer-dbc.talents (packs-src/talents/) несёт 967 — треть
// книги никогда не могла стать кандидатом на замену. Теперь СНАЧАЛА строится
// кэш из обоих паков Талантов (TALENT_LIB_PACKS) через refreshTalentGroupIndex
// (тот же приём, что talentGodKeyOf в constants/patronage.mjs — синхронный
// кэш, обновляемый асинхронно), и только для того, чего в паке ещё нет,
// остаётся запасной путь из константы. По той же схеме, что
// test/rules/talent-library-entry-pack-primary.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  talentGroupOf, altTalentCandidates, refreshTalentGroupIndex
} from "../../module/rules/duplicate-grants.mjs";

/** Пак-заглушка: getIndex отдаёт индекс, folders.get(id) — имя папки по id. */
function fakePack(index, folderNames) {
  return {
    getIndex: async () => index,
    folders: { get: id => (id in folderNames) ? { name: folderNames[id] } : undefined }
  };
}

beforeEach(() => {
  globalThis.game.packs = undefined;
});

describe("talentGroupOf/altTalentCandidates — без собранного пака", () => {
  it("нет game.packs вовсе — запасной путь из TALENT_LIBRARY", async () => {
    await refreshTalentGroupIndex();
    expect(talentGroupOf("Combat Formation / Боевое Построение")).toEqual({ folder: "Общие", tier: 1 });
    expect(talentGroupOf("Такого таланта нет")).toBeNull();
  });

  it("пустой game.packs (ни один пак не найден) — тот же запасной путь", async () => {
    globalThis.game.packs = new Map();
    await refreshTalentGroupIndex();
    expect(talentGroupOf("Combat Formation / Боевое Построение")).toEqual({ folder: "Общие", tier: 1 });
  });
});

describe("talentGroupOf/altTalentCandidates — пак собран", () => {
  it("Талант новой книги, которого нет в TALENT_LIBRARY, получает Группу из пака", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack(
      [
        { _id: "d1", name: "Дредноутный Талант A", folder: "fD", system: { tier: 2 } },
        { _id: "d2", name: "Дредноутный Талант B", folder: "fD", system: { tier: 2 } }
      ],
      { fD: "Дредноуты" }
    )]]);
    await refreshTalentGroupIndex();

    expect(talentGroupOf("Дредноутный Талант A")).toEqual({ folder: "Дредноуты", tier: 2 });

    // Кандидат — второй Талант той же папки/ступени из пака, которого в
    // TALENT_LIBRARY не было и быть не могло (611/967, wdbc-91b). Сам
    // дублирующий Талант исключается через ownedNames — персонаж, у которого
    // обнаружен дубль, им уже владеет (как и в вызывающем коде mechanics.mjs).
    const cands = altTalentCandidates("Дредноутный Талант A", ["Дредноутный Талант A"]);
    expect(cands.map(c => c.name)).toContain("Дредноутный Талант B");
    expect(cands.map(c => c.name)).not.toContain("Дредноутный Талант A");
  });

  it("Талант из TALENT_LIBRARY, которого пак ещё не содержит, — остаётся на запасном пути", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack(
      [{ _id: "d1", name: "Дредноутный Талант A", folder: "fD", system: { tier: 2 } }],
      { fD: "Дредноуты" }
    )]]);
    await refreshTalentGroupIndex();

    // Combat Formation не встречается в этом фейковом индексе пака — берётся
    // из TALENT_LIBRARY, как и раньше.
    expect(talentGroupOf("Combat Formation / Боевое Построение")).toEqual({ folder: "Общие", tier: 1 });
  });

  it("запись пака без резолвящейся папки — пропускается, группа неизвестна (как раньше у Талантов без записи)", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack(
      [{ _id: "d1", name: "Талант без папки", folder: "нет-такой-id", system: { tier: 1 } }],
      {}
    )]]);
    await refreshTalentGroupIndex();

    expect(talentGroupOf("Талант без папки")).toBeNull();
  });

  it("пак упал (getIndex бросает) — тихий откат на константу для уже известных Талантов", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents",
      { getIndex: async () => { throw new Error("недоступен"); }, folders: { get: () => undefined } }]]);
    await refreshTalentGroupIndex();

    expect(talentGroupOf("Combat Formation / Боевое Построение")).toEqual({ folder: "Общие", tier: 1 });
  });

  it("кандидаты не включают уже имеющиеся у персонажа (без учёта регистра)", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.talents", fakePack(
      [
        { _id: "d1", name: "Дредноутный Талант A", folder: "fD", system: { tier: 2 } },
        { _id: "d2", name: "Дредноутный Талант B", folder: "fD", system: { tier: 2 } }
      ],
      { fD: "Дредноуты" }
    )]]);
    await refreshTalentGroupIndex();

    const cands = altTalentCandidates("Дредноутный Талант A", ["дредноутный талант b"]);
    expect(cands.map(c => c.name)).not.toContain("Дредноутный Талант B");
  });
});
