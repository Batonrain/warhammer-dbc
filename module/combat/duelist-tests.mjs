// module/combat/duelist-tests.mjs
// Общие броски кнопок пачки «дуэлянты» (Ворон, Виткис, Гладиатор, Воин Ноты,
// Питати): тест одного персонажа с модификаторами реестра правил и встречный
// тест двух персонажей с карточкой в чат. Здесь нет правил архетипов — только
// арифметика броска, чтобы пять файлов не копировали её.

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { skillWithChar, hasFalseBlade } from "../rules/raven-talents.mjs";

/** Первая цель игрока на сцене (актор токена) или null. */
export function firstTargetActor() {
  return [...(game.user?.targets ?? [])][0]?.actor ?? null;
}

/** Все цели игрока (акторы токенов). */
export function targetActors() {
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

/**
 * Специализация группового Навыка: «Trade (Dancer)(A)». Характеристика + Ранг
 * записи (нетренированный −20) + её постоянный мод.
 */
export function groupSpecValue(actor, group, specKey, charKey) {
  const list = actor?.system?.groupSkills?.[group];
  const entry = Array.isArray(list)
    ? list.find(e => e?.specKey === specKey || new RegExp(specKey, "i").test(String(e?.specialty ?? e?.name ?? "")))
    : null;
  const ch = Number(actor?.system?.characteristics?.[charKey]?.total) || 0;
  if (!entry) return { value: ch - 20, trained: false };
  const rank = SKILL_RANKS[entry.rank]?.bonus ?? -20;
  return { value: ch + rank + (Number(entry.mod) || 0), trained: rank > -20 };
}

/** WS стороны встречного теста: с Ложным Клинком — лучшее из WS и Deceive(WS). */
export function wsSide(actor) {
  const ws = Number(actor?.system?.characteristics?.ws?.total) || 0;
  if (hasFalseBlade(actor)) {
    const dec = skillWithChar(actor, "deceive", "ws");
    if (dec > ws) return { label: "Deceive(WS)", value: dec, ctx: { kind: "skill", char: "ws", skill: "deceive" } };
  }
  return { label: "WS", value: ws, ctx: { kind: "skill", char: "ws" } };
}

/**
 * Бросок одной стороны: { roll, rv, threshold, success, deg, line }.
 * ctx — контекст сбора модификаторов (rules/roll-mods.mjs).
 */
export async function rollSide(actor, { label, base, mod = 0, modLabel = "", ctx = {}, targetActor = null }) {
  const rm = collectTestMods(actor, { ...ctx, targetActor });
  const threshold = base + mod + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const parts = [mod ? `${modLabel} ${mod >= 0 ? "+" : ""}${mod}`.trim() : "", ...rm.parts];
  return { roll, rv: roll.total, threshold, success, deg, line: rollStatLine({ label, base, parts, threshold, rv: roll.total }) };
}

/**
 * Тест персонажа с карточкой. Возвращает исход броска.
 * `lines(res)` — строки карточки по исходу.
 */
export async function rollTestCard(actor, { icon = "🎲", title, label, base, mod = 0, modLabel = "", ctx = {}, targetActor = null, lines = () => [] }) {
  const res = await rollSide(actor, { label, base, mod, modLabel, ctx, targetActor });
  await postTestCard(actor, {
    icon, title: `${title} — ${esc(actor.name)}`,
    threshold: res.line,
    outcome: outcomeHtml(res.success, `${res.success ? "Успех" : "Провал"} — ${res.deg} ${_degWord(res.deg)}`),
    lines: lines(res).filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)
  }, { rolls: [res.roll] });
  return res;
}

/**
 * Встречный тест двух персонажей одной карточкой (бросают обе стороны сразу —
 * так же, как кнопки Талантов в combat/elite-buttons.mjs).
 * sides: { label, base, mod, modLabel, ctx } для каждой стороны.
 * @returns {Promise<{mine, theirs, winner:"mine"|"theirs"|null, margin:number}>}
 */
export async function opposedTestCard(actor, target, { icon = "⚔️", title, mine, theirs, lines = () => [] }) {
  const a = await rollSide(actor, { ...mine, targetActor: target });
  const b = await rollSide(target, { ...theirs, targetActor: actor });
  const { winner, margin } = resolveOpposed(
    { success: a.success, deg: a.deg, threshold: a.threshold },
    { success: b.success, deg: b.deg, threshold: b.threshold });
  const res = { mine: a, theirs: b, winner, margin };
  const sideTxt = (n, r) => `${esc(n)}: ${r.success ? "Успех" : "Провал"} ${r.deg} ${_degWord(r.deg)}`;
  await postTestCard(actor, {
    icon, title: `${title} — ${esc(actor.name)} против ${esc(target.name)}`,
    threshold: a.line,
    lines: [`<div class="roll-threshold">${esc(target.name)}:</div>`, b.line,
      ...lines(res).filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)],
    outcome: outcomeHtml(winner === "mine",
      `${sideTxt(actor.name, a)} · ${sideTxt(target.name, b)} — ${winner === "mine" ? `побеждает ${esc(actor.name)}` : winner === "theirs" ? `побеждает ${esc(target.name)}` : "ничья"}${margin ? ` (перевес ${margin})` : ""}`)
  }, { rolls: [a.roll, b.roll] });
  return res;
}
