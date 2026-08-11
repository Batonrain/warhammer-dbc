import { BODY_TYPES } from "../constants/body-map.mjs";
import { ELITE_ARCHETYPES } from "../constants/elite-archetypes.mjs";
import { HAEM_STAGES, HAEM_FLESH_TRAITS, HAEM_WARP_TRAITS, HAEM_TRAIT_MAP,
         isHaemonculus, haemState, traitCost } from "../constants/haemonculus.mjs";
// module/sheets/actor-sheet.mjs

import { CHARACTERISTICS, SKILL_RANKS, APTITUDES } from "../constants/characteristics.mjs";
import { talentCostXP, charCostXP, skillCostXP, aptitudeCat, charAptitudeSet, ALIGN_LABEL, CHAR_APTITUDES, raceAllyTalent,
         dynamicAptKind, resolveTalentAptitudes } from "../constants/advancement.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { ITEM_TYPES, GEAR_ITEM_TYPES, WEAPON_CLASSES, DAMAGE_TYPES } from "../constants/items.mjs";
import { resolveCultureFx, cultureCat } from "../constants/legions.mjs";
import { AZURIANE_PATHS, PATH_GRADES, PATH_GRADE_ORDER,
         buildPathSelectOptions, buildGradeSelectOptions } from "../constants/aeldari-paths.mjs";
import { buildWorldSelectOptions, buildBandSelectOptions,
         getWorld, getBand } from "../constants/aeldari-origins.mjs";
import { buildDrukhariFactionOptions, getDrukhariFaction,
         buildDrukhariDistrictOptions, getDrukhariDistrict } from "../constants/drukhari-factions.mjs";
import { buildMasqueOptions, getMasque } from "../constants/harlequin-masques.mjs";
import { MELEE_STANCES, MELEE_TECHNIQUES, GRIPS, parseGrips, gripEffects } from "../constants/combat.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, fateTerm } from "../helpers/utils.mjs";
import { buildSkillDisplay, buildGetData,
         CONDITIONS_DEF }                  from "./sheet-helpers.mjs";
import { _executeAttackRoll }              from "../combat/attack.mjs";
import { attackThreshold }                 from "../combat/attack-threshold.mjs";
import { _executeFearRoll, _executeTraumaRoll } from "../combat/fear.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto,
         buildTargetEffectButtons, buildPropertyChatBlock } from "../combat/weapon-properties.mjs";
import { WEAPON_PROPERTIES } from "../constants/weapon-properties.mjs";
import { mutationByRoll, giftByRoll, mutationCatalog, mutationItemData,
         GOD_GIFTS } from "../constants/mutations.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../combat/weapon-mods.mjs";
import { qualityEffects }                   from "../constants/quality.mjs";
import { _resolveSoulBurn }                 from "../hooks.mjs";
import { _performDodge, _performParry }    from "../combat/defense.mjs";
import { _reloadWeapon, _getCompatibleAmmo,
         _showAmmoSelectDialog }           from "../combat/reload.mjs";
import { _showContestDialog }              from "../combat/techniques.mjs";
import { openRigManager }                   from "../apps/rig-manager.mjs";
import { openSurgeon }                       from "../apps/surgeon.mjs";
import { infamyContext, changeInfamy, restoreInfamy, spendInfamy } from "../apps/infamy-points.mjs";
import { promptStatAdd } from "../apps/stat-log.mjs";
import { CHAOS_PATRONS, chaosPatronMeta } from "../constants/chaos-patron.mjs";
import { RACES, SUBRACES, SUBRACE_DATA,
         RACE_GROUPS, AELDARI_RACES, AELDARI_PATHS } from "../constants/races.mjs";
import { getLegion, getChapter, buildLegionOptions, buildChapterOptions, buildCultureLegionOptions, resolveCulture } from "../constants/legions.mjs";
import { FEAR_RATINGS,
         MENTAL_DISORDERS,
         DISORDER_LIBRARY, rollDisorderEntry }      from "../constants/fear-tables.mjs";
import { archetypeEntries, archetypesForRace, archetypeSheetContext, applyArchetype } from "../apps/archetypes.mjs";
import { MECHANICUS_IMPLANTS, SKITARII_WAR_PLATE } from "../constants/implants.mjs";
import { _toggleShield,
         _rollShieldActivation,
         _repairShield }                   from "../combat/shield.mjs";
import { WarhammerItemSheet } from "./item-sheet.mjs";
import { PSY_NATURES, PSY_MODES, PSY_PATHS, PSY_POWER_TYPES } from "../constants/psyker.mjs";
import { PSY_DISCIPLINES } from "../constants/disciplines.mjs";
import { getPhenomenon, getPeril } from "../constants/psyker-tables.mjs";
import { techIcon } from "../constants/tech-icons.mjs";
import { ironModForQuality, leastQuality } from "../constants/implant-mechanics.mjs";
import { TWIN_SPIRIT_DEMONS, twinSpiritMeta, manifestProfile,
         POSSESSION_GIFTS, POSSESSION_TALENTS } from "../constants/possession.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { beginTargeting } from "../combat/aim.mjs";
import { HOMEWORLD_BY_KEY, homeworldRollMods, matchesContext } from "../constants/homeworlds.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { checkRequirement } from "../constants/talent-requirements.mjs";
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
import { syncGrantedEquipment } from "../apps/mechanics.mjs";

// 9 основных характеристик, в которые Мастер создания кидает 2d10 (корник вахи).
// Влияние (inf) сюда не входит — оно от arch.infRoll.
const CREATION_ROLL_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

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
// Плейсхолдер невыбранной специализации группового навыка («любые N», стр. 5-21).
const WILD_SPEC = "— выбери —";
// Специализации, в названии которых ЕСТЬ запятая — их нельзя резать по запятой
// (стр. 58: «Warp, Daemons and Psykers» — одно комбинированное знание, которое
// «может использоваться вместо любого из троих и подвигается как одно»).
const COMBINED_SPECS = new Set([
  "warp, daemons and psykers",
  "варп, демоны и псайкеры"
]);

// ── Локализация навыков/специализаций для мастера (англ. данные → русский) ──
const _EN_SKILL = {
  "acrobatics":"acrobatics","athletics":"athletics","awareness":"awareness","charm":"charm",
  "command":"command","commerce":"commerce","deceive":"deceive","dodge":"dodge","inquiry":"inquiry",
  "interrogate":"interrogate","intimidate":"intimidate","logic":"logic","medicae":"medicae",
  "parry":"parry","psyniscience":"psyniscience","scrutiny":"scrutiny","security":"security",
  "sleight of hand":"sleightOfHand","stealth":"stealth","survival":"survival","tech-use":"techUse","tech use":"techUse"
};
const _EN_GROUP = {
  "common lore":"commonLore","forbidden lore":"forbiddenLore","scholastic lore":"scholasticLore",
  "schol. lore":"scholasticLore","linguistics":"linguistics","navigation":"navigation",
  "navigate":"navigation","operate":"operate","trade":"trade"
};
const _SPEC_RU = {
  // Чувства
  "sight":"Зрение","hearing":"Слух","smell":"Обоняние","taste":"Вкус","touch":"Осязание","all":"Все",
  // Типы оружия
  "bolt":"Болтерное","flame":"Зажигательное","grav":"Гравитонное","las":"Лазерное","launcher":"Пусковое",
  "melta":"Мельта","plasma":"Плазма","power":"Силовое","shock":"Шоковое","chain":"Цепное","bow":"Лук",
  "solid projectile":"Твердотельное","primary":"Основное","primitive":"Примитивное","exotic":"Экзотическое",
  "flechette":"Флешетты","needle":"Игольное","galvanic":"Гальваническое","rad":"Радиационное",
  // Сопротивления
  "cold":"Холод","blindness":"Слепота","deafness":"Глухота","disease":"Болезни","fear":"Страх",
  "heat":"Жар","poison":"Яды","poisons":"Яды","psychic powers":"Психосилы","stun":"Оглушение","radiation":"Радиация",
  // Знания/языки
  "imperium":"Империум","war":"Война","chaos":"Хаос","astartes":"Астартес","adeptus astartes":"Астартес",
  "adeptus mechanicus":"Механикус","mechanicus":"Механикус","daemons":"Демоны","warp":"Варп","heresy":"Ересь",
  "horus heresy and long war":"Ересь Хоруса и Долгая Война","xenos":"Ксеносы","psykers":"Псайкеры","mutants":"Мутанты",
  "heraldry":"Геральдика","codex astartes":"Кодекс Астартес","legend":"Легенды","legends":"Легенды",
  "numerology":"Нумерология","occult":"Оккультизм","beasts":"Звери","pirates":"Пираты",
  "high gothic":"Высокий Готик","low gothic":"Низкий Готик","battle cant":"Боевой Язык","battle kant":"Боевой Язык",
  "druchii":"Друкхари","lameldannar":"ЛамЭлданнар","lameldannar druchii":"ЛамЭлданнар (Друкхари)",
  "aeldari":"Аэльдари","corsair":"Корсар","eldar":"Эльдар","chaos glyphs":"Глифы Хаоса","true tongue":"Истинный Язык",
  "inquisition":"Инквизиция","navigators":"Навигаторы","xenobiology":"Ксенобиология","tactica imperialis":"Тактика Империалис"
};
const _norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
function ruSpec(x) { return _SPEC_RU[_norm(x)] || String(x).trim(); }
// Один элемент строки навыков → русский («Common Lore (Druchii) +10» → «Общие Знания (Друкхари) +10»).
function ruSkillEntry(str) {
  let s = String(str).trim();
  const rk = (s.match(/\+(\d+)/) || [])[1]; const suf = rk ? ` +${rk}` : "";
  s = s.replace(/\+\d+/, "").trim();
  const gm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (gm) {
    const base = _norm(gm[1]); const inside = gm[2].trim();
    const gk = _EN_GROUP[base]; const sk = _EN_SKILL[base];
    const lbl = gk ? GROUP_SKILLS_DEF[gk]?.label : (sk ? SKILLS_DEF[sk]?.label : gm[1].trim());
    if (/люб/i.test(inside)) return `${lbl} (${inside})${suf}`;
    const specs = inside.split(/\s*,\s*/).map(x => ruSpec(x)).join(", ");
    return `${lbl} (${specs})${suf}`;
  }
  const sk = _EN_SKILL[_norm(s)];
  return (sk ? SKILLS_DEF[sk]?.label : s) + suf;
}
// Полная строка навыков (через запятую, с учётом «или»/скобок) → русский.
function ruSkillString(str) {
  if (!str) return "";
  // Разбиваем по запятым верхнего уровня (скобки не трогаем).
  const out = []; let d = 0, cur = "";
  for (const ch of String(str)) { if (ch === "(") d++; else if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; }
  if (cur.trim()) out.push(cur);
  return out.map(e => {
    const parts = e.split(/\s+или\s+/);
    return parts.map(p => ruSkillEntry(p)).join(" или ");
  }).join(", ");
}

/**
 * Машинная культура легиона персонажа. Культура может быть от ДРУГОГО легиона,
 * чем геносемя (в системе это отдельные поля), поэтому берём именно её.
 */
function cultFxOf(actor) {
  const gs = actor?.system?.geneSeed;
  if (!gs) return null;
  return resolveCultureFx(gs.cultureLegion || gs.legion, gs.cultureChapter || gs.chapter);
}

/**
 * Позиция окна-пикера: Foundry считает top по запрошенной высоте, а окно
 * потом дорастает содержимым и уезжает вниз за край экрана. Считаем сами:
 * ужимаем размер под окно браузера и центрируем.
 */
/**
 * Доводит окно-пикер по месту ПОСЛЕ отрисовки. Foundry считает top по
 * запрошенной высоте, а окно потом дорастает содержимым и уезжает вниз —
 * поэтому меряем фактический размер элемента и центрируем сами.
 * Заодно гасим Enter в строке поиска: диалог принимал его за нажатие
 * кнопки по умолчанию и закрывался.
 */
function centerPicker(html) {
  const el = html.closest?.(".app")?.[0] ?? html[0]?.closest?.(".app");
  if (!el) return;
  requestAnimationFrame(() => {
    const h = Math.min(el.offsetHeight || 0, window.innerHeight - 40);
    const w = Math.min(el.offsetWidth  || 0, window.innerWidth  - 40);
    if (!h || !w) return;
    el.style.height = `${h}px`;
    el.style.top    = `${Math.max(10, Math.round((window.innerHeight - h) / 2))}px`;
    el.style.left   = `${Math.max(10, Math.round((window.innerWidth  - w) / 2))}px`;
  });
  html.find(".pick-search").on("keydown", ev => {
    if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); }
  });
}

function pickerPos(width, height) {
  const w = Math.min(width, window.innerWidth - 40);
  const h = Math.min(height, window.innerHeight - 80);
  return {
    width: w, height: h,
    left: Math.max(10, Math.round((window.innerWidth - w) / 2)),
    top:  Math.max(10, Math.round((window.innerHeight - h) / 2))
  };
}

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
    if (context.isHaemonculus) context.haem = this._haemContext();

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
    if (raceAllyTalent(this.actor.system.race, name)) return "ally";
    return cultureCat("talent", name, folder, cultFxOf(this.actor));
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
    const fatigueExempt = ["t", "inf", "cog", "pf"];
    // Добывающий мир, «Потом и кровью»: штрафы начинаются лишь после T.b Усталости.
    const hw = HOMEWORLD_BY_KEY[actorHomeworldKey(this.actor)];
    const grace = hw?.fatigueGrace === "tBonus" ? (this.actor.system.characteristics?.t?.bonus ?? 0) : 0;
    if ((this.actor.system.fatigue?.value ?? 0) < 1 + grace) return 0;
    if (fatigueExempt.includes((charKey ?? "").toLowerCase())) return 0;
    return -10;
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

  /** Разбивает строку по запятым верхнего уровня (запятые внутри скобок не режут). */
  _splitTopLevel(str) {
    const out = []; let depth = 0, cur = "";
    for (const ch of String(str)) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
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
    for (const r of (rawList || [])) for (const e of this._splitTopLevel(String(r))) entries.push(e);
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

  /**
   * Пикер добавления Талантов/Черт прямо с листа (без лазания в компендиум).
   * Группировка по типам корбука (папки компендиума, стр. 62-105) + Аэльдари.
   * Поиск, раскрытие описания стрелкой, добавление по «＋». kind: "talent"|"trait".
   */
  async _openItemPicker(kind) {
    const PACKS = { trait: "warhammer-dbc.traits", mutation: "warhammer-dbc.mutations",
                    talent: "warhammer-dbc.talents" };
    const packName = PACKS[kind] || PACKS.talent;
    const pack = game.packs.get(packName);
    if (!pack) return ui.notifications.warn(`Компендиум не найден: ${packName}`);
    const docs = await pack.getDocuments();
    const esc  = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

    // Группировка по папкам (учёт родителя) + порядок по folder.sort (порядок корбука).
    const groups = new Map();
    for (const d of docs) {
      const f = d.folder;
      const parent = f?.folder?.name || "";
      const label  = f ? (parent ? `${parent} · ${f.name}` : f.name) : "Прочее";
      const sort   = (f?.folder?.sort ?? 900000) * 1000 + (f?.sort ?? 0);
      const lock   = f ? this._talentGroupLock(kind, parent, f.name) : null;
      if (!groups.has(label)) groups.set(label, { sort, items: [], lock });
      groups.get(label).items.push(d);
    }
    const ordered = [...groups.entries()].sort((a, b) => a[1].sort - b[1].sort || a[0].localeCompare(b[0], "ru"));
    const kindLabel = kind === "trait" ? "черты" : (kind === "mutation" ? "мутации" : "таланта");
    // Склонности персонажа — для авто-цены таланта (стр. 23-24).
    // У Орды нет ни Склонностей, ни Опыта: цены не показываем и не начисляем.
    const hasXP    = Array.isArray(this.actor.system.aptitudes);
    const charApts = charAptitudeSet(this.actor.system.aptitudes || []);

    const body = ordered.map(([label, g]) => {
      const rows = g.items
        .sort((a, b) => ((a.system.tier || 0) - (b.system.tier || 0)) || a.name.localeCompare(b.name, "ru"))
        .map(d => {
          const tier = (kind === "talent" && d.system.tier) ? `<span class="pick-tier">Ур.${d.system.tier}</span>` : "";
          // Требования сверяются с листом: невыполненные подсвечиваются красным.
          const chk  = d.system.requirement ? checkRequirement(this.actor, d.system.requirement)
                                            : { state: "ok", unmet: [] };
          const reqTitle = chk.state === "fail"
            ? `Не выполнено: ${esc(chk.unmet.join(", "))}`
            : (chk.state === "unknown" ? "Требование не удалось проверить автоматически" : "Требования выполнены");
          const req  = d.system.requirement
            ? `<span class="pick-req pick-req-${chk.state}" title="${reqTitle}">${esc(d.system.requirement)}</span>`
            : "";
          const ben  = esc(d.system.benefit || d.system.description || "—");
          let cost = "";
          if (kind === "talent" && hasXP) {
            // Mastery / Beyond Human наследуют склонности выбранной Х-ки/Навыка
            // (стр. 62) — цена станет известна только после выбора привязки.
            const dyn = dynamicAptKind(d.name);
            if (dyn) {
              const range = this._dynamicTalentCostRange(d, charApts, dyn);
              cost = `<span class="pick-cost cost-dyn" title="Склонности «как у ${dyn === "char" ? "Характеристики" : "Навыка"}» — цена зависит от выбора при покупке (стр. 62)">${range} XP</span>`;
            } else {
              const forced = this._talentCat(d.name, d.folder);
              const cat = forced === "ally" ? "ally" : aptitudeCat(charApts, d.system.aptitudes || []);
              const xp  = talentCostXP(d.system.tier, d.system.aptitudes || [], charApts,
                this._talentCat(d.name, d.folder));
              cost = `<span class="pick-cost cost-${cat}" title="${ALIGN_LABEL[cat]} — совпадений склонностей: ${(d.system.aptitudes||[]).filter(a=>charApts.has(a)).length}">${xp} XP</span>`;
            }
          }
          const addBtn = g.lock
            ? `<button type="button" class="pick-add" data-id="${d.id}" disabled title="${esc(g.lock)}">🔒</button>`
            : `<button type="button" class="pick-add" data-id="${d.id}" title="Купить и добавить на лист">＋</button>`;
          return `<div class="pick-row${chk.state === "fail" ? " pick-unmet" : ""}${g.lock ? " pick-row-locked" : ""}" data-name="${esc(String(d.name).toLowerCase())}" data-req="${chk.state}">
            <div class="pick-head">
              <button type="button" class="pick-exp" title="Показать описание">▸</button>
              <span class="pick-name" title="Раскрыть">${esc(d.name)}</span>${tier}${req}${cost}
              ${addBtn}
            </div>
            <div class="pick-desc" style="display:none;">${ben}</div>
          </div>`;
        }).join("");
      const unmet = (rows.match(/class="pick-row[^"]*pick-unmet/g) || []).length;
      const lockHtml = g.lock
        ? `<span class="pick-count pick-count-locked" title="${esc(g.lock)}">🔒 ${esc(g.lock)}</span>` : "";
      return `<div class="pick-group pick-collapsed${g.lock ? " pick-group-locked" : ""}">
        <div class="pick-group-head" title="Свернуть / развернуть">
          <span class="pick-caret">▸</span>${esc(label)}
          <span class="pick-count">${g.items.length}</span>
          ${unmet ? `<span class="pick-count pick-count-unmet" title="Требования не выполнены">${unmet}</span>` : ""}
          ${lockHtml}
        </div>
        <div class="pick-group-body">${rows}</div></div>`;
    }).join("");

    // Гейтинг папок (_talentGroupLock) действует только у Талантов — только там
    // и показываем управление им (скрыть недоступное / разблокировать покупку).
    const gateControls = kind === "talent" ? `
      <div class="pick-top pick-top-gate">
        <label class="pick-hide-locked-label">
          <input type="checkbox" class="pick-hide-locked-cb"/> Скрывать недоступные
        </label>
        <button type="button" class="pick-force-unlock"
                title="Разблокирует покупку талантов из закрытых групп, даже если персонаж не подходит под условие">
          🔒 Разрешить покупку при несоответствии
        </button>
      </div>` : "";

    const content = `<div class="wh-item-picker">
      <div class="pick-top">
        <input type="text" class="pick-search" placeholder="Поиск ${kindLabel}…"/>
        <button type="button" class="pick-custom" title="Создать свой ${kindLabel} с нуля">＋ Своё</button>
      </div>
      ${gateControls}
      <div class="pick-list">${body || "<em>Пусто</em>"}</div>
    </div>`;

    new Dialog({
      title: kind === "trait" ? "Добавить черту" : (kind === "mutation" ? "Добавить мутацию / Дар" : "Добавить талант"),
      content,
      buttons: { close: { label: "Закрыть" } },
      default: "close",
      render: html => {
        centerPicker(html);
        // Скрыть недоступные группы / разблокировать покупку из них вопреки
        // условию — только пока диалог открыт, ничего не сохраняется.
        let hideLocked = false;
        let forceUnlock = false;
        // Своё с нуля — пустой предмет + открыть его лист.
        html.find(".pick-custom").on("click", async ev => {
          ev.preventDefault();
          const item = await Item.create({ name: kind === "trait" ? "Новая черта" : (kind === "mutation" ? "Новая мутация" : "Новый талант"), type: kind }, { parent: this.actor });
          item?.sheet?.render(true);
        });
        html.find(".pick-add").on("click", async ev => {
          ev.preventDefault(); ev.stopPropagation();
          const d = docs.find(x => x.id === ev.currentTarget.dataset.id);
          if (!d) return;
          const dFolder = d.folder;
          const lock = dFolder ? this._talentGroupLock(kind, dFolder.folder?.name || "", dFolder.name) : null;
          if (lock && !forceUnlock) return ui.notifications.warn(`Недоступно: ${lock}`);
          const obj = d.toObject();
          if (kind === "talent" && hasXP) {
            // Авто-цена по склонностям; помечаем как купленный (учитывается в Опыте).
            obj.system = obj.system || {};
            const dyn = dynamicAptKind(d.name);
            if (dyn) {
              // Mastery / Beyond Human: сначала выбор привязки (стр. 62), затем
              // цена по склонностям выбранной Характеристики/Навыка (стр. 23-24).
              const pick = await this._promptDynamicAptTalent(d, dyn, charApts);
              if (!pick) return;                       // отмена — ничего не покупаем
              obj.system.specialization = pick.label;
              obj.system.aptitudes      = pick.apts;   // фиксируем на предмете
              obj.system.aptSource      = pick.key;    // ключ Х-ки/навыка для пересчёта
              obj.system.cost           = pick.cost;
            } else {
              obj.system.cost = talentCostXP(d.system.tier, d.system.aptitudes || [], charApts,
                this._talentCat(d.name, d.folder));
            }
            obj.system.purchased = true;
          }
          await this.actor.createEmbeddedDocuments("Item", [obj]);
          ui.notifications.info(kind === "talent" && obj.system?.cost
            ? `Куплено: ${d.name} (−${obj.system.cost} XP)` : `Добавлено: ${d.name}`);
          $(ev.currentTarget).closest(".pick-row").addClass("just-added");
        });
        const toggle = row => {
          const desc = row.querySelector(".pick-desc");
          const exp  = row.querySelector(".pick-exp");
          const open = desc.style.display !== "none";
          desc.style.display = open ? "none" : "block";
          exp.textContent = open ? "▸" : "▾";
        };
        html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
        html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));

        // Категории свёрнуты по умолчанию — раскрываются кликом по заголовку.
        html.find(".pick-group-head").on("click", ev => {
          const grp = ev.currentTarget.closest(".pick-group");
          const collapsed = grp.classList.toggle("pick-collapsed");
          const caret = grp.querySelector(".pick-caret");
          if (caret) caret.textContent = collapsed ? "▸" : "▾";
        });

        // Видимость групп: скрытые по поиску (нет совпадений) ИЛИ, если включён
        // чекбокс «Скрывать недоступные», заблокированные по условию листа.
        const applyGroupVisibility = () => {
          const q = html.find(".pick-search").val().toLowerCase().trim();
          html.find(".pick-group").each((_, gr) => {
            if (hideLocked && gr.classList.contains("pick-group-locked")) { gr.style.display = "none"; return; }
            const hits = gr.querySelectorAll(".pick-row:not(.pick-hidden)").length;
            gr.style.display = hits ? "" : "none";
            // При поиске раскрываем найденное, при пустой строке — снова свернуть.
            gr.classList.toggle("pick-collapsed", !q);
            const caret = gr.querySelector(".pick-caret");
            if (caret) caret.textContent = q ? "▾" : "▸";
          });
        };

        html.find(".pick-search").on("input", ev => {
          const q = ev.currentTarget.value.toLowerCase().trim();
          html.find(".pick-row").each((_, r) => { r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q)); });
          applyGroupVisibility();
        });

        html.find(".pick-hide-locked-cb").on("change", ev => {
          hideLocked = ev.currentTarget.checked;
          applyGroupVisibility();
        });

        // Разрешить покупку из закрытых групп вопреки условию — снимает
        // disabled и меняет 🔒 на ＋ у всех уже отрисованных «недоступных» кнопок.
        html.find(".pick-force-unlock").on("click", ev => {
          ev.preventDefault();
          forceUnlock = !forceUnlock;
          const btn = ev.currentTarget;
          btn.classList.toggle("on", forceUnlock);
          btn.textContent = forceUnlock ? "🔓 Покупка разрешена вопреки условию" : "🔒 Разрешить покупку при несоответствии";
          html.find(".pick-row-locked .pick-add").each((_, b) => {
            b.disabled = !forceUnlock;
            b.textContent = forceUnlock ? "＋" : "🔒";
            if (forceUnlock) b.title = `Доступно вопреки условию: ${b.title}`;
            else b.title = b.title.replace(/^Доступно вопреки условию: /, "");
          });
        });
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(580, 660) }).render(true);
  }

  /**
   * Список вариантов привязки для Mastery / Beyond Human (стр. 62) с ценой
   * каждого: талант наследует ОБЕ склонности выбранной Характеристики/Навыка.
   * @returns {{key,label,apts,cat,cost}[]} отсортировано по возрастанию цены
   */
  _dynamicTalentOptions(doc, kind, charApts) {
    const defs = { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF };
    const tier = doc.system?.tier || 3;
    const src  = kind === "char"
      ? Object.entries(CHAR_APTITUDES).map(([k]) => [k, CHARACTERISTICS[k]?.label || k.toUpperCase()])
      : [...Object.entries(SKILLS_DEF).map(([k, v]) => [k, v.label]),
         ...Object.entries(GROUP_SKILLS_DEF).map(([k, v]) => [k, `${v.label} (группа)`])];
    return src.map(([key, label]) => {
      const apts = resolveTalentAptitudes(doc.name, doc.system?.aptitudes || [], key, defs);
      const cat  = aptitudeCat(charApts, apts);
      return { key, label, apts, cat, cost: talentCostXP(tier, apts, charApts,
        this._talentCat(label)) };
    }).sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label, "ru"));
  }

  /** Компактная запись «мин–макс XP» для бейджа в пикере. */
  _dynamicTalentCostRange(doc, charApts, kind) {
    const opts = this._dynamicTalentOptions(doc, kind, charApts);
    if (!opts.length) return "?";
    const lo = opts[0].cost, hi = opts[opts.length - 1].cost;
    return lo === hi ? String(lo) : `${lo}–${hi}`;
  }

  /**
   * Диалог привязки Mastery / Beyond Human: выбор Характеристики или Навыка,
   * от которого талант берёт склонности (и, как следствие, цену).
   */
  _promptDynamicAptTalent(doc, kind, charApts) {
    const opts = this._dynamicTalentOptions(doc, kind, charApts);
    const esc  = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const what = kind === "char" ? "Характеристика" : "Навык";
    const rows = opts.map(o =>
      `<option value="${esc(o.key)}" data-cost="${o.cost}" data-cat="${o.cat}">
         ${esc(o.label)} — ${o.cost} XP (${ALIGN_LABEL[o.cat]})
       </option>`).join("");

    return new Promise(resolve => {
      new Dialog({
        title: `${doc.name}: выбор привязки`,
        content: `
          <form class="wh-dyn-apt">
            <p class="dyn-hint">Талант наследует склонности выбранн${kind === "char" ? "ой Характеристики" : "ого Навыка"}
               (стр. 62), поэтому от выбора зависит цена (стр. 23-24).</p>
            <div class="atk-dlg-row">
              <label>${what}:</label>
              <select id="dyn-apt-sel" class="pm-input pm-wide">${rows}</select>
            </div>
            <div class="dyn-preview" id="dyn-preview"></div>
          </form>`,
        buttons: {
          ok: {
            label: "Купить",
            callback: html => {
              const key = String(html.find("#dyn-apt-sel").val() || "");
              resolve(opts.find(o => o.key === key) || null);
            }
          },
          cancel: { label: "Отмена", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null),
        render: html => {
          const upd = () => {
            const o = opts.find(x => x.key === String(html.find("#dyn-apt-sel").val() || ""));
            if (!o) return;
            html.find("#dyn-preview").html(
              `<span class="pick-cost cost-${o.cat}">${o.cost} XP</span>
               <span class="dyn-apts">склонности: ${o.apts.map(a => APTITUDES[a] || a).join(" + ")}</span>`);
          };
          html.find("#dyn-apt-sel").on("change", upd);
          upd();
        }
      }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-dyn-apt-dialog"], width: 460 }).render(true);
    });
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

  /**
   * Бросок 1d100 по ОБЩЕМУ ПУЛУ — либо таблица Общих Мутаций (стр. 440), либо
   * таблица Даров выбранного Бога (стр. 453-460); тип выбирается в диалоге,
   * один и тот же бросок переинтерпретируется по нужной таблице. Сдвиг ±Inf.b
   * (если результат НЕ от Порчи за Провал) работает одинаково для обеих
   * веток — раньше был только у Мутаций. Неделимые бросают дважды и выбирают
   * результат — только для ветки Мутаций (по тексту книги, Дары привязаны к
   * конкретному Богу-покровителю и не имеют двойного броска).
   */
  async _rollMutationOrGift() {
    const infB = this.actor.system.characteristics?.inf?.bonus ?? 0;
    const patron = this.actor.system.patronGod || "";
    const undivided = patron === "undivided";
    const roll1 = await new Roll("1d100").evaluate();
    const roll2 = undivided ? await new Roll("1d100").evaluate() : null;
    const defaultGod = GOD_GIFTS[patron] ? patron : Object.keys(GOD_GIFTS)[0];
    const godOptions = Object.entries(GOD_GIFTS)
      .map(([k, g]) => `<option value="${k}" ${k === defaultGod ? "selected" : ""}>${g.label}</option>`).join("");
    const resultName = (type, god, val) => type === "gift" ? (giftByRoll(god, val)?.name || "—") : mutationByRoll(val);

    const content = `
      <form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип:</label>
          <select id="mg-type" class="pm-input">
            <option value="mutation">Мутация (Общие, стр. 440)</option>
            <option value="gift">Дар Бога (стр. 453-460)</option>
          </select></div>
        <div class="atk-dlg-row" id="mg-god-row"><label>Бог-покровитель:</label>
          <select id="mg-god" class="pm-input">${godOptions}</select></div>
        <div class="atk-dlg-row"><label>Бросок:</label><span><b>${roll1.total}</b></span></div>
        ${roll2 ? `<div class="atk-dlg-row"><label>Второй (Неделимый):</label><span><b>${roll2.total}</b></span></div>
        <div class="atk-dlg-row" id="mg-which-row"><label>Использовать:</label>
          <select id="mg-which"><option value="1">Первый (${roll1.total})</option><option value="2">Второй (${roll2.total})</option></select></div>` : ""}
        <div class="atk-dlg-row">
          <label>Сдвиг (±Inf.b ${infB}):</label>
          <input type="number" id="mg-shift" value="0" min="-${infB}" max="${infB}"
                 title="Только если результат НЕ от Порчи за Провал"/>
        </div>
        <div class="atk-dlg-row"><label>Итог:</label><b id="mg-result">${resultName("mutation", defaultGod, roll1.total)}</b></div>
      </form>`;

    new Dialog({
      title: "🧬 Мутация / Дар Бога",
      content,
      buttons: {
        ok: { label: "Получить", callback: async (html) => {
          const type  = String(html.find("#mg-type").val() || "mutation");
          const god   = String(html.find("#mg-god").val() || defaultGod);
          const base  = (roll2 && type === "mutation" && html.find("#mg-which").val() === "2") ? roll2.total : roll1.total;
          const shift = Math.max(-infB, Math.min(infB, parseInt(html.find("#mg-shift").val()) || 0));
          const val   = base + shift;
          const name  = resultName(type, god, val);
          const data  = foundry.utils.deepClone(mutationItemData(name, type === "gift" ? god : ""));
          delete data.folder; delete data.folderParent;
          const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div class="wh-roll-result"><div class="roll-header">${type === "gift" ? `Дар ${GOD_GIFTS[god]?.label || god}` : "Мутация"}</div>
              <div class="roll-statline"><span class="roll-stat"><label>Бросок</label><b>${base}</b></span>
              ${shift ? `<span class="roll-stat"><label>Сдвиг</label><b>${shift > 0 ? "+" : ""}${shift}</b></span>` : ""}
              <span class="roll-stat"><label>Итог</label><b>${val}</b></span></div>
              <div class="roll-outcome"><b>${name}</b></div></div>`,
            rolls: [roll1, ...(roll2 ? [roll2] : [])]
          });
          item?.sheet?.render(true);
        }},
        cancel: { label: "Отмена" }
      },
      default: "ok",
      render: html => {
        const syncVisibility = () => {
          const type = html.find("#mg-type").val();
          html.find("#mg-god-row").toggle(type === "gift");
          html.find("#mg-which-row").toggle(!!roll2 && type === "mutation");
        };
        const upd = () => {
          const type  = html.find("#mg-type").val();
          const god   = html.find("#mg-god").val();
          const base  = (roll2 && type === "mutation" && html.find("#mg-which").val() === "2") ? roll2.total : roll1.total;
          const shift = Math.max(-infB, Math.min(infB, parseInt(html.find("#mg-shift").val()) || 0));
          html.find("#mg-result").text(resultName(type, god, base + shift));
        };
        syncVisibility();
        html.find("#mg-type").on("change", () => { syncVisibility(); upd(); });
        html.find("#mg-god, #mg-shift, #mg-which").on("input change", upd);
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 420 }).render(true);
  }

  /**
   * Пикер общего пула Мутаций (стр. 440-452) и Даров Богов (стр. 453-460):
   * список прямо из таблиц книги, поэтому работает и до того, как соберётся
   * компендиум. Один объединённый пул — можно выбрать ЛЮБУЮ запись, не
   * ограничиваясь Богом-покровителем персонажа.
   */
  async _openMutationPicker() {
    const cat = mutationCatalog();
    const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const row = (x) => `
      <div class="pick-row" data-name="${esc(x.name.toLowerCase())}">
        <div class="pick-head">
          <button type="button" class="pick-exp" title="Показать описание">▸</button>
          <span class="pick-name" title="Раскрыть">${esc(x.name)}</span>
          <span class="pick-req">d100 ${esc(x.range)}</span>
          <button type="button" class="pick-add" data-name="${esc(x.name)}" data-god="${esc(x.god)}"
                  title="Добавить на лист">＋</button>
        </div>
        <div class="pick-desc" style="display:none;">${esc(x.text) || "<em>Описание ещё не перенесено из книги</em>"}</div>
      </div>`;
    const groups = [
      { label: "Общие мутации (стр. 440)", items: cat.common },
      ...cat.gifts.map(g => ({ label: `Дары — ${g.label}`, items: g.items }))
    ];

    const body = groups.map(g => `
      <div class="pick-group">
        <div class="pick-group-head">${esc(g.label)} <span class="pick-count">${g.items.length}</span></div>
        <div class="pick-group-body">${g.items.map(row).join("")}</div>
      </div>`).join("");

    new Dialog({
      title: "Добавить мутацию или Дар Бога",
      content: `<div class="wh-item-picker">
        <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск…"/></div>
        <div class="pick-list">${body}</div>
      </div>`,
      buttons: { close: { label: "Закрыть" } },
      default: "close",
      render: html => {
        centerPicker(html);
        html.find(".pick-add").on("click", async ev => {
          ev.preventDefault(); ev.stopPropagation();
          const { name, god } = ev.currentTarget.dataset;
          const data = foundry.utils.deepClone(mutationItemData(name, god));
          delete data.folder; delete data.folderParent;
          await this.actor.createEmbeddedDocuments("Item", [data]);
          ui.notifications.info(`Добавлено: ${name}`);
          $(ev.currentTarget).closest(".pick-row").addClass("just-added");
        });
        const toggle = (r) => {
          const d = r.querySelector(".pick-desc"), e = r.querySelector(".pick-exp");
          const open = d.style.display !== "none";
          d.style.display = open ? "none" : "block";
          e.textContent = open ? "▸" : "▾";
        };
        html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
        html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
        html.find(".pick-search").on("input", ev => {
          const q = ev.currentTarget.value.toLowerCase().trim();
          // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
          // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
          // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
          // фильтровался вовсе.
          html.find(".pick-row").each((_, r) => {
            r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
          });
          html.find(".pick-group").each((_, g) => {
            g.style.display = g.querySelectorAll(".pick-row:not(.pick-hidden)").length ? "" : "none";
          });
        });
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(560, 640) }).render(true);
  }

  /**
   * Пикер СНАРЯЖЕНИЯ из компендиумов: оружие, броня, щиты, боеприпасы,
   * снаряжение и инструменты. В одном стиле с пикерами талантов и мутаций:
   * вкладки-категории, поиск, раскрытие описания, добавление по «＋».
   */
  async _openGearPicker() {
    const PACKS = [
      { id: "warhammer-dbc.weapons",   label: "Оружие" },
      { id: "warhammer-dbc.armor",     label: "Броня" },
      { id: "warhammer-dbc.shields",   label: "Силовые щиты" },
      { id: "warhammer-dbc.ammunition",label: "Боеприпасы" },
      { id: "warhammer-dbc.gear",      label: "Снаряжение" },
      { id: "warhammer-dbc.tools",     label: "Инструменты" }
    ];
    const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

    // Загружаем только существующие паки (часть может быть не установлена).
    const groups = [];
    for (const p of PACKS) {
      const pack = game.packs.get(p.id);
      if (!pack) continue;
      const docs = await pack.getDocuments();
      if (!docs.length) continue;
      // Внутри пака — разбивка по папкам компендиума (Стрелковое/Рукопашное/…).
      const byFolder = new Map();
      for (const d of docs) {
        const f = d.folder;
        const parent = f?.folder?.name || "";
        const label  = f ? (parent ? `${parent} · ${f.name}` : f.name) : "Прочее";
        if (!byFolder.has(label)) byFolder.set(label, []);
        byFolder.get(label).push(d);
      }
      groups.push({ pack: p, folders: [...byFolder.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "ru")) });
    }
    if (!groups.length) return ui.notifications.warn("Компендиумы снаряжения не найдены.");

    // Краткая строка характеристик — чтобы выбирать, не открывая лист.
    const statLine = (d) => {
      const g = d.system || {};
      const bits = [];
      if (d.type === "weapon") {
        if (g.damage) bits.push(`${g.damage}${g.damageType ? " " + (DAMAGE_TYPES[g.damageType] || g.damageType) : ""}`);
        if (g.penetration) bits.push(`Проб. ${g.penetration}`);
        if (g.range)     bits.push(`${g.range}м`);
        const rof = [g.rof_single, g.rof_semi, g.rof_full].filter(x => x != null);
        if (rof.length && (g.rof_semi || g.rof_full)) bits.push(`RoF ${g.rof_single || "–"}/${g.rof_semi || "–"}/${g.rof_full || "–"}`);
      } else if (d.type === "armor") {
        bits.push(`AP ${g.head||0}/${g.body||0}/${g.leftArm||0}/${g.leftLeg||0}`);
        if (g.strengthBonus) bits.push(`S +${g.strengthBonus}`);
      } else if (d.type === "forcefield") {
        bits.push(`Щит ${g.ratingMin || 1}-${g.ratingMax || 0}`);
      }
      if (g.weight) bits.push(`${g.weight}кг`);
      if (g.availability != null) bits.push(`R ${g.availability}`);
      return bits.join(" · ");
    };

    const rowHtml = (d) => `
      <div class="pick-row" data-name="${esc(String(d.name).toLowerCase())}">
        <div class="pick-head">
          <button type="button" class="pick-exp" title="Показать описание">▸</button>
          <span class="pick-name" title="Раскрыть">${esc(d.name)}</span>
          <span class="pick-req">${esc(statLine(d))}</span>
          <button type="button" class="pick-add" data-uuid="${d.uuid}" title="Добавить на лист">＋</button>
        </div>
        <div class="pick-desc" style="display:none;">${esc(d.system?.special || d.system?.description || "—")}</div>
      </div>`;

    const tabs = groups.map((g, i) =>
      `<button type="button" class="gp-tab${i === 0 ? " is-on" : ""}" data-tab="${i}" data-hits="">${esc(g.pack.label)}</button>`).join("");
    const panes = groups.map((g, i) => `
      <div class="gp-pane" data-pane="${i}" style="${i === 0 ? "" : "display:none;"}">
        ${g.folders.map(([label, docs]) => `
          <div class="pick-group">
            <div class="pick-group-head">${esc(label)} <span class="pick-count">${docs.length}</span></div>
            <div class="pick-group-body">${docs
              .sort((a, b) => a.name.localeCompare(b.name, "ru")).map(rowHtml).join("")}</div>
          </div>`).join("")}
      </div>`).join("");

    new Dialog({
      title: "📚 Библиотека снаряжения",
      content: `<div class="wh-item-picker wh-gear-picker">
        <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск по названию…"/></div>
        <div class="gp-tabs">${tabs}</div>
        <div class="pick-list">${panes}</div>
      </div>`,
      buttons: { close: { label: "Закрыть" } },
      default: "close",
      render: html => {
        centerPicker(html);
        // Прилипание вкладок: высоты строки поиска и полосы вкладок кладём в
        // CSS-переменные — иначе заголовки папок наезжают на вкладки.
        const root = html.find(".wh-gear-picker")[0];
        if (root) requestAnimationFrame(() => {
          const topH = root.querySelector(".pick-top")?.offsetHeight ?? 0;
          const tabH = root.querySelector(".gp-tabs")?.offsetHeight  ?? 0;
          root.style.setProperty("--pick-top-h", `${topH}px`);
          root.style.setProperty("--gp-tabs-h", `${topH + tabH}px`);
        });
        html.find(".gp-tab").on("click", ev => {
          const idx = ev.currentTarget.dataset.tab;
          html.find(".gp-tab").removeClass("is-on");
          $(ev.currentTarget).addClass("is-on");
          html.find(".gp-pane").each((_, p) => { p.style.display = p.dataset.pane === idx ? "" : "none"; });
        });
        html.find(".pick-add").on("click", async ev => {
          ev.preventDefault(); ev.stopPropagation();
          const doc = await fromUuid(ev.currentTarget.dataset.uuid);
          if (!doc) return;
          const obj = doc.toObject(); delete obj._id;
          await this.actor.createEmbeddedDocuments("Item", [obj]);
          ui.notifications.info(`Добавлено: ${doc.name}`);
          $(ev.currentTarget).closest(".pick-row").addClass("just-added");
        });
        const toggle = (r) => {
          const d = r.querySelector(".pick-desc"), e = r.querySelector(".pick-exp");
          const open = d.style.display !== "none";
          d.style.display = open ? "none" : "block";
          e.textContent = open ? "▸" : "▾";
        };
        html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
        html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
        html.find(".pick-search").on("input", ev => {
          const q = ev.currentTarget.value.toLowerCase().trim();
          // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
          // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
          // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
          // фильтровался вовсе.
          html.find(".pick-row").each((_, r) => {
            r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
          });
          html.find(".pick-group").each((_, g) => {
            g.style.display = g.querySelectorAll(".pick-row:not(.pick-hidden)").length ? "" : "none";
          });
          // Совпадения могут лежать в другой вкладке, а она скрыта — поэтому
          // считаем найденное по каждой и подсказываем числом на кнопке.
          // Если в текущей вкладке пусто, а где-то есть — переключаемся туда сами.
          let firstHit = -1, total = 0;
          html.find(".gp-pane").each((_, pane) => {
            const n = pane.querySelectorAll(".pick-row:not(.pick-hidden)").length;
            total += n;
            if (n && firstHit < 0) firstHit = Number(pane.dataset.pane);
            const tab = html.find(`.gp-tab[data-tab="${pane.dataset.pane}"]`)[0];
            if (tab) {
              tab.dataset.hits = q ? String(n) : "";
              tab.classList.toggle("gp-tab-empty", !!q && !n);
            }
          });
          const active = html.find(".gp-tab.is-on")[0];
          const activeHits = active ? Number(active.dataset.hits || 0) : 0;
          if (q && !activeHits && firstHit >= 0) html.find(`.gp-tab[data-tab="${firstHit}"]`).trigger("click");
          html.find(".gp-empty").remove();
          if (q && !total) {
            html.find(".pick-list").append('<div class="gp-empty">Ничего не найдено</div>');
          }
        });
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(700, 680) }).render(true);
  }

  /** Выдаёт базовые импланты Механикум (пропуская уже имеющиеся). */
  async _grantMechanicusImplants() {
    const existing = new Set(this.actor.items.filter(i => i.type === "implant").map(i => i.name));
    const toAdd = MECHANICUS_IMPLANTS.filter(d => !existing.has(d.name)).map(d => foundry.utils.deepClone(d));
    if (toAdd.length) await this.actor.createEmbeddedDocuments("Item", toAdd);
    return toAdd.length;
  }

  /** Выдаёт Скитарию Боевые Латы Скитарии (броня + дефлектор) вместо имплантов Механикум. */
  async _grantSkitariiWarPlate() {
    const existing = new Set(this.actor.items.filter(i => i.type === "implant").map(i => i.name));
    if (existing.has(SKITARII_WAR_PLATE.name)) return 0;
    await this.actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(SKITARII_WAR_PLATE)]);
    return 1;
  }

  // ── Страх / Безумие ────────────────────────────────────────────────────

  /** Тест Страха → при провале таблица Шока (1d100 + 10×Провалы−1 − Infamy). */
  async _rollFear() {
    const wp = this.actor.system.characteristics.wp?.total ?? 0;
    const ratingOpts = Object.entries(FEAR_RATINGS).map(([k, r]) =>
      `<option value="${k}">${r.label} — важный W${r.important >= 0 ? "+" : ""}${r.important}, Infamy ${r.infamy}+</option>`).join("");
    new Dialog({
      title: "😱 Тест Страха",
      content: `
        <form class="wh-attack-form" style="padding:6px;">
          <div class="atk-dlg-row"><label>Рейтинг Страха:</label><select id="fear-rating">${ratingOpts}</select></div>
          <div class="atk-dlg-row"><label>Тип персонажа:</label>
            <select id="fear-type"><option value="important">Важный (игрок)</option><option value="normal">Обычный</option></select></div>
          <div class="atk-dlg-row"><label>Infamy:</label><input id="fear-infamy" type="number" value="0"/></div>
          <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fear-mod" type="number" value="0"/></div>
          <div class="atk-dlg-section">Свойства</div>
          <div class="atk-dlg-row"><label><input id="fear-prop-demon" type="checkbox"/> Демон</label></div>
        </form>`,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!", callback: async html => {
          const ratingKey = html.find("#fear-rating").val();
          const type      = html.find("#fear-type").val();
          const infamy    = parseInt(html.find("#fear-infamy").val()) || 0;
          const mod       = parseInt(html.find("#fear-mod").val()) || 0;
          // Свойства источника Страха — читаются в карточку/флаги сообщения;
          // Демон уже даёт бесплатный переброс при провале (см. fear.mjs).
          const properties = { demon: html.find("#fear-prop-demon").is(":checked") };
          await _executeFearRoll(this.actor, ratingKey, type, infamy, mod, properties);
        }},
        cancel: { label: "Отмена" }
      },
      default: "roll"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
  }

  /** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. */
  async _rollTrauma() {
    await _executeTraumaRoll(this.actor);
  }

  /** Случайное Ментальное Расстройство (d100) — создаёт предмет и сообщает в чат. */
  async _rollDisorder() {
    const roll = await new Roll("1d100").evaluate();
    const row  = rollDisorderEntry(roll.total);
    if (row) await this._createDisorderItem(row);
    const rollMode = game.settings.get("core", "rollMode");
    const dice = await roll.render();
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("dice","#6fe6ff")}Ментальное Расстройство — ${this.actor.name}</div>
          <div class="roll-dice">Бросок d100: <b>${roll.total}</b></div>
          <div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}${row?.name ?? "—"}</span></div>
          ${row?.desc ? `<div class="roll-threshold">${row.desc}</div>` : ""}
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  /** Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени). */
  async _createDisorderItem(entry) {
    if (this.actor.items.some(i => i.type === "mentalDisorder" && i.name === entry.name)) {
      ui.notifications.info(`Расстройство «${entry.name}» уже есть.`);
      return null;
    }
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      name: entry.name, type: "mentalDisorder",
      system: { description: entry.desc || "", testChar: "wp", testMod: entry.testMod || 0 }
    }]);
    return item;
  }

  /**
   * Пикер ментальных расстройств (стр. 292) — в одном стиле с пикерами
   * талантов, черт и мутаций: поиск, диапазон d100, раскрытие описания
   * стрелкой, добавление по «＋» прямо из строки.
   */
  _addDisorderDialog() {
    const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const have = new Set(this.actor.items.filter(i => i.type === "mentalDisorder").map(i => i.name));
    const rows = DISORDER_LIBRARY.map((d, i) => {
      const rng  = d.min === d.max ? String(d.min) : `${d.min}\u2013${d.max}`;
      const test = `W${d.testMod >= 0 ? "+" : ""}${d.testMod}`;
      const own  = have.has(d.name) ? '<span class="pick-owned">уже есть</span>' : "";
      return `
        <div class="pick-row${have.has(d.name) ? " pick-row-owned" : ""}" data-name="${esc(d.name.toLowerCase())}">
          <div class="pick-head">
            <button type="button" class="pick-exp" title="Показать описание">▸</button>
            <span class="pick-name" title="Раскрыть">${esc(d.name)}</span>
            <span class="pick-tier">${test}</span>
            <span class="pick-req">d100 ${rng}</span>${own}
            <button type="button" class="pick-add" data-idx="${i}" title="Добавить на лист">＋</button>
          </div>
          <div class="pick-desc" style="display:none;">${esc(d.desc || "—")}</div>
        </div>`;
    }).join("");

    new Dialog({
      title: "🧠 Добавить расстройство",
      content: `<div class="wh-item-picker">
        <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск расстройства…"/></div>
        <div class="pick-list">
          <div class="pick-group">
            <div class="pick-group-head">Ментальные расстройства <span class="pick-count">${DISORDER_LIBRARY.length}</span></div>
            <div class="pick-group-body">${rows}</div>
          </div>
        </div>
      </div>`,
      buttons: { close: { label: "Закрыть" } },
      default: "close",
      render: html => {
        centerPicker(html);
        html.find(".pick-add").on("click", async ev => {
          ev.preventDefault(); ev.stopPropagation();
          const entry = DISORDER_LIBRARY[parseInt(ev.currentTarget.dataset.idx)];
          if (!entry) return;
          const item = await this._createDisorderItem(entry);
          if (item) {
            $(ev.currentTarget).closest(".pick-row").addClass("just-added");
            item.sheet?.render(true);
          }
        });
        const toggle = (r) => {
          const d = r.querySelector(".pick-desc"), e = r.querySelector(".pick-exp");
          const open = d.style.display !== "none";
          d.style.display = open ? "none" : "block";
          e.textContent = open ? "▸" : "▾";
        };
        html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
        html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
        html.find(".pick-search").on("input", ev => {
          const q = ev.currentTarget.value.toLowerCase().trim();
          // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
          // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
          // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
          // фильтровался вовсе.
          html.find(".pick-row").each((_, r) => {
            r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
          });
        });
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(560, 620) }).render(true);
  }

  /** Тест конкретного расстройства (W + его testMod). */
  async _rollDisorderTest(item) {
    const sys     = item.system;
    const charKey = sys.testChar || "wp";
    const meta    = CHARACTERISTICS[charKey];
    const charVal = this.actor.system.characteristics[charKey]?.total ?? 0;
    const eff     = charVal + (sys.testMod || 0);
    const roll    = await new Roll("1d100").evaluate();
    const rv      = roll.total;
    const success = rv <= eff;
    const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;
    const rollMode = game.settings.get("core", "rollMode");
    const dice    = await roll.render();
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#c98bff")}${item.name} — ${this.actor.name}</div>
          <div class="roll-threshold">${meta?.abbr ?? charKey}: <b>${charVal}</b>${sys.testMod ? ` ${sys.testMod >= 0 ? "+" : ""}${sys.testMod}` : ""} → Порог: <b>${eff}</b></div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${success
            ? `<span class="roll-success">Успех — контроль удержан (${deg} ${_degWord(deg)})</span>`
            : `<span class="roll-failure">Провал — расстройство проявляется (${deg} ${_degWord(deg)})</span>`}</div>
          ${sys.description ? `<div class="roll-threshold" style="font-size:0.9em;">${sys.description}</div>` : ""}
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  /** Бросает формулу стартовых Ран вида "15+1d5". */
  async _rollWoundsFormula(formula) {
    if (!formula) return 0;
    try { return (await new Roll(String(formula)).evaluate()).total; }
    catch(e) { console.warn("wounds formula:", formula, e); return 0; }
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

  /**
   * Мастер создания персонажа: Раса → Субраса → Мировоззрение → Архетип.
   * Применяет всё разом (характеристики только в пустые поля, Черты/импланты —
   * недостающие). Безопасно при повторном запуске.
   */
  // Резолвит объекты расы/архетипа/субрасы/«Прошлого» по выбранным ключам мастера.
  _resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast }) {
    const race = RACES[raceKey];
    const arch = archetypeEntries()[archKey];
    const sub  = SUBRACE_DATA[subraceKey];
    const pastKey = raceKey === "ynnari" ? ynnariPast
                  : raceKey === "harlequin" ? harlequinPast : "";
    const past = (pastKey && RACES[pastKey]) ? RACES[pastKey] : null;
    return { race, arch, sub, past, pastKey };
  }

  // Плоская база характеристик до броска: раса (+ Прошлое) + архетип + субраса.
  _creationCharSum({ race, past, arch, sub }) {
    const sum = {};
    for (const [k, v] of Object.entries(race?.chars    || {})) sum[k] = (sum[k] || 0) + v;
    for (const [k, v] of Object.entries(past?.chars    || {})) sum[k] = (sum[k] || 0) + v;
    for (const [k, v] of Object.entries(arch?.charBonus || {})) sum[k] = (sum[k] || 0) + v;
    for (const [k, v] of Object.entries(sub?.charMods   || {})) sum[k] = (sum[k] || 0) + v;
    return sum;
  }

  // Число бонусных бросков расы (по выбранным ключам мастера).
  _creationBonusRolls(raceKey) {
    return Number(RACES[raceKey]?.bonusRolls) || 0;
  }

  // Один комплект метода «Генерация»: 9 (+бонус) бросков 2d10, берём 9 старших.
  _rollCharSet(bonusRolls = 0) {
    const d = () => 1 + Math.floor(Math.random() * 10);
    const r2 = () => d() + d();
    const vals = Array.from({ length: 9 + bonusRolls }, r2).sort((a, b) => b - a).slice(0, 9);
    return { vals, sum: vals.reduce((s, v) => s + v, 0) };
  }

  // Итоговые значения распределения: { charKey: значение активного набора }.
  _wizardCharValues() {
    const set  = this._wizardSets?.[this._wizardActiveSet];
    const vals = set?.vals || [];
    const out = {};
    for (const k of CREATION_ROLL_CHARS) {
      const vi = this._wizardAssign?.[k];
      out[k] = (vi != null) ? (vals[vi] ?? 0) : 0;
    }
    return out;
  }

  _showCreationWizard() {
    const curRace = this.actor.system.race || "human";
    // Метод «Генерация»: два независимых набора (каждый можно перебросить). Игрок
    // выбирает набор, затем раскидывает его значения по х-кам (drag&drop / клики).
    //   _wizardSets       — [{vals:[9], sum}, {vals:[9], sum}]
    //   _wizardActiveSet  — индекс выбранного набора (0/1)
    //   _wizardAssign     — { charKey: индекс значения в активном наборе }
    //   _wizardArmed      — «взятое кликом» значение (индекс) для клик-раскидки
    const _bonus = this._creationBonusRolls(curRace);
    this._wizardSets = [this._rollCharSet(_bonus), this._rollCharSet(_bonus)];
    this._wizardActiveSet = 0;
    this._wizardAssign = {};
    this._wizardArmed = null;
    // Расы выключенных подсистем («Книга Эльдар» и т.п.) прячем из Мастера —
    // та же логика, что и у шапки листа (context.raceGroups выше).
    const offRacesWiz = disabledRaceKeys();
    const raceOpts = RACE_GROUPS.map(g => {
      const opts = g.races.filter(k => RACES[k] && (k === curRace || !offRacesWiz.includes(k)))
        .map(k => `<option value="${k}" ${k === curRace ? "selected" : ""}>${RACES[k].label}</option>`).join("");
      return opts ? `<optgroup label="${g.label}">${opts}</optgroup>` : "";
    }).join("");
    const ynnariPastOpts = `<option value="">— не выбрано —</option>` + (RACES.ynnari.pastRaces || [])
      .map(k => `<option value="${k}" ${k === this.actor.system.ynnariPast ? "selected" : ""}>${RACES[k]?.label || k}</option>`).join("");
    const harlequinPastOpts = `<option value="">— не выбрано —</option>` + (RACES.harlequin.pastRaces || [])
      .map(k => `<option value="${k}" ${k === this.actor.system.harlequinPast ? "selected" : ""}>${RACES[k]?.label || k}</option>`).join("");

    const content = `
      <form class="wh-wizard-form" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">🧙 Создание персонажа</span></div>
        <div class="atk-dlg-row"><label>Раса:</label><select id="wiz-race">${raceOpts}</select></div>
        <div class="atk-dlg-row wiz-ynnari-row" style="display:none;"><label>Прошлое:</label><select id="wiz-ynnari-past">${ynnariPastOpts}</select></div>
        <div class="atk-dlg-row wiz-harlequin-row" style="display:none;"><label>Прошлое:</label><select id="wiz-harlequin-past">${harlequinPastOpts}</select></div>
        <div class="atk-dlg-row"><label>Субраса:</label><select id="wiz-subrace"></select></div>
        <div class="atk-dlg-row wiz-align-row"><label>Мировоззрение:</label>
          <select id="wiz-align">
            <option value="loyalist">Лоялист</option>
            <option value="renegade">Ренегат</option>
            <option value="heretic">Хаосит</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Архетип:</label><select id="wiz-arch"></select></div>
        <div id="wiz-note" class="atk-range-info" style="font-size:0.84em;"></div>
        <div id="wiz-legion" class="wiz-legion" style="display:none;">
          <div class="wiz-gen-lbl">Легион Астартес (геносемя и культура выбираются отдельно):</div>
          <div class="atk-dlg-row"><label>Легион (геносемя):</label><select id="wiz-legion-sel">${buildLegionOptions("")}</select></div>
          <div class="atk-dlg-row"><label>Орден / Банда:</label><select id="wiz-chapter-sel"></select></div>
          <div class="atk-dlg-row"><label title="Геносемя сохраняешь, а культуру можно перенять у другого легиона (напр. Повелитель Ночи в Чёрном Легионе).">Культура (легион):</label><select id="wiz-cult-sel">${buildCultureLegionOptions("")}</select></div>
          <div class="atk-dlg-row" id="wiz-cult-chapter-row" style="display:none;"><label>Культура (орден):</label><select id="wiz-cult-chapter-sel"></select></div>
        </div>
        <div class="wiz-gen">
          <div class="wiz-gen-lbl">1. Выбери набор бросков (можно перебросить):</div>
          <div id="wiz-sets" class="wiz-sets"></div>
          <div class="wiz-gen-lbl">2. Раскидай значения по характеристикам — перетащи или кликни значение, затем характеристику:
            <button type="button" id="wiz-auto" class="wiz-mini-btn" title="Разложить по убыванию">↕ по порядку</button>
            <button type="button" id="wiz-clear" class="wiz-mini-btn" title="Снять все значения">✕ сброс</button>
          </div>
          <div id="wiz-chips" class="wiz-chips"></div>
          <div id="wiz-slots" class="wiz-slots"></div>
        </div>
        <div class="roll-threshold" style="font-size:0.8em;color:#5a4a30;">
          Итог = база расы/архетипа + раскиданное значение. Заполняются только пустые поля; повторный запуск безопасен.
        </div>
      </form>`;

    const dlg = new Dialog({
      title: "Мастер создания персонажа",
      content,
      buttons: {
        apply: {
          icon: '<i class="fas fa-user-plus"></i>', label: "Создать",
          callback: async html => {
            const isAstartes = html.find("#wiz-race").val() === "astartes";
            await this._applyCreation({
              raceKey:    html.find("#wiz-race").val(),
              subraceKey: html.find("#wiz-subrace").val(),
              alignment:  html.find("#wiz-align").val(),
              archKey:    html.find("#wiz-arch").val(),
              ynnariPast: html.find("#wiz-ynnari-past").val(),
              harlequinPast: html.find("#wiz-harlequin-past").val(),
              charRolls:  this._wizardCharValues(),
              geneSeed: isAstartes ? {
                legion:         html.find("#wiz-legion-sel").val() || "",
                chapter:        html.find("#wiz-chapter-sel").val() || "",
                cultureLegion:  html.find("#wiz-cult-sel").val() || "",
                cultureChapter: html.find("#wiz-cult-chapter-sel").val() || ""
              } : null
            });
          }
        },
        cancel: { label: "Отмена" }
      },
      default: "apply",
      render: html => {
        const rebuild = () => {
          const rk    = html.find("#wiz-race").val();
          const race  = RACES[rk];
          const subOpts = ['<option value="">— нет —</option>']
            .concat((race?.subraces || []).map(sk => `<option value="${sk}">${SUBRACES[sk] || sk}</option>`));
          html.find("#wiz-subrace").html(subOpts.join(""));
          // Архетипы: Астартес/Азуриане/Друкхари/Арлекины — свои; Человек — обычные.
          // Прочие (сплайсы, гарпии, наги, скваты и т.п.) — человеческие архетипы.
          // Исключения: Аэльдари (используют Пути) и Сслиты — архетипа не выбирают.
          // (фильтрация вынесена в archetypesForRace — тот же приём, что читает и шапка листа)
          const archEntries = archetypesForRace(rk);
          // Группировка по полю group (если есть)
          const grouped = {};
          for (const [k, a] of archEntries) (grouped[a.group || ""] ??= []).push([k, a]);
          const archOpts = archEntries.length
            ? Object.entries(grouped).map(([g, list]) => {
                const opts = list.map(([k, a]) => `<option value="${k}">${a.name}</option>`).join("");
                return g ? `<optgroup label="${g}">${opts}</optgroup>` : opts;
              }).join("")
            : '<option value="">— нет (Аэльдари используют Пути; Сслиты — без архетипа) —</option>';
          html.find("#wiz-arch").html(archOpts);
          html.find(".wiz-ynnari-row").toggle(rk === "ynnari");
          html.find(".wiz-harlequin-row").toggle(rk === "harlequin");
          // Аэльдари используют Пути, а не Мировоззрение — скрываем выбор.
          html.find(".wiz-align-row").toggle(!AELDARI_RACES.includes(rk));
          // Легион+культура — только для Астартес.
          html.find("#wiz-legion").toggle(rk === "astartes");
          if (rk === "astartes") refreshLegion();
          // Число бонусных бросков зависит от расы — перекатываем оба набора и
          // сбрасываем раскладку.
          const bonus = this._creationBonusRolls(rk);
          this._wizardSets = [this._rollCharSet(bonus), this._rollCharSet(bonus)];
          this._wizardActiveSet = 0;
          this._wizardAssign = {};
          this._wizardArmed = null;
          this._updateWizardNote(html);
          renderGen();
        };

        // Астартес: заполнить зависимые селекты (Орден по легиону, Культура-орден по культуре-легиону).
        const refreshLegion = () => {
          const lg = html.find("#wiz-legion-sel").val();
          html.find("#wiz-chapter-sel").html(buildChapterOptions(lg, ""));
          const cl = html.find("#wiz-cult-sel").val();
          html.find("#wiz-cult-chapter-row").toggle(!!cl);
          if (cl) html.find("#wiz-cult-chapter-sel").html(buildChapterOptions(cl, ""));
        };

        // Присвоить значение (индекс vi активного набора) характеристике k.
        // Если это значение уже занято другой х-кой — освобождаем её (без дублей).
        const assignTo = (k, vi) => {
          if (vi == null || Number.isNaN(vi)) return;
          for (const c of CREATION_ROLL_CHARS) if (c !== k && this._wizardAssign[c] === vi) delete this._wizardAssign[c];
          this._wizardAssign[k] = vi;
          this._wizardArmed = null;
        };

        // Полный рендер блока Генерации: наборы + пул фишек + слоты х-к.
        const renderGen = () => {
          const { race, arch, sub, past } = this._resolveCreation({
            raceKey:       html.find("#wiz-race").val(),
            subraceKey:    html.find("#wiz-subrace").val(),
            archKey:       html.find("#wiz-arch").val(),
            ynnariPast:    html.find("#wiz-ynnari-past").val(),
            harlequinPast: html.find("#wiz-harlequin-past").val()
          });
          const sum    = this._creationCharSum({ race, past, arch, sub });
          const sets   = this._wizardSets || [];
          const active = this._wizardActiveSet || 0;
          const vals   = sets[active]?.vals || [];
          const assign = this._wizardAssign || {};
          const armed  = this._wizardArmed;

          // 1) Наборы
          html.find("#wiz-sets").html(sets.map((s, si) => `
            <div class="wiz-set ${si === active ? "active" : ""}" data-set="${si}" title="Выбрать набор ${si + 1}">
              <div class="wiz-set-head"><span class="wiz-set-name">Набор ${si + 1}</span>
                <span class="wiz-set-sum">Σ ${s.sum}</span>
                <a class="wiz-set-reroll" data-set="${si}" title="Перебросить набор ${si + 1}">↻</a>
              </div>
              <div class="wiz-set-vals">${s.vals.map(v => `<span>${v}</span>`).join("")}</div>
            </div>`).join(""));

          // 2) Пул фишек (незанятые значения активного набора)
          const used = new Set(Object.values(assign).filter(v => v != null));
          const poolVis = vals.map((_, i) => i).filter(i => !used.has(i));
          html.find("#wiz-chips").html(
            poolVis.length
              ? poolVis.map(vi => `<span class="wiz-chip ${vi === armed ? "armed" : ""}" draggable="true" data-vi="${vi}">${vals[vi]}</span>`).join("")
              : `<span class="wiz-chips-empty">все значения разложены</span>`
          );

          // 3) Слоты характеристик
          html.find("#wiz-slots").html(CREATION_ROLL_CHARS.map(k => {
            const base = sum[k] || 0;
            const vi   = assign[k];
            const has  = vi != null;
            const val  = has ? (vals[vi] ?? 0) : 0;
            return `<div class="wiz-slot ${has ? "filled" : "empty"}" data-char="${k}" title="${CHARACTERISTICS[k].label}: база ${base}${has ? ` + ${val}` : ""}">
              <span class="ws-abbr">${CHARACTERISTICS[k].abbr}</span>
              <span class="ws-chip" ${has ? `draggable="true" data-vi="${vi}"` : ""}>${has ? val : "—"}</span>
              <span class="ws-total">${base + val}</span>
              <span class="ws-base">база ${base}</span>
            </div>`;
          }).join(""));

          // Кол-во разложенных — для подсветки готовности.
          const done = CREATION_ROLL_CHARS.filter(k => assign[k] != null).length;
          html.find(".wiz-gen").toggleClass("incomplete", done < CREATION_ROLL_CHARS.length);

          wireGen();
        };

        // Навешиваем обработчики (drag&drop + клики) после каждого рендера.
        const wireGen = () => {
          // Выбор набора
          html.find(".wiz-set").off("click").on("click", ev => {
            if ($(ev.target).closest(".wiz-set-reroll").length) return;   // не по кнопке переброса
            const si = Number(ev.currentTarget.dataset.set);
            if (si === this._wizardActiveSet) return;
            this._wizardActiveSet = si;
            this._wizardAssign = {};                                      // новый набор — новые значения
            this._wizardArmed = null;
            renderGen();
          });
          // Переброс набора
          html.find(".wiz-set-reroll").off("click").on("click", ev => {
            ev.preventDefault(); ev.stopPropagation();
            const si = Number(ev.currentTarget.dataset.set);
            const bonus = this._creationBonusRolls(html.find("#wiz-race").val());
            this._wizardSets[si] = this._rollCharSet(bonus);
            if (si === this._wizardActiveSet) { this._wizardAssign = {}; this._wizardArmed = null; }
            renderGen();
          });
          // Клик по фишке — «взять/отпустить» для клик-раскладки
          html.find(".wiz-chip").off("click").on("click", ev => {
            const vi = Number(ev.currentTarget.dataset.vi);
            this._wizardArmed = (this._wizardArmed === vi) ? null : vi;
            renderGen();
          });
          // Клик по слоту — положить взятое значение / снять текущее (в пул)
          html.find(".wiz-slot").off("click").on("click", ev => {
            const k = ev.currentTarget.dataset.char;
            if (this._wizardArmed != null) { assignTo(k, this._wizardArmed); renderGen(); return; }
            if (this._wizardAssign[k] != null) { delete this._wizardAssign[k]; renderGen(); }   // снять
          });
          // Drag&drop
          html.find(".wiz-chip[draggable], .ws-chip[draggable]").off("dragstart").on("dragstart", ev => {
            ev.originalEvent.dataTransfer.setData("text/plain", String(ev.currentTarget.dataset.vi));
            ev.originalEvent.dataTransfer.effectAllowed = "move";
          });
          html.find(".wiz-slot").off("dragover").on("dragover", ev => { ev.preventDefault(); });
          html.find(".wiz-slot").off("drop").on("drop", ev => {
            ev.preventDefault();
            const vi = Number(ev.originalEvent.dataTransfer.getData("text/plain"));
            assignTo(ev.currentTarget.dataset.char, vi);
            renderGen();
          });
          // Сброс фишки обратно в пул — дроп на область фишек
          html.find("#wiz-chips").off("dragover").on("dragover", ev => ev.preventDefault());
          html.find("#wiz-chips").off("drop").on("drop", ev => {
            ev.preventDefault();
            const vi = Number(ev.originalEvent.dataTransfer.getData("text/plain"));
            const k = CREATION_ROLL_CHARS.find(c => this._wizardAssign[c] === vi);
            if (k) { delete this._wizardAssign[k]; renderGen(); }
          });
        };

        html.find("#wiz-race").on("change", rebuild);
        html.find("#wiz-subrace, #wiz-arch, #wiz-ynnari-past, #wiz-harlequin-past").on("change", () => {
          this._updateWizardNote(html); renderGen();
        });
        // Астартес: зависимые селекты легиона/культуры.
        html.find("#wiz-legion-sel, #wiz-cult-sel").on("change", refreshLegion);
        // «По порядку» — разложить значения по убыванию (WS←макс … FEL←мин).
        html.find("#wiz-auto").on("click", ev => {
          ev.preventDefault();
          this._wizardAssign = {};
          CREATION_ROLL_CHARS.forEach((k, i) => { this._wizardAssign[k] = i; });
          this._wizardArmed = null;
          renderGen();
        });
        html.find("#wiz-clear").on("click", ev => {
          ev.preventDefault();
          this._wizardAssign = {}; this._wizardArmed = null; renderGen();
        });
        rebuild();
      }
    }, { classes: ["dialog", "wh-attack-dialog", "warhammer-dbc", "wh-holo"], width: 460 });
    dlg.render(true);
  }

  _updateWizardNote(html) {
    const race = RACES[html.find("#wiz-race").val()];
    const arch = archetypeEntries()[html.find("#wiz-arch").val()];
    const parts = [];
    if (race?.skills) parts.push(`<b>Навыки расы:</b> ${ruSkillString(race.skills)}`);
    if (arch) {
      if (Object.keys(arch.charBonus || {}).length)
        parts.push(`<b>Бонус архетипа:</b> ${Object.entries(arch.charBonus).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`).join(", ")}`);
      if (arch.charChoice)   parts.push(`<b>Выбор:</b> ${arch.charChoice}`);
      if (arch.infRoll)      parts.push(`<b>Влияние:</b> ${arch.infRoll}`);
      if (arch.requiredPath) parts.push(`<b>Требуемый Путь:</b> ${arch.requiredPath}`);
      if (arch.wounds)       parts.push(`<b>Раны:</b> ${arch.wounds}`);
      if (arch.trait) parts.push(`<b>Трейт:</b> ${arch.trait.name}`);
    }
    html.find("#wiz-note").html(parts.join("<br/>"));
  }

  async _applyCreation({ raceKey, subraceKey, alignment, archKey, ynnariPast, harlequinPast, charRolls = null, geneSeed = null }) {
    const { race, arch, sub, past, pastKey } =
      this._resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast });
    const chars = this.actor.system.characteristics;

    const updates = {
      "system.race":      raceKey,
      "system.subrace":   subraceKey || "",
      "system.alignment": alignment || "loyalist",
      "system.archetype": archKey || "",
      "system.ynnariPast":    raceKey === "ynnari"    ? (ynnariPast || "")    : "",
      "system.harlequinPast": raceKey === "harlequin" ? (harlequinPast || "") : ""
    };
    // Астартес: сохраняем легион (геносемя) и отдельно культуру (стр. 489-506).
    if (geneSeed) {
      updates["system.geneSeed.legion"]         = geneSeed.legion || "";
      updates["system.geneSeed.chapter"]        = geneSeed.chapter || "";
      updates["system.geneSeed.cultureLegion"]  = geneSeed.cultureLegion || "";
      updates["system.geneSeed.cultureChapter"] = geneSeed.cultureChapter || "";
    }
    if (arch?.isPsyker)     updates["system.isPsyker"]     = true;
    if (arch?.isTechpriest) updates["system.isTechpriest"] = true;
    if (arch?.psykerClass)  updates["system.psyker.class"] = arch.psykerClass;
    // Азуриане — псайкеры (трейт Psyker, «Древнее Мастерство»); то же для Иннари/Арлекина с Прошлым Азуриан
    if (raceKey === "azuriane" || pastKey === "azuriane") updates["system.isPsyker"] = true;

    // Характеристики (только в пустые поля): база = раса (+ Прошлое) + бонус
    // архетипа + бонус субрасы, ПЛЮС бросок 2d10 в каждую из 9 основных х-к
    // (корник вахи). Влияние (inf) 2d10 не кидается — оно от arch.infRoll ниже.
    const sum = this._creationCharSum({ race, past, arch, sub });
    for (const [k, v] of Object.entries(sum)) {
      if ((chars[k]?.base || 0) === 0) {
        const roll = (charRolls && CREATION_ROLL_CHARS.includes(k)) ? (charRolls[k] || 0) : 0;
        updates[`system.characteristics.${k}.base`] = v + roll;
      }
    }

    // Раны (только если ещё не заданы)
    const w = await this._rollWoundsFormula(arch?.wounds);
    if (w && (this.actor.system.wounds?.max || 0) === 0) {
      updates["system.wounds.max"]   = w;
      updates["system.wounds.value"] = w;
    }

    // Влияние (Inf) по броску архетипа — только в пустое поле
    if (arch?.infRoll && (chars.inf?.base || 0) === 0) {
      const infv = await this._rollWoundsFormula(arch.infRoll);
      if (infv) updates["system.characteristics.inf.base"] = infv;
    }

    await this.actor.update(updates);

    // Черты: расовые (+ Прошлого для Иннари) + субрасовые + архетипный
    let traits = 0;
    traits += await this._createTraitsFromList(race?.traits, race?.label || raceKey);
    if (past?.traits) traits += await this._createTraitsFromList(past.traits, past.label || pastKey);
    if (sub?.traits) traits += await this._createTraitsFromList(sub.traits, sub.label || subraceKey);
    if (arch?.trait) traits += await this._createTraitsFromList([arch.trait], `Архетип: ${arch.name}`);

    // Импланты Механикум / Боевые Латы Скитарии
    let implants = 0;
    if (arch?.grantsImplants) implants = await this._grantMechanicusImplants();
    else if (arch?.grantsWarPlate) implants = await this._grantSkitariiWarPlate();
    // Органы Геносемени — космодесантнику при создании.
    if (raceKey === ASTARTES_RACE) implants += await this._grantAstartesImplants();

    // Стартовые таланты: раса + Прошлое + субраса + архетип (выборы — через диалог)
    // Культура легиона выдаёт свои Таланты (стр. 489-506). Культура может быть
    // от ДРУГОГО легиона, чем геносемя, — берём именно её.
    const cultFx = geneSeed
      ? resolveCultureFx(geneSeed.cultureLegion || geneSeed.legion,
                         geneSeed.cultureChapter || geneSeed.chapter)
      : null;
    const talRaw = [].concat(
      race?.talents || [],
      past?.talents || [],
      sub?.talents  || [],
      arch?.talents ? [arch.talents] : [],
      cultFx?.grantTalents || []
    );
    const srcLabel = `${race?.label || raceKey}${arch ? ` / ${arch.name}` : ""}`;
    const talents = await this._applyStartingTalents(talRaw, srcLabel);

    // Навыки архетипа/расы — выдаём БЕСПЛАТНО (grantedRank), опыт не тратится (стр. 5-21).
    const grantedSkills = await this._grantCreationSkills({ race, past, sub, arch });
    // Навыки от культуры легиона — тоже бесплатным рангом.
    const cultSkills = await this._grantCultureSkills(cultFx);

    // Снаряжение архетипа/расы — ВРЕМЕННО ОТКЛЮЧЕНО (метод _grantCreationGear
    // оставлен для будущих доработок: нужен словарь EN→компендиум для надёжности).
    // const gearN = await this._grantCreationGear({ race, past, sub, arch, isAstartes: raceKey === "astartes" });

    await this.actor.setFlag("warhammer-dbc", "setupDone", true);
    this._applyThemeClasses();

    ui.notifications.info(`🧙 Создание: ${race?.label}${arch ? ` / ${arch.name}` : ""} — Черт ${traits}, Талантов ${talents}, Навыков ${grantedSkills + cultSkills} (бесплатно)${implants ? `, имплантов ${implants}` : ""}. Снаряжение — вручную.`);
  }

  /**
   * Стартовое снаряжение архетипа/расы (стр. 5-21, корбук снаряжение с 165):
   * разбирает строку gear, разрешает выборы «A/B/C»/«A или B» диалогом (с учётом
   * скобок), затем создаёт найденные в компендиумах предметы и постит карту в чат
   * с итоговым списком (нераспознанное/«любое»/количества — выдаются вручную).
   */
  async _grantCreationGear({ race, past, sub, arch, isAstartes }) {
    const raw = [arch?.gear, race?.gear, past?.gear, sub?.gear].filter(Boolean).join(", ");
    if (!raw.trim() && !isAstartes) return 0;

    // Разбивка варианта с учётом вложенности скобок (как у навыков).
    const splitChoice = (str) => {
      const out = []; let d = 0, cur = "", i = 0;
      while (i < str.length) {
        const ch = str[i];
        if (ch === "(") d++; else if (ch === ")") d--;
        if (d === 0 && (ch === "/" || ch === ";")) { out.push(cur); cur = ""; i++; continue; }
        const m = (d === 0) ? str.slice(i).match(/^\s+или\s+/) : null;
        if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
        cur += ch; i++;
      }
      if (cur.trim()) out.push(cur);
      return out.map(s => s.trim()).filter(Boolean);
    };

    const entries = raw.trim() ? this._splitTopLevel(raw) : [];
    const layout = [], choiceDefs = [];
    for (const e of entries) {
      const parts = splitChoice(e);
      if (parts.length > 1) { layout.push({ ci: choiceDefs.length }); choiceDefs.push(parts); }
      else layout.push({ fixed: e });
    }
    const picks = await this._promptGearChoices(choiceDefs);
    const resolved = layout.map(x => x.fixed != null ? x.fixed : (picks[x.ci] || ""));

    // Попытка создать распознанные предметы из компендиумов (best-effort).
    const created = [];
    try {
      const packs = ["weapons","armor","gear","ammunition","shields","tools","armour-systems"]
        .map(p => game.packs.get(`warhammer-dbc.${p}`)).filter(Boolean);
      const index = new Map();  // нормализованное имя → doc
      const norm = s => String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
      for (const pk of packs) for (const e of await pk.getIndex()) {
        for (const part of String(e.name).split("/")) { const k = norm(part); if (k && !index.has(k)) index.set(k, { pack: pk, id: e._id }); }
      }
      const findItem = (txt) => {
        // Чистим «L. », количества, «(…)», «до R», «Best.Q» — оставляем имя.
        let s = String(txt).replace(/^\s*\d+×?\s*/,"").replace(/^l\.\s*/i,"").replace(/\([^)]*\)/g,"")
          .replace(/\bдо\s*R\s*\d+\b/gi,"").replace(/\b(Best|Good|Common|Poor)\.?Q\b/gi,"").trim();
        const k = norm(s);
        if (index.has(k)) return index.get(k);
        // мягкий поиск по вхождению
        for (const [name, ref] of index) if (k.length > 4 && (name.includes(k) || k.includes(name)) && Math.abs(name.length-k.length) < 6) return ref;
        return null;
      };
      const toCreate = [];
      for (const r of resolved) {
        if (/\bлюб/i.test(r) || /модификац|доз|магазин|\bR\d\b\s*$/i.test(r)) continue; // абстрактное — вручную
        const ref = findItem(r);
        if (ref) { const doc = await ref.pack.getDocument(ref.id); if (doc) { toCreate.push(doc.toObject()); created.push(doc.name); } }
      }
      if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    } catch (e) { console.warn("warhammer-dbc | grant gear", e); }

    // Карта в чат: итоговый список (что создано / что выдать вручную) + системы брони Астартес.
    const esc = s => String(s).replace(/</g,"&lt;");
    const createdSet = new Set(created.map(c => c.toLowerCase()));
    const rows = resolved.map(r => {
      const done = created.some(c => esc(r).toLowerCase().includes(c.toLowerCase().split("/")[0].trim()));
      return `<li${done ? ' style="color:#4dffa6;"' : ''}>${done ? "✓ " : "▫ "}${esc(r)}</li>`;
    }).join("");
    const astartes = isAstartes
      ? `<div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(77,255,166,.25);"><b>+ 4 базовые Системы силовой брони на выбор</b> — из компендиума «Системы силовой брони» (добавьте во вкладке «Снаряжение»).</div>`
      : "";
    ChatMessage.create({
      content: `<div class="wh-roll-result"><div class="roll-header">🎒 Стартовое снаряжение — ${esc(arch?.name || race?.label || "персонаж")}</div>
        <ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${rows || "<li>—</li>"}</ul>${astartes}
        <div style="font-size:.8em;opacity:.7;margin-top:4px;">✓ — добавлено на лист. ▫ — выдать вручную (компендиумы Оружие/Броня/Снаряжение или ＋ на вкладке «Снаряжение»).</div></div>`,
      whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
      speaker: { alias: this.actor.name }
    });
    return created.length;
  }

  /** Диалог выбора «на выбор» снаряжения. choiceDefs — массивы строк; возвращает выбранные[]. */
  _promptGearChoices(choiceDefs) {
    if (!choiceDefs?.length) return Promise.resolve([]);
    const esc = s => String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");
    const rows = choiceDefs.map((opts,i) =>
      `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Снаряжение:</label><select class="wtc-sel" data-i="${i}">${opts.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></div>`
    ).join("");
    return new Promise(resolve => {
      new Dialog({
        title: "Выбор стартового снаряжения",
        content: `<form class="wh-talent-choices"><p class="wtc-hint">Архетип/раса даёт снаряжение на выбор — уточни:</p>${rows}</form>`,
        buttons: { ok: { label: "Применить", callback: html => {
          const res = []; html.find("select[data-i]").each((_,el)=>{ res[Number(el.dataset.i)] = el.value; }); resolve(res);
        } } },
        default: "ok", close: () => resolve(choiceDefs.map(o => o[0]))
      }, { classes:["dialog","warhammer-dbc","wh-holo","wh-talent-dialog"], width: 480 }).render(true);
    });
  }

  /**
   * Выдаёт навыки архетипа/расы БЕСПЛАТНО (стр. 5-21): проставляет grantedRank
   * (базовый уровень без траты опыта). Выборы «или» — диалог; групповые «(любое N)»
   * — плейсхолдеры для выбора игроком. Опыт тратится только за ступени сверх выданного.
   */
  /**
   * Навыки, выдаваемые культурой легиона (стр. 489-506). Переиспользуем разбор
   * навыков создания: он уже умеет групповые навыки, специализации и «+10».
   */
  async _grantCultureSkills(cultFx) {
    const list = cultFx?.grantSkills || [];
    if (!list.length) return 0;
    return await this._grantCreationSkills({ race: { skills: list.join(", ") } });
  }

  async _grantCreationSkills({ race, past, sub, arch }) {
    const SK = {
      "acrobatics":"acrobatics","athletics":"athletics","awareness":"awareness","charm":"charm",
      "command":"command","commerce":"commerce","deceive":"deceive","dodge":"dodge","inquiry":"inquiry",
      "interrogate":"interrogate","intimidate":"intimidate","logic":"logic","medicae":"medicae",
      "parry":"parry","psyniscience":"psyniscience","scrutiny":"scrutiny","security":"security",
      "sleight of hand":"sleightOfHand","stealth":"stealth","survival":"survival","tech-use":"techUse","tech use":"techUse"
    };
    // Префиксы групповых навыков. В корбуке они пишутся сокращённо и вразнобой
    // («For. Lore», «Com. Lore», «Schol. Lore», «Navigate»), поэтому здесь ВСЕ
    // варианты — иначе запись молча теряется при выдаче (баг: Техножрецу не
    // доставалось For. Lore (Mechanicum)+10).
    const GRP = {
      "common lore":"commonLore",   "com. lore":"commonLore",   "com lore":"commonLore",
      "forbidden lore":"forbiddenLore","for. lore":"forbiddenLore","for lore":"forbiddenLore",
      "scholastic lore":"scholasticLore","schol. lore":"scholasticLore","schol lore":"scholasticLore",
      "linguistics":"linguistics",
      "navigation":"navigation",    "navigate":"navigation",
      "operate":"operate","trade":"trade"
    };
    // Перевод специализаций групповых навыков (лор-ориентированный).
    const SPEC_RU = {
      "imperium":"Империум","war":"Война","chaos":"Хаос","astartes":"Астартес",
      "adeptus astartes":"Астартес","adeptus mechanicus":"Механикус","mechanicus":"Механикус",
      "daemons":"Демоны","warp":"Варп","heresy":"Ересь","horus heresy":"Ересь Хоруса",
      "long war":"Долгая Война","xenos":"Ксеносы","psykers":"Псайкеры","mutants":"Мутанты",
      "heraldry":"Геральдика","tactica imperialis":"Тактика Империалис","codex astartes":"Кодекс Астартес",
      "legend":"Легенды","legends":"Легенды","numerology":"Нумерология","occult":"Оккультизм",
      "cryptology":"Криптология","judgement":"Правосудие","archeotech":"Археотех","beasts":"Звери",
      "pirates":"Пираты","high gothic":"Высокий Готик","low gothic":"Низкий Готик",
      "chaos glyphs":"Глифы Хаоса","true tongue":"Истинный Язык","battle cant":"Боевой Язык",
      "battle kant":"Боевой Язык","xenobiology":"Ксенобиология","astartes implants":"Импланты Астартес",
      "horus heresy and long war":"Ересь Хоруса и Долгая Война","followers of chaos":"Последователи Хаоса",
      "inquisition":"Инквизиция","navigators":"Навигаторы","underworld":"Преступный мир",
      "warp, daemons and psykers":"Варп, Демоны и Псайкеры","xenos occult":"Ксено-Оккультизм",
      "adeptus arbites":"Адептус Арбитес","administratum":"Администратум","archenemy":"Архивраг",
      "ecclesiarchy":"Экклезиархия","imperial creed":"Имперский Культ","imperial guard":"Имперская Гвардия",
      "imperial fleet":"Имперский Флот","intrigue":"Интрига","tech":"Технология","toil":"Труд",
      // «Mechanicus» на стр.16 — опечатка книги: в списке специализаций (стр.58)
      // есть только «Mechanicum». Сводим к одной записи, иначе у персонажа
      // появятся два разных Запретных Знания об одном и том же.
      "binary cant":"Бинарный Кант","mechanicum":"Механикум","mechanicus":"Механикум",
      "chymistry":"Химия",
      "warp, daemons and psykers":"Варп, Демоны и Псайкеры","engineer":"Инженер",
      "crime":"Преступность","sump":"Свалки","astra telepathica":"Астра Телепатика",
      "adeptus astra telepathica":"Астра Телепатика","genestealer":"Генокрад",
      "druchii":"Друкхари","lameldannar":"ЛамЭлданнар","lameldannar druchii":"ЛамЭлданнар (Друкхари)",
      "aeldari":"Аэльдари","corsair":"Корсар","eldar":"Эльдар",
      "surface":"Поверхность","aeronautica":"Авиа","voidship":"Космос","stellar":"Звёздная",
      "armourer":"Бронник","weaponsmith":"Оружейник","chymist":"Химик","chymistry":"Химия",
      "voidfarer":"Космоход","mason":"Каменщик","technomat":"Техномат","shipwright":"Корабел"
    };
    const specRu = raw => { const k = String(raw).toLowerCase().replace(/\s+/g," ").trim(); return SPEC_RU[k] || raw; };
    const STEP = { untrained:0, knows:1, trained:2, veteran:3, expert:4 };
    const rankOf = n => n>=30?"expert":n>=20?"veteran":n>=10?"trained":"knows";
    const norm = s => String(s||"").toLowerCase().replace(/\s+/g," ").trim();

    const raw = [race?.skills, past?.skills, sub?.skills, arch?.skills].filter(Boolean).join(", ");
    if (!raw.trim()) return 0;
    // Разбиение варианта «или»/«/» ТОЛЬКО на верхнем уровне скобок (иначе ломается
    // «Linguistics (Battle Cant/High Gothic)» — «/» внутри скобок это варианты спец.).
    const splitChoice = (str) => {
      const out = []; let d = 0, cur = "", i = 0;
      while (i < str.length) {
        const ch = str[i];
        if (ch === "(") d++;
        else if (ch === ")") d--;
        if (d === 0 && ch === "/") { out.push(cur); cur = ""; i++; continue; }
        const m = (d === 0) ? str.slice(i).match(/^\s+или\s+/) : null;
        if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
        cur += ch; i++;
      }
      if (cur.trim()) out.push(cur);
      return out.map(s => s.trim()).filter(Boolean);
    };
    // Русское имя опции навыка для диалога («Linguistics (Battle Cant) +10» → «Лингвистика (Боевой Язык) +10»).
    const skillOptRu = (opt) => {
      const m = String(opt).match(/\+\d+/); const suf = m ? " " + m[0] : "";
      let s = String(opt).replace(/\+\d+/, "").trim();
      const gm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (gm) {
        const gk = GRP[norm(gm[1])];
        const gl = gk ? (GROUP_SKILLS_DEF[gk]?.label || gm[1].trim()) : (SK[norm(gm[1])] ? SKILLS_DEF[SK[norm(gm[1])]]?.label : gm[1].trim());
        return `${gl} (${specRu(gm[2].trim())})${suf}`;
      }
      const sk = SK[norm(s)];
      return (sk ? (SKILLS_DEF[sk]?.label || s) : s) + suf;
    };

    const entries = this._splitTopLevel(raw);
    const direct = [], choices = [];
    for (const e of entries) {
      const parts = splitChoice(e);
      if (parts.length > 1) { choices.push(parts.map(p => ({ value: p, label: skillOptRu(p) }))); continue; }
      // Выбор ВНУТРИ скобок: «For. Lore (Archeotech/Xenos/Warp)» — одна из трёх
      // специализаций, а не все три (стр. 20). Запятая внутри скобок при этом
      // означает «и обе»: «Trade (Armourer, Weaponsmith)».
      const im = e.match(/^(.*?)\s*\(([^)]*)\)\s*(\+\d+)?\s*$/);
      if (im && GRP[norm(im[1])] && /\s+или\s+|\//.test(im[2]) && !/люб/i.test(im[2])) {
        const head = im[1].trim(), suf = im[3] || "";
        const opts = im[2].split(/\s+или\s+|\s*\/\s*/).map(s => s.trim()).filter(Boolean)
          .map(sp => { const v = `${head} (${sp})${suf}`; return { value: v, label: skillOptRu(v) }; });
        if (opts.length > 1) { choices.push(opts); continue; }
      }
      direct.push(e);
    }
    const chosen = await this._promptSkillChoices(choices);
    const all = [...direct, ...chosen];

    const upd = {};
    const groupCache = {};   // key → рабочий массив записей
    const getGroup = k => (groupCache[k] ??= foundry.utils.deepClone(this.actor.system.groupSkills?.[k] || []));
    // Слоты «любые N» считаем за проход и сверяем с уже выданными генерацией
    // (wildSlot), иначе повторный прогон Мастера удваивает групповые навыки
    // (Человек: Common Lore ×4 → ×8). Выбранная игроком специализация занимает
    // свой слот и переживает пересчёт.
    const wildWant = {};   // gkey → сколько слотов даёт генерация
    const wildRank = {};   // gkey → лучший ранг среди источников
    const unknown  = [];   // нераспознанные записи (диагностика для ГМа)

    for (let str of all) {
      str = String(str).trim(); if (!str) continue;
      const m = str.match(/\+(\d+)/); const rank = rankOf(m ? parseInt(m[1]) : 0);
      str = str.replace(/\+\d+/,"").trim();
      const gm = str.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (gm) {
        const gkey = GRP[norm(gm[1])];
        if (gkey) {
          const inside = gm[2].trim();
          const arr = getGroup(gkey);
          // Смешанный случай «(War, любое 1)» (Астартес, стр. 7): конкретная
          // специализация + N свободных слотов. Раньше вся запись уходила в
          // «любое», и War терялся — поэтому части разбираем по отдельности.
          const parts   = COMBINED_SPECS.has(norm(inside))
            ? [inside] : inside.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
          const wildPs  = parts.filter(p => /люб/i.test(p));
          const namedPs = parts.filter(p => !/люб/i.test(p));
          if (wildPs.length) {
            for (const p of wildPs) {
              const cnt = parseInt((p.match(/\d+/)||["1"])[0]) || 1;
              wildWant[gkey] = (wildWant[gkey] || 0) + cnt;
              if ((STEP[rank]||0) >= (STEP[wildRank[gkey]]||0)) wildRank[gkey] = rank;
            }
            for (const raw of namedPs) {
              const ru = specRu(raw);
              let ent = arr.find(e => norm(e.specialty)===norm(ru));
              if (ent) { ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0; }
              else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0 });
            }
          } else {
            // Несколько специализаций ТОЛЬКО через запятую (в названиях бывает «and»/«и»,
            // напр. «Horus Heresy and Long War» — это ОДНА специализация, стр. 58-61).
            // Исключение — комбинированные названия, где запятая ВНУТРИ имени
            // («Warp, Daemons and Psykers» — единый навык, стр. 58): их не режем.
            const specs = COMBINED_SPECS.has(norm(inside))
              ? [inside]
              : inside.split(/\s*,\s*/).map(s=>s.trim()).filter(Boolean);
            for (const raw of specs) {
              const ru = specRu(raw);
              let ent = arr.find(e => norm(e.specialty)===norm(ru));
              if (ent) { ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0; }
              else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0 });
            }
          }
          continue;
        }
        // Скобки есть, но префикс не групповой навык — отметим как неизвестное,
        // если это и не обычный навык (проверка ниже).
      }
      const skey = SK[norm(str)];
      if (skey) {
        const cur = upd[`system.skills.${skey}.grantedRank`] || this.actor.system.skills?.[skey]?.grantedRank || "untrained";
        const better = (STEP[rank] >= (STEP[cur]||0)) ? rank : cur;
        upd[`system.skills.${skey}.grantedRank`] = better;
        const curRank = this.actor.system.skills?.[skey]?.rank || "untrained";
        if ((STEP[curRank]||0) < STEP[better]) upd[`system.skills.${skey}.rank`] = better;
        upd[`system.skills.${skey}.cost`] = 0;
      } else {
        // Не распознали — раньше запись просто исчезала. Теперь копим и сообщаем
        // ГМу, чтобы опечатка в данных архетипа была видна сразу.
        unknown.push(str);
      }
    }
    // Сверка слотов «любые N»: доводим их число ровно до положенного. Лишние
    // снимаем только с невыбранных плейсхолдеров — выбранное игроком остаётся.
    for (const [gk, want] of Object.entries(wildWant)) {
      const arr   = getGroup(gk);
      const rank  = wildRank[gk] || "knows";
      const slots = arr.filter(e => e?.wildSlot);
      if (slots.length > want) {
        const free = slots.filter(e => e.wild || norm(e.specialty) === norm(WILD_SPEC));
        for (const e of free.slice(0, slots.length - want)) arr.splice(arr.indexOf(e), 1);
      } else {
        for (let i = slots.length; i < want; i++)
          arr.push({ specialty: WILD_SPEC, rank, grantedRank: rank, cost: 0, wild: true, wildSlot: true });
      }
      // Ранг слотов подтягиваем до лучшего среди источников.
      for (const e of arr) if (e?.wildSlot) {
        e.grantedRank = rank;
        if ((STEP[e.rank]||0) < STEP[rank]) e.rank = rank;
        e.cost = 0;
      }
    }
    for (const [gk, arr] of Object.entries(groupCache)) upd[`system.groupSkills.${gk}`] = arr;
    if (Object.keys(upd).length) await this.actor.update(upd);

    // Нераспознанное больше не теряется молча — говорим ГМу, что выдать руками.
    if (unknown.length) {
      console.warn("Warhammer DBC | Не распознаны стартовые навыки:", unknown);
      ui.notifications.warn(
        `Не распознано навыков: ${unknown.length} — выдайте вручную: ${unknown.join("; ")}`,
        { permanent: true });
    }

    const nSk = Object.keys(upd).filter(k => k.endsWith(".grantedRank")).length;
    const nGr = Object.values(groupCache).reduce((s,a)=>s+a.length,0);
    return nSk + nGr;
  }

  /** Диалог выбора «или»-навыков. choices — массивы {value,label}; возвращает value[]. */
  _promptSkillChoices(choices) {
    if (!choices?.length) return Promise.resolve([]);
    const esc = s => String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");
    const rows = choices.map((opts,i) =>
      `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Навык:</label><select class="wtc-sel" data-i="${i}">${opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>`
    ).join("");
    return new Promise(resolve => {
      new Dialog({
        title: "Выбор стартовых навыков",
        content: `<form class="wh-talent-choices"><p class="wtc-hint">Архетип/раса даёт выбор — уточни:</p>${rows}</form>`,
        buttons: { ok: { label: "Применить", callback: html => {
          const res = []; html.find("select[data-i]").each((_,el)=>{ if(el.value) res.push(el.value); }); resolve(res);
        } } },
        default: "ok", close: () => resolve([])
      }, { classes:["dialog","warhammer-dbc","wh-holo","wh-talent-dialog"], width: 460 }).render(true);
    });
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
   * Доступность целой папки-группы в пикере Талантов по условиям листа
   * (не путать с requirement отдельного таланта — тут гейтится вся папка).
   * Возвращает null (открыто) либо причину блокировки для бейджа/тултипа.
   */
  _talentGroupLock(kind, parent, folderName) {
    if (kind !== "talent") return null;
    const sys = this.actor.system || {};
    const DRUKHARI_RACES = ["drukhari", "truebornDrukhari", "mandrake", "wrack"];

    if (parent === "Книга Пустоты" && folderName === "Ген навигатора") {
      const has = this.actor.items.some(i => i.type === "trait" && i.name === "Navigator's Gen / Ген Навигатора");
      return has ? null : "Нужна Черта Navigator's Gen / Ген Навигатора";
    }
    if (parent === "Элитные архетипы") {
      const has = sys.eliteArchetype === folderName || (sys.eliteArchetypesExtra || []).includes(folderName);
      return has ? null : `Нужен Элитный архетип «${folderName}»`;
    }
    if (parent === "Таланты одержимых") {
      return sys.possessed ? null : "Нужна включённая опция «Одержимый» (вкладка Записи)";
    }
    if (parent === "Таланты Астартес" && folderName === "Повелители Ночи") {
      return sys.geneSeed?.legion === "VIII" ? null : "Нужно Геносемя Повелителей Ночи (или одной из их варбанд)";
    }
    if (parent === "Книга Пустоты" && folderName === "Псайкер") {
      return (Number(sys.psyker?.rating) || 0) > 0 ? null : "Нужен Пси-Рейтинг больше 0";
    }
    if (!parent && folderName.startsWith("Экзодиты — ")) {
      return sys.race === "exodite" ? null : "Нужна раса Экзодит";
    }
    if (!parent && folderName === "Друкхари") {
      return DRUKHARI_RACES.includes(sys.race) ? null : "Нужна раса Друкхари";
    }
    if (!parent && folderName === "Азуриани") {
      return sys.race === "azuriane" ? null : "Нужна раса Азуриане";
    }
    if (!parent && folderName.startsWith("Арлекины — ")) {
      return sys.race === "harlequin" ? null : "Нужна раса Арлекин";
    }
    if (!parent && folderName === "Иннари") {
      return sys.race === "ynnari" ? null : "Нужна раса Иннари";
    }
    if (!parent && folderName === "Псайкана") {
      return (Number(sys.psyker?.rating) || 0) > 0 ? null : "Нужен Пси-Рейтинг больше 0";
    }
    if (!parent && folderName === "Скитарии") {
      const has = this.actor.items.some(i => i.type === "implant" && i.name === "Skitarii War Plate / Боевые Латы Скитарии");
      return has ? null : "Нужны установленные Боевые Латы Скитарии";
    }
    if (!parent && folderName === "Таланты Боли") {
      return DRUKHARI_RACES.includes(sys.race) ? null : "Нужна раса Друкхари";
    }
    if (!parent && (folderName === "Механикум" || folderName === "Техномистик")) {
      const has = this.actor.items.some(i => i.type === "trait" && i.name === "Mechanicum Implants / Импланты Механикум");
      return has ? null : "Нужна Черта Mechanicum Implants / Импланты Механикум";
    }
    // Возможность, а не раса: доступ открывает правило «astartes.geneseed»
    // (module/rules/library/astartes.mjs). Любая другая раса с Геносеменем
    // получит ту же папку из своих данных, без правки этой строки.
    if (!parent && folderName === "Геносемя") {
      return hasRuleFlag(this.actor, "talents.geneSeed") ? null : "Нужно Геносемя (раса Астартес)";
    }
    return null;
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


  /** Сводка Гемункула для вкладки: лестница ступеней, бюджеты, таблицы. */
  _haemContext() {
    const st = haemState(this.actor);
    const h  = this.actor.system.haemonculus || {};

    const ladder = HAEM_STAGES.map(s => ({
      stage: s.stage, name: s.name, gain: s.gain, cost: s.stage ? s.cost : 0, inf: s.inf,
      req: s.req, sample: s.sample, benefits: s.benefits,
      open: s.stage <= st.stage, isCurrent: s.stage === st.stage
    }));

    const budgets = st.split
      ? [pool("Идеал Плоти", st.pools.flesh), pool("Идеал Варпа", st.pools.warp)]
      : [pool("Общий пул", st.pools.shared)];
    function pool(label, p) {
      const cap = p.cap || 0;
      return { label, cap, spent: p.spent, over: p.spent > cap,
               pct: cap ? Math.min(100, Math.round(p.spent / cap * 100)) : 0 };
    }

    // Строка таблицы: определение трейта + текущее состояние покупки.
    const rows = (defs, kind) => defs.map(d => {
      const taken = (h[kind] || []).find(e => e.key === d.key);
      const ranks = taken ? Math.max(1, Number(taken.ranks) || 1) : 0;
      return { key: d.key, name: d.name, take: d.take, up: d.up, note: d.note,
               noCor: kind === "warp" && d.cor === false,
               taken: !!taken, ranks, cost: taken ? traitCost(d, ranks) : 0 };
    });

    return {
      ...st, current: HAEM_STAGES[st.stage], ladder, budgets,
      anyTable: st.fleshOpen || st.warpOpen,
      tables: [
        { kind: "flesh", title: "ИДЕАЛ ПЛОТИ", open: st.fleshOpen, needStage: 1,
          rows: rows(HAEM_FLESH_TRAITS, "flesh") },
        { kind: "warp",  title: "ИДЕАЛ ВАРПА", open: st.warpOpen,  needStage: 4,
          corNote: true, cor: st.warpCor, rows: rows(HAEM_WARP_TRAITS, "warp") }
      ]
    };
  }

  /** Взойти на следующую ступень / откатить текущую. */
  async _haemStep(delta) {
    const cur  = Number(this.actor.system.haemonculus?.stage) || 0;
    const next = Math.max(0, Math.min(5, cur + delta));
    if (next === cur) return;
    if (delta > 0) {
      const s = HAEM_STAGES[next];
      const ok = await Dialog.confirm({
        title: `Стадия ${next} — ${s.name}`,
        content: `<p><b>Стоимость:</b> ${s.cost} xp${s.inf ? `, требуется Inf ${s.inf}` : ""}.</p>`
               + `<p><b>Требования:</b> ${s.req}</p>`
               + (s.sample ? `<p><b>Образец:</b> ${s.sample}</p>` : "")
               + `<p>Опыт списывается вручную во вкладке РАЗВИТИЕ — ступени идут отдельной веткой.</p>`
      });
      if (!ok) return;
    }
    await this.actor.update({ "system.haemonculus.stage": next });
  }

  /** Взять или убрать трейт из таблицы Идеала. */
  async _haemToggleTrait(kind, key) {
    const def = HAEM_TRAIT_MAP[kind]?.[key];
    if (!def) return;
    const list = foundry.utils.duplicate(this.actor.system.haemonculus?.[kind] || []);
    const i = list.findIndex(e => e.key === key);
    if (i >= 0) list.splice(i, 1);
    else list.push({ key, ranks: 1 });
    await this.actor.update({ [`system.haemonculus.${kind}`]: list });
  }

  /** Изменить число рейтингов взятого трейта. */
  async _haemRank(kind, key, delta) {
    const def = HAEM_TRAIT_MAP[kind]?.[key];
    if (!def || def.up == null) return;
    const list = foundry.utils.duplicate(this.actor.system.haemonculus?.[kind] || []);
    const e = list.find(x => x.key === key);
    if (!e) return;
    e.ranks = Math.max(1, (Number(e.ranks) || 1) + delta);
    await this.actor.update({ [`system.haemonculus.${kind}`]: list });
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
    html.find(".haem-advance-btn").click(() => this._haemStep(1));
    html.find(".haem-descend-btn").click(() => this._haemStep(-1));
    html.find(".haem-toggle-btn").click(ev => {
      const d = ev.currentTarget.dataset;
      this._haemToggleTrait(d.kind, d.key);
    });
    html.find(".haem-rank-btn").click(ev => {
      const d = ev.currentTarget.dataset;
      this._haemRank(d.kind, d.key, Number(d.delta));
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
    html.find(".char-wizard-btn").click(ev => {
      ev.preventDefault();
      this._showCreationWizard();
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

    // Реестр органов Геносемени на вкладке ТЕЛО — открыть орган по клику.
    html.find(".geneseed-name-link").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) item.sheet?.render(true);
    });

    // Ручное состояние органа Геносемени: не вживлён / вживлён / не работает.
    // "installed" решает, попадает ли орган на био-скан и в снаряжение как
    // установленный; "disabled" — отдельный флаг, глушащий только его эффекты
    // (см. gate в actor.mjs), сам орган при этом остаётся на месте.
    html.find(".geneseed-state-select").change(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      const state = ev.currentTarget.value;
      if (state === "off") {
        await item.unsetFlag("warhammer-dbc", "disabled");
        await item.unsetFlag("warhammer-dbc", "installed");
      } else if (state === "on") {
        await item.unsetFlag("warhammer-dbc", "disabled");
        await item.setFlag("warhammer-dbc", "installed", true);
      } else {
        await item.setFlag("warhammer-dbc", "installed", true);
        await item.setFlag("warhammer-dbc", "disabled", true);
      }
      // Тот же тумблер гасит и любые ActiveEffect, добавленные на орган через
      // вкладку «Эффекты» — только "on" считается по-настоящему активным.
      await syncItemEffectsDisabled(item, state === "on");
      // ...и любое выданное этим органом снаряжение/оружие (Кислотный плевок
      // Железы Бетчера и т.п.) — появляется/исчезает вместе с состоянием.
      await syncGrantedEquipment(item);
      await syncAstartesImplantWeapon(item);
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

    // Длительность теперь бросается автоматически при применении препарата
    // (см. _applyDrug). Отдельная кнопка-бросок убрана.

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
    // Уровень улучшения → накопительная авто-цена по склонностям (стр. 23-24).
    // Цена = сумма шагов +5..+25 до выбранного уровня (категория по совпадению склонностей).
    const CHAR_IMP_STEPS = { none: 0, simple: 1, average: 2, trained: 3, significant: 4, expert: 5 };
    // grantedImp — бесплатный уровень улучшения от архетипа/расы (кнопка ★):
    // опыт считается только за ступени ВЫШЕ выданного, как и у навыков.
    const charImpCost = (charKey, improvement, grantedImp) => {
      const apts  = charAptitudeSet(this.actor.system.aptitudes);
      const steps = CHAR_IMP_STEPS[improvement] ?? 0;
      const floor = CHAR_IMP_STEPS[grantedImp ?? this.actor.system.characteristics?.[charKey]?.grantedImp] ?? 0;
      let sum = 0;
      for (let i = Math.max(floor, 0); i < steps; i++) sum += charCostXP(i, charKey, apts);
      return sum;
    };
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

    // Ранг навыка → накопительная авто-цена по склонностям (стр. 23-24, 57).
    // grantedRank — бесплатный базовый уровень от архетипа/расы (стр. 5-21): опыт
    // тратится только за ступени ВЫШЕ выданного (иначе раздувалась трата).
    const SKILL_RANK_STEPS = { untrained: 0, knows: 1, trained: 2, veteran: 3, expert: 4 };
    const skillCumCost = (def, rank, entryChar, grantedRank) => {
      const apts  = charAptitudeSet(this.actor.system.aptitudes);
      const itemApts = [entryChar || def?.char, def?.apt2].filter(Boolean);
      const steps  = SKILL_RANK_STEPS[rank] ?? 0;
      const floor  = SKILL_RANK_STEPS[grantedRank] ?? 0;
      let sum = 0;
      // Имя навыка берём из его определения — в этой области видимости
      // отдельной переменной name нет.
      // Общие знания и Ремесло всегда Дружественные — это перебивает и
      // Склонности, и культуру легиона (стр. 58, 61).
      const _cc = def?.alwaysAlly ? "ally"
        : cultureCat("skill", def?.label || def?.name || "", "", cultFxOf(this.actor));
      for (let i = Math.max(floor, 0); i < steps; i++) sum += skillCostXP(i, itemApts, apts, _cc);
      return sum;
    };

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

    // ── Групповые навыки ──────────────────────────────────────────────────
    html.find(".add-group-skill").click(ev => {
      ev.preventDefault(); ev.stopPropagation();
      this._addGroupSkill(ev.currentTarget.dataset.group);
    });
    html.find(".group-skill-rank-select").change(ev => {
      const el      = ev.currentTarget;
      const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[el.dataset.group] ?? []);
      const idx     = parseInt(el.dataset.index);
      if (entries[idx]) {
        entries[idx].rank = el.value;
        const def = GROUP_SKILLS_DEF[el.dataset.group];
        entries[idx].cost = skillCumCost(def, el.value, entries[idx].char, entries[idx].grantedRank || "untrained");
      }
      this.actor.update({ [`system.groupSkills.${el.dataset.group}`]: entries });
    });
    html.find(".group-skill-cost-input").change(ev => {
      const el      = ev.currentTarget;
      const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[el.dataset.group] ?? []);
      const idx     = parseInt(el.dataset.index);
      if (entries[idx]) entries[idx].cost = parseInt(el.value) || 0;
      this.actor.update({ [`system.groupSkills.${el.dataset.group}`]: entries });
    });
    html.find(".group-skill-char-select").change(ev => {
      const el      = ev.currentTarget;
      const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[el.dataset.group] ?? []);
      const idx     = parseInt(el.dataset.index);
      if (entries[idx]) entries[idx].char = el.value;
      this.actor.update({ [`system.groupSkills.${el.dataset.group}`]: entries });
    });

    // Контекстное меню групповых навыков
    html.find(".group-skill-entry-row").on("contextmenu", ev => {
      ev.preventDefault(); ev.stopPropagation();
      $(".wh-context-menu").remove();
      const row      = $(ev.currentTarget);
      const groupKey = row.data("group");
      const idx      = parseInt(row.data("index"));
      const menu = $(`
        <div class="wh-context-menu">
          <div class="wh-ctx-item wh-ctx-rename">✏️ Переименовать</div>
          <div class="wh-ctx-item wh-ctx-delete">🗑️ Удалить</div>
        </div>
      `).css({ top: ev.clientY + "px", left: ev.clientX + "px", position: "fixed" });
      $("body").append(menu);
      setTimeout(() => { $(document).one("click.wh-ctx", () => menu.remove()); }, 50);
      menu.find(".wh-ctx-rename").on("click", ev2 => {
        ev2.stopPropagation(); menu.remove(); $(document).off("click.wh-ctx");
        const entries = this.actor.system.groupSkills?.[groupKey] ?? [];
        const current = entries[idx]?.specialty ?? "";
        this._showRenameDialog(current).then(newName => {
          if (!newName || newName === current) return;
          const updated = foundry.utils.deepClone(this.actor.system.groupSkills?.[groupKey] ?? []);
          if (updated[idx]) updated[idx].specialty = newName;
          this.actor.update({ [`system.groupSkills.${groupKey}`]: updated });
        });
      });
      menu.find(".wh-ctx-delete").on("click", ev2 => {
        ev2.stopPropagation(); menu.remove(); $(document).off("click.wh-ctx");
        const updated = foundry.utils.deepClone(this.actor.system.groupSkills?.[groupKey] ?? []);
        updated.splice(idx, 1);
        this.actor.update({ [`system.groupSkills.${groupKey}`]: updated });
      });
    });
    html.find(".skills-advance-scroll").on("scroll", () => {
      $(".wh-context-menu").remove();
      $(document).off("click.wh-ctx");
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

    // ＋ Мутация/Дар — общий пул (см. _openMutationPicker): выбор ЛЮБОЙ
    // записи из Общих Мутаций ИЛИ Даров любого Бога, не только покровителя.
    html.find(".mutgift-add-btn").click(async ev => {
      ev.preventDefault();
      if (ev.shiftKey) {   // Shift — пустая мутация с нуля
        const item = await Item.create({ name: "Новая мутация", type: "mutation" }, { parent: this.actor });
        return item?.sheet?.render(true);
      }
      this._openMutationPicker();
    });

    // 🎲 Бросок по общему пулу (Общие Мутации ИЛИ Дар Бога — тип выбирается в
    // диалоге). Бросок можно сдвинуть на ±Inf.b (если результат не от
    // Провала) — спрашиваем модификатор.
    html.find(".mutgift-roll-btn").click(async ev => {
      ev.preventDefault();
      await this._rollMutationOrGift();
    });

    // ── Склонности персонажа (Развитие) ────────────────────────────────────
    // Текущий список как массив (защита от случая, когда значение стало объектом)
    const getAptitudes = () => {
      const v = this.actor.system.aptitudes;
      if (Array.isArray(v)) return [...v];
      if (v && typeof v === "object") return Object.values(v);
      return [];
    };
    html.find(".apt-char-add-btn").click(async ev => {
      ev.preventDefault();
      const arr = getAptitudes();
      // Первая незанятая склонность из списка (чтобы не плодить дубли/пустышки).
      const used = new Set(arr);
      const free = Object.keys(APTITUDES).find(k => k !== "general" && !used.has(k)) || "ws";
      arr.push(free);
      await this.actor.update({ "system.aptitudes": arr });
    });
    html.find(".apt-char-remove").click(async ev => {
      ev.preventDefault();
      const idx = parseInt(ev.currentTarget.dataset.index);
      const arr = getAptitudes();
      arr.splice(idx, 1);
      await this.actor.update({ "system.aptitudes": arr });
    });
    html.find(".apt-char-select").on("change", async () => {
      const arr = [];
      html.find(".apt-char-select").each((_, el) => arr.push(el.value));
      await this.actor.update({ "system.aptitudes": arr });
      // Смена склонности → пересчёт цен характеристик, навыков, групповых навыков (стр. 24).
      const upd = {};
      for (const [k, c] of Object.entries(this.actor.system.characteristics || {}))
        if (c?.improvement && c.improvement !== "none")
          upd[`system.characteristics.${k}.cost`] = charImpCost(k, c.improvement, c.grantedImp || "none");
      for (const [k, s] of Object.entries(this.actor.system.skills || {}))
        if (s?.rank && s.rank !== "untrained") upd[`system.skills.${k}.cost`] = skillCumCost(SKILLS_DEF[k], s.rank, null, s.grantedRank || "untrained");
      for (const [gk, arr2] of Object.entries(this.actor.system.groupSkills || {})) {
        if (!Array.isArray(arr2) || !arr2.length) continue;
        const def = GROUP_SKILLS_DEF[gk];
        const nw = arr2.map(e => ({ ...e, cost: (e?.rank && e.rank !== "untrained") ? skillCumCost(def, e.rank, e.char, e.grantedRank || "untrained") : (e.cost || 0) }));
        upd[`system.groupSkills.${gk}`] = nw;
      }
      if (Object.keys(upd).length) await this.actor.update(upd);
      // Пересчёт цен купленных талантов-предметов (стартовые с cost 0 не трогаем).
      const apts = charAptitudeSet(this.actor.system.aptitudes);
      const defs = { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF };
      const talUpd = this.actor.items
        .filter(it => it.type === "talent" && it.system?.purchased)
        .map(it => {
          // Mastery / Beyond Human считаем по склонностям привязанной Х-ки/Навыка
          // (aptSource), а не по записи компендиума (стр. 62).
          const a = it.system.aptSource
            ? resolveTalentAptitudes(it.name, it.system.aptitudes || [], it.system.aptSource, defs)
            : (it.system.aptitudes || []);
          return { _id: it.id, "system.cost": talentCostXP(it.system.tier, a, apts,
          this._talentCat(it.name)) };
        });
      if (talUpd.length) await this.actor.updateEmbeddedDocuments("Item", talUpd);
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

    // ── Таланты в Развитии (название + цена) ─────────────────────────────────
    const getAdvTalents = () => {
      const v = this.actor.system.advanceTalents;
      if (Array.isArray(v)) return foundry.utils.deepClone(v);
      if (v && typeof v === "object") return Object.values(v);
      return [];
    };
    html.find(".advtal-add-btn").click(async ev => {
      ev.preventDefault();
      const arr = getAdvTalents();
      arr.push({ name: "", cost: 0 });
      await this.actor.update({ "system.advanceTalents": arr });
    });
    html.find(".advtal-remove").click(async ev => {
      ev.preventDefault();
      const idx = parseInt(ev.currentTarget.dataset.index);
      const arr = getAdvTalents();
      arr.splice(idx, 1);
      await this.actor.update({ "system.advanceTalents": arr });
    });
    // Удаление КУПЛЕННОГО таланта-предмета прямо из «Развития» (возврат опыта
    // происходит сам: actor.mjs суммирует system.cost предметов-талантов).
    html.find(".advtal-item-remove").click(async ev => {
      ev.preventDefault();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      const ok = await Dialog.confirm({
        title: "Удалить талант",
        content: `<p>Удалить <b>${item.name}</b> с листа? Потраченный опыт (${parseInt(item.system?.cost) || 0}) вернётся.</p>`
      });
      if (ok) await item.delete();
    });
    html.find(".advtal-input").on("change", async () => {
      const arr = [];
      html.find(".advtal-input").each((_, el) => {
        const i = parseInt(el.dataset.index);
        if (!arr[i]) arr[i] = { name: "", cost: 0 };
        if (el.dataset.field === "cost") arr[i].cost = parseInt(el.value) || 0;
        else                             arr[i].name = el.value;
      });
      await this.actor.update({ "system.advanceTalents": arr });
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

    // ── Силы навигатора (вкладка НАВ) ──────────────────────────────────────
    html.find(".nav-add-btn").click(async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новая сила навигатора", type: "navigatorPower" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    html.find(".nav-activate-btn").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) this._activateNavigatorPower(item);
    });
    html.find(".nav-sustain-cb").change(async ev => {
      const id = ev.currentTarget.dataset.itemId;
      const on = ev.currentTarget.checked;
      // Можно поддерживать только одну Силу навигатора одновременно
      const updates = [];
      for (const it of this.actor.items) {
        if (it.type !== "navigatorPower") continue;
        const want = it.id === id ? on : false;
        if ((it.system.isSustained || false) !== want)
          updates.push({ _id: it.id, "system.isSustained": want });
      }
      if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
      for (const it of this.actor.items) {
        if (it.type !== "navigatorPower") continue;
        await syncItemEffectsDisabled(it, it.id === id ? on : false);
      }
    });

    // ── Псайкана ──────────────────────────────────────────────────────────
    // Базовый PR и Природа Дара редактируются и в ПСИ, и в Развитии — через
    // class-обработчики (без name=), чтобы не было конфликта дублей в форме.
    html.find(".psy-rating-input").change(ev => {
      this.actor.update({ "system.psyker.rating": parseInt(ev.currentTarget.value) || 0 });
    });
    html.find(".psy-class-select").change(ev => {
      this.actor.update({ "system.psyker.class": ev.currentTarget.value });
    });

    html.find(".psy-add-btn").click(async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новая психосила", type: "psychicPower" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    html.find(".psy-sustain-cb").change(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) { await item.update({ "system.isSustained": ev.currentTarget.checked }); await syncItemEffectsDisabled(item); }
    });
    html.find(".psy-manifest-btn").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) this._showManifestDialog(item);
    });
    html.find(".psy-sense-btn").click(() => this._rollPsyniscience());
    html.find(".psy-hood-btn").click(() => this._rollPsyWpTest(
      "🛡️ Пси-капюшон",
      "Реакция: встречный тест W+PR×5 — уменьшает Успехи вражеской манифестации на ваши (при равенстве/больше — гасит силу)."));
    html.find(".psy-soulburn-btn").click(() => _resolveSoulBurn(this.actor.id));

    // ── Техночудеса ─────────────────────────────────────────────────────────
    html.find(".tech-add-btn").click(async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новое Техночудо", type: "techPower" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    html.find(".tech-sustain-cb").change(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) { await item.update({ "system.sustained": ev.currentTarget.checked }); await syncItemEffectsDisabled(item); }
    });
    html.find(".tech-activate-btn").click(ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) this._activateTechMiracle(item);
    });
    html.find(".cognition-input").change(ev => {
      this.actor.update({ "system.cognition.value": parseInt(ev.currentTarget.value) || 0 });
    });
    html.find(".energy-input").change(ev => {
      this.actor.update({ "system.energy.value": parseInt(ev.currentTarget.value) || 0 });
    });
    html.find(".energy-max-input").change(ev => {
      this.actor.update({ "system.energy.max": parseInt(ev.currentTarget.value) || 0 });
    });
    html.find(".cognition-rest-btn").click(async ev => {
      ev.preventDefault();
      const cog = this.actor.system.cognition || { value: 0, max: 0, regen: 0 };
      const nv  = Math.min(cog.max || 0, (cog.value || 0) + (cog.regen || 0));
      await this.actor.update({ "system.cognition.value": nv });
    });
    html.find(".tech-scan-btn").click(() => {
      const def = SKILLS_DEF.techUse;
      const sk  = this.actor.system.skills?.techUse;
      this._rollSkill("📡 Ноосферное Сканирование (Tech-Use)", sk?.total ?? -20, def?.char ?? "int", { skill: "techUse" });
    });
    // Кнопки генерации ⚙/⚡ от имплантов Кибернетики Механикум
    html.find(".tech-gen-btn").click(ev => {
      const d = ev.currentTarget.dataset;
      const item = this.actor.items.get(d.itemId);
      this._techGenResource(item, {
        res: d.res, amount: parseInt(d.amount) || 0,
        fromCognition: parseInt(d.fromCog) || 0
      });
    });
    // Тумблеры энергосистем (Печь Плоти / Солнечный Конвертер)
    html.find(".tech-toggle-cb").change(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await item.setFlag("warhammer-dbc", "techActive", ev.currentTarget.checked);
    });

    html.find(".weapon-equip-cb").change(async ev => {
      const itemId   = ev.currentTarget.dataset.itemId;
      const equipped = ev.currentTarget.checked;
      const item     = this.actor.items.get(itemId);
      if (item) { await item.update({ "system.equipped": equipped }); await syncItemEffectsDisabled(item, equipped); }
    });

    html.find(".armor-equip-cb").change(async ev => {
      const itemId   = ev.currentTarget.dataset.itemId;
      const equipped = ev.currentTarget.checked;
      const item     = this.actor.items.get(itemId);
      if (item) { await item.update({ "system.equipped": equipped }); await syncItemEffectsDisabled(item, equipped); }
    });

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

    // ── Ручные щиты (стр. 215) ───────────────────────────────────────────
    // Рука определяет, какая «Р1» в зонах защиты; «поднять щит» включает зоны,
    // указанные в скобках (они прикрываются лишь осознанным движением).
    html.find(".shield-hand-btn").click(async ev => {
      ev.preventDefault();
      const el = ev.currentTarget;
      const item = this.actor.items.get(el.dataset.itemId);
      if (item) await item.setFlag("warhammer-dbc", "shieldHand", el.dataset.hand);
    });
    html.find(".shield-raise-btn").click(async ev => {
      ev.preventDefault();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      const on = !item.getFlag("warhammer-dbc", "shieldRaised");
      await item.setFlag("warhammer-dbc", "shieldRaised", on);
      ui.notifications.info(on
        ? `${item.name}: щит поднят — прикрыты дополнительные зоны.`
        : `${item.name}: щит опущен.`);
    });

    html.find(".weapon-reload-btn").click(async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await _reloadWeapon(this.actor, item);
    });

    html.find(".weapon-ammo-select").change(async ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      const ammoId = ev.currentTarget.value;
      const item   = this.actor.items.get(itemId);
      if (item) await item.update({ "system.loadedAmmoId": ammoId });
    });

    // ── Контекстное меню предметов ────────────────────────────────────────
    html.find(".item-row").on("contextmenu", ev => {
      ev.preventDefault(); ev.stopPropagation();
      $(".wh-context-menu").remove();
      const itemId = $(ev.currentTarget).data("item-id");
      const item   = this.actor.items.get(itemId);
      if (!item) return;
      const menu = $(`
        <div class="wh-context-menu">
          <div class="wh-ctx-item wh-ctx-edit">✏️ Редактировать</div>
          <div class="wh-ctx-item wh-ctx-delete">🗑️ Удалить</div>
        </div>
      `).css({ top: ev.clientY + "px", left: ev.clientX + "px", position: "fixed" });
      $("body").append(menu);
      setTimeout(() => { $(document).one("click.wh-ctx", () => menu.remove()); }, 50);

      menu.find(".wh-ctx-edit").on("click", ev2 => {
        ev2.stopPropagation(); menu.remove(); $(document).off("click.wh-ctx");
        const sheet = item.sheet;
        if (sheet) { sheet.render(true); }
        else { new WarhammerItemSheet(item).render(true); }
      });

      menu.find(".wh-ctx-delete").on("click", ev2 => {
        ev2.stopPropagation(); menu.remove(); $(document).off("click.wh-ctx");
        item.delete();
      });
    });

    html.find(".shield-row").on("dblclick", ev => {
      if ($(ev.target).closest("button").length) return;
      const itemId = $(ev.currentTarget).data("item-id");
      const item   = this.actor.items.get(itemId);
      if (item) item.sheet.render(true);
    });

    html.find(".shield-toggle-btn, .shield-roll-btn, .shield-repair-btn").on("contextmenu", ev => {
      ev.stopPropagation();
    });

    html.find(".shield-toggle-btn").on("click", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item   = this.actor.items.get(itemId);
      if (item) await _toggleShield(this.actor, item);
    });

    html.find(".shield-roll-btn").on("click", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item   = this.actor.items.get(itemId);
      if (item) await _rollShieldActivation(this.actor, item);
    });

    html.find(".shield-repair-btn").on("click", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      const item   = this.actor.items.get(itemId);
      if (item) await _repairShield(this.actor, item);
    });

    // ── Препараты ─────────────────────────────────────────────────────────────
html.find(".drug-apply-btn").click(async ev => {
  ev.preventDefault();
  const itemId = ev.currentTarget.dataset.itemId;
  const item   = this.actor.items.get(itemId);
  if (item) await this._applyDrug(item);
});

html.find(".drug-apply-other-btn").click(async ev => {
  ev.preventDefault();
  const itemId = ev.currentTarget.dataset.itemId;
  const item   = this.actor.items.get(itemId);
  if (!item) return;
  const target = this._resolveOtherTargetActor();
  if (!target) return;
  await this._applyDrug(item, target);
});

html.find(".drug-name-link").click(ev => {
  ev.preventDefault();
  const itemId = ev.currentTarget.dataset.itemId;
  const item   = this.actor.items.get(itemId);
  if (item) item.sheet.render(true);
});

html.find(".effect-deactivate-btn").click(async ev => {
  ev.preventDefault();
  const itemId = ev.currentTarget.dataset.itemId;
  const item   = this.actor.items.get(itemId);
  if (!item) return;
  await item.update({
    "system.activeEffect.isActive":         false,
    "system.activeEffect.isAfterEffect":    false,
    "system.activeEffect.roundsRemaining":  0,
    "system.activeEffect.charDamageStat":   "",
    "system.activeEffect.charDamageAmount": 0
  });
  ui.notifications.info(`Эффект «${item.name}» завершён.`);
});

// ── Пост-эффект препарата ──────────────────────────────────────────────────
html.find(".effect-trigger-after-btn").click(async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  const itemId = ev.currentTarget.dataset.itemId;
  const item   = this.actor.items.get(itemId);
  if (!item) return;
  await this._triggerAfterEffect(item);
});

// ── Тест Зависимости ────────────────────────────────────────────────────────
html.find(".addiction-test-btn").click(async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  const item    = this.actor.items.get(ev.currentTarget.dataset.itemId);
  const charKey = ev.currentTarget.dataset.char || "t";
  const mod     = parseInt(ev.currentTarget.dataset.mod) || 0;
  await this._rollAddictionTest(item, charKey, mod);
});

// ── Снять зависимость ────────────────────────────────────────────────────────
html.find(".addiction-remove-btn").click(async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
  if (item) await item.update({ "system.addiction.isAddicted": false });
  // Снимаем общее состояние «Зависимость», если больше нет активных зависимостей
  const stillAddicted = this.actor.items.some(i =>
    i.type === "drug" && i.system.addiction?.hasAddiction && i.system.addiction?.isAddicted
  );
  if (!stillAddicted) await this.actor.update({ "system.conditions.addicted": false });
});
    // ── Состояния ─────────────────────────────────────────────────────────
    html.find(".conditions-add-btn").click(ev => {
      ev.preventDefault();
      this._showAddConditionDialog();
    });

    // Переключатель типа тела (муж./жен.) на вкладке ТЕЛО.
    html.find(".bc-sex-toggle").click(async ev => {
      ev.preventDefault();
      const cur = ev.currentTarget.dataset.bodytype || "male";
      await this.actor.setFlag("warhammer-dbc", "bodyType", cur === "female" ? "male" : "female");
    });

    // Открыть окно имплантации (хирургеон).
    html.find(".bc-surgeon-btn").click(ev => { ev.preventDefault(); openSurgeon(this.actor); });

    // Жизненные потребности: изменить стадию Голода/Жажды/Сна (0-3).
    const _setVital = async (key, val) => {
      const v = Math.max(0, Math.min(3, Math.round(Number(val) || 0)));
      await this.actor.update({ [`system.vitals.${key}`]: v });
    };
    html.find("[data-vital-adj]").on("click", ev => {
      ev.preventDefault();
      const b = ev.currentTarget;
      const key = b.dataset.vitalAdj;
      const cur = Math.round(Number(this.actor.system.vitals?.[key]) || 0);
      _setVital(key, cur + Number(b.dataset.dir));
    });
    html.find("[data-vital-reset]").on("click", ev => { ev.preventDefault(); _setVital(ev.currentTarget.dataset.vitalReset, 0); });

    // ── Одержимый: Проявить / Заключить (полудействие + тест Cor+20) ──────────
    html.find(".poss-manifest-btn").on("click", async ev => {
      ev.preventDefault();
      await this._toggleManifest();
    });

    // Всплывающие подсказки при наведении на импланты/органы фигуры.
    const figPanel = html.find(".bc-figure-panel")[0];
    if (figPanel) {
      let tipEl = figPanel.querySelector(".bc-imp-tip");
      if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "bc-imp-tip"; figPanel.appendChild(tipEl); }
      figPanel.querySelectorAll(".body-implants .imp-tipwrap[data-tip]").forEach(gEl => {
        gEl.addEventListener("mouseenter", () => { tipEl.textContent = gEl.getAttribute("data-tip"); tipEl.classList.add("show"); });
        gEl.addEventListener("mousemove", ev => {
          const r = figPanel.getBoundingClientRect();
          const x = Math.min(ev.clientX - r.left + 12, figPanel.clientWidth - 208);
          const y = Math.min(ev.clientY - r.top + 12, figPanel.clientHeight - 44);
          tipEl.style.left = Math.max(4, x) + "px"; tipEl.style.top = Math.max(4, y) + "px";
        });
        gEl.addEventListener("mouseleave", () => tipEl.classList.remove("show"));
      });
    }

    // Констатация смерти — останавливает кардиомонитор (плоская линия).
    html.find(".bc-death-toggle").change(async ev => {
      await this.actor.setFlag("warhammer-dbc", "deceased", ev.currentTarget.checked);
    });

    // Выбор стороны (Л/П) для имплантов конечностей/глаз в реестре аугметики.
    html.find(".bc-side-btn").click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      const side = ev.currentTarget.dataset.side;
      const cur  = item.getFlag("warhammer-dbc", "bodySide");
      if (cur === side) await item.unsetFlag("warhammer-dbc", "bodySide");
      else await item.setFlag("warhammer-dbc", "bodySide", side);
    });

    html.find(".condition-remove-btn").click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const condition = ev.currentTarget.dataset.condition;
      const def       = CONDITIONS_DEF[condition];
      const updates   = { [`system.conditions.${condition}`]: false };
      if (def?.hasLevel && def.levelField) {
        updates[`system.conditions.${def.levelField}`] = 0;
      }
      await this.actor.update(updates);
    });

    html.find(".condition-level-input").change(async ev => {
      ev.stopPropagation();
      const condition = ev.currentTarget.dataset.condition;
      const def       = CONDITIONS_DEF[condition];
      const val       = parseInt(ev.currentTarget.value) || 0;
      if (!def?.hasLevel || !def.levelField) return;
      await this.actor.update({
        [`system.conditions.${def.levelField}`]: val
      });
    });

    // ── Усталость ─────────────────────────────────────────────────────────
    html.find(".fatigue-add-btn").click(async ev => {
      ev.preventDefault();
      await this._addFatigue(1);
    });
    html.find(".fatigue-remove-btn").click(async ev => {
      ev.preventDefault();
      await this._removeFatigue(1);
    });
    html.find(".fatigue-rest-btn").click(async ev => {
      ev.preventDefault();
      await this._fatiguePeriodRest();
    });
    html.find(".fatigue-sleep-btn").click(async ev => {
      ev.preventDefault();
      await this._fatigueSleep();
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── МЕХАНИКА УСТАЛОСТИ
  // ══════════════════════════════════════════════════════════════════════════

  async _addFatigue(amount = 1) {
    const system   = this.actor.system;
    const tb        = system.characteristics?.t?.bonus  ?? 0;
    const wb        = system.characteristics?.wp?.bonus ?? 0;
    const threshold = tb + wb;
    const current  = system.fatigue?.value ?? 0;
    const newVal   = current + amount;

    const updates = {
      "system.fatigue.value": newVal,
      "system.fatigue.max":   threshold
    };

    if (threshold > 0 && newVal >= threshold) {
      const unconsciousMinutes = Math.max(1, 10 - tb);
      updates["system.conditions.unconscious"] = true;

      await this.actor.update(updates);

      const rollMode = game.settings.get("core", "rollMode");
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("warn","#ff6b6b")}${this.actor.name} — Потеря сознания!</div>
          <div class="roll-threshold">
            Усталость: <b>${newVal}</b> ≥ порог T.b + W.b (<b>${threshold}</b>) — превышен.
          </div>
          <div class="roll-outcome">
            <span class="roll-failure">
              Персонаж без сознания <b>${unconsciousMinutes}</b> мин.
              (10 − ${tb} = ${unconsciousMinutes}, мин. 1)
            </span>
          </div>
          <div class="roll-threshold" style="font-size:0.85em;">
            После прихода в себя — снимается 1 Усталость автоматически.
          </div>
        </div>`
      }, rollMode));

      ui.notifications.warn(`${this.actor.name} потерял сознание на ${unconsciousMinutes} минут!`);
    } else {
      await this.actor.update(updates);
      if (newVal >= 1 && current < 1) {
        ui.notifications.info(`${this.actor.name}: Усталость 1+ — штраф −10 на все тесты (кроме T, Inf, Cog).`);
      }
    }
  }

  async _removeFatigue(amount = 1) {
    const system   = this.actor.system;
    const current  = system.fatigue?.value ?? 0;
    const tb        = system.characteristics?.t?.bonus  ?? 0;
    const wb        = system.characteristics?.wp?.bonus ?? 0;
    const threshold = tb + wb;
    const newVal   = Math.max(0, current - amount);

    const updates = {
      "system.fatigue.value": newVal,
      "system.fatigue.max":   threshold
    };

    if (system.conditions?.unconscious && newVal < threshold) {
      updates["system.conditions.unconscious"] = false;
    }

    await this.actor.update(updates);
  }

  async _fatiguePeriodRest() {
    const current = this.actor.system.fatigue?.value ?? 0;
    if (current <= 0) {
      ui.notifications.info(`${this.actor.name}: Усталость и так 0.`);
      return;
    }
    await this._removeFatigue(1);

    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("spark","#4dffa6")}${this.actor.name} — Час отдыха</div>
        <div class="roll-outcome">
          <span class="roll-success">Снята 1 Усталость. Осталось: <b>${Math.max(0, current - 1)}</b></span>
        </div>
      </div>`
    }, rollMode));
  }

  async _fatigueSleep() {
    const current = this.actor.system.fatigue?.value ?? 0;
    const tb      = this.actor.system.characteristics?.t?.bonus  ?? 0;
    const wb      = this.actor.system.characteristics?.wp?.bonus ?? 0;

    await this.actor.update({
      "system.fatigue.value":          0,
      "system.fatigue.max":            tb + wb,
      "system.conditions.unconscious": false
    });

    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("spark","#4dffa6")}${this.actor.name} — Полноценный сон</div>
        <div class="roll-outcome">
          <span class="roll-success">Вся Усталость снята (было: <b>${current}</b>).</span>
        </div>
      </div>`
    }, rollMode));
  }

  // ── Диалог добавления состояния ───────────────────────────────────────────

  _showAddConditionDialog() {
    const conds = this.actor.system.conditions || {};
    const inactive = Object.entries(CONDITIONS_DEF)
      .filter(([key]) => !conds[key])
      .map(([key, def]) =>
        `<label class="add-cond-label" style="--cond-color:${def.color || "#4dffa6"};">
          <input type="checkbox" class="add-cond-cb" data-condition="${key}"/>
          <span class="add-cond-icon">${def.svg || def.icon}</span>
          <span class="add-cond-name">${def.label}</span>
        </label>`
      ).join("");

    if (!inactive) {
      ui.notifications.info("Все состояния уже активны!");
      return;
    }

    new Dialog({
      title: "Добавить состояние",
      content: `
        <form class="wh-add-condition-form">
          <div class="add-cond-list">${inactive}</div>
        </form>`,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Добавить",
          callback: async html => {
            const updates = {};
            html.find(".add-cond-cb:checked").each((_, cb) => {
              const key = cb.dataset.condition;
              updates[`system.conditions.${key}`] = true;
            });
            if (Object.keys(updates).length > 0) {
              await this.actor.update(updates);
            }
          }
        },
        cancel: { label: "Отмена" }
      },
      default: "add"
    }, { classes: ["dialog", "wh-add-condition-dialog", "warhammer-dbc", "wh-holo"], width: 360 }).render(true);
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

  _showRenameDialog(currentName) {
    return new Promise(resolve => {
      let resolved = false;
      const d = new Dialog({
        title: "Переименовать специализацию",
        content: `<form style="padding:8px 4px;">
          <input type="text" id="rename-input" value="${currentName}"
            style="width:100%;padding:4px 6px;background:var(--wh-input-bg,#ccc8bc);
                   border:1px solid var(--wh-border,#7a5c2e);font-family:inherit;
                   font-size:1em;box-sizing:border-box;" autocomplete="off"/>
        </form>`,
        buttons: {
          ok: {
            icon: '<i class="fas fa-check"></i>', label: "Сохранить",
            callback: html => {
              if (!resolved) {
                resolved = true;
                resolve(html.find("#rename-input").val().trim() || null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>', label: "Отмена",
            callback: () => { if (!resolved) { resolved = true; resolve(null); } }
          }
        },
        default: "ok",
        render: html => {
          setTimeout(() => {
            const inp = html.find("#rename-input")[0];
            if (inp) { inp.focus(); inp.select(); }
          }, 50);
          html.find("#rename-input").on("keydown", ev => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              if (!resolved) {
                resolved = true;
                const val = html.find("#rename-input").val().trim();
                d.close(); resolve(val || null);
              }
            }
          });
        },
        close: () => { if (!resolved) { resolved = true; resolve(null); } }
      }, { classes: ["dialog","wh-rename-dialog"], width: 360 });
      d.render(true);
    });
  }

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
    const medic   = this.actor;
    const tgt     = [...(game.user.targets ?? [])][0]?.actor || null;
    const hasTgt  = !!tgt && tgt.id !== medic.id;
    const refHtml = `
      <details class="heal-reference" style="margin-top:6px;font-size:0.82em;">
        <summary style="cursor:pointer;font-weight:bold;">📖 Справка по лечению</summary>
        <div style="padding:4px 2px;line-height:1.35;">
          <b>Уровни ранения</b> (потеря Ран): Лёгкое — до T.b×2; Тяжёлое — больше T.b×2; Критическое — Отрицательные Раны (крит. урон).<br/>
          <b>Первая Помощь</b> (5 Ходов; 1 раз после урона, провал = использование): Лёгкое Medicae+10 (I.b Ран), Тяжёлое Medicae+0 (2), Критическое Medicae−10 (1).<br/>
          <b>Пассивное</b> (раз в сутки): Лёгкое 1; Тяжёлое — тест T+0 на 1; Критическое — нет.<br/>
          <b>Отдых</b> (сутки, без тяжёлой работы/боёв): Лёгкое ½T.b; Тяжёлое 1; Критическое — тест T+0 на 1.<br/>
          <b>Постельный режим</b> (сутки, лёжа): Лёгкое T.b; Тяжёлое ½T.b (окр.▲); Критическое 1.<br/>
          <b>Мед. уход</b>: Medicae+0 (лёгкий/тяжёлый) сокращает период до 8 часов; Medicae−10 (критический) — лечится как тяжёлый, но раз в сутки.<br/>
          <b>Физиология Астартес</b>: всегда считается отдыхающим; реальный отдых = постельный режим; полный постельный режим не ускоряет сверх этого.<br/>
          <b>Прижигание</b>: раскалённым предметом — 1d5 Усталости и 1d10 урона в Т, цель фиксируют или тест W−20; иногда останавливает заражение через рану.<br/>
          <b>Бесполезные конечности/Ампутация</b>: лечение перелома — 5 мин + Medicae+0 (конечность бесполезна 2d10−T.b сут.). Без помощи 2×T.b ч — перманентно; ампутация Medicae−10 (провал → Кровотечение, обрубок Medicae−10 или Гангрена).<br/>
          <b>Пришивание конечностей</b>: Medicae−30 (нужно качественное снаряжение); успех — восстановление 1d10+3−T.b сут.<br/>
          <b>Бионика/Кибернетика</b>: установка Medicae−30; провал — 1d10 непогл. R; успех — 1d10+3−T.b сут. адаптации.<br/>
          <b>Кома</b>: вывод раз в 10−T.b дней тестом Medicae−40 (нужен уход и питание).<br/>
          <b>Лечение болезней</b>: по умолчанию постельный режим; просто отдых −20, без отдыха −40; тест обычно раз в сутки.
        </div>
      </details>`;

    const content = `
      <form class="wh-wizard-form" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("heart","#ff8a8a")}Лечение</span></div>
        <div class="atk-dlg-row"><label>Пациент:</label>
          <select id="heal-patient">
            <option value="self">${medic.name} (себя)</option>
            ${hasTgt ? `<option value="target" selected>${tgt.name} (цель)</option>` : ``}
          </select>
        </div>
        <div class="atk-dlg-row"><label>Режим:</label>
          <select id="heal-mode">
            <option value="firstAid">Первая Помощь (тест Медики)</option>
            <option value="rest">Отдых (сутки)</option>
            <option value="bedRest">Постельный режим (сутки)</option>
            <option value="passive">Пассивное (сутки)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label title="Medicae: критический лечится как тяжёлый; период до 8 часов"><input type="checkbox" id="heal-care"/> Мед. уход</label></div>
        <div class="atk-dlg-row"><label>Мод. теста:</label><input type="number" id="heal-mod" value="0" style="width:60px;"/></div>
        <div class="atk-dlg-row"><label title="Напр. Мастер-Хирургеон +2">Доп. Раны:</label><input type="number" id="heal-bonus" value="0" style="width:60px;"/></div>
        <div id="heal-note" class="atk-range-info" style="font-size:0.84em;"></div>
        ${refHtml}
      </form>`;

    const updateNote = (html) => {
      const patient = html.find("#heal-patient").val() === "target" ? tgt : medic;
      if (!patient) return;
      const lvl   = _woundLevel(patient.system);
      const parts = [
        `<b>Пациент:</b> ${patient.name}`,
        `<b>Уровень ранения:</b> ${lvl.label} (потеряно ${lvl.lost}${lvl.crit ? `, крит ${lvl.crit}` : ""}, T.b ${lvl.tb})`
      ];
      if (hasRuleFlag(patient, "healing.astartes")) parts.push(`<i>Физиология Астартес: всегда считается отдыхающим.</i>`);
      if (patient.system.wounds?.firstAidUsed) parts.push(`<span style="color:#a33;">⚠ Первая Помощь уже оказана (нужен новый урон).</span>`);
      html.find("#heal-note").html(parts.join("<br/>"));
    };

    new Dialog({
      title: "Лечение",
      content,
      buttons: {
        go: { icon: '<i class="fas fa-heart"></i>', label: "Выполнить", callback: async html => {
          const patient = html.find("#heal-patient").val() === "target" ? tgt : medic;
          if (!patient) { ui.notifications.warn("Нет выбранной цели — наведите таргет (T) на токен пациента."); return; }
          await this._applyHealing(patient, {
            mode:  html.find("#heal-mode").val(),
            care:  html.find("#heal-care").is(":checked"),
            mod:   parseInt(html.find("#heal-mod").val())   || 0,
            bonus: parseInt(html.find("#heal-bonus").val()) || 0
          });
        }},
        cancel: { label: "Отмена" }
      },
      default: "go",
      render: html => {
        updateNote(html);
        html.find("#heal-patient, #heal-mode").on("change", () => updateNote(html));
      }
    }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
  }

  /** Расчёт и применение лечения к пациенту + сообщение в чат. */
  async _applyHealing(patient, { mode, care, mod, bonus }) {
    const medic = this.actor;
    const lvl   = _woundLevel(patient.system);
    const tb    = lvl.tb;
    // Физиология Астартес — возможность от правил, а не раса пациента:
    // «лечится как космодесантник» книга пишет и про другие расы.
    const isAstartes = hasRuleFlag(patient, "healing.astartes");
    const rolls = [];
    const lines = [];
    let heal = 0;
    const lblOf = { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" };
    const half  = (n, up) => up ? Math.ceil(n / 2) : Math.floor(n / 2);
    const medSkill = () => medic.system.skills?.medicae?.total
      ?? ((medic.system.characteristics?.int?.value ?? 20) - 20);

    if (mode === "firstAid") {
      if (patient.system.wounds?.firstAidUsed) {
        ui.notifications.warn(`${patient.name}: Первая Помощь уже оказывалась после этого урона.`);
        return;
      }
      const testMod = ({ light: 10, heavy: 0, critical: -10 }[lvl.key]) + mod;
      const skill   = medSkill();
      const eff     = skill + testMod;
      const roll    = await new Roll("1d100").evaluate(); rolls.push(roll);
      const rv      = roll.total;
      const success = rv <= eff;
      const deg     = Math.floor(Math.abs(success ? eff - rv : rv - eff) / 10) + 1;
      const baseHeal = { light: medic.system.characteristics?.int?.bonus ?? 0, heavy: 2, critical: 1 }[lvl.key];
      lines.push(`${rollIcon("heart","#ff8a8a")}<b>Первая Помощь</b> (${lvl.label}): Медика ${skill}${testMod >= 0 ? "+" : ""}${testMod} → порог <b>${eff}</b>, бросок <b>${rv}</b> — ${success ? `<span class="roll-success">Успех (${deg})</span>` : `<span class="roll-failure">Провал (${deg})</span>`}`);
      heal = success ? Math.max(0, baseHeal + bonus) : 0;
      if (!success) lines.push(`Восстановление: 0 — Первая Помощь израсходована.`);
      try { await patient.update({ "system.wounds.firstAidUsed": true }); } catch(e) {}
    } else {
      // Физиология Астартес: пассивное → отдых; отдых → постельный режим.
      let effMode = mode;
      if (isAstartes) {
        if (mode === "passive")   effMode = "rest";
        else if (mode === "rest") effMode = "bedRest";
        if (effMode !== mode) lines.push(`<i>Астартес: режим «${({passive:"Пассивное",rest:"Отдых"})[mode]}» считается как «${({rest:"Отдых",bedRest:"Постельный режим"})[effMode]}».</i>`);
      }
      // Мед. уход.
      let key = lvl.key;
      if (care) {
        const careMod = (lvl.key === "critical" ? -10 : 0) + mod;
        const eff  = medSkill() + careMod;
        const roll = await new Roll("1d100").evaluate(); rolls.push(roll);
        const ok   = roll.total <= eff;
        if (lvl.key === "critical") {
          lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b> (крит): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — лечится как тяжёлый</span>` : `<span class="roll-failure">Провал</span>`}`);
          if (ok) key = "heavy";
        } else {
          lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b>: Медика+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — период до 8 часов</span>` : `<span class="roll-failure">Провал</span>`}`);
        }
      }
      const modeLabel = { rest: "Отдых", bedRest: "Постельный режим", passive: "Пассивное лечение" }[effMode];
      let amount = 0, needT = false;
      if (effMode === "rest") {
        amount = { light: half(tb), heavy: 1, critical: 0 }[key];
        if (key === "critical") needT = true;
      } else if (effMode === "bedRest") {
        amount = { light: tb, heavy: half(tb, true), critical: 1 }[key];
      } else { // passive
        amount = { light: 1, heavy: 0, critical: 0 }[key];
        if (key === "heavy") needT = true;
      }
      if (needT) {
        const tv   = (patient.system.characteristics?.t?.value ?? 0) + mod;
        const roll = await new Roll("1d100").evaluate(); rolls.push(roll);
        const ok   = roll.total <= tv;
        lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): тест T+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${tv}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`);
        heal = ok ? Math.max(0, 1 + bonus) : 0;
      } else {
        heal = amount > 0 ? Math.max(0, amount + bonus) : 0;
        lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): восстановление <b>${amount}</b>${bonus && amount > 0 ? ` + ${bonus} (доп.)` : ""} Ран${amount === 0 ? " — нет лечения" : ""}.`);
      }
    }

    // Применяем (не больше, чем не хватает Ран).
    const missing = Math.max(0, (patient.system.wounds?.max ?? 0) - (patient.system.wounds?.value ?? 0))
                  + (patient.system.wounds?.critical ?? 0);
    const applied = Math.min(heal, missing);
    if (applied > 0) {
      try {
        await patient.update(_computeWoundHealing(patient.system, applied));
        lines.push(`${rollIcon("heart","#ff8a8a")}Восстановлено Ран: <b>${applied}</b>${applied < heal ? ` (ограничено нехваткой)` : ""}.`);
      } catch(e) {
        lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — восстановите <b>${applied}</b> Ран вручную (нужен ГМ).`);
      }
    }

    const rollMode = game.settings.get("core", "rollMode");
    const msg = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: medic }),
      content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("heart","#ff8a8a")}Лечение — ${patient.name}</div><div class="roll-threshold">${lines.join("<br/>")}</div></div>`,
      rolls,
      sound: rolls.length ? CONFIG.sounds.dice : undefined
    }, rollMode);
    await ChatMessage.create(msg);
  }

  // ── Очки Боли (Друкхари) ──────────────────────────────────────────────────
  /** Краткое сообщение о Боли в чат. */
  async _painChatMsg(text) {
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("bolt","#c98bff")}Очки Боли — ${this.actor.name}</div><div class="roll-threshold">${text}</div></div>`
    }, game.settings.get("core", "rollMode")));
  }

  /** Впитать (+1) или потратить (−1) Очко Боли. */
  async _painChange(delta, kind) {
    const cur = this.actor.system.fate?.value ?? 0;
    const max = this.actor.system.fate?.max   ?? 0;
    if (delta > 0 && cur >= max) { ui.notifications.info(`Очки Боли уже на максимуме (${max}).`); return; }
    if (delta < 0 && cur <= 0)   { ui.notifications.info("Нет Очков Боли для траты."); return; }
    const next = Math.max(0, Math.min(max, cur + delta));
    await this.actor.update({ "system.fate.value": next });
    await this._painChatMsg(kind === "absorb"
      ? `＋ Впитана <b>1</b> Боль (Реакция). Текущая Боль: <b>${next}</b> / ${max}.`
      : `− Потрачена <b>1</b> Боль. Осталось: <b>${next}</b> / ${max}.`);
  }

  /** Выжигание Души / Варп-урон: Боль выжигается первой (3 урона за 1 Боль). */
  _painSoulBurn() {
    const content = `
      <form class="wh-wizard-form" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">🔥 Выжигание Души / Варп-урон</span></div>
        <div class="atk-dlg-row"><label>Входящий урон:</label><input type="number" id="pain-sb-dmg" value="0" min="0" style="width:70px;"/></div>
        <div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Боль выжигается первой: 1 Боль поглощает 3 урона. Остаток уходит в Раны.</div>
      </form>`;
    new Dialog({
      title: "Поглощение Болью",
      content,
      buttons: {
        go: { icon: '<i class="fas fa-fire"></i>', label: "Поглотить", callback: async html => {
          const dmg = Math.max(0, parseInt(html.find("#pain-sb-dmg").val()) || 0);
          if (!dmg) return;
          const cur = this.actor.system.fate?.value ?? 0;
          const painUsed = Math.min(cur, Math.ceil(dmg / 3));
          const absorbed = Math.min(dmg, painUsed * 3);
          const remaining = dmg - absorbed;
          const updates = { "system.fate.value": cur - painUsed };
          if (remaining > 0) Object.assign(updates, _computeWoundDamage(this.actor.system, remaining));
          await this.actor.update(updates);
          const lines = [
            `Входящий урон: <b>${dmg}</b>`,
            `${rollIcon("fire","#ff8a3a")}Выжжено Боли: <b>${painUsed}</b> → поглощено <b>${absorbed}</b> урона`,
            remaining > 0 ? `${rollIcon("blood","#ff6b6b")}В Раны: <b>${remaining}</b>` : `Урон полностью поглощён Болью`,
            `Осталось Боли: <b>${cur - painUsed}</b> / ${this.actor.system.fate?.max ?? 0}`
          ];
          await this._painChatMsg(lines.join("<br/>"));
        }},
        cancel: { label: "Отмена" }
      },
      default: "go"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
  }
// ── Активация пост-эффекта ────────────────────────────────────────────────

async _triggerAfterEffect(item) {
  const sys = item.system;
  if (!sys.hasAfterEffect) return;

  const actor = this.actor;
  const fx    = sys.afterEffectSpecial || {};

  // ── Применяем эффекты пост-эффекта ───────────────────────────────────
  const actorUpdates = {};

  // Снять кровотечение
  if (fx.removesBleedingLevels > 0) {
    const cur    = actor.system.conditions?.bleedingLevel || 0;
    const newVal = Math.max(0, cur - fx.removesBleedingLevels);
    actorUpdates["system.conditions.bleedingLevel"] = newVal;
    actorUpdates["system.conditions.bleeding"]      = newVal > 0;
  }

  // Снять усталость
  if (fx.removesFatigueLevels > 0) {
    const cur    = actor.system.conditions?.fatiguedLevel || 0;
    const newVal = Math.max(0, cur - fx.removesFatigueLevels);
    actorUpdates["system.conditions.fatiguedLevel"] = newVal;
    actorUpdates["system.conditions.fatigued"]      = newVal > 0;
    const fatVal = actor.system.fatigue?.value || 0;
    actorUpdates["system.fatigue.value"] = Math.max(0, fatVal - fx.removesFatigueLevels);
  }

  // Снять раны (ЛЕЧЕНИЕ: восстанавливаем здоровье)
  if (fx.removesWounds > 0) {
    Object.assign(actorUpdates, _computeWoundHealing(actor.system, fx.removesWounds));
  }

  // Наложить состояние
  if (fx.grantsCondition) {
    const condDef    = CONDITIONS_DEF[fx.grantsCondition];
    const lvlToGrant = fx.grantsConditionLevel ?? 1;
    actorUpdates[`system.conditions.${fx.grantsCondition}`] = true;
    if (condDef?.hasLevel && condDef.levelField) {
      const curLvl = actor.system.conditions?.[condDef.levelField] || 0;
      actorUpdates[`system.conditions.${condDef.levelField}`] = curLvl + lvlToGrant;
    }
    if (fx.grantsCondition === "fatigued") {
      const fatVal = actor.system.fatigue?.value || 0;
      actorUpdates["system.fatigue.value"] = fatVal + lvlToGrant;
    }
  }

  // Доп. (мульти-) эффекты пост-эффекта
  const extras = await _applyEffectExtras(actor, fx);
  Object.assign(actorUpdates, extras.updates);

  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);

  // ── Урон в характеристику (бросается ОДИН раз при запуске пост-эффекта) ──
  // Результат сохраняется в activeEffect и, пока пост-эффект активен,
  // автоматически вычитается из характеристики в prepareDerivedData.
  const cd = sys.afterEffectCharDamage || {};
  let charDamageStat   = "";
  let charDamageAmount = 0;
  let charDamageRoll   = null;
  let charDamageDiceStr = "";
  if (cd.stat && cd.formula) {
    const chars = actor.system.characteristics;
    const resolved = resolveCharFormula(cd.formula, chars, actor.system.corruptionBonus ?? 0);
    try {
      charDamageRoll   = await new Roll(resolved).evaluate();
      charDamageAmount = Math.max(0, charDamageRoll.total);
      charDamageStat   = cd.stat;
      if (charDamageRoll.terms) {
        const parts = [];
        for (const term of charDamageRoll.terms) {
          if (term.results) {
            const s = term.results.filter(r => r.active).reduce((a, r) => a + r.result, 0);
            parts.push(`[${s}]`);
          } else if (term.operator !== undefined) parts.push(term.operator);
          else if (term.number !== undefined)     parts.push(String(term.number));
        }
        charDamageDiceStr = parts.join("");
      }
    } catch(e) {
      ui.notifications.warn(`Не удалось бросить формулу урона в характеристику: ${cd.formula}`);
      console.error(e);
    }
  }

  // ── Переключаем флаг пост-эффекта ────────────────────────────────────
  // Препарат остаётся активным (isActive), но теперь применяются модификаторы
  // пост-эффекта. Счётчик раундов основного эффекта обнуляем.
  await item.update({
    "system.activeEffect.isActive":         true,
    "system.activeEffect.isAfterEffect":    true,
    "system.activeEffect.roundsRemaining":  0,
    "system.activeEffect.charDamageStat":   charDamageStat,
    "system.activeEffect.charDamageAmount": charDamageAmount
  });

  // ── Бросок формулы пост-эффекта (если задана) ────────────────────────
  const categoryIcon = {
    medicine: "💊", narcotic: "💉", poison: "☠️", elixir: "⚗️"
  }[sys.drugCategory] || "💊";

  let chatContent = `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("warn","#ffb84d")}Пост-эффект: ${categoryIcon} ${item.name}</div>`;

  // Модификаторы характеристик пост-эффекта
  const afterStatMods = sys.afterEffectStatMods || {};
  const afterModParts = [];
  for (const [k, v] of Object.entries(afterStatMods)) {
    if (v && v !== 0) afterModParts.push(`${k.toUpperCase()} ${v > 0 ? "+" : ""}${v}`);
  }
  if (afterModParts.length > 0) {
    chatContent += `<div class="roll-threshold">${rollIcon("chart","#8fd0ff")}Модификаторы: <b>${afterModParts.join(", ")}</b></div>`;
  }

  // Урон в характеристику
  if (charDamageStat && charDamageAmount > 0) {
    const lbl = CHARACTERISTICS[charDamageStat]?.abbr ?? charDamageStat.toUpperCase();
    chatContent += `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}Урон в характеристику <b>${lbl}</b>: ${charDamageDiceStr ? `${charDamageDiceStr} = ` : ""}<b style="color:#8b0000;">−${charDamageAmount}</b> <span style="font-size:0.85em;color:#5a4a30;">(действует, пока активен пост-эффект)</span></div>`;
  }

  // Доп. (мульти-) эффекты пост-эффекта
  for (const l of extras.lines)
    chatContent += `<div class="roll-threshold">${l}</div>`;

  // Текст пост-эффекта
  if (sys.afterEffect) {
    chatContent += `<div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}${sys.afterEffect}</span></div>`;
  }

  // Бросок урона пост-эффекта
  if (sys.afterEffectDice) {
    try {
      const chars = actor.system.characteristics;
      const resolvedFormula = resolveCharFormula(sys.afterEffectDice, chars, actor.system.corruptionBonus ?? 0);

      // Вся строка считается формулой (поддерживает «1d10 + W.b»)
      const formulaPart = resolvedFormula;
      const labelPart   = "";

      const roll = await new Roll(formulaPart).evaluate();

      // Строка с результатами кубиков
      let diceStr = formulaPart;
      if (roll.terms) {
        const parts = [];
        for (const term of roll.terms) {
          if (term.results) {
            const s = term.results.filter(r => r.active).reduce((a, r) => a + r.result, 0);
            parts.push(`[${s}]`);
          } else if (term.operator !== undefined) {
            parts.push(term.operator);
          } else if (term.number !== undefined) {
            parts.push(String(term.number));
          }
        }
        diceStr = parts.join("");
      }

      chatContent += `<div class="roll-threshold">
        ${rollIcon("dice","#6fe6ff")}Формула: <b>${sys.afterEffectDice}</b> → ${diceStr} =
        <b style="color:#8b0000;">${roll.total}</b>
        ${labelPart ? `<span style="color:#5a3a10;"> ${labelPart}</span>` : ""}
      </div>`;

      // Специальные эффекты пост-эффекта в чат
      if (fx.removesBleedingLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("blood","#ff6b6b")}Снято ур. Кровотечения: <b>${fx.removesBleedingLevels}</b></div>`;
      if (fx.removesFatigueLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Снято ур. Усталости: <b>${fx.removesFatigueLevels}</b></div>`;
      if (fx.removesWounds > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("heart","#ff8a8a")}Снято Ран: <b>${fx.removesWounds}</b></div>`;
      if (fx.grantsCondition) {
        const lvl = fx.grantsConditionLevel ?? 1;
        chatContent += `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено${lvl > 1 ? ` ${lvl} ур.` : ""}: <b>${fx.grantsCondition}</b></div>`;
      }
      if (fx.customEffect)
        chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;

      chatContent += `</div>`;

      const rollMode = game.settings.get("core", "rollMode");
      const messageData = ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatContent,
        rolls:   [roll, ...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls],
        sound:   CONFIG.sounds.dice
      }, rollMode);
      await ChatMessage.create(messageData);

    } catch(e) {
      chatContent += `</div>`;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatContent
      });
      ui.notifications.warn(`Не удалось бросить формулу пост-эффекта: ${sys.afterEffectDice}`);
      console.error(e);
    }
  } else {
    // Нет формулы урона — отправляем текст (с броском урона в характеристику, если был)
    if (fx.customEffect)
      chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;
    chatContent += `</div>`;
    const rollMode = game.settings.get("core", "rollMode");
    const postRolls = [...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls];
    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatContent,
      ...(postRolls.length ? { rolls: postRolls, sound: CONFIG.sounds.dice } : {})
    }, rollMode);
    await ChatMessage.create(messageData);
  }

  ui.notifications.info(`${item.name}: пост-эффект активирован.`);
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

  // ── Тест Зависимости ───────────────────────────────────────────────────────

  async _rollAddictionTest(item, charKey = "t", testMod = 0) {
    const charTotal   = this.actor.system.characteristics[charKey]?.total ?? 0;
    const fatigue     = this._getFatiguePenalty(charKey);
    const eff         = charTotal + testMod + fatigue;
    const wasAddicted = item?.system?.addiction?.isAddicted || false;

    const roll    = await new Roll("1d100").evaluate();
    const rv      = roll.total;
    const success = rv <= eff;
    const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;
    const abbr    = CHARACTERISTICS[charKey]?.abbr ?? charKey.toUpperCase();
    const name    = item?.name ?? "Наркотик";

    let outcome;
    if (success) {
      if (wasAddicted && item) {
        // Срыв зависимости — избавление
        await item.update({ "system.addiction.isAddicted": false });
        const still = this.actor.items.some(i =>
          i.type === "drug" && i.id !== item.id &&
          i.system.addiction?.hasAddiction && i.system.addiction?.isAddicted
        );
        if (!still) await this.actor.update({ "system.conditions.addicted": false });
        outcome = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Зависимость преодолена!</span>`;
      } else {
        outcome = `<span class="roll-success">Сопротивление успешно — ${deg} ${_degWord(deg)}</span>`;
      }
    } else {
      // Провал → персонаж зависим от ЭТОГО препарата
      if (item) await item.update({ "system.addiction.isAddicted": true });
      await this.actor.update({ "system.conditions.addicted": true });
      outcome = wasAddicted
        ? `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Зависимость сохраняется.</span>`
        : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж стал зависим!</span>`;
    }

    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("warn","#ffb84d")}Тест Зависимости — ${name}</div>
          <div class="roll-threshold">
            ${abbr}: <b>${charTotal}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""}${fatigue !== 0 ? ` 😓 ${fatigue}` : ""}
            → Порог: <b>${eff}</b>
          </div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ПСАЙКАНА
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Через что кастуется психосила. Прорицание (divination) — через навык
   * Псинаука; также явный выбор testChar="psyniscience" использует навык.
   * Иначе — характеристика (WP/Int/Per/Fel).
   */
  _resolvePsyCastAttr(sys) {
    let key = sys.testChar || "wp";
    if (sys.discipline === "divination" && (key === "per" || !sys.testChar)) key = "psyniscience";
    if (key === "psyniscience") {
      return { key, val: this.actor.system.skills?.psyniscience?.total ?? -20, abbr: "Псинаука" };
    }
    if (key === "cor") {
      // Психотест на Порчу (колдовство/демонология): бросок против значения Порчи.
      return { key, val: this.actor.system.corruption?.value ?? 0, abbr: "Порча" };
    }
    return {
      key,
      val:  this.actor.system.characteristics[key]?.total ?? 0,
      abbr: CHARACTERISTICS[key]?.abbr ?? key.toUpperCase()
    };
  }

  _showManifestDialog(item) {
    const sys      = item.system;
    const psy      = this.actor.system.psyker || {};
    const isEldar  = AELDARI_RACES.includes(this.actor.system.race);
    // Аэльдари всегда используют Природу «Древнее Мастерство»
    const nature   = isEldar ? "ancientMastery" : (psy.class || "bound");
    // Манифест. PR (mPR) — свободный выбор от 1 до текущего Пси-Рейтинга (тPR),
    // стр. 289: тPR = бPR −1 за каждую поддерживаемую силу, а эPR можно снижать
    // «на любое значение до минимума в 1». `prRequired` — требование ИЗУЧЕНИЯ
    // силы («кроме требований»), а не нижняя граница манифестации, поэтому
    // список не должен им ограничиваться.
    const maxPR    = Math.max(0, psy.currentRating || 0);
    const minPR    = 1;
    const cast     = this._resolvePsyCastAttr(sys);
    const charAbbr = cast.abbr;
    const charVal  = cast.val;

    let prOptions = "";
    const top = Math.max(1, maxPR);
    for (let p = minPR; p <= top; p++)
      prOptions += `<option value="${p}" ${p === top ? "selected" : ""}>${p}</option>`;
    // тPR 0 — новые силы манифестировать нельзя (стр. 289).
    const prWarn = maxPR <= 0
      ? `<div class="pm-warn">тPR = 0 (все ${psy.sustain || 0} PR уходят на поддержание) — новые психосилы манифестировать нельзя.</div>`
      : (psy.sustain ? `<div class="pm-note">тPR ${maxPR} = бPR ${psy.rating || 0} − ${psy.sustain} на поддержание.</div>` : "");

    const modeOptions = Object.entries(PSY_MODES).map(([k, m]) =>
      `<option value="${k}" ${k === "normal" ? "selected" : ""}>${m.label}</option>`).join("");
    const pathOptions = Object.entries(PSY_PATHS).map(([k, p]) =>
      `<option value="${k}">${p.label}</option>`).join("");

    // Доп. профили атаки и вариации броска
    const profiles = sys.profiles || [];
    const variants = sys.variants || [];
    const profileRow = profiles.length ? `
        <div class="atk-dlg-row">
          <label>Профиль атаки:</label>
          <select id="psy-profile">
            <option value="-1">Основной</option>
            ${profiles.map((p, i) => `<option value="${i}">${p.label || ("Профиль " + (i + 1))}</option>`).join("")}
          </select>
        </div>` : "";
    const variantRow = variants.length ? `
        <div class="atk-dlg-row">
          <label>Вариация броска:</label>
          <select id="psy-variant">
            <option value="-1">— нет —</option>
            ${variants.map((v, i) => `<option value="${i}">${v.label || ("Вариация " + (i + 1))}${v.testMod ? ` (${v.testMod >= 0 ? "+" : ""}${v.testMod})` : ""}</option>`).join("")}
          </select>
        </div>` : "";

    // Данные для живого предпросмотра порога/Феномена (клиентская сторона).
    const NATx = PSY_NATURES[nature] || PSY_NATURES.bound;
    const natData = {
      normalPhenMod: NATx.normalPhenMod || 0,
      pushBonusType: NATx.pushBonusType || "fixed",
      pushBonus:     NATx.pushBonus || 0,
      pushFormula:   NATx.pushFormula || "",
      pushPhenType:  NATx.pushPhenType || "flat",
      pushPhenValue: NATx.pushPhenValue || 0
    };
    const pathData = Object.fromEntries(Object.entries(PSY_PATHS).map(([k, p]) => [k, {
      ePR: p.ePR || 0, testMod: p.testMod || 0, phenMod: p.phenMod || 0, dyn: p.dynamicTestMod || ""
    }]));
    const dynBonus = { t: this.actor.system.characteristics?.t?.bonus ?? 0,
                       wp: this.actor.system.characteristics?.wp?.bonus ?? 0 };
    const powerMod = Number(sys.testMod) || 0;
    const variantMods = variants.map(v => Number(v.testMod) || 0);
    const psyMeta = { charVal, charAbbr, powerMod, natData, pathData, dynBonus, variantMods, isEldar };

    const discLabel = (PSY_DISCIPLINES?.[sys.discipline]?.label) || "";
    const typeLabel = (PSY_POWER_TYPES?.[sys.powerType]) || sys.powerType || "";
    const dmgLabel  = sys.damage ? ` · урон ${sys.damage}` : "";

    const content = `
      <form class="wh-psy-manifest">
        <div class="pm-header">
          <span class="pm-sigil">✨</span>
          <div class="pm-titles">
            <div class="pm-name">${item.name}</div>
            <div class="pm-sub">${[discLabel, typeLabel].filter(Boolean).join(" · ")}${dmgLabel}</div>
          </div>
          <span class="pm-nature" title="Природа Дара">${NATx.label || nature}</span>
        </div>

        <div class="pm-preview">
          <div class="pm-prev-thr-wrap">
            <div class="pm-prev-lbl">Порог психотеста (${charAbbr})</div>
            <div class="pm-prev-thr" id="pm-thr">—</div>
          </div>
          <div class="pm-prev-meta">
            <div class="pm-prev-chip">эPR <b id="pm-epr">—</b></div>
            <div class="pm-prev-chip pm-prev-phen" id="pm-phen">—</div>
          </div>
        </div>

        <div class="pm-modes" role="group" aria-label="Режим">
          <button type="button" class="pm-mode" data-mode="safe" title="эPR = ½ mPR (▲). Феномены не вызываются.">Безопасный</button>
          <button type="button" class="pm-mode is-on" data-mode="normal" title="эPR = mPR. Феномен при дубле на успехе или 99.">Обычный</button>
          <button type="button" class="pm-mode" data-mode="push" title="эPR = mPR + бонус Природы. Феномен гарантирован.">Усиленный</button>
        </div>
        <input type="hidden" id="psy-mode" value="normal"/>

        <div class="pm-row">
          <label>Манифест. PR</label>
          <select id="psy-pr" class="pm-input">${prOptions}</select>
          ${isEldar ? `
          <label class="pm-push-lbl">Усиление</label>
          <select id="psy-push-bonus" class="pm-input">
            <option value="1">+1</option><option value="2">+2</option>
            <option value="3">+3</option><option value="4">+4</option>
          </select>` : ""}
        </div>
        ${prWarn}

        <div class="pm-row">
          <label>Путь Силы</label>
          <select id="psy-path" class="pm-input pm-wide">${pathOptions}</select>
        </div>
        ${profiles.length ? `
        <div class="pm-row">
          <label>Профиль</label>
          <select id="psy-profile" class="pm-input pm-wide">
            <option value="-1">Основной</option>
            ${profiles.map((p, i) => `<option value="${i}">${p.label || ("Профиль " + (i + 1))}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-profile" value="-1"/>`}
        ${variants.length ? `
        <div class="pm-row">
          <label>Вариация</label>
          <select id="psy-variant" class="pm-input pm-wide">
            <option value="-1">— нет —</option>
            ${variants.map((v, i) => `<option value="${i}">${v.label || ("Вариация " + (i + 1))}${v.testMod ? ` (${v.testMod >= 0 ? "+" : ""}${v.testMod})` : ""}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-variant" value="-1"/>`}

        <details class="pm-adv">
          <summary>Дополнительно</summary>
          <div class="pm-row">
            <label>Мод. PR (±)</label>
            <input id="psy-pr-mod" class="pm-input pm-num" type="number" value="0" title="Таланты/ситуации: каст по PR±N"/>
            <label>Доп. мод. теста</label>
            <input id="psy-mod" class="pm-input pm-num" type="number" value="0"/>
          </div>
          <div class="pm-row">
            <label>эPR урона</label>
            <input id="psy-pr-dmg" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для урона (мин. 1)"/>
            <label>эPR дальности</label>
            <input id="psy-pr-range" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для дальности (мин. 1)"/>
          </div>
        </details>
      </form>`;

    new Dialog({
      title: `Манифестация: ${item.name}`,
      content,
      buttons: {
        cast: {
          icon: '<i class="fas fa-hat-wizard"></i>', label: "Психотест!",
          callback: async html => {
            await this._executePsychotest(item, {
              mPR:      parseInt(html.find("#psy-pr").val())     || minPR,
              prMod:    parseInt(html.find("#psy-pr-mod").val()) || 0,
              mode:     html.find("#psy-mode").val()             || "normal",
              path:     html.find("#psy-path").val()             || "",
              modifier: parseInt(html.find("#psy-mod").val())    || 0,
              eldar:    isEldar,
              pushChoice: parseInt(html.find("#psy-push-bonus").val()) || 1,
              damagePR: parseInt(html.find("#psy-pr-dmg").val())   || 0,
              rangePR:  parseInt(html.find("#psy-pr-range").val()) || 0,
              profileIdx: parseInt(html.find("#psy-profile").val()) ?? -1,
              variantIdx: parseInt(html.find("#psy-variant").val()) ?? -1
            });
          }
        },
        cancel: { label: "Отмена" }
      },
      default: "cast",
      render: html => this._wirePsyManifestPreview(html, psyMeta)
    }, { classes: ["dialog", "wh-attack-dialog", "warhammer-dbc", "wh-holo", "wh-psy-dialog"], width: 400 }).render(true);
  }

  // Живой предпросмотр окна манифестации: пилюли режима + пересчёт порога/эPR/Феномена.
  _wirePsyManifestPreview(html, m) {
    const el = html[0] ?? html;
    const $ = (sel) => el.querySelector(sel);
    const modeInput = $("#psy-mode");

    const recalc = () => {
      const mode  = modeInput.value || "normal";
      const mPR0  = parseInt($("#psy-pr")?.value) || 0;
      const prMod = parseInt($("#psy-pr-mod")?.value) || 0;
      const mod   = parseInt($("#psy-mod")?.value) || 0;
      const path  = $("#psy-path")?.value || "";
      const varIdx = parseInt($("#psy-variant")?.value ?? "-1");
      const pMR = Math.max(0, mPR0 + prMod);

      let ePR = pMR, phenText = "", eprSuffix = "";
      if (mode === "safe") { ePR = Math.ceil(pMR / 2); phenText = "Феноменов нет"; }
      else if (mode === "normal") { ePR = pMR; phenText = m.isEldar ? "Феномен: дубль 66 / крит-провал" : "Феномен: дубль / 99"; }
      else {
        let pb = 0;
        if (m.natData.pushBonusType === "choice" || m.isEldar) pb = parseInt($("#psy-push-bonus")?.value) || 1;
        else if (m.natData.pushBonusType === "roll") { pb = 0; eprSuffix = `+${m.natData.pushFormula || "1d5"}`; }
        else pb = m.natData.pushBonus || 0;
        ePR = pMR + pb;
        phenText = "Феномен гарантирован";
      }
      const pd = m.pathData[path] || { ePR: 0, testMod: 0, phenMod: 0, dyn: "" };
      ePR += pd.ePR || 0;
      const pathTest = (pd.testMod || 0) + (pd.dyn ? (m.dynBonus[pd.dyn] || 0) : 0);
      const varMod = (varIdx >= 0) ? (m.variantMods[varIdx] || 0) : 0;
      const thr = m.charVal + 5 * ePR + mod + pathTest + m.powerMod + varMod;

      $("#pm-thr").textContent = thr;
      $("#pm-epr").textContent = `${ePR}${eprSuffix}`;
      const phenEl = $("#pm-phen");
      phenEl.textContent = phenText;
      phenEl.classList.toggle("danger", mode === "push");
      phenEl.classList.toggle("safe", mode === "safe");
    };

    // Пилюли режима.
    el.querySelectorAll(".pm-mode").forEach(b => b.addEventListener("click", () => {
      el.querySelectorAll(".pm-mode").forEach(x => x.classList.remove("is-on"));
      b.classList.add("is-on");
      modeInput.value = b.dataset.mode;
      // Поле «Усиление» актуально только в Усиленном режиме.
      const pushLbl = el.querySelector(".pm-push-lbl");
      const pushSel = $("#psy-push-bonus");
      if (pushLbl && pushSel) { const on = b.dataset.mode === "push"; pushLbl.style.opacity = pushSel.style.opacity = on ? "1" : "0.4"; }
      recalc();
    }));
    el.querySelectorAll("select, input").forEach(inp => {
      inp.addEventListener("change", recalc);
      inp.addEventListener("input", recalc);
    });

    // Раскрытие «Дополнительно» — растянуть окно диалога под новый контент,
    // иначе блок обрезается.
    const details = el.querySelector(".pm-adv");
    if (details) {
      const win = el.closest("[data-appid]");
      const app = win ? ui.windows?.[win.dataset.appid] : null;
      details.addEventListener("toggle", () => app?.setPosition?.({ height: "auto" }));
    }
    recalc();
  }

  async _executePsychotest(item, opts) {
    const sys      = item.system;
    const psy      = this.actor.system.psyker || {};
    const nature   = opts.eldar ? "ancientMastery" : (psy.class || "bound");
    const NAT      = PSY_NATURES[nature] || PSY_NATURES.bound;
    const PATH     = PSY_PATHS[opts.path] || PSY_PATHS[""];
    // Руны Судьбы/Битвы: манифестация только в Безопасном/Обычном режиме.
    let runeNote = "";
    if (PATH.runeMode && opts.mode === "push") {
      opts.mode = "normal";
      runeNote = "Руна: Усиленный режим недоступен — использован Обычный.";
    }
    const MODE     = PSY_MODES[opts.mode] || PSY_MODES.normal;
    const cast     = this._resolvePsyCastAttr(sys);
    const charVal  = cast.val;
    const charAbbr = cast.abbr;

    // ── Эффективный Пси-Рейтинг и модификатор к броску Феноменов ──────────────
    // Манифест. PR с учётом модификатора (таланты/ситуации: PR±N), мин. 0.
    const prMod = opts.prMod || 0;
    const mPR   = Math.max(0, (opts.mPR || 0) + prMod);
    let ePR = mPR;
    let pushBonus = 0;
    let phenMod = 0;
    if (opts.mode === "safe") {
      ePR = Math.ceil(mPR / 2);
    } else if (opts.mode === "normal") {
      ePR = mPR;
      phenMod = NAT.normalPhenMod;
    } else { // push (Усиленный)
      if (NAT.pushBonusType === "roll") {
        const r = await new Roll(NAT.pushFormula).evaluate();
        pushBonus = r.total;
      } else if (NAT.pushBonusType === "choice") {
        pushBonus = Math.max(1, Math.min(NAT.pushChoiceMax || 4, opts.pushChoice || 1));
      } else pushBonus = NAT.pushBonus;
      ePR = mPR + pushBonus;
      phenMod = NAT.pushPhenType === "flat"
        ? NAT.pushPhenValue
        : NAT.pushPhenValue * pushBonus;
    }

    // ── Бонусы Пути Силы ──────────────────────────────────────────────────────
    ePR     += PATH.ePR || 0;
    phenMod += PATH.phenMod || 0;
    const pathLabel = PATH.label || "";
    // Динамический бонус Пути от характеристики (Телесная Конверсия: +T.b)
    const pathDynMod = PATH.dynamicTestMod
      ? (this.actor.system.characteristics[PATH.dynamicTestMod]?.bonus ?? 0) : 0;

    // Психофокус: отдельный тест W+0 (свободное действие, 1/ход). Успех → +10,
    // крит. успех (дубль на успехе) → +15, крит. провал (дубль на провале) → −10.
    let focusMod = 0, focusNote = "", focusRoll = null;
    if (PATH.focusTest) {
      const wpv = this.actor.system.characteristics.wp?.total ?? 0;
      focusRoll = await new Roll("1d100").evaluate();
      const fv      = focusRoll.total;
      const fPass   = fv <= wpv;
      const fDouble = (fv % 11 === 0) || fv === 100;
      if (fPass && fDouble) focusMod = 15;
      else if (fPass)       focusMod = 10;
      else if (fDouble)     focusMod = -10;
      const fWord = (fPass && fDouble) ? "крит. успех" : fPass ? "успех" : fDouble ? "крит. провал" : "провал";
      const fCls  = focusMod >= 0 ? "roll-success" : "roll-failure";
      focusNote = `<div class="roll-defense-note">${rollIcon("spark","#c98bff")}Психофокус (W ${wpv}): бросок <b>${fv}</b> → <span class="${fCls}">${fWord}${focusMod ? `, ${focusMod > 0 ? "+" : ""}${focusMod}` : ", без бонуса"}</span> к психотесту. <i>(свободное действие, 1/ход, в свой Ход)</i></div>`;
    }
    const pathTestMod = (PATH.testMod || 0) + pathDynMod + focusMod;

    const actorUpdates = {}; // накопленные изменения (Порча Варп-Шока, Раны Конверсии)

    // ── Эффективный PR по аспектам ─────────────────────────────────────────────
    // Псайкер может независимо снизить эPR для урона и дальности (минимум 1),
    // не трогая эPR психотеста. 0 в диалоге = использовать полный эPR.
    const clampPR  = (v) => (v > 0 ? Math.max(1, Math.min(ePR, v)) : ePR);
    const damagePR = clampPR(opts.damagePR || 0);
    const rangePR  = clampPR(opts.rangePR  || 0);
    const aspectsDiffer = damagePR !== ePR || rangePR !== ePR;

    // ── Профиль атаки и вариация броска ────────────────────────────────────────
    // Если выбран доп. профиль — берём его урон/тип/пробитие/свойства/урон-в-хар-ку,
    // иначе основной. Вариация добавляет свой модификатор к психотесту.
    const profile = (opts.profileIdx >= 0) ? (sys.profiles || [])[opts.profileIdx] : null;
    const atk = profile ? {
      damage:    profile.damage, damageType: profile.damageType || "energy",
      pen:       Number(profile.penetration) || 0,
      props:     _parsePsyPropsText(profile.propsText),
      charStat:  profile.charDamageStat || "",
      charForm:  profile.charDamageFormula || "",
      label:     profile.label || "профиль"
    } : {
      damage:    sys.damage, damageType: sys.damageType || "energy",
      pen:       Number(sys.penetration) || 0,
      props:     sys.weaponProps || [],
      charStat:  sys.charDamageStat || "",
      charForm:  sys.charDamageFormula || "",
      label:     "основной"
    };
    const variant    = (opts.variantIdx >= 0) ? (sys.variants || [])[opts.variantIdx] : null;
    const variantMod = Number(variant?.testMod) || 0;

    const powerMod  = sys.testMod || 0; // собственный модификатор силы
    const threshold = charVal + 5 * ePR + (opts.modifier || 0) + pathTestMod + powerMod + variantMod;
    const roll = await new Roll("1d100").evaluate();
    const rv   = roll.total;
    let success = rv <= threshold;
    let deg  = Math.floor(Math.abs(rv - threshold) / 10) + 1;
    const allRolls = focusRoll ? [roll, focusRoll] : [roll];

    // Аэльдари, Безопасный режим: авто-успех, число успехов = тPR (mPR)
    if (opts.eldar && opts.mode === "safe") {
      success = true;
      deg = Math.max(1, mPR);
    }

    // Телесная Конверсия — цена в Ранах (платится при использовании Пути)
    if (PATH.woundCost) {
      Object.assign(actorUpdates, _computeWoundDamage(this.actor.system, PATH.woundCost));
    }

    // ── Авто-урон (для атакующих сил при успехе) ──────────────────────────────
    const isDamaging = ["attack", "psychicShoot", "psychicBlade"].includes(sys.powerType);
    const atkProps   = resolveWeaponPropsList(atk.props);   // свойства атаки (профиля)
    let damageSection = "";
    if (success && isDamaging && atk.damage) {
      const chars = this.actor.system.characteristics;
      const dmgFormula = _resolveCharFormula(String(atk.damage).replace(/\bPR\b/gi, damagePR), chars, this.actor.system.corruptionBonus ?? 0);
      // Число попаданий по типу Психострельбы (стр. 290): Снаряд/Взрыв/Дыхание — 1;
      // Обстрел (короткая очередь) — по 1 за нечётный Успех = ceil(deg/2);
      // Шторм (длинная очередь) — по 1 за каждый Успех = deg.
      const shootType = sys.shootSubtype || "";
      let hits = 1, hitsNote = "";
      if (sys.powerType === "psychicShoot") {
        if (shootType === "barrage") { hits = Math.max(1, Math.ceil(deg / 2)); hitsNote = `Психический Обстрел: <b>${hits}</b> попад. (по 1 за нечётный из ${deg} Успехов).`; }
        else if (shootType === "storm") { hits = Math.max(1, deg); hitsNote = `Психический Шторм: <b>${hits}</b> попад. (по 1 за каждый из ${deg} Успехов).`; }
      }
      try {
        const dtLabel = DAMAGE_TYPES[atk.damageType] || atk.damageType;
        const pen     = atk.pen;
        const hitLines = [];
        for (let h = 0; h < hits; h++) {
          const dmgRoll = await new Roll(dmgFormula).evaluate();
          allRolls.push(dmgRoll);
          hitLines.push(`
            <div class="roll-damage-hit">
              <span>${hits > 1 ? `Попадание #${h + 1}` : "Урон"} (${dtLabel}, Проб. ${pen}): <b>${dmgRoll.total}</b></span>
              <button class="wh-apply-dmg-btn" type="button"
                data-damage="${dmgRoll.total}" data-penetration="${pen}"
                data-damage-type="${atk.damageType}" data-hit-location="Торс"
                data-weapon-name="${item.name}" data-attacker="${this.actor.name}">
                ${dmgRoll.total} → Торс
              </button>
            </div>`);
        }
        damageSection = `
          <div class="roll-damage-section">
            ${hitsNote ? `<div class="roll-threshold" style="font-size:0.82em;">${hitsNote}${profile ? ` Профиль «${atk.label}».` : ""} Вторичные цели (в 2м) — попадания в Торс.</div>` : (profile ? `<div class="roll-threshold" style="font-size:0.82em;">Профиль «${atk.label}».</div>` : "")}
            ${hitLines.join("")}
          </div>`;
      } catch(e) {
        ui.notifications.warn(`Не удалось бросить урон психосилы: ${atk.damage}`);
        console.error(e);
      }
    }

    // ── Урон в характеристику (если задан) ─────────────────────────────────────
    let charDamageSection = "";
    if (success && atk.charStat && atk.charForm) {
      try {
        const cdRoll = await new Roll(String(atk.charForm).replace(/\bPR\b/gi, damagePR)).evaluate();
        allRolls.push(cdRoll);
        const cdAbbr = CHARACTERISTICS[atk.charStat]?.abbr || atk.charStat.toUpperCase();
        charDamageSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон в характеристику <b>${cdAbbr}</b>: <b>${cdRoll.total}</b></div>
            <div class="roll-threshold" style="font-size:0.82em;">Примените к соответствующей характеристике цели (минуя Раны).</div>
          </div>`;
      } catch(e) {
        ui.notifications.warn(`Не удалось бросить урон в характеристику: ${atk.charForm}`);
      }
    }

    // ── Свойства атаки психосилы: памятки + кнопки эффектов на цель ─────────────
    let attackPropsSection = "";
    if (success && isDamaging && atkProps.length) {
      const propBlock  = buildPropertyChatBlock(atkProps);
      const effectBtns = buildTargetEffectButtons(atkProps, { hit: true, netDamageKnown: false });
      attackPropsSection = (propBlock || "") + (effectBtns || "");
    }

    // ── Феномен / Прорыв ──────────────────────────────────────────────────────
    let phenomena = false;
    const isDouble = (rv % 11 === 0) || rv === 100;
    if (PATH.phenOnly66) {
      // Руны Судьбы/Битвы: Феномен только на броске 66 в Обычном режиме.
      phenomena = (opts.mode === "normal") && success && rv === 66;
    } else if (opts.eldar) {
      // Эльдарские правила Феноменов по режимам:
      if (opts.mode === "safe") {
        phenomena = false;                                   // Безопасный — никогда
      } else if (opts.mode === "normal") {
        const critFail = !success && (isDouble || rv === 100);
        phenomena = (success && rv === 66) || critFail;      // дубль 66 на успехе или крит. провал
      } else { // push
        phenomena = !success || (success && isDouble);       // провал или дубль
      }
    } else if (MODE.phenomena === "always") {
      phenomena = true;
    } else if (MODE.phenomena === "double") {
      phenomena = (success && isDouble) || rv === 99;
    }

    let phenSection = "";
    let perilTriggered = false;
    if (phenomena) {
      const phenRoll = await new Roll(`1d100 + ${phenMod}`).evaluate();
      allRolls.push(phenRoll);
      const phenVal = phenRoll.total;
      const phen = getPhenomenon(phenVal);
      phenSection = `
        <div class="psy-phenomenon">
          <div class="psy-phen-header">⚠️ Психический Феномен (бросок ${phenVal}${phenMod !== 0 ? `, мод ${phenMod >= 0 ? "+" : ""}${phenMod}` : ""})</div>
          <div class="psy-phen-name">${phen.label}</div>
          <div class="psy-phen-text">${phen.text}</div>
        </div>`;

      // Прорыв (если Феномен переходит в Прорыв)
      if (phen.peril) {
        perilTriggered = true;
        const perilRoll = await new Roll("1d100").evaluate();
        allRolls.push(perilRoll);
        const peril = getPeril(perilRoll.total);
        phenSection += `
          <div class="psy-peril">
            <div class="psy-peril-header">💀 ВАРП-ПРОРЫВ! (бросок ${perilRoll.total})</div>
            <div class="psy-peril-name">${peril.label}</div>
            <div class="psy-peril-text">${peril.text}</div>
          </div>`;
      }
    } else if (opts.mode === "safe") {
      phenSection = `<div class="roll-threshold" style="font-size:0.85em;">Безопасный режим — Феномены не вызываются.</div>`;
    } else {
      phenSection = `<div class="roll-threshold" style="font-size:0.85em;color:#3a7a3a;">Феномен не вызван.</div>`;
    }

    // ── Варп-Шок: не-Хаоситы получают Порчу при Феномене (1d5 при Прорыве) ──────
    let warpShockSection = "";
    if (phenomena && !NAT.isChaos) {
      let corrAmt = 1;
      if (perilTriggered) {
        const corrRoll = await new Roll("1d5").evaluate();
        allRolls.push(corrRoll);
        corrAmt = corrRoll.total;
      }
      const curCorr = this.actor.system.corruption?.value || 0;
      actorUpdates["system.corruption.value"] = curCorr + corrAmt;
      warpShockSection = `<div class="psy-warpshock">🌀 Варп-Шок: <b>+${corrAmt} Порчи</b>${perilTriggered ? " (1d5 — за Прорыв)" : ""}. Не-Хаоситы в радиусе PR×5 м от Прорыва: тест W+0 или +1 Порчи.</div>`;
    } else if (phenomena && NAT.isChaos) {
      warpShockSection = `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Демонический дар игнорирует негативные эффекты собственных Феноменов (но не Прорывов).</div>`;
    }

    // Цена Конверсии в чат
    let conversionLine = "";
    if (PATH.woundCost) {
      conversionLine = `<div class="roll-threshold" style="font-size:0.85em;color:#8b0000;">${rollIcon("blood","#ff6b6b")}Телесная Конверсия: −${PATH.woundCost} Раны.</div>`;
    }

    // Применяем накопленные изменения (Раны/Порча)
    if (Object.keys(actorUpdates).length) await this.actor.update(actorUpdates);

    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#c98bff")}${item.name}</div>
          <div class="roll-threshold">
            Природа: <b>${NAT.label}</b> | Режим: <b>${MODE.label}</b>${pathLabel ? ` | Путь: <b>${pathLabel}</b>` : ""}
          </div>
          <div class="roll-threshold">
            mPR <b>${opts.mPR}</b>${prMod ? ` ${prMod >= 0 ? "+" : ""}${prMod} = <b>${mPR}</b>` : ""} → эPR <b>${ePR}</b>${pushBonus ? ` (Усиление +${pushBonus})` : ""}${PATH.ePR ? ` (Путь +${PATH.ePR})` : ""}
          </div>
          ${aspectsDiffer ? `<div class="roll-threshold" style="font-size:0.82em;">эPR по аспектам: тест <b>${ePR}</b>${isDamaging ? ` · урон <b>${damagePR}</b>` : ""} · дальность <b>${rangePR}</b></div>` : ""}
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.82em;">Дальность: ${String(sys.range).replace(/\bPR\b/gi, rangePR)}</div>` : ""}
          <div class="roll-threshold">
            ${charAbbr}: <b>${charVal}</b> + 5×${ePR}${opts.modifier ? ` ${opts.modifier >= 0 ? "+" : ""}${opts.modifier}` : ""}${pathTestMod ? ` ${pathTestMod >= 0 ? "+" : ""}${pathTestMod} (Путь)` : ""}${variantMod ? ` ${variantMod >= 0 ? "+" : ""}${variantMod} (Вариация)` : ""}
            → Порог: <b>${threshold}</b>
          </div>
          ${variant ? `<div class="roll-threshold" style="font-size:0.82em;">Вариация: <b>${variant.label || "—"}</b>${variant.note ? ` — ${variant.note}` : ""}</div>` : ""}
          ${PATH.note ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Путь: ${PATH.note}</div>` : ""}
          ${runeNote ? `<div class="roll-threshold" style="font-size:0.82em;color:#7a1010;">${runeNote}</div>` : ""}
          ${focusNote}
          <div class="roll-dice">Психотест: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Манифестация удалась — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Психотест провален — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${conversionLine}
          ${damageSection}
          ${charDamageSection}
          ${attackPropsSection}
          ${phenSection}
          ${warpShockSection}
        </div>`,
      rolls: allRolls,
      sound: CONFIG.sounds.dice
    }, rollMode));
  }

  _rollPsyniscience() {
    const def = SKILLS_DEF.psyniscience;
    const sk  = this.actor.system.skills?.psyniscience;
    this._rollSkill(def?.label ?? "Пси-чутьё", sk?.total ?? -20, def?.char ?? "per", { skill: "psyniscience" });
  }

  /** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
  async _rollPsyWpTest(label, note) {
    const wp  = this.actor.system.characteristics.wp?.total ?? 0;
    const pr  = this.actor.system.psyker?.currentRating ?? 0;
    const eff = wp + 5 * pr;
    const roll = await new Roll("1d100").evaluate();
    const rv   = roll.total;
    const success = rv <= eff;
    const deg  = Math.floor(Math.abs(rv - eff) / 10) + 1;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}</div>
          <div class="roll-threshold">WP: <b>${wp}</b> + 5×PR(${pr}) → Порог: <b>${eff}</b></div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}
          </div>
          <div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">${note}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode));
  }

  /** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
  async _activateNavigatorPower(item) {
    const sys     = item.system;
    const charKey = sys.testChar || "wp";
    const meta    = CHARACTERISTICS[charKey];
    const charVal = this.actor.system.characteristics[charKey]?.total ?? 0;
    const fatigue = this._getFatiguePenalty(charKey);
    const eff     = charVal + (sys.testMod || 0) + fatigue;

    const roll    = await new Roll("1d100").evaluate();
    const rv      = roll.total;
    const success = rv <= eff;
    const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;
    const rollMode = game.settings.get("core", "rollMode");
    const allRolls = [roll];

    // Урон (если задан и сила сработала)
    let dmgSection = "";
    if (success && sys.damage) {
      const chars = this.actor.system.characteristics;
      const f = _resolveCharFormula(String(sys.damage), chars, this.actor.system.corruptionBonus ?? 0);
      try {
        const dmgRoll = await new Roll(f).evaluate();
        allRolls.push(dmgRoll);
        const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
        const pen = sys.penetration || 0;
        dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${this.actor.name}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>`;
      } catch (e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
    }

    const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#8b78ff")}Сила навигатора: ${item.name}</div>
          ${sys.powerKind ? `<div class="roll-threshold" style="font-size:0.85em;">${sys.powerKind}</div>` : ""}
          <div class="roll-threshold">
            ${meta?.abbr ?? charKey}: <b>${charVal}</b>${sys.testMod ? ` ${sys.testMod >= 0 ? "+" : ""}${sys.testMod}` : ""}${fatigue ? ` 😓 ${fatigue}` : ""} → Порог: <b>${eff}</b>${sys.opposed ? " <span style='font-size:0.85em;'>(встречный — цель бросает свою хар-ку)</span>" : ""}
          </div>
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${dmgSection}
          ${sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : ""}
          <div class="roll-threshold" style="font-size:0.78em;color:#5a4a30;">Навигатор не бросает по таблицам Феноменов и Прорывов Варпа.</div>
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
        </div>`,
      rolls: allRolls,
      sound: CONFIG.sounds.dice
    }, rollMode));
  }

  /** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
  async _activateTechMiracle(item) {
    const sys      = item.system;
    const cogCost  = sys.cognitionCost || 0;
    let   enCost   = sys.energyCost || 0;
    const cog      = this.actor.system.cognition || { value: 0, max: 0 };
    const en       = this.actor.system.energy || { value: 0, max: 0 };

    if (cogCost > (cog.value || 0)) {
      ui.notifications.warn(`Недостаточно Когниции: нужно ${cogCost}, есть ${cog.value || 0}.`);
      return;
    }

    // ── Славословие: требует предварительной компиляции (X×5 минут) ──────────
    const isSlavo = sys.miracleType === "slavoslovie";
    if (isSlavo && !sys.compiled) {
      const x = sys.rating || 1;
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div class="wh-roll-result">
            <div class="roll-header">${rollIcon("chart","#8fd0ff")}Компиляция Славословия: ${item.name}</div>
            <div class="roll-threshold">Требуется компиляция <b>${x}×5 = ${x * 5}</b> минут. Держится как Процесс с Ценой ½X = <b>${Math.ceil(x / 2)}</b> Когниции.</div>
            <div class="roll-outcome"><span class="roll-success">Отметьте «Скомпилировано» на листе техночуда, затем активируйте.</span></div>
          </div>`
      }, game.settings.get("core", "rollMode")));
      return;
    }

    // ── Железо (Технофокусы): наименее качественный из установленных ─────────
    // Poor −10 / Good +5 / Best +10 к тесту и к I.b в формулах. Если требуемый
    // имплант не установлен — Техночудо нельзя использовать.
    const QLABEL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
    let ironMod = 0, ironLine = "", ironIbDelta = 0;
    const ironReqRaw = String(sys.iron || "").trim();
    if (ironReqRaw) {
      const reqs    = ironReqRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      const focus   = this.actor.system.techFocus || [];
      const matched = [], missing = [];
      for (const req of reqs) {
        const rl  = req.toLowerCase();
        const hit = focus.find(f => {
          const fl = f.name.toLowerCase();
          return fl.includes(rl) || fl.split("/").some(p => p.trim() && rl.includes(p.trim()));
        });
        if (hit) matched.push(hit); else missing.push(req);
      }
      if (missing.length) {
        ui.notifications.warn(`Нет нужного Железа (Технофокуса): ${missing.join(", ")}. Техночудо нельзя использовать без него.`);
        return;
      }
      const worstQ = leastQuality(matched.map(m => m.quality)) || "common";
      ironMod      = ironModForQuality(worstQ);
      ironIbDelta  = Math.trunc(ironMod / 10); // best +1 I.b, poor −1, good/comm 0
      ironLine     = `Железо (${matched.map(m => `${m.name.split("/")[0].trim()} ${QLABEL[m.quality]}`).join(", ")}) → тест ${ironMod >= 0 ? "+" : ""}${ironMod}`;
    }

    const skKey      = sys.testSkill || "techUse";
    const skillDef   = SKILLS_DEF[skKey];
    const skillLabel = skillDef?.label ?? "Tech-Use";
    const sk         = this.actor.system.skills?.[skKey];
    const base       = sk?.total ?? -20;
    const fatigue    = this._getFatiguePenalty(skillDef?.char ?? "int");
    const testMod    = sys.testMod || 0;
    const eff        = base + fatigue + testMod + ironMod;
    const allRolls   = [];

    // ── Компенсатор (X): тест Т−(10×X) снижает цену в ⚡ на 1 за Успех ─────────
    // Мод. Качества Железа НЕ применяется. Бонус имплантов (Печь/Инферния/Solar).
    let compLine = "";
    let compX = sys.miracleType === "compensator" ? (sys.rating || 0) : 0;
    const compExtra = (sys.extraTypes || []).find(e => e.type === "compensator");
    if (compExtra) compX = Math.max(compX, compExtra.x || 0);
    if (compX > 0 && enCost > 0) {
      const compBonus = this.actor.system.techCompBonus || 0;
      const tTot   = this.actor.system.characteristics?.t?.total ?? 0;
      const compTh = tTot - 10 * compX + compBonus;
      const cRoll  = await new Roll("1d100").evaluate();
      allRolls.push(cRoll);
      const cSucc  = cRoll.total <= compTh;
      const cDeg   = Math.floor(Math.abs(cRoll.total - compTh) / 10) + 1;
      const reduce = cSucc ? Math.min(enCost, cDeg) : 0;
      const enBefore = enCost;
      enCost = Math.max(0, enCost - reduce);
      compLine = `Компенсатор (X${compX}): T−${10 * compX}${compBonus ? ` +${compBonus}` : ""} → Порог ${compTh}, бросок ${cRoll.total} → `
        + (cSucc ? `−${reduce} ⚡ (${enBefore}→${enCost})` : `Провал, цена ${enCost} ⚡`);
    }

    // Проверка Энергии — после снижения Компенсатором, до основного теста
    if (enCost > (en.value || 0)) {
      ui.notifications.warn(`Недостаточно Энергии (Катушка Потенции): нужно ${enCost}, есть ${en.value || 0}.`);
      return;
    }

    // ── Основной тест активации ──────────────────────────────────────────────
    const roll    = await new Roll("1d100").evaluate();
    allRolls.push(roll);
    const rv      = roll.total;
    const success = rv <= eff;
    const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;

    // Трата ресурсов: Когниция ⚙ — всегда (до теста), Энергия ⚡ — только при Успехе.
    const resUpd = {};
    if (cogCost > 0)            resUpd["system.cognition.value"] = Math.max(0, (cog.value || 0) - cogCost);
    if (enCost  > 0 && success) resUpd["system.energy.value"]    = Math.max(0, (en.value  || 0) - enCost);
    if (Object.keys(resUpd).length) await this.actor.update(resUpd);

    // Славословие: при успехе компиляция расходуется (одноразово)
    if (isSlavo && success) await item.update({ "system.compiled": false });

    // Урон (если задан и активация удалась)
    let dmgSection = "";
    if (success && sys.damage) {
      // Качество Железа модифицирует I.b в формулах эффектов/дальности (best +1, poor −1).
      let chars = this.actor.system.characteristics;
      if (ironIbDelta && chars?.int) {
        chars = foundry.utils.deepClone(chars);
        chars.int.bonus = (chars.int.bonus || 0) + ironIbDelta;
      }
      const f = _resolveCharFormula(String(sys.damage).replace(/\bX\b/gi, sys.rating || 0), chars, this.actor.system.corruptionBonus ?? 0);
      try {
        const dmgRoll = await new Roll(f).evaluate();
        allRolls.push(dmgRoll);
        const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
        const pen = sys.penetration || 0;
        dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${this.actor.name}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>`;
      } catch(e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
    }

    const cogIco = techIcon("cognition");
    const enIco  = techIcon("energy");
    const costLine = [
      cogCost ? `${cogIco} Когниция −<b>${cogCost}</b>` : "",
      enCost  ? `${enIco} Энергия −<b>${enCost}</b>`    : "",
      (sys.sustained && sys.sustainCost) ? `Поддержание ${sys.sustainCost} ${cogIco}/Ход` : ""
    ].filter(Boolean).join(" | ");

    const rollMode = game.settings.get("core", "rollMode");
    const techDice = (await Promise.all(allRolls.map(r => r.render()))).join("");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("gear","#8fd0ff")}Техночудо: ${item.name}</div>
          <div class="roll-threshold">
            ${skillLabel}: <b>${base}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""}${fatigue !== 0 ? ` 😓 ${fatigue}` : ""} → Порог: <b>${eff}</b>
          </div>
          ${ironLine ? `<div class="roll-threshold" style="font-size:0.85em;">${ironLine}</div>` : ""}
          ${compLine ? `<div class="roll-threshold" style="font-size:0.85em;">${compLine}</div>` : ""}
          ${costLine ? `<div class="roll-threshold">${costLine}</div>` : ""}
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Активировано — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Сбой — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${dmgSection}
          ${sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : ""}
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${techDice}</details>
        </div>`,
      rolls: allRolls,
      sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
  async _techGenResource(item, { res, amount, fromCognition }) {
    if (!item) return;
    const QL   = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
    const q    = item.system.quality || "common";
    const sys  = this.actor.system;
    const cog  = sys.cognition || { value: 0, max: 0 };
    const en   = sys.energy    || { value: 0, max: 0, maxTotal: 0 };
    const enMax = en.maxTotal ?? en.max ?? 0;
    const src  = item.name.split("/")[0].trim();
    const upd  = {};
    let msg = "";

    if (fromCognition > 0) {
      // Конверсия ⚙→⚡ (Двигатель Холодного Синтеза). Цена по Качеству.
      const ratio  = (q === "poor" || q === "good") ? 4 : 3; // ⚙ за 1⚡
      const gained = Math.floor((cog.value || 0) / ratio);
      const room   = Math.max(0, enMax - (en.value || 0));
      const gain   = Math.min(gained, room);
      if (gain <= 0) {
        ui.notifications.warn(room <= 0 ? "Катушка Потенции уже заполнена." : `Недостаточно Когниции (нужно ${ratio}⚙ на 1⚡).`);
        return;
      }
      const spend = gain * ratio;
      upd["system.cognition.value"] = Math.max(0, (cog.value || 0) - spend);
      upd["system.energy.value"]    = Math.min(enMax, (en.value || 0) + gain);
      msg = `${src}: −${spend} ⚙ → +${gain} ⚡ (${ratio}⚙/1⚡, ${QL[q]})`;
    } else if (res === "energy") {
      const room = Math.max(0, enMax - (en.value || 0));
      const gain = Math.min(amount, room);
      if (gain <= 0) { ui.notifications.warn("Катушка Потенции уже заполнена."); return; }
      upd["system.energy.value"] = (en.value || 0) + gain;
      msg = `${src}: +${gain} ⚡`;
    } else {
      const gain = Math.min(amount, Math.max(0, (cog.max || 0) - (cog.value || 0)));
      if (gain <= 0) { ui.notifications.warn("Когниция уже на максимуме."); return; }
      upd["system.cognition.value"] = (cog.value || 0) + gain;
      msg = `${src}: +${gain} ⚙`;
    }
    await this.actor.update(upd);
    const pretty = msg.replace(/⚙/g, techIcon("cognition")).replace(/⚡/g, techIcon("energy"));
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">${techIcon("energy")} Энергосистема Механикум</div><div class="roll-threshold">${pretty}</div></div>`
    }, game.settings.get("core", "rollMode")));
  }

  // ── Применение препарата ──────────────────────────────────────────────────

  async _applyDrug(item, recipient = null) {
  const sys          = item.system;
  const owner        = this.actor;           // владелец препарата — расходует дозу
  const actor        = recipient || owner;   // получатель эффекта
  const applyToOther = actor !== owner;
  const qty          = (sys.quantity || 0) - 1;

  if (qty < 0) {
    ui.notifications.warn(`Препарат «${item.name}» закончился!`);
    return;
  }

  // ── Автоматический бросок длительности ───────────────────────────────────
  let resolvedRounds  = 0;
  let durationRollStr = "";
  let durationRoll    = null;

  if (sys.duration) {
    const chars = actor.system.characteristics;
    const resolvedFormula = resolveCharFormula(sys.duration, chars, actor.system.corruptionBonus ?? 0);

    try {
      durationRoll = await new Roll(resolvedFormula).evaluate();
      const roll = durationRoll;
      resolvedRounds = roll.total;

      // Строим строку с результатами кубиков [X]+Y
      if (roll.terms) {
        const parts = [];
        for (const term of roll.terms) {
          if (term.results) {
            const s = term.results
              .filter(r => r.active)
              .reduce((a, r) => a + r.result, 0);
            parts.push(`[${s}]`);
          } else if (term.operator !== undefined) {
            parts.push(term.operator);
          } else if (term.number !== undefined) {
            parts.push(String(term.number));
          }
        }
        durationRollStr = parts.join("") + ` = ${resolvedRounds}`;
      } else {
        durationRollStr = String(resolvedRounds);
      }
    } catch(e) {
      console.warn(`Не удалось бросить формулу длительности: ${sys.duration}`, e);
      durationRollStr = sys.duration;
    }
  }

  // ── Обновляем предмет ─────────────────────────────────────────────────────
  const itemUpdates = {
    "system.quantity":                      qty,
    "system.activeEffect.isActive":         true,
    "system.activeEffect.isAfterEffect":    false,
    "system.activeEffect.appliedAt":        game.time.worldTime,
    "system.activeEffect.roundsRemaining":  resolvedRounds,
    // сброс возможного урона в характеристику от прошлого пост-эффекта
    "system.activeEffect.charDamageStat":   "",
    "system.activeEffect.charDamageAmount": 0
  };

  // ── Применяем эффекты на актора ───────────────────────────────────────────
  const actorUpdates = {};
  const fx = sys.specialEffects || {};

  // Снять уровни кровотечения
  if (fx.removesBleedingLevels > 0) {
    const cur    = actor.system.conditions?.bleedingLevel || 0;
    const newVal = Math.max(0, cur - fx.removesBleedingLevels);
    actorUpdates["system.conditions.bleedingLevel"] = newVal;
    actorUpdates["system.conditions.bleeding"]      = newVal > 0;
  }

  // Снять усталость
  if (fx.removesFatigueLevels > 0) {
    const cur    = actor.system.conditions?.fatiguedLevel || 0;
    const newVal = Math.max(0, cur - fx.removesFatigueLevels);
    actorUpdates["system.conditions.fatiguedLevel"] = newVal;
    actorUpdates["system.conditions.fatigued"]      = newVal > 0;
    const fatVal = actor.system.fatigue?.value || 0;
    actorUpdates["system.fatigue.value"] = Math.max(0, fatVal - fx.removesFatigueLevels);
  }

  // Снять раны (ЛЕЧЕНИЕ: восстанавливаем здоровье — сначала критический урон, затем текущие до максимума)
  if (fx.removesWounds > 0) {
    Object.assign(actorUpdates, _computeWoundHealing(actor.system, fx.removesWounds));
  }

  // Снять состояние
  if (fx.removesCondition) {
    const condDef     = CONDITIONS_DEF[fx.removesCondition];
    const lvlToRemove = fx.removesConditionLevel || 0;

    if (condDef?.hasLevel && condDef.levelField && lvlToRemove > 0) {
      const curLvl = actor.system.conditions?.[condDef.levelField] || 0;
      const newLvl = Math.max(0, curLvl - lvlToRemove);
      actorUpdates[`system.conditions.${condDef.levelField}`]  = newLvl;
      actorUpdates[`system.conditions.${fx.removesCondition}`] = newLvl > 0;
      if (fx.removesCondition === "fatigued") {
        const fatVal = actor.system.fatigue?.value || 0;
        actorUpdates["system.fatigue.value"] = Math.max(0, fatVal - lvlToRemove);
      }
    } else {
      actorUpdates[`system.conditions.${fx.removesCondition}`] = false;
      if (condDef?.hasLevel && condDef.levelField) {
        actorUpdates[`system.conditions.${condDef.levelField}`] = 0;
      }
      if (fx.removesCondition === "fatigued") {
        actorUpdates["system.fatigue.value"] = 0;
      }
    }
  }

  // Снять радиацию
  if (fx.removesRadiation) {
    actorUpdates["system.conditions.radiation"]      = false;
    actorUpdates["system.conditions.radiationLevel"] = 0;
  }

  // Наложить состояние
  if (fx.grantsCondition) {
    const condDef    = CONDITIONS_DEF[fx.grantsCondition];
    const lvlToGrant = fx.grantsConditionLevel ?? 1;
    actorUpdates[`system.conditions.${fx.grantsCondition}`] = true;
    if (condDef?.hasLevel && condDef.levelField) {
      const curLvl = actor.system.conditions?.[condDef.levelField] || 0;
      actorUpdates[`system.conditions.${condDef.levelField}`] = curLvl + lvlToGrant;
    }
    if (fx.grantsCondition === "fatigued") {
      const fatVal = actor.system.fatigue?.value || 0;
      actorUpdates["system.fatigue.value"] = fatVal + lvlToGrant;
    }
  }

  // Нейтрализует препараты
  if (fx.counteractsDrugs) {
    for (const drugItem of actor.items.filter(
      i => i.type === "drug" && i.id !== item.id && i.system.activeEffect?.isActive
    )) {
      await drugItem.update({
        "system.activeEffect.isActive":        false,
        "system.activeEffect.isAfterEffect":   false,
        "system.activeEffect.roundsRemaining": 0,
        "system.activeEffect.charDamageStat":   "",
        "system.activeEffect.charDamageAmount": 0
      });
    }
  }

  // Доп. (мульти-) эффекты: Обескровливание, лечение/урон по формуле, доп. Усталость
  const extras = await _applyEffectExtras(actor, fx);
  Object.assign(actorUpdates, extras.updates);

  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);

  if (applyToOther) {
    // Владелец всегда расходует дозу.
    await item.update({ "system.quantity": qty });

    // Длящийся эффект (модификаторы характеристик или пост-эффект) нужно
    // отслеживать в листе ЦЕЛИ — создаём активную копию препарата у неё.
    // Для чисто мгновенных медикаментов (лечение/снятие состояний) копия не
    // нужна — эффекты уже применены к цели выше.
    const hasOngoing =
      sys.hasAfterEffect ||
      Object.values(sys.statMods || {}).some(v => typeof v === "number" && v !== 0);

    if (hasOngoing) {
      const drugData = item.toObject();
      delete drugData._id;
      drugData.system.quantity     = 0; // доза уже «в» цели, переприменить нельзя
      drugData.system.activeEffect = {
        isActive:         true,
        isAfterEffect:    false,
        appliedAt:        game.time.worldTime,
        expiresAt:        null,
        roundsRemaining:  resolvedRounds,
        charDamageStat:   "",
        charDamageAmount: 0
      };
      try {
        await Item.create(drugData, { parent: actor });
      } catch(e) {
        ui.notifications.error(`Не удалось применить «${item.name}» на ${actor.name} (нет прав на изменение цели?).`);
        console.error(e);
      }
    }
  } else {
    await item.update(itemUpdates);
  }

  // ── Сообщение в чат ───────────────────────────────────────────────────────
  const categoryIcon = {
    medicine: "💊", narcotic: "💉", poison: "☠️", elixir: "⚗️"
  }[sys.drugCategory] || "💊";

  const DELIVERY_RU = {
    injection: "Инъекция", gas: "Газ/Аэрозоль", liquid: "Жидкость",
    smoke: "Курение", patch: "Припарка", pill: "Таблетка",
    food: "Еда", wound: "Рана", contact: "Контакт",
    gas_contact: "Газ-Контакт", gas_eye: "Газ-Глаза"
  };

  // Модификаторы характеристик
  const statModParts = [];
  for (const [k, v] of Object.entries(sys.statMods || {})) {
    if (v && v !== 0) statModParts.push(
      `${k.toUpperCase()} ${v > 0 ? "+" : ""}${v}`
    );
  }

  let chatContent = `<div class="wh-roll-result">
    <div class="roll-header">${categoryIcon} ${item.name}</div>`;

  if (applyToOther)
    chatContent += `<div class="roll-threshold">${rollIcon("target","#4dffa6")}Применил: <b>${owner.name}</b> → <b>${actor.name}</b></div>`;

  if (sys.deliveryMethod)
    chatContent += `<div class="roll-threshold">Приём: <b>${DELIVERY_RU[sys.deliveryMethod] ?? sys.deliveryMethod}</b></div>`;

  // Длительность с результатом броска
  if (sys.duration) {
    if (durationRollStr) {
      chatContent += `<div class="roll-threshold">⏱ Длительность: <b>${sys.duration}</b> → <b>${durationRollStr}</b> раундов/минут</div>`;
    } else {
      chatContent += `<div class="roll-threshold">⏱ Длительность: <b>${sys.duration}</b></div>`;
    }
  }

  if (sys.effect)
    chatContent += `<div class="roll-outcome"><span class="roll-success">${rollIcon("bolt","#ffb84d")}Эффект: ${sys.effect}</span></div>`;

  if (statModParts.length > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("chart","#8fd0ff")}Модификаторы: <b>${statModParts.join(", ")}</b></div>`;

  if (fx.removesBleedingLevels > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("blood","#ff6b6b")}Снято ур. Кровотечения: <b>${fx.removesBleedingLevels}</b></div>`;
  if (fx.removesFatigueLevels > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Снято ур. Усталости: <b>${fx.removesFatigueLevels}</b></div>`;
  if (fx.removesWounds > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("heart","#ff8a8a")}Восстановлено Ран: <b>${fx.removesWounds}</b></div>`;
  for (const l of extras.lines)
    chatContent += `<div class="roll-threshold">${l}</div>`;
  if (fx.removesCondition) {
    const lvl = fx.removesConditionLevel || 0;
    chatContent += `<div class="roll-threshold">Снято${lvl > 0 ? ` ${lvl} ур.` : ""}: <b>${fx.removesCondition}</b></div>`;
  }
  if (fx.removesRadiation)
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Радиация снята</div>`;
  if (fx.grantsCondition) {
    const lvl = fx.grantsConditionLevel ?? 1;
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено${lvl > 1 ? ` ${lvl} ур.` : ""}: <b>${fx.grantsCondition}</b></div>`;
  }
  if (fx.counteractsDrugs)
    chatContent += `<div class="roll-threshold">${rollIcon("spark","#6fe6ff")}Нейтрализует все активные препараты</div>`;
  if (fx.immuneToPoisons)
    chatContent += `<div class="roll-threshold">${rollIcon("shield","#4dffa6")}Иммунитет к ядам активен</div>`;
  if (fx.bonusVsPoisons && fx.bonusVsPoisons !== 0)
    chatContent += `<div class="roll-threshold">${rollIcon("shield","#4dffa6")}Бонус против ядов: <b>+${fx.bonusVsPoisons}</b></div>`;
  if (fx.customEffect)
    chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;

  // Пост-эффект — превью
  if (sys.hasAfterEffect) {
    chatContent += `<div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}Пост-эффект: ${sys.afterEffect || "—"}`;
    if (sys.afterEffectDice) chatContent += ` [${sys.afterEffectDice}]`;
    chatContent += `</span></div>`;
  }

  chatContent += `<div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
    Осталось: ${qty}
  </div></div>`;

  const rollMode = game.settings.get("core", "rollMode");
  const allRolls = [...(durationRoll ? [durationRoll] : []), ...extras.rolls];
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: chatContent,
    ...(allRolls.length ? { rolls: allRolls } : {}),
    sound:   CONFIG.sounds.dice
  }, rollMode));
}
}

// ── Вспомогательная функция ───────────────────────────────────────────────────
function _conditionLevelField(condition) {
  const def = CONDITIONS_DEF[condition];
  return def?.levelField || null;
}

/**
 * Лечение ран. В этой системе wounds.value — текущее здоровье (убывает при уроне),
 * wounds.critical — критический урон сверх нуля (растёт). Поэтому лечение сначала
 * убирает критический урон, затем восстанавливает текущие раны до максимума.
 * Возвращает объект апдейтов для actor.update().
 */
function _computeWoundHealing(system, amount) {
  let value      = system.wounds?.value    ?? 0;
  let critical   = system.wounds?.critical ?? 0;
  const max      = system.wounds?.max      ?? 0;
  let heal       = Math.max(0, amount);

  if (critical > 0) {
    const h = Math.min(critical, heal);
    critical -= h;
    heal     -= h;
  }
  if (heal > 0) {
    value = max > 0 ? Math.min(max, value + heal) : value + heal;
  }
  return {
    "system.wounds.value":    value,
    "system.wounds.critical": critical
  };
}

/** Непоглощаемый урон в Раны: уменьшает текущие, переполнение → критический урон. */
function _computeWoundDamage(system, amount) {
  let value    = system.wounds?.value    ?? 0;
  let critical = system.wounds?.critical ?? 0;
  const dmg    = Math.max(0, amount);
  if (value >= dmg) {
    value -= dmg;
  } else {
    critical += (dmg - value);
    value = 0;
  }
  const out = {
    "system.wounds.value":    value,
    "system.wounds.critical": critical
  };
  // Новый урон → снова можно оказать Первую Помощь.
  if (dmg > 0) out["system.wounds.firstAidUsed"] = false;
  return out;
}

/**
 * Уровень ранения по текущим Ранам:
 *  - critical>0 (Отрицательные Раны) → «critical»
 *  - потеряно > T.b×2 → «heavy»
 *  - иначе → «light» (в т.ч. без ранений)
 * Возвращает { key, label, lost, tb }.
 */
function _woundLevel(system) {
  const value = system.wounds?.value    ?? 0;
  const max   = system.wounds?.max      ?? 0;
  const crit  = system.wounds?.critical ?? 0;
  const tb    = system.characteristics?.t?.bonus ?? 0;
  const lost  = Math.max(0, max - value);
  let key = "light";
  if (crit > 0)            key = "critical";
  else if (lost > tb * 2)  key = "heavy";
  const label = { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" }[key];
  return { key, label, lost, tb, crit };
}

/** Подставляет бонусы характеристик в формулу и берёт первую (формульную) часть. */
// Делегирует единому каноническому резолверу (utils). corB — бонус Порчи (Cor.b).
function _resolveCharFormula(formula, chars, corB = 0) {
  return resolveCharFormula(formula, chars, corB);
}

// Парсит текст особых свойств профиля психосилы («Tearing, Felling (4), Toxic (7, 2d10)»)
// в записи {key,rating,rating2}. Имена сопоставляются по label/en реестра.
function _parsePsyPropsText(text) {
  if (!text) return [];
  const tokens = []; let depth = 0, cur = "";
  for (const ch of String(text)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  const byName = {};
  for (const d of Object.values(WEAPON_PROPERTIES)) {
    byName[d.label.toLowerCase()] = d.key;
    if (d.en) byName[d.en.toLowerCase()] = d.key;
  }
  const out = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = byName[name.toLowerCase()];
    if (!key) continue;
    const entry = { key, rating: 0, rating2: 0 };
    if (rating != null) {
      const parts = rating.split(",").map(s => s.trim());
      const r1 = parseInt(parts[0]); if (!isNaN(r1)) entry.rating = r1;
      if (parts[1] != null) { const r2 = parseInt(parts[1]); if (!isNaN(r2)) entry.rating2 = r2; }
    }
    out.push(entry);
  }
  return out;
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

/**
 * Применяет «доп.» (мульти-) эффекты блока к цели: снятие Обескровливания,
 * лечение по формуле, доп. Усталость, непоглощаемый урон в Раны.
 * Возвращает { updates, lines, rolls } для слияния в актор-апдейт и чат.
 */
async function _applyEffectExtras(target, fx) {
  const updates = {};
  const lines   = [];
  const rolls   = [];
  if (!fx) return { updates, lines, rolls };
  const chars = target.system.characteristics;

  // Снять уровни Обескровливания
  if (fx.removesHaemorrhagingLevels > 0) {
    const cur = target.system.conditions?.haemorrhagingLevel || 0;
    const nv  = Math.max(0, cur - fx.removesHaemorrhagingLevels);
    updates["system.conditions.haemorrhagingLevel"] = nv;
    updates["system.conditions.haemorrhaging"]      = nv > 0;
    lines.push(`${rollIcon("blood","#ff6b6b")}Снято ур. Обескровливания: <b>${fx.removesHaemorrhagingLevels}</b>`);
  }

  // Лечение Ран по формуле (бросок)
  if (fx.healFormula) {
    try {
      const r = await new Roll(_resolveCharFormula(fx.healFormula, chars)).evaluate();
      rolls.push(r);
      Object.assign(updates, _computeWoundHealing(target.system, r.total));
      lines.push(`${rollIcon("heart","#ff8a8a")}Лечение: <b>${fx.healFormula}</b> = <b>${r.total}</b>`);
    } catch(e) { console.error("healFormula:", e); }
  }

  // Доп. Усталость
  if (fx.grantsFatigue > 0) {
    const fatVal = target.system.fatigue?.value ?? 0;
    updates["system.fatigue.value"] = fatVal + fx.grantsFatigue;
    lines.push(`${rollIcon("warn","#ffb84d")}Усталость +<b>${fx.grantsFatigue}</b>`);
  }

  // Непоглощаемый урон в Раны (бросок)
  if (fx.woundDamage) {
    try {
      const r = await new Roll(_resolveCharFormula(fx.woundDamage, chars)).evaluate();
      rolls.push(r);
      Object.assign(updates, _computeWoundDamage(target.system, r.total));
      lines.push(`${rollIcon("burst","#ff6b6b")}Непоглощаемый урон в Раны: <b>${fx.woundDamage}</b> = <b style="color:#8b0000;">${r.total}</b>`);
    } catch(e) { console.error("woundDamage:", e); }
  }

  return { updates, lines, rolls };

}

/**
 * Подключает окно выбора Талантов/Черт к листу, который не наследует лист
 * персонажа (например, к Орде). Копируются только методы самого пикера —
 * остальная механика листа не затрагивается.
 */
export function attachItemPicker(SheetClass) {
  for (const m of ["_openItemPicker", "_promptDynamicAptTalent",
                   "_dynamicTalentCostRange", "_dynamicTalentOptions"]) {
    if (WarhammerCharacterSheet.prototype[m] && !SheetClass.prototype[m])
      SheetClass.prototype[m] = WarhammerCharacterSheet.prototype[m];
  }
}
