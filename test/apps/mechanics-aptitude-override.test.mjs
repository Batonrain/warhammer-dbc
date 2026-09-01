// test/apps/mechanics-aptitude-override.test.mjs
//
// wdbc-zk69: запись Конструктора kind:"capability" получает второй режим
// (capabilityMode:"aptOverride") — «Навык/Талант/Характеристика всегда
// Дружественный/Враждебный, независимо от Покровительства» (Африэль/
// Эльданар/Серый Человек). Превращение в правило — test/rules/capability.test.mjs;
// здесь — только Конструктор (blankMechEntry/describeMechEntry).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { blankMechEntry, describeMechEntry } from "../../module/apps/mechanics.mjs";

describe("kind:capability — override склонности (wdbc-zk69)", () => {
  it("blankMechEntry заводит запись в обычном режиме «флаг» по умолчанию", () => {
    const e = blankMechEntry("capability");
    expect(e.capabilityMode).toBe("flag");
    expect(e.capabilityAptScope).toBe("skill");
    expect(e.capabilityAptMatch).toBe("");
    expect(e.capabilityAptAlign).toBe("ally");
  });

  it("describeMechEntry в режиме «флаг» — превью как раньше, без override-текста", () => {
    const e = { ...blankMechEntry("capability"), capabilityKey: "healing.astartes" };
    const text = describeMechEntry(e);
    expect(text.startsWith("Возможность:")).toBe(true);
    expect(text).not.toContain("независимо от Покровительства");
  });

  it("describeMechEntry без совпадения — жалоба в превью, не тихая заглушка", () => {
    const e = { ...blankMechEntry("capability"), capabilityMode: "aptOverride" };
    expect(describeMechEntry(e)).toContain("не задано совпадение");
  });

  it("describeMechEntry — Навык, Дружественный", () => {
    const e = { ...blankMechEntry("capability"), capabilityMode: "aptOverride",
      capabilityAptScope: "skill", capabilityAptMatch: "Deceive", capabilityAptAlign: "ally" };
    expect(describeMechEntry(e)).toBe("Навык «Deceive» — Дружественный независимо от Покровительства");
  });

  it("describeMechEntry — Характеристика, Враждебный", () => {
    const e = { ...blankMechEntry("capability"), capabilityMode: "aptOverride",
      capabilityAptScope: "characteristic", capabilityAptMatch: "ws", capabilityAptAlign: "enemy" };
    expect(describeMechEntry(e)).toBe("Характеристика «ws» — Враждебный независимо от Покровительства");
  });

  it("describeMechEntry — Талант через целую группу", () => {
    const e = { ...blankMechEntry("capability"), capabilityMode: "aptOverride",
      capabilityAptScope: "talent", capabilityAptMatch: "группа:Скорость", capabilityAptAlign: "ally" };
    expect(describeMechEntry(e)).toBe("Талант «группа:Скорость» — Дружественный независимо от Покровительства");
  });
});
