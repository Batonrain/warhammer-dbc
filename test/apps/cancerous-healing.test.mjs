// test/apps/cancerous-healing.test.mjs
//
// wdbc-w8ws: обвязка Мутации «Cancerous Healing / Раковое Исцеление» —
// касание текущей цели (game.user.targets), живой штраф-эффект на ней, и
// ресинк её доли аблативного пула (флаг cancerousHealingAblative +
// ablativeMax) при лечении/уроне. Арифметика — rules/cancerous-healing.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { useCancerousHealing, syncCancerousHealingPenalty, cancerousHealingButtonHtml,
         reconcileCancerousHealingAfterHeal, reconcileCancerousHealingToFit }
  from "../../module/apps/cancerous-healing.mjs";

/** Ведёт диалог «Цель согласна» (promptTouch) до конца: жмёт «Коснуться». */
async function acceptTouch(promise, { consent = true, ws = 0, mod = 0 } = {}) {
  expect(captured.dialog).toBeTruthy();
  await captured.press("ok", fakeForm({ "#ch-consent": consent, "#ch-ws": String(ws), "#ch-mod": String(mod) }));
  return promise;
}

function fakeEffect(data, ownerEffects) {
  const fx = {
    id: Math.random().toString(36),
    name: data.name, changes: data.changes, flags: data.flags,
    getFlag(ns, key) { return this.flags?.[ns]?.[key]; },
    async update(patch) { Object.assign(this, patch); },
    async delete() { ownerEffects.splice(ownerEffects.indexOf(fx), 1); }
  };
  return fx;
}

function fakeActor({ value = 5, max = 10, ablative = 0, ablativeMax = 0, conditions = {}, flags = {} } = {}) {
  const actor = {
    name: "Цель",
    system: { wounds: { value, critical: 0, max, ablative, ablativeMax }, conditions, characteristics: {} },
    effects: [],
    flags: { "warhammer-dbc": { ...flags } },
    getFlag(ns, key) { return this.flags?.[ns]?.[key]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let obj = actor;
        for (let i = 0; i < parts.length - 1; i++) obj = (obj[parts[i]] ??= {});
        obj[parts.at(-1)] = v;
      }
    },
    async createEmbeddedDocuments(type, docs) {
      const created = docs.map(d => fakeEffect(d, actor.effects));
      actor.effects.push(...created);
      return created;
    }
  };
  return actor;
}

function fakeMutation() {
  return { type: "mutation", name: "Cancerous Healing / Раковое Исцеление" };
}

describe("useCancerousHealing", () => {
  let caster, target, mutation;
  beforeEach(() => {
    resetCaptured();
    caster = { name: "Целитель" };
    target = fakeActor({ value: 4, max: 10, conditions: { bleeding: true, bleedingLevel: 2, crippling: true } });
    mutation = fakeMutation();
    globalThis.game.user.targets = [{ actor: target }];
  });

  it("без цели — предупреждает и ничего не меняет", async () => {
    globalThis.game.user.targets = [];
    await useCancerousHealing(caster, mutation);
    expect(target.system.wounds.ablative).toBe(0);
  });

  it("отмена диалога — ничего не меняет", async () => {
    const promise = useCancerousHealing(caster, mutation);
    expect(captured.dialog).toBeTruthy();
    captured.dismiss();
    await promise;
    expect(target.system.wounds.ablative).toBe(0);
  });

  it("даёт недостающие Раны аблативом (и ablativeMax), лечит Кровотечение/Crippling, ставит штраф-эффект", async () => {
    await acceptTouch(useCancerousHealing(caster, mutation), { consent: true });
    expect(target.system.wounds.ablative).toBe(6); // 10-4
    expect(target.system.wounds.ablativeMax).toBe(6);
    expect(target.getFlag("warhammer-dbc", "cancerousHealingAblative")).toBe(6);
    expect(target.system.conditions.bleeding).toBe(false);
    expect(target.system.conditions.bleedingLevel).toBe(0);
    expect(target.system.conditions.crippling).toBe(false);

    const fx = target.effects.find(e => e.getFlag("warhammer-dbc", "cancerousHealingPenalty"));
    expect(fx).toBeTruthy();
    expect(fx.changes).toEqual([
      { key: "system.characteristics.ag.totalFx", type: "subtract", value: 12, phase: "initial", priority: 0 },
      { key: "system.characteristics.s.totalFx",  type: "subtract", value: 12, phase: "initial", priority: 0 }
    ]);
  });

  it("повторное касание заменяет прошлую долю, не складывая её саму с собой", async () => {
    await acceptTouch(useCancerousHealing(caster, mutation)); // доля 6
    target.system.wounds.value = 7; // подлечился где-то ещё, missing 3
    await acceptTouch(useCancerousHealing(caster, mutation));
    expect(target.system.wounds.ablative).toBe(3);
    expect(target.system.wounds.ablativeMax).toBe(3);
    expect(target.getFlag("warhammer-dbc", "cancerousHealingAblative")).toBe(3);
  });
});

describe("useCancerousHealing: цель не согласна — безоружная атака", () => {
  let caster, target, mutation;
  beforeEach(() => {
    resetCaptured();
    caster = { name: "Целитель", system: { characteristics: { ws: { total: 45 } } } };
    target = fakeActor({ value: 4, max: 10 });
    mutation = fakeMutation();
    globalThis.game.user.targets = [{ actor: target }];
  });

  it("успешная атака — эффект применяется, в чате отмечено «навязано»", async () => {
    captured.dice = null;
    captured.nextRoll = 30; // ≤ порога 45
    const promise = useCancerousHealing(caster, mutation);
    await captured.press("ok", fakeForm({ "#ch-consent": false, "#ch-ws": "45", "#ch-mod": "0" }));
    await promise;

    expect(target.system.wounds.ablative).toBe(6);
    expect(captured.chat.some(c => c.content.includes("Раковое Исцеление") && c.content.includes("навязано"))).toBe(true);
  });

  it("провал атаки — эффект НЕ применяется", async () => {
    captured.dice = null;
    captured.nextRoll = 90; // > порога 45
    const promise = useCancerousHealing(caster, mutation);
    await captured.press("ok", fakeForm({ "#ch-consent": false, "#ch-ws": "45", "#ch-mod": "0" }));
    await promise;

    expect(target.system.wounds.ablative).toBe(0);
    expect(target.getFlag("warhammer-dbc", "cancerousHealingAblative")).toBeUndefined();
  });
});

describe("reconcileCancerousHealingAfterHeal", () => {
  it("лечение сверх потолка — доля и ablativeMax сжимаются, не растут от урона", async () => {
    const target = fakeActor({ value: 4, max: 10, ablative: 6, ablativeMax: 6, flags: { cancerousHealingAblative: 6 } });
    target.system.wounds.value = 7; // подлечили — missing теперь 3
    await reconcileCancerousHealingAfterHeal(target);
    expect(target.system.wounds.ablative).toBe(3);
    expect(target.system.wounds.ablativeMax).toBe(3);

    target.system.wounds.value = 2; // затем получил урон — missing вырос до 8
    await reconcileCancerousHealingAfterHeal(target);
    expect(target.system.wounds.ablative).toBe(3); // не подтянулось обратно
  });

  it("нет прошлой доли — ничего не делает", async () => {
    const target = fakeActor({ value: 4, max: 10 });
    await reconcileCancerousHealingAfterHeal(target);
    expect(target.system.wounds.ablative).toBe(0);
  });
});

describe("reconcileCancerousHealingToFit", () => {
  it("пул просел ниже доли (поглощение урона) — доля и ablativeMax сжимаются", async () => {
    const target = fakeActor({ ablative: 3, ablativeMax: 6, flags: { cancerousHealingAblative: 6 } });
    await reconcileCancerousHealingToFit(target);
    expect(target.system.wounds.ablativeMax).toBe(3);
    expect(target.getFlag("warhammer-dbc", "cancerousHealingAblative")).toBe(3);
  });

  it("пул не просел — не трогает ничего", async () => {
    const target = fakeActor({ ablative: 6, ablativeMax: 6, flags: { cancerousHealingAblative: 6 } });
    await reconcileCancerousHealingToFit(target);
    expect(target.system.wounds.ablativeMax).toBe(6);
  });
});

describe("syncCancerousHealingPenalty", () => {
  it("нет своей доли — эффект удаляется, даже если на акторе есть посторонний аблатив", async () => {
    const target = fakeActor({ ablative: 4 }); // весь пул — постороннего источника
    const fx = { flags: { "warhammer-dbc": { cancerousHealingPenalty: true } }, getFlag(ns, k) { return this.flags[ns][k]; }, deleted: false, async delete() { this.deleted = true; } };
    target.effects.push(fx);
    await syncCancerousHealingPenalty(target);
    expect(fx.deleted).toBe(true);
  });

  it("есть своя доля, эффекта ещё нет — создаётся по НЕЙ, не по всему пулу", async () => {
    const target = fakeActor({ ablative: 3, flags: { cancerousHealingAblative: 3 } });
    await syncCancerousHealingPenalty(target);
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0].changes[0].value).toBe(6);
  });

  it("своя доля изменилась — существующий эффект пересчитывается, не дублируется", async () => {
    const target = fakeActor({ ablative: 3, flags: { cancerousHealingAblative: 3 } });
    await syncCancerousHealingPenalty(target);
    target.flags["warhammer-dbc"].cancerousHealingAblative = 5;
    await syncCancerousHealingPenalty(target);
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0].changes[0].value).toBe(10);
  });

  it("посторонний аблатив на том же акторе (напр. Absurdly Fat) не штрафуется", async () => {
    // Пул 9: 3 от Ракового Исцеления + 6 постороннего.
    const target = fakeActor({ ablative: 9, flags: { cancerousHealingAblative: 3 } });
    await syncCancerousHealingPenalty(target);
    expect(target.effects[0].changes[0].value).toBe(6); // 2×3, не 2×9
  });
});

describe("cancerousHealingButtonHtml", () => {
  it("пусто у другой Мутации/без актора", () => {
    expect(cancerousHealingButtonHtml({ type: "mutation", name: "Flayed" }, {})).toBe("");
    expect(cancerousHealingButtonHtml(fakeMutation(), null)).toBe("");
  });
  it("рисует кнопку у своей Мутации с актором", () => {
    expect(cancerousHealingButtonHtml(fakeMutation(), {})).toContain("cancerous-healing-btn");
  });
});
