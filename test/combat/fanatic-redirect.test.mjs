// test/combat/fanatic-redirect.test.mjs
//
// Back to Back/Спиной к Спине (Sahara 3-ac78, bd wdbc-3w7lo): раздача Трейта
// Fanatic, опознание носителей и (19.10.2026, «нужно сильнее
// автоматизировать») — геометрия контакта с целью + счётчик «раз в Раунд
// без Реакции». Перенос самого попадания по-прежнему не требует кода
// (существующая кнопка «Применить урон» уже резолвит цель из выделенного
// токена сцены в момент клика) — см. заголовок module/combat/fanatic-redirect.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { hasFanatic, fanaticCandidates, backToBackGrantSectionHtml,
  fanaticInterceptCandidates, backToBackFreeUseAvailable, markBackToBackFreeUseUsed
} from "../../module/combat/fanatic-redirect.mjs";

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

describe("fanaticInterceptCandidates — геометрия базового контакта с целью", () => {
  const token = (x, y) => ({ document: { x, y, width: 1, height: 1 } });
  const actorWithToken = (uuid, tok, items = [trait("Fanatic")]) => {
    const a = actor(uuid, items);
    a.getActiveTokens = () => (tok ? [tok] : []);
    return a;
  };

  beforeEach(() => { globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } }; });

  it("носитель Fanatic в контакте — кандидат", () => {
    const targetToken = token(0, 0);
    const fanatic = actorWithToken("f1", token(0, 0));
    expect(fanaticInterceptCandidates(targetToken, [fanatic]).map(a => a.uuid)).toEqual(["f1"]);
  });

  it("носитель Fanatic далеко — не кандидат", () => {
    const targetToken = token(0, 0);
    const fanatic = actorWithToken("f1", token(0, 1000));
    expect(fanaticInterceptCandidates(targetToken, [fanatic])).toEqual([]);
  });

  it("без Fanatic — не кандидат, даже в контакте", () => {
    const targetToken = token(0, 0);
    const noFanatic = actorWithToken("f1", token(0, 0), []);
    expect(fanaticInterceptCandidates(targetToken, [noFanatic])).toEqual([]);
  });

  it("excludeUuids — сама цель не предлагает себя перехватчиком", () => {
    const targetToken = token(0, 0);
    const defender = actorWithToken("def1", targetToken);
    expect(fanaticInterceptCandidates(targetToken, [defender], { excludeUuids: ["def1"] })).toEqual([]);
  });

  it("без targetToken — пусто", () => {
    expect(fanaticInterceptCandidates(null, [actorWithToken("f1", token(0, 0))])).toEqual([]);
  });
});

describe("backToBackFreeUseAvailable/markBackToBackFreeUseUsed — раз в Раунд без Реакции", () => {
  const fanaticActor = () => {
    const flags = {};
    return {
      uuid: "f1",
      getFlag: (_ns, key) => flags[key],
      setFlag: async (_ns, key, value) => { flags[key] = value; }
    };
  };

  beforeEach(() => { globalThis.game = { combat: { round: 1 } }; });

  it("доступен, пока не отмечен использованным в этом Раунде", async () => {
    const a = fanaticActor();
    expect(backToBackFreeUseAvailable(a)).toBe(true);
    await markBackToBackFreeUseUsed(a);
    expect(backToBackFreeUseAvailable(a)).toBe(false);
  });

  it("новый Раунд сбрасывает отметку сам", async () => {
    const a = fanaticActor();
    await markBackToBackFreeUseUsed(a);
    expect(backToBackFreeUseAvailable(a)).toBe(false);
    globalThis.game.combat.round = 2;
    expect(backToBackFreeUseAvailable(a)).toBe(true);
  });

  it("без активного Combat — отследить нечем, доступность не отнимается", () => {
    globalThis.game = {};
    expect(backToBackFreeUseAvailable(fanaticActor())).toBe(true);
  });
});
