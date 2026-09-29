// test/apps/mechanics-script-on-grant.test.mjs
//
// applyMechEntry (module/apps/mechanics.mjs) при выдаче предмета запускает
// код kind:"script" ТОЛЬКО у записей с scriptOnGrant. Остальные — кнопки
// «▶ Запустить» (цена, откат, диалоги) и при выдаче в Мастере создания
// срабатывать не должны: так у Слаангора endBattleForm обрывал применение
// субрасы, а Scrounge/Адаптивная Отрава сами открывали диалоги без цены.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyMechEntry } from "../../module/apps/mechanics.mjs";

function fakeItem() {
  const store = {};
  return {
    name: "Тестовый предмет",
    actor: null,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
  };
}

describe("applyMechEntry: kind:\"script\" при выдаче", () => {
  it("запись без scriptOnGrant код не запускает", async () => {
    const item = fakeItem();
    await applyMechEntry({}, { id: "e1", kind: "script", code: 'await item.setFlag("test","ran",true);' }, item);
    expect(item.getFlag("test", "ran")).toBeUndefined();
  });

  it("запись со scriptOnGrant код запускает", async () => {
    const item = fakeItem();
    await applyMechEntry({}, { id: "e1", kind: "script", scriptOnGrant: true, code: 'await item.setFlag("test","ran",true);' }, item);
    expect(item.getFlag("test", "ran")).toBe(true);
  });
});

/** Все записи kind:"script" из packs-src — с пометкой, где лежат. */
function packScriptEntries() {
  const out = [];
  const walk = dir => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith(".json")) continue;
      let json;
      try { json = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
      const visit = o => {
        if (!o || typeof o !== "object") return;
        if (o.kind === "script" && "code" in o) out.push({ file: f.name, entry: o });
        for (const v of Object.values(o)) visit(v);
      };
      visit(json);
    }
  };
  walk("packs-src");
  return out;
}

describe("packs-src: записи kind:\"script\" и «При выдаче»", () => {
  const all = packScriptEntries();

  it("запись с ценой, частотой или триггером — кнопка, при выдаче не срабатывает", () => {
    const bad = all.filter(({ entry }) =>
      entry.scriptOnGrant && (entry.capabilityCostPool || entry.scriptThrottleUnit || entry.scriptTrigger));
    expect(bad.map(b => `${b.file}: ${b.entry.label}`)).toEqual([]);
  });

  it("пассивные записи, которые обязаны срабатывать при выдаче, помечены", () => {
    const onGrant = all.filter(({ entry }) => entry.scriptOnGrant).map(({ file }) => file);
    expect(onGrant.some(n => n.startsWith("Psyker___"))).toBe(true);   // Беглый Псайкер — стартовое расстройство
    expect(onGrant.some(n => n.startsWith("Военная_зона"))).toBe(true); // флаг hitLocationShift
    expect(onGrant.some(n => n.startsWith("Heir___"))).toBe(true);      // Помазанник (5)
  });

  it("Кнопки форм Зверолюда при выдаче не срабатывают", () => {
    const forms = all.filter(({ file }) => /^(Slaangor___|Pestigor___|Khorngor___|Adaptive_Venom|Scrounge)/.test(file));
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.filter(({ entry }) => entry.scriptOnGrant).map(f => f.file)).toEqual([]);
  });
});
