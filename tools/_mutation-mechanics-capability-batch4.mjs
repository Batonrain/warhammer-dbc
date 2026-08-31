// tools/_mutation-mechanics-capability-batch4.mjs — wdbc-1rno, ревизия по запросу координатора.
// Честная повторная сверка «оставшихся 33» вскрыла непоследовательность: 26 из них
// НЕСУТ конкретное правило/число (штраф, триггер, тест), но были ошибочно оставлены
// вовсе без Механики вместо capability-заглушки — той же самой конвенции, что уже
// применена к 149 другим записям. Здесь это исправлено. Остаются ДЕЙСТВИТЕЛЬНО без
// Механики только 7 записей, у которых нет ни одного числа/правила (Change of Sex,
// Enigma, Inside Out, Loss of Limb, Strange Voice, Two-Faced, Warped Visage) — сами
// авторы текста называют их «сугубо косметическими»/GM-произвольными.
//
// Отдельно: 6 из этих 26 (Centaur, Multiple Eyes, Strange Invulnerability,
// Strange Tongue, Warp-Touched, Wrapped in Chaos) имеют НУЛЕВОЙ базовый эффект —
// 100% содержания в субмутациях (10-11 вариантов у каждой). Заглушка честно
// фиксирует «эффект есть, определяется субмутацией, не разобран», а не молчание.
//
// Investigated-and-rejected (см. label у Headless/Живое Зеркало): пробовала найти
// РЕАЛЬНЫЙ обходной путь через нативный item.effects[] (Foundry ActiveEffect) для
// Headless (system.initiative — валидный ключ в EFFECT_KEY_LABELS) вместо ожидания
// нового вида записи Конструктора. Итог: НИ ОДИН файл во всём packs-src не
// использует item.effects[] напрямую — это НЕ используемый авторский путь в этом
// репозитории (все эффекты идут только через flags.warhammer-dbc.mechanics,
// движок сам создаёт ActiveEffect на акторе в рантайме). Рисковать и изобретать
// новый, никем не проверенный способ авторства ради одной записи — решила не
// делать; оставлено text+capability-заглушка+ссылка на wdbc-v9a7 с находкой в
// комментарии для будущей сессии.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const DIR = "packs-src/mutations/Общие_мутации/";

const ENTRIES = [
  ["Addiction___Зависимость_1SvSdOadpjJSHvgg.json", "addiction",
    "Не удовлетворив зависимость за день — штраф −10 на все тесты Навыков (не Характеристик) до утоления; 13 субмутаций определяют предмет зависимости, не автоматизированы (нет bd)"],
  ["Beastman___Зверолюд_Us9zsnoINwwU1iku.json", "beastman",
    "Все Трейты расы Зверолюда кроме 4 названных, Навыки Lore/Trade на ступень ниже (мин. +0), становится полноценным Зверолюдом — комплексная замена расы, вне полей Конструктора"],
  ["Blessed_Fits___Благословенные_Припадки_5djB4fV2cxRDpMVY.json", "blessedFits",
    "Переброшенный на Очко Бесчестия тест, оказавшийся провалом — Оглушение на 1 Раунд; полный Раунд в Оглушении возвращает потраченное Очко Бесчестия"],
  ["Blood_Replacement___Замена_Крови_WkKMDdEdcnrcPaKB.json", "bloodReplacement",
    "Иммунитет к смерти от Кровотечения/Обескровливания; 11 субмутаций определяют тип крови и эффект при ранении (I/R/X урон), не автоматизированы"],
  ["Burning_Body___Пылающее_Тело_ZZJAzGhDQ3NNPiwe.json", "burningBody",
    "Иммунитет к экстремальным температурам/Горению (подавляемо тестом W+0 на 1 час); рукопашные атакующие в Rng 0-1/Захвате — A+0 или 1d10 E(Fl) Dmg; 10 субмутаций варьируют профиль пламени — упирается в архитектурный пробел иммунитета к свойствам (wdbc-plsf)"],
  ["Centaur___Центавр_y8tSRrNuEXuD3KcP.json", "centaur",
    "Нижняя половина тела заменяется телом животного по субмутации (10 вариантов — Multiple Arms/Quadruped/Natural Weapons/Таланты и др.), сама база не даёт эффекта без субмутации — не автоматизировано"],
  ["Cyclops___Циклоп_Hdb0dzfpQKp8TkkD.json", "cyclops",
    "−5 тесты зрения, автопровал измерения дистанции на глаз; доп. шанс Избегания от атак, способных опустить Раны до −7 и ниже (даже от внезапных, дважды при известной атаке); по решению ГМа W-тест на потерю полудействия от видений"],
  ["Desiccated___Иссушенный_qDrYbOsxhVnicTxF.json", "desiccated",
    "−10 соц. взаимодействия и −5 ментальные действия в присутствии еды; штраф от Усталости −20 вместо −10"],
  ["Gift_of_Tongues___Дар_Языков_u9mczjF2k0mEe9Um.json", "giftOfTongues",
    "Понимает любую речь/язык жестов душ-носителей, отвечает только оскорблениями на их языке; +20 на тесты спровоцировать нападение/вызов на дуэль"],
  ["Hand_of_Death___Рука_Смерти_jNjI64tQMN7d7dGp.json", "handOfDeath",
    "Сращивание с выбранным уже носимым оружием (+10 WS/BS, Баланс до 0, генерация боеприпасов, Reinforced, +10 AP руке) — выбор СВОЕГО предмета игрока, не выдача новой копии из пака (см. wdbc-hftn)"],
  ["Headless___Безголовый_GJ0E9NX1keEc7636.json", "headless",
    "−2 Инициатива (system.initiative — валидный ключ EFFECT_KEY_LABELS, но нет ни одного прецедента ручной записи item.effects[] в контенте всего packs-src — проверено; см. wdbc-v9a7), угол обзора 120°, попадания в голову = попадания в торс"],
  ["Heart_of_Steel___Стальное_Сердце_fZAHbU1JmeVjEFW2.json", "heartOfSteel",
    "Все воспринимаемые рейтинги Страха на 1 меньше (игнорируются на 0 или пределе Бесчестия); 4 god-гейтнутые субмутации усиливают эффект против конкретных типов целей ещё на 1 — личное снижение восприятия Страха, не то же самое, что снятие чужого Страха к себе (нет bd)"],
  ["Infernal_Will___Инфернальная_Воля_vOiGjH4Hhao5ChM1.json", "infernalWill",
    "Иммунитет к Страху (упирается в архитектурный пробел wdbc-plsf), но провал теста Навыка на 4+ (не Крит) — бросок по таблице Шока; Неделимость/Покровительство снижают результат"],
  ["Knowledge_of_Ages___Знания_Веков_0Mc6b4RhLPO4ruoU.json", "knowledgeOfAges",
    "Без траты опыта изучает любой Навык по выбору до +10 + Талант Mastery; Усиление/Успех/Переброс для этого Навыка — переброс 1d10 (9-10: бесплатно, 1: Ступор) — «любой Навык» вне ограниченного списка specChoiceKeys (см. wdbc-2n5t)"],
  ["Living_Mirror___Живое_Зеркало_1fAC4vUURFPIfhHU.json", "livingMirror",
    "Иммунитет к E(Ls) Dmg (снаряжение зеркалится через 5 минут ношения); штрафы Stealth по решению ГМа — упирается в архитектурный пробел иммунитета к типу урона (готовой Черты под это в паке нет, проверено grep)"],
  ["Multiple_Eyes___Множественные_Глаза_QNkitLzwFw8vE4Gn.json", "multipleEyes",
    "10 субмутаций дают разные доп. глаза с разными эффектами (Navigate(Warp) пилотирование, +20 Awareness, круговой обзор, Independent Targeting и др.) — база сама не даёт эффекта без субмутации, не автоматизировано"],
  ["Organ_of_Chaos___Орган_Хаоса_UxwqSTbL0hbBcGJO.json", "organOfChaos",
    "Трейт Unnatural Characteristic(+1) на характеристику по выбору ГМа (случайный демон/орган) + малая способность по решению ГМа — характеристика определяется на месте выдачи, вне фиксированных полей Конструктора"],
  ["Shield_of_Purity___Щит_Чистоты_a0vViAT7lL8WyVjK.json", "shieldOfPurity",
    "Иммунитет к Горению и свойству Corrosive — упирается в архитектурный пробел иммунитета к свойствам оружия (wdbc-plsf/wdbc-8b5)"],
  ["Strange_Invulnerability___Странная_Неуяз_LddtMZYmbMI2ZSa8.json", "strangeInvulnerability",
    "Целиком в субмутациях (12 вариантов неуязвимости к типам атак — тупое/клинковое/стрелковое/взрывы/множественные цели и др.), база сама не даёт эффекта — не автоматизировано"],
  ["Strange_Tongue___Странный_Язык_7cchLXBNvN31QfzY.json", "strangeTongue",
    "10 субмутаций дают разные способности языка (Parasite, нюх +20, метательный захват, укус, огнемётная атака и др.) — база не даёт эффекта без субмутации, не автоматизировано"],
  ["Synesthesia___Синэстезия_zdaE6ofV1Xgdx2xA.json", "synesthesia",
    "−20 Scrutiny против персонажа, −10 доп. на Избирательные атаки по нему, −20 его соц. взаимодействия/Командование, штраф Stealth по решению ГМа — ранее ошибочно классифицирована как чисто нарративная, реально несёт 3 фиксированных штрафа"],
  ["Tentacle___Щупальце_nUfrCbj7cIAEWope.json", "tentacle",
    "+20 на приём Захват и тесты Борьбы, растяжение до 4м — модификатор ПРИЁМА (не Навыка), нет вида записи под это (см. wdbc-vkwe); 10 субмутаций не автоматизированы"],
  ["Vampiric_Dependency___Вампирическая_Зави_bNs7bQF7D6EL2nxd.json", "vampiricDependency",
    "Воздержание от подпитки >1 месяц — тест T+0 (−10/мес) или 1 Порча; 10 субмутаций определяют способ/эффект утоления, не автоматизированы (нет bd)"],
  ["Warp_Eater___Пожиратель_Варпа_CNYjlSI5fXnnaqYI.json", "warpEater",
    "Раз в месяц тест Cor+10 или 1 Порча, избегается 4 уникальными по субмутации эмоциональными триггерами в месяц — ранее ошибочно классифицирована как чисто нарративная"],
  ["Warp_Touched___Затронутый_Варпом_www8irFZ4bT6bDsO.json", "warpTouched",
    "10 субмутаций дают психологические W-тесты/эффекты (ложь/правдивость/клептомания/вспыльчивость и др.) — база не даёт эффекта без субмутации, не автоматизировано"],
  ["Wrapped_in_Chaos___Укутанный_в_Хаос_gXfpzscchJ6Vdlq1.json", "wrappedInChaos",
    "10 субмутаций дают разные эффекты дыма (телепорт в тени, фантомные копии, дымовая завеса, штрафы на попадание и др.) — база не даёт эффекта без субмутации, не автоматизировано"]
];

let count = 0;
const toRegister = [];
for (const [file, slug, label] of ENTRIES) {
  const full = DIR + file;
  const doc = JSON.parse(fs.readFileSync(full, "utf8"));
  const groups = doc.flags?.["warhammer-dbc"]?.mechanics || [];
  if (groups.length > 0) { console.log("already has mechanics, skip:", full); continue; }
  const e = blankMechEntry("capability");
  e.id = `${slug}-cap`;
  e.capabilityKey = `mutation.${slug}`;
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  const g = blankMechGroup("AND");
  g.entries = [e];
  doc.flags["warhammer-dbc"].mechanics = [g];
  fs.writeFileSync(full, JSON.stringify(doc, null, 2) + "\n");
  count++;
  toRegister.push({ key: `mutation.${slug}`, label, name: doc.name });
}

const CAP_FILE = "module/constants/capabilities.mjs";
let capSrc = fs.readFileSync(CAP_FILE, "utf8");
let block = "\n  // ── Общие мутации, партия 4 (wdbc-1rno, ревизия по запросу координатора) —\n" +
  "  // заглушка данными, reader пуст сознательно ──\n";
for (const { key, label, name } of toRegister) {
  block += `  "${key}": {\n` +
    `    label: ${JSON.stringify(label)},\n` +
    `    source: "Мутация: ${name.split(" / ")[0]} (Общие мутации)",\n` +
    `    reader: ""\n` +
    `  },\n`;
}
const marker = "\n};";
const idx = capSrc.lastIndexOf(marker);
capSrc = capSrc.slice(0, idx) + block + capSrc.slice(idx);
fs.writeFileSync(CAP_FILE, capSrc);

console.log(`OK: ${count} мутаций получили capability-запись, ${toRegister.length} ключей зарегистрировано`);
