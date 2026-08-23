// module/sheets/squad-sheet.mjs
// ════════════════════════════════════════════════════════════════════════
//  Лист Отряда — командная вертикаль (Лидер / Командир / Координатор),
//  Слаженность, Риск, Команды и Мораль. Оформление — как у листа персонажа.
//
//  Посты и участники назначаются перетаскиванием актора (или его токена)
//  на соответствующий слот листа.
// ════════════════════════════════════════════════════════════════════════

import { SQUAD_LEAD_TYPES, SQUAD_MEMBER_TYPES, SQUAD_TYPE_LABEL,
         SQUAD_POSTS, SQUAD_POST_ORDER,
         RISK_LEVELS, COHESION_LIMIT, COHESION_START_CAP, COHESION_EVENTS,
         PRESENCE_BENEFITS, SHORT_COMMANDS, SHORT_COMMAND_LIMITS,
         DETAIL_COMMANDS, TACTICS_TALENTS, COMMAND_REFERENCE,
         MORALE_RULES, BROKEN_SQUAD_RULE,
         cohesionBonus, riskCap } from "../constants/squad.mjs";
import { commandReachFor, presenceNumber } from "../rules/command.mjs";
import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { MINION_TIERS } from "../constants/minions.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "../apps/actor-factions.mjs";

/** Экранирование пользовательского текста для вставки в HTML чата. */
/** Степени успеха/провала по правилу системы: |порог − бросок| / 10 + 1. */
const degrees = (threshold, roll) => Math.floor(Math.abs(threshold - roll) / 10) + 1;

// ── Действия листа ───────────────────────────────────────────────────────────
// Как на листах Орды, техники и звёздной системы: ApplicationV2 зовёт обработчик
// [data-action] с this = лист и элементом-источником вторым аргументом. Обычные
// функции — чтобы карта действий сверялась с шаблоном тестом. Общая обвязка
// (whenEditable, onTab, filePicker) — в v2-helpers.mjs.

const memberIdOf = target => target.closest("[data-member-id]")?.dataset.memberId;

// ── Доступно всем, включая игрока без прав на отряд ──
// Открыть лист своего товарища, сойти с поста и выйти из отряда должен уметь и
// тот, кому сам отряд не принадлежит: права проверяются внутри обработчиков.

async function onOpen(event, target) {
  const uuid = target.closest("[data-uuid]")?.dataset.uuid;
  if (!uuid) return;
  const doc = await fromUuid(uuid);
  (doc?.actor ?? doc)?.sheet?.render(true);
}

async function onPostClear(event, target) {
  const key = target.closest("[data-post-slot]")?.dataset.postSlot;
  if (!key) return;
  const posts = foundry.utils.deepClone(this.actor.system.posts || {});
  if (!this.actor.isOwner) {
    const occ = posts[key]?.uuid ? (await fromUuid(posts[key].uuid)) : null;
    if (!((occ?.actor ?? occ)?.isOwner)) return ui.notifications.warn("Снять с поста можно только своего персонажа.");
  }
  posts[key] = { uuid: "", name: "", img: "" };
  await this._persistSquad({ "system.posts": posts });
}

async function onMemberRemove(event, target) {
  const id = memberIdOf(target);
  const members = foundry.utils.deepClone(this.actor.system.members || []);
  const m = members.find(x => x.id === id);
  if (!m) return;
  if (!this.actor.isOwner) {
    const occ = m.uuid ? await fromUuid(m.uuid) : null;
    if (!((occ?.actor ?? occ)?.isOwner)) return ui.notifications.warn("Вывести из отряда можно только своего персонажа.");
  }
  await this._persistSquad({ "system.members": members.filter(x => x.id !== id) });
}

// ── Слаженность ──
// Shift/Ctrl удваивают шаг: обычное событие двигает на ±5, впечатляющее — на ±10.
const cohStep = event => (event.shiftKey || event.ctrlKey) ? 10 : 5;

function onCohUp(event)   { return this._changeCohesion(cohStep(event)); }
function onCohDown(event) { return this._changeCohesion(-cohStep(event)); }
function onCohEvent(event, target) {
  return this._changeCohesion(Number(target.dataset.delta) || 0, target.dataset.label);
}
function onCohMission() { return this._startMission(); }

function onPortrait() {
  const FP = filePicker();
  return new FP({
    type: "image", current: this.actor.img || "",
    callback: path => this.actor.update({ img: path })
  }).render(true);
}

// ── Команды ──
function onPresenceRoll() { return this._commandRoll("presence"); }
function onShortRoll()    { return this._commandRoll("short"); }
function onDetailRoll()   { return this._commandRoll("detail"); }
function onBriefingRoll() { return this._briefingRoll(); }
function onOrderRoll()    { return this._orderRoll(); }
function onHeroicRoll()   { return this._heroicRoll(); }

function onPresenceOff() { return this.actor.update({ "system.presence.active": false }); }
function onShortOff()    { return this.actor.update({ "system.shortCommand.active": false }); }
function onDetailOff()   {
  return this.actor.update({ "system.detailCommand.active": false, "system.detailCommand.picks": [] });
}
function onDetailPick(event, target) { return this._toggleDetailPick(target.dataset.key); }

// ── Мораль ──
function onMemberMorale(event, target) { return this._memberTest(memberIdOf(target), "morale"); }
function onMemberBroken(event, target) { return this._memberTest(memberIdOf(target), "broken"); }
function onMemberFlag(event, target)   { return this._toggleMoraleFlag(memberIdOf(target)); }
function onMoraleReset()               { return this._resetMoraleFlags(); }

export class WarhammerSquadSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    // squad-sheet-form — на самой форме листа: CSS цепляется за
    // «.warhammer-dbc.squad-sheet-form», а у V1 этот класс нёс <form> в шаблоне.
    classes: ["warhammer-dbc", "sheet", "actor", "squad-sheet", "wh-holo", "squad-sheet-form"],
    position: { width: 840, height: 900 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      tab: onTab,
      // Без whenEditable: игрок-не-владелец должен уметь открыть лист товарища,
      // снять с поста и вывести из отряда СВОЕГО персонажа.
      open:         onOpen,
      postClear:    onPostClear,
      memberRemove: onMemberRemove,
      cohUp:        whenEditable(onCohUp),
      cohDown:      whenEditable(onCohDown),
      cohEvent:     whenEditable(onCohEvent),
      cohMission:   whenEditable(onCohMission),
      portrait:     whenEditable(onPortrait),
      presenceRoll: whenEditable(onPresenceRoll),
      presenceOff:  whenEditable(onPresenceOff),
      shortRoll:    whenEditable(onShortRoll),
      shortOff:     whenEditable(onShortOff),
      detailRoll:   whenEditable(onDetailRoll),
      detailOff:    whenEditable(onDetailOff),
      detailPick:   whenEditable(onDetailPick),
      briefingRoll: whenEditable(onBriefingRoll),
      orderRoll:    whenEditable(onOrderRoll),
      heroicRoll:   whenEditable(onHeroicRoll),
      memberMorale: whenEditable(onMemberMorale),
      memberBroken: whenEditable(onMemberBroken),
      memberFlag:   whenEditable(onMemberFlag),
      moraleReset:  whenEditable(onMoraleReset)
    }
  };

  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/actor/squad-sheet.hbs", root: true }
  };

  static TABS = {
    primary: {
      initial: "roster",
      tabs: [
        { id: "roster",    label: "ОТРЯД" },
        { id: "commands",  label: "КОМАНДЫ" },
        { id: "morale",    label: "МОРАЛЬ" },
        { id: "reference", label: "СПРАВОЧНИК" },
        { id: "notes",     label: "ЗАПИСИ" }
      ]
    }
  };

  // ── Чтение связанных акторов ──────────────────────────────────────────────

  /** Разворачивает uuid в актора (токен → его актор). Недоступный — null. */
  _resolve(uuid) {
    if (!uuid) return null;
    try { const d = fromUuidSync(uuid); return d?.actor ?? d ?? null; }
    catch (e) { return null; }
  }

  /** Карточка занятого поста: имя, портрет, ключевые для командования цифры. */
  _postData(key) {
    const meta = SQUAD_POSTS[key];
    const raw  = this.actor.system.posts?.[key] || {};
    const doc  = this._resolve(raw.uuid);
    const sys  = doc?.system || {};
    const fel  = sys.characteristics?.fel?.total ?? null;
    const felB = sys.characteristics?.fel?.bonus ?? 0;
    return {
      key, label: meta.label, icon: meta.icon, hint: meta.hint,
      uuid: raw.uuid || "",
      filled: !!raw.uuid,
      missing: !!raw.uuid && !doc,
      name: doc?.name || raw.name || (raw.uuid ? "(недоступен)" : ""),
      img:  doc?.img  || raw.img  || "icons/svg/mystery-man.svg",
      fel, felBonus: felB,
      wp:      sys.characteristics?.wp?.total ?? null,
      int:     sys.characteristics?.int?.total ?? null,
      command: sys.skills?.command?.total ?? null,
      logic:   sys.skills?.logic?.total ?? null,
      // Command может воздействовать одновременно на F.b × 2 подчинённых.
      capacity: felB * 2,
      // Снятый шлем силовой брони поднимает уровень Риска командующего.
      helmetOff: !!doc?.system?.helmetlessActive && isFeatureEnabled("helmetless")
    };
  }

  /** Строка участника: портрет, тип, показатели, отметка потери Командования. */
  _memberData(m) {
    const doc  = this._resolve(m.uuid);
    const sys  = doc?.system || {};
    const type = doc?.type || m.type || "character";
    const isHorde   = type === "horde";
    const isVehicle = type === "vehicle";
    // Орда Миньонов (minionTier === "horde") живёт Магнитудой, а не Ранами,
    // как и обычная Орда — но поле хранится в system.magnitude.max, а не
    // .start (minion.mjs), потому считаем её отдельно от SQUAD_TYPE_LABEL.
    const isMinionHorde = type === "minion" && !!MINION_TIERS[sys.minionTier]?.isHorde;
    return {
      id: m.id, uuid: m.uuid || "",
      name: doc?.name || m.name || "(недоступен)",
      img:  doc?.img  || m.img  || "icons/svg/mystery-man.svg",
      type, typeLabel: SQUAD_TYPE_LABEL[type] || type,
      missing: !doc,
      note: m.note || "",
      moraleLost: !!m.moraleLost,
      isHorde, isVehicle,
      // W — тест Морали и Сломленного Отряда; P.b — лимит «нескольких командиров».
      wp:  sys.characteristics?.wp?.total ?? null,
      perBonus: sys.characteristics?.per?.bonus ?? null,
      // Сколько командиров он способен слушать одновременно: ½ P.b (окр.▼).
      multiCap: sys.characteristics?.per?.bonus != null
        ? Math.floor(sys.characteristics.per.bonus / 2) : null,
      // Живучесть по типу актора — чтобы отряд читался с одного взгляда.
      hp: isHorde       ? `Магн. ${sys.magnitude?.value ?? 0}/${sys.magnitude?.start ?? 0}`
        : isMinionHorde ? `Магн. ${sys.magnitude?.value ?? 0}/${sys.magnitude?.max ?? 0}`
        : isVehicle     ? `Стр. ${sys.structure?.value ?? 0}/${sys.structure?.max ?? 0}`
        : (sys.wounds ? `Раны ${sys.wounds.value ?? 0}/${sys.wounds.max ?? 0}` : ""),
      // Что до него вообще доходит от Командования: Орде — лишь эффекты 1 и 3
      // Присутствия. Правило общее с панелью «Под моим Присутствием»
      // (rules/command.mjs), чтобы Орда читалась одинаково на обоих путях.
      reach: commandReachFor(type, this.actor.system.presence?.benefit || "")
    };
  }

  async _prepareContext(options) {
    // submitOnChange перерисовывает весь лист на КАЖДОЕ изменение поля (Риск,
    // Слаженность, отметки Детальной Команды и т.п.). Активная вкладка обязана
    // пережить этот цикл: единственный надёжный момент её прочитать — здесь,
    // до того как _prepareContext построит новый context.tab, а this.element
    // ещё хранит СТАРЫЙ DOM с верной .active-меткой (changeTab выставляет её
    // по клику и нигде больше не трогает). Если это разошлось с this.tabGroups
    // (нашли живьём: лист откатывался на «ОТРЯД» вместо вкладки игрока), берём
    // за истину то, что фактически было на экране, а не внутреннее состояние.
    const liveTab = this.element
      ?.querySelector('.sheet-tabs[data-group="primary"] .item.active')?.dataset.tab;
    if (liveTab && this.tabGroups) this.tabGroups.primary = liveTab;

    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.tab = this.tabGroups?.primary ?? WarhammerSquadSheet.TABS.primary.initial;
    // Поле «Фракция» в шапке — общее для всех листов (apps/actor-factions.mjs).
    Object.assign(context, actorFactionsContext(this.actor));
    const sys = this.actor.system;
    context.system  = sys;
    context.derived = sys.derived || {};
    context.isGM    = game.user.isGM;
    // ── Заметки: prose-mirror с переключаемым режимом (как у Journal Entries).
    const enrichOpts = { relativeTo: this.actor, secrets: this.actor.isOwner };
    context.notesEnriched   = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.notes || "", enrichOpts);
    context.gmNotesEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.gmNotes || "", enrichOpts);

    // ── Командная вертикаль ──
    context.posts     = SQUAD_POST_ORDER.map(k => this._postData(k));
    const leader      = context.posts.find(p => p.key === "leader");
    const commander   = context.posts.find(p => p.key === "commander");
    const coordinator = context.posts.find(p => p.key === "coordinator");
    context.leader = leader; context.commander = commander; context.coordinator = coordinator;

    // Кто фактически раздаёт Команды: Командир, иначе Лидер.
    context.activeCommander = commander.filled ? commander : (leader.filled ? leader : null);
    // Делегирование: Командир пользуется авторитетом Лидера — провал Морали
    // Лидера тогда бьёт и по Командам Командира.
    context.delegated = !!sys.delegated && leader.filled && commander.filled;

    // Максимум подчинённых под одновременным Командованием — F.b × 2.
    const cap = context.activeCommander?.capacity ?? 0;
    context.capacity     = cap;
    context.capacityOver = cap > 0 && (sys.members?.length || 0) > cap;

    // ── Участники ──
    context.members = (Array.isArray(sys.members) ? sys.members : []).map(m => this._memberData(m));
    context.memberCount = context.members.length;

    // ── Слаженность и Риск ──
    context.cohesionLimit    = COHESION_LIMIT;
    context.cohesionStartCap = COHESION_START_CAP;
    context.cohesionEvents   = COHESION_EVENTS.map((e, i) => ({ ...e, idx: i, sign: e.delta > 0 ? "up" : "down" }));
    context.effRisk = this._effectiveRisk();
    context.riskLevels = RISK_LEVELS.map(r => ({
      ...r, capLabel: r.max == null ? "без предела" : String(r.max),
      selected: r.level === sys.risk
    }));

    // ── Команды ──
    const shortKey = sys.shortCommand?.key || "inspire";
    const shortDef = SHORT_COMMANDS.find(c => c.key === shortKey) || SHORT_COMMANDS[0];
    const shortSux = Number(sys.shortCommand?.successes) || 0;
    context.presenceBenefits = PRESENCE_BENEFITS.map(b => ({ ...b, selected: b.key === (sys.presence?.benefit || "extreme") }));
    context.presenceActive   = !!sys.presence?.active;
    // Координатор не раздаёт Командное Присутствие — предупреждаем, если он один.
    context.presenceBlocked  = !commander.filled && !leader.filled && coordinator.filled;

    context.shortCommands = SHORT_COMMANDS.map(c => ({
      ...c, selected: c.key === shortKey,
      bonus: shortSux > 0 ? shortSux * c.mult : 0
    }));
    context.shortActive   = !!sys.shortCommand?.active;
    context.shortSux      = shortSux;
    context.shortBonus    = shortSux * shortDef.mult;
    context.shortLabel    = shortDef.label;
    context.shortNote     = sys.shortCommand?.note || "";
    context.shortLimits   = SHORT_COMMAND_LIMITS;

    const detailSux   = Number(sys.detailCommand?.successes) || 0;
    const detailPicks = Array.isArray(sys.detailCommand?.picks) ? sys.detailCommand.picks : [];
    const detailSpent = DETAIL_COMMANDS.filter(c => detailPicks.includes(c.key))
      .reduce((s, c) => s + c.cost, 0);
    context.detailCommands = DETAIL_COMMANDS.map(c => ({
      ...c,
      picked: detailPicks.includes(c.key),
      // Купить можно, если хватает нерастраченных Успехов.
      affordable: detailPicks.includes(c.key) || (detailSux - detailSpent) >= c.cost,
      // «Сплочение» работает только если Слаженность просела ниже стартовой.
      disabled: c.key === "rally" && !context.derived.belowStart
    }));
    context.detailActive = !!sys.detailCommand?.active;
    context.detailSux    = detailSux;
    context.detailSpent  = detailSpent;
    context.detailLeft   = Math.max(0, detailSux - detailSpent);
    context.tacticsTalents = TACTICS_TALENTS;

    // Брифинг: Успехи расходуются по одному Ходу в следующем бою.
    const briefSux = Number(sys.briefing?.successes) || 0;
    context.briefingSux = briefSux;
    // Каждый Ход из Брифинга даёт Короткую Команду с ½ I.b (окр.▼) Успехов.
    context.briefingPower = context.activeCommander?.int != null
      ? Math.floor(Math.floor(context.activeCommander.int / 10) / 2) : null;

    // ── Справочные блоки ──
    context.commandReference = COMMAND_REFERENCE;
    context.moraleRules      = MORALE_RULES;
    context.brokenSquadRule  = BROKEN_SQUAD_RULE;

    // Подсказки для дропа.
    context.leadTypesLabel   = SQUAD_LEAD_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ");
    context.memberTypesLabel = SQUAD_MEMBER_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ");

    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;

    // Поле «Фракция» в шапке — общее для всех листов.
    activateFactionFieldListeners(el, this.actor);

    // Дроп привязываем всегда, а не только на редактируемом листе: игрок без
    // прав на отряд приводит в него своего персонажа, запись идёт через ГМа.
    try {
      const DDC = foundry.applications?.ux?.DragDrop?.implementation
               ?? foundry.applications?.ux?.DragDrop ?? globalThis.DragDrop;
      if (DDC) new DDC({ dropSelector: null, callbacks: { drop: this._onDrop.bind(this) } }).bind(el);
    } catch (e) { console.warn("Warhammer DBC | squad DnD bind:", e); }

    if (!this.isEditable) return;

    // Подсветка слота при наведении перетаскиваемого актора.
    el.querySelectorAll("[data-post-slot], .sq-member-dropzone").forEach(slot => {
      slot.addEventListener("dragover", ev => { ev.preventDefault(); slot.classList.add("sq-drop-hover"); });
      slot.addEventListener("dragleave", () => slot.classList.remove("sq-drop-hover"));
      slot.addEventListener("drop",      () => slot.classList.remove("sq-drop-hover"));
    });

    // Поле Слаженности в шапке — без name (иначе дубль имени в форме), пишем вручную.
    el.querySelectorAll(".sq-coh-live").forEach(f => f.addEventListener("change", ev => {
      const v = Math.max(-COHESION_LIMIT, Math.min(COHESION_LIMIT, parseInt(ev.currentTarget.value) || 0));
      this.actor.update({ "system.cohesion.value": v });
    }));

    // Заметка участника — сохраняем по потере фокуса.
    el.querySelectorAll(".sq-member-note").forEach(f => f.addEventListener("change", ev => {
      const id = memberIdOf(ev.currentTarget);
      const members = foundry.utils.deepClone(this.actor.system.members || []);
      const m = members.find(x => x.id === id); if (!m) return;
      m.note = ev.currentTarget.value;
      this.actor.update({ "system.members": members });
    }));
  }

  // ── Перетаскивание акторов на посты и в состав ────────────────────────────

  // Дроп разрешён всем: игрок без прав на отряд может привести в него своего
  // персонажа. Права проверяются в самих обработчиках.
  _canDragDrop(_selector) { return true; }

  async _onDrop(event) {
    let data = null;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) { /* нет данных */ }
    if (data && (data.type === "Token" || data.type === "Actor")) return this._onDropActor(event, data);
    return super._onDrop(event);
  }

  /** Отряд — не носитель снаряжения: предметы кладут на его участников. */
  async _onDropItem(_event, _data) {
    ui.notifications.warn("Отряд не хранит предметы — перетащите их на лист участника отряда.");
    return false;
  }

  /**
   * Запись состава. Владелец отряда пишет напрямую; игрок, приводящий своего
   * персонажа в чужой отряд, — запросом к активному ГМу по сокету.
   */
  async _persistSquad(update) {
    if (this.actor.isOwner) { await this.actor.update(update); return true; }
    const gm = game.users.activeGM;
    if (!gm) {
      ui.notifications.warn("Нужен активный ГМ на сессии, чтобы войти в чужой отряд.");
      return false;
    }
    game.socket.emit("system.warhammer-dbc", {
      action: "squadRoster",
      squadUuid: this.actor.uuid,
      posts:   update["system.posts"]   ?? foundry.utils.deepClone(this.actor.system.posts   || {}),
      members: update["system.members"] ?? foundry.utils.deepClone(this.actor.system.members || []),
      userId: game.user.id
    });
    return true;
  }

  async _onDropActor(event, data) {
    const uuid = data.uuid
      || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
      || (data.type === "Token" && data.sceneId && data.tokenId ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
    if (!uuid) return false;

    let doc = null;
    try { doc = await fromUuid(uuid); } catch (e) { doc = null; }
    const actor = doc?.actor ?? doc;
    if (!actor || actor.id === this.actor.id) return false;

    // Игрок без прав на отряд может приводить только своего персонажа.
    if (!this.actor.isOwner && !actor.isOwner) {
      ui.notifications.warn("В чужой отряд можно привести только своего персонажа.");
      return false;
    }

    // Куда бросили: на конкретный пост или в состав.
    const postEl = event.target?.closest?.("[data-post-slot]");
    const post   = postEl?.dataset.postSlot || null;

    if (post) return this._assignPost(post, uuid, actor);
    return this._addMember(uuid, actor);
  }

  /** Назначение на пост Лидера / Командира / Координатора. */
  async _assignPost(key, uuid, actor) {
    if (!SQUAD_POSTS[key]) return false;
    if (!SQUAD_LEAD_TYPES.includes(actor.type)) {
      ui.notifications.warn(
        `${SQUAD_POSTS[key].label}ом может быть только: ${SQUAD_LEAD_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ")}. ` +
        `«${actor.name}» — ${SQUAD_TYPE_LABEL[actor.type] || actor.type}.`);
      return false;
    }
    const posts = foundry.utils.deepClone(this.actor.system.posts || {});
    // Один персонаж не может занимать два поста сразу — снимаем с прежнего.
    for (const k of SQUAD_POST_ORDER) {
      if (k !== key && posts[k]?.uuid === uuid) posts[k] = { uuid: "", name: "", img: "" };
    }
    posts[key] = { uuid, name: actor.name, img: actor.img };
    const ok = await this._persistSquad({ "system.posts": posts });
    if (ok) ui.notifications.info(`${actor.name} — ${SQUAD_POSTS[key].label} отряда «${this.actor.name}».`);
    return ok;
  }

  /** Добавление участника в состав. */
  async _addMember(uuid, actor) {
    if (!SQUAD_MEMBER_TYPES.includes(actor.type)) {
      ui.notifications.warn(
        `Участником отряда может быть только: ${SQUAD_MEMBER_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ")}. ` +
        `«${actor.name}» — ${SQUAD_TYPE_LABEL[actor.type] || actor.type}.`);
      return false;
    }
    const members = foundry.utils.deepClone(this.actor.system.members || []);
    if (members.some(m => m.uuid === uuid)) {
      ui.notifications.info(`${actor.name} уже в составе отряда.`);
      return false;
    }
    members.push({
      id: foundry.utils.randomID(), uuid,
      name: actor.name, img: actor.img, type: actor.type,
      note: "", moraleLost: false
    });
    const ok = await this._persistSquad({ "system.members": members });
    if (ok) ui.notifications.info(`${actor.name} вошёл в отряд «${this.actor.name}».`);
    return ok;
  }

  // ── Слаженность ───────────────────────────────────────────────────────────

  /** Изменение текущей Слаженности с записью события в чат. */
  async _changeCohesion(delta, label = "") {
    if (!delta) return;
    const coh = this.actor.system.cohesion || {};
    const before = Number(coh.value) || 0;
    const after  = Math.max(-COHESION_LIMIT, Math.min(COHESION_LIMIT, before + delta));
    if (after === before) return;
    await this.actor.update({ "system.cohesion.value": after });

    const up = after > before;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result sq-chat">
        <div class="roll-header">${rollIcon("crown", up ? "#4dffa6" : "#ff8a8a")}Слаженность — ${esc(this.actor.name)}</div>
        ${label ? `<div class="roll-threshold">${esc(label)}</div>` : ""}
        <div class="roll-outcome"><span class="${up ? "roll-success" : "roll-failure"}">
          ${before >= 0 ? "+" : ""}${before} → ${after >= 0 ? "+" : ""}${after} (${delta > 0 ? "+" : ""}${delta})
        </span></div>
      </div>`
    });
  }

  /** Начало миссии: текущая и стартовая Слаженность приравниваются базовой. */
  async _startMission() {
    const base = Number(this.actor.system.cohesion?.base) || 0;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Начало миссии" },
      content: `<p>Сбросить Слаженность отряда к базовой (<b>${base >= 0 ? "+" : ""}${base}</b>) и снять отметки потери Командования?</p>`
    });
    if (!ok) return;
    const members = foundry.utils.deepClone(this.actor.system.members || []);
    members.forEach(m => { m.moraleLost = false; });
    await this.actor.update({
      "system.cohesion.start": base,
      "system.cohesion.value": base,
      "system.members": members,
      "system.presence.active": false,
      "system.shortCommand.active": false,
      "system.detailCommand.active": false,
      "system.detailCommand.picks": [],
      "system.detailCommand.successes": 0,
      "system.shortCommand.successes": 0
    });
  }

  // ── Команды ───────────────────────────────────────────────────────────────

  /**
   * Уровень Риска с учётом снятого шлема командующего: книга даёт +1, если
   * немодифицированный Риск равен 2+. Выше 5 не поднимается.
   */
  _effectiveRisk(postKey = null) {
    const base = Math.max(1, Math.min(5, Number(this.actor.system.risk) || 1));
    const post = postKey ? this._postData(postKey) : null;
    // Без указания поста смотрим на того, кто фактически командует.
    const who = post || (this._postData("commander").filled ? this._postData("commander")
                                                            : this._postData("leader"));
    const bonus = (who?.helmetOff && base >= 2) ? 1 : 0;
    const value = Math.min(5, base + bonus);
    return { base, bonus, value, cap: riskCap(value), who: who?.name || "" };
  }

  /** Посты, способные отдавать Команды (для выбора в диалоге). */
  _availableRollers() {
    return SQUAD_POST_ORDER.map(k => this._postData(k)).filter(p => p.filled && !p.missing);
  }

  /**
   * Диалог и бросок Команды.
   * @param {"presence"|"short"|"detail"} kind — что именно отдаётся.
   */
  async _commandRoll(kind) {
    const rollers = this._availableRollers();
    if (!rollers.length)
      return ui.notifications.warn("Сначала назначьте Лидера, Командира или Координатора — перетащите актора на слот поста.");

    // Командное Присутствие Координатор не раздаёт вовсе.
    const pool = kind === "presence" ? rollers.filter(r => r.key !== "coordinator") : rollers;
    if (!pool.length)
      return ui.notifications.warn("Координатор не раздаёт Командное Присутствие — нужен Командир или Лидер.");

    const sys = this.actor.system;
    const coh = Number(sys.derived?.cohesion) || 0;
    const title = { presence: "Командное Присутствие", short: "Короткая Команда", detail: "Детальная Команда" }[kind];

    const rollerOpts = pool.map((p, i) =>
      `<option value="${p.key}" ${i === 0 ? "selected" : ""} data-base="${p.command ?? -20}" data-coord="${p.key === "coordinator" ? 1 : 0}" data-risk-free="${p.key === "coordinator" ? 1 : 0}">
        ${p.label}: ${esc(p.name)} — Command ${p.command ?? "—"}
      </option>`).join("");

    const shortOpts = SHORT_COMMANDS.map(c =>
      `<option value="${c.key}" ${c.key === (sys.shortCommand?.key || "inspire") ? "selected" : ""}>${c.label} (Успехи×${c.mult})</option>`).join("");
    const presenceOpts = PRESENCE_BENEFITS.map(b =>
      `<option value="${b.key}" ${b.key === (sys.presence?.benefit || "extreme") ? "selected" : ""}>${b.label}</option>`).join("");

    const eRisk    = this._effectiveRisk();
    const riskInfo = RISK_LEVELS.find(r => r.level === eRisk.value);
    const capTxt   = riskInfo?.max == null ? "без предела" : String(riskInfo.max);

    // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная сломала бы
    // button.form, через который читаются поля.
    const content = `<div class="wh-attack-form sq-cmd-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(title)}</span><span class="atk-weapon-class">${esc(this.actor.name)}</span></div>
      <div class="atk-dlg-row"><label>Отдаёт:</label>
        <select id="sq-roller">${rollerOpts}</select></div>
      ${kind === "short" ? `<div class="atk-dlg-row"><label>Команда:</label><select id="sq-kind">${shortOpts}</select></div>` : ""}
      ${kind === "presence" ? `<div class="atk-dlg-row"><label>Преимущество:</label><select id="sq-benefit">${presenceOpts}</select></div>` : ""}
      <div class="atk-dlg-row"><label>Command(F):</label><input id="sq-base" type="number" value="${pool[0].command ?? -20}"/></div>
      <div class="atk-dlg-row"><label>Слаженность:</label><span id="sq-coh" class="sq-cmd-coh">${cohesionBonus(coh, pool[0].key === "coordinator") >= 0 ? "+" : ""}${cohesionBonus(coh, pool[0].key === "coordinator")}</span></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="sq-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row atk-total-row"><label>Итоговый порог:</label><span id="sq-total">0</span></div>
      <div class="sq-cmd-risk">Риск ${eRisk.value}${eRisk.bonus ? ` (${eRisk.base} +1 — шлем снят)` : ""} — максимум Успехов: <b id="sq-cap">${capTxt}</b></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: `${title}: ${this.actor.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "sq-cmd-dialog"],
      position: { width: 400 },
      content,
      buttons: [
        {
          action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", default: true,
          callback: async (event, button) => {
            const form  = button.form;
            const key   = String(form.querySelector("#sq-roller")?.value || "commander");
            const base  = parseInt(form.querySelector("#sq-base").value) || 0;
            const mod   = parseInt(form.querySelector("#sq-mod").value) || 0;
            const isCo  = key === "coordinator";
            const extra = { benefit: form.querySelector("#sq-benefit")?.value,
                            shortKey: form.querySelector("#sq-kind")?.value };
            await this._executeCommand(kind, key, base + cohesionBonus(coh, isCo) + mod, extra);
          }
        },
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        const roller = form.querySelector("#sq-roller");
        const baseIn = form.querySelector("#sq-base");
        const modIn  = form.querySelector("#sq-mod");
        const upd = () => {
          const isCo = String(roller?.value || "commander") === "coordinator";
          const cb   = cohesionBonus(coh, isCo);
          form.querySelector("#sq-coh").textContent = `${cb >= 0 ? "+" : ""}${cb}`;
          const base = parseInt(baseIn.value) || 0;
          const mod  = parseInt(modIn.value) || 0;
          form.querySelector("#sq-total").textContent = base + cb + mod;
        };
        roller?.addEventListener("change", ev => {
          baseIn.value = ev.currentTarget.selectedOptions[0]?.dataset.base ?? -20;
          upd();
        });
        [baseIn, modIn].forEach(i => i.addEventListener("input", upd));
        upd();
      }
    });
  }

  /** Исполнение Команды: бросок, Успехи с учётом Риска, эффект и запись состояния. */
  async _executeCommand(kind, rollerKey, threshold, extra = {}) {
    const sys    = this.actor.system;
    const roller = this._postData(rollerKey);
    const isCo   = rollerKey === "coordinator";

    const roll = await new Roll("1d100").evaluate();
    const rv   = roll.total;
    const ok   = rv <= threshold;
    const deg  = degrees(threshold, rv);

    // Потолок Успехов от Риска — на Координатора не распространяется: он не
    // вдохновляет личным примером, а лишь советует.
    const eRisk  = this._effectiveRisk(rollerKey);
    const cap    = isCo ? null : eRisk.cap;
    const capped = ok && cap != null && deg > cap;
    const sux    = ok ? (capped ? cap : deg) : 0;

    let effect = "", update = {};

    if (kind === "presence") {
      const bKey = extra.benefit || sys.presence?.benefit || "extreme";
      const b    = PRESENCE_BENEFITS.find(x => x.key === bKey) || PRESENCE_BENEFITS[0];
      if (ok) update = { "system.presence.active": true, "system.presence.benefit": bKey };
      effect = `<div class="sq-chat-effect"><b>${esc(b.label)}</b><div class="sq-chat-desc">${esc(b.desc)}</div></div>` +
        (ok ? `<div class="sq-chat-note">Присутствие активно до конца боя или до потери Командования.</div>` : "");
    }
    else if (kind === "short") {
      const cKey = extra.shortKey || sys.shortCommand?.key || "inspire";
      const c    = SHORT_COMMANDS.find(x => x.key === cKey) || SHORT_COMMANDS[0];
      const bonus = sux * c.mult;
      if (ok) update = {
        "system.shortCommand.active": true, "system.shortCommand.key": cKey,
        "system.shortCommand.successes": sux,
        // Короткая Команда даёт и все преимущества Командного Присутствия.
        ...(isCo ? {} : { "system.presence.active": true })
      };
      effect = `<div class="sq-chat-effect"><b>${esc(c.label)}</b> — бонус <b class="sq-chat-big">+${bonus}</b> (${sux}×${c.mult})
        <div class="sq-chat-desc">${esc(c.desc)}</div></div>`;
    }
    else if (kind === "detail") {
      if (ok) update = {
        "system.detailCommand.active": true, "system.detailCommand.successes": sux,
        "system.detailCommand.picks": [],
        ...(isCo ? {} : { "system.presence.active": true })
      };
      const list = DETAIL_COMMANDS.map(c =>
        `<div class="sq-chat-detail${sux >= c.cost ? " sq-chat-afford" : ""}"><span class="sq-chat-cost">${c.cost}</span> ${esc(c.label)}</div>`).join("");
      effect = `<div class="sq-chat-effect"><b>Успехов на эффекты: ${sux}</b><div class="sq-chat-details">${list}</div>
        <div class="sq-chat-note">Выберите эффекты на вкладке «Команды» — Успехи спишутся автоматически.</div></div>`;
    }

    if (ok && Object.keys(update).length) await this.actor.update(update);

    const coh = Number(sys.derived?.cohesion) || 0;
    const cohMod = cohesionBonus(coh, isCo);
    const title = { presence: "Командное Присутствие", short: "Короткая Команда", detail: "Детальная Команда" }[kind];
    const missed = ok ? this._notReachedBy(kind, extra) : "";

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result sq-chat">
        <div class="roll-header">${rollIcon("crown", "#4dffa6")}${esc(title)} — ${esc(this.actor.name)}</div>
        <div class="roll-threshold">${esc(roller.label)}: <b>${esc(roller.name)}</b> ·
          Слаженность ${cohMod >= 0 ? "+" : ""}${cohMod}${isCo ? " (половинный — Координатор)" : ""} → Порог <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${ok
          ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}${capped ? `, срезано Риском ${sys.risk} до ${cap}` : ""}</span>`
          : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}</div>
        ${effect}
        ${missed}
      </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

  /**
   * До кого отданное не дошло. Орде из состава Команды не достаются вовсе, а
   * из Присутствия — только эффекты 1 и 3, и молчать об этом нельзя: игрок
   * иначе раздаст бонус всему отряду, включая толпу.
   */
  _notReachedBy(kind, extra = {}) {
    const benefit = kind === "presence"
      ? (extra.benefit || this.actor.system.presence?.benefit || "extreme") : "";
    const missed = (this.actor.system.members || [])
      .map(m => this._memberData(m))
      .filter(m => !m.missing && (kind === "presence" ? !m.reach.presenceApplies : !m.reach.commands));
    if (!missed.length) return "";

    const names = missed.map(m => esc(m.name)).join(", ");
    const why = kind === "presence"
      ? `выбранное преимущество (эффект ${presenceNumber(benefit)}) до них не доходит`
      : "Команды на них не действуют — только эффекты 1 и 3 Присутствия";
    return `<div class="sq-chat-note sq-chat-missed">Не получают: <b>${names}</b> — ${why}.</div>`;
  }

  /** Покупка/отмена эффекта Детальной Команды за накопленные Успехи. */
  async _toggleDetailPick(key) {
    const def = DETAIL_COMMANDS.find(c => c.key === key); if (!def) return;
    const dc    = this.actor.system.detailCommand || {};
    const picks = Array.isArray(dc.picks) ? [...dc.picks] : [];
    const sux   = Number(dc.successes) || 0;

    if (picks.includes(key)) {
      await this.actor.update({ "system.detailCommand.picks": picks.filter(k => k !== key) });
      return;
    }
    if (key === "rally" && !this.actor.system.derived?.belowStart)
      return ui.notifications.warn("«Сплочение» работает, только если Слаженность ниже стартовой на миссию.");

    const spent = DETAIL_COMMANDS.filter(c => picks.includes(c.key)).reduce((s, c) => s + c.cost, 0);
    if (sux - spent < def.cost)
      return ui.notifications.warn(`Не хватает Успехов: нужно ${def.cost}, осталось ${Math.max(0, sux - spent)}.`);

    picks.push(key);
    const update = { "system.detailCommand.picks": picks };
    // «Сплочение» немедленно поднимает Слаженность на +5.
    if (key === "rally") {
      const cur = Number(this.actor.system.cohesion?.value) || 0;
      update["system.cohesion.value"] = Math.min(COHESION_LIMIT, cur + 5);
    }
    await this.actor.update(update);

    if (key === "tactics") {
      ui.notifications.info(`Особая Тактика: выберите Талант — ${TACTICS_TALENTS.join(", ")}.`);
    }
  }

  /** Брифинг: комбинированный тест Command(I)−10 и Logic(I)−10. */
  async _briefingRoll() {
    const cmd = this._postData("commander").filled ? this._postData("commander") : this._postData("leader");
    if (!cmd.filled) return ui.notifications.warn("Нужен Командир или Лидер, чтобы провести брифинг.");

    // Оба навыка проходят через Интеллект: базовое значение = ранг навыка,
    // пересчитанный с F/Ag на I, поэтому берём I и ранговый бонус самого навыка.
    const intTotal = cmd.int ?? 0;
    const felTotal = cmd.fel ?? 0;
    const cmdRank  = (cmd.command ?? -20) - felTotal;              // ранговый бонус Command
    const logRank  = (cmd.logic ?? -20) - (cmd.int ?? 0);          // ранговый бонус Logic (уже на I)
    const cmdTarget = intTotal + cmdRank - 10;
    const logTarget = intTotal + logRank - 10;

    const content = `<div class="wh-attack-form sq-cmd-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Брифинг</span><span class="atk-weapon-class">${esc(cmd.name)}</span></div>
      <div class="sq-cmd-hint">Комбинированный тест: обе части бросаются одним d100, Успехи — по худшей из них.</div>
      <div class="atk-dlg-row"><label>Command(I)−10:</label><input id="sq-b1" type="number" value="${cmdTarget}"/></div>
      <div class="atk-dlg-row"><label>Logic(I)−10:</label><input id="sq-b2" type="number" value="${logTarget}"/></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="sq-mod" type="number" value="0"/></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Брифинг: ${this.actor.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "sq-cmd-dialog"],
      position: { width: 400 },
      content,
      buttons: [
        {
          action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const mod = parseInt(form.querySelector("#sq-mod").value) || 0;
            const t1  = (parseInt(form.querySelector("#sq-b1").value) || 0) + mod;
            const t2  = (parseInt(form.querySelector("#sq-b2").value) || 0) + mod;
            const roll = await new Roll("1d100").evaluate();
            const rv = roll.total;
            const ok1 = rv <= t1, ok2 = rv <= t2;
            const ok  = ok1 && ok2;
            // Комбинированный тест: Успехи — по худшему порогу.
            const worst = Math.min(t1, t2);
            const deg   = degrees(worst, rv);
            const sux   = ok ? deg : 0;
            const power = Math.floor(Math.floor((cmd.int ?? 0) / 10) / 2);

            if (ok) await this.actor.update({ "system.briefing.successes": sux });

            await ChatMessage.create(ChatMessage.applyRollMode({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: `<div class="wh-roll-result sq-chat">
                <div class="roll-header">${rollIcon("chart", "#4dffa6")}Брифинг — ${esc(this.actor.name)}</div>
                <div class="roll-threshold">${esc(cmd.name)} · Command(I)−10: <b>${t1}</b> · Logic(I)−10: <b>${t2}</b></div>
                <div class="roll-dice">Бросок: <b>${rv}</b></div>
                <div class="roll-outcome">${ok
                  ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
                  : `<span class="roll-failure">Провал${!ok1 ? " (Command)" : ""}${!ok2 ? " (Logic)" : ""}</span>`}</div>
                ${ok ? `<div class="sq-chat-effect">Подчинённые получают <b>${sux}</b> Ход(ов) в следующем бою с преимуществами
                  Короткой Команды силой <b>${power}</b> Успехов (½ I.b, окр.▼), по выбору их Лидера.</div>` : ""}
              </div>`,
              rolls: [roll], sound: CONFIG.sounds.dice
            }, game.settings.get("core", "rollMode")));
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  /** Приказ подчинённому: встречный тест Command(F)+0 vs W+0. */
  async _orderRoll() {
    const cmd = this._postData("commander").filled ? this._postData("commander") : this._postData("leader");
    if (!cmd.filled) return ui.notifications.warn("Приказы отдаёт Командир (или Лидер) — назначьте пост.");
    const members = (this.actor.system.members || []).map(m => this._memberData(m)).filter(m => !m.missing);
    if (!members.length) return ui.notifications.warn("В отряде нет доступных участников.");

    const coh = Number(this.actor.system.derived?.cohesion) || 0;
    const opts = members.map((m, i) =>
      `<option value="${m.id}" ${i === 0 ? "selected" : ""} data-wp="${m.wp ?? 0}">${esc(m.name)} — W ${m.wp ?? "—"}</option>`).join("");

    const content = `<div class="wh-attack-form sq-cmd-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Приказ</span><span class="atk-weapon-class">Command(F)+0 vs W+0</span></div>
      <div class="sq-cmd-hint">Свободное действие. При победе Командира подчинённый вынужден следовать приказу.</div>
      <div class="atk-dlg-row"><label>Подчинённый:</label><select id="sq-target">${opts}</select></div>
      <div class="atk-dlg-row"><label>Command(F):</label><input id="sq-base" type="number" value="${cmd.command ?? -20}"/></div>
      <div class="atk-dlg-row"><label>Слаженность:</label><span class="sq-cmd-coh">${coh >= 0 ? "+" : ""}${coh}</span></div>
      <div class="atk-dlg-row"><label>Порог подчинённого (W):</label><input id="sq-wp" type="number" value="${members[0].wp ?? 0}"/></div>
      <div class="atk-dlg-row"><label>Приказ:</label><input id="sq-text" type="text" placeholder="Что приказано"/></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Приказ: ${this.actor.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "sq-cmd-dialog"],
      position: { width: 400 },
      content,
      buttons: [
        {
          action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", default: true,
          callback: async (event, button) => {
            const form  = button.form;
            const tgtId = String(form.querySelector("#sq-target").value || "");
            const tgt   = members.find(m => m.id === tgtId);
            const cTgt  = (parseInt(form.querySelector("#sq-base").value) || 0) + coh;
            const wTgt  = parseInt(form.querySelector("#sq-wp").value) || 0;
            const text  = String(form.querySelector("#sq-text").value || "");

            const rc = await new Roll("1d100").evaluate();
            const rw = await new Roll("1d100").evaluate();
            const okC = rc.total <= cTgt, okW = rw.total <= wTgt;
            const degC = okC ? degrees(cTgt, rc.total) : 0;
            const degW = okW ? degrees(wTgt, rw.total) : 0;
            // Встречный тест: побеждает успешный с бо́льшим числом Успехов;
            // при равенстве — сопротивляющийся (приказ не продавлен).
            const cmdWins = okC && (!okW || degC > degW);

            await ChatMessage.create(ChatMessage.applyRollMode({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: `<div class="wh-roll-result sq-chat">
                <div class="roll-header">${rollIcon("shield", "#4dffa6")}Приказ — ${esc(cmd.name)} → ${esc(tgt?.name || "")}</div>
                ${text ? `<div class="sq-chat-order">«${esc(text)}»</div>` : ""}
                <div class="roll-threshold">Command(F) <b>${cTgt}</b> → бросок <b>${rc.total}</b>${okC ? ` (${degC} ${_degWord(degC)})` : " — провал"}</div>
                <div class="roll-threshold">W подчинённого <b>${wTgt}</b> → бросок <b>${rw.total}</b>${okW ? ` (${degW} ${_degWord(degW)})` : " — провал"}</div>
                <div class="roll-outcome">${cmdWins
                  ? `<span class="roll-success">Командир побеждает — подчинённый вынужден следовать приказу</span>`
                  : `<span class="roll-failure">Подчинённый устоял — приказ не продавлен</span>`}</div>
                <div class="sq-chat-note">Игровой персонаж получает преимущества Команд только если признаёт авторитет Командира; иначе его Команды считаются как от Координатора.</div>
              </div>`,
              rolls: [rc, rw], sound: CONFIG.sounds.dice
            }, game.settings.get("core", "rollMode")));
          }
        },
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        form.querySelector("#sq-target").addEventListener("change", ev => {
          form.querySelector("#sq-wp").value = ev.currentTarget.selectedOptions[0]?.dataset.wp ?? 0;
        });
      }
    });
  }

  /** Героический Конец: Command(W)+0 vs Intimidate(W)+0 того, кто вывел из боя. */
  async _heroicRoll() {
    const cmd = this._postData("commander").filled ? this._postData("commander") : this._postData("leader");
    if (!cmd.filled) return ui.notifications.warn("Героический Конец совершает Командир или Лидер — Координатору он недоступен.");

    // Command(W): ранговый бонус навыка ложится на Волю вместо Товарищества.
    const cmdW = (cmd.wp ?? 0) + ((cmd.command ?? -20) - (cmd.fel ?? 0));

    const content = `<div class="wh-attack-form sq-cmd-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Героический Конец</span><span class="atk-weapon-class">${esc(cmd.name)}</span></div>
      <div class="sq-cmd-hint">Command(W)+0 против Intimidate(W)+0 того, кто вывел командира из боя.</div>
      <div class="atk-dlg-row"><label>Command(W):</label><input id="sq-base" type="number" value="${cmdW}"/></div>
      <div class="atk-dlg-row"><label>Intimidate(W) врага:</label><input id="sq-enemy" type="number" value="30"/></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Героический Конец: ${this.actor.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "sq-cmd-dialog"],
      position: { width: 400 },
      content,
      buttons: [
        {
          action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const t1 = parseInt(form.querySelector("#sq-base").value) || 0;
            const t2 = parseInt(form.querySelector("#sq-enemy").value) || 0;
            const r1 = await new Roll("1d100").evaluate();
            const r2 = await new Roll("1d100").evaluate();
            const ok1 = r1.total <= t1, ok2 = r2.total <= t2;
            const d1 = ok1 ? degrees(t1, r1.total) : 0;
            const d2 = ok2 ? degrees(t2, r2.total) : 0;
            const wins = ok1 && (!ok2 || d1 > d2);

            if (!wins) await this.actor.update({
              "system.presence.active": false, "system.shortCommand.active": false,
              "system.detailCommand.active": false
            });

            await ChatMessage.create(ChatMessage.applyRollMode({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: `<div class="wh-roll-result sq-chat">
                <div class="roll-header">${rollIcon("skull", "#ff8a8a")}Героический Конец — ${esc(cmd.name)}</div>
                <div class="roll-threshold">Command(W) <b>${t1}</b> → <b>${r1.total}</b>${ok1 ? ` (${d1} ${_degWord(d1)})` : " — провал"}</div>
                <div class="roll-threshold">Intimidate(W) врага <b>${t2}</b> → <b>${r2.total}</b>${ok2 ? ` (${d2} ${_degWord(d2)})` : " — провал"}</div>
                <div class="roll-outcome">${wins
                  ? `<span class="roll-success">Командование держится ещё ${d1} Раунд(ов)${d1 >= 5 ? " — и он отдаёт Короткую Команду как Подвигом (через W)" : ""}</span>`
                  : `<span class="roll-failure">Командование потеряно немедленно</span>`}</div>
              </div>`,
              rolls: [r1, r2], sound: CONFIG.sounds.dice
            }, game.settings.get("core", "rollMode")));
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  // ── Мораль участников ─────────────────────────────────────────────────────

  /**
   * Тест участника: Морали (W+0) или Сломленного Отряда (W+0 с модификатором
   * Слаженности как теста Морали).
   */
  async _memberTest(id, kind) {
    const raw = (this.actor.system.members || []).find(m => m.id === id);
    if (!raw) return;
    const m = this._memberData(raw);
    if (m.wp == null) return ui.notifications.warn(`У «${m.name}» нет Воли — тест невозможен.`);

    if (kind === "broken" && !this.actor.system.derived?.broken)
      return ui.notifications.warn("Тест Сломленного Отряда проходят только при отрицательной Слаженности.");

    const coh = Number(this.actor.system.derived?.cohesion) || 0;
    // Тест Морали идёт от чистой Воли; Сломленный Отряд — с модификатором Слаженности.
    const target = kind === "broken" ? m.wp + coh : m.wp;

    const roll = await new Roll("1d100").evaluate();
    const rv  = roll.total;
    const ok  = rv <= target;
    const deg = degrees(target, rv);
    const crit = ok ? rv <= 5 : rv >= 96;

    // Провал теста Морали снимает с подчинённого все преимущества Командования.
    if (kind === "morale" && !ok) {
      const members = foundry.utils.deepClone(this.actor.system.members || []);
      const t = members.find(x => x.id === id); if (t) t.moraleLost = true;
      await this.actor.update({ "system.members": members });
    }

    const outcome = kind === "morale"
      ? (ok ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}, Командование сохранено</span>`
            : `<span class="roll-failure">Провал — теряет все преимущества Командования; следующий Раунд доступны только «Укрепление Морали» и «Храбрость»</span>`)
      : (ok ? (deg >= 5 || crit
            ? `<span class="roll-success">Успех на ${deg} ${_degWord(deg)} — до конца боя эти тесты проходятся автоматически</span>`
            : `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}, боец держит строй</span>`)
            : (crit
            ? `<span class="roll-failure">Критический провал — самосохранение до конца боя или сцены</span>`
            : `<span class="roll-failure">Провал — в свой Ход действует из мотивов самосохранения (укрытие, отход, сдача)</span>`));

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result sq-chat">
        <div class="roll-header">${rollIcon(kind === "morale" ? "heart" : "warn", ok ? "#4dffa6" : "#ff8a8a")}${kind === "morale" ? "Тест Морали" : "Сломленный Отряд"} — ${esc(m.name)}</div>
        <div class="roll-threshold">W <b>${m.wp}</b>${kind === "broken" ? ` · Слаженность ${coh >= 0 ? "+" : ""}${coh}` : ""} → Порог <b>${target}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
        ${kind === "broken" ? `<div class="sq-chat-note">Если боец под Запугиванием своего Лидера или Командира и набрал Провалов не больше, чем тот Успехов на Intimidate, тест считается пройденным.</div>` : ""}
      </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

  /** Ручная отметка «потерял Командование» у участника. */
  async _toggleMoraleFlag(id) {
    const members = foundry.utils.deepClone(this.actor.system.members || []);
    const m = members.find(x => x.id === id); if (!m) return;
    m.moraleLost = !m.moraleLost;
    await this.actor.update({ "system.members": members });
  }

  /** Снять отметки потери Командования со всего отряда (новый Раунд/бой). */
  async _resetMoraleFlags() {
    const members = foundry.utils.deepClone(this.actor.system.members || []);
    members.forEach(m => { m.moraleLost = false; });
    await this.actor.update({ "system.members": members });
  }
}
