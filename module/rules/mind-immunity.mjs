// module/rules/mind-immunity.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Иммунитет к психосилам, влияющим на разум — Трейт «Не От Мира Сего»
//  (From Beyond): «иммунен к психосилам, влияющим на разум (Телепатия из
//  подгрупп Мезмеризма/Иллюзионизма, отдельные психосилы Тзинча и Слаанеш),
//  если сам не пожелает, чтобы они на него подействовали».
//
//  Телепатия: подтип «Мезмеризм» или «Иллюзионизм». «Отдельные психосилы Тзинча и
//  Слаанеш» — силы дисциплин Богов с подтипом «Влияющие на разум»: категория заведена
//  пустой (решение владельца 14.11.2026), силы туда внесут при ревью психосил.
//  Гейт стоит перед открытием «Теста Сопротивления» (hooks.mjs) и спрашивает
//  игрока, пустить ли силу (оговорка «если сам не пожелает»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const MIND_IMMUNE_CAPABILITY = "psychic.mindImmune";

/** Подтипы Телепатии, которые считаются «влияющими на разум». */
export const MIND_SUBTYPES = new Set(["мезмеризм", "иллюзионизм"]);

/** Подтип-разметка в дисциплинах Богов (Тзинч, Слаанеш): силы Бога, влияющие на разум. */
export const GOD_MIND_SUBTYPE = "влияющие на разум";
export const GOD_MIND_DISCIPLINES = new Set(["tzeentch", "slaanesh"]);

/** Это сила «на разум»: Телепатия (Мезмеризм/Иллюзионизм) или сила Тзинча/Слаанеш с подтипом-разметкой. */
export function isMindPower(discipline, subtype) {
  const d = String(discipline || "").trim().toLowerCase();
  const t = String(subtype || "").trim().toLowerCase();
  return (d === "telepathy" && MIND_SUBTYPES.has(t)) || (GOD_MIND_DISCIPLINES.has(d) && t === GOD_MIND_SUBTYPE);
}

/** Гасит ли иммунитет эту силу у этой цели (до вопроса «пустить?»). */
export function mindImmunityBlocksPower(targetActor, discipline, subtype) {
  // «Извне» (Медуза) — и по имени: старая копия без ключа (приёмка #581). Имя
  // русское: английское «From Beyond» носят и демоны бестиария с другим текстом.
  return isMindPower(discipline, subtype) && hasAbility(targetActor, MIND_IMMUNE_CAPABILITY, "Извне", "trait");
}
