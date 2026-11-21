// Чемпион Терминатор: Помазанник, Поглотитель, Фениксиец, Саван Смерти (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  anointedShieldBonus, devourerGrappleSize, isPolearm, phoenicianMainProfile, deathShroudDamageFormula
} from "../../module/rules/terminator-talents.mjs";

const talent = name => ({ type: "talent", name });
const spear = { type: "weapon", name: "Spear", system: { meleeCategory: "Копьё", damage: "1d10+3" } };
const sword = { type: "weapon", name: "Sword", system: { meleeCategory: "Меч", damage: "1d10" } };

describe("Чемпион Терминатор", () => {
  it("Помазанник: +35 к щиту только с меткой", () => {
    expect(anointedShieldBonus({ flags: { "warhammer-dbc": { anointedShield: true } } })).toBe(35);
    expect(anointedShieldBonus({ flags: {} })).toBe(0);
  });
  it("Поглотитель: +1 Размер в Борьбе", () => {
    expect(devourerGrappleSize({ items: [talent("Devourer / Поглотитель")] })).toBe(1);
    expect(devourerGrappleSize({ items: [] })).toBe(0);
  });
  it("Фениксиец: только древковое и только с Талантом", () => {
    const a = { items: [talent("Phoenician / Фениксиец")] };
    expect(isPolearm(spear)).toBe(true);
    expect(phoenicianMainProfile(a, spear)).toBe(true);
    expect(phoenicianMainProfile(a, sword)).toBe(false);
    expect(phoenicianMainProfile({ items: [] }, spear)).toBe(false);
  });
  it("Саван Смерти: урон оружия + S.b", () => {
    expect(deathShroudDamageFormula({ system: { characteristics: { s: { bonus: 8 } } } }, spear)).toBe("1d10+3 + 8");
  });
});

describe("Атраментар (решение 21.11.2026)", () => {
  it("Страх не общий: Талант не выдаёт Черту Fear, а включается до конца сцены", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "packs-src/talents/Элитные_архетипы";
    const sub = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).find(d => readdirSync(`${dir}/${d}`).some(f => f.startsWith("Atramentar")));
    const file = readdirSync(`${dir}/${sub}`).find(f => f.startsWith("Atramentar"));
    const doc = JSON.parse(readFileSync(`${dir}/${sub}/${file}`, "utf8"));
    const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "trait" && /Fear/.test(e.sourceName ?? ""))).toBe(false);
    const src = readFileSync("module/combat/terminator-talents.mjs", "utf8");
    expect(src).toMatch(/activateItemUntil\(item, \{[^}]*sceneOnly: true/);
  });
});
