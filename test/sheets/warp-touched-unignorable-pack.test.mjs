// test/sheets/warp-touched-unignorable-pack.test.mjs
//
// Затронутый Варпом, субмутация 1 (wdbc-1rno.26): «не может игнорировать
// этот Страх» — на НАСТОЯЩЕМ JSON пака мутации, а не на фикстуре с записью
// без гейта по строке субмутации. Фикстура диалога (disorders-fear-dialog)
// держит запись без when.submutations: сломанный гейт пака там остался бы
// зелёным, а за столом мутация молчала бы — или срабатывала на любой строке.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";
import { fearDialogDefaults } from "../../module/sheets/tabs/disorders.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WT = packDocByFileHint(path.join(ROOT,
  "packs-src/mutations/Общие_мутации/Warp_Touched___Затронутый_Варпом_www8irFZ4bT6bDsO.json"));

/** Персонаж с мутацией из пака и выпавшей строкой субмутации `label`. */
function withMutation(label, { faced = 0 } = {}) {
  const flags = faced ? { fearFacedRating: faced } : {};
  return {
    id: "a1", type: "character", name: "Затронутый", effects: [],
    items: [{ ...WT, id: WT._id, system: { ...WT.system, submutation: { label } } }],
    system: { characteristics: { wp: { total: 40 }, inf: { total: 60 } },
      fatigue: { value: 0, max: 0 }, fate: { value: 0 }, fearRating: 0 },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async () => {}, createEmbeddedDocuments: async () => [], flags
  };
}
const raging = { type: "character", items: [], system: { fearRating: 0, inRage: true } };

beforeEach(resetCaptured);

describe("Затронутый Варпом (пак): строка 1 — Страх Ярости нельзя игнорировать", () => {
  it("строка 1, враг в Ярости — Страх 3 и «нельзя игнорировать»", () => {
    expect(fearDialogDefaults(withMutation("1"), raging, { relation: "enemy" }))
      .toMatchObject({ rating: 3, rageFear: true, unignorable: true });
  });

  it("строка 10 — Ярость врага Страха не прибавляет и игнорировать его можно", () => {
    expect(fearDialogDefaults(withMutation("10"), raging, { relation: "enemy" }))
      .toMatchObject({ rating: 1, unignorable: false });
  });

  it("строка 1, сквозной путь: Infamy 60 и память сцены не спасают от теста", async () => {
    const actor = withMutation("1", { faced: 3 });
    const pre = fearDialogDefaults(actor, raging, { relation: "enemy" });
    captured.nextRoll = 99;
    await _executeFearRoll(actor, pre.rating, "important", pre.infamy, 0, { unignorable: pre.unignorable });
    const msg = captured.chat.at(-1).content;
    expect(msg).not.toContain("Не требуется");
    expect(msg).not.toContain("выстоял");
  });
});
