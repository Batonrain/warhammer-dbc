// tools/_5dyh-batch4-missed.mjs — wdbc-5dyh, добор: 33 записи Gear/Tools с
// непустым system.effect, которые не попали ни в withNum (там ловился только
// паттерн вида «+20»/«-10»), ни в noNum (там — полное отсутствие цифр вообще)
// более ранних проходов этой сессии. Числа в них — ёмкость слотов/капсул,
// AP-порог, множитель скорости работы, радиус ауры и т.п., не тестовый
// модификатор Навыка/Характеристики; ни одна запись не мечется под testMod.
import fs from "node:fs";

const patches = [
  { file: "packs-src/gear/Головное/Animus_Speculum___Анимус_Спекулюм_gMwXqMxrGdNxPZek.json",
    notes: "Не смоделировано: выдаёт Трейт Warp Sight (только Пария) и меняет радиус собственной ауры Парии — не тестовый модификатор." },
  { file: "packs-src/gear/Головное/Inhalator___Ингалятор_fo0V4Bi3NRDodtoF.json",
    notes: "Не смоделировано целиком: активация газовых капсул с разными эффектами — расходный ресурс/действие, не тест." },
  { file: "packs-src/gear/Головное/Spy_Mask___Маска_Шпиона_fecdf8u22rkLuGCW.json",
    notes: "Не смоделировано: переключение между режимами восприятия — доступ к возможности, не бонус к тесту." },
  { file: "packs-src/gear/Мистическое/Crown_of_Prospero___Корона_Просперо_jNHhW2RYhodtLvMT.json",
    notes: "Не смоделировано целиком: 1d100 при Феномене/Прорыве — специфика психической механики (wdbc-jw81), не testMod." },
  { file: "packs-src/gear/Мистическое/Endless_Grasp___Бесконечная_Хватка_cia9CsIofq2rIeWT.json",
    notes: "Не смоделировано целиком: урон/недееспособность руки при наложении — самостоятельная механика урона, не тест." },
  { file: "packs-src/gear/Мистическое/Frostfather_s_Belt___Пояс_Морозного_Отца_8DoLb1shC4J7xEzC.json",
    notes: "Числа — ёмкость колчана/петель под оружие, не тестовый модификатор." },
  { file: "packs-src/gear/Мистическое/Namthar_Thorn___Шип_Намтар_GuDOXUBhCk45GHJk.json",
    notes: "Не смоделировано целиком: снятие «счётчика» уколом — своя условная механика ресурса, не тест." },
  { file: "packs-src/gear/Мистическое/Soul_Catcher___Душеловка_LmvA3t8cykDm5c93.json",
    notes: "Не смоделировано целиком: автопоглощение души по условиям (радиус/занятость/приоритет) — новая механика, не тест." },
  { file: "packs-src/gear/Мистическое/Spark_of_Hatred___Искра_Ненависти_3cht2WTBwpiEEBRy.json",
    notes: "Не смоделировано: даёт возможность использовать предмет как источник огня для Пиромантии — доступ к возможности, не бонус к тесту." },
  { file: "packs-src/gear/Мистическое/Traitor_s_Hand___Рука_Предателя_hdoJo9ZMUKEyRiBW.json",
    notes: "Не смоделировано: даёт преимущества Талантов Quick Draw/Quick Store и игнор штрафов — грант Таланта/снятие штрафа, не собственный testMod с числом." },
  { file: "packs-src/gear/Разгрузка/Back_Sheath___Заплечные_Ножны_oUSrgI1uQnBXXPrN.json",
    notes: "Число — вместимость слота разгрузки (5×1), не тестовый модификатор." },
  { file: "packs-src/gear/Разгрузка/Bandolier___Бандольер_WefBG8mB3FwEyV4v.json",
    notes: "Числа — количество карманов/петель разгрузки, не тестовый модификатор." },
  { file: "packs-src/gear/Разгрузка/Hip_Holster___Набедренная_Кобура_8bmGNmNxsC5jVi5T.json",
    notes: "Число — вместимость слота разгрузки (2×1), не тестовый модификатор." },
  { file: "packs-src/gear/Разгрузка/Missile_Rack___Ракетный_Ранец_l9CSp0rDpeEpkQSn.json",
    notes: "Числа — боезапас/условие извлечения по Ходам, не тестовый модификатор." },
  { file: "packs-src/gear/Разное/Camping_Crystallizer___Походный_Кристалл_ny6In0IlXl8YE3dZ.json",
    notes: "Не смоделировано целиком: создание расходников почасовым циклом — генерация ресурса, не тест." },
  { file: "packs-src/gear/Разное/Chem_Injector___Хим_Инжектор_kipvZBRaVKc4F9P9.json",
    notes: "Число — ёмкость (3 капсулы), не тестовый модификатор." },
  { file: "packs-src/gear/Разное/Commorite_Stimm_Rack___Комморитский_Стим_OIBTHrihXZ9cPZHr.json",
    notes: "Число — ёмкость (6 ампул) и режим активации, не тестовый модификатор." },
  { file: "packs-src/gear/Разное/Demolition_Vest___Подрывной_Жилет_rwWveZuVhInMLq8X.json",
    notes: "Не смоделировано целиком: спецправила подрывного жилета (масса/установка) — свойство самого взрывного заряда, не тест владельца." },
  { file: "packs-src/gear/Разное/Gruesome_Talismans___Ужасающие_Талисманы_aWy0B37Ur9u8jEQR.json",
    notes: "Не смоделировано: выдаёт Трейт Fear(1) условно (против определённых типов целей) — вне схемы testMod." },
  { file: "packs-src/gear/Разное/Hell_Mask___Адская_Маска_0cQToVxaugeEDz2P.json",
    notes: "Не смоделировано: порог/штраф теста ПРОТИВНИКА при попытке точной атаки по владельцу, не бонус владельцу." },
  { file: "packs-src/gear/Разное/Omni_Dimensional_Whistle___Меж_Измеренче_klpIGBp6cprKwVGB.json",
    notes: "Не смоделировано целиком: самоурон + невозможность говорить при использовании — расходное действие, не тест." },
  { file: "packs-src/gear/Разное/Webway_Portal___Портал_Паутины_F8duVkW2mJ9UqIGE.json",
    notes: "Не смоделировано целиком: создание портала (размер/срок жизни) — новая механика перемещения, не тест." },
  { file: "packs-src/tools/Мистическое/Force_Rod___Психосиловой_Жезл_YHIo3rFNybClTeAK.json",
    notes: "Не смоделировано целиком: заключение силы в жезл при манифестации — специфика психической механики (wdbc-jw81), не testMod." },
  { file: "packs-src/tools/Общие/Cogitator___Когитатор_ztFWyXgZNBLih4Dw.json",
    notes: "«×4 работа по анализу» — множитель СКОРОСТИ работы (время выполнения), не модификатор результата теста." },
  { file: "packs-src/tools/Общие/Lockpunch___Замкошибатель_bpgAY2duibADWcdT.json",
    notes: "«AP ≤16 → уничтожить замок» — порог применения инструмента (сравнение с AP предмета), не тест Навыка/Характеристики." },
  { file: "packs-src/tools/Общие/Pinner___Прижиматель_jIzkEZXaeQGsO5yr.json",
    notes: "Не смоделировано целиком: area-поле, блокирующее чужие магнитные замки — эффект на предметы в радиусе, не тест владельца." },
  { file: "packs-src/tools/Общие/Teleport_Homer___Телепортационный_Маяк_fRUN2vF9e1XE71kL.json",
    notes: "Убирает шанс несчастного случая при телепортации — вероятностный эффект отдельной телепортационной механики (см. Teleportarium/Tizcan Anchor), не тестовый модификатор Навыка/Характеристики." },
  { file: "packs-src/tools/Расходники/Ceramite_Sealant___Керамитовый_Герметик_enaApHUS87bK8vmC.json",
    notes: "Восстанавливает свойство Sealed/Void брони — воздействие на ДРУГОЙ предмет (доспех), не тест владельца." },
  { file: "packs-src/tools/Расходники/Ghillie_Kit___Гиль_Комплект_2Sy4eh0gY9nAFIzE.json",
    notes: "Даёт эффект Качества другого предмета (хамелеолиновый плащ) для местности — косвенная ссылка на чужой Best.Q, не фиксированное число этого предмета." },
  { file: "packs-src/tools/Стационарное/Deprivation_Chamber___Камера_Депривации_5jevUMBWhMuFjiHp.json",
    notes: "Не смоделировано целиком: механика пытки против иммунитета к пыткам — узкоспециализированная процедура, не тест." },
  { file: "packs-src/tools/Стационарное/Hypno_Pod___Гипно_Капсула_uvCfnDewb5qZzfL6.json",
    notes: "Не смоделировано целиком: имплантация знаний NPC — не тест владельца-игрока." },
  { file: "packs-src/tools/Стационарное/Throne_of_Chaos___Трон_Хаоса_NgMMxDhyMJhsDUZR.json",
    notes: "Не смоделировано: выдаёт Демонические Трейты чемпиону — вне схемы testMod." },
  { file: "packs-src/tools/Стационарное/Vitae_Womb___Вита_Матка_SvXeQe9ptt3MDOKm.json",
    notes: "Не смоделировано целиком: репродуктивная механика (срок/вместимость) — вне схемы тестового модификатора." }
];

for (const p of patches) {
  const doc = JSON.parse(fs.readFileSync(p.file, "utf8"));
  doc.system.notes = p.notes;
  fs.writeFileSync(p.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
