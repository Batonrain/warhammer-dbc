// module/combat/inspire-wrath.mjs
// ════════════════════════════════════════════════════════════════════════
//  Inspire Wrath / Вдохновить Гнев — поток (правила и множители —
//  rules/inspire-wrath.mjs; запись в чужих акторов — combat/gm-relay.mjs).
//
//  startInspireWrath(actor): кнопка на листе Таланта (apps/talent-actions.mjs).
//   1. оратор выцеливает слушателей (токены-цели), не больше F.b×10
//      (F.b×100 с Demagogue);
//   2. выбирает группу, против которой разжигает гнев (Фракция / Раса /
//      Признак / Покровительство / «Все!» — тот же выбор цели, что у Hatred);
//   3. Полное Действие (2 ОД) и тест Charm+0;
//   4. успех — каждому выцеленному слушателю выдаётся временный Талант Hatred
//      против этой группы (+10 в рукопашной по ней, переброс социальных тестов и
//      Морали — всё это уже читает rules/hatred.mjs) до конца сцены;
//   5. провал — ничего не выдаётся, ОД потрачены.
//
//  Срок «до конца сцены» — решение владельца при обрыве книжного текста; снятие
//  — endInspiredWrathOnSceneEnd из кнопки «🎬 Новая сцена» (apps/game-session.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { sameTarget, targetLabel } from "../rules/talent-targets.mjs";
import { unlinkedTokens } from "../migrations/unlinked-tokens.mjs";
import {
  hasInspireWrath, inspireWrathAudience, isInspiredHatred, inspireWrathOutcome,
  hasDemagogue, INSPIRED_WRATH_FLAG
} from "../rules/inspire-wrath.mjs";

const NS = "warhammer-dbc";
const CHARM_MOD = 0;

/** Выцеленные слушатели: уникальные акторы токенов-целей, без самого оратора. */
export function audienceActors(speaker, targets = globalThis.game?.user?.targets) {
  const seen = new Set();
  const out = [];
  for (const t of targets ?? []) {
    const a = t?.actor;
    if (!a || a === speaker || a.uuid === speaker?.uuid || seen.has(a.uuid)) continue;
    seen.add(a.uuid);
    out.push(a);
  }
  return out;
}

/** Уже есть такая же временная Ненависть этого оратора против этой группы? */
function hasSameInspired(listener, target, speakerUuid) {
  return [...(listener.items ?? [])].some(i => {
    if (!isInspiredHatred(i)) return false;
    const flag = i.getFlag?.(NS, INSPIRED_WRATH_FLAG) ?? i.flags?.[NS]?.[INSPIRED_WRATH_FLAG];
    return flag?.sourceUuid === speakerUuid && (i.system?.targets ?? []).some(t => sameTarget(t, target));
  });
}

/**
 * Выдать слушателям временную Ненависть. Превышение лимита аудитории
 * отсекается здесь же: лишние слушатели в список granted не попадают.
 *
 * @returns {Promise<{granted:string[], already:string[], failed:string[], over:number}>}
 */
export async function grantInspiredHatred(speaker, target, listeners, limit) {
  const granted = [], already = [], failed = [];
  const chosen = listeners.slice(0, Math.max(0, limit));
  const over = Math.max(0, listeners.length - chosen.length);
  for (const listener of chosen) {
    if (hasSameInspired(listener, target, speaker.uuid)) { already.push(listener.name); continue; }
    // Предмет собирает тот, кто пишет (ГМ из шаблона компендиума) — по сокету идёт только цель.
    const ok = await writeToTarget(listener, { kind: "inspireHatred", target }, speaker);
    (ok ? granted : failed).push(listener.name);
  }
  return { granted, already, failed, over };
}

/** Окно выбора группы. null — отмена. */
async function promptHatredGroup(speaker) {
  const { targetChoiceHtml, wireTargetChoice, readTargetChoice } = await import("../apps/target-choice.mjs");
  const { openCompendiumBrowser } = await import("../apps/compendium-browser.mjs");
  const ch = { key: "group", label: "Против какой группы разжигается гнев",
    hint: "Выберите группу — слушатели получат Hatred против неё" };
  const state = { factionTargets: {} };
  const $ = globalThis.$;
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: `Вдохновить Гнев — ${speaker.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-holo-dialog">${targetChoiceHtml(ch)}</div>`,
    render: (_event, dialog) => wireTargetChoice($(dialog.element), ch, state,
      prompt => openCompendiumBrowser(false, { filters: { type: "faction" }, prompt })),
    buttons: [
      { action: "ok", label: "Далее", default: true,
        callback: (_e, _b, dialog) => readTargetChoice($(dialog.element), ch, state) || "none" },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (picked === "none") ui.notifications?.warn("Вдохновить Гнев: группа не выбрана (для фракции нажмите «Выбрать фракцию…»).");
  return picked && picked !== "none" ? picked : null;
}

/**
 * Провести Вдохновить Гнев.
 * @param {Actor} actor
 * @param {{target?:object, rv?:number}} [inject] подмена выбора группы и броска (тесты)
 * @returns {Promise<string|null>} "granted" | "failed" | null — не начато
 */
export async function startInspireWrath(actor, inject = {}) {
  if (!hasInspireWrath(actor)) { ui.notifications?.warn("Вдохновить Гнев: у персонажа нет такого Таланта."); return null; }
  const limit = inspireWrathAudience(actor);
  if (limit < 1) { ui.notifications?.warn("Вдохновить Гнев: бонус Fel нулевой — аудитории нет."); return null; }
  const listeners = audienceActors(actor);
  if (!listeners.length) {
    ui.notifications?.warn("Вдохновить Гнев: выцельте слушателей (токены-цели) — гнев получат только они.");
    return null;
  }
  const target = inject.target ?? await promptHatredGroup(actor);
  if (!target) return null;

  // Полное Действие, ментальное.
  if (!await spendActionPoints(actor, 2, { physical: false })) {
    ui.notifications?.warn("⚠️ Не хватает ОД на Вдохновить Гнев (Полное Действие).");
    return null;
  }

  // Charm+0.
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "charm", char: "fel" });
  const base = Number(actor.system?.skills?.charm?.total ?? -20);
  const threshold = base + CHARM_MOD + ruleMods.total;
  const roll = inject.rv == null ? await new Roll("1d100").evaluate() : null;
  const rv = inject.rv ?? roll.total;
  const { success, deg } = testOutcome(rv, threshold);
  const outcome = inspireWrathOutcome({ success });

  const statLine = rollStatLine({ label: "Charm+0", base, parts: ruleMods.parts, threshold, rv });
  const title = `Вдохновить Гнев — ${esc(actor.name)}`;
  const icon = rollIcon("skull", "#ff8a8a");
  const group = esc(targetLabel(target));

  if (!success) {
    await postTestCard(actor, { icon, title, threshold: statLine,
      outcome: outcomeHtml(false, `Провал (${deg} ${_degWord(deg)}) — толпа не подхватила речь`) },
    { rolls: roll ? [roll] : [] });
    return outcome;
  }

  const res = await grantInspiredHatred(actor, target, listeners, limit);
  const lines = [];
  if (res.granted.length) lines.push(`<div class="roll-threshold">Hatred против «${group}» до конца сцены: <b>${res.granted.map(esc).join(", ")}</b>.</div>`);
  if (res.already.length) lines.push(`<div class="roll-threshold">Уже вдохновлены этой речью: ${res.already.map(esc).join(", ")}.</div>`);
  if (res.failed.length) lines.push(`<div class="roll-threshold">⚠ Не удалось выдать (Мастера нет в игре): ${res.failed.map(esc).join(", ")}.</div>`);
  if (res.over) lines.push(`<div class="roll-threshold">Сверх лимита аудитории (${limit}${hasDemagogue(actor) ? ", Demagogue" : ""}) — ${res.over} цел. без Ненависти.</div>`);
  lines.push(`<div class="roll-threshold" style="font-size:0.85em;">Книга: наполненная ненавистью толпа не всегда поддаётся контролю — её поведение ведёт стол. Срок «до конца сцены» — решение стола при обрыве книжного текста.</div>`);
  await postTestCard(actor, { icon, title, threshold: statLine,
    outcome: outcomeHtml(true, `Успех (${deg} ${_degWord(deg)}) — гнев разожжён против «${group}»`),
    sections: lines }, { rolls: roll ? [roll] : [] });
  return outcome;
}

/** Снять выданную Ненависть у актора. */
async function clearInspired(actor) {
  const ids = [...(actor?.items ?? [])].filter(isInspiredHatred).map(i => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  return ids.length;
}

/**
 * Конец сцены/сессии (кнопки календаря, только ГМ): временная Ненависть
 * слушателей снимается у всех акторов мира и у несвязанных токенов.
 */
export async function endInspiredWrathOnSceneEnd() {
  let n = 0;
  for (const actor of globalThis.game?.actors ?? []) n += await clearInspired(actor);
  for (const t of unlinkedTokens()) n += await clearInspired(t.actor);
  return n;
}
