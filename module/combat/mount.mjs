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
// ════════════════════════════════════════════════════════════════════════════

import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon }      from "../constants/roll-icons.mjs";
import { SKILL_RANKS }   from "../constants/characteristics.mjs";
import {
  MOUNT_SPEEDS, MOUNT_SKID, MOUNT_TERRAIN_MOD, STAY_MOD, BIKE_REPAIR, SELECTIVE_MODS,
  mountTraits, isBike, riderControl, testMod, turnOptions, skidInfo,
  fallFromSaddle, acrobaticsStayMod, spliceBonus, hasTalent, passengerCount,
  maneuverMods, hitTarget, mountSpd, mountRangedPenalty, mountSelectiveMod
} from "../rules/mount.mjs";

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

/** Один бросок d100 против порога: степени считаются как везде в системе. */
async function rollAgainst(threshold) {
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;
  return { roll, rv, passed, deg, critFail: rv >= 96 };
}

/** Список поправок в подпись порога: «навык +10, Манёвренный +20». */
const modLine = parts => parts.filter(p => p.value).map(p => `${p.label} ${sgn(p.value)}`).join(", ");

async function postCard(actor, html, rolls = []) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">${html}</div>`,
    ...(rolls.length ? { rolls, sound: CONFIG.sounds.dice } : {})
  }, game.settings.get("core", "rollMode")));
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
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Поворот!",
        callback: async html => {
          const idx = parseInt(html.find("#mt-angle").val()) || 0;
          const extra = parseInt(html.find("#mt-mod").val()) || 0;
          await resolveTurn(rider, ctx, turns, idx, extra);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

async function resolveTurn(rider, ctx, turns, idx, extraMod) {
  const option = turns.options[idx];
  const { control, speedKey } = ctx;

  if (!option.needsTest) {
    return postCard(rider, `
      <div class="roll-header">${rollIcon("run")}Поворот — ${esc(rider.name)}</div>
      <div class="roll-outcome"><span class="roll-success">Поворот на ${option.angle}° без теста${
        option.action === "half" ? " (полудействие)" : option.action === "free" ? " (свободное действие)" : ""}.</span></div>`);
  }

  const threshold = control.value + option.mod + extraMod;
  const { roll, rv, passed, deg } = await rollAgainst(threshold);

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Поворот на ${option.angle}°.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Поворот только на ${turns.fallbackAngle}°.</span></div>
       ${saddleButton(rider, "agility", option.riderMod, `неудачный поворот на ${option.angle}°`)}`;

  await postCard(rider, `
    <div class="roll-header">${rollIcon("run")}Поворот на ${option.angle}° — ${esc(rider.name)}</div>
    <div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(option.mod + extraMod)}
      (${MOUNT_SPEEDS[speedKey].label}${turns.manoeuvreParts.length ? `, ${modLine(turns.manoeuvreParts)}` : ""}) → Порог <b>${threshold}</b></div>
    ${control.combined ? `<div class="roll-defense-note">Навыком не владеет — по книге это комбинированный тест с основным действием.</div>` : ""}
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
    ${body}`, [roll]);
}

// ── Занос (стр. 477) ──────────────────────────────────────────────────────

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

  const threshold = control.value + info.mod;
  const { roll, rv, passed, deg } = await rollAgainst(threshold);

  const body = passed
    ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Поворот ещё на ${info.angle}°.</span></div>`
    : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Дополнительного поворота нет.</span></div>`;

  await postCard(rider, `
    <div class="roll-header">${rollIcon("burst", "#ff8a3a")}Занос — ${esc(rider.name)}</div>
    <div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(info.mod)}
      (Занос ${sgn(MOUNT_SKID.mod)}${info.manoeuvreParts.length ? `, ${modLine(info.manoeuvreParts)}` : ""}) → Порог <b>${threshold}</b></div>
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
    ${body}
    <div class="roll-allout-note">Независимо от исхода: −10 на все физические действия до начала следующего Хода.</div>`, [roll]);

  await rider.update({ "system.mount.skidUsed": true });
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
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const skill = parseInt(html.find("#mtt-skill").val()) || 0;
          const zone  = parseInt(html.find("#mtt-zone").val()) || 0;
          const extra = parseInt(html.find("#mtt-mod").val()) || 0;
          await resolveMountTerrain(rider, ctx, { skill, zone, extra, terrainMod });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
}

async function resolveMountTerrain(rider, ctx, { skill, zone, extra, terrainMod }) {
  const { mount, control } = ctx;
  const total = terrainMod + zone + extra;
  const threshold = skill + total;
  const { roll, rv, passed, deg } = await rollAgainst(threshold);

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

  await postCard(rider, `
    <div class="roll-header">${rollIcon("burst", "#b0a080")}Трудный Ландшафт верхом — ${esc(rider.name)}</div>
    <div class="roll-threshold">${control.label} <b>${skill}</b> ${sgn(total)}
      (верхом ${sgn(terrainMod)}${zone ? `, зона ${sgn(zone)}` : ""}${extra ? `, мод ${sgn(extra)}` : ""}) → Порог <b>${threshold}</b></div>
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
    ${body}`, [roll]);
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
 * а не бросает сама: переброс всегда выбор игрока.
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
  const threshold = base + Number(mod) + splice;
  const { roll, rv, passed, deg } = await rollAgainst(threshold);

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

  await postCard(rider, `
    <div class="roll-header">${rollIcon("warn", "#ffb84d")}Удержаться в седле — ${esc(rider.name)}</div>
    <div class="roll-threshold">${label} <b>${base}</b> ${sgn(Number(mod) + splice)}
      ${splice ? `(Сращивание +${splice}) ` : ""}→ Порог <b>${threshold}</b></div>
    ${reason ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Причина: ${esc(reason)}</div>` : ""}
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
    ${body}`, [roll]);
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
  await rider.update({ "system.conditions.prone": true });
  await postCard(rider, `
    <div class="roll-header">${rollIcon("blood", "#ff6b6b")}Выпал из седла — ${esc(rider.name)}</div>
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}${formula}: <b>${roll.total}</b></div>
    <div class="roll-damage-section">
      <div class="roll-damage-label">Урон падения — поглощается как обычно</div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${roll.total}" data-penetration="0" data-damage-type="impact"
        data-hit-location="Торс" data-weapon-name="Падение из седла" data-attacker="—"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0">
        Применить урон падения: <b>${roll.total}</b>
      </button>
    </div>
    <div class="roll-allout-note">Персонаж лежит на земле.</div>`, [roll]);
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
export async function showMountedDodgeDialog(rider, extraMod = 0, attackDeg = null) {
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
            await resolveMountedDodge(rider, ctx, target, extraMod, attackDeg);
            resolve(true);
          } },
        cancel: { label: "Отмена", callback: () => resolve(false) }
      },
      default: "roll"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
  });
}

async function resolveMountedDodge(rider, ctx, target, extraMod, attackDeg) {
  const { mount, control } = ctx;
  const chars = rider.system.characteristics ?? {};
  const rank = rider.system.skills?.dodge?.rank ?? "untrained";
  const dodgeBase = (Number(chars.ag?.total) || 0) + (SKILL_RANKS[rank]?.bonus ?? -20);

  const riderHit = target === "rider";
  const dodgeMod = riderHit ? -10 : 0;
  const dodgeThreshold = dodgeBase + dodgeMod + extraMod;

  const { roll: dodgeRoll, rv: dodgeRv, passed: dodgePassed, deg: dodgeDeg } = await rollAgainst(dodgeThreshold);
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
  const opposed = Number.isFinite(attackDeg);
  const evaded = passed && (!opposed || deg > attackDeg);

  let outcome;
  if (!passed) {
    outcome = `<span class="roll-failure">Уклонение провалено${
      ctrlPart && !ctrlPart.passed && dodgePassed ? " — подвёл сам скакун" : ""} — попадание проходит.</span>`;
  } else if (evaded) {
    outcome = `<span class="roll-success">Уклонение успешно — ${deg} ${_degWord(deg)}${opposed ? ` против ${attackDeg}` : ""}!</span>`;
  } else {
    outcome = `<span class="roll-failure">${rollIcon("warn", "#ffb84d")}Уклонение удалось (${deg} ${_degWord(deg)}), но атака сильнее (${attackDeg}).</span>`;
  }

  await postCard(rider, `
    <div class="roll-header">${rollIcon("run")}Уклонение верхом — ${esc(rider.name)}</div>
    <div class="roll-threshold">Цель попадания: <b>${riderHit ? "всадник" : esc(mount.name)}</b></div>
    <div class="roll-threshold">Уклонение <b>${dodgeBase}</b> ${sgn(dodgeMod + extraMod)} → Порог <b>${dodgeThreshold}</b>
      · 1d100: <b>${dodgeRv}</b> — ${dodgePassed ? "успех" : "провал"}</div>
    ${ctrlPart ? `<div class="roll-threshold">${control.label} <b>${control.value}</b> ${sgn(testMod(STAY_MOD, mount))}
      → Порог <b>${ctrlPart.threshold}</b> · 1d100: <b>${ctrlPart.rv}</b> — ${ctrlPart.passed ? "успех" : "провал"}</div>` : ""}
    ${opposed ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Встречная проверка — атака: <b>${attackDeg}</b> ${_degWord(attackDeg)}</div>` : ""}
    <div class="roll-outcome">${outcome}</div>`, rolls);
}

// ── Куда пришлось попадание ───────────────────────────────────────────────

/**
 * Разбор не-Избирательного попадания по паре: обычно бьёт скакуна, дубль —
 * всадника, а Черта Stand делит по чётности. Бросок атаки вводится вручную:
 * карточка атаки не знает, верхом ли цель, — цель выбирается уже после броска.
 */
export async function showHitAllocationDialog(rider) {
  const ctx = await mountContext(rider);
  if (!ctx) return;
  const { mount, traits } = ctx;
  const stand = "stand" in traits;

  new Dialog({
    title: `Попадание верхом — ${rider.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Бросок атаки:</label><input id="ha-roll" type="number" value="0" min="1" max="100"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          ${stand
            ? "Стойка: чётный результат — по всаднику, нечётный — по скакуну."
            : "Дубль (11, 22 … 99) — по всаднику, любой другой результат — по скакуну."}
        </div>
      </form>`,
    buttons: {
      ok: { icon: '<i class="fas fa-crosshairs"></i>', label: "Определить",
        callback: async html => {
          const rv = parseInt(html.find("#ha-roll").val()) || 0;
          const target = hitTarget(rv, mount, { traits, rider });
          const toRider = target === "rider";
          await postCard(rider, `
            <div class="roll-header">${rollIcon("target", "#8fd0ff")}Попадание верхом — ${esc(rider.name)}</div>
            <div class="roll-dice">Бросок атаки: <b>${rv}</b></div>
            <div class="roll-outcome"><span class="${toRider ? "roll-failure" : "roll-success"}">
              Попадание по ${toRider ? "ВСАДНИКУ" : `скакуну — ${esc(mount.name)}`}.</span></div>
            <div class="roll-defense-note">Уклонение: ${toRider
              ? "обычное, со штрафом −10."
              : `комбинированное с ${ctx.control.label} ${sgn(testMod(STAY_MOD, mount))}; можно и Парировать.`}</div>
            <div class="roll-defense-note">Избирательные атаки: по всаднику
              <b>${sgn(mountSelectiveMod("rider", mount))}</b>${
                mountSelectiveMod("rider", mount) === SELECTIVE_MODS.riderCovered ? " (Укрытие)" : ""
              }, по скакуну <b>${sgn(mountSelectiveMod("mount", mount))}</b>.</div>`);
        } },
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
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-wrench"></i>', label: "Ремонт!",
        callback: async html => {
          const skill = parseInt(html.find("#br-skill").val()) || 0;
          const parts = parseInt(html.find("#br-parts").val()) || 0;
          const extra = parseInt(html.find("#br-mod").val()) || 0;
          await resolveBikeRepair(bikeActor, { skill, parts, extra, mode, broken });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
}

async function resolveBikeRepair(bikeActor, { skill, parts, extra, mode, broken }) {
  const total = mode.mod + parts + extra;
  const threshold = skill + total;
  const { roll, rv, passed, deg } = await rollAgainst(threshold);

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

  await postCard(bikeActor, `
    <div class="roll-header">${rollIcon("wrench", "#c9b08a")}Ремонт байка — ${esc(bikeActor.name)}</div>
    <div class="roll-threshold">Tech-Use <b>${skill}</b> ${sgn(total)} (ремонт ${sgn(mode.mod)}${parts ? `, детали +${parts}` : ""}${extra ? `, мод ${sgn(extra)}` : ""}) → Порог <b>${threshold}</b></div>
    <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
    ${body}`, [roll]);
}

// ── Сводка для панели ─────────────────────────────────────────────────────

/**
 * Всё, что панель «ВЕРХОМ» показывает без броска: чем ведётся скакун, какие
 * штрафы уже висят, свободны ли руки, что доступно на этой скорости.
 */
export function mountSummary(rider, mount, actors = []) {
  const traits  = mountTraits(mount);
  const control = riderControl(rider, mount, traits);
  const speedKey = speedKeyOf(rider);
  const passengers = passengerCount(mount, actors);
  return {
    control, traits, speedKey, passengers,
    speedLabel: MOUNT_SPEEDS[speedKey].label,
    ranged: mountRangedPenalty(speedKey, mount),
    maneuver: maneuverMods(rider, mount, { passengers, traits }),
    skid: skidInfo(speedKey, rider, mount, { passengers, traits })
  };
}
