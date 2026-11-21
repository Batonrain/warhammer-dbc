// test/tools/automation-coverage.test.mjs
//
// Замер автоматизации Черт/Талантов/Навыков (tools/automation-coverage.mjs).
// Сам замер — инструмент для отчёта, а не гейт: числа меняются с каждой
// закрытой механикой. Здесь проверяется, что раскладка не врёт по форме —
// каждая запись в одной корзине, корзины в сумме дают всё, и на известных
// записях корзина та, что ожидается по их устройству в паке.

import { describe, it, expect, beforeAll } from "vitest";
import { analyzeCoverage, tally, BUCKETS, toMarkdown, reasonOf } from "../../tools/automation-coverage.mjs";

let res;
beforeAll(async () => { res = await analyzeCoverage(); }, 60_000);

const find = (re) => res.items.find(i => re.test(i.name));

describe("automation-coverage", () => {
  it("каждая запись — ровно в одной корзине, сумма сходится", () => {
    const t = tally(res.items);
    expect(res.items.length).toBeGreaterThan(1000);
    expect(BUCKETS.reduce((s, b) => s + t[b], 0)).toBe(t.total);
    for (const it of res.items) expect(BUCKETS).toContain(it.bucket);
  });

  it("ActiveEffect засчитывается как «работает»", () => {
    const it = find(/^Unnatural T \(4\) \/ Сверхъест\. Стойкость$/);
    expect(it?.bucket).toBe("auto");
    expect(it.ways).toContain("effect");
  });

  it("Черта только с кнопкой-памяткой — «памятка»", () => {
    const it = find(/^The Old Days \/ Старые Деньки$/);
    expect(it?.bucket).toBe("memo");
  });

  it("шаблонная причина «Не смоделировано» распознаётся", () => {
    expect(reasonOf("Не смоделировано: эффект срабатывает по условию/триггеру или сочетает")).toBe("условие или триггер");
    expect(reasonOf("")).toBe("без заметки");
  });

  it("у каждого Навыка есть строка в отчёте", () => {
    expect(res.skills.length).toBe(28);
    const md = toMarkdown(res, { date: "2026-11-18" });
    for (const s of res.skills) expect(md).toContain(`| ${s.label} / ${s.en}`);
  });
});
