// module/combat/psychic-sustain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снятие поддержания психосилы — один набор правок на все пути (пачка I2).
//
//  Раньше эти поля сбрасывал только обработчик галочки «Подд.» на вкладке МИСТИКА
//  (sheets/tabs/psychic.mjs). Теперь поддержание снимает и Варп-Замок («все поддерживаемые
//  психосилы развеиваются»), и список сбросов обязан быть один: забытое поле — это висящая
//  «степень успеха», чужая цель или оружие с купленными свойствами у уже развеянной силы.
// ════════════════════════════════════════════════════════════════════════════

import { forceBladeShopClear } from "../apps/force-blade-choice.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";
import { WOUND_FREE_FLAG } from "../rules/wound-in-reality.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const NS = "warhammer-dbc";

/**
 * Патч предмета-силы «поддержание снято».
 * - wdbc-8m0x/1wvn: сохранённые степень успеха и эPR — иначе на листе висело бы число прошлого каста;
 * - wdbc-vxgd: купленные Force Blade свойства оружия (читаются только пока isSustained);
 * - wdbc-lmd2: цель поддержания (источник cross-actor правил);
 * - Заточение Силы: флаг замка плода;
 * - Рана в Реальности: «бесплатной» сила бывает, только пока поддерживается.
 */
export function sustainOffPatch(item) {
  const upd = {
    "system.isSustained": false,
    "system.sustainedDegree": null,
    "system.sustainedEpr": null,
    "system.sustainedTargetUuid": ""
  };
  if (item?.system?.hasWeaponShop) upd["system.effects.weaponBuff"] = forceBladeShopClear();
  if (item?.getFlag?.(NS, "fruitOfFleshLockUuid")) upd[`flags.${NS}.-=fruitOfFleshLockUuid`] = null;
  if (item?.getFlag?.(NS, WOUND_FREE_FLAG)) upd[`flags.${NS}.-=${WOUND_FREE_FLAG}`] = null;
  return upd;
}

/**
 * Развеять ВСЕ поддерживаемые психосилы актора (Варп-Замок).
 * @returns {Promise<string[]>} имена развеянных сил
 */
export async function dispelAllSustained(actor) {
  const names = [];
  for (const item of [...(actor?.items ?? [])]) {
    if (item?.type !== "psychicPower" || !item.system?.isSustained) continue;
    await item.update(sustainOffPatch(item));
    await syncItemEffectsDisabled(item);
    names.push(item.name);
  }
  return names;
}

// ── Сон и потеря сознания (остаток Талантов, 20.11.2026) ────────────────────
// Книга: «если псайкер … теряет сознание, или засыпает, все поддерживаемые психосилы прекращаются».
// Сон Разума: «позволяет поддерживать одну выбранную при его взятии психосилу даже когда он спит
// или без сознания» — её id лежит флагом актора (кнопка Таланта chooseDreamingPower).

export const DREAMING_FLAG = "dreamingOfMindPower";

/** Встал ли в этой правке Спит/Без сознания/Кома. */
export function sleepDropTriggered(changes) {
  const c = changes?.system?.conditions ?? {};
  return c.asleep === true || c.unconscious === true || c.coma === true;
}

/** Какую силу Сон Разума держит (id предмета) — только при Таланте. */
export function dreamingKeepId(actor) {
  const has = [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Dreaming of Mind"));
  return has ? (actor?.flags?.[NS]?.[DREAMING_FLAG] ?? null) : null;
}

/** Уснул/потерял сознание: снять поддержание всех сил, кроме силы Сна Разума. */
export async function dropSustainOnSleep(actor) {
  const keep = dreamingKeepId(actor);
  const names = [];
  let kept = "";
  for (const item of [...(actor?.items ?? [])]) {
    if (item?.type !== "psychicPower" || !item.system?.isSustained) continue;
    if (keep && item.id === keep) { kept = item.name; continue; }
    await item.update(sustainOffPatch(item));
    await syncItemEffectsDisabled(item);
    names.push(item.name);
  }
  if (!names.length && !kept) return names;
  const { postTestCard } = await import("../helpers/test-card.mjs");
  const { esc } = await import("../helpers/utils.mjs");
  await postTestCard(actor, {
    icon: "🌙", title: `Поддержание прервано — ${esc(actor.name)}`,
    lines: [
      names.length ? `<div class="roll-threshold">Псайкер уснул или потерял сознание: прекращены ${names.map(esc).join(", ")}.</div>` : "",
      kept ? `<div class="roll-threshold">Сон Разума: «${esc(kept)}» продолжает поддерживаться.</div>` : ""
    ].filter(Boolean)
  }, { sound: false });
  return names;
}

/** Кнопка Сна Разума: выбрать психосилу, которую держит подсознание. */
export async function chooseDreamingPower(actor) {
  const powers = [...(actor?.items ?? [])].filter(i => i.type === "psychicPower");
  if (!powers.length) return ui.notifications.warn("⚠️ На листе нет психосил.");
  const { esc } = await import("../helpers/utils.mjs");
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Сон Разума" }, rejectClose: false,
    content: `<div class="form-group"><label>Какую психосилу поддерживать во сне и без сознания?</label><select name="pick">${
      powers.map(p => `<option value="${p.id}" ${p.id === actor.getFlag(NS, DREAMING_FLAG) ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Выбрать", callback: (_e, b) => b.form.elements.pick.value }
  }).catch(() => null);
  if (!id) return;
  await actor.setFlag(NS, DREAMING_FLAG, id);
  ui.notifications.info(`Сон Разума: «${actor.items.get(id)?.name}» будет поддерживаться во сне.`);
}
