// module/rules/hands.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАНЯТОСТЬ РУК (wdbc-3xqh + wdbc-3hxg). Бюджет, а не Л/П-слоты с конфликтами:
//  каждый удерживаемый предмет занимает 0/1/2 руки, актор имеет бюджет из
//  Трейта Multiple Arms (его rating — уже ПОЛНОЕ число рук, не «доп.» — см.
//  apps/cybernetic-excellence.mjs) минус ампутации (system.conditions.lostHands/
//  ArmsCount). Источники правил — корбук, «Типы Стрелкового Оружия» (стр. 171,
//  Пистолет/Метательное 1р, Винтовка/Длинная Винтовка/Тяжёлое 2р, Пусковое 2р
//  по аналогии), «Бой Несколькими Руками» (стр. 32) и хваты рукопашного
//  (GRIPS, constants/combat.mjs).
//
//  Рука конкретного предмета (какая «Р1» у щита, для карточек HUD) — единый
//  флаг heldHand поверх исторических shieldHand/weaponHand (оставлены как
//  фолбэк на чтение, ничего не мигрируем на живых листах).
// ════════════════════════════════════════════════════════════════════════════

import { parseGrips, RANGED_GRIPS } from "../constants/combat.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries, getInstalledMods } from "../combat/weapon-mods.mjs";
import { isHandShield } from "../combat/hand-shield.mjs";
import { isMultipleArmsTrait } from "./cybernetic-excellence.mjs";
import { isFusedByHandOfDeath } from "./hand-of-death.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { isPathOneHandedWeapon } from "./library/paths.mjs";

const NS = "warhammer-dbc";
const BASE_HANDS = 2;

// Хваты рукопашного, занимающие НЕ одну руку (всё, чего здесь нет — 1 рука:
// «1р» и специализированные хваты Об/Бл/Кл/Мх — это способы удержания той
// же одной руки, не отдельный счётчик). Хв/Зуб/Кист/Щуп — части тела
// (хвост/зуб/голый кулак/щупальце-мутация), а не удерживаемое снаряжение,
// поэтому тоже 0: раньше «Хв» был только в GRIPS (боевые модификаторы уже
// применялись), но не в этом списке — Хвост-мутация из-за этого ошибочно
// съедала руку в бюджете (wdbc, отчёт пользователя).
// Когти.Р ("Л", core.json, «Типы Рукопашного Оружия»): «не дают пользоваться
// этой рукой для использования другого оружия и тонкой работы с
// устройствами» — в отличие от Когти.П ("П", на предплечье, ладонь свободна),
// занимает ладонь как обычное держимое оружие. "П+Л" (оба хвата разом, напр.
// Силовой Кулак/Молниевые Когти) тоже покрывает всю ладонь — тем же следствием.
const MELEE_GRIP_HANDS = { "2р": 2, "П": 0, "Л": 1, "П+Л": 1, "Ног": 0, "Гол": 0, "Хв": 0, "Зуб": 0, "Кист": 0, "Щуп": 0 };

// Класс стрелкового → руки (корбук стр. 171), когда у предмета ещё нет своего
// sys.grips (бэкфилл RANGED_GRIPS по паку не завершён, wdbc-3hxg). thrown —
// метательное/гранаты.
const RANGED_CLASS_HANDS = { pistol: 1, thrown: 1, basic: 2, heavy: 2, launcher: 2, stationary: 0 };

/** Текущий хват рукопашного оружия: выбранный в диалоге атаки/HUD, иначе первый из профиля. */
export function currentMeleeGrip(item) {
  // Рука Смерти (wdbc-hftn, стр. 46): срослось с рукой — всегда Стандартный
  // Хват "1р", даже если раньше был другой (Об/Бл/Кл/Мх/Хв) или предмет
  // изначально двуручный. Игнорирует сохранённый hudGrip намеренно.
  if (isFusedByHandOfDeath(item)) return "1р";
  const flagged = item.getFlag?.(NS, "hudGrip");
  if (flagged) return flagged;
  return parseGrips(item.system?.grips)[0] || "1р";
}

/**
 * Хват дальнобойного (wdbc-3hxg, стр. 166): "1р"/"2р" из того же sys.grips,
 * что и рукопашное. Отдача (Recoil X) запрещает "1р" при S.b < X — тот же
 * гейт, что и в attack-dialog.mjs (resolveSelectionSafe), продублирован тут
 * чистой функцией, чтобы не тянуть Foundry-диалог в бюджет рук. Возвращает
 * null, если у предмета нет sys.grips (тогда решает RANGED_CLASS_HANDS).
 */
/**
 * Хваты дальнобойного, ДОСТУПНЫЕ этому актору: собственный sys.grips предмета
 * плюс выданные возможностями. Держится в одном месте с attack-dialog.mjs
 * (extraGrips) намеренно: если бюджет рук не знает про выданный хват, лист
 * запретит взять оружие, которое окно атаки разрешает держать одной рукой.
 *
 * wdbc-2gn (находка 3, ревью 07.09.2026): этот список расходился с
 * attack-dialog.mjs::extraGrips — тот собирает ПЯТЬ источников (modGrantedGrips,
 * commandoGrip, doubleGripGrip, oneHandRifleGrip, pathOneHandGrip), а здесь
 * было только два последних. Игрок ставил модификацию «Pistol Grip» (даёт
 * «1р» через system.effects.grantsGrip установленной weaponMod), выбирал в
 * диалоге атаки «1р» — HUD-флаг записывался, а бюджет рук ниже (не находя
 * этот хват в своём списке) продолжал требовать «2р» и не давал надеть щит
 * во вторую руку. Commando Carbine и Double Grip — тот же класс расхождения,
 * просто до сих пор без жалобы: они «живут в диалоге» только в смысле «дают
 * галочку на бросок», а какую РУКУ они требуют — общий вопрос с бюджетом.
 */
function availableRangedGrips(item, actor, auto) {
  const own = parseGrips(item.system?.grips).filter(k => RANGED_GRIPS[k]);
  const extra = [];
  const addExtra = key => { if (RANGED_GRIPS[key] && !own.includes(key) && !extra.includes(key)) extra.push(key); };
  // Хват от модификации (Pistol Grip и подобные, wdbc-8vp1): system.effects.
  // grantsGrip установленной weaponMod — то же поле, что читает attack-dialog.mjs
  // (modGrantedGrips).
  for (const mod of getInstalledMods(actor, item)) addExtra(mod.system?.effects?.grantsGrip);
  // Commando/Коммандо (wdbc-eduq): карабин держат одной рукой, как пистолет.
  if (auto?.carbine && hasRuleFlag(actor, "weapon.commandoCarbine")) addExtra("1р");
  // Double Grip/Двуручный хват пистолета (wdbc-mu6v): пистолет двумя руками.
  if (item.system?.weaponClass === "pistol" && hasRuleFlag(actor, "weapon.doubleGripPistol")) addExtra("2р");
  // Откатная Перчатка / Подавители Отдачи / Рука-Пушка: винтовку (класс basic —
  // в нём и «Винтовка», и «Длинная Винтовка», стр. 171) можно держать одной
  // рукой (wdbc-f7iw, wdbc-6tzk).
  if (item.system?.weaponClass === "basic" && hasRuleFlag(actor, "weapon.oneHandedRifle")) addExtra("1р");
  // Стрела Кхейна у адепта Пути Воина уровня Следующий (wdbc-4e60) — тот же
  // список читает окно атаки; расходиться этим двум местам нельзя.
  if (isPathOneHandedWeapon(item) && hasRuleFlag(actor, "weapon.oneHandedWarriorPath")) addExtra("1р");
  return [...own, ...extra];
}

/**
 * Свойства оружия С УЧЁТОМ УСТАНОВЛЕННЫХ МОДИФИКАЦИЙ (wdbc-9dg8).
 *
 * Раньше здесь стояла resolveWeaponProps — «свойства самого предмета, без
 * модификаций», и бюджет рук оказался единственным потребителем свойств,
 * который смотрел мимо модификаций (остальные пять — attack.mjs, defense.mjs,
 * hooks.mjs, attack-dialog.mjs, horde-sheet.mjs — давно считают через
 * mergeWeaponPropEntries). Из-за этого купленное за R3 «Наплечное» честно
 * применялось в бою, а руку всё равно держало занятой.
 *
 * Владельца предмета берём из переданного актора, иначе из item.parent; вне
 * актора (компендиум, боковая панель) модификаций и быть не может — тогда
 * читаем собственные свойства предмета, как раньше.
 */
function effectiveAuto(item, actor) {
  const owner = actor?.items ? actor : (item?.parent?.items ? item.parent : null);
  const entries = owner
    ? mergeWeaponPropEntries(item, getModEffects(owner, item))
    : (item?.system?.weaponProps ?? []);
  return aggregateAuto(resolveWeaponPropsList(entries));
}

function effectiveRangedGripHands(item, actor, auto) {
  const list = availableRangedGrips(item, actor, auto);
  if (!list.length) return null;
  const flagged = item.getFlag?.(NS, "hudGrip");
  let key = list.includes(flagged) ? flagged : list[0];
  if (key === "1р") {
    const recoilRating = auto.recoilRating || 0;
    const sBonus = Number(actor?.system?.characteristics?.s?.bonus) || 0;
    // Good.Q/Best.Q Откатная Перчатка «игнорирует свойство Recoil оружия» —
    // гейт по S.b не применяется вовсе (wdbc-f7iw).
    const gated = recoilRating > 0 && sBonus < recoilRating
               && !hasRuleFlag(actor, "weapon.ignoreRecoil");
    if (gated) key = list.includes("2р") ? "2р" : key;
  }
  return key === "1р" ? 1 : key === "2р" ? 2 : null;
}

/**
 * Сколько рук занимает предмет ПРЯМО СЕЙЧАС (0-2). Independent/Wrist/Пальцевое
 * — всегда 0, они и есть исключение из правила «оружие занимает руку», и
 * читаются они ДО ветвления рукопашное/дальнобойное: Поцелуй Арлекина надет на
 * запястье и рукопашный (wdbc-9dg8). actor —
 * нужен только дальнобойному (гейт Отдачи по S.b); по умолчанию — носитель
 * предмета (у настоящих Foundry-документов item.parent это и есть актор).
 */
export function weaponHandsRequired(item, actor = item?.parent) {
  if (!item || item.type !== "weapon") return 0;
  const sys = item.system || {};
  if (isHandShield(item)) return 1;
  // Рука Смерти: сросшееся оружие работает одной рукой, даже если профиль
  // требовал двух (стр. 46) — гейт до ветвления мелейное/дальнобойное, оба
  // случая читают sys.grips/RANGED_CLASS_HANDS ниже, которых это правило не
  // касается.
  if (isFusedByHandOfDeath(item)) return 1;
  // «Руки не занимает» — свойство самой вещи, а не её дальнобойности: проверка
  // стоит ДО ветвления melee/ranged (wdbc-9dg8). Пальцевое (перстень на палец)
  // здесь же — по книге его можно надеть на каждый палец и стрелять
  // одновременно с оружием в той же руке.
  const auto = effectiveAuto(item, actor);
  if (auto.independent || auto.wrist || auto.digital) return 0;
  if (sys.weaponClass === "melee") return MELEE_GRIP_HANDS[currentMeleeGrip(item)] ?? 1;
  // Стационарное: класс решает РАНЬШЕ данных (wdbc-7utm). У станкового хват
  // «2р» описывает, как за него берутся, а не сколько рук оно отнимает у
  // бюджета — оружие стоит на станке. Пока поле grips было пустым, сюда
  // доходил классовый запас с нулём; после бэкфилла заполненное «2р» вернуло
  // бы 2 и турель начала бы съедать обе руки. Единственный класс, где данные
  // и запас расходятся намеренно.
  if (sys.weaponClass === "stationary") return RANGED_CLASS_HANDS.stationary;
  const gripHands = effectiveRangedGripHands(item, actor, auto);
  if (gripHands != null) return gripHands;
  return RANGED_CLASS_HANDS[sys.weaponClass] ?? 1;
}

/** Рука предмета (left/right/null) — heldHand, с фолбэком на старые флаги. */
export function getHeldHand(item) {
  return item?.getFlag?.(NS, "heldHand")
      ?? item?.getFlag?.(NS, "shieldHand")
      ?? item?.getFlag?.(NS, "weaponHand")
      ?? null;
}

/** Единая запись руки предмета — новый флаг, старые больше не пишутся. */
export async function setHeldHand(item, hand) {
  if (!item) return;
  await item.setFlag(NS, "heldHand", hand);
}

/**
 * Рейтинг Трейта Multiple Arms — уже ПОЛНОЕ число рук (raw «Multiple Arms
 * (4)» = четыре руки, не «+4»; текст самого Трейта: «общее число рук = X»),
 * см. apps/cybernetic-excellence.mjs:BASE_ARMS. Трейта нет — обычные 2 руки.
 *
 * Берётся НАИБОЛЬШИЙ рейтинг, а не первый попавшийся: Конструктор «МЕХАНИКА»
 * дедуплицирует только Таланты, а два источника Трейта (мутация + её
 * субмутация, как «Странные Руки» + «Призрачные Руки») кладут на актора две
 * отдельные записи. Раз рейтинг — ИТОГ, а не прибавка, верный ответ из двух
 * «общих чисел рук» — большее; при первом попавшемся сильная субмутация
 * молча проигрывала слабой базовой записи.
 */
export function baseHandsFromTraits(actor) {
  const ratings = [...(actor?.items ?? [])]
    .filter(isMultipleArmsTrait)
    .map(t => Number(t.system?.rating) || 0)
    .filter(n => n > 0);
  return ratings.length ? Math.max(...ratings) : BASE_HANDS;
}

/** Сколько рук у актора доступно прямо сейчас: Трейт минус ампутации (0-31/32). */
export function maxHands(actor) {
  const cond = actor?.system?.conditions || {};
  const lost = (Number(cond.lostHandsCount) || 0) + (Number(cond.lostArmsCount) || 0);
  return Math.max(0, baseHandsFromTraits(actor) - lost);
}

// ── Кисть и рука (wdbc-x1nz.2.97 п.2, «Раны и Урон», стр. 43) ─────────────
// «Ладонь: персонаж не может пользоваться оружием и предметами этой рукой,
// кроме предметов, что цепляются к запястью (щит, когти, нартеций). Рука:
// также как ладонь, но персонаж больше не имеет запястья, чтобы нацепить
// щит, когти, или другой предмет.» Раньше lostHands и lostArms вычитались из
// бюджета одинаково, щит всегда брал здоровую руку, а предметы на запястье
// (0 рук) оставались доступны даже без единой руки. Теперь:
//   • запястий = Трейт − потерянные руки (кисть запястье оставляет);
//   • обрубков кисти = потерянные кисти (не больше, чем запястий) — на
//     каждый можно пристегнуть один щит, и он НЕ занимает здоровую руку;
//   • предмет на запястье/предплечье требует запястья — без руки нельзя.

/**
 * «Ладонь: Штраф –20 на все тесты, что требуют двух рук» (рука — «также как
 * ладонь»; «Раны и Урон», стр. 43; wdbc-x1nz.2.97 п.3). Решение владельца:
 * тесты «двумя руками» — Карабканье (combat/movement-actions.mjs) и приёмы
 * Борьбы, когда цель держат двумя руками (combat/grapple.mjs). Многорукому
 * штраф — по бюджету рук: потерял кисть, но рук осталось две и больше —
 * двумя руками он всё ещё действует, штрафа нет.
 * @returns {number} −20 или 0
 */
export function twoHandedTestPenalty(actor) {
  const cond = actor?.system?.conditions || {};
  const lost = (Number(cond.lostHandsCount) || 0) + (Number(cond.lostArmsCount) || 0);
  return lost >= 1 && maxHands(actor) < 2 ? -20 : 0;
}

/** Подпись штрафа выше — одна на все места, где он применяется. */
export const TWO_HANDED_PENALTY_LABEL = "Без кисти/руки (тест двумя руками)";

/** Сколько у актора запястий: базовые руки минус потерянные РУКИ (не кисти). */
export function maxWrists(actor) {
  const lostArms = Number(actor?.system?.conditions?.lostArmsCount) || 0;
  return Math.max(0, baseHandsFromTraits(actor) - lostArms);
}

/** Обрубки кисти — запястья без ладони, к которым можно пристегнуть щит. */
export function handStumps(actor) {
  const lostHands = Number(actor?.system?.conditions?.lostHandsCount) || 0;
  return Math.max(0, Math.min(lostHands, maxWrists(actor)));
}

/**
 * Предмет крепится на запястье/предплечье и ладони не занимает: свойство
 * Wrist или хват рукопашного «П» (Когти.П — на предплечье). Щит сюда не
 * входит: на здоровой руке его держат ладонью (1 рука), на обрубок —
 * пристёгивают (см. handsOccupied).
 */
export function isWristMounted(item, actor = item?.parent) {
  if (!item || item.type !== "weapon" || isHandShield(item)) return false;
  if (item.system?.weaponClass === "melee" && currentMeleeGrip(item) === "П") return true;
  return !!effectiveAuto(item, actor).wrist;
}

function equippedWristMounted(actor, exclude = null) {
  return (actor?.items ? [...actor.items] : [])
    .filter(i => i.type === "weapon" && i.system?.equipped && i.id !== exclude && isWristMounted(i, actor));
}

/**
 * Экипированные предметы, реально занимающие руки (щиты — тоже type:"weapon").
 *
 * Актор передаётся в weaponHandsRequired ЯВНО, а не добывается из item.parent:
 * от него зависят возможности («винтовку одной рукой», «Стрела Кхейна у адепта
 * Пути Воина») и гейт Отдачи по S.b, а parent есть только у настоящего
 * Foundry-документа. Раз актор здесь и так на руках, полагаться на обратную
 * ссылку незачем.
 */
export function handHeldItems(actor) {
  return (actor?.items ? [...actor.items] : [])
    .filter(i => i.type === "weapon" && i.system?.equipped && weaponHandsRequired(i, actor) > 0);
}

/** Руки, занятые Захватом: у Атакующего — сколько держит, у Цели — обездвиженные. */
export function grappleHandsUsed(actor) {
  if (!actor?.system?.conditions?.grappling) return 0;
  const f = key => actor?.getFlag?.("warhammer-dbc", key) ?? actor?.flags?.["warhammer-dbc"]?.[key];
  const role = f("grappleRole");
  if (role === "attacker") return Math.max(1, Number(f("grappleHands")) || 1);
  if (role === "target") return Number(f("grappleHeldHands")) || 2;
  return 0;
}

/**
 * Сводка занятости рук актора. exclude — id предмета, который не учитывать
 * (проверка «хватит ли рук, если снять/не считая вот этот»).
 */
export function handsOccupied(actor, { exclude = null } = {}) {
  const items = handHeldItems(actor).filter(i => i.id !== exclude);
  // Борьба (стр. 12, wdbc-x1nz.2.77): «Одна из рук Атакующего занята
  // Захватом» (или больше, если держит несколькими), а у Цели каждая рука
  // Атакующего обездвиживает две. Флаги ставит combat/grapple.mjs; читаем
  // напрямую, без импорта Борьбы (она сама импортирует этот файл).
  // wdbc-x1nz.2.97 п.2: щиты сперва садятся на обрубки кисти (пристёгнуты к
  // запястью, здоровую руку не занимают), остальные — по руке, как раньше.
  const stumps = handStumps(actor);
  const shieldCount = items.filter(i => isHandShield(i)).length;
  const stumpShields = Math.min(shieldCount, stumps);
  const used  = items.reduce((sum, i) => sum + weaponHandsRequired(i, actor), 0)
              - stumpShields + grappleHandsUsed(actor);
  const max   = maxHands(actor);
  // Запястья: предметы на запястье плюс щиты на обрубках. Без руки запястья нет.
  const wrists = maxWrists(actor);
  const wristUsed = equippedWristMounted(actor, exclude).length + stumpShields;
  return {
    max, used, free: Math.max(0, max - used), over: used > max || wristUsed > wrists, items,
    wrists, wristUsed, stumps, stumpShields, freeStumps: stumps - stumpShields
  };
}

/**
 * Хватит ли рук, чтобы ДОПОЛНИТЕЛЬНО экипировать предмет. Проверяет только
 * прирост от этого конкретного действия — уже существующие «нелегальные»
 * связки на старых листах персонажей этим не блокируются и не трогаются.
 *
 * wdbc-x1nz.2.97 п.2: предмет на запястье требует свободного запястья (без
 * руки — нельзя); щит встаёт на свободный обрубок кисти, если он есть, и
 * тогда здоровая рука не нужна.
 */
export function canEquipInHands(actor, item) {
  if (isWristMounted(item, actor)) {
    const occ = handsOccupied(actor, { exclude: item.id });
    return occ.wristUsed + 1 <= occ.wrists;
  }
  const need = weaponHandsRequired(item, actor);
  if (need <= 0) return true;
  const occ = handsOccupied(actor, { exclude: item.id });
  if (isHandShield(item) && occ.freeStumps > 0 && occ.wristUsed + 1 <= occ.wrists) return true;
  return need <= occ.free;
}
