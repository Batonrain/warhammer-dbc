// module/combat/extinguish.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тушение Горения (книга, «Раны и Урон» → «Огонь», wdbc-x1nz.2.93):
//  «Персонаж может потушить себя за полудействие, упав на землю и
//  покатавшись, тестом на А–20, хотя природа пламени и горючесть одежды
//  персонажа могут менять модификатор к этому броску по решению ГМа. Другие
//  персонажи в контакте с горящим могут потушить его полудействием и тестом
//  А+0, но при Критическом Провале они сами Загораются.»
//
//  Раньше горящего тушил только ГМ крестиком на теге. Образец — действие
//  «Встать» (combat/movement-actions.mjs::_standUpPlain): ОД через
//  action-economy.mjs, Состояния через единую точку conditions.mjs.
//
//  Решения, не записанные в книге буквально:
//   - «упав на землю» — тушащий себя становится Поваленным при ЛЮБОМ исходе
//     теста: он лёг и катался, успех решает только, погасло ли пламя. Встать —
//     обычное действие «Встать». Помогающий другому не падает.
//   - «в контакте» — Базовый/Глубокий контакт токенов (combat/free-attack.mjs::
//     allContactTokenDocs, тот же, что у рикошета в Рукопашной). Без токенов на
//     сцене (тушат «на словах») контакт не проверяется.
//   - Критический Провал — натуральные 96–100 (rules/roll-outcome.mjs::
//     criticalOutcome); он же всегда провал тушения.
//
//  Кнопка — вкладка БОЙ, строка «Лечение» (templates/actor/parts/tab-combat.hbs,
//  sheets/tabs/combat.mjs). Для макроса: showExtinguishDialog(actor) или
//  extinguishBurning(actor, patient, {mod}).
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { rollConditionCharTest, BURNING_FORMULA_FLAG } from "./condition-ticks.mjs";

const NS = "warhammer-dbc";

/** Модификатор книги: себя A−20, другого A+0. */
export function extinguishBookMod(self) {
  return self ? -20 : 0;
}

const sameActor = (a, b) => a === b || (a?.id != null && a.id === b?.id);

/**
 * В контакте ли тушащий с горящим. Нет токена у кого-то из двоих (или нет
 * сцены) — проверять нечем, тушение не запрещается.
 */
async function inContactWith(actor, patient) {
  const mine   = actor?.getActiveTokens?.(false, true)?.[0];
  const theirs = patient?.getActiveTokens?.(false, true)?.[0];
  if (!mine || !theirs || !globalThis.canvas?.tokens) return true;
  // Лениво: free-attack.mjs тянет за собой регионы сцены.
  const { allContactTokenDocs } = await import("./free-attack.mjs");
  return allContactTokenDocs(mine).some(d => d.id === theirs.id);
}

/**
 * Потушить Горение: себя (A−20, ложится) или другого в контакте (A+0, при
 * Критическом Провале загорается сам). Полудействие.
 * @returns {Promise<null|{success:boolean, critFail:boolean, eff:number, rv:number}>}
 */
export async function extinguishBurning(actor, patient = actor, { mod = 0 } = {}) {
  if (!actor || !patient) return null;
  if (!patient.system?.conditions?.burning) {
    ui.notifications.warn(`${patient.name}: не горит.`);
    return null;
  }
  const self = sameActor(actor, patient);
  if (!self && !await inContactWith(actor, patient)) {
    ui.notifications.warn(`${actor.name} не в контакте с ${patient.name} — дотянуться нечем.`);
    return null;
  }
  if (!await spendActionPoints(actor, 1, { physical: true })) {
    ui.notifications.warn("⚠️ Не хватает ОД (полудействие).");
    return null;
  }

  const bookMod = extinguishBookMod(self);
  const t = await rollConditionCharTest(actor, "ag", bookMod + (Number(mod) || 0));
  const critFail = criticalOutcome(t.rv).failure;
  const success = t.success && !critFail;

  const lines = [];
  if (success) {
    await patient.update({
      ...conditionRemoveFields("burning"),
      ...(patient.getFlag?.(NS, BURNING_FORMULA_FLAG) ? { [`flags.${NS}.-=${BURNING_FORMULA_FLAG}`]: null } : {})
    });
  }
  if (self) {
    const prone = actor.system?.conditions?.prone ? {} : conditionApplyFields("prone", null, actor);
    if (Object.keys(prone).length) {
      await actor.update(prone);
      lines.push(`<div class="roll-threshold">Упал на землю и катался — Повален (встать — действие «Встать»).</div>`);
    }
  } else if (critFail) {
    const ignite = conditionApplyFields("burning", null, actor);
    if (Object.keys(ignite).length) {
      await actor.update(ignite);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}<b>Критический Провал</b> — ${esc(actor.name)} сам Загорается!</div>`);
    }
  }

  const parts = [`${self ? "себя" : "другого"} ${bookMod >= 0 ? "+" : ""}${bookMod}`,
    mod ? `ГМ ${mod >= 0 ? "+" : ""}${mod}` : null, ...t.parts].filter(Boolean);
  await postTestCard(actor, {
    icon: rollIcon("fire", "#ff8a3a"),
    title: self ? `Потушить себя — ${esc(actor.name)}` : `Потушить ${esc(patient.name)} — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: self ? "Ag−20" : "Ag+0", base: t.base, parts, threshold: t.eff, rv: t.rv }),
    lines,
    outcome: outcomeHtml(success, success
      ? `Пламя сбито — ${esc(patient.name)} больше не горит (полудействие).`
      : `Не удалось — ${esc(patient.name)} всё ещё горит (полудействие потрачено).`)
  }, { rolls: [t.roll] });
  return { success, critFail, eff: t.eff, rv: t.rv };
}

/**
 * Окно: кого тушить (себя / выбранную цель) и модификатор ГМа («природа
 * пламени и горючесть одежды»). По умолчанию — горящая цель, если она есть,
 * иначе сам.
 */
export async function showExtinguishDialog(actor) {
  if (!actor) return null;
  const tgt = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const tgtBurning = !!tgt && !sameActor(tgt, actor) && !!tgt.system?.conditions?.burning;
  const selfBurning = !!actor.system?.conditions?.burning;
  if (!selfBurning && !tgtBurning) {
    ui.notifications.warn(`Никто не горит: ни ${actor.name}, ни выбранная цель.`);
    return null;
  }
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-row"><label>Кого:</label>
        <select id="ext-who">
          ${selfBurning ? `<option value="self">${esc(actor.name)} (себя, Ag−20, ляжет)</option>` : ""}
          ${tgtBurning ? `<option value="target" selected>${esc(tgt.name)} (в контакте, Ag+0)</option>` : ""}
        </select>
      </div>
      <div class="atk-dlg-row"><label title="Природа пламени и горючесть одежды — по решению ГМа">Мод. ГМа:</label><input type="number" id="ext-mod" value="0" style="width:60px;"/></div>
    </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Потушить Горение" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 380 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Потушить (полудействие)", icon: "fas fa-fire-extinguisher", default: true,
        callback: async (event, button) => {
          const form = button.form;
          const who = form.querySelector("#ext-who")?.value;
          const mod = parseInt(form.querySelector("#ext-mod")?.value) || 0;
          return extinguishBurning(actor, who === "target" ? tgt : actor, { mod });
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  });
}
