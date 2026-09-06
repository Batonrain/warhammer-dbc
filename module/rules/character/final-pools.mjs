// module/rules/character/final-pools.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ХВОСТ ПЕРЕСЧЁТА ЛИСТА: Инициатива, Когниция Техножреца, Энергия Катушки
//  Потенции и Пси-Рейтинг (wdbc-neez).
//
//  Первый раздел, вынесенный из prepareCharacterDerived (1090 строк). Выбран
//  первым не по важности, а по связям: он последний в функции, поэтому ничего
//  из него не читают следующие разделы — вынести его нельзя было сломать
//  порядок вычислений.
//
//  Все четыре величины считаются из уже готовых чисел и ни одного прохода по
//  предметам не делают: то, что приходит аргументами, накоплено разделами выше.
//  Это и есть причина, по которой «один проход по предметам» и «разбиение по
//  разделам» — противоположные требования (см. wdbc-uvap): единый проход
//  связывает разделы общими накопителями, а разбиение их развязывает.
// ════════════════════════════════════════════════════════════════════════════

import { psyRatingFromTalents } from "../psyker.mjs";
import { hasRuleFlag } from "../flags.mjs";
import { initiativeCharKey, fastestHandBonus, initiativeHint,
         INITIATIVE_DEFAULT_CHAR } from "../initiative.mjs";

/**
 * @param {object} actor            актор — для возможностей (hasRuleFlag) и предметов
 * @param {object} system           system актора, правится на месте
 * @param {object} deps
 * @param {object} deps.chars       готовые характеристики (system.characteristics)
 * @param {number} deps.agBonus     бонус Ловкости
 * @param {number} deps.traitInitMod вклад Черт в Инициативу (легаси-петля)
 * @param {number} deps.implantEnergyMax прибавка имплантов к максимуму Энергии
 * @param {number} deps.sustainedCost стоимость поддерживаемых психосил
 * @param {number} deps.implantCompBonus прибавка имплантов к Совместимости
 * @param {boolean} deps.techFocusInstalled установлен ли Техно-Фокус
 */
export function prepareFinalPools(actor, system, { chars, agBonus, traitInitMod,
                                                   implantEnergyMax, sustainedCost,
                                                   implantCompBonus, techFocusInstalled }) {
  // ── Инициатива ────────────────────────────────────────────────────────
  // Хранит Ag.bonus + модификаторы Талантов (Combat Formation, Paranoia).
  // Сам бросок = 1d10 + system.initiative. Читаем текущее значение ДО
  // перезаписи (wdbc-v9a7): kind:"characteristic" с charKey:"initiative"
  // (apps/mechanics.mjs) выдаётся как embedded ActiveEffect с ключом
  // system.initiative, фаза "final" — применяется Foundry раньше этой
  // строки, и без чтения назад перезапись стёрла бы вклад Мутаций
  // («Безголовый» −2) тем же способом, каким раньше терялся sizeMod
  // Астартес (см. комментарий у traitSizeMod выше).
  //
  // Чем считать (Боевое Построение — I.b, Чувство Боя — P.b), сколько раз
  // кидать (Молниеносные Рефлексы, Эльдарское Тело) и надбавка Самой Быстрой
  // Руки живут в module/rules/initiative.mjs (wdbc-7zzr).
  const initChar  = initiativeCharKey(actor, chars);
  const initBonus = initChar === INITIATIVE_DEFAULT_CHAR ? agBonus : (chars[initChar]?.bonus ?? agBonus);
  // На лист кладётся только ПОДСКАЗКА: сам ключ характеристики и число бросков
  // отдельными полями заводить незачем — их спрашивают у rules/initiative.mjs
  // напрямую (так делает боевой трекер, documents/combatant.mjs), а поле,
  // которое никто не читает, со временем начинает врать молча.
  system.initiativeHint  = initiativeHint(actor, chars);
  system.initiative = initBonus + fastestHandBonus(actor, chars)
                    + (traitInitMod || 0) + (Number(system.initiative) || 0);

  // ── Когниция (Техножрец) ───────────────────────────────────────────────
  // Пул Когниции = Int.bonus; в начале Хода восстанавливается ½ Int.b.
  if (system.cognition) {
    const ib = chars.int?.bonus ?? 0;
    system.cognition.max   = ib;
    system.cognition.regen = Math.ceil(ib / 2);
  }

  // ── Энергия (Катушка Потенции) + Техночудеса Кибернетики Механикум ──────
  // energy.max — база (ручной ввод); maxTotal = база + бонусы имплантов
  // (Мотивные Банки +5 и т.п.). Активация/зарядка используют maxTotal.
  if (system.energy) {
    system.energy.bonusMax = implantEnergyMax;
    system.energy.maxTotal = Math.max(0, (system.energy.max || 0) + implantEnergyMax);
    if ((system.energy.value || 0) > system.energy.maxTotal)
      system.energy.value = system.energy.maxTotal;
  }
  // Бонус к тесту Компенсатора (лучший среди имплантов) и установленные
  // Технофокусы (Железо) — для активации Техночудес и показа на листе.
  system.techCompBonus   = implantCompBonus;
  system.techFocus       = techFocusInstalled;

  // ── Пси-Рейтинг ────────────────────────────────────────────────────────
  // Базовый PR — по умолчанию хранимое поле (бестиарий/NPC задают его прямо
  // статблоком, без Таланта). Если на акторе есть Талант «Psy Rating /
  // Пси-Рейтинг» — он замещает хранимое значение, предмет становится
  // источником истины (psyRatingFromTalents в module/rules/psyker.mjs).
  if (system.psyker) {
    const derivedPR = psyRatingFromTalents(actor.items);
    system.psyker.ratingFromTalent = derivedPR !== null;
    if (derivedPR !== null) system.psyker.rating = derivedPR;

    // sustainedCost уже посчитан выше, в общем проходе по actor.items
    // (вместе с autoPsyCost) — тот же item.type "psychicPower".
    // Руническая Вязь «Стальной Гриммуар» (wdbc-unku): снимает штраф −1 эPR
    // за поддержание одной силы. Схема не различает, какая именно сила
    // «вписана» в Гриммуар — прощаем 1 очко суммарной стоимости поддержания
    // в целом (только если что-то вообще поддерживается).
    if (sustainedCost > 0 && hasRuleFlag(actor, "runicWeave.steelGrimoire")) {
      sustainedCost = Math.max(0, sustainedCost - 1);
    }
    system.psyker.sustain       = sustainedCost;
    system.psyker.currentRating = Math.max(0, (system.psyker.rating || 0) - sustainedCost);
    // «Независимо от обстоятельств всегда считается Связанным» (Серый
    // Человек, wdbc-gzuf) — Природа Дара выставляется один раз в чаргене
    // (дропдаун), но здесь пересчитывается каждый цикл, так что ручная
    // смена значения на листе тут же откатывается обратно.
    if (hasRuleFlag(actor, "psyker.alwaysBound")) system.psyker.class = "bound";
  }
}
