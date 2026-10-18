// test/apps/majestic-horns-submutations-mechanics.test.mjs
//
// wdbc-1rno.10: остаток субмутаций Majestic Horns/Величественные Рога.
// Здесь — 10 (Корона Рогов → integralAttack на новый предмет-оружие, тот же
// приём, что у Зубастого Языка, strange-tongue-submutation-mechanics.test.mjs)
// и 8 (Рога Кровожада: Concussive(0) всегда, Flame(3d10) только в Ярости и
// только по псайкерам). Страж на РЕАЛЬНЫЕ данные пака.

import { describe, it, expect } from "vitest";
import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const horns = packDocById("packs-src/mutations/Общие_мутации", "7gVtvzDAlpTU48cd");
const crown = packDocById("packs-src/weapons/Интегральные_атаки", "CCDdNzbbq0tmRBPM");
const submutations = parseSubmutations(horns.system.benefit);
const entries = horns.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const bySub = label => entries.filter(e => (e.when?.submutations ?? []).includes(label));

describe("Majestic Horns: 10 — Корона Рогов", () => {
  it("в таблице СУБМУТАЦИИ есть строка 10", () => {
    expect(submutations.entries.map(e => e.label)).toContain("10");
  });

  it("запись integralAttack ссылается на реальный предмет-оружие", () => {
    const e = bySub("10").find(x => x.kind === "integralAttack");
    expect(e.equipSourceUuid).toBe(`Compendium.warhammer-dbc.weapons.Item.${crown._id}`);
  });

  it("предмет несёт книжный профиль: Rng 0, 1d10 R, Pen 2, Cheap Shot, Tainted", () => {
    expect(crown.system.weaponClass).toBe("melee");
    expect(crown.system.range).toBe(0);
    expect(crown.system.damage).toBe("1d10");
    expect(crown.system.damageType).toBe("rending");
    expect(crown.system.penetration).toBe(2);
    expect(crown.system.weaponProps.map(p => p.key).sort()).toEqual(["cheapShot", "tainted"]);
  });

  it("запись включается только когда выпала именно 10", () => {
    const e = bySub("10").find(x => x.kind === "integralAttack");
    expect(entryWhenOk(null, e, { system: { submutation: { label: "10" } } })).toBe(true);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "8" } } })).toBe(false);
  });
});

// ── 8 — Рога Кровожада через настоящий конвейер атаки ──────────────────────
import "../support/foundry-stub.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const asMutation = (sub) => ({
  id: "m1", name: horns.name, type: "mutation", system: { ...horns.system, submutation: { label: sub } },
  flags: horns.flags, getFlag: (s, k) => horns.flags[s]?.[k]
});
const hornsWeapon = { type: "weapon", name: "Horns (Deadly Natural Weapons) / Рога (Смертельное Естественное Оружие)", system: {} };
const sword = { type: "weapon", name: "Sword / Меч", system: {} };
const owner = (sub, inRage) => ({ type: "character", items: [asMutation(sub)], getFlag: () => undefined,
  system: { conditions: {}, characteristics: {}, inRage } });
const psyker = { items: [], system: { psyker: { rating: 2 } } };
const flagPsyker = { items: [], system: { isPsyker: true } };
const grunt = { items: [], system: { psyker: { rating: 0 } } };
const attack = (actor, extra) => resolveTest({ actor, kind: "attack", weaponClass: "melee", isMelee: true, weapon: hornsWeapon, ...extra });
const keys = r => (r.weaponProps ?? []).map(p => p.key).sort();

describe("Majestic Horns: 8 — Рога Кровожада (Concussive всегда, Flame в Ярости по псайкерам)", () => {
  it("Concussive (0) — на Рогах всегда, даже вне Ярости и без цели", () => {
    const r = attack(owner("8", false), { targetActor: grunt });
    expect(r.weaponProps).toContainEqual(expect.objectContaining({ key: "concussive", rating: 0 }));
    expect(keys(r)).not.toContain("flame");
  });

  it("в Ярости по псайкеру (Пси-Рейтинг или флаг isPsyker) Рога получают Flame (3d10)", () => {
    for (const t of [psyker, flagPsyker]) {
      const r = attack(owner("8", true), { targetActor: t });
      expect(r.weaponProps).toContainEqual(expect.objectContaining({ key: "flame", rating: "3d10" }));
    }
  });

  it("в Ярости, но по не-псайкеру или без цели — Flame нет", () => {
    expect(keys(attack(owner("8", true), { targetActor: grunt }))).toEqual(["concussive"]);
    expect(keys(attack(owner("8", true), {}))).toEqual(["concussive"]);
  });

  it("по псайкеру, но вне Ярости — Flame нет", () => {
    expect(keys(attack(owner("8", false), { targetActor: psyker }))).toEqual(["concussive"]);
  });

  it("другое оружие (не Рога) свойств не получает", () => {
    const r = attack(owner("8", true), { targetActor: psyker, weapon: sword });
    expect(r.weaponProps ?? []).toHaveLength(0);
  });

  it("другая субмутация (не 8) — ничего не даёт", () => {
    expect(attack(owner("4-5", true), { targetActor: psyker }).weaponProps ?? []).toHaveLength(0);
  });
});

// ── 2-3 — Укреплённые Рога, 9 — Зрящие Рога (броня) ─────────────────────────
import { parseAbsorptionTarget, describeMechEntry } from "../../module/apps/mechanics.mjs";
import { mechFormulaTotalSafe } from "../../module/rules/mech-formula.mjs";
import { resolveArmorAbsorptionAP } from "../../module/combat/armor-properties.mjs";
import { EFFECT_KEY_WHITELIST, expectedPhase, EYE_ARMOUR_KEY } from "../../module/constants/effect-keys.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

describe("parseAbsorptionTarget: цель записи «AP против…»", () => {
  it("широкий тип и подвид — как раньше", () => {
    expect(parseAbsorptionTarget("vsType:impact")).toMatchObject({ scope: "vsType", key: "impact", path: "system.absorption.vsType.impact" });
    expect(parseAbsorptionTarget("vsSubtype:crushing")).toMatchObject({ path: "system.absorption.vsSubtype.crushing" });
  });
  it("подвид в одной локации", () => {
    expect(parseAbsorptionTarget("vsSubtypeAt:head:crushing"))
      .toMatchObject({ scope: "vsSubtypeAt", loc: "head", key: "crushing", path: "system.absorption.vsSubtypeAt.head.crushing" });
  });
  it("мусор, неизвестная локация, обрубок — null", () => {
    for (const bad of ["", "vsSubtypeAt:head", "vsSubtypeAt:tail:crushing", "vsFoo:x", undefined])
      expect(parseAbsorptionTarget(bad)).toBeNull();
  });
});

describe("Majestic Horns: 2-3 и 9 — данные согласованы с движком", () => {
  it("2-3: +Cor.b AP против I(Cr) в голову — ключ известен эффектам, фаза final", () => {
    const e = bySub("2-3").find(x => x.kind === "absorption");
    const abs = parseAbsorptionTarget(e.absorptionTarget);
    expect(abs.path).toBe("system.absorption.vsSubtypeAt.head.crushing");
    expect(EFFECT_KEY_WHITELIST).toContain(abs.path);
    expect(expectedPhase(abs.path)).toBe("final");
    expect(mechFormulaTotalSafe(e.absorptionValue, { cor: 5 })).toBe(5);
    expect(describeMechEntry(e)).toMatch(/Дробящ.*Голова/);
  });

  it("2-3: способность профилей Удара головой заведена и есть у Удара головой", () => {
    const cap = bySub("2-3").find(x => x.kind === "capability");
    expect(CAPABILITIES[cap.capabilityKey]).toBeTruthy();
    const headbutt = packDocById("packs-src/weapons/Интегральные_атаки", "xP2os46ZgH3HqoGj");
    const prof = headbutt.system.profiles.filter(p => p.requiresCapability?.includes(cap.capabilityKey));
    expect(prof.map(p => p.damage).sort()).toEqual(["1d10+2", "1d10-1"]);
    // «+3 Dmg и кубик до d10»: из 1d5-4 выходит 1d10-1; Безоружный Воин (1d10-1) → 1d10+2.
    expect(headbutt.system.damage).toBe("1d5-4");
    for (const p of prof) { expect(p.damageType).toBe("impact"); expect(p.damageSubtype).toBe("crushing"); }
  });

  it("9: броня глаз ½Cor.b (окр.▼) — ключ eyeBonus известен эффектам", () => {
    const e = bySub("9").find(x => x.kind === "armour");
    expect(e.armourLocation).toBe("eye");
    expect(EFFECT_KEY_WHITELIST).toContain(EYE_ARMOUR_KEY);
    expect(mechFormulaTotalSafe(e.armourValue, { cor: 5 })).toBe(2);
    expect(mechFormulaTotalSafe(e.armourValue, { cor: 4 })).toBe(2);
    expect(mechFormulaTotalSafe(e.armourValue, { cor: 1 })).toBe(0);
    expect(describeMechEntry(e)).toMatch(/Глаза/);
  });
});

describe("resolveArmorAbsorptionAP: бонус локации и броня глаз", () => {
  const base = { damageType: "impact", melee: true };

  it("I(Cr) в голову: бонус подвида входит в AP, после чего голова делится пополам", () => {
    const hit = (subtypeBonus) => resolveArmorAbsorptionAP({
      ...base, baseArmorAP: 4, damageSubtype: "crushing", hitLocation: "Голова", subtypeBonus });
    expect(hit(0)).toBe(2);
    expect(hit(4)).toBe(4);
  });

  it("Глаз: AP шлема игнорируется, броня глаз остаётся; естественная броня тоже", () => {
    const eye = (extra) => resolveArmorAbsorptionAP({
      ...base, baseArmorAP: 5, wornAP: 5, damageSubtype: "", hitLocation: "Глаз (Голова)", ...extra });
    expect(eye({})).toBe(0);
    expect(eye({ eyeBonus: 2 })).toBe(2);
    expect(eye({ eyeBonus: 2, baseArmorAP: 6, wornAP: 5 })).toBe(3);   // +1 естественной брони
  });

  it("броня глаз не действует на попадание в обычную голову", () => {
    expect(resolveArmorAbsorptionAP({ ...base, baseArmorAP: 3, hitLocation: "Голова", eyeBonus: 5 })).toBe(3);
  });
});
