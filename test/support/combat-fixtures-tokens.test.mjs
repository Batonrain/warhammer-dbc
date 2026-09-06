// test/support/combat-fixtures-tokens.test.mjs
//
// wdbc-kcb5: actorFor().getActiveTokens() до этой правки игнорировал оба
// аргумента (linked, document) и всегда вёл себя как linked:false — разница
// между «только привязанные токены» и «все токены актора» была физически
// непроверяема юнит-тестом. Ровно эта путаница (getActiveTokens(true) не
// находит непривязанный токен) была найдена только живым тестом — wdbc-5280.
// Этот файл — тест на саму заглушку, а не на игровую логику.

import { describe, it, expect, beforeEach } from "vitest";
import { actorFor } from "./combat-fixtures.mjs";

function tokenFor(actor, { linked, id = "t1" } = {}) {
  const document = { id, actorLink: linked };
  return { actor, document };
}

describe("actorFor().getActiveTokens(linked, document) — форма настоящего Foundry v14", () => {
  let actor;

  beforeEach(() => {
    actor = actorFor();
    actor.uuid = "Actor.a1";
    globalThis.canvas = { tokens: { placeables: [] } };
  });

  it("умолчание (без аргументов) — находит и привязанный, и непривязанный токен", () => {
    const linked = tokenFor(actor, { linked: true, id: "linked" });
    const unlinked = tokenFor(actor, { linked: false, id: "unlinked" });
    canvas.tokens.placeables = [linked, unlinked];

    const found = actor.getActiveTokens();
    expect(found.map(t => t.document.id).sort()).toEqual(["linked", "unlinked"]);
  });

  it("linked:true — оставляет только токен с actorLink:true (баг wdbc-5280)", () => {
    const linked = tokenFor(actor, { linked: true, id: "linked" });
    const unlinked = tokenFor(actor, { linked: false, id: "unlinked" });
    canvas.tokens.placeables = [linked, unlinked];

    const found = actor.getActiveTokens(true);
    expect(found.map(t => t.document.id)).toEqual(["linked"]);
  });

  it("document:true — возвращает TokenDocument, не Token", () => {
    const linked = tokenFor(actor, { linked: true, id: "linked" });
    canvas.tokens.placeables = [linked];

    const [doc] = actor.getActiveTokens(false, true);
    expect(doc).toBe(linked.document);
  });

  it("чужой актор не попадает в выборку", () => {
    const other = actorFor();
    other.uuid = "Actor.a2";
    canvas.tokens.placeables = [tokenFor(other, { linked: true })];

    expect(actor.getActiveTokens()).toEqual([]);
  });
});
