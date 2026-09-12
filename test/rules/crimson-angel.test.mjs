// test/rules/crimson-angel.test.mjs
//
// Crimson Angel / Багровый Ангел (wdbc-1rno, Кхорн): «в пределах видимости
// есть цель, к которой у персонажа Талант Ненависти» — та же геометрия
// видимости, что у nearestVisiblePsyker (the-hunter.mjs), отбор — по
// rules/hatred.mjs::hatredTargetsOf/anyTargetMatches.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { visibleHatredTargetsFrom, nearestVisibleHatredTarget } from "../../module/rules/crimson-angel.mjs";
import { raceTarget, allTarget } from "../../module/rules/talent-targets.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function hatredTalent(targets) {
  return { type: "talent", name: "Hatred / Ненависть", system: { targets } };
}
function championActor(items = []) {
  return { items };
}
function token(id, actor, { x = 0, y = 0, hidden = false, sight = { range: 30, angle: 0 } } = {}) {
  return { id, x, y, width: 1, height: 1, rotation: 0, hidden, sight, actor };
}
function scene(tokens) {
  const sc = { grid, tokens: { contents: tokens } };
  for (const t of tokens) t.parent = sc;
  return sc;
}

describe("visibleHatredTargetsFrom", () => {
  it("подходящая под цель Ненависти цель в поле зрения — попадает в список", () => {
    const champion = championActor([hatredTalent([raceTarget("ork", "Орк")])]);
    const championT = token("champion", champion, { x: 0 });
    const ork = token("ork", { system: { race: "ork" } }, { x: 300 }); // 3 клетки × 2м = 6м, в пределах 30м
    scene([championT, ork]);
    expect(visibleHatredTargetsFrom(championT, champion).map(r => r.token.id)).toEqual(["ork"]);
  });

  it("цель не подходит ни под одну Ненависть — не попадает в список", () => {
    const champion = championActor([hatredTalent([raceTarget("ork", "Орк")])]);
    const championT = token("champion", champion, { x: 0 });
    const human = token("human", { system: { race: "human" } }, { x: 300 });
    scene([championT, human]);
    expect(visibleHatredTargetsFrom(championT, champion)).toEqual([]);
  });

  it("подходящая цель вне поля зрения (за пределом дальности) — не попадает", () => {
    const champion = championActor([hatredTalent([allTarget()])]);
    const championT = token("champion", champion, { x: 0, sight: { range: 5, angle: 0 } });
    const far = token("far", { system: {} }, { x: 1000 }); // 20м > 5м
    scene([championT, far]);
    expect(visibleHatredTargetsFrom(championT, champion)).toEqual([]);
  });

  it("скрытый токен исключён, даже если подходит и виден", () => {
    const champion = championActor([hatredTalent([allTarget()])]);
    const championT = token("champion", champion, { x: 0 });
    const hidden = token("hidden", { system: {} }, { x: 100, hidden: true });
    scene([championT, hidden]);
    expect(visibleHatredTargetsFrom(championT, champion)).toEqual([]);
  });

  it("без Талантов Ненависти у чемпиона — пустой список, сцена вообще не обходится зря", () => {
    const champion = championActor([]);
    const championT = token("champion", champion, { x: 0 });
    const anyone = token("anyone", { system: {} }, { x: 100 });
    scene([championT, anyone]);
    expect(visibleHatredTargetsFrom(championT, champion)).toEqual([]);
  });

  it("несколько подходящих целей — сортировка по расстоянию, ближайшая первой", () => {
    const champion = championActor([hatredTalent([allTarget()])]);
    const championT = token("champion", champion, { x: 0 });
    const near = token("near", { system: {} }, { x: 300 });  // 6м
    const nearer = token("nearer", { system: {} }, { x: 100 }); // 2м
    scene([championT, near, nearer]);
    expect(visibleHatredTargetsFrom(championT, champion).map(r => r.token.id)).toEqual(["nearer", "near"]);
  });
});

describe("nearestVisibleHatredTarget", () => {
  it("возвращает ближайшую подходящую цель", () => {
    const champion = championActor([hatredTalent([allTarget()])]);
    const championT = token("champion", champion, { x: 0 });
    const near = token("near", { system: {} }, { x: 300 });
    const nearer = token("nearer", { system: {} }, { x: 100 });
    scene([championT, near, nearer]);
    expect(nearestVisibleHatredTarget(championT, champion)?.token.id).toBe("nearer");
  });

  it("нет подходящих целей — null", () => {
    const champion = championActor([]);
    const championT = token("champion", champion, { x: 0 });
    scene([championT]);
    expect(nearestVisibleHatredTarget(championT, champion)).toBeNull();
  });

  it("без сцены (токен не на канвасе) — null, не падает", () => {
    const champion = championActor([hatredTalent([allTarget()])]);
    expect(nearestVisibleHatredTarget({ id: "x", actor: champion }, champion)).toBeNull();
  });
});
