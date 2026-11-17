// test/combat/weapon-property-book-effects.test.mjs
// Сверка свойств оружия с книгой («Особые Свойства Оружия», пачка wdbc-x1nz.4):
// Шоковое, Связывающее, Выгорание; названия по книге.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";
import { buildTargetEffectButtons } from "../../module/combat/weapon-properties.mjs";
import { resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";
import { deflagrateBranch, DEFLAGRATE_MIN_AP } from "../../module/combat/damage.mjs";

const buttons = (key, rating = 0) => buildTargetEffectButtons(
  resolveWeaponPropsList([{ key, rating }]), { hit: true });

describe("Шоковое (Shocking): «при пробитии брони, 1 Раунд за каждый Провал»", () => {
  it("кнопка срабатывает только при пробитии и считает раунды по Провалам", () => {
    const html = buttons("shocking");
    expect(html).toContain('data-wp-on-breach="1"');
    expect(html).toContain('data-wp-level-per-dop="1"');
    expect(html).toContain('data-wp-rounds="1"');
    expect(html).toContain('data-wp-condition="stunned"');
    expect(html).toContain('data-wp-fixed-rounds="0"');
  });
});

describe("Связывающее (Snare): связана и Беспомощна, тест A или S", () => {
  it("две кнопки — Ловкость и Сила, обе накладывают Беспомощность, штраф −10×X", () => {
    const html = buttons("snare", 2);
    const helpless = html.match(/data-wp-condition="helpless"/g) ?? [];
    expect(helpless.length).toBe(2);
    expect(html).toContain('data-wp-test-char="ag"');
    expect(html).toContain('data-wp-test-char="s"');
    expect(html).toContain('data-wp-test-mod="-20"');
    expect(html).not.toContain('data-wp-condition="pinned"');
  });
});

describe("Выгорание (Deflagrate): порог AP 2", () => {
  it("AP ≥ 2 — взрыв по соседям, меньше — непоглощаемый E по цели", () => {
    expect(DEFLAGRATE_MIN_AP).toBe(2);
    expect(deflagrateBranch(2)).toBe("blast");
    expect(deflagrateBranch(6)).toBe("blast");
    expect(deflagrateBranch(1)).toBe("direct");
    expect(deflagrateBranch(0)).toBe("direct");
    expect(deflagrateBranch(undefined)).toBe("direct");
  });
});

describe("названия по книге", () => {
  it.each([
    ["lance", "Пика"], ["wrecker", "Крушитель"], ["shocking", "Шоковое"],
    ["scatter", "Разброс"], ["snare", "Связывающее"], ["spray", "Спрей"],
    ["surge", "Скачок"], ["tainted", "Запятнанное"], ["tearing", "Терзающее"]
  ])("%s → %s", (key, label) => {
    expect(WEAPON_PROPERTIES[key].label).toBe(label);
  });
  it("Пика описана как потолок AP 20 (а не «AP×СУ»), Артиллерия — без «раз в 2 раунда»", () => {
    expect(WEAPON_PROPERTIES.lance.desc).toContain("20 AP");
    expect(WEAPON_PROPERTIES.ordnance.desc).not.toContain("раз в 2");
  });
});
