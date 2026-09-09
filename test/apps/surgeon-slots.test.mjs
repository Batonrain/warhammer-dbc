// test/apps/surgeon-slots.test.mjs
//
// Окно «Хирургеон» раскладывает импланты по системам тела: вид импланта
// (classifyImplant → kind) должен попадать ровно в один слот. Вид, которому
// слота НЕТ, исчезает из окна целиком — включая «Прочее», потому что тот
// ловит не «всё остальное», а именной список [null, "torso"].
//
// Цена такой дыры не косметическая (wdbc-tuh4). Флаг «хирургически
// установлен» ставит ТОЛЬКО это окно; без него имплант считается неактивным
// (apps/effects.mjs::isItemActive), а всё, что он выдаёт записями
// Конструктора, откатывается назад тем же проходом
// (apps/mechanics.mjs::syncGrantedEquipment). Так и вышло с Боевыми Латами
// Скитарии: classifyImplant возвращал kind "fullbody", системы под него не
// было, имплант не показывался нигде — и выданный им комплект брони
// удалялся сразу после создания. Владелец видел нули по всем зонам.
//
// Поэтому тест сверяет не вёрстку, а ПОЛНОТУ: каждый вид, который умеет
// вернуть classifyImplant, обязан иметь свой слот.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyImplant } from "../../module/constants/body-map.mjs";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)));

/** Слоты окна читаются из исходника: сам модуль тянет за собой Foundry. */
function surgeonKinds() {
  const src = fs.readFileSync(path.join(ROOT, "module/apps/surgeon.mjs"), "utf8");
  const block = src.slice(src.indexOf("const SYSTEMS = ["), src.indexOf("const NS_INST"));
  const kinds = new Set();
  for (const m of block.matchAll(/kinds:\s*\[([^\]]*)\]/g)) {
    for (const raw of m[1].split(",")) {
      const v = raw.trim();
      if (!v) continue;
      kinds.add(v === "null" ? null : v.replace(/^["']|["']$/g, ""));
    }
  }
  return kinds;
}

/**
 * Виды, которые вообще умеет вернуть classifyImplant.
 *
 * Читается ТОЛЬКО участок от таблицы IMPLANT_KINDS до конца самой функции:
 * дальше в файле «kind» встречается у совсем другой сущности — координат
 * рисунка тела («claw», «tool»), — и слот в Хирургеоне ей не нужен.
 */
function classifierKinds() {
  const src = fs.readFileSync(path.join(ROOT, "module/constants/body-map.mjs"), "utf8");
  const from = src.indexOf("const IMPLANT_KINDS = [");
  const fnAt = src.indexOf("export function classifyImplant");
  const to   = src.indexOf("\n}", fnAt);
  const region = src.slice(from, to);
  const kinds = new Set();
  for (const m of region.matchAll(/kind:\s*"([\w-]+)"/g)) kinds.add(m[1]);
  return kinds;
}

describe("Хирургеон: у каждого вида импланта есть свой слот", () => {
  it("разбор исходников не пустой — иначе тест зелен ни от чего", () => {
    expect(surgeonKinds().size).toBeGreaterThan(5);
    expect(classifierKinds().size).toBeGreaterThan(5);
  });

  it("ни один вид импланта не остаётся без системы тела", () => {
    const slots = surgeonKinds();
    const orphans = [...classifierKinds()].filter(k => !slots.has(k));
    expect(orphans, `виды без слота: ${orphans.join(", ")}`).toEqual([]);
  });

  it("«Всё тело» опознаётся и имеет слот — именной случай wdbc-tuh4", () => {
    // Боевые Латы Скитарии: поле «Установлен» = «всё тело».
    const got = classifyImplant("Skitarii War Plate / Боевые Латы Скитарии", "всё тело", "skitarii");
    expect(got?.kind).toBe("fullbody");
    expect(surgeonKinds().has("fullbody")).toBe(true);
  });
});
