// module/apps/naga-traits.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Черты Наги — обвязка Foundry (диалоги, часы, хуки). Числа и правила книги
//  — module/rules/naga-traits.mjs; здесь только чтение/запись документов.
//
//  Кто зовёт:
//   • poisonImmunitySource — hooks.mjs::_applyWeaponPropEffect (Toxic);
//   • extraWoundDailyClock — combat/condition-clock.mjs (часы Календаря);
//   • useAdaptiveVenom — запись kind:"script" Черты «Адаптивная Отрава»
//     (помощник apps/item-script.mjs);
//   • checkDarkPrinceMilestones / enforceLockedPatron / grantLockedPatron —
//     хуки в warhammer-dbc.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag, ruleFlagLabels } from "../rules/flags.mjs";
import {
  POISON_IMMUNE_CAPABILITY, EXTRA_WOUND_DAILY_CAPABILITY, EXTRA_WOUND_DAILY_FLAG,
  extraWoundDailyPlan, adaptiveVenomCandidates, ADAPTIVE_VENOM_DOSE_FLAG,
  LOCKED_SLAANESH_CAPABILITY, LOCKED_PATRON, patronChangeBlocked,
  DARK_PRINCE_MILESTONE_CAPABILITY, DARK_PRINCE_TAKEN_FLAG, DARK_PRINCE_ARMS,
  DARK_PRINCE_INFAMY_MAX, darkPrinceMilestonesDue
} from "../rules/naga-traits.mjs";
import { isMultipleArmsTrait } from "../rules/cybernetic-excellence.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { actorInfamyValue, actorInfamyPath, spendFromInfamyPool } from "./infamy-points.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Подпись источника иммунитета к ядам — или "" (иммунитета нет). */
export function poisonImmunitySource(actor) {
  if (!hasRuleFlag(actor, POISON_IMMUNE_CAPABILITY)) return "";
  return ruleFlagLabels(actor, POISON_IMMUNE_CAPABILITY)[0] || "Иммунитет к ядам";
}

// ── +1 Рана в сутки (Изуверская Физиология) ─────────────────────────────────

/**
 * Часы Календаря: «дополнительно вылечивает себе 1 Рану в сутки» — поверх
 * обычного лечения (combat/healing-clock.mjs), которое у Наги идёт как у
 * Космодесантника. Обработчик CONDITION_CLOCK_HANDLERS.
 */
export async function extraWoundDailyClock(actor, { to } = {}) {
  if (!hasRuleFlag(actor, EXTRA_WOUND_DAILY_CAPABILITY)) return;
  const sys = actor.system;
  if (!sys?.wounds) return;
  const woundMax = Number(sys.wounds.effectiveMax ?? sys.wounds.max) || 0;
  const missing = Math.max(0, woundMax - (Number(sys.wounds.value) || 0)) + (Number(sys.wounds.critical) || 0);
  const plan = extraWoundDailyPlan({ lastAt: actor.getFlag?.(NS, EXTRA_WOUND_DAILY_FLAG), worldTime: to, missing });
  if (plan.nextAt === null) return;
  const update = { [`flags.${NS}.${EXTRA_WOUND_DAILY_FLAG}`]: plan.nextAt };
  if (plan.heal > 0) Object.assign(update, computeWoundHealing(sys, plan.heal));
  await actor.update(update);
  if (!plan.heal) return;
  const src = ruleFlagLabels(actor, EXTRA_WOUND_DAILY_CAPABILITY)[0] || "Доп. лечение";
  const rollMode = actor.hasPlayerOwner ? game.settings.get("core", "rollMode") : "gmroll";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart", "#ff8a8a")}${esc(actor.name)} — ${esc(src)}</div>
      <div class="roll-threshold">+1 Рана в сутки сверх обычного лечения: суток ${plan.days}, восстановлено Ран: <b>${plan.heal}</b>.</div>
    </div>`
  }, rollMode));
}

// ── Адаптивная Отрава: превратить яд в клыках ───────────────────────────────

/**
 * «Может потратить Очко Бесчестия, чтобы превратить яд в своих клыках в
 * любой другой яд с вектором рана, инъекция или еда … и Редкостью не более 2
 * на 1 укус или одну дозу в еду; … 3 Очка для Редкости 3 и 5 Очков для
 * Редкости 4». Список ядов — из компендиума Химии; выбранный яд ложится на
 * лист одной дозой («… (яд в клыках)»), и её применяют к укушенной цели
 * обычной кнопкой препарата. Прежняя неизрасходованная доза заменяется —
 * в клыках один яд за раз.
 */
export async function useAdaptiveVenom(actor) {
  if (!actor) return;
  const pack = game.packs?.get(`${NS}.chemistry`);
  const docs = pack ? await pack.getDocuments() : [];
  const options = adaptiveVenomCandidates(docs);
  if (!options.length) return ui.notifications.warn("Адаптивная Отрава: в компендиуме Химии не нашлось подходящих ядов.");
  const have = actorInfamyValue(actor) + tempInfamyAmount(actor);
  const optHtml = options.map((o, i) => `<option value="${i}" ${o.cost > have ? "disabled" : ""}>`
    + `${esc(o.doc.name)} — R${Number(o.doc.system.availability) || 0}, ${o.cost} ОБ</option>`).join("");
  const pick = await foundry.applications.api.DialogV2.wait({
    window: { title: `Адаптивная Отрава — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form style="padding:4px 6px;">
      <p style="margin:4px 0;">Яд с вектором рана/инъекция/еда. Цена: Редкость ≤2 — 1 Очко Бесчестия, R3 — 3, R4 — 5. Есть: <b>${have}</b>.</p>
      <select name="venom" style="width:100%;">${optHtml}</select></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Превратить", default: true,
        callback: (_e, button) => Number(button.form.querySelector('select[name="venom"]')?.value) },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  if (pick === null || pick === undefined || Number.isNaN(pick)) return;
  const chosen = options[pick];
  if (!chosen) return;
  if (chosen.cost > have) return ui.notifications.warn(`Адаптивная Отрава: не хватает Очков Бесчестия (нужно ${chosen.cost}).`);
  const path = actorInfamyPath(actor);
  const spent = await spendFromInfamyPool(actor, chosen.cost, path);
  if (!spent) return;
  if (spent.poolSpent > 0) await actor.update({ [path]: spent.poolValue });

  const old = actor.items.filter(i => i.getFlag?.(NS, ADAPTIVE_VENOM_DOSE_FLAG));
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id));
  const data = chosen.doc.toObject();
  delete data._id;
  data.name = `${chosen.doc.name} (яд в клыках)`;
  data.system = { ...(data.system || {}), quantity: 1 };
  data.flags = { ...(data.flags || {}), [NS]: { ...(data.flags?.[NS] || {}), adaptiveVenomDose: true } };
  await actor.createEmbeddedDocuments("Item", [data]);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("blood", "#9d7cd8")}Адаптивная Отрава — ${esc(actor.name)}</div>
      <div class="roll-threshold">Яд в клыках: <b>${esc(chosen.doc.name)}</b> (R${Number(chosen.doc.system.availability) || 0}), потрачено Очков Бесчестия: <b>${chosen.cost}</b>.</div>
      <div class="roll-threshold" style="font-size:0.85em;">На 1 укус или 1 дозу в еду: примените дозу «${esc(data.name)}» к укушенной цели кнопкой препарата.</div>
    </div>`
  });
}

/**
 * Ввести цели укуса дозу «(яд в клыках)» (wdbc-s4ql0): цель — отмеченный
 * (targeted) токен, иначе выделенный не-укусивший; применение — обычный
 * applyDrug с получателем, после него израсходованная доза убирается с листа.
 */
export async function injectFangVenom(attackerUuid) {
  const doc = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const attacker = doc?.actor ?? doc ?? null;
  const dose = [...(attacker?.items ?? [])].find(i => i.getFlag?.(NS, ADAPTIVE_VENOM_DOSE_FLAG));
  if (!attacker || !dose) return ui.notifications.warn("Яд клыков: доза не найдена на листе укусившей.");
  const token = [...(game.user?.targets ?? [])][0]
    ?? (canvas?.tokens?.controlled ?? []).find(t => t.actor && t.actor.id !== attacker.id);
  const target = token?.actor;
  if (!target) return ui.notifications.warn("Яд клыков: отметьте цель (T) или выделите её токен.");
  const { applyDrug } = await import("../sheets/tabs/drugs.mjs");
  await applyDrug(attacker, dose, target);
  if ((Number(dose.system?.quantity) || 0) <= 0) await attacker.deleteEmbeddedDocuments("Item", [dose.id]).catch(() => {});
}

// ── Дитя Тёмного Принца ─────────────────────────────────────────────────────

/** Черта-шаблон «Multiple Arms» из компендиума — если своей у актора нет. */
async function multipleArmsTemplate() {
  const pack = game.packs?.get(`${NS}.traits`);
  if (!pack) return null;
  const index = await pack.getIndex();
  const hit = index.find(e => isMultipleArmsTrait({ type: "trait", name: e.name }));
  return hit ? pack.getDocument(hit._id) : null;
}

/**
 * «Еще 2 пары рук (и Трейт Multiple Arms (+2))» — рейтинг Многорукого +2.
 * Свой вклад помнится флагом на Черте (dpcArms), как у Кибернетического
 * Превосходства (apps/cybernetic-excellence.mjs): тот меняет рейтинг
 * разницей и нашего вклада не затирает.
 */
async function addDarkPrinceArms(actor) {
  const trait = [...actor.items].find(isMultipleArmsTrait) || null;
  if (trait) {
    const prev = Number(trait.getFlag(NS, "dpcArms")) || 0;
    await trait.update({
      "system.rating": (Number(trait.system?.rating) || 0) + DARK_PRINCE_ARMS,
      [`flags.${NS}.dpcArms`]: prev + DARK_PRINCE_ARMS
    });
    return;
  }
  const src = await multipleArmsTemplate();
  if (!src) return ui.notifications.warn("Многорукий: шаблон Черты не найден в компендиуме — поднимите рейтинг вручную.");
  // Конструктор тянет за собой полсистемы — грузим, только когда понадобился
  // (этот файл импортируют часы Состояний и hooks.mjs).
  const { rescaleTraitByRating } = await import("./mechanics.mjs");
  const data = src.toObject();
  delete data._id;
  const rating = 2 + DARK_PRINCE_ARMS;
  rescaleTraitByRating(data, rating);
  data.system.hasRating = true;
  data.system.rating = rating;
  data.flags = { ...(data.flags || {}), [NS]: { ...(data.flags?.[NS] || {}), dpcArms: DARK_PRINCE_ARMS } };
  await actor.createEmbeddedDocuments("Item", [data]);
}

const pendingMilestones = new Set();

/**
 * «Впервые набирая 30, 60, и 90 Inf, Нага может выбрать либо получить еще 2
 * пары рук…, либо получить +2 к максимуму Очков Бесчестия». Спрашивает за
 * каждый достигнутый и ещё не отыгранный порог; закрыл окно — спросит при
 * следующей правке актора (порог не сгорает).
 */
export async function checkDarkPrinceMilestones(actor) {
  if (!actor || pendingMilestones.has(actor.id)) return;
  if (!hasRuleFlag(actor, DARK_PRINCE_MILESTONE_CAPABILITY)) return;
  const taken = [...(actor.getFlag?.(NS, DARK_PRINCE_TAKEN_FLAG) ?? [])];
  const due = darkPrinceMilestonesDue(actor.system?.characteristics?.inf?.total, taken);
  if (!due.length) return;
  pendingMilestones.add(actor.id);
  try {
    for (const threshold of due) {
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: `Дитя Тёмного Принца — ${actor.name}` },
        classes: ["warhammer-dbc", "wh-holo"],
        content: `<p style="margin:4px 6px;">Впервые набрано <b>${threshold} Inf</b>. Дар Слаанеш на выбор:</p>`,
        rejectClose: false,
        buttons: [
          { action: "arms", label: `Ещё руки: Многорукий +${DARK_PRINCE_ARMS}`, default: true, callback: () => "arms" },
          { action: "infamy", label: `+${DARK_PRINCE_INFAMY_MAX} к максимуму Очков Бесчестия`, callback: () => "infamy" }
        ]
      });
      if (!choice) return;
      if (choice === "arms") await addDarkPrinceArms(actor);
      else await actor.update({ "system.infamyMaxMod": (Number(actor.system?.infamyMaxMod) || 0) + DARK_PRINCE_INFAMY_MAX });
      taken.push(threshold);
      await actor.setFlag(NS, DARK_PRINCE_TAKEN_FLAG, [...taken]);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark", "#d98cff")}Дитя Тёмного Принца — ${threshold} Inf</div>
          <div class="roll-threshold">${choice === "arms"
            ? `Выросли новые руки: Многорукий +${DARK_PRINCE_ARMS}.`
            : `Максимум Очков Бесчестия +${DARK_PRINCE_INFAMY_MAX}.`}</div>
        </div>`
      });
    }
  } finally {
    pendingMilestones.delete(actor.id);
  }
}

/**
 * «Не может потерять» покровительство Слаанеш: попытка сменить Покровителя
 * откатывается в preUpdateActor. Возвращает true, если правка вычищена.
 */
export function enforceLockedPatron(actor, changes) {
  const next = changes?.system?.patronGod;
  if (next === undefined || !patronChangeBlocked(next)) return false;
  if (!hasRuleFlag(actor, LOCKED_SLAANESH_CAPABILITY)) return false;
  delete changes.system.patronGod;
  ui.notifications?.warn(`${actor.name}: покровительство Слаанеш нельзя потерять (${ruleFlagLabels(actor, LOCKED_SLAANESH_CAPABILITY)[0] || "Черта"}).`);
  return true;
}

/** Несёт ли предмет запись Конструктора «Возможность» с этим ключом (дешёвый отбор для хуков). */
export function itemGrantsCapability(item, key) {
  const groups = item?.flags?.[NS]?.mechanics;
  if (!Array.isArray(groups)) return false;
  const walk = entries => (entries || []).some(e => (e?.kind === "capability" && e.capabilityKey === key)
    || (e?.kind === "group" && walk(e.group?.entries)));
  return groups.some(g => walk(g.entries));
}

/** «Начинает игру с покровительством Слаанеш» — ставится, как только Черта на листе. */
export async function grantLockedPatron(actor) {
  if (!actor || actor.system?.patronGod === undefined) return;
  if (actor.system.patronGod === LOCKED_PATRON) return;
  if (!hasRuleFlag(actor, LOCKED_SLAANESH_CAPABILITY)) return;
  await actor.update({ "system.patronGod": LOCKED_PATRON });
}
