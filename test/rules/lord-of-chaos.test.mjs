// test/rules/lord-of-chaos.test.mjs
//
// Lord of Chaos / Лорд Хаоса (корбук, Миньоны): «увеличивает максимум своих
// Миньонов на 50% (окр.▼)». Сквозная проверка на НАСТОЯЩЕЙ записи пака: Талант
// выдаёт возможность minion.core.lordOfChaos, её читает minionCapacity, а шапка
// блока СОЦИУМ берёт число оттуда же.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { packDocById } from "../support/pack-doc.mjs";
import { minionCapacity } from "../../module/rules/minion-build.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const doc = packDocById("packs-src/talents/Миньоны", "ZHwj3hl6AmeEo2Xk");

describe("Лорд Хаоса — данные", () => {
  it("Талант несёт запись capability с ключом minion.core.lordOfChaos", () => {
    const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === "minion.core.lordOfChaos")).toBe(true);
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });

  it("читатель назван в реестре возможностей", () => {
    expect(CAPABILITIES["minion.core.lordOfChaos"].reader).toContain("minion-build.mjs::minionCapacity");
  });

  it("книга действительно говорит «на 50% (окр.▼)»", () => {
    const book = fs.readFileSync(path.resolve(import.meta.dirname, "../../packs-src/books/core.json"), "utf8");
    expect(book).toContain("максимум своих Миньонов на 50% (окр.▼)");
  });
});

describe("Лорд Хаоса — настоящий Талант на Хозяине", () => {
  const master = (int) => ({
    system: { characteristics: { int: { total: int }, inf: { total: 60 } } },
    items: [{ id: "t", type: "talent", name: doc.name, system: doc.system, flags: doc.flags }]
  });

  it("Хозяин с I 50 (бонус 5): максимум Машин 7 вместо 5", () => {
    expect(minionCapacity(master(50), ["machine"])).toBe(7);
  });

  it("I 30 (бонус 3): 4 — округление вниз от 4,5", () => {
    expect(minionCapacity(master(30), ["machine"])).toBe(4);
  });
});
