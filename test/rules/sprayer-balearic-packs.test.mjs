// test/rules/sprayer-balearic-packs.test.mjs
//
// 3-8318: Таланты «Распылитель» (Sprayer) и «Балеарец» (Balearic) выдают свои
// Возможности из НАСТОЯЩИХ документов пака. Читатели в коде (defense.mjs,
// attack.mjs) зелёные на подставных акторах, но без записи Конструктора на
// Таланте механика не включилась бы ни у кого (ловушка «читатель есть, а
// выдачи нет» — test/tools/capability-reachable-ratchet.test.mjs).

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";   // defense.mjs наследует классы Foundry при загрузке
import fs from "node:fs";
import path from "node:path";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { SPRAYER_CAPABILITY } from "../../module/combat/defense.mjs";
import { BALEARIC_CAPABILITY, balearicSbBonus } from "../../module/rules/throwing-talents.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Документ Таланта из packs-src по префиксу имени файла. */
function talentDoc(prefix) {
  const base = path.join(ROOT, "packs-src", "talents");
  const hits = [];
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(base, d.name))) {
      if (f.startsWith(prefix)) hits.push(path.join(base, d.name, f));
    }
  }
  expect(hits, `в packs-src/talents должен быть ровно один ${prefix}*`).toHaveLength(1);
  return JSON.parse(fs.readFileSync(hits[0], "utf8"));
}

/** Актор с одним предметом-Талантом; имя испорчено, чтобы совпасть мог только ключ. */
function bearerOf(doc, ag = 50) {
  const item = { id: "it1", type: doc.type, name: "ИСПОРЧЕННОЕ ИМЯ", system: { ...(doc.system ?? {}) }, flags: doc.flags };
  return { type: "character", system: { characteristics: { ag: { total: ag, bonus: Math.floor(ag / 10) } } }, items: [item] };
}

describe("Sprayer — запись Конструктора на Таланте", () => {
  it("носитель получает flamer.core.sprayer", () => {
    expect(hasRuleFlag(bearerOf(talentDoc("Sprayer___")), SPRAYER_CAPABILITY)).toBe(true);
  });
  it("без Таланта возможности нет", () => {
    expect(hasRuleFlag({ type: "character", system: { characteristics: {} }, items: [] }, SPRAYER_CAPABILITY)).toBe(false);
  });
});

describe("Balearic — запись Конструктора на Таланте", () => {
  it("носитель получает throwing.core.balearic, прибавка = ½A.b вверх", () => {
    const a = bearerOf(talentDoc("Balearic___"), 50);   // A.b 5
    expect(hasRuleFlag(a, BALEARIC_CAPABILITY)).toBe(true);
    expect(balearicSbBonus(a)).toBe(3);
  });
  it("A.b 4 → +2; A.b 0 → 0 (не уходит в минус)", () => {
    expect(balearicSbBonus(bearerOf(talentDoc("Balearic___"), 40))).toBe(2);
    expect(balearicSbBonus(bearerOf(talentDoc("Balearic___"), 5))).toBe(0);
  });
  it("без Таланта прибавки нет", () => {
    expect(balearicSbBonus({ type: "character", system: { characteristics: { ag: { bonus: 6 } } }, items: [] })).toBe(0);
  });
});
