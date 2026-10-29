// test/data/mark-of-tzeentch-bound.test.mjs
//
// Метка Тзинча (корбук, Метки): «Трейт Psyker (связанный, если персонаж не был
// псайкером до этого)» — task-0469-bc1b. Реализовано записью kind:"script" с
// «При выдаче» на самой Метке (packs-src/traits/Метки_Богов). Условное «если не
// был» не выразить возможностью psyker.alwaysBound: она форсирует класс каждый
// пересчёт и затёрла бы ручную смену Природы Дара — поэтому разовая запись.
//
// Тест гоняет НАСТОЯЩИЙ код записи из пака (не копию в тесте) на подставном
// акторе: кто «уже был псайкером», у того класс не трогается; у нового псайкера
// ставится «bound» один раз, и ручная смена потом не откатывается.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { applyMechEntry } from "../../module/apps/mechanics.mjs";

const SYS = "warhammer-dbc";

const MARK = allPackDocuments("traits").map(d => d.doc)
  .find(d => d.name.split("/")[0].trim() === "Mark of Tzeentch");
const SCRIPT = (MARK?.flags?.[SYS]?.mechanics ?? []).flatMap(g => g.entries).find(e => e.kind === "script");

const markItem = actor => ({ id: "mark1", name: MARK.name, type: "trait", actor, getFlag: () => undefined, setFlag: async () => {} });

const psykerTrait = (grantedByItem) => ({
  id: grantedByItem ? "tFromMark" : "tOwn", type: "trait", name: "Psyker / Псайкер",
  flags: grantedByItem ? { [SYS]: { grantedByItem } } : {}
});

/** Подставной актор: update применяет плоские пути к system — как делает Foundry. Класс по умолчанию — как в схеме (_creature.mjs). */
function fakeActor({ isPsyker = false, cls = "bound", items = [] } = {}) {
  const actor = {
    system: { isPsyker, psyker: { class: cls } },
    items,
    updates: [],
    async update(patch) {
      this.updates.push(patch);
      for (const [path, v] of Object.entries(patch)) {
        const keys = path.split(".").slice(1);
        let o = this.system;
        for (const k of keys.slice(0, -1)) o = o[k];
        o[keys.at(-1)] = v;
      }
    }
  };
  return actor;
}

describe("Метка Тзинча: запись «связанный, если не был псайкером»", () => {
  it("новый псайкер (Трейт Psyker только от самой Метки) становится Связанным", async () => {
    const actor = fakeActor({ cls: "unbound", items: [psykerTrait("mark1")] });
    await applyMechEntry(actor, SCRIPT, markItem(actor));
    expect(actor.system.psyker.class).toBe("bound");
    expect(actor.updates).toEqual([{ "system.psyker.class": "bound" }]);
  }, PACK_SCAN_TIMEOUT);

  it("уже был псайкером (флаг «Пси-Пробуждение») — Несвязанный остаётся Несвязанным", async () => {
    const actor = fakeActor({ isPsyker: true, cls: "unbound" });
    await applyMechEntry(actor, SCRIPT, markItem(actor));
    expect(actor.system.psyker.class).toBe("unbound");
    expect(actor.updates).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("уже был псайкером (Трейт Psyker от другого источника) — класс не трогается", async () => {
    const actor = fakeActor({ cls: "unbound", items: [psykerTrait(null), psykerTrait("mark1")] });
    await applyMechEntry(actor, SCRIPT, markItem(actor));
    expect(actor.system.psyker.class).toBe("unbound");
    expect(actor.updates).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("один раз: повторный прогон Механики запись не переигрывает, ручная смена класса не откатывается", async () => {
    const actor = fakeActor({ cls: "unbound", items: [psykerTrait("mark1")] });
    const item = markItem(actor);
    const applied = new Set();
    await applyMechEntry(actor, SCRIPT, item, false, applied);
    expect(actor.system.psyker.class).toBe("bound");
    // Игрок сам сменил Природу Дара; Механику предмета прогнали заново (updateItem).
    actor.system.psyker.class = "unbound";
    await applyMechEntry(actor, SCRIPT, item, false, applied);
    expect(actor.system.psyker.class).toBe("unbound");
    expect(actor.updates).toHaveLength(1);
  }, PACK_SCAN_TIMEOUT);

  it("новый псайкер с классом по умолчанию (уже «bound») — писать нечего", async () => {
    const actor = fakeActor({ items: [psykerTrait("mark1")] });
    await applyMechEntry(actor, SCRIPT, markItem(actor));
    expect(actor.system.psyker.class).toBe("bound");
    expect(actor.updates).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  // «Обновить мир» дописывает эту запись в Метку, выданную ДО неё: запись ещё не
  // в mechanicsApplied и отыгрывается, а ГМ мог давно выставить «Несвязанный».
  it("повторный прогон у старой Метки не трогает класс, выставленный ГМом", async () => {
    const actor = fakeActor({ cls: "unbound", items: [psykerTrait("mark1")] });
    const oldIds = MARK.flags[SYS].mechanics.flatMap(g => g.entries).filter(e => e.kind !== "script").map(e => e.id);
    const oldMark = { ...markItem(actor), getFlag: (s, k) => (s === SYS && k === "mechanicsApplied" ? oldIds : undefined) };
    await applyMechEntry(actor, SCRIPT, oldMark);
    expect(actor.system.psyker.class).toBe("unbound");
    expect(actor.updates).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("возможность psyker.alwaysBound на Метке НЕ стоит (она форсировала бы класс безусловно)", () => {
    const keys = (MARK.flags[SYS].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).not.toContain("psyker.alwaysBound");
  }, PACK_SCAN_TIMEOUT);
});
