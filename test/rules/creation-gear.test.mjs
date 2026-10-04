// test/rules/creation-gear.test.mjs
//
// Стартовое снаряжение в Мастере создания (Этап 5) — таблица по ВСЕМ строкам
// «Стартовое Снаряжение» книги, присланным владельцем: 9 рас главы I (Огрин,
// Ратлинг, Скват, Зверолюд, Гарпия, Нага, Сплайс, Репликант, Йигори) и все
// Архетипы Людей и Космодесанта. Строки дословные, с огрехами набора книги
// («Good. Q», «Сombi-Tool» с русской «С», «стрелкоевое», перенос «Инстру-⏎
// ментов» — разбор обязан их переживать, а не требовать чистого текста).
//
// Для каждой строки зафиксировано, что Мастер с ней сделает, словами, которые
// видит игрок (describeGearSpec — та же подпись стоит в Мастере рядом со
// строкой): «выдаётся сам» (предмет найдётся по имени), «список: …» (откроется
// Обозреватель компендиумов, уже суженный по книге: пак, папка-Тип, потолок
// Редкости, число, Качество, Легион) или «…ГМ выдаёт отдельно» (Скакун —
// актор, не предмет). Внешний массив — варианты выбора «или», внутренний —
// выдачи одного варианта (набор через « + » или «4 … до R2 и 2 до R3»).
//
// Что имена «выдаётся сам» действительно находятся в паках — проверяет
// отдельный блок ниже на настоящих packs-src.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  splitGearTopLevel, gearChoiceOptions, parseGearEntry, parseGearItem, describeGearSpec,
  qualityForAvailability, defaultQualityPlan, qualityPlanFits, constructorCoverage,
  namedLookupKeys, pickNamedCandidate, needsLegionProp, normName, compactKey,
  GEAR_FOLDERS, GEAR_FOLDER_LABELS
} from "../../module/rules/creation-gear.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Что Мастер сделает со строкой: [вариант][выдача] → подпись. */
const plan = row => gearChoiceOptions(row).map(o => parseGearEntry(o).map(describeGearSpec));

// [источник, строка книги, ожидаемый план]
const BOOK_TABLE = [
  ["Космодесант · Чемпион", "L. Power Weapon (до R3, Good.Q)",
    [["список: Оружие · Силовое · Редкость ≤ 3 · Хорошее · Легион"]]],
  ["Космодесант · Избранный", "L. Chain Weapon (до R1) или L. Flamer",
    [["список: Оружие · Цепное · Редкость ≤ 1 · Легион"],["выдаётся сам · Легион"]]],
  ["Космодесант · Избранный", "L. Meltagun или L. Plasmagun",
    [["выдаётся сам · Легион"],["выдаётся сам · Легион"]]],
  ["Космодесант · Искатель", "L. Combi-Bolter или L. Storm Bolter или L. Stalker Bolter или L. Atrox Bolt Rifle",
    [["выдаётся сам · Легион"],["выдаётся сам · Легион"],["выдаётся сам · Легион"],["выдаётся сам · Легион"]]],
  ["Космодесант · Искатель", "+Ammo Selector",
    [["выдаётся сам"]]],
  ["Космодесант · Искатель", "4 магазина болтов до R2 и 2 до R3",
    [["список: Боеприпасы · 4 шт. · Редкость ≤ 2","список: Боеприпасы · 2 шт. · Редкость ≤ 3"]]],
  ["Космодесант · Искатель", "L. Combi-Flamer (Best.Q) или L. Combi-Melta (Good.Q) или L. Combi-Plasma или L. Auxiliary Grenade Launcher (Best.Q)",
    [["выдаётся сам · Высшее · Легион"],["выдаётся сам · Хорошее · Легион"],["выдаётся сам · Легион"],["выдаётся сам · Высшее · Легион"]]],
  ["Космодесант · Раптор", "2×L. Chain Weapon (до R1)",
    [["список: Оружие · Цепное · 2 шт. · Редкость ≤ 1 · Легион"]]],
  ["Космодесант · Раптор", "Jump Pack (Raptor pattern)",
    [["выдаётся сам"]]],
  ["Космодесант · Раптор", "6×L. Frag Grenades",
    [["выдаётся сам, 6 шт. · Легион"]]],
  ["Космодесант · Палач", "L. Chain Weapon (до R1, Best.Q) или L. Power Weapon (до R3)",
    [["список: Оружие · Цепное · Редкость ≤ 1 · Высшее · Легион"],["список: Оружие · Силовое · Редкость ≤ 3 · Легион"]]],
  ["Космодесант · Палач", "3 модификации для оружия (до R3)",
    [["список: Модификации оружия · 3 шт. · Редкость ≤ 3"]]],
  ["Космодесант · Хавок", "L. Heavy Bolter или L. Plasma Cannon или L. Multimelta или L. Autocannon",
    [["выдаётся сам · Легион"],["выдаётся сам · Легион"],["выдаётся сам · Легион"],["выдаётся сам · Легион"]]],
  ["Космодесант · Хавок", "Backpack Feed или Heavy Power Cable",
    [["выдаётся сам"],["выдаётся сам"]]],
  ["Космодесант · Апотекарий", "L. Chain Weapon (до R1)",
    [["список: Оружие · Цепное · Редкость ≤ 1 · Легион"]]],
  ["Космодесант · Апотекарий", "Narthecium (Good.Q)",
    [["выдаётся сам · Хорошее"]]],
  ["Космодесант · Апотекарий", "20 Доз Химии до R1",
    [["список: Химия · 20 шт. · Редкость ≤ 1"]]],
  ["Космодесант · Технодесантник", "1 Мехадендрит (R3 или R2 Good.Q)",
    [["список: Импланты · Редкость ≤ 3 · Качество по Редкости: R3 Обычное / R2 Хорошее"]]],
  ["Космодесант · Технодесантник", "Combi-Tool (Good.Q)",
    [["выдаётся сам · Хорошее"]]],
  ["Космодесант · Изгой", "L. Chain Weapon (до R1) или L. Shotgun",
    [["список: Оружие · Цепное · Редкость ≤ 1 · Легион"],["выдаётся сам · Легион"]]],
  ["Космодесант · Изгой", "8 L. Гранат или Бомб до R2",
    [["список: Оружие · Гранаты/Бомбы · 8 шт. · Редкость ≤ 2 · Легион"]]],
  ["Космодесант · Изгой", "Chameleoline Cloak (Good.Q) или L. Boarding Shield (Good.Q)",
    [["выдаётся сам · Хорошее"],["выдаётся сам · Хорошее · Легион"]]],
  ["Космодесант · Чародей", "L. Bolt Pistol",
    [["выдаётся сам · Легион"]]],
  ["Космодесант · Чародей", "L. Force Weapon (до R4)",
    [["список: Оружие · Психосиловое · Редкость ≤ 4 · Легион"]]],
  ["Люди · Отступник", "Autopistol (Best.Q) или Laspistol (Good.Q) или Blast Pistol",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Отступник", "Chain Weapon (до R1, Good.Q) или Power Weapon (до R2)",
    [["список: Оружие · Цепное · Редкость ≤ 1 · Хорошее"],["список: Оружие · Силовое · Редкость ≤ 2"]]],
  ["Люди · Отступник", "Full Flak Armour или Mesh Armour",
    [["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Отступник", "Cogitator (Best.Q) или Loud Hailer(Best.Q) или Hololith(Good.Q)",
    [["выдаётся сам · Высшее"],["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"]]],
  ["Люди · Отступник", "Disguise Kit(Best.Q) или Torture Tools(Best.Q) или Unholy Tomes",
    [["выдаётся сам · Высшее"],["выдаётся сам · Высшее"],["выдаётся сам"]]],
  ["Люди · Демонолог", "Autopistol (Good.Q) или Laspistol",
    [["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Демонолог", "Runic Weapon (Примитивное, Best.Q) или Sacrificial Athame",
    [["список: Оружие · Примитивное · Высшее · Рунический"],["выдаётся сам"]]],
  ["Люди · Демонолог", "Full Flak Armour(Good.Q) или Light Carapace",
    [["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Демонолог", "1 Мистическое Снаряжение или Инструмент (до R3)",
    [["список: Снаряжение/Инструменты · Мистическое · Редкость ≤ 3"]]],
  ["Люди · Демонолог", "2×Unholy Tomes (на разные темы)",
    [["выдаётся сам, 2 шт."]]],
  ["Люди · Демонолог", "Записи Ритуалов на суммарную Редкость 11, но не выше R3 каждый.",
    [["Записи Ритуалов на сумму Редкости 11 (каждая ≤ R3): у Ритуалов в компендиуме нет Редкости — выберите на вкладке «Ритуалы» вручную"]]],
  ["Люди · Ренегат", "Lasgun (Best.Q) или Bolter (Good.Q) или Plasma Gun или Heavy Flamer",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Ренегат", "Combi-Flamer или Auxiliary Grenade Launcher или Long-Las",
    [["выдаётся сам"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Ренегат", "Laspistol (Best.Q) или Bolt Pistol (Good.Q)",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"]]],
  ["Люди · Ренегат", "6 Модификаций для оружия (до R2)",
    [["список: Модификации оружия · 6 шт. · Редкость ≤ 2"]]],
  ["Люди · Ренегат", "Tempestus Carapace (Good. Q) или Xeno Mesh + Chameleoline Cloak",
    [["выдаётся сам · Хорошее"],["выдаётся сам","выдаётся сам"]]],
  ["Люди · Ренегат", "4 Модификации для брони (до R2)",
    [["список: Модификации брони · 4 шт. · Редкость ≤ 2"]]],
  ["Люди · Ренегат", "Rebreather(Best.Q) или Magnoculars(Best.Q) или Stummer",
    [["выдаётся сам · Высшее"],["выдаётся сам · Высшее"],["выдаётся сам"]]],
  ["Люди · Ренегат", "Medkit(Best.Q) или Recoil Glove (Good.Q) или Vox Caster",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Пират", "Vox-Legi Shotgun(+Pistol Grip) или Bolt Revolver или Plasma Pistol",
    [["выдаётся сам · + Pistol Grip"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Пират", "Shock Weapon или Snare Gun(Good.Q) или Webber",
    [["список: Оружие · Шоковое"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Пират", "Xeno Mesh(+Void) + Void Suit Helmet",
    [["выдаётся сам · + Void","выдаётся сам"]]],
  ["Люди · Пират", "3 Модификации для брони (до R2)",
    [["список: Модификации брони · 3 шт. · Редкость ≤ 2"]]],
  ["Люди · Пират", "Recoil Glove(Best.Q) или Mag-Boots (Good.Q) или Gravchute",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Пират", "Rebreather(Best.Q) или Photo-Visor(Best.Q) или Chem Injector (Good.Q)",
    [["выдаётся сам · Высшее"],["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"]]],
  ["Люди · Дикарь", "3 стандартных Примитивных рукопашных или Примитивных стрелковых оружия (Best.Q)",
    [["список: Оружие · Примитивное · 3 шт. · Высшее"]]],
  ["Люди · Дикарь", "6 Throwing Knife (+Mono) или 6 Throwing Axe (+Mono)",
    [["выдаётся сам, 6 шт. · + Mono"],["выдаётся сам, 6 шт. · + Mono"]]],
  ["Люди · Дикарь", "9 Модификаций для оружия (до R2)",
    [["список: Модификации оружия · 9 шт. · Редкость ≤ 2"]]],
  ["Люди · Дикарь", "Xeno Hides + Jack Chains (Best.Q) + Carapace Helm",
    [["выдаётся сам","выдаётся сам · Высшее","выдаётся сам"]]],
  ["Люди · Дикарь", "Скакун до R1 и набор брони до R1(базово) для него",
    [["Скакун — зверь из Бестиария, не предмет: ГМ выдаёт его отдельно"]]],
  ["Люди · Благородный", "2 Любых рукопашных оружия R1(Best.Q) или R2(Good.Q) или R3",
    [["список: Оружие · Рукопашное · 2 шт. · Редкость ≤ 3 · Качество по Редкости: R1 Высшее / R2 Хорошее / R3 Обычное"]]],
  ["Люди · Благородный", "Hotshot Pistol(Best.Q) или Orthlak Duel Revolver(Good.Q) или Needler Pistol",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Благородный", "Digital Laser(Good.Q) или Digital Plasma или Digital Needler",
    [["выдаётся сам · Хорошее"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Благородный", "9 Модификаций для оружия (до R3)",
    [["список: Модификации оружия · 9 шт. · Редкость ≤ 3"]]],
  ["Люди · Благородный", "Tempestus Carapace(Best.Q) или Light Power Armour(Good.Q)",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"]]],
  ["Люди · Благородный", "5 Модификаций или Систем для брони (до R3)",
    [["список: Модификации брони/Системы силовой брони · 5 шт. · Редкость ≤ 3"]]],
  ["Люди · Скитарий", "Radium Carbine (Best.Q) или Galvanic Rifle (Best.Q) или Arc Rifle",
    [["выдаётся сам · Высшее"],["выдаётся сам · Высшее"],["выдаётся сам"]]],
  ["Люди · Скитарий", "Radium Pistol (Best.Q) или Flechette Blaster (Good.Q) или Phosphor Pistol",
    [["выдаётся сам · Высшее"],["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Скитарий", "Taser Goad(Good.Q) или Transonic Blade(Good.Q) или PowerWeapon (до R2)",
    [["выдаётся сам · Хорошее"],["выдаётся сам · Хорошее"],["список: Оружие · Силовое · Редкость ≤ 2"]]],
  ["Люди · Скитарий", "7 Модификаций для оружия (до R2)",
    [["список: Модификации оружия · 7 шт. · Редкость ≤ 2"]]],
  ["Люди · Скитарий", "Skitarii War Plate (нельзя поменять)",
    [["выдаётся сам"]]],
  ["Люди · Скитарий", "2 Модуля Кибернетики Скитарии (R1,Good.Q или R2)",
    [["список: Импланты · 2 шт. · Редкость ≤ 2 · Качество по Редкости: R1 Хорошее / R2 Обычное"]]],
  ["Люди · Скитарий", "+1 к Качеству 3-х предметов",
    [["после выдачи — выбрать 3 предм. для +1 ступени Качества"]]],
  ["Люди · Еретех", "Hotshot Pistol (Good.Q) или Bolt Pistol или Phosphor Blast Pistol",
    [["выдаётся сам · Хорошее"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Еретех", "Poleaxe (Best.Q +Mono) или Power Axe или Arc Maul",
    [["выдаётся сам · Высшее · + Mono"],["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Еретех", "Enforcer Carapace + Vulcanized Cloak",
    [["выдаётся сам","выдаётся сам"]]],
  ["Люди · Еретех", "4 Бионики или Кибернетики (до R2, Good.Q или до R1 Best.Q)",
    [["список: Импланты · 4 шт. · Редкость ≤ 2 · Качество по Редкости: R2 Хорошее / R1 Высшее"]]],
  ["Люди · Еретех", "3 Кибернетики Механикум (до R2)",
    [["список: Импланты · 3 шт. · Редкость ≤ 2"]]],
  ["Люди · Еретех", "2 Мехадендрита (R3 или R2 Good.Q или R1 Best.Q)",
    [["список: Импланты · 2 шт. · Редкость ≤ 3 · Качество по Редкости: R3 Обычное / R2 Хорошее / R1 Высшее"]]],
  ["Люди · Еретех", "Cogitator(Best.Q) + Retinal Display",
    [["выдаётся сам · Высшее","выдаётся сам"]]],
  ["Люди · Еретех", "Сombi-Tool (Good.Q)",
    [["выдаётся сам · Хорошее"]]],
  ["Люди · Ведьма", "Laspistol или Stub Revolver",
    [["выдаётся сам"],["выдаётся сам"]]],
  ["Люди · Ведьма", "Sword (Good.Q) или Neural Whip",
    [["выдаётся сам · Хорошее"],["выдаётся сам"]]],
  ["Люди · Ведьма", "Knife(+Mono)",
    [["выдаётся сам · + Mono"]]],
  ["Люди · Ведьма", "Flak Uniform + Flak Vest",
    [["выдаётся сам","выдаётся сам"]]],
  ["Люди · Ведьма", "Psy-focus",
    [["выдаётся сам"]]],
  ["Люди · Беглый Псайкер", "Force Staff",
    [["выдаётся сам"]]],
  ["Люди · Беглый Псайкер", "Flak Uniform",
    [["выдаётся сам"]]],
  ["Люди · Нумен", "2 Любых рукопашных оружия R0(Best.Q) или R1(Good.Q) или R2",
    [["список: Оружие · Рукопашное · 2 шт. · Редкость ≤ 2 · Качество по Редкости: R0 Высшее / R1 Хорошее / R2 Обычное"]]],
  ["Люди · Нумен", "1 Любое стрелкоевое оружие R0(Best.Q) или R1(Good.Q) или R2",
    [["список: Оружие · Стрелковое · Редкость ≤ 2 · Качество по Редкости: R0 Высшее / R1 Хорошее / R2 Обычное"]]],
  ["Люди · Нумен", "Полный комплект брони R0(Best.Q) или R1(Good.Q) или R2",
    [["список: Броня · Редкость ≤ 2 · Качество по Редкости: R0 Высшее / R1 Хорошее / R2 Обычное"]]],
  ["Зверолюд", "4 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q",
    [["список: Снаряжение/Инструменты · 4 шт. · Редкость ≤ 1 · из них 1 Хорошее"]]],
  ["Гарпия, Нага", "4 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q и 1 Best.Q",
    [["список: Снаряжение/Инструменты · 4 шт. · Редкость ≤ 1 · из них 1 Высшее, 1 Хорошее"]]],
  ["Огрин", "3 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q",
    [["список: Снаряжение/Инструменты · 3 шт. · Редкость ≤ 1 · из них 1 Хорошее"]]],
  ["Огрин", "Все стартовое снаряжение бесплатно модифицируется под Огрина",
    [["всё оружие получит свойство «Огринизированное»"]]],
  ["Ратлинг, Репликант, Сплайс, Йигори", "5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q",
    [["список: Снаряжение/Инструменты · 5 шт. · Редкость ≤ 1 · из них 1 Высшее, 2 Хорошее"]]],
  ["Ратлинг, Репликант, Сплайс, Йигори", "Vox-Bead",
    [["выдаётся сам"]]],
  ["Скват", "5 элементов Снаряжения и Инструментов до R1 из них 3 Good.Q и 2 Best.Q",
    [["список: Снаряжение/Инструменты · 5 шт. · Редкость ≤ 1 · из них 2 Высшее, 3 Хорошее"]]],
  ["Скват", "+2 очка Стартового Снаряжения",
    [["+2 к Очкам Снаряжения — сразу в пуле"]]],
];
const BOOK_ROWS = BOOK_TABLE.map(r => r[1]);

describe("Стартовое снаряжение книги: что Мастер делает с каждой строкой", () => {
  it.each(BOOK_TABLE)("%s: «%s»", (_src, row, expected) => {
    expect(plan(row)).toEqual(expected);
  });

  it("текст расы целиком (как его пишут в gear) режется на строки без потерь", () => {
    // Книжный перенос строки и «, из них» — одна выдача, а не две.
    expect(splitGearTopLevel("4 элемента Снаряжения и Инструментов\nдо R1, из них 1 Good.Q и 1 Best.Q"))
      .toEqual(["4 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q и 1 Best.Q"]);
    expect(splitGearTopLevel("5 элементов Снаряжения и Инстру-\nментов до R1 из них 2 Good.Q и 1 Best.Q\nVox-Bead"))
      .toEqual(["5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q", "Vox-Bead"]);
    expect(splitGearTopLevel("Force Staff, Knife(+Mono)")).toEqual(["Force Staff", "Knife(+Mono)"]);
    expect(splitGearTopLevel("+Ammo Selector, 4 магазина болтов до R2 и 2 до R3"))
      .toEqual(["+Ammo Selector", "4 магазина болтов до R2 и 2 до R3"]);
  });
});

describe("Нынешние тексты паков (до правки агентами) не ломаются", () => {
  it.each([
    ["5 элементов Снаряжения/Инструментов до R1 (2 Good.Q, 1 Best.Q)",
      [["список: Снаряжение/Инструменты · 5 шт. · Редкость ≤ 1 · из них 1 Высшее, 2 Хорошее"]]],
    ["5 элементов до R1 (3 Good.Q, 2 Best.Q)",
      [["список: Снаряжение/Инструменты · 5 шт. · Редкость ≤ 1 · из них 2 Высшее, 3 Хорошее"]]],
    ["снаряжение бесплатно модифицируется под размер Огрина",
      [["всё оружие получит свойство «Огринизированное»"]]],
    ["+2 очка стартового снаряжения", [["+2 к Очкам Снаряжения — сразу в пуле"]]],
    ["4 Стандартные системы", [["список: Стандартные системы, 4 шт."]]],
    ["Болтер (Астартес) или Болт Пистолет (Астартес)", [["выдаётся сам"], ["выдаётся сам"]]],
    ["Shock Weapon (до R1)/Snare Gun (Good.Q)",
      [["список: Оружие · Шоковое · Редкость ≤ 1"], ["выдаётся сам · Хорошее"]]],
    // «Power/Wraithbone Weapon» — одно название с «/» внутри, не выбор.
    ["Power/Wraithbone Weapon (до R3, Best.Q)",
      [["список: Оружие · Силовое/Психокостяное · Редкость ≤ 3 · Высшее"]]],
    ["6 Бионики/Кибернетики (до R2 Good.Q или R1 Best.Q)",
      [["список: Импланты · 6 шт. · Редкость ≤ 2 · Качество по Редкости: R2 Хорошее / R1 Высшее"]]],
    ["1 любое рукопашное оружие R2 или 2 любых рукопашных R0",
      [["список: Оружие · Рукопашное · Редкость ≤ 2"], ["список: Оружие · Рукопашное · 2 шт. · Редкость ≤ 0"]]],
    ["Xenomesh Armour (Good.Q) или Kabalite Armour, или Wychsuit",
      [["выдаётся сам · Хорошее"], ["выдаётся сам"], ["выдаётся сам"]]],
    ["3 Splinter Pistol", [["выдаётся сам, 3 шт."]]]
  ])("«%s»", (row, expected) => {
    expect(plan(row)).toEqual(expected);
  });
});

describe("Качество выданного", () => {
  it("ступени «R0 Best / R1 Good / R2» — предмет получает лучшее, во что влезает", () => {
    const tiers = parseGearItem("2 Любых рукопашных оружия R0(Best.Q) или R1(Good.Q) или R2").tiers;
    expect([0, 1, 2].map(a => qualityForAvailability(tiers, a))).toEqual(["best", "good", "common"]);
    // Ниже нуля (R-1, R-2) — тоже Высшее.
    expect(qualityForAvailability(tiers, -2)).toBe("best");
    // Редкость у предмета не заполнена — худшая из ступеней, не Высшее наугад.
    expect(qualityForAvailability(tiers, null)).toBe("common");
  });

  it("«до R2, Good.Q или до R1 Best.Q» — R1 и ниже Высшее, R2 Хорошее", () => {
    const tiers = parseGearItem("4 Бионики или Кибернетики (до R2, Good.Q или до R1 Best.Q)").tiers;
    expect([1, 2].map(a => qualityForAvailability(tiers, a))).toEqual(["best", "good"]);
  });

  it("«из них 2 Good.Q и 1 Best.Q» — по умолчанию Высшее первому выбранному, затем Хорошее", () => {
    const slots = parseGearItem("5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q").qualitySlots;
    expect(slots).toEqual({ good: 2, best: 1 });
    expect(defaultQualityPlan(5, slots)).toEqual(["best", "good", "good", "common", "common"]);
    expect(qualityPlanFits(["good", "best", "common", "good", "common"], slots)).toBe(true);
    expect(qualityPlanFits(["best", "best", "common", "common", "common"], slots)).toBe(false);
  });

  it("«Good. Q» с пробелом — тоже Хорошее; «(Best.Q +Mono)» — Высшее и надстройка Mono", () => {
    expect(parseGearItem("Tempestus Carapace (Good. Q)").quality).toBe("good");
    expect(parseGearItem("Poleaxe (Best.Q +Mono)")).toMatchObject({ quality: "best", attach: ["Mono"] });
  });
});

describe("Конструктор Расы/Архетипа и текст не выдают одно и то же дважды", () => {
  const choice = (pack, extra = {}) => ({ kind: "equipment", equipMode: "choice", equipCategoryPack: pack, ...extra });
  const item = name => ({ kind: "equipment", equipMode: "direct", equipSourceName: name });

  it("Чемпион: «L. Power Weapon (до R3, Good.Q)» уже выдан Выбором Конструктора (Силовое, R≤3)", () => {
    const groups = [{ operator: "AND", entries: [choice("weapons", { equipWeaponType: GEAR_FOLDERS.power, equipMaxAvailability: 3 })] }];
    expect(constructorCoverage([["L. Power Weapon (до R3, Good.Q)"]], groups)).toEqual([true]);
  });

  it("группа «И» закрывает по строке на запись (Раптор: цепное ×2 и гранаты ×6 в одной группе)", () => {
    const groups = [{ entries: [
      choice("weapons", { equipWeaponType: GEAR_FOLDERS.chain, equipMaxAvailability: 1 }),
      choice("weapons", { equipWeaponType: GEAR_FOLDERS.grenades, equipMaxAvailability: 5 })
    ] }];
    const rows = [["2×L. Chain Weapon (до R1)"], ["Jump Pack (Raptor pattern)"], ["6×L. Frag Grenades"]];
    expect(constructorCoverage(rows, groups)).toEqual([true, false, true]);
  });

  it("группа «ИЛИ» — одна выдача: закрывает строку-выбор целиком, какой бы вариант ни выбрал игрок", () => {
    const groups = [{ operator: "OR", entries: [item("Autopistol / Автопистолет"), item("Laspistol / Лазпистолет"), item("Blast Pistol / Бласт Пистолет")] }];
    const row = gearChoiceOptions("Autopistol (Best.Q) или Laspistol (Good.Q) или Blast Pistol");
    expect(constructorCoverage([row, row], groups)).toEqual([true, false]);
  });

  it("две одинаковые строки (Нумен, два рукопашных) закрываются двумя группами, не одной", () => {
    const tiersGroup = () => ({ operator: "OR", entries: [0, 1, 2].map(r =>
      choice("weapons", { equipWeaponType: GEAR_FOLDERS.meleeBranch, equipMaxAvailability: r })) });
    const row = ["1 Любое рукопашное оружие R0(Best.Q) или R1(Good.Q) или R2"];
    expect(constructorCoverage([row, row, row], [tiersGroup(), tiersGroup()])).toEqual([true, true, false]);
  });

  it("именной вариант против Выбора-папки (Хавок: «L. Heavy Bolter» и Выбор «Болтерное») — по папке предмета", () => {
    const bolterFolder = "TQQsWi6Gc81MFTKy";
    const groups = [{ operator: "OR", entries: [choice("weapons", { equipWeaponType: bolterFolder, equipMaxAvailability: 5 })] }];
    const row = gearChoiceOptions("L. Heavy Bolter или L. Plasma Cannon");
    expect(constructorCoverage([row], groups, () => null)).toEqual([false]);
    expect(constructorCoverage([row], groups, s => (s.name === "Heavy Bolter" ? bolterFolder : null))).toEqual([true]);
  });

  it("Легионный предмет из папки Астартес закрывает Выбор Типа корбука с тем же именем (Хавок: «Болтерное»)", () => {
    const imperialBolter = "jdBWPiNnJBnxwZVn", astartesBolter = "TQQsWi6Gc81MFTKy";
    const names = { [imperialBolter]: "Болтерное", [astartesBolter]: "Болтерное", [GEAR_FOLDERS.power]: "Силовое" };
    const groups = [{ operator: "OR", entries: [choice("weapons", { equipWeaponType: imperialBolter, equipMaxAvailability: 5 })] }];
    const row = gearChoiceOptions("L. Heavy Bolter или L. Plasma Cannon");
    const folderOf = s => (s.name === "Heavy Bolter" ? astartesBolter : null);
    expect(constructorCoverage([row], groups, folderOf)).toEqual([false]);
    expect(constructorCoverage([row], groups, folderOf, id => names[id])).toEqual([true]);
    // Разные Типы с разными именами по-прежнему не совпадают.
    const powerOnly = [{ operator: "OR", entries: [choice("weapons", { equipWeaponType: GEAR_FOLDERS.power, equipMaxAvailability: 5 })] }];
    expect(constructorCoverage([row], powerOnly, folderOf, id => names[id])).toEqual([false]);
  });

  it("разные вещи не путаются: модификации оружия не закрываются модификациями брони", () => {
    const groups = [{ entries: [choice("armor-mods", { equipMaxAvailability: 2 })] }];
    expect(constructorCoverage([["6 Модификаций для оружия (до R2)"]], groups)).toEqual([false]);
  });

  // Записи Конструктора со снаряжением у Архетипов сняты (двойная выдача,
  // сверка 28.09.2026) — Этап 5 выдаёт весь текст сам, пропускать нечего.
  it("настоящий Чемпион из packs-src: Механика больше не выдаёт его снаряжение — Этап 5 выдаёт всё", () => {
    const dir = path.join(ROOT, "packs-src/archetypes");
    const file = fs.readdirSync(dir, { recursive: true }).find(f => /Champion___/.test(f));
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const rows = splitGearTopLevel(doc.system.gear).map(gearChoiceOptions);
    const groups = doc.flags["warhammer-dbc"].mechanics;
    expect(rows.length).toBeGreaterThan(0);
    expect(constructorCoverage(rows, groups).some(Boolean)).toBe(false);
  });
});

describe("Поиск предмета по имени", () => {
  it("«L. Bolter» — Легионная версия, «Bolter» — обычная", () => {
    const cands = [{ name: "Bolter / Болтер (Астартес)" }, { name: "Bolter / Болтер" }];
    expect(pickNamedCandidate(cands, parseGearItem("L. Bolter")).name).toBe("Bolter / Болтер (Астартес)");
    expect(pickNamedCandidate(cands, parseGearItem("Bolter (Good.Q)")).name).toBe("Bolter / Болтер");
  });

  it("«L.» без Легионной версии в паке — обычный предмет плюс свойство Legion", () => {
    expect(needsLegionProp(parseGearItem("L. Boarding Shield (Good.Q)"), "Boarding Shield / Абордажный Щит")).toBe(true);
    expect(needsLegionProp(parseGearItem("L. Flamer"), "Flamer / Огнемёт (Астартес)")).toBe(false);
    expect(needsLegionProp(parseGearItem("Flamer"), "Flamer / Огнемёт")).toBe(false);
  });

  it("«Frag Grenades» — граната «Frag / Фраг» из папки Гранаты, а не одноимённая ракета", () => {
    const spec = parseGearItem("6×L. Frag Grenades");
    expect(namedLookupKeys(spec)).toContain("frag");
    const cands = [{ name: "Frag / Ракета: Фраг", folder: "vRs6fjJo6bK9y8gL" }, { name: "Frag / Фраг", folder: GEAR_FOLDERS.grenades }];
    expect(pickNamedCandidate(cands, spec).name).toBe("Frag / Фраг");
  });

  it("«Сombi-Tool» с русской «С» и «Plasma Gun» вместо «Plasmagun» находятся", () => {
    expect(normName("Сombi-Tool")).toBe(normName("Combi-Tool"));
    expect(normName("Нартеций")).toBe("нартеций"); // чисто русское слово не трогается
    expect(namedLookupKeys(parseGearItem("Plasma Gun"))).toContain(compactKey(normName("Plasmagun")));
  });

  it("при равных — короткое имя («Нартеций», а не его рукопашный профиль)", () => {
    const cands = [{ name: "Narthecium / Нартеций (рукопашный профиль)" }, { name: "Narthecium / Нартеций" }];
    expect(pickNamedCandidate(cands, parseGearItem("Narthecium (Good.Q)")).name).toBe("Narthecium / Нартеций");
  });
});

// ── Настоящие паки ──────────────────────────────────────────────────────────

const packDocs = pack => fs.readdirSync(path.join(ROOT, "packs-src", pack), { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => JSON.parse(fs.readFileSync(path.join(e.parentPath ?? e.path, e.name), "utf8")));

describe("Опоры разбора в packs-src", () => {
  it("папки категорий существуют и называются так, как их подписывает Мастер", () => {
    const folders = new Map();
    for (const pack of ["weapons", "gear", "tools"]) for (const d of packDocs(pack)) {
      if (String(d._key).startsWith("!folders")) folders.set(d._id, d.name);
    }
    for (const [key, id] of Object.entries(GEAR_FOLDERS)) {
      expect(folders.get(id), `${key} → ${id}`).toBe(GEAR_FOLDER_LABELS[key]);
    }
  });

  it("все «выдаётся сам» из книги находятся в паках — кроме известных пробелов контента", () => {
    const index = new Map();
    const PACKS = ["weapons", "armor", "gear", "ammunition", "shields", "tools", "armour-systems", "traits", "implants", "weapon-mods", "armor-mods"];
    for (const pack of PACKS) for (const d of packDocs(pack)) {
      if (String(d._key).startsWith("!folders")) continue;
      for (const part of String(d.name).split("/")) {
        const k0 = normName(part);
        for (const k of new Set([k0, compactKey(k0)])) if (k) (index.get(k) ?? index.set(k, []).get(k)).push({ name: d.name, folder: d.folder });
      }
    }
    const find = spec => { for (const k of namedLookupKeys(spec)) if (index.has(k)) return pickNamedCandidate(index.get(k), spec); return null; };
    const missing = new Set();
    for (const row of BOOK_ROWS) for (const opt of gearChoiceOptions(row)) for (const spec of parseGearEntry(opt)) {
      if (spec.kind !== "named") continue;
      if (!find(spec)) missing.add(spec.name);
      for (const a of spec.attach || []) if (!find({ name: a })) missing.add(`+${a}`);
    }
    // Этих предметов в компендиумах нет: Мастер откроет по ним Обозреватель
    // с угаданной вкладкой, а в отчёт ушла задача завести их в пак.
    expect([...missing].sort()).toEqual(["Ammo Selector", "Void Suit Helmet"]);
  });
});

describe("normName: «Armour» и «Armor» — одно слово (живая проверка 04.10.2026)", () => {
  it("«Ghostplate Armor» из текста находит «Ghostplate Armour / Призрачная Броня» из пака", () => {
    const fromText = normName("Ghostplate Armor");
    const fromPack = String("Ghostplate Armour / Призрачная Броня").split("/").map(normName);
    expect(fromPack).toContain(fromText);
  });

  it("сворачивается только целое слово, а не кусок другого", () => {
    expect(normName("Armoured Vest")).toBe("armoured vest");
    expect(normName("Power Armour")).toBe("power armor");
    expect(normName("ARMOUR")).toBe("armor");
  });
});
