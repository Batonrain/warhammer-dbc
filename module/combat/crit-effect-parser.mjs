// module/combat/crit-effect-parser.mjs
// ════════════════════════════════════════════════════════════════════════════
//  wdbc-xql6: крит-таблицы (../../critical-tables.mjs) и таблица Шока после
//  провала Страха (constants/fear-tables.mjs::SHOCK_TABLE) — это ~200 строк
//  свободного русского текста. Раньше в чат уходил только текст, игрок сам
//  раскидывал по счётчикам: сам кидал 1d10 Раундов Оглушения, сам ставил
//  Кровотечение. Здесь — узкий regex-скан по типовым оборотам книги
//  («Оглушена на NdX Раундов», «N Усталости», «Кровотечение» и т.п.),
//  превращающий их в кликабельные пилюли CONDITIONS_DEF: клик сам кидает
//  кубик длительности (если он есть) и накладывает состояние на актора
//  карточки. Нераспознанные обороты («тест T+0, или умереть от шока»,
//  «−10 на все тесты X», урон в характеристику и т.п.) остаются только
//  текстом самой карточки — этот модуль их не трогает и не прячет.
//
//  ВАЖНО (см. doombc-russian-text-regex-pitfalls): \w/\b в JS не видят
//  кириллицу вовсе — везде explicit [а-яёА-ЯЁ], никаких \b. Регэкспы ниже
//  построены не «в слепую», а по факту прочтения всех 304 строк
//  critical-tables.mjs — это не широкий скан-кандидатов по книге (там
//  добавляется риск морфологических омонимов), а сверенный список реальных
//  формулировок этой конкретной таблицы.
// ════════════════════════════════════════════════════════════════════════════

// Из constants/conditions.mjs (wdbc-w88h), не из sheets/sheet-helpers.mjs —
// combat/ не должен тянуть слой листа.
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { addFatigue, conditionAdjustFields, conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { LIMB_LOSS_KEYS, BODY_SIDE_SHORT, sideOfLimb, pickLostSide, lostSideFields } from "../rules/limb-loss.mjs";
import { dropFromHand } from "./limb-loss.mjs";
import { isImmuneToCondition } from "../rules/condition-guards.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { USELESS_SIDES, SIDE_LABELS, pickSide, uselessApplyFields } from "../rules/useless-limbs.mjs";

/** Пилюли Бесполезной конечности (wdbc-x1nz.2.99) — не Состояния, а запись в system.uselessLimbs. */
const USELESS_KEYS = { uselessArm: "arm", uselessLeg: "leg" };

/** Потеря какой части тела на какой конечности попадания (wdbc-x1nz.2.100). Глаза — без стороны попадания. */
const LIMB_KEY_TYPE = { lostHands: "arm", lostArms: "arm", lostFeet: "leg", lostLegs: "leg" };

/** Сторона ("right"/"left"/"") для пилюли по конечности попадания ("rightArm"…), если тип совпал. */
function pillSide(key, limbSide) {
  const type = USELESS_KEYS[key] ?? LIMB_KEY_TYPE[key];
  return type && USELESS_SIDES[limbSide] === type ? limbSide : "";
}

/**
 * «Цель роняет всё, что держит в этой руке», «выбивает из руки», «То, что
 * было в руке, падает» (wdbc-x1nz.2.100) — кнопка «Выронить» под текстом.
 * Только на попадании в руку: сторона берётся из места попадания.
 */
export function textDropsHeld(text) {
  return /рон(?:яет|ять)|выронить|выбивает\s+из\s+руки|выпускает\s+из\s+этой\s+руки|что\s+было\s+в\s+руке,?\s+падает|что\s+было\s+у\s+цели\s+в\s+руке,\s+уничтожено/iu.test(text ?? "");
}

export function dropButtonHtml(text, actorUuid, limbSide = "") {
  const side = sideOfLimb(limbSide);
  if (!actorUuid || !side || USELESS_SIDES[limbSide] !== "arm" || !textDropsHeld(text)) return "";
  return `<div class="wh-crit-pills">
    <button type="button" class="wh-crit-drop-btn" data-actor-uuid="${esc(actorUuid)}" data-side="${side}"
      title="Снять из этой руки всё, что в ней было (без траты ОД)">
      ${rollIcon("warn", "#d9a066")} Выронить (${BODY_SIDE_SHORT[side]} рука)</button>
  </div>`;
}

// «Стем + на NdX/N Раунд(ов)» — общий костяк для Оглушения/Ослепления.
function roundPhrase(stem) {
  // «её»/«ее» — книга пишет без ё («Оглушая ее на 1 Раунд», wdbc-x1nz.2.98).
  return new RegExp(`${stem}[а-яёА-ЯЁ]*\\s+(?:цель\\s+|е[её]\\s+|его\\s+)?на\\s+(\\d+d\\d+|\\d+)\\s+Раунд`, "giu");
}

/**
 * Распознать типовые фразы в тексте крит-эффекта/строки Шока и вернуть
 * список пилюль { key (CONDITIONS_DEF), formula (кубик/число/null),
 * permanent (bool) }. Дубли (тот же key+formula) схлопываются — некоторые
 * обороты («Удушья» дважды в одном предложении) иначе дали бы вторую кнопку.
 */
export function parseCritEffectPills(text) {
  if (!text) return [];
  const pills = [];
  const seen = new Set();
  const push = (key, formula, extra = {}) => {
    if (!CONDITIONS_DEF[key]) return;
    const dedupeKey = `${key}:${formula || ""}:${extra.permanent ? "p" : ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    pills.push({ key, formula: formula || null, ...extra });
  };

  // Оглушение: «Оглушена/Оглушая/Оглушение ... на NdX Раундов»
  for (const m of text.matchAll(roundPhrase("Оглуш"))) push("stunned", m[1]);

  // Ослепление: «Ослепляет/Ослеплена ... на NdX Раундов», отдельно — перманент
  for (const m of text.matchAll(roundPhrase("Ослеп"))) push("blinded", m[1]);
  if (/перманентно\s+ослеплен[а-яёА-ЯЁ]*/giu.test(text)) push("blinded", null, { permanent: true });

  // Беспомощность: «Беспомощна/Беспомощной на 1d5 Раундов» (Химические, wdbc-x1nz.2.98).
  // Тикающего счётчика у helpless нет — кинутые Раунды идут в карточку текстом.
  for (const m of text.matchAll(roundPhrase("Беспомощ"))) push("helpless", m[1]);

  // Усталость: «N[dX] [уровень/уровня/уровней] Усталости»
  for (const m of text.matchAll(/(\d+d\d+|\d+)\s+(?:уровень|уровня|уровней)?\s*Усталост[а-яёА-ЯЁ]*/giu))
    push("fatigued", m[1]);

  // Кровотечение — таблица никогда не даёт числа, только сам факт.
  if (/Кровотечение/gu.test(text)) push("bleeding", null);

  // Обескровливание — редкий, но точный случай («Кровотечение и 2 Обескровливания»).
  for (const m of text.matchAll(/(\d+)\s+Обескровливани[а-яёА-ЯЁ]*/giu))
    push("haemorrhaging", m[1]);

  // Удушье — крит-таблица числа не даёт; запас задержки дыхания при наложении
  // — книжные T.b×2 Раундов активного режима (applyCritEffectPill ниже,
  // wdbc-x1nz.2.94), а не 0: с нулём персонаж сразу терял бы сознание.
  if (/Удушь[а-яёА-ЯЁ]*/gu.test(text)) push("suffocating", null);

  // Загорание — почти всегда за проваленным тестом («тест A+0, или Загореться»),
  // поэтому пилюля всё равно предлагается — ГМ жмёт, только если тест провален.
  if (/Загор[а-яёА-ЯЁ]*/gu.test(text)) push("burning", null);

  // Перманентная потеря слуха.
  if (/лишен[а-я]*\s+слуха/giu.test(text)) push("deafened", null, { permanent: true });

  // Сбита/сбивает с ног — булево состояние Повален.
  if (/[Сс]бит[а-яёА-ЯЁ]*\s+с\s+ног|[Сс]бива[а-яёА-ЯЁ]*\s+с\s+ног/gu.test(text)) push("prone", null);

  // «потерять/теряет сознание» — тоже часто за тестом (Взрывной/таблица Шока).
  if (/потерять\s+сознание|теряет\s+сознание/giu.test(text)) push("unconscious", null);

  // Потеря частей тела (стр. 30-31, wdbc-1rno.6) — за тестом («тест на T+X,
  // или лишиться/потерять Y», сверено построчно со всей critical-tables.mjs:
  // book знает только эти пять слов рядом с «лишиться»/«потерять» — не
  // широкий скан-кандидатов) и как прямая констатация факта («Цель теряет
  // руку/ногу.» — устойчивая формула всех безусловных строк потери руки/ноги
  // в этой таблице). Каждая пилюля тянет Кровотечение — книга «Потеря
  // конечностей ВСЕГДА приводит к Кровотечению» не оговаривает исключений
  // для строк, которые само слово не упоминают.
  const LIMB_LOSS_WORDS = { ладони: "lostHands", кисти: "lostHands", кисть: "lostHands", стопу: "lostFeet", ступню: "lostFeet", ногу: "lostLegs", глаз: "lostEyes" };
  for (const m of text.matchAll(/(?:лишиться|потерять)\s+(ладони|кисти|кисть|стопу|ступню|ногу|глаз)/giu)) {
    const key = LIMB_LOSS_WORDS[m[1].toLowerCase()];
    if (key) { push(key, "1"); push("bleeding", null); }
  }
  if (/[Цц]ель\s+теря[а-яёА-ЯЁ]*\s+руку/gu.test(text)) { push("lostArms", "1"); push("bleeding", null); }
  if (/[Цц]ель\s+теря[а-яёА-ЯЁ]*\s+ногу/gu.test(text)) { push("lostLegs", "1"); push("bleeding", null); }
  // «Цель теряет зрение» — полная слепота как исход удара по лицу, не то же
  // самое, что физическая потеря глаза (lostEyes) выше; ближайшее книжное
  // Состояние — перманентное Ослепление (тот же приём, что уже даёт
  // «перманентно ослеплена» строкой выше).
  if (/[Цц]ель\s+теря[а-яёА-ЯЁ]*\s+зрение/gu.test(text)) push("blinded", null, { permanent: true });

  // Бесполезная конечность (wdbc-x1nz.2.99): по предложениям — в одной строке
  // таблицы рядом бывают «сбита с ног» и «Рука становится бесполезной», тип
  // конечности берётся из того предложения, где сказано «бесполезн-».
  // «на NdX Раундов» — временно (лечения не нужно), иначе — до лечения.
  // «Ступня бесполезна» — это нога (решение владельца, 24.09.2026).
  const healPenalty = /Тесты\s+лечения\s+бесполезной\s+конечности\s+получают\s+штраф\s+[–−-](\d+)/iu.exec(text);
  for (const sentence of text.split(/(?<=[.!?])\s+/u)) {
    if (!/бесполезн/iu.test(sentence) || /Тесты\s+лечения/iu.test(sentence)) continue;
    const key = /(?:^|[^а-яёА-ЯЁ])(?:ног[аиу]|ступн[а-яё]*)(?![а-яёА-ЯЁ])/iu.test(sentence) ? "uselessLeg" : "uselessArm";
    const rounds = /бесполезн[а-яёА-ЯЁ]*\s+на\s+(\d+d\d+|\d+)\s+Раунд/iu.exec(sentence)
      || /на\s+(\d+d\d+|\d+)\s+Раунд[а-яёА-ЯЁ]*\s+рук[а-яёА-ЯЁ]*\s+становится\s+бесполезн/iu.exec(sentence);
    push(key, rounds ? rounds[1] : null, healPenalty ? { healMod: -Number(healPenalty[1]) } : {});
  }
  // «рука бесполезна и поражена Гангреной» (C/Рука 9, C/Нога 9).
  if (/поражен[а-яёА-ЯЁ]*\s+Гангрен/iu.test(text)) push("gangrene", null);

  return pills;
}

/**
 * Утверждает ли текст крит-эффекта/Шока смерть цели ПРЯМО, а не условно
 * (wdbc-1rno, 09.09.2026). «Тест T+0, или умереть от шока» — 12 строк книги
 * с этой формулировкой — смерть там зависит от исхода теста, намеренно НЕ
 * ловится: «умереть» здесь инфинитив (умере-), другой корень, чем «умирает»/
 * «умирающий» (умира-) в безусловных строках — различие настоящее, не
 * искусственное. «Трупным» (ядом) — прилагательное, не «труп» цели:
 * негативный lookahead `(?!н)` отсекает его явно (2 строки книги несут оба
 * слова разом — «трупным ядом» ВНУТРИ условной «или умереть от шока»).
 *
 * Список оборотов сверен построчно со ВСЕЙ таблицей (critical-tables.mjs,
 * 200 строк) — не широкий скан-кандидатов, а то, что реально встречается:
 * «умирает»/«убивает»/«убивая»/«погибает» (все книжные формы трёх глаголов
 * смерти), «безжизненн-», «труп» (без «-ный»), «уходит жизнь», «не
 * способна/не удаётся пережить», «смерть наступает», «заканчивается
 * мгновенной смертью», «это смертельно».
 *
 * 09.09.2026, живая проверка (live-tester): первая редакция сужала «убива»/
 * «погиба» до конкретных окончаний ([ею]) — деепричастие «убивая» (реальная
 * форма в 4 строках книги, critical-tables.mjs:118,121,144,145) под эту
 * маску не попадало, кнопка молча не появлялась. У «умира» такого
 * искусственного сужения не было изначально — проверено вживую, что
 * ловится. Урок: не сужать корень до подмножества окончаний без явной
 * причины — «мертвая буква» ловится только полным перебором форм, которого
 * никто не делал.
 *
 * 10.09.2026 (wdbc-665): полный перебор наконец сделан машинно — все 200
 * строк прогнаны через каждый оборот. Оказалось, что девять БЕЗУСЛОВНО
 * смертельных строк, и все на результатах 9-10, кнопки не давали, потому что
 * ни одного глагола смерти в них нет вовсе: «Голова цели взрывается…» (2),
 * «прежде чем [растаять как снег на ветру и] умереть» (2 — инфинитив, но
 * смерть здесь безусловна, в отличие от условного «или умереть от шока»:
 * различает их оборот «прежде чем», а не корень), «Смертельнее не бывает»,
 * «разрывает цель в кровавые клочья» (2), «Цель прекращает своё
 * существование» (2). Все 14 условных строк «или умереть» под новые обороты
 * НЕ попадают — проверено тем же прогоном (test/combat/crit-effect-parser.
 * test.mjs).
 *
 * Осторожно с `\b`: в JS это ASCII-граница слова, и `\bумереть` после
 * пробела не срабатывает вовсе — кириллица для неё не «слово». Первая
 * редакция этой правки молча ловила 0 строк именно из-за этого.
 */
export function textAssertsDeath(text) {
  if (!text) return false;
  // «тест на T+0, или умирает от остановки сердца» (C/Торс 9) — та же условная
  // смерть, что «или умереть от шока», но глаголом «умира-»: вырезаем до скана.
  text = text.replace(/или\s+умира[а-яёА-ЯЁ]*/giu, "");
  return /умира[а-яёА-ЯЁ]*|убива[а-яёА-ЯЁ]*|погиба[а-яёА-ЯЁ]*|безжизненн[а-яёА-ЯЁ]*|труп(?!н)[а-яёА-ЯЁ]*|уходит\s+жизнь|не\s+(?:уда[её]тся|способна)\s+пережить|смерть\s+наступает|заканчивается\s+мгновенной\s+смертью|это\s+смертельно|голов[а-яё]*\s+цели\s+взрывается|прежде\s+чем[^.]*умереть|смертельнее\s+не\s+бывает|в\s+кровавые\s+клочья|прекращает\s+сво[её]\s+существование/giu
    .test(text);
}

/**
 * Кнопка «Констатировать смерть» под текстом крит-эффекта — только когда
 * textAssertsDeath(text) истинно. Не через CONDITIONS_DEF/critPillsHtml:
 * смерть — не Состояние, а отдельный флаг flags.warhammer-dbc.deceased
 * (module/sheets/tabs/body.mjs, тот же флаг, что уже держит весь готовый блок
 * Спасения/Воскрешения, module/rules/death-save.mjs). Применяющий клик —
 * не здесь: combat/ не должен тянуть слой листа (см. шапку файла), кнопку
 * разбирает module/hooks.mjs, который уже стоит поверх обоих слоёв.
 *
 * weaponUuid (wdbc-1rno, Кровавое Пламя) — необязательный: оружие, которым
 * нанесён именно этот удар, уже известно на карточке урона (attack-card.mjs::
 * itemUuid) — несётся дальше как data-атрибут, чтобы клик мог засчитать
 * «убитого этим оружием» (module/combat/blood-flame.mjs::
 * registerBloodFlameKill), не как условие появления самой кнопки.
 */
export function deathButtonHtml(text, actorUuid, weaponUuid = "") {
  if (!actorUuid || !textAssertsDeath(text)) return "";
  return `<div class="wh-crit-pills">
    <button type="button" class="wh-crit-death-btn" data-actor-uuid="${esc(actorUuid)}"
      data-weapon-uuid="${esc(weaponUuid || "")}"
      title="Книга прямо описывает смерть цели">
      ${rollIcon("skull", "#ff6b6b")} Констатировать смерть</button>
  </div>`;
}

/** Пилюля со значением уровня/раундов? Иначе — просто булев флаг. */
function formulaIsDice(formula) {
  return !!formula && /d/i.test(formula);
}

/**
 * HTML-блок кнопок под текстом крит-эффекта. actorUuid — цель, известная
 * УЖЕ на этапе применения урона (applyDamageToActor), поэтому в отличие от
 * пилюль Ритуала (module/apps/ritual-cast.mjs — перетаскиваемые, без
 * фиксированной цели) здесь достаточно кликабельной кнопки.
 *
 * hitNetDamage (wdbc-3pv5, опционально) — непоглощённый урон САМОГО удара,
 * породившего крит-эффект: у пилюли «Загорается» (в отличие от Огня-свойства
 * оружия) книга не даёт отдельного числа для «пламя наносит не больше 1d10» —
 * крит-таблица бьёт только фактом. Ближайший осмысленный кандидат — урон
 * этого же попадания, поэтому кладём его в data-source-damage, только у
 * пилюли "burning" (остальным он не нужен).
 *
 * side (wdbc-x1nz.2.99, опционально) — какая конечность задета (ключ
 * rules/useless-limbs.mjs::LOCATION_TO_SIDE по месту попадания): только у
 * пилюль Бесполезной руки/ноги, чтобы бесполезной стала именно она.
 */
export function critPillsHtml(pills, actorUuid, hitNetDamage = null, { side = "" } = {}) {
  if (!pills?.length || !actorUuid) return "";
  const btns = pills.map(p => {
    const def = CONDITIONS_DEF[p.key];
    if (!def) return "";
    const useless = USELESS_KEYS[p.key];
    const durTxt = p.permanent ? " (перм.)" : (p.formula ? ` ${esc(p.formula)}${useless ? " Р." : ""}` : (useless ? " (до лечения)" : ""));
    let srcDmgAttr = (p.key === "burning" && hitNetDamage != null)
      ? ` data-source-damage="${esc(String(hitNetDamage))}"` : "";
    if (useless) srcDmgAttr += ` data-heal-mod="${Number(p.healMod) || 0}"`;
    if (useless || LIMB_KEY_TYPE[p.key]) srcDmgAttr += ` data-side="${pillSide(p.key, side)}"`;
    return `<button type="button" class="wh-crit-apply-btn" data-actor-uuid="${esc(actorUuid)}"
      data-cond-key="${p.key}" data-formula="${esc(p.formula || "")}" data-permanent="${p.permanent ? "1" : "0"}"${srcDmgAttr}
      title="Наложить на цель карточки">
      ${def.svg || def.icon} ${esc(def.label)}${durTxt}</button>`;
  }).filter(Boolean).join("");
  return btns ? `<div class="wh-crit-pills">${btns}</div>` : "";
}

/**
 * Применить одну пилюлю к актору: кидает кубик длительности (если формула —
 * кубик), накладывает состояние (аддитивно к уже идущему счётчику — вторая
 * подряд Оглушающая рана добавляет Раунды, а не перекрывает их) и постит
 * карточку в чат. Состояния без levelField (Без сознания) — только флаг,
 * кинутая длительность идёт в карточку текстом: тикающей инфраструктуры для
 * них нет (см. condition-ticks.mjs — только Оглушение/Ослепление/Удушье),
 * снимать их ГМ будет вручную, как и раньше.
 *
 * sourceDamage (wdbc-3pv5, только для key==="burning") — непоглощённый урон
 * попадания, породившего крит-эффект (data-source-damage кнопки,
 * critPillsHtml). Кладётся в system.conditions.burningSourceDamage той же
 * записью, что накладывает само Состояние — Cooler/Морозное Сердце сравнивают
 * его с книжным порогом (condition-ticks.mjs::ensureBurningGrace).
 */
export async function applyCritEffectPill(actor, { key, formula, permanent, sourceDamage = null, side = "", healMod = 0 } = {}) {
  const def = CONDITIONS_DEF[key];
  if (!actor || !def) return;
  if (USELESS_KEYS[key]) return applyUselessLimbPill(actor, { key, formula, side, healMod });
  if (LIMB_LOSS_KEYS.includes(key)) return applyLimbLossPill(actor, { key, side });

  let amount = null, diceHtml = "", diceRoll = null;
  if (formulaIsDice(formula)) {
    diceRoll = await new Roll(formula).evaluate();
    amount = diceRoll.total;
    diceHtml = await diceRoll.render();
  } else if (formula) {
    amount = Number(formula) || null;
  }

  const tracked = key === "fatigued" || (def.hasLevel && def.levelField);
  if (key === "fatigued") {
    await addFatigue(actor, amount || 1);
  } else if (def.hasLevel && def.levelField && amount != null && !permanent) {
    // Потеря части тела сюда не доходит — applyLimbLossPill выше (по сторонам).
    await actor.update(conditionAdjustFields(actor, key, amount));
  } else {
    // Удушье без числа (wdbc-x1nz.2.94): полный запас активного режима,
    // T.b×2 Раундов (condition-ticks.mjs::suffocationHoldUnits — не
    // импортируется отсюда: condition-ticks тянет damage.mjs, а тот — этот файл).
    const level = (key === "suffocating" && !permanent)
      ? Math.max(1, (Number(actor.system?.characteristics?.t?.bonus) || 0) * 2)
      : null;
    const fields = conditionApplyFields(key, level, actor);
    if (key === "burning" && sourceDamage != null && Object.keys(fields).length) {
      fields["system.conditions.burningSourceDamage"] = sourceDamage;
    }
    // Крит «Загорается» книга числом не усиливает — обычный 1d10; формула
    // ПРОШЛОГО, уже погасшего источника пламени (condition-ticks.mjs::
    // BURNING_FORMULA_FLAG) сюда не переносится. Если персонаж ещё горит от
    // того источника, его пламя никуда не делось — формула остаётся.
    if (key === "burning" && Object.keys(fields).length && !actor.system?.conditions?.burning
        && actor.getFlag?.("warhammer-dbc", "burningDamageFormula")) {
      fields["flags.warhammer-dbc.-=burningDamageFormula"] = null;
    }
    await actor.update(fields);
  }

  const noteParts = [];
  if (permanent) noteParts.push("перманентно");
  else if (amount != null) noteParts.push(`+${amount}${tracked ? "" : " (снимите вручную — без автотика)"}`);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Крит-эффект → ${esc(actor.name)}</div>
      <div class="roll-threshold">${def.svg || def.icon} <b>${esc(def.label)}</b>${noteParts.length ? ` — ${noteParts.join(", ")}` : ""}</div>
      ${diceHtml}
    </div>`,
    rolls: diceRoll ? [diceRoll] : [],
    sound: diceRoll ? CONFIG.sounds.dice : null
  }, game.settings.get("core", "rollMode")));
}

/**
 * Пилюля «Бесполезная рука/нога» (wdbc-x1nz.2.99): запись в
 * system.uselessLimbs той конечности, куда пришёлся удар (иначе — первой
 * целой этого типа). С формулой — на столько Раундов, без — до лечения:
 * с этой минуты идут часы 2×T.b (rules/useless-limbs.mjs).
 */
async function applyUselessLimbPill(actor, { key, formula, side, healMod }) {
  const def = CONDITIONS_DEF[key];
  const type = USELESS_KEYS[key];
  const target = pickSide(actor.system, type, side);
  let rounds = 0, diceRoll = null, diceHtml = "";
  if (formulaIsDice(formula)) {
    diceRoll = await new Roll(formula).evaluate();
    rounds = diceRoll.total;
    diceHtml = await diceRoll.render();
  } else if (formula) {
    rounds = Number(formula) || 0;
  }
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  await actor.update(uselessApplyFields(actor.system, target, {
    rounds, healMod: Number(healMod) || 0, worldTime: game.time?.worldTime ?? 0, tb
  }));
  // Бесполезной рукой ничего не удержать (wdbc-x1nz.2.100).
  if (type === "arm") await dropFromHand(actor, sideOfLimb(target), { reason: "рука бесполезна" });
  const note = rounds > 0
    ? `на <b>${rounds}</b> Раунд.`
    : `до лечения — Medicae+0 в течение <b>${2 * Math.max(0, tb)}</b> ч. (2×T.b), иначе перманентно${Number(healMod) ? `; тесты лечения ${healMod}` : ""}`;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Крит-эффект → ${esc(actor.name)}</div>
      <div class="roll-threshold">${def.svg || def.icon} <b>${esc(def.label)}</b> (${esc(SIDE_LABELS[target])}) — ${note}</div>
      ${diceHtml}
    </div>`,
    rolls: diceRoll ? [diceRoll] : [],
    sound: diceRoll ? CONFIG.sounds.dice : null
  }, game.settings.get("core", "rollMode")));
}

/**
 * Пилюля потери части тела (wdbc-1rno.6, по сторонам — wdbc-x1nz.2.100):
 * на стороне попадания (или первой целой), с таймером Гангрены обрубка
 * (T.b дней, иначе 80%). Кровотечение — своей пилюлей рядом. Потерянная
 * кисть/рука роняет то, что держала (кисть — кроме закреплённого на
 * запястье и щита: его пристёгивают к обрубку).
 */
async function applyLimbLossPill(actor, { key, side }) {
  const def = CONDITIONS_DEF[key];
  if (isImmuneToCondition(actor, key, isItemActive)) return;
  const bodySide = pickLostSide(actor.system, key, sideOfLimb(side));
  if (!bodySide) {
    ui.notifications?.warn(`${actor.name}: «${def.label}» — обе уже потеряны.`);
    return;
  }
  await actor.update(lostSideFields(key, bodySide, {
    timer: true, worldTime: game.time?.worldTime ?? 0, tb: Number(actor.system?.characteristics?.t?.bonus) || 0
  }));
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Крит-эффект → ${esc(actor.name)}</div>
      <div class="roll-threshold">${def.svg || def.icon} <b>${esc(def.label)}</b> (${BODY_SIDE_SHORT[bodySide]}) — обрубок нужно обработать (Medicae−10) за T.b дн., иначе 80% Гангрены</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
  if (key === "lostHands" || key === "lostArms")
    await dropFromHand(actor, bodySide, { wrist: key === "lostArms", reason: key === "lostArms" ? "рука потеряна" : "кисть потеряна" });
}
