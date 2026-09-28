// module/combat/replicant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Черт Репликанта. Арифметика и ключи — rules/replicant.mjs.
//
//   • Гипно-Шрамы: Ступор на 1 Раунд при Крит. Провале теста I
//     (зовёт rules/kind-outcome.mjs);
//   • Крючок Сывороток: часы по времени мира (combat/condition-clock.mjs,
//     CONDITION_CLOCK_HANDLERS) — 1d5 урона в S и T каждые 8 ч просрочки;
//     «принять сыворотку» — кнопка на вкладке ТЕЛО и применение самой
//     Сыворотки Репликанта из Химии (sheets/tabs/drugs.mjs::applyDrug);
//   • Срок Годности / Генетическое Угасание: бросок срока жизни 15+1d5 и
//     строка «возраст / предел» на вкладке ТЕЛО.
// ════════════════════════════════════════════════════════════════════════════

import { applyConditionWithDuration } from "./condition-effects.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  SERUM_HOOK, EXPIRATION_DATE, GENETIC_DECAY, SERUM_FLAG, SERUM_TARGETS, LIFESPAN_FLAG, LIFESPAN_FORMULA,
  START_AGE_MIN, REPLICANT_JUVENAT_NOTE, traitWithKey, serumTakenAt, serumOverdue, serumTicksBetween,
  serumStatusLabel, lifespanYears, replicantMaxAge, mutationCountNoGifts
} from "../rules/replicant.mjs";

const NS = "warhammer-dbc";

/** Маркер предмета Химии «Сыворотка Репликанта» (packs-src/chemistry/Медикаменты). */
export const SERUM_ITEM_FLAG = "replicantSerum";

export function isReplicantSerum(item) {
  return item?.type === "drug" && !!(item.getFlag?.(NS, SERUM_ITEM_FLAG) ?? item.flags?.[NS]?.[SERUM_ITEM_FLAG]);
}

async function chat(actor, header, body, rolls = []) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${header}</div>
      ${body}
    </div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : null
  });
}

// ── Гипно-Шрамы ─────────────────────────────────────────────────────────────

/**
 * Ступор на 1 Раунд. Возвращает строку для карточки теста (пусто — иммунитет).
 */
export async function applyHypnoScarsStun(actor) {
  const ok = await applyConditionWithDuration(actor, "dazed", { value: 1, unit: "rounds" });
  return ok
    ? `<div class="roll-threshold">🌀 Гипно-Шрамы: Критический Провал теста I — <b>Ступор на 1 Раунд</b> (хаотичные галлюцинации)</div>`
    : `<div class="roll-threshold">🌀 Гипно-Шрамы: Ступор не наложен (иммунитет)</div>`;
}

// ── Крючок Сывороток ───────────────────────────────────────────────────────

/** Отметить приём сыворотки сейчас. */
export async function takeSerum(actor, { announce = true } = {}) {
  const trait = traitWithKey(actor, SERUM_HOOK);
  if (!trait) return false;
  const now = game.time?.worldTime ?? 0;
  const wasOverdue = serumOverdue(serumTakenAt(trait), now);
  await trait.setFlag(NS, SERUM_FLAG, now);
  if (announce) {
    await chat(actor, `💉 ${esc(actor.name)} — сыворотка принята`,
      `<div class="roll-threshold">Крючок Сывороток: следующая доза — через 7 дней.${wasOverdue
        ? " Урон в S и T снова восстанавливается отдыхом." : ""}</div>`);
  }
  return true;
}

/**
 * Часы Крючка Сывороток — обработчик CONDITION_CLOCK_HANDLERS
 * (combat/condition-clock.mjs). Приём ещё не отмечен — отсчёт начинается с
 * этого отрезка: штрафа задним числом нет (как у Зависимости).
 */
export async function serumHookClock(actor, { from, to }) {
  const trait = traitWithKey(actor, SERUM_HOOK);
  if (!trait) return;
  const takenAt = serumTakenAt(trait);
  if (takenAt == null) {
    await trait.setFlag(NS, SERUM_FLAG, Number(from));
    return;
  }
  const ticks = serumTicksBetween(takenAt, from, to);
  if (!ticks.length) return;
  const rolls = [];
  const lines = [];
  for (const at of ticks) {
    if (actor.getFlag?.(NS, "deceased")) break;
    const parts = [];
    for (const key of SERUM_TARGETS) {
      const roll = await new Roll("1d5").evaluate();
      rolls.push(roll);
      const res = await applyCharDamage(actor, key, roll.total, { at });
      parts.push(`${key.toUpperCase()} −${res.applied}${res.decay ? ` (1d5=${roll.total} +${res.decay} Генетическое Угасание)` : ` (1d5=${roll.total})`}`);
      if (res.died) break;
    }
    lines.push(parts.join(", "));
  }
  await chat(actor, `${rollIcon("warn", "#d9a066")}${esc(actor.name)} — нет сыворотки`,
    `<div class="roll-threshold">Крючок Сывороток: неделя без сыворотки — урон каждые 8 часов:<br/>${lines.join("<br/>")}</div>
     <div class="roll-threshold">Урон в S и T не восстанавливается отдыхом и медитацией, пока не принята сыворотка (эликсиры и психосилы лечат).</div>`,
    rolls);
}

// ── Срок Годности ──────────────────────────────────────────────────────────

/** Бросок срока жизни 15+1d5 — один раз, результат на Черте. */
export async function rollLifespan(actor) {
  const trait = traitWithKey(actor, EXPIRATION_DATE);
  if (!trait || lifespanYears(trait) != null) return null;
  const roll = await new Roll(LIFESPAN_FORMULA).evaluate();
  await trait.setFlag(NS, LIFESPAN_FLAG, roll.total);
  await chat(actor, `⏳ ${esc(actor.name)} — Срок Годности`,
    `<div class="roll-threshold">Срок жизни Репликанта: ${LIFESPAN_FORMULA} = <b>${roll.total}</b> лет. Стартовый персонаж, скорее всего, уже прожил не меньше ${START_AGE_MIN} лет.</div>`,
    [roll]);
  return roll.total;
}

// ── Вкладка ТЕЛО ───────────────────────────────────────────────────────────

/**
 * Контекст блока «Репликант» вкладки ТЕЛО. null — у актора нет ни одной из
 * этих Черт, блок не рисуется.
 */
export function replicantBodyContext(actor) {
  const serumTrait = traitWithKey(actor, SERUM_HOOK);
  const lifeTrait  = traitWithKey(actor, EXPIRATION_DATE);
  if (!serumTrait && !lifeTrait) return null;
  const now = globalThis.game?.time?.worldTime ?? 0;
  const out = {};
  if (serumTrait) {
    const takenAt = serumTakenAt(serumTrait);
    out.serum = { overdue: serumOverdue(takenAt, now), status: serumStatusLabel(takenAt, now) };
  }
  if (lifeTrait) {
    const hasDecay = !!traitWithKey(actor, GENETIC_DECAY);
    const mutations = mutationCountNoGifts(actor);
    const age = Number(actor?.system?.bio?.age) || 0;
    const max = replicantMaxAge(lifespanYears(lifeTrait), mutations, hasDecay);
    out.life = {
      rolled: !!max,
      formula: LIFESPAN_FORMULA,
      age,
      base: max?.base ?? null,
      decay: max?.decay ?? 0,
      max: max?.max ?? null,
      left: max ? Math.max(0, max.max - age) : null,
      alert: !!max && age >= max.max - 1,
      juvenat: REPLICANT_JUVENAT_NOTE
    };
  }
  return out;
}
