// test/apps/flesh-is-weak.test.mjs
//
// Flesh is Weak / Плоть Слаба (Таланты Механикума, Sahara 3-cc96 п.7; DoomBC —
// Основная книга): «Персонаж увеличивает рейтинг Трейта Machine на 1. Можно
// брать до ½I.b (окр.▲) раз.» Каждая копия Таланта поднимает рейтинг Machine на 1,
// броня Machine пересчитывается под новый рейтинг.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { syncFleshIsWeak, restoreFleshIsWeakAfterSync } from "../../module/apps/flesh-is-weak.mjs";
import { buildSyncReport, applySyncReport, buildPackIndex, diffItemAgainstPack } from "../../module/apps/content-sync.mjs";
import { planFleshIsWeak, planFleshIsWeakAfterSync, fleshIsWeakCopies, fleshIsWeakCap, isMachineTrait, isFleshIsWeak }
  from "../../module/rules/flesh-is-weak.mjs";

const MACHINE = packDocById("packs-src/traits", "a9uOuJE4oCOisx8d");

/** Предмет-заглушка с getFlag/update по пути; для Machine — настоящие ActiveEffect из пака. */
function stub(data, id) {
  const it = structuredClone(data);
  it.id = id; it.flags ??= {};
  it.getFlag = (s, k) => it.flags[s]?.[k];
  it.effects = (it.effects ?? []).map(e => ({ ...e, id: e._id }));
  it.updateEmbeddedDocuments = async (_t, ups) => {
    for (const u of ups) {
      const e = it.effects.find(x => x.id === u._id);
      e.system.changes = u["system.changes"];
    }
  };
  it.update = async ch => {
    for (const [path, value] of Object.entries(ch)) {
      const del = path.match(/^flags\.([^.]+)\.-=(.+)$/);
      if (del) { delete it.flags[del[1]]?.[del[2]]; continue; }
      const m = path.match(/^flags\.([^.]+)\.(.+)$/);
      if (m) { (it.flags[m[1]] ??= {})[m[2]] = value; continue; }
      const keys = path.split(".");
      let node = it;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  return it;
}
const machine = (id, rating = 3) => {
  const m = stub({ ...MACHINE, system: { ...MACHINE.system, rating } }, id);
  for (const e of m.effects) for (const ch of e.system.changes) ch.value = rating;
  return m;
};
const fiw = id => stub({ type: "talent", name: "Flesh is Weak / Плоть Слаба", system: {} }, id);
const actorWith = items => { const a = new Actor(); a.items = items; return a; };
const ap = m => m.effects.flatMap(e => e.system.changes.map(c => c.value));

describe("чистая часть", () => {
  it("копии, предел ½I.b вверх, опознание по имени", () => {
    expect(fleshIsWeakCopies([fiw("a"), fiw("b"), machine("m")])).toBe(2);
    expect(fleshIsWeakCap(5)).toBe(3);
    expect(fleshIsWeakCap(4)).toBe(2);
    expect(isMachineTrait(machine("m"))).toBe(true);
    expect(isMachineTrait({ type: "talent", name: "Machine Empathy / Машинная Эмпатия" })).toBe(false);
    expect(isFleshIsWeak(fiw("a"))).toBe(true);
  });
  it("план: нет Machine или нет Таланта — менять нечего; при двух Machine выбирается старший рейтинг", () => {
    expect(planFleshIsWeak([fiw("a")])).toBeNull();
    expect(planFleshIsWeak([machine("m")])).toBeNull();
    const plan = planFleshIsWeak([fiw("a"), machine("m1", 2), machine("m2", 3)]);
    expect(plan.target.id).toBe("m2");
    expect(plan.delta).toBe(1);
  });
});

describe("syncFleshIsWeak", () => {
  it("одна копия: рейтинг Machine 3 → 4, броня +4 на всех участках, вклад записан флагом", async () => {
    const m = machine("m");
    const a = actorWith([m, fiw("a")]);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(4);
    expect(ap(m).every(v => v === 4)).toBe(true);
    expect(ap(m)).toHaveLength(6);
    expect(m.flags["warhammer-dbc"].fiwContribution).toBe(1);
  });

  it("идемпотентно: повторный вызов без перемен ничего не меняет", async () => {
    const m = machine("m");
    const a = actorWith([m, fiw("a")]);
    await syncFleshIsWeak(a);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(4);
  });

  it("вторая копия добавляет ещё +1; снятие обеих возвращает исходное и стирает флаг", async () => {
    const m = machine("m");
    const t1 = fiw("a"), t2 = fiw("b");
    const items = [m, t1, t2];
    const a = actorWith(items);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(5);
    expect(ap(m).every(v => v === 5)).toBe(true);
    items.splice(items.indexOf(t2), 1);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(4);
    items.splice(items.indexOf(t1), 1);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(3);
    expect(ap(m).every(v => v === 3)).toBe(true);
    expect(m.flags["warhammer-dbc"].fiwContribution).toBeUndefined();
  });

  it("две Machine (одна от Перерождения): +1 получает только та, у которой больше рейтинг", async () => {
    const big = machine("m1", 3), small = machine("m2", 2);
    const a = actorWith([small, big, fiw("a")]);
    await syncFleshIsWeak(a);
    expect(big.system.rating).toBe(4);
    expect(small.system.rating).toBe(2);
  });

  it("нет Machine — Талант ничего не поднимает, ничего не создаётся", async () => {
    const t = fiw("a");
    const a = actorWith([t]);
    await syncFleshIsWeak(a);
    expect(a.items).toHaveLength(1);
  });
});

// Решение владельца 26.10.2026 (вариант B): после «Обновить мир» сверка затирает
// +N от Таланта в Machine (рейтинг и броня), флаг вклада остаётся. Вклад
// возвращается ТОЛЬКО по факту правки сверкой; реакция на любое изменение рейтинга
// прибавила бы +N дважды при ручной правке.
describe("«Плоть Слаба» после «Обновить мир»", () => {
  const setEffects = (m, v) => { for (const e of m.effects) for (const ch of e.system.changes) ch.value = v; };

  it("чистый план: рейтинг перезаписан — пак + N; только эффекты — базовый = рейтинг − N; ничего не правили — null", () => {
    expect(planFleshIsWeakAfterSync({ rating: 3, contribution: 1, ratingOverwritten: true, effectsReplaced: true }))
      .toEqual({ newRating: 4, effects: { from: 3, to: 4 } });
    expect(planFleshIsWeakAfterSync({ rating: 3, contribution: 1, ratingOverwritten: true }))
      .toEqual({ newRating: 4, effects: null });
    expect(planFleshIsWeakAfterSync({ rating: 5, contribution: 2, effectsReplaced: true }))
      .toEqual({ newRating: null, effects: { from: 3, to: 5 } });
    expect(planFleshIsWeakAfterSync({ rating: 3, contribution: 1 })).toBeNull();
    expect(planFleshIsWeakAfterSync({ rating: 3, contribution: 0, ratingOverwritten: true })).toBeNull();
  });

  it("сверка записала рейтинг и броню пака (3): вклад возвращается — рейтинг 4, броня +4", async () => {
    const m = machine("m");
    const a = actorWith([m, fiw("a")]);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(4);
    // Сверка: значения пака затёрли всё, флаг остался.
    m.system.rating = 3; setEffects(m, 3);
    expect(planFleshIsWeak(a.items)).toBeNull();                     // сам по себе синк «копий столько же» ничего не вернёт
    expect(await restoreFleshIsWeakAfterSync(m, { ratingOverwritten: true, effectsReplaced: true })).toBe(true);
    expect(m.system.rating).toBe(4);
    expect(ap(m).every(v => v === 4)).toBe(true);
    expect(m.flags["warhammer-dbc"].fiwContribution).toBe(1);        // флаг не двигается
  });

  it("сверка пересоздала только эффекты (рейтинг прежний, уже с +N): рейтинг не растёт второй раз, броня догоняет", async () => {
    const m = machine("m");
    await syncFleshIsWeak(actorWith([m, fiw("a")]));
    setEffects(m, 3);                                                 // пак: броня под базовый рейтинг
    await restoreFleshIsWeakAfterSync(m, { effectsReplaced: true });
    expect(m.system.rating).toBe(4);
    expect(ap(m).every(v => v === 4)).toBe(true);
  });

  it("без пересчёта вызов ничего не делает; ручная правка рейтинга ГМом не прибавляет +N второй раз", async () => {
    const m = machine("m");
    const a = actorWith([m, fiw("a")]);
    await syncFleshIsWeak(a);
    m.system.rating = 6;                                              // ГМ поправил руками
    expect(await restoreFleshIsWeakAfterSync(m)).toBe(false);
    await syncFleshIsWeak(a);
    expect(m.system.rating).toBe(6);
  });

  it("Machine без вклада Таланта сверка не трогает", async () => {
    const m = machine("m");
    expect(await restoreFleshIsWeakAfterSync(m, { ratingOverwritten: true, effectsReplaced: true })).toBe(false);
    expect(m.system.rating).toBe(3);
  });

  // Ревью: опора рейтинга бывает трёх видов, и строка не должна врать ни на одном.
  describe("diffItemAgainstPack: три вида опоры рейтинга при вкладе +1 (рейтинг на предмете 4)", () => {
    const statusFor = async (baseline, packRating) => {
      const m = machine("m");
      await syncFleshIsWeak(actorWith([m, fiw("a")]));                // рейтинг 4, флаг 1
      if (baseline !== undefined) m.flags["warhammer-dbc"].contentSync = { baseline: { rating: baseline } };
      const rows = diffItemAgainstPack(m, { system: { rating: packRating } }).filter(d => d.path === "rating");
      return rows.length ? rows[0].status : null;
    };
    it("записанная опора = значение пака (3): пак не менялся — строки нет; поднялся до 5 — «чисто»", async () => {
      expect(await statusFor(3, 3)).toBeNull();
      expect(await statusFor(3, 5)).toBe("clean");
    });
    it("опора снята с актора вместе с +N (4): пак поднялся до 5 — «чисто», не конфликт", async () => {
      expect(await statusFor(4, 5)).toBe("clean");
    });
    it("неявная опора (текущее значение, с +N): пак не менялся (3) — строки нет; поднялся — «чисто»", async () => {
      expect(await statusFor(undefined, 3)).toBeNull();
      expect(await statusFor(undefined, 5)).toBe("clean");
    });
    it("ГМ правил рейтинг руками (6 при опоре 3 и вкладе 1) — по-прежнему конфликт", async () => {
      const m = machine("m");
      await syncFleshIsWeak(actorWith([m, fiw("a")]));
      m.flags["warhammer-dbc"].contentSync = { baseline: { rating: 3 } };
      m.system.rating = 6;
      expect(diffItemAgainstPack(m, { system: { rating: 5 } }).find(d => d.path === "rating").status).toBe("conflict");
    });
  });

  it("applySyncReport: пак поднял рейтинг Machine 3 → 5 — Machine с +1 получает 6 и броню +6; строка «чистая», не конфликт", async () => {
    const m = machine("m");
    await syncFleshIsWeak(actorWith([m, fiw("a")]));                  // рейтинг 4, флаг 1
    m.flags["warhammer-dbc"].contentSync = { baseline: { rating: 3 } };
    const pack = { uuid: "u-m", name: MACHINE.name, type: "trait", system: { rating: 5 } };
    const actor = {
      id: "a1", name: "Механикум", items: [m],
      updateEmbeddedDocuments: async (_t, updates) => {
        for (const u of updates) {
          const { _id, ...rest } = u;
          await m.update(rest);
        }
      }
    };
    actor.items.get = id => actor.items.find(i => i.id === id);
    const report = buildSyncReport([actor], buildPackIndex([pack]));
    const row = report.rows.find(r => r.path === "rating");
    expect(row.entries[0].status).toBe("clean");
    globalThis.game = { actors: { get: () => actor } };
    await applySyncReport(report, new Set([row.entries[0].entryKey]));
    expect(m.system.rating).toBe(6);
    // Опора — значение пака (заглушка кладёт путь плоским ключом — разворачиваем, как Foundry).
    const written = m.flags["warhammer-dbc"]["contentSync.baseline.rating"];
    expect(written).toBe(5);
    m.flags["warhammer-dbc"].contentSync = { baseline: { rating: written } };
    // Следующий прогон «Обновить мир» расхождения не видит.
    expect(buildSyncReport([actor], buildPackIndex([pack])).rows.find(r => r.path === "rating")).toBeUndefined();
  });
});
