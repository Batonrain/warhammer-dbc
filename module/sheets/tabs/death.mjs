// module/sheets/tabs/death.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть (стр. 232-233): диалог «Спасение» рядом с Кардио-монитором
//  (bc-death-toggle, templates/actor/parts/tab-effects.hbs) — доступен, только
//  пока констатирована смерть (флаг warhammer-dbc.deceased). Три пути:
//  Чудесное Спасение (всем), Божественная Защита (только с Талантом), и
//  Замедленная Анимация (только Астартес с установленной Сус-ан Мембраной,
//  Раны не ниже −15). «Игрушка Богов» — напоминание текстом, не гейт: ГМ и
//  игрок сами решают, вынужден ли персонаж воспользоваться Спасением.
//  «Воскресить» — отдельная кнопка без формулы вовсе: последствия того, ЧТО
//  и КАК воскресило персонажа (стр. 233, «Воскрешение» — чистая нарративная
//  глава без единой цифры в книге) — на усмотрение ГМа и игроков.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { esc } from "../../helpers/utils.mjs";
import {
  fatePoolLabel, MIRACULOUS_SAVE, DIVINE_PROTECTION, SUS_AN_TEST_MOD,
  hasDivineProtectionTalent, hasSusAnMembrane, susAnEligible, fateSaveFails,
  toyOfGodsApplies
} from "../../rules/death-save.mjs";
import { computeWoundHealing } from "./wounds.mjs";

const NS = "warhammer-dbc";

async function _postCard(actor, header, lines, rolls = []) {
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("skull","#ff6b6b")}${esc(header)} — ${esc(actor.name)}</div>
      <div class="roll-threshold">${lines.join("<br/>")}</div>
    </div>`,
    rolls, sound: rolls.length ? CONFIG.sounds.dice : undefined
  }, rollMode));
}

/** Чудесное Спасение и Божественная Защита расплачиваются пулом Судьбы/Бесчестья одинаково. */
async function _resolveFateSave(actor, kind, cfg, { restoreToZero, resurrectNote }) {
  const pool = fatePoolLabel(actor);
  const current = Number(actor.system.fate?.value) || 0;

  const fateRoll = await new Roll(cfg.fateDie).evaluate();
  const loss = fateRoll.total + (cfg.fateFlat || 0);
  const failed = fateSaveFails(current, loss);

  if (failed) {
    await actor.update({ "system.fate.value": Math.max(0, current - loss) });
    await _postCard(actor, kind, [
      `Пул ${pool}: <b>${current}</b> − (${cfg.fateFlat ? `${cfg.fateFlat}+` : ""}${fateRoll.total}=${loss}) → опустился бы до 0 и ниже.`,
      `<span class="roll-failure">Провал — Боги отвернулись. Персонаж мёртв по-настоящему.</span>`
    ], [fateRoll]);
    return;
  }

  const corRoll = await new Roll(cfg.corDie).evaluate();
  const newFate = current - loss;
  const newCor  = (Number(actor.system.corruption?.value) || 0) + corRoll.total;
  const updates = {
    "system.fate.value": newFate,
    "system.corruption.value": Math.min(100, newCor)
  };
  updates[`flags.${NS}.deceased`] = false;
  if (restoreToZero) {
    Object.assign(updates, computeWoundHealing(actor.system, Math.max(0, -(Number(actor.system.wounds?.value) || 0)) + (Number(actor.system.wounds?.critical) || 0)));
  }
  await actor.update(updates);

  const lines = [
    `Пул ${pool}: <b>${current}</b> − ${loss} → <b>${newFate}</b>.`,
    `Порча: +${corRoll.total} → <b>${Math.min(100, newCor)}</b>${newCor > 100 ? " (потолок 100)" : ""}.`,
    `<span class="roll-success">Успех — персонаж жив. Кардиомонитор перезапущен.</span>`
  ];
  if (resurrectNote) lines.push(resurrectNote);
  await _postCard(actor, kind, lines, [fateRoll, corRoll]);
}

async function doMiraculousSave(actor) {
  await _resolveFateSave(actor, "Чудесное Спасение", MIRACULOUS_SAVE, {
    restoreToZero: true,
    resurrectNote: "Урон и эффекты смертельного попадания откатываются — персонаж как будто не получал этот удар."
  });
}

async function doDivineProtection(actor) {
  await _resolveFateSave(actor, "Божественная Защита", DIVINE_PROTECTION, {
    restoreToZero: true,
    resurrectNote: "Персонаж без сознания до конца сцены/боя, а до конца сессии может совершать только полудвижения. "
      + "Если Inf/Cor теперь 50+ и есть безопасная база — можно чудом переместиться туда (по решению игрока/ГМа)."
  });
}

/** Замедленная Анимация — не тратит Судьбу/Бесчестье, отдельный тест W+30 (Сус-ан Мембрана). */
async function doSusAnimation(actor) {
  const w = Number(actor.system.characteristics?.wp?.total) || 0;
  const threshold = w + SUS_AN_TEST_MOD;
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;

  const lines = [`W <b>${w}</b>+${SUS_AN_TEST_MOD} → порог <b>${threshold}</b>, бросок <b>${roll.total}</b>.`];
  if (success) {
    await actor.update({
      [`flags.${NS}.deceased`]: false,
      "system.conditions.unconscious": true,
      "system.conditions.helpless": true
    });
    lines.push(`<span class="roll-success">Успех — десантник входит в Замедленную Анимацию вместо смерти.</span>`);
    lines.push("Без сознания и Беспомощен. Диагностика −60 (For.Lore (Astartes Implants) снимает штраф). "
      + "Вывод — операция в апотекарионе, Medicae−40, медик с For.Lore (Astartes Implants)+0, 12−Успехи ч. (мин. 3).");
  } else {
    lines.push(`<span class="roll-failure">Провал — тело не выдерживает, десантник мёртв.</span>`);
  }
  await _postCard(actor, "Замедленная Анимация", lines, [roll]);
}

export async function doResurrect(actor) {
  await actor.setFlag(NS, "deceased", false);
  await _postCard(actor, "Воскрешение", [
    "Кардиомонитор перезапущен вручную — персонаж воскрешён.",
    "Формулы в книге для этого нет (стр. 233 — чистый нарратив): что, как и какой ценой его вернуло, решают ГМ и игроки."
  ]);
}

export function showDeathSaveDialog(actor) {
  if (!actor?.getFlag?.(NS, "deceased")) {
    ui.notifications.warn(`${actor.name}: смерть не констатирована.`);
    return;
  }
  const pool = fatePoolLabel(actor);
  const canDivine = hasDivineProtectionTalent(actor);
  const canSusAn  = hasSusAnMembrane(actor) && susAnEligible(actor);
  const toyNote = toyOfGodsApplies(actor)
    ? `<div class="atk-range-info" style="font-size:0.82em;color:#e0a83a;">⚠ Игрушка Богов: на первом смертельном ранении сессии Покровительство обычно обязывает воспользоваться Спасением/Защитой, если это не подняло бы Cor до 100 — решение за столом.</div>`
    : "";

  const opt = (key, label, note, enabled = true) => `
    <button type="button" class="wh-death-action" data-action="${key}" ${enabled ? "" : "disabled"}
      style="width:100%;text-align:left;margin:3px 0;${enabled ? "" : "opacity:0.45;"}">
      <b>${label}</b><br/><span style="font-size:0.8em;">${note}</span>
    </button>`;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("skull","#ff6b6b")}Спасение от смерти</span></div>
      ${toyNote}
      ${opt("miraculous", "Чудесное Спасение", `1d10+10 ${pool} и 1d10 Порчи — провал, если пул опустится до 0.`)}
      ${opt("divine", "Божественная Защита", canDivine
        ? `1d5+5 ${pool} и 1d5 Порчи — провал, если пул опустится до 0.`
        : "Требует Талант «Божественная Защита» — не найден на листе.", canDivine)}
      ${opt("susan", "Замедленная Анимация", canSusAn
        ? `Тест W+30 (не тратит ${pool}/Порчу). Только Астартес с Сус-ан Мембраной, Раны не ниже −15.`
        : "Только Астартес с установленной Сус-ан Мембраной и Ранами не ниже −15.", canSusAn)}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Спасение от смерти" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [{ action: "close", label: "Закрыть" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      form.querySelectorAll(".wh-death-action:not([disabled])").forEach(b => b.addEventListener("click", async () => {
        const key = b.dataset.action;
        if (key === "miraculous") await doMiraculousSave(actor);
        else if (key === "divine") await doDivineProtection(actor);
        else if (key === "susan") await doSusAnimation(actor);
        dialog.close();
      }));
    }
  });
}
