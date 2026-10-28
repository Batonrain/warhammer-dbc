// test/sheets/psychic-epr-talents.test.mjs
//
// Сдержанность и Дитя Варпа в самой манифестации (Sahara 3-28): эPR в
// Безопасном режиме и бонус Усиленного. Чистая арифметика — rules/psyker.mjs,
// здесь проверено, что executePsychotest и живой предпросмотр окна её зовут.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { executePsychotest, wirePsyManifestPreview } from "../../module/sheets/tabs/psychic.mjs";

const talent = name => ({ id: name, type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

function power() {
  const it = { id: "p1", name: "Взор Варпа", type: "psychicPower",
    system: { testChar: "wp", powerType: "utility", testMod: 0 }, updates: [],
    update: async d => { it.updates.push(d); return d; } };
  return it;
}

function actor(items = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = {};
  return {
    id: "actor-1", name: "Псайкер", items: list, updates: [],
    getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    system: {
      race: "human", fatigue: { value: 0 },
      psyker: { rating: 9, currentRating: 9, sustain: 0, class: "bound" },
      skills: {}, corruption: { value: 0 }, corruptionBonus: 0,
      wounds: { value: 8, max: 10, critical: 0 },
      characteristics: { wp: { total: 40, value: 40, bonus: 4 } }
    },
    update: async d => { d && 0; return d; },
    updateEmbeddedDocuments: async () => []
  };
}

const opts = (mPR, mode) => ({ mPR, prMod: 0, mode, path: "", modifier: 0, eldar: false, pushChoice: 1,
  damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 });

/** эПР, записанный на предмете при успешной манифестации. */
async function epr(a, mPR, mode) {
  const p = power();
  captured.nextRoll = 1; // гарантированный успех
  await executePsychotest(a, p, opts(mPR, mode));
  return p.updates.find(u => "system.sustainedEpr" in u)?.["system.sustainedEpr"];
}

beforeEach(resetCaptured);

describe("executePsychotest: Сдержанность", () => {
  it("Безопасный режим без Таланта — ½ mPR вверх (регресс)", async () => {
    expect(await epr(actor(), 9, "safe")).toBe(5);
  });

  it("Безопасный режим со Сдержанностью — mPR−3", async () => {
    expect(await epr(actor([talent("Restraint / Сдержанность")]), 9, "safe")).toBe(6);
  });

  it("Обычный и Усиленный режимы Сдержанность не меняет", async () => {
    const a = actor([talent("Restraint / Сдержанность")]);
    expect(await epr(a, 9, "normal")).toBe(9);
    expect(await epr(a, 2, "push")).toBe(5);   // Связанный: +3
  });
});

describe("executePsychotest: Дитя Варпа", () => {
  it("Усиленный режим без Таланта — как раньше (+3 Связанному)", async () => {
    expect(await epr(actor(), 2, "push")).toBe(5);
  });

  it("Усиленный режим с Дитём Варпа — ещё +1", async () => {
    expect(await epr(actor([talent("Child of the Warp / Дитя Варпа")]), 2, "push")).toBe(6);
  });

  it("Безопасный и Обычный режимы Дитя Варпа не меняет", async () => {
    const a = actor([talent("Child of the Warp / Дитя Варпа")]);
    expect(await epr(a, 4, "safe")).toBe(2);
    expect(await epr(a, 4, "normal")).toBe(4);
  });
});

describe("окно манифестации: предпросмотр эPR берёт те же числа", () => {
  function html() {
    const vals = { "#psy-pr": "9", "#psy-pr-mod": "0", "#psy-mod": "0", "#psy-path": "", "#psy-variant": "-1",
      "#psy-push-bonus": "1", "#psy-rune-strike": "0" };
    const nodes = {};
    const node = sel => (nodes[sel] ??= { value: vals[sel] ?? "", textContent: "", style: {}, classList: { toggle() {}, remove() {}, add() {} },
      addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, checked: false, dataset: {} });
    const root = { querySelector: node, querySelectorAll: () => [], closest: () => null };
    return { root, nodes };
  }

  function eprShown(flags, mode) {
    const { root, nodes } = html();
    nodes["#psy-mode"] = { value: mode, addEventListener() {} };
    const meta = { charVal: 40, charAbbr: "WP", powerMod: 0, natData: { pushBonusType: "fixed", pushBonus: 3, pushFormula: "", pushPhenType: "flat", pushPhenValue: 10, normalPhenMod: 0 },
      pathData: {}, dynBonus: {}, variantMods: [], isEldar: false, fatigue: 0, runeBase: 0, ...flags };
    wirePsyManifestPreview(root, meta);
    return nodes["#pm-epr"]?.textContent;
  }

  it("Безопасный режим: Сдержанность поднимает показанный эPR", () => {
    expect(eprShown({}, "safe")).toBe("5");
    expect(eprShown({ restraint: true }, "safe")).toBe("6");
  });

  it("Усиленный режим: Дитя Варпа добавляет +1 к показанному эPR", () => {
    expect(eprShown({}, "push")).toBe("12");
    expect(eprShown({ childOfWarp: true }, "push")).toBe("13");
  });
});
