// module/rules/sigillite-runes.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РУНЫ СИГИЛЛИТОВ (wdbc-fsl9) — экономика ресурса Элитного Архетипа
//  «Последователь Ордена Сигиллитов» (DoomBC — Психокеры-Жабы, стр. 101-102).
//
//  Книга дословно (packs-src/books/toad-psykers.json, entry «Последователь
//  Ордена Сигиллитов»):
//    • «В начале своего хода псайкер получает бPR рун и еще по +1 за каждую
//      ступень в навыке Forbidden Lore (Archeotech) вплоть до +5 за +30 в
//      навыке и Mastery»;
//    • «У персонажа может быть максимум 20 рун»;
//    • «В начале боя персонаж стартует с бPR рун»;
//    • «манифестировать любую известную ему руну, тратя на ее манифестацию
//      бPR психосилы×2 Рун»;
//    • Rune Library: «увеличивает максимальный лимит рун на +I.b и еще на +1
//      за каждую ступень навыка Forbidden Lore (Archeotech). Этот талант можно
//      взять до 3 раз»;
//    • Rune Calculator: «При наступлении первого хода псайкера в бою он
//      получает дополнительно +I.b рун. Этот талант можно взять до 3 раз»;
//    • Rune Strike: «может потратить дополнительно четыре руны, добавив ей
//      +1 эPR… Персонаж может тратить руны несколько раз… если манифестация
//      была провальной, псайкер может вернуть I.b рун».
//
//  ── ПОЧЕМУ ЧИСЛО НА АКТОРЕ, А НЕ «СОСТОЯНИЕ» (Condition) ──────────────────
//  Подсказка владельца была «сделать Руны накапливаемым Состоянием». Формат
//  Состояния в этой системе такого не выражает, и это не вкусовое различие —
//  шесть конкретных мест:
//    1. в записи реестра (constants/conditions.mjs, typedef ConditionDef)
//       нет поля под МАКСИМУМ вовсе; `counter` задаёт только ВИД счётчика
//       ("level"|"rounds"|"count"), из него строится ровно ОДНО числовое поле
//       (COUNTER_SUFFIX, conditions.mjs) — второго, под потолок, взяться
//       неоткуда;
//    2. схема строит Состояние плоско: `bool` + опциональное `num` без min/max
//       (data/actor/_creature.mjs, цикл по CONDITION_STORED_KEYS). Пул —
//       ДРУГАЯ, отдельно заведённая форма: `pool = { value, max }`;
//    3. пересчёт листа (rules/character.mjs) считает максимумы только пулам
//       (fate.max, deadMight.max, fatigue.max, sanity.max); Состояния он
//       трогает лишь булевыми ветками — слота «пересчитать потолок
//       Состояния» в конвейере нет;
//    4. Талант не может поднять счётчик Состояния: Конструктор `kind:"poolMax"`
//       знает закрытый список из двух целей (apps/mechanics.mjs), а прямой
//       ActiveEffect отсекается белым списком путей (constants/effect-keys.mjs)
//       — `system.conditions.*` в нём нет;
//    5. запись `kind:"condition"` описывает СОБЫТИЕ (наложить/снять/иммунитет/
//       смягчить), а не запас: `condLevel` пишется разово при наложении;
//    6. булев флаг рулит тегом: потратил все Руны → `runes:false` → тег
//       пропал с листа и значок с токена. «0 из 20» обязан оставаться видимым.
//  Поэтому Руны — пул `system.sigilliteRunes = {value, max}` по образцу
//  «Мёртвого Могущества» Иннари и Очков Боли Друкхари, а максимум считается
//  производно в rules/character.mjs — там же, где «Бездонная Душа» уже
//  поднимает максимум Боли подсчётом взятий Таланта.
//
//  ── ПОЧЕМУ ТАЛАНТЫ ЧИТАЮТСЯ, А НЕ ЗАШИТЫ ─────────────────────────────────
//  Числа Талантов берутся с АКТОРА на лету: доступ к самому Пути — возможность
//  `psychicPath.sigillites.runeMagic` (constants/capabilities.mjs), выдаётся
//  Чертой через Конструктор; вклад Rune Library/Rune Calculator считается
//  подсчётом взятий Таланта по имени, ровно как «Бездонная Душа»
//  (rules/character.mjs). Нет Черты — нет ни одного из этих чисел, и ни один
//  псайкер без неё не видит в своём тесте ни единого изменения.
//
//  Модуль чистый: ни `game`, ни `ui`, ни бросков — только актор-литерал.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { rankIndex } from "./req-atom.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { PSY_DISCIPLINES } from "../constants/disciplines.mjs";
import { woundLossUpdates } from "./wounds.mjs";

/** Базовый потолок Рун из книги: «У персонажа может быть максимум 20 рун». */
export const RUNE_BASE_MAX = 20;

/** «вплоть до +5 за +30 в навыке и Mastery» — потолок вклада ступеней. */
export const ARCHEOTECH_STEP_CAP = 5;

/** Rune Strike: «потратить дополнительно четыре руны, добавив ей +1 эPR». */
export const RUNE_STRIKE_COST = 4;

/** Оба «до 3 раз» талантов ветки. */
export const TALENT_TAKE_CAP = 3;

/** Возможность, которой открывается вся ветка (выдаётся Чертой Сигиллитов). */
export const RUNE_MAGIC_FLAG = "psychicPath.sigillites.runeMagic";

/** Возможность Таланта «Prepared Rune / Заготовленная Руна» (wdbc-p2it). */
export const PREPARED_RUNE_FLAG = "rune.sigillites.prepared";

const num = v => Number(v) || 0;

/**
 * Владеет ли актор Путём Силы «Руны Сигиллитов».
 *
 * ЕДИНСТВЕННЫЙ гейт всей подсистемы: и лист, и окно манифестации, и хуки
 * начала Хода/боя спрашивают только его. Персонаж без Черты не получает ни
 * пула, ни строки в карточке, ни лишнего поля в диалоге — общий конвейер
 * психосил для него не меняется ни на символ.
 */
export function hasRuneMagic(actor) {
  return hasRuleFlag(actor, RUNE_MAGIC_FLAG);
}

/** Бонус Характеристики (I.b — Интеллект: книга пишет «I 40», «I.b»). */
function charBonus(actor, key) {
  return num(actor?.system?.characteristics?.[key]?.bonus);
}

/** Сколько раз взят Талант с таким именем (двуязычно), не больше `cap`. */
export function talentTakes(actor, names, cap = TALENT_TAKE_CAP) {
  const items = actor?.items ?? [];
  let n = 0;
  for (const item of items) {
    if (item?.type !== "talent") continue;
    if (names.some(w => itemHasName(item, w))) n++;
  }
  return Math.min(cap, n);
}

/**
 * Ступени навыка Forbidden Lore (Archeotech): 0…5.
 *
 * Шкала рангов системы (rules/req-atom.mjs) — untrained/knows/trained/veteran/
 * expert, то есть «Знает/+10/+20/+30» дают 1…4. Пятую ступень книга называет
 * Mastery, и в этой системе Mastery — не ранг, а Талант с привязкой к навыку
 * (constants/advancement.mjs, DYNAMIC_APT_TALENTS). Поэтому пятая ступень
 * ищется среди Талантов, а не среди рангов, и только вместе с +30: книга
 * говорит «+5 за +30 в навыке И Mastery».
 */
export function archeotechSteps(actor) {
  const list = actor?.system?.groupSkills?.forbiddenLore;
  const entries = Array.isArray(list) ? list : [];
  let best = 0;
  for (const e of entries) {
    if (!isArcheotech(e)) continue;
    best = Math.max(best, rankIndex(e?.rank));
  }
  if (best <= 0) return 0;
  const mastery = best >= 4 && hasArcheotechMastery(actor) ? 1 : 0;
  return Math.min(ARCHEOTECH_STEP_CAP, best + mastery);
}

/** Запись Группы Навыков — это Archeotech? Ключ или подпись, любым языком. */
function isArcheotech(entry) {
  if (String(entry?.specKey || "").trim() === "archeotech") return true;
  return /archeotech|археотех/i.test(String(entry?.specialty || entry?.name || ""));
}

/**
 * Есть ли у актора Талант «Mastery / Мастерство», привязанный к Археотеху.
 *
 * Специализация Таланта — свободная строка («Forbidden Lore (Archeotech)»),
 * ключа там нет, поэтому сверка текстовая и намеренно широкая: ложный
 * отрицательный (не узнали привязку) отнимает у игрока законную ступень
 * молча, ложный положительный виден в числе на листе и правится.
 */
function hasArcheotechMastery(actor) {
  for (const item of actor?.items ?? []) {
    if (item?.type !== "talent") continue;
    if (!itemHasName(item, "Mastery") && !itemHasName(item, "Мастерство")) continue;
    const spec = String(item?.system?.specialization || "");
    if (/archeotech|археотех/i.test(spec)) return true;
  }
  return false;
}

/**
 * Максимум Рун: 20 + за каждое взятие Rune Library (до 3) «+I.b и ещё +1 за
 * каждую ступень Forbidden Lore (Archeotech)».
 *
 * Про потолок ступеней в тексте Библиотеки Рун оговорки нет — берём ту же
 * `archeotechSteps`, у которой потолок 5 и так совпадает с числом ступеней
 * шкалы: разойтись эти два счёта не должны.
 */
export function runeMax(actor) {
  if (!hasRuneMagic(actor)) return 0;
  const library = talentTakes(actor, ["Rune Library", "Библиотека Рун"]);
  const per = charBonus(actor, "int") + archeotechSteps(actor);
  return RUNE_BASE_MAX + library * per;
}

/** «В начале своего хода псайкер получает бPR рун и еще по +1 за ступень». */
export function runeGainPerTurn(actor) {
  if (!hasRuneMagic(actor)) return 0;
  return num(actor?.system?.psyker?.rating) + archeotechSteps(actor);
}

/** «В начале боя персонаж стартует с бPR рун» — не прибавка, а установка. */
export function runeStartOfCombat(actor) {
  if (!hasRuneMagic(actor)) return 0;
  return Math.min(num(actor?.system?.psyker?.rating), runeMax(actor));
}

/**
 * Rune Calculator: «При наступлении первого хода псайкера в бою он получает
 * дополнительно +I.b рун», до 3 взятий.
 */
export function runeCalculatorBonus(actor) {
  if (!hasRuneMagic(actor)) return 0;
  return talentTakes(actor, ["Rune Calculator", "Вычислитель Рун"]) * charBonus(actor, "int");
}

// ════════════════════════════════════════════════════════════════════════════
//  ЗАГОТОВЛЕННАЯ РУНА (wdbc-p2it) — «Prepared Rune» (стр. 101-102 книги):
//  «В начале боя персонаж может выбрать одну руну, чья стоимость сотворения в
//  первый раз падает на I.b персонажа, но не ниже 1».
//
//  Состояние НА БОЙ (какая Руна выбрана, была ли уже её первая манифестация)
//  хранится флагом на АКТОРЕ — не полем на психосиле (та Руна и так уже несёт
//  СВОЁ отдельное состояние `runeLearned`, wdbc-exjp, и это разные вещи:
//  «изучена вообще» переживает бои, «выбрана и ещё не использована в ЭТОМ
//  бою» — нет).
//
//  Выбор делает и «уже использована» сбрасывает module/rules/
//  sigillite-runes-combat.mjs::processPreparedRuneCombatStart — явной
//  перезаписью флага в начале Encounter-а (тот же приём, что у Witch's Edge,
//  module/combat/witchs-edge.mjs), а НЕ сравнением с id боя через
//  rules/cooldown.mjs: тот принцип трогает `game.combat`, а этот модуль
//  обязан оставаться чистым (см. заголовок файла) — сравнение живёт в
//  sigillite-runes-combat.mjs, здесь только чтение/запись плоского флага.
// ════════════════════════════════════════════════════════════════════════════

const PREPARED_RUNE_FLAG_SCOPE = "warhammer-dbc";
const PREPARED_RUNE_FLAG_KEY   = "preparedRune";

/** Id психосилы, выбранной Заготовленной Руной на текущий бой — или null. */
export function preparedRuneChoiceId(actor) {
  return actor?.getFlag?.(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY)?.itemId ?? null;
}

/** Состоялась ли уже первая манифестация выбранной Руны в этом бою. */
export function isPreparedRuneUsed(actor) {
  return !!actor?.getFlag?.(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY)?.used;
}

/**
 * Скидка к цене манифестации ИМЕННО этой психосилы прямо сейчас: I.b, но
 * только когда разом верно всё — есть Талант, эта Руна выбрана на текущий
 * бой, и первая манифестация в этом бою ещё не потрачена. Иначе 0 — цена не
 * меняется, и вызывающему не нужно знать причину (нет Таланта / выбрана
 * другая Руна / скидка уже использована — снаружи это одно и то же «нет»).
 */
export function preparedRuneDiscount(actor, item) {
  if (!hasRuleFlag(actor, PREPARED_RUNE_FLAG)) return 0;
  if (!item?.id || preparedRuneChoiceId(actor) !== item.id) return 0;
  if (isPreparedRuneUsed(actor)) return 0;
  return charBonus(actor, "int");
}

/**
 * Отмечает выбранную Заготовленную Руну потраченной на этот бой — вызывать
 * РОВНО тогда, когда скидка реально применилась к списанию (tabs/psychic.mjs
 * ::executePsychotest), а не при каждом открытии окна манифестации: диалог
 * может быть отменён, и списание в долг раньше самого броска не наступает.
 */
export async function markPreparedRuneUsed(actor) {
  const current = actor?.getFlag?.(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY);
  if (!current?.itemId || !actor?.setFlag) return;
  await actor.setFlag(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY, { ...current, used: true });
}

/**
 * Цена манифестации: «бPR психосилы × 2 Руны».
 *
 * «бPR психосилы» — требуемый Пси-Рейтинг самой силы (`system.prRequired`), а
 * не текущий рейтинг псайкера: соседним предложением книга называет тем же
 * оборотом «минимально требуемый бPR, указанный в требованиях психосилы».
 * Минимум 2 (сила с prRequired 0 всё равно стоит одну «пару»).
 *
 * `actor` необязателен: без него (как во всех старых вызовах) скидка
 * Заготовленной Руны не считается вовсе — тот же приём, что у прочих функций
 * файла, которым актор не всегда нужен.
 */
export function runeCostForPower(power, actor = null) {
  const pr = Math.max(1, num(power?.system?.prRequired));
  const base = pr * 2;
  const discount = preparedRuneDiscount(actor, power);
  return discount > 0 ? Math.max(1, base - discount) : base;
}

/** Полная цена манифестации с учётом Рунного Удара (0…N дополнительных эPR). */
export function runeCostTotal(power, runeStrike = 0, actor = null) {
  return runeCostForPower(power, actor) + Math.max(0, Math.trunc(num(runeStrike))) * RUNE_STRIKE_COST;
}

/** Сколько дополнительных эPR может позволить себе актор прямо сейчас. */
export function runeStrikeMax(actor, power) {
  if (!hasRuneMagic(actor) || !talentTakes(actor, ["Rune Strike", "Рунный Удар"], 1)) return 0;
  const left = runeValue(actor) - runeCostForPower(power, actor);
  return left > 0 ? Math.floor(left / RUNE_STRIKE_COST) : 0;
}

/** Rune Strike, провал: «псайкер может вернуть I.b рун». */
export function runeStrikeRefund(actor) {
  return charBonus(actor, "int");
}

/** Текущее число Рун на акторе. */
export function runeValue(actor) {
  return num(actor?.system?.sigilliteRunes?.value);
}

/**
 * Обновление пула после начисления/траты, с зажимом в 0…max.
 * Возвращает `null`, когда менять нечего — чтобы не звать `actor.update`
 * впустую на каждый Ход каждого псайкера.
 */
export function runeUpdate(actor, delta, { set = null } = {}) {
  if (!hasRuneMagic(actor)) return null;
  const max = runeMax(actor);
  const cur = runeValue(actor);
  const raw = set === null ? cur + num(delta) : num(set);
  const next = Math.max(0, Math.min(max, raw));
  if (next === cur) return null;
  return { "system.sigilliteRunes.value": next };
}

// ════════════════════════════════════════════════════════════════════════════
//  ИЗУЧЕННЫЕ РУНЫ (wdbc-exjp) — «Псайкер получает возможность изучить Руну
//  любой психосилы, кроме Божественных и Либрариума, за 50 опыта… Чтобы
//  изучить руну псайкер должен иметь минимально требуемый бPR, указанный в
//  требованиях психосилы» (стр. 101-102).
//
//  Руна привязана к КОНКРЕТНОЙ психосиле — хранится полем на самом предмете
//  психосилы (item.system.runeLearned/runeLearnCost, data/item/psychic-power.mjs),
//  не списком на акторе: это та же форма, что isSustained/sustainedDegree
//  чуть выше по конвейеру (tabs/psychic.mjs), и она переживает удаление ЧУЖИХ
//  психосил без побочных эффектов — список на акторе пришлось бы чистить
//  отдельным хуком deleteItem (как это уже сделано для eliteArchetype в
//  apps/elite-buy.mjs), а так удалённый предмет уносит свою Руну сам.
//
//  Без Черты «Магия Сигиллитов» это поле никем не читается — Путь без Черты
//  недоступен для выбора вовсе (constants/psyker.mjs, PSY_PATHS.sigillite.flag),
//  и до манифестации через него дело не доходит.
// ════════════════════════════════════════════════════════════════════════════

/** «за 50 опыта» — базовая цена изучения одной Руны. */
export const RUNE_LEARN_COST = 50;

/** Prometheus Fire: «изучение таких рун требует на +50 опыта больше». */
export const RUNE_LEARN_FORBIDDEN_EXTRA = 50;

/** Improvised Rune: «1 непоглощаемого R Dmg в руку» — прямая потеря Раны. */
export const IMPROVISED_RUNE_WOUND_COST = 1;

/** Improvised Rune: «1 урона в S, A и W» — по каждой из трёх сразу. */
export const IMPROVISED_RUNE_CHAR_DAMAGE = 1;
export const IMPROVISED_RUNE_CHARS = ["s", "ag", "wp"];

/** Возможности двух зависимых Талантов (constants/capabilities.mjs). */
export const IMPROVISED_RUNE_FLAG = "rune.sigillites.improvised";
export const PROMETHEUS_FIRE_FLAG = "rune.sigillites.prometheusFire";

/** Изучена ли Руна ИМЕННО этой психосилы. */
export function isRuneLearned(item) {
  return !!item?.system?.runeLearned;
}

/**
 * «кроме Божественных и Либрариума» — дисциплины, чью Руну нельзя изучить без
 * Prometheus Fire. Божественные — группа "Божественные" реестра дисциплин
 * (Слаанеш/Нургл/Тзинч, constants/disciplines.mjs); Либрариум — своя
 * дисциплина того же реестра (психосилы Астартес-Библиотекариев).
 */
export function isForbiddenRuneDiscipline(item) {
  const key = item?.system?.discipline;
  if (!key) return false;
  if (key === "librarium") return true;
  return PSY_DISCIPLINES[key]?.group === "Божественные";
}

/** Improvised Rune: можно манифестировать даже неизученные Руны — ценой урона. */
export function hasImprovisedRune(actor) {
  return hasRuleFlag(actor, IMPROVISED_RUNE_FLAG);
}

/** Prometheus Fire: снимает запрет на Руны Божественных психосил/Либрариума. */
export function hasPrometheusFire(actor) {
  return hasRuleFlag(actor, PROMETHEUS_FIRE_FLAG);
}

/**
 * Условия и цена изучения Руны конкретной психосилы для конкретного актора.
 *
 * @returns {{cost:number, forbidden:boolean, allowed:boolean, prBlocked:boolean}}
 *   cost      — сколько опыта спишется (50, либо 100 с Prometheus Fire);
 *   forbidden — сила из Божественной дисциплины/Либрариума (нужен Prometheus Fire);
 *   allowed   — можно ли вообще изучить эту Руну (forbidden без Prometheus Fire — нет);
 *   prBlocked — «должен иметь минимально требуемый бPR» ещё не выполнено —
 *               это ВОПРОС (как нехватка опыта у Элитного архетипа,
 *               apps/elite-buy.mjs), а не жёсткий запрет: за столом бывает
 *               «ГМ разрешил исключение».
 */
export function runeLearnInfo(actor, item) {
  const forbidden = isForbiddenRuneDiscipline(item);
  const prometheus = hasPrometheusFire(actor);
  const allowed = !forbidden || prometheus;
  const cost = RUNE_LEARN_COST + ((forbidden && prometheus) ? RUNE_LEARN_FORBIDDEN_EXTRA : 0);
  const prBlocked = num(actor?.system?.psyker?.rating) < Math.max(0, num(item?.system?.prRequired));
  return { cost, forbidden, allowed, prBlocked };
}

/**
 * Патч для actor.update(): цена «сымпровизированной» манифестации ещё не
 * изученной Руны (Талант Improvised Rune) — 1 непоглощаемая Рана + 1 урона
 * разом в S, A и W (`system.charDamage.*` — тот же знаковый ручной модификатор
 * характеристики, что и у Гангрены, combat/gangrene.mjs). «Непоглощаемый» —
 * про броню/ТБ: этот урон приходит не боевым попаданием, а woundLossUpdates
 * применяется к нему как к уже готовому, непоглощённому числу Ран — армия/ТБ
 * тут в принципе не участвуют. Аблативный пул (щит из жира/AP) книга не
 * освобождает — та же общая арифметика Ран, что и у прочих прямых списаний
 * этого файла (см. PATH.woundCost выше по конвейеру, tabs/psychic.mjs).
 *
 * «восстанавливает 1 за 8 часов, не лечится психосилами/судьбой/бесчестия/
 * медитацией» — НЕ смоделировано: в системе нет вообще ни одного авто-
 * восстановления system.charDamage.* (см. combat/gangrene.mjs) — этому темпу
 * сейчас нечему противоречить, лечить эти минус-очки, кроме ручной правки
 * игроком поля «Мод.», всё равно нечем ни у одного источника такого урона.
 */
export function improvisedRuneCostUpdates(actor) {
  const updates = woundLossUpdates(actor.system, IMPROVISED_RUNE_WOUND_COST);
  for (const key of IMPROVISED_RUNE_CHARS) {
    const cur = num(actor?.system?.charDamage?.[key]);
    updates[`system.charDamage.${key}`] = cur - IMPROVISED_RUNE_CHAR_DAMAGE;
  }
  return updates;
}
