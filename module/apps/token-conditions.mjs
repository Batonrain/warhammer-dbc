// module/apps/token-conditions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Синхронизация СОСТОЯНИЙ листа (system.conditions.*) со статус-иконками
//  токена — нативным Foundry TokenHUD/ActiveEffect.statuses. Раньше это были
//  два независимых мира: CONFIG.statusEffects оставался дефолтным набором
//  Foundry (Dead/Unconscious/Prone из коробки, без Оглушения/Кровотечения и
//  прочего своего), и ни один из них не знал про system.conditions — снять
//  «Ослеплён» на листе не гасило иконку на токене и наоборот.
//
//  Подход: CONFIG.statusEffects строится ИЗ CONDITIONS_DEF/CONDITION_ICONS —
//  те же 27 состояний, те же иконки, что и в блоке СОСТОЯНИЯ. Дальше — пара
//  хуков в оба конца:
//   - Лист → токен: правка system.conditions.<key> вызывает
//     actor.toggleStatusEffect (создаёт/удаляет ActiveEffect со statuses).
//   - Токен → лист: наложение/снятие иконки на токене (или через ПКМ на
//     токене, HUD статусов) правит system.conditions.<key> тем же путём, что
//     и кнопки листа (снятие уровневого состояния обнуляет и счётчик).
//  Флаг _syncing — предохранитель: applying один конец не должен снова
//  дёргать другой в том же цикле (иначе actor.update → hook → toggle →
//  hook → update... до бесконечности).
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS_DEF } from "../sheets/sheet-helpers.mjs";
import { CONDITION_ICONS } from "../constants/condition-icons.mjs";

// «Усталость» — не бинарное состояние, а зеркало счётчика system.fatigue.value
// (actor.mjs prepareDerivedData). Токен умеет только вкл/выкл иконку, а не
// хранить число — включать её щелчком по токену нечего, тег и так следует за
// настоящей Усталостью на ТЕЛЕ. Поэтому исключена из статус-набора токена.
const TOKEN_SYNC_EXCLUDE = new Set(["fatigued"]);

export function statusIconUri(key) {
  const ic = CONDITION_ICONS[key];
  if (!ic) return "icons/svg/hazard.svg";
  // currentColor работает только внутри страницы листа (класс задаёт цвет);
  // иконка токена — самостоятельный <img>, цвет нужно вписать в саму svg.
  const body = ic.body.replaceAll(/currentColor/g, ic.color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/** Заменяет CONFIG.statusEffects на состояния системы (+ «Повержен» ядра — на нём завязан HUD боя/трекер). */
export function buildConditionStatusEffects() {
  const deadId = CONFIG.specialStatusEffects?.DEFEATED;
  const deadDefault = CONFIG.statusEffects?.find(e => e.id === deadId);

  return [
    ...(deadDefault ? [deadDefault] : []),
    ...Object.entries(CONDITIONS_DEF)
      .filter(([key]) => !TOKEN_SYNC_EXCLUDE.has(key))
      .map(([key, def]) => ({ id: key, name: def.label, img: statusIconUri(key) }))
  ];
}

// Предохранитель от рекурсии между двумя концами синхронизации в рамках
// одного вызванного нами же обновления.
let _syncing = false;

function registerConditionStatusSync() {
  // Лист (и вообще любой код, пишущий system.conditions.<key> через
  // actor.update — кнопки листа, эффекты оружия, наркотики) → токен.
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (_syncing || userId !== game.user.id) return;
    const changedConditions = changes?.system?.conditions;
    if (!changedConditions || !(actor instanceof Actor)) return;
    for (const key of Object.keys(changedConditions)) {
      if (!CONDITIONS_DEF[key] || TOKEN_SYNC_EXCLUDE.has(key)) continue;
      const want = !!actor.system.conditions?.[key];
      const has  = actor.statuses?.has(key) ?? false;
      if (want === has) continue;
      _syncing = true;
      try { await actor.toggleStatusEffect(key, { active: want }); }
      finally { _syncing = false; }
    }
  });

  // Токен (HUD статусов/ПКМ по токену) → лист.
  const syncFromEffect = async (effect, options, userId, removed) => {
    if (_syncing || userId !== game.user.id) return;
    const actor = effect.parent;
    if (!(actor instanceof Actor) || !actor.system?.conditions) return;
    const key = [...(effect.statuses ?? [])].find(s => CONDITIONS_DEF[s] && !TOKEN_SYNC_EXCLUDE.has(s));
    if (!key) return;
    const want = !removed;
    if (!!actor.system.conditions[key] === want) return;
    _syncing = true;
    try {
      const def = CONDITIONS_DEF[key];
      const updates = { [`system.conditions.${key}`]: want };
      if (!want && def.hasLevel && def.levelField) updates[`system.conditions.${def.levelField}`] = 0;
      await actor.update(updates);
    } finally { _syncing = false; }
  };
  Hooks.on("createActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, false));
  Hooks.on("deleteActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, true));
}

export function initConditionStatusEffects() {
  CONFIG.statusEffects = buildConditionStatusEffects();
  registerConditionStatusSync();
}
