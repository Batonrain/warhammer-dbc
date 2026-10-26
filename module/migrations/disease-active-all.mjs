// module/migrations/disease-active-all.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Болезни: «действует» у ВСЕХ уже выданных копий (task-3ab7, решение владельца
//  26.10.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Проход disease-active.mjs (wdbc-dbveg) включал только болезни с
//  записями Конструктора или ActiveEffect — тем, у кого было что терять. Но
//  Чумной Пастырь (rules/plague-shepherd.mjs::isInfected) теперь считает
//  заражёнными только болезни с system.active === true, а раньше засчитывал любую
//  выданную. Выдавались болезни выключенными (active:false), поэтому у
//  существующих отрядов Нурглитов «свободная Короткая Команда» пропала бы: у
//  Скверны Нургла, Чумного Дыхания и прочих болезней без механики active так и
//  остался false.
//
//  ЧТО ДЕЛАЕТ. Однократно включает (active:true) каждую выданную копию болезни на
//  акторе, у которой ещё нет метки diseaseActiveMigrated — то есть которую не
//  включал и первый проход. Метку получает и эта копия.
//
//  ЧЕГО НЕ ТРОГАЕТ.
//   • Копии с меткой diseaseActiveMigrated: их включил первый проход, и если ГМ
//     выключил такую после заражения (болезнь отбита) — это осознанное решение.
//   • Болезни папки предметов МИРА (без владельца): включённая заготовка отказала
//     бы в тесте заражения после перетаскивания на персонажа (disease-infection).
//   • Уже включённые копии.
//   Иммунитет Метки Нургла и Stuff of Nightmares (rules/disease-immunity.mjs) к
//   проходу отношения не имеет: он гасит действие болезни выше, в isItemActive.
//
//  ОСТАТОЧНЫЙ РИСК. Отличить «выдана выключенной, ждёт теста заражения» от «ГМ
//  выключил после заражения» без метки нельзя: болезни, которые ГМ положил на
//  актора выключенными ПОСЛЕ 25.10.2026 и ещё не прогнал тест заражения, этот
//  проход тоже включит. Он однократный; такие копии ГМ выключает кнопкой «Действует».
//
//  ИДЕМПОТЕНТНОСТЬ. Включённая копия несёт метку и больше не трогается — повтор
//  (runMigrationGate не ставит ключ версии при частичном сбое другого актора) не
//  включит заново то, что ГМ выключил после этого прохода. Отдельный ключ версии
//  (diseaseActiveAllVersion): disease-active уже выпущен, поднимать его VERSION
//  нельзя. Несвязанный токен — только предметы его дельты (unlinked-tokens.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";
import { DONE_FLAG } from "./disease-active.mjs";

const FLAG = "warhammer-dbc";

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Чистая функция: ни Foundry, ни записи.
 */
export function diseaseActiveAllPatch(item) {
  if (item?.type !== "disease" || item.system?.active) return null;
  if (item.flags?.[FLAG]?.[DONE_FLAG]) return null;
  return { "system.active": true, [`flags.${FLAG}.${DONE_FLAG}`]: true };
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function diseaseActiveAllUpdates(items) {
  const out = [];
  for (const item of items ?? []) {
    const patch = diseaseActiveAllPatch(item);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

async function migrateOneActor(actor, items = actor.items) {
  const updates = diseaseActiveAllUpdates(items);
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
 * Акторы мира и несвязанные токены сцен (только предметы из дельты токена). Ошибка
 * на одном акторе/токене логируется и пропускается; версия штампуется вызывающим
 * кодом только при полном успехе.
 */
export async function migrateDiseaseActiveAll({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Болезни (все выданные): только для ГМа."); return; }
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Болезни (все выданные): сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Выданные болезни включены (действуют, как раньше): ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Выданные болезни включены (действуют, как раньше): ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
