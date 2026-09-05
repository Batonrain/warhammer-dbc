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
import { isMirroredCondition, isMirrorClearable, MIRROR_KEYS } from "../rules/condition-mirrors.mjs";
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

/**
 * Что нужно доделать статус-набору токена, чтобы он сошёлся с МЕТКАМИ актора
 * (wdbc-6xhl). Чистая функция — на вход отражение меток в system.conditions и
 * текущий набор статусов токена, на выход «что зажечь, что погасить».
 *
 * Отдельно от книжных Состояний по существу дела, а не для порядка. Книжное
 * Состояние ПИШЕТСЯ в system.conditions.<ключ>, и хук ловит его по тому, что
 * буквально пришло в патче. Метка туда не пишется НИКОГДА: её источники —
 * system.inRage, флаги актора, флаг на щите, и весь боевой код пишет именно
 * их. Поэтому метки ловятся не «что изменилось», а сверкой отражения с тем,
 * что сейчас на токене. Ровно из-за этой разницы иконки меток не появлялись
 * вовсе: тег на листе был, а хук молчал.
 *
 * @param {object} conditions system.conditions актора (уже пересчитанный)
 * @param {Set<string>} statuses actor.statuses
 * @returns {{add: string[], remove: string[]}}
 */
export function markStatusPlan(conditions = {}, statuses = new Set()) {
  const add = [], remove = [];
  for (const key of MIRROR_KEYS) {
    if (TOKEN_SYNC_EXCLUDE.has(key)) continue;
    const want = !!conditions?.[key];
    const has  = statuses?.has?.(key) ?? false;
    if (want && !has) add.push(key);
    else if (!want && has) remove.push(key);
  }
  return { add, remove };
}

/** Применяет план выше к актору. Под тем же предохранителем, что и остальное. */
async function syncMarkStatuses(actor) {
  if (_syncing) return;
  const { add, remove } = markStatusPlan(actor.system?.conditions, actor.statuses);
  for (const [keys, active] of [[add, true], [remove, false]]) {
    for (const key of keys) {
      _syncing = true;
      try { await actor.toggleStatusEffect(key, { active }); }
      finally { _syncing = false; }
    }
  }
}

function registerConditionStatusSync() {
  // Лист (и вообще любой код, пишущий system.conditions.<key> через
  // actor.update — кнопки листа, эффекты оружия, наркотики) → токен.
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (_syncing || userId !== game.user.id) return;
    if (!(actor instanceof Actor)) return;
    // Метки — ПЕРЕД разбором патча и независимо от него: их источники лежат
    // вне system.conditions, и по «что изменилось» их не поймать (wdbc-6xhl).
    await syncMarkStatuses(actor);
    const changedConditions = changes?.system?.conditions;
    if (!changedConditions) return;
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
        // Причин ровно две, и путать их нельзя: у метки (wdbc-5uae) её ставит
        // своё действие, у книжного Состояния патч пуст из-за ИММУНИТЕТА.
        const label = CONDITIONS_DEF[key]?.label || key;
        ui.notifications?.info(isMirroredCondition(key)
          ? `${actor.name}: «${label}» вручную не ставится — её включает своё действие.`
          : `${actor.name}: иммунитет к «${label}» — Состояние не накладывается.`);
        return;
      }
      // Снятие МЕТКИ, живущей на предмете («Щит поднят»): патчем актора её не
      // достать, поэтому иконку возвращаем на место, а не делаем вид, что сняли.
      if (!want && isMirroredCondition(key) && !isMirrorClearable(key)) {
        ui.notifications?.info(`${actor.name}: «${CONDITIONS_DEF[key]?.label || key}» снимается кнопкой у самого предмета — щит опускается на вкладке БОЙ.`);
        return;
      }
      await actor.update(fields);
    } finally { _syncing = false; }
  };
  Hooks.on("createActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, false));
  Hooks.on("deleteActiveEffect", (effect, options, userId) => syncFromEffect(effect, options, userId, true));

  // Метка «Щит поднят» живёт флагом на ПРЕДМЕТЕ, а не на акторе — обновление
  // актора при этом не приходит вовсе, и без этих трёх хуков иконка щита не
  // зажглась бы никогда. Сверка дешёвая (сравнение набора меток с набором
  // статусов), поэтому зовём её на любое изменение предметов, не пытаясь
  // угадать, какое именно поле тронули.
  const onItemChange = async (item, ...rest) => {
    const userId = rest.at(-1);
    if (_syncing || userId !== game.user.id) return;
    const actor = item?.parent;
    if (actor instanceof Actor && actor.system?.conditions) await syncMarkStatuses(actor);
  };
  Hooks.on("updateItem", onItemChange);
  Hooks.on("createItem", onItemChange);
  Hooks.on("deleteItem", onItemChange);
}

export function initConditionStatusEffects() {
  CONFIG.statusEffects = buildConditionStatusEffects();
  registerConditionStatusSync();
}
