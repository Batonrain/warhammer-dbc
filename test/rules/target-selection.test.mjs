// test/rules/target-selection.test.mjs
// 3-5fbf, Target Selection / Выбор Целей: «его промахи никогда не попадают в союзников».
import { describe, it, expect } from "vitest";
import { misfireCandidates, dispositionsAreAllies, hasTargetSelection } from "../../module/rules/target-selection.mjs";

const T = (id, disposition) => ({ id, disposition });
const contact = [T("ally", 1), T("enemy", -1), T("neutral", 0), T("self", 1), T("secret", -2)];

describe("misfireCandidates", () => {
  it("без Таланта список не меняется (враги и союзники как в книге)", () => {
    expect(misfireCandidates(contact, { targetSelection: false, shooterTokenId: "self", shooterDisposition: 1 }))
      .toEqual(contact);
  });
  it("с Талантом убраны союзники стрелка и сам стрелок, враги и нейтралы остаются", () => {
    const ids = misfireCandidates(contact, { targetSelection: true, shooterTokenId: "self", shooterDisposition: 1 }).map(t => t.id);
    expect(ids).toEqual(["enemy", "neutral", "secret"]);
  });
  it("стрелок-враг игроков: его союзниками считаются Hostile", () => {
    const pool = [T("a", -1), T("b", 1)];
    expect(misfireCandidates(pool, { targetSelection: true, shooterTokenId: "x", shooterDisposition: -1 }).map(t => t.id)).toEqual(["b"]);
  });
  it("нейтральный стрелок: союзников у него нет, не отсекается никто, кроме него самого", () => {
    const pool = [T("a", 0), T("b", 1), T("me", 0)];
    expect(misfireCandidates(pool, { targetSelection: true, shooterTokenId: "me", shooterDisposition: 0 }).map(t => t.id)).toEqual(["a", "b"]);
  });
  it("все участники — союзники: список пуст (промах ни в кого не попадает)", () => {
    expect(misfireCandidates([T("a", 1), T("b", 1)], { targetSelection: true, shooterDisposition: 1 })).toEqual([]);
  });
  it("не изменяет исходный массив", () => {
    const src = [T("a", 1), T("b", -1)];
    misfireCandidates(src, { targetSelection: true, shooterDisposition: 1 });
    expect(src).toHaveLength(2);
  });
});

describe("dispositionsAreAllies", () => {
  it("Friendly+Friendly и Hostile+Hostile — да; разные, Neutral, Secret — нет", () => {
    expect(dispositionsAreAllies(1, 1)).toBe(true);
    expect(dispositionsAreAllies(-1, -1)).toBe(true);
    expect(dispositionsAreAllies(1, -1)).toBe(false);
    expect(dispositionsAreAllies(0, 0)).toBe(false);
    expect(dispositionsAreAllies(-2, -2)).toBe(false);
  });
});

describe("hasTargetSelection", () => {
  it("опознаёт Талант по имени", () => {
    const actor = { items: [{ type: "talent", name: "Target Selection / Выбор Целей", system: {} }] };
    expect(hasTargetSelection(actor)).toBe(true);
    expect(hasTargetSelection({ items: [] })).toBe(false);
  });
});
