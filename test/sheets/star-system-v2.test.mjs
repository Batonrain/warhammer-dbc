// test/sheets/star-system-v2.test.mjs
//
// Лист звёздной системы на ApplicationV2 (wdbc-ff4.10.5). Общий договор с
// шаблоном — в describeV2Sheet; здесь своё: что именно лист показывает
// игроку, а что придерживает до разведки. Это и есть смысл листа — половина
// контекста считается дважды, для ГМа и для игрока.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerStarSystemSheet } from "../../module/sheets/star-system-sheet.mjs";

describeV2Sheet(WarhammerStarSystemSheet, {
  sheet: "module/sheets/star-system-sheet.mjs",
  template: "templates/actor/star-system-sheet.hbs"
});

function body(id, name, system = {}) {
  return { id, name, type: "celestialBody", system: { bodyType: "planet", ...system } };
}

function systemActor(bodies = [], over = {}) {
  const items = [...bodies];
  items.filter = Array.prototype.filter.bind(items);
  items.get = id => items.find(i => i.id === id) ?? null;
  return {
    name: "Джокарис", uuid: "Actor.ss1", isOwner: true, items,
    system: { region: "", derived: { counts: {} }, ...over }
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerStarSystemSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "overview" } }, extra);
}

const ctxOf = actor => WarhammerStarSystemSheet.prototype._prepareContext.call(sheetLike(actor), {});

// Тела без родителя-звезды попадают в orphanZones — это единственная ветка,
// которой хватает одного тела, поэтому проверки строятся на ней.
const rowsOf = ctx => ctx.orphanZones.flatMap(z => z.rows);

beforeEach(() => { globalThis.game.user.isGM = false; });

describe("_prepareContext: что видит игрок", () => {
  it("неразведанное тело с сигналом маскируется", async () => {
    const ctx = await ctxOf(systemActor([body("b1", "Джокарис II", { signal: true })]));
    const [row] = rowsOf(ctx);

    expect(row.name).toBe("Неопознанный сигнал");
    expect(row.icon).toBe("📡");
    expect(row.summary).toBe("");
    expect(row.unscouted).toBe(true);
  });

  it("разведанное тело показывает сводку и ресурсы", async () => {
    const ctx = await ctxOf(systemActor([body("b1", "Джокарис II", {
      scouted: true, bodySize: "large", resources: { ore: 3 }
    })]));
    const [row] = rowsOf(ctx);

    expect(row.name).toBe("Джокарис II");
    expect(row.summary).toContain("Большое");
    expect(row.resChips.map(c => c.value)).toEqual([3]);
  });

  it("сводка ресурсов системы считает только разведанное", async () => {
    const ctx = await ctxOf(systemActor([
      body("b1", "Первая", { scouted: true, resources: { ore: 2 } }),
      body("b2", "Вторая", { resources: { ore: 40 } })          // не разведана
    ]));

    expect(ctx.resourceSummary.map(r => r.value)).toEqual([2]);
  });
});

describe("_prepareContext: что видит ГМ", () => {
  beforeEach(() => { globalThis.game.user.isGM = true; });

  it("имя неразведанного тела не маскируется, но помечено скрытым", async () => {
    const ctx = await ctxOf(systemActor([body("b1", "Джокарис II", { signal: true })]));
    const [row] = rowsOf(ctx);

    expect(row.name).toBe("Джокарис II");
    expect(row.plState).toBe("hidden");
    expect(row.showScout).toBe(true);
  });

  it("сводка ресурсов считает и неразведанное", async () => {
    const ctx = await ctxOf(systemActor([
      body("b1", "Первая", { scouted: true, resources: { ore: 2 } }),
      body("b2", "Вторая", { resources: { ore: 40 } })
    ]));

    expect(ctx.resourceSummary.map(r => r.value)).toEqual([42]);
  });
});

describe("_prepareContext: регион", () => {
  it("регион актора попадает в список, даже если его нет в настройках", async () => {
    const ctx = await ctxOf(systemActor([], { region: "Ультима Сегментум" }));
    expect(ctx.regions[0]).toBe("Ультима Сегментум");
  });
});
