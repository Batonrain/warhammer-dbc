// module/combat/lacrimallus.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЛАКРИМАЛЛУС — кнопки Черт и Талантов (арифметика —
//  rules/lacrimallus-talents.mjs). Слуги — список «Под моим Присутствием»
//  (system.followers, вкладка СОЦИУМ): там Лакрималлус и держит свои Орды и
//  Миньонов тех-траллов.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { mech1Card } from "./mech1-rolls.mjs";
import {
  isToilWorker, isTechThrall, isHorde, magnitudeOf, toilseerCrew, assemblyLineSuccesses,
  corpsesPerThrall, chainsCap, chainsShiftOutcome, overclockMagnitudeLoss, OVERCLOCK_THRALL_DAMAGE,
  hasInhumanResources, ASSEMBLY_LINE_BANK_CAP, ASSEMBLY_LINE_POOL, hasToilseer
} from "../rules/lacrimallus-talents.mjs";

const num = v => Number(v) || 0;

const docOf = uuid => {
  if (!uuid) return null;
  try { const d = fromUuidSync(uuid); return d?.actor ?? d ?? null; } catch { return null; }
};

/** Слуги «Под моим Присутствием». */
export function followersOf(actor) {
  const list = Array.isArray(actor?.system?.followers) ? actor.system.followers : [];
  return list.map(f => docOf(f?.uuid)).filter(Boolean);
}

async function askNumber(title, label, { value = 1, max = 99, hint = "" } = {}) {
  const raw = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `${hint ? `<p style="margin:4px 6px;">${hint}</p>` : ""}<div class="form-group"><label>${esc(label)}</label><input type="number" name="n" min="0" max="${max}" value="${value}" autofocus/></div>`,
    ok: { label: "Готово", callback: (_ev, b) => b.form.querySelector("[name=n]")?.value }
  }).catch(() => null);
  if (raw == null) return null;
  return Math.max(0, Math.min(max, Math.trunc(num(raw))));
}

// ── Трудовидец ──────────────────────────────────────────────────────────────

/** Расчёт ассистентов и бригад для Крафта по списку слуг. */
export async function useToilseerCrew(actor) {
  if (!actor || !hasToilseer(actor)) return ui.notifications?.warn("⚠️ У актора нет Черты Трудовидец.");
  const workers = followersOf(actor).filter(isToilWorker);
  if (!workers.length) return ui.notifications?.warn("⚠️ В списке «Под моим Присутствием» нет сервиторов и тех-траллов.");
  const crew = toilseerCrew(workers);
  const rows = workers.map(w => isHorde(w)
    ? `${esc(w.name)}: Орда, Магнитуда ${magnitudeOf(w)} → ${Math.floor(magnitudeOf(w) / 5)}`
    : `${esc(w.name)}: 1`);
  await mech1Card(actor, {
    icon: "🛠️", title: "Трудовидец: бригады",
    lines: [
      `Ассистентов в тест Крафта (без нужных Навыков): <b>${crew.assistants}</b> — впишите в поле «Ассистенты» проекта.`,
      `Или бригадами: до <b>${crew.brigades}</b> «потоков» — по завершении Крафта +1 вещь за каждую работавшую бригаду.`,
      `<div class="roll-threshold" style="font-size:0.85em;">${rows.join("; ")}. Орды — 1 за каждые полные 5 Магнитуды. Гекатонхейр: +1 в бригаду за лишнюю пару конечностей — за столом.</div>`
    ]
  });
  return crew;
}

// ── Сборочная Линия ─────────────────────────────────────────────────────────

/** Сутки работы Орд тех-траллов: Успехи в пул Сборочной Линии. */
export async function useAssemblyLine(actor) {
  const hordes = followersOf(actor).filter(h => isHorde(h) && isTechThrall(h));
  const n = assemblyLineSuccesses(hordes);
  if (!n) return ui.notifications?.warn("⚠️ Нет Орд тех-траллов с Магнитудой 3+ в списке «Под моим Присутствием».");
  const { gainResource } = await import("../apps/resource-pools.mjs");
  const res = await gainResource(actor, ASSEMBLY_LINE_POOL, n, { silent: true });
  await mech1Card(actor, {
    icon: "🏭", title: "Сборочная Линия: сутки",
    lines: [
      `${hordes.map(h => `${esc(h.name)} (${magnitudeOf(h)})`).join(", ")} → <b>+${n}</b> Успехов (1 за 3 Магнитуды).`,
      res ? `В пуле: <b>${res.after}</b>. Тратятся на Крафт изделий с Банком ≤ ${ASSEMBLY_LINE_BANK_CAP}.` : ""
    ].filter(Boolean)
  });
  return n;
}

// ── Цепи Производства ───────────────────────────────────────────────────────

/** Итог смены с аугментированными людьми: кто умер и стал тех-траллом. */
export async function useChainsOfProduction(actor) {
  const cap = chainsCap(actor?.system?.characteristics?.per?.bonus);
  const n = await askNumber(`Цепи Производства — ${actor.name}`, "Сколько аугментированных работало", {
    value: cap, max: cap, hint: `Не больше P.b (${cap}) на смену Крафта. Аугментация — 1 минута на человека.`
  });
  if (!n) return;
  const roll = await new Roll(`${n}d10`).evaluate();
  const rolls = roll.dice?.[0]?.results?.map(r => r.result) ?? [roll.total];
  const out = chainsShiftOutcome(rolls);
  const { postTestCard } = await import("../helpers/test-card.mjs");
  await postTestCard(actor, {
    icon: "⛓️", title: `Цепи Производства — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Броски: ${rolls.join(", ")} (умирают на 1–3).</div>`,
      `<div class="roll-threshold">Умерли и стали тех-траллами: <b>${out.dead}</b>; выжили: <b>${out.alive}</b>. Новых траллов добавьте Миньонами или Магнитудой Орды.</div>`
    ]
  }, { rolls: [roll] });
  return out;
}

// ── Тралл из трупов ─────────────────────────────────────────────────────────

async function corpseRollCard(actor, { xenos = false, title, extra = [] }) {
  const inhuman = hasInhumanResources(actor);
  const roll = await new Roll("1d10").evaluate();
  const n = corpsesPerThrall(roll.total, { inhuman, xenos });
  const { postTestCard } = await import("../helpers/test-card.mjs");
  await postTestCard(actor, {
    icon: "💀", title: `${esc(title)} — ${esc(actor.name)}`,
    lines: [
      ...extra.map(l => `<div class="roll-threshold">${l}</div>`),
      `<div class="roll-threshold">1d10 = <b>${roll.total}</b> → на тралла уходит <b>${n}</b> ${n === 1 ? "труп" : "трупа"}${
        inhuman && !xenos ? " (Бесчеловечные Ресурсы: 1–5 — 2, 6+ — 1)" : " (1–3 — 3, 4–6 — 2, 7+ — 1)"}.</div>`
    ]
  }, { rolls: [roll] });
  return n;
}

async function askXenos(title) {
  return foundry.applications.api.DialogV2.wait({
    window: { title }, classes: ["warhammer-dbc", "wh-holo"],
    content: "<p style=\"margin:4px 6px;\">Чьи трупы?</p>",
    buttons: [
      { action: "human", label: "Люди", default: true, callback: () => false },
      { action: "xenos", label: "Ксеносы", callback: () => true }
    ],
    rejectClose: false
  });
}

/** Бесчеловечные Ресурсы: сколько трупов уходит на тралла. */
export async function useInhumanResources(actor) {
  const xenos = await askXenos(`Тралл из трупов — ${actor.name}`);
  if (xenos == null) return;
  return corpseRollCard(actor, { xenos, title: "Тралл из трупов",
    extra: [xenos ? "Трупы ксеносов: разброс как обычно, без бонуса Таланта." : "Трупы людей, умерших не более часа назад; работа — 1 минута."] });
}

// ── Быстрые Объятья ─────────────────────────────────────────────────────────

/** Подъём тех-тралла за ментальное полудействие и 2 Когниции. */
export async function useRapidEmbrace(actor) {
  const COST = 2;
  const cog = num(actor?.system?.cognition?.value);
  if (cog < COST) return ui.notifications?.warn(`⚠️ Не хватает Когниции: нужно ${COST}, есть ${cog}.`);
  const xenos = await askXenos(`Быстрые Объятья — ${actor.name}`);
  if (xenos == null) return;
  const { spendActionPoints } = await import("./action-economy.mjs");
  if (!await spendActionPoints(actor, 1, { physical: false })) return ui.notifications?.warn("⚠️ Нет полудействия.");
  await actor.update({ "system.cognition.value": cog - COST });
  return corpseRollCard(actor, { xenos, title: "Быстрые Объятья",
    extra: [`Ментальное полудействие, Когниция −<b>${COST}</b>. Трупы — в пределах 3 м. Нужны медицинский мехадендрит и 2 мехатендрила.`] });
}

// ── Разгон Траллов ──────────────────────────────────────────────────────────

/** Цена переброса теста тех-траллу или Орде (цель — T). */
export async function useThrallOverclock(actor) {
  const target = [...(game.user?.targets ?? [])].map(t => t.actor).find(Boolean);
  if (!target || !isTechThrall(target)) return ui.notifications?.warn("⚠️ Выберите целью (T) тех-тралла или Орду тех-траллов, которые перебрасывают тест.");
  const mine = game.user?.isGM || target.isOwner;
  if (isHorde(target)) {
    const mag = magnitudeOf(target);
    const loss = overclockMagnitudeLoss(mag);
    if (mine && loss) await target.update({ "system.magnitude.value": Math.max(0, mag - loss) });
    return mech1Card(actor, { icon: "⚡", title: "Разгон Траллов",
      lines: [`${esc(target.name)} перебрасывает тест: Магнитуда −<b>${loss}</b> (1 за каждые полные 10): ${mag} → ${Math.max(0, mag - loss)}.${mine ? "" : " Орда не ваша — спишите вручную."}`] });
  }
  const roll = await new Roll(OVERCLOCK_THRALL_DAMAGE).evaluate();
  let line = "";
  if (mine) {
    const { applyWoundLoss } = await import("../rules/wounds.mjs");
    const loss = await applyWoundLoss(target, roll.total);
    line = ` Раны ${loss?.currentWounds ?? "?"} → ${loss?.newWounds ?? "?"}.`;
  } else line = " Тралл не ваш — Раны спишите вручную.";
  const { postTestCard } = await import("../helpers/test-card.mjs");
  return postTestCard(actor, {
    icon: "⚡", title: `Разгон Траллов — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${esc(target.name)} перебрасывает тест: <b>${roll.total}</b> непоглощаемого R Dmg в торс.${line}</div>`]
  }, { rolls: [roll] });
}
