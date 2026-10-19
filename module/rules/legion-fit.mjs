// module/rules/legion-fit.mjs
//
// Свойство Legion / Легион — «приспособлено для силы и размеров Астартес».
// В книге это не памятка, а штрафы к использованию, и они идут в обе стороны:
//
//   • оружие с Legion в чужих руках: −10 за Размер меньше 1, −10 за Бонус Силы
//     меньше 7 и −10 за то, что руки (или перчатки) не сделаны под Астартес;
//   • Астартес с оружием БЕЗ Legion: −10 (гранаты не в счёт) — спусковая скоба
//     мала для его пальца.
//
// Считается по возможности `weapons.legion` (rules/flags.mjs), а не по расе:
// приспособленность к легионному оружию — это про сложение носителя, и её
// может дать не только раса Астартес.

/** Один шаг штрафа. Все слагаемые в книге одинаковы — по −10. */
export const LEGION_STEP = -10;

/** Возможность «сложен под легионное оружие» — её выдают правила расы. */
export const LEGION_FIT_FLAG = "weapons.legion";

/**
 * Возможность «оружие не по размеру не штрафует за Размер и Силу» (wdbc-vsma).
 * Книжный источник — Best.Q Откатная Перчатка: «позволяет людям оперировать
 * оружием Легиона и Огринов без штрафов за недостаточный размер и S.b, но всё
 * ещё с −10 за неудобную форму». Снимает ДВА слагаемых из трёх; третье (руки
 * не под Астартес) и есть та самая «неудобная форма» — остаётся.
 *
 * Про Огринизированное оружие: его собственные штрафы система пока не считает
 * вовсе (свойство ogryned в constants/weapon-properties.mjs описано текстом,
 * читателя у него нет) — когда появятся, они обязаны спрашивать этот же ключ.
 */
export const OVERSIZED_FIT_FLAG = "weapon.oversizedIgnoreSizeStrength";

/**
 * Возможность «в силовой броне Легион-оружие вообще без штрафов» (Giant's
 * Arms / Оружие Гигантов, arsenal.core.giantSArms, стр. 62, wdbc-3-65ff).
 * В отличие от OVERSIZED_FIT_FLAG снимает ВСЕ ТРИ слагаемых, не два — книга
 * не делает исключения для «неудобной формы». Талант сам по себе (capability
 * на предмете) условия «надета силовая броня» не знает — его проверяет
 * вызывающий код (module/sheets/attack-dialog.mjs) и передаёт сюда уже
 * готовым булевым ignoresHandFit.
 */
export const GIANTS_ARMS_FLAG = "arsenal.core.giantSArms";

/**
 * Штраф к тесту атаки за несоответствие оружия и носителя.
 *
 * @param {object}  o
 * @param {boolean} o.hasLegion  у оружия есть свойство Legion
 * @param {boolean} o.fitsLegion носитель сложен под легионное оружие (Астартес)
 * @param {number}  o.size       Размер носителя
 * @param {number}  o.sBonus     Бонус Силы носителя
 * @param {boolean} o.isGrenade  граната — исключение из штрафа Астартес
 * @param {boolean} o.ignoresSizeStrength  носитель снимает штрафы за Размер и
 *        Бонус Силы (Best.Q Откатная Перчатка, OVERSIZED_FIT_FLAG) — «неудобная
 *        форма» при этом остаётся.
 * @param {boolean} o.ignoresHandFit  Giant's Arms в надетой силовой броне
 *        (GIANTS_ARMS_FLAG выше) — снимает все три слагаемых, Размер и Силу тоже.
 * @returns {{total: number, parts: {label: string, value: number}[]}}
 */
export function legionAttackPenalty({ hasLegion = false, fitsLegion = false,
                                      size = 0, sBonus = 0, isGrenade = false,
                                      ignoresSizeStrength = false,
                                      ignoresHandFit = false } = {}) {
  const parts = [];

  if (hasLegion && !fitsLegion) {
    if (!ignoresSizeStrength && !ignoresHandFit && (Number(size)   || 0) < 1) parts.push({ label: "Легион: Размер меньше 1",   value: LEGION_STEP });
    if (!ignoresSizeStrength && !ignoresHandFit && (Number(sBonus) || 0) < 7) parts.push({ label: "Легион: Бонус Силы меньше 7", value: LEGION_STEP });
    // Руки под Астартес — то же сложение, что даёт fitsLegion; раз его нет,
    // хват не подогнан. Оружие можно доработать (R 0), и тогда предмет просто
    // теряет свойство Legion — отдельного признака для этого не нужно.
    if (!ignoresHandFit) parts.push({ label: "Легион: руки не под Астартес", value: LEGION_STEP });
  } else if (!hasLegion && fitsLegion && !isGrenade) {
    parts.push({ label: "Оружие не легионное (мала скоба)", value: LEGION_STEP });
  }

  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

/**
 * Надета ли силовая броня — тот же признак, что у radiation-scene.mjs/
 * armour-history.mjs (item.system.armorType === "power"), включена она или
 * нет роли не играет: книга Giant's Arms говорит «нося», не «в активной».
 */
export function wearsPowerArmour(actor) {
  return (actor?.items ?? []).some(i => i.type === "armor" && i.system?.equipped && i.system?.armorType === "power");
}
