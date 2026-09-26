// test/combat/limb-sides-drop.test.mjs
//
// wdbc-x1nz.2.100: потеря конечностей по сторонам — бюджет рук считает
// недоступную сторону один раз; потерянная/бесполезная рука роняет то, что
// держала (combat/limb-loss.mjs::itemsToDrop), крит-строки «роняет всё» дают
// кнопку «Выронить». wdbc-x1nz.2.101: Нартеций Мясника — область атаки
// «weapon:name:Нартеций».

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { itemsToDrop } from "../../module/combat/limb-loss.mjs";
import { maxHands, maxWrists, handStumps } from "../../module/rules/hands.mjs";
import { lostSideFields, lostCountFields, derivedLimbLossConditions } from "../../module/rules/limb-loss.mjs";
import { textDropsHeld, dropButtonHtml, parseCritEffectPills, critPillsHtml } from "../../module/combat/crit-effect-parser.mjs";
import { CRITICAL_TABLES, critRowText } from "../../critical-tables.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { installedImplantSide } from "../../module/sheets/tabs/healing.mjs";

const flagsOf = {};
const weapon = (id, grips, hand = "", over = {}) => ({
  type: "weapon", id, name: over.name ?? id,
  system: { equipped: true, weaponClass: "melee", grips, weaponProps: [], ...over.system },
  getFlag: (ns, key) => (key === "heldHand" ? hand || undefined : (flagsOf[id] || {})[key])
});

function applyPatch(system, patch) {
  const next = structuredClone(system);
  for (const [p, v] of Object.entries(patch)) {
    const parts = p.replace(/^system\./, "").split(".");
    let o = next;
    for (const k of parts.slice(0, -1)) o = (o[k] ??= {});
    o[parts.at(-1)] = v;
  }
  return next;
}

/** Система с потерями по сторонам и уже посчитанными производными Состояниями. */
function sysWith(patch = {}) {
  const system = applyPatch({ lostLimbs: {}, uselessLimbs: {}, conditions: {}, characteristics: { s: { bonus: 4 } } }, patch);
  Object.assign(system.conditions, derivedLimbLossConditions(system));
  return system;
}

describe("бюджет рук по сторонам", () => {
  it("кисть и рука на одной стороне — одна недоступная рука, не две", () => {
    const system = sysWith({ ...lostSideFields("lostHands", "left"), ...lostSideFields("lostArms", "left") });
    const actor = { items: [], system };
    expect(maxHands(actor)).toBe(1);
    expect(maxWrists(actor)).toBe(1);
    expect(handStumps(actor)).toBe(0);
  });

  it("кисть слева, рука справа — ни одной ладони, обрубок кисти слева", () => {
    const system = sysWith({ ...lostSideFields("lostHands", "left"), ...lostSideFields("lostArms", "right") });
    const actor = { items: [], system };
    expect(maxHands(actor)).toBe(0);
    expect(maxWrists(actor)).toBe(1);
    expect(handStumps(actor)).toBe(1);
  });

  it("бесполезная рука на стороне уже потерянной — не вычитается второй раз", () => {
    const system = sysWith({ ...lostSideFields("lostArms", "right"), "system.uselessLimbs.rightArm.state": "untreated" });
    expect(maxHands({ items: [], system })).toBe(1);
  });

  it("число → стороны: новые на первые целые, снятие с последней", () => {
    let system = sysWith();
    system = applyPatch(system, lostCountFields(system, "lostEyes", 1));
    expect(system.lostLimbs.rightEye.lost).toBe(true);
    system = applyPatch(system, lostCountFields(system, "lostEyes", 2));
    system = applyPatch(system, lostCountFields(system, "lostEyes", 1));
    expect(system.lostLimbs.rightEye.lost).toBe(true);
    expect(system.lostLimbs.leftEye.lost).toBe(false);
  });
});

describe("itemsToDrop — что выпадает из руки", () => {
  const sword  = weapon("sword", "1р", "right");
  const claws  = weapon("claws", "П", "right");
  const pistol = weapon("pistol", "1р", "left");

  it("потерянная кисть: оружие этой руки падает, закреплённое на запястье — нет", () => {
    const system = sysWith(lostSideFields("lostHands", "right"));
    const drop = itemsToDrop({ items: [sword, claws, pistol], system }, "right", { wrist: false });
    expect(drop.map(i => i.id)).toEqual(["sword"]);
  });

  it("потерянная/бесполезная рука: падает и закреплённое на запястье", () => {
    const system = sysWith(lostSideFields("lostArms", "right"));
    const drop = itemsToDrop({ items: [sword, claws, pistol], system }, "right", { wrist: true });
    expect(drop.map(i => i.id).sort()).toEqual(["claws", "sword"]);
  });

  it("двуручное без назначенной руки падает, когда рук не хватает", () => {
    const maul = weapon("maul", "2р");
    const system = sysWith(lostSideFields("lostArms", "left"));
    const drop = itemsToDrop({ items: [maul], system }, "left", { wrist: true });
    expect(drop.map(i => i.id)).toEqual(["maul"]);
  });

  it("другая рука ничего не теряет", () => {
    const system = sysWith(lostSideFields("lostArms", "left"));
    expect(itemsToDrop({ items: [sword, claws], system }, "left").map(i => i.id)).toEqual([]);
  });
});

describe("крит-строки: «Выронить» и сторона пилюли", () => {
  const row = (type, loc, n) => critRowText(CRITICAL_TABLES[type][loc], n);

  it("«роняет всё, что держит в этой руке» (I/Рука 3), «выбивает из руки» (R/Рука 1), «выпускает из этой руки» (C/Рука 2)", () => {
    expect(textDropsHeld(row("impact", "arm", 3))).toBe(true);
    expect(textDropsHeld(row("rending", "arm", 1))).toBe(true);
    expect(textDropsHeld(row("chemical", "arm", 2))).toBe(true);
    expect(textDropsHeld(row("impact", "arm", 2))).toBe(false);
  });

  it("кнопка «Выронить» — только при попадании в руку, со стороной попадания", () => {
    const text = row("impact", "arm", 1);
    expect(dropButtonHtml(text, "Actor.x", "leftArm")).toContain('data-side="left"');
    expect(dropButtonHtml(text, "Actor.x", "rightLeg")).toBe("");
    expect(dropButtonHtml(text, "Actor.x", "")).toBe("");
  });

  it("пилюля потери руки несёт сторону попадания; нога по руке — без стороны", () => {
    const pills = parseCritEffectPills(row("impact", "arm", 8));
    expect(critPillsHtml(pills, "Actor.x", null, { side: "leftArm" })).toMatch(/data-cond-key="lostArms"[^>]*data-side="leftArm"/s);
    const legPills = parseCritEffectPills(row("impact", "leg", 8));
    expect(critPillsHtml(legPills, "Actor.x", null, { side: "leftArm" })).toMatch(/data-cond-key="lostLegs"[^>]*data-side=""/s);
  });
});

describe("бионика берёт сторону у импланта из Хирургеона", () => {
  const snap = entries => new Map(entries.map(([id, kind, side, installed]) => [id, { kind, side, installed }]));

  it("новый установленный имплант руки слева — сторона «left»", () => {
    const before = snap([["eye1", "eye", "right", true]]);
    const after = snap([["eye1", "eye", "right", true], ["arm1", "arm", "left", true]]);
    expect(installedImplantSide(before, after, "arm")).toBe("left");
    expect(installedImplantSide(before, after, "hand")).toBe("left");
  });

  it("тип не совпал, не установлен или сразу пара — решает окно Лечения", () => {
    const before = snap([]);
    expect(installedImplantSide(before, snap([["leg1", "leg", "left", true]]), "arm")).toBe("");
    expect(installedImplantSide(before, snap([["arm1", "arm", "left", false]]), "arm")).toBe("");
    expect(installedImplantSide(before, snap([["a", "leg", "left", true], ["b", "leg", "right", true]]), "leg")).toBe("");
  });

  it("уже стоявший имплант не считается новым", () => {
    const s = snap([["arm1", "arm", "left", true]]);
    expect(installedImplantSide(s, s, "arm")).toBe("");
  });
});

describe("Мясник: область атаки «weapon:name:Нартеций» (wdbc-x1nz.2.101)", () => {
  const butcher = {
    type: "talent", name: "Butcher / Мясник", system: {}, getFlag: () => undefined,
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e1", kind: "attackProp", apScope: "name:Нартеций", apKey: "extreme", apRating: "9", apRating2: "", label: "" },
      { id: "e2", kind: "attackProp", apScope: "name:Нартеций", apKey: "precise", apRating: "", apRating2: "", label: "" }
    ] }] } }
  };
  const actor = { type: "character", items: [butcher], system: { conditions: {}, characteristics: {} }, getFlag: () => undefined };
  const narthecium = { type: "weapon", name: "Narthecium / Нартеций (рукопашный профиль)", system: {} };
  const knife = { type: "weapon", name: "Knife / Нож", system: {} };

  it("Нартецию — Extreme (9) и Precise, другому оружию — нет", () => {
    const withN = resolveTest({ actor, kind: "attack", weaponClass: "melee", isMelee: true, weapon: narthecium });
    expect(withN.weaponProps.map(p => p.key ?? p.propKey).sort()).toEqual(["extreme", "precise"]);
    const withKnife = resolveTest({ actor, kind: "attack", weaponClass: "melee", isMelee: true, weapon: knife });
    expect(withKnife.weaponProps ?? []).toHaveLength(0);
  });
});
