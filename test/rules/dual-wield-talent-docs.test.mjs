// test/rules/dual-wield-talent-docs.test.mjs
//
// Проверка на НАСТОЯЩИХ документах пака, а не на подставном акторе (wdbc-3jlm).
//
// Повод конкретный. Арифметика ветки «Два оружия» была написана и покрыта
// тестами с самодельными фикстурами — а живая проверка показала, что Талант
// «Независимое Прицеливание» в компендиуме не несёт записи «Возможность»:
// правило targetSpreadExceeded честно спрашивало флаг, которого ни один
// предмет в игре не выдавал. Игрок покупал Талант за опыт и не получал
// ничего. Тест с выдуманным предметом этого поймать не мог — поэтому здесь
// читается тот самый файл, из которого собирается компендиум.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { itemHasKey } from "../../module/rules/item-marker.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { CAP_TWO_WEAPON, CAP_AMBIDEXTROUS, CAP_INDEPENDENT_TARGETING }
  from "../../module/rules/dual-wield.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR  = path.join(ROOT, "packs-src/talents/Два_оружия");

/** Все документы папки «Два оружия», кроме служебного описания самой папки. */
const talents = fs.readdirSync(DIR)
  .filter(f => f.endsWith(".json") && f !== "_Folder.json")
  .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));

const byKey = key => talents.filter(t => itemHasKey(t, key));

describe("Таланты ветки «Два оружия» в паке несут свои Возможности", () => {
  it("«Два Оружия» — ровно один документ, и он даёт ключ парной атаки", () => {
    expect(byKey(CAP_TWO_WEAPON).map(t => t.name)).toEqual(
      ["Two Weapon Wielder / Два Оружия"]);
  });

  it("Амбидекстр даёт свой ключ — иначе штраф неосновной руки не снять", () => {
    expect(byKey(CAP_AMBIDEXTROUS).map(t => t.name)).toEqual(
      ["Ambidextrous / Амбидекстр"]);
  });

  it("Независимое Прицеливание даёт свой ключ — иначе предел 10 м не снимается", () => {
    expect(byKey(CAP_INDEPENDENT_TARGETING).map(t => t.name)).toEqual(
      ["Independent Targeting / Независимое Прицеливание"]);
  });

  it("каждая скидка −10 к парному штрафу висит на своём Таланте", () => {
    for (const key of ["bladeDancer", "brawler", "fanOfKnives",
                       "gunslinger", "sidearm", "sideblade"]) {
      expect(byKey(`dualWield.core.${key}`).length,
        `dualWield.core.${key} не выдаётся ни одним предметом пака`).toBe(1);
    }
  });
});

describe("реестр возможностей называет читателя", () => {
  it("у механизированных ключей ветки reader не пустой", () => {
    // Пустой reader — честная пометка «правило записано, кода за ним нет».
    // Для этих ключей код есть, и запись обязана на него указывать: иначе
    // следующая ревизия ветки снова примет живой ключ за мёртвый.
    for (const key of [CAP_TWO_WEAPON, CAP_AMBIDEXTROUS, CAP_INDEPENDENT_TARGETING]) {
      expect(CAPABILITIES[key]?.reader, `${key} без читателя`).toContain("dual-wield.mjs");
    }
  });
});
