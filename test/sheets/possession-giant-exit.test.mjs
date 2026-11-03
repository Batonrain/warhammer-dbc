// test/sheets/possession-giant-exit.test.mjs
//
// Дар Одержимого «Гигант» (книга: «+10 к максимуму и текущему количеству Ран»).
// Максимум держится на производном effectiveMax, пока демон проявлен, а текущие
// Раны при входе поднимаются записью в хранимое system.wounds.value. Выход из
// Проявления забирал бонус максимума, но не срезал текущие Раны: на живом листе
// оставалось «20 из 10» (проверка в Foundry 03.11.2026, задача Sahara 20-10) —
// производный кламп character.mjs работает только пока у максимума есть поправка.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured } from "../support/foundry-stub.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { toggleManifest } from "../../module/sheets/tabs/possession.mjs";

const talent = name => ({ id: name, name, type: "talent", system: {}, getFlag: () => undefined });

function possessed({ wounds, giant = true, manifested = true } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(system, {
    alignment: "heretic", possessed: true,
    possession: { manifested },
    corruption: { value: 40 },
    wounds
  });
  const items = giant ? [talent("Giant / Дар: Гигант")] : [];
  items.get = id => items.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Одержимый", system, items, getFlag: () => undefined };
  const prepare = () => WarhammerActor.prototype.prepareDerivedData.call(actor);
  actor.update = async updates => {
    for (const [path, value] of Object.entries(updates)) {
      const keys = path.replace(/^system\./, "").split(".");
      let node = actor.system;
      for (const k of keys.slice(0, -1)) node = node[k] ??= {};
      node[keys.at(-1)] = value;
    }
    prepare();
  };
  prepare();
  return actor;
}

describe("Одержимый: Дар «Гигант» и выход из Проявления", () => {
  beforeEach(() => { captured.chat.length = 0; captured.nextRoll = 1; });

  it("выход из Проявления срезает текущие Раны до максимума без Дара", async () => {
    const a = possessed({ wounds: { max: 10, value: 20 } });
    expect(a.system.wounds.effectiveMax).toBe(20);
    await toggleManifest(a);
    expect(a.system.possession.manifested).toBe(false);
    expect(a.system.wounds.effectiveMax).toBe(10);
    expect(a.system.wounds.value).toBe(10);
  });

  it("Раны ниже нового максимума при выходе остаются как были", async () => {
    const a = possessed({ wounds: { max: 10, value: 4 } });
    await toggleManifest(a);
    expect(a.system.wounds.value).toBe(4);
  });

  it("вход и выход несколько раз подряд: +10 при входе, срез при выходе, лишнего не копится", async () => {
    const a = possessed({ wounds: { max: 10, value: 10 }, manifested: false });
    for (let i = 0; i < 3; i++) {
      await toggleManifest(a);                       // вход
      expect(a.system.wounds.value).toBe(20);
      await toggleManifest(a);                       // выход
      expect(a.system.wounds.value).toBe(10);
    }
  });

  it("без Дара «Гигант» выход Раны не трогает", async () => {
    const a = possessed({ wounds: { max: 10, value: 7 }, giant: false });
    await toggleManifest(a);
    expect(a.system.wounds.value).toBe(7);
    expect(a.system.wounds.effectiveMax).toBe(10);
  });
});

// Одержимый, получивший архетип ПОКУПКОЙ (buyEliteArchetype): флаг system.possessed
// там остаётся false, а вкладка Одержимого видна (predicates.isPossessed считает
// и сам архетип). Авто-эффекты Проявления (rules/character.mjs) читали один флаг,
// и Дар «Гигант» давал +10 к текущим Ранам без +10 к максимуму: «20 из 10» после
// входа и после выхода (живая проверка 03.11.2026, Sahara 20-10-caa0).
describe("Одержимый, купивший архетип (флаг possessed не стоит): Дар «Гигант»", () => {
  beforeEach(() => { captured.chat.length = 0; captured.nextRoll = 1; });

  function viaArchetype({ wounds, manifested = false } = {}) {
    const a = possessed({ wounds, manifested });
    a.system.possessed = false;
    a.system.alignment = "unaligned";
    a.system.eliteArchetype = "Possessed / Одержимый";
    WarhammerActor.prototype.prepareDerivedData.call(a);
    return a;
  }

  it("вход: Раны 20, максимум 20; выход: 10 из 10; три цикла подряд", async () => {
    const a = viaArchetype({ wounds: { max: 10, value: 10 } });
    for (let i = 0; i < 3; i++) {
      await toggleManifest(a);
      expect(a.system.wounds.effectiveMax).toBe(20);
      expect(a.system.wounds.value).toBe(20);
      await toggleManifest(a);
      expect(a.system.wounds.effectiveMax).toBe(10);
      expect(a.system.wounds.value).toBe(10);
    }
  });

  it("набранные законно Раны ниже максимума не обнуляются ни при входе, ни при выходе", async () => {
    const a = viaArchetype({ wounds: { max: 10, value: 6 } });
    await toggleManifest(a);
    expect(a.system.wounds.value).toBe(16);
    a.system.wounds.value = 3;
    await toggleManifest(a);
    expect(a.system.wounds.value).toBe(3);
  });

  it("авто-эффекты Проявления на месте: Unnatural S от профиля и Size без SPD", async () => {
    const a = viaArchetype({ wounds: { max: 10, value: 10 } });
    await toggleManifest(a);
    expect(a.system.possessionActive?.applied?.length).toBeGreaterThan(0);
  });

  it("без архетипа и без флага Проявление авто-эффектов не даёт", async () => {
    const a = viaArchetype({ wounds: { max: 10, value: 10 } });
    a.system.eliteArchetype = "";
    await toggleManifest(a);
    expect(a.system.possessionActive).toBeNull();
    expect(a.system.wounds.effectiveMax).toBe(10);
  });
});
