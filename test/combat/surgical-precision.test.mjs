// 3-dc87: Хирургическая Точность — арифметика и кнопка карточки.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { oddSuccesses, surgicalThreshold } from "../../module/rules/surgical-precision.mjs";
import { runSurgicalPrecision, surgicalPrecisionButtonHtml } from "../../module/combat/surgical-precision.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const grant = () => {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "test.sp", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.surgicalPrecision" }] }]);
};

const medic = (extra = {}) => ({
  name: "Медик", uuid: "Actor.m", isOwner: true, items: [],
  system: { skills: { medicae: { total: 60 } }, characteristics: { int: { total: 40, bonus: 4 } }, ...extra },
  getFlag: () => undefined
});

describe("oddSuccesses", () => {
  it("нечётные Успехи среди 1..N: 1→1, 2→1, 3→2, 4→2, 5→3; провал → 0", () => {
    expect([1, 2, 3, 4, 5].map(n => oddSuccesses(n))).toEqual([1, 1, 2, 2, 3]);
    expect(oddSuccesses(4, false)).toBe(0);
  });
});

describe("surgicalThreshold", () => {
  it("человек — Medicae−10", () => {
    expect(surgicalThreshold(medic(), "human").threshold).toBe(50);
  });
  it("не-человек — меньший из двух Пределов; без Lore — Int−20−10", () => {
    // Lore не изучен: 40−20−10 = 10 < 50
    expect(surgicalThreshold(medic(), "astartes").threshold).toBe(10);
    const m = medic({ groupSkills: { forbiddenLore: [{ specKey: "xenobiology", specialty: "Xenobiology", total: 70 }] } });
    expect(surgicalThreshold(m, "xenos").threshold).toBe(50); // min(50, 60)
  });
});

describe("кнопка карточки", () => {
  afterEach(() => { clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });
  it("только с Талантом, Избирательной атакой и попаданием", () => {
    expect(surgicalPrecisionButtonHtml(medic(), { selective: true, hit: true })).toBe("");
    grant();
    expect(surgicalPrecisionButtonHtml(medic(), { selective: true, hit: true })).toContain("wh-surgical-btn");
    expect(surgicalPrecisionButtonHtml(medic(), { selective: false, hit: true })).toBe("");
    expect(surgicalPrecisionButtonHtml(medic(), { selective: true, hit: false })).toBe("");
  });
});

describe("runSurgicalPrecision", () => {
  const realWait = foundry.applications?.api?.DialogV2?.wait;
  beforeEach(() => {
    resetCaptured();
    grant();
    foundry.applications.api.DialogV2.wait = async () => "human";
  });
  afterEach(() => {
    foundry.applications.api.DialogV2.wait = realWait;
    clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f);
  });
  const dom = () => ({
    dataset: { damage: "10" }, _b: { textContent: "10" },
    querySelector() { return this._b; }
  });

  it("Успех с 3 степенями (бросок 25 при Пределе 50 → 3 ст.): 2 нечётных Успеха → +2 к урону в кнопке", async () => {
    const applyBtn = dom(); const el = { disabled: false, textContent: "" };
    captured.nextRoll = 25;
    const added = await runSurgicalPrecision(medic(), { applyBtn, el });
    expect(added).toBe(2);
    expect(applyBtn.dataset.damage).toBe("12");
    expect(applyBtn._b.textContent).toBe("12");
    expect(el.disabled).toBe(true);
  });

  it("Провал — урон не меняется", async () => {
    const applyBtn = dom(); const el = { disabled: false, textContent: "" };
    captured.nextRoll = 95;
    expect(await runSurgicalPrecision(medic(), { applyBtn, el })).toBe(0);
    expect(applyBtn.dataset.damage).toBe("10");
  });

  it("Без Таланта — отказ без броска", async () => {
    clearRuleSources();
    captured.nextRoll = 5;
    expect(await runSurgicalPrecision(medic(), { applyBtn: dom(), el: {} })).toBeNull();
    expect(captured.rolls).toHaveLength(0);
  });
});
