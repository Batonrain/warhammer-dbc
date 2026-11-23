// Хуки, что пишут общее состояние, исполняет один активный ГМ (приёмка #597):
// при двух ГМах game.user.isGM пускал обоих — сроки и карточки шли дважды, миграции задваивали щиты.
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("activeGM вместо isGM", () => {
  it("updateWorldTime со сроками активаций/Инзорцизма/Монозависимого", () => {
    const src = read("module/hooks.mjs");
    const at = src.indexOf("clearExpiredActivations(game.time.worldTime)");
    const head = src.slice(src.lastIndexOf('Hooks.on("updateWorldTime"', at), at);
    expect(head).toContain("game.users.activeGM?.isSelf");
    expect(head).not.toMatch(/!game\.user\.isGM\)/);
  });
  it("восполнение пулов в начале боя", () => {
    expect(read("module/hooks.mjs")).toContain("if (game.users.activeGM?.isSelf) await refillResourcePoolsOnCombatStart(combat);");
  });
  it("миграция встроенных щитов Черт", () => {
    const src = read("warhammer-dbc.mjs");
    const at = src.indexOf("migrateTraitShields({ tokensOnly: true })");
    const head = src.slice(src.lastIndexOf('Hooks.once("ready"', at), at);
    expect(head).toContain("if (!game.users.activeGM?.isSelf) return;");
  });
});
