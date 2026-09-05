// module/apps/skillful-torture.mjs
// ════════════════════════════════════════════════════════════════════════
//  Skillful Torture / Искусная Пытка (Талант, packs-src/talents/Таланты_Боли/
//  Skillful_Torture___Искусная_Пытка_nibgzZyVum8rCQ2L.json, wdbc-sk8s):
//
//  «Пытая Беспомощного врага 5 минут и успешно пройдя Interrogate−20(I) vs
//  W+0, все друкхари, что могли насыщаться с жертвы, получают 2 Боли и
//  восстанавливают 1d5 урона во все Характеристики. За каждые 3 Успеха
//  восстанавливается ещё 1d5 Характеристики и +1 Боли. Каждый друкхари
//  получает пользу не более W.b раз в сутки (включая усиления за доп.
//  успехи в одной проверке).»
//
//  Решения по неоднозначностям текста (согласованы с пользователем):
//   - «(I)» — тест идёт по Интеллекту, а не по умолчательной Воле Навыка
//     Допрос (module/constants/skills.mjs::interrogate.char==="wp").
//   - «vs W+0» — настоящий ВСТРЕЧНЫЙ тест (resolveOpposed, оба бросают),
//     не односторонний тест пытающего со справочным порогом цели.
//   - «друкхари, способные насыщаться с жертвы» — любой друкхари-актор в
//     текущем бою (или на сцене вне боя), без доп. условия.
//   - «за каждые 3 Успеха» — margin/3 округлённый вниз (margin — итоговая
//     степень ВСТРЕЧНОГО теста из resolveOpposed, не исходного).
//
//  Day-лимит — throttleCount(actor, FLAG, "day") из module/rules/cooldown.mjs
//  (wdbc-sk8s), max = W.b ПОЛУЧАТЕЛЯ (не пытающего) — каждый друкхари считает
//  свой личный дневной лимит независимо, инкремент один раз за пытку, не за
//  каждый тир (текст явно: «включая усиления… в одной проверке»).
// ════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { raceMatches } from "../rules/race.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "skillfulTorture";

/** Владеет ли актор Талантом Skillful Torture / Искусная Пытка. */
export function hasSkillfulTorture(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Skillful Torture"));
}

/** Друкхари ли актор — по расе, либо по «Прошлому» Иннари/Арлекина (module/rules/race.mjs). */
export function isDrukhari(actor) {
  return raceMatches(actor?.system, "drukhari");
}

/** Порог Interrogate(Int)−20 пытающего — «(I)» книги, не Воля по умолчанию Навыка. */
export function interrogateIntTotal(actor) {
  const rank = actor?.system?.skills?.interrogate?.rank;
  const rankBonus = SKILL_RANKS[rank]?.bonus ?? -20;
  const intTotal = Number(actor?.system?.characteristics?.int?.total) || 0;
  return intTotal + rankBonus;
}

/** Сколько тиров по 3 Успеха (margin встречного теста) — каждый даёт +1d5 лечения и +1 Боли. */
export function extraTiers(margin) {
  return Math.max(0, Math.floor((Number(margin) || 0) / 3));
}

/** Друкхари-актёры в текущем бою — либо на текущей сцене, если боя нет. */
export function drukhariNearby() {
  let actors;
  if (game.combat?.combatants) {
    actors = [...game.combat.combatants].map(c => c.actor).filter(Boolean);
  } else {
    actors = (canvas?.scene?.tokens?.contents ?? []).map(t => t.actor).filter(Boolean);
  }
  const seen = new Set();
  return actors.filter(a => {
    if (!isDrukhari(a) || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

/**
 * Начисляет Боль + лечение всех Характеристик получателю (после проверки
 * дневного лимита ЕГО СОБСТВЕННЫМ W.b — вызывающий код это уже проверил).
 * healRolls — массив уже брошенных 1d5 (база + по одному на тир).
 */
export async function grantTortureBenefit(actor, healRolls) {
  const totalHeal = healRolls.reduce((a, b) => a + (Number(b) || 0), 0);
  const pain = 1 + healRolls.length; // 2 Боли база (1 тир) + 1 за каждый доп. тир
  const upd = {};
  for (const key of Object.keys(actor.system?.characteristics ?? {})) {
    const cur = Number(actor.system.charDamage?.[key]) || 0;
    if (cur < 0) upd[`system.charDamage.${key}`] = Math.min(0, cur + totalHeal);
  }
  const fateCur = actor.system.fate?.value ?? 0;
  const fateMax = actor.system.fate?.max ?? 0;
  upd["system.fate.value"] = Math.min(fateMax, fateCur + pain);
  await actor.update(upd);
  return { totalHeal, pain };
}

/** Дневной лимит получателя (W.b) — есть ли ещё запас. */
export function tortureBenefitAvailable(actor) {
  const wpBonus = Number(actor?.system?.characteristics?.wp?.bonus) || 0;
  if (wpBonus <= 0) return false;
  return isThrottleCountAvailable(actor, FLAG, "day", wpBonus);
}

/** Списывает одно использование дневного лимита получателя. */
export async function markTortureBenefitUsed(actor) {
  const wpBonus = Number(actor?.system?.characteristics?.wp?.bonus) || 0;
  await incrementThrottleCount(actor, FLAG, "day", wpBonus);
}

/**
 * Диалог «Искусная Пытка»: тест Interrogate(Int)−20 пытающего против W+0
 * Беспомощной цели (встречный), при успехе раздаёт пользу всем друкхари
 * рядом (с учётом их личного дневного лимита).
 */
export async function showSkillfulTortureDialog(torturer) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn("Наведите таргет (T) на Беспомощную жертву.");
  if (!target.system?.conditions?.helpless) {
    return ui.notifications.warn(`«${target.name}» не отмечен(а) как Беспомощный — пытка требует беспомощную жертву.`);
  }
  // Feels No Pain / Не Чувствует Боли (wdbc-1rno): «иммунен к пыткам, что
  // полагаются на боль» — Искусная Пытка книжно и есть пытка болью.
  if (hasRuleFlag(target, "mutation.feelsNoPain")) {
    return ui.notifications.warn(`«${target.name}» не чувствует боли — пытка на неё не действует.`);
  }

  // Общий сбор модификаторов обеим сторонам (wdbc-ct65.3): встречный тест —
  // это два теста, каждый со своими Чертами и своим состоянием тела. Допрос
  // книга называет тестом Морали (rules/resolve-test.mjs::isMoraleOpposedSkill),
  // жертва отвечает тем же.
  const torturerMods = collectTestMods(torturer, { kind: "skill", skill: "interrogate", char: "int", morale: true });
  const targetMods   = collectTestMods(target, { kind: "skill", char: "wp", morale: true });
  const torturerThreshold = interrogateIntTotal(torturer) - 20 + torturerMods.total;
  const targetThreshold   = (target.system.characteristics?.wp?.total ?? 0) + targetMods.total;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("skull","#c98bff")}Искусная Пытка</span></div>
      <div class="roll-threshold">Пытающий: ${esc(torturer.name)} — Допрос(Int)−20: <b>${torturerThreshold}</b></div>
      <div class="roll-threshold">Жертва: ${esc(target.name)} — Воля: <b>${targetThreshold}</b></div>
      <div style="font-size:0.85em;color:#8a8a8a;margin-top:6px;">5 минут пытки. При успехе — Боль и лечение Характеристик всем друкхари рядом (в бою — комбатанты, иначе — на сцене), с учётом их личного дневного лимита (W.b раз в сутки).</div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Искусная Пытка" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Пытать", icon: "fas fa-skull", default: true,
        callback: async () => {
          const torturerRoll = await new Roll("1d100").evaluate();
          const targetRoll   = await new Roll("1d100").evaluate();
          const mine   = { ...testOutcome(torturerRoll.total, torturerThreshold), threshold: torturerThreshold };
          const theirs = { ...testOutcome(targetRoll.total, targetThreshold), threshold: targetThreshold };
          const { winner, margin } = resolveOpposed(mine, theirs);

          const lines = [
            `${rollIcon("target","#c98bff")}${esc(torturer.name)}: <b>${torturerRoll.total}</b> vs ${torturerThreshold}${torturerMods.parts.length ? ` (${torturerMods.parts.join(", ")})` : ""} ${mine.success ? "(успех)" : "(провал)"}`,
            `${rollIcon("target","#8a8a8a")}${esc(target.name)}: <b>${targetRoll.total}</b> vs ${targetThreshold}${targetMods.parts.length ? ` (${targetMods.parts.join(", ")})` : ""} ${theirs.success ? "(успех)" : "(провал)"}`
          ];

          if (winner !== "mine") {
            lines.push(`<b>Жертва выстояла</b> — пытка не принесла пользы.`);
            // Встречный тест: Порогов два (свой у пытающего, свой у жертвы) и
            // они уже расписаны построчно с подписями модификаторов — общей
            // строки Порога/броска у такой карточки быть не может.
            await postTestCard(torturer, {
              title: "Искусная Пытка",
              lines: [lines.join("<br/>")]
            }, { sound: false });
            return;
          }

          const tiers = extraTiers(margin);
          const healRolls = [];
          for (let i = 0; i < 1 + tiers; i++) {
            const r = await new Roll("1d5").evaluate();
            healRolls.push(r.total);
          }
          lines.push(`Победа с margin <b>${margin}</b> — доп. тиров: <b>${tiers}</b>, броски лечения: ${healRolls.join(", ")}`);

          const recipients = drukhariNearby();
          const benefited = [], capped = [];
          for (const actor of recipients) {
            if (!tortureBenefitAvailable(actor)) { capped.push(actor.name); continue; }
            const { totalHeal, pain } = await grantTortureBenefit(actor, healRolls);
            await markTortureBenefitUsed(actor);
            benefited.push(`${esc(actor.name)} (+${pain} Боли, +${totalHeal} лечения)`);
          }
          if (benefited.length) lines.push(`<b>Получили пользу:</b> ${benefited.join(", ")}`);
          if (capped.length) lines.push(`<span style="color:#a33;">Дневной лимит исчерпан:</span> ${capped.map(esc).join(", ")}`);
          if (!recipients.length) lines.push(`<i>Рядом нет друкхари, способных насытиться.</i>`);

          await postTestCard(torturer, {
            title: "Искусная Пытка — успех",
            lines: [lines.join("<br/>")]
          }, { sound: false });
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}
