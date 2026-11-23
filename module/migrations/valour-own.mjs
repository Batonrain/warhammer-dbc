// module/migrations/valour-own.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Соглашение Доблести (Кузнец Крови) у уже играющих (приёмка #597).
//
//  ЧТО СЛУЧИЛОСЬ. Обет стал механикой: оружие и броня без метки «своё»
//  (VALOUR_OWN_FLAG) считаются чужими, и атака таким оружием или надевание
//  такой брони гасит весь Архетип на 8 дней (rules/archetype-suppression.mjs).
//  Метку ставит только галочка в окне Черты — у Кузнеца Крови, созданного до
//  этого, не отмечено ничего, и первая же атака своим клинком — нарушение.
//
//  ЧТО ДЕЛАЕТ. Однократно: у актора с Чертой ставит метку на всё его оружие и
//  броню — что уже лежит на листе, считается своим (ГМ вёл обет руками).
//  ИДЕМПОТЕНТНА: отмеченное не трогается. Несвязанный токен с основой в мире
//  видит метки основы и не трогается; своё снаряжение токена — отмечается.
// ════════════════════════════════════════════════════════════════════════════

import { hasValourousAccord, isValourOwn, VALOUR_OWN_FLAG } from "../rules/archetype-suppression.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

const NS = "warhammer-dbc";

/** Оружие и броня актора без метки «своё» (чистая функция). */
export function valourOwnPending(actor) {
  if (!hasValourousAccord(actor)) return [];
  return [...(actor?.items ?? [])].filter(i => (i.type === "weapon" || i.type === "armor") && !isValourOwn(i));
}

async function migrateOneActor(actor) {
  const items = valourOwnPending(actor);
  if (!items.length) return 0;
  await actor.updateEmbeddedDocuments("Item", items.map(i => ({ _id: i.id, [`flags.${NS}.${VALOUR_OWN_FLAG}`]: true })));
  return 1;
}

export async function migrateValourOwn({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Соглашение Доблести: только для ГМа."); return; }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Соглашение Доблести: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor));
  }
  const msg = `Соглашение Доблести: снаряжение отмечено своим у ${fixed}${failed ? `; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира` : ""}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
