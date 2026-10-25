// test/sheets/attack-selection-grind.test.mjs
//
// Перемолоть / Grind (Рукопашные, Sahara 3-8dc5): Пила против того, кого носитель
// держит в Борьбе, считает полный S.b вместо половины. Проверка идёт на выборе
// окна атаки (sheets/attack/selection.mjs): именно оттуда флаг ½S.b уходит в бросок
// (gripSbHalf в sheets/attack/dialog.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { buildSelection } from "../../module/sheets/attack/selection.mjs";
import { grindFullSb, holdsInGrapple } from "../../module/rules/melee-talents.mjs";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const GRIND = { key: "meleeCore.core.grind", name: "Grind / Перемолоть" };

/** Актор в Борьбе: роль и партнёр читаются как флаги Foundry. */
function fighter(items, { role = "attacker", partner = "Actor.victim" } = {}) {
  const a = actorFor({ items });
  a.uuid = "Actor.me";
  const flags = { grappleRole: role, grapplePartnerUuid: partner };
  a.getFlag = (scope, key) => (scope === "warhammer-dbc" ? flags[key] : undefined);
  return a;
}
const victim = (uuid = "Actor.victim") => ({ id: "v1", uuid, system: {}, getActiveTokens: () => [] });

function selectionFor(actor, targetActor, maneuverKey = "saw", extra = {}) {
  const item = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", weaponProps: [{ key: "tearing" }] }, { name: "Пилоцепной меч" });
  const { resolveSelectionSafe } = buildSelection({
    actor, atkProfiles: [], bowMarkedMod: 0, categoryFor: () => "Меч", fullAttackForced: false,
    gripKey: "", gripList: [], hasShieldEquipped: false, isMelee: true, isMounted: false, item,
    maneuverKeyDefault: "standard", meleeBaseKey: "standard", primGrip: "", profIdx: -1, sBonus: 4,
    stance: "standard", sys: item.system, targetActor, trainingFor: () => ({ trained: true, source: "" }),
    wp: { cheapShot: false, tearing: true }, ...extra
  });
  return resolveSelectionSafe({ maneuverKey, baseKey: "standard" });
}

beforeEach(() => resetCaptured());

describe("Перемолоть: Пила в Борьбе — полный S.b", () => {
  it("без Таланта Пила режет S.b вдвое (регрессия)", () => {
    expect(selectionFor(fighter([]), victim()).mDef.sbHalf).toBe(true);
  });

  it("с Талантом (ключ), цель в Борьбе у носителя — полный S.b", () => {
    expect(selectionFor(fighter([talentByKey(GRIND.key)]), victim()).mDef.sbHalf).toBe(false);
  });

  it("с Талантом (имя, без записи Конструктора) — то же", () => {
    const a = fighter([{ id: "g", name: GRIND.name, type: "talent", system: {} }]);
    expect(selectionFor(a, victim()).mDef.sbHalf).toBe(false);
  });

  it("с Талантом, но цель НЕ в Борьбе с носителем — половина остаётся", () => {
    expect(selectionFor(fighter([talentByKey(GRIND.key)]), victim("Actor.other")).mDef.sbHalf).toBe(true);
  });

  it("с Талантом, но носитель — Цель Захвата, а не держащий — половина остаётся", () => {
    expect(selectionFor(fighter([talentByKey(GRIND.key)], { role: "target" }), victim()).mDef.sbHalf).toBe(true);
  });

  it("без цели в окне — половина остаётся", () => {
    expect(selectionFor(fighter([talentByKey(GRIND.key)]), null).mDef.sbHalf).toBe(true);
  });

  it("другой приём (Выпад) Талант не трогает", () => {
    const sel = selectionFor(fighter([talentByKey(GRIND.key)]), victim(), "thrust");
    expect(sel.mDef.sbHalf).toBeUndefined();
  });

  it("в подписи приёма названа причина", () => {
    const sel = selectionFor(fighter([talentByKey(GRIND.key)]), victim());
    expect(sel.mDef.chatNote).toContain("Перемолоть");
    expect(sel.mDef.chatNote).not.toContain("½S.b");
  });
});

describe("Рипост: Избегания цели −20 против ответной атаки", () => {
  it("с extraEvasionMod −20 штраф уходит и в Уклонение, и в Парирование цели", () => {
    const sel = selectionFor(fighter([]), victim(), "standard", { extraEvasionMod: -20 });
    expect(sel.targetDodgeMod).toBe(-20);
    expect(sel.targetParryMod).toBe(-20);
    expect(sel.note).toContain("Рипост");
  });

  it("складывается с приёмом (Выпад: Уклонение +10 → −10; Парирование −10 → −30)", () => {
    const sel = selectionFor(fighter([]), victim(), "thrust", { extraEvasionMod: -20 });
    expect(sel.targetDodgeMod).toBe(-10);
    expect(sel.targetParryMod).toBe(-30);
  });

  it("без Рипоста — штрафа нет (регрессия)", () => {
    const sel = selectionFor(fighter([]), victim(), "standard");
    expect(sel.targetDodgeMod).toBe(0);
    expect(sel.targetParryMod).toBe(0);
  });
});

describe("rules/melee-talents: чистые функции Перемолоть", () => {
  it("holdsInGrapple: нужен и «attacker», и партнёр из набора uuid цели", () => {
    const me = fighter([]);
    expect(holdsInGrapple(me, new Set(["Actor.victim"]))).toBe(true);
    expect(holdsInGrapple(me, new Set(["Actor.x"]))).toBe(false);
    expect(holdsInGrapple(fighter([], { role: null }), new Set(["Actor.victim"]))).toBe(false);
  });

  it("grindFullSb: только Пила, только при хватке и с Талантом", () => {
    const a = fighter([talentByKey(GRIND.key)]);
    expect(grindFullSb(a, { maneuverKey: "saw", holdsTarget: true })).toBe(true);
    expect(grindFullSb(a, { maneuverKey: "saw", holdsTarget: false })).toBe(false);
    expect(grindFullSb(a, { maneuverKey: "sweep", holdsTarget: true })).toBe(false);
    expect(grindFullSb(fighter([]), { maneuverKey: "saw", holdsTarget: true })).toBe(false);
  });
});
