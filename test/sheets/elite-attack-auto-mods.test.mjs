// #586, живая проверка 21.11.2026: auto-бонусы элитных Талантов (Провидец Войны,
// Бестиарий…) не доезжали до Порога атаки — окно атаки пропускает autoMods только
// по белому списку. Сторож: каждый префикс списка — реальный id правила в коде,
// иначе переименование правила снова тихо выключит бонус.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const src = fs.readFileSync(path.join(ROOT, "module/sheets/attack-dialog.mjs"), "utf8");
const list = JSON.parse("[" + src.match(/ELITE_ATTACK_AUTO_MODS = \[([\s\S]*?)\]/)[1].trim().replace(/,\s*$/, "") + "]");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".mjs") ? [path.join(dir, e.name)] : []);
}
const code = [...walk(path.join(ROOT, "module/rules")), ...walk(path.join(ROOT, "module/combat"))]
  .map(f => fs.readFileSync(f, "utf8")).join("\n");

describe("белый список auto-бонусов элитных архетипов в Пороге атаки", () => {
  it("список не пуст и содержит Провидца Войны и Бестиарий", () => {
    expect(list).toContain("vitkis.warSeer.hit");
    expect(list).toContain("gladiator.bestiarius");
  });
  it("каждый префикс — id правила, который реально заводит код", () => {
    for (const id of list) expect(code.includes(`"${id}`) || code.includes("`" + id), id).toBe(true);
  });
  it("окно атаки без оружия передаёт цель в контекст правил", () => {
    expect(src).toMatch(/collectTestMods\(actor, \{ kind: "attack", isMelee: true, char: "ws", targetActor \}\)/);
  });
});
