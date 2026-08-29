// module/rules/squad.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ ОТРЯДА — Слаженность (зажатая в ±40) и её толкование, потолок
//  Успехов по уровню Риска, признак Сломленного Отряда.
//
//  Здесь — только чистая арифметика по собственным данным отряда. Всё, что
//  требует чтения связанных акторов (Командир, участники), считается в листе:
//  прочитать чужой документ в prepareDerivedData на этапе загрузки мира нельзя.
//  Вызывается из documents/actor.mjs (_prepareSquadData) — вынесена из
//  монолита prepareDerivedData (wdbc-yo4n).
// ════════════════════════════════════════════════════════════════════════════

import { COHESION_LIMIT, COHESION_START_CAP, RISK_LEVELS,
         cohesionBand, cohesionBonus, riskCap } from "../constants/squad.mjs";

/**
 * Производные данные Отряда. Мутирует system.derived и зажимает
 * system.cohesion.* / system.risk в допустимые пределы.
 *
 * @param {object} system system актора (мутируется)
 */
export function prepareSquadDerived(system) {
  const coh = system.cohesion || (system.cohesion = { base: 0, start: 0, value: 0 });
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(Number(v) || 0)));

  coh.base  = clamp(coh.base,  COHESION_START_CAP);
  coh.start = clamp(coh.start, COHESION_START_CAP);
  coh.value = clamp(coh.value, COHESION_LIMIT);

  const value = coh.value;
  const band  = cohesionBand(value);
  const risk  = Math.max(1, Math.min(5, Number(system.risk) || 1));
  system.risk = risk;

  system.derived = {
    cohesion:        value,
    cohesionCmd:     cohesionBonus(value, false),   // модификатор Команд Командира/Лидера
    cohesionCoord:   cohesionBonus(value, true),    // модификатор Команд Координатора
    cohesionBand:    band.key,
    cohesionLabel:   band.label,
    cohesionHint:    band.hint,
    // Шкала −40…+40 в процентах (для полосы состояния).
    cohesionPct:     Math.round((value + COHESION_LIMIT) / (COHESION_LIMIT * 2) * 100),
    belowStart:      value < coh.start,             // условие Детальной Команды «Сплочение»
    broken:          value < 0,                     // отряд может проходить тесты Сломленного Отряда
    risk,
    riskCap:         riskCap(risk),
    riskLabel:       RISK_LEVELS.find(r => r.level === risk)?.label || "",
    memberCount:     Array.isArray(system.members) ? system.members.length : 0
  };
}
