// module/combat/trophy-kill.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОЧКИ ТРОФЕЕВ ЗА УБИТУЮ ЦЕЛЬ (Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Книга (Мастер Казней): Собиратель Трофеев — убив вражеского офицера, чемпиона или чудовище
//  (по усмотрению ГМа), получает 1 очко Трофеев (максимум P.b); Трофеи Триумфа — убив достойную
//  трофея цель с Inf 30–59 получает 2 очка, 60–79 — 3, 80+ — 4. «Достойна ли цель» решает ГМ —
//  система спрашивает его диалогом; что можно посчитать (сумма по Inf, зажим по P.b) — считает сама.
//
//  Поток: смерть цели констатирована (sheets/tabs/body.mjs::setDeceased) → offerTrophyAfterKill
//  кладёт в чат карточку с кнопкой «Трофей» (образец — offerReaperAfterKill, combat/reaper-chain.mjs) →
//  клик ГМа (hooks.mjs, .wh-trophy-btn) → диалог → awardTrophy пишет очки в убийцу. Пишет ГМ, у него
//  есть права на любого актора, поэтому ГМ-релей (gm-relay.mjs) не нужен; игрок карточку не решает.
//  Раз на карточку — runCardOnce (card-once.mjs, флаг trophyAwarded).
// ════════════════════════════════════════════════════════════════════════════

import { hasTrophyPoints, hasTrophiesOfTriumph, trophyAwardAmount, trophyMax, trophyValue } from "../rules/trophy-points.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const TROPHY_CARD_FLAG = "trophyAwarded";

/** Inf цели — характеристика «Влияние» (system.characteristics.inf). */
const infOf = actor => Number(actor?.system?.characteristics?.inf?.total) || 0;

/** HTML кнопки «Трофей» на карточке. */
export function trophyButtonHtml({ killerUuid, victimName = "", victimInf = 0 }) {
  return `<div class="roll-defense-section">
    <button class="wh-trophy-btn" type="button"
      data-killer-uuid="${esc(killerUuid)}" data-victim-name="${esc(victimName)}" data-victim-inf="${Number(victimInf) || 0}"
      title="Трофей: решает ГМ — достойна ли цель (офицер, чемпион, чудовище). Очки считаются по Inf цели (Трофеи Триумфа: 30–59 — 2, 60–79 — 3, 80+ — 4), максимум P.b.">
      ${rollIcon("skull")}Трофей: ${esc(victimName)}
    </button>
  </div>`;
}

/**
 * Смерть цели констатирована убийцей-носителем Очков Трофеев — карточка «Трофей» в чат.
 * @param {Actor} victim
 * @param {Item} weapon  оружие последнего ранения (LAST_DAMAGE_WEAPON_FLAG); его владелец — убийца
 * @returns {Promise<boolean>} карточка выпущена
 */
export async function offerTrophyAfterKill(victim, weapon) {
  const killer = weapon?.parent ?? weapon?.actor ?? null;
  if (!killer || killer === victim || !hasTrophyPoints(killer)) return false;
  await postTestCard(killer, {
    icon: rollIcon("skull", "#c9a24a"),
    title: `Трофей — ${esc(victim?.name ?? "цель")} убит(а)`,
    lines: [
      `<div class="roll-threshold">${esc(killer.name)}: достойна ли цель трофея (офицер, чемпион, чудовище) — решает ГМ.</div>`,
      trophyButtonHtml({ killerUuid: killer.uuid, victimName: victim?.name ?? "", victimInf: infOf(victim) })
    ]
  }, { sound: false });
  return true;
}

/**
 * Диалог ГМа: засчитать ли трофей. Показывает сумму и Inf цели.
 * @param {{amount:number, inf:number, victimName?:string, killerName?:string, triumph?:boolean}} info
 * @returns {Promise<boolean>}
 */
export async function trophyKillDecision({ amount = 1, inf = 0, victimName = "", killerName = "", triumph = false } = {}) {
  const how = triumph && inf >= 30 ? `Трофеи Триумфа: Inf цели ${inf} — ${amount}` : "Собиратель Трофеев — 1";
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Трофей" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Засчитать трофей за убитого офицера/чемпиона/чудовище?<br>`
      + `<b>${esc(victimName || "цель")}</b> → ${esc(killerName || "убийца")}: <b>+${amount}</b> (${esc(how)}).</p>`,
    rejectClose: false,
    buttons: [
      { action: "award", label: `Засчитать (+${amount})`, default: true, callback: () => "award" },
      { action: "decline", label: "Не достойна трофея", callback: () => "decline" }
    ]
  });
  return choice === "award";
}

/**
 * Начислить убийце Очки Трофеев за убитую цель после решения ГМа.
 * @param {Actor} killer
 * @param {{inf?:number, victimName?:string, decide?:(info:object)=>Promise<boolean>}} o
 *   decide — решение ГМа (по умолчанию диалог trophyKillDecision)
 * @returns {Promise<{awarded:boolean, amount?:number, added?:number, reason?:string}>}
 */
export async function awardTrophy(killer, { inf = 0, victimName = "", decide = trophyKillDecision } = {}) {
  if (!killer || !hasTrophyPoints(killer)) return { awarded: false, reason: "noPool" };
  const max = trophyMax(killer);
  const cur = trophyValue(killer);
  if (cur >= max) return { awarded: false, reason: "full" };
  const triumph = hasTrophiesOfTriumph(killer);
  const amount = trophyAwardAmount({ triumph, inf });
  const ok = await decide({ amount, inf: Number(inf) || 0, victimName, killerName: killer.name, triumph });
  if (!ok) return { awarded: false, reason: "declined" };
  const next = Math.min(max, cur + amount);
  await killer.update({ "system.trophyPoints.value": next });
  return { awarded: true, amount, added: next - cur };
}
