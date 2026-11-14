// dbc-114 (14.11.2026), пачка 9: Черты-«правила стола» (кнопка-памятка) и Черты, ждущие подсистему. Фикстуры — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
// Пачка 9: Черты, у которых по решению владельца механики нет вовсе («Правило стола, механики нет»);
// пачка 11: остальные памятки — механика ждёт задачу Sahara (проверяет trait-capabilities-all-read.test.mjs).
const withReminder = docs.filter(d => /Правило стола, механики нет/.test(d.system?.notes ?? "")
  && JSON.stringify(d.flags?.["warhammer-dbc"]?.mechanics ?? []).includes("Памятка"));

describe("кнопки-памятки у Черт — правил стола", () => {
  it("их 35 (сверка с решением владельца 14.11.2026)", () => {
    expect(withReminder).toHaveLength(35);
  });
  it("код каждой кнопки — исполнимое тело async-функции и пишет benefit Черты в чат", () => {
    for (const d of withReminder) {
      const s = d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "script" && /Памятка/.test(e.label));
      expect(s.code, d.name).toContain("ChatMessage.create");
      expect(s.code, d.name).toContain("item.system?.benefit");
      expect(() => new Function("item", "actor", "ChatMessage", `return (async function(){${s.code}})`), d.name).not.toThrow();
    }
  });
});

describe("Черты, ждущие подсистему", () => {
  const waiting = Object.entries(CAPABILITIES).filter(([k, v]) => k.startsWith("trait.") && /^ЖДЁТ ПОДСИСТЕМУ/.test(v.reader));
  it("22 Черты, у каждой в читателе номер задачи Sahara", () => {
    expect(waiting).toHaveLength(22);
    for (const [k, v] of waiting) expect(v.reader, k).toMatch(/task-[0-9a-f]{4}/);
  });
});
