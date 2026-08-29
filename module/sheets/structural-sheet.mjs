// module/sheets/structural-sheet.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общий предок «структурных» листов — Отряд/Формирование/Корабль/Техника/
//  Звёздная система/Орда (wdbc-mdvf, находка R2/A3 аудита технического
//  долга). Каждый из них раньше напрямую наследовал ActorSheetV2 и заново
//  писал идентичный боилерплейт _prepareContext (актор/вкладка/Фракция/
//  system/derived/isGM) и паттерн «дроп актора → UUID → сокет-релей ГМу».
//  По образцу WarhammerCharacterSheet (actor-sheet.mjs) — тот уже так делает
//  для Персонажа/Демона/Принца/Миньона.
// ════════════════════════════════════════════════════════════════════════

import { actorFactionsContext } from "../apps/actor-factions.mjs";

export class WarhammerStructuralSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  /**
   * Общий боилерплейт контекста: актор, активная вкладка, поле «Фракция» в
   * шапке, `system`/`derived`, признак ГМа. Заметки (notesEnriched и
   * подобные) остаются за наследником — у каждого свой набор полей
   * (notes/gmNotes/description/warpRoutes), общего имени на все шесть нет.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.tab = this.tabGroups?.primary ?? this.constructor.TABS.primary.initial;
    // Поле «Фракция» в шапке — общее для всех листов (apps/actor-factions.mjs).
    Object.assign(context, actorFactionsContext(this.actor));
    const sys = this.actor.system;
    context.system  = sys;
    context.derived = sys.derived || {};
    context.isGM    = game.user.isGM;
    return context;
  }

  /** Обогащение текстового поля тем же рецептом, что у всех структурных
   *  листов (prose-mirror с переключаемым режимом, как у Journal Entries). */
  _enrich(text) {
    return foundry.applications.ux.TextEditor.implementation.enrichHTML(text || "", {
      relativeTo: this.actor, secrets: this.actor.isOwner
    });
  }

  // ── Дроп актора → UUID → сокет-релей ГМу ──────────────────────────────────
  // Общий для Отряда/Формирования/Корабля/Техники: игрок без прав на этот
  // структурный актор всё равно должен уметь привести/посадить/придать
  // СВОЕГО персонажа — запись идёт через активного ГМа по сокету. Орда и
  // Звёздная система в этом паттерне не участвуют — их листы просто не зовут
  // методы ниже, поведение не меняется.

  /** Общий разбор дропа: Token/Actor → this._onDropActor, иначе — предмет
   *  штатным путём. Наследник подключает: `_onDrop(event) { return
   *  this._dispatchActorOrItemDrop(event); }`. */
  async _dispatchActorOrItemDrop(event) {
    let data = null;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) { /* нет данных */ }
    if (data && (data.type === "Token" || data.type === "Actor")) return this._onDropActor(event, data);
    return super._onDrop(event);
  }

  /** UUID из данных дропа → актор (токен разворачивается в своего актора).
   *  null — данных нет, актор не нашёлся, либо это сам носитель листа. */
  async _resolveDroppedActor(data) {
    const uuid = data.uuid
      || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
      || (data.type === "Token" && data.sceneId && data.tokenId ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
    if (!uuid) return null;
    let doc = null;
    try { doc = await fromUuid(uuid); } catch (e) { doc = null; }
    const actor = doc?.actor ?? doc;
    if (!actor || actor.id === this.actor.id) return null;
    return { uuid, actor };
  }

  /**
   * Запись обновления структурного актора: владелец пишет напрямую, иначе —
   * запрос активному ГМу по сокету (see warhammer-dbc.mjs, обработчик
   * события `system.warhammer-dbc` по полю `action`).
   * @param {object} update        — Actor#update, исполняется если владелец
   * @param {object} socketPayload — событие целиком (action, …Uuid и т.п.);
   *                                 userId добавляется сам
   * @param {string} noGmWarning   — предупреждение без активного ГМа
   */
  async _persistOrRelay(update, socketPayload, noGmWarning) {
    if (this.actor.isOwner) { await this.actor.update(update); return true; }
    const gm = game.users.activeGM;
    if (!gm) { ui.notifications.warn(noGmWarning); return false; }
    game.socket.emit("system.warhammer-dbc", { ...socketPayload, userId: game.user.id });
    return true;
  }

  /** Ручная привязка DragDrop к корню листа — там, где PARTS.body.root=true
   *  ломает штатное связывание ActorSheetV2 (Отряд/Формирование/Орда/
   *  Техника; Корабль в этом не нуждается, см. его собственный _onRender). */
  _bindManualDragDrop(el, label) {
    try {
      const DDC = foundry.applications?.ux?.DragDrop?.implementation
               ?? foundry.applications?.ux?.DragDrop ?? globalThis.DragDrop;
      if (DDC) new DDC({ dropSelector: null, callbacks: { drop: this._onDrop.bind(this) } }).bind(el);
    } catch (e) { console.warn(`Warhammer DBC | ${label} DnD bind:`, e); }
  }
}
