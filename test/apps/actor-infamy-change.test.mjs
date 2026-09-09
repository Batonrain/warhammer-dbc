// test/apps/actor-infamy-change.test.mjs
//
// Очки Бесчестия лежат в РАЗНЫХ полях: у Демон-Принца — system.dp.ip, у
// Хаосита — system.fate.value (module/apps/infamy-points.mjs, шапка). Скрипт
// «Отца Битвы» писал fate.value руками — у Демон-Принца схема это поле
// содержит, а лист не показывает, и начисленное Очко пропадало (wdbc-0b2).
//
// Здесь проверяется общая точка записи и то, что скрипты предметов её ВИДЯТ:
// имя в области видимости executeItemCode — половина контракта, без неё
// скрипт снова напишет пул руками.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { changeActorInfamy, actorInfamyPath } from "../../module/apps/infamy-points.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const root = path.resolve(import.meta.dirname, "../..");

/** Актор-заглушка: update() пишет в плоскую карту, как настоящий. */
function actorOf(type, system) {
  const updates = {};
  return {
    type, system, updates,
    update: async patch => Object.assign(updates, patch)
  };
}

describe("Очки Бесчестия начисляются в пул своего типа актора", () => {
  it("Демон-Принц — system.dp.ip", async () => {
    const dp = actorOf("demonPrince", { dp: { ip: 2 }, characteristics: { inf: { bonus: 5 } } });
    const res = await changeActorInfamy(dp, 1);
    expect(actorInfamyPath(dp)).toBe("system.dp.ip");
    expect(dp.updates["system.dp.ip"]).toBe(3);
    expect(res).toMatchObject({ before: 2, after: 3, max: 5, changed: true });
  });

  it("Хаосит — system.fate.value, потолок Inf.b", async () => {
    const heretic = actorOf("character", { alignment: "heretic", fate: { value: 4 }, characteristics: { inf: { bonus: 5 } } });
    await changeActorInfamy(heretic, 1);
    expect(heretic.updates["system.fate.value"]).toBe(5);
  });

  it("полный пул не переполняется и записи не делает", async () => {
    const dp = actorOf("demonPrince", { dp: { ip: 5 }, characteristics: { inf: { bonus: 5 } } });
    const res = await changeActorInfamy(dp, 1);
    expect(res.changed).toBe(false);
    expect(dp.updates).toEqual({});
  });
});

describe("скрипты предметов видят движок Бесчестия", () => {
  it("changeActorInfamy передан в область видимости executeItemCode", () => {
    const src = fs.readFileSync(path.join(root, "module/apps/item-script.mjs"), "utf8");
    // и в списке имён AsyncFunction, и в списке значений вызова
    expect(src.match(/"changeActorInfamy"/g)?.length ?? 0).toBe(1);
    expect(src).toMatch(/\n\s*changeActorInfamy, actorInfamyValue, actorInfamyMax,/);
  });

  it("«Отец Битвы» пишет пул через движок, а не в fate.value руками", () => {
    const doc = packDocByFileHint(
      "packs-src/mutations/Дары_Богов/Кхорн/Father_of_Battle___Отец_Битвы_pQ0ypCOCEl4SDqJf.json");
    const code = doc.flags["warhammer-dbc"].mechanics
      .flatMap(g => g.entries).map(e => e.code).filter(Boolean).join("\n");
    expect(code).toContain("changeActorInfamy(actor, 1)");
    expect(code, "самодельная запись пула вернулась").not.toContain('"system.fate.value"');
  });
});
