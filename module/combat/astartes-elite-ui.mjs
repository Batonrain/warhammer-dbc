// module/combat/astartes-elite-ui.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общая Foundry-обвязка кнопок Талантов элитных архетипов пачки «astartes»
//  (Броненосец, Герольд, Коготь Варпа, Моритат, Чемпион Терминатор,
//  Облитератор, Кузнец Крови): выбор предмета, цель на сцене, тест Навыка без
//  диалога, траты Реакции/ОД. Сами правила — в module/rules/<архетип>-talents.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { skillTestValue, boonString, boonNow, ELITE_BOON_FLAG } from "../rules/astartes-elite-common.mjs";
import { tokensThatCanSee } from "../rules/vision-target.mjs";
import { writeToTarget } from "./gm-relay.mjs";

/** Выбор одного из списка ({id, label}) — null при отказе. Один вариант — без вопроса. */
export async function chooseOne(title, options, { prompt = "" } = {}) {
  if (!options?.length) return null;
  if (options.length === 1) return options[0];
  const html = `${prompt ? `<p>${esc(prompt)}</p>` : ""}<div class="form-group"><select name="pick">${
    options.map((o, i) => `<option value="${i}">${esc(o.label)}</option>`).join("")}</select></div>`;
  const idx = await foundry.applications.api.DialogV2.prompt({
    window: { title }, classes: ["warhammer-dbc", "wh-holo"], content: html,
    ok: { label: "Выбрать", callback: (_ev, button) => Number(button.form.elements.pick.value) },
    rejectClose: false
  }).catch(() => null);
  return idx == null ? null : options[idx] ?? null;
}

/** Подтверждение да/нет. */
export function confirmBox(title, text, yes = "Да", no = "Нет") {
  return foundry.applications.api.DialogV2.confirm({
    window: { title }, classes: ["warhammer-dbc", "wh-holo"], content: `<p>${text}</p>`,
    yes: { label: yes }, no: { label: no }, rejectClose: false
  }).catch(() => false);
}

/** Первый токен актора на сцене (или null). */
export function actorToken(actor) {
  return actor?.getActiveTokens?.(false, true)?.[0] ?? null;
}

/** Акторы выделенных целей пользователя (без повторов). */
export function targetedActors() {
  const out = new Map();
  for (const t of game.user?.targets ?? []) {
    const a = t.actor ?? t.document?.actor;
    if (a) out.set(a.uuid, a);
  }
  return [...out.values()];
}

/** Токены (TokenDocument) в радиусе N м от актора. */
export function tokensAround(actor, meters, opts = {}) {
  const tok = actorToken(actor);
  return tok ? tokensWithinRadius(tok.document ?? tok, meters, opts) : [];
}

/** Сделать токены целями пользователя (кнопка «Применить урон → Всем» дальше работает сама). */
export function setTargets(tokenDocs) {
  const ids = tokenDocs.map(t => t.id).filter(Boolean);
  try { canvas.tokens?.setTargets?.(ids); } catch { /* вне сцены — цели не нужны */ }
}

/** Сторона токена: одна ли с актором (disposition). */
export function sameSide(actor, tokenDoc) {
  const mine = actorToken(actor);
  const a = mine?.document?.disposition ?? mine?.disposition;
  return a != null && tokenDoc?.disposition === a;
}

/** Списать ОД (вне боя экономика молчит). false — не хватило, игрок увидел причину. */
export async function payActions(actor, cost, label) {
  if (!cost) return true;
  if (!canSpendActionPoints(actor, cost)) {
    ui.notifications?.warn(`⚠️ ${actor.name}: не хватает ОД на «${label}» (нужно ${cost}).`);
    return false;
  }
  return spendActionPoints(actor, cost);
}

/** Списать одну Реакцию (универсальную). false — Реакций нет. */
export async function payReaction(actor, label) {
  const r = Number(actor.system?.reactions?.value) || 0;
  if (r <= 0) {
    ui.notifications?.warn(`⚠️ ${actor.name}: Реакций не осталось — «${label}» недоступно.`);
    return false;
  }
  await actor.update({ "system.reactions.value": r - 1 });
  return true;
}

/**
 * Тест Навыка (или Характеристики) без диалога: Порог = значение + mod + правила.
 * @param {Actor} actor
 * @param {{skill?:string, group?:string, spec?:RegExp, char?:string, mod?:number,
 *          parts?:string[], icon?:string, title?:string, success?:string, failure?:string,
 *          ctx?:object, sections?:string[]}} o
 */
export async function rollSkillCard(actor, o = {}) {
  const { skill = "", group = "", spec = null, char: charOver = "", mod = 0, parts = [],
    icon = "🎲", title = "Тест", success = "", failure = "", ctx = {}, sections = [] } = o;
  const val = skillTestValue(actor, { skill, group, spec, char: charOver });
  const ruleCtx = { kind: "skill", char: val.char, ...(skill ? { skill } : {}), ...(group ? { group } : {}), ...ctx };
  const rm = collectTestMods(actor, ruleCtx);
  const m = Number(mod) || 0;
  const threshold = val.value + m + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success: ok, deg } = testOutcome(roll.total, threshold);
  const label = val.label;
  const outcome = ok
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}${success ? `. ${success}` : ""}</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}${failure ? `. ${failure}` : ""}</span>`;
  await postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor.name)}`,
    threshold: rollStatLine({ label, base: val.value, parts: [m ? `${m > 0 ? "+" : ""}${m}` : null, ...parts, ...rm.parts], threshold, rv: roll.total }),
    outcome, sections
  }, { rolls: [roll] });
  return { success: ok, deg, threshold, rv: roll.total, crit: roll.total <= 5 ? "success" : roll.total >= 96 ? "failure" : "" };
}

/** Подпись Характеристики: «W», «P». */
export const charAbbr = key => CHARACTERISTICS[key]?.abbr ?? key;
export { SKILLS_DEF };

/** Простая карточка без броска. */
export function infoCard(actor, icon, title, lines, { sections = [], rolls = [] } = {}) {
  return postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor.name)}`,
    lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`), sections
  }, { sound: rolls.length > 0, rolls });
}

/**
 * Кнопка «Применить урон» (те же data-атрибуты, что у взрыва гранаты —
 * combat/delayed-blast.mjs; обработчик в hooks.mjs). forceTarget — урон сразу
 * этому актору, без выбора цели.
 */
export function applyDamageButton({ damage, pen = 0, type = "impact", label = "", attacker = null,
  forceTarget = "", warp = false, crippling = 0, ignoreArmour = false, text = "" }) {
  return `<button class="wh-apply-dmg-btn" type="button"
      ${forceTarget ? `data-force-target="${forceTarget}"` : ""}
      data-damage="${Number(damage) || 0}" data-penetration="${Number(pen) || 0}"
      data-damage-type="${esc(type)}" data-damage-subtype=""
      data-hit-location="Торс" data-weapon-name="${esc(label)}"
      data-weapon-uuid="" data-attacker="${esc(attacker?.name ?? "")}" data-attacker-uuid="${attacker?.uuid ?? ""}"
      data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="${warp ? 1 : 0}"
      ${ignoreArmour ? `data-ignore-armour="1"` : ""}
      data-lance="0" data-sanctified="0" data-blast="0" data-flame="0" data-power-field="0" data-spray="0"
      data-devastating="0" data-weapon-range="0" data-melee="0" data-burst="0"
      data-corrosive="0" data-entropy="0" data-touch-of-pain="0" data-crippling="${Number(crippling) || 0}" data-piercing="0"
      data-haywire="" data-haywire-dmg2="" data-through-shot="0" data-has-extreme="0">
      ${text || `Применить урон: <b>${Number(damage) || 0}</b>`}
    </button>`;
}

/** Соратники (та же сторона), видящие актора — как у Живого Стяга (combat/living-banner.mjs). */
export function alliesInSight(actor) {
  const token = actorToken(actor);
  if (!token || !canvas?.ready) return [];
  const side = token.document?.disposition ?? token.disposition;
  const candidates = canvas.tokens.placeables.filter(t => t.actor && t.actor !== actor
    && (t.document?.disposition ?? t.disposition) === side);
  const seen = tokensThatCanSee(token, candidates, canvas.grid);
  return [...new Map(seen.map(t => [t.actor.uuid, t.actor])).values()];
}

/**
 * Выдать дар «до конца боя/сцены» (rules/astartes-elite-common.mjs). Чужому
 * актору пишет ГМ (gm-relay.mjs, RELAY_TARGET_FLAGS). Бой — бой получателя,
 * иначе бой выдавшего.
 * @returns {Promise<boolean>}
 */
export async function grantBoon(target, key, { value = 0, label = "" }, initiator) {
  const nowT = boonNow(target);
  const nowI = initiator ? boonNow(initiator) : { combatId: "", sceneId: "" };
  const str = boonString({ combatId: nowT.combatId || nowI.combatId, sceneId: nowT.sceneId || nowI.sceneId, value, label });
  return writeToTarget(target, { kind: "update", data: { [`flags.warhammer-dbc.${ELITE_BOON_FLAG}.${key}`]: str } }, initiator);
}
