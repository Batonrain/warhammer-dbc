// test/sheets/diseases-perfect-host.test.mjs
//
// Идеальный Хозяин (Дар Нургла, wdbc-1rno): кнопка «снять болезнь» отказывает
// носителю Дара — «не может быть вылечен от болезней».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { activateDiseaseListeners } from "../../module/sheets/tabs/diseases.mjs";
import { PERFECT_HOST } from "../../module/rules/perfect-host.mjs";

/** Минимальный jQuery-подобный html: .find(sel).click(cb) запоминает обработчик. */
function fakeHtml() {
  const handlers = {};
  return {
    handlers,
    find: sel => ({ click: cb => { handlers[sel] = cb; } })
  };
}

function actorWith({ perfectHost = false } = {}) {
  const deleted = [];
  const disease = { id: "d1", type: "disease", name: "Гэллерпокс", system: { active: true },
                    delete: async () => { deleted.push("d1"); },
                    update: async () => {} };
  const items = [disease];
  if (perfectHost) items.push({
    id: "gift", type: "mutation", name: "Perfect Host",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: PERFECT_HOST, label: "" }
    ] }] } }
  });
  const coll = Object.assign(items.slice(), { contents: items, get: id => items.find(i => i.id === id) });
  return { name: "Чемпион", type: "character", system: {}, items: coll, deleted };
}

describe("снятие болезни", () => {
  beforeEach(() => resetCaptured());

  it("обычный персонаж — болезнь снимается", async () => {
    const actor = actorWith();
    const html = fakeHtml();
    activateDiseaseListeners(html, actor);
    await html.handlers[".disease-remove-btn"]({ currentTarget: { dataset: { itemId: "d1" } } });
    expect(actor.deleted).toEqual(["d1"]);
    expect(captured.warnings).toEqual([]);
  });

  it("носитель Идеального Хозяина — отказ с объяснением, болезнь остаётся", async () => {
    const actor = actorWith({ perfectHost: true });
    const html = fakeHtml();
    activateDiseaseListeners(html, actor);
    await html.handlers[".disease-remove-btn"]({ currentTarget: { dataset: { itemId: "d1" } } });
    expect(actor.deleted).toEqual([]);
    expect(captured.warnings.join(" ")).toContain("Идеальный Хозяин");
  });
});
