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

// Из реестра constants/conditions.mjs (wdbc-w88h), не из sheets/sheet-helpers.mjs
// — этот слой (apps/, синхронизация с движком) не должен тянуть слой листа.
import { CONDITIONS_DEF, CONDITION_ICONS, TOKEN_SYNC_EXCLUDE } from "../constants/conditions.mjs";
// Единая точка наложения/снятия (wdbc-fejd) — держит флаг и счётчик в
// согласии сама, вместо ручной сборки пары полей прямо здесь.
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";

// «Усталость» — не бинарное состояние, а зеркало счётчика system.fatigue.value
// (actor.mjs prepareDerivedData). Токен умеет только вкл/выкл иконку, а не
// хранить число — включать её щелчком по токену нечего, тег и так следует за
// настоящей Усталостью на ТЕЛЕ. Поэтому исключена из статус-набора токена
// (CONDITIONS.fatigued.tokenSync === false — единственный ключ там).

/**
 * Путь к статическому файлу иконки Состояния (wdbc-ahtb.1): Foundry v14
 * валидирует поле img создаваемого ActiveEffect как FilePathField —
 * требует настоящий путь к файлу с расширением. data:image/svg+xml,...
 * (как было раньше) этой валидации не проходит: actor.toggleStatusEffect
 * падал с ошибкой на КАЖДОМ Состоянии, иконка на токене не появлялась
 * никогда ни для одного из 27. Файлы — сгенерированный артефакт
 * (assets/conditions/<key>.svg, tools/build-condition-icons.mjs) из того
 * же body/color, что CONDITIONS_DEF отдаёт тегу на листе — перегенерировать
 * после правки constants/conditions.mjs, test/tools/condition-icons-sync.
 * test.mjs ловит забытую перегенерацию.
 */
export function statusIconUri(key) {
  if (!CONDITION_ICONS[key]) return "icons/svg/hazard.svg";
  return `systems/warhammer-dbc/assets/conditions/${key}.svg`;
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
      const fields = want ? conditionApplyFields(key, null, actor) : conditionRemoveFields(key);
      // Пустой патч на наложении = у актора ИММУНИТЕТ к этому Состоянию
      // (запись Конструктора kind:"condition", wdbc-tl0f). Просто пропустить
      // нельзя: иконка на токене осталась бы стоять, а на листе Состояния
      // не было бы — та самая «невидимая метка», от которой уходит этот этап.
      // Поэтому эффект снимается обратно, и иконка гаснет сама.
      if (want && !Object.keys(fields).length) {
        await effect.delete();
        ui.notifications?.info(`${actor.name}: иммунитет к «${CONDITIONS_DEF[key]?.label || key}» — Состояние не накладывается.`);
        return;
      }
      await actor.update(fields);
    } finally { _syncing = false; }
  };
  Hooks.on("createActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, false));
  Hooks.on("deleteActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, true));
}

export function initConditionStatusEffects() {
  CONFIG.statusEffects = buildConditionStatusEffects();
  registerConditionStatusSync();
}
