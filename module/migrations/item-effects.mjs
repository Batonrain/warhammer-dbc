// module/migrations/item-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Миграция: system.effects.* существующих предметов → embedded ActiveEffect.
//  Переводит старые числовые эффекты в реальный, работающий Active Effect —
//  единственный источник правды для этих 10 типов отныне. Сам system.effects НЕ
//  стираем (легаси/справка), только перестаём его читать в prepareDerivedData.
//  Партиалы листов (armor/tech-power/psychic-power.hbs) прячут за флагом
//  migratedEffect поля charBonuses и AP-эффекты армор-модов (item-sheet.mjs:
//  context.effectsMigrated) — до wdbc-o80l правка визуально сохранялась, но не
//  доходила до актора (миграция гоняется один раз на ready, не на updateItem).
//  Исключение: addProps/removeProps/weaponBuff (module/combat/weapon-mods.mjs)
//  этот флаг не проверяют вовсе — они и не входят в перенос
//  (legacyEffectsToChanges его не знает), поэтому их правка через лист всегда
//  доходит до актора и в UI не прячется (см. находку B4 — незадокументированное
//  исключение из архитектуры, решение за владельцем).
//
//  Признаком «уже перенесено» служит сама механика в эффектах (по ключам, см.
//  carriedKeys), а НЕ флаг `migratedEffect`: флаг ставила и прошлая версия
//  миграции, и он же стоит у предметов, чью механику перенесли в Конструктор.
//  Актор старое поле у помеченного предмета не читает (documents/actor.mjs),
//  поэтому предмет с флагом, но без эффекта, механику теряет вовсе — так в паках
//  лежат 4 органа Геносемени (Бископея — +2 к бонусу Силы Астартес). Флаг
//  остаётся: он и говорит актору не складывать старое поле поверх эффектов.
//
//  Обратная сторона признака по механике: эффект, удалённый вручную, вернётся
//  при следующем запуске. Чтобы механику выключить, эффект гасят (disabled) —
//  погашенный ключ остаётся занятым.
// ════════════════════════════════════════════════════════════════════════════

import { hasLegacyEffects, legacyEffectsToChanges, expectedPhase } from "../constants/effect-keys.mjs";
import { implantTableEffects }                      from "../constants/implant-mechanics.mjs";
import { isItemActive }                             from "../apps/effects.mjs";
import { characteristicEffectKey, describeMechEntry, allMechEntryIds,
         DURABLE_MECH_KINDS }                       from "../apps/mechanics.mjs";

const SYSTEM = "warhammer-dbc";

export const MIGRATE_EFFECT_TYPES = new Set([
  "talent", "trait", "implant", "mutation", "psychicPower", "techPower",
  "homeworld", "divination", "armorMod", "weaponMod"
]);
const MIGRATE_COMPENDIA = [
  "warhammer-dbc.traits", "warhammer-dbc.talents",
  "warhammer-dbc.aeldari-traits", "warhammer-dbc.aeldari-talents",
  "warhammer-dbc.implants",
  "warhammer-dbc.mutations", "warhammer-dbc.psychic-powers", "warhammer-dbc.tech-powers",
  "warhammer-dbc.homeworlds", "warhammer-dbc.divinations",
  "warhammer-dbc.armor-mods", "warhammer-dbc.weapon-mods"
];

// vehicleTrait НЕ входит в этот набор и не должен: у Техники своя, отдельная
// система бонусов (_prepareVehicleData, documents/actor.mjs) — она читает
// system.effects Черт техники (openTopped/spdMod/deflectorShield/autonomous и
// т.д.) вручную при каждом prepareData, без ActiveEffect и без гейта
// migratedEffect вовсе. Это не пробел миграции, а второй, параллельный
// источник истины для бонусов техники — задокументированное исключение
// (wdbc-ng6c, находка B5). Рефакторинг в module/rules/ — отдельная задача
// wdbc-yo4n, этой миграции не касается.

// Поля старого формата, которым в ActiveEffect соответствия нет. Пока такое
// поле заполнено, помечать предмет перенесённым нельзя: старое поле актор у
// помеченного не читает (documents/actor.mjs, combat/armor-mods.mjs) — механика
// исчезла бы с обеих сторон.
//
// Потолок Ловкости работает, но мимо эффектов: его считает armorAgilityCap
// (combat/armor-mods.mjs) из старого поля, и ключа в EFFECT_KEY_LABELS у него
// нет. Пометить мод с maxAgilityMod — значит снова его обесточить, поэтому
// поле и остаётся здесь. Так стоят «Открытые Сочленения» в паке. AP против
// типа урона отсюда ушёл: у него появился ключ absorption.vsType.* (wdbc-1j8).
const LEGACY_ONLY_KEYS = ["maxAgilityMod"];

// А это — поля, легаси-только у одних лишь модификаций. Обычный AP модификации
// складывается в AP её носителя ДО того, как брони сравниваются между собой
// (armorFromItems в actor.mjs: у нестакающихся берётся лучшая), и обвешан
// гейтами, которых у эффекта нет, — снятый шлем, тип брони под систему. Эффект
// на акторе лёг бы поверх победившей брони, а не той, на которой стоит. Считает
// это только getArmorModEffects, поэтому старое поле у модификаций обязано
// остаться читаемым. У черт и имплантов те же поля переносятся штатно.
const MOD_LEGACY_ONLY_KEYS = ["armourAll", "apAll", "apHead", "apBody", "apArms", "apLegs"];

/** Поля, которые у ЭТОГО предмета переносить некуда. */
export function legacyOnlyKeys(item) {
  return item.type === "armorMod" || item.type === "weaponMod"
    ? [...LEGACY_ONLY_KEYS, ...MOD_LEGACY_ONLY_KEYS]
    : LEGACY_ONLY_KEYS;
}

// Поля модификаций оружия (weaponMod: attackMod/damageMod/penMod/rangeMod/
// clipMod/rofMod/addProps/removeProps/mechAddProps/mechRemoveProps) и весовых
// психосил (psychicPower: weaponBuff) — реестр НЕ выше, LEGACY_ONLY_KEYS/
// MOD_LEGACY_ONLY_KEYS. Эти поля combat/weapon-mods.mjs (getModEffects) читает
// из system.effects НАПРЯМУЮ, всегда, вне зависимости от migratedEffect — своя
// самостоятельная система «эффектов оружия» (числовые бонусы и список
// даруемых свойств), не легаси-счётчик характеристик, ожидающий переноса в
// ActiveEffect. В LEGACY_ONLY_KEYS их заносить НЕЛЬЗЯ: тот список блокирует
// простановку migratedEffect, пока поле заполнено — а у реальных модификаций
// оно заполнено всегда (это их обычные данные, не остаток старой миграции),
// поэтому весь тип встал бы немигрируемым навсегда (проверено: тест «ни один
// предмет пака не помечен перенесённым с полем мимо ActiveEffect» ловит это
// как ложное срабатывание). Перечислены здесь только затем, чтобы при чтении
// кода это выглядело как явное, зафиксированное решение, а не как то, что
// legacyEffectsToChanges (constants/effect-keys.mjs) просто повезло не знать
// про эти ключи — не гарантия, а факт архитектуры (wdbc-ng6c, находки B4/B6).
// mechAddProps/mechRemoveProps сюда же: их пишет напрямую Конструктор Механики
// (syncWeaponPropItemEffects, apps/mechanics.mjs, kind:"weaponProp") — тоже
// намеренное исключение, не случайный обход правила «эффекты только через
// ActiveEffect»: changes не умеет выразить «добавить элемент в массив свойств
// оружия».
export const WEAPON_MOD_EFFECT_KEYS = [
  "attackMod", "damageMod", "penMod", "rangeMod", "rangeMult",
  "clipMod", "clipMult", "rofSemiMod", "rofFullMod",
  "reliabilityMod", "balanceMod", "weightPct", "addProps", "removeProps",
  "mechAddProps", "mechRemoveProps"
];
export const PSYCHIC_WEAPON_BUFF_KEY = "weaponBuff";

// Суффикс имени перенесённого эффекта. Единственный признак, по которому дубль
// отличим от эффекта Конструктора: ключ у них один и тот же, а имена своим
// эффектам Конструктор даёт через describeMechEntry (apps/mechanics.mjs).
const MIGRATED_SUFFIX = " (перенесено)";

/**
 * Ключи характеристик, которые правят записи Конструктора (`flags.mechanics`,
 * apps/mechanics.mjs). Свои эффекты он заводит сам, когда предмет попадает к
 * актору, поэтому в компендиуме их ещё нет и читать приходится сами записи.
 * Ключ строит та же функция, что и сам Конструктор: своя копия правила
 * («Бонус» целится в .bonusFx) перестала бы узнавать пару при первой же
 * правке цели.
 */
function mechanicsKeys(item) {
  const keys = new Set();
  for (const group of item.getFlag(SYSTEM, "mechanics") ?? [])
    for (const entry of group.entries ?? [])
      if (entry.kind === "characteristic") keys.add(characteristicEffectKey(entry));
  return keys;
}

/**
 * Ключи, механику которых предмет уже несёт: свои эффекты плюс записи
 * Конструктора. Свои эффекты — прошлый перенос (в том числе переименованный)
 * либо ручной эффект GM на то же поле. Сравниваем по ключам, а не по имени
 * эффекта: имя правится в UI одним кликом, ключ — нет.
 *
 * У всех 13 Родных миров и 8 Предсказаний в паках записи Конструктора совпадают
 * со старым полем: перенести их значило бы удвоить бонусы.
 */
function carriedKeys(item) {
  const keys = mechanicsKeys(item);
  for (const effect of item.effects ?? [])
    for (const c of effect.system?.changes ?? []) keys.add(c.key);
  return keys;
}

/**
 * Снимает с перенесённых эффектов правки, которые уже ведёт Конструктор.
 * Возвращает число снятых.
 *
 * Ранняя миграция перенесла в эффект механику, которую потом завели и в
 * Конструкторе — так в паке оказались 13 Родных миров. На акторе работали оба
 * источника разом (эффект приезжает с предметом, записи Конструктора он
 * отыгрывает при получении), и бонус удваивался: Добывающий мир давал S +3/+3,
 * T +3/+3, Fel −3/−3. Побеждает Конструктор — штатное место механики.
 *
 * Предмет без записей Конструктора не трогаем: его копия могла уехать к актору
 * до того, как механику там завели, и эффект — единственный её источник.
 */
export async function dropMechanicsDuplicates(item) {
  const mech = mechanicsKeys(item);
  if (!mech.size) return 0;

  let dropped = 0;
  const emptied = [];
  for (const effect of item.effects ?? []) {
    if (!effect.name?.endsWith(MIGRATED_SUFFIX)) continue;
    const changes = effect.system?.changes ?? [];
    const keep = changes.filter(c => !mech.has(c.key));
    if (keep.length === changes.length) continue;
    dropped += changes.length - keep.length;
    if (keep.length) await effect.update({ "system.changes": keep });
    else emptied.push(effect.id);
  }
  if (emptied.length) await item.deleteEmbeddedDocuments("ActiveEffect", emptied);
  return dropped;
}

/** Changes числовой росписи импланта из IMPLANT_MECH (пусто у прочих типов). */
function implantTableChanges(item) {
  if (item.type !== "implant") return [];
  const legacy = implantTableEffects(item.name);
  return legacy ? legacyEffectsToChanges(legacy) : [];
}

/** Переносит механику одного предмета. true — если эффект создан. */
export async function migrateItemEffects(item) {
  if (!MIGRATE_EFFECT_TYPES.has(item.type)) return false;
  const fx = item.system?.effects;
  if (legacyOnlyKeys(item).some(k => fx?.[k])) return false;

  const carried = carriedKeys(item);
  const changes = hasLegacyEffects(fx)
    ? legacyEffectsToChanges(fx).filter(c => !carried.has(c.key))
    : [];

  // Числовая роспись IMPLANT_MECH — то же старое поле, только лежавшее в коде и
  // применявшееся по имени предмета (wdbc-cy2). Новые паки несут эти числа в
  // самом предмете, а розданным копиям их даёт этот перенос. Ключ, который у
  // предмета уже занят, не дублируем: у Крукса Механикуса, Сикарианских ЭФМ и
  // Модуля Прицельного Фокуса надбавка была записана в обоих местах разом.
  for (const c of implantTableChanges(item))
    if (!carried.has(c.key) && !changes.some(x => x.key === c.key)) changes.push(c);

  if (!changes.length) {
    // Переносить нечего или уже перенесено. Флаг всё равно ставим: это он велит
    // актору не складывать старое поле поверх эффектов.
    if (!item.getFlag(SYSTEM, "migratedEffect")) await item.setFlag(SYSTEM, "migratedEffect", true);
    return false;
  }

  // Старый расчёт пропускал предметы в неактивном состоянии (неустановленный или
  // неисправный имплант, неподдерживаемая психосила) — эффект рождается в том же
  // состоянии и тем же предикатом, каким его ведут дальше (isItemActive и
  // syncItemEffectsDisabled в apps/effects.mjs). Надетость носителя модификации
  // isItemActive теперь тоже проверяет; чего он не знает — снятого шлема и
  // требований систем силовой брони, их по-прежнему считает только
  // getInstalledArmorMods (combat/armor-mods.mjs).
  await item.createEmbeddedDocuments("ActiveEffect", [{
    name: `${item.name}${MIGRATED_SUFFIX}`, img: item.img,
    disabled: !isItemActive(item),
    system: { changes }
  }]);
  await item.setFlag(SYSTEM, "migratedEffect", true);
  return true;
}

// Починка бага ранней версии миграции: она целилась в system.armour.<зона> —
// поля с таким именем у актора нет вовсе (в схеме system.armor, и это ручной
// блок, который берётся через Math.max, а не складывается). AP перенесённых
// предметов был мёртв: старое поле актор у помеченного не читает, а эффект
// писал в никуда. Живой ключ — system.armorBonus.<зона>, хранимый, поэтому и
// фаза меняется на "initial" (см. constants/effect-keys.mjs).
//
// У модификаций брони починка другая: их AP в эффект не уезжает вовсе
// (MOD_LEGACY_ONLY_KEYS), поэтому мёртвый эффект снимается целиком, а с ним и
// флаг — старое поле снова должно стать видимым для getArmorModEffects.
//
// Возвращает число тронутых эффектов. Идемпотентно: мёртвых ключей не остаётся.
const DEAD_AP_KEY = /^system\.armour\.(\w+)$/;

export async function repairDeadArmourKeys(item) {
  const isMod = item.type === "armorMod" || item.type === "weaponMod";
  let fixed = 0;
  const emptied = [];

  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.some(c => DEAD_AP_KEY.test(c.key))) continue;
    fixed++;

    if (isMod) {
      const keep = changes.filter(c => !DEAD_AP_KEY.test(c.key));
      if (keep.length) await effect.update({ "system.changes": keep });
      else emptied.push(effect.id);
      continue;
    }
    await effect.update({ "system.changes": changes.map(c => {
      const loc = c.key.match(DEAD_AP_KEY)?.[1];
      return loc ? { ...c, key: `system.armorBonus.${loc}`, phase: "initial" } : c;
    }) });
  }

  if (emptied.length) await item.deleteEmbeddedDocuments("ActiveEffect", emptied);
  // Механику модификации снова ведёт старое поле — пометка должна уйти, иначе
  // актор его так и не прочтёт.
  if (fixed && isMod) await item.unsetFlag(SYSTEM, "migratedEffect");
  return fixed;
}

// Починка бага: «Чёрный Панцирь» (имплант Астартес) через запись Конструктора
// kind:"armour" давал АР 4 в торс как СКЛАДЫВАЕМУЮ надбавку — тем же путём,
// что обычная Естественная Броня Черт. Но по тексту самого предмета: «БЕЗ
// БРОНИ считается как нагрудник с АР 4» — это замена/подстраховка на случай
// отсутствия брони на торсе, а не бонус поверх неё. Из-за складывания
// космодесантник в силовой броне получал +4 АР в торс сверх номинала
// (найдено тестером 2026-08-22). Верное поведение (лучшее из двух, не сумма)
// теперь даёт спец-случай по имени в documents/actor.mjs (best("body")) —
// здесь только снимается старая складываемая запись Механики и порождённый
// ею ActiveEffect, чтобы бонус не считался дважды. Задевает и уже выданные
// копии импланта на акторах, и сам компендиум (packs-src поправлен тем же
// фиксом, но уже собранный LevelDB-пак живого мира — нет).
const BLACK_CARAPACE_RE = /Чёрный Панцирь|Black Carapace/i;

export async function repairBlackCarapaceStacking(item) {
  if (item.type !== "implant" || !BLACK_CARAPACE_RE.test(item.name)) return 0;
  const groups = item.getFlag(SYSTEM, "mechanics");
  if (!Array.isArray(groups) || !groups.length) return 0;

  const removedIds = [];
  const keptGroups = groups
    .map(g => {
      const entries = (g.entries || []).filter(e => {
        const isStackingBodyArmour = e.kind === "armour" && e.armourLocation === "body" && Number(e.armourValue) > 0;
        if (isStackingBodyArmour) removedIds.push(e.id);
        return !isStackingBodyArmour;
      });
      return { ...g, entries };
    })
    .filter(g => (g.entries || []).length);
  if (!removedIds.length) return 0;

  const toDelete = (item.effects ?? [])
    .filter(fx => removedIds.includes(fx.getFlag?.(SYSTEM, "mechEntry")))
    .map(fx => fx.id);
  // setFlag на живом акторе сам триггерит Hooks.on("updateItem") →
  // applyItemMechanics/syncMechanicsEffects (warhammer-dbc.mjs) и снимает тот
  // же эффект — на стенде тестов хуков нет, поэтому чистим и сами, но уже
  // ПОСЛЕ setFlag эффект может не существовать (гонка с хуком в реальном
  // мире), отсюда try/catch: тест — единственный источник правды, здесь
  // просто best-effort подчистка.
  await item.setFlag(SYSTEM, "mechanics", keptGroups);
  if (toDelete.length) {
    try { await item.deleteEmbeddedDocuments("ActiveEffect", toDelete); }
    catch (e) { /* хук уже снял эффект сам — ничего страшного */ }
  }
  return 1;
}

// Починка бага: ключ `system.sizeMod` (Размер от Черт — «Size / Размер (X)»,
// «Hulking / Громила») уезжал с фазой "final" — она ложится ПОСЛЕ
// prepareDerivedData, а SPD/Движение считаются как раз внутри него из
// traitSizeMod (documents/actor.mjs). Бейдж «Размер» на листе оттого выглядел
// верным (final успевал к рендеру), а Движение — как у персонажа без Размера
// вовсе (найдено на живых данных: sizeMod=1, sizeTotal=0 у всех Астартес мира).
// Верная фаза для этого ключа теперь в INITIAL_PHASE_KEYS (effect-keys.mjs);
// чинит любой ключ не по одному sizeMod, а по общему правилу expectedPhase —
// та же проверка, что listItemEffects даёт GM как hasWrongPhase.
export async function repairEffectPhases(item) {
  let fixed = 0;
  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.length) continue;
    let touched = false;
    const fixedChanges = changes.map(c => {
      const want = expectedPhase(c.key);
      if (c.phase === want) return c;
      touched = true;
      return { ...c, phase: want };
    });
    if (touched) { await effect.update({ "system.changes": fixedChanges }); fixed++; }
  }
  return fixed;
}

// Починка бага ранней версии миграции: charValueBonuses (обычные +X к
// характеристике — Родные миры, импланты и т.п.) переводились в
// system.characteristics.<стат>.value — поля, которого не существует ни в
// схеме, ни в коде листа (сравните с prepareDerivedData: считается .total).
// Эффект тихо создавался, но ни на что не влиял. Верный путь — .total, он
// пересчитывается заново из base/advance/... каждый цикл, поэтому
// "final"-эффект безопасно ложится поверх (тот же приём, что и у .bonus).
// Идемпотентно само по себе — почищенных .value-ключей просто не останется.
/**
 * Ключ надбавки к Бонусу характеристики: `.bonus` → `.bonusFx`, фаза "initial".
 *
 * `.bonus` считается расчётом листа (documents/actor.mjs), поэтому эффект фазы
 * "final" менял на листе число, но не доходил ни до брони, ни до навыков, ни до
 * перемещений. Цель — хранимое `.bonusFx`, которое входит в сам расчёт
 * (wdbc-5wm). Чинить надо и уже перенесённые миры: перенос сверяет несомую
 * механику по ключу, и рядом со старым лёг бы второй эффект — тот же бонус
 * дважды, причём работающий только наполовину.
 */
/**
 * Метит эффекты, заведённые Конструктором до появления пересборки: без метки
 * `mechEntry` она их не узнает и при первой же правке заведёт рядом второй —
 * бонус посчитается дважды (wdbc-473).
 *
 * Признак — имя: эффектам Конструктор даёт describeMechEntry(запись), и до
 * первой правки оно совпадает. Правки же и не было: пока метки нет, правка
 * никуда не доходила — тем и была беда.
 */
export async function adoptMechanicsEffects(item) {
  const byName = new Map();
  for (const group of item.getFlag(SYSTEM, "mechanics") ?? [])
    for (const entry of group.entries ?? [])
      if (DURABLE_MECH_KINDS.has(entry.kind)) byName.set(describeMechEntry(entry), entry.id);
  if (!byName.size) return 0;

  let tagged = 0;
  for (const effect of item.effects ?? []) {
    if (effect.getFlag?.(SYSTEM, "mechEntry")) continue;
    const entryId = byName.get(effect.name);
    if (!entryId) continue;
    await effect.setFlag(SYSTEM, "mechEntry", entryId);
    tagged++;
  }
  return tagged;
}

/**
 * `mechanicsApplied: true` → список id записей, которые тогда лежали.
 *
 * Флаг был булевым «предмет свою механику отработал», пока применение
 * случалось единственный раз, при получении предмета. Теперь оно поштучное
 * (запись, дописанную на листе актора, надо отыграть, а соседнюю — нет), и
 * старому флагу нужен ровно один перевод. Делать его на лету, в самом
 * применении, нельзя: там «всё, что лежит сейчас» уже включало бы только что
 * дописанную запись, и она молча считалась бы отыгранной.
 *
 * Идемпотентно: у переведённого предмета флаг уже массив.
 */
export async function materializeMechanicsApplied(item) {
  if (item.getFlag(SYSTEM, "mechanicsApplied") !== true) return 0;
  await item.setFlag(SYSTEM, "mechanicsApplied", [...allMechEntryIds(item)]);
  return 1;
}

export async function repairCharBonusEffectKeys(item) {
  // И `.bonus`, и `.total`: оба поля расчёт листа собирает заново, так что
  // эффект поверх любого из них правил только показанное число. Целью стали
  // хранимые надбавки — bonusFx и totalFx соответственно.
  const dead = /^system\.characteristics\.(\w+)\.(bonus|total)$/;
  let fixed = 0;
  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.some(c => dead.test(c.key))) continue;
    const newChanges = changes.map(c => dead.test(c.key)
      ? { ...c, key: `${c.key}Fx`, phase: "initial" } : c);
    await effect.update({ "system.changes": newChanges });
    fixed++;
  }
  return fixed;
}

export async function repairCharValueEffectKeys(item) {
  let fixed = 0;
  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.some(c => /^system\.characteristics\.\w+\.value$/.test(c.key))) continue;
    const newChanges = changes.map(c => /^system\.characteristics\.\w+\.value$/.test(c.key)
      ? { ...c, key: c.key.replace(/\.value$/, ".total") } : c);
    await effect.update({ "system.changes": newChanges });
    fixed++;
  }
  return fixed;
}

/** Весь мир: предметы акторов и компендиумы библиотек. */
export async function migrateAllItemEffects() {
  let migrated = 0, repaired = 0, deduped = 0, adopted = 0;

  /** Порядок шагов важен — см. комментарии внутри. */
  async function pass(item) {
    // Починка идёт первой: эффект ранней миграции с ключом `.value` иначе не
    // узнать по ключу (перенос ищет `.total`), и рядом лёг бы второй — тот же
    // бонус дважды. Она же приводит ключ к тому виду, в каком его сверяет
    // снятие дублей.
    repaired += await repairCharValueEffectKeys(item);
    // И эта до переноса, по той же причине: перенос ищет ключ надбавки к
    // Бонусу в его нынешнем виде (.bonusFx), а старый эффект несёт .bonus —
    // рядом лёг бы второй, и бонус посчитался бы дважды.
    repaired += await repairCharBonusEffectKeys(item);
    // До пересборки: неметенный эффект Конструктора она примет за чужой.
    adopted  += await adoptMechanicsEffects(item);
    // Тем же проходом — перевод булева mechanicsApplied в список id записей.
    adopted  += await materializeMechanicsApplied(item);
    // И эта тоже до переноса: мёртвый ключ брони перенос за уже несомую
    // механику не считает (carriedKeys сверяет по ключу), и рядом лёг бы
    // второй — тот же AP дважды. У модификаций она, наоборот, снимает флаг,
    // и перенос обязан увидеть предмет уже без него.
    repaired += await repairDeadArmourKeys(item);
    // До выравнивания фаз: снимает саму запись Механики и её ActiveEffect у
    // «Чёрного Панцира» — нечего будет выравнивать по фазе, эффект удалён.
    repaired += await repairBlackCarapaceStacking(item);
    // Порядок не важен относительно шагов выше — просто выравнивает фазу
    // changes по expectedPhase, ключи и наличие эффектов уже устоялись.
    repaired += await repairEffectPhases(item);
    deduped  += await dropMechanicsDuplicates(item);
    if (await migrateItemEffects(item)) migrated++;
  }

  for (const actor of game.actors) for (const item of actor.items) await pass(item);

  // Компендиумы библиотек — та же логика, с разблокировкой пака. Замок
  // возвращается в finally: configure пишет в game.settings, то есть снятый
  // замок переживает перезапуск и открывает пак на правку мимо настройки
  // protectCompendiumEdits навсегда. Пак, открытый ГМом до миграции, таким и
  // остаётся — отсюда wasLocked с обеих сторон.
  for (const packId of MIGRATE_COMPENDIA) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    const wasLocked = pack.locked;
    try {
      if (wasLocked) await pack.configure({ locked: false });
      for (const doc of await pack.getDocuments()) await pass(doc);
    } catch (e) {
      console.error(`Warhammer DBC | Миграция эффектов '${packId}':`, e);
    } finally {
      if (wasLocked) await pack.configure({ locked: true });
    }
  }

  if (migrated) {
    console.log(`Warhammer DBC | Миграция эффектов: перенесено ${migrated} предм. в Active Effect.`);
    ui.notifications?.info(`Warhammer DBC: перенесено в новую систему эффектов — ${migrated}.`);
  }
  if (repaired) {
    console.log(`Warhammer DBC | Починка эффектов: исправлено ${repaired} — мёртвые ключи и цель надбавок характеристик.`);
    ui.notifications?.info(`Warhammer DBC: исправлены неработавшие бонусы характеристик — ${repaired}.`);
  }
  if (deduped) {
    console.log(`Warhammer DBC | Снято правок, задвоенных Конструктором: ${deduped}.`);
    ui.notifications?.info(`Warhammer DBC: убраны задвоенные бонусы — ${deduped}.`);
  }
  if (adopted) console.log(`Warhammer DBC | Помечено эффектов Конструктора: ${adopted}.`);
  return { migrated, repaired, deduped, adopted };
}
