// test/data/actor-schemas.test.mjs
//
// Перевод типа актора с template.json на схему проверяется теми же двумя
// вопросами, что и у предметов (см. item-schemas.test.mjs): умолчания и
// сохранность данных пака.
//
// Разница в одном: умолчания актора не переписаны в тест руками, а сняты с
// прежнего template.json в legacy-actor-templates.json. У Демона таких полей
// больше двух сотен, и список, набранный заново, проверял бы не схему, а
// внимательность набиравшего. Всё, чем схема НАМЕРЕННО отличается от старого
// описания, перечислено ниже в DEVIATIONS — молча разойтись они не могут.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { CHARACTERISTICS }   from "../../module/constants/characteristics.mjs";
import { SKILLS_DEF }        from "../../module/constants/skills.mjs";
import { packDocuments, leaves, isEmpty } from "../support/pack-docs.mjs";

const LEGACY = JSON.parse(fs.readFileSync(
  path.resolve(import.meta.dirname, "legacy-actor-templates.json"), "utf8"));

/** Пак с документами этого типа; null — таких акторов в паках нет. */
const PACKS = {
  daemon:      "bestiary",
  demonPrince: null,
  horde:       null,
  vehicle:     "vehicles",
  squad:       null,
  formation:   null,
  ship:        null,
  starSystem:  null,
  character:   "bestiary"
};

// Миньоны (стр. 111-113) — поля заведены уже после того, как template.json
// перестал описывать поля, поэтому в снимке прежних умолчаний их нет. Миньоном
// бывает Персонаж и Демон, Хозяином — они же и Принц Демонов, и набор полей у
// всех троих один (module/data/actor/_creature.mjs).
const MINION_FIELDS = {
  masterUuid: "", minionType: "", minionTier: "", loyalty: { value: 0, max: 0 }
};

/** Расхождения сверх общих для трёх типов с характеристиками. */
const OWN_DEVIATIONS = {
  // Пусто = Бог не выбран. Умолчание "undivided" делало «Покровительство:
  // Неделимый» выполненным у любого, кто не трогал выбор (wdbc-osz).
  character: { patronGod: "" },
  // Вкладку «ТЕЛО» Принцу открыли позже: она общая с Персонажем, и её хранимые
  // поля (фигура голо-скана и жизнеобеспечение) пришлось завести и здесь.
  demonPrince: { bodyType: "male", vitals: { hunger: 0, thirst: 0, sleep: 0 } }
};

/** Намеренные расхождения схемы с прежним template.json: путь → почему. */
const DEVIATIONS = {
  vehicle: {
    // Объявлена не была, но лежит у всех 56 машин пака.
    "availability": 0
  },
  horde: {
    // Навыки Орды заведены позже template.json (вкладка «ПОКАЗАТЕЛИ»): у Орды
    // нет покупок за опыт, поэтому в записи только ранг и выведенное значение.
    skills: Object.fromEntries(Object.keys(SKILLS_DEF)
      .map(k => [k, { rank: "untrained", total: -20 }])),
    // Групповые — записями со специализацией, как у существ.
    groupSkills: Object.fromEntries(Object.keys(GROUP_SKILLS_DEF).map(k => [k, []]))
  },
  // У трёх существ три набора расхождений сразу, и записаны они по-разному:
  // поля Миньонов и свои поля типа — обычными именами, надбавки характеристик —
  // путями внутрь characteristics. withDeviations ниже разбирает и то, и
  // другое, поэтому держать их врозь незачем.
  //
  // Надбавки — цель эффектов, добавляющих к Бонусу и к Значению
  // характеристики: свои хранимые поля. Бонус — потому что «Сверхъестественное»
  // редактируемый ввод на листе; Значение — потому что `total` расчёт собирает
  // заново, и эффект поверх него не поднимал ни Бонус, ни навыки (wdbc-5wm).
  ...Object.fromEntries(["character", "daemon", "demonPrince"].map(type => [type, {
    ...MINION_FIELDS,
    ...Object.fromEntries(Object.keys(CHARACTERISTICS)
      .flatMap(k => [[`characteristics.${k}.bonusFx`, 0], [`characteristics.${k}.totalFx`, 0]])),
    ...OWN_DEVIATIONS[type]
  }]))
};

/** Вписать значение по пути «characteristics.t.bonusFx» в копию объекта. */
function withDeviations(base, deviations = {}) {
  const out = structuredClone(base);
  for (const [path, value] of Object.entries(deviations)) {
    const keys = path.split(".");
    let cur = out;
    for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
    cur[keys.at(-1)] = value;
  }
  return out;
}

/**
 * Поля прошлого формата: значение не теряется, а переезжает в другое поле
 * силами migrateData, и проверяет переезд отдельный тест.
 */
const MIGRATED_AWAY = {
  vehicle: ["crew"]   // → stations
};

describe("типы данных акторов", () => {
  // Полей в template.json больше нет вовсе, остался только перечень типов:
  // тип, попавший в этот перечень без схемы, не получит ни одного поля.
  it("у каждого типа из template.json есть схема, и каждая проверена", () => {
    const declared = JSON.parse(fs.readFileSync(
      path.resolve(import.meta.dirname, "../../template.json"), "utf8")).Actor.types;
    expect(Object.keys(ACTOR_DATA_MODELS).sort()).toEqual([...declared].sort());
    expect(Object.keys(PACKS).sort()).toEqual([...declared].sort());
  });

  for (const [type, pack] of Object.entries(PACKS)) {
    describe(type, () => {
      const Model = ACTOR_DATA_MODELS[type];

      it("пустой актор получает умолчания прежнего template.json", () => {
        expect(new Model({}).toObject()).toEqual(withDeviations(LEGACY[type], DEVIATIONS[type]));
      });

      it.skipIf(!pack)("документы пака проходят через схему без потерь", () => {
        const docs = packDocuments(pack, type);
        expect(docs.length).toBeGreaterThan(0);

        const migrated = MIGRATED_AWAY[type] ?? [];
        const lost = [];
        for (const { file, doc } of docs) {
          const after = new Map(leaves(new Model(doc.system).toObject()));
          for (const [key, value] of leaves(doc.system)) {
            if (isEmpty(value) || migrated.some(m => key === m || key.startsWith(`${m}.`))) continue;
            if (after.get(key) !== value) lost.push(`${file}: ${key} = ${JSON.stringify(value)}`);
          }
        }
        expect(lost).toEqual([]);
      });
    });
  }

  describe("разовые переезды", () => {
    it("ростер экипажа техники переезжает из crew в stations", () => {
      const vehicle = new ACTOR_DATA_MODELS.vehicle({
        crew: [{ role: "driver", uuid: "Actor.abc", name: "Гвардеец", img: "a.webp" }]
      });
      expect(vehicle.stations).toEqual([
        { id: expect.any(String), role: "driver", uuid: "Actor.abc", name: "Гвардеец", img: "a.webp" }
      ]);
      expect(vehicle.crew).toBeUndefined();
    });

    it("занятые места экипажа переезд не трогает", () => {
      const vehicle = new ACTOR_DATA_MODELS.vehicle({
        crew: [{ role: "driver" }],
        stations: [{ id: "s1", role: "gunner", uuid: "", name: "", img: "" }]
      });
      expect(vehicle.stations).toEqual([{ id: "s1", role: "gunner", uuid: "", name: "", img: "" }]);
    });

    it("список isPsyker сворачивается в флаг, а не считается правдой целиком", () => {
      expect(new ACTOR_DATA_MODELS.daemon({ isPsyker: [false, false] }).isPsyker).toBe(false);
      expect(new ACTOR_DATA_MODELS.daemon({ isPsyker: [true, true] }).isPsyker).toBe(true);
    });
  });
});
