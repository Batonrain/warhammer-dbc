// module/combat/kenetai.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кенетаи — кнопки Черт и Талантов (обвязка rules/kenetai-talents.mjs).
//
//   Оккультный Клинок — кнопка на карточке рукопашного попадания
//     Психосиловым оружием (и кнопка Черты): окно манифестации силы
//     полудействия свободным действием, без Путей, одно попадание
//     (форма попаданий — psyker-elite-hooks.mjs::eliteShotShape);
//     Разрушитель Чар — вместо силы встречный W против W цели и снятие
//     одного эффекта психосилы; Выпад Души — Успехи попадания к манифестации.
//   Общее Сознание — ритуал 5 минут на выделенных союзников (до бPR); бонус
//     к тестам WS — источник правил rules/sources.mjs.
// ════════════════════════════════════════════════════════════════════════

import {
  OCCULT_BLADE_FLAG, SOUL_BURN_ROUND_FLAG, SHARED_MIND_FLAG,
  hasOccultBlade, hasSharedConsciousness, hasSoulThrust, hasSpellBreaker, hasWayOfTwoBlades,
  isForceMelee, occultBladeAllowed, soulBurnBlockedByOccultBlade, sharedMindRange, sharedMindCap,
  setSharedMindResolver
} from "../rules/kenetai-talents.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { showManifestDialog } from "../sheets/tabs/psychic.mjs";
import { roundTag, markOccultBladeUse } from "./kenetai-state.mjs";
import { esc } from "../helpers/utils.mjs";
import { askSelect, askNumber, askConfirm, infoCard, actorsDistance, targetedActors } from "./psyker-elite-common.mjs";

const NS = "warhammer-dbc";
const BTN_CLASS = "wh-occult-blade-btn";
const line = html => `<div class="roll-threshold">${html}</div>`;

// Живой бонус Общего Сознания: акторы сцены, uuid → документ, расстояние.
setSharedMindResolver({
  actors: () => {
    const seen = new Set(), out = [];
    for (const t of globalThis.canvas?.tokens?.placeables ?? []) {
      const a = t.actor;
      if (a && !seen.has(a.uuid)) { seen.add(a.uuid); out.push(a); }
    }
    return out;
  },
  fromUuid: uuid => { try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch { return null; } },
  dist: (a, b) => actorsDistance(a, b)
});

/** Выжигание Души: метка Раунда и запрет после Оккультного Клинка. Возвращает причину отказа или "". */
export async function kenetaiSoulBurnGate(actor) {
  const tag = roundTag();
  if (!tag || !hasOccultBlade(actor)) return "";
  if (soulBurnBlockedByOccultBlade(actor, tag)) return "Оккультный Клинок уже применён в этом Раунде — Выжигания Души не будет (Путь Двух Клинков снимает запрет).";
  await actor.setFlag(NS, SOUL_BURN_ROUND_FLAG, tag);
  return "";
}

/** Кнопка «Оккультный Клинок» на карточке рукопашного попадания Психосиловым оружием. */
export function injectOccultBladeButtons(html) {
  if (!html?.querySelectorAll || html.querySelector(`.${BTN_CLASS}`)) return;
  for (const applyBtn of html.querySelectorAll(".wh-apply-dmg-btn[data-weapon-uuid]")) {
    if (applyBtn.dataset.psychic === "1") continue;
    let actor = null, weapon = null;
    try {
      actor = fromUuidSync(applyBtn.dataset.attackerUuid);
      weapon = fromUuidSync(applyBtn.dataset.weaponUuid);
    } catch { continue; }
    if (!actor?.isOwner || !hasOccultBlade(actor) || !isForceMelee(weapon)) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.textContent = "🗡 Оккультный Клинок: психосила с кромки клинка";
    btn.title = "Свободное действие: психосила полудействия по цели атаки, без Путей Силы, одно попадание без Избегания.";
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      useOccultBlade(actor, { weaponUuid: weapon.uuid });
    });
    (applyBtn.closest(".roll-dmg-hit-group") ?? applyBtn).after(btn);
    return;
  }
}

/** Оккультный Клинок: сила с кромки клинка (или Разрушитель Чар). */
export async function useOccultBlade(actor, { weaponUuid = "" } = {}) {
  if (!hasOccultBlade(actor)) return ui.notifications.warn("⚠️ Нет Черты Оккультный Клинок.");
  if (!weaponUuid) {
    const blades = [...actor.items].filter(i => isForceMelee(i) && i.system?.equipped);
    if (!blades.length) return ui.notifications.warn("⚠️ Нет снаряжённого Психосилового рукопашного оружия.");
    weaponUuid = blades.length === 1 ? blades[0].uuid
      : await askSelect("Оккультный Клинок", "Попадание оружием", blades.map(b => ({ value: b.uuid, label: b.name })));
    if (!weaponUuid) return;
  }
  const tag = roundTag();
  if (tag) {
    const gate = occultBladeAllowed(actor.getFlag(NS, OCCULT_BLADE_FLAG), tag, weaponUuid,
      { twoBlades: hasWayOfTwoBlades(actor), soulBurnTag: actor.getFlag(NS, SOUL_BURN_ROUND_FLAG) ?? "" });
    if (!gate.ok) return ui.notifications.warn(`⚠️ ${gate.reason}`);
  }
  let mode = "power";
  if (hasSpellBreaker(actor)) {
    mode = await askSelect("Оккультный Клинок", "Что сделать", [
      { value: "power", label: "Манифестировать психосилу по цели атаки" },
      { value: "breaker", label: "Разрушитель Чар: снять с цели эффект психосилы" }
    ]);
    if (!mode) return;
  }
  if (mode === "breaker") return spellBreaker(actor, weaponUuid);

  const powers = [...actor.items].filter(i => i.type === "psychicPower" && (i.system?.action || "half") === "half");
  if (!powers.length) return ui.notifications.warn("⚠️ Нет психосил полудействия.");
  const pid = await askSelect("Оккультный Клинок", "Психосила (полудействие)", powers.map(p => ({ value: p.id, label: p.name })),
    { hint: "Свободным действием, без Путей Силы; только по цели атаки, одно попадание, от которого нельзя Избегать." });
  if (!pid) return;
  let thrust = 0;
  if (hasSoulThrust(actor)) {
    thrust = await askNumber("Выпад Души", "Успехи попадания приёмом Выпад (0 — не Выпад)", 0, { min: 0, max: 20,
      hint: "Для психосил со встречным тестом цели: Успехи попадания прибавятся к Успехам манифестации." });
    if (thrust == null) return;
  }
  showManifestDialog(actor, actor.items.get(pid), { freeAction: true, occultBlade: { weaponUuid, thrust } });
}

async function rollWill(actor, { fail = false } = {}) {
  const mods = collectTestMods(actor, { kind: "characteristic", char: "wp" });
  const threshold = (Number(actor?.system?.characteristics?.wp?.total) || 0) + (Number(mods.total) || 0);
  const roll = await new Roll("1d100").evaluate();
  const o = fail ? { success: false, deg: 1 } : testOutcome(roll.total, threshold);
  return { roll, threshold, success: o.success, deg: o.deg };
}

/** Разрушитель Чар: встречный W+0 против W+0 цели, победа — снять один эффект психосилы. */
async function spellBreaker(actor, weaponUuid) {
  const target = targetedActors()[0];
  if (!target) return ui.notifications.warn("⚠️ Выделите цель атаки.");
  const effects = [...(target.effects ?? [])].filter(e => !e.disabled);
  if (!effects.length) return ui.notifications.warn(`⚠️ На ${target.name} нет эффектов.`);
  const ally = target.isOwner && target !== actor
    ? await askConfirm("Разрушитель Чар", `${esc(target.name)} — союзник и намеренно проваливает встречный тест?`) : false;
  const mine = await rollWill(actor);
  const theirs = await rollWill(target, { fail: ally });
  const res = resolveOpposed(mine, theirs);
  await markOccultBladeUse(actor, weaponUuid);
  const side = (a, r, f) => `W (${esc(a.name)}): <b>${r.threshold}</b> → ${f ? "намеренный провал" : `бросок <b>${r.roll.total}</b> — ${r.success ? "Успех" : "Провал"} ${r.deg}`}`;
  const lines = [line(side(actor, mine)), line(side(target, theirs, ally))];
  if (res.winner !== "mine") {
    lines.push(line(`<span class="roll-failure">Чары держатся</span> — ${esc(target.name)} не уступил.`));
    return infoCard(actor, `Разрушитель Чар → ${target.name}`, lines, { icon: "✂", rolls: [mine.roll, theirs.roll] });
  }
  const id = await askSelect("Разрушитель Чар", "Эффект психосилы", effects.map(e => ({ value: e.id, label: e.name })),
    { hint: "Снимается один эффект по выбору. Поддерживаемую силу заклинатель затем отпускает сам." });
  const eff = id ? target.effects.get(id) : null;
  if (eff) {
    if (target.isOwner || game.user?.isGM) {
      await eff.delete();
      lines.push(line(`<span class="roll-success">Нить разрублена:</span> с ${esc(target.name)} снят эффект «${esc(eff.name)}».`));
    } else {
      lines.push(line(`<span class="roll-success">Нить разрублена:</span> ГМ — снимите с ${esc(target.name)} эффект «${esc(eff.name)}» (нет прав на цель).`));
    }
  }
  await infoCard(actor, `Разрушитель Чар → ${target.name}`, lines, { icon: "✂", rolls: [mine.roll, theirs.roll] });
}

/** Общее Сознание: связать выделенных союзников (до бPR) или распустить связь. */
export async function useSharedConsciousness(actor) {
  if (!hasSharedConsciousness(actor)) return ui.notifications.warn("⚠️ Нет Черты Общее Сознание.");
  const st = actor.getFlag(NS, SHARED_MIND_FLAG);
  if (st?.members?.length) {
    const what = await askSelect("Общее Сознание", "Связь уже есть", [
      { value: "relink", label: "Новый ритуал на выделенных союзников" },
      { value: "drop", label: "Разорвать связь" }
    ]);
    if (!what) return;
    if (what === "drop") {
      await actor.unsetFlag(NS, SHARED_MIND_FLAG);
      return infoCard(actor, "Общее Сознание", [line("Связь разумов разорвана.")], { icon: "🧠" });
    }
  }
  const cap = sharedMindCap(actor);
  const allies = targetedActors().filter(a => a !== actor && a.uuid !== actor.uuid);
  if (!allies.length) return ui.notifications.warn("⚠️ Выделите союзников для связи.");
  if (allies.length > cap) return ui.notifications.warn(`⚠️ Связать можно не больше бPR (${cap}) союзников.`);
  await actor.setFlag(NS, SHARED_MIND_FLAG, { members: allies.map(a => a.uuid) });
  const range = sharedMindRange(actor);
  await infoCard(actor, "Общее Сознание", [
    line(`Ритуал 5 минут: разум связан с ${allies.map(a => `<b>${esc(a.name)}</b>`).join(", ")}.`),
    line(`Пока связанные не дальше <b>${range} м</b>, все получают к тестам WS (и рукопашным атакам) +2 за каждого другого связанного рядом (Кенетаи — +5) — само, в каждом броске.`),
    line("Синхронизация Инициативы, общий обзор и парирование за союзника в 3 м — по договорённости за столом.")
  ], { icon: "🧠" });
}

export const KENETAI_API = { useOccultBlade, useSharedConsciousness };
