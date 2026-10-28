// module/apps/torture.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общий диалог ПЫТКИ для всех персонажей (3-dc87, решение владельца
//  24.10.2026: «один общий диалог пыток для всех, на основе
//  apps/skillful-torture.mjs, который был только у Друкхари; Мучитель
//  подвесить к нему»).
//
//  Тест пытки — тот же, что у Искусной Пытки (книга, Друкхари): встречный
//  Interrogate(Int)−20 пытающего против W+0 жертвы, оба бросают. У диалога
//  есть модификаторы обеим сторонам (поля «Мод. пытающего»/«Мод. жертвы»).
//
//  • Режим «Искусная Пытка» (skillful) — всё как раньше: при победе Боль и
//    лечение Характеристик всем друкхари рядом, дневной лимит W.b, Пожиратель
//    Боли. Доступен только владельцу Таланта (кнопка в sheets/tabs/combat.mjs).
//  • Мучитель (Медик, medic.core.torturer): «проводя пытки или ассистируя в
//    них» — тест Medicae−10 владельца Таланта (сам пытающий или ассистент),
//    −3×Успехи на встречный тест жертвы; при неудачном тесте пыток — без урона
//    жертве и она пригодна для дальнейших пыток.
//
//  Общий диалог УРОНА жертве не наносит и пригодность к пыткам не ведёт:
//  книга подробных правил пытки вне Таланта не даёт — эту часть ведёт ГМ.
//  Арифметика Мучителя — rules/torture.mjs; помощники Искусной Пытки —
//  apps/skillful-torture.mjs (оттуда они и взяты).
// ════════════════════════════════════════════════════════════════════════

import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { hasTalentCapability } from "../rules/ability-by-key.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { EATER_OF_PAIN_CAPABILITY, eaterOfPainChoiceButtonsHtml } from "../rules/eater-of-pain.mjs";
import { TORTURER_CAP } from "../rules/medic-talents.mjs";
import { clearForesight } from "./talent-actions.mjs";
import { testSuccesses, torturerVictimPenalty, torturerThreshold } from "../rules/torture.mjs";
import {
  interrogateIntTotal, extraTiers, drukhariNearby, grantTortureBenefit,
  tortureBenefitAvailable, markTortureBenefitUsed
} from "./skillful-torture.mjs";

/**
 * Модификаторы и переброс стороны — тем же приёмом, что combat/intimidate.mjs
 * ::_sideModsAndReroll: оба бросают здесь без промежуточного диалога-галочки,
 * так что переброс области "morale" (Unshakeable Will и подобные) применяется
 * автоматически, не чекбоксом (task-284f, живая проверка 22.10.2026).
 */
function _sideModsAndReroll(resolved) {
  const list = [...resolved.autoMods, ...resolved.mods.filter(m => !m.askOnly)];
  const total = list.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const parts = list.map(m => `${m.label} ${Number(m.value) >= 0 ? "+" : ""}${m.value}`);
  const reroll = resolved.rerolls.find(r => r.who !== "target");
  return { total, parts, reroll: reroll ? { mode: reroll.mode, rolls: reroll.rolls, label: reroll.label } : null };
}

/** Иммунитет к пыткам: Не Чувствует Боли (мутация) и Метка Слаанеш (defence.tortureImmune). */
export function isTortureImmune(target) {
  return hasRuleFlag(target, "mutation.feelsNoPain") || hasRuleFlag(target, "defence.tortureImmune");
}

/** Актёры боя (или сцены вне боя) — кандидаты в ассистенты-Мучители. */
function sceneActors() {
  const actors = game.combat?.combatants
    ? [...game.combat.combatants].map(c => c.actor)
    : (canvas?.scene?.tokens?.contents ?? []).map(t => t.actor);
  const seen = new Set();
  return actors.filter(a => a && !seen.has(a.id) && seen.add(a.id));
}

/** Кто может дать Мучителя этой пытке: сам пытающий (если Талант есть) и ассистенты на сцене. */
export function torturerHolders(torturer, target) {
  const out = [];
  if (hasTalentCapability(torturer, TORTURER_CAP)) out.push(torturer);
  for (const a of sceneActors()) {
    if (a.id === torturer.id || a.id === target?.id) continue;
    if (hasTalentCapability(a, TORTURER_CAP)) out.push(a);
  }
  return out;
}

/**
 * Провести пытку без диалога (диалог только собирает параметры).
 * @param {Actor} torturer
 * @param {Actor} target
 * @param {{skillful?:boolean, torturerMod?:number, targetMod?:number, holder?:Actor|null}} opts
 * @returns {Promise<{winner:string, margin:number, torturerSuccesses:number}>}
 */
export async function resolveTorture(torturer, target, { skillful = false, torturerMod = 0, targetMod = 0, holder = null } = {}) {
  const title = skillful ? "Искусная Пытка" : "Пытка";
  const torturerMods = _sideModsAndReroll(resolveTest({ actor: torturer, kind: "skill", skill: "interrogate", char: "int", morale: true, targetActor: target }));
  // interrogation — тест СОПРОТИВЛЕНИЯ допросу жертвы (Ортопрокси, Sahara 3-defiance).
  const targetMods   = _sideModsAndReroll(resolveTest({ actor: target, kind: "skill", char: "wp", morale: true, interrogation: true, targetActor: torturer }));
  const lines = [];

  // Мучитель: тест Medicae−10 владельца Таланта до встречного теста; Успехи
  // дают жертве −3 на её встречный тест.
  let torturerSuccesses = 0, victimPenalty = 0;
  if (holder && hasTalentCapability(holder, TORTURER_CAP)) {
    const thr = torturerThreshold(holder);
    const { rv: hRv } = await rollD100WithReroll(null);
    torturerSuccesses = testSuccesses(hRv, thr);
    victimPenalty = torturerVictimPenalty(torturerSuccesses);
    lines.push(`${rollIcon("heart","#c98bff")}Мучитель (${esc(holder.name)}): Medicae−10 → Предел <b>${thr}</b>, бросок <b>${hRv}</b> — ${
      torturerSuccesses ? `<span class="roll-success">${torturerSuccesses} Успех(ов): жертве ${victimPenalty} на встречный тест</span>` : `<span class="roll-failure">Провал</span>`}`);
  }

  const torturerThresholdVal = interrogateIntTotal(torturer) - 20 + torturerMods.total + (Number(torturerMod) || 0);
  const targetThreshold = (target.system.characteristics?.wp?.total ?? 0) + targetMods.total + (Number(targetMod) || 0) + victimPenalty;

  const { rv: torturerRv, rerollNote: torturerRerollNote } = await rollD100WithReroll(torturerMods.reroll);
  const { rv: targetRv, rerollNote: targetRerollNote } = await rollD100WithReroll(targetMods.reroll);
  const mine   = { ...testOutcome(torturerRv, torturerThresholdVal), threshold: torturerThresholdVal };
  const theirs = { ...testOutcome(targetRv, targetThreshold), threshold: targetThreshold };
  const { winner, margin } = resolveOpposed(mine, theirs);
  await clearForesight(torturer); // бросок пытающего — тест I: +10 Предусмотрительности потрачен

  const tMods = [...torturerMods.parts, torturerMod ? `мод. ${torturerMod >= 0 ? "+" : ""}${torturerMod}` : ""].filter(Boolean);
  const vMods = [...targetMods.parts, targetMod ? `мод. ${targetMod >= 0 ? "+" : ""}${targetMod}` : "", victimPenalty ? `Мучитель ${victimPenalty}` : ""].filter(Boolean);
  lines.push(
    `${rollIcon("target","#c98bff")}${esc(torturer.name)}: <b>${torturerRv}</b> vs ${torturerThresholdVal}${tMods.length ? ` (${esc(tMods.join(", "))})` : ""} ${mine.success ? "(успех)" : "(провал)"}`,
    torturerRerollNote,
    `${rollIcon("target","#8a8a8a")}${esc(target.name)}: <b>${targetRv}</b> vs ${targetThreshold}${vMods.length ? ` (${esc(vMods.join(", "))})` : ""} ${theirs.success ? "(успех)" : "(провал)"}`,
    targetRerollNote
  );

  if (winner !== "mine") {
    lines.push(`<b>Жертва выстояла</b> — пытка не принесла пользы.`);
    // Мучитель: «при неудачном тесте пыток не наносит урон жертве и не делает
    // её непригодной для дальнейших пыток». Урон общий диалог не считает —
    // подсказка стола, что на этот раз его нет.
    if (holder && hasTalentCapability(holder, TORTURER_CAP)) {
      lines.push(`${rollIcon("heart","#c98bff")}Мучитель: неудача пытки — жертва не получает урона и остаётся пригодной для дальнейших пыток.`);
    }
    // Встречный тест: Порогов два, они расписаны построчно с подписями
    // модификаторов — общей строки Порога/броска у такой карточки быть не может.
    await postTestCard(torturer, { title, lines: [lines.filter(Boolean).join("<br/>")] }, { sound: false });
    return { winner, margin, torturerSuccesses };
  }

  if (!skillful) {
    lines.push(`<b>Жертва сломлена</b> (запас ${margin}). Урон и пригодность к дальнейшим пыткам ведёт ГМ.`);
    // Пожиратель Боли: «успешно проведя Пытку» — теперь триггер и у общей пытки.
    const eater = margin > 0 && hasRuleFlag(torturer, EATER_OF_PAIN_CAPABILITY)
      ? eaterOfPainChoiceButtonsHtml(torturer.uuid, margin) : "";
    if (eater) lines.push(`${rollIcon("heart","#ff6bd6")}Пожиратель Боли (${margin} Успехов):`);
    await postTestCard(torturer, { title: `${title} — успех`, lines: [lines.filter(Boolean).join("<br/>"), eater] }, { sound: false });
    return { winner, margin, torturerSuccesses };
  }

  const tiers = extraTiers(margin);
  const healRolls = [];
  for (let i = 0; i < 1 + tiers; i++) {
    const r = await new Roll("1d5").evaluate();
    healRolls.push(r.total);
  }
  lines.push(`Победа с margin <b>${margin}</b> — доп. тиров: <b>${tiers}</b>, броски лечения: ${healRolls.join(", ")}`);

  const recipients = drukhariNearby();
  const benefited = [], capped = [];
  for (const actor of recipients) {
    if (!tortureBenefitAvailable(actor)) { capped.push(actor.name); continue; }
    const { totalHeal, pain } = await grantTortureBenefit(actor, healRolls);
    await markTortureBenefitUsed(actor);
    benefited.push(`${esc(actor.name)} (+${pain} Боли, +${totalHeal} лечения)`);
  }
  if (benefited.length) lines.push(`<b>Получили пользу:</b> ${benefited.join(", ")}`);
  if (capped.length) lines.push(`<span style="color:#a33;">Дневной лимит исчерпан:</span> ${capped.map(esc).join(", ")}`);
  if (!recipients.length) lines.push(`<i>Рядом нет друкхари, способных насытиться.</i>`);

  // Eater of Pain/Пожиратель Боли (Слаанеш, wdbc-1rno): «успешно проведя
  // Пытку... преимущества за каждый Успех». margin — та же мера «Успехов», что
  // extraTiers() даёт тирам друкхари; одна кнопка на margin кубов разом.
  const eaterOfPainButtons = margin > 0 && hasRuleFlag(torturer, EATER_OF_PAIN_CAPABILITY)
    ? eaterOfPainChoiceButtonsHtml(torturer.uuid, margin) : "";
  if (eaterOfPainButtons) lines.push(`${rollIcon("heart","#ff6bd6")}Пожиратель Боли (${margin} Успехов):`);

  await postTestCard(torturer, {
    title: `${title} — успех`,
    lines: [lines.filter(Boolean).join("<br/>"), eaterOfPainButtons]
  }, { sound: false });
  return { winner, margin, torturerSuccesses };
}

/**
 * Диалог пытки: цель — таргет (T), параметры — модификаторы сторон и
 * ассистент-Мучитель. skillful: Искусная Пытка (требует Беспомощную жертву).
 */
export async function showTortureDialog(torturer, { skillful = false } = {}) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn("Наведите таргет (T) на жертву.");
  if (skillful && !target.system?.conditions?.helpless) {
    return ui.notifications.warn(`«${target.name}» не отмечен(а) как Беспомощный — пытка требует беспомощную жертву.`);
  }
  // Feels No Pain / Не Чувствует Боли (wdbc-1rno) и Метка Слаанеш (wdbc-f7fn):
  // «иммунен к пыткам» — общее имя defence.tortureImmune заведено ради второго.
  if (isTortureImmune(target)) {
    return ui.notifications.warn(`«${target.name}» не чувствует боли — пытка на неё не действует.`);
  }

  const holders = torturerHolders(torturer, target);
  const title = skillful ? "Искусная Пытка" : "Пытка";
  const torturerPreview = interrogateIntTotal(torturer) - 20;
  const targetPreview = target.system.characteristics?.wp?.total ?? 0;
  const holderOptions = holders.length
    ? `<option value="">— без Мучителя —</option>` + holders.map((h, i) => `<option value="${esc(h.id)}" ${i === 0 ? "selected" : ""}>${esc(h.name)}${h.id === torturer.id ? " (сам)" : " (ассистент)"}</option>`).join("")
    : "";
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("skull","#c98bff")}${title}</span></div>
      <div class="roll-threshold">Пытающий: ${esc(torturer.name)} — Допрос(Int)−20: <b>${torturerPreview}</b> (без Черт и модификаторов)</div>
      <div class="roll-threshold">Жертва: ${esc(target.name)} — Воля: <b>${targetPreview}</b></div>
      <div class="atk-dlg-row"><label>Мод. пытающего:</label><input type="number" id="torture-mod-self" value="0" style="width:60px;"/></div>
      <div class="atk-dlg-row"><label>Мод. жертвы:</label><input type="number" id="torture-mod-target" value="0" style="width:60px;"/></div>
      ${holders.length ? `<div class="atk-dlg-row"><label title="Талант «Мучитель»: тест Medicae−10, −3 жертве за каждый Успех; при неудаче пытки — без урона жертве">Мучитель:</label><select id="torture-holder">${holderOptions}</select></div>` : ""}
      <div style="font-size:0.85em;color:#8a8a8a;margin-top:6px;">${skillful
        ? "5 минут пытки. При успехе — Боль и лечение Характеристик всем друкхари рядом (в бою — комбатанты, иначе — на сцене), с учётом их личного дневного лимита (W.b раз в сутки)."
        : "Встречный тест Допрос(Int)−20 против Воли жертвы. Урон жертве и её пригодность к дальнейшим пыткам ведёт ГМ."}</div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Пытать", icon: "fas fa-skull", default: true,
        callback: async (event, button) => {
          const form = button.form;
          const num = sel => parseInt(form.querySelector(sel)?.value) || 0;
          const holderId = form.querySelector("#torture-holder")?.value || "";
          await resolveTorture(torturer, target, {
            skillful, torturerMod: num("#torture-mod-self"), targetMod: num("#torture-mod-target"),
            holder: holders.find(h => h.id === holderId) ?? null
          });
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}
