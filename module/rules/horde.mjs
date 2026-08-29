// module/rules/horde.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ ОРДЫ — Характеристики (total/bonus), Навыки, Размер и боевые
//  показатели по текущей Магнитуде, движение, состояние (Ослаблена/Сломлена),
//  броня по надетым предметам. Вызывается из documents/actor.mjs
//  (_prepareHordeData) — вынесена из монолита prepareDerivedData (wdbc-yo4n).
//  Счёт урона по Орде (попадания/Магнитуда) — отдельно, rules/horde-damage.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { HORDE_SIZE_LABELS, hordeSizeFor, hordeMagDamageDice, hordeState,
         massDamageThreshold, WEAKENED_WP_PENALTY, noRecoveryHours } from "./horde-damage.mjs";
import { calcMovement } from "./movement.mjs";

/**
 * Производные данные Орды. Мутирует system.derived/system.movement и
 * читает флаг hordeRoundDamage актора.
 *
 * @param {object} actor  сам актор (для this.items/this.getFlag)
 * @param {object} system system актора (мутируется)
 */
export function prepareHordeDerived(actor, system) {
  // Характеристики: total = база + продвижение + Мод. (знаковый ручной
  // модификатор, как у Персонажа/Демона/Миньона/Принца Демона); бонус = ⌊total/10⌋.
  const charDamage = system.charDamage || {};
  for (const [key, char] of Object.entries(system.characteristics || {})) {
    const dmgMod = charDamage[key] || 0;
    char.charDamage = dmgMod;
    char.total = (Number(char.base) || 0) + (Number(char.advance) || 0) + dmgMod;
    char.bonus = Math.floor(char.total / 10);
  }
  // Навыки: значение = характеристика навыка + надбавка ранга. Считается так
  // же, как у существ, но без продвижений за опыт — у орды их нет.
  for (const [key, sk] of Object.entries(system.skills || {})) {
    const def     = SKILLS_DEF[key];
    const charVal = def ? (system.characteristics?.[def.char]?.total ?? 0) : 0;
    sk.total = charVal + (SKILL_RANKS[sk.rank]?.bonus ?? -20);
  }

  // Групповые навыки — те же правила, но характеристику может задавать сама
  // запись (у Ремесла она своя у каждой специализации).
  for (const [groupKey, entries] of Object.entries(system.groupSkills || {})) {
    if (!Array.isArray(entries)) continue;
    const def = GROUP_SKILLS_DEF[groupKey];
    for (const entry of entries) {
      const charKey = entry.char || def?.char;
      const charVal = charKey ? (system.characteristics?.[charKey]?.total ?? 0) : 0;
      entry.total = charVal + (SKILL_RANKS[entry.rank]?.bonus ?? -20);
    }
  }

  const mag   = system.magnitude || (system.magnitude = { value: 0, start: 0 });
  const value = Math.max(0, Number(mag.value) || 0);
  const start = Math.max(0, Number(mag.start) || 0);

  // Боевой Размер по Магнитуде (не влияет на SPD) и бонусные кубы урона —
  // счёт общий с конвейером урона, rules/horde-damage.mjs.
  const magSize       = hordeSizeFor(value);
  const magDamageDice = hordeMagDamageDice(value);

  // Движение: SPD = Ag.bonus + собственный размер существа (не Размер Орды).
  const agB = system.characteristics?.ag?.bonus ?? 0;
  system.movement = calcMovement(agB, Number(system.sizeMod) || 0);

  // Боевые показатели Орды.
  const meleeTargets = Math.max(1, Math.floor(value / 5));
  const enemiesMelee = Math.max(0, Number(system.enemiesInMelee) || 0);
  // Отдельные стрелки (расчёты тяжёлого оружия) бьют своими атаками и в
  // стрельбе Орды не участвуют — их Магнитуда из расчёта вычитается.
  const detached     = Math.min(value, Math.max(0, Number(system.detachedMagnitude) || 0));
  const shootingMag  = Math.max(0, value - detached);
  const rangedShots  = Math.max(0, Math.floor(shootingMag / 10) - Math.floor(enemiesMelee / 2));

  // Состояние по доле от стартовой Магнитуды.
  const pct = start > 0 ? value / start : 1;
  const immune = !!system.immuneFear;
  const state = hordeState({ value, start, immune });

  // Броня Орды: все попадания идут в торс, поэтому считается AP тела, и не
  // суммой, а по лучшему предмету — как у существ (несколько слоёв брони не
  // складываются). Поле system.absorption мастер по-прежнему ставит руками:
  // там сумма «броня + бонус Стойкости», как было до появления предметов.
  let armourAP = 0;
  for (const item of actor.items ?? []) {
    if (item.type !== "armor" || !item.system?.equipped) continue;
    armourAP = Math.max(armourAP, Number(item.system.body) || 0);
  }
  const manualAbsorption = Math.max(0, Number(system.absorption) || 0);

  system.derived = {
    magSize,
    magSizeLabel: HORDE_SIZE_LABELS[magSize] || "",
    armourAP,
    absorptionTotal: manualAbsorption + armourAP,
    magDamageDice,
    magDamageStr: magDamageDice ? `+${magDamageDice}d10` : "—",
    meleeTargets,
    rangedShots,
    detached,
    psychTestBonus: value,                    // бонус к тестам Страха/Запугивания/Подавления = Магнитуда
    pct: Math.round(pct * 100),
    state,
    immune,
    lost: Math.max(0, start - value),
    psychDamage: Math.max(0, Number(system.psychDamage) || 0),
    halfThreshold: Math.floor(start * 0.5),
    quarterThreshold: Math.floor(start * 0.25),
    massDamageThreshold: massDamageThreshold(start),  // 25%+ за раунд → тест W+Магнитуда
    // Ослабленная Орда катит Волю с −10 и не лечит психологический урон
    // 10−W.b часов. Штраф уже сложен в порог теста Воли ниже.
    wpPenalty: state === "weakened" ? WEAKENED_WP_PENALTY : 0,
    wpTestThreshold: (system.characteristics?.wp?.total ?? 0)
                   + (state === "weakened" ? WEAKENED_WP_PENALTY : 0),
    // Порог психологического теста: Воля плюс Магнитуда (толпа держится числом).
    psychTestThreshold: (system.characteristics?.wp?.total ?? 0) + value
                      + (state === "weakened" ? WEAKENED_WP_PENALTY : 0),
    noRecoveryHours: noRecoveryHours(system.characteristics?.wp?.bonus ?? 0),
    roundDamage: Number(actor.getFlag?.("warhammer-dbc", "hordeRoundDamage")) || 0
  };
}
