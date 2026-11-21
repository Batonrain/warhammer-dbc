// test/sheets/squad-references-actor.test.mjs
//
// task-371e: открытый лист Отряда перерисовывается, когда меняется актор на
// посту или в составе (флаг Боевой Песни лежит на командире, не на Отряде).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";

const { squadReferencesActor } = await import("../../module/sheets/squad-sheet.mjs");

const commander = { uuid: "Actor.c", getActiveTokens: () => [{ uuid: "Scene.s.Token.t" }] };
const stranger  = { uuid: "Actor.x", getActiveTokens: () => [] };

describe("squadReferencesActor", () => {
  it("командир на посту по uuid актора", () => {
    expect(squadReferencesActor({ posts: { commander: { uuid: "Actor.c" } } }, commander)).toBe(true);
  });
  it("командир на посту по uuid токена", () => {
    expect(squadReferencesActor({ posts: { leader: { uuid: "Scene.s.Token.t" } } }, commander)).toBe(true);
  });
  it("член состава", () => {
    expect(squadReferencesActor({ posts: {}, members: [{ uuid: "Actor.c" }] }, commander)).toBe(true);
  });
  it("посторонний актор — не трогаем", () => {
    expect(squadReferencesActor({ posts: { commander: { uuid: "Actor.c" } }, members: [] }, stranger)).toBe(false);
  });
});
