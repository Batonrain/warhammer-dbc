// module/combat/pariah-touch.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Касание Парии (корбук, Субрасы Людей — Пария; task-1452). Кнопка на Черте
//  «Пария» (kind:"script", помощник pariahTouch из elite-api/null-zones-body.mjs):
//  по каждой выбранной цели — что положено книгой.
//
//   «Нормальный человек при любом физическом контакте должен пройти тест на
//   W–10, или обязан принимать все усилия, чтобы разорвать контакт. Псайкеры
//   и демоны проваливают этот тест автоматически и получают бPR или 3d10
//   соответственно непоглощаемого R Dmg в торс».
//
//  Что кого ждёт — rules/null-zones.mjs::pariahTouchOutcome (чистая логика).
//  Раны чужой цели пишет ГМ по сокету (combat/gm-relay.mjs, op "pariahTouch").
//  НЕ автоматизировано: «раны от касания нельзя залечить психосилами,
//  демоническими дарами, ритуалами, эликсирами» — у Ран нет происхождения,
//  лечение их не различает; строка-напоминание в карточке.
// ════════════════════════════════════════════════════════════════════════════

import { pariahTouchOutcome } from "../rules/null-zones.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { esc } from "../helpers/utils.mjs";

const NO_HEAL_NOTE = "Эти Раны нельзя залечить психосилами, демоническими дарами, ритуалами или чародейскими эликсирами.";

/**
 * @param {Actor} pariah кто касается (или кого коснулись — правило одно)
 * @param {Actor[]} targets
 */
export async function pariahTouch(pariah, targets = []) {
  const list = (targets ?? []).filter(t => t && t !== pariah && t.uuid !== pariah?.uuid);
  if (!list.length) {
    ui.notifications?.warn("Касание Парии: выберите цель (тот, кого коснулись).");
    return null;
  }
  const results = [];
  for (const target of list) {
    const out = pariahTouchOutcome(target);
    if (out.kind === "none") {
      await postTestCard(target, {
        title: `Касание Парии — ${esc(target.name)}`,
        outcome: `<span class="roll-success">Без последствий: у ${esc(target.name)} нет души, которую обожгла бы Пустота.</span>`
      }, { sound: false });
      results.push({ target, kind: "none" });
      continue;
    }
    if (out.kind === "human") {
      const wp = Number(target.system?.characteristics?.wp?.total) || 0;
      const eff = wp + out.testMod;
      const roll = await new Roll("1d100").evaluate();
      const { success, deg } = testOutcome(roll.total, eff);
      await postTestCard(target, {
        title: `Касание Парии — ${esc(target.name)}`,
        threshold: rollStatLine({ label: "W−10", base: wp, parts: ["Касание Парии −10"], threshold: eff, rv: roll.total }),
        outcome: success
          ? outcomeHtml(true, `Успех (${deg}) — отвращение пересилено`)
          : outcomeHtml(false, `Провал (${deg}) — ${esc(target.name)} обязан всеми силами разорвать контакт с ${esc(pariah?.name ?? "Парией")}`)
      }, { rolls: [roll] });
      results.push({ target, kind: "human", success });
      continue;
    }
    // Псайкер — бPR, демон — 3d10: тест проваливается автоматически.
    const roll = await new Roll(out.formula).evaluate();
    const amount = Math.max(1, Math.min(30, Math.trunc(roll.total)));
    const ok = await writeToTarget(target, { kind: "pariahTouch", amount }, pariah);
    await postTestCard(target, {
      title: `Касание Парии — ${esc(target.name)}`,
      outcome: outcomeHtml(false, `Автопровал (${out.kind === "daemon" ? "демон" : "псайкер"}) — ${amount} непоглощаемого R Dmg в Торс${ok ? "" : " (не применено: нет Мастера)"}`),
      lines: [`<div class="roll-threshold">${out.kind === "daemon" ? "3d10" : "бPR"}: ${amount}. ${NO_HEAL_NOTE}</div>`]
    }, { rolls: [roll] });
    results.push({ target, kind: out.kind, amount, applied: ok });
  }
  return results;
}
