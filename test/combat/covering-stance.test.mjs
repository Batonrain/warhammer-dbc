// test/combat/covering-stance.test.mjs
//
// Прикрывающая Стойка (стр. 15, wdbc-x1nz.2.66.7): −20 рукопашным атакам по
// союзникам в Базовом/Глубоком контакте с персонажем в этой Стойке — то же
// соседство, что Свободная Атака (module/combat/free-attack.mjs), только
// фильтр «союзник» вместо «враг» и доп. фильтр по meleeStance.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { friendlyContactTokenDocs, coveringDefendersOf } from "../../module/combat/free-attack.mjs";

const HOSTILE = -1, FRIENDLY = 1;

function fakeActor({ type = "character", meleeStance = "standard", ...system } = {}) {
  return { type, system: { meleeStance, ...system } };
}

function token({ id, x = 0, y = 0, width = 2, height = 2, disposition = HOSTILE, actor = null, name = id } = {}) {
  const doc = { id, x, y, width, height, disposition, actor, name, uuid: `Scene.s.Token.${id}` };
  doc.object = { id, uuid: doc.uuid, targetedBy: null, setTarget() {} };
  return { document: doc };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] }, ready: true };
});

describe("friendlyContactTokenDocs", () => {
  it("союзник вплотную — попадает в список", () => {
    const me  = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const ally = token({ id: "a", x: 2, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    canvas.tokens.placeables = [me, ally];
    expect(friendlyContactTokenDocs(me.document).map(d => d.id)).toEqual(["a"]);
  });

  it("враг вплотную — не считается", () => {
    const me = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor() });
    canvas.tokens.placeables = [me, enemy];
    expect(friendlyContactTokenDocs(me.document)).toEqual([]);
  });

  it("союзник далеко — не в контакте", () => {
    const me = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const ally = token({ id: "a", x: 30, y: 30, disposition: FRIENDLY, actor: fakeActor() });
    canvas.tokens.placeables = [me, ally];
    expect(friendlyContactTokenDocs(me.document)).toEqual([]);
  });
});

describe("coveringDefendersOf", () => {
  it("союзник в Прикрывающей Стойке рядом — найден", () => {
    const me = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const guard = token({ id: "g", x: 2, y: 0, disposition: FRIENDLY, actor: fakeActor({ meleeStance: "covering" }) });
    canvas.tokens.placeables = [me, guard];
    expect(coveringDefendersOf(me.document).map(d => d.id)).toEqual(["g"]);
  });

  it("союзник рядом, но НЕ в Прикрывающей Стойке — не считается", () => {
    const me = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const ally = token({ id: "a", x: 2, y: 0, disposition: FRIENDLY, actor: fakeActor({ meleeStance: "standard" }) });
    canvas.tokens.placeables = [me, ally];
    expect(coveringDefendersOf(me.document)).toEqual([]);
  });

  it("враг в Прикрывающей Стойке рядом — не считается (не союзник)", () => {
    const me = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor() });
    const enemyGuard = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ meleeStance: "covering" }) });
    canvas.tokens.placeables = [me, enemyGuard];
    expect(coveringDefendersOf(me.document)).toEqual([]);
  });
});
