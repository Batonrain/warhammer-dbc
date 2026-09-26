// module/migrations/limb-loss-sides.mjs
// ════════════════════════════════════════════════════════════════════════
//  Потеря конечностей по сторонам у уже покалеченных (приёмка #518-#526).
//
//  ЧТО СЛУЧИЛОСЬ. wdbc-x1nz.2.100 перенёс потерю из conditions.lostX /
//  lostXCount / lostXGangreneAt в system.lostLimbs. Схема старых полей не
//  описывает и вычищает их при загрузке. migrateData (rules/limb-loss.mjs::
//  migrateLegacyLimbLoss) раскладывает их по сторонам в памяти, пока у
//  документа нет своего lostLimbs, — но сервер Foundry правит документ
//  диффом, и первая же частичная запись lostLimbs (вернули одну руку)
//  оставила бы в базе только её, а вторая потерянная «отросла» бы при
//  следующей загрузке. Поэтому разложенное записывается целиком, один раз.
//
//  Несвязанный токен: system дельты — ObjectField, старые поля там живут
//  нетронутыми, а синтетический актор получает lostLimbs базового (с
//  умолчаниями), и migrateData до дельты не доходит. Дельта разбирается
//  здесь: её старые поля перекрывают базового актора по своим ключам.
// ════════════════════════════════════════════════════════════════════════

import { legacyLimbLossSides } from "../rules/limb-loss.mjs";
import { unlinkedTokens, deltaSystem } from "./unlinked-tokens.mjs";

const hasLoss = (lostLimbs) => Object.values(lostLimbs ?? {}).some(e => e?.lost);

/**
 * Полный lostLimbs для записи в дельту токена или null: старых полей в
 * дельте нет, либо дельта уже несёт свой lostLimbs.
 */
export function tokenLimbLossPatch(deltaSys, currentLostLimbs) {
  if (!deltaSys?.conditions || deltaSys.lostLimbs !== undefined) return null;
  const byKey = legacyLimbLossSides(deltaSys.conditions);
  if (!Object.keys(byKey).length) return null;
  return Object.assign(structuredClone(currentLostLimbs ?? {}), ...Object.values(byKey));
}

/**
 * Прогон по миру. Идемпотентно: запись та же, что уже в памяти. Сбой на
 * акторе/токене логируется и пропускается; версию вызывающий код штампует
 * только при failed === 0.
 */
export async function migrateLimbLossSides() {
  if (!game.user?.isGM) return;
  let actors = 0;
  let tokens = 0;
  let failed = 0;

  for (const actor of game.actors) {
    const lostLimbs = actor._source?.system?.lostLimbs;
    if (!hasLoss(lostLimbs)) continue;
    try { await actor.update({ "system.lostLimbs": lostLimbs }); actors++; }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | Потеря конечностей: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  for (const { tokenDoc, actor } of unlinkedTokens()) {
    const patch = tokenLimbLossPatch(deltaSystem(tokenDoc), actor._source?.system?.lostLimbs);
    if (!patch) continue;
    try { await actor.update({ "system.lostLimbs": patch }); tokens++; }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | Потеря конечностей: сбой на токене «${tokenDoc.name}» (${tokenDoc.id}), пропущен:`, e);
    }
  }

  const msg = `Потеря конечностей по сторонам: акторов — ${actors}, токенов — ${tokens}` +
    (failed ? `; ${failed} пропущено из-за ошибок — миграция повторится при следующей загрузке мира.` : ".");
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (actors || tokens || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { actors, tokens, failed };
}
