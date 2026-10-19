// test/combat/fanatic-redirect.test.mjs
//
// Back to Back/Спиной к Спине (Sahara 3-ac78, bd wdbc-3w7lo) — урезанная
// версия: раздача Трейта Fanatic и опознание носителей. Перенос самого
// попадания не требует кода (существующая кнопка «Применить урон» уже
// резолвит цель из выделенного токена сцены в момент клика) — см. заголовок
// module/combat/fanatic-redirect.mjs.

import { describe, it, expect } from "vitest";
import { hasFanatic, fanaticCandidates, backToBackGrantSectionHtml } from "../../module/combat/fanatic-redirect.mjs";

const trait = (name) => ({ type: "trait", name, system: {} });
const talent = (name) => ({ type: "talent", name, system: {} });
const actor = (uuid, items = []) => ({ uuid, items });

describe("hasFanatic", () => {
  it("по любой половине имени, только type:trait", () => {
    expect(hasFanatic(actor("a1", [trait("Fanatic / Фанатик")]))).toBe(true);
    expect(hasFanatic(actor("a1", [trait("Fanatic")]))).toBe(true);
    expect(hasFanatic(actor("a1", [trait("Фанатик")]))).toBe(true);
    // Талант с тем же именем — не считается (книга различает Трейт и Талант).
    expect(hasFanatic(actor("a1", [talent("Fanatic")]))).toBe(false);
  });
  it("без Трейта — false", () => {
    expect(hasFanatic(actor("a1", []))).toBe(false);
  });
});

describe("fanaticCandidates", () => {
  it("отбирает носителей Fanatic, кроме исключённых uuid", () => {
    const a = actor("a1", [trait("Fanatic")]);
    const b = actor("a2", [trait("Фанатик")]);
    const c = actor("a3", []);
    expect(fanaticCandidates([a, b, c]).map(x => x.uuid).sort()).toEqual(["a1", "a2"]);
    expect(fanaticCandidates([a, b, c], { excludeUuids: ["a1"] }).map(x => x.uuid)).toEqual(["a2"]);
  });
  it("пусто без кандидатов", () => {
    expect(fanaticCandidates([actor("a1", [])])).toEqual([]);
    expect(fanaticCandidates([])).toEqual([]);
  });
});

describe("backToBackGrantSectionHtml", () => {
  it("пусто без Таланта", () => {
    expect(backToBackGrantSectionHtml(actor("a1", []))).toBe("");
  });
  it("кнопка с лимитом получателей у носителя Таланта", () => {
    const roller = { uuid: "cmd1", items: [talent("Back to Back / Спиной к Спине")],
      system: { characteristics: { fel: { bonus: 4 } } } };
    const html = backToBackGrantSectionHtml(roller);
    expect(html).toContain("wh-back-to-back-grant");
    expect(html).toContain('data-commander-uuid="cmd1"');
    expect(html).toContain("до 2 подчинённых");
  });
});
