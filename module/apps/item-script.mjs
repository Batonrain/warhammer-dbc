// module/apps/item-script.mjs
// ════════════════════════════════════════════════════════════════════════
//  ИСПОЛНЕНИЕ произвольного JS на предмете. С появления единого Конструктора
//  (module/apps/mechanics.mjs, вкладка «МЕХАНИКА») это больше не отдельная
//  вкладка листа — «Код» стал одним из видов записи в общем списке. Файл
//  остался как есть и по двум причинам:
//   1) executeItemCode() — общий исполнитель, которым пользуется и запись
//      kind:"script" в mechanics.mjs, и старые предметы;
//   2) обратная совместимость: предметы, созданные ДО объединения (в т.ч.
//      старые записи warhammer-dbc.script-library до их миграции), хранят
//      код по-старому — flags.warhammer-dbc.scripts[] (массив) или совсем
//      старый плоский flags.warhammer-dbc.script/scriptAutoRun. runAutoScripts()
//      по-прежнему вызывается из Hooks.on("createItem", ...) в
//      warhammer-dbc.mjs, так что такие предметы продолжают работать без
//      вмешательства — просто их код больше не отображается ни на какой
//      вкладке (нечем редактировать старый формат, кроме прямого редактора
//      флагов). Практических таких предметов в этом проекте почти нет — сам
//      компендиум warhammer-dbc.script-library удалён за ненадобностью,
//      его шаблоны полностью заменены видами записи Конструктора.
//
//  Тот же троян доверия, что и у обычных макросов Foundry: кто может
//  редактировать предмет, тот может редактировать произвольный код на нём.
//  Ничего не песочница — контекст (actor/item/token) передаётся как есть.
// ════════════════════════════════════════════════════════════════════════

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/** Общий исполнитель произвольного JS предмета — используется отовсюду. */
export async function executeItemCode(item, code, event) {
  const actor = item.actor ?? null;
  const token = actor?.getActiveTokens?.(true)[0] ?? null;
  const speaker = ChatMessage.getSpeaker({ actor, token });
  const fn = new AsyncFunction(
    "item", "actor", "token", "speaker", "game", "ui", "ChatMessage", "event",
    code
  );
  await fn(item, actor, token, speaker, game, ui, ChatMessage, event ?? null);
}

/**
 * Нормализованный список скриптов предмета — всегда массив {id, name, code,
 * autoRun}, независимо от того, в каком формате они реально хранятся.
 */
export function getItemScripts(item) {
  const arr = item.getFlag("warhammer-dbc", "scripts");
  if (Array.isArray(arr) && arr.length) return arr;
  const legacy = (item.getFlag("warhammer-dbc", "script") || "").trim();
  if (!legacy) return [];
  return [{
    id: "legacy", name: "Скрипт", code: legacy,
    autoRun: !!item.getFlag("warhammer-dbc", "scriptAutoRun")
  }];
}

/**
 * Выполняет ОДИН скрипт предмета — по id записи (кнопка «▶» у конкретного
 * блока). Без scriptId выполняет первый по порядку (страховка для старых
 * вызовов без id — в интерфейсе такого пути больше нет, каждая кнопка
 * всегда передаёт свой id).
 */
export async function runItemScript(item, { event, scriptId } = {}) {
  const scripts = getItemScripts(item);
  const entry = scriptId ? scripts.find(s => s.id === scriptId) : scripts[0];
  const code = (entry?.code || "").trim();
  if (!code) {
    return ui.notifications.warn(
      `У предмета «${item.name}» не задан скрипт${scriptId ? " (эта запись пуста)" : " (вкладка «Скрипты»)"}.`
    );
  }
  try {
    await executeItemCode(item, code, event);
  } catch (e) {
    const label = entry?.name || item.name;
    console.error(`Warhammer DBC | Ошибка скрипта «${label}» предмета «${item.name}»:`, e);
    ui.notifications.error(`Скрипт «${label}»: ${e.message}`);
  }
}

/**
 * Выполняет по очереди ВСЕ скрипты предмета, отмеченные autoRun — вызывается
 * из Hooks.on("createItem", ...) в warhammer-dbc.mjs. Последовательно (не
 * Promise.all), чтобы порядок блоков был предсказуем, если один зависит от
 * состояния, оставленного предыдущим.
 */
export async function runAutoScripts(item) {
  for (const entry of getItemScripts(item)) {
    if (entry.autoRun && (entry.code || "").trim()) {
      await runItemScript(item, { scriptId: entry.id });
    }
  }
}
