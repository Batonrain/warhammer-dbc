// test/helpers/token-after-update.test.mjs — Sahara 589-updatetoken: позиция после анимированного перемещения.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { tokenDocAfterUpdate } from "../../module/helpers/token-after-update.mjs";
import { tokenDocAfterUpdate as reexported } from "../../module/combat/free-attack.mjs";

describe("tokenDocAfterUpdate", () => {
  const doc = { id: "t", uuid: "Scene.s.Token.t", name: "T", actor: { id: "a" }, parent: { id: "s" }, x: 0, y: 0, width: 1, height: 1, disposition: -1 };
  it("координаты из changes важнее документа, сцена и актор сохраняются", () => {
    const at = tokenDocAfterUpdate(doc, { x: 300, y: 200 });
    expect(at).toMatchObject({ x: 300, y: 200, width: 1, parent: { id: "s" }, actor: { id: "a" } });
  });
  it("без changes — документ как есть", () => {
    expect(tokenDocAfterUpdate(doc, {})).toMatchObject({ x: 0, y: 0 });
  });
  it("старый импорт из free-attack.mjs работает", () => expect(reexported).toBe(tokenDocAfterUpdate));
});
