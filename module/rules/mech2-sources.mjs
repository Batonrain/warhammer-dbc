// module/rules/mech2-sources.mjs
// Один источник правил на пачку элитных архетипов «mech2» (Тех Ассасин,
// Секутор, Электрожрец, Лорд Дискордант) — две строки в sources.mjs вместо
// восьми, чтобы параллельные ветки не сталкивались. Здесь НЕЛЬЗЯ импортировать
// ничего, что ведёт обратно к sources.mjs (AGENTS.md, «циклы импорта»).

import { paradoxVeilRules } from "./tech-assassin.mjs";
import { secutorRules } from "./secutor-talents.mjs";

/** Правила пачки для броска актора (actor, ctx). */
export function mech2Rules(actor, ctx = {}) {
  return [
    ...paradoxVeilRules(actor, ctx),
    ...secutorRules(actor, ctx)
  ];
}
