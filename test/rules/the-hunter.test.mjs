// test/rules/the-hunter.test.mjs
//
// The Hunter / Загонщик (wdbc-1rno, Кхорн) — «нападает на ближайшего
// псайкера» реализовано как ПОДСКАЗКА (нет автоатак ни для одного существа
// в системе, см. шапку module/rules/the-hunter.mjs): visiblePsykersFrom /
// nearestVisiblePsyker находят, кто из псайкеров сцены в поле зрения
// чемпиона, ближайший первым. Переиспользует geometry vision-target.mjs +
// tokenDocDistance — эта пара тестов проверяет только обвязку (фильтры
// self/hidden/isPsyker, сортировку по дистанции), не саму формулу замера.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  visiblePsykersFrom, nearestVisiblePsyker,
  hunterHoundInfo, isHunterHoundActor, HOUND_NAME, HUNTER_HOUND_FLAG
} from "../../module/rules/the-hunter.mjs";
import { ruName } from "../../module/apps/demon-summon.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function token(id, { x = 0, y = 0, isPsyker = false, hidden = false, sight = {}, rotation = 0 } = {}) {
  return { id, x, y, width: 1, height: 1, rotation, sight, hidden, actor: { system: { isPsyker } } };
}
function scene(tokens) {
  const sc = { grid, tokens: { contents: tokens } };
  for (const t of tokens) t.parent = sc;
  return sc;
}

describe("visiblePsykersFrom / nearestVisiblePsyker", () => {
  it("без сцены (нет токена на канвасе) — пустой список", () => {
    const champion = token("champ");
    expect(visiblePsykersFrom(champion)).toEqual([]);
    expect(nearestVisiblePsyker(champion)).toBeNull();
  });

  it("находит псайкера в поле зрения, не-псайкера пропускает", () => {
    const champion = token("champ", { x: 0 });
    const psyker   = token("psyker",   { x: 300, isPsyker: true });  // 6м
    const mundane  = token("mundane",  { x: 200, isPsyker: false }); // 4м, ближе — но не псайкер
    scene([champion, psyker, mundane]);

    const result = visiblePsykersFrom(champion);
    expect(result.map(r => r.token.id)).toEqual(["psyker"]);
    expect(nearestVisiblePsyker(champion).token.id).toBe("psyker");
  });

  it("несколько псайкеров — сортирует по дистанции, ближайший первым", () => {
    const champion = token("champ", { x: 0 });
    const far  = token("far",  { x: 900, isPsyker: true });  // 18м
    const near = token("near", { x: 300, isPsyker: true });  // 6м
    scene([champion, far, near]);

    expect(visiblePsykersFrom(champion).map(r => r.token.id)).toEqual(["near", "far"]);
    expect(nearestVisiblePsyker(champion).token.id).toBe("near");
    expect(nearestVisiblePsyker(champion).distance).toBeCloseTo(6);
  });

  it("псайкер вне дальности зрения — не считается видимым", () => {
    const champion = token("champ", { x: 0, sight: { range: 5 } }); // 5м обзор
    const psyker = token("psyker", { x: 300, isPsyker: true }); // 6м — за пределом
    scene([champion, psyker]);
    expect(nearestVisiblePsyker(champion)).toBeNull();
  });

  it("скрытый псайкер — не считается видимым", () => {
    const champion = token("champ", { x: 0 });
    const psyker = token("psyker", { x: 100, isPsyker: true, hidden: true });
    scene([champion, psyker]);
    expect(nearestVisiblePsyker(champion)).toBeNull();
  });

  it("сам чемпион (isPsyker:true на себе) в список не попадает", () => {
    const champion = token("champ", { x: 0, isPsyker: true });
    scene([champion]);
    expect(nearestVisiblePsyker(champion)).toBeNull();
  });
});

describe("hunterHoundInfo / isHunterHoundActor", () => {
  function actorWithFlag(info) {
    return { getFlag: (scope, key) => (scope === "warhammer-dbc" && key === HUNTER_HOUND_FLAG ? info : undefined) };
  }

  it("без флага — null/false", () => {
    const actor = actorWithFlag(undefined);
    expect(hunterHoundInfo(actor)).toBeNull();
    expect(isHunterHoundActor(actor)).toBe(false);
  });

  it("с флагом — отдаёт championUuid/itemId, isHunterHoundActor true", () => {
    const info = { championUuid: "Actor.champ1", itemId: "item1" };
    const actor = actorWithFlag(info);
    expect(hunterHoundInfo(actor)).toEqual(info);
    expect(isHunterHoundActor(actor)).toBe(true);
  });

  // Призыв (combat/the-hunter.mjs → spawnDemonOnScene) ищет демона по имени тем же
  // сравнением, что apps/demon-summon.mjs::findBestiaryActor: целиком или русской половиной.
  it("HOUND_NAME находит актора в Бестиарии тем же сравнением, что и призыв", () => {
    const needle = HOUND_NAME.toLowerCase();
    const hits = allPackDocuments("bestiary").map(d => d.doc)
      .filter(d => d.name.toLowerCase() === needle || ruName(d.name).toLowerCase() === needle);
    expect(hits.length, "в packs-src/bestiary нет актора с этим именем").toBeGreaterThan(0);
  }, PACK_SCAN_TIMEOUT);
});
