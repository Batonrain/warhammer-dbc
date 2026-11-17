// Каждый снаряд техники (weaponTag) должен иметь орудие в паке с тем же английским именем,
// иначе в игре снаряд ни к чему не подбирается (wdbc-nzzgn).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { weaponAmmoTagOf } from "../../module/rules/ammo-override.mjs";

function readJson(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) readJson(p, out);
    else if (e.name.endsWith(".json") && !e.name.startsWith("_Folder")) out.push(JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return out;
}

describe("снаряды техники ↔ орудия", () => {
  const tags = new Set(weaponTagsOfWeapons());
  const shells = readJson("packs-src/ammunition/Техника").filter(a => a.system?.weaponTag);
  function weaponTagsOfWeapons() {
    return readJson("packs-src/vehicle-weapons").map(w => weaponAmmoTagOf(w));
  }

  for (const shell of shells) {
    it(`${shell.name}: орудие «${shell.system.weaponTag}» есть в паке`, () => {
      const tag = shell.system.weaponTag.trim().toLowerCase();
      expect(tags.has(tag)).toBe(true);
    });
  }
});
