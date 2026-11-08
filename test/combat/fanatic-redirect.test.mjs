// test/combat/fanatic-redirect.test.mjs
//
// Back to Back/Спиной к Спине (Sahara 3-ac78, bd wdbc-3w7lo): раздача Трейта
// Fanatic, опознание носителей и (19.10.2026, «нужно сильнее
// автоматизировать») — геометрия контакта с целью + счётчик «раз в Раунд
// без Реакции». Перенос самого попадания по-прежнему не требует кода
// (существующая кнопка «Применить урон» уже резолвит цель из выделенного
// токена сцены в момент клика) — см. заголовок module/combat/fanatic-redirect.mjs.
// Кнопка «Перехват» в карточке (attack-card.mjs) переносит урон сама, а
// payFanaticIntercept списывает бесплатный перехват или Реакцию.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../module/combat/action-economy.mjs", () => ({ spendReaction: vi.fn() }));
import { spendReaction } from "../../module/combat/action-economy.mjs";
import { hasFanatic, fanaticCandidates, backToBackGrantSectionHtml,
  fanaticInterceptCandidates, backToBackFreeUseAvailable, markBackToBackFreeUseUsed, clearFanaticGrants,
  payFanaticIntercept, fanaticPayer
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

// Книга: Fanatic даётся «до конца боя» — розданный Трейт снимается, свой остаётся.
describe("clearFanaticGrants", () => {
  const granted = (id) => ({ id, type: "trait", name: "Fanatic", flags: { "warhammer-dbc": { fanaticGrant: { source: "cmd1" } } } });
  const owned = (uuid, items) => {
    const a = { uuid, items, isOwner: true, deleted: [] };
    a.deleteEmbeddedDocuments = async (type, ids) => { a.deleted.push(...ids); };
    return a;
  };

  it("снимает розданные Fanatic у всех, свой Трейт не трогает", async () => {
    const cmd = owned("cmd1", [granted("g1")]);
    const sub = owned("a2", [granted("g2"), { id: "own", type: "trait", name: "Fanatic", flags: {} }]);
    const none = owned("a3", []);
    await clearFanaticGrants([cmd, sub, none]);
    expect(cmd.deleted).toEqual(["g1"]);
    expect(sub.deleted).toEqual(["g2"]);
    expect(none.deleted).toEqual([]);
  });
});

describe("fanaticInterceptCandidates — геометрия базового контакта с целью", () => {
  let tokenSeq = 0;
  const token = (x, y, a = null, { actorLink = true, id = `t${++tokenSeq}` } = {}) =>
    ({ id, document: { id, x, y, width: 1, height: 1, actorLink }, actor: a });
  const worldActor = (uuid, items = [trait("Fanatic")]) => actor(uuid, items);
  const deltaActor = (worldUuid, tokenId, items = [trait("Fanatic")]) => ({
    isToken: true, uuid: `Scene.s.Token.${tokenId}.Actor.${worldUuid}`, items, token: { baseActor: worldActor(worldUuid, []) }
  });

  beforeEach(() => { globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } }; });

  it("носитель Fanatic в контакте — кандидат: актор и токен", () => {
    const targetToken = token(0, 0);
    const fanatic = worldActor("f1");
    const tok = token(0, 0, fanatic);
    const out = fanaticInterceptCandidates(targetToken, [tok]);
    expect(out.map(e => e.actor.uuid)).toEqual(["f1"]);
    expect(out[0].token).toBe(tok);
  });

  it("носитель Fanatic далеко — не кандидат", () => {
    expect(fanaticInterceptCandidates(token(0, 0), [token(0, 1000, worldActor("f1"))])).toEqual([]);
  });

  it("без Fanatic — не кандидат, даже в контакте", () => {
    expect(fanaticInterceptCandidates(token(0, 0), [token(0, 0, worldActor("f1", []))])).toEqual([]);
  });

  it("токен без актора пропускается", () => {
    expect(fanaticInterceptCandidates(token(0, 0), [token(0, 0, null)])).toEqual([]);
  });

  it("Fanatic только в дельте несвязанного токена (мирового актора с Fanatic в game.actors нет) — кандидат", () => {
    const delta = deltaActor("Actor.f1", "tf");
    const tok = token(0, 0, delta, { actorLink: false });
    const out = fanaticInterceptCandidates(token(0, 0), [tok]);
    expect(out.map(e => e.actor.uuid)).toEqual(["Scene.s.Token.tf.Actor.Actor.f1"]);
    expect(out[0].token).toBe(tok);
    expect(fanaticPayer(out[0].actor)).toBe(delta);
  });

  it("Fanatic у мирового актора, но не в дельте токена — не кандидат: ударяет и платит токен", () => {
    const delta = deltaActor("Actor.f1", "tf", []);
    expect(fanaticInterceptCandidates(token(0, 0), [token(0, 0, delta, { actorLink: false })])).toEqual([]);
  });

  it("два токена одного связанного актора — один кандидат, первый токен в контакте", () => {
    const fanatic = worldActor("Actor.f1");
    const far = token(0, 1000, fanatic);
    const near1 = token(0, 0, fanatic);
    const near2 = token(100, 0, fanatic);
    const out = fanaticInterceptCandidates(token(0, 0), [far, near1, near2]);
    expect(out).toHaveLength(1);
    expect(out[0].token).toBe(near1);
  });

  it("два несвязанных токена разных uuid — два кандидата, каждому свой токен", () => {
    const tokA = token(0, 0, deltaActor("Actor.f1", "ta"), { actorLink: false });
    const tokB = token(100, 0, deltaActor("Actor.f1", "tb"), { actorLink: false });
    const out = fanaticInterceptCandidates(token(0, 0), [tokA, tokB]);
    expect(out.map(e => e.token)).toEqual([tokA, tokB]);
    expect(new Set(out.map(e => e.actor.uuid)).size).toBe(2);
  });

  it("токен самой цели исключён — по ссылке и по id документа", () => {
    const fanatic = worldActor("f1");
    const targetToken = token(0, 0, fanatic);
    expect(fanaticInterceptCandidates(targetToken, [targetToken])).toEqual([]);
    const sameDoc = token(0, 0, fanatic, { id: targetToken.document.id });
    expect(fanaticInterceptCandidates(targetToken, [sameDoc])).toEqual([]);
  });

  it("excludeUuids — носитель удара не предлагает себя перехватчиком", () => {
    const defender = worldActor("def1");
    const defToken = token(100, 0, defender);
    expect(fanaticInterceptCandidates(token(0, 0), [defToken], { excludeUuids: ["def1"] })).toEqual([]);
    expect(fanaticInterceptCandidates(token(0, 0), [defToken], { excludeUuids: [undefined] })).toHaveLength(1);
  });

  it("без targetToken — пусто", () => {
    expect(fanaticInterceptCandidates(null, [token(0, 0, worldActor("f1"))])).toEqual([]);
  });

  it("токены по умолчанию — canvas.tokens.placeables", () => {
    globalThis.canvas.tokens = { placeables: [token(0, 0, worldActor("f1"))] };
    expect(fanaticInterceptCandidates(token(0, 0)).map(e => e.actor.uuid)).toEqual(["f1"]);
  });
});

describe("fanaticPayer — кто платит за перехват", () => {
  it("несвязанный токен: актор токена (своя дельта Реакций и счётчика), а не мировой актор", () => {
    const world = { uuid: "Actor.f1", name: "Фанатик" };
    const tokenActor = { uuid: "Scene.s.Token.t.Actor.f1", name: "Фанатик", isToken: true };
    world.getActiveTokens = () => [{ actor: tokenActor }];
    expect(fanaticPayer(world)).toBe(tokenActor);
  });

  it("актор несвязанного токена платит сам, даже если у него есть getActiveTokens на другой токен", () => {
    const other = { uuid: "Scene.s.Token.other.Actor.f1", isToken: true };
    const own = { uuid: "Scene.s.Token.t.Actor.f1", isToken: true, getActiveTokens: () => [{ actor: other }] };
    expect(fanaticPayer(own)).toBe(own);
  });

  it("связанный токен: тот же актор", () => {
    const world = { uuid: "Actor.f1" };
    world.getActiveTokens = () => [{ actor: world }];
    expect(fanaticPayer(world)).toBe(world);
  });

  it("токена на сцене нет — мировой актор", () => {
    const world = { uuid: "Actor.f1", getActiveTokens: () => [] };
    expect(fanaticPayer(world)).toBe(world);
    expect(fanaticPayer({ uuid: "Actor.f2" })).toEqual({ uuid: "Actor.f2" });
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

describe("payFanaticIntercept — плата за перехват: бесплатный раз в Раунд или Реакция", () => {
  const grantedItem = { type: "trait", name: "Fanatic", flags: { "warhammer-dbc": { fanaticGrant: { source: "cmd1" } } } };
  const bearer = (uuid, items) => {
    const flags = {};
    return { uuid, items, getFlag: (_ns, key) => flags[key], setFlag: async (_ns, key, value) => { flags[key] = value; } };
  };
  let seq = 0;
  const message = (id = `m${++seq}`) => {
    const flags = {};
    return { id, isOwner: true, getFlag: (_ns, key) => flags[key], setFlag: async (_ns, key, value) => { flags[key] = value; } };
  };

  beforeEach(() => {
    globalThis.game = { combat: { round: 1 } };
    spendReaction.mockReset();
    spendReaction.mockResolvedValue(true);
  });

  it("розданный Фанатик: первый перехват бесплатный и гасит счётчик Раунда, Реакция цела", async () => {
    const f = bearer("f1", [grantedItem]);
    const r = await payFanaticIntercept(f, message());
    expect(r).toMatchObject({ ok: true, free: true });
    expect(backToBackFreeUseAvailable(f)).toBe(false);
    expect(spendReaction).not.toHaveBeenCalled();
  });

  it("бесплатный уже потрачен — тратит Реакцию", async () => {
    const f = bearer("f1", [grantedItem]);
    await markBackToBackFreeUseUsed(f);
    const r = await payFanaticIntercept(f, message());
    expect(r).toMatchObject({ ok: true, free: false });
    expect(spendReaction).toHaveBeenCalledWith(f);
  });

  it("собственный Фанатик (не от Таланта) тоже перехватывает бесплатно раз в Раунд, потом за Реакцию", async () => {
    const f = bearer("f1", [trait("Fanatic")]);
    const first = await payFanaticIntercept(f, message());
    expect(first).toMatchObject({ ok: true, free: true });
    expect(backToBackFreeUseAvailable(f)).toBe(false);
    expect(spendReaction).not.toHaveBeenCalled();
    const second = await payFanaticIntercept(f, message());
    expect(second).toMatchObject({ ok: true, free: false });
    expect(spendReaction).toHaveBeenCalledTimes(1);
  });

  it("нет Реакции — перехват не состоялся", async () => {
    spendReaction.mockResolvedValue(false);
    const f = bearer("f1", [trait("Fanatic")]);
    await markBackToBackFreeUseUsed(f);
    const r = await payFanaticIntercept(f, message());
    expect(r.ok).toBe(false);
  });

  it("на одной карточке второе попадание тем же Фанатиком — уже оплачено, ничего не списывается", async () => {
    const f = bearer("f1", [trait("Fanatic")]);
    await markBackToBackFreeUseUsed(f);
    const msg = message();
    await payFanaticIntercept(f, msg);
    const again = await payFanaticIntercept(f, msg);
    expect(again).toMatchObject({ ok: true, already: true });
    expect(spendReaction).toHaveBeenCalledTimes(1);
  });

  it("на другой карточке платится заново", async () => {
    const f = bearer("f1", [trait("Fanatic")]);
    await markBackToBackFreeUseUsed(f);
    await payFanaticIntercept(f, message());
    await payFanaticIntercept(f, message());
    expect(spendReaction).toHaveBeenCalledTimes(2);
  });
});
