// tools/_5dyh-batch2-gear.mjs — wdbc-5dyh, второй проход: 60 записей Gear с
// числом в тексте (system.effect). Механизм — тот же testMod (flags.mechanics),
// что в первом батче. Большинство «Мистического» раздела — многоэффектные
// экзотические предметы (демонология/псайкерство/условные триггеры), где
// плоский testMod либо не подходит по смыслу (бонус НЕ владельцу, площадной,
// многоступенчатый по Редкости), либо риск переприменить его без выполнения
// условия — такие оставлены честным текстом с причиной в notes, не выдуманы.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function testMod({ label, modScope, skillKey, charKey, value }) {
  const e = blankMechEntry("testMod");
  e.modScope = modScope; e.modValueMode = "flat"; e.value = value; e.label = label;
  if (modScope === "skill") e.skillKey = skillKey;
  if (modScope === "char") e.charKey = charKey;
  return e;
}

const root = "packs-src/gear";
const patches = [
  { file: "Головное/Beast_Master_Mask___Маска_Повелителя_Зве_J6Uht2b1niYuqSkX.json",
    entries: [testMod({ label: "Маска Повелителя Зверей (Выживание)", modScope: "skill", skillKey: "survival", value: 20 }),
              testMod({ label: "Маска Повелителя Зверей", modScope: "char", charKey: "per", value: 10 })],
    notes: "Оговорка не смоделирована: +20 Survival — только в бою; переброс проваленных Survival на командование зверями не смоделирован." },
  { file: "Головное/Preysense_Visor___Охотничий_Визор_JHAXAIK5EEZVPsAZ.json",
    entries: [testMod({ label: "Охотничий Визор (тьма)", modScope: "skill", skillKey: "awareness", value: 20 })],
    notes: "«Тесты Зрения во тьме» отображены как Awareness (ближайший навык восприятия в реестре) — не дословное совпадение. Игнор штрафов освещения/засечка тепла не смоделированы." },
  { file: "Головное/Psi_Occulum___Пси_Оккулюм_GYBOxpgj5zw5v37m.json",
    notes: "Не смоделировано целиком: Трейт Warp Sight, отключение при попадании в голову — числового модификатора теста нет, Scholastic Lore(Occult)+0 — ремонтный тест без бонуса." },
  { file: "Головное/Psychic_Hood___Психический_Капюшон_AM690ScChLDe3mky.json",
    notes: "Не смоделировано: +5 на ВСЕ психотесты — нет области testMod «психотест» в реестре (см. wdbc-jw81 про тот же класс пробела); действие Пси-Капюшон — не числовой эффект." },
  { file: "Головное/Rebreather___Ребризер_ajya2Q9Q2Vqh8q73.json",
    notes: "Не смоделировано целиком: 1 час воздуха, иммунитет к газам/удушью — расходный ресурс/иммунитет, не тест." },
  { file: "Головное/Slave_Collar___Рабский_Ошейник_yAD75g7qsABInGp3.json",
    notes: "Не смоделировано: числа — пороги теста взлома (Security+0/Tech-Use−20), не бонусы владельцу." },
  { file: "Мистическое/Amethyst_of_Distortion___Аметист_Искажен_FRi59P7j4FAFaJes.json",
    notes: "Не смоделировано: −15 — штраф ПРОТИВНИКАМ, атакующим психосилами носителя, не бонус/штраф самому носителю." },
  { file: "Мистическое/Amethyst_of_Reflection___Аметист_Отражен_jx9r4lOUfS7dgl7x.json",
    notes: "Не смоделировано: +15 на сопротивление психосилам/дарам/Одержимости — нет области testMod, охватывающей именно эти встречные тесты как класс." },
  { file: "Мистическое/Amulet_of_Fangs___Амулет_Клыков_rEK40N8IVyCfdP7M.json",
    entries: [testMod({ label: "Амулет Клыков", modScope: "char", charKey: "ws", value: 5 })],
    notes: "Оговорка не смоделирована: +5 WS — только для атак естественным/безоружным оружием, здесь на все тесты WS. Бонусное Очко Бесчестия не смоделировано." },
  { file: "Мистическое/Beguiling_Gem___Заманчивый_Самоцвет_nGjXlvPzUdrXLm70.json",
    notes: "Не смоделировано целиком: W−10 — порог теста ПРОТИВНИКА, атакующего носителя, не бонус носителю." },
  { file: "Мистическое/Bell_of_Lost_Hope___Колокол_Утраченной_Н_AkVmyQOMU7pTfY00.json",
    notes: "Не смоделировано целиком: авто-успех/−20 Нурглитам и прочим — эффект на ДРУГИХ существ по триггеру, не тест владельца." },
  { file: "Мистическое/Bloodskull_Heart___Сердце_Кровавого_Чере_9FoB3bREpldOjBa6.json",
    notes: "Не смоделировано целиком: сложная многобожная реакция (смерть/кровотечение/взрыв) — вне схемы тестового модификатора." },
  { file: "Мистическое/Cage_of_Neverborn___Клеть_Нерожденных_SRMxFVfkzBBY0nyY.json",
    notes: "Не смоделировано целиком: призыв демона через гранаты-плоды — новая механика, не тест." },
  { file: "Мистическое/Coldfire_Heart___Сердце_Холодного_Пламен_4pg2w3zcn1gXHIkD.json",
    notes: "Не смоделировано целиком: замена результата Феномена, встречный тест W+0 — специфика психической механики (wdbc-jw81), не общий testMod." },
  { file: "Мистическое/Cold_Eyes___Холодные_Глаза_KWYD46XBqmjiD7HG.json",
    entries: [testMod({ label: "Холодные Глаза", modScope: "skill", skillKey: "awareness", value: 30 })],
    notes: "«Тесты зрения» отображены как Awareness — не дословно. Снятие штрафов дальней/экстремальной дистанции и Полу-Прицеливание не смоделированы." },
  { file: "Мистическое/Collar_of_Khorne___Ошейник_Кхорна_gckT8Q33aPM9EBwC.json",
    notes: "Не смоделировано целиком: −30/+30 к психотестам — область «психотест» отсутствует в testMod (wdbc-jw81); прочее (Sanctified укус, потеря Psyker) — не тест." },
  { file: "Мистическое/Cruel_Sun___Жестокое_Солнце_SD4Rk0hRAtqhW5Mw.json",
    notes: "Не смоделировано целиком: −20 — штраф ДРУГИМ существам по условию (вера в Императора, в поле зрения), не владельцу." },
  { file: "Мистическое/Crystal_Palm___Хрустальная_Длань_tBlEMaCFWm1yYSiO.json",
    notes: "Не смоделировано целиком: руны для Пути Силы, урон при разрушении — не тестовый модификатор." },
  { file: "Мистическое/Fallen_Banner___Падший_Штандарт_r3QhL2PMXA0hZoga.json",
    notes: "Не смоделировано: +1/−1 SPD и тест T+0 — эффект на группу существ в радиусе по критерию Покровительства, не личный testMod." },
  { file: "Мистическое/Glean_Eye___Сияющий_Глаз_tveZ4iBC4LHNTnW7.json",
    entries: [testMod({ label: "Сияющий Глаз (свободная рука)", modScope: "skill", skillKey: "dodge", value: 10 })],
    notes: "Оговорка не смоделирована: +10 Избегание — только когда рука без предметов и естественная/мутационная, здесь безусловно." },
  { file: "Мистическое/Lead_Cage___Свинцовая_Клеть_EY0MA4x7WF3QDsTR.json",
    notes: "Не смоделировано целиком: игнор бонусов на Феномены при манифестации — специфика психической механики (wdbc-jw81)." },
  { file: "Мистическое/Mask_of_Ang_Grath___Маска_Анг_Грата_UBvE0g6VDyiiqjGT.json",
    notes: "Не смоделировано целиком: выдаёт Трейт/Таланты условно (только Кхорн, только если их нет) и авто-успех в Ярости — многоступенчатое условие." },
  { file: "Мистическое/Mimic_Mask___Маска_Мимик_kzJXwFDt6jsrk3TR.json",
    notes: "Не смоделировано: Logic−20 — порог теста НАБЛЮДАТЕЛЯ, распознающего обман, не владельца." },
  { file: "Мистическое/Nightmarescope___Кошмароскоп_AoMhLrZd89OFl3Ua.json",
    notes: "Не смоделировано целиком: −3×Успехи цели на встречные тесты после успеха владельца — многоступенчатый эффект на цель, не собственный testMod." },
  { file: "Мистическое/Nightmare_Choir___Кошмарный_Хор_MRhbbMAil5vijxP0.json",
    notes: "Не смоделировано целиком: иммунитеты и лечение по сложным условиям (Бог, ранение, осколки душ) — вне testMod." },
  { file: "Мистическое/Obsidian_Web___Обсидиановая_Паутина_5k4DgUq94liuJ4ZK.json",
    notes: "Не смоделировано целиком: авто-урон при телепортации рядом — триггер не на тест, новая механика." },
  { file: "Мистическое/Opal_Bracelets___Опаловые_Браслеты_dV22QJ4rpBKKP5Hu.json",
    notes: "Не смоделировано целиком: копирование ритуальных кругов — новая механика, не тест." },
  { file: "Мистическое/Silver_Fangs___Серебряные_Клыки_fv72FjBT3ZIvSZTo.json",
    notes: "Не смоделировано целиком: встроенная атака Укусом с лечением/зависимостью — новое оружие+механика ресурса, не testMod." },
  { file: "Мистическое/Skull_Totem___Тотем_Черепов_MDqoiR2jU35izdTT.json",
    entries: [testMod({ label: "Тотем Черепов (атаки с Натиска)", modScope: "attack", value: 10 })],
    notes: "Условие Покровительства Кхорна не смоделировано (testMod применится и без него). +W.b м дистанции Натиска и разрешение чаще впадать в Ярость не смоделированы." },
  { file: "Мистическое/Thorn_Heart___Терновое_Сердце_oxzMB3JbsOJpAf1q.json",
    notes: "Не смоделировано целиком: +6 A при непоглощённом уроне (Кхорн) / снижение урона по счётчику (Слаанеш) — условные накопительные эффекты вне testMod." },
  { file: "Мистическое/Undead_Heart___Немертвое_Сердце_s6diw72tx26wXTY7.json",
    notes: "Не смоделировано целиком: Трейты Regeneration/Stuff of Nightmares условно по Богу — не тестовый модификатор." },
  { file: "Мистическое/Vortex_Pendant___Вихревая_Подвеска_xPM5xIfVFqAiMaDB.json",
    notes: "Не смоделировано: W−20 — порог собственного теста прерывания силы (уже описан в самом эффекте, не бонус)." },
  { file: "Мобильность/Climb_Harness___Альпинистская_Разгрузка_UADVRykhf7DcFRTj.json",
    notes: "Не смоделировано: +30 Карабканье — в реестре Навыков нет отдельного ключа «Карабканье» (близко Acrobatics/Athletics, но неточно — не гадаю)." },
  { file: "Мобильность/Gravchute___Гравишют_uzNYmSiBaRY9BSqg.json",
    notes: "Не смоделировано целиком: Operate(Aeronautica)+30/+0 — пороги специфичных тестов, не общий бонус группового Навыка Operate." },
  { file: "Мобильность/Jump_Pack___Прыжковый_Ранец_RhAUzRfpdk3U1AoG.json",
    notes: "Не смоделировано целиком: Трейт Flyer(12), условный полёт — не тестовый модификатор." },
  { file: "Мобильность/Mag_Boots___Маг_Сапоги_tUPYu27xw4JF9cNQ.json",
    notes: "Не смоделировано: −10 A — штраф активации, не Навыка/Характеристики теста, и условен режимом." },
  { file: "Разгрузка/Belt___Ремень_BjVlpNIzPw9hIDnh.json",
    notes: "Числа — вместимость карманов/кобур, не тестовые модификаторы." },
  { file: "Разгрузка/Boot_Holster___Кобура_в_Сапоге_xvl75LtKMYgHvB46.json",
    notes: "Не смоделировано: Awareness−30 — порог теста НАБЛЮДАТЕЛЯ, ищущего спрятанное оружие, не владельца." },
  { file: "Разгрузка/Concealed_Holster___Скрытая_Кобура_XaolRHhiI8JUf8yF.json",
    notes: "Та же причина, что у Кобуры в Сапоге — порог теста наблюдателя." },
  { file: "Разгрузка/Ejector___Выбрасыватель_eJDRPFl9P8NTd9cV.json",
    notes: "Не смоделировано: +2 Инициатива условна Талантом Quick Draw в первый Ход; Awareness−30 — порог теста наблюдателя." },
  { file: "Разное/Chemical_Laboratory___Хим_Лаборатория_MimnkRznoG0vkv0K.json",
    entries: [testMod({ label: "Хим-Лаборатория", modScope: "skill", skillKey: "medicae", value: 10 })],
    notes: "Отнесена к Medicae как ближайшему навыку изготовления химических препаратов — книга не называет конкретный Навык явно, требует сверки с первоисточником. Изготовление ядов/материалы не смоделированы." },
  { file: "Разное/Chemistry_Analyzer___Анализатор_Химии_QYAjXJAjcciE23Xx.json",
    entries: [testMod({ label: "Анализатор Химии", modScope: "skill", skillKey: "medicae", value: 10 })],
    notes: "Та же оговорка, что у Хим-Лаборатории — Navyк не назван явно в тексте." },
  { file: "Разное/Chirurgeon_Pack___Рюкзак_Хирургеон_Ll96rDuhHk9wrapM.json",
    notes: "Не смоделировано целиком: комбинация нескольких предметов Best.Q + Трейт Multiple Arms — составной эффект, не собственный testMod." },
  { file: "Разное/Clone_Field___Клонирующее_Поле_rbZZZbRbcPcFSxqi.json",
    notes: "Не смоделировано целиком: бонус масштабируется Редкостью предмета (за каждую редкость выше 0) — переменная величина, не фиксированный testMod." },
  { file: "Разное/Goblet_of_Spite___Кубок_Злобы_g34JA5ywN0kp0cKL.json",
    notes: "Не смоделировано целиком: аура безумия на противников — эффект на других по площади, не собственный тест владельца." },
  { file: "Разное/Icon_of_Silence___Икона_Тишины_wI0nkIIzQ6lhAFKm.json",
    notes: "Текст сам помечает эффект «ситуативно до +30» — не фиксированное число, применять как testMod означало бы дать бонус безусловно." },
  { file: "Разное/Mask_of_the_Damned___Маска_Обреченного_HlYIl697BzfbdqHf.json",
    notes: "Не смоделировано: W−10 — порог теста ПРОТИВНИКА, не владельца." },
  { file: "Разное/Mirrorhelm___Стеклянный_Шлем_dOUo1fgJB9sCAdHr.json",
    notes: "Не смоделировано целиком: доп. Реакция и условное Преимущество — не числовой testMod." },
  { file: "Разное/Nightmare_Doll___Кошмарная_Кукла_Lv2a8rRrmzyeeOLd.json",
    notes: "Не смоделировано целиком: Fear(4) плюс каскад условных эффектов на других существ — вне testMod." },
  { file: "Разное/Prey_Taker_s_Portal___Портал_Охотника_gSJSPT41rRVWbbSB.json",
    notes: "Не смоделировано целиком: телепортация группы существ — новая механика, не тест." },
  { file: "Разное/Reductor___Редуктор_iypVYtYfycrztRI8.json",
    entries: [testMod({ label: "Редуктор (извлечение)", modScope: "skill", skillKey: "medicae", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — на извлечение трофеев конкретно, здесь на любой тест Medicae." },
  { file: "Разное/Shadow_Field___Теневое_Поле_Z1L5Y1Sw7ZP7qnqX.json",
    notes: "Не смоделировано целиком: щит-купол с запасом AP/Аблативных Ран, area-эффекты — отдельная система защиты, не testMod." },
  { file: "Разное/Signum___Сигнум_tUNQ6Oti3JqnFQqK.json",
    notes: "Не смоделировано: +10 BS — бонус СОЮЗНИКАМ владельца, не самому владельцу." },
  { file: "Разное/Soul_Trap___Душелов_mGUWEQ1PxfzLVbgG.json",
    notes: "Не смоделировано целиком: захват души при убийстве — новая механика, не тест." },
  { file: "Разное/Tormentor_Helmet___Шлем_Мучителя_NpupATOxtNYDW1Hz.json",
    notes: "Не смоделировано: встроенное оружие и +20 очередям — это свойство ВСТРОЕННОГО оружия (integral_attack), не эффект самого предмета Gear." },
  { file: "Разное/Tormentor___Мучитель_OyQ90AEC0KGGCyRo.json",
    entries: [testMod({ label: "Мучитель (Interrogate/Intimidate)", modScope: "skill", skillKey: "interrogate", value: 20 }),
              testMod({ label: "Мучитель (Interrogate/Intimidate)", modScope: "skill", skillKey: "intimidate", value: 20 })],
    notes: "Оговорка не смоделирована: значение в тексте — W.b(душ)×5, здесь фиксированные +20 как приближение (условие поддержания полудействием и множитель числа душ не выражены)." },
  { file: "Разное/Trophy_Rack___Трофейная_Стойка_1jaEVEmcsNuUbp4j.json",
    notes: "Текст сам помечает «ситуативно» и «сама по себе бонусов не даёт» — применять testMod означало бы дать бонус безусловно." },
  { file: "Разное/Vexantrope___Вексантроп_KxKwmkRp2pAkW0B5.json",
    notes: "Не смоделировано: −10 — штраф ПРОТИВНИКУ, не владельцу; остальное — многоступенчатая условная механика." },
  { file: "Разное/Vox_Caster___Вокс_Кастер_cuJALc51c9wso0Pk.json",
    notes: "Числа — дальность связи и бонус Инфограждения, не тестовые модификаторы." }
];

for (const p of patches) {
  const file = `${root}/${p.file}`;
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  if (p.entries) {
    const group = blankMechGroup("AND");
    group.entries = p.entries;
    doc.flags ??= {}; doc.flags["warhammer-dbc"] ??= {};
    doc.flags["warhammer-dbc"].mechanics = [group];
  }
  if (p.notes) doc.system.notes = p.notes;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
