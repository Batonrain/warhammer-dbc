// ════════════════════════════════════════════════════════════════════════
//  Хирургикон — окно имплантации (Warhammer DBC).
//  Ripperdoc-стиль: фигура по центру, слоты по системам тела по бокам.
//  Установка = создание предмета-импланта на акторе из компендиума,
//  снятие = удаление. Сторона Л/П — флаг предмета warhammer-dbc.bodySide.
//  Механику имплантов НЕ дублирует — использует те же классификатор/цвета,
//  что и вкладка ТЕЛО.
// ════════════════════════════════════════════════════════════════════════

import { buildBodyState, buildBodyLayers, buildImplantsSvg,
         classifyImplant, implantCatColor } from "../constants/body-map.mjs";
import { syncItemEffectsDisabled } from "./effects.mjs";
import { syncGrantedEquipment } from "./mechanics.mjs";

const { Application } = foundry.appv1.api;
const NS = "warhammer-dbc";

const QUAL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
const IMPL_CAT = {
  mechanicus: "Механикус", mechEnergy: "Механикус", mechFocus: "Механикус",
  mechOther: "Механикус", mechadendrite: "Механикус", bionic: "Бионика",
  cybernetic: "Кибернетика", psybernetic: "Псибернетика", archeotech: "Археотех",
  skitarii: "Скитарии", bioimplant: "Биоимплант",
};

// SVG-иконки систем (без эмодзи).
const IC = (body) => `<svg class="wh-surg-ic" viewBox="0 0 16 16" width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  brain:  IC(`<path d="M8 2.6C6 2.6 5 4 5 5.4 3.8 5.7 3.2 6.7 3.7 7.8 3 8.6 3.3 10 4.4 10.4 4.6 11.6 5.7 12.4 8 12.4V2.6Z"/><path d="M8 2.6C10 2.6 11 4 11 5.4 12.2 5.7 12.8 6.7 12.3 7.8 13 8.6 12.7 10 11.6 10.4 11.4 11.6 10.3 12.4 8 12.4"/>`),
  eye:    IC(`<path d="M2 8S4.4 4.2 8 4.2 14 8 14 8 11.6 11.8 8 11.8 2 8 2 8Z"/><circle cx="8" cy="8" r="2.1" fill="currentColor" stroke="none"/>`),
  skin:   IC(`<path d="M2.5 5.5C5 4 11 4 13.5 5.5M2.5 8C5 6.5 11 6.5 13.5 8M2.5 10.5C5 9 11 9 13.5 10.5"/>`),
  lungs:  IC(`<path d="M8 3v5"/><path d="M8 8H6C4.3 8 3.4 9.2 3.4 11l.2 2h2.6C7 15 8 14 8 12.4Z" fill="currentColor" fill-opacity="0.25"/><path d="M8 8h2c1.7 0 2.6 1.2 2.6 3l-.2 2h-2.6C9 15 8 14 8 12.4"/>`),
  heart:  IC(`<path d="M8 13.2S2.8 9.6 2.8 6.1A2.6 2.6 0 0 1 8 4.8 2.6 2.6 0 0 1 13.2 6.1C13.2 9.6 8 13.2 8 13.2Z" fill="currentColor" fill-opacity="0.3"/>`),
  bone:   IC(`<path d="M4.6 11.4 11.4 4.6"/><circle cx="3.4" cy="12.6" r="1.5"/><circle cx="4.9" cy="11.1" r="1.5"/><circle cx="12.6" cy="3.4" r="1.5"/><circle cx="11.1" cy="4.9" r="1.5"/>`),
  arm:    IC(`<path d="M4 3v4.5A3.5 3.5 0 0 0 7.5 11H13" stroke-width="1.6"/><circle cx="4" cy="3" r="1.3" fill="currentColor" stroke="none"/><circle cx="13" cy="11" r="1.6"/>`),
  leg:    IC(`<path d="M6 2.5V8l3.5 5.5" stroke-width="1.6"/><circle cx="6" cy="2.5" r="1.3" fill="currentColor" stroke="none"/><path d="M9.5 13.5H13"/>`),
  tent:   IC(`<path d="M2.5 13.5C5 13.5 5 9 8 9s3-4.5 5.5-6"/><circle cx="13.5" cy="3" r="1.6" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/>`),
  chip:   IC(`<rect x="4" y="4" width="8" height="8" rx="1"/><path d="M4 7H2M4 9H2M12 7h2M12 9h2M7 4V2M9 4V2M7 12v2M9 12v2"/><rect x="6.5" y="6.5" width="3" height="3" fill="currentColor" stroke="none"/>`),
};

// Слоты по системам тела (kind из classifyImplant → система). null = «прочее».
const SYSTEMS = [
  { id: "cortex",  label: "Лобная кора",       icon: ICONS.brain, kinds: ["cranial"] },
  { id: "ocular",  label: "Окулярная система", icon: ICONS.eye,   kinds: ["eye"], sideable: true },
  { id: "respir",  label: "Дыхательная",       icon: ICONS.lungs, kinds: ["respirator", "lung"] },
  { id: "circ",    label: "Кровеносная",       icon: ICONS.heart, kinds: ["heart"] },
  { id: "skel",    label: "Скелет",            icon: ICONS.bone,  kinds: ["skeleton"] },
  { id: "skin",    label: "Кожа",              icon: ICONS.skin,  kinds: ["skin"] },
  { id: "arms",    label: "Руки",              icon: ICONS.arm,   kinds: ["arm"], sideable: true },
  { id: "legs",    label: "Ноги",              icon: ICONS.leg,   kinds: ["leg"], sideable: true },
  { id: "mech",    label: "Механодендриты",    icon: ICONS.tent,  kinds: ["mechadendrite"] },
  { id: "other",   label: "Прочее",            icon: ICONS.chip,  kinds: [null, "torso"] },
];

const NS_INST = "installed"; // флаг «хирургически установлен»
const kindOf = (item) => classifyImplant(item.name, item.system?.installed)?.kind || null;

export class SurgeonWindow extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "wh-holo", "wh-surgeon"],
      template: "systems/warhammer-dbc/templates/apps/surgeon.hbs",
      width: 1020, height: 780, resizable: true,
      scrollY: [".wh-surg-col"],
    });
  }
  constructor(actor, options = {}) {
    super(options);
    this.actorId = actor.id;
    this.options.id = "wh-surgeon-" + actor.id;
    this._lib = null;
  }
  get actor() { return game.actors.get(this.actorId); }
  get title() { return `Хирургеон — имплантация — ${this.actor?.name || ""}`; }

  async _library() {
    if (this._lib) return this._lib;
    let docs = [];
    try { const p = game.packs.get(NS + ".implants"); if (p) docs = await p.getDocuments(); } catch (e) {}
    this._lib = docs.map(d => ({
      uuid: d.uuid, name: d.name,
      category: d.system?.category || "cybernetic",
      kind: classifyImplant(d.name, d.system?.installed)?.kind || null,
    }));
    return this._lib;
  }

  async getData() {
    const actor = this.actor;
    if (!actor) return { missing: true };

    const items = actor.items.filter(i => i.type === "implant");
    const isInstalled = i => !!i.getFlag(NS, NS_INST);

    // Фигура строится ТОЛЬКО из установленных (флаг).
    const raw = items.filter(isInstalled).map(i => {
      const side = i.getFlag?.(NS, "bodySide");
      return { name: i.name, installed: i.system.installed || "", category: i.system.category || "cybernetic",
               side: (side === "left" || side === "right") ? side : undefined };
    });
    const bodyState = buildBodyState(raw);
    const impl = buildImplantsSvg(bodyState, this.actor.system.bodyType || "male");

    const lib = await this._library();
    const ownedNames = new Set(items.map(i => i.name));   // всё, что уже на акторе

    const systems = SYSTEMS.map(sys => {
      const kset = new Set(sys.kinds);
      const inSys = i => kset.has(kindOf(i));
      const installed = items.filter(i => inSys(i) && isInstalled(i)).map(i => ({
        id: i.id, name: i.name,
        catColor: implantCatColor(i.system.category),
        quality: QUAL[i.system.quality] ?? "",
        side: i.getFlag?.(NS, "bodySide") || "",
      }));
      // «Со склада» — предметы на акторе, но не установленные.
      const owned = items.filter(i => inSys(i) && !isInstalled(i))
        .map(i => ({ id: i.id, name: i.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      // Компендиум — сгруппировано по категории (детальная сортировка).
      // ПАРНЫЕ системы (глаза/руки/ноги) допускают ДВА экземпляра — по одному
      // на сторону. Раньше любой уже имеющийся на акторе имплант скрывался из
      // списка по имени, поэтому второй глаз/руку поставить было нельзя.
      const limit    = sys.sideable ? 2 : 1;
      const cntByName = {};
      for (const i of items) if (inSys(i)) cntByName[i.name] = (cntByName[i.name] || 0) + 1;
      const byCat = {};
      for (const d of lib) {
        if (!kset.has(d.kind)) continue;
        // Непарные — как раньше (по всему актору); парные — по числу в системе.
        if (sys.sideable ? ((cntByName[d.name] || 0) >= limit) : ownedNames.has(d.name)) continue;
        const lbl = IMPL_CAT[d.category] ?? d.category ?? "—";
        (byCat[lbl] = byCat[lbl] || []).push({ uuid: d.uuid, name: d.name });
      }
      const groups = Object.entries(byCat)
        .map(([label, arr]) => ({ label, items: arr.sort((a, b) => a.name.localeCompare(b.name, "ru")) }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru"));
      return { id: sys.id, label: sys.label, icon: sys.icon, sideable: !!sys.sideable,
               installed, count: installed.length,
               available: { owned, groups, has: owned.length > 0 || groups.length > 0 } };
    });

    const mid = Math.ceil(systems.length / 2);
    return {
      actorName: actor.name,
      layers: buildBodyLayers(bodyState, this.actor.system.bodyType || "male"),
      implantsBack: impl.back, implantsFront: impl.front,
      systemsL: systems.slice(0, mid), systemsR: systems.slice(mid),
      implantTotal: items.filter(isInstalled).length,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;

    // Имплантировать: «own:<id>» — установить имеющийся (флаг); «lib:<uuid>» — создать из компендиума и установить.
    el.querySelectorAll("[data-install]").forEach(sel => sel.addEventListener("change", async e => {
      const v = e.target.value; if (!v) return;
      const [src, ref] = v.split(/:(.+)/);
      // Для парной системы (глаза/руки/ноги) сразу занимаем свободную сторону,
      // чтобы два одинаковых импланта не висели без Л/П и не путались.
      const sysId = e.target.dataset.install;   // data-install="{{id}}" — id системы
      const sysDef = SYSTEMS.find(s => s.id === sysId);
      const freeSide = () => {
        if (!sysDef?.sideable) return null;
        const kset = new Set(sysDef.kinds);
        const used = new Set(this.actor.items
          .filter(i => i.type === "implant" && kset.has(kindOf(i)) && i.getFlag(NS, NS_INST))
          .map(i => i.getFlag(NS, "bodySide")).filter(Boolean));
        return used.has("left") ? (used.has("right") ? null : "right") : "left";
      };
      if (src === "own") {
        const item = this.actor.items.get(ref);
        if (item) {
          const side = item.getFlag(NS, "bodySide") ? null : freeSide();
          await item.setFlag(NS, NS_INST, true);
          if (side) await item.setFlag(NS, "bodySide", side);
          // Установлен — довыдаём его Механику (эффекты + связанные атаки/снаряжение).
          await syncItemEffectsDisabled(item, true);
          await syncGrantedEquipment(item);
          ui.notifications?.info(`🔧 Имплантировано: ${item.name}`);
        }
      } else if (src === "lib") {
        const doc = await fromUuid(ref); if (!doc) return;
        const obj = doc.toObject(); delete obj._id;
        foundry.utils.setProperty(obj, `flags.${NS}.${NS_INST}`, true);
        const side = freeSide();
        if (side) foundry.utils.setProperty(obj, `flags.${NS}.bodySide`, side);
        await this.actor.createEmbeddedDocuments("Item", [obj]);
        ui.notifications?.info(`🔧 Имплантировано: ${doc.name}${side ? (side === "left" ? " (левый)" : " (правый)") : ""}`);
      }
      this.render(false);
    }));

    // Извлечь имплант (снять установку — предмет остаётся в снаряжении).
    el.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async () => {
      const item = this.actor.items.get(b.dataset.remove); if (!item) return;
      await item.unsetFlag(NS, NS_INST);
      // Извлечён — гасим его Механику: эффекты и всё, что он выдавал, уходят
      // вместе с ним, пока не установят обратно.
      await syncItemEffectsDisabled(item, false);
      await syncGrantedEquipment(item);
      ui.notifications?.info(`Имплант извлечён (в снаряжении): ${item.name}`);
      this.render(false);
    }));

    // Сторона Л/П.
    el.querySelectorAll("[data-side-btn]").forEach(b => b.addEventListener("click", async () => {
      const item = this.actor.items.get(b.dataset.item); if (!item) return;
      const side = b.dataset.sideBtn, cur = item.getFlag(NS, "bodySide");
      if (cur === side) await item.unsetFlag(NS, "bodySide"); else await item.setFlag(NS, "bodySide", side);
      this.render(false);
    }));

    // Открыть лист импланта.
    el.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => {
      this.actor.items.get(b.dataset.open)?.sheet?.render(true);
    }));
  }
}

export function openSurgeon(actor) {
  if (!actor) return null;
  const app = new SurgeonWindow(actor);
  app.render(true);
  return app;
}
