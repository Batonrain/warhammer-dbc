// test/data/loss-of-limb-submutations.test.mjs
//
// wdbc-1rno.6.1: «Потеря Конечности» — потерю части тела по выпавшей
// субмутации накладывает ОДИН механизм: хук updateItem →
// combat/limb-loss.mjs::syncLossOfLimbMutation (по сторонам, с пометкой
// mutation:true, откат при удалении мутации — test/combat/loss-of-limb-
// mutation.test.mjs).
//
// Приёмка #527: ночная сессия дописала в пак ещё 8 записей Конструктора
// (kind:"condition", apply по субмутации). Обе половины стартуют на одно и то
// же изменение: Конструктор через lostCountFields отнимал ПЕРВУЮ целую
// сторону с mutation:false — «Ладонь левой руки» стоила обеих кистей, а
// потеря Конструктора не откатывалась вовсе. Сторож держит обе стороны:
// хук на месте, записей потери в паке нет.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { packDocById } from "../support/pack-doc.mjs";
import { LIMB_LOSS_KEYS } from "../../module/rules/limb-loss.mjs";

// Loss_of_Limb___Потеря_Конечности_MmNCVwTHcWDFFzGa.json
const doc = () => packDocById("packs-src/mutations/Общие_мутации", "MmNCVwTHcWDFFzGa");

describe("Потеря Конечности: потерю накладывает только хук", () => {
  it("в паке нет записей Конструктора, накладывающих потерю части тела", () => {
    const entries = (doc().flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);
    expect(entries.filter(e => e.kind === "condition" && LIMB_LOSS_KEYS.includes(e.condKey))).toEqual([]);
  });

  it("хук syncLossOfLimbMutation подключён на создание и смену субмутации", () => {
    const hooks = fs.readFileSync(path.resolve(import.meta.dirname, "../../module/hooks.mjs"), "utf8");
    expect(hooks).toMatch(/isLossOfLimbMutation\(item\)\) await syncLossOfLimbMutation\(item\)/);
    expect(hooks).toMatch(/changes\?\.system\?\.submutation && isLossOfLimbMutation\(item\)\) await syncLossOfLimbMutation\(item\)/);
  });
});
