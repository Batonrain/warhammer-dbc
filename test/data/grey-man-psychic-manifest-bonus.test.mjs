// test/data/grey-man-psychic-manifest-bonus.test.mjs
//
// wdbc-dq3: книга («Oteshii/Серые Люди», aeldari-branches.json) даёт Серому
// Человеку «PR для Мысленной Связи считается на 3 выше» и «бPR врождённых
// Blur/Compel/Deja Vu/Invisibility увеличивается на +1» — облегчение
// МАНИФЕСТАЦИИ (порог психотеста), а не требования ИЗУЧЕНИЯ.
//
// Раньше запись Механики (`equipPrRequiredDelta`) правила
// `system.prRequired` выданной копии — это поле читает ТОЛЬКО (а) экран
// «Требуемый ПР» и (б) цена манифестации в Рунах Сигиллитов (бPR психосилы ×
// 2, module/rules/sigillite-runes.mjs::runeCostForPower). На сам психотест
// (module/sheets/tabs/psychic.mjs::executePsychotest, mPR/эPR/Порог) поле
// prRequired не влияет вовсе — подарок был не виден на броске и вдобавок
// удорожал манифестацию Рунами.
//
// Инженерных данных для «модификатор теста, привязанный к конкретной
// психосиле» через Конструктор (kind:"testMod") в системе нет: область
// «power:<имя>» реализована в конвейере теста (resolve-test.mjs,
// commit b879fabf) и описана в docs/rules-format.md, но НЕ подключена к
// item-rules.mjs::scopeTarget — тот принимает только all/char/skill/attack/…
// (module/rules — «чужая зона» для контентной правки). Поэтому фикс сделан
// внутри packs-src: Серый Человек получает СВОИ копии этих пяти психосил
// (тот же кодовый путь equipMode:"direct", что и раньше — копия предмета не
// трогает канонический экземпляр, которым продолжают пользоваться остальные
// расы) с system.testMod, увеличенным на +5 за каждую книжную «+1 к PR» —
// 5×эPR это ровно вклад одного пункта Пси-Рейтинга в Порог психотеста
// (attackThreshold: charVal + 5×эPR), поэтому число математически то же
// самое, что «PR на N выше», для сложности броска.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { PACKS_SRC, packFileText } from "../support/pack-docs.mjs";

const RACE_FILE = path.join(PACKS_SRC, "races/Субрасы/Grey_Man___Серый_Человек_nMKfyeoo5SiSSdTQ.json");

/** Книжная дельта PR для каждой из пяти психосил (aeldari-branches.json). */
const BOOK_PR_DELTA = {
  "Mind Link / Мысленная Связь": 3,
  "Blur / Размытие": 1,
  "Compel / Принуждение": 1,
  "Deja Vu / Дежавю": 1,
  "Invisibility / Невидимость": 1
};

/** Канонический (общий для всех рас) предмет каждой из пяти психосил. */
const CANONICAL_UUID = {
  "Mind Link / Мысленная Связь": "Compendium.warhammer-dbc.psychic-powers.Item.rv8giUCLEdApkGWi",
  "Blur / Размытие": "Compendium.warhammer-dbc.psychic-powers.Item.MbxHnl1hvIZ2MtGr",
  "Compel / Принуждение": "Compendium.warhammer-dbc.psychic-powers.Item.dTZUMXR6NT0pdDCx",
  "Deja Vu / Дежавю": "Compendium.warhammer-dbc.psychic-powers.Item.dBpdJzAIQhZmOPsq",
  "Invisibility / Невидимость": "Compendium.warhammer-dbc.psychic-powers.Item.cYnYjPcfXibtYaJO"
};

function loadRace() {
  return JSON.parse(packFileText(RACE_FILE));
}

function psychicEquipEntries(race) {
  const out = [];
  for (const group of race.flags["warhammer-dbc"].mechanics) {
    for (const entry of group.entries) {
      if (entry.kind === "equipment" && entry.equipCategoryPack === "psychic-powers") out.push(entry);
    }
  }
  return out;
}

/** Находит документ psychic-powers по _id, обходя весь пак (как packDocuments). */
function findPsychicPowerById(id) {
  const dir = path.join(PACKS_SRC, "psychic-powers");
  const found = [];
  const walk = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json") || entry.name.startsWith("_")) continue;
      const doc = JSON.parse(packFileText(full));
      if (doc._id === id) found.push(doc);
    }
  };
  walk(dir);
  return found[0] ?? null;
}

describe("Серый Человек: облегчение манифестации психосил (wdbc-dq3)", () => {
  const race = loadRace();
  const entries = psychicEquipEntries(race);

  it("выдаёт ровно пять врождённых психосил (Mind Link + четыре из списка)", () => {
    expect(entries.map(e => e.equipSourceName).sort()).toEqual(Object.keys(BOOK_PR_DELTA).sort());
  });

  it("больше не поднимает system.prRequired выданной копии (equipPrRequiredDelta)", () => {
    for (const entry of entries) {
      expect(entry.equipPrRequiredDelta, entry.equipSourceName).toBe(0);
    }
  });

  it("каждая выданная сила больше НЕ указывает на канонический (общий) предмет", () => {
    for (const entry of entries) {
      expect(entry.equipSourceUuid, entry.equipSourceName)
        .not.toBe(CANONICAL_UUID[entry.equipSourceName]);
    }
  });

  it.each(Object.entries(BOOK_PR_DELTA))(
    "«%s»: testMod race-варианта = testMod канонической силы + 5×(книжная дельта PR)",
    (name, delta) => {
      const entry = entries.find(e => e.equipSourceName === name);
      expect(entry, name).toBeTruthy();

      const canonicalId = CANONICAL_UUID[name].split(".").pop();
      const canonical = findPsychicPowerById(canonicalId);
      expect(canonical, `канонический предмет «${name}» не найден`).toBeTruthy();

      const variantId = entry.equipSourceUuid.split(".").pop();
      const variant = findPsychicPowerById(variantId);
      expect(variant, `race-вариант «${name}» не найден по uuid из записи`).toBeTruthy();

      expect(variant.system.testMod).toBe((Number(canonical.system.testMod) || 0) + delta * 5);
      // Требование ИЗУЧЕНИЯ не тронуто книгой — variant.prRequired остаётся
      // равным каноническому (сила выдана даром, но текст её требования не менялся).
      expect(variant.system.prRequired).toBe(canonical.system.prRequired);
    }
  );
});
