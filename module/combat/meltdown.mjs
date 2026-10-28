// module/combat/meltdown.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Meltdown / Расплавление — поток (правила, числа и исходы — rules/meltdown.mjs;
//  очередь отложенного взрыва — combat/delayed-blast.mjs).
//
//  startMeltdown(actor): кнопка на листе Таланта (apps/talent-actions.mjs).
//   1. лаз-оружие в руках с Power Setting + нож (в руках или на разгрузке);
//   2. Полудействие (1 ОД) и тест Tech-Use+10;
//   3. Критический Провал — взрыв сразу, в руках; Провал — оружие сломано;
//      Успех — взрыв через 1d5 Раундов (в начале Хода персонажа): 1–4 Успеха срок бросает
//      ГМ втайне (шёпот ГМам), 5+ — игрок сам (публичный бросок).
// ════════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome, criticalOutcome } from "../rules/roll-outcome.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { getActiveMods } from "./weapon-mods.mjs";
import { scheduleDelayedBlast, detonateDelayedBlast } from "./delayed-blast.mjs";
import { pendingDelayedBlasts } from "../rules/delayed-blast.mjs";
import {
  hasMeltdown, meltdownWeaponOk, meltdownKnifeOk, meltdownOutcome,
  MELTDOWN_TEST_MOD, MELTDOWN_BLAST, MELTDOWN_TIMER_DIE
} from "../rules/meltdown.mjs";

const optionsHtml = items => items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");

/** Оружие и нож для Расплавления: единственные кандидаты — сразу, иначе окно выбора. null — отмена/нет. */
async function pickItems(actor, weapons, knives) {
  if (weapons.length === 1 && knives.length === 1) return { weapon: weapons[0], knife: knives[0] };
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: "Расплавление: оружие и нож" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-holo-dialog">
      <p>Лаз-оружие с Power Setting:</p><select class="melt-weapon" style="width:100%">${optionsHtml(weapons)}</select>
      <p>Металлический нож:</p><select class="melt-knife" style="width:100%">${optionsHtml(knives)}</select></div>`,
    buttons: [
      { action: "ok", label: "Далее", default: true,
        callback: (event, button) => ({ weapon: button.form.querySelector(".melt-weapon")?.value, knife: button.form.querySelector(".melt-knife")?.value }) },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    rejectClose: false
  });
  if (!res || res === "cancel") return null;
  return { weapon: actor.items.get(res.weapon), knife: actor.items.get(res.knife) };
}

/** GM-ы мира (получатели скрытого броска). */
const gmWhisper = () => (ChatMessage.getWhisperRecipients?.("GM") ?? []).map(u => u.id ?? u);

/**
 * Провести Расплавление. Возвращает исход ("instant"/"break"/"hidden"/"open") или null, если не начато.
 */
export async function startMeltdown(actor) {
  if (!hasMeltdown(actor)) { ui.notifications?.warn("Расплавление: у персонажа нет Таланта Meltdown."); return null; }
  // Уже плавящееся оружие (его id в очереди взрывов) второй раз не расплавить.
  const melting = new Set(pendingDelayedBlasts(actor).flatMap(e => e.itemIds ?? []));
  const weapons = [...actor.items].filter(i => !melting.has(i.id) && meltdownWeaponOk(i, getActiveMods(actor, i)));
  const knives = [...actor.items].filter(meltdownKnifeOk);
  if (!weapons.length) { ui.notifications?.warn("Расплавление: нужно лаз-оружие в руках с Power Setting (не сломанное)."); return null; }
  if (!knives.length) { ui.notifications?.warn("Расплавление: нужен металлический нож в руках или на разгрузке."); return null; }
  const picked = await pickItems(actor, weapons, knives);
  if (!picked?.weapon || !picked?.knife) return null;
  const { weapon, knife } = picked;

  // Полудействие.
  if (!await spendActionPoints(actor, 1, { physical: true })) { ui.notifications?.warn("⚠️ Не хватает ОД на Расплавление (полудействие)."); return null; }

  // Tech-Use+10.
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "techUse", char: "int" });
  const base = Number(actor.system?.skills?.techUse?.total ?? -20);
  const threshold = base + MELTDOWN_TEST_MOD + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success, deg } = testOutcome(rv, threshold);
  const critFail = criticalOutcome(rv).failure;
  const outcome = meltdownOutcome({ success, deg, critFail });

  const blast = {
    ...MELTDOWN_BLAST, label: "Расплавление", weaponName: `Расплавление: ${weapon.name}`,
    itemIds: [weapon.id, knife.id]
  };
  const statLine = rollStatLine({ label: "Tech-Use+10", base, parts: [`Расплавление +${MELTDOWN_TEST_MOD}`, ...ruleMods.parts], threshold, rv });
  const dice = await roll.render();
  const diceSection = `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`;
  const title = `Расплавление — ${esc(actor.name)}`;
  const icon = rollIcon("bolt", "#ffb84d");

  if (outcome === "instant") {
    await postTestCard(actor, { icon, title, threshold: statLine,
      outcome: outcomeHtml(false, "Критический Провал — оружие взрывается немедленно в руках"), sections: [diceSection] }, { rolls: [roll] });
    await detonateDelayedBlast(actor, blast, { reason: "Критический Провал." });
    return outcome;
  }
  if (outcome === "break") {
    await weapon.update({ "system.destroyed": true });
    await postTestCard(actor, { icon, title, threshold: statLine,
      outcome: outcomeHtml(false, `Провал (${deg} ${_degWord(deg)}) — «${esc(weapon.name)}» сломано и бесполезно, пока его не починят (смена работы)`),
      sections: [diceSection] }, { rolls: [roll] });
    return outcome;
  }

  // Успех: срок до взрыва 1d5 Раундов. 1–4 Успеха бросает ГМ втайне, 5+ — игрок.
  const hidden = outcome === "hidden";
  const timer = await new Roll(MELTDOWN_TIMER_DIE).evaluate();
  await scheduleDelayedBlast(actor, { ...blast, turnsLeft: timer.total, hidden });
  await postTestCard(actor, { icon, title, threshold: statLine,
    outcome: outcomeHtml(true, `Успех (${deg} ${_degWord(deg)}) — «${esc(weapon.name)}» перегружено и скоро взорвётся`),
    lines: [hidden
      ? `<div class="roll-threshold">⏳ Время до взрыва (1d5 Раундов, 1–4 Успеха) бросает ГМ втайне — игрок его не знает. Взрыв — в начале Хода персонажа.</div>`
      : `<div class="roll-threshold">⏳ 5+ Успехов: время до взрыва бросает игрок — <b>${timer.total}</b> ${timer.total === 1 ? "Раунд" : "Раунда(ов)"}. Взрыв — в начале Хода персонажа.</div>`],
    sections: [diceSection] }, { rolls: [roll, ...(hidden ? [] : [timer])] });
  if (hidden) {
    // Пустой список адресатов в Foundry значит «всем» — тайную записку без ГМ-получателей не шлём вовсе.
    const gms = gmWhisper();
    if (gms.length) {
      await postTestCard(actor, { icon, title: `Расплавление (только ГМ) — ${esc(actor.name)}`,
        lines: [`<div class="roll-threshold">🔒 Тайный бросок 1d5: взрыв через <b>${timer.total}</b> Раунд(а/ов) — в начале Хода ${esc(actor.name)}. Оружие: ${esc(weapon.name)}.</div>`] },
      { rolls: [timer], whisper: gms, sound: false, blind: true });
    } else {
      ui.notifications?.warn("Расплавление: ГМ не в сети — срок взрыва записан скрыто, объявите его по карточке взрыва.");
    }
  }
  return outcome;
}
