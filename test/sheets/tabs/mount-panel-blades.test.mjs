// test/sheets/tabs/mount-panel-blades.test.mjs
//
// wdbc-8nz6: панель «ВЕРХОМ» показывает состояние Лезвий (X) — доступна ли
// кнопка и сколько использований осталось в этот Ход, по рангу Навыка
// управления скакуном/байком.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { mountPanelContext } from "../../../module/sheets/tabs/mount-panel.mjs";

const trait = (name, rating = 0) => ({ type: "trait", name, system: { rating } });

const beast = ({ items = [] } = {}) => ({
  type: "character", uuid: "Actor.beast", items, name: "Скакун",
  system: {
    size: 1, initiative: 3,
    movement: { halfMove: 8 },
    wounds: { value: 14, max: 14, critical: 0 }
  }
});

const rider = ({ ag = 40, survival = "trained", bladesUsed = 0, mountUuid = "Actor.beast" } = {}) => ({
  type: "character", uuid: "Actor.rider", items: [], name: "Всадник",
  system: {
    size: 0, initiative: 5,
    characteristics: { ag: { total: ag } },
    skills: { survival: { rank: survival, total: 10 } },
    groupSkills: { operate: [] },
    mount: { uuid: mountUuid, role: "rider", speed: "half", bladesUsed }
  }
});

describe("mountPanelContext — Лезвия (X)", () => {
  it("скакун без Черты — блок недоступен", () => {
    const ctx = mountPanelContext(rider(), [rider(), beast()]);
    expect(ctx.mountBlades.available).toBe(false);
  });

  it("с Чертой, нетренированный Навык — доступности нет, кнопка выключена", () => {
    const m = beast({ items: [trait("Blades / Лезвия (X)", 4)] });
    const ctx = mountPanelContext(rider({ survival: "untrained" }), [rider(), m]);
    expect(ctx.mountBlades.available).toBe(true);
    expect(ctx.mountBlades.max).toBe(0);
    expect(ctx.mountBlades.allowed).toBe(false);
  });

  it("Опытный (+20) даёт 2 использования, использовано 1 — ещё разрешено", () => {
    const m = beast({ items: [trait("Blades / Лезвия (X)", 4)] });
    const ctx = mountPanelContext(rider({ survival: "veteran", bladesUsed: 1 }), [rider(), m]);
    expect(ctx.mountBlades.max).toBe(2);
    expect(ctx.mountBlades.used).toBe(1);
    expect(ctx.mountBlades.allowed).toBe(true);
  });

  it("лимит исчерпан — кнопка выключена", () => {
    const m = beast({ items: [trait("Blades / Лезвия (X)", 4)] });
    const ctx = mountPanelContext(rider({ survival: "trained", bladesUsed: 1 }), [rider(), m]);
    expect(ctx.mountBlades.allowed).toBe(false);
  });
});
