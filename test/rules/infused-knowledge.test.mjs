// test/rules/infused-knowledge.test.mjs
//
// Infused Knowledge / Вложенные Знания (sage.core.infusedKnowledge), решение
// владельца 24.10.2026 (в силе 26.10.2026): «Он считается имеющим все Common Lore
// и Scholastic Lore изученными на +0. Он не получает эти Навыки в расчёте
// продвижений и должен изучить их как обычно, чтобы продвинуть на +10 и выше или
// для изучения другого Таланта» — Lore считаются на +0 ТОЛЬКО для тестов (итог
// записи), пороги Талантов и требования Lore по-прежнему смотрят на ступень.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { checkRequirement } from "../../module/constants/talent-requirements.mjs";

const infused = () => ({ id: "ik", name: "Infused Knowledge / Вложенные Знания", type: "talent", system: {},
  getFlag: () => undefined, flags: {} });

function characterWith(groupSkills, items = [], intBase = 40) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.int.base = intBase;
  Object.assign(system.groupSkills, groupSkills);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}
const entry = (specialty, rank = "untrained", extra = {}) => ({ specialty, rank, cost: 0, total: -20, ...extra });

describe("Вложенные Знания: Common/Scholastic Lore не ниже +0 в тестах", () => {
  it("нетренированные Common и Scholastic Lore считаются на +0 (Int 40 → 40), не на −20", () => {
    const s = characterWith({ commonLore: [entry("Империум")], scholasticLore: [entry("Тактика")] }, [infused()]);
    expect(s.groupSkills.commonLore[0].total).toBe(40);
    expect(s.groupSkills.scholasticLore[0].total).toBe(40);
  });

  it("без Таланта нетренированное Lore по-прежнему −20", () => {
    const s = characterWith({ commonLore: [entry("Империум")] }, []);
    expect(s.groupSkills.commonLore[0].total).toBe(20);
  });

  it("выше +0 ничего не добавляется и не отнимается: «Тренированное» остаётся +10", () => {
    const s = characterWith({ commonLore: [entry("Империум", "trained")] }, [infused()]);
    expect(s.groupSkills.commonLore[0].total).toBe(50);
  });

  it("постоянный модификатор записи (mod) прибавляется поверх +0", () => {
    const s = characterWith({ commonLore: [entry("Империум", "untrained", { mod: 5 })] }, [infused()]);
    expect(s.groupSkills.commonLore[0].total).toBe(45);
  });

  it("Forbidden Lore, Язык и прочие группы не затронуты", () => {
    const s = characterWith({ forbiddenLore: [entry("Ксеносы")], linguistics: [entry("Готик")], trade: [entry("Кузнец")] }, [infused()]);
    expect(s.groupSkills.forbiddenLore[0].total).toBe(20);
    expect(s.groupSkills.linguistics[0].total).toBe(20);
    expect(s.groupSkills.trade[0].total).toBe(20);
  });

  it("ступень записи НЕ меняется — пороги Талантов и требования Lore смотрят на неё", () => {
    const s = characterWith({ commonLore: [entry("Империум")] }, [infused()]);
    expect(s.groupSkills.commonLore[0].rank).toBe("untrained");
    expect(s.groupSkills.commonLore[0].cost).toBe(0);
    // Требование «Common Lore (Империум)+10» с этим Талантом остаётся невыполненным.
    const actor = { type: "character", system: s, items: [infused()] };
    expect(checkRequirement(actor, "Common Lore (Империум)+10").state).toBe("fail");
    // Контроль: настоящая ступень «Тренированное» требование закрывает.
    const trained = characterWith({ commonLore: [entry("Империум", "trained")] }, [infused()]);
    expect(checkRequirement({ type: "character", system: trained, items: [infused()] }, "Common Lore (Империум)+10").state).toBe("ok");
  });
});

describe("Вложенные Знания: данные пака", () => {
  it("запись Конструктора есть, возможность названа читателем, заметка без «не реализовано»", () => {
    const doc = packDocById("packs-src/talents/Мудрец", "6XAfVIPWuy6LP3ST");
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("sage.core.infusedKnowledge");
    expect(CAPABILITIES["sage.core.infusedKnowledge"].reader).toMatch(/character\.mjs/);
    expect(doc.system.notes).not.toMatch(/Не реализовано/);
    expect(doc.system.notes).toMatch(/Реализовано/);
  });
});
