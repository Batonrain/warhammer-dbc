// test/rules/witchfinder.test.mjs
//
// Ведьмоискатель (Sahara 3-defiance, корбук): «перебрасывать неудачные тесты
// Awareness на засекание проявления психосил и тесты Forbidden Lore (Psykers)
// для распознания психосилы». Система не знает, для чего игрок бросает навык,
// поэтому в окне броска носителю Таланта показана галочка (sheets/actor-sheet.mjs),
// а отмеченная, она ставит ctx.psychicDetect — область psychicDetect и открывает
// переброс. Запись Конструктора берётся из НАСТОЯЩЕГО файла packs-src.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { witchfinderTestKind, WITCHFINDER_CAP } from "../../module/rules/defiance-talents.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/talents/Пси_стойкость");
function packTalent(prefix) {
  const file = fs.readdirSync(DIR).find(f => f.startsWith(prefix));
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  return { ...doc, id: doc._id, getFlag: () => undefined };
}

const actor = items => ({ type: "character", system: { characteristics: { per: { total: 40 }, int: { total: 40 } } }, items });
const rerolls = (items, ctx) => resolveTest({ actor: actor(items), ...ctx }).rerolls.map(r => r.target);

const AWARENESS = { kind: "skill", char: "per", skill: "awareness" };
const LORE_PSYKERS = { kind: "skill", char: "int", group: "forbiddenLore", specialty: "Psykers / Псайкеры" };

describe("Ведьмоискатель: запись в паке", () => {
  const wf = packTalent("Witchfinder");
  const entries = wf.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("несёт kind:reroll на области psychicDetect (keepBest, для себя) и возможность psyResist.core.witchfinder", () => {
    expect(entries.find(e => e.kind === "reroll")).toMatchObject({ rerollScope: "psychicDetect", rerollMode: "keepBest", rerollWho: "self" });
    expect(entries.find(e => e.kind === "capability")?.capabilityKey).toBe(WITCHFINDER_CAP);
  });

  it("возможность заведена в реестре и называет читателя", () => {
    expect(CAPABILITIES[WITCHFINDER_CAP].reader).toContain("psychicDetect");
  });
});

describe("Ведьмоискатель: переброс только при отметке «засекаю/распознаю психосилу»", () => {
  const wf = () => packTalent("Witchfinder");

  it("Awareness с отметкой — переброс; без неё — нет (книга: только на засекание психосил)", () => {
    expect(rerolls([wf()], { ...AWARENESS, psychicDetect: true })).toEqual(["psychicDetect"]);
    expect(rerolls([wf()], AWARENESS)).toEqual([]);
  });

  it("Forbidden Lore (Psykers) с отметкой — переброс; без неё — нет", () => {
    expect(rerolls([wf()], { ...LORE_PSYKERS, psychicDetect: true })).toEqual(["psychicDetect"]);
    expect(rerolls([wf()], LORE_PSYKERS)).toEqual([]);
  });

  it("без Таланта переброса нет даже с отметкой", () => {
    expect(rerolls([], { ...AWARENESS, psychicDetect: true })).toEqual([]);
  });

  it("отметка не открывает переброс на сопротивление психосиле и другие тесты", () => {
    expect(rerolls([wf()], { kind: "skill", char: "wp", psychicThreat: true })).toEqual([]);
    expect(rerolls([wf()], { kind: "skill", char: "wp" })).toEqual([]);
  });
});

describe("witchfinderTestKind: когда предлагать галочку", () => {
  it("Awareness — засекание", () => {
    expect(witchfinderTestKind(AWARENESS)).toBe("detect");
  });

  it("Forbidden Lore с Псайкерами — распознание (в том числе совмещённая «Варп, Демоны и Псайкеры»)", () => {
    expect(witchfinderTestKind(LORE_PSYKERS)).toBe("recognize");
    expect(witchfinderTestKind({ group: "forbiddenLore", specialty: "Warp, Daemons and Psykers" })).toBe("recognize");
    expect(witchfinderTestKind({ group: "forbiddenLore", specialty: "Варп, Демоны и Псайкеры" })).toBe("recognize");
  });

  it("Forbidden Lore про другое (Демоны, Ксеносы) и прочие навыки — галочки нет", () => {
    expect(witchfinderTestKind({ group: "forbiddenLore", specialty: "Daemons / Демоны" })).toBeNull();
    expect(witchfinderTestKind({ group: "forbiddenLore", specialty: "Xenos" })).toBeNull();
    expect(witchfinderTestKind({ skill: "psyniscience" })).toBeNull();
    expect(witchfinderTestKind({ group: "scholasticLore", specialty: "Psykers" })).toBeNull();
    expect(witchfinderTestKind({ kind: "skill", char: "per" })).toBeNull();
    expect(witchfinderTestKind(null)).toBeNull();
  });
});
