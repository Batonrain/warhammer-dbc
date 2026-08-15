// module/sheets/attack-dialog.mjs
//
// Диалог атаки: собирает выбор игрока — режим огня, прицеливание, ситуативные
// модификаторы, условные эффекты боеприпаса и галочки правил — в один порог
// теста и отдаёт его конвейеру броска (module/combat/attack.mjs).
//
// Сам диалог ничего не решает про урон и попадание: он показывает, из чего
// сложился порог, и следит, чтобы показанное число совпадало с брошенным.
// Функции принимают актора, а не лист, поэтому проверяются без Foundry.
//
// Хват и профиль оружия выбираются в HUD (флаги предмета) — здесь только
// применяются молча и попадают в сводку окна (стр. 39, 207-221).

import { CHARACTERISTICS }                    from "../constants/characteristics.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }       from "../constants/items.mjs";
import { MELEE_STANCES, GRIPS, parseGrips, gripEffects } from "../constants/combat.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { rollIcon }                           from "../constants/roll-icons.mjs";
import { qualityEffects }                     from "../constants/quality.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, esc } from "../helpers/utils.mjs";
import { _executeAttackRoll }                 from "../combat/attack.mjs";
import { attackThreshold }                    from "../combat/attack-threshold.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../combat/weapon-mods.mjs";
import { hasRuleFlag }                        from "../rules/flags.mjs";
import { ruleRollModsHtml }                   from "../rules/roll-mods.mjs";
import { fatiguePenalty }                     from "./tabs/conditions.mjs";

export async function showAttackDialog(actor, item, techniqueOpts = {}) {
  const sys     = item.system;
  // forceMelee: стрелковое оружие используется как рукопашное (приклад/в упор,
  // стр. 40) — тест по WS, рукопашные режимы/модификаторы.
  const forceMelee = !!techniqueOpts.forceMelee;
  const isMelee = sys.weaponClass === "melee" || sys.weaponClass === "thrown" || forceMelee;
  const charKey = isMelee ? "ws" : "bs";

  // ── Хват и профиль выбираются в HUD (флаги оружия) или передаются в opts ──
  //   Здесь применяются молча: пилюль выбора в окне атаки больше нет (стр. 39, 207-221).
  const gripList  = isMelee ? parseGrips(sys.grips) : [];
  const primGrip  = gripList[0] || "";
  const gripKey   = techniqueOpts.gripKey
                 ?? item.getFlag?.("warhammer-dbc", "hudGrip")
                 ?? primGrip;
  const gripDef   = GRIPS[gripKey] ? gripEffects(gripKey, gripKey !== primGrip) : null;
  const atkProfiles = Array.isArray(sys.profiles) ? sys.profiles : [];
  let   profIdx   = techniqueOpts.profileIdx;
  if (profIdx === undefined || profIdx === null) profIdx = item.getFlag?.("warhammer-dbc", "hudProfile");
  profIdx = Number.isFinite(Number(profIdx)) ? Number(profIdx) : -1;
  const atkProfile  = (profIdx >= 0) ? (atkProfiles[profIdx] || null) : null;
  const gripWs      = gripDef ? gripDef.ws : 0;
  const attackNote  = [
    atkProfile ? `Профиль: ${atkProfile.label || "доп."}${atkProfile.damage ? ` (${atkProfile.damage})` : ""}` : "",
    gripDef ? `Хват: ${gripDef.label}${gripDef.ws ? ` · WS ${gripDef.ws >= 0 ? "+" : ""}${gripDef.ws}` : ""}${gripDef.dmgFlat ? ` · урон ${gripDef.dmgFlat >= 0 ? "+" : ""}${gripDef.dmgFlat}` : ""}${gripDef.sbHalf ? " · ½S.b" : ""} — ${gripDef.note}` : ""
  ].filter(Boolean).join("<br>");

  // ── Особые свойства оружия (+ модификации + боеприпас) ───────────────────
  const modFx       = getModEffects(actor, item);
  const _entries    = mergeWeaponPropEntries(item, modFx);
  // Свойства заряженного боеприпаса (стр. 203) — чтобы порог и памятки в
  // диалоге совпадали с тем, что реально применит бросок.
  {
    const _ammo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
    for (const p of (_ammo?.system?.properties || [])) {
      const key = typeof p === "string" ? p : p.key;
      if (!key || _entries.some(x => x.key === key)) continue;
      _entries.push({ key,
        rating:  typeof p === "string" ? 0 : (p.rating  || 0),
        rating2: typeof p === "string" ? 0 : (p.rating2 || 0) });
    }
  }
  const wProps      = resolveWeaponPropsList(_entries);
  const wp           = aggregateAuto(wProps);
  // Качество: рукопашное даёт мод на тесты с оружием (Poor −10 / Good +5 / Best +10)
  const qTestMod     = isMelee ? (qualityEffects(item).auto.testMod || 0) : 0;
  const wpAttackMod  = (wp.attackMod || 0) + (modFx.attackMod || 0) + qTestMod;
  const wantShortBox = !isMelee && (wp.meltaShort || wp.scatter);
  const wantMaximal  = !isMelee && wp.maximal;

  // ── Правила из реестра (module/rules/) ───────────────────────────────────
  //   Атака — такой же тест конвейера, как бросок навыка: вид теста «attack»,
  //   область эффекта «attack» или «weapon:<класс>». Актор цели нужен
  //   правилам, чей отбор зависит от того, по кому бьют (targetHasTrait).
  const attackCtx = {
    kind: "attack",
    weaponClass: sys.weaponClass,
    isMelee,
    char: charKey,
    targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null
  };
  const ruleMods = ruleRollModsHtml(actor, attackCtx);

  const stance      = actor.system.meleeStance || "standard";
  const stanceDef   = MELEE_STANCES[stance];
  const stanceBonus = isMelee ? (stanceDef?.wsBonus ?? 0) : 0;

  const currentAiming = actor.system.aiming || "none";
  const aimingBonus   = currentAiming === "half" ? 10 : currentAiming === "full" ? 20 : 0;
  const aimingLabel   = currentAiming === "half"
    ? "Полу-прицеливание (+10)"
    : currentAiming === "full" ? "Полное прицеливание (+20)" : "";

  const loadedAmmo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
  const ammoSys    = loadedAmmo?.system;
  const ammoAtkMod = ammoSys?.attackMod ?? 0;

  const techBonus = techniqueOpts.extraBonus ?? 0;
  const charBase  = (actor.system.characteristics[charKey]?.total ?? 0) + (sys.attackBonus || 0) + wpAttackMod + gripWs;
  const charVal   = charBase + techBonus + stanceBonus + (wp.noAim ? 0 : aimingBonus) + ammoAtkMod;

  // Штраф усталости (мод препаратов уже учтён в char.total)
  const hasFatigue = (actor.system.fatigue?.value ?? 0) >= 1;

  const rofModes = [];
  if (isMelee) {
    rofModes.push({ value: "melee",  label: "Рукопашная атака (±0)",      bonus: 0  });
    rofModes.push({ value: "charge", label: "Натиск (+20, движение ≥4м)", bonus: 20 });
  } else {
    if (sys.rof_single > 0)
      rofModes.push({ value: "single", label: "Одиночный выстрел (+10)", bonus: 10 });
    if (sys.rof_semi > 0)
      rofModes.push({ value: "semi",   label: `Короткая очередь (±0, ${sys.rof_semi} выстр.)`,  bonus: 0   });
    if (sys.rof_full > 0)
      rofModes.push({ value: "full",   label: `Длинная очередь (−10, ${sys.rof_full} выстр.)`,  bonus: -10 });
    if (sys.rof_semi > 0 || sys.rof_full > 0)
      rofModes.push({ value: "suppression", label: "Стрельба на подавление (−20)", bonus: -20 });
  }

  const rofHtml = rofModes.map((m, i) =>
    `<label class="atk-rof-label">
      <input type="radio" name="atk-rof" value="${m.value}"
             data-bonus="${m.bonus}" ${i === 0 ? "checked" : ""}/>
      <span>${m.label}</span>
     </label>`
  ).join("");

  // Точное (Precise): −20 к штрафу Избирательных по сочленениям и глазам
  const csMod = wp.calledShotMod || 0;
  let aimTargets = [
    { value: "",       label: "— Без прицела —",      penalty:   0 },
    { value: "torso",  label: "Торс (−10)",            penalty: -10 },
    { value: "leg",    label: "Нога (−15)",             penalty: -15 },
    { value: "arm",    label: "Рука (−20)",             penalty: -20 },
    { value: "head",   label: "Голова (−20)",           penalty: -20 },
    { value: "joint",  label: "Сочленение/Шея",         penalty: -40, precise: true },
    { value: "eye",    label: "Глаз",                   penalty: -50, precise: true }
  ];
  // Неточное / Взрывное (Imprecise): нельзя делать Избирательные попадания
  if (wp.noCalledShot) aimTargets = [aimTargets[0]];
  const aimHtml = aimTargets.map(t => {
    const pen = (t.precise && csMod) ? Math.min(0, t.penalty + csMod) : t.penalty;
    const lbl = t.value && !t.label.includes("(")
      ? `${t.label} (${pen})`
      : t.label;
    return `<option value="${t.value}" data-penalty="${pen}">${lbl}</option>`;
  }).join("");

  let rangeInfoHtml = "";
  if (!isMelee && sys.range > 0) {
    const rng     = sys.range;
    const rngMult = ammoSys?.rangeMultiplier ?? 1;
    const rngAdd  = ammoSys?.rangeMod ?? 0;
    const effRng  = Math.round(rng * rngMult) + rngAdd;
    rangeInfoHtml = `
      <div class="atk-range-info">
        <div class="atk-range-title">
          📏 Дистанции (Rng = ${rng}м${rngMult !== 1 ? ` ×${rngMult}` : ""}${rngAdd !== 0 ? ` ${rngAdd >= 0 ? "+" : ""}${rngAdd}м` : ""} = ${effRng}м)
        </div>
        <div class="atk-range-grid">
          <span class="atr-zone atr-pb">В упор: 0,5–3м → <b>+30</b></span>
          <span class="atr-zone atr-sh">Короткая: 3–${Math.ceil(effRng / 2)}м → <b>+10</b></span>
          <span class="atr-zone atr-cb">Боевая: ${Math.ceil(effRng / 2)}–${effRng}м → <b>±0</b></span>
          <span class="atr-zone atr-lg">Дальняя: ${effRng}–${effRng * 2}м → <b>−10</b></span>
          <span class="atr-zone atr-ex">Экстрем.: ${effRng * 2}–${effRng * 3}м → <b>−30</b></span>
        </div>
        <div class="atk-range-note" style="font-size:0.82em;opacity:0.8;">В ближнем бою — дистанция в упор, но модификатор ±0.</div>
      </div>`;
  }

  let ammoDialogHtml = "";
  if (!isMelee) {
    const magCur   = sys.magazineCur || 0;
    const magMax   = sys.magazineMax || 0;
    const magCls   = magCur === 0 ? "ammo-empty"
      : magCur <= Math.ceil(magMax * 0.25) ? "ammo-low" : "";
    const ammoMods = loadedAmmo ? _buildAmmoModString(ammoSys) : "";
    ammoDialogHtml = `
      <div class="atk-ammo-block">
        <span class="atk-ammo-label">${rollIcon("spark","#8fd0ff")}Боеприпасы:</span>
        <span class="atk-ammo-name">${loadedAmmo ? loadedAmmo.name : "стандартные"}</span>
        ${ammoMods ? `<span class="atk-ammo-mods">(${ammoMods})</span>` : ""}
        <span class="atk-ammo-mag ${magCls}">Магазин: <b>${magCur}/${magMax}</b></span>
      </div>`;
  }

  const aimingHtml = `
    <div class="atk-dlg-modifiers">
      <div class="atk-mods-title">Прицеливание</div>
      <div class="atk-aiming-block">
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="none" data-bonus="0"
                 ${currentAiming === "none" ? "checked" : ""}/>
          <span>Без прицеливания (±0)</span>
        </label>
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="half" data-bonus="10"
                 ${currentAiming === "half" ? "checked" : ""}/>
          <span>Полу-прицеливание (+10)</span>
        </label>
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="full" data-bonus="20"
                 ${currentAiming === "full" ? "checked" : ""}/>
          <span>Полное прицеливание (+20)</span>
        </label>
      </div>
    </div>`;

  const commonMods = [
    { label: "Усталость",     value: -10, autoCheck: hasFatigue },
    { label: "Слабый свет",   value: -10 },
    { label: "Дым / туман",   value: isMelee ? -10 : -20 },
    { label: "Тьма",          value: isMelee ? -20 : -30 },
    { label: "Ослеплён",      value: isMelee ? -30 : -99, autofail: !isMelee },
    { label: "Цель лежит",    value: isMelee ?  20 : -20 },
    { label: "Цель бежит",    value: isMelee ?  20 : -20 },
    { label: "Цель Оглушена", value: 20 },
    { label: "Цель Врасплох", value: 30 },
    { label: "Скрытая атака", value: 30, note: "цель не знает" }
  ];
  const specificMods = isMelee ? [
    { label: "Трудный ландшафт",       value: -10 },
    { label: "Очень трудный ландшафт", value: -20 },
    { label: "Числ. перевес 2к1",      value:  10 },
    { label: "Числ. перевес 3к1",      value:  20 },
    { label: "Положение выше",         value:  10 },
    { label: "Более длинное оружие",   value:   5 },
    { label: "Бой несколькими руками", value: -20, note: "осн./неосн. рука" }
  ] : [
    { label: "Подавлен огнём",          value: -20 },
    { label: "Стрельба в рукопашную",   value: -20 },
    { label: "Дистанция в упор",        value:  30 },
    { label: "Короткая дистанция",      value:  10 },
    { label: "Боевая дистанция",        value:   0 },
    { label: "Дальняя дистанция",       value: -10 },
    { label: "Экстремальная дистанция", value: -30 }
  ];

  const makeMods = arr => arr.map(m => {
    const isAF      = m.autofail === true;
    const isChecked = m.autoCheck === true;
    const dispVal   = isAF ? "провал" : (m.value >= 0 ? `+${m.value}` : `${m.value}`);
    const note      = m.note ? ` [${m.note}]` : "";
    return `<label class="attack-mod-check${isChecked ? " atk-mod-auto" : ""}">
      <input type="checkbox" class="atk-mod-cb"
             data-value="${isAF ? 0 : m.value}"
             ${isAF    ? 'data-autofail="true"' : ""}
             ${isChecked ? "checked" : ""}/>
      <span>${m.label} (${dispVal})${note}${isChecked ? " 😓" : ""}</span>
    </label>`;
  }).join("");

  const extraHtml = `
    <div class="atk-dlg-modifiers">
      <div class="atk-mods-title">Дополнительно</div>
      <div class="atk-mods-list atk-mods-col1">
        <label class="attack-mod-check">
          <input type="checkbox" id="atk-swift"/>
          <span>Стремительная атака (+10, −10 за доп. атаку)</span>
        </label>
        <label class="attack-mod-check">
          <input type="checkbox" id="atk-lightning"/>
          <span>Молниеносная атака (+10, −20 за доп. атаку)</span>
        </label>
        <label class="attack-mod-check">
          <input type="checkbox" id="atk-allout"/>
          <span>Атака всем телом (+20, теряет Уклонение)</span>
        </label>
      </div>
    </div>`;

  const stanceBonusNote = (isMelee && stanceBonus !== 0)
    ? `<span class="atk-stance-badge">${rollIcon("sword")}Стойка: ${stanceBonus >= 0 ? "+" : ""}${stanceBonus}</span>`
    : "";
  const ammoBadge = (!isMelee && ammoAtkMod !== 0)
    ? `<span class="atk-ammo-badge">${rollIcon("spark","#8fd0ff")}Боеприпасы: ${ammoAtkMod >= 0 ? "+" : ""}${ammoAtkMod}</span>`
    : "";

  // ── Условные модификаторы боеприпаса (стр. 203) ──────────────────────────
  // «+10 против целей с душами», «+30 против псайкеров и демонов» и т.п.
  // Безусловно применять нельзя (зависит от цели), поэтому даём галочки —
  // и НЕ прячем в свёрнутый блок: их легко упустить, а они крупные.
  const ammoConds = (!isMelee && Array.isArray(ammoSys?.condMods)) ? ammoSys.condMods : [];
  const ammoCondHtml = ammoConds.length ? `
      <div class="av-ammo-cond">
        <div class="av-sec-lbl">${rollIcon("spark","#8fd0ff")}Боеприпас: ${esc(loadedAmmo?.name || "")}</div>
        ${ammoConds.map((c, i) => {
          const parts = [];
          if (c.atk) parts.push(`${c.atk > 0 ? "+" : ""}${c.atk}`);
          if (c.dmg) parts.push(`${c.dmg > 0 ? "+" : ""}${c.dmg} урона`);
          for (const k of (c.wp || [])) parts.push(WEAPON_PROPERTIES[k]?.label || k);
          const val = parts.length ? `<span class="avc-val">${parts.join(", ")}</span>` : "";
          const note = c.note ? `<span class="avc-note">${esc(c.note)}</span>` : "";
          // Пункты без числовых эффектов — просто памятка, без галочки.
          const isNote = !c.atk && !c.dmg && !(c.wp || []).length;
          return isNote
            ? `<div class="avc-row avc-row-note">${esc(c.label)} ${note}</div>`
            : `<label class="avc-row"><input type="checkbox" class="atk-ammo-cond"
                 data-idx="${i}" data-atk="${c.atk || 0}"/>
                 <span class="avc-lbl">${esc(c.label)}</span> ${val} ${note}</label>`;
        }).join("")}
      </div>` : "";
  const fatigueBadge = hasFatigue
    ? `<span class="atk-fatigue-badge">${rollIcon("warn","#ffb84d")}−10</span>`
    : "";
  // Бейдж препарата: показываем, если активные препараты меняют выбранную характеристику
  const drugCharMod  = actor.system.drugCharMods?.[charKey] ?? 0;
  const drugAtkBadge = drugCharMod !== 0
    ? `<span class="atk-drug-badge" title="Уже учтено в пороге">💊 ${drugCharMod > 0 ? "+" : ""}${drugCharMod}</span>`
    : "";

  // Свойства оружия — напоминание + чекбокс короткой дистанции + перезарядка
  const wpDialogList = wProps.map(p => {
    const r = p.def.rating ? ` (${p.rating ?? 0}${p.def.rating2 ? "/" + (p.rating2 ?? 0) : ""})` : "";
    const tip = esc(p.def.desc);
    return `<span class="atk-wprop-badge" title="${tip}">${p.def.label}${r}</span>`;
  }).join("");
  const wpDialogHtml = wProps.length ? `
    <div class="atk-dlg-modifiers">
      <div class="atk-mods-title">${rollIcon("gear","#8fd0ff")}Свойства оружия</div>
      <div class="atk-wprops-list">${wpDialogList}</div>
    </div>` : "";
  const shortRangeHtml = wantShortBox ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-shortrange" class="atk-mod-cb" data-value="${wp.scatter ? 10 : 0}"/>
      <span>${rollIcon("target","#4dffa6")}Короткая дистанция / в упор${wp.meltaShort ? " — Мельта ×2 Проб." : ""}${wp.scatter ? " — Рассеив. +10/+1d10" : ""}</span>
    </label>` : "";
  // Полосы дальности: у оружия свой список бонусов по дистанции (стр. 193-197).
  const bands = Array.isArray(sys.rangeBands) ? sys.rangeBands : [];
  const bandHtml = bands.length ? `
    <label class="attack-mod-check attack-mod-select">
      <span>${rollIcon("target", "#8fd0ff")}Дистанция</span>
      <select id="atk-band">
        <option value="-1">Обычная — без бонусов</option>
        ${bands.map((b, i) => {
          const bits = [];
          if (b.dice) bits.push(`+${b.dice}d10 урона`);
          if (b.dmg)  bits.push(`+${b.dmg} урона`);
          if (b.pen)  bits.push(`+${b.pen} Проб.`);
          return `<option value="${i}">${b.label}${bits.length ? " — " + bits.join(", ") : ""}</option>`;
        }).join("")}
      </select>
    </label>` : "";
  // Выключенное оружие (стр. 209-211): цепное/шоковое/силовое можно погасить
  // свободным действием, и полем Haywire — принудительно.
  const OFF_HINT = { chain: "−2 урона, −1 Проб., без Рвущего",
                     shock: "как примитивное, −2 урона",
                     power: sys.offProfile?.name ? `как «${sys.offProfile.name}»` : "как примитивное" };
  const canOff  = ["chain", "shock", "power"].includes(sys.weaponType);
  const offHtml = (isMelee && canOff) ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-weaponoff"/>
      <span>${rollIcon("bolt", "#ff9d4d")}Оружие выключено / подавлено ЭМИ — ${OFF_HINT[sys.weaponType]}</span>
    </label>` : "";
  const maximalHtml = wantMaximal ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-maximal"/>
      <span>${rollIcon("bolt","#ffb84d")}Максимальный режим (+1d10 урона, +2 Проб., Взрыв(2), ×2 расход, Перезарядка)</span>
    </label>` : "";
  const rechargeWarnHtml = (!isMelee && sys.needsRecharge)
    ? `<div class="atk-recharge-warn">${rollIcon("bolt","#6fe6ff")}Оружие на подзарядке — стрельба раз в 2 хода.</div>`
    : "";

  // Режим атаки и прицеливание — компактными пилюлями (радио под ними).
  const rofPills = rofModes.map((mm, i) =>
    `<label class="av-pill"><input type="radio" name="atk-rof" value="${mm.value}" data-bonus="${mm.bonus}" ${i === 0 ? "checked" : ""}/><span>${mm.label}</span></label>`
  ).join("");
  const aimingPills = [["none", 0, "Без прицела"], ["half", 10, "Полу +10"], ["full", 20, "Полное +20"]].map(([v, bon, lbl]) =>
    `<label class="av-pill"><input type="radio" name="atk-aiming" value="${v}" data-bonus="${bon}" ${currentAiming === v ? "checked" : ""}/><span>${lbl}</span></label>`
  ).join("");

  // Хват и профиль выбираются в HUD; здесь — только компактная сводка (read-only).
  // Показываем, если выбран доп. профиль, у хвата есть эффект, или хватов несколько.
  const gripHasEffect = gripDef && (gripDef.ws || gripDef.dmgFlat || (gripDef.addProps?.length) || gripDef.sbHalf);
  const gripProfileNote = (atkProfile || gripHasEffect || gripList.length > 1) ? `
      <div class="av-gripnote">${rollIcon("sword","#6fe6ff")}${attackNote}</div>` : "";

  const content = `
    <form class="wh-attack-form wh-atk-v2">
      ${techniqueOpts.techniqueLabel ? `
      <div class="atk-technique-note">
        ${rollIcon("sword")}Приём: <b>${techniqueOpts.techniqueLabel}</b>
        ${techniqueOpts.stanceLabel ? ` | Стойка: <b>${techniqueOpts.stanceLabel}</b>` : ""}
        ${techniqueOpts.techniqueNote ? `<div class="atk-technique-desc">${techniqueOpts.techniqueNote}</div>` : ""}
        ${techniqueOpts.chatNote ? `<div class="atk-technique-chatnote">${techniqueOpts.chatNote}</div>` : ""}
      </div>` : ""}

      <div class="av-header">
        <span class="av-name">${item.name}</span>
        <span class="av-class">${forceMelee ? "в упор / приклад" : (WEAPON_CLASSES[sys.weaponClass] || "")}</span>
        <span class="av-badges">${stanceBonusNote}${ammoBadge}${fatigueBadge}${drugAtkBadge}</span>
      </div>

      <div class="av-preview">
        <div class="av-prev-lbl">Итоговый порог теста</div>
        <div class="av-prev-total" id="atk-total-display">${charVal}</div>
        <input id="atk-threshold" type="hidden" value="${charVal}"/>
      </div>

      ${ammoDialogHtml}${rechargeWarnHtml}${wpDialogHtml}

      <div class="av-row">
        <label>Характеристика</label>
        <select id="atk-char" class="av-input">
          ${Object.entries(CHARACTERISTICS).map(([k, m]) => {
            const v = actor.system.characteristics[k]?.total ?? 0;
            return `<option value="${k}" ${k === charKey ? "selected" : ""}>${m.abbr} (${v})</option>`;
          }).join("")}
        </select>
        <label>Доп. мод</label>
        <input id="atk-modifier" class="av-input av-num" type="number" value="0"/>
      </div>

      ${gripProfileNote}
      <div class="av-section">
        <div class="av-sec-lbl">Режим атаки</div>
        <div class="av-pills">${rofPills}</div>
      </div>
      <div class="av-section">
        <div class="av-sec-lbl">Прицеливание</div>
        <div class="av-pills">${aimingPills}</div>
      </div>

      <div class="av-row">
        <label>Прицельно в…</label>
        <select id="atk-aim" class="av-input av-wide">${aimHtml}</select>
      </div>

      ${rangeInfoHtml}
      ${shortRangeHtml}${bandHtml}${offHtml}${maximalHtml}
      ${ammoCondHtml}
      ${ruleMods.html}

      <details class="av-adv">
        <summary>Ситуативные модификаторы<span class="av-adv-hint">— разверни, если нужны</span></summary>
        <div class="av-mod-block">
          <div class="av-mod-head">Общие</div>
          <div class="av-mod-grid">${makeMods(commonMods)}</div>
        </div>
        <div class="av-mod-block">
          <div class="av-mod-head">${isMelee ? "Рукопашные" : "Стрелковые"}</div>
          <div class="av-mod-grid">${makeMods(specificMods)}</div>
        </div>
        <div class="av-mod-block">
          <div class="av-mod-head">Особые атаки</div>
          <div class="av-mod-col">
            <label class="attack-mod-check"><input type="checkbox" id="atk-swift"/><span>Стремительная атака (+10, −10 за доп. атаку)</span></label>
            <label class="attack-mod-check"><input type="checkbox" id="atk-lightning"/><span>Молниеносная атака (+10, −20 за доп. атаку)</span></label>
            <label class="attack-mod-check"><input type="checkbox" id="atk-allout"/><span>Атака всем телом (+20, теряет Уклонение)</span></label>
          </div>
        </div>
      </details>
    </form>`;

  return new Promise(resolve => {
    let resolved = false;
    let autoFail = false;

    const dialog = new Dialog({
      title: `Атака: ${item.name}`,
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
          callback: async html => {
            if (resolved) return;
            resolved = true;

            if (autoFail) {
              await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<div class="wh-roll-result">
                  <div class="roll-header">${rollIcon("sword")}${item.name}</div>
                  <div class="roll-outcome">
                    <span class="roll-failure">Автоматический провал (Ослеплён)</span>
                  </div></div>`
              });
              resolve(null); return;
            }

            const selectedChar = html.find("#atk-char").val();
            const threshold    = parseInt(html.find("#atk-threshold").val()) || 0;
            const modifier     = parseInt(html.find("#atk-modifier").val())  || 0;
            const rofMode      = html.find("input[name='atk-rof']:checked").val() || rofModes[0]?.value;
            const rofBonus     = parseInt(html.find("input[name='atk-rof']:checked").data("bonus")) || 0;
            const aimVal       = html.find("#atk-aim").val();
            const aimPenalty   = parseInt(html.find("#atk-aim option:selected").data("penalty")) || 0;
            const aimTarget    = aimTargets.find(t => t.value === aimVal);
            const newAiming    = html.find("input[name='atk-aiming']:checked").val() || "none";

            let modSum = 0;
            html.find(".atk-mod-cb:not([data-autofail]):checked").each((_, cb) => {
              modSum += parseInt($(cb).data("value")) || 0;
            });
            // Отмеченные условные эффекты боеприпаса (стр. 203): бонус к тесту
            // плюс урон и свойства, которые нужно передать в сам бросок.
            const ammoCondSel = [];
            html.find(".atk-ammo-cond:checked").each((_, cb) => {
              modSum += parseInt(cb.dataset.atk) || 0;
              const c = ammoConds[parseInt(cb.dataset.idx)];
              if (c) ammoCondSel.push(c);
            });
            const ammoCondDmg = ammoCondSel.reduce((n, c) => n + (c.dmg || 0), 0);
            const ammoCondProps = ammoCondSel.flatMap(c => c.wp || []);

            // Галочки от реестра правил — тот же формат, что у Особенностей
            // Происхождения и предметных rollMods в диалоге броска навыка.
            let halveRulePenalty = false;
            html.find(".rule-mod:checked").each((_, cb) => {
              modSum += parseInt(cb.dataset.value) || 0;
              if (cb.dataset.halve === "1") halveRulePenalty = true;
            });

            const isSwift     = html.find("#atk-swift").is(":checked");
            const isLightning = html.find("#atk-lightning").is(":checked");
            const isAllOut    = html.find("#atk-allout").is(":checked");
            const extraBonus  = (isSwift ? 10 : 0) + (isLightning ? 10 : 0) + (isAllOut ? 20 : 0);
            // Мод хвата (gripWs) уже вошёл в charBase/threshold; мод препаратов — в char.total.
            const finalThreshold = attackThreshold({
              base: threshold,
              mods: [modifier, modSum, rofBonus, aimPenalty, extraBonus],
              halvePenalty: halveRulePenalty
            });

            await actor.update({ "system.aiming": "none" });

            const shortRange = html.find("#atk-shortrange").is(":checked");
            const bandIdx    = Number(html.find("#atk-band").val() ?? -1);
            const weaponOff  = html.find("#atk-weaponoff").is(":checked");
            const maximal    = html.find("#atk-maximal").is(":checked");

            // Профиль атаки + хват выбраны в HUD (см. начало метода): применяем молча.
            await _executeAttackRoll(
              actor, item, selectedChar, finalThreshold, rofMode, aimTarget,
              {
                isSwift, isLightning, isAllOut,
                techniqueOpts,
                shortRange, maximal, bandIdx,
                profile: atkProfile, attackNote,
                weaponOff, gripKey,
                gripProps: gripDef ? gripDef.addProps : [],
                gripDmgFlat: gripDef ? gripDef.dmgFlat : 0,
                gripSbHalf: gripDef ? gripDef.sbHalf : false,
                // Условные эффекты боеприпаса, отмеченные игроком (стр. 203).
                ammoCondProps, ammoCondDmg,
                ammoCondLabels: ammoCondSel.map(c => c.label),
                aimingLabel: (newAiming !== "none" && !wp.noAim)
                  ? (newAiming === "half" ? "Полу-прицеливание (+10)" : "Полное прицеливание (+20)")
                  : ""
              }
            );
            resolve(true);
          }
        },
        cancel: {
          label: "Отмена",
          callback: () => { if (!resolved) { resolved = true; resolve(null); } }
        }
      },
      default: "roll",
      render: html => {
        const updateTotal = () => {
          autoFail = false;
          html.find(".atk-mod-cb[data-autofail='true']:checked").each(() => { autoFail = true; });
          if (autoFail) {
            html.find("#atk-total-display").text("ПРОВАЛ").css("color", "#8b0000");
            return;
          }
          const ck     = html.find("#atk-char").val();
          const base   = (actor.system.characteristics[ck]?.total ?? 0)
                         + (sys.attackBonus || 0) + wpAttackMod + techBonus + stanceBonus + ammoAtkMod + gripWs;
          const mod    = parseInt(html.find("#atk-modifier").val())  || 0;
          const rofBon = parseInt(html.find("input[name='atk-rof']:checked").data("bonus")) || 0;
          const aimPen = parseInt(html.find("#atk-aim option:selected").data("penalty"))    || 0;
          const aimBon = wp.noAim ? 0
                       : (parseInt(html.find("input[name='atk-aiming']:checked").data("bonus")) || 0);
          const extra  = (html.find("#atk-swift").is(":checked")     ? 10 : 0)
                       + (html.find("#atk-lightning").is(":checked") ? 10 : 0)
                       + (html.find("#atk-allout").is(":checked")    ? 20 : 0);
          let modsSit = 0;
          html.find(".atk-mod-cb:not([data-autofail]):checked").each((_, cb) => {
            modsSit += parseInt($(cb).data("value")) || 0;
          });
          // Условные модификаторы боеприпаса (стр. 203) — считаем отдельно,
          // чтобы сводка ситуативных не приписывала себе патронные бонусы.
          let modsAmmo = 0;
          html.find(".atk-ammo-cond:checked").each((_, cb) => {
            modsAmmo += parseInt(cb.dataset.atk) || 0;
          });
          // Правила реестра — считаем тем же кодом, что и сам бросок ниже:
          // иначе игрок увидит в окне одно число, а бросится другое.
          let modsRule = 0, halveRule = false;
          html.find(".rule-mod:checked").each((_, cb) => {
            modsRule += parseInt(cb.dataset.value) || 0;
            if (cb.dataset.halve === "1") halveRule = true;
          });
          const mods = modsSit + modsAmmo + modsRule;
          html.find("#atk-threshold").val(base + aimBon);
          html.find("#atk-total-display")
              .text(attackThreshold({
                base: base + aimBon,
                mods: [mod, mods, rofBon, aimPen, extra],
                halvePenalty: halveRule
              }))
              .css("color", "");
          // Блок ситуативных свёрнут по умолчанию, поэтому его сводка должна
          // быть видна в заголовке — иначе авто-отметки (Усталость, Ослеплён)
          // молча уходят в порог, и непонятно, откуда взялся модификатор.
          const picked = html.find(".atk-mod-cb:checked");
          const names  = picked.map((_, cb) =>
            ($(cb).closest("label").text() || "").trim().replace(/\s+/g, " ")).get();
          const $hint = html.find(".av-adv-hint");
          if (picked.length) {
            const sign = modsSit > 0 ? "+" : "";
            $hint.addClass("is-active")
                 .text(`— активно ${picked.length}${modsSit ? ` (${sign}${modsSit})` : ""}: ${names.join(", ")}`);
          } else {
            $hint.removeClass("is-active").text("— разверни, если нужны");
          }
        };
        html.find("#atk-char, #atk-aim").on("change", updateTotal);
        html.find("#atk-modifier").on("input", updateTotal);
        html.find(".atk-mod-cb, .atk-ammo-cond, .rule-mod, input[name='atk-rof'], input[name='atk-aiming'], #atk-swift, #atk-lightning, #atk-allout")
            .on("change", updateTotal);
        // Сворачивание «Ситуативные модификаторы» — подгоняем высоту окна.
        const el0 = html[0] ?? html;
        const det = el0?.querySelector(".av-adv");
        if (det) det.addEventListener("toggle", () => dialog.setPosition?.({ height: "auto" }));
        updateTotal();
      },
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, { classes: ["dialog","wh-attack-dialog","warhammer-dbc","wh-holo","wh-atk-dialog"], width: 420 });

    dialog.render(true);
  });
}

export async function showAttackDialogWithTechnique(actor, item, techDef, stanceDef, techKey) {
  await showAttackDialog(actor, item, {
    technique:      techKey,
    techniqueLabel: techDef.label,
    techniqueNote:  techDef.note,
    stanceLabel:    stanceDef?.label,
    chatNote:       techDef.chatNote,
    targetDodgeMod: techDef.targetDodgeMod ?? 0,
    targetParryMod: techDef.targetParryMod ?? 0,
    extraBonus:     techDef.wsBonus
  });
}

export async function showAttackDialogNoWeapon(actor, techDef) {
  const ws      = actor.system.characteristics.ws?.total ?? 0;
  const stance  = actor.system.meleeStance || "standard";
  const stBon   = MELEE_STANCES[stance]?.wsBonus ?? 0;
  const fatigue = fatiguePenalty(actor, "ws");
  // WS уже включает мод препаратов (см. prepareDerivedData)
  const final   = ws + techDef.wsBonus + stBon + fatigue;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const hit      = rv <= final;
  const deg      = hit
    ? Math.floor((final - rv) / 10) + 1
    : Math.floor((rv - final) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");
  const outcome  = hit
    ? `<span class="roll-success">Попадание — ${deg} ${_degWord(deg)}</span>`
    : `<span class="roll-failure">Промах — ${deg} ${_degWord(deg)}</span>`;

  const defButtons = hit ? `
    <div class="roll-defense-section">
      <div class="roll-defense-title">${rollIcon("shield","#4dffa6")}Защита цели (выберите токен защищающегося):</div>
      <div class="roll-defense-btns">
        <button class="wh-dodge-btn" type="button" data-extra-mod="0">Уклонение</button>
        <button class="wh-parry-btn" type="button" data-extra-mod="0">Парирование</button>
      </div>
    </div>` : "";

  // Урон безоружного удара (стр. 40): база I(Cr) +S.b; у Астартес — профиль
  // в квадратных скобках (например, кулак 1d5−3 → 1d10). Применяется через кнопку.
  const allRolls = [roll];
  let unarmedDmgSection = "";
  if (hit && techDef.damage) {
    const astartesProfile = hasRuleFlag(actor, "unarmed.astartesProfile");
    const dmgSrc = (astartesProfile && techDef.damageAstartes) ? techDef.damageAstartes : techDef.damage;
    const dmgFormula = resolveCharFormula(dmgSrc, actor.system.characteristics, actor.system.corruptionBonus ?? 0);
    try {
      const dmgRoll = await new Roll(dmgFormula).evaluate();
      allRolls.push(dmgRoll);
      const dtLabel = DAMAGE_TYPES[techDef.damageType] || techDef.damageType || "Ударный";
      unarmedDmgSection = `
        <div class="roll-damage-section">
          <div class="roll-damage-label">Урон (${dtLabel}, Проб. ${techDef.pen || 0})${astartesProfile ? " · профиль Астартес" : ""}: <b>${dmgRoll.total}</b>${techDef.props ? ` · ${techDef.props}` : ""}</div>
          <button class="wh-apply-dmg-btn" type="button"
            data-damage="${dmgRoll.total}" data-penetration="${techDef.pen || 0}"
            data-damage-type="${techDef.damageType || "impact"}" data-hit-location="Торс"
            data-primitive="1" data-weapon-name="${techDef.label}" data-attacker="${actor.name}">
            Применить урон: ${dmgRoll.total} → Торс
          </button>
        </div>`;
    } catch (e) { console.error("Безоружный урон:", e); }
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
          ${techDef.chatNote
            ? `<div class="roll-technique-note">${techDef.chatNote}</div>` : ""}
        </div>
        <div class="roll-header">${rollIcon("sword")}${techDef.label} ${techDef.headerSuffix ? `— ${techDef.headerSuffix}` : "(без оружия)"}</div>
        <div class="roll-threshold">
          WS: <b>${ws}</b>
          ${stBon !== 0 ? ` стойка ${stBon >= 0 ? "+" : ""}${stBon}` : ""}
          ${techDef.wsBonus !== 0 ? ` ${techDef.wsBonus >= 0 ? "+" : ""}${techDef.wsBonus}` : ""}
          ${fatigue !== 0 ? ` усталость ${fatigue}` : ""}
          → Порог: <b>${final}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
        ${unarmedDmgSection}
        ${defButtons}
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));
}
