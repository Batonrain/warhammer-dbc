// test/migrations/legion-geneseed-size-fix.test.mjs
//
// wdbc-nesq: Геносемя XX Альфа-Легиона/Железных Змей до PR #421 давало
// sizeMod:1 в константе; правка константы не трогает уже созданных Черт
// «Геносемя: <легион>» — эта миграция выправляет сохранённое значение по
// ТЕКУЩЕЙ константе (не по двум захардкоженным именам).

import { describe, it, expect } from "vitest";
import {
  currentSizeModByEffName, geneSeedSizeMismatch, migrateLegionGeneSeedSize, geneSeedEffectSizeMod
} from "../../module/migrations/legion-geneseed-size-fix.mjs";
import { LEGIONS } from "../../module/constants/legions.mjs";

// effectSizeMod — Черта уже прошла миграцию эффектов (migrations/item-
// effects.mjs): sizeMod переехал в embedded ActiveEffect с ключом
// system.sizeMod, и актор читает ИМЕННО его, а не легаси-поле. Именно в этом
// виде Черты и лежат во всех живых мирах, потому что migrateAllItemEffects
// гоняется у ГМа на каждой загрузке.
function trait({ id = "t1", name, source = "Легион", sizeMod = 0,
                 effectSizeMod = null, extraChange = null } = {}) {
  const flags = {};
  const effects = [];
  if (effectSizeMod !== null) {
    const changes = [{ key: "system.sizeMod", mode: "add", value: effectSizeMod, phase: "initial" }];
    if (extraChange) changes.push(extraChange);
    effects.push({
      id: "eff1", disabled: false, system: { changes },
      async update(data) { if (data["system.changes"]) this.system.changes = data["system.changes"]; }
    });
  }
  return {
    id, name, type: "trait", effects,
    system: { source, effects: { sizeMod } },
    // getFlag нужен самой миграции только через geneSeedEffectSizeMod (там
    // читаются item.effects), но фикстура держит его: Foundry-документ всегда
    // его имеет, а без него любая будущая проверка флага здесь упала бы на
    // «не функция», а не на смысле теста.
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async update(data) {
      if (Object.hasOwn(data, "system.effects.sizeMod")) this.system.effects.sizeMod = data["system.effects.sizeMod"];
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const eid of ids) {
        const i = effects.findIndex(e => e.id === eid);
        if (i !== -1) effects.splice(i, 1);
      }
    }
  };
}

describe("currentSizeModByEffName", () => {
  it("книжная константа для XX Альфа Легион и XIII Железные Змеи сейчас 0", () => {
    const map = currentSizeModByEffName();
    expect(map.get("XX Альфа Легион")).toBe(0);
    expect(map.get("XIII Железные Змеи")).toBe(0);
  });

  it("покрывает все легионы и капитулы разом", () => {
    const map = currentSizeModByEffName();
    const totalChapters = LEGIONS.reduce((n, l) => n + (l.chapters?.length || 0), 0);
    expect(map.size).toBe(LEGIONS.length + totalChapters);
  });
});

describe("geneSeedSizeMismatch", () => {
  it("Черта с устаревшим sizeMod:1 (Альфа Легион) — расхождение найдено", () => {
    const item = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 1 });
    expect(geneSeedSizeMismatch(item)).toEqual({ correct: 0, stored: 1, inEffect: 0 });
  });

  it("Черта с устаревшим sizeMod:1 (Железные Змеи) — расхождение найдено", () => {
    const item = trait({ name: "Геносемя: XIII Железные Змеи", sizeMod: 1 });
    expect(geneSeedSizeMismatch(item)).toEqual({ correct: 0, stored: 1, inEffect: 0 });
  });

  it("уже правильный sizeMod:0 — расхождения нет", () => {
    const item = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 0 });
    expect(geneSeedSizeMismatch(item)).toBeNull();
  });

  it("не Черта — null", () => {
    expect(geneSeedSizeMismatch({ type: "weapon", name: "Геносемя: XX Альфа Легион" })).toBeNull();
  });

  it("Черта не источника «Легион» (одноимённая совпала случайно) — null", () => {
    const item = trait({ name: "Геносемя: XX Альфа Легион", source: "Прочее", sizeMod: 1 });
    expect(geneSeedSizeMismatch(item)).toBeNull();
  });

  it("Черта не «Геносемя: ...» — null, даже источника «Легион»", () => {
    const item = trait({ name: "Культура: Альфа Легион", sizeMod: 1 });
    expect(geneSeedSizeMismatch(item)).toBeNull();
  });

  it("effName не найден в текущих LEGIONS (легион переименован/удалён) — null, не трогать", () => {
    const item = trait({ name: "Геносемя: Несуществующий Легион", sizeMod: 1 });
    expect(geneSeedSizeMismatch(item)).toBeNull();
  });

  it("легион БЕЗ известной ошибки (sizeMod и правильный, и сохранённый — 0) — null", () => {
    const item = trait({ name: "Геносемя: XIII Ультрамарины", sizeMod: 0 });
    expect(geneSeedSizeMismatch(item)).toBeNull();
  });
});

describe("migrateLegionGeneSeedSize", () => {
  function actorWith(items) {
    return { items };
  }

  it("правит только расходящиеся Черты, остальных не трогает", async () => {
    const bad1 = trait({ id: "bad1", name: "Геносемя: XX Альфа Легион", sizeMod: 1 });
    const bad2 = trait({ id: "bad2", name: "Геносемя: XIII Железные Змеи", sizeMod: 1 });
    const ok   = trait({ id: "ok", name: "Геносемя: XIII Ультрамарины", sizeMod: 0 });
    const other = trait({ id: "other", name: "Культура: Альфа Легион", sizeMod: 5 });

    globalThis.game = {
      user: { isGM: true },
      actors: [actorWith([bad1, ok, other]), actorWith([bad2])]
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateLegionGeneSeedSize();

    expect(res.fixed).toBe(2);
    expect(bad1.system.effects.sizeMod).toBe(0);
    expect(bad2.system.effects.sizeMod).toBe(0);
    expect(ok.system.effects.sizeMod).toBe(0);
    expect(other.system.effects.sizeMod).toBe(5); // не тронут
  });

  it("не ГМ — предупреждает, ничего не трогает", async () => {
    const bad = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 1 });
    globalThis.game = { user: { isGM: false }, actors: [actorWith([bad])] };
    let warned = false;
    globalThis.ui = { notifications: { info: () => {}, warn: () => { warned = true; } } };

    const res = await migrateLegionGeneSeedSize();

    expect(warned).toBe(true);
    expect(res).toBeUndefined();
    expect(bad.system.effects.sizeMod).toBe(1);
  });

  // ГЛАВНЫЙ случай живых миров: миграция эффектов уже перенесла sizeMod в
  // ActiveEffect, и актор Размер берёт ОТТУДА. Правка одного легаси-поля
  // Размер не меняла вовсе, но рапортовала «выправлено у Черт: N» — зелёные
  // тесты при мёртвой миграции.
  it("Черта уже мигрирована в ActiveEffect — снимается и запись эффекта", async () => {
    const bad = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 1, effectSizeMod: 1 });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([bad])] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateLegionGeneSeedSize();

    expect(res.fixed).toBe(1);
    expect(bad.system.effects.sizeMod).toBe(0);
    expect(geneSeedEffectSizeMod(bad)).toBe(0);
    expect(bad.effects).toHaveLength(0); // эффект опустел — удалён целиком
  });

  it("легаси-поле уже 0, а эффект всё ещё даёт +1 — расхождение всё равно найдено", async () => {
    const bad = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 0, effectSizeMod: 1 });
    expect(geneSeedSizeMismatch(bad)).toEqual({ correct: 0, stored: 0, inEffect: 1 });

    globalThis.game = { user: { isGM: true }, actors: [actorWith([bad])] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
    const res = await migrateLegionGeneSeedSize();

    expect(res.fixed).toBe(1);
    expect(geneSeedEffectSizeMod(bad)).toBe(0);
  });

  it("в эффекте есть и другие changes — сносится только строка Размера, эффект живёт", async () => {
    const other = { key: "system.armorBonus.body", mode: "add", value: 2, phase: "initial" };
    const bad = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 1,
                        effectSizeMod: 1, extraChange: other });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([bad])] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    await migrateLegionGeneSeedSize();

    expect(bad.effects).toHaveLength(1);
    expect(bad.effects[0].system.changes).toEqual([other]);
  });

  it("повторный прогон ничего не меняет (идемпотентность)", async () => {
    const bad = trait({ name: "Геносемя: XX Альфа Легион", sizeMod: 1, effectSizeMod: 1 });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([bad])] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    expect((await migrateLegionGeneSeedSize()).fixed).toBe(1);
    expect((await migrateLegionGeneSeedSize()).fixed).toBe(0);
  });

  it("ничего расходящегося — fixed:0, без ошибок", async () => {
    const ok = trait({ name: "Геносемя: XIII Ультрамарины", sizeMod: 0 });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([ok])] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateLegionGeneSeedSize();
    expect(res.fixed).toBe(0);
  });
});
