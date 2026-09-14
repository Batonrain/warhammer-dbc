// Лик Богов / Countenance of <God> (Дары Богов, wdbc-1rno): базовый социальный
// бонус лика мигрирован из capability-заглушки в реальные kind:"testMod".
// Слаанеш — book: "получает бонус +10 на все тесты социальных взаимодействий"
// (blanket, modScope:"social"). Тзинч — book: "бонус +10 на все тесты Deceive
// и Scrutiny" (два отдельных навыка, не общий "social"). Кхорн/Нургл НЕ
// мигрированы тем же способом: их базовый бонус адресован конкретному типу
// цели (солдаты/больные), а не всем — плоский testMod переоценил бы его
// (дал бы бонус против ЛЮБОГО), это не безопасное приближение, а ошибка;
// остаются capability-заглушкой до появления распознавания типа цели.
//
// Продолжение (13.09.2026): общий ОСТАТОК всех четырёх Даров «Лик <Бога>» —
// рейтинг Страха 3 за 1 Очко Бесчестия (module/rules/countenance-of-gods.mjs,
// kind:"script" countenanceOfGods-<god>-fear на каждом предмете) — см. второй
// блок describe ниже. «Демоны <Бога> ниже Герольда признают авторитет» по-
// прежнему НЕ смоделировано (Командование не гейтит готовность слушать),
// как и верхний ярус +30 у Слаанеш/Тзинч, требующий распознавания цели.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { packDocByFileHint, packDocById } from "../support/pack-doc.mjs";
import { COUNTENANCE_INFO, countenanceInfoFor, buildCountenanceFearFlag } from "../../module/rules/countenance-of-gods.mjs";
import { executeItemCode } from "../../module/apps/item-script.mjs";

const SYSTEM = "warhammer-dbc";
const asItem = (name, mechanics) => ({ id: name, name, flags: { [SYSTEM]: { mechanics } } });
const readMechanics = path => packDocByFileHint(path).flags[SYSTEM].mechanics;

describe("Лик Богов: базовый социальный бонус механизирован (wdbc-1rno)", () => {
  it("Слаанеш: kind:\"testMod\" даёт rollBonus target:social +10", () => {
    const mechanics = readMechanics(
      "packs-src/mutations/Дары_Богов/Слаанеш/Countenance_of_Slaanesh___Лик_Слаанеш_YXV2wWWT2P8KrasN.json");
    expect(mechanics.length).toBeGreaterThan(1);
    const rules = rulesFromItemMechanics([asItem("Countenance of Slaanesh", mechanics)]);
    const bonus = rules.find(r => r.effects[0]?.kind === "rollBonus" && r.effects[0]?.target === "social");
    expect(bonus).toBeDefined();
    expect(bonus.effects[0]).toMatchObject({ kind: "rollBonus", target: "social", value: 10 });
  });

  it("Тзинч: kind:\"testMod\" даёт rollBonus skill:deceive +10 и skill:scrutiny +10", () => {
    const mechanics = readMechanics(
      "packs-src/mutations/Дары_Богов/Тзинч/Countenance_of_Tzeentch___Лик_Тзинча_Lci03nSWXLRbQ8ys.json");
    expect(mechanics.length).toBeGreaterThan(1);
    const rules = rulesFromItemMechanics([asItem("Countenance of Tzeentch", mechanics)]);
    const deceive = rules.find(r => r.effects[0]?.target === "skill:deceive");
    const scrutiny = rules.find(r => r.effects[0]?.target === "skill:scrutiny");
    expect(deceive.effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:deceive", value: 10 });
    expect(scrutiny.effects[0]).toMatchObject({ kind: "rollBonus", target: "skill:scrutiny", value: 10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Продолжение 13.09.2026 — общий остаток (Страх 3 за 1 Очко Бесчестия).
// ═══════════════════════════════════════════════════════════════════════

const GOD_DOCS = {
  khorne:   ["packs-src/mutations/Дары_Богов/Кхорн", "wkpvChQkINn5SodJ"],
  nurgle:   ["packs-src/mutations/Дары_Богов/Нургл", "6Oya0s1omuOqYP8L"],
  slaanesh: ["packs-src/mutations/Дары_Богов/Слаанеш", "YXV2wWWT2P8KrasN"],
  tzeentch: ["packs-src/mutations/Дары_Богов/Тзинч", "Lci03nSWXLRbQ8ys"]
};

function scriptCodeFor(god) {
  const [dir, id] = GOD_DOCS[god];
  const doc = packDocById(dir, id);
  const entry = doc.flags["warhammer-dbc"].mechanics
    .flatMap(g => g.entries)
    .find(e => e.kind === "script" && e.id === `countenanceOfGods-${god}-fear`);
  if (!entry) throw new Error(`countenanceOfGods-${god}-fear не найден в паке`);
  return entry.code;
}

function actorOf(fateValue) {
  return {
    name: "Тест",
    system: { alignment: "heretic", fate: { value: fateValue }, characteristics: { inf: { bonus: 5 } } },
    getActiveTokens: () => [],
    getFlag: () => null,
    setFlag: async function (scope, key, value) {
      this._flags = this._flags || {};
      this._flags[key] = value;
    },
    update: async function (patch) {
      for (const [dottedKey, value] of Object.entries(patch)) {
        const parts = dottedKey.split(".");
        let obj = this;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts.at(-1)] = value;
      }
    }
  };
}

describe("countenance-of-gods (wdbc-1rno, Лик <Бога> — общий остаток)", () => {
  it("все 4 Бога Хаоса зарегистрированы", () => {
    expect(Object.keys(COUNTENANCE_INFO).sort()).toEqual(["khorne", "nurgle", "slaanesh", "tzeentch"]);
  });

  it("каждый Бог исключает СВОИХ последователей из действия Страха", () => {
    for (const [god, info] of Object.entries(COUNTENANCE_INFO)) {
      expect(info.exclude).toBe(god);
    }
  });

  it("особая реакция адресована ДРУГОМУ конкретному Богу, не себе", () => {
    for (const info of Object.values(COUNTENANCE_INFO)) {
      expect(info.special).not.toBe(info.god);
    }
  });

  it("книжная пара исключений верна: Кхорн↔Слаанеш, Нургл↔Тзинч", () => {
    expect(COUNTENANCE_INFO.khorne.special).toBe("slaanesh");
    expect(COUNTENANCE_INFO.nurgle.special).toBe("tzeentch");
    expect(COUNTENANCE_INFO.slaanesh.special).toBe("khorne");
    expect(COUNTENANCE_INFO.tzeentch.special).toBe("nurgle");
  });

  it("только у Слаанеш особая реакция цели — Ярость, у остальных — переброс Успехов", () => {
    expect(COUNTENANCE_INFO.slaanesh.specialText).toMatch(/Ярость/);
    expect(COUNTENANCE_INFO.khorne.specialText).toMatch(/перебрасывать Успехи/);
    expect(COUNTENANCE_INFO.nurgle.specialText).toMatch(/перебрасывать Успехи/);
    expect(COUNTENANCE_INFO.tzeentch.specialText).toMatch(/перебрасывать Успехи/);
  });

  it("countenanceInfoFor неизвестного ключа — null, не бросает", () => {
    expect(countenanceInfoFor("undivided")).toBeNull();
    expect(countenanceInfoFor("")).toBeNull();
  });

  it("buildCountenanceFearFlag собирает флаг с рейтингом 3 и книжным исключением", () => {
    const flag = buildCountenanceFearFlag("khorne", 5);
    expect(flag.rating).toBe(3);
    expect(flag.exclude).toBe("khorne");
    expect(flag.special).toBe("slaanesh");
    expect(flag.grantedRound).toBe(5);
  });

  it("buildCountenanceFearFlag неизвестного Бога — null", () => {
    expect(buildCountenanceFearFlag("undivided")).toBeNull();
  });
});

describe("countenanceOfGods-<god>-fear — script-запись на самих 4 предметах пака", () => {
  beforeEach(() => resetCaptured());

  for (const god of Object.keys(GOD_DOCS)) {
    it(`${god}: тратит 1 Очко Бесчестия и ставит флаг с рейтингом 3`, async () => {
      const actor = actorOf(3);
      const item = { name: `Тест ${god}`, actor };
      await executeItemCode(item, scriptCodeFor(god), null);
      expect(actor.system.fate.value).toBe(2);
      expect(actor._flags.countenanceOfGods).toMatchObject({
        rating: 3, god, exclude: COUNTENANCE_INFO[god].exclude, special: COUNTENANCE_INFO[god].special
      });
      expect(captured.chat.length).toBe(1);
      expect(captured.chat[0].content).toContain(COUNTENANCE_INFO[god].excludeLabel);
    });
  }

  it("без Очков Бесчестия — предупреждение, ни списания, ни флага", async () => {
    const actor = actorOf(0);
    const item = { name: "Тест", actor };
    await executeItemCode(item, scriptCodeFor("khorne"), null);
    expect(actor.system.fate.value).toBe(0);
    expect(actor._flags).toBeUndefined();
    expect(captured.warnings.length).toBeGreaterThan(0);
  });
});
