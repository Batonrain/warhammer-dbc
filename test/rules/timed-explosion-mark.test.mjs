// Выдержанный Взрыв (Питати): метка точки разряда — только для вплетённой силы, в том же бою и Раунде.
import { describe, it, expect } from "vitest";
import { timedExplosionVerdict } from "../../module/rules/runic-shot.mjs";

const combat = { id: "c1", round: 2 };
const at = { x: 1, y: 2, sceneId: "s", itemUuid: "Actor.a.Item.blast", combatId: "c1", round: 2 };

describe("Выдержанный Взрыв: метка точки разряда", () => {
  it("та же сила, сцена, бой и Раунд — точка берётся", () => {
    expect(timedExplosionVerdict(at, { itemUuid: "Actor.a.Item.blast", sceneId: "s", combat })).toBe("use");
  });
  it("шаблон другого Взрывного оружия/силы метку не трогает", () => {
    expect(timedExplosionVerdict(at, { itemUuid: "Actor.a.Item.grenade", sceneId: "s", combat })).toBe("skip");
    expect(timedExplosionVerdict(at, { itemUuid: "", sceneId: "s", combat })).toBe("skip");
  });
  it("следующий Раунд, другой бой, конец боя или старая метка без силы — истекла", () => {
    expect(timedExplosionVerdict(at, { itemUuid: at.itemUuid, sceneId: "s", combat: { id: "c1", round: 3 } })).toBe("stale");
    expect(timedExplosionVerdict(at, { itemUuid: at.itemUuid, sceneId: "s", combat: { id: "c2", round: 2 } })).toBe("stale");
    expect(timedExplosionVerdict(at, { itemUuid: at.itemUuid, sceneId: "s", combat: null })).toBe("stale");
    expect(timedExplosionVerdict({ x: 1, y: 2, sceneId: "s" }, { itemUuid: "x", sceneId: "s", combat: null })).toBe("stale");
  });
  it("вне боя метка вне боя действует", () => {
    const out = { ...at, combatId: "", round: 0 };
    expect(timedExplosionVerdict(out, { itemUuid: at.itemUuid, sceneId: "s", combat: null })).toBe("use");
  });
});
