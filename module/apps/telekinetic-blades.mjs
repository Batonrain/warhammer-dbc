// module/apps/telekinetic-blades.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Клинки Силы после удачной манифестации (wdbc-1rno.28). Правила —
//  rules/telekinetic-blades.mjs, призванное оружие — rules/summoned-weapon.mjs.
//
//  • Телекинетический Клинок: выбрать образцы (по одному на клинок, выбор
//    запоминается на силе), положить на лист экипированные клинки, включить
//    поддержание. Снятое поддержание (галочка «Подд.», Варп-Замок, сон…)
//    растворяет клинки — хук в module/hooks.mjs.
//  • Телекинетическое Лезвие: выбрать одно рукопашное оружие (клинки первыми),
//    записать усиление (system.effects.weaponBuff — тот же канал, что у
//    Силового Клинка, читает combat/weapon-mods.mjs, пока сила поддерживается).
//  • Точный Телекинез: включить поддержание — руки (+2) и полное Незримое
//    клинков считаются из поддержания сами (rules/hands.mjs, combat/attack.mjs).
// ════════════════════════════════════════════════════════════════════════════

import {
  TK_BLADE_CHOICE_FLAG, isTelekineticBlade, isTelekineticEdge, isPrecisionTelekinesis,
  isTelekineticBladeCandidate, telekineticBladeCount, telekineticBladeWeaponData, telekineticEdgeBuff,
  PRECISION_TK_ARMS
} from "../rules/telekinetic-blades.mjs";
import { summonsOf, summonedBy } from "../rules/summoned-weapon.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

const folderPath = doc => {
  const out = [];
  for (let f = doc?.folder; f; f = f.folder) out.unshift(f.name);
  return out;
};

async function candidates() {
  const pack = game.packs?.get(`${NS}.weapons`);
  if (!pack) return [];
  const docs = await pack.getDocuments();
  return docs.filter(d => isTelekineticBladeCandidate({ type: d.type, system: d.system, folderPath: folderPath(d) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Диалог: по одному образцу на клинок. → массив uuid или null. */
async function chooseBlades(actor, power, count) {
  const list = await candidates();
  if (!list.length) { ui.notifications.warn("Телекинетический Клинок: в компендиуме оружия нет примитивного рукопашного."); return null; }
  const remembered = power.getFlag(NS, TK_BLADE_CHOICE_FLAG) ?? [];
  const selects = Array.from({ length: count }, (_, i) => {
    const cur = remembered[i] ?? remembered[0] ?? "";
    const opts = list.map(d => `<option value="${esc(d.uuid)}"${d.uuid === cur ? " selected" : ""}>`
      + `${esc(d.name)} — ${esc(d.system.damage)}, Pen ${Number(d.system.penetration) || 0}</option>`).join("");
    return `<label style="display:block;margin:4px 0;">Клинок ${i + 1}: <select name="b${i}" style="width:100%;">${opts}</select></label>`;
  }).join("");
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: `Телекинетический Клинок — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form style="padding:4px 6px;"><p style="margin:4px 0;">Стандартное примитивное рукопашное оружие, только профили R Dmg. Клинков: <b>${count}</b>.</p>${selects}</form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Создать", default: true,
        callback: (_e, button) => Array.from({ length: count }, (_, i) => button.form.querySelector(`select[name="b${i}"]`)?.value ?? "") },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  if (!Array.isArray(res) || res.some(u => !u)) return null;
  await power.setFlag(NS, TK_BLADE_CHOICE_FLAG, res);
  return res;
}

async function ensureSustained(power) {
  if (!power.system?.isSustained) await power.update({ "system.isSustained": true });
}

async function summonBlades(actor, power, epr) {
  const count = telekineticBladeCount(epr);
  const uuids = await chooseBlades(actor, power, count);
  if (!uuids) return;
  const old = summonsOf(actor, power.id);
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id));
  const data = [];
  for (const [index, uuid] of uuids.entries()) {
    const base = await fromUuid(uuid).catch(() => null);
    if (base) data.push(telekineticBladeWeaponData(base.toObject(), { epr, powerId: power.id, index }));
  }
  if (!data.length) return;
  await actor.createEmbeddedDocuments("Item", data);
  await ensureSustained(power);
  await postTestCard(actor, {
    icon: "🗡️", title: `Телекинетический Клинок — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">В руке: ${data.map(d => `<b>${esc(d.name)}</b> (${esc(d.system.damage)}, Pen ${d.system.penetration})`).join(", ")} — +${epr} Dmg, +${epr} Pen, невесомо.</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Невидим: незасекшие получают −20 к Избеганиям (с Точным Телекинезом — Незримое). Сила поддерживается; снятие поддержания или «Снаряжено» растворяет клинок.</div>`
    ]
  }, { sound: false });
}

function edgeChoices(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i.type === "weapon" && (i.system?.weaponClass === "melee" || i.system?.melee))
    .map(i => ({ id: i.id, name: i.name, equipped: !!i.system?.equipped, tk: summonedBy(i)?.kind === "telekineticBlade" }))
    .sort((a, b) => (b.tk - a.tk) || (b.equipped - a.equipped));
}

async function applyEdge(actor, power, epr) {
  const list = edgeChoices(actor);
  if (!list.length) { ui.notifications.warn("Телекинетическое Лезвие: у персонажа нет рукопашного оружия."); return; }
  let weaponId = list[0].id;
  if (list.length > 1) {
    const opts = list.map(w => `<option value="${esc(w.id)}">${esc(w.name)}${w.equipped ? "" : " (не надето)"}</option>`).join("");
    weaponId = await foundry.applications.api.DialogV2.wait({
      window: { title: `Телекинетическое Лезвие — ${actor.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<form style="padding:4px 6px;"><p style="margin:4px 0;">Одно рукопашное оружие в пределах дальности.</p><select name="w" style="width:100%;">${opts}</select></form>`,
      rejectClose: false,
      buttons: [
        { action: "ok", label: "Наложить", default: true, callback: (_e, b) => b.form.querySelector('select[name="w"]')?.value ?? "" },
        { action: "cancel", label: "Отмена", callback: () => null }
      ]
    });
    if (!weaponId) return;
  }
  const weapon = actor.items.get(weaponId);
  const buff = telekineticEdgeBuff(weapon, epr);
  await power.update({ "system.effects.weaponBuff": buff });
  await ensureSustained(power);
  await postTestCard(actor, {
    icon: "🗡️", title: `Телекинетическое Лезвие — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold"><b>${esc(weapon?.name ?? "")}</b>: +${buff.damageMod} Dmg${buff.penMod ? `, +${buff.penMod} Pen` : ""}, Reinforced — пока сила поддерживается.</div>`,
      buff.penMod ? "" : `<div class="roll-threshold" style="font-size:0.85em;">Профиль не R: Pen не растёт. I(Cr): шипы, +5 на попадание по жёсткой броне — учтите сами, если нет мод. Flanged/Spiked.</div>`]
      .filter(Boolean)
  }, { sound: false });
}

async function applyPrecision(actor, power) {
  await ensureSustained(power);
  await postTestCard(actor, {
    icon: "🖐️", title: `Точный Телекинез — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Пара телекинетических рук: +${PRECISION_TK_ARMS} руки (как Multiple Arms), пока сила поддерживается. Телекинетические Клинки бьют Незримо.</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">WS/BS/S/T/A рук = W псайкера; безоружные атаки ими Незримы — отметьте сами.</div>`]
  }, { sound: false });
}

/**
 * Удавшаяся манифестация психосилы: если это Клинок Силы — сделать своё.
 * @returns {Promise<boolean>} true — сила из этой ветки обработана
 */
export async function runPsychicSummon(actor, power, { epr = 0 } = {}) {
  if (!actor || !power) return false;
  if (isTelekineticBlade(power)) { await summonBlades(actor, power, epr); return true; }
  if (isTelekineticEdge(power)) { await applyEdge(actor, power, epr); return true; }
  if (isPrecisionTelekinesis(power)) { await applyPrecision(actor, power); return true; }
  return false;
}
