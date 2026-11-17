// test/combat/weapon-mod-sights-omni.test.mjs
//
// Омни-Прицел / Omni-Scope: «Комбинирует эффекты всех остальных прицелов»
// (Основная книга, «Модификации → Прицелы»; Sahara task-e683) и Лазерный Прицел /
// Red-Dot: «Оружие получает +10 на одиночные выстрелы» (Sahara 10, п.1).
// Единый вопрос «даёт ли прицел эффект X» — module/rules/sight-effects.mjs; мод и
// читатели берутся настоящие (документы packs-src), чтобы пак и код не разошлись.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";
import { OMNI_COMBINED, SIGHT_EFFECT, sightGrants, sightEffectsOf, isOmniSight }
  from "../../module/rules/sight-effects.mjs";
import { longRangeImmunityReason } from "../../module/rules/range-penalty-immunity.mjs";
import { lightPenaltyImmunityReason, smokePenaltyImmunityReason }
  from "../../module/rules/vision-penalty-immunity.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

function packDoc(pack, enName) {
  const hit = allPackDocuments(pack).find(({ doc }) => doc.name.split("/")[0].trim() === enName);
  if (!hit) throw new Error(`packs-src/${pack}: нет «${enName}»`);
  return hit.doc;
}

function owned(doc, id) {
  const item = { ...doc, id, flags: { ...(doc.flags ?? {}) } };
  item.getFlag = (scope, key) => item.flags?.[scope]?.[key];
  return item;
}

const rifle = () => ({ id: "w1", type: "weapon", flags: {}, getFlag: () => undefined,
  system: { equipped: true, weaponClass: "basic", weaponProps: [] } });

function modOn(enName, id = "m1") {
  const item = owned(packDoc("weapon-mods", enName), id);
  item.system = { ...item.system, installedOn: "w1" };
  return item;
}

const retinal = () => {
  const item = owned(packDoc("gear", "Retinal Display"), "g1");
  item.system = { ...item.system, equipped: true };
  return item;
};

function actorWith(items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { id: "a1", items: list, system: {} };
}

const SIGHTS = ["Collimator Sight", "Djinn Sight", "Laser Sight", "Motion Predictor", "Oculus Sight",
  "Optical Sight", "Target Designator", "Thermal Sight", "Wide-Angle Sight"];

describe("Лазерный Прицел: +10 одиночным (данные пака)", () => {
  it("rofSingleAttackMod = 10, и getModEffects отдаёт его", () => {
    expect(packDoc("weapon-mods", "Laser Sight").system.effects.rofSingleAttackMod).toBe(10);
    const fx = getModEffects(actorWith([modOn("Laser Sight")]), rifle());
    expect(fx.rofSingleAttackMod).toBe(10);
    expect(fx.rofSemiAttackMod).toBe(0);
    expect(fx.rofFullAttackMod).toBe(0);
  });
});

describe("Лазерный Прицел: старая копия без поля в данных", () => {
  it("+10 одиночным приходит по имени (max, не сумма)", () => {
    const old = modOn("Laser Sight");
    old.system.effects.rofSingleAttackMod = 0;
    expect(getModEffects(actorWith([old]), rifle()).rofSingleAttackMod).toBe(10);
    const synced = modOn("Laser Sight");
    expect(getModEffects(actorWith([synced]), rifle()).rofSingleAttackMod).toBe(10);
  });
});

describe("sightGrants — один вопрос про эффект прицела", () => {
  const mods = name => [modOn(name)];

  it("каждый прицел отвечает «да» только на свои эффекты", () => {
    expect(sightGrants(mods("Optical Sight"), SIGHT_EFFECT.longRange)).not.toBeNull();
    expect(sightGrants(mods("Optical Sight"), SIGHT_EFFECT.smoke)).toBeNull();
    expect(sightGrants(mods("Djinn Sight"), SIGHT_EFFECT.longRange)).not.toBeNull();
    expect(sightGrants(mods("Djinn Sight"), SIGHT_EFFECT.smoke)).not.toBeNull();
    expect(sightGrants(mods("Djinn Sight"), SIGHT_EFFECT.lowLight)).toBeNull();
    expect(sightGrants(mods("Thermal Sight"), SIGHT_EFFECT.lowLight)).not.toBeNull();
    expect(sightGrants(mods("Thermal Sight"), SIGHT_EFFECT.longRange)).toBeNull();
    expect(sightGrants(mods("Laser Sight"), SIGHT_EFFECT.laserDot)).not.toBeNull();
    expect(sightGrants(mods("Collimator Sight"), SIGHT_EFFECT.laserDot)).toBeNull();
  });

  it("Омни-Прицел отвечает «да» на любой эффект", () => {
    for (const effect of Object.values(SIGHT_EFFECT)) {
      expect(sightGrants(mods("Omni-Sight"), effect), effect).not.toBeNull();
    }
  });

  it("неизвестный эффект — ошибка, а не тихое «нет»", () => {
    expect(() => sightGrants([], "xray")).toThrow(/xray/);
  });
});

describe("Омни-Прицел: числа объединены (OMNI_COMBINED сверен с паком)", () => {
  const sightDocs = () => SIGHTS.map(n => packDoc("weapon-mods", n));

  // Какие поля effects мода «что-то делают»: не нули/ложь/пустое, множители ≠ 1.
  const active = (k, v) => (typeof v === "boolean" ? v : typeof v === "number" ? v !== (k.endsWith("Mult") ? 1 : 0) : false);

  it("таблица равна максимуму полей всех остальных прицелов — ни больше, ни меньше", () => {
    const union = {};
    for (const doc of sightDocs()) {
      for (const [k, v] of Object.entries(doc.system.effects ?? {})) {
        if (!active(k, v)) continue;
        union[k] = typeof v === "boolean" ? true : Math.max(union[k] ?? -Infinity, v);
      }
    }
    expect(union).toEqual({ ...OMNI_COMBINED });
  });

  it("с надетым Ретинальным Дисплеем Омни даёт в getModEffects +10/+5/+10 к режимам огня", () => {
    const fx = getModEffects(actorWith([modOn("Omni-Sight"), retinal()]), rifle());
    expect(fx.rofSingleAttackMod).toBe(10);
    expect(fx.rofSemiAttackMod).toBe(5);
    expect(fx.rofFullAttackMod).toBe(10);
  });

  it("без Дисплея/Глаза Омни «бесполезен»: ни режимов огня, ничего (требование — Омни, не Целеуказателя)", () => {
    const fx = getModEffects(actorWith([modOn("Omni-Sight")]), rifle());
    expect(fx.rofSingleAttackMod).toBe(0);
    expect(fx.rofSemiAttackMod).toBe(0);
    expect(fx.rofFullAttackMod).toBe(0);
  });

  it("sightEffectsOf: Омни — объединение, прочие моды — свои поля как есть", () => {
    const omni = sightEffectsOf(modOn("Omni-Sight"));
    expect(omni).toMatchObject(OMNI_COMBINED);
    const coll = modOn("Collimator Sight");
    expect(sightEffectsOf(coll)).toBe(coll.system.effects);
    expect(isOmniSight(coll)).toBe(false);
  });

  it("свои числа Омни не удваиваются (max, не сумма)", () => {
    const omni = modOn("Omni-Sight");
    omni.system.effects.aimAttackMod = 7;
    omni.system.effects.rofFullAttackMod = 3;
    const fx = sightEffectsOf(omni);
    expect(fx.aimAttackMod).toBe(7);
    expect(fx.rofFullAttackMod).toBe(10);
  });
});

describe("Омни-Прицел: гасители штрафов дальности и видимости", () => {
  const actor = () => actorWith([]);
  const omni = () => [modOn("Omni-Sight")];

  it("штраф дальней дистанции снят при Прицеливании, без него — нет", () => {
    expect(longRangeImmunityReason(actor(), omni(), { aiming: "half" })).toMatch(/Омни-Прицел/);
    expect(longRangeImmunityReason(actor(), omni(), { aiming: "none" })).toBeNull();
  });

  it("слабый свет/тьма и дым сняты при Прицеливании", () => {
    expect(lightPenaltyImmunityReason(actor(), omni(), { aiming: "full" })).toMatch(/Омни-Прицел/);
    expect(smokePenaltyImmunityReason(actor(), omni(), { aiming: "full" })).toMatch(/Омни-Прицел/);
    expect(lightPenaltyImmunityReason(actor(), omni(), { aiming: "none" })).toBeNull();
    expect(smokePenaltyImmunityReason(actor(), omni(), { aiming: "none" })).toBeNull();
  });

  it("прежние гасители работают как раньше (Оптический — дальность, Термальный — свет, Джинн — всё три)", () => {
    expect(longRangeImmunityReason(actor(), [modOn("Optical Sight")], { aiming: "half" })).toMatch(/Оптический/);
    expect(lightPenaltyImmunityReason(actor(), [modOn("Thermal Sight")], { aiming: "half" })).toMatch(/Термальный/);
    expect(smokePenaltyImmunityReason(actor(), [modOn("Thermal Sight")], { aiming: "half" })).toBeNull();
    expect(smokePenaltyImmunityReason(actor(), [modOn("Djinn Sight")], { aiming: "half" })).toMatch(/Джинн/);
    expect(longRangeImmunityReason(actor(), [modOn("Collimator Sight")], { aiming: "half" })).toBeNull();
  });
});

describe("заметки модов не врут о том, чего нет", () => {
  it("Оптический, Джинн, Термальный — гашение штрафов помечено реализованным (не «не смоделировано»)", () => {
    for (const n of ["Optical Sight", "Djinn Sight", "Thermal Sight"]) {
      expect(packDoc("weapon-mods", n).system.notes, n).not.toMatch(/Не смоделировано/);
    }
  });

  it("Предсказатель Движения — высотная половина реализована", () => {
    expect(packDoc("weapon-mods", "Motion Predictor").system.notes).not.toMatch(/НЕ реализована/);
  });
});
