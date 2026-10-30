// test/tools/capability-reachable-ratchet.test.mjs
//
// ХРАПОВИК ДОСЯГАЕМОСТИ ВОЗМОЖНОСТЕЙ (заведён по wdbc-3jlm, пересчитан по
// wdbc-czra).
//
// У возможности две половины: ЧИТАТЕЛЬ в коде (кто-то спрашивает про неё) и
// ВЫДАЧА — то, чем она включается из игры. Пока есть только читатель, механика
// не работает НИ У КОГО, и заметить это обычными средствами нельзя: код
// правильный, тесты зелёные, а за столом ничего не происходит. Ровно так вышло
// с Талантом «Два Оружия»: модуль правил, окно атаки, списание одного ОД на
// пару ударов — всё написано и покрыто тестами, но сам Талант в компендиуме
// записи «Возможность» не нёс, и галочка не появлялась ни у кого.
//
// ПЕРВЫЙ ЗАМЕР ДАЛ 69 — И ОКАЗАЛСЯ ПОЧТИ ЦЕЛИКОМ АРТЕФАКТОМ ИЗМЕРЕНИЯ.
// Он искал ровно одно: строковый литерал ключа в `target:` или в записи
// Конструктора. Разбор каждой из 69 (07.09.2026) показал, что способность
// обычно РАБОТАЕТ, просто включается не ключом с этим именем:
//
//   31 — та же способность смоделирована под рабочим ключом `ability.*`
//        (module/rules/ability-by-key.mjs), и выдаётся ИМЕННО он;
//    8 — выдаётся кодом, но имя цели там переменная, а не литерал
//        (pilot.dreadnought и семь sarcophagus.* — rules/sources.mjs);
//    9 — предмет несёт запись Конструктора другого вида (Преимущество
//        механизировано kind:"reroll", wdbc-u0by);
//    1 — предмет несёт ActiveEffect (Эльдарская Ловкость, +1 к максимуму ОД);
//    9 — код опознаёт носителя по имени предмета (долг wdbc-iadw о хрупкости
//        опознания по имени, но за столом способность есть).
//
// Осталось 11, и все одиннадцать — законные: перечислены поимённо ниже.
// Настоящих дыр «написано, но включить нечем» на 07.09.2026 не осталось.
//
// Разбор живёт в tools/capability-reachability.mjs, здесь — только гейт.

import { describe, it, expect } from "vitest";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { analyze } from "../../tools/capability-reachability.mjs";

/**
 * Возможности без выдачи, признанные законными — каждая с причиной.
 *
 * Это НЕ список «руки не дошли»: у каждой записи выдача не нужна по замыслу.
 * Новый ключ сюда добавляется только вместе с объяснением, ПОЧЕМУ включатель
 * не требуется; «потом сделаем» — не причина, такой ключ должен ронять тест.
 */
const ALLOWED = {
  // Иммунитеты к свойствам оружия: в паке нет предмета, который бы их давал,
  // они заведены про запас — ГМ ставит эффектом (см. их же `source`).
  "weaponPropertyImmunity.piercing": "иммунитет про запас, ставится эффектом ГМа",
  "weaponPropertyImmunity.haywire":  "иммунитет про запас, ставится эффектом ГМа",
  "weaponPropertyImmunity.snare":    "иммунитет про запас, ставится эффектом ГМа",

  // Иммунитет по подвиду урона (wdbc-q0q8): инфраструктура заведена раньше
  // контента. laser выдаётся Живым Зеркалом, flame — Био-Плавильней на Best.Q
  // (контентный проход 11.09.2026) — оба убраны из списка исключений.
  // Оставшиеся два пока некому выдать, тот же принцип, что weaponPropertyImmunity.* выше.
  "damageImmunity.subtype.crushing":      "иммунитет про запас, ставится эффектом ГМа — подвиды урона ещё не проставлены в паке (wdbc-q0q8)",
  "damageImmunity.subtype.fragmentation": "иммунитет про запас, ставится эффектом ГМа — подвиды урона ещё не проставлены в паке (wdbc-q0q8)",
  "damageImmunity.subtype.electrical":    "иммунитет про запас, ставится эффектом ГМа — подвиды урона ещё не проставлены в паке (wdbc-q0q8)",
  "damageImmunity.subtype.toxic":         "иммунитет про запас, ставится эффектом ГМа — подвиды урона ещё не проставлены в паке (wdbc-q0q8)",

  // Состязания рукопашной доступны всем — Талант их не гейтит, это общий
  // принцип (character-context.mjs, тот же у Финта/Давления/Напролома).
  "meleeCore.core.disarm": "Состязание доступно всем, Талант доступность не гейтит",

  // Подмена характеристики Инициативы: книга даёт только Int (Боевое
  // Построение) и Per (Чувство Боя) — оба выдаются Талантами. Остальные шесть
  // существуют, чтобы ГМ мог разрешить свой вариант эффектом.
  "combat.initiativeChar.ws":  "книжного носителя нет, ключ про запас для эффекта ГМа",
  "combat.initiativeChar.bs":  "книжного носителя нет, ключ про запас для эффекта ГМа",
  "combat.initiativeChar.s":   "книжного носителя нет, ключ про запас для эффекта ГМа",
  "combat.initiativeChar.t":   "книжного носителя нет, ключ про запас для эффекта ГМа",
  "combat.initiativeChar.wp":  "книжного носителя нет, ключ про запас для эффекта ГМа",
  "combat.initiativeChar.fel": "книжного носителя нет, ключ про запас для эффекта ГМа",

  // Сверхъестественная Характеристика (wdbc-gdf2, 18.09.2026): включается НЕ
  // Конструктор-ключом/target-литералом, а именем предмета (module/rules/
  // unnatural-characteristic.mjs::UNNATURAL_PREFIX — Трейт типа "trait", чьё
  // английское имя начинается с «Unnatural »), поэтому строковый литерал
  // ключа capability анализатор в паках не находит. Выдач НЕ «нечем включить»
  // — их ~40+ в packs-src/traits (Unnatural S (4), Unnatural WP (+2) и т.д.,
  // плюс шаблонные «Unnatural Strength (X)» под ручной рейтинг), включатель
  // просто другого вида, чем ищет анализатор.
  "trait.unnaturalCharacteristic": "включается по имени предмета (Unnatural …), не по target-ключу — анализатор такой вид выдачи не распознаёт, хотя предметов-выдачи ~40+",

  // Альтернативные чувства против Ослепления (wdbc-x1nz.2.89): тот же случай,
  // что trait.unnaturalCharacteristic выше — главный включатель ИМЯ Черты
  // (rules/library/conditions.mjs::ALT_SENSES_TRAITS; packs-src/traits/
  // Sonar_Sense, Unnatural_Senses, бестиарий). Ключ Конструктора — второй,
  // запасной путь для предметов «даёт Трейт Sonar Sense» (Sonar Visor,
  // импланты), которые его пока не несут.
  "trait.sonarSense":      "включается по имени Черты (Sonar Sense / Сонарное Чувство), ключ Конструктора — запасной путь",
  "trait.unnaturalSenses": "включается по имени Черты (Unnatural Senses (X)), ключ Конструктора — запасной путь",

  // Скорость полёта (Гарпия, глава I): как Sonar Sense — включатель ИМЯ Черты
  // Flyer/Hoverer (rules/flight-speed.mjs, combat/movement-actions.mjs держат
  // имена массивом, литерала в вызове itemHasName анализатор не видит).
  "trait.flyer": "включается по имени Черты (Flyer / Летун, Hoverer / Парящий) — сотни носителей в паках, ключ Конструктора не нужен",

  // Чистый Разум (module/rules/training-advantage.mjs::hasClearMind, курс
  // Обучения): включатель — имя Черты через itemHasName внутри hasItem(actor,
  // "trait", "Clear Mind"), не через hasTalent — анализатор ищет литерал
  // только в вызовах itemHasName/hasAbility/hasTalent/hasItemNamed/hasNamed
  // напрямую, этот вызов другой формы не распознаёт, хотя за столом работает.
  "trait.treytyRas.clearMind": "включается по имени Черты (Clear Mind / Чистый Разум) — вызов другой формы (hasItem), анализатор такой не распознаёт",

  // Melee Training / Weapon Training (Арсенал, гл. 3, wdbc-8r2iv): читаются
  // rules/weapon-training.mjs по ИМЕНИ Таланта (regex /^Melee Training\b/,
  // /^Weapon Training\b/) + system.specialization, не по capabilityKey —
  // анализатор ищет литерал ключа, этот вид выдачи не распознаёт, хотя за
  // столом способность есть у любого персонажа с купленным Талантом.
  "arsenal.core.meleeTraining":  "включается по имени Таланта (Melee Training) + system.specialization, rules/weapon-training.mjs — анализатор такой вид выдачи не распознаёт",
  "arsenal.core.weaponTraining": "включается по имени Таланта (Weapon Training) + system.specialization, rules/weapon-training.mjs — анализатор такой вид выдачи не распознаёт",

  // Armour Training / Тренировка в Броне (Арсенал, гл. 3, wdbc-3-65ff): тот же
  // приём, что у Melee/Weapon Training выше — читается rules/armour-training.mjs
  // по ИМЕНИ Таланта (regex /^Armour Training\b/) + system.specialization, не
  // по capabilityKey — анализатор такой вид выдачи не распознаёт, хотя за
  // столом способность есть у любого персонажа с купленным Талантом.
  "arsenal.core.armourTraining": "включается по имени Таланта (Armour Training) + system.specialization, rules/armour-training.mjs — анализатор такой вид выдачи не распознаёт",

  // Exotic Weapon Training (Арсенал, гл. 3, wdbc-3-65ff): тот же приём —
  // читается rules/weapon-training.mjs по ИМЕНИ Таланта + system.specialization
  // (подстрокой в названии предмета), не по capabilityKey.
  "arsenal.core.exoticWeaponTraining": "включается по имени Таланта (Exotic Weapon Training) + system.specialization (подстрокой в названии предмета), rules/weapon-training.mjs — анализатор такой вид выдачи не распознаёт",

  // Cybernetic Excellence / Кибернетическое Превосходство (Механикум, гл. 3,
  // wdbc-wyu40): включатель — regex NAME_RE.test(item.name) внутри именованной
  // функции isCyberneticExcellence (rules/cybernetic-excellence.mjs), не
  // прямой вызов itemHasName/hasAbility/hasTalent — анализатор такую обёртку
  // не распознаёт, хотя за столом способность работает.
  "mechanicum.core.cyberneticExcellence": "включается по имени Таланта через regex в isCyberneticExcellence (rules/cybernetic-excellence.mjs) — анализатор такую обёртку не распознаёт",

  // Таланты Оккультиста (перепроверка Sahara 3-2a39, 19.10.2026): тот же
  // приём, что у Melee/Weapon/Armour Training выше — module/rules/
  // occultist-talents.mjs::hasOccultistTalent читает имя Таланта через
  // itemHasName(i, n), где n приходит из модульного массива имён
  // (ERUDITE_INFERNAL_NAMES и т.п.), а не строковым литералом прямо в
  // вызове — анализатор такую форму не распознаёт, хотя Таланты с этими
  // именами есть в packs-src/talents/Оккультист и способность за столом
  // работает у любого персонажа, купившего нужный Талант.
  //
  // Rite Puzzler сюда НЕ входит (фикс 19.10.2026, независимое ревью): эта
  // фраза для него была неправдой — ritePuzzlerLearnMod нигде не вызывается,
  // Талант не включает никакой проверяемой автоматизации. Честная заглушка
  // (reader: "" + «ПОДТВЕРЖДЕНО ЧЕСТНОЙ ЗАГЛУШКОЙ» в capabilities.mjs) не
  // попадает в withReader вовсе — строка-исключение ему не нужна.
  "occultist.core.eruditeInfernal": "включается по имени Таланта (Erudite-Infernal) через модульный массив имён в occultist-talents.mjs::hasOccultistTalent — анализатор такую форму не распознаёт",
  "occultist.core.infernalMaster": "включается по имени Таланта (Infernal Master) через модульный массив имён в occultist-talents.mjs::hasOccultistTalent — анализатор такую форму не распознаёт",
  "occultist.core.gloriousPurpose": "включается по имени Таланта (Glorious Purpose) через модульный массив имён в occultist-talents.mjs::hasOccultistTalent — анализатор такую форму не распознаёт",
  // Fallbacks / Instructor (Sahara fallbacks-instructor, 30.10.2026): тот же
  // приём — hasFallbacks/hasInstructor читают имя Таланта через
  // hasOccultistTalent и массивы имён; включают список ассистентов-акторов
  // в диалоге ритуала (rules/ritual-assistants.mjs).
  "occultist.core.fallbacks": "включается по имени Таланта (Fallbacks) через модульный массив имён в occultist-talents.mjs::hasFallbacks — анализатор такую форму не распознаёт",
  "occultist.core.instructor": "включается по имени Таланта (Instructor) через модульный массив имён в occultist-talents.mjs::hasInstructor — анализатор такую форму не распознаёт"
};

describe("возможности с читателем должны быть достижимы из игры", () => {
  const report = analyze(CAPABILITIES);

  it("реестр и паки вообще разобраны — иначе тест зелен от пустоты", () => {
    expect(report.withReader.length).toBeGreaterThan(100);
    expect(report.byWay.packs.length).toBeGreaterThan(100);
  });

  it("нет возможности с читателем, которую нечем включить", () => {
    const unexplained = report.unreachable.filter(k => !Object.hasOwn(ALLOWED, k));
    expect(unexplained, `нечем включить:\n${unexplained
      .map(k => `  ${k}  [${CAPABILITIES[k]?.source ?? ""}]`).join("\n")}`).toEqual([]);
  });

  it("список законных исключений не заводится про запас", () => {
    // Обратная сторона: ключ ушёл из недосягаемых (его наконец выдали), а
    // строка исключения осталась — и следующая настоящая дыра под тем же
    // именем проедет молча.
    const stale = Object.keys(ALLOWED).filter(k => !report.unreachable.includes(k));
    expect(stale, `выдача появилась, строку исключения пора убрать:\n${stale.join("\n")}`).toEqual([]);
  });

  it("вся ветка «Два оружия», у которой есть читатель, выдаётся Талантами", () => {
    // Именной случай, из-за которого храповик и заведён: код был, выдачи не
    // было, и ни один игрок галочку «Обе руки» не видел.
    const dual = report.withReader.filter(k => k.startsWith("dualWield."));
    expect(dual.length).toBeGreaterThan(0);
    expect(dual.filter(k => !report.byWay.packs.includes(k))).toEqual([]);
  });
});
