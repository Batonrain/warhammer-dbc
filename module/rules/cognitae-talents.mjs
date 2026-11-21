// module/rules/cognitae-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Когнитэ — чистая часть. Кнопки — combat/cognitae.mjs.
//
//  • Гипно-Программирование: навык (W)+0, «развивается как Неделимый» —
//    ступень навыка хранится меткой hypnoAdvance на Черте (0/10/20/30),
//    тест встречный против W+0 жертвы; Астартес с Каталептическим Узлом
//    −30; Механикус иммунны. Длительное воздействие копит Успехи на жертве
//    до 10×W.b.
//  • Ритуал Восьми Спиц: срок жертвы — метка eightSpokes { deadline, vision }
//    на Когнитэ; за каждую начатую неделю опоздания −10 к тестам кнопок
//    Черт и Талантов архетипа (их считает этот файл).
//  • Искажённый Зов — 3 Успеха Гипно-Программирования на Астропате.
//  • Совершенная Маска — комбинированный Tech-Use−20 и Schol.Lore(Occult)−20,
//    неделя до калибровки. Замещающая Вуаль — сутки.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const DAY = 86400;
export const WEEK = 7 * DAY;
export const EIGHT_SPOKES_FLAG = "eightSpokes";
export const HYPNO_ADVANCE_FLAG = "hypnoAdvance";
export const HYPNO_PROGRESS_FLAG = "hypnoProgress";
export const CORRUPTED_CALL_FLAG = "corruptedCall";
export const PERFECT_MASK_FLAG = "perfectMask";
export const PROXY_VEIL_FLAG = "proxyVeil";
export const CORRUPTED_CALL_COST = 3;
export const CATALEPTIC_PENALTY = -30;

export const hasHypnoProgramming = a => hasItemNamed(a, "Hypno-Programming", ["trait"]);
export const hasEightSpokes = a => hasItemNamed(a, "Ritual of Eight Spokes", ["trait"]);
export const hasCorruptedCall = a => hasItemNamed(a, "Corrupted Call", ["talent"]);
export const hasPerfectMask = a => hasItemNamed(a, "Perfect Mask", ["talent"]);
export const hasProxyVeil = a => hasItemNamed(a, "Proxy Veil", ["talent"]);
export const hasThousandPapercuts = a => hasItemNamed(a, "Thousand Papercuts", ["talent"]);
export const hasCatalepseanNode = a => hasItemNamed(a, "Catalepsean Node");

const flagOf = (a, k) => a?.flags?.["warhammer-dbc"]?.[k] ?? a?.getFlag?.("warhammer-dbc", k);

/** Ступень навыка Гипно-Программирования: 0/10/20/30 (метка на Черте). */
export function hypnoAdvance(actor) {
  const trait = [...(actor?.items ?? [])].find(i => i.type === "trait" && hasItemNamed({ items: [i] }, "Hypno-Programming", ["trait"]));
  const v = Number(trait?.flags?.["warhammer-dbc"]?.[HYPNO_ADVANCE_FLAG] ?? trait?.getFlag?.("warhammer-dbc", HYPNO_ADVANCE_FLAG)) || 0;
  return Math.max(0, Math.min(30, Math.round(v / 10) * 10));
}

/** Штраф Ритуала Восьми Спиц: −10 за каждую начатую неделю после срока. */
export function eightSpokesPenalty(actor, now = 0) {
  if (!hasEightSpokes(actor)) return 0;
  const f = flagOf(actor, EIGHT_SPOKES_FLAG);
  const deadline = Number(f?.deadline);
  if (!Number.isFinite(deadline) || !f) return 0;
  const late = Number(now) - deadline;
  if (late <= 0) return 0;
  return -10 * Math.ceil(late / WEEK);
}

/** Поправка жертвы во встречном тесте W против гипноза. */
export function hypnoVictimMod(victim) {
  return hasCatalepseanNode(victim) ? CATALEPTIC_PENALTY : 0;
}

/** Длительное воздействие: сколько Успехов нужно для смены личности — 10×W.b. */
export function hypnoPersonalityNeed(victim) {
  return 10 * Math.max(0, Number(victim?.system?.characteristics?.wp?.bonus) || 0);
}

/** Копилка длительного воздействия на жертве (по этому Когнитэ). */
export function hypnoProgress(victim, cognitaeUuid) {
  const f = flagOf(victim, HYPNO_PROGRESS_FLAG);
  return f && f.by === cognitaeUuid ? Math.max(0, Number(f.total) || 0) : 0;
}

/** Действует ли метка со сроком { until } сейчас. */
export function timedFlagActive(actor, key, now = 0) {
  const f = flagOf(actor, key);
  return !!f && Number(f.until) > Number(now);
}
