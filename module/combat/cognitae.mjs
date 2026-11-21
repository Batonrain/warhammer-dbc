// module/combat/cognitae.mjs
// ════════════════════════════════════════════════════════════════════════
//  Когнитэ — кнопки (чистая часть — rules/cognitae-talents.mjs).
//  Штраф Ритуала Восьми Спиц ложится на каждый тест этих кнопок сам.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { actorInfamyValue, changeActorInfamy } from "../apps/infamy-points.mjs";
import {
  WEEK, DAY, EIGHT_SPOKES_FLAG, HYPNO_ADVANCE_FLAG, HYPNO_PROGRESS_FLAG, CORRUPTED_CALL_FLAG, PERFECT_MASK_FLAG,
  PROXY_VEIL_FLAG, CORRUPTED_CALL_COST,
  hasHypnoProgramming, hasEightSpokes, hasCorruptedCall, hasPerfectMask, hasProxyVeil, hasThousandPapercuts,
  hypnoAdvance, eightSpokesPenalty, hypnoVictimMod, hypnoPersonalityNeed, hypnoProgress
} from "../rules/cognitae-talents.mjs";
import { NS, CANCEL, firstTarget, writeOrWarn, askNumber, askChoice, cultCard, rollCultTest } from "./cult-common.mjs";

const ICON = "🌀";
const now = () => Number(globalThis.game?.time?.worldTime) || 0;
const spokes = actor => {
  const p = eightSpokesPenalty(actor, now());
  return p ? { extraMod: p, extraLabel: "Ритуал Восьми Спиц (опоздание)" } : {};
};

/** Гипно-Программирование: (W)+ступень против W+0 беспомощной жертвы (T), 8 часов. */
export async function useHypnoProgramming(actor) {
  if (!hasHypnoProgramming(actor)) return ui.notifications.warn("⚠️ Нет Черты Гипно-Программирование.");
  const victim = firstTarget();
  if (!victim || victim === actor) return ui.notifications.warn("⚠️ Гипно-Программирование: выберите беспомощного пленника (T на токене).");
  const checks = [{ name: "mech", label: "Жертва — Механикус (иммунна)" }];
  if (hasCorruptedCall(actor)) checks.push({ name: "astropath", label: "Жертва — Астропат (Искажённый Зов)" });
  const pick = await askChoice("Гипно-Программирование", "Сеанс (8 часов):", [
    { value: "session", label: "Вопросы / скрыть воспоминания / команды (1 Успех — одно)" },
    { value: "long", label: "Длительное воздействие — копить Успехи на смену личности" }
  ], { checks, hint: `Навык Гипно-Программирование(W)+${hypnoAdvance(actor)} против W+0 жертвы.` });
  if (!pick) return CANCEL;
  if (pick.checks.mech) {
    await cultCard(actor, "Гипно-Программирование", [`«${esc(victim.name)}» — Механикус: иммунитет к гипнозу.`], { icon: ICON });
    return false;
  }
  const adv = hypnoAdvance(actor);
  const mine = await rollCultTest(actor, {
    title: "Гипно-Программирование", icon: ICON, tests: [{ char: "wp", mod: adv, label: "Гипно-Программирование(W)" }],
    targetActor: victim, ...spokes(actor)
  });
  const vMod = hypnoVictimMod(victim);
  const theirs = await rollCultTest(victim, {
    title: "Сопротивление гипнозу", icon: "🧠", tests: [{ char: "wp", mod: vMod }],
    ...(vMod ? { lines: ["Каталептический Узел: −30."] } : {})
  });
  const res = resolveOpposed(mine, theirs);
  if (res.winner !== "mine") {
    await cultCard(actor, "Гипно-Программирование", [`«${esc(victim.name)}» устоял — сеанс впустую.`], { icon: ICON });
    return false;
  }
  const s = Math.max(1, mine.deg);
  const lines = [`Встречный тест выигран: <b>${s}</b> Успехов.`];
  if (pick.value === "long") {
    const need = hypnoPersonalityNeed(victim);
    const total = hypnoProgress(victim, actor.uuid) + s;
    const wrote = await writeOrWarn(victim, { [`flags.${NS}.${HYPNO_PROGRESS_FLAG}`]: { by: actor.uuid, total } }, "копилку гипноза");
    lines.push(`Длительное воздействие: <b>${total}</b> из ${need} (10×W.b)${total >= need ? " — <b>личность жертвы изменена</b>" : ""}${wrote ? "" : " (внесёт ГМ)"}.`);
  } else {
    lines.push(`Потратьте ${s} Успехов: 1 — ответ на вопрос, скрыть воспоминание или заложить команду с условием; 3 — заменить воспоминание другим.`);
    if (pick.checks.astropath && s >= CORRUPTED_CALL_COST) {
      const use = await askChoice("Искажённый Зов", `Потратить ${CORRUPTED_CALL_COST} Успеха на Искажённый Зов?`, [
        { value: "yes", label: "Да — неделю подменять один концепт в сообщениях" }, { value: "no", label: "Нет" }]);
      if (use === "yes") {
        await writeOrWarn(victim, { [`flags.${NS}.${CORRUPTED_CALL_FLAG}`]: { by: actor.uuid, until: now() + WEEK } }, "Искажённый Зов");
        lines.push(`Искажённый Зов (−${CORRUPTED_CALL_COST} Успеха): неделю Астропат подменяет один концепт (дату, координаты, имя) в сообщениях; осталось ${s - CORRUPTED_CALL_COST} Успехов.`);
      }
    }
  }
  await cultCard(actor, "Гипно-Программирование", lines, { icon: ICON });
  return false;
}

/** Гипно-Программирование: ступень навыка (Неделимый: +0/+10/+20/+30). Опыт — по обычным правилам. */
export async function setHypnoAdvance(actor, item) {
  const v = await askChoice("Гипно-Программирование", "Ступень навыка:", [0, 10, 20, 30].map(n => ({ value: String(n), label: `+${n}` })),
    { hint: `Сейчас +${hypnoAdvance(actor)}. Опыт за развитие списывается вручную (как у Неделимого Навыка).` });
  if (v == null) return CANCEL;
  const trait = item ?? actor.items.find(i => i.type === "trait" && hasHypnoProgramming({ items: [i] }));
  await trait?.setFlag(NS, HYPNO_ADVANCE_FLAG, Number(v));
  return false;
}

/** Ритуал Восьми Спиц: новое видение — срок неделя. */
export async function eightSpokesVision(actor) {
  if (!hasEightSpokes(actor)) return ui.notifications.warn("⚠️ Нет Черты Ритуал Восьми Спиц.");
  const vision = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Ритуал Восьми Спиц — видение" },
    content: `<div class="atk-dlg-row"><label>Жертва (со слов ГМ):</label><input type="text" name="v" class="pm-input"/></div>`,
    ok: { label: "Записать", callback: (ev, b) => String(b.form.elements.v.value || "").trim() }, rejectClose: false
  }).catch(() => null);
  if (vision == null) return CANCEL;
  const prev = actor.getFlag(NS, EIGHT_SPOKES_FLAG);
  const deadline = prev && Number(prev.deadline) < now() ? Number(prev.deadline) : now() + WEEK;
  await actor.update({ [`flags.${NS}.${EIGHT_SPOKES_FLAG}`]: { vision, deadline } });
  const p = eightSpokesPenalty(actor, now());
  await cultCard(actor, "Ритуал Восьми Спиц", [
    `Видение: «${esc(vision || "—")}». Срок: <b>${Math.max(0, Math.ceil((deadline - now()) / DAY))}</b> сут.${p ? ` Опоздание уже даёт <b>${p}</b>.` : ""}`
  ], { icon: "☸️" });
  return false;
}

/** Ритуал Восьми Спиц: жертва принесена — штраф снят, следующее видение через неделю. */
export async function eightSpokesSacrifice(actor) {
  if (!hasEightSpokes(actor)) return ui.notifications.warn("⚠️ Нет Черты Ритуал Восьми Спиц.");
  const was = eightSpokesPenalty(actor, now());
  await actor.update({ [`flags.${NS}.${EIGHT_SPOKES_FLAG}`]: { vision: "", deadline: now() + WEEK } });
  await cultCard(actor, "Ритуал Восьми Спиц", [`Жертва принесена.${was ? ` Штраф ${was} снят.` : ""} Новое видение — через неделю.`], { icon: "☸️" });
  return false;
}

/** Совершенная Маска: Tech-Use−20 + Schol.Lore(Occult)−20, носитель — T (или сам). */
export async function usePerfectMask(actor) {
  if (!hasPerfectMask(actor)) return ui.notifications.warn("⚠️ Нет Таланта Совершенная Маска.");
  const wearer = firstTarget() ?? actor;
  const r = await rollCultTest(actor, {
    title: "Совершенная Маска", icon: "🎭",
    tests: [{ skill: "techUse", mod: -20 }, { group: "scholasticLore", spec: "occult", specLabel: "Occult", mod: -20 }],
    success: "маска готова", failure: "проектор не настроен", ...spokes(actor),
    lines: ["Голографический проектор Good.Q+ и 8 часов работы."]
  });
  if (!r.success) return false;
  const as = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Совершенная Маска — образ" },
    content: `<div class="atk-dlg-row"><label>Кем выглядит:</label><input type="text" name="v" class="pm-input"/></div>`,
    ok: { label: "Готово", callback: (ev, b) => String(b.form.elements.v.value || "").trim() }, rejectClose: false
  }).catch(() => "");
  const wrote = await writeOrWarn(wearer, { [`flags.${NS}.${PERFECT_MASK_FLAG}`]: { by: actor.uuid, as: as || "", until: now() + WEEK } }, "Совершенную Маску");
  await cultCard(actor, "Совершенная Маска", [
    `«${esc(wearer.name)}» выглядит как <b>${esc(as || "другой персонаж")}</b> для всех чувств, чтения разума и истинного зрения${wrote ? "" : " (внесёт ГМ)"}.`,
    "Без калибровки — неделя (кнопка «Калибровать маску»)."
  ], { icon: "🎭" });
  return false;
}

/** Совершенная Маска: калибровка — ещё неделя. */
export async function calibratePerfectMask(actor) {
  if (!hasPerfectMask(actor)) return ui.notifications.warn("⚠️ Нет Таланта Совершенная Маска.");
  const wearer = firstTarget() ?? actor;
  const f = wearer.getFlag?.(NS, PERFECT_MASK_FLAG);
  if (!f) return ui.notifications.warn(`⚠️ На «${wearer.name}» нет Совершенной Маски.`);
  await writeOrWarn(wearer, { [`flags.${NS}.${PERFECT_MASK_FLAG}`]: { ...f, until: now() + WEEK } }, "калибровку");
  await cultCard(actor, "Совершенная Маска", [`Маска «${esc(wearer.name)}» откалибрована — ещё неделя.`], { icon: "🎭" });
  return false;
}

/** Замещающая Вуаль: Очко Бесчестия (цена записи), союзник (T) — подставная личность на сутки. */
export async function useProxyVeil(actor) {
  if (!hasProxyVeil(actor)) return ui.notifications.warn("⚠️ Нет Таланта Замещающая Вуаль.");
  const ally = firstTarget();
  if (!ally || ally === actor) return ui.notifications.warn("⚠️ Замещающая Вуаль: выберите добровольца (T на токене).");
  const wrote = await writeOrWarn(ally, { [`flags.${NS}.${PROXY_VEIL_FLAG}`]: { by: actor.uuid, until: now() + DAY } }, "Замещающую Вуаль");
  if (!wrote && !game.user?.isGM) return CANCEL;
  await cultCard(actor, "Замещающая Вуаль", [
    `«${esc(ally.name)}» искренне верит в роль прикрытия — сутки или до кодовой фразы (4 часа работы).`,
    "Любой успешный тест Scrutiny против него покажет подставную личность."
  ], { icon: "🎭" });
  return false;
}

/** Тысяча Бумажных Порезов: потратить N Очков Бесчестия на бюрократическую атаку. */
export async function useThousandPapercuts(actor) {
  if (!hasThousandPapercuts(actor)) return ui.notifications.warn("⚠️ Нет Таланта Тысяча Бумажных Порезов.");
  const have = actorInfamyValue(actor);
  if (have < 1) return ui.notifications.warn("⚠️ Нет Очков Бесчестия.");
  const n = await askNumber("Тысяча Бумажных Порезов", "Очков Бесчестия:", { min: 1, max: have, value: 1,
    hint: "Нужен внедрённый в местный Администратум агент. Чем больше Очков — тем сильнее эффект." });
  if (!n) return CANCEL;
  const res = await changeActorInfamy(actor, -n);
  const target = firstTarget();
  await cultCard(actor, "Тысяча Бумажных Порезов", [
    `Потрачено <b>${n}</b> Очков Бесчестия (${res.before} → ${res.after})${target ? ` против «${esc(target.name)}»` : ""}: проверки, ревизии, диспуты о собственности, вплоть до внимания Арбитров и Инквизиции — чем больше Очков, тем сильнее. Итог описывает ГМ.`
  ], { icon: "📜" });
  return false;
}
