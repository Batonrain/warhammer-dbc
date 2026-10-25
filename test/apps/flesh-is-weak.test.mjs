// test/apps/flesh-is-weak.test.mjs
//
// Flesh is Weak / Плоть Слаба (Таланты Механикума, Sahara 3-cc96 п.7; DoomBC —
// Основная книга): «Персонаж увеличивает рейтинг Трейта Machine на 1. Можно
// брать до ½I.b (окр.▲) раз.» Каждая копия Таланта поднимает рейтинг Machine на 1,
// броня Machine пересчитывается под новый рейтинг.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { syncFleshIsWeak } from "../../module/apps/flesh-is-weak.mjs";
import { planFleshIsWeak, fleshIsWeakCopies, fleshIsWeakCap, isMachineTrait, isFleshIsWeak }
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
