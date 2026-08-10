// module/constants/features.mjs
// ════════════════════════════════════════════════════════════════════════
//  Подключаемые подсистемы Doom Core.
//  Каждая — отдельный флажок в Настройках Игры → Warhammer DBC.
//  Выключенная подсистема убирает свои типы акторов из окна создания и
//  запрещает создавать новых, но НЕ ломает уже созданных: их листы
//  продолжают открываться, чтобы выключатель оставался обратимым.
// ════════════════════════════════════════════════════════════════════════

import { AELDARI_RACES } from "./races.mjs";

export const SYSTEM_ID = "warhammer-dbc";

/**
 * Реестр подсистем.
 * key        — ключ настройки в пространстве имён системы;
 * actorTypes — типы акторов, которые она приносит;
 * raceKeys   — ключи рас (module/constants/races.mjs), которые она приносит
 *              (аналог actorTypes, но для расы — не отдельного типа актора).
 */
export const FEATURES = {
  battleBook: {
    key: "battleBook",
    name: "«Книга Битв»",
    hint: "Расширение, позволяющее стратегически командовать крупными соединениями войск.",
    default: true,
    actorTypes: ["formation"]
  },
  aeldariBook: {
    key: "aeldariBook",
    name: "«Книга Эльдар»",
    hint: "Раса Аэльдари и её ответвления (Азуриане, Друкхари, Иннари, Полуэльдар, Арлекин, Экзодит).",
    default: true,
    actorTypes: [],
    raceKeys: AELDARI_RACES,
    sheetTypes: ["character"],
    group: "extra"
  },
  homeworlds: {
    key: "homeworlds",
    name: "Происхождения",
    hint: "Адаптированная система родных миров персонажа.",
    default: true,
    // Тип актора не приносит — добавляет выбор Происхождения в шапку листов
    // персонажа и Демон-Принца.
    actorTypes: [],
    sheetTypes: ["character", "demonPrince"],
    group: "extra"
  },
  divinations: {
    key: "divinations",
    name: "Предсказания",
    hint: "Адаптированная система предсказаний судьбы.",
    default: true,
    actorTypes: [],
    sheetTypes: ["character", "demonPrince"],
    group: "extra"
  },
  helmetless: {
    key: "helmetless",
    name: "Броня без шлема",
    hint: "Правила ношения силовой брони Астартес без шлема.",
    default: true,
    actorTypes: [],
    sheetTypes: ["character"],
    group: "extra"
  },
  armourHistories: {
    key: "armourHistories",
    name: "Истории силовой брони",
    hint: "Истории и особенности комплектов силовой брони Астартес.",
    default: true,
    actorTypes: [],
    sheetTypes: ["character"],
    group: "extra"
  }
};

/** Подразделы окна настроек: ключ группы -> заголовок. */
export const FEATURE_GROUPS = {
  extra: { label: "Дополнительное", hint: "Необязательные подсистемы создания персонажа." }
};

/** Ключи настроек, отнесённых к подразделу. */
export function featureKeysInGroup(group) {
  return FEATURE_ORDER.filter(k => FEATURES[k]?.group === group);
}

export const FEATURE_ORDER = ["battleBook", "aeldariBook", "homeworlds", "divinations",
                              "helmetless", "armourHistories"];

/** Включена ли подсистема. До готовности настроек — значение по умолчанию. */
export function isFeatureEnabled(key) {
  try { return game.settings.get(SYSTEM_ID, key) !== false; }
  catch (e) { return FEATURES[key]?.default ?? true; }
}

/** Подсистема, которой принадлежит тип актора (или null). */
export function featureForActorType(type) {
  return Object.values(FEATURES).find(f => (f.actorTypes || []).includes(type)) || null;
}

/** Отключён ли тип актора выключенной подсистемой. */
export function isActorTypeDisabled(type) {
  const f = featureForActorType(type);
  return !!f && !isFeatureEnabled(f.key);
}

/** Подсистема, которой принадлежит раса (или null). */
export function featureForRace(raceKey) {
  return Object.values(FEATURES).find(f => (f.raceKeys || []).includes(raceKey)) || null;
}

/** Отключена ли раса выключенной подсистемой. */
export function isRaceDisabled(raceKey) {
  const f = featureForRace(raceKey);
  return !!f && !isFeatureEnabled(f.key);
}

/** Все ключи рас, отключённые сейчас настройками. */
export function disabledRaceKeys() {
  const out = [];
  for (const f of Object.values(FEATURES)) {
    if (!isFeatureEnabled(f.key)) out.push(...(f.raceKeys || []));
  }
  return out;
}

/** Все типы акторов, отключённые сейчас настройками. */
export function disabledActorTypes() {
  const out = [];
  for (const f of Object.values(FEATURES)) {
    if (!isFeatureEnabled(f.key)) out.push(...(f.actorTypes || []));
  }
  return out;
}

/**
 * Собирает флажки подсистем в подразделы окна настроек.
 *
 * Ядро рисует настройки системы плоским списком в порядке регистрации, поэтому
 * группу нельзя объявить декларативно: переносим её поля в собственный
 * контейнер с заголовком и опускаем в конец раздела — так под заголовок
 * не попадёт ничего постороннего.
 */
export function registerSettingsSections() {
  Hooks.on("renderSettingsConfig", (_app, element) => {
    const root = element instanceof HTMLElement ? element : (element?.[0] ?? null);
    if (!root) return;

    for (const [group, meta] of Object.entries(FEATURE_GROUPS)) {
      const fields = featureKeysInGroup(group)
        .map(k => root.querySelector(`[name="${SYSTEM_ID}.${k}"]`)?.closest(".form-group"))
        .filter(Boolean);
      if (!fields.length) continue;
      // Повторный рендер — секция уже собрана.
      if (fields[0].closest(`.wh-settings-section[data-group="${group}"]`)) continue;

      const parent = fields[0].parentElement;
      if (!parent) continue;

      const section = document.createElement("div");
      section.className = "wh-settings-section";
      section.dataset.group = group;
      const head = document.createElement("h3");
      head.className = "wh-settings-subhead";
      head.textContent = meta.label;
      section.appendChild(head);
      if (meta.hint) {
        const hint = document.createElement("p");
        hint.className = "hint wh-settings-subhint";
        hint.textContent = meta.hint;
        section.appendChild(hint);
      }
      for (const f of fields) section.appendChild(f);
      parent.appendChild(section);
    }
  });
}

/** Регистрация флажков подсистем. Вызывается в init до всего остального. */
export function registerFeatureSettings() {
  for (const key of FEATURE_ORDER) {
    const f = FEATURES[key];
    game.settings.register(SYSTEM_ID, f.key, {
      name: f.name,
      hint: f.hint,
      scope: "world",
      config: true,
      type: Boolean,
      default: f.default,
      onChange: () => {
        // Окно создания актора читает настройку на лету — перезагрузка не нужна.
        // Перерисовываем боковую панель и открытые листы затронутых типов.
        try { ui.actors?.render(); } catch (e) { /* панель ещё не готова */ }
        try {
          // Перерисовываем и «свои» типы акторов, и листы, куда подсистема
          // добавляет поля (Происхождение / Предсказание в шапке).
          const types = [...(f.actorTypes || []), ...(f.sheetTypes || [])];
          for (const a of game.actors ?? []) {
            if (types.includes(a.type)) a.sheet?.render(false);
          }
        } catch (e) { /* мир ещё не загружен */ }
      }
    });
  }
}
