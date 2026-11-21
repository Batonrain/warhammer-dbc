// module/rules/astartes-elite-rules.mjs
// Источник правил «astartesElite» (rules/sources.mjs) пачки элитных архетипов
// «astartes»: живые дары соратникам (rules/astartes-elite-common.mjs) и знамя
// Ни Шагу Назад (rules/gerold-talents.mjs). Только чистые модули без
// обратного пути к sources.mjs.

import { aliveBoons, boonRules, boonNow } from "./astartes-elite-common.mjs";
import { standYourGroundRules } from "./gerold-talents.mjs";

/** Правила актора от способностей пачки (свои и чужие). */
export function astartesEliteRules(actor) {
  if (!actor) return [];
  return [...boonRules(aliveBoons(actor, boonNow(actor))), ...standYourGroundRules(actor)];
}
