// test/combat/force-move-spd.test.mjs
//
// Sahara spd-0. Толкание (Через Силу, Совместное Перемещение, Против Техники; книга, стр. 27:
// «при толкании до максимума в SPD») читало `actor.system.movement.spd`, которого у существа нет
// (SPD живёт в `movement.halfMove` / `movement.spdNow`): потолок был 0, и Толкание «сдвигало на 0м»,
// сколько бы Успехов ни выпало. Старые тесты держали то же выдуманное поле, поэтому зеленели.
//
// Здесь — НАСТОЯЩАЯ схема существа (`ACTOR_DATA_MODELS[type]`) и настоящий пересчёт листа
// (test/support/real-creature.mjs). Множитель Черт (Почитатели Танца: Полудвижение ×2) в потолок
// не входит: SPD без множителей, как у остальных потребителей (rules/speed-multipliers.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { realCreature } from "../support/real-creature.mjs";
import { forceMoveSpd, forceMoveDistance, useForceMove } from "../../module/combat/force-move.mjs";
import { useJointMove } from "../../module/combat/joint-move.mjs";
import { useVehiclePushContest } from "../../module/combat/vehicle-force-move.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const WORSHIPPERS = () => packDoc("aeldari-traits", "zvrmidxuc39LFSIg");

const cardText = () => String(captured.chat.at(-1)?.content ?? "");
/** «сдвинуто на 4м» → 4 (null, если карточка без дистанции). */
const movedMeters = () => {
  const m = cardText().match(/сдвинуто на ([\d.]+)м/);
  return m ? Number(m[1]) : null;
};

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { delete globalThis.game.combat; });

describe("forceMoveSpd — SPD с настоящего существа", () => {
  for (const type of ["character", "daemon", "demonPrince", "minion"]) {
    it(`${type}: SPD 4 (Ловкость 40) → потолок Толкания 4`, () => {
      const a = realCreature({ type, spd: 4 });
      expect(a.system.movement.spd).toBeUndefined(); // поля, которое читал код, у существа нет
      expect(a.system.movement.halfMove).toBe(4);
      expect(forceMoveSpd(a)).toBe(4);
    });
  }

  it("носитель Почитателей Танца: Полудвижение SPD×2 = 8, а потолок — SPD 4", () => {
    const a = realCreature({ spd: 4, docs: [WORSHIPPERS()] });
    expect(a.system.movement.halfMove).toBe(8);
    expect(forceMoveSpd(a)).toBe(4);
  });

  it("старые данные без spdNow — halfMove; пусто — 0", () => {
    expect(forceMoveSpd({ system: { movement: { halfMove: 5 } } })).toBe(5);
    expect(forceMoveSpd({ system: {} })).toBe(0);
    expect(forceMoveSpd(null)).toBe(0);
  });

  it("forceMoveDistance с этим SPD: 0,5м за Успех, не выше SPD", () => {
    const spd = forceMoveSpd(realCreature({ spd: 4 }));
    expect(forceMoveDistance("push", 3, spd)).toBe(1.5);
    expect(forceMoveDistance("push", 20, spd)).toBe(4);
  });
});

describe("Через Силу — Толкание на настоящем персонаже", () => {
  it("SPD 4, Athletics 40, бросок 10 (4 Усп.) → сдвинуто на 2м (раньше 0м)", async () => {
    captured.nextRoll = 10;
    await useForceMove(realCreature({ spd: 4, athletics: 40 }), { mode: "push", throughForce: true });
    expect(movedMeters()).toBe(2);
  });

  it("много Успехов — упирается в SPD 4, а не в 0", async () => {
    captured.nextRoll = 1; // Athletics 90 → 9 Усп. = 4,5м, потолок 4
    await useForceMove(realCreature({ spd: 4, athletics: 90 }), { mode: "push", throughForce: true });
    expect(movedMeters()).toBe(4);
  });

  it("носитель Почитателей Танца: потолок SPD 4, а не Полудвижение 8 (было бы 4,5м)", async () => {
    captured.nextRoll = 1;
    const dancer = realCreature({ spd: 4, athletics: 90, docs: [WORSHIPPERS()] });
    await useForceMove(dancer, { mode: "push", throughForce: true });
    expect(movedMeters()).toBe(4);
  });

  it("Подъём/Переворот от SPD не зависит — потолок 2м", async () => {
    captured.nextRoll = 1;
    await useForceMove(realCreature({ spd: 10, athletics: 90 }), { mode: "lift", throughForce: true });
    expect(movedMeters()).toBe(2);
  });

  it("демон, принц демонов, миньон — те же 2м на 4 Успеха", async () => {
    for (const type of ["daemon", "demonPrince", "minion"]) {
      resetCaptured();
      captured.nextRoll = 10;
      await useForceMove(realCreature({ type, spd: 4, athletics: 40 }), { mode: "push", throughForce: true });
      expect(movedMeters(), type).toBe(2);
    }
  });
});

describe("Совместное Перемещение — потолок Толкания у ведущего", () => {
  it("ведущий SPD 4 с 9 Успехами сдвигает на 4м, а не на 0м", async () => {
    captured.nextRoll = 1;
    const lead = realCreature({ spd: 4, athletics: 90 });
    await useJointMove(lead, [], { mode: "push", weight: 0 });
    expect(movedMeters()).toBe(4);
  });

  it("ведущий — носитель Почитателей Танца: потолок SPD 4, не 8", async () => {
    captured.nextRoll = 1;
    const lead = realCreature({ spd: 4, athletics: 90, docs: [WORSHIPPERS()] });
    await useJointMove(lead, [], { mode: "push", weight: 0 });
    expect(movedMeters()).toBe(4);
  });
});

describe("Против Техники — потолок Толкания у атакующего", () => {
  // Пилот: низкий Operate, чтобы атакующий выиграл встречный тест при том же rv.
  const pilot = () => ({
    id: "p1", name: "Пилот", type: "character", items: [],
    system: { characteristics: { ag: { total: 10 } }, skills: {}, groupSkills: { operate: [] } },
    update: async () => {}
  });

  it("атакующий SPD 4 выигрывает — сдвинуто на 4м, а не на 0м", async () => {
    captured.nextRoll = 1;
    await useVehiclePushContest(realCreature({ spd: 4, athletics: 90 }), pilot(), { mode: "push" });
    expect(movedMeters()).toBe(4);
  });

  it("атакующий — носитель Почитателей Танца: потолок SPD 4, не 8", async () => {
    captured.nextRoll = 1;
    const dancer = realCreature({ spd: 4, athletics: 90, docs: [WORSHIPPERS()] });
    await useVehiclePushContest(dancer, pilot(), { mode: "push" });
    expect(movedMeters()).toBe(4);
  });
});
