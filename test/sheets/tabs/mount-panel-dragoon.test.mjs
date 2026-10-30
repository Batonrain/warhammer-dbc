// test/sheets/tabs/mount-panel-dragoon.test.mjs
//
// Панель «ВЕРХОМ» показывала штраф стрельбы с седла без поправки Драгуна /
// Мастера-Драгуна (Sahara maximal-blast-10-rng, п.3): окно атаки считало верно
// (rules/damage-talents.mjs::unstablePlatformPenalty — только пистолеты и
// винтовки), а панель давала общее число. Теперь рядом — вторая цифра для
// пистолета/винтовки.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { mountPanelContext } from "../../../module/sheets/tabs/mount-panel.mjs";

const beast = () => ({
  type: "character", uuid: "Actor.beast", items: [], name: "Скакун",
  system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
});

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const rider = (items, speed = "full") => ({
  type: "character", uuid: "Actor.rider", items, name: "Всадник",
  system: {
    size: 0, initiative: 5,
    characteristics: { ag: { total: 40 } },
    skills: { survival: { rank: "trained", total: 10 } },
    groupSkills: { operate: [] },
    mount: { uuid: "Actor.beast", role: "rider", speed }
  }
});

describe("mountPanelContext: штраф стрельбы с седла и Драгун", () => {
  it("без Таланта — одно число, второй строки нет", () => {
    const r = rider([]);
    const ctx = mountPanelContext(r, [r, beast()]);
    expect(ctx.mountRanged).toBe(-20);
    expect(ctx.mountRangedLight).toBe(null);
    expect(ctx.mountRangedLightNote).toBe("");
  });

  it("Драгун: общий штраф −20, а для пистолета/винтовки −10", () => {
    const r = rider([talent("Dragoon / Драгун")]);
    const ctx = mountPanelContext(r, [r, beast()]);
    expect(ctx.mountRanged).toBe(-20);
    expect(ctx.mountRangedLight).toBe(-10);
    expect(ctx.mountRangedLightNote).toContain("Драгун");
  });

  it("Мастер-Драгун: для пистолета/винтовки штрафа нет", () => {
    const r = rider([talent("Master Dragoon / Мастер-Драгун")]);
    const ctx = mountPanelContext(r, [r, beast()]);
    expect(ctx.mountRangedLight).toBe(0);
    expect(ctx.mountRangedLightNote).toContain("Мастер-Драгун");
  });

  it("штрафа нет (скакун стоит) — Талант нечего поправлять", () => {
    const r = rider([talent("Dragoon / Драгун")], "still");
    const ctx = mountPanelContext(r, [r, beast()]);
    expect(ctx.mountRanged).toBe(0);
    expect(ctx.mountRangedLight).toBe(null);
  });
});
