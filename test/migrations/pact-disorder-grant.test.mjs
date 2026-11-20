// test/migrations/pact-disorder-grant.test.mjs
//
// Ревью #581 п.1: Черты Пактов получили scriptOnGrant на СТАРОЙ записи — у
// уже играющих её id давно в mechanicsApplied, «Обновить мир» скрипт не
// запустит. Миграция выдаёт расстройство тем же grantStartingDisorder.
// Параметры сверяются с настоящими JSON packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { allPackDocuments } from "../support/pack-docs.mjs";
import { PACT_DISORDERS, pactDisorderGrants } from "../../module/migrations/pact-disorder-grant.mjs";

const trait = (name, id = "T1") => ({ id, type: "trait", name, system: {}, flags: {} });
const disorder = name => ({ id: "D1", type: "mentalDisorder", name, system: {}, flags: {} });

describe("Расстройства Пактов у уже играющих", () => {
  it("параметры совпадают со скриптом записи Черты в паке", () => {
    const traits = allPackDocuments("traits").map(d => d.doc);
    for (const p of PACT_DISORDERS) {
      const doc = traits.find(t => t.name.startsWith(p.trait + " /"));
      expect(doc, p.trait).toBeTruthy();
      const code = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.scriptOnGrant).code;
      expect(code).toContain(`name: "${p.opts.name}", severity: ${p.opts.severity}, severityMin: ${p.opts.severityMin}`);
      expect(code).toContain(`pactScaled: ${p.opts.pactScaled}`);
    }
  });

  it("Черта есть, расстройства нет — выдать от этой Черты", () => {
    const t = trait("Dream Chaser / Гоняющийся за Мечтой");
    const out = pactDisorderGrants([t]);
    expect(out).toHaveLength(1);
    expect(out[0].item).toBe(t);
    expect(out[0].opts).toMatchObject({ name: "Психопатия", severity: -1, severityMin: -1, incurable: true, pactScaled: true });
  });

  it("идемпотентно: расстройство уже на листе — ничего", () => {
    expect(pactDisorderGrants([trait("Supreme Avarice / Высшая Алчность"), disorder("Перфекционизм")])).toEqual([]);
  });

  it("чужое расстройство не мешает; без Черты — ничего", () => {
    expect(pactDisorderGrants([trait("Vengeful One / Мстительный"), disorder("Сноб")])).toHaveLength(1);
    expect(pactDisorderGrants([disorder("Сноб"), { ...trait("Deathless Oath / Несмертная Клятва"), type: "talent" }])).toEqual([]);
  });
});
