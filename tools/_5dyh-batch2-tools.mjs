// tools/_5dyh-batch2-tools.mjs — wdbc-5dyh, второй проход: 31 запись Tools с
// числом в тексте (system.effect), ещё не размеченная flags.mechanics.
// Тот же метод, что в _5dyh-batch2-gear.mjs: чистые однозначные бонусы теста
// самого владельца — в testMod, всё прочее (пороги встречных тестов ДРУГИХ,
// многоступенчатые ритуалы, area-эффекты, тиры по Редкости, débuff противнику)
// честно в system.notes без домысливания.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function testMod({ label, skillKey, value }) {
  const e = blankMechEntry("testMod");
  e.modScope = "skill"; e.modValueMode = "flat"; e.value = value; e.label = label; e.skillKey = skillKey;
  return e;
}

const root = "packs-src/tools";
const patches = [
  { file: "Мистическое/Chaos_Instrument___Инструмент_Хаоса_Mwmdl7R83DSmIcDX.json",
    notes: "Не смоделировано: +10/+20 — бонус Command только против демонов (выше при совпадении Покровительства), не общий; переброс через Trade(Musician) не выражается плоским testMod." },
  { file: "Мистическое/Cleansing_Salts___Очищающие_Соли_9XM22ndID5t53H5l.json",
    notes: "Не смоделировано целиком: ритуал очищения с уроном по Характеристикам, условной длительностью восстановления и риском смерти — новая процедура, не тестовый модификатор." },
  { file: "Мистическое/Exalted_Icon___Возвышенная_Икона_3uCkX4KFOCTZMwSj.json",
    notes: "Не смоделировано целиком: аура на СОЮЗНИКОВ, зависящая от Покровительства (4 разных эффекта по Богу) — не собственный тест владельца." },
  { file: "Мистическое/Glimmerstone___Проблескамень_jmrJ4DW71ynT5yfb.json",
    notes: "Не смоделировано: W+0 — порог сохранения эффекта, не бонус; снятие штрафов PR/Феноменов — специфика психической механики (wdbc-jw81)." },
  { file: "Мистическое/Icon_of_Chaos___Икона_Хаоса_NPdQdD06D1P3vpe0.json",
    notes: "Не смоделировано целиком: призыв к иконе, +30 Нестабильности демонам рядом — площадные/чужие эффекты; Баланс−2 — свойство самого предмета как оружия, отдельная запись." },
  { file: "Мистическое/Venic_Noose___Веническая_Петля_jQYhxHSK7lY1Sxha.json",
    notes: "Не смоделировано: +20 — бонус только против ОДНОГО конкретного пойманного демона (Демоническое Владычество/социалка), не общий testMod по навыку." },
  { file: "Наборы_инструментов/Combi_Tool___Комби_Инструмент_qMt9IaIeIfB9CVo8.json",
    notes: "Не смоделировано: «+10 на большинство практических тестов Навыка» — не привязано к конкретному Навыку, гадать ключ не стал; Tech-Use+0 — порог настройки, не бонус." },
  { file: "Наборы_инструментов/Demolition_Kit___Подрывной_Комплект_Pbjm1z1Sdgm97IVI.json",
    notes: "Tech-Use+0 — порог сборки бомбы, не бонус теста." },
  { file: "Наборы_инструментов/Injector___Инъектор_tgsTsBeftBwYcwMV.json",
    notes: "Medicae+0 — порог применения, не бонус; инъекции как атака — отдельная боевая механика, не testMod." },
  { file: "Наборы_инструментов/Investigator_Kit___Следовательский_Набор_afhCTNbEIBT16200.json",
    entries: [testMod({ label: "Следовательский Набор", skillKey: "inquiry", value: 20 })],
    notes: "«Детальный осмотр местности» отображён как Inquiry (Дознание) — ближайший навык по книге, не дословное совпадение." },
  { file: "Наборы_инструментов/Purgery_Kit___Комплект_для_Заметания_Сле_PNua5lrFjsjQlsbV.json",
    notes: "Не смоделировано целиком: −10 за Успех — штраф тестам ДРУГИХ (выслеживающих), не бонус владельцу; Security(I)+20 — порог, не бонус." },
  { file: "Наборы_инструментов/Rendering_Kit___Раздирающий_Комплект_lrOVDVbfM9jyy9dY.json",
    notes: "Не смоделировано: +10/+20 — узкоспециализированный ритуал жертвоприношения, не входит ни в один общий Навык из реестра." },
  { file: "Наборы_инструментов/Unholy_Tomes___Нечестивые_Тома_TIIjgVtxYBMwMvD1.json",
    notes: "Не смоделировано: +20 применяется к ОДНОМУ Навыку набора на выбор игрока (несколько вариантов F.L./Sch.Lore) — выбор при получении предмета не поддержан схемой testMod без ручного выбора GM." },
  { file: "Общие/Auspex___Ауспекс_d4Nw3iPhztwCmkUE.json",
    entries: [testMod({ label: "Ауспекс", skillKey: "awareness", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — только на нахождение засекаемой цели, здесь на любой тест Awareness; Tech-Use+0 (настройка режима) — порог, не бонус." },
  { file: "Общие/Fire_Extinguisher___Огнетушитель_uypsiq2Qk8oLCOa5.json",
    notes: "Не смоделировано целиком: тушение пламени — бросок урона против порога, не тест Навыка/Характеристики." },
  { file: "Общие/Graffiti_Paint___Краска_Граффити_Ysm4pjDkggioPmsh.json",
    notes: "Не смоделировано: −20 — штраф ПРОТИВНИКУ (забрызганный визор), не владельцу." },
  { file: "Общие/Magnacles___Магручники_RWnn991iNg5H7Qut.json",
    notes: "Числа — параметры удержания цели (движение/взлом), не тестовый модификатор владельцу." },
  { file: "Общие/Manacles___Наручники_p3SXXrxUIU6DJoIX.json",
    notes: "Числа — пороги взлома/вырывания СКОВАННОЙ целью и характеристики самого предмета (Размер/AP/Структура), не бонус владельцу." },
  { file: "Общие/Null_Rod___Нуль_Жезл_yL1oRmHAGSCQZpUH.json",
    notes: "Не смоделировано: +30 на встречные броски против психосил — нет области testMod для «встречный тест против психосилы» как класса (тот же пробел, что в wdbc-jw81); −30/−10 псайкерам рядом — эффект на ДРУГИХ, не владельца." },
  { file: "Общие/Reductor___Редуктор_EDX0M2TEbpXYBi0q.json",
    entries: [testMod({ label: "Редуктор (извлечение)", skillKey: "medicae", value: 30 })],
    notes: "Полное совпадение текста (Medicae+30 на извлечение геносемени/органов)." },
  { file: "Общие/Screamer___Крикун_whtru1TRE9E2htDR.json",
    notes: "«Проходит Awareness на 1-75» — это шанс срабатывания ловушки, не бонус теста владельца." },
  { file: "Общие/Stummer___Стаммер_2qv2fOPxJS8bFWE3.json",
    entries: [testMod({ label: "Стаммер (скрытное передвижение)", skillKey: "stealth", value: 20 })],
    notes: "Оговорка не смоделирована: −20 слуху ДРУГИХ в радиусе — эффект не владельцу, не включён." },
  { file: "Общие/Tempormortis___Темпормортис_E9sWRWDaijbkvL3Y.json",
    notes: "Не смоделировано целиком: замедление атакующего противника (Инициатива/порядок действий/Избегания) — эффект на противника через боевую экономику действий, не testMod." },
  { file: "Расходники/Caltrops___Чеснок_VdEuoc2UFREtOvQc.json",
    notes: "Не смоделировано целиком: Трудный ландшафт −30/−40 и урон при провале — область/местность, эффект на любого, кто туда встаёт, не тест владельца." },
  { file: "Расходники/Sacred_Oils___Священное_Масло_vT9sJF0wLjh9PPgG.json",
    notes: "+1 к Надёжности ОРУЖИЯ в следующем бою — свойство применяется к другому предмету (оружию) по расходу этого, не собственный тест владельца-Tools; не путать с armor/weapon-mods схемой." },
  { file: "Стационарное/Apothecarion___Апотекарион_dUGR8Bja3dKsoUys.json",
    notes: "Не смоделировано: 5 тиров бонусов по Редкости предмета (R1..R5) к трём разным Навыкам — переменная величина, зависящая от конкретного экземпляра, не фиксированный testMod." },
  { file: "Стационарное/Castrian_Soulcage___Кастрианская_Душекле_9PdU6ObkW1cUUlmI.json",
    notes: "Не смоделировано целиком: многоступенчатый ритуал призыва/удержания демона (Tech-Use(I) вместо W, вместимость по типу демона) — вне схемы testMod." },
  { file: "Стационарное/Crystal_Spire___Хрустальный_Шпиль_NsV7kL1tJPyKpXGe.json",
    notes: "Не смоделировано целиком: аура +20 в радиусе на ГРУППУ (не владельца), плюс каскадный взрыв при разрушении — area-эффект, не testMod." },
  { file: "Стационарное/Forge___Кузница_h9v2BhklswadYKL8.json",
    notes: "Та же причина, что у Апотекариона — тиры по Редкости, переменная величина." },
  { file: "Стационарное/Teleportarium___Телепортариум_n73A90Krxdf5ZAcQ.json",
    notes: "Не смоделировано целиком: комбо-тест из двух Навыков с условными модификаторами по режиму — не одиночный testMod." },
  { file: "Стационарное/Tizcan_Anchor___Тизканский_Якорь_2R4MOqkp3zXQdKAG.json",
    notes: "Не смоделировано целиком: изменение правил дублей для Феноменов и условный порог W−30 — специфика психической механики (wdbc-jw81), не testMod." }
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
