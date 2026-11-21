// module/combat/warlock.mjs
// ════════════════════════════════════════════════════════════════════════
//  Чернокнижник — кнопки Черты и Талантов (обвязка rules/warlock-talents.mjs).
//  Гейт Тёмных Искусств, Варп-Танцор, Последнее Эхо и Маг-Каннибал в окне
//  манифестации — combat/psyker-elite-hooks.mjs.
// ════════════════════════════════════════════════════════════════════════

import {
  DARK_ARTS_FREE_FLAG, SILENT_STUDENT_FLAG, TRANSCRIPTION_FLAG,
  hasCannibalMage, hasFinalEcho, hasInterpreter, hasListener, hasSilentStudent, hasTranscription,
  darkArtsFree, silentStudentNeed
} from "../rules/warlock-talents.mjs";
import { spendActionPoints, apCostForActionType, isEncounterActive } from "./action-economy.mjs";
import { addCondition } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { eliteTest, askSelect, askNumber, infoCard } from "./psyker-elite-common.mjs";

const NS = "warhammer-dbc";
const line = html => `<div class="roll-threshold">${html}</div>`;
const tb = (actor, k) => Math.max(0, Number(actor?.system?.characteristics?.[k]?.bonus) || 0);

/** Снять ограничения Тёмных Искусств на n своих Ходов. */
export async function freeDarkArts(actor, turns, source) {
  const cur = darkArtsFree(actor);
  const t = Math.max(Number(cur?.turns) || 0, Math.max(1, Math.trunc(turns)));
  await actor.setFlag(NS, DARK_ARTS_FREE_FLAG, { turns: t, source });
}

/** Начало Хода: счётчик «как обычный псайкер». */
export async function processWarlockTurnStart(actor) {
  const st = darkArtsFree(actor);
  if (!st) return;
  const t = (Number(st.turns) || 0) - 1;
  if (t > 0) return actor.setFlag(NS, DARK_ARTS_FREE_FLAG, { ...st, turns: t });
  await actor.unsetFlag(NS, DARK_ARTS_FREE_FLAG);
  await infoCard(actor, "Тёмные Искусства", [line(`${st.source === "cannibal" ? "Маг-Каннибал" : "Последнее Эхо"} кончилось: снова только через Пути Силы и в Обычном режиме.`)], { icon: "🕯" });
}

/**
 * После манифестации (окно сил): Последнее Эхо после Пути «Жертва»;
 * Маг-Каннибал прерывается Феноменом/Прорывом — тошнота, Оглушение 1 Раунд.
 * @returns {string[]} строки карточки
 */
export async function warlockAfterManifest(actor, { path = "", phenomena = false, perilTriggered = false, reroll = false } = {}) {
  const out = [];
  const st = darkArtsFree(actor);
  if (st?.source === "cannibal" && (phenomena || perilTriggered) && !reroll) {
    await actor.unsetFlag(NS, DARK_ARTS_FREE_FLAG);
    await addCondition(actor, "stunned", { level: 1 });
    out.push(line("Маг-Каннибал: Феномен прервал действие съеденного — его тошнит, <b>Оглушение на 1 Раунд</b> (наложено)."));
  }
  if (path === "sacrifice" && hasFinalEcho(actor) && !reroll) {
    const n = tb(actor, "wp");
    await freeDarkArts(actor, n, "echo");
    out.push(line(`Последнее Эхо: ${n} Ходов (W.b, включая этот) — манифестирует как обычный псайкер, без ограничений Тёмных Искусств.`));
  }
  return out;
}

/** Маг-Каннибал: полное действие — T.b×2 Ходов как обычный псайкер. */
export async function useCannibalMage(actor) {
  if (!hasCannibalMage(actor)) return ui.notifications.warn("⚠️ Нет Таланта Маг-Каннибал.");
  if (isEncounterActive() && !(await spendActionPoints(actor, apCostForActionType("Полное действие"), { physical: true })))
    return ui.notifications.warn("⚠️ Не хватает ОД на полное действие.");
  const n = tb(actor, "t") * 2;
  await freeDarkArts(actor, n + 1, "cannibal");
  await infoCard(actor, "Маг-Каннибал", [
    line(`Съедена часть разумного (умершего не больше суток назад): <b>${n}</b> Ходов (T.b×2) — манифестирует как обычный псайкер, без ограничений Тёмных Искусств (окно манифестации их не проверяет).`),
    line("Феномен или Прорыв за это время прекращает эффект, Оглушение на 1 Раунд — наложится само.")
  ], { icon: "🍖" });
}

/** Транскрипция: день обучения психосиле. */
export async function useTranscription(actor) {
  if (!hasTranscription(actor)) return ui.notifications.warn("⚠️ Нет Черты Транскрипция.");
  const teacher = await askSelect("Транскрипция", "Учитель", [
    { value: "warlock", label: "Другой Чернокнижник — без теста" },
    { value: "psyker", label: "Другой псайкер — Scholastic Lore (Occult)−10 за день" }
  ]);
  if (!teacher) return;
  const name = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Транскрипция" },
    content: `<div class="atk-dlg-row"><label>Психосила:</label><input type="text" name="t" class="pm-input"/></div>`,
    ok: { label: "День обучения", callback: (e, b) => String(b.form.elements.t.value ?? "").trim() }, rejectClose: false
  }).catch(() => "");
  if (!name) return;
  const log = { ...(actor.getFlag(NS, TRANSCRIPTION_FLAG) ?? {}) };
  const rec = { ok: 0, fail: 0, ...(log[name] ?? {}) };
  let ok = true;
  if (teacher === "psyker") {
    const adv = hasInterpreter(actor);
    const t = await eliteTest(actor, {
      what: { group: "scholasticLore", spec: "Occult" }, mod: -10, advantage: adv, title: `Транскрипция: «${name}»`, icon: "📜",
      extraParts: adv ? ["Преимущество (Интерпретатор)"] : [],
      success: "день обучения засчитан", failure: "весь день впустую"
    });
    if (!t.ok) return;
    ok = t.success;
  }
  rec[ok ? "ok" : "fail"] += 1;
  log[name] = rec;
  await actor.setFlag(NS, TRANSCRIPTION_FLAG, log);
  await infoCard(actor, "Транскрипция", [line(`«${esc(name)}»: засчитано дней — <b>${rec.ok}</b>, впустую — ${rec.fail}.${teacher === "warlock" ? " Учитель — Чернокнижник: без теста." : ""}`)], { icon: "📜" });
}

/** Слушающий: Пси-Чутьё как псайкер. */
export async function useListener(actor) {
  if (!hasListener(actor)) return ui.notifications.warn("⚠️ Нет Таланта Слушающий.");
  const mod = await askNumber("Слушающий: Пси-Чутьё", "Модификатор теста", 0, { min: -60, max: 60 });
  if (mod == null) return;
  await eliteTest(actor, { what: { skill: "psyniscience" }, mod, title: "Пси-Чутьё (Слушающий)", icon: "👂" });
}

/** Тихий Ученик: 8 ч у следа силы, Psyniscience+30, Успехи копятся до цены/50. */
export async function useSilentStudent(actor) {
  if (!hasSilentStudent(actor)) return ui.notifications.warn("⚠️ Нет Таланта Тихий Ученик.");
  const v = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Тихий Ученик" },
    content: `<div class="atk-dlg-row"><label>Психосила (эхо):</label><input type="text" name="t" class="pm-input"/></div>
      <div class="atk-dlg-row"><label>Её цена изучения (опыт):</label><input type="number" name="c" class="pm-input" value="200" min="0"/></div>`,
    ok: { label: "Изучать 8 часов", callback: (e, b) => ({ name: String(b.form.elements.t.value ?? "").trim(), cost: Number(b.form.elements.c.value) || 0 }) },
    rejectClose: false
  }).catch(() => null);
  if (!v?.name) return;
  const need = silentStudentNeed(v.cost);
  const store = { ...(actor.getFlag(NS, SILENT_STUDENT_FLAG) ?? {}) };
  const had = Number(store[v.name]) || 0;
  const t = await eliteTest(actor, { what: { skill: "psyniscience" }, mod: 30, title: `Тихий Ученик: «${v.name}»`, icon: "🕯" });
  if (!t.ok) return;
  const total = had + (t.success ? t.deg : 0);
  const done = total >= need;
  if (done) delete store[v.name]; else store[v.name] = total;
  await actor.setFlag(NS, SILENT_STUDENT_FLAG, store);
  await infoCard(actor, "Тихий Ученик", [
    line(`«${esc(v.name)}»: Успехов ${had ? `${had} + ` : ""}${t.success ? t.deg : 0} = <b>${total}</b> из ${need} (цена ${v.cost} ÷ 50).`),
    line(done ? "<b>Формула собрана</b> — силу можно изучить за опыт (перетащите её на лист)." : "Мало — Успехи сохранены до следующего эха этой силы.")
  ], { icon: "🕯" });
}

export const WARLOCK_API = { useCannibalMage, useTranscription, useListener, useSilentStudent };
