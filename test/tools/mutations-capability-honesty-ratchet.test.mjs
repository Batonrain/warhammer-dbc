// test/tools/mutations-capability-honesty-ratchet.test.mjs
//
// wdbc-1rno (храповик, второй слой поверх mechanics-or-honest-notes-ratchet):
// та проверка засчитывает запись «покрытой», если у неё есть ЛЮБАЯ
// flags.warhammer-dbc.mechanics — включая kind:"capability" с ПУСТЫМ reader
// в module/constants/capabilities.mjs (Конструктор-заглушка, объявленная
// данными, но без единого читателя в коде, см. шапку capabilities.mjs).
// Честная переоценка 01.09.2026 показала: 176/183 «есть Mechanics» —
// это не «работает». Этот тест закрепляет ДРУГОЙ, более строгий инвариант:
// сколько записей Мутаций/Даров несут ТОЛЬКО пустые capability-заглушки
// (ни одного реального kind, ни одной capability с непустым reader).
//
// Число — числовой долг (toBeLessThanOrEqual, может только уменьшаться):
// каждая точечная миграция стаба в реальную запись (testMod/trait/skill/
// aura/... или дописанный reader существующей capability) двигает его вниз;
// откат/новый пустой стаб без разбора — тест ломается.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACKS_SRC = path.join(ROOT, "packs-src");
const MUTATIONS_DIR = path.join(PACKS_SRC, "mutations");

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

/** Реестр { capabilityKey: reader } из module/constants/capabilities.mjs — текстовый парсинг
 *  (тот же приём, что в других разведочных скриптах этой сессии): импортировать сам
 *  модуль сюда нельзя без живого game.* окружения у некоторых соседних констант,
 *  а нам нужны только label/reader строки объекта CAPABILITIES. */
function readCapabilityReaders() {
  const src = fs.readFileSync(path.join(ROOT, "module/constants/capabilities.mjs"), "utf8");
  const keyRe = /"([a-zA-Z][a-zA-Z0-9_.]*)":\s*\{\s*\n\s*label:/g;
  const readers = {};
  let m;
  while ((m = keyRe.exec(src))) {
    const key = m[1];
    const start = keyRe.lastIndex;
    const end = src.indexOf("\n  },", start);
    const block = src.slice(start, end);
    const rm = block.match(/reader:\s*"((?:[^"\\]|\\.)*)"/);
    // reader отсутствует строкой (напр. многострочный шаблон) — считаем непустым:
    // это не голая заглушка, а что-то нестандартное, разбирать вручную не тут.
    readers[key] = rm ? rm[1] : "(non-string-reader)";
  }
  return readers;
}

function isStubOnlyDoc(doc, readers) {
  const mech = doc.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(mech) || !mech.length) return false; // нет Mechanics вовсе — другая категория (долг ratchet'а honest-notes)
  for (const grp of mech) {
    for (const entry of (grp.entries || [])) {
      if (entry.kind !== "capability") return false; // любой другой kind — уже реальная механика
      const reader = readers[entry.capabilityKey];
      if (reader !== "" ) return false; // неизвестный ключ ИЛИ известный, но с читателем — не голый стаб
    }
  }
  return true;
}

describe("храповик: capability-заглушки в Мутациях/Дарах не растут молча (wdbc-1rno)", () => {
  it("реестр capabilities.mjs реально распарсен (защита от пустого regex)", () => {
    const readers = readCapabilityReaders();
    expect(Object.keys(readers).length).toBeGreaterThan(1000);
  });

  it("Мутации/Дары: не больше 130 записей несут ТОЛЬКО пустую capability-заглушку", () => {
    const readers = readCapabilityReaders();
    const files = walk(MUTATIONS_DIR);
    expect(files.length).toBeGreaterThan(0);
    const stubOnly = files.filter(f => isStubOnlyDoc(JSON.parse(fs.readFileSync(f, "utf8")), readers));
    // Базовая линия зафиксирована 01.09.2026 после честной переоценки wdbc-1rno,
    // относительно origin/main (не устаревшей локальной main — та отставала
    // на 18 коммитов на момент этой сессии, некоторые из них добавили ещё
    // мутации/дары): 132 голых заглушки ПОСЛЕ четырёх точечных миграций этой
    // сессии (Hermaphrodite → testMod skillKey:charm; Countenance of Slaanesh
    // → testMod modScope:social; Countenance of Tzeentch → два testMod
    // deceive/scrutiny; Immortal Beauty → kind:"trait" Regeneration(1) под
    // when.woundTier:["heavy","dying"] — старая пометка «гейт не поддержан
    // entry.when» была устаревшей, wdbc-wyr3 давно закрыт). Верхний ярус
    // («+30 с единоверцами»/«против союзников») у Countenance-* сознательно
    // не смоделирован — адресован конкретной цели, распознавания цели нет.
    // Снижать порог явно — отдельной правкой по мере миграции остальных
    // стабов, не двигать вверх без разбора в bd wdbc-1rno.
    // 01.09.2026 (продолжение): Boneless/Бескостный → доп. AND-группа
    // kind:"characteristic" (+10 Ag) — book-текст сверен напрямую
    // (packs-src/books/core.json, «18 | Бескостный»: «Персонаж получает
    // +10 к A» — безусловная строка, отдельная от условного абзаца про
    // форму без опоры/аморфную гору плоти). Capability-заглушка остаётся
    // на нетронутом остатке (½ I(Cr) Dmg до Поглощения/иммунитет к
    // переломам/опциональный Quadruped).
    // Gift of Tongues/Дар Языков -> доп. AND-группа kind:"testMod"
    // (modScope:social, +20) - book-текст «+20 на все тесты социального
    // взаимодействия» без сужения на тип теста (провокация - лишь цель по
    // тексту, не мех. условие). Capability остаётся на понимании речи/языка
    // жестов/ответе оскорблениями.
    // Noble Bearing/Благородная Поступь -> доп. AND-группа kind:"terrainIgnore"
    // (все 11 свойств TERRAIN_PROPS) - book-текст «Персонаж игнорирует штрафы
    // от трудного ландшафта» отдельным предложением. Capability остаётся на
    // хождении по поверхности жидкостей.
    // Продолжение (углублённый разбор пропущенных находок по просьбе
    // пользователя): Cyclops/Циклоп -> testMod skillKey:awareness (−5,
    // «Бдительность» — единственный подходящий Навык + прецедент Eyes of
    // Chaos). Polymath/Полимат -> testMod modScope:skill skillKey:trade
    // (+10, book-текст прямо называет «Навыки группы Trade») — testMod
    // ловит групповой Навык через ctx.group той же строкой «skill:<ключ>»,
    // что и одиночный (resolve-test.mjs::effectAppliesTo, подтверждено
    // существующим тестом test/rules/resolve-test.test.mjs) — НЕ архитектурный
    // пробел, как считалось раньше. Miasma/Миазмы -> testMod skillKey:survival
    // (+40, тот же навык, что уже использует Witch-Seeker для выслеживания)
    // под НОВЫМ шестым гейтом when.requireSealedArmour/negateSealedArmour
    // (mech-when.mjs, PREDICATES.wearsSealedArmour — читает существующее
    // ARMOR_PROPERTIES.sealed) — «без гермодоспеха» книги теперь честно
    // проверяется, а не игнорируется.
    // Black Eyes/Чёрные Глаза -> testMod skillKey:awareness modValueMode:
    // "formula" value:"ceil(cor/2)" (+½Cor(окр.▲), тот же навык, что Cyclops)
    // — testMod впервые читает живую формулу mech-formula.mjs, не только
    // голое число (новый modValueMode:"formula" в item-rules.mjs/resolve-
    // test.mjs/mechanics.mjs, wdbc-1rno), считается заново на каждый бросок
    // от ctx.actor, не застывает при получении предмета.
    // Countenance of Khorne/Nurgle, Majestic Horns — переоценка ранее
    // отвергнутого «target-type пробела»: все модификаторы testMod в системе
    // уже читаются как ОПЦИОНАЛЬНЫЕ галочки диалога броска (rule-mod/item-mod
    // checkbox, actor-sheet.mjs/attack-dialog.mjs/roll-mods.mjs), не
    // применяются молча — значит флэт testMod с честной подписью цели
    // («+20 социальные тесты (солдаты/воины)») безопасен без какого-либо
    // распознавания типа цели в коде: игрок сам решает, ставить ли галочку
    // против конкретного собеседника, тот же принцип, что у halvePenalty.
    // Прежний вывод «флэт дал бы бонус против любого — ошибка» не учитывал
    // эту механику галочек. Khorne/Nurgle получили по 3 testMod-записи
    // (базовый/культистский тир социальных + доп. Навык/штраф), Majestic
    // Horns — одну.
    // Sentient Cyst/Разумная Циста -> новый вид записи kind:"failDegMod"
    // (module/rules/effects.mjs, resolve-test.mjs::failDegModFromRules,
    // kind-outcome.mjs::resolveKindOutcome, docs/rules-format.md) — «+3
    // Провала при провале» книги считается ПОСЛЕ броска, не в галочках
    // диалога (в отличие от testMod), суммируется безусловно на провале.
    // Второй проход по оставшимся 121 (по просьбе пользователя, «давай»):
    // Witch-Seeker (+30 Survival, выслеживание псайкеров), Enchanting Voice
    // (+½Cor(окр.▲) соц., formula, исключения — подпись галочки), Progenitor
    // (+30 соц. + +30 встречные психосил/психоатак, обе — с прямыми
    // потомками, подпись галочки), Spellwise (переброс Пси-чутья, kind:"reroll").
    // Третий проход (по просьбе пользователя, «Доделай» -> «Активные
    // способности через kind:"script"»): Mist Transformation/Трансформация
    // Тумана и Spatial Instability/Пространственная Нестабильность — ручная
    // кнопка «▶ Запустить» клонирует Incorporeal(+Flyer) из пака Черт;
    // частота/длительность/побочные эффекты НЕ автоматизированы (см.
    // capabilities.mjs). Не проверено живьём в Foundry — мир не был запущен
    // на момент правки, только синтаксис (AsyncFunction-парсинг тем же
    // конструктором, что executeItemCode) и структура/паттерн (тот же приём
    // поиска по пaку, что apps/homeworlds.mjs::buildTraits).
    // Pure Form/Чистая Форма (по прямой просьбе пользователя — «давай
    // сделаем», «не удаление, а отключение») -> новый примитив
    // rules/mutation-suppression.mjs: flags.warhammer-dbc.suppressed на
    // type:"mutation", isItemActive() (apps/effects.mjs) знает про него,
    // setMutationsSuppressed() переиспользует уже существующий toggle-
    // конвейер apps/toggle-abilities.mjs::syncToggleChild (эффекты/свойства
    // оружия/выданные Черты-Таланты/выданные предметы) — НЕ изобретён заново.
    // Два kind:"script": переключатель (1 час туда/обратно предполагается
    // отыгранным) + аварийный разрыв (мгновенно, +1d10 непогл. R Dmg через
    // rules/wounds.mjs::woundLossUpdates, тот же путь, что боевой урон).
    // Icon of Blasphemy/Икона Богохульства (по прямой просьбе пользователя —
    // «у токенов есть дальность видения и сектор обзора, можем использовать?»)
    // -> новый модуль rules/vision-target.mjs (isTokenInSight/tokensThatCanSee,
    // TokenDocument.sight.range/angle+rotation, геометрия без стен/тьмы —
    // canvas.visibility.testVisibility недоступен вне живого canvas) + новая
    // AND-группа kind:"script": находит токены-Имперцев (rules/factions.mjs)
    // в пределах видимости актора, гоняет W-тест на каждого (паттерн
    // combat/pacifism.mjs::rollPacifismTest — 1d100 vs wp.total), провал ->
    // system.inRage. Канал Пси-чутья/Ноосканирования и «атакует только
    // чемпиона» остаются на честной capability-заглушке (см. label выше) —
    // не смоделированы. Throttle scriptThrottleUnit:"battle" (вне активного
    // боя не гейтит вовсе — приближение «раз за бой ИЛИ сцену»). Не проверено
    // живьём в Foundry (мир не запущен), только синтаксис/структура.
    // Compression/Сжатие (по прямой просьбе пользователя, «Compression давай
    // сделаем») — единственный случай в этой сессии, где capability получила
    // РЕАЛЬНЫЙ reader (не новую запись Механики на предмете): новый чистый
    // модуль rules/compression.mjs + combat/defense.mjs::_performCompression/
    // _performExtendBodyPart — реактивная АЛЬТЕРНАТИВА Уклонению рядом с
    // кнопками Уклонения/Парирования на карточке атаки (attack-card.mjs::
    // defenseSection, новый параметр hitLocLabel — уже вычислен и передаётся
    // с самого начала атаки, attack.mjs); показывается, только если место
    // попадания не Торс. Без броска: тратит Реакцию (hasRuleFlag-гейт по
    // capability, как COUNTER_ATTACK_CAPABILITY), нивелирует ровно ЭТО
    // попадание, помнит втянутые части на акторе
    // (flags.warhammer-dbc.compressedParts), кнопка «Разложить» в той же
    // карточке возвращает часть обратно (data-actor-uuid, тот же приём, что
    // у кнопки Контратаки после Парирования — не полагается на «выбранный
    // токен»). НЕ автоматизировано намеренно (см. шапку rules/compression.mjs):
    // слепота от втянутой Головы (существующий blindedRounds — счётчик
    // раундов, автоснимающийся тиком, НЕ подходит для состояния «пока не
    // разложена обратно», подключение сломало бы честность модели), снижение
    // мобильности от Ног (книга не даёт числа), автовыпуск оружия из Руки.
    // Не проверено живьём в Foundry.
    expect(stubOnly.length).toBeLessThanOrEqual(112);
  });
});
