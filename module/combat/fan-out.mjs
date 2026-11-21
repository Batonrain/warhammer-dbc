// module/combat/fan-out.mjs
// Разбежаться! / Fan Out! (Талант Лидерства): «В начале боя сразу после бросков Инициативы
// персонаж может пройти Command (P)+0 (с бонусами Слаженности), чтобы дать до Успехи членам отряда
// Талант Reposition на этот бой.» Reposition читается rules/speed-talents.mjs::hasSpeedTalent по
// метке FAN_OUT_FLAG = id боя; запись на чужие листы — через ГМа (gm-relay, флаг из списка).

import { esc, _degWord } from "../helpers/utils.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { sideValue } from "./opposed-contest.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { findMemberSquad, squadRoleOf } from "../rules/squad-roles.mjs";
import { cohesionBonus } from "../constants/squad.mjs";
import { FAN_OUT_FLAG } from "../rules/speed-talents.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";

/** Сколько бойцов получают Reposition: до Успехов, не больше членов отряда. */
export function fanOutCount(deg, members) {
  return Math.max(0, Math.min(Number(deg) || 0, Number(members) || 0));
}

export async function useFanOut(actor) {
  if (!actor || !hasItemNamed(actor, "Fan Out!", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Разбежаться!.");
  const combat = game.combat;
  if (!combat?.started || (Number(combat.round) || 0) > 1) return ui.notifications.warn("⚠️ Разбежаться! — в начале боя, сразу после Инициативы.");
  const squad = findMemberSquad(actor.uuid);
  if (!squad) return ui.notifications.warn("⚠️ Персонаж не состоит в Отряде.");
  const role = squadRoleOf(squad, actor.uuid);
  const coh = cohesionBonus(squad.system?.cohesion?.value, role === "coordinator");
  const uuids = [squad.system?.posts?.leader?.uuid, squad.system?.posts?.commander?.uuid, squad.system?.posts?.coordinator?.uuid,
    ...(squad.system?.members ?? []).map(m => m?.uuid)].filter(u => u && u !== actor.uuid);
  const mates = [...new Set(uuids)].map(u => fromUuidSync(u)).filter(Boolean);
  // Command (P): Ранг Навыка Command, Характеристика — Восприятие.
  const base = sideValue(actor, { skill: "command" })
    - (Number(actor.system?.characteristics?.fel?.total) || 0) + (Number(actor.system?.characteristics?.per?.total) || 0);
  const rm = collectTestMods(actor, { kind: "skill", skill: "command", char: "per" });
  const threshold = base + coh + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  let chosen = [];
  const n = success ? fanOutCount(deg, mates.length) : 0;
  if (n > 0) {
    const preTargets = new Set([...(game.user?.targets ?? [])].map(t => t.actor?.uuid));
    const rows = mates.map((m, i) => `<label style="display:block;"><input type="checkbox" name="m${i}" ${preTargets.has(m.uuid) || (!preTargets.size && i < n) ? "checked" : ""}/> ${esc(m.name)}</label>`).join("");
    const picked = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Разбежаться! — до ${n}` }, rejectClose: false,
      content: `<p>Кому дать Reposition на этот бой (не больше ${n})?</p>${rows}`,
      ok: { label: "Дать", callback: (_e, b) => mates.filter((_m, i) => b.form.elements[`m${i}`]?.checked) }
    }).catch(() => null);
    chosen = (picked ?? []).slice(0, n);
    for (const m of chosen) await writeToTarget(m, { kind: "update", data: { [`flags.warhammer-dbc.${FAN_OUT_FLAG}`]: combat.id } }, actor);
  }
  await postTestCard(actor, {
    icon: "🏃", title: `Разбежаться! — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Command (P)", base, parts: [coh ? `Слаженность ${coh >= 0 ? "+" : ""}${coh}` : "", ...rm.parts].filter(Boolean), threshold, rv: roll.total }),
    outcome: success
      ? outcomeHtml(true, `Успех — ${deg} ${_degWord(deg)}. Reposition на этот бой: ${chosen.length ? chosen.map(m => esc(m.name)).join(", ") : "никому"} — пункт «Смена Позиции» в меню Движения.`)
      : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}.`)
  }, { rolls: [roll] });
}
