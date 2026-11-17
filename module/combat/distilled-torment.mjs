// module/combat/distilled-torment.mjs
// ════════════════════════════════════════════════════════════════════════
//  Distilled Torment / Дистиллированная Мука (Талант Шумового Десантника,
//  Sahara 1-54b9): «Когда шумовой десантник убивает обладающее душой
//  существо звуковым оружием, он может потратить Реакцию, чтобы обратить его
//  плоть в сверкающую пыль. Он может взять горсть этой пыли (только одну с
//  каждого убитого) и превратить ее в дозу любого наркотика, что он когда-
//  либо принимал, дав этой дозе любой Прием на свой выбор. Для персонажей
//  без Покровительства Слаанеш этот наркотик бесполезен и инертен.»
//
//  Кнопка вкладки БОЙ открывает диалог: какой наркотик (из тех, что носитель
//  принимал — журнал flags.warhammer-dbc.drugsTaken ведётся с момента Таланта, плюс то, что
//  лежит на листе, недельный журнал доз и зависимости), какой Приём. Убийство звуковым оружием
//  система не отслеживает — игрок подтверждает его галочкой. Реакция списывается
//  общей точкой spendReaction; доза — копия препарата (с листа или из пака «Химия») в одном экземпляре.
//
//  «Бесполезен и инертен для не поклоняющихся Слаанеш» — подпись на самой дозе (флаг
//  distilledTorment) и строка карточки; запрета приёма в системе нет.
// ════════════════════════════════════════════════════════════════════════

import { hasAbility } from "../rules/ability-by-key.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { DRUG_DELIVERY } from "../constants/items.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { spendReaction } from "./action-economy.mjs";

const NS = "warhammer-dbc";
export const DRUGS_TAKEN_FLAG = "drugsTaken";
export const DISTILLED_FLAG = "distilledTorment";
export const DISTILLED_DELIVERY = ["injection", "gas", "liquid", "smoke", "patch", "pill"];

export const hasDistilledTorment = actor => hasAbility(actor, "ability.distilledTorment", "Distilled Torment", "talent");

/** Записать приём наркотика в вечный журнал носителя Таланта (drugs.mjs, после применения). */
export async function noteDrugTaken(actor, item) {
  if (!actor?.setFlag || !item?.name || !hasDistilledTorment(actor)) return;
  const name = String(item.name).trim().replace(/\./g, "·");
  const log = actor.getFlag?.(NS, DRUGS_TAKEN_FLAG) ?? {};
  if (log[name]) return;
  await actor.setFlag(NS, DRUGS_TAKEN_FLAG, { [name]: true });
}

/** Названия наркотиков, которые носитель принимал: вечный журнал, лист, недельный журнал, зависимости. Без повторов. */
export function knownDrugNames(actor) {
  const names = new Set();
  const flag = key => actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key] ?? {};
  for (const k of Object.keys(flag(DRUGS_TAKEN_FLAG))) names.add(k);
  for (const k of Object.keys(flag("drugDoses"))) names.add(k);
  for (const [k, v] of Object.entries(flag("drugWithdrawal"))) names.add(String(v?.name || k));
  for (const i of actor?.items ?? []) if (i?.type === "drug" && i.name) names.add(String(i.name));
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "ru"));
}

/** Шаблон препарата: сперва предмет носителя, затем пак «Химия» — по любой половине двуязычного названия. */
async function drugTemplate(actor, name) {
  const own = [...(actor?.items ?? [])].find(i => i?.type === "drug" && (i.name === name || itemHasName(i, name)));
  if (own) return own.toObject();
  const pack = globalThis.game?.packs?.get?.("warhammer-dbc.chemistry");
  if (!pack) return null;
  const hit = [...(pack.index ?? [])].find(e => e.type === "drug" && (e.name === name || itemHasName(e, name)));
  const doc = hit ? await pack.getDocument(hit._id) : null;
  return doc?.toObject?.() ?? null;
}

/** Данные новой дозы: один экземпляр, выбранный Приём, метка происхождения. Чистая функция. */
export function distilledDoseData(template, delivery) {
  const data = foundry.utils.deepClone(template);
  delete data._id;
  data.system = { ...(data.system ?? {}), quantity: 1, deliveryMethod: delivery,
    activeEffect: { isActive: false, isAfterEffect: false, appliedAt: 0, expiresAt: null, roundsRemaining: 0, charDamageStat: "", charDamageAmount: 0 } };
  data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}), [DISTILLED_FLAG]: true } };
  return data;
}

/** Диалог «Пыль из плоти»: выбор наркотика и Приёма, подтверждение убийства, трата Реакции. */
export async function showDistilledTormentDialog(actor) {
  const known = knownDrugNames(actor);
  const drugOpts = known.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const deliveryOpts = DISTILLED_DELIVERY.map(k => `<option value="${k}">${esc(DRUG_DELIVERY[k] ?? k)}</option>`).join("");
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="roll-threshold">Наркотик из тех, что ${esc(actor.name)} когда-либо принимал (журнал ведётся с момента Таланта, плюс лист и зависимости):</div>
      <div class="atk-dlg-row"><select name="drug" style="width:100%;">${drugOpts || `<option value="">— журнал пуст —</option>`}</select></div>
      <div class="atk-dlg-row"><label>Другой (название):</label><input type="text" name="drugOther" placeholder="если принимал раньше" style="width:55%;"/></div>
      <div class="atk-dlg-row"><label>Приём:</label><select name="delivery">${deliveryOpts}</select></div>
      <div class="atk-dlg-row"><label title="Система не отслеживает убийства звуковым оружием — подтвердите сами"><input type="checkbox" name="killed"/> Убил звуковым оружием существо с душой (Реакция тратится)</label></div>
      <div style="font-size:0.85em;color:#8a8a8a;margin-top:6px;">Одна доза с одного убитого. Для не поклоняющихся Слаанеш доза бесполезна и инертна.</div>
    </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Дистиллированная Мука" }, classes: ["wh-attack-dialog", "warhammer-dbc"], position: { width: 420 }, content, rejectClose: false,
    buttons: [
      {
        action: "go", label: "Обратить в пыль", icon: "fas fa-flask", default: true,
        callback: async (event, button) => {
          const form = button.form;
          if (!form.querySelector("[name=killed]")?.checked) return ui.notifications.warn("Нужно убийство обладающего душой существа звуковым оружием — отметьте галочку.");
          const name = (form.querySelector("[name=drugOther]")?.value || "").trim() || form.querySelector("[name=drug]")?.value || "";
          if (!name) return ui.notifications.warn("Выберите или впишите наркотик.");
          const delivery = form.querySelector("[name=delivery]")?.value || "injection";
          await makeDistilledDose(actor, name, delivery);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}

/** Потратить Реакцию и выдать дозу. */
export async function makeDistilledDose(actor, name, delivery) {
  const template = await drugTemplate(actor, name);
  if (!template) return ui.notifications.warn(`Не нашёл наркотик «${name}» ни на листе, ни в паке «Химия» — создайте дозу вручную.`);
  if (!await spendReaction(actor, { physical: false })) return;
  const data = distilledDoseData(template, delivery);
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  await postTestCard(actor, {
    icon: rollIcon("warp", "#e85ad6"), title: `Дистиллированная Мука — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Плоть обратилась в сверкающую пыль: доза «${esc(created?.name ?? name)}», Приём — <b>${esc(DRUG_DELIVERY[delivery] ?? delivery)}</b>.</div>`,
      `<div>Для не поклоняющихся Слаанеш эта доза бесполезна и инертна.</div>`
    ]
  }, { sound: false });
  return created;
}
