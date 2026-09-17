// test/apps/organ-of-chaos.test.mjs
//
// Мутация «Organ of Chaos/Орган Хаоса» (wdbc-1rno): книга не даёт формулы
// (характеристику и малую способность решает ГМ на месте выдачи) — кнопка
// на КОНКРЕТНОМ экземпляре предмета пишет выбор записью kind:"characteristic"
// (Unnatural X +1, тот же приём, что apps/hand-of-khorne.mjs::setApEntry) +
// свободный текст малой способности в system.notes.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { useOrganOfChaos, organOfChaosButtonHtml, isOrganOfChaosItem } from "../../module/apps/organ-of-chaos.mjs";

function fakeItem({ name = "Organ of Chaos / Орган Хаоса", capabilityKey = "mutation.organOfChaos" } = {}) {
  const store = {};
  const item = {
    id: "item1", type: "mutation", name,
    system: { notes: "" },
    effects: [],
    flags: { "warhammer-dbc": { mechanics: [{ id: "g0", operator: "AND", entries: [
      { id: "cap1", kind: "capability", capabilityKey, label: "" }
    ] }] } },
    getFlag: (ns, key) => (key === "mechanics" ? item.flags[ns]?.mechanics : store[key]),
    setFlag: async (ns, key, value) => {
      if (key === "mechanics") item.flags[ns] = { ...item.flags[ns], mechanics: value };
      else store[key] = value;
      return item;
    },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = item;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    },
    createEmbeddedDocuments: async (docType, docs) => { item.effects.push(...docs); return item.effects; },
    deleteEmbeddedDocuments: async (docType, ids) => { item.effects = item.effects.filter(e => !ids.includes(e.id)); return ids; }
  };
  return item;
}

const mechEntries = item => (item.getFlag("warhammer-dbc", "mechanics") || []).flatMap(g => g.entries);

beforeEach(resetCaptured);

describe("isOrganOfChaosItem", () => {
  it("опознаёт по capabilityKey", () => {
    expect(isOrganOfChaosItem(fakeItem())).toBe(true);
  });
  it("не путает с другой Мутацией", () => {
    expect(isOrganOfChaosItem(fakeItem({ name: "Boneless / Бескостный", capabilityKey: "mutation.boneless" }))).toBe(false);
  });
});

describe("useOrganOfChaos", () => {
  it("пишет Unnatural X (+1) записью kind:\"characteristic\" (field:bonus) + малую способность в notes", async () => {
    const item = fakeItem();
    const actor = { name: "Носитель" };
    const promise = useOrganOfChaos(actor, item);
    await captured.press("ok", {
      querySelector: sel => {
        if (sel === "#ooc-char") return { value: "s" };
        if (sel === "#ooc-ability") return { value: "Рога — +1d5 урона рогами при Натиске" };
        return null;
      }
    });
    await promise;

    const entry = mechEntries(item).find(e => e.id === "organ-of-chaos-unnatural");
    expect(entry).toMatchObject({ kind: "characteristic", charKey: "s", field: "bonus", op: "add", value: 1 });
    expect(item.system.notes).toBe("Рога — +1d5 урона рогами при Натиске");
    expect(captured.chat.at(-1).content).toContain("Unnatural S");
  });

  it("перенастройка обновляет ТУ ЖЕ запись, не заводит вторую", async () => {
    const item = fakeItem();
    const actor = { name: "Носитель" };
    const run = async (charKey) => {
      const promise = useOrganOfChaos(actor, item);
      await captured.press("ok", { querySelector: sel => sel === "#ooc-char" ? { value: charKey } : (sel === "#ooc-ability" ? { value: "" } : null) });
      await promise;
    };
    await run("s");
    await run("wp");

    const entries = mechEntries(item).filter(e => e.id === "organ-of-chaos-unnatural");
    expect(entries).toHaveLength(1);
    expect(entries[0].charKey).toBe("wp");
  });

  it("отмена диалога — ничего не пишет", async () => {
    const item = fakeItem();
    const actor = { name: "Носитель" };
    const promise = useOrganOfChaos(actor, item);
    await captured.press("cancel", { querySelector: () => null });
    await promise;
    expect(mechEntries(item).find(e => e.id === "organ-of-chaos-unnatural")).toBeUndefined();
  });

  it("не «Орган Хаоса» — ничего не делает", async () => {
    const other = fakeItem({ name: "Boneless / Бескостный", capabilityKey: "mutation.boneless" });
    await useOrganOfChaos({ name: "Носитель" }, other);
    expect(captured.dialog).toBeNull();
  });
});

describe("organOfChaosButtonHtml", () => {
  it("статус «не настроен» до первой настройки", () => {
    expect(organOfChaosButtonHtml(fakeItem(), {})).toContain("не настроен");
  });
  it("показывает выбранную характеристику после настройки", async () => {
    const item = fakeItem();
    const promise = useOrganOfChaos({ name: "Носитель" }, item);
    await captured.press("ok", { querySelector: sel => sel === "#ooc-char" ? { value: "int" } : (sel === "#ooc-ability" ? { value: "" } : null) });
    await promise;
    expect(organOfChaosButtonHtml(item, {})).toContain("Int");
  });
  it("пусто у другой Мутации", () => {
    expect(organOfChaosButtonHtml(fakeItem({ name: "Boneless / Бескостный", capabilityKey: "mutation.boneless" }), {})).toBe("");
  });
});
