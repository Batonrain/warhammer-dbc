// module/rules/power-setting.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Power Setting / Настройка Мощности (модификация лаз-оружия; Sahara 3-9d40, решение
//  владельца 24.10.2026: Выпуск Батареи и Расплавление зависят от неё — моделируем минимально).
//
//  Модификация (core.json, «Стрелковое оружие», стр. 201): «Оружие имеет два
//  дополнительных режима и может переключать режимы за свободное действие:
//  Усиление: Dmg +1, Pen +1, Надежность –1, Surge (2); Перегрузка: Dmg +2, Pen +2,
//  Надежность –2, Surge (4). Требование: Las оружие, кроме тяжелого оружия».
//
//  Режим хранится флагом оружия (`flags.warhammer-dbc.powerMode`: "" — обычный,
//  "boost" — Усиление, "overload" — Перегрузка); переключатель — в окне атаки
//  (sheets/attack-dialog.mjs), числа подмешивает combat/weapon-mods.mjs::getModEffects
//  вместе с остальными эффектами модификаций. Источник «есть ли у оружия Power
//  Setting»: установленная активная модификация (предмет weaponMod) ИЛИ пометка
//  «Power Setting» в поле «Особенности» самого оружия («Моды: Power Setting» — так
//  записаны лазганы из таблицы книги, «+Power Setting»).
//
//  Чистые функции без Foundry. ВАЖНО: файл — ЛИСТ (ни одного импорта): его грузит
//  combat/weapon-mods.mjs, а тот входит в цепочку sources.mjs → … → hands.mjs, поэтому любой
//  импорт отсюда в rules/ability-by-key.mjs замкнул бы круг (AGENTS.md, «Источники правил»).
//  Выпуск Батареи (Талант, спрашивает hasAbility) — отдельным файлом rules/batpack-dump.mjs.
// ════════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

export const POWER_MODE_FLAG = "powerMode";

/** Режимы Power Setting: поправки к Dmg/Pen/Надёжности и рейтинг Surge. */
export const POWER_MODES = Object.freeze({
  "":       Object.freeze({ key: "",         label: "Обычный",    damage: 0, pen: 0, reliability: 0,  surge: 0 }),
  boost:    Object.freeze({ key: "boost",    label: "Усиление",   damage: 1, pen: 1, reliability: -1, surge: 2 }),
  overload: Object.freeze({ key: "overload", label: "Перегрузка", damage: 2, pen: 2, reliability: -2, surge: 4 })
});

/** Предмет — модификация Power Setting (в паке она названа «Power Tuning / Настройка Мощности»). */
export const isPowerSettingMod = item => item?.type === "weaponMod"
  && /Power\s*(Setting|Tuning)|Настройка\s+Мощности/i.test(String(item.name ?? ""));

/**
 * Есть ли у оружия Power Setting: лаз-оружие, кроме тяжёлого и рукопашного; установленный
 * активный мод или пометка в «Особенностях».
 * @param {object}   weapon
 * @param {object[]} [activeMods]  действующие модификации этого оружия (weapon-mods.mjs::getActiveMods)
 */
export function hasPowerSetting(weapon, activeMods = []) {
  const sys = weapon?.system;
  if (weapon?.type !== "weapon" || !sys) return false;
  if (sys.weaponClass === "heavy" || sys.weaponClass === "melee") return false;
  return activeMods.some(isPowerSettingMod) || /Power\s*Setting/i.test(String(sys.special ?? ""));
}

/** Режим Power Setting, выбранный на оружии ("" / "boost" / "overload"). */
export function powerModeOf(weapon) {
  const v = weapon?.getFlag?.(NS, POWER_MODE_FLAG) ?? weapon?.flags?.[NS]?.[POWER_MODE_FLAG] ?? "";
  return Object.hasOwn(POWER_MODES, v) ? v : "";
}

/**
 * Поправки выбранного режима для getModEffects ({} — режим обычный или Power Setting нет).
 * @returns {{damageMod:number, penMod:number, reliabilityMod:number, addProps:object[], label:string}|null}
 */
export function powerSettingEffects(weapon, activeMods = []) {
  if (!hasPowerSetting(weapon, activeMods)) return null;
  const mode = POWER_MODES[powerModeOf(weapon)];
  if (!mode.key) return null;
  return {
    damageMod: mode.damage, penMod: mode.pen, reliabilityMod: mode.reliability,
    addProps: [{ key: "surge", rating: mode.surge, rating2: 0 }],
    label: `Настройка Мощности: ${mode.label}`
  };
}
