import { BODY_TYPES } from "../constants/body-map.mjs";
import { ELITE_ARCHETYPES } from "../constants/elite-archetypes.mjs";
import { isHaemonculus } from "../constants/haemonculus.mjs";
import { haemonculusContext, haemStep, haemToggleTrait,
         haemRank } from "./tabs/haemonculus.mjs";
import { openItemPicker, talentCategory } from "./item-picker.mjs";
import { openGearPicker } from "./gear-picker.mjs";
// module/sheets/actor-sheet.mjs

import { CHARACTERISTICS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { talentCostXP, aptitudeCat, charAptitudeSet,
         CHAR_APTITUDES, resolveTalentAptitudes } from "../constants/advancement.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { ITEM_TYPES, GEAR_ITEM_TYPES, WEAPON_CLASSES, DAMAGE_TYPES } from "../constants/items.mjs";
import { AZURIANE_PATHS, PATH_GRADES, PATH_GRADE_ORDER,
         buildPathSelectOptions, buildGradeSelectOptions } from "../constants/aeldari-paths.mjs";
import { buildWorldSelectOptions, buildBandSelectOptions,
         getWorld, getBand } from "../constants/aeldari-origins.mjs";
import { buildDrukhariFactionOptions, getDrukhariFaction,
         buildDrukhariDistrictOptions, getDrukhariDistrict } from "../constants/drukhari-factions.mjs";
import { buildMasqueOptions, getMasque } from "../constants/harlequin-masques.mjs";
import { MELEE_STANCES, MELEE_TECHNIQUES, GRIPS, parseGrips, gripEffects } from "../constants/combat.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, fateTerm,
         splitTopLevel } from "../helpers/utils.mjs";
import { showCreationWizard, ruSpec } from "../apps/creation.mjs";
import { buildSkillDisplay, buildGetData } from "./sheet-helpers.mjs";
import { _executeAttackRoll }              from "../combat/attack.mjs";
import { attackThreshold }                 from "../combat/attack-threshold.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { WEAPON_PROPERTIES } from "../constants/weapon-properties.mjs";
import { rollMutationOrGift, openMutationPicker } from "./tabs/mutations.mjs";
import { openFearDialog, rollTrauma, rollDisorder, createDisorderItem, openDisorderPicker,
         rollDisorderTest } from "./tabs/disorders.mjs";
import { fatiguePenalty, activateConditionsListeners } from "./tabs/conditions.mjs";
import { painChatMsg, painChange, openPainSoulBurnDialog } from "./tabs/pain.mjs";
import { showHealingDialog, applyHealing } from "./tabs/healing.mjs";
import { activateDrugListeners } from "./tabs/drugs.mjs";
import { activatePsychicListeners, activateNavigatorPower, executePsychotest,
         resolvePsyCastAttr, rollPsyWpTest, rollPsyniscience, showManifestDialog,
         wirePsyManifestPreview } from "./tabs/psychic.mjs";
import { activateTechListeners, activateTechMiracle, techGenResource } from "./tabs/tech.mjs";
import { activateGearListeners } from "./tabs/gear.mjs";
import { activateBodyListeners } from "./tabs/body.mjs";
import { activateAdvanceListeners, charImpCost as advCharImpCost,
         skillCumCost as advSkillCumCost } from "./tabs/advance.mjs";
import { activateItemContextMenu } from "./context-menu.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../combat/weapon-mods.mjs";
import { qualityEffects }                   from "../constants/quality.mjs";
import { _resolveSoulBurn }                 from "../hooks.mjs";
import { _performDodge, _performParry }    from "../combat/defense.mjs";
import { _showContestDialog }              from "../combat/techniques.mjs";
import { openRigManager }                   from "../apps/rig-manager.mjs";
import { infamyContext, changeInfamy, restoreInfamy, spendInfamy } from "../apps/infamy-points.mjs";
import { promptStatAdd } from "../apps/stat-log.mjs";
import { CHAOS_PATRONS, chaosPatronMeta } from "../constants/chaos-patron.mjs";
import { RACES, SUBRACES,
         RACE_GROUPS, AELDARI_RACES, AELDARI_PATHS } from "../constants/races.mjs";
import { getLegion, getChapter, resolveCulture } from "../constants/legions.mjs";
import { archetypeSheetContext, applyArchetype } from "../apps/archetypes.mjs";
import { TWIN_SPIRIT_DEMONS, twinSpiritMeta, manifestProfile,
         POSSESSION_GIFTS, POSSESSION_TALENTS } from "../constants/possession.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { beginTargeting } from "../combat/aim.mjs";
import { homeworldRollMods, matchesContext } from "../constants/homeworlds.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { specOptions, matchSpec, specDef } from "../constants/skill-specializations.mjs";
import { ASTARTES_IMPLANTS, ASTARTES_RACE,
         missingAstartesImplants } from "../constants/astartes-implants.mjs";
import { syncAstartesImplantWeapon } from "../apps/astartes-implants.mjs";
import { applyHomeworld, homeworldSheetContext, actorHomeworldKey } from "../apps/homeworlds.mjs";
import { applyDivination, divinationSheetContext } from "../apps/divinations.mjs";
import { HELMETLESS_FEL_BONUS, HELMETLESS_EFFECTS, HELMETLESS_ACTION } from "../constants/power-armour-lore.mjs";
import { isHelmetMod } from "../combat/armor-mods.mjs";
import { isFeatureEnabled, disabledRaceKeys } from "../constants/features.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";

// Псевдонимы коротких имён талантов из данных рас/архетипов → имена в библиотеке
// (по англ. части, в нижнем регистре). Покрывает расхождения «Minion» →
// «Minion of Chaos», дефисы, мн.ч. и опечатки.
const TALENT_ALIAS = {
  "minion":               "minion of chaos",
  "erudite infernal":     "erudite-infernal",
  "clues from the crowd": "clues from the crowds",
  "sure stitch":          "sure strike"
};
// Разделители вариантов выбора в данных: « или » и «/».
const TALENT_CHOICE_SEP = /\s+или\s+|\s*\/\s*/i;

export class WarhammerCharacterSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc","sheet","actor","character","wh-holo"],
      template: "systems/warhammer-dbc/templates/actor/character-sheet.hbs",
      width: 840, height: 920,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  _savedScrollTops = {};
  _geneSeedOpen = false;
  _combatCollapse = { stance: false, tech: false };
  // Свёрнутые категории вкладки снаряжения (ключ категории → свёрнута?).
  _gearCollapse = {};
  // Носители (оружие/броня), у которых свёрнут список установленных улучшений.
  _gearHostCollapse = new Set();
  _wizardPrompted = false;

  _saveScrollPositions() {
    if (!this.element?.length) return;
    this.element.find(".sheet-body, .skills-advance-scroll").each((i, el) => {
      this._savedScrollTops[i] = el.scrollTop;
    });
  }

  _restoreScrollPositions() {
    if (!this.element?.length) return;
    this.element.find(".sheet-body, .skills-advance-scroll").each((i, el) => {
      if (this._savedScrollTops[i] !== undefined) el.scrollTop = this._savedScrollTops[i];
    });
  }

  async render(force = false, options = {}) {
    this._saveScrollPositions();
    return super.render(force, options);
  }

  // Показать/скрыть под-строки установленных улучшений конкретного носителя
  // (оружия/брони) на вкладке снаряжения. Строки-описания при сворачивании
  // прячутся; при разворачивании остаются скрытыми (раскрываются кнопкой ▸).
  _applyGearHostCollapse(html, hid) {
    const collapsed = !!this._gearHostCollapse?.has(hid);
    html.find(`.gear-modsub-row[data-host-id="${hid}"]`).css("display", collapsed ? "none" : "");
    if (collapsed) html.find(`.ability-detail-row[data-host-id="${hid}"]`).css("display", "none");
    html.find(`.gear-mods-toggle[data-host-id="${hid}"]`).toggleClass("collapsed", collapsed);
  }

  // ── Одержимый: переключение Проявления (+ тест Cor+20 при входе) ───────────
  async _toggleManifest() {
    const sys = this.actor.system;
    const p   = sys.possession || {};
    const now = !p.manifested;
    const meta = twinSpiritMeta(p.demon || "katart");
    const updates = { "system.possession.manifested": now };

    if (now) {
      // Вход в Проявление — тест Cor+20; при Провале +1 Порчи.
      const cor    = sys.corruption?.value ?? 0;
      const target = Math.min(100, cor + 20);
      const roll   = await (new Roll("1d100")).evaluate();
      const success = roll.total <= target;
      if (!success) updates["system.corruption.value"] = Math.min(100, cor + 1);
      const body = `
        <div class="wh-poss-card" style="--gc:${meta.color}">
          <div class="wh-poss-card-h">⛧ ПРОЯВЛЕНИЕ — ${meta.label} (${meta.godLabel})</div>
          <div class="wh-poss-card-r">Тест Cor+20: <b>${roll.total}</b> против <b>${target}</b> —
            <span class="${success ? "ok" : "bad"}">${success ? "Успех" : "Провал: +1 Порчи"}</span></div>
          <div class="wh-poss-card-n">Демон перестраивает тело в боевую форму. Броня/одежда сплавляются с формой.</div>
        </div>`;
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: body });
    } else {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="wh-poss-card" style="--gc:${meta.color}"><div class="wh-poss-card-h">Демон заключён — смертная форма</div></div>`
      });
    }
    await this.actor.update(updates);
  }

  // ── getData ───────────────────────────────────────────────────────────────

  getData() {
    const context = super.getData();
    const system  = this.actor.system;

    Object.assign(context, buildGetData(this.actor));

    // ── Архетип (шапка): селектор из компендиума, только доступные текущей расе ──
    context.archetype = archetypeSheetContext(this.actor);

    // ── Бой: сворачиваемые Стойки/Приёмы + метки для свёрнутого заголовка ────
    context.combatStanceCollapsed = !!this._combatCollapse?.stance;
    context.combatTechCollapsed   = !!this._combatCollapse?.tech;

    // ── Снаряжение: сохранённое состояние сворачивания категорий ────────────
    context.gearCollapse = this._gearCollapse || {};
    const _STANCE_NAMES = { standard: "Стандартная", aggressive: "Агрессивная",
      defensive: "Защитная", covering: "Прикрывающая", springing: "Пружинящая", rapidstrike: "Частокол" };
    context.combatStanceLabel = _STANCE_NAMES[system.meleeStance] || "Стандартная";

    // ── Снаряжение: сенсор нагрузки (когитатор) ─────────────────────────────
    const _enc = system.encumbrance || {};
    const _encMax = Number(_enc.max) || 0, _encCur = Number(_enc.effectiveCurrent ?? _enc.current) || 0;
    const _pct = _encMax ? Math.round((_encCur / _encMax) * 100) : 0;
    context.encumbrancePct   = Math.max(0, Math.min(100, _pct));
    context.encumbranceOver  = _pct > 100;
    context.encumbranceLevel = _pct >= 100 ? "over" : _pct >= 66 ? "heavy" : "ok";

    // ── Показатели: сенсоры Порчи/Безумия (когитатор) ───────────────────────
    const _cor = system.corruption || {};
    const _corLimit = Number(_cor.limit) || 100;
    const _corPct = Math.round(((Number(_cor.value) || 0) / _corLimit) * 100);
    context.corruptionPct = Math.max(0, Math.min(100, _corPct));
    context.corruptionLevel = _corPct >= 80 ? "over" : _corPct >= 50 ? "heavy" : "ok";
    const _insPct = Math.round(Number(system.insanity?.value) || 0);
    context.insanityPct = Math.max(0, Math.min(100, _insPct));
    context.insanityLevel = _insPct >= 70 ? "over" : _insPct >= 40 ? "heavy" : "ok";

    // ── Прочие сенсоры (шапка + Развитие) ───────────────────────────────────
    const _xp = system.experience || {};
    const _xpTot = Number(_xp.total) || 0, _xpSpent = Number(_xp.spent) || 0;
    context.xpPct = _xpTot ? Math.max(0, Math.min(100, Math.round((_xpSpent / _xpTot) * 100))) : 0;
    // Очки Судьбы — пипсы
    const _fVal = Number(system.fate?.value) || 0, _fMax = Number(system.fate?.max) || 0;
    context.fatePips = Array.from({ length: Math.min(10, Math.max(0, _fMax)) }, (_, i) => ({ on: (i + 1) <= _fVal }));
    // Усталость — шкала
    const _fatVal = Number(system.fatigue?.value) || 0, _fatMax = Number(system.fatigue?.max) || 0;
    const _fatPct = _fatMax ? Math.round((_fatVal / _fatMax) * 100) : 0;
    context.fatiguePct = Math.max(0, Math.min(100, _fatPct));
    context.fatigueLevel = _fatPct >= 100 ? "over" : _fatPct >= 66 ? "heavy" : "ok";

    // Родные миры — опциональное расширение: дропдаун «Происхождение» в шапке.
    context.homeworld = homeworldSheetContext(this.actor);
    context.divination = divinationSheetContext(this.actor);

    // Снятый шлем: галочка показывается, только если снаряжение вообще даёт
    // ОБ на голову (т.е. на персонаже есть шлем).
    if (isFeatureEnabled("helmetless") && (system.gearHeadAP || 0) > 0) {
      // Системы, стоящие в шлеме: со снятым шлемом не работают, кроме вокс-линка.
      const helmetMods = this.actor.items.filter(i =>
        i.type === "armorMod" && i.system.modGroup === "helmet" && i.system.installedOn);
      context.helmetless = {
        on: !!system.helmetOff, headAP: system.gearHeadAP,
        effects: HELMETLESS_EFFECTS, action: HELMETLESS_ACTION,
        disabled: helmetMods.filter(isHelmetMod).map(i => i.name),
        kept:     helmetMods.filter(i => !isHelmetMod(i)).map(i => i.name)
      };
    } else context.helmetless = null;

    context.races = RACES;
    // Сгруппированный список рас для optgroup — расы выключенных подсистем
    // (напр. «Книга Эльдар») из списка убираем, кроме уже стоящей у этого
    // актора: так подсистему можно выключить, не сломав существующих
    // персонажей (та же логика, что и у disabledActorTypes()).
    const offRaces = disabledRaceKeys();
    context.raceGroups = RACE_GROUPS.map(g => ({
      label: g.label,
      races: g.races.filter(k => RACES[k] && (k === system.race || !offRaces.includes(k)))
        .map(k => ({ key: k, label: RACES[k].label }))
    })).filter(g => g.races.length);
    const currentRace = RACES[system.race];
    context.availableSubraces = currentRace?.subraces?.length
      ? currentRace.subraces.map(key => ({ key, label: SUBRACES[key] })) : [];
    context.hasSubraces = context.availableSubraces.length > 0;
    context.isAeldari = AELDARI_RACES.includes(system.race);
    context.isYnnari  = system.race === "ynnari";
    // Фактор Прибыли (Вольный Торговец): бонус = ФП ÷ 10 (как у характеристик)
    context.profitFactorBonus = Math.floor((Number(system.aspirations?.profitFactor) || 0) / 10);
    // Иннари: выбор «Прошлого» (бывшей расы) и её бонусы + Черты Иннари.
    context.ynnariPast      = system.ynnariPast || "";
    context.ynnariPastLabel = RACES[system.ynnariPast]?.label || "";
    context.ynnariPastOptions = (RACES.ynnari.pastRaces || [])
      .map(k => ({ key: k, label: RACES[k]?.label || k }));
    // Арлекин: выбор «Прошлого» (изначальной расы) и её бонусы + Черты Арлекина.
    context.isHarlequin        = system.race === "harlequin";
    context.harlequinPast      = system.harlequinPast || "";
    context.harlequinPastLabel = RACES[system.harlequinPast]?.label || "";
    context.harlequinPastOptions = (RACES.harlequin.pastRaces || [])
      .map(k => ({ key: k, label: RACES[k]?.label || k }));
    context.masqueOptions  = buildMasqueOptions(system.harlequinMasque || "");
    context.selectedMasque = getMasque(system.harlequinMasque || "");

    // Пути Аэльдари: для каждой строки — селект пути, селект градации,
    // полный текст выбранной градации и метка авто-бонусов.
    const pathRows = Array.isArray(system.paths) ? system.paths
      : (system.paths ? Object.values(system.paths) : []);
    context.charPaths = pathRows.map((row, idx) => {
      const key   = row.key || "";
      const grade = row.grade || "";
      const path  = AZURIANE_PATHS[key];
      const gradeIdx = PATH_GRADE_ORDER.indexOf(grade);
      // Градации КУМУЛЯТИВНЫ: показываем все достигнутые (Новичок..выбранная).
      const gradesShown = [];
      const cumChar = {};
      let cumCor = 0;
      if (path && gradeIdx >= 0) {
        for (let i = 0; i <= gradeIdx; i++) {
          const gk = PATH_GRADE_ORDER[i];
          const g  = path.grades?.[gk];
          if (!g) continue;
          gradesShown.push({ gradeLabel: PATH_GRADES[gk], desc: g.desc || "" });
          if (g.auto?.charBonus) {
            for (const [ck, cv] of Object.entries(g.auto.charBonus)) {
              cumChar[ck] = (cumChar[ck] || 0) + cv; // Unnatural суммируется по градациям
            }
          }
          if (g.auto?.corLimit) cumCor = Math.max(cumCor, g.auto.corLimit);
        }
      }
      const autoBits = [];
      for (const [ck, cv] of Object.entries(cumChar)) {
        const abbr = CHARACTERISTICS[ck]?.abbr || ck.toUpperCase();
        autoBits.push(`Unnatural ${abbr} (+${cv})`);
      }
      if (cumCor) autoBits.push(`+${cumCor} к лимиту Порчи`);
      return {
        idx,
        key, grade,
        pathOptions:  buildPathSelectOptions(key),
        gradeOptions: buildGradeSelectOptions(path, grade),
        label:        path?.label || "",
        group:        path?.group || "",
        gradesShown,
        autoLabel:    autoBits.join(", ")
      };
    });

    // Происхождение Аэльдари: Мир-Корабль и Корсарская Банда (вкладка Записи)
    // У Друкхари вместо этого — Кабал/Культ Ведьм/Ковен.
    context.isDrukhari     = system.race === "drukhari";
    context.showWorldOrigin = context.isAeldari && !context.isDrukhari;
    context.worldOptions   = buildWorldSelectOptions(system.world || "");
    context.bandOptions    = buildBandSelectOptions(system.band || "");
    context.selectedWorld  = getWorld(system.world || "");
    context.selectedBand   = getBand(system.band || "");
    context.drukhariFactionOptions = buildDrukhariFactionOptions(system.drukhariFaction || "");
    context.selectedDrukhariFaction = getDrukhariFaction(system.drukhariFaction || "");
    context.drukhariDistrictOptions = buildDrukhariDistrictOptions(system.drukhariDistrict || "");
    context.selectedDrukhariDistrict = getDrukhariDistrict(system.drukhariDistrict || "");

    // Телосложение: набор PNG-масок фигуры на вкладке «ТЕЛО». Есть у любого
    // персонажа, поэтому считается вне ветки хаоситов.
    context.bodyTypes = Object.entries(BODY_TYPES).map(([key, label]) =>
      ({ key, label, selected: (system.bodyType || "male") === key }));

    // ── Одержимый (DoomBC_Core 129-132): синергия хоста и Двойного Духа ──────
    context.isHeretic = system.alignment === "heretic";
    // ── Очки Бесчестия (корбук 438): доступны Хаоситам ─────────────────────
    if (context.isHeretic && this._infamyEnabled) {
      const ip = Math.max(0, Number(foundry.utils.getProperty(this.actor, this._infamyPath)) || 0);
      context.infamy = infamyContext(this.actor, this._infamyKey,
        { ip, ipMax: this._infamyMax, showCounter: this._infamyShowCounter });
      context.chaosPatron = chaosPatronMeta(this._infamyKey);
      context.chaosPatrons = CHAOS_PATRONS.map(p => ({ ...p, selected: p.key === this._infamyKey,
        favor: Number(foundry.utils.getProperty(this.actor, `system.patronFavor.${p.key}`)) || 0 }));
      // Селектор Бога в ЗАПИСЯХ — только там, где патрон не выбирается иначе.
      // У Демон-Принца патрон = «Патрон» в шапке (allegiance) → селектор скрыт.
      context.showPatronPicker = this._showPatronPicker;
    }
    // ── Гемункул: путь возвышения (стадии 0–5) и таблицы трейтов ──────────
    context.isHaemonculus = isHaemonculus(this.actor);
    if (context.isHaemonculus) context.haem = haemonculusContext(this.actor);

    context.possessed = context.isHeretic && !!system.possessed;
    if (context.possessed) {
      const p    = system.possession || {};
      const meta = twinSpiritMeta(p.demon || "katart");
      const cor  = system.corruption?.value ?? 0;
      const infB = system.characteristics?.inf?.bonus ?? 0;
      const corB = Math.floor(cor / 10);
      const prof = manifestProfile(cor);
      const sym  = Math.max(0, Math.min(5, Number(p.symbiosis) || 0));
      // Симбиоз ограничен min(Inf/15, Cor/15) окр.▼
      const symLimit = Math.max(0, Math.min(5, Math.floor(Math.min(cor, (system.characteristics?.inf?.total ?? 0)) / 15)));
      const wbDemon = Math.floor((p.demonWounds?.max ?? 0) / 10);
      // Активные Дары на акторе (предметы-таланты «Дар: …») и лимит по профилю.
      const activeGiftNames = this.actor.items
        .filter(i => i.type === "talent" && i.name.startsWith("Дар: "))
        .map(i => i.name.replace(/^Дар:\s*/, ""));
      const activeGiftSet = new Set(activeGiftNames);
      context.possession = {
        p, meta, cor, prof, sym, symLimit,
        demonOptions: TWIN_SPIRIT_DEMONS.map(d => ({ key: d.key, label: d.label, godLabel: (twinSpiritMeta(d.key).godLabel), selected: d.key === (p.demon || "katart") })),
        symOptions: [0,1,2,3,4,5].map(n => ({ n, selected: n === sym })),
        symPips: [1,2,3,4,5].map(n => ({ on: n <= sym, over: n > symLimit })),
        socialBonus: sym * 10,
        hostWBonus:  sym * 5,
        controlHours: Math.max(1, 10 - wbDemon),
        naturalArmour: corB,
        regen: Math.ceil(corB / 2),
        demonWShield: `1-${p.demonWounds?.max ?? 0}`,
        giftGroups: _groupGifts(activeGiftSet),
        // Таланты архетипа: только Неделимого + бога вселённого демона.
        talents: POSSESSION_TALENTS.filter(t => t.god === "Неделимый" || t.god === meta.godLabel),
        greaterPossessed: !!p.greaterPossessed,
        // Проявление: состояние и применённые авто-бонусы
        manifested: !!p.manifested,
        applied: (system.possessionActive?.applied) || [],
        activeGiftCount: activeGiftNames.length,
        giftLimit: prof.gifts,
        giftsOver: activeGiftNames.length > prof.gifts,
        // Руны True Tongue (генерируются в шаблоне; сюда — сид анимации по богу)
        runeSeed: (p.demon || "katart").length * 7 % 12
      };
    }

    const _charApts = charAptitudeSet(system.aptitudes);
    context.chars = Object.entries(CHARACTERISTICS).map(([key, meta]) => ({
      key,
      // Категория цены по склонностям (стр. 24) — для подсветки в «Развитии».
      aptCat:       aptitudeCat(_charApts, CHAR_APTITUDES[key] || []),
      label:        _charLabel(key, system.alignment),
      abbr:         meta.abbr,
      base:         system.characteristics[key]?.base         ?? 0,
      advance:      system.characteristics[key]?.advance      ?? 0,
      supernatural: system.characteristics[key]?.supernatural ?? 0,
      improvement:  system.characteristics[key]?.improvement  ?? "none",
      grantedImp:   system.characteristics[key]?.grantedImp   ?? "none",
      // Помечено ли улучшение как выданное архетипом/расой (кнопка ★).
      isGranted:   (system.characteristics[key]?.grantedImp ?? "none") !== "none",
      total:        system.characteristics[key]?.total        ?? 0,
      bonus:        system.characteristics[key]?.bonus        ?? 0,
      cost:         system.characteristics[key]?.cost         ?? 0,
      charDamage:   system.charDamage?.[key]                  ?? 0
    }));

    context.absorption = system.absorption || {
      head: 0, body: 0, leftArm: 0, rightArm: 0,
      leftLeg: 0, rightLeg: 0, toughnessBonus: 0,
      armorOnly: { head:0, body:0, leftArm:0, rightArm:0, leftLeg:0, rightLeg:0 }
    };

    context.fateLabel = fateTerm(system).plural;

    const tb = system.characteristics?.t?.bonus ?? 0;
    const wb = system.characteristics?.wp?.bonus ?? 0;
    const fatigueThreshold = tb + wb;
    context.fatigueThreshold = fatigueThreshold;
    context.fatigueValue     = system.fatigue?.value ?? 0;
    context.fatigueMax       = system.fatigue?.max   ?? fatigueThreshold;

    // Доп. AP против типов урона (от модификаций брони) — строка для боя
    const vs = system.absorption?.vsType || {};
    const vsLabels = { energy: "Энерг.", impact: "Удар.", rending: "Реж.", blast: "Взрыв." };
    context.armorVsTypeStr = Object.entries(vsLabels)
      .filter(([k]) => (vs[k] || 0) !== 0)
      .map(([k, l]) => `${l} +${vs[k]}`)
      .join(" · ");

    return context;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Штраф усталости для броска.
   * Освобождены: T, Inf, Cog
   */
  /**
   * Категория таланта для расчёта цены: раса может делать талант всегда
   * Дружественным (Total Recall у Астартес), иначе решает культура легиона.
   */
  _talentCat(name, folder = "") {
    return talentCategory(this.actor, name, folder);
  }

  /**
   * Снятый шлем силовой брони: +5 ко всем тестам на основе Товарищества.
   * Правило безусловное, поэтому применяется само, а не галочкой в диалоге.
   */
  _getHelmetlessBonus(charKey) {
    if (!this.actor.system.helmetlessActive) return 0;
    return (charKey ?? "").toLowerCase() === "fel" ? HELMETLESS_FEL_BONUS : 0;
  }

  _getFatiguePenalty(charKey) {
    return fatiguePenalty(this.actor, charKey);
  }

  /**
   * Определяет актора-цель для «Применить на другом».
   * Приоритет: нацеленные токены (target), иначе выделенные (controlled).
   * Токены самого применяющего исключаются. Требуется ровно одна цель.
   */
  _resolveOtherTargetActor() {
    const targets = [...(game.user.targets ?? [])];
    let candidates = targets.length ? targets : [...(canvas.tokens?.controlled ?? [])];
    candidates = candidates.filter(t => {
      const a = t.actor ?? t.document?.actor;
      return a && a.id !== this.actor.id;
    });

    if (candidates.length === 0) {
      ui.notifications.warn("🎯 Нацельтесь на токен цели (или выделите его), чтобы применить препарат на другом.");
      return null;
    }
    if (candidates.length > 1) {
      ui.notifications.warn("🎯 Выберите ровно одну цель (один нацеленный/выделенный токен).");
      return null;
    }
    const actor = candidates[0].actor ?? candidates[0].document?.actor;
    if (!actor) {
      ui.notifications.warn("Не удалось определить актора цели.");
      return null;
    }
    return actor;
  }

  // Модификаторы характеристик от препаратов теперь применяются централизованно
  // в WarhammerActor.prepareDerivedData() — они уже входят в char.total, поэтому
  // отдельно в бросках их прибавлять НЕ нужно (иначе двойной учёт).

  /**
   * Навешивает на корень листа классы темы: раса / мировоззрение / класс.
   * Используется CSS для акцентов и баннера (wh-align-*, wh-race-*, wh-class-*).
   */
  _applyThemeClasses() {
    const root = this.element;
    if (!root?.length) return;
    const sys = this.actor.system;
    const cls = sys.isTechpriest ? "techpriest" : (sys.isPsyker ? "psyker" : "adept");
    root.removeClass((i, c) => (c.match(/wh-(align|race|class)-\S+/g) || []).join(" "));
    root.addClass(`wh-align-${sys.alignment || "loyalist"} wh-race-${sys.race || "none"} wh-class-${cls}`);
  }

  /** Создаёт Черты из списка {name,benefit,rating,hasRating,effects}, пропуская существующие по имени. */
  async _createTraitsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const existing = new Set(this.actor.items.filter(i => i.type === "trait").map(i => i.name));
    const toCreate = list.filter(t => t?.name && !existing.has(t.name)).map(t => ({
      name: t.name,
      type: "trait",
      system: {
        benefit:   t.benefit || "",
        source,
        hasRating: t.hasRating || false,
        rating:    t.rating || 0,
        effects: { charBonusStat:"", charBonusValue:0, armourAll:0, fearRating:0, sizeMod:0, ...(t.effects || {}) }
      }
    }));
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    return toCreate.length;
  }

  /**
   * Создаёт Таланты по списку имён. Полное описание/уровень/Бог подтягивается из
   * библиотеки талантов по совпадению английской части имени; скобочная часть
   * («Resistance (Cold, Heat)») идёт в Специализацию. Дубликаты — по имени+спец.
   */
  async _createTalentsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const keyOf    = (n, s) => `${n}|${s || ""}`;
    const existing = new Set(this.actor.items.filter(i => i.type === "talent")
      .map(i => keyOf(i.name, i.system?.specialization)));
    let lib = [];
    try {
      const pack = game.packs.get("warhammer-dbc.talents");
      if (pack) lib = await pack.getDocuments();
    } catch(e) { /* библиотека недоступна — создадим заглушки */ }
    const norm  = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng = new Map();
    for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const toCreate = [];
    const seen = new Set();
    for (const raw of list) {
      if (!raw) continue;
      const m        = String(raw).match(/^([^(]+?)\s*(?:\(([^)]*)\))?\s*$/);
      const baseName = (m ? m[1] : raw).trim();
      const spec     = (m && m[2]) ? m[2].trim() : "";
      const hit      = byEng.get(norm(baseName)) || byEng.get(TALENT_ALIAS[norm(baseName)] || "\0");
      const fullName = hit ? hit.name : String(raw);
      const key      = keyOf(fullName, spec);
      if (existing.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (hit) {
        const sys = foundry.utils.deepClone(hit.system);
        if (spec) sys.specialization = spec;
        if (source) sys.notes = `Стартовый талант: ${source}`;
        toCreate.push({ name: fullName, type: "talent", img: hit.img, system: sys });
      } else {
        toCreate.push({ name: String(raw), type: "talent", system: {
          tier: 1, specialization: spec,
          benefit: source ? `Стартовый талант (${source}) — уточните выбор вручную.` : ""
        }});
      }
    }
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    return toCreate.length;
  }

  /**
   * Применяет стартовые таланты (список строк/строк-через-запятую). Записи-выборы
   * «X или Y» и «(любые N)» собираются в один диалог выбора; всё остальное
   * создаётся сразу. Возвращает число созданных талантов.
   */
  async _applyStartingTalents(rawList, source = "") {
    const entries = [];
    for (const r of (rawList || [])) for (const e of splitTopLevel(String(r))) entries.push(e);
    // Отсев «строительных» записей (не таланты): ассигнования опыта и счётчики
    // вида «1000 xp на Психосилы», «12 Талантов 1 уровня».
    const real = entries.filter(e => !/\d\s*(xp|хр)/i.test(e) && !/талант/i.test(e));
    if (!real.length) return 0;

    // Опции специализаций берём из библиотеки талантов.
    let lib = [];
    try { const p = game.packs.get("warhammer-dbc.talents"); if (p) lib = await p.getDocuments(); } catch(e) {}
    const norm   = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng  = new Map(); for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const find   = base => byEng.get(norm(base)) || byEng.get(TALENT_ALIAS[norm(base)] || "\0");
    // Перевод часто-английских специализаций (чувства, типы оружия, сопротивления…),
    // если компендиум ещё засеян по-английски.
    const optsOf = base => {
      const s = find(base)?.system?.specialization || "";
      if (!s || /люб|кажд|для каждого|организац/i.test(s)) return null;
      return s.split(",").map(x => ruSpec(x.trim())).filter(Boolean);
    };

    const fixed = [], choices = [];
    for (const e of real) {
      if (TALENT_CHOICE_SEP.test(e)) {
        choices.push({ type: "or", raw: e, options: e.split(TALENT_CHOICE_SEP).map(s => s.trim()).filter(Boolean) });
      } else {
        const m = e.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        if (m && /люб/i.test(m[2])) {
          const count = parseInt((m[2].match(/\d+/) || ["1"])[0], 10) || 1;
          choices.push({ type: "wild", raw: e, base: m[1].trim(), count, opts: optsOf(m[1].trim()) });
        } else fixed.push(e);
      }
    }

    // Локализатор: «English (спец.) — Русское» по данным компендиума талантов.
    const nameOf = raw => {
      const m = String(raw).match(/^(.*?)\s*(\([^)]*\))?\s*$/);
      const base = (m ? m[1] : raw).trim();
      const spec = m && m[2] ? " " + m[2] : "";
      const d = find(base);
      if (!d) return String(raw);
      const parts = String(d.name).split("/");
      const ru = parts.length > 1 ? parts[1].trim() : "";
      return ru ? `${base}${spec} — ${ru}` : `${base}${spec}`;
    };

    const chosen = await this._promptTalentChoices(choices, nameOf);
    return await this._createTalentsFromList([...fixed, ...chosen], source);
  }

  _openItemPicker(kind) {
    return openItemPicker(this.actor, kind);
  }

  /** Диалог выбора для «или»/«любые N». Резолвится массивом строк-имён талантов. */
  _promptTalentChoices(choices, nameOf = (s => String(s))) {
    if (!choices || !choices.length) return Promise.resolve([]);
    const esc = s => String(s).replace(/"/g, "&quot;");
    const rows = choices.map((c, i) => {
      if (c.type === "or") {
        const opts = c.options.map(o => `<option value="${esc(o)}">${esc(nameOf(o))}</option>`).join("");
        return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Выбор:</label><select class="wtc-sel" data-ci="${i}" data-cj="0">${opts}</select></div>`;
      }
      // wild
      let inputs = "";
      for (let j = 0; j < c.count; j++) {
        if (c.opts) {
          const opts = c.opts.map(o => `<option value="${esc(o)}">${o}</option>`).join("");
          inputs += `<select class="wtc-sel wtc-mini" data-ci="${i}" data-cj="${j}">${opts}</select>`;
        } else {
          inputs += `<input type="text" class="wtc-inp" data-ci="${i}" data-cj="${j}" placeholder="специализация"/>`;
        }
      }
      return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">${nameOf(c.base)} <span class="wtc-x">×${c.count}</span></label><div class="wtc-inputs">${inputs}</div></div>`;
    }).join("");

    return new Promise(resolve => {
      new Dialog({
        title: "Выбор стартовых талантов",
        content: `<form class="wh-talent-choices"><p class="wtc-hint">Уточните таланты-выборы:</p>${rows}</form>`,
        buttons: {
          ok: {
            label: "Применить",
            callback: html => {
              const result = [];
              html.find("[data-ci]").each((_, el) => {
                const c = choices[Number(el.dataset.ci)];
                const v = String(el.value || "").trim();
                if (!v) return;
                result.push(c.type === "wild" ? `${c.base} (${v})` : v);
              });
              resolve(result);
            }
          }
        },
        default: "ok",
        close: () => resolve([])
      }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-talent-dialog"], width: 480 }).render(true);
    });
  }


  _openGearPicker() {
    return openGearPicker(this.actor);
  }

  // ── Страх / Безумие ────────────────────────────────────────────────────

  /** Тест Страха → при провале таблица Шока (1d100 + 10×Провалы−1 − Infamy). */
  async _rollFear() {
    return openFearDialog(this.actor);
  }

  /** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. */
  async _rollTrauma() {
    return rollTrauma(this.actor);
  }

  /** Случайное Ментальное Расстройство (d100) — создаёт предмет и сообщает в чат. */
  async _rollDisorder() {
    return rollDisorder(this.actor);
  }

  /** Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени). */
  async _createDisorderItem(entry) {
    return createDisorderItem(this.actor, entry);
  }

  /**
   * Пикер ментальных расстройств (стр. 292) — в одном стиле с пикерами
   * талантов, черт и мутаций: поиск, диапазон d100, раскрытие описания
   * стрелкой, добавление по «＋» прямо из строки.
   */
  _addDisorderDialog() {
    return openDisorderPicker(this.actor);
  }

  /** Тест конкретного расстройства (W + его testMod). */
  async _rollDisorderTest(item) {
    return rollDisorderTest(this.actor, item);
  }

  /** Применяет расовые бонусы (характеристики только в пустые поля + расовые Черты). */
  async _applyRaceData(raceKey) {
    const race = RACES[raceKey];
    if (!race) return;
    const chars = this.actor.system.characteristics;
    const upd = {};
    for (const [k, v] of Object.entries(race.chars || {})) {
      if ((chars[k]?.base || 0) === 0) upd[`system.characteristics.${k}.base`] = v;
    }
    if (Object.keys(upd).length) await this.actor.update(upd);
    const n  = await this._createTraitsFromList(race.traits || [], race.label || raceKey);
    const nt = await this._applyStartingTalents(race.talents || [], race.label || raceKey);
    // Космодесантнику органы Геносемени положены по умолчанию.
    const ng = raceKey === ASTARTES_RACE ? await this._grantAstartesImplants() : 0;
    ui.notifications.info(`🧬 ${race.label}: характеристик ${Object.keys(upd).length}, `
      + `Черт ${n}, Талантов ${nt}${ng ? `, органов Геносемени ${ng}` : ""}.`);
  }

  /**
   * Выдаёт космодесантнику недостающие органы Геносемени. Они не операция,
   * а часть тела, поэтому сразу помечаются вживлёнными — иначе их эффекты
   * не учитывались бы и они не попали бы на карту тела.
   * Железа Бетчера приносит с собой профиль кислотного плевка.
   */
  async _grantAstartesImplants() {
    const missing = missingAstartesImplants(this.actor);
    if (!missing.length) return 0;

    const docs = missing.map(o => foundry.utils.mergeObject(
      foundry.utils.deepClone(o), { flags: { "warhammer-dbc": { installed: true, geneSeed: true } } }));
    const created = await this.actor.createEmbeddedDocuments("Item", docs);

    // Боевые профили связанных органов (Кислотный плевок Железы Бетчера и
    // т.п.) — тот же синк, что держит их в актуальном состоянии при
    // установке/снятии органа далее (см. syncAstartesImplantWeapon).
    for (const item of created) if (item.system.linkedWeapon) await syncAstartesImplantWeapon(item);

    return missing.length;
  }

  // Совместимость: кнопка геносемени применяет расу Астартес
  async _applyAstartesRace() { return this._applyRaceData("astartes"); }

  /** Иннари: бонусы Прошлого (бывшей расы) + Черты Иннари. */
  async _applyYnnari() {
    const past = this.actor.system.ynnariPast;
    if (past && RACES[past]) await this._applyRaceData(past);  // бонусы изначальной расы
    const n = await this._createTraitsFromList(RACES.ynnari.traits || [], "Иннари");
    ui.notifications.info(`Иннари: применены Черты Иннари (${n})${past ? ` и бонусы Прошлого (${RACES[past]?.label})` : ""}.`);
  }

  /** Арлекин: бонусы Прошлого (изначальной расы) + Черты Арлекина. */
  async _applyHarlequin() {
    const past = this.actor.system.harlequinPast;
    if (past && RACES[past]) await this._applyRaceData(past);  // бонусы изначальной расы
    const n = await this._createTraitsFromList(RACES.harlequin.traits || [], "Арлекин");
    ui.notifications.info(`Арлекин: применены Черты Арлекина (${n})${past ? ` и бонусы Прошлого (${RACES[past]?.label})` : ""}.`);
  }

  /**
   * Применяет легион/орден: создаёт Черты «Геносемя/Культура/Проклятье» с текстом
   * (и авто-эффектами, где есть числовые бонусы — Unnatural и т.п.). Повторный
   * запуск обновляет: старые легион-Черты (source «Легион») удаляются.
   */
  async _applyLegion() {
    const gs = this.actor.system.geneSeed || {};
    const legion  = getLegion(gs.legion || "");
    if (!legion) return ui.notifications.warn("Сначала выберите Легион на вкладке «Записи».");
    const chapter = getChapter(gs.legion || "", gs.chapter || "");
    const effName = chapter ? `${legion.num} ${chapter.name}` : `${legion.num} ${legion.name}`;
    const geneseed = chapter ? chapter.geneseed : legion.geneseed;
    const curse    = chapter ? chapter.curse    : legion.curse;
    const effects  = (chapter && chapter.effects) || legion.effects || null;
    const choices  = (chapter && chapter.curseChoices) || legion.curseChoices || null;
    const noCurse  = !curse || /^(нет проклятья|—)/i.test(curse.trim());

    // Культура может быть перенята у другого легиона/банды (геносемя сохраняется).
    const cul = (gs.cultureLegion && resolveCulture(gs.cultureLegion, gs.cultureChapter))
              || { name: effName, culture: (chapter ? chapter.culture : legion.culture) };

    const baseList = [
      { name: `Геносемя: ${effName}`, benefit: geneseed, effects: effects ? { charBonuses: effects.charBonuses || [], armourAll: effects.armourAll || 0, fearRating: effects.fearRating || 0, sizeMod: effects.sizeMod || 0 } : undefined },
      { name: `Культура: ${cul.name}`, benefit: cul.culture }
    ];

    const apply = async (curseEntry) => {
      // Удаляем прежние легион-Черты (source «Легион»), чтобы переприменить.
      const old = this.actor.items.filter(i => i.type === "trait" && i.system?.source === "Легион").map(i => i.id);
      if (old.length) await this.actor.deleteEmbeddedDocuments("Item", old);
      const list = [...baseList];
      if (curseEntry) list.push({ name: `Проклятье: ${curseEntry.name}`, benefit: curseEntry.text });
      const n = await this._createTraitsFromList(list, "Легион");
      ui.notifications.info(`Легион применён: ${effName}. Создано Черт: ${n}${effects ? " (числовые бонусы Геносемени применены)" : ""}.`);
    };

    // Если у проклятья есть варианты — даём выбрать.
    if (choices && choices.length) {
      const buttons = {};
      choices.forEach((ch, i) => {
        buttons[`c${i}`] = { label: ch.name, callback: () => apply(ch) };
      });
      buttons.none = { label: "Без проклятья", callback: () => apply(null) };
      new Dialog({
        title: `Проклятье: ${effName}`,
        content: `<div style="padding:6px;font-size:0.9em;">Выберите проклятье:<ul style="margin:6px 0 0;padding-left:16px;">${choices.map(ch => `<li><b>${ch.name}</b> — ${ch.text}</li>`).join("")}</ul></div>`,
        buttons, default: "c0"
      }, { width: 460 }).render(true);
      return;
    }

    await apply(noCurse ? null : { name: effName, text: curse });
  }

  // ── Очки Бесчестия (корбук 438) — переопределяется листом Демон-Принца ────
  // Хаосит: пул = поле «Очки Бесчестья» в шапке (system.fate), счётчик в полосе
  // скрыт; тема/сигил — по выбранному Богу-покровителю (system.patronGod).
  get _infamyEnabled() { return true; }
  get _showPatronPicker() { return true; }   // Демон-Принц переопределяет на false (патрон в шапке)
  get _infamyPath() { return "system.fate.value"; }
  get _infamyMax()  { return Math.max(0, Number(this.actor.system.fate?.max) || 0); }
  get _infamyShowCounter() { return false; }
  get _infamyKey()  { return this.actor.system.patronGod || "undivided"; }
  _infamyMeta()     { const p = chaosPatronMeta(this._infamyKey); return { gc: p.color, gc2: p.gc2, sigil: p.sigil }; }
  _ipChange(delta)  { return changeInfamy(this.actor, this._infamyPath, this._infamyMax, delta); }
  _ipRestore()      { return restoreInfamy(this.actor, this._infamyPath, this._infamyMax, this._infamyMeta()); }
  _ipSpend(key)     { return spendInfamy(this.actor, key, { godKey: this._infamyKey, ipFullPath: this._infamyPath, ipMax: this._infamyMax, meta: this._infamyMeta() }); }

  // ── Слушатели ─────────────────────────────────────────────────────────────

  /** Какие расы из листа подходят под метку расы элитного архетипа. */
  _eliteRaceMatch(entry) {
    const r = String(entry.race || "Любая");
    if (/люб/i.test(r)) return true;
    const race = this.actor.system.race || "";
    const sub  = this.actor.system.subrace || "";
    const MAP = {
      "Космодесантник": ["astartes"],
      "Человек":        ["human", "ogryn", "ratling", "navigator", "squat"],
      // Метка «Друкхари» покрывает и субрасы — так сказано в книге.
      "Друкхари":       ["drukhari", "truebornDrukhari", "mandrake", "wrack"],
      "Друкхари Истиннорожденный": ["truebornDrukhari"],
      "Сслит":          ["sslyth"],
      "Мандрагора":     ["mandrake"],
      "Развалина":      ["wrack"]
    };
    // Метка может перечислять несколько рас через запятую.
    return r.split(/[,/]/).some(part => {
      const keys = MAP[part.trim()];
      if (!keys) return false;
      return keys.includes(race) || keys.includes(sub);
    });
  }

  /**
   * Пикер элитных архетипов: подходящие сверху, остальные — под спойлером.
   * extraIndex — индекс в system.eliteArchetypesExtra (доп. поля из шапки,
   * кнопка «+»); без него, как раньше, пишет в основное system.eliteArchetype.
   */
  _showElitePicker(sheetHtml, extraIndex = null) {
    const cur = extraIndex == null
      ? (this.actor.system.eliteArchetype || "")
      : (this.actor.system.eliteArchetypesExtra?.[extraIndex] || "");
    const fit = [], rest = [];
    for (const e of ELITE_ARCHETYPES) (this._eliteRaceMatch(e) ? fit : rest).push(e);

    const card = (e, dim) => `
      <button type="button" class="ep-item ${dim ? "dim" : ""} ${e.name === cur ? "on" : ""}"
              data-name="${e.name}">
        <span class="ep-name">${e.name}</span>
        <span class="ep-meta">${e.race}${e.god ? " · " + e.god : ""}</span>
        <span class="ep-req">${e.req || ""}</span>
      </button>`;

    const dlg = new Dialog({
      title: "Элитный архетип",
      content: `<form class="wh-elite-picker">
        <input type="text" class="ep-search" placeholder="Поиск по названию или требованиям…"/>
        <div class="ep-sec">Доступные расе (${fit.length})</div>
        <div class="ep-list">${fit.map(e => card(e, false)).join("") || '<div class="ep-none">Для этой расы записей нет — впишите свой архетип вручную.</div>'}</div>
        ${rest.length ? `<details class="ep-rest"><summary>Прочие архетипы (${rest.length}) — требования не выполнены</summary>
          <div class="ep-list">${rest.map(e => card(e, true)).join("")}</div></details>` : ""}
        <div class="ep-custom">
          <label>Свой архетип</label>
          <input type="text" class="ep-own" value="${cur.replace(/"/g, "&quot;")}" placeholder="Название своего элитного архетипа"/>
          <button type="button" class="ep-own-set">Записать</button>
        </div>
      </form>`,
      buttons: { close: { label: "Закрыть" } },
      default: "close",
      render: html => {
        const put = async (name) => {
          if (extraIndex == null) {
            await this.actor.update({ "system.eliteArchetype": name });
          } else {
            const arr = foundry.utils.deepClone(this.actor.system.eliteArchetypesExtra || []);
            arr[extraIndex] = name;
            await this.actor.update({ "system.eliteArchetypesExtra": arr });
          }
          dlg.close();
        };
        html.find(".ep-item").click(ev => put(ev.currentTarget.dataset.name));
        html.find(".ep-own-set").click(() => put(html.find(".ep-own").val().trim()));
        html.find(".ep-own").on("keydown", ev => {
          if (ev.key === "Enter") { ev.preventDefault(); put(ev.currentTarget.value.trim()); }
        });
        html.find(".ep-search").on("input", ev => {
          const q = ev.currentTarget.value.trim().toLowerCase();
          html.find(".ep-item").each((_, el) => {
            el.classList.toggle("ep-hidden", !!q && !el.textContent.toLowerCase().includes(q));
          });
        });
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 560, height: 620 });
    dlg.render(true);
  }


  activateListeners(html) {
    requestAnimationFrame(() => { this._restoreScrollPositions(); });
    super.activateListeners(html);

    // Выбор Элитного архетипа: список фильтруется по расе персонажа, но поле
    // остаётся текстовым — свой архетип можно просто вписать руками.
    html.find(".elite-pick-btn").click(() => this._showElitePicker(html));

    // Доп. элитные архетипы (кнопка «+» в шапке) — простой текстовый список
    // поверх основного system.eliteArchetype (тот остаётся первым/главным).
    const getEliteExtra = () => foundry.utils.deepClone(this.actor.system.eliteArchetypesExtra || []);
    html.find(".elite-add-btn").click(async ev => {
      ev.preventDefault();
      const arr = getEliteExtra(); arr.push("");
      await this.actor.update({ "system.eliteArchetypesExtra": arr });
    });
    html.find(".elite-extra-input").on("change", async ev => {
      const i = parseInt(ev.currentTarget.dataset.index);
      const arr = getEliteExtra(); if (arr[i] === undefined) return;
      arr[i] = ev.currentTarget.value;
      await this.actor.update({ "system.eliteArchetypesExtra": arr });
    });
    html.find(".elite-extra-remove").click(async ev => {
      ev.preventDefault();
      const i = parseInt(ev.currentTarget.dataset.index);
      const arr = getEliteExtra(); arr.splice(i, 1);
      await this.actor.update({ "system.eliteArchetypesExtra": arr });
    });
    html.find(".elite-extra-pick-btn").click(ev =>
      this._showElitePicker(html, parseInt(ev.currentTarget.dataset.index)));

    // ── Происхождение (Родные миры) ───────────────────────────────────────
    // Смена мира снимает всё, что дал прежний, и выдаёт новое (с диалогом
    // выбора, если мир его требует). Сам <select> не привязан к system.*.
    html.find(".hw-select").on("change", ev => applyHomeworld(this.actor, ev.currentTarget.value));
    html.find(".arch-select").on("change", ev => applyArchetype(this.actor, ev.currentTarget.value));
    html.find(".dv-select").on("change", ev => applyDivination(this.actor, ev.currentTarget.value));

    // ── Вкладка ГЕМУНКУЛ ──────────────────────────────────────────────────
    html.find(".haem-advance-btn").click(() => haemStep(this.actor, 1));
    html.find(".haem-descend-btn").click(() => haemStep(this.actor, -1));
    html.find(".haem-toggle-btn").click(ev => {
      const d = ev.currentTarget.dataset;
      haemToggleTrait(this.actor, d.kind, d.key);
    });
    html.find(".haem-rank-btn").click(ev => {
      const d = ev.currentTarget.dataset;
      haemRank(this.actor, d.kind, d.key, Number(d.delta));
    });
    // Ступень раскрывается по клику на заголовок — все описания сразу не влезают.
    html.find(".haem-step-head").click(ev => {
      const step = ev.currentTarget.closest(".haem-step");
      const body = step.querySelector(".haem-step-body");
      const show = body.style.display === "none";
      body.style.display = show ? "" : "none";
      step.classList.toggle("is-expanded", show);
    });

    // Очки Бесчестия (общая полоса infamy-strip)
    if (this.isEditable) {
      html.find(".dp-ip-minus").click(() => this._ipChange(-1));
      html.find(".dp-ip-plus").click(() => this._ipChange(+1));
      html.find(".dp-ip-restore").click(() => this._ipRestore());
      html.find(".dp-ip-spend").click(ev => this._ipSpend(ev.currentTarget.dataset.ability));
    }

    // ── Визуальная темизация листа по расе / мировоззрению / классу ─────────
    this._applyThemeClasses();

    // ── Третий Глаз навигатора: зрачок следит за курсором ──────────────────
    const eyeMove = html.find(".nav-eye-move")[0];
    const eyeSvg  = html.find(".nav-eye")[0];
    if (eyeMove && eyeSvg) {
      const rootEl = this.element?.[0] || html[0];
      const MAX = 11; // user-units (svg)
      const onEye = (ev) => {
        const r = eyeSvg.getBoundingClientRect();
        if (!r.width) return;
        let dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        eyeMove.style.transform = `translate(${(dx * MAX).toFixed(2)}px, ${(dy * MAX).toFixed(2)}px)`;
      };
      rootEl?.addEventListener("mousemove", onEye);
    }

    // ── Бой: свернуть/развернуть Стойки и Приёмы (без ре-рендера) ──────────
    html.find(".combat-collapse-head[data-collapse]").on("click", ev => {
      const key = ev.currentTarget.dataset.collapse;
      if (!this._combatCollapse) this._combatCollapse = {};
      this._combatCollapse[key] = !this._combatCollapse[key];
      ev.currentTarget.closest(".combat-collapsible")?.classList.toggle("collapsed", this._combatCollapse[key]);
    });

    // ── Снаряжение: свернуть/развернуть категорию (без ре-рендера; доступно и
    //    наблюдателям — потому размещено до проверки прав редактирования) ─────
    html.find(".gear-cat-head[data-gear-cat]").on("click", ev => {
      if (ev.target.closest("button, select, input, a")) return; // не по контролам внутри
      const key = ev.currentTarget.dataset.gearCat;
      if (!this._gearCollapse) this._gearCollapse = {};
      this._gearCollapse[key] = !this._gearCollapse[key];
      ev.currentTarget.closest(".gear-cat")?.classList.toggle("collapsed", this._gearCollapse[key]);
    });

    // ── Снаряжение: свернуть/развернуть улучшения под носителем ──────────────
    if (!this._gearHostCollapse) this._gearHostCollapse = new Set();
    // Восстанавливаем состояние после ре-рендера.
    for (const hid of this._gearHostCollapse) this._applyGearHostCollapse(html, hid);
    html.find(".gear-mods-toggle[data-host-id]").on("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const hid = ev.currentTarget.dataset.hostId;
      if (this._gearHostCollapse.has(hid)) this._gearHostCollapse.delete(hid);
      else this._gearHostCollapse.add(hid);
      this._applyGearHostCollapse(html, hid);
    });

    // ── Драг предметов из листа (напр. оружие → «Осквернение» в Завесе) ─────
    html.find(".item-row[data-item-id]").each((i, el) => {
      const id = el.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", ev => {
        ev.stopPropagation();
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
        ev.dataTransfer.effectAllowed = "copy";
      });
    });

    if (!this.isEditable) return;

    // ── Мастер создания персонажа (только по кнопке) ────────────────────────
    // Черты, стартовые таланты, органы Геносемени и тема листа остаются здесь:
    // их зовут и кнопки «Применить расу»/«Применить легион».
    html.find(".char-wizard-btn").click(ev => {
      ev.preventDefault();
      showCreationWizard(this.actor, {
        createTraits:          (list, source) => this._createTraitsFromList(list, source),
        applyStartingTalents:  (raw, source)  => this._applyStartingTalents(raw, source),
        grantAstartesImplants: ()             => this._grantAstartesImplants(),
        applyTheme:            ()             => this._applyThemeClasses()
      });
    });

    // Раскрытие описания таланта/черты/мутации в выпадающей строке под основной.
    // Строка описания всегда идёт СЛЕДУЮЩИМ <tr> сразу за строкой с кнопкой —
    // берём её так, а не поиском по data-item-id: на одном листе таблицы
    // талантов, черт, имплантов и органов Геносемени независимы, и если бы
    // где-то совпал id, раскрытие по атрибуту открыло бы сразу все совпадения.
    html.find(".ability-detail-toggle").on("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const row = $(ev.currentTarget).closest("tr").next(".ability-detail-row");
      const shown = row.toggle().is(":visible");
      ev.currentTarget.textContent = shown ? "▾" : "▸";
      ev.currentTarget.closest("tr")?.classList.toggle("ability-row-open", shown);
    });

    // ── Геносемя (Астартес) ─────────────────────────────────────────────────
    html.find(".gene-origin-input").change(ev => {
      this.actor.update({ "system.geneSeed.origin": ev.currentTarget.value });
    });
    html.find(".gene-apply-btn").click(async ev => {
      ev.preventDefault();
      await this._applyAstartesRace();
    });
    html.find(".legion-apply-btn").click(async ev => {
      ev.preventDefault();
      await this._applyLegion();
    });
    // Цена психосилы (синхронно: вкладки «Развитие» и «ПСИ» → авто-сумма в Опыт).
    html.find(".psy-cost-input, .tech-cost-input").on("change", ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) item.update({ "system.cost": parseInt(ev.currentTarget.value) || 0 });
    });
    // Вкл/выкл включаемой системы силовой брони (бонусы учитываются только во вкл.).
    html.find(".armormod-active-toggle").on("click", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) {
        const active = !item.system.active;
        await item.update({ "system.active": active });
        await syncItemEffectsDisabled(item);
      }
    });

    // ── Установка мода/системы на носитель (инлайн-выпадашка) ────────────────
    html.find(".gear-mod-install").on("change", async ev => {
      ev.stopPropagation();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      const targetId = ev.currentTarget.value;
      if (item && targetId) { await item.update({ "system.installedOn": targetId }); await syncItemEffectsDisabled(item); }
    });

    // ── Снять мод/систему с носителя ─────────────────────────────────────────
    html.find(".gear-mod-uninstall").on("click", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      // Снятие также выключает включаемую систему (бонусы не должны висеть).
      if (item) { await item.update({ "system.installedOn": "", "system.active": false }); await syncItemEffectsDisabled(item, false); }
    });
    html.find(".ynnari-apply-btn").click(async ev => {
      ev.preventDefault();
      await this._applyYnnari();
    });
    html.find(".harlequin-apply-btn").click(async ev => {
      ev.preventDefault();
      await this._applyHarlequin();
    });
    // Сворачивание гайда имплантов (состояние держится между перерисовками)
    if (this._geneSeedOpen) {
      html.find(".gene-organs").removeClass("collapsed");
      html.find(".gene-toggle-btn").text("▾ Импланты");
    }
    html.find(".gene-toggle-btn").click(ev => {
      ev.preventDefault();
      this._geneSeedOpen = !this._geneSeedOpen;
      html.find(".gene-organs").toggleClass("collapsed", !this._geneSeedOpen);
      ev.currentTarget.textContent = (this._geneSeedOpen ? "▾" : "▸") + " Импланты";
    });

    // Длительность теперь бросается автоматически при применении препарата.

    // ── Страх / Безумие / Порча ────────────────────────────────────────────
    html.find(".fear-roll").click(() => this._rollFear());
    html.find(".trauma-roll").click(() => this._rollTrauma());
    html.find(".disorder-roll, .disorder-roll-btn").click(() => this._rollDisorder());
    html.find(".disorder-add-btn").click(() => this._addDisorderDialog());
    html.find(".disorder-test-btn").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) this._rollDisorderTest(item);
    });
    html.find(".disorder-remove-btn").click(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await item.delete();
    });
    html.find(".disorder-name-link").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) item.sheet?.render(true);
    });

    // ── Болезни ───────────────────────────────────────────────────────────
    html.find(".disease-name-link").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) item.sheet?.render(true);
    });
    html.find(".disease-remove-btn").click(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await item.delete();
    });
    html.find(".disease-active-toggle").click(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await item.update({ "system.active": !item.system.active });
    });
    html.find(".disease-add-btn").click(async () => {
      const [it] = await this.actor.createEmbeddedDocuments("Item", [
        { name: "Новая болезнь", type: "disease", system: { diseaseType: "warp" } }
      ]);
      it?.sheet.render(true);
    });
    html.find(".corruption-roll").click(() => {
      const wp = this.actor.system.characteristics.wp?.total ?? 0;
      this._rollCharacteristic("Воля (Порча)", "WP", wp, "wp");
    });

    // ── Кнопки «+» показателей: Безумие/Порча (число или XdY+Z), Опыт,
    //    Благосклонность Бога-покровителя (ЗАПИСИ) — общий диалог+лог в чат ──
    html.find(".stat-add-btn").click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const stat = ev.currentTarget.dataset.stat;
      if (stat === "insanity") {
        await promptStatAdd(this.actor, { label: "Безумие", path: "system.insanity.value", allowDice: true });
      } else if (stat === "corruption") {
        await promptStatAdd(this.actor, { label: "Порча", path: "system.corruption.value", allowDice: true });
      } else if (stat === "xpTotal") {
        await promptStatAdd(this.actor, { label: "Опыт (Всего)", path: "system.experience.total" });
      } else if (stat === "patronFavor") {
        const god = ev.currentTarget.dataset.god;
        const meta = chaosPatronMeta(god);
        await promptStatAdd(this.actor, { label: `Благосклонность — ${meta.label}`, path: `system.patronFavor.${god}` });
      }
    });

    // ── Инициатива ────────────────────────────────────────────────────────
    html.find(".initiative-roll-btn").click(async () => {
      // initiativeMod уже учтён формулой через @initiativeMod (см. CONFIG.Combat.initiative)
      if (!this.actor.inCombat) {
        ui.notifications.warn(`${this.actor.name} не участвует в бою — добавьте токен в трекер инициативы.`);
        return;
      }
      await this.actor.rollInitiative({ createCombatants: false, rerollInitiative: true });
    });

    // ── Смена расы ────────────────────────────────────────────────────────
    html.find(".race-select").change(ev => {
      this.actor.update({ "system.race": ev.currentTarget.value, "system.subrace": "" });
    });

    // ── Бросок характеристики ─────────────────────────────────────────────
    html.find(".char-roll").click(ev => {
      const key   = ev.currentTarget.dataset.char;
      if (key === "pf") {                       // Фактор Прибыли — не характеристика
        const pf = Number(this.actor.system.aspirations?.profitFactor) || 0;
        this._rollCharacteristic("Фактор Прибыли", "PF", pf, "pf", true);
        return;
      }
      const meta  = CHARACTERISTICS[key];
      const total = this.actor.system.characteristics[key]?.total ?? 0;
      this._rollCharacteristic(_charLabel(key, this.actor.system.alignment), meta.abbr, total, key);
    });

    // ── Редактирование характеристик ──────────────────────────────────────
    html.find(".char-input").change(ev => {
      const el = ev.currentTarget;
      this.actor.update({
        [`system.characteristics.${el.dataset.char}.${el.dataset.field}`]: parseInt(el.value) || 0
      });
    });
    // Накопительные авто-цены по склонностям (стр. 23-24) считает tabs/advance.mjs;
    // здесь короткие обёртки — секции ниже зовут их без актора.
    const charImpCost  = (charKey, improvement, grantedImp) =>
      advCharImpCost(this.actor, charKey, improvement, grantedImp);
    const skillCumCost = (def, rank, entryChar, grantedRank) =>
      advSkillCumCost(this.actor, def, rank, entryChar, grantedRank);
    html.find(".char-improvement-select").change(ev => {
      const el = ev.currentTarget;
      const charKey = el.dataset.char;
      // Ставим уровень И авто-цену (можно затем поправить вручную в поле «Цена»).
      this.actor.update({
        [`system.characteristics.${charKey}.improvement`]: el.value,
        [`system.characteristics.${charKey}.cost`]: charImpCost(charKey, el.value)
      });
    });
    html.find(".char-cost-input").change(ev => {
      const el      = ev.currentTarget;
      const charKey = el.dataset.char;
      const cost    = parseInt(el.value) || 0;
      this.actor.update({ [`system.characteristics.${charKey}.cost`]: cost });
    });

    // ── Ручная пометка «выдано архетипом» (★) ────────────────────────────
    // Мастер выдаёт бесплатное автоматически (grantedRank/grantedImp), но то,
    // что вписано руками, считалось купленным: обнулённая цена возвращалась при
    // следующей смене ранга. Кнопка ★ фиксирует текущий уровень как бесплатный.
    html.find(".grant-toggle[data-char]").click(ev => {
      ev.preventDefault();
      const charKey = ev.currentTarget.dataset.char;
      const c   = this.actor.system.characteristics?.[charKey] || {};
      const imp = c.improvement || "none";
      const on  = (c.grantedImp || "none") !== "none";
      const nextGranted = on ? "none" : imp;
      if (!on && imp === "none")
        return ui.notifications.warn("Сначала выберите уровень улучшения, потом помечайте его как выданный.");
      this.actor.update({
        [`system.characteristics.${charKey}.grantedImp`]: nextGranted,
        [`system.characteristics.${charKey}.cost`]: charImpCost(charKey, imp, nextGranted)
      });
    });

    html.find(".grant-toggle[data-skill]").click(ev => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.skill;
      const sk  = this.actor.system.skills?.[key] || {};
      const rank = sk.rank || "untrained";
      const on   = (sk.grantedRank || "untrained") !== "untrained";
      const nextGranted = on ? "untrained" : rank;
      if (!on && rank === "untrained")
        return ui.notifications.warn("Сначала выберите ранг навыка, потом помечайте его как выданный.");
      this.actor.update({
        [`system.skills.${key}.grantedRank`]: nextGranted,
        [`system.skills.${key}.cost`]: skillCumCost(SKILLS_DEF[key], rank, null, nextGranted)
      });
    });

    // ★ у таланта-предмета: «выдан архетипом» ↔ «куплен за опыт».
    html.find(".grant-toggle[data-talent]").click(async ev => {
      ev.preventDefault();
      const item = this.actor.items.get(ev.currentTarget.dataset.talent);
      if (!item) return;
      const cost = parseInt(item.system?.cost) || 0;
      const on   = !!item.system?.granted || (cost === 0 && !item.system?.purchased);
      if (on) {
        // Снимаем ★ → талант считается купленным, цена по склонностям (стр. 23-24).
        const apts = charAptitudeSet(this.actor.system.aptitudes);
        const a = item.system.aptSource
          ? resolveTalentAptitudes(item.name, item.system.aptitudes || [], item.system.aptSource,
              { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF })
          : (item.system.aptitudes || []);
        await item.update({
          "system.granted": false, "system.purchased": true,
          "system.cost": talentCostXP(item.system.tier, a, apts,
            this._talentCat(item.name))
        });
      } else {
        await item.update({ "system.granted": true, "system.purchased": false, "system.cost": 0 });
      }
    });

    html.find(".grant-toggle[data-group]").click(ev => {
      ev.preventDefault();
      const el      = ev.currentTarget;
      const gk      = el.dataset.group;
      const idx     = parseInt(el.dataset.index);
      const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[gk] ?? []);
      const e = entries[idx]; if (!e) return;
      const rank = e.rank || "untrained";
      const on   = (e.grantedRank || "untrained") !== "untrained";
      if (!on && rank === "untrained")
        return ui.notifications.warn("Сначала выберите ранг навыка, потом помечайте его как выданный.");
      e.grantedRank = on ? "untrained" : rank;
      e.cost = skillCumCost(GROUP_SKILLS_DEF[gk], rank, e.char, e.grantedRank);
      this.actor.update({ [`system.groupSkills.${gk}`]: entries });
    });

    // ── Навыки ────────────────────────────────────────────────────────────
    html.find(".skill-roll").click(ev => {
      const isGroup = ev.currentTarget.dataset.group === "true";
      if (isGroup) {
        const groupKey = ev.currentTarget.dataset.groupkey;
        const idx      = parseInt(ev.currentTarget.dataset.index);
        const entry    = this.actor.system.groupSkills?.[groupKey]?.[idx];
        const def      = GROUP_SKILLS_DEF[groupKey];
        if (!entry || !def) return;
        this._rollSkill(`${def.label}: ${entry.specialty}`, entry.total ?? -20, entry.char || def.char,
          { group: groupKey, specialty: entry.specialty });
      } else {
        const key = ev.currentTarget.dataset.skill;
        const def = SKILLS_DEF[key];
        const sk  = this.actor.system.skills?.[key];
        this._rollSkill(def?.label ?? key, sk?.total ?? -20, def?.char ?? "ag", { skill: key });
      }
    });

    html.find(".wounds-heal-btn").click(() => this._showHealingDialog());

    html.find(".pain-absorb-btn").click(() => this._painChange(+1, "absorb"));
    html.find(".pain-spend-btn").click(() => this._painChange(-1, "spend"));
    html.find(".pain-soulburn-btn").click(() => this._painSoulBurn());

    html.find(".skill-rank-select").change(ev => {
      const el = ev.currentTarget;
      const key = el.dataset.skill;
      const granted = this.actor.system.skills?.[key]?.grantedRank || "untrained";
      this.actor.update({
        [`system.skills.${key}.rank`]: el.value,
        [`system.skills.${key}.cost`]: skillCumCost(SKILLS_DEF[key], el.value, null, granted)
      });
    });
    html.find(".skill-cost-input").change(ev => {
      const el = ev.currentTarget;
      this.actor.update({ [`system.skills.${el.dataset.skill}.cost`]: parseInt(el.value) || 0 });
    });

    // ── Вкладка РАЗВИТИЕ ──────────────────────────────────────────────────
    // Выбор специализации остаётся тут: пикер — часть листа, а не вкладки.
    activateAdvanceListeners(html, this.actor, {
      addGroupSkill: groupKey => this._addGroupSkill(groupKey)
    });

    // ── Снаряжение ────────────────────────────────────────────────────────
    html.find(".add-item-btn").click(() => { this._showAddItemDialog(); });
    html.find(".rig-open-btn").click(() => { openRigManager(this.actor); });

    // Добавление Черт/Талантов — через пикер с листа (группировка по типам,
    // поиск, описание по стрелке). ПКМ — создать пустую (для своих/книжных).
    html.find(".trait-add-btn").on("click", ev => { ev.preventDefault(); this._openItemPicker("trait"); });
    html.find(".trait-add-btn").on("contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новая черта", type: "trait" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    html.find(".talent-add-btn").on("click", ev => { ev.preventDefault(); this._openItemPicker("talent"); });
    html.find(".talent-add-btn").on("contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новый талант", type: "talent" }, { parent: this.actor });
      item?.sheet?.render(true);
    });

    // ＋ мутация / ＋ Дар — выбор КОНКРЕТНОЙ записи из таблиц книги.
    html.find(".gear-lib-btn").click(ev => { ev.preventDefault(); this._openGearPicker(); });

    // ＋ Мутация/Дар — общий пул (см. tabs/mutations.mjs): выбор ЛЮБОЙ
    // записи из Общих Мутаций ИЛИ Даров любого Бога, не только покровителя.
    html.find(".mutgift-add-btn").click(async ev => {
      ev.preventDefault();
      if (ev.shiftKey) {   // Shift — пустая мутация с нуля
        const item = await Item.create({ name: "Новая мутация", type: "mutation" }, { parent: this.actor });
        return item?.sheet?.render(true);
      }
      openMutationPicker(this.actor);
    });

    // 🎲 Бросок по общему пулу (Общие Мутации ИЛИ Дар Бога — тип выбирается в
    // диалоге). Бросок можно сдвинуть на ±Inf.b (если результат не от
    // Провала) — спрашиваем модификатор.
    html.find(".mutgift-roll-btn").click(async ev => {
      ev.preventDefault();
      await rollMutationOrGift(this.actor);
    });

    // ── Стремления (стр. 22) — 3 ЖЁСТКИХ слота: [0]=Гордыня,[1]=Позор,[2]=Мотивация ──
    // Позиция в массиве = категория, слоты всегда 3 (не добавляются/не удаляются
    // как раньше — только очищаются "✕" или переключаются на "Своё").
    const getAspir = () => {
      const v = this.actor.system.aspirations;
      const arr = Array.isArray(v) ? foundry.utils.deepClone(v) : [];
      while (arr.length < 3) arr.push({ id: "" });
      return arr;
    };
    html.find(".aspir-remove").click(async ev => {
      ev.preventDefault();
      const i = parseInt(ev.currentTarget.dataset.index);
      const arr = getAspir(); arr[i] = { id: "" };
      await this.actor.update({ "system.aspirations": arr });
    });
    html.find(".aspir-select").on("change", async ev => {
      const i = parseInt(ev.currentTarget.dataset.index);
      const arr = getAspir();
      arr[i] = (ev.currentTarget.value === "__custom__")
        ? { custom: true, name: "", mods: "", desc: "" }
        : { id: ev.currentTarget.value };
      await this.actor.update({ "system.aspirations": arr });
    });
    html.find(".aspir-custom-name, .aspir-custom-mods").on("change", async ev => {
      const i = parseInt(ev.currentTarget.dataset.index);
      const arr = getAspir();
      arr[i] = { ...arr[i], custom: true };
      if (ev.currentTarget.classList.contains("aspir-custom-name")) arr[i].name = ev.currentTarget.value;
      else arr[i].mods = ev.currentTarget.value;
      await this.actor.update({ "system.aspirations": arr });
    });

    // ── Пути Аэльдари ───────────────────────────────────────────────────────
    const getPaths = () => {
      const v = this.actor.system.paths;
      if (Array.isArray(v)) return foundry.utils.deepClone(v);
      if (v && typeof v === "object") return Object.values(v);
      return [];
    };
    html.find(".path-add-btn").click(async ev => {
      ev.preventDefault();
      const arr = getPaths();
      arr.push({ key: "", grade: "" });
      await this.actor.update({ "system.paths": arr });
    });
    html.find(".path-remove").click(async ev => {
      ev.preventDefault();
      const idx = parseInt(ev.currentTarget.dataset.index);
      const arr = getPaths();
      arr.splice(idx, 1);
      await this.actor.update({ "system.paths": arr });
    });
    const savePaths = async () => {
      const arr = [];
      html.find(".path-sel").each((_, el) => {
        const i = parseInt(el.dataset.index);
        if (!arr[i]) arr[i] = { key: "", grade: "" };
        arr[i].key = el.value;
      });
      html.find(".path-grade").each((_, el) => {
        const i = parseInt(el.dataset.index);
        if (!arr[i]) arr[i] = { key: "", grade: "" };
        arr[i].grade = el.value;
      });
      // При смене пути сбрасываем градацию на первую доступную
      html.find(".path-sel").each((_, el) => {
        const i = parseInt(el.dataset.index);
        const path = AZURIANE_PATHS[el.value];
        if (path && arr[i] && !path.grades?.[arr[i].grade]) {
          arr[i].grade = PATH_GRADE_ORDER.find(g => path.grades?.[g]) || "";
        }
      });
      await this.actor.update({ "system.paths": arr });
    };
    html.find(".path-sel, .path-grade").on("change", savePaths);

    // Сворачивание панели Путей (состояние держится между перерисовками)
    if (this._pathsOpen === false) {
      html.find(".paths-collapse").addClass("collapsed");
      html.find(".paths-toggle-btn").text("▸ Пути");
    }
    html.find(".paths-toggle-btn").click(ev => {
      ev.preventDefault();
      const nowOpen = this._pathsOpen === false; // был свёрнут → разворачиваем
      this._pathsOpen = nowOpen;
      html.find(".paths-collapse").toggleClass("collapsed", !nowOpen);
      ev.currentTarget.textContent = (nowOpen ? "▾" : "▸") + " Пути";
    });

    activatePsychicListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts),
      resolveSoulBurn: _resolveSoulBurn
    });

    activateTechListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts)
    });

    activateGearListeners(html, this.actor);

    html.find(".weapon-attack-roll").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      // Стрельба по клику: у стрелкового/метательного оружия без уже выбранной
      // цели — сперва прицеливание перекрестием, диалог откроется по выбору цели.
      // Ближний бой и уже назначенная цель — сразу диалог (прежнее поведение).
      const isRanged = item.system?.weaponClass && item.system.weaponClass !== "melee";
      const hasTarget = (game.user?.targets?.size ?? 0) > 0;
      if (isRanged && !hasTarget && canvas?.ready) {
        beginTargeting(this.actor, item, () => this._showAttackDialog(item));
      } else {
        this._showAttackDialog(item);
      }
    });

    // ── Контекстное меню предметов ────────────────────────────────────────
    activateItemContextMenu(html, this.actor);

    // ── Препараты ─────────────────────────────────────────────────────────────
    activateDrugListeners(html, this.actor, {
      resolveOtherTargetActor: () => this._resolveOtherTargetActor()
    });
    // ── Состояния и Усталость ─────────────────────────────────────────────
    activateConditionsListeners(html, this.actor);

    // ── Вкладка ТЕЛО ──────────────────────────────────────────────────────
    activateBodyListeners(html, this.actor);

    // ── Одержимый: Проявить / Заключить (полудействие + тест Cor+20) ──────────
    html.find(".poss-manifest-btn").on("click", async ev => {
      ev.preventDefault();
      await this._toggleManifest();
    });

    // ── Стойка ───────────────────────────────────────────────────────────
    html.find(".stance-radio").change(ev => {
      this.actor.update({ "system.meleeStance": ev.currentTarget.value });
    });

    // ── Приёмы ───────────────────────────────────────────────────────────
    html.find(".technique-btn").click(ev => {
      const tech    = ev.currentTarget.dataset.technique;
      const techDef = MELEE_TECHNIQUES[tech];
      if (!techDef) return;

      const meleeItem = this.actor.items.find(i =>
        i.type === "weapon" && i.system.equipped &&
        (i.system.weaponClass === "melee" || i.system.weaponClass === "thrown")
      );
      const stance    = this.actor.system.meleeStance || "standard";
      const stanceDef = MELEE_STANCES[stance];

      if (tech === "knockdown" || tech === "feint" || tech === "press") {
        _showContestDialog(this.actor, techDef);
      } else if (meleeItem) {
        this._showAttackDialogWithTechnique(meleeItem, techDef, stanceDef, tech);
      } else {
        this._showAttackDialogNoWeapon(techDef);
      }
    });
  }

  // ── Диалог атаки ─────────────────────────────────────────────────────────

  async _showAttackDialog(item, techniqueOpts = {}) {
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
    const modFx       = getModEffects(this.actor, item);
    const _entries    = mergeWeaponPropEntries(item, modFx);
    // Свойства заряженного боеприпаса (стр. 203) — чтобы порог и памятки в
    // диалоге совпадали с тем, что реально применит бросок.
    {
      const _ammo = sys.loadedAmmoId ? this.actor.items.get(sys.loadedAmmoId) : null;
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
    const ruleMods = this._ruleRollModsHtml(attackCtx);

    const stance      = this.actor.system.meleeStance || "standard";
    const stanceDef   = MELEE_STANCES[stance];
    const stanceBonus = isMelee ? (stanceDef?.wsBonus ?? 0) : 0;

    const currentAiming = this.actor.system.aiming || "none";
    const aimingBonus   = currentAiming === "half" ? 10 : currentAiming === "full" ? 20 : 0;
    const aimingLabel   = currentAiming === "half"
      ? "Полу-прицеливание (+10)"
      : currentAiming === "full" ? "Полное прицеливание (+20)" : "";

    const loadedAmmo = sys.loadedAmmoId ? this.actor.items.get(sys.loadedAmmoId) : null;
    const ammoSys    = loadedAmmo?.system;
    const ammoAtkMod = ammoSys?.attackMod ?? 0;

    const techBonus = techniqueOpts.extraBonus ?? 0;
    const charBase  = (this.actor.system.characteristics[charKey]?.total ?? 0) + (sys.attackBonus || 0) + wpAttackMod + gripWs;
    const charVal   = charBase + techBonus + stanceBonus + (wp.noAim ? 0 : aimingBonus) + ammoAtkMod;

    // Штраф усталости (мод препаратов уже учтён в char.total)
    const hasFatigue = (this.actor.system.fatigue?.value ?? 0) >= 1;

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
    const escAC = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const ammoCondHtml = ammoConds.length ? `
        <div class="av-ammo-cond">
          <div class="av-sec-lbl">${rollIcon("spark","#8fd0ff")}Боеприпас: ${escAC(loadedAmmo?.name || "")}</div>
          ${ammoConds.map((c, i) => {
            const parts = [];
            if (c.atk) parts.push(`${c.atk > 0 ? "+" : ""}${c.atk}`);
            if (c.dmg) parts.push(`${c.dmg > 0 ? "+" : ""}${c.dmg} урона`);
            for (const k of (c.wp || [])) parts.push(WEAPON_PROPERTIES[k]?.label || k);
            const val = parts.length ? `<span class="avc-val">${parts.join(", ")}</span>` : "";
            const note = c.note ? `<span class="avc-note">${escAC(c.note)}</span>` : "";
            // Пункты без числовых эффектов — просто памятка, без галочки.
            const isNote = !c.atk && !c.dmg && !(c.wp || []).length;
            return isNote
              ? `<div class="avc-row avc-row-note">${escAC(c.label)} ${note}</div>`
              : `<label class="avc-row"><input type="checkbox" class="atk-ammo-cond"
                   data-idx="${i}" data-atk="${c.atk || 0}"/>
                   <span class="avc-lbl">${escAC(c.label)}</span> ${val} ${note}</label>`;
          }).join("")}
        </div>` : "";
    const fatigueBadge = hasFatigue
      ? `<span class="atk-fatigue-badge">${rollIcon("warn","#ffb84d")}−10</span>`
      : "";
    // Бейдж препарата: показываем, если активные препараты меняют выбранную характеристику
    const drugCharMod  = this.actor.system.drugCharMods?.[charKey] ?? 0;
    const drugAtkBadge = drugCharMod !== 0
      ? `<span class="atk-drug-badge" title="Уже учтено в пороге">💊 ${drugCharMod > 0 ? "+" : ""}${drugCharMod}</span>`
      : "";

    // Свойства оружия — напоминание + чекбокс короткой дистанции + перезарядка
    const wpDialogList = wProps.map(p => {
      const r = p.def.rating ? ` (${p.rating ?? 0}${p.def.rating2 ? "/" + (p.rating2 ?? 0) : ""})` : "";
      const tip = (p.def.desc || "").replace(/"/g, "&quot;");
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
              const v = this.actor.system.characteristics[k]?.total ?? 0;
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
                  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
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

              await this.actor.update({ "system.aiming": "none" });

              const shortRange = html.find("#atk-shortrange").is(":checked");
              const bandIdx    = Number(html.find("#atk-band").val() ?? -1);
              const weaponOff  = html.find("#atk-weaponoff").is(":checked");
              const maximal    = html.find("#atk-maximal").is(":checked");

              // Профиль атаки + хват выбраны в HUD (см. начало метода): применяем молча.
              await _executeAttackRoll(
                this.actor, item, selectedChar, finalThreshold, rofMode, aimTarget,
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
            const base   = (this.actor.system.characteristics[ck]?.total ?? 0)
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

  async _showAttackDialogWithTechnique(item, techDef, stanceDef, techKey) {
    await this._showAttackDialog(item, {
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

  async _showAttackDialogNoWeapon(techDef) {
    const ws      = this.actor.system.characteristics.ws?.total ?? 0;
    const stance  = this.actor.system.meleeStance || "standard";
    const stBon   = MELEE_STANCES[stance]?.wsBonus ?? 0;
    const fatigue = this._getFatiguePenalty("ws");
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
      const astartesProfile = hasRuleFlag(this.actor, "unarmed.astartesProfile");
      const dmgSrc = (astartesProfile && techDef.damageAstartes) ? techDef.damageAstartes : techDef.damage;
      const dmgFormula = _resolveCharFormula(dmgSrc, this.actor.system.characteristics, this.actor.system.corruptionBonus ?? 0);
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
              data-primitive="1" data-weapon-name="${techDef.label}" data-attacker="${this.actor.name}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>`;
      } catch (e) { console.error("Безоружный урон:", e); }
    }

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
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

  // ── Добавление предмета ───────────────────────────────────────────────────

  _showAddItemDialog() {
    // Только снаряжение — без талантов/черт/психосил/расстройств и пр.
    const options = GEAR_ITEM_TYPES
      .map(type => `<option value="${type}">${ITEM_TYPES[type]}</option>`).join("");
    new Dialog({
      title: "Добавить предмет",
      content: `<form style="padding:8px;">
        <select id="new-item-type" class="wh-add-item-select" style="width:100%;padding:5px 6px;
          background:#0c2418;color:#d8ffe8;border:1px solid #2f9e6a;
          font-family:inherit;font-size:1em;">${options}</select>
      </form>`,
      buttons: {
        create: {
          icon: '<i class="fas fa-plus"></i>', label: "Создать",
          callback: async html => {
            const type  = html.find("#new-item-type").val();
            const label = ITEM_TYPES[type] || "Новый предмет";
            await Item.create({ name: `New ${label}`, type }, { parent: this.actor });
          }
        },
        cancel: { label: "Отмена" }
      },
      default: "create"
    }, { classes: ["dialog","wh-add-item-dialog","warhammer-dbc","wh-holo"], width: 320 }).render(true);
  }

  // ── Диалоги броска ────────────────────────────────────────────────────────

  async _addGroupSkill(groupKey) {
    const def = GROUP_SKILLS_DEF[groupKey];
    if (!def) return;
    const picked = await this._showSpecPicker(groupKey, def);
    if (!picked?.specialty) return;

    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[groupKey] ?? []);
    const entry = { specialty: picked.specialty, rank: "untrained", cost: 0, total: -20 };
    // Ключ каталога — на него ссылаются механики; своя специализация без ключа.
    if (picked.specKey) entry.specKey = picked.specKey;
    // Своя Характеристика специализации (Operate(Voidship) — Интеллект).
    const sd = picked.specKey ? specDef(groupKey, picked.specKey) : null;
    if (sd?.char) entry.char = sd.char;
    entries.push(entry);
    this.actor.update({ [`system.groupSkills.${groupKey}`]: entries });
  }

  /**
   * Выбор специализации Группы Навыков: список из книги (стр. 58-61) плюс
   * своя. У специализаций с подстановкой (<Регион>, <Раса>) спрашиваем,
   * чем её заполнить.
   */
  _showSpecPicker(groupKey, def) {
    const opts = specOptions(groupKey);
    const esc = x => String(x ?? "").replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const rows = opts.map(o =>
      `<option value="${esc(o.key)}" data-free="${o.free ? 1 : 0}">${esc(o.display)}</option>`).join("");

    return new Promise(resolve => {
      let done = false;
      new Dialog({
        title: `${def.label}: специализация`,
        content: `<form class="wh-spec-picker">
          <div class="spec-row"><label>Из книги</label>
            <select id="spec-key"><option value="">— своя —</option>${rows}</select></div>
          <div class="spec-row" id="spec-fill-row" style="display:none;">
            <label id="spec-fill-label">Уточнение</label>
            <input type="text" id="spec-fill" placeholder="Например: Коронус"/></div>
          <div class="spec-row" id="spec-own-row"><label>Своя</label>
            <input type="text" id="spec-own" placeholder="Название специализации"/></div>
          <div class="spec-hint" id="spec-hint"></div>
        </form>`,
        buttons: {
          ok: { icon: '<i class="fas fa-check"></i>', label: "Добавить", callback: h => {
            if (done) return; done = true;
            const key = String(h.find("#spec-key").val() || "");
            if (!key) return resolve({ specialty: String(h.find("#spec-own").val() || "").trim() });
            const sd = specDef(groupKey, key);
            let specialty = sd?.label || key;
            if (sd?.free) {
              const fill = String(h.find("#spec-fill").val() || "").trim();
              // «Xenos (<Раса>)» + «Eldar» → «Xenos (Eldar)»
              specialty = fill ? specialty.replace(/<[^>]*>/, fill) : specialty.replace(/\s*\(<[^>]*>\)/, "");
            }
            resolve({ specialty, specKey: key });
          }},
          cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
        },
        default: "ok",
        render: h => {
          const upd = () => {
            const opt = h.find("#spec-key")[0].selectedOptions[0];
            const key = String(h.find("#spec-key").val() || "");
            const free = opt?.dataset.free === "1";
            h.find("#spec-fill-row").toggle(free);
            h.find("#spec-own-row").toggle(!key);
            const sd = key ? specDef(groupKey, key) : null;
            const bits = [];
            if (sd?.char)  bits.push(`Характеристика: ${CHARACTERISTICS[sd.char]?.abbr || sd.char}`);
            if (sd?.chars) bits.push(`Часто используемые: ${sd.chars.map(c => CHARACTERISTICS[c]?.abbr || c).join(", ")}`);
            if (sd?.psykerOnly) bits.push("Только для псайкеров");
            if (sd?.combines)   bits.push("Заменяет каждое из входящих знаний и двигается как одно");
            h.find("#spec-hint").text(bits.join(" · "));
          };
          h.find("#spec-key").on("change", upd); upd();
        },
        close: () => { if (!done) { done = true; resolve(null); } }
      }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-spec-dialog"], width: 460 }).render(true);
    });
  }

  /**
   * Галочки Особенности Происхождения для диалога броска.
   * Модификатор не применяется молча: игрок сам решает, уместен ли он здесь.
   *
   * Выключенная подсистема убирает Происхождение и отсюда: иначе выбор пропадал
   * из шапки листа (homeworldSheetContext), а галочки Особенности у персонажа с
   * уже применённым Происхождением оставались в диалоге броска.
   */
  _homeworldModsHtml(context) {
    if (!isFeatureEnabled("homeworlds")) return { html: "", mods: [] };
    const mods = homeworldRollMods(actorHomeworldKey(this.actor), context);
    if (!mods.length) return { html: "", mods };
    const rows = mods.map((m, i) => {
      const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
      return `<label class="attack-mod-check hw-roll-mod">
        <input type="checkbox" class="hw-mod" data-idx="${i}" data-value="${m.value || 0}"
               ${m.halvePenalty ? 'data-halve="1"' : ""}/>
        <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
    }).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers hw-mods">
        <div class="atk-mods-title">Родной мир — ${mods[0].world}</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  /**
   * Галочки ситуативных модификаторов, объявленных прямо на предметах актора
   * (flags.warhammer-dbc.rollMods — тот же формат записей, что и у
   * HOMEWORLDS[].rollMods: {when, value, label, halvePenalty}). Заполняется
   * записью kind:"rollmod" Конструктора (module/apps/mechanics.mjs) при
   * получении предмета. Один блок на предмет-источник, чтобы игрок видел,
   * откуда галочка.
   */
  _itemRollModsHtml(context) {
    const groups = [];
    for (const it of this.actor.items) {
      const mods = it.getFlag("warhammer-dbc", "rollMods");
      if (!Array.isArray(mods) || !mods.length) continue;
      const hits = mods.filter(m => matchesContext(m.when, context));
      if (hits.length) groups.push({ item: it, mods: hits });
    }
    if (!groups.length) return { html: "", mods: [] };
    const allMods = [];
    let idx = 0;
    const blocks = groups.map(g => {
      const rows = g.mods.map(m => {
        const gi = idx++;
        allMods.push(m);
        const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
        return `<label class="attack-mod-check item-roll-mod">
          <input type="checkbox" class="item-mod" data-idx="${gi}" data-value="${m.value || 0}"
                 ${m.halvePenalty ? 'data-halve="1"' : ""}/>
          <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
      }).join("");
      return `<div class="atk-dlg-modifiers item-mods">
        <div class="atk-mods-title">${g.item.name}</div>
        <div class="atk-mods-list">${rows}</div></div>`;
    }).join("");
    return { mods: allMods, html: blocks };
  }

  /**
   * Галочки от реестра правил — третий источник модификаторов рядом с
   * Особенностями Происхождения и предметными rollMods. Правила приходят через
   * конвейер теста (module/rules/resolve-test.mjs, фазы 1–3): здесь только показ.
   *
   * Формат записи тот же, {value, label, halvePenalty}, поэтому дальше диалог
   * складывает все три вида галочек одинаково.
   */
  _ruleRollModsHtml(context) {
    const { mods } = resolveTest({ actor: this.actor, ...context });
    if (!mods.length) return { html: "", mods };
    const rows = mods.map((m, i) => {
      const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
      return `<label class="attack-mod-check rule-roll-mod">
        <input type="checkbox" class="rule-mod" data-idx="${i}" data-value="${m.value || 0}"
               ${m.halvePenalty ? 'data-halve="1"' : ""}/>
        <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
    }).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers rule-mods">
        <div class="atk-mods-title">Правила</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  _showSkillRollDialog(label, baseTotal, defaultChar, hideCharSelect = false, rollContext = null) {
    return new Promise(resolve => {
      let resolved = false;
      const rollCtx = { kind: "skill", char: defaultChar, ...(rollContext || {}) };
      const hw = this._homeworldModsHtml(rollCtx);
      const im = this._itemRollModsHtml(rollCtx);
      const rl = this._ruleRollModsHtml(rollCtx);
      const defaultCharTotal = this.actor.system.characteristics[defaultChar]?.total ?? 0;
      const rankBonus        = baseTotal - defaultCharTotal;
      const charOptions = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
        const v = this.actor.system.characteristics[key]?.total ?? 0;
        return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>${meta.abbr} — ${meta.label} (${v})</option>`;
      }).join("");

      const dialog = new Dialog({
        title: `Проверка: ${label}`,
        content: `
          <form class="wh-skill-roll-form">
            <div class="roll-dlg-header"><span>${label}</span></div>
            ${hideCharSelect ? "" : `<div class="roll-dlg-row">
              <label>Бросок с:</label>
              <select id="skill-char-select">${charOptions}</select>
            </div>`}
            <div class="roll-dlg-row">
              <label>Цель:</label>
              <input id="skill-target" type="number" value="${baseTotal}"/>
            </div>
            <div class="roll-dlg-row">
              <label>Модификатор:</label>
              <input id="skill-modifier" type="number" value="0"/>
            </div>
            ${hw.html}
            ${im.html}
            ${rl.html}
          </form>`,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок",
            callback: html => {
              if (!resolved) {
                resolved = true;
                let modifier = parseInt(html.find("#skill-modifier").val()) || 0;
                // Особенности родного мира: плюсы складываются, «Закалка»
                // Схолы Прогениум ополовинивает итоговый штраф.
                let halve = false;
                html.find(".hw-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                // Ситуативные модификаторы предметов (Черты/Таланты/etc. со
                // скрипт-записанным flags.warhammer-dbc.rollMods) — та же логика.
                html.find(".item-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                // Реестр правил (module/rules/) — та же логика.
                html.find(".rule-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                if (halve && modifier < 0) modifier = -Math.floor(Math.abs(modifier) / 2);
                resolve({
                  charKey:  html.find("#skill-char-select").val(),
                  target:   parseInt(html.find("#skill-target").val())   || 0,
                  modifier
                });
              }
            }
          },
          cancel: {
            label: "Отмена",
            callback: () => { if (!resolved) { resolved = true; resolve(null); } }
          }
        },
        default: "roll",
        render: html => {
          html.find("#skill-char-select").on("change", ev => {
            html.find("#skill-target").val(
              (this.actor.system.characteristics[ev.currentTarget.value]?.total ?? 0) + rankBonus
            );
          });
        },
        close: () => { if (!resolved) { resolved = true; resolve(null); } }
      }, { classes: ["dialog","wh-roll-dialog-window"], width: 340 });
      dialog.render(true);
    });
  }

  // ── Бросок навыка ─────────────────────────────────────────────────────────

  async _rollSkill(label, baseTotal, defaultChar, rollContext = null) {
    const result = await this._showSkillRollDialog(label, baseTotal, defaultChar, false, rollContext);
    if (!result) return;
    const { charKey, target, modifier } = result;

    const fatiguePenalty = this._getFatiguePenalty(defaultChar);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total → итог навыка)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    const roll     = await new Roll("1d100").evaluate();
    const rv       = roll.total;
    const charAbbr = CHARACTERISTICS[charKey]?.abbr ?? charKey;
    const rollMode = game.settings.get("core", "rollMode");
    const deg      = Math.floor(Math.abs(rv <= eff ? eff - rv : rv - eff) / 10) + 1;
    const outcome  = rv <= eff
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}</div>
          <div class="roll-threshold">
            ${charAbbr}: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  // ── Лечение / Первая Помощь ───────────────────────────────────────────────
  /** Диалог лечения: себя или выбранной цели (тест Медики/Стойкости). */
  _showHealingDialog() {
    return showHealingDialog(this.actor);
  }

  /** Расчёт и применение лечения к пациенту + сообщение в чат. */
  async _applyHealing(patient, { mode, care, mod, bonus }) {
    return applyHealing(this.actor, patient, { mode, care, mod, bonus });
  }

  // ── Очки Боли (Друкхари) ──────────────────────────────────────────────────
  /** Краткое сообщение о Боли в чат. */
  async _painChatMsg(text) {
    return painChatMsg(this.actor, text);
  }

  /** Впитать (+1) или потратить (−1) Очко Боли. */
  async _painChange(delta, kind) {
    return painChange(this.actor, delta, kind);
  }

  /** Выжигание Души / Варп-урон: Боль выжигается первой (3 урона за 1 Боль). */
  _painSoulBurn() {
    return openPainSoulBurnDialog(this.actor);
  }
  // ── Бросок характеристики ─────────────────────────────────────────────────

  async _rollCharacteristic(label, abbr, threshold, charKey, hideCharSelect = false) {
    const result = await this._showSkillRollDialog(label, threshold, charKey, hideCharSelect);
    if (!result) return;
    const { target, modifier } = result;

    const fatiguePenalty = this._getFatiguePenalty(charKey);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    const roll     = await new Roll("1d100").evaluate();
    const rv       = roll.total;
    const rollMode = game.settings.get("core", "rollMode");
    const deg      = Math.floor(Math.abs(rv <= eff ? eff - rv : rv - eff) / 10) + 1;
    const outcome  = rv <= eff
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${abbr} — ${label}</div>
          <div class="roll-threshold">
            Цель: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  _degWord(n) { return _degWord(n); }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ПСАЙКАНА
  // ══════════════════════════════════════════════════════════════════════════

  _resolvePsyCastAttr(sys) {
    return resolvePsyCastAttr(this.actor, sys);
  }

  _showManifestDialog(item) {
    return showManifestDialog(this.actor, item);
  }

  _wirePsyManifestPreview(html, meta) {
    return wirePsyManifestPreview(html, meta);
  }

  async _executePsychotest(item, opts) {
    return executePsychotest(this.actor, item, opts);
  }

  _rollPsyniscience() {
    return rollPsyniscience(this.actor, (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts));
  }

  /** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
  async _rollPsyWpTest(label, note) {
    return rollPsyWpTest(this.actor, label, note);
  }

  /** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
  async _activateNavigatorPower(item) {
    return activateNavigatorPower(this.actor, item);
  }

  /** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
  async _activateTechMiracle(item) {
    return activateTechMiracle(this.actor, item);
  }

  // ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
  async _techGenResource(item, opts) {
    return techGenResource(this.actor, item, opts);
  }

}

/** Подставляет бонусы характеристик в формулу и берёт первую (формульную) часть. */
// Делегирует единому каноническому резолверу (utils). corB — бонус Порчи (Cor.b).
function _resolveCharFormula(formula, chars, corB = 0) {
  return resolveCharFormula(formula, chars, corB);
}

// Метка характеристики с учётом мировоззрения: у Хаосита «Влияние» → «Бесчестие».
function _charLabel(key, alignment) {
  if (key === "inf" && alignment === "heretic") return "Бесчестие";
  return CHARACTERISTICS[key]?.label ?? key;
}

// Группировка каталога Даров Одержимого по группам (для вкладки «Одержимость»).
// activeSet — имена Даров, реально надетых на актора (подсветка «активен»).
function _groupGifts(activeSet = new Set()) {
  const order = ["Защита","Движение","Трансформация","Оружие","Усилители","Стрельба","Единение"];
  const map = new Map(order.map(g => [g, []]));
  for (const g of POSSESSION_GIFTS) {
    (map.get(g.group) || map.set(g.group, []).get(g.group)).push({
      name: g.name, cost: g.cost ? `${g.cost} xp` : "Базовый", sym: g.sym, text: g.text,
      active: activeSet.has(g.name)
    });
  }
  return order.map(g => ({ group: g, gifts: map.get(g) || [] }));
}

