// module/apps/infoguard.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИНФОГРАЖДЕНИЕ (гл. IV «Арсенал», вступление) — Успехи встречного теста,
//  которыми высокотехнологичный предмет (не Primitive/Мистическое, не
//  Демоническое, не Импланты/бионика) противостоит Техночудесам Ноотеургии
//  и Аниматеургии, нацеленным «vs Инфограждение» (module/sheets/tabs/tech.mjs).
//
//  Накладывается ½ смены тестом Tech-Use+0: Успехи после теста делятся
//  пополам (окр.▲) и хранятся на предмете, пока не наложат заново.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF } from "../constants/skills.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { fatigueGraceForActor } from "../rules/fatigue-grace.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { esc, relayItemUpdate } from "../helpers/utils.mjs";

// Копия fatiguePenalty (module/sheets/tabs/conditions.mjs) без импорта самого
// conditions.mjs — тот тянет sheet-helpers.mjs, а sheet-helpers.mjs тянет этот
// файл (supportsInfoguard) обратно: получился бы цикл импортов.
function fatiguePenalty(actor, charKey) {
  const fatigueExempt = ["t", "inf", "cog", "pf"];
  const hw = HOMEWORLD_BY_KEY[actor?.items?.find(i => i.type === "homeworld")?.system?.key || ""];
  const hwGrace = hw?.fatigueGrace === "tBonus" ? (actor.system.characteristics?.t?.bonus ?? 0) : 0;
  const grace = Math.max(hwGrace, fatigueGraceForActor(actor));
  if ((actor.system.fatigue?.value ?? 0) < 1 + grace) return 0;
  if (fatigueExempt.includes((charKey ?? "").toLowerCase())) return 0;
  return -10;
}

/** Есть ли смысл показывать блок Инфограждения у этого предмета. */
export function supportsInfoguard(item) {
  if (!item) return false;
  const sys = item.system || {};
  switch (item.type) {
    case "weapon":
      if (sys.daemonWeapon?.bound) return false;
      return !(sys.weaponProps || []).some(p => p.key === "primitive");
    case "armor":
      return !(sys.properties || []).some(p => p.key === "primitive");
    case "gear":
      return sys.gearCategory !== "mystic";
    case "tool":
      return sys.toolCategory !== "mystic";
    default:
      return false;
  }
}

/** Данные для блока «Инфограждение» на листе предмета. */
export function infoguardContext(item) {
  if (!supportsInfoguard(item)) return null;
  return { successes: item.system.infoguard || 0 };
}

// ── Автоматизация Техночудес Ноотеургии/Аниматеургии, работающих «vs
//    Инфограждение» (packs-src/tech-powers/**, тексты effect найдены прямым
//    поиском). Различаю по устойчивой английской части названия — русская
//    часть варьируется в написании ("Проклятье"/"Проклятие" и т.п.).
const OPPOSED_INFOGUARD_POWERS = ["Numerica Curse", "Numerica Delving", "Scrapcode Injection", "Techsorcism Purge"];
const BUFF_INFOGUARD_POWERS = {
  // «+½I.b(окр.▲) к Инфограждению» — прибавка.
  "Techsorcism Ward": { mode: "add", label: "+½I.b (окр.▲)", formula: a => Math.ceil((a.system.characteristics?.int?.bonus ?? 0) / 2) },
  // «поднимает Инфограждение до I.b, если ниже» — не прибавка, а максимум.
  "Vox Warding":       { mode: "max", label: "до I.b, если ниже", formula: a => a.system.characteristics?.int?.bonus ?? 0 }
};

/** Предметы актора, годные под Инфограждение — экипированные/носимые. */
function carriedInfoguardItems(actor) {
  return actor.items.filter(i => supportsInfoguard(i) && (i.system.equipped ?? true));
}

/**
 * HTML-блок для чат-карточки Техночуда (activateTechMiracle, tech.mjs):
 * у чудес «vs Инфограждение» — подставляет встречный порог цели (её
 * банковские Успехи, а без них — Tech-Use(I)+0 по I.b, как велит книга);
 * у усиливающих чудес — сразу прибавляет/поднимает Инфограждение целям (или
 * своим предметам, если цель не выбрана) и отчитывается, что изменилось.
 * Дальше сам встречный бросок цели, как и остальные противостояния в этом
 * коде, остаётся ручным — это соответствует остальной практике проекта.
 */
export async function infoguardInteractionSection(actor, item, { success } = {}) {
  if (!success) return "";
  const name = item?.name || "";

  const opposedKey = OPPOSED_INFOGUARD_POWERS.find(k => name.includes(k));
  if (opposedKey) {
    const targets = Array.from(game.user?.targets || []).map(t => t.actor).filter(Boolean);
    if (!targets.length) {
      return `<div class="roll-threshold infoguard-target-block">Цель не выбрана (game.user.targets) — Инфограждение придётся свериться вручную.</div>`;
    }
    const lines = [];
    for (const tActor of targets) {
      const ib = tActor.system.characteristics?.int?.bonus ?? 0;
      const items = carriedInfoguardItems(tActor);
      if (!items.length) {
        lines.push(`${esc(tActor.name)}: нет предмета под Инфограждением — встречный Tech-Use(I)+0 (I.b ${ib})`);
        continue;
      }
      for (const it of items) {
        const v = it.system.infoguard || 0;
        lines.push(`${esc(tActor.name)} — ${esc(it.name)}: Инфограждение <b>${v}</b>${v ? "" : ` (не наложено → Tech-Use(I)+0, I.b ${ib})`}`);
      }
    }
    return `<div class="roll-threshold infoguard-target-block"><b>Встречный порог (Инфограждение цели):</b><br>${lines.join("<br>")}</div>`;
  }

  const buffEntry = Object.entries(BUFF_INFOGUARD_POWERS).find(([k]) => name.includes(k));
  if (buffEntry) {
    const [, def] = buffEntry;
    const targetActors = Array.from(game.user?.targets || []).map(t => t.actor).filter(Boolean);
    const recipients = targetActors.length ? targetActors : [actor];
    const bump = def.formula(actor);
    const lines = [];
    for (const rActor of recipients) {
      for (const it of carriedInfoguardItems(rActor)) {
        const cur = it.system.infoguard || 0;
        const nv  = def.mode === "max" ? Math.max(cur, bump) : cur + bump;
        if (nv === cur) continue;
        await relayItemUpdate(it, { "system.infoguard": nv });
        lines.push(`${esc(rActor.name)} — ${esc(it.name)}: ${cur} → <b>${nv}</b>`);
      }
    }
    if (!lines.length) return "";
    return `<div class="roll-threshold infoguard-target-block"><b>Инфограждение усилено (${def.label}):</b><br>${lines.join("<br>")}</div>`;
  }

  return "";
}

/**
 * Мод. от Талантов/Черт ВЛАДЕЛЬЦА предмета к тесту Инфограждения над ним
 * (wdbc-uez7, делегированный тест — та же общая схема, что healing.mjs::
 * patientHealingMod) — эффекты с target:"skill:techUse:recipient". Сейчас в
 * паках нет ни одной такой записи (Инфограждение по книге — фиксированный
 * Tech-Use+0), но подключение готово на будущее и не меняет число, когда
 * подходящих правил нет.
 */
function ownerInfoguardMod(ownerActor) {
  if (!ownerActor) return { total: 0, lines: [] };
  const { mods } = resolveTest({ actor: ownerActor, kind: "skill", skill: "techUse", asRecipient: true });
  const total = mods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const lines = mods.map(m => `${esc(m.label)} (${esc(ownerActor.name)}): ${m.value >= 0 ? "+" : ""}${m.value}`);
  return { total, lines };
}

/**
 * Наложение Инфограждения: ½ смены, тест Tech-Use+0, Успехи ÷2 (окр.▲).
 * executorActor (wdbc-uez7, делегированный тест) — специалист, которого
 * попросили наложить Инфограждение на чужое снаряжение: бросает СВОИМ Tech-Use
 * и Усталостью, а не владельца предмета; запись всё равно ложится на сам
 * item (relayItemUpdate уже умеет писать чужой предмет через ГМ-релей, если у
 * исполнителя нет прав). Без executorActor — как раньше, владелец сам себе
 * накладывает.
 */
export async function rollInfoguard(item, { executorActor = null } = {}) {
  const ownerActor = item?.actor;
  if (!ownerActor) return;
  if (!supportsInfoguard(item)) {
    ui.notifications?.warn(`${item.name}: Инфограждение недоступно — предмет Примитивный, Мистический или Импланты/бионика.`);
    return;
  }
  const actor = executorActor ?? ownerActor;
  const delegating = actor !== ownerActor;

  const def   = SKILLS_DEF.techUse;
  const sk    = actor.system.skills?.techUse;
  const base  = sk?.total ?? -20;
  const fatigue = fatiguePenalty(actor, def?.char ?? "int");
  const ownerMod = delegating ? ownerInfoguardMod(ownerActor) : { total: 0, lines: [] };
  const eff   = base + fatigue + ownerMod.total;

  const roll    = await new Roll("1d100").evaluate();
  const rv      = roll.total;
  const success = rv <= eff;
  const deg     = success ? Math.floor(Math.abs(rv - eff) / 10) + 1 : 0;
  // Успехи после Инфограждения делятся пополам (окр.▲); при провале — 0.
  const successes = Math.ceil(deg / 2);

  await relayItemUpdate(item, { "system.infoguard": successes });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("shield", "#8fd0ff")}Инфограждение: ${esc(item.name)}${delegating ? ` — за ${esc(ownerActor.name)}` : ""}</div>
          ${ownerMod.lines.length ? `<div class="roll-threshold">${ownerMod.lines.join("<br/>")}</div>` : ""}
          <div class="roll-threshold">Tech-Use+0${fatigue !== 0 ? ` 😓 ${fatigue}` : ""} → Порог: <b>${eff}</b> (без бонуса инструментов, кроме Комби-Инструмента в Топоре Омниссии; Unnatural I не учитывается)</div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Успех — ${deg} Усп. → ½ (окр.▲) = <b>${successes}</b> Успехов Инфограждения</span>`
              : `<span class="roll-failure">Провал — Инфограждение снято (0 Успехов)</span>`}
          </div>
          <div class="roll-threshold" style="font-size:0.85em;">Занимает ½ смены. Успехи Инфограждения служат встречным порогом против Техночудес Ноотеургии/Аниматеургии.</div>
        </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));

  return successes;
}
