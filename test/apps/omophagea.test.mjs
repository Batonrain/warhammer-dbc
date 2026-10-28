// 3-b530: Омофагея, Вор Памяти, Испробовать Душу.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  tasteTheSoulBonus, memoryThiefMax, memoryThiefDurationSeconds, memoryThiefCandidates,
  memoryThiefRank, memoryThiefHasRoom, expiredMemoryThief
} from "../../module/rules/omophagea.mjs";
import { runOmophagea, grantMemoryThiefSkill, sweepMemoryThief, omophageaPanelHtml, isOmophageaItem } from "../../module/apps/omophagea.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const cap = key => ({
  type: "talent", name: key, system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key }] }] } }
});

function marine({ int = 50, per = 40, items = [], skills = {}, groupSkills = {} } = {}) {
  const flags = {};
  const a = {
    id: "m", name: "Десантник", items,
    system: { characteristics: { int: { total: int, bonus: Math.floor(int / 10) }, per: { total: per, bonus: Math.floor(per / 10) } }, skills, groupSkills },
    getFlag: (ns, k) => flags[`${ns}.${k}`], setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    update: async d => {
      for (const [p, v] of Object.entries(d)) {
        const parts = p.split("."); let cur = a;
        for (const x of parts.slice(0, -1)) { cur[x] ??= {}; cur = cur[x]; }
        cur[parts.at(-1)] = v;
      }
    }
  };
  return a;
}

describe("rules/omophagea", () => {
  it("Испробовать Душу: +½ P окр.▲", () => {
    expect(tasteTheSoulBonus(45)).toBe(23);
    expect(tasteTheSoulBonus(40)).toBe(20);
  });
  it("Вор Памяти: ½ I.b окр.▲ Навыков, срок I.b суток", () => {
    expect(memoryThiefMax(5)).toBe(3);
    expect(memoryThiefMax(4)).toBe(2);
    expect(memoryThiefDurationSeconds(5)).toBe(5 * 86400);
    expect(memoryThiefHasRoom([{}, {}], 5)).toBe(true);
    expect(memoryThiefHasRoom([{}, {}, {}], 5)).toBe(false);
  });
  it("ступень жертвы, но не ниже собственной", () => {
    expect(memoryThiefRank("untrained", "veteran")).toEqual({ rank: "veteran", changed: true });
    expect(memoryThiefRank("expert", "trained")).toEqual({ rank: "expert", changed: false });
  });
  it("кандидаты — только изученные Навыки жертвы, обычные и групповые", () => {
    const victim = { system: {
      skills: { medicae: { rank: "trained" }, athletics: { rank: "untrained" } },
      groupSkills: { trade: [{ specialty: "Chymist", rank: "knows" }, { specialty: "Smith", rank: "untrained" }] } } };
    const ids = memoryThiefCandidates(victim).map(c => c.id);
    expect(ids).toEqual(["p:medicae", "g:trade:Chymist"]);
  });
  it("истёкшие записи", () => {
    expect(expiredMemoryThief([{ expiresAt: 10 }, { expiresAt: 100 }], 50)).toHaveLength(1);
  });
});

describe("Омофагея: кнопка и тест", () => {
  beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; game.user = { targets: new Set() }; });
  afterEach(() => { captured.dice = null; clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });

  it("панель только у импланта Омофагея", () => {
    const item = { id: "i", type: "implant", name: "8. Омофагея / Omophagea" };
    expect(isOmophageaItem(item)).toBe(true);
    expect(omophageaPanelHtml(item, marine())).toContain("omophagea-btn");
    expect(omophageaPanelHtml({ id: "x", type: "implant", name: "Второе Сердце" }, marine())).toBe("");
  });

  it("тест I+0: успех — карточка с Успехами; Испробовать Душу добавляет +½P к Порогу", async () => {
    const plain = marine({ int: 50, per: 40 });
    captured.nextRoll = 45;
    await runOmophagea(plain, null);
    expect(captured.chat.at(-1).content).toContain("Успех");
    expect(captured.chat.at(-1).content).not.toContain("Испробовать Душу");

    resetCaptured();
    const taster = marine({ int: 50, per: 40, items: [cap("geneseed.core.tasteTheSoul")] });
    captured.nextRoll = 65; // 50 + 20 = 70 → успех; без Таланта 65 > 50 — провал
    await runOmophagea(taster, null);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Испробовать Душу");
    expect(html).toContain("Успех");
  });

  it("Вор Памяти без таргета: карточка не зовёт «нажать снова» — повтор был бы новым тестом", async () => {
    captured.nextRoll = 10;
    await runOmophagea(marine({ items: [cap("geneseed.core.memoryThief")] }), null);
    const html = captured.chat.at(-1).content;
    expect(html).not.toContain("нажмите кнопку снова");
    expect(html).toContain("до нажатия");
  });

  it("провал теста — ничего полезного", async () => {
    captured.nextRoll = 99;
    await runOmophagea(marine(), null);
    expect(captured.chat.at(-1).content).toContain("Неудача");
  });
});

describe("Вор Памяти: перенять и откатить", () => {
  beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; });
  const cand = { id: "p:medicae", kind: "plain", skillKey: "medicae", specialty: "", specKey: "", rank: "veteran", label: "Medicae — Опытный" };

  it("ступень жертвы на I.b суток, откат тиком Календаря", async () => {
    const a = marine({ int: 50, skills: { medicae: { rank: "untrained" } } });
    const line = await grantMemoryThiefSkill(a, cand);
    expect(line).toContain("5 сут.");
    expect(a.system.skills.medicae.rank).toBe("veteran");
    const rec = a.getFlag("warhammer-dbc", "memoryThiefSkills")[0];
    expect(rec.expiresAt).toBe(1000 + 5 * 86400);

    await sweepMemoryThief(a, 1000 + 5 * 86400 - 1);
    expect(a.system.skills.medicae.rank).toBe("veteran");
    await sweepMemoryThief(a, 1000 + 5 * 86400);
    expect(a.system.skills.medicae.rank).toBe("untrained");
    expect(a.getFlag("warhammer-dbc", "memoryThiefSkills")).toEqual([]);
  });

  it("групповой Навык: запись добавляется и убирается при откате", async () => {
    const a = marine({ int: 40 });
    const g = { id: "g:trade:Chymist", kind: "group", skillKey: "trade", specialty: "Chymist", specKey: "", rank: "trained", label: "Trade (Chymist)" };
    await grantMemoryThiefSkill(a, g);
    expect(a.system.groupSkills.trade).toHaveLength(1);
    await sweepMemoryThief(a, 1000 + 4 * 86400);
    expect(a.system.groupSkills.trade).toHaveLength(0);
  });

  it("ступень, купленную поверх краденой за I.b суток, откат не отнимает", async () => {
    const a = marine({ int: 50, skills: { medicae: { rank: "untrained" } } });
    await grantMemoryThiefSkill(a, cand);
    a.system.skills.medicae.rank = "expert"; // игрок докупил за опыт
    await sweepMemoryThief(a, 1000 + 5 * 86400);
    expect(a.system.skills.medicae.rank).toBe("expert");
    expect(a.getFlag("warhammer-dbc", "memoryThiefSkills")).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("докуплена поверх — остаётся");
  });

  it("групповой Навык: докупленное поверх остаётся — и новая запись, и прежняя", async () => {
    const a = marine({ int: 40, groupSkills: { lore: [{ specialty: "Imperium", rank: "untrained" }] } });
    await grantMemoryThiefSkill(a, { id: "g:trade:Chymist", kind: "group", skillKey: "trade", specialty: "Chymist", specKey: "", rank: "trained", label: "Trade (Chymist)" });
    await grantMemoryThiefSkill(a, { id: "g:lore:Imperium", kind: "group", skillKey: "lore", specialty: "Imperium", specKey: "", rank: "trained", label: "Lore (Imperium)" });
    a.system.groupSkills.trade[0].rank = "veteran";
    a.system.groupSkills.lore[0].rank = "veteran";
    await sweepMemoryThief(a, 1000 + 4 * 86400);
    expect(a.system.groupSkills.trade).toEqual([expect.objectContaining({ specialty: "Chymist", rank: "veteran" })]);
    expect(a.system.groupSkills.lore[0].rank).toBe("veteran");
  });

  it("лимит ½ I.b: сверх лимита отказ, ничего не меняется", async () => {
    const a = marine({ int: 20, skills: { medicae: { rank: "untrained" }, athletics: { rank: "untrained" } } }); // I.b 2 → максимум 1
    await grantMemoryThiefSkill(a, cand);
    const second = await grantMemoryThiefSkill(a, { ...cand, id: "p:athletics", skillKey: "athletics", label: "Athletics" });
    expect(second).toBeNull();
    expect(a.system.skills.athletics.rank).toBe("untrained");
  });

  it("собственная ступень выше — ничего не меняется и запись не заводится", async () => {
    const a = marine({ skills: { medicae: { rank: "expert" } } });
    const line = await grantMemoryThiefSkill(a, { ...cand, rank: "trained" });
    expect(line).toContain("не ниже");
    expect(a.getFlag("warhammer-dbc", "memoryThiefSkills")).toBeUndefined();
  });
});
