// module/rules/cybernetic-excellence.mjs
//
// Талант «Cybernetic Excellence / Кибернетическое Превосходство» (корбук,
// Механикум, стр. 111-ish): каждая покупка ставит ещё одну бионическую руку и
// даёт Трейт Multiple Arms (+1). Повторяемый Талант — hasRating/rating на
// самом предмете (тот же приём, что Psy Rating/Enemy, см. rules/psyker.mjs) —
// а «+1» из текста складывается в system.rating Таланта. Книжный потолок
// покупок — ½I.b+1 (окр.▼) — здесь просто формула-функция для UI/подсказки,
// НЕ enforcement: как и у прочих подобных Талантов в системе, ГМ решает сам.
//
// Чистые функции, Foundry не нужен — Foundry-часть (найти/создать/подвинуть
// сам Трейт на акторе) живёт в module/apps/cybernetic-excellence.mjs.

const NAME_RE = /cybernetic excellence|кибернетическое превосходство/i;
const MULTIPLE_ARMS_RE = /multiple arms|многоруки/i;

/** Это Cybernetic Excellence (по имени, в любом языке пары)? */
export function isCyberneticExcellence(item) {
  return item?.type === "talent" && NAME_RE.test(item.name || "");
}

/** Это Multiple Arms (по имени, в любом языке пары)? */
export function isMultipleArmsTrait(item) {
  return item?.type === "trait" && MULTIPLE_ARMS_RE.test(item.name || "");
}

/** Талант Cybernetic Excellence среди предметов актора, если есть. */
export function cyberneticExcellenceTalent(items = []) {
  return [...items].find(isCyberneticExcellence) || null;
}

/** Сколько раз куплен — 0, если Таланта нет вовсе. */
export function cyberneticExcellencePurchases(items = []) {
  const t = cyberneticExcellenceTalent(items);
  return t ? Math.max(0, Number(t.system?.rating) || 0) : 0;
}

/** Книжный потолок покупок: ½I.b+1, округление вниз (стр. книги — Механикум). */
export function cyberneticExcellenceCap(intBonus) {
  return Math.floor((Number(intBonus) || 0) / 2) + 1;
}
