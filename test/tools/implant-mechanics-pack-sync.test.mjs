// test/tools/implant-mechanics-pack-sync.test.mjs
//
// wdbc-9bzv: energyMax/compensator/ironFocus раньше жили ТОЛЬКО в IMPLANT_MECH
// (constants/implant-mechanics.mjs) — таблице regex по ИМЕНИ импланта.
// Переименование импланта в паке молча обнуляло Энергию Катушки Потенции,
// бонус Компенсатора или Технофокус, потому что таблица переставала узнавать
// предмет. Числа теперь бэкфилены в сам предмет (packs-src), а таблица
// остаётся ТОЛЬКО фоллбэком для немигрированных легаси-копий (см.
// character.mjs). Эта проверка ловит рассинхрон на переходный период: для
// любого пак-документа, чьё имя ЕЩЁ совпадает с записью таблицы, схема должна
// нести те же числа — иначе фоллбэк молча замаскирует забытый бэкфилл.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { abs } from "../../tools/packs.mjs";
import { IMPLANT_MECH } from "../../module/constants/implant-mechanics.mjs";

/** Все JSON-документы пака: путь (для отчёта) + разобранное содержимое. */
function packFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const file = path.join(e.parentPath ?? e.path, e.name);
    out.push({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) });
  }
  return out;
}

/** Число (флат) или {poor,common,good,best} → всегда полный объект с нулями по умолчанию. */
function normQuality(v) {
  if (v == null) return { poor: 0, common: 0, good: 0, best: 0 };
  if (typeof v === "object")
    return { poor: v.poor ?? 0, common: v.common ?? 0, good: v.good ?? 0, best: v.best ?? 0 };
  return { poor: v, common: v, good: v, best: v };
}

function implants() {
  return packFiles(abs("packs-src/implants")).filter(({ doc }) => doc.type === "implant");
}

/** Пары (запись таблицы с директивой) × (пак-документ, чьё имя ей совпадает). */
function matchedPairs(directive) {
  const docs = implants();
  const pairs = [];
  for (const mech of IMPLANT_MECH) {
    if (!mech[directive]) continue;
    for (const { file, doc } of docs) if (mech.re.test(doc.name)) pairs.push({ file, doc, mech });
  }
  return pairs;
}

describe("energyMax/compensator/ironFocus: пак не отстаёт от IMPLANT_MECH", () => {
  it("проверка не выродилась в пустышку (пары действительно находятся)", () => {
    const total = matchedPairs("energyMax").length
      + matchedPairs("compensator").length
      + matchedPairs("ironFocus").length;
    expect(total).toBeGreaterThan(0);
  });

  it("energyMax в схеме совпадает с таблицей", () => {
    const stale = [];
    for (const { file, doc, mech } of matchedPairs("energyMax")) {
      const got = normQuality(doc.system.energyMax);
      const want = normQuality(mech.energyMax);
      if (JSON.stringify(got) !== JSON.stringify(want))
        stale.push(`${path.basename(file)} (${doc.name}): energyMax=${JSON.stringify(got)} ≠ таблица ${JSON.stringify(want)}`);
    }
    expect(stale).toEqual([]);
  });

  it("compensator в схеме совпадает с таблицей", () => {
    const stale = [];
    for (const { file, doc, mech } of matchedPairs("compensator")) {
      const got = normQuality(doc.system.compensator);
      const want = normQuality(mech.compensator);
      if (JSON.stringify(got) !== JSON.stringify(want))
        stale.push(`${path.basename(file)} (${doc.name}): compensator=${JSON.stringify(got)} ≠ таблица ${JSON.stringify(want)}`);
    }
    expect(stale).toEqual([]);
  });

  it("ironFocus в схеме выставлен там, где таблица его требует", () => {
    const stale = [];
    for (const { file, doc } of matchedPairs("ironFocus")) {
      if (doc.system.ironFocus !== true)
        stale.push(`${path.basename(file)} (${doc.name}): ironFocus не выставлен, а таблица требует`);
    }
    expect(stale).toEqual([]);
  });
});
