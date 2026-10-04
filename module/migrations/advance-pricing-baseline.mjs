// module/migrations/advance-pricing-baseline.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Цены Продвижения после сверки «Опыт»/«Склонности» (04.10.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Два изменения расчёта цены легли поверх уже живых миров:
//   1. умолчание мира сменено со «Склонностей» на «Покровительство» —
//      constants/patronage.mjs::DEFAULT_PRICING_MODE. Там, где ГМ настройку
//      ни разу не сохранял, режим сменился бы молча: пропала бы панель
//      Склонностей, а цены у не-Хаоситов стали бы Нейтральными;
//   2. Таланты Элитных Архетипов стали Нейтральными по Склонностям (стр. 24),
//      а цена покупки Таланта из окна выбора — считаться по режиму персонажа.
//  Уже записанные на листах цены пересчитываются только при смене Склонностей,
//  Покровителя или режима, так что у живых персонажей держалась бы старая.
//
//  ЧТО ДЕЛАЕТ. Решение владельца 04.10.2026:
//   • мир, у которого настройка «Система цен Продвижения» ни разу не
//     сохранялась И в котором уже есть Персонажи, закрепляется на прежних
//     «Склонностях». Новый пустой мир остаётся на книжном умолчании;
//   • затем цены всех купленных продвижений Персонажей пересчитываются общим
//     проходом (sheets/tabs/advance.mjs::recalcAllAdvanceCosts). Ручные цены
//     (costManual) он не трогает.
//
//  Идемпотентна: закрепление пропускается, когда настройка уже сохранена, а
//  пересчёт всегда даёт то же число. Несвязанные токены не обходятся: у них
//  дельта, а не свои Склонности, и цена считается от базового актора.
// ════════════════════════════════════════════════════════════════════════════

import { SYSTEM_ID, refreshTalentGodIndex } from "../constants/patronage.mjs";
import { recalcAllAdvanceCosts } from "../sheets/tabs/advance.mjs";

const SETTING = "advancePricingMode";

/** Сохранялась ли настройка в этом мире хоть раз (а не просто есть умолчание). */
export function advancePricingSaved() {
  try {
    return !!game.settings.storage?.get?.("world")?.getSetting?.(`${SYSTEM_ID}.${SETTING}`);
  } catch (e) { return true; } // не смогли проверить — настройку не трогаем
}

export async function migrateAdvancePricing() {
  if (!game.user?.isGM) { ui.notifications?.warn("Цены Продвижения: только для ГМа."); return; }
  const characters = [...(game.actors ?? [])].filter(a => a.type === "character");

  let pinned = false;
  if (characters.length && !advancePricingSaved()) {
    await game.settings.set(SYSTEM_ID, SETTING, "aptitude");
    pinned = true;
  }

  // Цена Таланта по Покровительству берёт Бога из кэша пака: до его
  // построения считалось бы по запасной библиотеке (она отстаёт от пака).
  await refreshTalentGodIndex();

  let fixed = 0;
  let failed = 0;
  for (const actor of characters) {
    try { await recalcAllAdvanceCosts(actor); fixed++; }
    catch (e) { failed++; console.error(`Warhammer DBC | Цены Продвижения: сбой на «${actor.name}», пропущено:`, e); }
  }

  const msg = `Цены Продвижения пересчитаны у ${fixed} персонажей`
    + (pinned ? "; режим мира закреплён на «Склонностях» (как было до 04.10.2026)" : "")
    + (failed ? `; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира` : "") + ".";
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed, pinned };
}
