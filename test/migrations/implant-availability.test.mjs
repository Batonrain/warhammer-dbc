// test/migrations/implant-availability.test.mjs
//
// wdbc-wc3: PR #452 добавил имплантам Доступность и варианты Best.Q только в
// packs-src. Предмет на акторе — снимок момента выдачи, компендиум он не
// перечитывает, поэтому у всех, кому имплант уже выдали, Доступность осталась
// нулевой, а bestQualityEffects пустым. Пустой список — ещё и гейт диалога
// выбора эффекта (needsBestQChoice), так что окно им не предлагалось вовсе.

import { describe, it, expect, afterEach } from "vitest";
import { implantAvailabilityPatch, migrateImplantAvailability } from "../../module/migrations/implant-availability.mjs";

const implant = (system = {}) => ({ type: "implant", name: "Биологическая Рука", system });
const book    = (system = {}) => ({ type: "implant", name: "Биологическая Рука", system });

const OPTS = [{ label: "Unnatural S(4)", note: "усиливает Руку Гладиатора" }];

describe("implantAvailabilityPatch", () => {
  it("Доступность 0 у выданного, в книге 4 — доливается", () => {
    const patch = implantAvailabilityPatch(implant({ availability: 0 }), book({ availability: 4 }));
    expect(patch).toEqual({ "system.availability": 4 });
  });

  it("Доступность уже проставлена ГМом — НЕ перетирается книжной", () => {
    const patch = implantAvailabilityPatch(implant({ availability: 2 }), book({ availability: 4 }));
    expect(patch).toBeNull();
  });

  it("пустой список вариантов Best.Q — доливается из книги", () => {
    const patch = implantAvailabilityPatch(
      implant({ availability: 4, bestQualityEffects: [] }),
      book({ availability: 4, bestQualityEffects: OPTS })
    );
    expect(patch).toEqual({ "system.bestQualityEffects": OPTS });
  });

  it("свой непустой список вариантов не трогается", () => {
    const mine = [{ label: "своё", note: "" }];
    const patch = implantAvailabilityPatch(
      implant({ availability: 4, bestQualityEffects: mine }),
      book({ availability: 4, bestQualityEffects: OPTS })
    );
    expect(patch).toBeNull();
  });

  it("оба поля пусты — доливаются разом", () => {
    const patch = implantAvailabilityPatch(
      implant({ availability: 0, bestQualityEffects: [] }),
      book({ availability: 4, bestQualityEffects: OPTS })
    );
    expect(patch).toEqual({ "system.availability": 4, "system.bestQualityEffects": OPTS });
  });

  it("в книге Доступности тоже нет — доливать нечего, ноль не «чинится» нулём", () => {
    expect(implantAvailabilityPatch(implant({ availability: 0 }), book({ availability: 0 }))).toBeNull();
  });

  it("не имплант — не наш случай", () => {
    const w = { type: "weapon", name: "Меч", system: { availability: 0 } };
    expect(implantAvailabilityPatch(w, book({ availability: 4 }))).toBeNull();
  });

  it("исходника нет — null, без падения", () => {
    expect(implantAvailabilityPatch(implant({ availability: 0 }), null)).toBeNull();
  });

  it("идемпотентность: повторный прогон по уже долитому ничего не даёт", () => {
    const first = implantAvailabilityPatch(
      implant({ availability: 0, bestQualityEffects: [] }),
      book({ availability: 4, bestQualityEffects: OPTS })
    );
    const after = implant({ availability: first["system.availability"],
                            bestQualityEffects: first["system.bestQualityEffects"] });
    expect(implantAvailabilityPatch(after, book({ availability: 4, bestQualityEffects: OPTS }))).toBeNull();
  });
});

// wdbc-wc3, четвёртая часть: поле появилось у ВСЕХ 303 имплантов, а книга даёт
// его 79 биоимплантам Друкхари. С умолчанием 0 лист утверждал у остальных
// «0 Дефицит» — не книжное значение, а заглушка, по которой игрок не должен
// ориентироваться при закупке. Умолчание стало null («не указано в книге»),
// и два ЗАКОННЫХ нуля (импланты с «R 0.» в описании) при этом сохраняются.
describe("данные паков: заполнено ровно там, где книга это говорит", () => {
  it("ключ availability присутствует ровно у 79 имплантов, из них два — законный 0", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../packs-src/implants");

    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".json") && !e.name.startsWith("_Folder")) files.push(p);
      }
    })(root);

    let withKey = 0, zeros = 0;
    for (const f of files) {
      const sys = JSON.parse(fs.readFileSync(f, "utf8")).system ?? {};
      if (!("availability" in sys)) continue;
      withKey++;
      if (sys.availability === 0) zeros++;
    }
    expect(files.length).toBeGreaterThan(250);
    expect(withKey).toBe(79);
    expect(zeros).toBe(2);
  });
});

// wdbc-059h: по образцу gear-equipped/wdbc-dyi — было один try на ВЕСЬ цикл по
// акторам, сбой на одном глушил доливку остальным молча.
describe("migrateImplantAvailability: изоляция сбоя одного актора (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  const fakePack = (doc) => ({
    getIndex: async () => [{ _id: "src1", name: doc.name }],
    getDocument: async (id) => (id === "src1" ? doc : null)
  });

  function actorWith(id, items, { throwOnUpdate = false } = {}) {
    return {
      id, name: `Actor ${id}`, items,
      async updateEmbeddedDocuments(type, updates) {
        if (throwOnUpdate) throw new Error(`boom on ${id}`);
        for (const u of updates) {
          const item = items.find(i => i.id === u._id);
          if (item) Object.assign(item.system, { availability: u["system.availability"] });
        }
      }
    };
  }

  it("сбой на одном акторе не прерывает доливку остальным и не топит их результат", async () => {
    const src = book({ availability: 4 });
    src._id = "src1";
    const bad = actorWith("bad", [implant({ availability: 0 })], { throwOnUpdate: true });
    const good = actorWith("good", [implant({ availability: 0 })]);

    globalThis.game = {
      user: { isGM: true },
      actors: [bad, good],
      scenes: [],
      packs: { get: () => fakePack(src) }
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateImplantAvailability();

    expect(res.fixed).toBe(1);
    expect(res.failed).toBe(1);
    expect(good.items[0].system.availability).toBe(4);
    expect(bad.items[0].system.availability).toBe(0);
  });
});
