// module/combat/soul-binding.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ритуал Связывания Души — кнопки и карточки (чистая часть —
//  rules/soul-binding.mjs, Sahara 581-ddee).
//
//  • Карточка успешного ритуала (apps/ritual-cast.mjs) несёт кнопку
//    «Связать души»: цель — отмеченный токен (T) или Миньон Ритуалиста на
//    выбор; встречный тест W−30(+10 за Успех) vs W+0; победа сама ставит
//    обоим метку связи, а Миньону — галочку «Связан душой».
//  • Урон Выжигания Души и Варп-Оружия после поглощения делится между
//    связанными (combat/damage.mjs, hooks.mjs::_executeSoulBurn).
//  • Смерть цели — Ритуалисту тест W−30, провал: −2d10 W навсегда
//    (хук смерти в warhammer-dbc.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { charLossPortionsAddFields } from "../rules/char-loss.mjs";
import { SOUL_BOUND_FLAG } from "../rules/minion-loyalty.mjs";
import {
  SOUL_BOND_FLAG, soulBondPartners, soulBindingThresholds, withPartner, splitSoulBondDamage,
  SOUL_BINDING_DEATH_MOD, soulBondRangeKm
} from "../rules/soul-binding.mjs";

const NS = "warhammer-dbc";
const ICON = "🔗";

/** Кнопка карточки ритуала. */
export function soulBindingButtonHtml(actor, deg) {
  return `<div class="roll-threshold" style="font-size:0.85em;">
    <button type="button" class="wh-soul-binding-btn" data-actor-uuid="${esc(actor.uuid)}" data-deg="${Math.max(1, Number(deg) || 1)}">${ICON} Связать души: встречный W−30 vs W цели</button>
  </div>`;
}

async function pickTarget(actor) {
  const marked = [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a !== actor);
  if (marked) return marked;
  const minions = (game.actors?.contents ?? []).filter(a => a.system?.masterUuid === actor.uuid);
  if (!minions.length) {
    ui.notifications?.warn("Связывание Души: отметьте цель (T) — своего Миньона.");
    return null;
  }
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Связывание Души" },
    content: `<div class="atk-dlg-row"><label>Цель</label><select name="m" class="pm-input">${
      minions.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Связать", callback: (ev, b) => b.form.elements.m.value },
    rejectClose: false
  }).catch(() => null);
  return id ? game.actors.get(id) : null;
}

async function writeBond(actor, update) {
  if (game.user?.isGM || actor.isOwner) { await actor.update(update); return true; }
  return false;
}

/** Встречный тест кнопки «Связать души». */
export async function bindSoulsFromCard(actor, deg) {
  const target = await pickTarget(actor);
  if (!target) return;
  const t = soulBindingThresholds(actor, target, deg);
  const [ra, rt] = [await new Roll("1d100").evaluate(), await new Roll("1d100").evaluate()];
  const mine = { ...testOutcome(ra.total, t.ritualist), threshold: t.ritualist };
  const theirs = { ...testOutcome(rt.total, t.target), threshold: t.target };
  const win = resolveOpposed(mine, theirs).winner === "mine";
  const lines = [
    `<div class="roll-threshold">${esc(actor.name)}: W−30${t.extra ? `+${t.extra}` : ""} — <b>${ra.total}</b> против <b>${t.ritualist}</b> (${mine.success ? "Успех" : "Провал"} ${mine.deg})</div>`,
    `<div class="roll-threshold">${esc(target.name)}: W+0 — <b>${rt.total}</b> против <b>${t.target}</b> (${theirs.success ? "Успех" : "Провал"} ${theirs.deg})</div>`
  ];
  if (win) {
    const okA = await writeBond(actor, { [`flags.${NS}.${SOUL_BOND_FLAG}`]: withPartner(soulBondPartners(actor), target.uuid) });
    const tUpd = { [`flags.${NS}.${SOUL_BOND_FLAG}`]: withPartner(soulBondPartners(target), actor.uuid) };
    if (target.type === "minion" || target.system?.masterUuid) tUpd[`flags.${NS}.${SOUL_BOUND_FLAG}`] = true;
    const okT = await writeBond(target, tUpd);
    lines.push(`<div class="roll-threshold">Души связаны: общие чувства и сенсорные Навыки/Таланты, Врасплох — только обоих сразу; связь держится до ${soulBondRangeKm(actor, target)} км (сумма W.b). Урон Выжигания Души и Варп-Оружия делится поровну автоматически.</div>`);
    if (!okA || !okT) lines.push(`<div class="roll-threshold">Связь у ${esc(!okA ? actor.name : target.name)} отметит ГМ (нет прав на лист).</div>`);
  }
  await postTestCard(actor, {
    icon: ICON, title: `Связывание Души — ${esc(actor.name)} и ${esc(target.name)}`,
    lines,
    outcome: win ? `<span class="roll-success">Связь установлена.</span>` : `<span class="roll-failure">Цель устояла — связи нет.</span>`
  }, { rolls: [ra, rt] });
}

/**
 * Деление урона Выжигания Души / Варп-Оружия: возвращает, сколько остаётся
 * пострадавшему, и строку для карточки; доли партнёров применяются здесь же
 * (непоглощаемо — поглощение уже было).
 */
export async function shareSoulBondDamage(actor, damage) {
  const partners = [];
  for (const u of soulBondPartners(actor)) {
    const p = await fromUuid(u).catch(() => null);
    const a = p?.actor ?? p;
    if (a && a !== actor) partners.push(a);
  }
  const split = splitSoulBondDamage(damage, partners.length);
  if (!split.shares.length) return { net: Number(damage) || 0, note: "" };
  const parts = [];
  for (let i = 0; i < partners.length; i++) {
    const share = split.shares[i];
    if (!share) continue;
    if (game.user?.isGM || partners[i].isOwner) {
      await applyWoundLoss(partners[i], share);
      parts.push(`${esc(partners[i].name)} −${share}`);
    } else parts.push(`${esc(partners[i].name)} −${share} (впишет ГМ)`);
  }
  return { net: split.self, note: `🔗 Связь Душ: урон ${damage} делится поровну — ${esc(actor.name)} −${split.self}, ${parts.join(", ")}.` };
}

/** Смерть связанной цели: Ритуалисту W−30 (как против психосилы), провал — −2d10 W навсегда. */
export async function soulBondDeathTest(ritualist, dead) {
  const w = Number(ritualist?.system?.characteristics?.wp?.total) || 0;
  const threshold = w + SOUL_BINDING_DEATH_MOD;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const rolls = [roll];
  let loss = "";
  if (!success) {
    const lr = await new Roll("2d10").evaluate();
    rolls.push(lr);
    const { patch, applied } = charLossPortionsAddFields(ritualist.system,
      [{ key: "wp", amount: lr.total, hours: 0, source: "Связывание Души: смерть цели" }], game.time?.worldTime ?? 0);
    if (Object.keys(patch).length && (game.user?.isGM || ritualist.isOwner)) await ritualist.update(patch);
    loss = `Перманентно теряет <b>${applied.wp ?? lr.total}</b> W (2d10 = ${lr.total}).`;
  }
  await postTestCard(ritualist, {
    icon: ICON, title: `Связь Душ оборвалась — ${esc(dead.name)} мёртв`,
    lines: [`<div class="roll-threshold">${esc(ritualist.name)}: W−30 (как против психосилы) — <b>${roll.total}</b> против <b>${threshold}</b> (${success ? "Успех" : "Провал"} ${deg}). ${loss}</div>`],
    outcome: success ? `<span class="roll-success">Разум выдержал разрыв.</span>` : `<span class="roll-failure">Часть души ушла вместе с целью.</span>`
  }, { rolls });
}

/** Хук смерти: умерла цель связи (у кого есть soulBound) — тест её Ритуалистам. */
export async function onSoulBondDeath(actor) {
  if (!actor?.getFlag?.(NS, SOUL_BOUND_FLAG)) return;
  for (const u of soulBondPartners(actor)) {
    const p = await fromUuid(u).catch(() => null);
    const r = p?.actor ?? p;
    if (r && r !== actor) await soulBondDeathTest(r, actor);
  }
}
