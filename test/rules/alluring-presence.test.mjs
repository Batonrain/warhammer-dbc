// dbc-114 (14.11.2026): Чарующее Присутствие — −10 на Избегания против атак демона.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { alluringPresencePenalty } from "../../module/rules/alluring-presence.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

describe("Чарующее Присутствие", () => {
  it("без атакующего штрафа нет", () => expect(alluringPresencePenalty(null)).toBe(0));
  it("в паке Черта выдаёт способность, у неё есть читатель", () => {
    const dir = path.resolve("packs-src/traits");
    const f = fs.readdirSync(dir).find(x => x.startsWith("Alluring_Presence___"));
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const keys = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("defence.enemyEvasionPenalty");
    expect(CAPABILITIES["defence.enemyEvasionPenalty"].reader).toBeTruthy();
  });
});
