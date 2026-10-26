// test/apps/war-cry.test.mjs
//
// War Cry / Боевой Клич (Sahara 3-5e84, доделка inspire-wrath-cannon-fodder):
// кнопка на листе Таланта — 1 Усталости и НАСТОЯЩИЙ временный эффект «рейтинг
// Страха +1 до начала следующего Хода» (ActiveEffect на system.fearRating со
// сроком в 1 Раунд, expiry "turnStart"; combat/timed-effects.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { talentActionsHtml, runTalentAction, isWarCryItem } from "../../module/apps/talent-actions.mjs";
import { timedEffectData, timedEffectStale, sweepTimedEffects, onTimedEffectExpired, TIMED_EFFECT_FLAG, WAR_CRY_EFFECT_KEY }
  from "../../module/combat/timed-effects.mjs";

const warCry = () => ({
  id: "w1", type: "talent", name: "War Cry / Боевой Клич",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "social.core.warCry" }] }] } }
});

function actor(fearRating = 0) {
  const flags = {};
  const a = {
    id: "a", name: "Горлопан", items: [], effects: [],
    system: { fearRating, fatigue: { value: 0, max: 0 }, characteristics: { t: { total: 40, bonus: 4 }, wp: { total: 40, bonus: 4 } }, conditions: {} },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    createEmbeddedDocuments: async (type, docs) => {
      expect(type).toBe("ActiveEffect");
      const made = docs.map((d, i) => ({ ...d, id: `fx${a.effects.length + i}`,
        getFlag: (ns, k) => d.flags?.[ns]?.[k] }));
      a.effects.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (type, ids) => { a.effects = a.effects.filter(e => !ids.includes(e.id)); },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = a;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("Боевой клич", () => {
  it("кнопка только на листе этого Таланта у владельца-актора", () => {
    expect(isWarCryItem(warCry())).toBe(true);
    expect(talentActionsHtml(warCry(), actor())).toContain('data-talent-action="warCry"');
    expect(talentActionsHtml(warCry(), null)).toBe("");
    expect(talentActionsHtml({ type: "talent", name: "Прочий", flags: {} }, actor())).toBe("");
  });

  it("клик: +1 Усталости, карточка «Страх 1» и настоящий эффект +1 к рейтингу Страха на 1 Раунд", async () => {
    const a = actor(0);
    expect(await runTalentAction("warCry", warCry(), a)).toBe(true);
    expect(a.system.fatigue.value).toBe(1);
    expect(captured.chat.at(-1).content).toContain("рейтинг Страха <b>1</b>");
    expect(a.effects).toHaveLength(1);
    const fx = a.effects[0];
    // priority выше «upgrade» Черты Fear (X): Fear (2) + Клич = 3, а не 2 (ревью В2).
    expect(fx.system.changes).toEqual([{ key: "system.fearRating", type: "add", value: 1, phase: "final", priority: 100 }]);
    expect(fx.system.changes[0].priority).toBeGreaterThan(0);
    // Срок — штатная Duration v14: { value, units, expiry }, а не выдуманная форма v13.
    expect(fx.duration).toEqual({ value: 1, units: "rounds", expiry: "turnStart" });
    expect(fx.flags["warhammer-dbc"][TIMED_EFFECT_FLAG].key).toBe(WAR_CRY_EFFECT_KEY);
  });

  it("при собственном рейтинге — «N → N+1», эффект тот же (+1)", async () => {
    const a = actor(2);
    await runTalentAction("warCry", warCry(), a);
    expect(captured.chat.at(-1).content).toContain("2 → 3");
    expect(a.effects[0].system.changes[0].value).toBe(1);
  });

  it("повторный клич заменяет прежний эффект, а не складывает рейтинг", async () => {
    const a = actor(0);
    await runTalentAction("warCry", warCry(), a);
    await runTalentAction("warCry", warCry(), a);
    expect(a.effects).toHaveLength(1);
  });

  it("чужой предмет не запускает клич: ни Усталости, ни эффекта", async () => {
    const a = actor();
    expect(await runTalentAction("warCry", { type: "talent", name: "Прочее", flags: {} }, a)).toBe(false);
    expect(a.system.fatigue.value).toBe(0);
    expect(a.effects).toEqual([]);
  });
});

describe("временный эффект: срок", () => {
  it("timedEffectData: фаза — по ключу, срок — в Раундах до начала Хода", () => {
    const d = timedEffectData({ key: "k", name: "x", changes: [{ key: "system.fearRating", value: 1 }],
      combat: { id: "c1", round: 3 } });
    expect(d.system.changes[0].phase).toBe("final");
    expect(d.duration.expiry).toBe("turnStart");
    expect(d.flags["warhammer-dbc"][TIMED_EFFECT_FLAG]).toEqual({ key: "k", combatId: "c1", round: 3 });
  });

  it("timedEffectStale: тот же Раунд — живёт; следующий или другой бой — снять; вне боя — живёт", () => {
    const flag = { key: "k", combatId: "c1", round: 3 };
    expect(timedEffectStale(flag, { id: "c1", round: 3 })).toBe(false);
    expect(timedEffectStale(flag, { id: "c1", round: 4 })).toBe(true);
    expect(timedEffectStale(flag, { id: "c2", round: 1 })).toBe(true);
    expect(timedEffectStale(flag, null)).toBe(false);
  });

  it("sweepTimedEffects в начале Хода снимает только устаревшие метки", async () => {
    const a = actor();
    globalThis.game.combat = { id: "c1", round: 3, started: true };
    await runTalentAction("warCry", warCry(), a);
    expect(await sweepTimedEffects(a, { id: "c1", round: 3 })).toBe(0);
    expect(a.effects).toHaveLength(1);
    expect(await sweepTimedEffects(a, { id: "c1", round: 4 })).toBe(1);
    expect(a.effects).toEqual([]);
    delete globalThis.game.combat;
  });

  it("onTimedEffectExpired: только по отметке ядра, только активный ГМ, только в бою", async () => {
    const del = [];
    const effect = { flags: { "warhammer-dbc": { [TIMED_EFFECT_FLAG]: { key: "k" } } }, delete: async () => del.push(1) };
    globalThis.game.users = { activeGM: { isSelf: true } };
    globalThis.game.combat = { started: true };
    expect(await onTimedEffectExpired(effect, { duration: { expired: false } })).toBe(false);
    expect(await onTimedEffectExpired({ flags: {}, delete: async () => del.push(2) }, { duration: { expired: true } })).toBe(false);
    expect(await onTimedEffectExpired(effect, { duration: { expired: true } })).toBe(true);
    expect(del).toEqual([1]);
    globalThis.game.combat = { started: false };
    expect(await onTimedEffectExpired(effect, { duration: { expired: true } })).toBe(false);
    globalThis.game.users = { activeGM: { isSelf: false } };
    globalThis.game.combat = { started: true };
    expect(await onTimedEffectExpired(effect, { duration: { expired: true } })).toBe(false);
    delete globalThis.game.combat;
  });
});
