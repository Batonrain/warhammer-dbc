// module/rules/predicates.mjs
//
// Реестр условий (`when`) для правил. Каждый предикат — чистая функция
// (actor, ctx, value) => boolean. Ни обращений к game/ui/canvas, ни бросков:
// иначе правило не проверить тестом без запуска Foundry, а ради этого всё и
// затевалось. Формат записи — docs/rules-format.md.

import { actorFactionKeys, anySameOrDescendant, isSameOrDescendant, getFactionIndex }
  from "./factions.mjs";
import { raceMatches } from "./race.mjs";

/** Значение условия к списку: строка считается списком из одного элемента. */
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

const norm = s => String(s ?? "").trim().toLowerCase();

/**
 * Имена Талантов и Черт в системе двуязычные: «Gene-Seed / Геносемя».
 * Сравниваем по любой половине; специализация в скобках на конце
 * («Resistance (Cold)») при сравнении отбрасывается.
 *
 * Тем же сравнением область `power:<имя>` находит психосилу
 * (rules/resolve-test.mjs): имена сил двуязычны ровно так же, и правило «у
 * астартес Порицание бьёт иначе» не должно зависеть от того, какой половиной
 * имени его записали.
 */
export function itemHasName(item, wanted) {
  const w = norm(wanted);
  if (!w) return false;
  return nameForms(item).includes(w);
}

/** Специализация в скобках на конце: «Resistance (Cold)» → «Resistance». */
const SPEC_TAIL = /\s*\([^)]*\)\s*$/;

/**
 * Все формы имени предмета, по которым он опознаётся: каждая половина
 * двуязычного имени, плюс та же половина без специализации в скобках.
 *
 * Разбор кэшируется НА САМОМ ПРЕДМЕТЕ (wdbc-uvap). Причина — не сама функция,
 * а число вызовов: 57 Талантов опознаются по литеральному имени (wdbc-iadw),
 * и каждый вопрос заново приводил имя каждого предмета к нижнему регистру,
 * резал по «/» и гонял регулярку. В профиле пересчёта листа (node --cpu-prof,
 * актор на 120 предметов) на это уходила треть всего времени.
 *
 * Ключ кэша — сам объект предмета, а годность проверяется по СЫРОМУ имени:
 * переименовали предмет — разбор пересчитывается тут же. Иначе правка имени в
 * компендиуме «применялась бы через раз», а это ровно тот класс молчаливых
 * поломок, против которого весь wdbc-iadw.
 *
 * WeakMap, а не поле на предмете: предмет бывает и живым документом Foundry
 * (чужое поле на нём — лишняя запись в данные), и сырым объектом из packs-src.
 */
const NAME_FORMS = new WeakMap();

function nameForms(item) {
  const raw = item?.name;
  // Предмет без имени (или вовсе без предмета) не совпадает ни с чем — и в
  // кэш его класть не за что.
  if (typeof raw !== "string" || !raw) return [];

  const hit = NAME_FORMS.get(item);
  if (hit && hit.raw === raw) return hit.forms;

  const forms = [];
  for (const part of norm(raw).split("/")) {
    const p = part.trim();
    if (p && !forms.includes(p)) forms.push(p);
    const bare = p.replace(SPEC_TAIL, "").trim();
    if (bare && !forms.includes(bare)) forms.push(bare);
  }
  NAME_FORMS.set(item, { raw, forms });
  return forms;
}

/**
 * Есть ли у актора Талант или Черта с каждым из перечисленных имён.
 *
 * Список означает «и», а не «или»: правило с двумя вариантами записывается
 * двумя правилами, а вот требование двух Талантов сразу иначе не выразить.
 *
 * Типы «talent», «trait» и «mutation» намеренно не разделяются — так же
 * ведёт себя разборщик требований талантов (constants/talent-requirements.mjs),
 * и правило не должно молча не сработать из-за того, что содержимое записано
 * Чертой. «mutation» добавлен для targetHasTrait (wdbc-1rno) — Дары Богов
 * записаны тем же типом предмета, что и общие Мутации (system.god), находки
 * вида «противник ПРОТИВ персонажа с Мутацией/Даром X» иначе не матчились бы.
 */
function hasNamed(actor, names) {
  const items = [...(actor?.items ?? [])];
  return list(names).every(name => items.some(
    i => (i?.type === "talent" || i?.type === "trait" || i?.type === "mutation") && itemHasName(i, name)));
}

/**
 * Итоговый Размер актора: базовый `system.size` плюс вклад Черт `system.sizeMod`.
 * Лист кладёт сумму в `system.sizeTotal` (documents/actor.mjs), но у подставного
 * актора в тесте её может не быть, поэтому считаем сами.
 *
 * Экспортирована: тем же способом читает Размер cor.sizeToHit/core.sizeStealth
 * (rules/resolve-test.mjs, valueFrom.targetSize/selfSize) — второй копии
 * формулы заводить не стали.
 */
export function sizeOf(actor) {
  const sys = actor?.system ?? {};
  if (sys.sizeTotal != null) return Number(sys.sizeTotal) || 0;
  return (Number(sys.size) || 0) + (Number(sys.sizeMod) || 0) + (Number(sys.sizeModNoSpd) || 0);
}

// Силовая/аспектная броня — то же множество, что POWER_ARMOR_TYPES в
// combat/armor-mods.mjs; не импортируем оттуда, чтобы rules/ не тянуло
// зависимость на combat/ (предикаты обязаны жить без Foundry, а armor-mods.mjs
// уже завязан на живой актор).
const POWER_ARMOUR_TYPES = new Set(["power", "aspect"]);

function wearsPowerArmour(actor) {
  return (actor?.items ?? []).some(i =>
    i?.type === "armor" && i?.system?.equipped && POWER_ARMOUR_TYPES.has(i?.system?.armorType));
}

/**
 * Носит ли актор хоть один надетый предмет брони со свойством «Sealed /
 * Закрытая» (ARMOR_PROPERTIES.sealed, constants/items.mjs — «Защита от химии
 * на коже»). Свойства брони хранятся как плоский массив строк-ключей
 * (system.properties, в отличие от оружия — без рейтинга, см.
 * combat/armor-properties.mjs::resolveArmorProps), здесь читаются напрямую
 * без импорта того модуля — тот уже завязан на combat/, а предикаты обязаны
 * жить без Foundry (см. комментарий у wearsPowerArmour выше).
 */
function wearsSealedArmour(actor) {
  return (actor?.items ?? []).some(i =>
    i?.type === "armor" && i?.system?.equipped &&
    (i?.system?.properties ?? []).includes("sealed"));
}

/**
 * Сус-ан Мембрана — орган Геносемени Гвардии Ворона/Призраков Смерти
 * (wdbc-l07y, дубль был в rules/death-save.mjs и apps/sus-an-heal.mjs).
 * Русская половина в паке несёт книжный номер («12. Сус-ан Мембрана /
 * Sus-an Membrane») — itemHasName сравнивает половины ЦЕЛИКОМ, поэтому номер
 * сломал бы совпадение по русской половине; проверяем обе половины
 * отдельно, а не одну надёжную (английскую) — старые фикстуры тестов и
 * возможные ручные записи без номера остаются рабочими.
 */
export function isSusAnMembraneItem(item) {
  return item?.type === "implant" &&
    (itemHasName(item, "Сус-ан Мембрана") || itemHasName(item, "Sus-an Membrane"));
}

/**
 * Оглушение ИЛИ Ступор (wdbc-r5o7.3) — не два отдельных условия, а один
 * читатель: книга прямо называет Ступор «Оглушённой целью для прочих
 * эффектов» (стр. 30-31), поэтому любой код, спрашивающий «Оглушён ли
 * актор», обязан спрашивать это, а не только conditions.stunned (иначе
 * список расходится с книгой при первой же новой проверке). Плоская
 * функция, не запись PREDICATES — оба читателя (action-economy.mjs,
 * attack-dialog.mjs) вне конвейера правил `when`/rollBonus.
 */
export function isStunnedOrDazed(actor) {
  const c = actor?.system?.conditions;
  return !!(c?.stunned || c?.dazed);
}

/**
 * Ослеплён — сам флаг ИЛИ производное от Потери глаз: «Без обоих глаз
 * персонаж Ослеплён» (стр. 30-31, wdbc-r5o7.4). Считается на лету, а не
 * отдельной проставленной галочкой — иначе два поля разъедутся при первой
 * же ручной правке conditions.lostEyesCount (тот же принцип, что
 * isStunnedOrDazed выше).
 */
export function isBlindedActor(actor) {
  const c = actor?.system?.conditions;
  return !!(c?.blinded || (Number(c?.lostEyesCount) || 0) >= 2);
}

/** Хирургически установленный (не просто лежащий в инвентаре) имплант с этим именем. */
function hasInstalledImplant(actor, name) {
  return (actor?.items ?? []).some(i => i?.type === "implant" && itemHasName(i, name) &&
    i?.flags?.["warhammer-dbc"]?.installed && !i?.flags?.["warhammer-dbc"]?.disabled);
}

/**
 * Состоит ли актор в каждой из перечисленных фракций — считая нижестоящие.
 * Персонаж из III роты Несущих Слово подходит под условие «Хаос».
 *
 * Список означает «и», как у hasTalent/hasTrait: правило с альтернативами
 * пишется двумя правилами, а требование двух принадлежностей сразу иначе не
 * выразить.
 */
function inFactions(actor, wanted) {
  const mine = actorFactionKeys(actor);
  const byKey = getFactionIndex();
  return list(wanted).every(key => anySameOrDescendant(mine, key, byKey));
}

/**
 * Предикаты, которым нужен КОНТЕКСТ БРОСКА, а не один актор: цель, оружие,
 * характеристика теста. Их нельзя спрашивать оттуда, где контекста нет —
 * например из записи Конструктора на предмете (rules/mech-when.mjs): она
 * вычисляется и вне броска, при выдаче и в предпросмотре, и тихий ответ «нет»
 * про несуществующую цель выключал бы механику молча.
 *
 * Список сверяется с кодом тестом (test/rules/when-predicates-bridge.test.mjs):
 * предикат, читающий ctx, обязан быть здесь.
 */
export const CTX_DEPENDENT_PREDICATES = new Set([
  "weaponClass", "charNotIn", "charIn",
  "targetHasTrait", "targetLacksCondition", "targetHasCondition",
  "targetHasSize", "targetKeepsNimbleInArmour", "targetHasFaction",
  "avatarOfSlaughterOffTarget", "hexMarkedPreyAllyBonus"
]);

export const PREDICATES = {
  race:    (actor, ctx, value) => list(value).includes(actor?.system?.race),
  subrace: (actor, ctx, value) => list(value).includes(actor?.system?.subrace),

  // Легион Геносемени (module/constants/legions.mjs, id — римская цифра, "VIII"
  // у Повелителей Ночи). Раса «astartes» одна на всех легионов, поэтому
  // легионные Таланты (папка пикера «Повелители Ночи») не выразить условием
  // `race` — нужен отдельный ключ (item-picker.mjs::talentGroupLock, wdbc-sauo).
  geneSeedLegion: (actor, ctx, value) => list(value).includes(actor?.system?.geneSeed?.legion),

  // Пси-Рейтинг не ниже указанного — общее условие книги (папки пикера
  // «Псайкер»/«Псайкана», wdbc-sauo), было в справочнике нереализованным
  // с самого этапа 1 плана.
  psyRatingMin: (actor, ctx, value) => (Number(actor?.system?.psyker?.rating) || 0) >= Number(value),

  sizeMax: (actor, ctx, value) => sizeOf(actor) <= Number(value),

  // В Ярости (system.inRage, тот же флаг, что читает weapon-properties.mjs
  // для weaponPropertyImmunityInRage) — простой тумблер, не полная механика
  // Ярости (wdbc-wyr3).
  inRage: (actor) => !!actor?.system?.inRage,

  // Носит ли надетую броню со свойством «Sealed / Закрытая» — шестой гейт
  // Механики (when.requireSealedArmour/negateSealedArmour, mech-when.mjs,
  // wdbc-1rno: «без гермодоспеха» у Миазм и подобных).
  wearsSealedArmour,

  // Уровень Ранения (documents/actor.mjs, rules/wound-tier.mjs): healthy/light/
  // heavy/dying, тот же ключ, что подписан в блоке РАНЫ на листе. Список — «в
  // списке», как у race/subrace/weaponClass: правило «Тяжело раненный или
  // хуже» пишется woundTier: ["heavy", "dying"].
  woundTier: (actor, ctx, value) => list(value).includes(actor?.system?.wounds?.tier),

  charMin: (actor, ctx, value) => Object.entries(value ?? {}).every(
    ([key, min]) => (Number(actor?.system?.characteristics?.[key]?.total) || 0) >= min),

  // Бонус характеристики не ниже указанного: charBonusMin: { s: 5 } — «S.b 5
  // и выше». НЕ заменяется на charMin: { s: 50 } (wdbc-vsma): Бонус — это не
  // «полное значение делить на десять», в него идут ступени Unnatural и
  // надбавки эффектов (rules/character.mjs: floor(total/10) + supernatural +
  // bonusFx + Черты и Пути). У Астартес с Unnatural Strength полное значение и
  // Бонус расходятся, и подмена одного другим врала бы именно там, где книга
  // говорит про Бонус чаще всего («требует S.b 5», «Бонус Силы меньше 7»).
  charBonusMin: (actor, ctx, value) => Object.entries(value ?? {}).every(
    ([key, min]) => (Number(actor?.system?.characteristics?.[key]?.bonus) || 0) >= min),

  hasTalent: (actor, ctx, value) => hasNamed(actor, value),
  hasTrait:  (actor, ctx, value) => hasNamed(actor, value),

  weaponClass: (actor, ctx, value) => list(value).includes(ctx?.weapon?.system?.weaponClass),

  // Характеристика ТЕКУЩЕГО теста НЕ входит в список — «для всех тестов,
  // кроме T/Inf/Cor» (Отравление, Усталость, стр. 30-31/33): список — «не
  // любой из», как у targetLacksCondition, отрицание зашито в саму функцию
  // (готового «not» в `when` нет, см. комментарий там). ctx.char пуст у
  // теста без характеристики (напр. чистый Приём) — тогда список ничего не
  // исключает, правило действует.
  charNotIn: (actor, ctx, value) => !list(value).includes((ctx?.char || "").toLowerCase()),

  // Обратное charNotIn — характеристика теста ВХОДИТ в список. Нужен, когда
  // список короче через «входит», чем через «не входит» (Гангрена, стр.
  // 30-31, wdbc-r5o7.5: −20 именно на Int/Per/WP/Fel/Inf, а не «всё, кроме
  // WS/BS/S/T/Ag»). Тест без характеристики — список не включает пустую
  // строку, предикат не срабатывает (симметрично charNotIn).
  charIn: (actor, ctx, value) => list(value).includes((ctx?.char || "").toLowerCase()),

  // Актор цели лежит в ctx.targetActor, а не в ctx.target: в контексте броска
  // (rules/match-context.mjs) имя `target` занято флагом «бросок нацелен», и на
  // этапе 2 плана оба контекста сошлись в одном объекте.
  targetHasTrait: (actor, ctx, value) => hasNamed(ctx?.targetActor, value),

  // Противоположность targetHasTrait по состояниям, не по Чертам: «нет ни
  // одного из перечисленных состояний X» (ключи — CONDITIONS_DEF в
  // constants/conditions.mjs, напр. "stunned"/"helpless"). Список — не «и»,
  // как у hasTalent, а поэлементное «нет», иначе «Оглушён ИЛИ Беспомощен» было
  // бы не выразить одним условием. Нужна как есть, а не через отрицание в
  // данных — `when` в rules/collect.mjs требует ото ВСЕХ условий true разом
  // (AND), готового «not» нет, поэтому отрицание зашито в саму функцию.
  targetLacksCondition: (actor, ctx, value) =>
    list(value).every(key => !ctx?.targetActor?.system?.conditions?.[key]),

  // Пара к targetLacksCondition — но «или», не «и»: у САМОГО актора есть хотя
  // бы одно из перечисленных Состояний (wdbc-r5o7, module/rules/library/
  // conditions.mjs). Список — «Оглушён ИЛИ Ошеломлён» одним условием, как и
  // у targetHasCondition ниже.
  hasCondition: (actor, ctx, value) =>
    list(value).some(key => !!actor?.system?.conditions?.[key]),

  // То же самое, но про цель броска (ctx.targetActor) — «атаки по Поваленной
  // цели» и подобные правила со стороны атакующего.
  targetHasCondition: (actor, ctx, value) =>
    list(value).some(key => !!ctx?.targetActor?.system?.conditions?.[key]),

  // Ненулевой Размер — гейт core.sizeToHit/core.sizeStealth (rules/library/
  // core.mjs): без него строка с «(+0)» лезла бы в чек-лист на каждом броске
  // против обычного человека, а не только там, где Размер реально что-то даёт.
  hasSize:       (actor, ctx) => sizeOf(actor) !== 0,
  targetHasSize: (actor, ctx) => sizeOf(ctx?.targetActor) !== 0,

  // «Позволяет сохранять Трейт Nimble в силовой броне» (имплант «Чёрный
  // Панцирь / Black Carapace», DoomBC — ГЕНОСЕМЯ) — без брони условие не
  // проверяется вовсе, Проворный сам по себе Чёрного Панциря не требует.
  targetKeepsNimbleInArmour: (actor, ctx) => {
    const t = ctx?.targetActor;
    if (!wearsPowerArmour(t)) return true;
    return hasInstalledImplant(t, "Black Carapace");
  },

  // Принадлежность к фракции — своя и у цели. Обе считают нижестоящие: условие
  // «Хаос» подходит и роте в составе его легиона, обратное неверно.
  hasFaction: (actor, ctx, value) => inFactions(actor, value),

  // У социального теста цели-токена нет вовсе: фракцию собеседника игрок
  // выбирает в диалоге, и она приезжает в ctx.socialFaction одним ключом.
  // Поэтому смотрим сначала туда, и только потом на выделенного актора.
  targetHasFaction: (actor, ctx, value) => {
    const byKey = getFactionIndex();
    if (ctx?.socialFaction)
      return list(value).every(key => isSameOrDescendant(ctx.socialFaction, key, byKey));
    return inFactions(ctx?.targetActor, value);
  },

  // Avatar of Slaughter/Аватар Резни (wdbc-sk8s): цель провалила тест W−10
  // против Берсерка → до конца боя −20 на атаки/манёвры, НЕ направленные на
  // него. Метка — на самом акторе (module/combat/avatar-of-slaughter.mjs),
  // читается здесь, а не через cross-actor источник (в отличие от Adjutant):
  // условие целиком про самого актора и то, кого он сейчас атакует.
  avatarOfSlaughterOffTarget: (actor, ctx) => {
    const mark = actor?.getFlag?.("warhammer-dbc", "avatarOfSlaughterMark");
    if (!mark?.berserkerUuid) return false;
    return ctx?.targetActor?.uuid !== mark.berserkerUuid;
  },

  // Hex-Marked Prey/Проклятая Метка (Талант, Шаман Зверолюдей, wdbc-xxb7):
  // «Пока метка активна, все зверолюди-союзники получают +15 на атаки
  // против этой цели.» Метка живёт на ЦЕЛИ (module/combat/
  // beastman-shaman.mjs::applyHexMarkedPrey), поэтому cross-actor чтение —
  // ctx.targetActor, не сам actor (в отличие от avatarOfSlaughterOffTarget
  // выше, где метка на самом акторе). «Зверолюди-союзники» — раса
  // effectiveRace(actor.system)==="beastman" (rules/race.mjs): чистое поле
  // актора, доступное предикату без canvas/disposition.
  //
  // `value` (wdbc-w8z4, god-ответвления): необязательный фильтр по
  // Покровительству, под которым была наложена метка (mark.god). Общий
  // безусловный бонус пишет `when: { hexMarkedPreyAllyBonus: true }` —
  // булево/пустое значение god не фильтрует, ведёт себя как раньше. God-
  // специфичное правило (Кхорн: Proven(3), Нургл: Toxic(1) на попаданиях
  // союзников, rules/library/beastman-shaman.mjs) пишет god строкой:
  // `when: { hexMarkedPreyAllyBonus: "khorne" } }`.
  hexMarkedPreyAllyBonus: (actor, ctx, value) => {
    const mark = ctx?.targetActor?.getFlag?.("warhammer-dbc", "hexMarkedPrey");
    if (!mark) return false;
    if (!raceMatches(actor?.system, "beastman")) return false;
    if (typeof value === "string" && value) return mark.god === value;
    return true;
  }
};

/**
 * Элитный архетип у актора — тремя источниками: строка в шапке
 * (`system.eliteArchetype`), список дополнительных (`eliteArchetypesExtra`)
 * или предмет типа eliteArchetype. Архетип бывает и предметом (куплен
 * пикером), и строкой (вписан руками/со старого листа) — обе формы отпирают
 * одно и то же. Раньше жил копиями в character-context и item-picker.
 *
 * `name` принимает и одну половину («Феларх»), и полное двуязычное имя
 * («Felarch / Феларх»): совпадение любой половины искомого с любой половиной
 * источника достаточно — старые архетипы записаны только русской половиной,
 * новые полным именем, и обе формы встречаются с обеих сторон сверки
 * (wdbc-91o8). Служебный префикс [WIP] у имени при сверке отбрасывается.
 */
export function hasEliteArchetype(actor, name) {
  const wanted = String(name ?? "").split("/").map(s => s.trim()).filter(Boolean);
  if (!wanted.length) return false;
  const sys = actor?.system || {};
  const sources = [
    sys.eliteArchetype,
    ...(sys.eliteArchetypesExtra || []),
    ...[...(actor?.items ?? [])].filter(i => i?.type === "eliteArchetype").map(i => i?.name)
  ].map(n => ({ name: String(n ?? "").replace(/^\[WIP\]\s*/, "") }));
  return wanted.some(w => sources.some(src => itemHasName(src, w)));
}

/**
 * Одержимый (DoomBC_Core 129-132): ручной чекбокс Хаосита ЛИБО Элитный
 * архетип «Одержимый». Один предикат на вкладку листа и на гейт папки
 * «Таланты одержимых» в пикере — иначе вкладка открыта, а Дары не купить.
 */
export function isPossessed(actor) {
  const sys = actor?.system || {};
  return (sys.alignment === "heretic" && !!sys.possessed) || hasEliteArchetype(actor, "Одержимый");
}

/**
 * Дары Одержимого (module/constants/possession.mjs::POSSESSION_GIFTS) —
 * предметы-таланты с двуязычным именем «Английское / Дар: Русское» (wdbc-rc5z).
 * Раньше этот префикс был договором между rules/character.mjs (точное
 * совпадение ВСЕЙ строки имени с «Дар: X» — не срабатывало на реальные
 * бигвальные записи пака) и sheets/tabs/possession.mjs (name.startsWith,
 * та же ошибка — реальное имя начинается с английской половины, не с
 * префикса), закреплён только комментариями в двух местах.
 */
export const GIFT_NAME_PREFIX = "Дар: ";

/** Множество активных имён Даров (без префикса) — предметы-таланты актора. */
export function giftNamesOf(actor) {
  const out = new Set();
  for (const i of actor?.items ?? []) {
    if (i?.type !== "talent") continue;
    for (const part of String(i?.name ?? "").split("/")) {
      const p = part.trim();
      if (p.startsWith(GIFT_NAME_PREFIX)) { out.add(p.slice(GIFT_NAME_PREFIX.length).trim()); break; }
    }
  }
  return out;
}
