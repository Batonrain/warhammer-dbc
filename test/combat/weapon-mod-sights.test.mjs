// test/combat/weapon-mod-sights.test.mjs
//
// «Хотя на оружие можно установить несколько прицелов, для каждой атаки можно
// пользоваться только одним» (Основная книга, «Модификации → Прицелы»;
// wdbc-1rno.40, Sahara wdbc-1rno-40). Прицел — модификация группы «sights»
// (все десять модов раздела «Прицелы» и только они). Действует один — выбранный
// в окне атаки (флаг оружия hudSight), по умолчанию первый рабочий;
// остальные установленные прицелы на эту атаку молчат. Прочих модов правило не
// касается.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects, getActiveMods, activeSightId, isSightMod, mergeWeaponPropEntries,
         ACTIVE_SIGHT_FLAG } from "../../module/combat/weapon-mods.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const SYS = "warhammer-dbc";

function packDoc(pack, enName) {
  const hit = allPackDocuments(pack).find(({ doc }) => doc.name.split("/")[0].trim() === enName);
  if (!hit) throw new Error(`packs-src/${pack}: нет «${enName}»`);
  return hit.doc;
}

function owned(doc, id, flags = {}) {
  const item = { ...doc, id, flags: { ...(doc.flags ?? {}), [SYS]: { ...(doc.flags?.[SYS] ?? {}), ...flags } } };
  item.getFlag = (scope, key) => item.flags?.[scope]?.[key];
  return item;
}

function rifle({ sight, weaponProps = [] } = {}) {
  const flags = sight ? { [SYS]: { [ACTIVE_SIGHT_FLAG]: sight } } : {};
  return { id: "w1", type: "weapon", flags, getFlag: (s, k) => flags?.[s]?.[k],
    system: { equipped: true, weaponClass: "basic", weaponProps } };
}

function modOn(enName, id) {
  const item = owned(packDoc("weapon-mods", enName), id);
  item.system = { ...item.system, installedOn: "w1" };
  return item;
}

function retinal() {
  const item = owned(packDoc("gear", "Retinal Display"), "g1");
  item.system = { ...item.system, equipped: true };
  return item;
}

function actorWith(items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { id: "a1", items: list };
}

describe("что считается прицелом", () => {
  it("все десять модов папки «Прицелы» — группа sights, и больше ни один мод", () => {
    const docs = allPackDocuments("weapon-mods").map(x => ({ ...x, file: x.file.replaceAll("\\", "/") }));
    const inFolder = docs.filter(({ file }) => file.includes("/Прицелы/"));
    expect(inFolder).toHaveLength(10);
    for (const { doc } of inFolder) expect(isSightMod(doc), doc.name).toBe(true);
    for (const { doc, file } of docs.filter(({ file }) => !file.includes("/Прицелы/"))) {
      expect(isSightMod(doc), file).toBe(false);
    }
  });
});

describe("activeSightId — какой прицел действует (wdbc-1rno.40)", () => {
  it("прицелов нет — null", () => {
    expect(activeSightId(actorWith([]), rifle())).toBe(null);
  });

  it("один прицел — он и действует, выбирать нечего", () => {
    expect(activeSightId(actorWith([modOn("Collimator Sight", "s1")]), rifle())).toBe("s1");
  });

  it("два прицела без выбора — первый", () => {
    const actor = actorWith([modOn("Collimator Sight", "s1"), modOn("Motion Predictor", "s2")]);
    expect(activeSightId(actor, rifle())).toBe("s1");
  });

  it("выбор, сохранённый на оружии, — он", () => {
    const actor = actorWith([modOn("Collimator Sight", "s1"), modOn("Motion Predictor", "s2")]);
    expect(activeSightId(actor, rifle({ sight: "s2" }))).toBe("s2");
  });

  it("сохранённый прицел сняли с оружия — откат на первый", () => {
    const actor = actorWith([modOn("Collimator Sight", "s1"), modOn("Motion Predictor", "s2")]);
    expect(activeSightId(actor, rifle({ sight: "gone" }))).toBe("s1");
  });

  it("сохранён Целеуказатель, но ретинальный дисплей сняли — действует рабочий Коллиматорный", () => {
    const actor = actorWith([modOn("Target Designator", "s1"), modOn("Collimator Sight", "s2")]);
    expect(activeSightId(actor, rifle({ sight: "s1" }))).toBe("s2");
    // а с надетым дисплеем выбор игрока в силе
    expect(activeSightId(actorWith([modOn("Target Designator", "s1"), modOn("Collimator Sight", "s2"), retinal()]),
      rifle({ sight: "s1" }))).toBe("s1");
  });

  it("без выбора первым берётся РАБОЧИЙ: Целеуказатель без ретинального дисплея пропускается", () => {
    const actor = actorWith([modOn("Target Designator", "s1"), modOn("Collimator Sight", "s2")]);
    expect(activeSightId(actor, rifle())).toBe("s2");
  });
});

describe("getActiveMods / getModEffects — один прицел за атаку", () => {
  it("второй прицел не действует, прочие моды — да", () => {
    const silencer = { id: "m9", type: "weaponMod", name: "Silencer / Глушитель",
      system: { installedOn: "w1", modGroup: "other", effects: { attackMod: 1 } } };
    const actor = actorWith([modOn("Collimator Sight", "s1"), modOn("Motion Predictor", "s2"), silencer]);
    expect(getActiveMods(actor, rifle()).map(m => m.id)).toEqual(["s1", "m9"]);
    expect(getActiveMods(actor, rifle({ sight: "s2" })).map(m => m.id)).toEqual(["s2", "m9"]);
  });

  it("Коллиматорный + Омни-Прицел: эффекты НЕ складываются — работает только выбранный", () => {
    const inaccurate = [{ key: "inaccurate", rating: 0, rating2: 0 }];
    const actor = actorWith([modOn("Collimator Sight", "s1"), modOn("Omni-Sight", "s2"), retinal()]);
    const keys = w => mergeWeaponPropEntries(w, getModEffects(actor, w)).map(p => p.key);

    const viaCollimator = rifle({ weaponProps: inaccurate });
    expect(keys(viaCollimator)).toContain("inaccurate");            // Омни сейчас не смотрят

    const viaOmni = rifle({ sight: "s2", weaponProps: inaccurate });
    expect(keys(viaOmni)).not.toContain("inaccurate");
    expect(getActiveMods(actor, viaOmni).some(m => m.id === "s1")).toBe(false);
  });
});
