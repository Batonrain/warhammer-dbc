// test/data/archetypes-savage-noble-mechanicus-vs-book.test.mjs
//
// Сверка Архетипов главы I (Люди: Дикарь, Благородный; Механикус: Скитарий,
// Еретех) с присланным владельцем текстом книги (сверка 28.09.2026).
//
// Книжные строки лежат здесь литералами, а не выводятся из packs-src/books:
// источник истины — присланный текст, и core.json с ним местами расходится
// (вёрстка). Тест сторожит то, что уже однажды разъезжалось:
//  • текст снаряжения (`gear`) — Этап 5 Мастера создания разбирает его
//    напрямую, поэтому он обязан повторять книгу строку в строку («И» —
//    запятая, выбор — «или»), а был урезан до одной-двух позиций;
//  • Черты Архетипа — у Скитария их ДВЕ (Data Acquisition и My Own Master),
//    выдавалась одна;
//  • полный текст Черт вместо пересказа;
//  • резерв-константы (module/constants/archetypes.mjs) в согласии с паком.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { ARCHETYPES } from "../../module/constants/archetypes.mjs";

const HUMANS = "packs-src/archetypes/Люди";
const MECH = "packs-src/archetypes/Механикус";

const BOOK = {
  savage: {
    dir: HUMANS, id: "rZjq8ZEDlbqTG1BO", name: "Дикарь",
    charBonus: { t: 5, s: 2 }, wounds: "11+1d5",
    gear: "3 стандартных Примитивных рукопашных или Примитивных стрелковых оружия (Best.Q), "
      + "6 Throwing Knife (+Mono) или 6 Throwing Axe (+Mono), "
      + "Chain Weapon (до R1, Good.Q) или Power Weapon (до R2), "
      + "9 Модификаций для оружия (до R2), "
      + "Xeno Hides + Jack Chains (Best.Q) + Carapace Helm, "
      + "Скакун до R1 и набор брони до R1(базово) для него",
    traits: { DSgbJn6nYpzWvpbp: "Когда Дикарь проваливает не-атакующий тест S, T, A или P, он может потратить Очко Бесчестия, чтобы вместо этого преуспеть в нем на 1 Успех. Дикарь игнорирует требования по Inf для Миньонов-зверей." }
  },
  noble: {
    dir: HUMANS, id: "O3qKF9xHsaAsmT3L", name: "Благородный",
    charBonus: { ag: 5, fel: 2 }, wounds: "11+1d5",
    gear: "2 Любых рукопашных оружия R1(Best.Q) или R2(Good.Q) или R3, "
      + "Hotshot Pistol(Best.Q) или Orthlak Duel Revolver(Good.Q) или Needler Pistol, "
      + "Digital Laser(Good.Q) или Digital Plasma или Digital Needler, "
      + "9 Модификаций для оружия (до R3), "
      + "Tempestus Carapace(Best.Q) или Light Power Armour(Good.Q), "
      + "5 Модификаций или Систем для брони (до R3)",
    traits: { NfsMbgxVFtDvy5zO: "При создании персонажа, Благородный выбирает 2 Характеристики – они становятся дружественными в плане продвижений, и остаются таковыми, невзирая на его Покровительства." }
  },
  skitarii: {
    dir: MECH, id: "T2X1Qm3PD0q5z83B", name: "Скитарий",
    charBonus: { per: 5, t: 2 }, wounds: "11+1d5",
    gear: "Radium Carbine (Best.Q) или Galvanic Rifle (Best.Q) или Arc Rifle, "
      + "Radium Pistol (Best.Q) или Flechette Blaster (Good.Q) или Phosphor Pistol, "
      + "Taser Goad(Good.Q) или Transonic Blade(Good.Q) или Power Weapon (до R2), "
      + "7 Модификаций для оружия (до R2), "
      + "Skitarii War Plate (нельзя поменять), "
      + "2 Модуля Кибернетики Скитарии (R1,Good.Q или R2), "
      + "+1 к Качеству 3-х предметов",
    traits: {
      SbegSSBYvV0d2LFC: "Скитарий получает Преимущество на все тесты Awareness.",
      MyOwnMstrTrt7kQ2: "Коды командования для Боевых Лат Скитария не работают."
    }
  },
  heretek: {
    dir: MECH, id: "w27A7ks4K6REWeN3", name: "Еретех",
    charBonus: { int: 5, t: 2 }, wounds: "12+1d5",
    gear: "Hotshot Pistol (Good.Q) или Bolt Pistol или Phosphor Blast Pistol, "
      + "Poleaxe (Best.Q +Mono) или Power Axe или Arc Maul, "
      + "Enforcer Carapace + Vulcanized Cloak, "
      + "4 Бионики или Кибернетики (до R2, Good.Q или до R1 Best.Q), "
      + "3 Кибернетики Механикум (до R2), "
      + "2 Мехадендрита (R3 или R2 Good.Q или R1 Best.Q), "
      + "Cogitator(Best.Q) + Retinal Display, "
      + "Combi-Tool (Good.Q)",
    traits: { bL8lOm6EIJrREQck: "Еретех игнорирует требования по Inf для Миньонов-машин." }
  }
};

const traitDoc = id => packDocById("packs-src/traits", id);
const mechEntries = doc => (doc.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);

describe.each(Object.entries(BOOK))("Архетип %s против книги", (key, book) => {
  const doc = packDocById(book.dir, book.id);

  it("ключ не тронут, русское имя — книжное", () => {
    expect(doc.system.key).toBe(key);
    expect(doc.name.split("/").pop().trim()).toBe(book.name);
  });

  it("Бонусные Х-ки и Раны", () => {
    expect(doc.system.charBonus).toEqual(book.charBonus);
    expect(doc.system.wounds).toBe(book.wounds);
  });

  it("текст снаряжения повторяет книгу (его разбирает Этап 5 Мастера)", () => {
    expect(doc.system.gear).toBe(book.gear);
  });

  it("каждая Черта книги выдаётся записью Конструктора и несёт полный текст", () => {
    const granted = mechEntries(doc).filter(e => e.kind === "trait").map(e => e.sourceUuid.split(".").pop());
    for (const [id, text] of Object.entries(book.traits)) {
      expect(granted).toContain(id);
      expect(traitDoc(id).system.benefit).toBe(text);
    }
    expect(granted).toHaveLength(Object.keys(book.traits).length);
  });

  it("резерв-константа в согласии с паком", () => {
    const c = ARCHETYPES[key];
    expect(c.name).toBe(book.name);
    expect(c.charBonus).toEqual(book.charBonus);
    expect(c.wounds).toBe(book.wounds);
    expect(c.gear).toBe(book.gear);
  });
});

describe("Черты Архетипов: возможности для автоматики", () => {
  const caps = id => mechEntries(traitDoc(id)).filter(e => e.kind === "capability").map(e => e.capabilityKey);

  it("Выживальщик: «вместо провала — успех» и Миньоны-звери без требования Inf", () => {
    expect(caps("DSgbJn6nYpzWvpbp")).toEqual(expect.arrayContaining(["trait.survivor", "minion.ignoreInfamy.beast"]));
  });

  it("Повелитель Машин: Миньоны-машины без требования Inf", () => {
    expect(caps("bL8lOm6EIJrREQck")).toContain("minion.ignoreInfamy.machine");
  });

  it("Сам Себе Хозяин: возможность объявлена", () => {
    expect(caps("MyOwnMstrTrt7kQ2")).toContain("trait.myOwnMaster");
  });

  it("Получение Данных: Преимущество (переброс с лучшим) на все тесты Awareness", () => {
    const rr = mechEntries(traitDoc("SbegSSBYvV0d2LFC")).filter(e => e.kind === "reroll");
    expect(rr).toHaveLength(1);
    expect(rr[0]).toMatchObject({ rerollScope: "skill", skillKey: "awareness", rerollMode: "keepBest" });
  });
});
