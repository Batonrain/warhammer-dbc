// module/migrations/disease-active.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Болезни: «действует» у уже выданных копий (wdbc-dbveg).
//
//  ЧТО СЛУЧИЛОСЬ. Решение владельца 25.10.2026: болезнь действует только когда
//  включена (system.active). Раньше isItemActive (apps/effects.mjs) для типа
//  disease отдавал true независимо от поля, поэтому записи Конструктора болезни
//  (charRecovery у Гнили Нургла, Трескающихся Костей, Хрупкой Комы, Цветения,
//  Проклятия Гнили) работали у всех, кому болезнь выдали, — а выдаётся она из пака
//  выключенной (active:false). С правкой isItemActive такие больные тихо
//  «выздоровели» бы.
//
//  ЧТО ДЕЛАЕТ. Однократно включает (active:true) уже выданные копии болезней,
//  у которых есть что терять: записи Конструктора (flags.warhammer-dbc.mechanics)
//  или ActiveEffect на самом предмете. Болезни без механики не трогает — для них
//  поле ничего не значит, а выключатель остаётся в руках ГМа. Иммунитет Метки
//  Нургла проверяется отдельно и выше (rules/disease-immunity.mjs), к этому
//  проходу отношения не имеет. Болезни в папке предметов МИРА (без владельца) не
//  трогаются: терять там нечего.
//
//  ИДЕМПОТЕНТНОСТЬ. Каждая включённая копия получает метку
//  flags.warhammer-dbc.diseaseActiveMigrated, и копию с меткой проход больше не
//  трогает: повторный прогон (runMigrationGate не ставит ключ версии при частичном
//  сбое другого актора) не включит заново то, что ГМ выключил осознанно (заражение
//  отбито). Остаточный случай: свежая копия из пака, выданная между сбойным и
//  повторным прогоном, будет включена без броска заражения — только пока в мире есть
//  стабильно сбойный актор. Несвязанные токены идут тем же гейтом: оба ключа
//  выставляются разом, «только токены» отдельно не запускается — миграция новая,
//  у неё нет миров, где ключ основного прохода уже стоял без ключа токенов.
//
//  Несвязанный токен мигрируется только в пределах своей дельты
//  (migrations/unlinked-tokens.mjs): унаследованные от базового актора болезни
//  прошли вместе с ним.
// ════════════════════════════════════════════════════════════════════════════

import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";

const FLAG = "warhammer-dbc";
/** Метка на самой копии: проход её уже включил (делает повтор безопасным). */
const DONE_FLAG = "diseaseActiveMigrated";

/** Есть ли у предмета записи Конструктора (хотя бы одна запись хотя бы в одной группе). */
function hasMechanicsEntries(item) {
  const groups = item?.flags?.[FLAG]?.mechanics;
  return Array.isArray(groups) && groups.some(g => Array.isArray(g?.entries) && g.entries.length > 0);
}

/** ActiveEffect на самом предмете (embedded) — у болезни их заводит только ГМ вручную. */
function hasOwnEffects(item) {
  const e = item?.effects;
  return !!(e && (e.size ?? e.length ?? 0) > 0);
}

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Чистая функция: ни Foundry, ни записи.
 */
export function diseaseActivePatch(item) {
  if (item?.type !== "disease" || item.system?.active) return null;
  // Копия уже прошла проход: дальше «выключено» — осознанное решение ГМа
  // (заражение отбито), повтор (частичный сбой другого актора не ставит ключ
  // версии, runMigrationGate) не должен включать её заново.
  if (item.flags?.[FLAG]?.[DONE_FLAG]) return null;
  if (!hasMechanicsEntries(item) && !hasOwnEffects(item)) return null;
  return { "system.active": true, [`flags.${FLAG}.${DONE_FLAG}`]: true };
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function diseaseActiveUpdates(items) {
  const out = [];
  for (const item of items ?? []) {
    const patch = diseaseActivePatch(item);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

async function migrateOneActor(actor, items = actor.items) {
  const updates = diseaseActiveUpdates(items);
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    // ActiveEffect самой болезни (если есть) включается вместе с ней.
    for (const u of updates) {
      const item = actor.items?.get?.(u._id);
      if (item) await syncItemEffectsDisabled(item);
    }
  }
  return updates.length;
}

/**
 * Предметы мира, акторы мира и несвязанные токены сцен (только предметы из
 * дельты токена). Ошибка на одном акторе/токене логируется и пропускается;
 * версия штампуется вызывающим кодом только при полном успехе.
 */
export async function migrateDiseaseActive({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Болезни (действует): только для ГМа."); return; }
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Болезни (действует): сбой на «${what}», пропущено:`, e); }
  };

  // Предметы папки мира (game.items) НЕ трогаются: болезнь без владельца никого
  // не лечит и не калечит, терять там нечего, а включённая заготовка отказала бы
  // в тесте заражения после перетаскивания на персонажа (disease-infection).
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Болезни с механикой включены (действуют, как раньше): ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Болезни с механикой включены (действуют, как раньше): ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
