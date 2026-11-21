// Sahara 12-dbc-114-0075: Рубрикант — не получает Порчу, не Бегает, при Ранах ниже 0 рассыпается.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  CORRUPTION_IMMUNE_CAP, NO_RUN_CAP, CRUMBLE_CAP, corruptionWithImmunity, crumblesOnWoundLoss
} from "../../module/rules/rubricae.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const KEYS = [CORRUPTION_IMMUNE_CAP, NO_RUN_CAP, CRUMBLE_CAP];
const capKeys = item => (item.flags?.["warhammer-dbc"]?.mechanics ?? [])
  .flatMap(g => g.entries).filter(e => e.kind === "capability").map(e => e.capabilityKey);

describe("Рубрикант: правила", () => {
  it("прирост Порчи отменяется, снижение проходит", () => {
    expect(corruptionWithImmunity(10, 15)).toBe(10);
    expect(corruptionWithImmunity(10, 4)).toBe(4);
    expect(corruptionWithImmunity(0, 0)).toBe(0);
  });
  it("рассыпается только при уходе Ран ниже 0 и только с возможностью", () => {
    expect(crumblesOnWoundLoss(true, true)).toBe(true);
    expect(crumblesOnWoundLoss(true, false)).toBe(false);
    expect(crumblesOnWoundLoss(false, true)).toBe(false);
  });
});

describe("Рубрикант: данные", () => {
  it("у всех трёх возможностей есть читатель", () => {
    for (const k of KEYS) expect(CAPABILITIES[k]?.reader, k).toBeTruthy();
  });
  it("Черта в паке выдаёт все три возможности", () => {
    const dir = path.resolve("packs-src/traits/Элитные_архетипы/Колдун_Рубрики");
    const f = fs.readdirSync(dir).find(x => x.startsWith("Rubricae___"));
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    expect(capKeys(j)).toEqual(expect.arrayContaining(KEYS));
  });
  it("копия Черты в профиле Голема Рубрики тоже их выдаёт", () => {
    const dir = path.resolve("packs-src/bestiary/Существа_Элитных_архетипов");
    const f = fs.readdirSync(dir).find(x => x.startsWith("Rubric_Golem___"));
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const trait = j.items.find(i => i.name.startsWith("Rubricae"));
    expect(capKeys(trait)).toEqual(expect.arrayContaining(KEYS));
  });
});
