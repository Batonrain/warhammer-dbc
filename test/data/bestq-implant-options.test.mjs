// test/data/bestq-implant-options.test.mjs
//
// ВАРИАНТЫ БОНУСНОГО ЭФФЕКТА BEST.Q-БИОИМПЛАНТОВ (wdbc-ukpu).
//
// Книга Аэльдари: Ответвления, «АРСЕНАЛ ДРУКХАРИ»: Best.Q-биоимплант даёт один
// эффект на выбор, каждый следующий поднимает Редкость на 1. Список вариантов
// лежал сплошным текстом внутри system.effect — выбирать было не из чего.
// Разбор в tools/bestq-implant-options.mjs кладёт его в system.bestQualityEffects.
//
// Проверяется и сам разбор (на выдуманных строках — там видно, что именно
// ломается), и результат на НАСТОЯЩИХ документах пака: разбор по регулярке
// легко теряет вариант молча, а зелёный тест на самодельной строке этого не
// покажет.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseBestQOptions, BESTQ_MARKER } from "../../tools/bestq-implant-options.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

const implants = walk(path.join(ROOT, "packs-src/implants"))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter(d => d?.system);

const bestQ = implants.filter(d => BESTQ_MARKER.test(String(d.system.effect || "")));

describe("разбор вариантов Best.Q", () => {
  it("берёт название и пояснение по отдельности", () => {
    expect(parseBestQOptions("Best.Q: что-то + 1 эффект (R +1 за каждый доп.): "
      + "1) Первый (пояснение раз); 2) Второй (пояснение два)."))
      .toEqual([
        { label: "Первый", note: "пояснение раз" },
        { label: "Второй", note: "пояснение два" }
      ]);
  });

  it("точка с запятой ВНУТРИ пояснения не обрывает список", () => {
    // Именной случай: у Электродуги четвёртый вариант («+1d10 ран; 1/час
    // полное исцеление») терялся молча, и разбор отдавал три вместо четырёх.
    const parsed = parseBestQOptions("Best.Q: x + 1 эффект (R +1 за каждый доп.): "
      + "1) Раз (а); 2) Два (б); 3) Три (в); 4) Четыре (первое; второе).");
    expect(parsed.map(o => o.label)).toEqual(["Раз", "Два", "Три", "Четыре"]);
    expect(parsed.at(-1).note).toBe("первое; второе");
  });

  it("вложенные скобки в пояснении остаются целыми", () => {
    const [only] = parseBestQOptions("Best.Q: x + 1 эффект (R +1 за каждый доп.): "
      + "1) Импульс (безоружные Haywire(0)); 2) Второй (б).");
    expect(only.note).toBe("безоружные Haywire(0)");
  });

  it("рваная нумерация — пусто, а не половина списка", () => {
    // Лучше не разобрать и сказать, чем записать в данные неполный список.
    expect(parseBestQOptions("Best.Q: x + 1 эффект (R +1 за каждый доп.): "
      + "1) Раз (а); 3) Три (в).")).toEqual([]);
  });

  it("текста правила нет — разбирать нечего", () => {
    expect(parseBestQOptions("Обычный имплант без Best.Q")).toEqual([]);
    expect(parseBestQOptions("")).toEqual([]);
  });
});

describe("документы пака несут разобранный список", () => {
  it("правило нашлось у семи десятков биоимплантов", () => {
    // Страховка от «тест зелен, потому что ничего не нашёл».
    expect(bestQ.length).toBeGreaterThanOrEqual(70);
  });

  it("у каждого список заполнен и совпадает с текстом", () => {
    const bad = [];
    for (const doc of bestQ) {
      const stored = doc.system.bestQualityEffects ?? [];
      const parsed = parseBestQOptions(doc.system.effect);
      if (!stored.length) { bad.push(`${doc.name}: список пуст`); continue; }
      if (stored.length !== parsed.length)
        bad.push(`${doc.name}: в поле ${stored.length}, в тексте ${parsed.length}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("ни один вариант не остался без названия", () => {
    const bad = bestQ.flatMap(d => (d.system.bestQualityEffects ?? [])
      .filter(o => !String(o.label || "").trim())
      .map(() => d.name));
    expect(bad).toEqual([]);
  });
});
