// module/apps/battle-forms.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Боевые формы «до конца боя или сцены» — Foundry-обвязка поверх
//  module/rules/battle-forms.mjs (данные форм и чистый расчёт — там).
//
//  Включает форму кнопка на панели «ВОЗМОЖНОСТИ СЕЙЧАС»: запись Конструктора
//  kind:"script" на предмете субрасы с ценой 1 Очко Бесчестия зовёт
//  activateBattleForm(actor, key). Если форма уже действует или не хватает ОД,
//  функция бросает ошибку — runMechScriptEntry тогда Бесчестие НЕ списывает
//  (цена снимается только после успешного скрипта).
//
//  Выключается форма:
//    • концом боя — endBattleFormsOnCombatEnd (hooks.mjs, deleteCombat);
//    • кнопками «🎬 Новая сцена»/«⏻ Конец сессии» — endBattleFormsOnSceneEnd
//      (apps/game-session.mjs);
//    • досрочно, если книга разрешает (Клешня Слаангора) — endBattleForm.
//  Выданные формой предметы помечены флагом battleForm и удаляются; оружие,
//  перестроенное формой, несёт battleFormRevert и возвращается к прежнему.
// ════════════════════════════════════════════════════════════════════════════

import { BATTLE_FORM_FLAG, BATTLE_FORM_REVERT_FLAG, battleFormDef, activeBattleForms,
         grantedByForm, patchedByForm, naturalWeaponsAttacks, deadlyNaturalPatch } from "../rules/battle-forms.mjs";
import { canSpendActionPoints, spendActionPoints } from "../combat/action-economy.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { unlinkedTokens } from "../migrations/unlinked-tokens.mjs";

const NS = "warhammer-dbc";

async function packDocData(pack, id) {
  const doc = await game.packs?.get(`${NS}.${pack}`)?.getDocument(id).catch(() => null);
  if (!doc) return null;
  const data = doc.toObject();
  delete data._id;
  return data;
}

async function card(actor, title, lines) {
  await postTestCard(actor, {
    icon: rollIcon("burst", "#b04040"),
    title: `${esc(title)} — ${esc(actor.name)}`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
  }, { sound: false });
}

/**
 * Включить форму. Бросает ошибку (и тем отменяет списание Бесчестия), если
 * форма уже действует, неизвестна или не хватает ОД на действие.
 */
export async function activateBattleForm(actor, key) {
  const def = battleFormDef(key);
  if (!actor || !def) throw new Error(`неизвестная форма «${key}»`);
  if (activeBattleForms(actor.items).has(key)) throw new Error(`«${def.label}» уже действует`);
  if (def.activateAp && !canSpendActionPoints(actor, def.activateAp))
    throw new Error(`«${def.label}»: не хватает Очков Действия (нужно ${def.activateAp})`);

  const toCreate = [];
  for (const g of def.grant ?? []) {
    const data = await packDocData(g.pack, g.id);
    if (!data) continue;
    if (g.rating != null && data.system) { data.system.hasRating = true; data.system.rating = g.rating; }
    if (g.equip && data.system && "equipped" in data.system) data.system.equipped = true;
    data.flags = { ...(data.flags || {}), [NS]: { ...(data.flags?.[NS] || {}), [BATTLE_FORM_FLAG]: { form: key } } };
    toCreate.push(data);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

  const patched = [];
  if (def.deadlyNaturalWeapons) {
    const updates = [];
    for (const { weapon, trait } of naturalWeaponsAttacks(actor.items)) {
      const plan = deadlyNaturalPatch(weapon.system, trait.system?.rating);
      if (!plan) continue;
      updates.push({ _id: weapon.id, ...plan.patch,
        [`flags.${NS}.${BATTLE_FORM_REVERT_FLAG}`]: { form: key, ...plan.revert } });
      patched.push(weapon.name);
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }

  if (def.activateAp) await spendActionPoints(actor, def.activateAp);
  await card(actor, def.label, [
    def.text,
    patched.length ? `Перестроено оружие: ${patched.map(esc).join(", ")}.` : "",
    "Кончится само — в конце боя или по кнопке «Новая сцена»."
  ].filter(Boolean));
}

/** Снять форму с актора: удалить выданное ею, откатить перестроенное. */
async function revertBattleForm(actor, key) {
  const granted = grantedByForm(actor.items, key).map(i => i.id);
  if (granted.length) await actor.deleteEmbeddedDocuments("Item", granted);
  const updates = patchedByForm(actor.items, key).map(w => {
    const r = w.getFlag(NS, BATTLE_FORM_REVERT_FLAG) || {};
    return { _id: w.id, "system.weaponProps": r.weaponProps ?? w.system.weaponProps,
             "system.penetration": r.penetration ?? w.system.penetration,
             [`flags.${NS}.-=${BATTLE_FORM_REVERT_FLAG}`]: null };
  });
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return granted.length + updates.length > 0;
}

/**
 * Досрочно вернуть форму (Клешня Слаангора: «за полное действие превратить
 * эту руку обратно бесплатно»). Бросает ошибку, если книга досрочного
 * возврата не даёт, формы нет или не хватает ОД.
 */
export async function endBattleForm(actor, key) {
  const def = battleFormDef(key);
  if (!actor || !def) throw new Error(`неизвестная форма «${key}»`);
  if (!def.manualEnd) throw new Error(`«${def.label}» держится до конца боя или сцены`);
  if (!activeBattleForms(actor.items).has(key)) throw new Error(`«${def.label}» сейчас не действует`);
  if (def.endAp && !canSpendActionPoints(actor, def.endAp))
    throw new Error(`«${def.label}»: не хватает Очков Действия (нужно ${def.endAp})`);
  await revertBattleForm(actor, key);
  if (def.endAp) await spendActionPoints(actor, def.endAp);
  await card(actor, def.label, ["Форма возвращена в обычную."]);
}

async function endAllForms(actor) {
  if (!actor?.items) return;
  for (const key of activeBattleForms(actor.items)) await revertBattleForm(actor, key);
}

/** Конец боя: формы участников гаснут (hooks.mjs, deleteCombat). */
export async function endBattleFormsOnCombatEnd(combat) {
  for (const c of combat?.combatants ?? []) await endAllForms(c.actor);
}

/**
 * Конец сцены/сессии (кнопки календаря): форма, включённая вне боя или
 * актором не из трекера, по deleteCombat не откатится — снимаем у всех
 * акторов мира и у несвязанных токенов текущих сцен.
 */
export async function endBattleFormsOnSceneEnd() {
  for (const actor of game.actors ?? []) await endAllForms(actor);
  for (const t of unlinkedTokens()) await endAllForms(t.actor);
}
