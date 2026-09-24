// test/rules/useless-limbs.test.mjs
//
// wdbc-x1nz.2.99: Бесполезные Конечности (книга, «Бесполезные Конечности и
// Ампутация») — чистая логика module/rules/useless-limbs.mjs, распознавание
// в крит-строках и последствия для рук/движения.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  uselessCount, pickSide, uselessApplyFields, uselessClockStep, uselessRoundTick,
  settableSides, setLimbOutcome, sideToAmputate, clearSideFields, uselessHint,
  NO_AID_GANGRENE_CHANCE, FAILED_SET_GANGRENE_CHANCE
} from "../../module/rules/useless-limbs.mjs";
import { parseCritEffectPills } from "../../module/combat/crit-effect-parser.mjs";
import { CRITICAL_TABLES, critRowText } from "../../critical-tables.mjs";
import { maxHands, twoHandedTestPenalty } from "../../module/rules/hands.mjs";
import { readMirror, mirrorClearPatch } from "../../module/rules/condition-mirrors.mjs";

const HOUR = 3600, DAY = 86400;

/** Собрать system из плоского патча actor.update (system.uselessLimbs.X.Y). */
function applyPatch(system, patch) {
  const next = structuredClone(system);
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.replace(/^system\./, "").split(".");
    let o = next;
    for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
    o[parts.at(-1)] = value;
  }
  return next;
}

const blank = () => ({ uselessLimbs: { rightArm: {}, leftArm: {}, rightLeg: {}, leftLeg: {} }, conditions: {} });

describe("наложение и выбор конечности", () => {
  it("до лечения: untreated, часы 2×T.b часов от сейчас", () => {
    const patch = uselessApplyFields(blank(), "leftArm", { worldTime: 1000, tb: 4 });
    expect(patch["system.uselessLimbs.leftArm.state"]).toBe("untreated");
    expect(patch["system.uselessLimbs.leftArm.noAidAt"]).toBe(1000 + 8 * HOUR);
  });

  it("на Раунды — только счётчик, второй эффект срок не укорачивает", () => {
    let sys = applyPatch(blank(), uselessApplyFields(blank(), "rightArm", { rounds: 5 }));
    sys = applyPatch(sys, uselessApplyFields(sys, "rightArm", { rounds: 2 }));
    expect(sys.uselessLimbs.rightArm.rounds).toBe(5);
    expect(sys.uselessLimbs.rightArm.state).toBeUndefined();
  });

  it("перманентная остаётся перманентной при новом переломе", () => {
    const sys = blank();
    sys.uselessLimbs.rightLeg = { state: "permanent", gangreneAt: 50 };
    const patch = uselessApplyFields(sys, "rightLeg", { worldTime: 10, tb: 3 });
    expect(patch["system.uselessLimbs.rightLeg.state"]).toBeUndefined();
  });

  it("pickSide: место попадания своего типа — оно; чужое — первая целая этого типа", () => {
    const sys = blank();
    sys.uselessLimbs.rightArm = { state: "untreated" };
    expect(pickSide(sys, "arm", "leftArm")).toBe("leftArm");
    expect(pickSide(sys, "arm", "rightLeg")).toBe("leftArm");
    expect(pickSide(sys, "leg", "")).toBe("rightLeg");
  });
});

describe("часы игрового времени", () => {
  it("2×T.b часов без помощи → перманентно, через T.b дней 70% Гангрены", () => {
    const sys = applyPatch(blank(), uselessApplyFields(blank(), "leftLeg", { worldTime: 0, tb: 3 }));
    expect(uselessClockStep(sys, { to: 6 * HOUR - 1, tb: 3 }).events).toEqual([]);
    const { patch, events } = uselessClockStep(sys, { to: 6 * HOUR, tb: 3 });
    expect(events).toEqual([{ side: "leftLeg", kind: "noAid" }]);
    expect(patch["system.uselessLimbs.leftLeg.state"]).toBe("permanent");
    expect(patch["system.uselessLimbs.leftLeg.gangreneAt"]).toBe(6 * HOUR + 3 * DAY);
    expect(patch["system.uselessLimbs.leftLeg.gangreneChance"]).toBe(NO_AID_GANGRENE_CHANCE);
  });

  it("прыжок Календаря через оба срока — и перманентность, и бросок Гангрены", () => {
    const sys = applyPatch(blank(), uselessApplyFields(blank(), "leftLeg", { worldTime: 0, tb: 2 }));
    const { events } = uselessClockStep(sys, { to: 10 * DAY, tb: 2 });
    expect(events.map(e => e.kind)).toEqual(["noAid", "gangreneDue"]);
    expect(events[1].chance).toBe(70);
  });

  it("срок в лубке вышел — конечность в строю", () => {
    const sys = blank();
    sys.uselessLimbs.rightArm = { state: "splinted", healAt: 100 };
    const { patch, events } = uselessClockStep(sys, { to: 100, tb: 3 });
    expect(events).toEqual([{ side: "rightArm", kind: "healed" }]);
    expect(applyPatch(sys, patch).uselessLimbs.rightArm.state).toBe("");
  });

  it("начало Хода: Раунды тают по каждой конечности отдельно", () => {
    const sys = blank();
    sys.uselessLimbs.rightArm = { rounds: 1 };
    sys.uselessLimbs.leftArm = { rounds: 3 };
    const { patch, ticks } = uselessRoundTick(sys);
    expect(patch).toEqual({ "system.uselessLimbs.rightArm.rounds": 0, "system.uselessLimbs.leftArm.rounds": 2 });
    expect(ticks).toHaveLength(2);
  });
});

describe("фиксация (Medicae+0)", () => {
  const untreated = () => {
    const sys = blank();
    sys.uselessLimbs.leftArm = { state: "untreated", noAidAt: 500 };
    return sys;
  };

  it("успех — в лубке на days суток, часы без помощи остановлены", () => {
    const out = setLimbOutcome(untreated(), "leftArm", { success: true, days: 7, worldTime: 100, tb: 3 });
    expect(out.result).toBe("splinted");
    expect(out.patch["system.uselessLimbs.leftArm.healAt"]).toBe(100 + 7 * DAY);
    expect(out.patch["system.uselessLimbs.leftArm.noAidAt"]).toBe(0);
  });

  it("провал — неправильно; попыток T.b, последняя проваленная — перманентно, 60%", () => {
    let sys = untreated();
    const first = setLimbOutcome(sys, "leftArm", { success: false, worldTime: 0, tb: 2 });
    expect(first.result).toBe("misset");
    sys = applyPatch(sys, first.patch);
    expect(settableSides(sys)).toEqual(["leftArm"]);
    const second = setLimbOutcome(sys, "leftArm", { success: false, worldTime: 0, tb: 2 });
    expect(second.result).toBe("permanent");
    expect(second.patch["system.uselessLimbs.leftArm.gangreneChance"]).toBe(FAILED_SET_GANGRENE_CHANCE);
    expect(settableSides(applyPatch(sys, second.patch))).toEqual([]);
  });

  it("T.b 0 — одна попытка всё равно есть", () => {
    expect(setLimbOutcome(untreated(), "leftArm", { success: false, tb: 0 }).result).toBe("permanent");
  });

  it("ампутация снимает сперва перманентную", () => {
    const sys = blank();
    sys.uselessLimbs.rightLeg = { state: "untreated" };
    sys.uselessLimbs.leftLeg = { state: "permanent" };
    expect(sideToAmputate(sys, "leg")).toBe("leftLeg");
    expect(sideToAmputate(blank(), "leg")).toBeNull();
  });
});

describe("последствия: руки и зеркало", () => {
  const actorWith = system => ({ system, items: [] });

  it("бесполезная рука — как потерянная: бюджет рук и −20 двумя руками", () => {
    const sys = blank();
    sys.uselessLimbs.leftArm = { state: "splinted" };
    expect(uselessCount(sys, "arm")).toBe(1);
    expect(maxHands(actorWith(sys))).toBe(1);
    expect(twoHandedTestPenalty(actorWith(sys))).toBe(-20);
  });

  it("тег «Бесполезная рука» стоит, подсказка называет руку, снятие чистит обе", () => {
    const sys = blank();
    sys.uselessLimbs.rightArm = { rounds: 3 };
    const actor = actorWith(sys);
    expect(readMirror(actor, "uselessArm")).toBe(true);
    expect(readMirror(actor, "uselessLeg")).toBe(false);
    expect(uselessHint(sys, "arm")).toBe("П. Рука — 3 Раунд.");
    expect(mirrorClearPatch("uselessArm")).toEqual({ ...clearSideFields("rightArm"), ...clearSideFields("leftArm") });
  });
});

describe("крит-строки → кнопка «Бесполезная рука/нога»", () => {
  const keys = text => parseCritEffectPills(text).map(p => `${p.key}:${p.formula ?? ""}${p.healMod ? `:${p.healMod}` : ""}`);
  const row = (type, loc, n) => critRowText(CRITICAL_TABLES[type][loc], n);

  it("до лечения: I/Рука 5, I/Нога 7 («сбита с ног» не путает тип), X/Нога 6", () => {
    expect(keys(row("impact", "arm", 5))).toContain("uselessArm:");
    expect(keys(row("impact", "leg", 7))).toContain("uselessLeg:");
    expect(keys(row("impact", "leg", 7))).not.toContain("uselessArm:");
    expect(keys(row("blast", "leg", 6))).toContain("uselessLeg:");
  });

  it("на Раунды: R/Рука 4 (1d10), E/Рука 2 (1d5), C/Рука 2 («на 1 Раунд рука становится»)", () => {
    expect(keys(row("rending", "arm", 4))).toContain("uselessArm:1d10");
    expect(keys(row("energy", "arm", 2))).toContain("uselessArm:1d5");
    expect(keys(row("chemical", "arm", 2))).toContain("uselessArm:1");
  });

  it("«ступня становится бесполезной» — нога (C/Нога 6)", () => {
    expect(keys(row("chemical", "leg", 6))).toContain("uselessLeg:");
  });

  it("некроз: штраф −20 к лечению уходит в кнопку (C/Рука 8)", () => {
    expect(keys(row("chemical", "arm", 8))).toContain("uselessArm::-20");
  });

  it("«бесполезна и поражена Гангреной» — и конечность, и Гангрена (C/Рука 9)", () => {
    const k = keys(row("chemical", "arm", 9));
    expect(k).toContain("uselessArm:");
    expect(k).toContain("gangrene:");
  });

  it("без слова «бесполезн» кнопки нет", () => {
    expect(keys(row("impact", "arm", 1)).some(k => k.startsWith("useless"))).toBe(false);
  });

  it("в таблицах 20 строк с бесполезной конечностью — все дают кнопку", () => {
    let withWord = 0, withPill = 0;
    for (const locs of Object.values(CRITICAL_TABLES)) for (const rows of Object.values(locs)) for (const [n] of rows) {
      const text = critRowText(rows, n);
      if (!/бесполезн/iu.test(text)) continue;
      withWord++;
      if (parseCritEffectPills(text).some(p => p.key.startsWith("useless"))) withPill++;
    }
    expect(withWord).toBe(withPill);
    expect(withWord).toBeGreaterThanOrEqual(20);
  });
});
