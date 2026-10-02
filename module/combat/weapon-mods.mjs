// module/combat/weapon-mods.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Модификации оружия: привязка к оружию и агрегация эффектов.
//  Модификация — Item типа "weaponMod" с system.installedOn = id оружия.
// ─────────────────────────────────────────────────────────────────────────────

import { fullyArmedReliabilityBonus } from "./fully-armed.mjs";
import { runtRifleIsLong } from "../rules/runt.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { isItemActive } from "../apps/effects.mjs";

/** Все установленные на данное оружие модификации (среди предметов актора). */
export function getInstalledMods(actor, weapon) {
  if (!actor || !weapon) return [];
  return actor.items.filter(i =>
    i.type === "weaponMod" && i.system.installedOn === weapon.id
  );
}

/**
 * Выполнено ли «интегрируется с X и бесполезен без них» (wdbc-1rno.38):
 * среди предметов актора есть АКТИВНЫЙ предмет с одним из имён
 * system.requiresWorn мода. Активность — общая isItemActive (apps/effects.mjs):
 * снаряжение с местом ношения — надето, имплант — установлен Хирургеоном и не
 * неисправен (и не погашен полем Дискорданта). Пустой список — условия нет.
 *
 * Сравнение по имени (rules/predicates.mjs::itemHasName, любая половина
 * двуязычного) — тот же приём, что у Респиратора/Противогаза
 * (wearsGasProtection): отдельного ключа «это ретинальный дисплей» у
 * предметов нет. Предметы, где ретинальный дисплей ВСТРОЕН (силовая/эльдарская
 * броня, Маска Шпиона, Всевидящее Око…), сюда пока не засчитываются — вопрос
 * владельцу, см. отчёт wdbc-1rno-38-x.
 */
export function modWornRequirementMet(actor, mod) {
  const need = (mod?.system?.requiresWorn ?? []).filter(n => typeof n === "string" && n.trim());
  if (!need.length) return true;
  return [...(actor?.items ?? [])].some(i =>
    need.some(n => itemHasName(i, n)) && isItemActive(i));
}

// ── Один прицел за атаку (wdbc-1rno.40) ────────────────────────────────────
// Книга, «Модификации → Прицелы»: «Хотя на оружие можно установить несколько
// прицелов, для каждой атаки можно пользоваться только одним». Прицел — мод
// группы «sights» (constants/items.mjs::WEAPON_MOD_GROUPS; в паке это ровно
// десять модов папки «Прицелы», сторож — test/combat/weapon-mod-sights.test.mjs).
// Выбор живёт флагом на ОРУЖИИ, как Хват/Профиль (hudGrip/hudProfile): его
// одинаково видят окно атаки, бросок (combat/attack.mjs), лист и бюджет рук —
// показанный порог не разойдётся с брошенным. Ставит его окно атаки
// (sheets/attack/dialog.mjs, выпадающий список «Прицел»).
export const SIGHT_MOD_GROUP = "sights";
export const ACTIVE_SIGHT_FLAG = "hudSight";

/** Прицел ли эта модификация оружия. */
export function isSightMod(mod) {
  return mod?.type === "weaponMod" && mod?.system?.modGroup === SIGHT_MOD_GROUP;
}

/**
 * id прицела, через который ведётся атака, или null, если прицелов нет.
 * Сохранённый на оружии выбор — если такой прицел всё ещё стоит И работает;
 * иначе первый РАБОЧИЙ (требование «носит X» выполнено), рабочих нет — первый.
 * «Работает» проверяется и у сохранённого: снял Ретинальный Дисплей — выбранный
 * раньше Целеуказатель стал бесполезен, и молча оставлять оружие вовсе без
 * прицела (теряя +5 стоящего рядом Коллиматорного) было бы хуже, чем
 * переключиться на рабочий.
 */
export function activeSightId(actor, weapon) {
  const sights = getInstalledMods(actor, weapon).filter(isSightMod);
  if (!sights.length) return null;
  const saved = weapon?.getFlag?.("warhammer-dbc", ACTIVE_SIGHT_FLAG)
    ?? weapon?.flags?.["warhammer-dbc"]?.[ACTIVE_SIGHT_FLAG];
  const working = sights.filter(s => modWornRequirementMet(actor, s));
  if (saved && working.some(s => s.id === saved)) return saved;
  return (working[0] ?? sights[0]).id;
}

/**
 * Модификации, которые ДЕЙСТВУЮТ на это оружие сейчас: установленные, минус
 * те, чьё требование «носит предмет X» не выполнено (wdbc-1rno.38), минус все
 * прицелы, кроме выбранного (wdbc-1rno.40). Все читатели эффектов модов
 * (getModEffects, окно атаки, ситуативные гасители штрафов, бюджет рук) берут
 * этот список, а не getInstalledMods, — иначе «бесполезный» или невыбранный мод
 * тихо работал бы в одном месте и молчал в другом.
 */
export function getActiveMods(actor, weapon) {
  const sightId = activeSightId(actor, weapon);
  return getInstalledMods(actor, weapon).filter(m =>
    (!isSightMod(m) || m.id === sightId) && modWornRequirementMet(actor, m));
}

/**
 * Сворачивает эффекты всех установленных модификаций в один объект.
 * Числовые — складываются; множители (rangeMult/clipMult) — перемножаются.
 * addProps — список {key,rating,rating2}; removeProps — массив ключей.
 *
 * Поля читаются из system.effects НАПРЯМУЮ, без проверки migratedEffect — и
 * это не пробел, а задокументированное исключение: WEAPON_MOD_EFFECT_KEYS /
 * PSYCHIC_WEAPON_BUFF_KEY в migrations/item-effects.mjs перечисляют их явно.
 * В LEGACY_ONLY_KEYS их заносить нельзя (это заблокировало бы migratedEffect
 * навсегда для любой реальной модификации — там эти поля заполнены штатно, не
 * как остаток старой миграции) — сами поля в ActiveEffect не переносятся
 * вовсе, это отдельная, самостоятельная система «эффектов оружия» (wdbc-ng6c, B4).
 */
export function getModEffects(actor, weapon) {
  const fx = {
    attackMod: 0, damageMod: 0, penMod: 0, rangeMod: 0, rangeMult: 1,
    clipMod: 0, clipMult: 1, rofSemiMod: 0, rofFullMod: 0,
    rofSingleAttackMod: 0, rofSemiAttackMod: 0, rofFullAttackMod: 0,
    reliabilityMod: 0, balanceMod: 0, weightPct: 0,
    addProps: [], removeProps: [], names: []
  };
  for (const mod of getActiveMods(actor, weapon)) {
    const e = mod.system.effects || {};
    fx.attackMod      += e.attackMod      || 0;
    // Подстройка под конкретного персонажа (Custom Grip и т.п.): бонус только
    // для актора, под которого модификация подстроена, зеркальный штраф всем
    // прочим. Пустой fittedToId — ещё не подстроена, бонус не действует.
    if (e.fittedToId) {
      fx.attackMod += (e.fittedToId === actor.id ? 1 : -1) * (Number(e.fittedBonus) || 0);
    }
    fx.damageMod      += e.damageMod      || 0;
    fx.penMod         += e.penMod         || 0;
    fx.rangeMod       += e.rangeMod       || 0;
    fx.rangeMult      *= (e.rangeMult ?? 1) || 1;
    fx.clipMod        += e.clipMod        || 0;
    fx.clipMult       *= (e.clipMult ?? 1) || 1;
    fx.rofSemiMod     += e.rofSemiMod     || 0;
    fx.rofFullMod     += e.rofFullMod     || 0;
    fx.rofSingleAttackMod += e.rofSingleAttackMod || 0;
    fx.rofSemiAttackMod   += e.rofSemiAttackMod   || 0;
    fx.rofFullAttackMod   += e.rofFullAttackMod   || 0;
    fx.reliabilityMod += e.reliabilityMod || 0;
    fx.balanceMod     += e.balanceMod     || 0;
    fx.weightPct      += e.weightPct      || 0;
    for (const p of (e.addProps || [])) fx.addProps.push(p);
    for (const k of (e.removeProps || [])) fx.removeProps.push(k);
    // Построено Конструктором Механики (kind:"weaponProp", см. module/apps/mechanics.mjs) —
    // отдельные поля, чтобы не задевать addProps/removeProps ручного раздела «Даруемые
    // свойства» выше на листе модификации; здесь просто доливаются в тот же поток.
    for (const p of (e.mechAddProps || [])) fx.addProps.push(p);
    for (const k of (e.mechRemoveProps || [])) fx.removeProps.push(k);
    fx.names.push(mod.name);
  }

  // ── Усиление от поддерживаемых психосил (Force-оружие, благословения и т.п.) ──
  for (const power of actor.items) {
    if (power.type !== "psychicPower" || !power.system.isSustained) continue;
    const wb = power.system.effects?.weaponBuff;
    if (!wb || !wb.enabled) continue;
    const scope = wb.scope || "equipped";
    if (scope === "equipped" && !weapon.system.equipped) continue;
    if (scope === "force" && !(weapon.system.weaponProps || []).some(p => p.key === "force")) continue;
    // Психосила, наложенная на КОНКРЕТНОЕ оружие (Force Blade, wdbc-vxgd):
    // книга даёт свойства именно тому предмету, на котором манифестировали.
    // Пустое поле — прежнее поведение «по всей надетой», чтобы старые записи
    // и случай «выбирать было не из чего» не остались без способности вовсе.
    if (wb.weaponId && String(wb.weaponId) !== String(weapon.id)) continue;
    fx.damageMod  += Number(wb.damageMod)  || 0;
    fx.penMod     += Number(wb.penMod)     || 0;
    fx.rangeMod   += Number(wb.rangeMod)   || 0;
    // wdbc-vxgd: Баланс — не запись weaponProps, а прямое числовое поле
    // оружия (system.balance, combat/defense.mjs::parryProfile) — тот же
    // канал balanceMod, что уже используют Модификации оружия выше.
    fx.balanceMod += Number(wb.balanceMod) || 0;
    for (const p of (wb.addProps || [])) fx.addProps.push(p);
    fx.names.push(power.name);
  }

  // Fully Armed / Во Всеоружии (Черта, wdbc-1rno) — +1 Надёжность для
  // не-тяжёлого стрелкового оружия с установленным Custom Grip (см.
  // module/combat/fully-armed.mjs; вес — отдельно, в module/constants/rig.mjs).
  fx.reliabilityMod += fullyArmedReliabilityBonus(actor, weapon);

  // Runt / Коротышка (Ратлинг): «считает все винтовки длинными винтовками» —
  // свойство «Длинная Винтовка» (нельзя стрелять в рукопашной), пока на
  // винтовке нет модификации Compact (module/rules/runt.mjs).
  if (runtRifleIsLong(actor, weapon)) {
    fx.addProps.push({ key: "longRifle", rating: 0, rating2: 0 });
    fx.names.push("Коротышка: винтовка как длинная");
  }

  return fx;
}

/**
 * Итоговый список свойств оружия с учётом модификаций:
 * собственные weaponProps + добавленные модами − убранные модами.
 * Возвращает массив {key, rating, rating2} (для resolveWeaponPropsList).
 */
export function mergeWeaponPropEntries(weapon, modFx) {
  const own = foundry.utils.deepClone(weapon?.system?.weaponProps ?? []);
  const removed = new Set(modFx?.removeProps ?? []);
  const result = own.filter(p => !removed.has(p.key));
  for (const p of (modFx?.addProps ?? [])) {
    if (removed.has(p.key)) continue;
    const existing = result.find(x => x.key === p.key);
    // ratingDelta (Конструктор: «увеличить/уменьшить рейтинг») — ОТНОСИТЕЛЬНАЯ
    // прибавка к уже посчитанному рейтингу, а не абсолютное значение (в отличие
    // от rating ниже, который берёт максимум при совпадении ключа).
    if (p.ratingDelta != null) {
      if (existing) {
        if (typeof existing.rating !== "string") existing.rating = Math.max(0, (existing.rating || 0) + p.ratingDelta);
      } else {
        result.push({ key: p.key, rating: Math.max(0, p.ratingDelta), rating2: 0 });
      }
      continue;
    }
    if (existing) {
      // Берём больший рейтинг, если свойство уже есть (строковые — формулы кубика — не максимизируем)
      existing.rating  = (typeof existing.rating === "string" || typeof p.rating === "string")
        ? (existing.rating || p.rating || 0)
        : Math.max(existing.rating  || 0, p.rating  || 0);
      // rating2 может быть формулой кубика (строка, напр. «2d10») — не вычисляем max.
      existing.rating2 = (typeof existing.rating2 === "string" || typeof p.rating2 === "string")
        ? (existing.rating2 || p.rating2 || 0)
        : Math.max(existing.rating2 || 0, p.rating2 || 0);
    } else {
      result.push({ key: p.key, rating: p.rating || 0, rating2: p.rating2 || 0 });
    }
  }
  return result;
}
