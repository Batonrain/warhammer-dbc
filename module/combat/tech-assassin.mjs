// module/combat/tech-assassin.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопки Талантов и Черт Тех Ассасина (Элитные архетипы). Состояние фрейма и
//  арифметика — rules/tech-assassin.mjs. Имена — литералами в hasItemNamed
//  (там же), их ищет замер покрытия.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard, outcomeHtml, rollStatLine } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { mechadendriteCount } from "../rules/mechadendrites.mjs";
import {
  FRAME_FLAG, VEIL_FLAG, FRAME_PARTS, VEIL_MODES, BISECTION_COST, DISJOINT_LIMB_WOUNDS, CHRYSALIS_REGEN, SCORPIO_PEN,
  hasBisection, hasChrysalis, hasDisjoint, hasModularAutonomy, hasScorpio, hasParadoxVeil,
  frameState, frameChange, partMissing, headOnly, scorpioActive, frameSizeShift, usableDendrites,
  chrysalisProgress, chrysalisReset, veilMode
} from "../rules/tech-assassin.mjs";

const NS = "warhammer-dbc";
const ICON = "🦂 ";

// Успех — undefined: truthy-результат скрипта значит «отказ», и runMechScriptEntry
// тогда не списал бы цену/лимит (apps/mechanics.mjs).
const card = async (actor, title, lines, extra = {}) => { await postTestCard(actor, {
  icon: ICON, title: `${esc(title)} — ${esc(actor.name)}`,
  lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`), ...extra
}, { sound: false }); };

const cognitionOf = actor => Math.max(0, Number(actor?.system?.cognition?.value) || 0);

/** Строка состояния фрейма для карточек. */
export function frameSummary(actor, state = frameState(actor)) {
  const gone = Object.entries(FRAME_PARTS).filter(([k]) => partMissing(state, k))
    .map(([k, m]) => `${m.label}${state.destroyed[k] ? " (уничтожена)" : ""}`);
  const parts = [gone.length ? `Нет на теле: ${gone.join(", ")}.` : "Фрейм собран целиком."];
  const size = frameSizeShift(actor);
  if (size) parts.push(`Размер ${size > 0 ? "+" : ""}${size} (уже в листе).`);
  if (headOnly(state)) {
    const dendr = usableDendrites(actor, mechadendriteCount(actor), state);
    parts.push(`Одна голова: перемещается Трейтом Hoverer; мехадендритов в деле — ${dendr}${dendr ? " (Черепная Мантия)" : ""}.`);
  }
  if (scorpioActive(actor, state)) parts.push(`Скорпион: жало — Трейт Parasite (Pen ${SCORPIO_PEN}), по правилам укусов в Захвате, по живым и по машинам.`);
  if (state.regrow) parts.push(`Куколка копит на «${FRAME_PARTS[state.regrow.part].label}»: ${state.regrow.wounds}/${FRAME_PARTS[state.regrow.part].regrow} Ран.`);
  return parts.join(" ");
}

async function saveFrame(actor, state) {
  await actor.setFlag(NS, FRAME_FLAG, {
    detached: state.detached, destroyed: state.destroyed, regrow: state.regrow ?? null
  });
}

/**
 * Bisection / Рассечение: «При Уклонении от атаки (не по площади) может
 * потратить на него 2 Когниции вместо Реакции». Кнопка списывает 2 ⚙ и даёт
 * одну Реакцию «только на Избегание» — её и заберёт Уклонение.
 */
export async function useBisection(actor) {
  if (!actor || !hasBisection(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Рассечение.");
  const cog = cognitionOf(actor);
  if (cog < BISECTION_COST) return ui.notifications.warn(`⚠️ Нужно ${BISECTION_COST} ⚙ Когниции, есть ${cog}.`);
  const def = Number(actor.system?.reactions?.defenseValue) || 0;
  await actor.update({ "system.cognition.value": cog - BISECTION_COST, "system.reactions.defenseValue": def + 1 });
  return card(actor, "Рассечение", [
    `−${BISECTION_COST} ⚙ Когниции (${cog} → ${cog - BISECTION_COST}): торс расходится, атака проходит через брешь. Добавлена 1 Реакция Избегания — Уклонение от этой атаки её и потратит, обычная Реакция цела.`,
    "Только против атаки не по площади. Если броня не перестроена под модульность (смена работы) — после этого Уклонения броня спадает."
  ]);
}

/** Диалог выбора части фрейма. */
async function pickPart(actor, { title, parts, note = "", withDamage = false, withDestroy = false }) {
  if (!parts.length) { ui.notifications.warn("⚠️ Подходящих частей нет."); return null; }
  const opts = parts.map(([k, m]) => `<option value="${k}">${esc(m.label)}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: `${title} — ${actor.name}` },
    content: `<form style="padding:4px 6px;">${note ? `<p style="margin:4px 0;">${note}</p>` : ""}
      <label>Часть: <select name="part">${opts}</select></label>
      ${withDamage ? `<p><label>Урон этого ранения (вернуть Раны): <input type="number" name="dmg" min="0" value="0" style="width:60px;"/></label></p>` : ""}
      ${withDestroy ? `<p><label><input type="checkbox" name="destroy"/> Ранение убило бы — часть уничтожена, а не отсоединена</label></p>` : ""}
    </form>`,
    ok: { label: "Готово", callback: (_e, b) => ({
      part: b.form.elements.part.value,
      dmg: withDamage ? Math.max(0, Number(b.form.elements.dmg.value) || 0) : 0,
      destroy: withDestroy ? !!b.form.elements.destroy.checked : false
    }) },
    rejectClose: false
  }).catch(() => null);
}

/**
 * Disjoint / Разделение: «За свободное действие может отсоединить или
 * присоединить обратно одну конечность в своём пространстве, тратя 1 Когницию
 * на присоединение». Отсоединённая конечность — 3 Раны, действует по правилам
 * Multiple Arms не дальше I м.
 */
export async function useDisjoint(actor, action = "detach") {
  if (!actor || !hasDisjoint(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Разделение.");
  const state = frameState(actor);
  const limbs = Object.entries(FRAME_PARTS).filter(([k, m]) => m.limb
    && (action === "attach" ? state.detached[k] : !partMissing(state, k)));
  const picked = await pickPart(actor, { title: action === "attach" ? "Присоединить конечность" : "Отсоединить конечность", parts: limbs });
  if (!picked) return;
  const res = frameChange(state, picked.part, action);
  if (!res.ok) return ui.notifications.warn(`⚠️ ${res.reason}.`);
  const cog = cognitionOf(actor);
  if (res.cost > cog) return ui.notifications.warn(`⚠️ Присоединение стоит ${res.cost} ⚙, есть ${cog}.`);
  if (res.cost) await actor.update({ "system.cognition.value": cog - res.cost });
  await saveFrame(actor, res.state);
  const label = FRAME_PARTS[picked.part].label;
  const intTotal = Number(actor.system?.characteristics?.int?.total) || 0;
  return card(actor, "Разделение", [
    action === "attach"
      ? `${label} присоединена обратно (свободное действие, −${res.cost} ⚙ Когниции).`
      : `${label} отсоединена (свободное действие). Действует и атакует по правилам Multiple Arms не дальше I м (${intTotal} м); ${DISJOINT_LIMB_WOUNDS} Раны и свои Критические Эффекты — ломается при Смерти/потере/бесполезности конечности.`,
    frameSummary(actor, res.state)
  ]);
}

/**
 * Modular Autonomy / Модульная Автономия: «Может игнорировать Критические
 * Эффекты и урон от ранений в конечность или торс, отсоединяя их. Если ранения
 * в конечность привели бы к смерти, конечность уничтожается».
 * Кнопка: отсоединить поражённую часть и вернуть Раны этого ранения.
 */
export async function useModularAutonomy(actor) {
  if (!actor || !hasModularAutonomy(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Модульная Автономия.");
  const state = frameState(actor);
  const parts = Object.entries(FRAME_PARTS).filter(([k]) => !partMissing(state, k));
  const picked = await pickPart(actor, {
    title: "Модульная Автономия", parts, withDamage: true, withDestroy: true,
    note: "Ранение в эту часть игнорируется: Критический Эффект не применяется, Раны возвращаются."
  });
  if (!picked) return;
  const res = frameChange(state, picked.part, picked.destroy ? "destroy" : "detach");
  if (!res.ok) return ui.notifications.warn(`⚠️ ${res.reason}.`);
  await saveFrame(actor, res.state);
  let healed = 0;
  if (picked.dmg > 0) {
    const w = actor.system?.wounds ?? {};
    const max = Number(w.effectiveMax ?? w.max) || 0;
    healed = Math.min(picked.dmg, Math.max(0, max - (Number(w.value) || 0)) + (Number(w.critical) || 0));
    if (healed > 0) await actor.update(computeWoundHealing(actor.system, healed));
  }
  const label = FRAME_PARTS[picked.part].label;
  return card(actor, "Модульная Автономия", [
    `${label} ${picked.destroy ? "уничтожена" : "отсоединена"}: урон и Критический Эффект этого ранения проигнорированы${healed ? ` — возвращено ${healed} Ран` : ""}.`,
    frameSummary(actor, res.state)
  ]);
}

/** Scorpio / Скорпион: показать жало (Размер уже в листе), либо почему не работает. */
export async function useScorpio(actor) {
  if (!actor || !hasScorpio(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Скорпион.");
  const state = frameState(actor);
  return card(actor, "Скорпион", [
    scorpioActive(actor, state)
      ? `Обе ноги отсоединены — жало выпущено: Размер −1 (уже в листе), Трейт Parasite с Pen ${SCORPIO_PEN}; применяется по правилам укусов в Захвате, по живым и по машинам.`
      : "Жало выходит только когда обе ноги отсоединены (кнопка Разделения или Модульной Автономии).",
    frameSummary(actor, state)
  ]);
}

/**
 * Chrysalis / Куколка: «В контакте с грудой металла может на 1 Раунд потерять
 * способность двигаться, получив Трейт Regeneration (2). Отращивание
 * конечности или механодендрита стоит 7 Ран, торса — 20 Ран. Прервав контакт,
 * теряет накопленные Раны».
 * Кнопка — тест Регенерации T+0 прямо сейчас; Успех даёт 2 Раны — лечение или
 * в копилку отращивания выбранной уничтоженной части.
 */
export async function useChrysalis(actor) {
  if (!actor || !hasChrysalis(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Куколка.");
  const state = frameState(actor);
  const destroyed = Object.entries(FRAME_PARTS).filter(([k]) => state.destroyed[k]);
  const opts = [`<option value="">Лечить Раны</option>`,
    ...destroyed.map(([k, m]) => `<option value="${k}"${state.regrow?.part === k ? " selected" : ""}>Отращивать: ${esc(m.label)} (${state.regrow?.part === k ? state.regrow.wounds : 0}/${m.regrow})</option>`),
    `<option value="__reset">Прервать контакт — сбросить копилку</option>`].join("");
  const target = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Куколка — ${actor.name}` },
    content: `<form style="padding:4px 6px;"><p style="margin:4px 0;">В контакте с грудой металла: 1 Раунд без движения, Regeneration (${CHRYSALIS_REGEN}).</p>
      <label>Куда Раны: <select name="t">${opts}</select></label></form>`,
    ok: { label: "Тест T+0", callback: (_e, b) => b.form.elements.t.value },
    rejectClose: false
  }).catch(() => null);
  if (target == null) return;
  if (target === "__reset") {
    await saveFrame(actor, chrysalisReset(state));
    return card(actor, "Куколка", ["Контакт с материалами прерван — накопленные на отращивание Раны потеряны."]);
  }
  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "t" });
  const threshold = t + mods.total;
  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  let line = "Провал — Раны не восстановились.";
  if (success && target) {
    const pr = chrysalisProgress(state, target, CHRYSALIS_REGEN);
    await saveFrame(actor, pr.state);
    line = pr.done ? `${FRAME_PARTS[target].label} отросла заново — со всей бионикой, кибернетикой и встроенным оружием.`
      : `+${CHRYSALIS_REGEN} к отращиванию «${FRAME_PARTS[target].label}»: ${pr.wounds}/${pr.need} Ран.`;
  } else if (success) {
    const w = actor.system?.wounds ?? {};
    const max = Number(w.effectiveMax ?? w.max) || 0;
    const healed = Math.min(CHRYSALIS_REGEN, Math.max(0, max - (Number(w.value) || 0)) + (Number(w.critical) || 0));
    if (healed > 0) await actor.update(computeWoundHealing(actor.system, healed));
    line = `Восстановлено ${healed} Ран.`;
  }
  await postTestCard(actor, {
    icon: ICON, title: `Куколка — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "T+0", base: t, parts: mods.parts.map(esc), threshold, rv }),
    lines: ["<div class=\"roll-threshold\">До конца Раунда не может двигаться.</div>"],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — ${line}` : line)
  }, { rolls });
}

/**
 * Paradox Veil / Вуаль Парадокса: «Раз в Ход может включить/выключить Вуаль
 * полностью или частично». Режим — метка на акторе; полная Вуаль проваливает
 * Внимательность полностью кибернетических наблюдателей (rules/tech-assassin.mjs).
 */
export async function useParadoxVeil(actor) {
  if (!actor || !hasParadoxVeil(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Вуаль Парадокса.");
  const cur = veilMode(actor);
  const mode = await foundry.applications.api.DialogV2.wait({
    window: { title: `Вуаль Парадокса — ${actor.name}` },
    content: `<p>Сейчас: <b>${VEIL_MODES[cur]}</b>.</p>`,
    buttons: Object.entries(VEIL_MODES).map(([k, l]) => ({ action: k, label: l, default: k === cur })),
    rejectClose: false
  }).catch(() => null);
  if (!mode || !VEIL_MODES[mode]) return "отмена";
  await actor.setFlag(NS, VEIL_FLAG, mode);
  return card(actor, "Вуаль Парадокса", [
    `Вуаль: <b>${VEIL_MODES[mode]}</b>.`,
    mode === "full" ? "Микрофоны, пикт-фидеры, визоры и ауспексы его не засекают; для полностью кибернетических Механикум он невидим, неслышим и неощутим — их тесты Внимательности против него проваливаются сами. Пси-Чутьё генераторы не засекает."
      : mode === "partial" ? "Невидим для визуальных сенсоров, но слышим или засекаем тепловидением — что именно оставлено, решает игрок; провал Внимательности не автоматический."
      : "Сенсоры и Ноосфера видят его как обычно."
  ]);
}
