// test/rules/disease-infection-effects.test.mjs
//
// «Последствия заражения» болезни (Sahara task-3ab7, п.2 и п.3; решение
// владельца 26.10.2026) и правка строк vectorTests/infectionEffects на листе
// болезни. Чистая часть — module/rules/disease-infection.mjs; бросок и карточка —
// combat/disease-infection.mjs (test/combat/disease-infection.test.mjs).
//
// Настоящие болезни из packs-src: книга (core, «Болезни», стр. 470-471)
//   Хворь Слабости — «заражается и немедленно получает 2d10 урона в А»;
//   Ходячая Оспа  — «Персонажи могут тратить Очки Бесчестия или Судьбы, чтобы
//                    автоматически проходить этот тест после Провала».

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { DiseaseData } from "../../module/data/item/disease.mjs";
import {
  infectionEffects, infectionDamage, hasAutoSuccess, EFFECT_KINDS,
  rowsAdd, rowsRemove, rowsPatch, BLANK_VECTOR, BLANK_EFFECT
} from "../../module/rules/disease-infection.mjs";

const DISEASES = allPackDocuments("diseases").map(d => d.doc).filter(d => d.type === "disease");
const byName = start => DISEASES.find(d => d.name.startsWith(start));

describe("настоящие болезни: последствия заражения лежат в данных и переживают схему", () => {
  it("Хворь Слабости: немедленно 2d10 урона в А (Ловкость) — один урон", () => {
    const d = byName("Хворь Слабости");
    expect(infectionDamage(d)).toEqual([expect.objectContaining({ kind: "charDamage", char: "ag", formula: "2d10" })]);
    expect(hasAutoSuccess(d)).toBe(false);
    // схема не теряет поле (ловушка «поле, забытое в схеме, пропадает»)
    const kept = new DiseaseData(structuredClone(d.system)).toObject();
    expect(infectionEffects({ system: kept })).toEqual(infectionEffects(d));
  }, PACK_SCAN_TIMEOUT);

  it("Ходячая Оспа: после провала Очко Бесчестия/Судьбы даёт авто-успех — и без урона", () => {
    const d = byName("Ходячая Оспа");
    expect(hasAutoSuccess(d)).toBe(true);
    expect(infectionDamage(d)).toEqual([]);
    const kept = new DiseaseData(structuredClone(d.system)).toObject();
    expect(hasAutoSuccess({ system: kept })).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("остальные болезни последствий заражения не несут", () => {
    const withEffects = DISEASES.filter(d => (d.system.infectionEffects ?? []).length).map(d => d.name);
    expect(withEffects.sort()).toEqual(["Хворь Слабости", "Ходячая Оспа"].sort());
  }, PACK_SCAN_TIMEOUT);

  it("умолчание схемы — пусто", () => {
    expect(new DiseaseData({}).toObject().infectionEffects).toEqual([]);
  });
});

describe("последствия заражения против текста «Путей передачи» (структура = слово книги)", () => {
  // Без \w/\b: русские буквы в них не входят (AGENTS.md, «Кириллица в регулярках»).
  const DAMAGE_RE = /немедленно\s+(?:получает\s+)?(\d*d\d+)\s+урона\s+(?:в\s+)?А/i;
  const AUTO_RE = /Очк[а-яё]+\s+Бесчест[а-яё]+\/Судьбы\s*[—–-]\s*авто-успех/i;

  for (const d of DISEASES) {
    it(`«${d.name}»: структура совпадает с текстом`, () => {
      const text = String(d.system.vectors ?? "");
      const dmg = text.match(DAMAGE_RE)?.[1] ?? null;
      expect(infectionDamage(d).map(e => e.formula)).toEqual(dmg ? [dmg] : []);
      expect(hasAutoSuccess(d)).toBe(AUTO_RE.test(text));
    }, PACK_SCAN_TIMEOUT);
  }
});

describe("infectionEffects: чистка записей", () => {
  const d = list => ({ system: { infectionEffects: list } });

  it("урон — только с известной Характеристикой и разбираемой формулой; неизвестный вид отбрасывается", () => {
    const list = infectionEffects(d([
      { kind: "charDamage", char: "ag", formula: "2d10", label: "Урон" },
      { kind: "charDamage", char: "zz", formula: "2d10" },
      { kind: "charDamage", char: "t", formula: "" },
      { kind: "charDamage", char: "t", formula: "abc" },
      { kind: "weird", char: "t", formula: "1d5" },
      null
    ]));
    expect(list).toEqual([{ kind: "charDamage", char: "ag", formula: "2d10", label: "Урон" }]);
  });
  it("подпись по умолчанию — из вида; авто-успех ни Характеристики, ни формулы не требует", () => {
    const [a] = infectionEffects(d([{ kind: "autoSuccessPoint" }]));
    expect(a.label).toBe(EFFECT_KINDS.autoSuccessPoint);
    expect(hasAutoSuccess(d([{ kind: "autoSuccessPoint" }]))).toBe(true);
  });
  it("нет поля / не массив / null — пусто", () => {
    expect(infectionEffects({ system: {} })).toEqual([]);
    expect(infectionEffects(d("x"))).toEqual([]);
    expect(infectionEffects(null)).toEqual([]);
  });
});

describe("правка строк на листе болезни: добавить, изменить, убрать", () => {
  it("rowsAdd не портит исходный массив и кладёт чистую заготовку", () => {
    const src = [{ label: "Кожа", char: "t", mod: 20 }];
    const out = rowsAdd(src, BLANK_VECTOR);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ label: "", char: "t", mod: 0 });
    expect(src).toHaveLength(1);
    out[1].label = "x";
    expect(BLANK_VECTOR.label).toBe("");
    expect(rowsAdd(undefined, BLANK_EFFECT)).toEqual([BLANK_EFFECT]);
  });
  it("rowsPatch: числовое поле приводится к целому, текст остаётся текстом, чужой индекс не трогает", () => {
    const src = [{ label: "Кожа", char: "t", mod: 20 }, { label: "Жидкости", char: "t", mod: -10 }];
    const out = rowsPatch(src, 1, "mod", "-30", ["mod"]);
    expect(out[1].mod).toBe(-30);
    expect(out[0]).toEqual(src[0]);
    expect(rowsPatch(src, 0, "mod", "abc", ["mod"])[0].mod).toBe(0);
    expect(rowsPatch(src, 0, "label", " Дым ", ["mod"])[0].label).toBe(" Дым ");
    expect(rowsPatch(src, 5, "mod", "1", ["mod"])).toEqual(src);
  });
  it("rowsRemove убирает ровно одну строку по индексу", () => {
    const src = [{ a: 1 }, { a: 2 }, { a: 3 }];
    expect(rowsRemove(src, 1)).toEqual([{ a: 1 }, { a: 3 }]);
    expect(rowsRemove(src, 9)).toEqual(src);
    expect(src).toHaveLength(3);
  });
  it("добавленный и заполненный вектор читает кнопка «Заражение» (самодельная болезнь)", async () => {
    const { diseaseVectors } = await import("../../module/rules/disease-infection.mjs");
    let list = rowsAdd([], BLANK_VECTOR);
    list = rowsPatch(list, 0, "label", "Дым", ["mod"]);
    list = rowsPatch(list, 0, "mod", "10", ["mod"]);
    expect(diseaseVectors({ system: { vectorTests: list } })).toEqual([{ label: "Дым", char: "t", mod: 10 }]);
  });
});
