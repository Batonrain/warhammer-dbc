// module/migrations/string-list-restore.mjs
// ════════════════════════════════════════════════════════════════════════
//  Восстановление строк-ключей, потерянных прежней схемой (wdbc-x1nz.2.81).
//
//  ЧТО СЛУЧИЛОСЬ. Свойства брони, пути отравления препарата и снимаемые
//  модификацией оружия свойства хранились списком строк, а схема описывала
//  их как ArrayField(ObjectField): Foundry молча превращал каждую строку в
//  {}. Предмет, хоть раз правленный в игре, терял все такие ключи — у брони
//  переставали работать Мягкая, Проводящая, Герметичная, Флак…
//
//  Схема исправлена (data/string-list.mjs), а migrateData заменил каждый
//  потерянный {} меткой LOST_KEY. Здесь метки превращаются обратно в ключи:
//  предмет, взятый из компендиума (_stats.compendiumSource, старое
//  flags.core.sourceId), получает список своего источника целиком. Предмет
//  без источника (собран руками) восстановить не из чего — метки снимаются,
//  а его имя называется в сводке, чтобы ГМ проставил свойства сам.
//
//  Приём — тот же, что nimble-rating.mjs: чистая функция для теста, правка
//  одного предмета, изоляция сбоя по актору, отдельный проход по несвязанным
//  токенам сцен.
// ════════════════════════════════════════════════════════════════════════

import { LOST_KEY } from "../data/string-list.mjs";

/** Какие поля каких типов — списки строк-ключей, пострадавшие от схемы. */
export const STRING_LIST_FIELDS = {
  armor:     ["properties"],
  drug:      ["poisonVector"],
  weaponMod: ["effects.removeProps", "effects.mechRemoveProps"]
};

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

/**
 * Что записать в поле. Меток нет — null (не трогать). Есть источник — его
 * список (строки), иначе — текущий без меток.
 */
export function restoredStringList(current, sourceList) {
  if (!Array.isArray(current) || !current.includes(LOST_KEY)) return null;
  if (Array.isArray(sourceList)) return sourceList.filter(v => typeof v === "string" && v !== LOST_KEY);
  return current.filter(v => v !== LOST_KEY);
}

/** uuid компендиума-источника предмета, если он известен. */
function sourceUuidOf(item) {
  return item._stats?.compendiumSource || item.flags?.core?.sourceId || "";
}

/**
 * Правит ОДИН предмет. @returns {"restored"|"stripped"|null}
 * restored — ключи взяты из источника; stripped — источника нет, метки сняты.
 */
export async function restoreItemStringLists(item) {
  const paths = STRING_LIST_FIELDS[item?.type];
  if (!paths) return null;
  const damaged = paths.filter(p => (getPath(item.system, p) ?? []).includes?.(LOST_KEY));
  if (!damaged.length) return null;
  const uuid = sourceUuidOf(item);
  const source = uuid ? await fromUuid(uuid).catch(() => null) : null;
  const update = {};
  for (const p of damaged) {
    update[`system.${p}`] = restoredStringList(getPath(item.system, p), source ? getPath(source.system, p) ?? [] : null);
  }
  await item.update(update);
  return source ? "restored" : "stripped";
}

async function migrateCollection(items, tally, owner = "") {
  for (const item of items) {
    const r = await restoreItemStringLists(item);
    if (r === "restored") tally.restored++;
    if (r === "stripped") tally.stripped.push(owner ? `${item.name} (${owner})` : item.name);
  }
}

/**
 * Все предметы мира, предметы акторов и несвязанных токенов сцен. Ошибка на
 * одном акторе/токене логируется и пропускается; версия штампуется
 * вызывающим кодом только при полном успехе.
 */
export async function migrateStringListRestore() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Восстановление свойств брони: только для ГМа.");
    return;
  }
  const tally = { restored: 0, stripped: [] };
  let failed = 0;
  const guarded = async (fn, what) => {
    try { await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Восстановление свойств: сбой на «${what}», пропущено:`, e); }
  };

  await guarded(() => migrateCollection(game.items ?? [], tally), "предметы мира");
  for (const actor of game.actors ?? []) await guarded(() => migrateCollection(actor.items, tally, actor.name), actor.name);
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink || !tokenDoc.actor) continue;
      await guarded(() => migrateCollection(tokenDoc.actor.items, tally, tokenDoc.name), `${tokenDoc.name} (${scene.name})`);
    }
  }

  const parts = [`восстановлено предметов — ${tally.restored}`];
  if (tally.stripped.length) parts.push(`без источника в компендиуме, проставьте свойства вручную: ${tally.stripped.join(", ")}`);
  if (failed) parts.push(`${failed} пропущено из-за ошибок — повторится при следующей загрузке`);
  const msg = `Свойства брони и модификаций: ${parts.join("; ")}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (tally.restored || tally.stripped.length || failed) ui.notifications?.[failed || tally.stripped.length ? "warn" : "info"]("Warhammer DBC: " + msg, { permanent: !!tally.stripped.length });
  return { restored: tally.restored, stripped: tally.stripped, failed };
}
