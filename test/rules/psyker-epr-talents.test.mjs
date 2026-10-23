// test/rules/psyker-epr-talents.test.mjs
//
// Restraint / Сдержанность и Child of the Warp / Дитя Варпа (глава 3,
// «Псайкана», Sahara 3-28; DoomBC — Основная книга, packs-src/books/core.json):
//   Restraint — «Он может рассчитывать свой эPR для манифестации в безопасном
//     режиме как тPR–3 вместо ½тPR как обычно».
//   Child of the Warp — «Он получает +1 PR при Усиленной манифестации».

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { manifestEprFlags, safeModeEpr, CHILD_OF_THE_WARP_PUSH_BONUS }
  from "../../module/rules/psyker.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (...items) => ({ items });

describe("manifestEprFlags: опознание Талантов", () => {
  it("находит оба Таланта по любой половине двуязычного имени", () => {
    expect(manifestEprFlags(actorWith(talent("Restraint / Сдержанность"), talent("Дитя Варпа"))))
      .toEqual({ restraint: true, childOfWarp: true });
  });

  it("без Талантов — оба ложь; одноимённая Черта/предмет другого типа не считается", () => {
    expect(manifestEprFlags(actorWith())).toEqual({ restraint: false, childOfWarp: false });
    expect(manifestEprFlags(actorWith({ type: "trait", name: "Restraint", system: {} })))
      .toEqual({ restraint: false, childOfWarp: false });
    expect(manifestEprFlags(null)).toEqual({ restraint: false, childOfWarp: false });
  });
});

describe("safeModeEpr", () => {
  it("без Сдержанности — ½ mPR с округлением вверх, как раньше", () => {
    expect(safeModeEpr(7)).toBe(4);
    expect(safeModeEpr(8)).toBe(4);
    expect(safeModeEpr(0)).toBe(0);
  });

  it("со Сдержанностью — mPR−3, когда это больше половины", () => {
    expect(safeModeEpr(9, { restraint: true })).toBe(6);   // ½ = 5
    expect(safeModeEpr(10, { restraint: true })).toBe(7);  // ½ = 5
  });

  it("со Сдержанностью — не хуже половины там, где mPR−3 меньше (малый mPR при Таланте PR 7+)", () => {
    expect(safeModeEpr(7, { restraint: true })).toBe(4);   // 7−3 = 4 = ceil(7/2)
    expect(safeModeEpr(4, { restraint: true })).toBe(2);   // 4−3 = 1 < 2
    expect(safeModeEpr(1, { restraint: true })).toBe(1);   // не уходит в ноль и минус
  });
});

describe("Дитя Варпа", () => {
  it("+1 к эPR при Усиленной манифестации", () => {
    expect(CHILD_OF_THE_WARP_PUSH_BONUS).toBe(1);
  });
});

describe("Таланты в паке", () => {
  const dir = path.resolve(import.meta.dirname, "../../packs-src/talents/Псайкана");
  const load = prefix => JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.startsWith(prefix))), "utf8"));
  const caps = doc => (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []).map(e => e.capabilityKey);

  it("Restraint несёт возможность psyker.core.restraint и заметку без «Не смоделировано»", () => {
    const doc = load("Restraint");
    expect(caps(doc)).toEqual(["psyker.core.restraint"]);
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });

  it("Child of the Warp несёт возможность psyker.core.childOfTheWarp и заметку без «Не смоделировано»", () => {
    const doc = load("Child_of_the_Warp");
    expect(caps(doc)).toEqual(["psyker.core.childOfTheWarp"]);
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });
});
