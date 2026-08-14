// module/migrations/item-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Миграция: system.effects.* существующих предметов → embedded ActiveEffect.
//  Переводит старые числовые эффекты в реальный, работающий Active Effect —
//  единственный источник правды для этих 10 типов отныне. Сам system.effects НЕ
//  стираем (легаси/справка), только перестаём его читать в prepareDerivedData и
//  показывать для редактирования (см. партиалы листов).
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

import { hasLegacyEffects, legacyEffectsToChanges } from "../constants/effect-keys.mjs";
import { isItemActive }                             from "../apps/effects.mjs";

const SYSTEM = "warhammer-dbc";

export const MIGRATE_EFFECT_TYPES = new Set([
  "talent", "trait", "implant", "mutation", "psychicPower", "techPower",
  "homeworld", "divination", "armorMod", "weaponMod"
]);
const MIGRATE_COMPENDIA = [
  "warhammer-dbc.traits", "warhammer-dbc.talents", "warhammer-dbc.implants",
  "warhammer-dbc.mutations", "warhammer-dbc.psychic-powers", "warhammer-dbc.tech-powers",
  "warhammer-dbc.homeworlds", "warhammer-dbc.divinations",
  "warhammer-dbc.armor-mods", "warhammer-dbc.weapon-mods"
];

// Поля старого формата, которым в ActiveEffect соответствия нет. Пока такое
// поле заполнено, помечать предмет перенесённым нельзя: старое поле актор у
// помеченного не читает (documents/actor.mjs, combat/armor-mods.mjs) — механика
// исчезла бы с обеих сторон.
//
// Остался один: потолок Ловкости не считает вообще никто — ни ключа эффекта,
// ни чтения system.maxAgility брони в actor.mjs (wdbc-fde). Так стоят
// «Открытые Сочленения» в паке. AP против типа урона отсюда ушёл: у него
// теперь есть ключ system.absorption.vsType.* (wdbc-1j8).
export const LEGACY_ONLY_KEYS = ["maxAgilityMod"];

// Суффикс имени перенесённого эффекта. Единственный признак, по которому дубль
// отличим от эффекта Конструктора: ключ у них один и тот же, а имена своим
// эффектам Конструктор даёт через describeMechEntry (apps/mechanics.mjs).
const MIGRATED_SUFFIX = " (перенесено)";

/**
 * Ключи характеристик, которые правят записи Конструктора (`flags.mechanics`,
 * apps/mechanics.mjs). Свои эффекты он заводит сам, когда предмет попадает к
 * актору, поэтому в компендиуме их ещё нет и читать приходится сами записи.
 * Ключ строится ровно как в applyMechEntry.
 */
function mechanicsKeys(item) {
  const keys = new Set();
  for (const group of item.getFlag(SYSTEM, "mechanics") ?? [])
    for (const entry of group.entries ?? [])
      if (entry.kind === "characteristic")
        keys.add(`system.characteristics.${entry.charKey}.${entry.field}`);
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

/** Переносит механику одного предмета. true — если эффект создан. */
export async function migrateItemEffects(item) {
  if (!MIGRATE_EFFECT_TYPES.has(item.type)) return false;
  const fx = item.system?.effects;
  if (LEGACY_ONLY_KEYS.some(k => fx?.[k])) return false;

  const carried = carriedKeys(item);
  const changes = hasLegacyEffects(fx)
    ? legacyEffectsToChanges(fx).filter(c => !carried.has(c.key))
    : [];

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
    name: `${item.name}${MIGRATED_SUFFIX}`, icon: item.img,
    disabled: !isItemActive(item),
    system: { changes }
  }]);
  await item.setFlag(SYSTEM, "migratedEffect", true);
  return true;
}

// Починка бага ранней версии миграции: charValueBonuses (обычные +X к
// характеристике — Родные миры, импланты и т.п.) переводились в
// system.characteristics.<стат>.value — поля, которого не существует ни в
// схеме, ни в коде листа (сравните с prepareDerivedData: считается .total).
// Эффект тихо создавался, но ни на что не влиял. Верный путь — .total, он
// пересчитывается заново из base/advance/... каждый цикл, поэтому
// "final"-эффект безопасно ложится поверх (тот же приём, что и у .bonus).
// Идемпотентно само по себе — почищенных .value-ключей просто не останется.
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
  let migrated = 0, repaired = 0, deduped = 0;

  /** Порядок шагов важен — см. комментарии внутри. */
  async function pass(item) {
    // Починка идёт первой: эффект ранней миграции с ключом `.value` иначе не
    // узнать по ключу (перенос ищет `.total`), и рядом лёг бы второй — тот же
    // бонус дважды. Она же приводит ключ к тому виду, в каком его сверяет
    // снятие дублей.
    repaired += await repairCharValueEffectKeys(item);
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
    console.log(`Warhammer DBC | Починка эффектов: исправлено ${repaired} эффект(ов) с ключом .value → .total.`);
    ui.notifications?.info(`Warhammer DBC: исправлены неработавшие бонусы характеристик — ${repaired}.`);
  }
  if (deduped) {
    console.log(`Warhammer DBC | Снято правок, задвоенных Конструктором: ${deduped}.`);
    ui.notifications?.info(`Warhammer DBC: убраны задвоенные бонусы — ${deduped}.`);
  }
  return { migrated, repaired, deduped };
}
