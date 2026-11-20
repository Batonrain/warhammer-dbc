// module/rules/jury-rigging.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Jury Rigging / На Честном Слове (Талант Крафта; Разобрать 6wmql). Книга:
//  «Персонаж может починить поломку, обычно требующую до ½ смены, за одно
//  полное действие, но уменьшает Качество предмета/машины на 1. Если тест на
//  использование устройства вызвал Крит-Провал, оно сразу ломается.
//  Полноценный ремонт снимает штрафы.»
//
//  Наспех починенное оружие несёт флаг JURY_RIGGED_FLAG с прежним Качеством:
//  кнопка «Полный ремонт» на листе возвращает его, Критический Провал атаки
//  этим оружием снова ставит system.destroyed (combat/attack.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const JURY_RIGGED_FLAG = "juryRigged";
const ORDER = ["poor", "common", "good", "best"];

export function hasJuryRigging(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Jury Rigging"));
}

/** Качество на ступень ниже (Poor.Q — ниже некуда). */
export function qualityStepDown(q) {
  const i = ORDER.indexOf(String(q || "common"));
  return ORDER[Math.max(0, (i < 0 ? 1 : i) - 1)];
}

/** Предмет починен наспех: прежнее Качество или null. */
export function juryRiggedOriginal(item) {
  const f = item?.flags?.["warhammer-dbc"]?.[JURY_RIGGED_FLAG] ?? item?.getFlag?.("warhammer-dbc", JURY_RIGGED_FLAG);
  return f?.quality ?? null;
}

/** Ломается ли наспех починенное оружие от этого броска. */
export function juryRigBreaks(item, critOutcome) {
  return !!critOutcome?.failure && juryRiggedOriginal(item) != null;
}
