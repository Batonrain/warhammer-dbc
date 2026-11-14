// dbc-114 (14.11.2026), пачка 4 (часть 2): Через Боль («Впитать боль»), Неприкосновенные, социальные расовые Черты.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { absorbPainAvailable, absorbPainInRange, absorbPainGain, absorbPainRoundKey } from "../../module/rules/absorb-pain.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("Впитать боль", () => {
  it("раз в Раунд боя с одной цели; другая цель и вне боя — можно", () => {
    const combat = { id: "c1", round: 2 };
    const map = { "Actor.a": "c1:2" };
    expect(absorbPainAvailable(map, "Actor.a", combat)).toBe(false);
    expect(absorbPainAvailable(map, "Actor.b", combat)).toBe(true);
    expect(absorbPainAvailable(map, "Actor.a", { id: "c1", round: 3 })).toBe(true);
    expect(absorbPainAvailable(map, "Actor.a", null)).toBe(true);
    expect(absorbPainRoundKey(null)).toBe("");
  });
  it("радиус P.b метров; неизвестное расстояние не блокирует", () => {
    expect(absorbPainInRange(4, 4)).toBe(true);
    expect(absorbPainInRange(5, 4)).toBe(false);
    expect(absorbPainInRange(null, 4)).toBe(true);
  });
  it("+1 Очко Боли, не выше максимума", () => {
    expect(absorbPainGain(2, 5)).toEqual({ value: 3, gained: true });
    expect(absorbPainGain(5, 5)).toEqual({ value: 5, gained: false });
    expect(absorbPainGain(undefined, 3)).toEqual({ value: 1, gained: true });
  });
  it("в паке: способность и кнопка зовут absorbPain(actor)", () => {
    const e = entries("Through the Pain / ");
    expect(e.map(x => x.capabilityKey)).toContain("pain.absorb");
    expect(e.find(x => x.kind === "script").code).toContain("absorbPain(actor)");
    expect(CAPABILITIES["pain.absorb"].reader).toBeTruthy();
  });
});

describe("Неприкосновенные", () => {
  it("не одержим и игнорирует щиты демонов — способности с читателями", () => {
    const keys = entries("Untouchable / ").map(x => x.capabilityKey);
    expect(keys).toEqual(expect.arrayContaining(["possession.immune", "shield.ignoreDaemon"]));
    for (const k of ["possession.immune", "shield.ignoreDaemon"]) expect(CAPABILITIES[k].reader).toBeTruthy();
  });
});

describe("социальные расовые Черты", () => {
  const social = prefix => entries(prefix).find(e => e.kind === "testMod");
  it("Жажда Власти: +10 на социальные тесты, галочкой", () => {
    const m = social("Reign Craving / ");
    expect(m).toMatchObject({ modScope: "social", value: 10, modAuto: false });
  });
  it("С Чужаком Ты Не Заговори: −20 на общение, галочкой", () => {
    const m = social("Speak Not Unto The Alien / ");
    expect(m).toMatchObject({ modScope: "social", value: -20, modAuto: false });
  });
});
