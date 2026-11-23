// module/combat/ritual-talents.mjs
// Кнопки Талантов Оккультиста вокруг ритуалов (чистая часть — rules/ritual-talents.mjs):
// Козёл Отпущения (подготовить жертву), Божественная Маска (временное покровительство за 1 ОБ),
// Промывка Мозгов (встречный Interrogate vs W) и Тзаангор Просвещённый (Диск без теста).

import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { WARP_GODS, WARP_GODS_MAP } from "../constants/veil.mjs";
import { registerContest, sideValue } from "./opposed-contest.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { SCAPEGOAT_FLAG, DIVINE_MASK_FLAG, BRAINWASHED_FLAG, hasScapegoat, hasDivineMask,
         hasBrainwashing, divineMaskSeconds, brainwashedList } from "../rules/ritual-talents.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";

const NS = "warhammer-dbc";

function firstTarget(actor) {
  return [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a !== actor) ?? null;
}

async function pickOption(title, label, options) {
  if (!options.length) return null;
  const html = `<div class="form-group"><label>${esc(label)}</label>
    <select name="pick">${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>`;
  return foundry.applications.api.DialogV2.prompt({
    window: { title }, content: html, rejectClose: false,
    ok: { label: "Выбрать", callback: (_e, b) => b.form.elements.pick.value }
  }).catch(() => null);
}

/** Козёл Отпущения: смена подготовки цели (под прицелом) к одному из ритуалов ритуалиста. */
export async function prepareScapegoat(actor) {
  if (!actor || !hasScapegoat(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Козёл Отпущения.");
  const victim = firstTarget(actor);
  if (!victim) return ui.notifications.warn("⚠️ Возьмите в цель жертву, которую готовите.");
  const rituals = [...(actor.items ?? [])].filter(i => i.type === "ritual");
  if (!rituals.length) return ui.notifications.warn("⚠️ На листе нет ни одного ритуала.");
  const name = await pickOption("Козёл Отпущения", "Для какого ритуала готовится жертва?",
    rituals.map(r => ({ value: r.name, label: r.name })));
  if (!name) return;
  await actor.setFlag(NS, SCAPEGOAT_FLAG, { ritualName: name, uuid: victim.uuid, name: victim.name });
  await postTestCard(actor, {
    icon: "🐐", title: `Козёл Отпущения — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Смена ритуальной подготовки: <b>${esc(victim.name)}</b> готов(а) для ритуала «${esc(name)}». Цена или цена ошибки этого ритуала ляжет на жертву — карточка ритуала покажет это сама.</div>`]
  }, { sound: false });
}

/** Божественная Маска: 15 минут, 1 ОБ — покровительство выбранного Бога на Cor.b часов. */
export async function useDivineMask(actor) {
  if (!actor || !hasDivineMask(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Божественная Маска.");
  const god = await pickOption("Божественная Маска", "Чьим слугой выдать себя?",
    WARP_GODS.map(g => ({ value: g.key, label: g.label })));
  if (!god) return;
  if (!(await spendInfamyPoint(actor, "Божественная Маска"))) return;
  const now = game.time?.worldTime ?? 0;
  const secs = divineMaskSeconds(actor);
  await actor.setFlag(NS, DIVINE_MASK_FLAG, { god, until: now + secs });
  await postTestCard(actor, {
    icon: "🎭", title: `Божественная Маска — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Потрачено 1 Очко Бесчестия. На ${secs / 3600} ч игрового времени ритуалы и Владычество считают покровителем <b>${esc(WARP_GODS_MAP[god]?.label || god)}</b> (Модификаторы Призыва ставятся сами). Если этот Бог враждебен вашему, каждый ритуал даст +1d5 Порчи.</div>`]
  }, { sound: false });
}

/** Промывка Мозгов: смена работы, Interrogate+0 vs W+0 цели под прицелом. Победа — доброволец ритуала. */
export async function useBrainwashing(actor) {
  if (!actor || !hasBrainwashing(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Промывка Мозгов.");
  const victim = firstTarget(actor);
  if (!victim) return ui.notifications.warn("⚠️ Возьмите жертву в цель.");
  const side = { skill: "interrogate" };
  const base = sideValue(actor, side);
  const rm = collectTestMods(actor, { kind: "skill", skill: "interrogate", char: "wp" });
  const threshold = base + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const techDef = {
    label: "Промывка Мозгов", resist: [{ char: "wp" }], opponents: () => [victim],
    onSuccess: async (a, { target }) => {
      if (!target) return;
      const list = brainwashedList(a).filter(e => e.uuid !== target.uuid);
      await a.setFlag(NS, BRAINWASHED_FLAG, [...list, { uuid: target.uuid, name: target.name }]);
      await postTestCard(a, {
        icon: "🧠", title: `Промывка Мозгов: ${esc(target.name)}`,
        lines: [`<div class="roll-threshold">${esc(target.name)} добровольно примет участие в одном ритуале ${esc(a.name)} — как жертва или ассистент, даже ценой жизни. Добавьте его ассистентом в окне ритуала: карточка отметит это и снимет метку.</div>`]
      }, { sound: false });
    }
  };
  await postTestCard(actor, {
    icon: "🧠", title: `Промывка Мозгов — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Interrogate", base, parts: rm.parts, threshold, rv: roll.total }),
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    sections: [registerContest(actor, techDef, { success, deg, threshold, rv: roll.total, side }, [victim])]
  }, { rolls: [roll] });
}

/** Тзаангор Просвещённый: час, без теста — Диск Тзинча под управлением, 3d10 урона в W. */
export async function useTzaangorDisc(actor) {
  if (!actor || !hasItemNamed(actor, "Tzaangor Enlightened", ["talent"])) {
    return ui.notifications.warn("⚠️ У актора нет Таланта Тзаангор Просвещённый.");
  }
  const { defaultSpawnDemonFn } = await import("../apps/demon-summon.mjs");
  const { applyCharDamage } = await import("./char-damage.mjs");
  const roll = await new Roll("3d10").evaluate();
  await defaultSpawnDemonFn("Disc of Tzeentch / Диск Тзинча", actor.uuid, { asMinion: true });
  await applyCharDamage(actor, "wp", roll.total);
  await postTestCard(actor, {
    icon: rollIcon("star"), title: `Тзаангор Просвещённый — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Час простого ритуала без теста: Диск Тзинча призван под управление ${esc(actor.name)} (как Трансформация Диска). Цена — <b>${roll.total}</b> урона в W (3d10).</div>`]
  }, { rolls: [roll] });
}
