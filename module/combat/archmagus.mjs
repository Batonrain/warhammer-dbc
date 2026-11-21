// module/combat/archmagus.mjs
// ════════════════════════════════════════════════════════════════════════
//  Архимаг — кнопки Черт и Талантов (Foundry-обвязка поверх
//  rules/archmagus-talents.mjs). Окно манифестации (посох, Высший Магус) —
//  combat/psyker-elite-hooks.mjs.
// ════════════════════════════════════════════════════════════════════════

import {
  MIRROR_SOUL_FLAG, INNER_EYE_FLAG, SAVANT_FLAG, MAGUS_EXCLUDE_COST, MAGUS_TRANSFER_COST, MAGUS_TRANSFER_RANGE,
  hasMagusSupreme, hasMasteryOfForm, hasWizardStaff, hasExemptus, hasInnerEye, hasMirrorSoul, hasMysticFeint,
  hasSavantImmaterial, hasUnlimitedPower, exemptusMod, innerEyeDeg, innerEyeState, unlimitedPowerResult,
  savantAllowed, staffQualityBonus
} from "../rules/archmagus-talents.mjs";
import { PSY_DISCIPLINES, canHaveFocusDiscipline } from "../constants/disciplines.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { mutationByRoll, mutationCatalog, mutationItemData } from "../constants/mutations.mjs";
import { handHeldItems, weaponHandsRequired } from "../rules/hands.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { spendCapabilityCost } from "./capability-cost.mjs";
import { spendReaction } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";
import { eliteTest, askNumber, askSelect, askChecks, askConfirm, infoCard, actorsDistance, targetedActors } from "./psyker-elite-common.mjs";
import { setPendingManifest } from "./psyker-elite-hooks-state.mjs";

const NS = "warhammer-dbc";
const line = html => `<div class="roll-threshold">${html}</div>`;
const infamy = (actor, amount, label) => spendCapabilityCost(actor, { pool: "infamy", amount }, label);

// ── Чародейский Посох ──────────────────────────────────────────────────────

/** Психосиловой посох в двуручном хвате (или null). */
export function wizardStaffHeld(actor) {
  return handHeldItems(actor).find(w => /staff|посох/i.test(w.name ?? "")
    && (w.system?.weaponProps ?? []).some(p => p?.key === "force")
    && weaponHandsRequired(w, actor) >= 2) ?? null;
}

/** Бонус посоха к любому психотесту (Good.Q/Best.Q) и подпись. */
export function wizardStaffTestBonus(actor) {
  if (!hasWizardStaff(actor)) return { bonus: 0, staff: null };
  const staff = wizardStaffHeld(actor);
  return { bonus: staff ? staffQualityBonus(staff.system?.quality) : 0, staff };
}

/** Уровень продвижения Scholastic Lore (Occult): +0/+10/+20/+30. */
export function occultLoreLevel(actor) {
  const e = findGroupEntry(actor, "scholasticLore", "Occult");
  return Math.max(0, SKILL_RANKS[e?.rank]?.bonus ?? 0);
}

/** Кнопка посоха: «тип Физическое» к следующей манифестации, раз в Ход. */
export async function useWizardStaff(actor) {
  if (!hasWizardStaff(actor)) return ui.notifications.warn("⚠️ Нет Черты Чародейский Посох.");
  const staff = wizardStaffHeld(actor);
  if (!staff) return ui.notifications.warn("⚠️ Нужен психосиловой посох в двуручном хвате.");
  if (!isRoundCapabilityAvailable(actor, "wizardStaffPhysical")) return ui.notifications.warn("⚠️ Посох уже использован в этом Ходу.");
  const bonus = occultLoreLevel(actor);
  await markRoundCapabilityUsed(actor, "wizardStaffPhysical");
  await setPendingManifest(actor, { staff: bonus });
  await infoCard(actor, "Чародейский Посох", [
    line(`Следующая манифестация получает тип <b>Физическое</b> (не меньше полудействия): <b>+${bonus}</b> к психотесту (уровень Scholastic Lore (Occult)) — окно манифестации прибавит само.`),
    staffQualityBonus(staff.system?.quality) ? line(`«${esc(staff.name)}» ${staff.system.quality === "best" ? "Best" : "Good"}.Q: ещё +${staffQualityBonus(staff.system.quality)} к каждому психотесту — уже считается всегда.`) : ""
  ], { icon: "🪄" });
}

// ── Высший Магус ───────────────────────────────────────────────────────────

/** Кнопка Черты: исключить союзников из Феномена (1 Очко) или перенести Прорыв (3 Очка). */
export async function useMagusSupreme(actor) {
  if (!hasMagusSupreme(actor)) return ui.notifications.warn("⚠️ Нет Черты Высший Магус.");
  const mode = await askSelect("Высший Магус", "Что сделать", [
    { value: "exclude", label: `Исключить союзников в поле зрения из Феномена (${MAGUS_EXCLUDE_COST} Очко Бесчестия)` },
    { value: "transfer", label: `Перенести Прорыв на цель (T) не далее ${MAGUS_TRANSFER_RANGE} м (${MAGUS_TRANSFER_COST} Очка)` }
  ], { hint: "Свой Феномен (не Прорыв) на Архимага не действует и так — это пишет карточка манифестации." });
  if (!mode) return;
  if (mode === "exclude") {
    if (!(await infamy(actor, MAGUS_EXCLUDE_COST, "Высший Магус"))) return;
    const names = targetedActors().map(a => esc(a.name));
    return infoCard(actor, "Высший Магус", [line(`Феномен не задевает выбранных персонажей${names.length ? `: <b>${names.join(", ")}</b>` : " (отметьте их целями T или назовите за столом)"}.`)], { icon: "🜂" });
  }
  const [target] = targetedActors();
  if (!target) return ui.notifications.warn("⚠️ Выберите цель (T), на которую перенести Прорыв.");
  const dist = actorsDistance(actor, target);
  if (dist != null && dist > MAGUS_TRANSFER_RANGE) return ui.notifications.warn(`⚠️ Цель в ${Math.round(dist)} м — дальше ${MAGUS_TRANSFER_RANGE} м.`);
  if (!(await infamy(actor, MAGUS_TRANSFER_COST, "Высший Магус"))) return;
  return infoCard(actor, "Высший Магус", [
    line(`Эффект Прорыва переходит на <b>${esc(target.name)}</b>${dist != null ? ` (${Math.round(dist)} м)` : ""} — Прорыв считается вызванным им.`),
    line("Площадные эффекты Прорыва задевают Архимага как обычно, если накрывают его.")
  ], { icon: "🜂" });
}

// ── Мастерство Формы ───────────────────────────────────────────────────────

/** 9 часов и Очко Бесчестия: For.Lore(Warp)−10 — переброс своей мутации (5+ Успехов — выбор). */
export async function useMasteryOfForm(actor) {
  if (!hasMasteryOfForm(actor)) return ui.notifications.warn("⚠️ Нет Черты Мастерство Формы.");
  const muts = [...actor.items].filter(i => i.type === "mutation");
  if (!muts.length) return ui.notifications.warn("⚠️ Перебрасывать нечего — мутаций нет.");
  const pick = await askSelect("Мастерство Формы", "Мутация на переброс", muts.map(m => ({ value: m.id, label: m.name })),
    { hint: "9 часов медитации и 1 Очко Бесчестия, затем тест For.Lore (Warp)−10." });
  const old = pick ? actor.items.get(pick) : null;
  if (!old) return;
  if (!(await infamy(actor, 1, "Мастерство Формы"))) return;
  const t = await eliteTest(actor, {
    what: { group: "forbiddenLore", spec: "Warp" }, mod: -10, title: "Мастерство Формы", icon: "🜂",
    success: d => d >= 5 ? "можно выбрать мутацию" : "мутация перебрасывается", failure: "мутация остаётся"
  });
  if (!t.success) return;
  let name;
  const rolls = [];
  if (t.deg >= 5) {
    const list = mutationCatalog().common;
    name = await askSelect("Мастерство Формы: выбор", "Новая мутация (таблица 1–100)", list.map(m => ({ value: m.name, label: `${m.range}: ${m.name}` })));
  }
  if (!name) {
    const r = await new Roll("1d100").evaluate();
    rolls.push(r);
    name = mutationByRoll(r.total);
  }
  const data = foundry.utils.deepClone(await mutationItemData(name, ""));
  delete data.folder; delete data.folderParent; delete data._id;
  await actor.deleteEmbeddedDocuments("Item", [old.id]);
  await actor.createEmbeddedDocuments("Item", [data]);
  await infoCard(actor, "Мастерство Формы", [
    line(`«${esc(old.name)}» → <b>${esc(name)}</b>${rolls.length ? ` (d100 = ${rolls[0].total})` : " (выбрана)"}.`)
  ], { icon: "🜂", rolls });
}

// ── Экземптус ──────────────────────────────────────────────────────────────

/** Реакция, For.Lore(Psykers)−60 (лично −30, +5 за кубик выжигания) — фокус дисциплины умершего. */
export async function useExemptus(actor) {
  if (!hasExemptus(actor)) return ui.notifications.warn("⚠️ Нет Таланта Экземптус.");
  const flags = await askChecks("Экземптус: умер псайкер в поле зрения", [
    { value: "personal", label: "Убит лично Архимагом (штраф −30 вместо −60)" },
    { value: "burn", label: "Умер от Выжигания Души Архимага (+5 за кубик урона)" }
  ]);
  if (flags == null) return;
  const personal = flags.includes("personal") || flags.includes("burn");
  const burnDice = flags.includes("burn") ? (await askNumber("Экземптус", "Кубиков урона от Выжигания Души", 1, { min: 0, max: 20 }) ?? 0) : 0;
  const owned = new Set(actor.system?.psyker?.focusDisciplines ?? []);
  const options = Object.entries(PSY_DISCIPLINES)
    .filter(([k]) => canHaveFocusDiscipline(k) && !owned.has(k))
    .map(([k, d]) => ({ value: k, label: d.label }));
  const disc = await askSelect("Экземптус", "Родная дисциплина умершего", options);
  if (!disc) return;
  if (!(await spendReaction(actor, { physical: false }))) return ui.notifications.warn("⚠️ Реакций не осталось.");
  const mod = exemptusMod({ personal, burnDice });
  const t = await eliteTest(actor, {
    what: { group: "forbiddenLore", spec: "Psykers" }, mod, title: "Экземптус", icon: "👁",
    extraParts: [personal ? "лично: −30 вместо −60" : "", burnDice ? `Выжигание: +${burnDice * 5}` : ""].filter(Boolean),
    success: `фокус на ${esc(PSY_DISCIPLINES[disc].label)} получен`, failure: "нить ускользает"
  });
  if (!t.success) return;
  await actor.update({ "system.psyker.focusDisciplines": [...owned, disc] });
}

// ── Внутренний Глаз ────────────────────────────────────────────────────────

const innerEyeCtx = () => ({ combatId: globalThis.game?.combat?.started ? game.combat.id : null, sceneId: globalThis.canvas?.scene?.id ?? null });

/** Очко Бесчестия: все тесты Пси-Чутья до конца боя/сцены — автоуспех с теми же Успехами. */
export async function useInnerEye(actor) {
  if (!hasInnerEye(actor)) return ui.notifications.warn("⚠️ Нет Таланта Внутренний Глаз.");
  const last = Number(actor.getFlag(NS, "lastPsyniscienceDeg")) || 1;
  const deg = await askNumber("Внутренний Глаз", "Успехов в последнем успешном тесте Пси-Чутья", last, { min: 1, max: 20 });
  if (!deg) return;
  if (!(await infamy(actor, 1, "Внутренний Глаз"))) return;
  const ctx = innerEyeCtx();
  await actor.setFlag(NS, INNER_EYE_FLAG, { deg, ...ctx });
  await infoCard(actor, "Внутренний Глаз", [
    line(`До конца ${ctx.combatId ? "боя" : "сцены"} каждый тест Пси-Чутья — <b>автоматический успех, ${deg} Успехов</b> (±1 за каждые полные 10 разницы модификаторов; кнопка Пси-Чутья спросит разницу сама).`)
  ], { icon: "👁" });
}

/**
 * Перехват теста Пси-Чутья: при действующем Внутреннем Глазе — карточка
 * автоуспеха вместо броска. true — перехвачено.
 */
export async function innerEyePsyniscience(actor) {
  const st = innerEyeState(actor, innerEyeCtx());
  if (!st) return false;
  const diff = await askNumber("Внутренний Глаз", "Модификатор этого теста минус модификатор первого (без Очков Бесчестия)", 0, { min: -100, max: 100 });
  if (diff == null) return true;
  const deg = innerEyeDeg(st.deg, diff);
  await infoCard(actor, "Пси-Чутьё (Внутренний Глаз)", [
    line(`Автоматический успех: <b>${deg}</b> Успехов (основа ${st.deg}${diff ? `, разница модификаторов ${diff > 0 ? "+" : ""}${diff}` : ""}).`)
  ], { icon: "👁" });
  return true;
}

// ── Зеркальная Душа ────────────────────────────────────────────────────────

/** Свободное действие раз в Ход: все поддерживаемые силы — на копию души (не снижают тPR) или обратно. */
export async function useMirrorSoul(actor) {
  if (!hasMirrorSoul(actor)) return ui.notifications.warn("⚠️ Нет Таланта Зеркальная Душа.");
  const sustained = [...actor.items].filter(i => i.type === "psychicPower" && i.system?.isSustained);
  const onCopy = sustained.filter(p => p.getFlag(NS, MIRROR_SOUL_FLAG));
  const onSelf = sustained.filter(p => !p.getFlag(NS, MIRROR_SOUL_FLAG));
  if (!sustained.length) return ui.notifications.warn("⚠️ Поддерживаемых психосил нет.");
  if (!isRoundCapabilityAvailable(actor, "mirrorSoul")) return ui.notifications.warn("⚠️ Зеркальная Душа уже использована в этом Ходу.");
  const toCopy = onSelf.length > 0 && (onCopy.length === 0 || await askConfirm("Зеркальная Душа",
    `На себе: ${onSelf.map(p => esc(p.name)).join(", ")}. На копии: ${onCopy.map(p => esc(p.name)).join(", ")}. Переместить силы <b>на копию</b>?`, "На копию", "С копии на себя"));
  const moving = toCopy ? onSelf : onCopy;
  await actor.updateEmbeddedDocuments("Item", moving.map(p => ({ _id: p.id, [`flags.${NS}.${MIRROR_SOUL_FLAG}`]: toCopy })));
  await markRoundCapabilityUsed(actor, "mirrorSoul");
  await infoCard(actor, "Зеркальная Душа", [
    line(`${toCopy ? "На копию души" : "С копии на себя"}: <b>${moving.map(p => esc(p.name)).join(", ")}</b>.`),
    line(`тPR теперь <b>${Number(actor.system?.psyker?.currentRating) || 0}</b> (поддержание на копии его не снижает).`)
  ], { icon: "🪞" });
}

// ── Мистический Финт ───────────────────────────────────────────────────────

/** Deceive+0: Пси-Чутьё с ≤ Успехов увидит не ту силу. */
export async function useMysticFeint(actor) {
  if (!hasMysticFeint(actor)) return ui.notifications.warn("⚠️ Нет Таланта Мистический Финт.");
  const mode = await askSelect("Мистический Финт", "Что скрыть", [
    { value: "cast", label: "Эту манифестацию (с Чародейским Посохом)" },
    { value: "site", label: "Следы прежних сил и ритуалов здесь (9 минут медитации)" }
  ]);
  if (!mode) return;
  if (mode === "cast" && !wizardStaffHeld(actor)) return ui.notifications.warn("⚠️ Нужен психосиловой посох в двуручном хвате.");
  await eliteTest(actor, {
    what: { skill: "deceive" }, mod: 0, title: "Мистический Финт", icon: "🎭",
    success: d => `тесты Пси-Чутья с ${d} Успехами и меньше видят ${mode === "cast" ? "другую силу и чужой отпечаток" : "изменённые следы"} — какую, называет игрок`,
    failure: "следы остаются настоящими"
  });
}

// ── Савант Имматериал ──────────────────────────────────────────────────────

/** Изучив силу, взять ещё одну не дороже половины её цены — бесплатно. */
export async function useSavantImmaterial(actor) {
  if (!hasSavantImmaterial(actor)) return ui.notifications.warn("⚠️ Нет Таланта Савант Имматериал.");
  const powers = [...actor.items].filter(i => i.type === "psychicPower");
  const used = new Set(powers.map(p => p.getFlag(NS, SAVANT_FLAG)).filter(Boolean));
  const sources = powers.filter(p => (Number(p.system?.cost) || 0) > 0 && !used.has(p.id) && !p.getFlag(NS, SAVANT_FLAG));
  const a = await askSelect("Савант Имматериал", "Изученная психосила (за опыт)", sources.map(p => ({ value: p.id, label: `${p.name} — ${p.system.cost} опыта` })),
    { hint: "Сначала перетащите на лист обе силы: изученную и ту, что берёте бесплатно." });
  const first = a ? actor.items.get(a) : null;
  if (!first) return;
  const cost = Number(first.system.cost) || 0;
  const candidates = powers.filter(p => p.id !== first.id && !p.getFlag(NS, SAVANT_FLAG) && savantAllowed(cost, p.system?.cost));
  const b = await askSelect("Савант Имматериал", `Бесплатная сила (не дороже ${Math.floor(cost / 2)} опыта)`, candidates.map(p => ({ value: p.id, label: `${p.name} — ${p.system.cost} опыта` })));
  const second = b ? actor.items.get(b) : null;
  if (!second) return;
  const was = Number(second.system.cost) || 0;
  await second.update({ "system.cost": 0, [`flags.${NS}.${SAVANT_FLAG}`]: first.id });
  await infoCard(actor, "Савант Имматериал", [
    line(`За «${esc(first.name)}» (${cost} опыта) бесплатно изучена <b>${esc(second.name)}</b> (${was} опыта не списано — лист пересчитал опыт).`)
  ], { icon: "📜" });
}

// ── Безграничная Сила ──────────────────────────────────────────────────────

/** Очко Бесчестия: Успехи ×3 против встречного теста/капюшона, остаток /3 (окр.▲). */
export async function useUnlimitedPower(actor) {
  if (!hasUnlimitedPower(actor)) return ui.notifications.warn("⚠️ Нет Таланта Безграничная Сила.");
  const content = `
    <div class="atk-dlg-row"><label>Ваши Успехи манифестации:</label><input type="number" name="mine" class="pm-input" value="1" min="0"/></div>
    <div class="atk-dlg-row"><label>Успехи противника (встречный тест):</label><input type="number" name="opp" class="pm-input" value="0" min="0"/></div>
    <div class="atk-dlg-row"><label>Снято контрмерами (капюшон и т.п.):</label><input type="number" name="cnt" class="pm-input" value="0" min="0"/></div>
    <div class="atk-dlg-row"><label>Провалы противника (если провалил):</label><input type="number" name="fail" class="pm-input" value="0" min="0"/></div>`;
  const v = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Безграничная Сила" }, content,
    ok: { label: "Потратить Очко Бесчестия", callback: (e, b) => ({ mine: b.form.elements.mine.value, oppSuccesses: b.form.elements.opp.value, counters: b.form.elements.cnt.value, oppFailures: b.form.elements.fail.value }) },
    rejectClose: false
  }).catch(() => null);
  if (!v) return;
  if (!(await infamy(actor, 1, "Безграничная Сила"))) return;
  const r = unlimitedPowerResult(v);
  await infoCard(actor, "Безграничная Сила", [
    line(`Успехи ×3: <b>${r.tripled}</b>; после встречного теста и контрмер: ${r.remaining}; /3 (окр.▲)${Number(v.oppFailures) > 0 ? ` + ${v.oppFailures} за Провалы противника (не делятся)` : ""} = <b>${r.final}</b>.`),
    line(r.won ? `Манифестация пробивает защиту с <b>${r.final}</b> Успехами.` : "Защита устояла — Успехов не осталось.")
  ], { icon: "⚡" });
}

/** Внутренний Глаз действует сейчас (для кнопки Пси-Чутья). */
export const innerEyeActiveNow = actor => !!innerEyeState(actor, innerEyeCtx());

export const ARCHMAGUS_API = {
  useWizardStaff, useMagusSupreme, useMasteryOfForm, useExemptus, useInnerEye, useMirrorSoul,
  useMysticFeint, useSavantImmaterial, useUnlimitedPower
};
