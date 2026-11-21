// module/migrations/trait-shields.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Встроенный щит-купол уже созданным Облитераторам (Sahara 576-51a6, 21.11.2026).
//
//  Щит Черты (combat/trait-shield.mjs) создаёт хук createItem в момент выдачи
//  Черты. Облитератор, взявший «Тело Из Плотеметалла» до появления щита, его
//  не получил бы никогда. Прогон однократный: у каждого актора (и несвязанного
//  токена) сверяет встроенные щиты с Чертами — создаёт недостающий, снимает
//  лишний. ИДЕМПОТЕНТНА: повтор ничего не меняет.
// ════════════════════════════════════════════════════════════════════════════

import { needsTraitShieldSync, syncTraitShields, TRAIT_SHIELDS, traitShieldPlan } from "../combat/trait-shield.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

/** Нужна ли актору правка щитов (чистая функция). */
export const traitShieldsOutOfSync = actor => needsTraitShieldSync(actor)
  && TRAIT_SHIELDS.some(spec => { const p = traitShieldPlan(actor, spec); return p.create > 0 || p.remove.length > 0; });

async function migrateOneActor(actor) {
  if (!traitShieldsOutOfSync(actor)) return 0;
  await syncTraitShields(actor);
  return 1;
}

export async function migrateTraitShields({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Встроенные щиты Черт: только для ГМа."); return; }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Встроенные щиты Черт: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor));
  }
  const msg = `Встроенные щиты Черт сверены: ${fixed}${failed ? `; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира` : ""}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
