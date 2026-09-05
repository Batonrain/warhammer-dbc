// module/combat/mount.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Верховые тесты (корбук стр. 477-478): Поворот, Занос, Трудный Ландшафт
//  верхом, удержание в седле, выпадение, Уклонение верхом, ремонт байка.
//
//  Пороги и таблицы сюда не пишутся — они в rules/mount.mjs, который живёт без
//  Foundry и проверяется тестами. Здесь только броски, карточки и правки
//  документов.
//
//  Тесты «чтобы удержаться в седле» бывают трёх разных видов, и книга это
//  различает: после неудачного поворота — тест A с поправкой поворота, после
//  провала ландшафта — тест НАВЫКА управления (Survival+0 или Operate−10), а
//  при Крит. Эффекте, падении или смерти скакуна — Acrobatics с поправкой по
//  скорости. Все три собраны в одну функцию `saddleTest` с разным `kind`,
//  потому что различаются они только порогом: последствие у всех одно.
//
//  Авто-встречный чекбокс/делегирование (wdbc-j814/wdbc-uez7) в эти диалоги
//  сознательно НЕ перенесены (wdbc-qc6d): все верховые тесты — Навык
//  управления/Ловкость/Акробатика самого rider против фиксированного порога
//  (Ландшафт/Занос/Седло), без стороннего актора с симметричным Навыком на
//  другом конце — авто-резолву опонента через skillTotal/characteristics тут
//  нечего считать. «Удержаться в седле» уже и так открывается кнопкой в
//  чат-карточке (wh-saddle-btn, hooks.mjs), доступной владельцу всадника или
//  ГМ — тот же результат, что делегирование даёт для Лечения, только не
//  требует отдельного механизма.
// ════════════════════════════════════════════════════════════════════════════

import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";
import { spendReaction }  from "./action-economy.mjs";
import { _noReactionCard } from "./defense.mjs";
import { rollIcon }      from "../constants/roll-icons.mjs";
import { postTestCard }  from "../helpers/test-card.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { SKILL_RANKS }   from "../constants/characteristics.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { resolveKindOutcome } from "../rules/kind-outcome.mjs";
import { testKindHtml, diceModeHtml, critLineHtml, readTestKind, readDiceChoice,
         mergeReroll, wireTestKindLive, rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import {
  MOUNT_SPEEDS, MOUNT_SKID, MOUNT_TERRAIN_MOD, STAY_MOD, BIKE_REPAIR, SELECTIVE_MODS,
  mountTraits, isBike, riderControl, testMod, turnOptions, skidInfo,
  fallFromSaddle, acrobaticsStayMod, spliceBonus, hasTalent, passengerCount,
  hitTarget, mountSpd, mountSelectiveMod, mountControlSkill, skillValue, BLADES_TIER_USES} from "../rules/mount.mjs";

const sgn = n => `${n >= 0 ? "+" : ""}${n}`;

/** Скакун этого всадника — документ по ссылке, что хранит сам всадник. */
export async function mountOf(rider) {
  const uuid = rider?.system?.mount?.uuid;
  if (!uuid) return null;
  return await fromUuid(uuid).catch(() => null);
}

/** Скорость скакуна в текущем Ходу; неизвестное значение считаем стоянкой. */
export function speedKeyOf(rider) {
  const key = rider?.system?.mount?.speed;
  return key in MOUNT_SPEEDS ? key : "still";
}

/**
 * Один бросок d100 против порога: степени считаются как везде в системе.
 * Крит (натуральные 1-5/96-100, стр. 25) — общий диапазон без расширения
 * правилом: верховые тесты не сводятся к одному ключу Навыка/Характеристики
 * (то Навык управления, то A, то смешанный тест), поэтому здесь — базовый
 * диапазон на всех, а не resolveTest под каждый из шести разных случаев.
 * `critLine` — готовая строка карточки, пустая, если не сработало.
 */
async function rollAgainst(threshold) {
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;
  const critLine = critLineHtml(criticalOutcome(rv));
  return { roll, rv, passed, deg, critLine };
}

/** Список поправок в подпись порога: «навык +10, Манёвренный +20». */
const modLine = parts => parts.filter(p => p.value).map(p => `${p.label} ${sgn(p.value)}`).join(", ");

/**
 * Адаптер `val(selector)` для rules/test-kind-widget.mjs поверх jQuery-обёртки
 * старого `Dialog` — тот же приём, что в sheets/tabs/disorders.mjs.
 */
function valOf(html) {
  return sel => { const v = html.find(sel).val(); return v === undefined ? null : v; };
}

/**
 * Полный конвейер Вида теста для верховых тестов, куда его раскатали (Поворот,
 * Занос, Ландшафт, Седло, Ремонт байка). Бросок + Комбинированный/Расширенный/
 * Встречный/Крит — как у остальных раскатанных диалогов, через
 * rules/kind-outcome.mjs::resolveKindOutcome. `baseEff` — уже посчитанный
 * порог теста ДО Сложности (её добавляет сюда).
 */
async function rollWithKind(actor, baseEff, tk, ctx) {
  const reroll = tk.reroll || null;
  const { roll, rv, rerollNote } = await rollD100WithReroll(reroll);
  const outcome = await resolveKindOutcome(actor, {
    kind: tk.kind, baseEff: baseEff + tk.difficulty, rv,
    combined: tk.combined, extended: tk.extended, opposed: tk.opposed, ctx
  });
  return { roll, rv, rerollNote, outcome };
}

/**
 * Публикация верховой карточки — общий сборщик helpers/test-card.mjs
 * (wdbc-kuun): `card` — набор полей testCardHtml (шапка, Порог, свои строки,
 * бросок, переброс, крит, исход, свои блоки). Звук кубика — только когда
 * бросок действительно был, как и раньше.
 */
async function postCard(actor, card, rolls = []) {
  await postTestCard(actor, card, { rolls, sound: rolls.length > 0 });
}

// ── Кто и на чём едет ─────────────────────────────────────────────────────

/**
 * Общий сбор: всадник, скакун, его Черты, значение Навыка управления и текущая
 * скорость. Возвращает null и ругается в интерфейс, если ехать не на чем —
 * каждому диалогу иначе пришлось бы повторять одну и ту же проверку.
 */
async function mountContext(rider) {
  const mount = await mountOf(rider);
  if (!mount) {
    ui.notifications.warn("⚠️ Персонаж не верхом: скакун не выбран на панели «ВЕРХОМ».");
    return null;
  }
  const traits  = mountTraits(mount);
  const control = riderControl(rider, mount, traits);
  const riders  = game.actors?.contents ?? [];
  return {
    mount, traits, control,
    speedKey: speedKeyOf(rider),
    passengers: passengerCount(mount, riders),
    bike: isBike(mount)
  };
}

// ── Поворот (стр. 477) ────────────────────────────────────────────────────

export async function showTurnDialog(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, control, speedKey, passengers } = ctx;

  const turns = turnOptions(speedKey, rider, mount, { passengers, traits: ctx.traits });
  const speedLabel = MOUNT_SPEEDS[speedKey].label;

  const rows = turns.options.map((o, i) => {
    const label = o.needsTest
      ? `${o.angle}° — тест ${control.label} ${sgn(o.mod)}`
      : `${o.angle}° — без теста${o.action === "half" ? " (полудействие)" : o.action === "free" ? " (свободное действие)" : ""}`;
    return `<option value="${i}">${label}</option>`;
  }).join("");

  const manNote = turns.manoeuvreParts.length
    ? `<div class="atk-range-info" style="font-size:0.82em;">Маневрирование: ${modLine(turns.manoeuvreParts)}</div>` : "";

  new Dialog({
    title: `Поворот — ${mount.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(mount.name)}</span>
          <span style="opacity:.7">(${speedLabel})</span></div>
        <div class="atk-dlg-row"><label>Угол:</label><select id="mt-angle">${rows}</select></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="mt-mod" type="number" value="0"/></div>
        ${manNote}
        <div class="atk-range-info" style="font-size:0.82em;">
          ${control.label}: <b>${control.value}</b>${control.combined ? " — Навыком не владеет, тест комбинированный" : ""}.
          При неудаче скакун поворачивает только на ${turns.fallbackAngle}°, а всадник проходит тест A.
        </div>
        ${testKindHtml({ defaultKind: "base", label: "Поворот" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Поворот!",
        callback: async html => {
          const val = valOf(html);
          const idx = parseInt(html.find("#mt-angle").val()) || 0;
          const extra = parseInt(html.find("#mt-mod").val()) || 0;
          const tk = readTestKind(val, { label: "Поворот" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          await resolveTurn(rider, ctx, turns, idx, extra, tk);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      const root = html[0];
      const { updateAutoOutcomeNote } = wireTestKindLive(root, {
        actor: rider, label: "Поворот",
        getBaseEff: () => {
          const idx = parseInt(root.querySelector("#mt-angle")?.value) || 0;
          const extra = parseInt(root.querySelector("#mt-mod")?.value) || 0;
          const option = turns.options[idx];
          return control.value + (option?.mod || 0) + extra;
        }
      });
      root.querySelectorAll("#mt-angle, #mt-mod").forEach(el => el.addEventListener("input", updateAutoOutcomeNote));
    }
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

async function resolveTurn(rider, ctx, turns, idx, extraMod, tk = { kind: "base", difficulty: 0 }) {
  const option = turns.options[idx];
  const { control, speedKey } = ctx;

  if (!option.needsTest) {
    return postCard(rider, {
      icon: rollIcon("run"), title: `Поворот — ${esc(rider.name)}`,
      outcome: `<span class="roll-success">Поворот на ${option.angle}° без теста${
        option.action === "half" ? " (полудействие)" : option.action === "free" ? " (свободное действие)" : ""}.</span>`
    });
  }

  const baseEff = control.value + option.mod + extraMod;
  const { roll, rv, rerollNote, outcome } = await rollWithKind(rider, baseEff, tk, { actor: rider, kind: "skill" });
  const { success: passed, deg } = outcome;

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Поворот на ${option.angle}°.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Поворот только на ${turns.fallbackAngle}°.</span></div>
       ${saddleButton(rider, "agility", option.riderMod, `неудачный поворот на ${option.angle}°`)}`;

  await postCard(rider, {
    icon: rollIcon("run"),
    title: `Поворот на ${option.angle}°${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(option.mod + extraMod)}
      (${MOUNT_SPEEDS[speedKey].label}${turns.manoeuvreParts.length ? `, ${modLine(turns.manoeuvreParts)}` : ""})${tk.difficulty ? ` ${sgn(tk.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (tk.difficulty || 0)}</b></div>`,
    lines: [
      outcome.combinedLine,
      control.combined ? `<div class="roll-defense-note">Навыком не владеет — по книге это комбинированный тест с основным действием.</div>` : ""
    ],
    rv, rerollNote, critLine: outcome.critLine,
    sections: [body, outcome.extendedLine, outcome.opposedLine]
  }, [roll]);
}

// ── Занос (стр. 477) ──────────────────────────────────────────────────────

/**
 * Раньше катился сразу по клику, без диалога — тест давал только Занос
 * (стр. 477), выбирать было не из чего. Появились Вид теста/Сложность/Кубик,
 * поэтому маленький DialogV2, как у остальных раскатанных тестов без диалога
 * (Безумие, Нестабильность Демона).
 */
export async function showSkidDialog(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, control, speedKey, passengers } = ctx;
  const info = skidInfo(speedKey, rider, mount, { passengers, traits: ctx.traits });

  if (!info.allowed) {
    return ui.notifications.warn(info.blockedBySidecar
      ? "⚠️ Байк с Коляской не может совершать Занос."
      : "⚠️ Занос возможен только после Натиска или Бега.");
  }

  const baseEff = control.value + info.mod;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Занос — ${mount.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 340 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>Занос — ${esc(mount.name)}</span></div>
        <div class="roll-dlg-row"><label>${control.label}:</label><span>${control.value} ${sgn(info.mod)} = ${baseEff}</span></div>
        ${testKindHtml({ defaultKind: "base", label: "Занос" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </div>`,
    buttons: [
      {
        action: "roll", icon: "fas fa-dice-d10", label: "Занос!", default: true,
        callback: (event, button) => {
          const val = sel => button.form.querySelector(sel)?.value ?? null;
          const tk = readTestKind(val, { label: "Занос" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          return tk;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => wireTestKindLive(dialog.element, {
      actor: rider, label: "Занос",
      getBaseEff: () => baseEff + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
    }),
    rejectClose: false
  });
  if (!result) return;

  const { roll, rv, rerollNote, outcome } = await rollWithKind(rider, baseEff, result, { actor: rider, kind: "skill" });
  const { success: passed, deg } = outcome;

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Поворот ещё на ${info.angle}°.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Дополнительного поворота нет.</span></div>`;

  await postCard(rider, {
    icon: rollIcon("burst", "#ff8a3a"),
    title: `Занос${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(info.mod)}
      (Занос ${sgn(MOUNT_SKID.mod)}${info.manoeuvreParts.length ? `, ${modLine(info.manoeuvreParts)}` : ""})${result.difficulty ? ` ${sgn(result.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (result.difficulty || 0)}</b></div>`,
    lines: [outcome.combinedLine],
    rv, rerollNote, critLine: outcome.critLine,
    sections: [
      body, outcome.extendedLine, outcome.opposedLine,
      `<div class="roll-allout-note">Независимо от исхода: −10 на все физические действия до начала следующего Хода.</div>`
    ]
  }, [roll]);

  await rider.update({ "system.mount.skidUsed": true });
}

// ── Лезвия (X) (стр. 478) ──────────────────────────────────────────────────
//  Раз в Ход (больше — при высоком ранге Навыка управления), проезжая мимо
//  врага, всадник свободным действием пытается попасть по нему Лезвиями/
//  Шипами скакуна или байка. Лимит использований в Ход растёт с рангом:
//  Тренированное (+10) — 1 раз, Опытный (+20) — 2 (по разным целям), Ветеран
//  (+30) — 3. Ниже Тренированного способность вообще недоступна.
//
//  Схема Черты хранит X одним числом (NumberField), а книга называет его
//  «профилем» — упрощение: X читается как плоский урон типа Rending без
//  Проб., как и остальные X-рейтинги в этом файле (deflectorShield и т.п.).

export async function showBladesDialog(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, traits } = ctx;
  if (!("blades" in traits)) {
    return ui.notifications.warn("⚠️ У этого скакуна нет Черты Лезвия.");
  }

  const control  = mountControlSkill(mount, traits);
  const sv       = skillValue(rider, control);
  const maxUses  = BLADES_TIER_USES[sv.rank] || 0;
  if (maxUses === 0) {
    return ui.notifications.warn(
      `⚠️ Нужен ${control.label}+10 (Тренированное) или выше — сейчас «${SKILL_RANKS[sv.rank]?.label ?? sv.rank}».`);
  }
  const used = Number(rider.system?.mount?.bladesUsed) || 0;
  if (used >= maxUses) {
    return ui.notifications.warn(`⚠️ Лезвия уже использованы ${used} из ${maxUses} раз в этот Ход.`);
  }

  const rating   = Number(traits.blades) || 0;
  const baseEff  = sv.value - 10;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Лезвия — ${mount.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 360 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>Лезвия — ${esc(mount.name)}</span></div>
        <div class="roll-dlg-row"><label>${control.label} −10:</label><span>${sv.value} − 10 = ${baseEff}</span></div>
        <div class="roll-dlg-row"><label>Использований:</label><span>${used} из ${maxUses} в этот Ход</span></div>
        ${testKindHtml({ defaultKind: "base", label: "Лезвия" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </div>`,
    buttons: [
      {
        action: "roll", icon: "fas fa-dice-d10", label: "Лезвия!", default: true,
        callback: (event, button) => {
          const val = sel => button.form.querySelector(sel)?.value ?? null;
          const tk = readTestKind(val, { label: "Лезвия" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          return tk;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => wireTestKindLive(dialog.element, {
      actor: rider, label: "Лезвия",
      getBaseEff: () => baseEff + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
    }),
    rejectClose: false
  });
  if (!result) return;

  const { roll, rv, rerollNote, outcome } = await rollWithKind(rider, baseEff, result, { actor: rider, kind: "skill" });
  const { success: passed, deg } = outcome;

  const body = passed
    ? `<div class="roll-damage-section">
        <div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Попадание Лезвиями, профиль <b>${rating}</b> R.</span></div>
        <div class="roll-defense-section">
          <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен цели</span></div>
          <button class="wh-dodge-btn" type="button" data-extra-mod="0" data-hits-count="1" data-attacker-uuid="${rider.uuid}">
            Уклонение (как от рукопашной)
          </button>
        </div>
        <div class="roll-apply-dmg-section">
          <button class="wh-apply-dmg-btn" type="button"
            data-damage="${rating}" data-penetration="0" data-damage-type="rending"
            data-hit-location="Торс" data-weapon-name="Лезвия" data-attacker="${esc(mount.name)}"
            data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0" data-melee="1">
            Применить урон Лезвий: <b>${rating}</b> R
          </button>
        </div>
      </div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Попадания нет.</span></div>`;

  await postCard(rider, {
    icon: rollIcon("blood", "#ff6b6b"),
    title: `Лезвия${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">${control.label} <b>${sv.value}</b> −10${result.difficulty ? ` ${sgn(result.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (result.difficulty || 0)}</b></div>`,
    rv, rerollNote, critLine: outcome.critLine,
    sections: [body, outcome.extendedLine, outcome.opposedLine]
  }, [roll]);

  await rider.update({ "system.mount.bladesUsed": used + 1 });
}

// ── Трудный Ландшафт верхом (стр. 477) ────────────────────────────────────

export async function showMountTerrainDialog(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, control, traits, bike } = ctx;

  // Вездеход снимает верховой штраф −20; Талант «Рысь» снимает сам тест, если
  // скакун прошёл не больше SPD за Ход.
  const allTerrain = "allTerrain" in traits;
  const trot = hasTalent(rider, "Trot", "Рысь");
  const terrainMod = allTerrain ? 0 : MOUNT_TERRAIN_MOD;

  new Dialog({
    title: `Трудный Ландшафт верхом — ${mount.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>${control.label}:</label><input id="mtt-skill" type="number" value="${control.value}"/></div>
        <div class="atk-dlg-row"><label>Верхом:</label><span>${sgn(terrainMod)}${allTerrain ? " — Вездеход" : ""}</span></div>
        <div class="atk-dlg-row"><label>Ландшафт зоны:</label><input id="mtt-zone" type="number" value="0"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="mtt-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          ${bike ? "Ландшафт не уменьшает SPD байка." : "Всадник выбирает: штраф −20 или половина SPD, как обычно."}
          Провал: 1 непоглощаемого I(Cr) скакуну и тест ${bike ? "Operate−10" : "Survival+0"} — или выпадение из седла.
          ${trot ? "<br>Талант «Рысь»: двигаясь не более SPD в Ход, скакун игнорирует Трудный Ландшафт вовсе." : ""}
        </div>
        ${testKindHtml({ defaultKind: "base", label: "Трудный Ландшафт верхом" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const val = valOf(html);
          const skill = parseInt(html.find("#mtt-skill").val()) || 0;
          const zone  = parseInt(html.find("#mtt-zone").val()) || 0;
          const extra = parseInt(html.find("#mtt-mod").val()) || 0;
          const tk = readTestKind(val, { label: "Трудный Ландшафт верхом" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          await resolveMountTerrain(rider, ctx, { skill, zone, extra, terrainMod, tk });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      const root = html[0];
      const { updateAutoOutcomeNote } = wireTestKindLive(root, {
        actor: rider, label: "Трудный Ландшафт верхом",
        getBaseEff: () => {
          const skill = parseInt(root.querySelector("#mtt-skill")?.value) || 0;
          const zone  = parseInt(root.querySelector("#mtt-zone")?.value) || 0;
          const extra = parseInt(root.querySelector("#mtt-mod")?.value) || 0;
          return skill + terrainMod + zone + extra;
        }
      });
      root.querySelectorAll("#mtt-skill, #mtt-zone, #mtt-mod").forEach(el => el.addEventListener("input", updateAutoOutcomeNote));
    }
  }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
}

async function resolveMountTerrain(rider, ctx, { skill, zone, extra, terrainMod, tk = { kind: "base", difficulty: 0 } }) {
  const { mount, control } = ctx;
  const total = terrainMod + zone + extra;
  const baseEff = skill + total;
  const { roll, rv, rerollNote, outcome } = await rollWithKind(rider, baseEff, tk, { actor: rider, kind: "skill" });
  const { success: passed, deg } = outcome;

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Проехал чисто.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}.</span></div>
       <div class="roll-damage-section">
         <div class="roll-damage-label">${rollIcon("blood", "#ff6b6b")}Скакуну: <b>1</b> непоглощаемого I(Cr)</div>
         <button class="wh-apply-dmg-btn" type="button"
           data-damage="1" data-penetration="999" data-damage-type="impact"
           data-hit-location="Торс" data-weapon-name="Трудный ландшафт" data-attacker="${esc(rider.name)}"
           data-felling="0" data-primitive="0" data-ignore-shield="1" data-warp-soak="0">
           Применить 1 урона скакуну — выберите его токен
         </button>
       </div>
       ${saddleButton(rider, "control", testMod(STAY_MOD, mount), "провал Трудного Ландшафта")}`;

  await postCard(rider, {
    icon: rollIcon("burst", "#b0a080"),
    title: `Трудный Ландшафт верхом${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">${control.label} <b>${skill}</b> ${sgn(total)}
      (верхом ${sgn(terrainMod)}${zone ? `, зона ${sgn(zone)}` : ""}${extra ? `, мод ${sgn(extra)}` : ""})${tk.difficulty ? ` ${sgn(tk.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (tk.difficulty || 0)}</b></div>`,
    lines: [outcome.combinedLine],
    rv, rerollNote, critLine: outcome.critLine,
    sections: [body, outcome.extendedLine, outcome.opposedLine]
  }, [roll]);
}

// ── Удержание в седле ─────────────────────────────────────────────────────

/** Виды теста удержания: чем считается порог и как он подписан. */
const SADDLE_KINDS = {
  agility:    { label: "Ловкость (A)",   char: "ag" },
  acrobatics: { label: "Акробатика",     skill: "acrobatics", char: "ag" },
  control:    { label: "Навык управления", control: true }
};

/** Кнопка «удержаться в седле» в карточке — тест идёт от актора всадника. */
function saddleButton(rider, kind, mod, reason) {
  return `
    <div class="roll-defense-section">
      <div class="roll-section-head">Удержаться в седле <span class="roll-head-hint">— ${esc(reason)}</span></div>
      <div class="roll-defense-btns">
        <button class="wh-saddle-btn" type="button" data-actor-uuid="${rider.uuid}"
          data-kind="${kind}" data-mod="${mod ?? 0}" data-reason="${esc(reason)}">
          ${SADDLE_KINDS[kind]?.label || "Тест"} ${sgn(mod ?? 0)}
        </button>
      </div>
    </div>`;
}

/**
 * Тест удержания в седле. Провал — выпадение: урон падения и «лежит».
 * Талант «Опытный Всадник» даёт переброс — карточка предлагает его кнопкой,
 * а не бросает сама: переброс всегда выбор игрока. Это отдельная, книжная
 * возможность («Опытный Всадник»), а не общий Кубик — тест ей не пользуется:
 * маленький DialogV2 перед броском предлагает Вид теста/Сложность/Кубик,
 * как у остальных верховых тестов; булев `reroll` (переброс Опытного Всадника)
 * — параметр самой функции, не путать с объектом Кубика внутри `tk`.
 */
export async function saddleTest(rider, { kind = "agility", mod = 0, reason = "", reroll = false } = {}) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, control, speedKey } = ctx;
  const def = SADDLE_KINDS[kind] || SADDLE_KINDS.agility;

  let base, label;
  if (def.control) {
    base = control.value;
    label = control.label;
  } else if (def.skill) {
    const chars = rider.system.characteristics ?? {};
    const rank = rider.system.skills?.[def.skill]?.rank ?? "untrained";
    base = (Number(chars[def.char]?.total) || 0) + (SKILL_RANKS[rank]?.bonus ?? -20);
    label = def.label;
  } else {
    base = Number(rider.system.characteristics?.[def.char]?.total) || 0;
    label = def.label;
  }

  // «Сращивание» одержимого скакуна: +5×W.b демона именно на эти тесты.
  const splice = spliceBonus(mount);
  const baseEff = base + Number(mod) + splice;

  const tk = await foundry.applications.api.DialogV2.wait({
    window: { title: "Удержаться в седле" },
    classes: ["wh-roll-dialog-window"],
    position: { width: 340 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>Удержаться в седле</span></div>
        <div class="roll-dlg-row"><label>${label}:</label><span>${baseEff}</span></div>
        ${reason ? `<div class="roll-dlg-note">${esc(reason)}</div>` : ""}
        ${testKindHtml({ defaultKind: "base", label: "Удержаться в седле" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </div>`,
    buttons: [
      {
        action: "roll", icon: "fas fa-dice-d10", label: "Тест!", default: true,
        callback: (event, button) => {
          const val = sel => button.form.querySelector(sel)?.value ?? null;
          const t = readTestKind(val, { label: "Удержаться в седле" });
          t.reroll = mergeReroll(null, readDiceChoice(val));
          return t;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => wireTestKindLive(dialog.element, {
      actor: rider, label: "Удержаться в седле",
      getBaseEff: () => baseEff + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
    }),
    rejectClose: false
  });
  if (!tk) return;

  const { roll, rv, rerollNote, outcome } = await rollWithKind(rider, baseEff, tk, { actor: rider, kind: "skill" });
  const { success: passed, deg } = outcome;

  const skilled = hasTalent(rider, "Skilled Rider", "Опытный Всадник");
  const rerollBtn = !passed && skilled && !reroll
    ? `<div class="roll-defense-btns"><button class="wh-saddle-reroll-btn" type="button"
         data-actor-uuid="${rider.uuid}" data-kind="${kind}" data-mod="${mod}" data-reason="${esc(reason)}">
         Опытный Всадник — перебросить</button></div>`
    : "";

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Удержался в седле.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Выпадает из седла!</span></div>
       ${rerollBtn}
       ${fallSection(rider, mount, speedKey)}`;

  await postCard(rider, {
    icon: rollIcon("warn", "#ffb84d"),
    title: `Удержаться в седле${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">${label} <b>${base}</b> ${sgn(Number(mod) + splice)}
      ${splice ? `(Сращивание +${splice}) ` : ""}${tk.difficulty ? ` ${sgn(tk.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (tk.difficulty || 0)}</b></div>`,
    lines: [
      outcome.combinedLine,
      reason ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Причина: ${esc(reason)}</div>` : ""
    ],
    rv, rerollNote, critLine: outcome.critLine,
    sections: [body, outcome.extendedLine, outcome.opposedLine]
  }, [roll]);
}

/** Блок выпадения: высота, формула урона и кнопка применения к всаднику. */
function fallSection(rider, mount, speedKey) {
  const fall = fallFromSaddle(speedKey, mount);
  const skilled = hasTalent(rider, "Skilled Rider", "Опытный Всадник");
  return `
    <div class="roll-damage-section">
      <div class="roll-damage-label">${rollIcon("blood", "#ff6b6b")}Падение:
        <b>${fall.formula}</b>${fall.height ? ` — как с высоты ${fall.height} м (${MOUNT_SPEEDS[speedKey].label}, SPD ${mountSpd(mount)})` : ""}</div>
      ${fall.note ? `<div class="roll-defense-note">${fall.note}</div>` : ""}
      <button class="wh-saddle-fall-btn" type="button" data-actor-uuid="${rider.uuid}"
        data-formula="${fall.formula}" data-height="${fall.height}">
        Бросить урон падения и лечь
      </button>
      ${skilled ? `<div class="roll-defense-note">Опытный Всадник: можно пройти ${
        isBike(mount) ? "Operate(А)+10" : "Survival(А)+10"}, чтобы спрыгнуть на ноги без урона.</div>` : ""}
    </div>`;
}

/** Урон падения плюс состояние «лежит»: выпавший из седла оказывается на земле. */
export async function applyFall(rider, formula) {
  const roll = await new Roll(formula || "1d10").evaluate();
  await rider.update(conditionApplyFields("prone"));
  // Строка броска здесь своя: это не бросок теста (Порога нет), а формула
  // урона падения — «1d10+2: 9», а не «Бросок: 9».
  await postCard(rider, {
    icon: rollIcon("blood", "#ff6b6b"), title: `Выпал из седла — ${esc(rider.name)}`,
    lines: [`<div class="roll-dice">${rollIcon("dice", "#6fe6ff")}${formula}: <b>${roll.total}</b></div>`],
    sections: [`
    <div class="roll-damage-section">
      <div class="roll-damage-label">Урон падения — поглощается как обычно</div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${roll.total}" data-penetration="0" data-damage-type="impact"
        data-hit-location="Торс" data-weapon-name="Падение из седла" data-attacker="—"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0">
        Применить урон падения: <b>${roll.total}</b>
      </button>
    </div>`,
      `<div class="roll-allout-note">Персонаж лежит на земле.</div>`]
  }, [roll]);
}

/**
 * Скакуна тряхнуло: Критический Эффект, сбит с ног, умер (байк — сломан) или,
 * с Чертой Unruly, просто получил непоглощённый урон. Всадник проходит
 * Acrobatics с поправкой по скорости — иначе вылетает из седла.
 */
export async function showMountDamageTest(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const unruly = "unruly" in ctx.traits;
  const mod = acrobaticsStayMod(ctx.speedKey);
  await saddleTest(rider, {
    kind: "acrobatics", mod,
    reason: unruly
      ? "Непослушный скакун — непоглощённый урон"
      : "Скакун получил Крит. Эффект, сбит с ног или погиб"
  });
}

// ── Уклонение верхом (стр. 478) ───────────────────────────────────────────

/**
 * Уклонение верхом устроено по-разному, смотря по кому попадание:
 *  • по скакуну — комбинированный тест, к Уклонению добавляется Навык
 *    управления (Survival+0 или Operate−10), и провал любой половины валит всё;
 *  • по всаднику — обычное Уклонение, но со штрафом −10.
 * Поэтому диалог сначала спрашивает, куда пришлось попадание.
 */
export async function showMountedDodgeDialog(rider, extraMod = 0, hitsCount = 1, attackerUuid = "") {
  const ctx = await mountContext(rider);
  if (!ctx) return null;
  const { mount, control } = ctx;
  const controlMod = testMod(STAY_MOD, mount);

  return new Promise(resolve => {
    new Dialog({
      title: `Уклонение верхом — ${rider.name}`,
      content: `
        <form class="wh-vehicle-dialog" style="padding:6px;">
          <div class="atk-dlg-row"><label>Попадание пришлось:</label>
            <select id="md-target">
              <option value="mount">По скакуну — комбинированное с ${control.label} ${sgn(controlMod)}</option>
              <option value="rider">По всаднику — обычное, но −10</option>
            </select>
          </div>
          <div class="atk-range-info" style="font-size:0.82em;">
            Не-Избирательные атаки бьют по скакуну; попаданием по всаднику считается дубль на броске атаки.
            Атаки по скакуну всадник может и Парировать, как если бы били по нему самому.
          </div>
        </form>`,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Уклонение!",
          callback: async html => {
            const target = html.find("#md-target").val();
            await resolveMountedDodge(rider, ctx, target, extraMod, hitsCount, attackerUuid);
            resolve(true);
          } },
        cancel: { label: "Отмена", callback: () => resolve(false) }
      },
      default: "roll"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
  });
}

async function resolveMountedDodge(rider, ctx, target, extraMod, hitsCount = 1, attackerUuid = "") {
  // Уклонение — Реакция (стр. 12) и верхом тоже: та же трата, что в
  // _performDodge, иначе конный всадник уклонялся бы бесплатно без лимита.
  if (!(await spendReaction(rider, { forDefense: true }))) return _noReactionCard(rider, "Уклонение");
  const { mount, control } = ctx;
  const chars = rider.system.characteristics ?? {};
  const rank = rider.system.skills?.dodge?.rank ?? "untrained";
  const dodgeBase = (Number(chars.ag?.total) || 0) + (SKILL_RANKS[rank]?.bonus ?? -20);

  const riderHit = target === "rider";
  const dodgeMod = riderHit ? -10 : 0;
  const dodgeThreshold = dodgeBase + dodgeMod + extraMod;

  const { roll: dodgeRoll, rv: dodgeRv, passed: dodgePassed, deg: dodgeDeg, critLine } = await rollAgainst(dodgeThreshold);
  const rolls = [dodgeRoll];

  // Комбинированный тест: вторая половина — Навык управления. Обе должны
  // пройти, а степенями считается меньшая из двух — как у любого совместного
  // теста в системе.
  let ctrlPart = null;
  if (!riderHit) {
    const ctrlThreshold = control.value + testMod(STAY_MOD, mount);
    const res = await rollAgainst(ctrlThreshold);
    rolls.push(res.roll);
    ctrlPart = { ...res, threshold: ctrlThreshold };
  }

  const passed = dodgePassed && (!ctrlPart || ctrlPart.passed);
  const deg = ctrlPart && passed ? Math.min(dodgeDeg, ctrlPart.deg) : dodgeDeg;
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  // Излишек Успехов — банкуется на попадания ДРУГИХ атак того же противника
  // в этом Ходу (стр. 12, module/combat/evasion-pool.mjs). Пеналти — extraMod
  // (мод. приёма атаки), а не внутренний −10 «по всаднику»: тот не от атаки.
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(rider, attackerUuid, leftover, extraMod);

  let outcome;
  if (!passed) {
    outcome = `<span class="roll-failure">Уклонение провалено${
      ctrlPart && !ctrlPart.passed && dodgePassed ? " — подвёл сам скакун" : ""} — ${
      totalHits > 1 ? `все ${totalHits} ${_hitWord(totalHits)} проходят.` : "попадание проходит."}</span>`;
  } else if (remaining === 0) {
    outcome = `<span class="roll-success">Уклонение успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}!</span>`;
  } else {
    outcome = `<span class="roll-failure">${rollIcon("warn", "#ffb84d")}Уклонение успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

  // Броски здесь показаны внутри строк Порога (у теста их два — Уклонение и
  // Навык управления), поэтому отдельной строки «Бросок» у карточки нет.
  await postCard(rider, {
    icon: rollIcon("run"), title: `Уклонение верхом — ${esc(rider.name)}`,
    threshold: `<div class="roll-threshold">Цель попадания: <b>${riderHit ? "всадник" : esc(mount.name)}</b></div>`,
    lines: [
      `<div class="roll-threshold">Уклонение <b>${dodgeBase}</b> ${sgn(dodgeMod + extraMod)} → Порог <b>${dodgeThreshold}</b>
      · 1d100: <b>${dodgeRv}</b> — ${dodgePassed ? "успех" : "провал"}</div>`,
      ctrlPart ? `<div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(testMod(STAY_MOD, mount))}
      → Порог <b>${ctrlPart.threshold}</b> · 1d100: <b>${ctrlPart.rv}</b> — ${ctrlPart.passed ? "успех" : "провал"}</div>` : ""
    ],
    critLine, outcome,
    sections: [leftoverNote]
  }, rolls);
}

// ── Куда пришлось попадание ───────────────────────────────────────────────

/**
 * Разбор не-Избирательного попадания по паре: обычно бьёт скакуна, дубль —
 * всадника, а Черта Stand делит по чётности. Бросок атаки вводится вручную:
 * карточка атаки не знает, верхом ли цель, — цель выбирается уже после броска.
 */
/**
 * Считает, куда пришлось попадание (по броску атаки), и постит карточку —
 * общая логика для ручного диалога и кнопки «Определить» прямо в карточке
 * атаки (wdbc-7as8, бросок уже известен — передаётся, не перепечатывается).
 */
export async function resolveHitAllocation(rider, rv) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, traits } = ctx;
  rv = parseInt(rv) || 0;
  const target = hitTarget(rv, mount, { traits, rider });
  const toRider = target === "rider";
  // «Бросок атаки» — чужой бросок, разбираемый этой карточкой, а не свой:
  // строка своя, а не общая «Бросок».
  await postCard(rider, {
    icon: rollIcon("target", "#8fd0ff"), title: `Попадание верхом — ${esc(rider.name)}`,
    lines: [`<div class="roll-dice">Бросок атаки: <b>${rv}</b></div>`],
    outcome: `<span class="${toRider ? "roll-failure" : "roll-success"}">
      Попадание по ${toRider ? "ВСАДНИКУ" : `скакуну — ${esc(mount.name)}`}.</span>`,
    sections: [
      `<div class="roll-defense-note">Уклонение: ${toRider
        ? "обычное, со штрафом −10."
        : `комбинированное с ${ctx.control.label} ${sgn(testMod(STAY_MOD, mount))}; можно и Парировать.`}</div>`,
      `<div class="roll-defense-note">Избирательные атаки: по всаднику
      <b>${sgn(mountSelectiveMod("rider", mount))}</b>${
        mountSelectiveMod("rider", mount) === SELECTIVE_MODS.riderCovered ? " (Укрытие)" : ""
      }, по скакуну <b>${sgn(mountSelectiveMod("mount", mount))}</b>.</div>`
    ]
  });
}

/** Ручной диалог (fallback без карточки под рукой) — тот же расчёт, что и кнопка. */
export async function showHitAllocationDialog(rider, defaultRv = 0) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const stand = "stand" in ctx.traits;

  new Dialog({
    title: `Попадание верхом — ${rider.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Бросок атаки:</label><input id="ha-roll" type="number" value="${parseInt(defaultRv) || 0}" min="1" max="100"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          ${stand
            ? "Стойка: чётный результат — по всаднику, нечётный — по скакуну."
            : "Дубль (11, 22 … 99) — по всаднику, любой другой результат — по скакуну."}
        </div>
      </form>`,
    buttons: {
      ok: { icon: '<i class="fas fa-crosshairs"></i>', label: "Определить",
        callback: html => resolveHitAllocation(rider, html.find("#ha-roll").val()) },
      cancel: { label: "Отмена" }
    },
    default: "ok"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

// ── Ремонт байка (стр. 478) ───────────────────────────────────────────────

/**
 * Ремонт байка идёт не как у большой техники (та чинится по своей таблице
 * условий и темпа, combat/vehicle.mjs): у байка это смена работы и один тест
 * Tech-Use — −20 повреждённому, −40 сломанному, по 1 Структуры за Успех.
 * Провал ремонта СЛОМАННОГО байка означает, что остов годится только на лом.
 */
export async function showBikeRepairDialog(bikeActor) {
  if (!isBike(bikeActor)) return ui.notifications.warn("⚠️ Это не байк.");
  const s = bikeActor.system.structure ?? {};
  const broken = (Number(s.value) || 0) <= 0 && (Number(s.critical) || 0) > 0;
  const mode = broken ? BIKE_REPAIR.broken : BIKE_REPAIR.damaged;

  new Dialog({
    title: `Ремонт байка — ${bikeActor.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(bikeActor.name)}</span>
          <span style="opacity:.7">${broken ? "— сломан" : `— Структура ${s.value ?? 0}/${s.max ?? 0}`}</span></div>
        <div class="atk-dlg-row"><label>Tech-Use (итог):</label><input id="br-skill" type="number" value="30"/></div>
        <div class="atk-dlg-row"><label>Ремонт:</label><span>${sgn(mode.mod)} — ${mode.label}</span></div>
        <div class="atk-dlg-row"><label>Подходящие детали:</label>
          <select id="br-parts"><option value="0">Нет</option><option value="${BIKE_REPAIR.partsBonus}">Есть (+${BIKE_REPAIR.partsBonus})</option></select></div>
        <div class="atk-dlg-row"><label>Инструменты и пр.:</label><input id="br-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Требуется смена работы. Каждый Успех — +${mode.perSuccess} Структуры.
          ${broken ? "<b>Провал: остов годится только на лом — новый байк сделать легче, чем починить этот.</b>" : ""}
        </div>
        ${testKindHtml({ defaultKind: "base", label: "Ремонт байка" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-wrench"></i>', label: "Ремонт!",
        callback: async html => {
          const val = valOf(html);
          const skill = parseInt(html.find("#br-skill").val()) || 0;
          const parts = parseInt(html.find("#br-parts").val()) || 0;
          const extra = parseInt(html.find("#br-mod").val()) || 0;
          const tk = readTestKind(val, { label: "Ремонт байка" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          await resolveBikeRepair(bikeActor, { skill, parts, extra, mode, broken, tk });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      const root = html[0];
      const { updateAutoOutcomeNote } = wireTestKindLive(root, {
        actor: bikeActor, label: "Ремонт байка",
        getBaseEff: () => {
          const skill = parseInt(root.querySelector("#br-skill")?.value) || 0;
          const parts = parseInt(root.querySelector("#br-parts")?.value) || 0;
          const extra = parseInt(root.querySelector("#br-mod")?.value) || 0;
          return skill + mode.mod + parts + extra;
        }
      });
      root.querySelectorAll("#br-skill, #br-parts, #br-mod").forEach(el => el.addEventListener("input", updateAutoOutcomeNote));
    }
  }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
}

async function resolveBikeRepair(bikeActor, { skill, parts, extra, mode, broken, tk = { kind: "base", difficulty: 0 } }) {
  const total = mode.mod + parts + extra;
  const baseEff = skill + total;
  const { roll, rv, rerollNote, outcome } = await rollWithKind(bikeActor, baseEff, tk, { actor: bikeActor, kind: "skill", skill: "techUse" });
  const { success: passed, deg } = outcome;

  const s = bikeActor.system.structure ?? {};
  const max = Number(s.max) || 0;
  let body;

  if (passed) {
    const gain = deg * mode.perSuccess;
    let crit = Number(s.critical) || 0;
    let val  = Number(s.value) || 0;
    let left = gain;
    if (crit > 0) { const take = Math.min(crit, left); crit -= take; left -= take; }
    if (left > 0) val = Math.min(max, val + left);
    await bikeActor.update({ "system.structure.value": val, "system.structure.critical": crit });
    body = `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Восстановлено <b>+${gain}</b> Структуры.</span></div>
      <div class="roll-damage-meta">Структура: <b>${s.value ?? 0}${s.critical ? `/крит ${s.critical}` : ""}</b> → <b>${val}${crit ? `/крит ${crit}` : ""}</b>${max ? ` (макс. ${max})` : ""}</div>`;
  } else {
    body = `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}.</span></div>
      ${broken && mode.failScraps
        ? `<div class="roll-allout-note">Остов байка годится только на лом — сделать новый легче, чем починить этот.</div>`
        : `<div class="roll-allout-note">Структура не восстановлена. Попытку можно повторить, потратив ещё смену работы.</div>`}`;
  }

  await postCard(bikeActor, {
    icon: rollIcon("wrench", "#c9b08a"),
    title: `Ремонт байка${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(bikeActor.name)}`,
    threshold: `<div class="roll-threshold">Tech-Use <b>${skill}</b> ${sgn(total)} (ремонт ${sgn(mode.mod)}${parts ? `, детали +${parts}` : ""}${extra ? `, мод ${sgn(extra)}` : ""})${tk.difficulty ? ` ${sgn(tk.difficulty)} (📊 Сложность)` : ""} → Порог <b>${baseEff + (tk.difficulty || 0)}</b></div>`,
    lines: [outcome.combinedLine],
    rv, rerollNote, critLine: outcome.critLine,
    sections: [body, outcome.extendedLine, outcome.opposedLine]
  }, [roll]);
}
