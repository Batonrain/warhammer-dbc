// test/sheets/restore-ammo-button.test.mjs
//
// Стр. 41, wdbc-x1nz.2.61: кнопка «Восстановить» испорченные Клином патроны
// живёт независимо от «Расклинить» — гейтится своим полем w.jammedAmmo, а не
// w.jammed (сам Клин может быть уже снят, а патроны — ещё нет).

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const hbs = fs.readFileSync(path.resolve(import.meta.dirname,
  "../../templates/actor/parts/tab-combat.hbs"), "utf8");

describe("Кнопка восстановления испорченных Клином патронов", () => {
  it("гейтится по w.jammedAmmo, не по w.jammed", () => {
    const start = hbs.indexOf("wh-sheet-restore-ammo-btn");
    expect(start).toBeGreaterThan(-1);
    const before = hbs.slice(Math.max(0, start - 120), start);
    expect(before).toContain("{{#if w.jammedAmmo}}");
  });

  it("зовёт rollRestoreJammedAmmo, не rollClearJam", () => {
    expect(hbs).toContain("wh-sheet-restore-ammo-btn");
  });
});
