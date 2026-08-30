// test/combat/target-effect.test.mjs
//
// buildTargetEffectButtons — движок «эффектов на цель» (кнопки в чате после
// попадания): тест сопротивления, состояние, доп. урон. Раньше не имел ни
// одного теста вообще. Здесь проверяется расширение под Bane/Vibro/Dreaming:
// - provalyDamage (урон «рейтинг×mult + add + Провалы», без кубика);
// - targetEffect как массив (два независимых теста на одном свойстве);
// - conditionMinDoP (состояние только при достаточных Провалах);
// - ослабленный гейт кнопки (кнопка нужна и без condition, если есть урон).
//
// Модуль не трогает Foundry — только чистая разметка, без foundry-stub.mjs.

import { describe, it, expect } from "vitest";
import { resolveWeaponPropsList, buildTargetEffectButtons } from "../../module/combat/weapon-properties.mjs";

const props = (entries) => resolveWeaponPropsList(entries);

describe("buildTargetEffectButtons: базовое поведение (не должно было сломаться)", () => {
  it("без попадания (hit:false) — пусто", () => {
    expect(buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]), { hit: false })).toBe("");
  });

  it("свойство с condition даёт кнопку с тестом", () => {
    const html = buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]), { hit: true });
    expect(html).toContain("wh-wprop-apply-btn");
    expect(html).toContain('data-wp-condition="poisoned"');
    expect(html).toContain("тест T");
  });

  it("кнопка несёт data-wp-key — ключ свойства для проверки иммунитета (wdbc-plsf)", () => {
    const html = buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]), { hit: true });
    expect(html).toContain('data-wp-key="toxic"');
  });

  it("свойство без targetEffect (например ordnance — только числовые auto) не даёт кнопку", () => {
    const html = buildTargetEffectButtons(props([{ key: "ordnance" }]), { hit: true });
    expect(html).toBe("");
  });

  it("onUnsoaked без непоглощённого урона — кнопки нет", () => {
    const html = buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]),
      { hit: true, netDamageKnown: true, hadUnsoaked: false });
    expect(html).toBe("");
  });
});

describe("provalyDamage: урон «рейтинг×mult + add + Провалы» без кубика", () => {
  it("Bane — mult:0, add:0: кнопка есть, несмотря на отсутствие condition", () => {
    const html = buildTargetEffectButtons(props([{ key: "bane", rating: 3 }]), { hit: true });
    expect(html).toContain("wh-wprop-apply-btn");
    expect(html).toContain('data-wp-provaly="1"');
    expect(html).toContain('data-wp-provaly-mult="0"');
    expect(html).toContain('data-wp-provaly-add="0"');
    expect(html).toContain('data-wp-rating="3"');
    // Без condition — раньше гейт (`!te.condition && te.kind !== "grav"`)
    // выбросил бы такую кнопку целиком.
    expect(html).toContain('data-wp-condition=""');
  });

  it("Vibro T-часть — mult:1, add:0: рейтинг реально попадает в разметку", () => {
    const html = buildTargetEffectButtons(props([{ key: "vibro", rating: 4 }]), { hit: true });
    expect(html).toContain('data-wp-provaly-mult="1"');
    expect(html).toContain('data-wp-rating="4"');
  });

  it("свойство без provalyDamage — атрибут явно нулевой", () => {
    const html = buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]), { hit: true });
    expect(html).toContain('data-wp-provaly="0"');
  });
});

describe("targetEffect как массив: два независимых теста на одном свойстве (Vibro)", () => {
  it("даёт ДВЕ кнопки — T-урон и S-отброс/Ничком", () => {
    const html = buildTargetEffectButtons(props([{ key: "vibro", rating: 2 }]), { hit: true });
    const buttonCount = (html.match(/wh-wprop-apply-btn/g) || []).length;
    expect(buttonCount).toBe(2);
    expect(html).toContain("урон T");
    expect(html).toContain("отброс/Ничком S");
  });

  it("T-часть тестируется по T, S-часть — по S", () => {
    const html = buildTargetEffectButtons(props([{ key: "vibro", rating: 2 }]), { hit: true });
    expect(html).toContain("тест T");
    expect(html).toContain("тест S");
  });

  it("S-часть несёт condition=prone и порог Провалов 5", () => {
    const html = buildTargetEffectButtons(props([{ key: "vibro", rating: 2 }]), { hit: true });
    expect(html).toContain('data-wp-condition="prone"');
    expect(html).toContain('data-wp-min-dop="5"');
  });

  it("свойство без conditionMinDoP — порог по умолчанию 1 (эффект от любого провала)", () => {
    const html = buildTargetEffectButtons(props([{ key: "toxic", rating: 2 }]), { hit: true });
    expect(html).toContain('data-wp-min-dop="1"');
  });
});

describe("Monofilament — Связана+Беспомощна (helpless) и урон X×3+Провалы", () => {
  it("тест по Ловкости (ag), condition helpless, provalyDamage mult:3", () => {
    const html = buildTargetEffectButtons(props([{ key: "monofilament", rating: 2 }]), { hit: true });
    expect(html).toContain('data-wp-condition="helpless"');
    expect(html).toContain("тест AG");
    expect(html).toContain('data-wp-provaly-mult="3"');
    expect(html).toContain('data-wp-rating="2"');
  });
});

describe("Dreaming — Ступор (dazed) через ту же гейтящую onUnsoaked-логику, что Toxic/Rad", () => {
  it("без непоглощённого урона кнопки нет", () => {
    const html = buildTargetEffectButtons(props([{ key: "dreaming", rating: 1 }]),
      { hit: true, netDamageKnown: true, hadUnsoaked: false });
    expect(html).toBe("");
  });

  it("с непоглощённым уроном — кнопка на condition dazed, тест по wp", () => {
    const html = buildTargetEffectButtons(props([{ key: "dreaming", rating: 1 }]),
      { hit: true, netDamageKnown: true, hadUnsoaked: true });
    expect(html).toContain('data-wp-condition="dazed"');
    expect(html).toContain("тест WP");
  });
});

describe("Challenge — Вызван (challenged) сразу на попадании, без onUnsoaked", () => {
  it("кнопка есть уже на простом попадании (Погибель/Сновидение требуют непоглощённый урон, Вызов — нет)", () => {
    const html = buildTargetEffectButtons(props([{ key: "challenge", rating: 2 }]),
      { hit: true, netDamageKnown: true, hadUnsoaked: false });
    expect(html).toContain('data-wp-condition="challenged"');
    expect(html).toContain("тест WP");
  });
});

describe("Corrosive/Crippling/Piercing/Haywire (wdbc-plsf) — больше не идут через эту кнопку", () => {
  // Раньше это были targetEffect.kind → текстовая заметка (roll-wprop-note).
  // Теперь применяются напрямую в combat/damage.mjs (applyDamageToActor), и
  // здесь для них не должно быть ни кнопки, ни заметки.
  it.each(["corrosive", "crippling", "piercing", "haywire"])(
    "%s: buildTargetEffectButtons ничего не рисует", (key) => {
      const html = buildTargetEffectButtons(props([{ key, rating: 2 }]), { hit: true });
      expect(html).toBe("");
    });
});
