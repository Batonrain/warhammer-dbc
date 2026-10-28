// test/combat/torrent.test.mjs
//
// Torrent / Поток (Талант Огнемётчика, Sahara 3-8318): «Когда он стреляет из
// огнемета, над которым он поработал хотя бы 1 смену, он может удвоить расход
// боеприпасов, чтобы вместо каплевидного шаблона поместить шаблон Blast(Rng/5+1)
// в пределах удвоенной обычной дальности огнемета и прямой видимости».
// «Работал смену» отмечает Мастерская Крафта флагом на самом оружии.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";
import {
  torrentOffered, torrentActive, torrentBlastRadius, torrentMaxDistance, torrentPlacementProblem,
  shiftCountsForTorrent, isFlamerWeapon, torrentWorkedShifts, TORRENT_WORKED_FLAG
} from "../../module/rules/flamer-talents.mjs";
import { CraftWorkshop, newCraftProject } from "../../module/apps/craft-workshop.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const TORRENT = { key: "flamer.core.torrent", name: "Torrent / Поток" };

/** Огнемёт с флагами на предмете. */
function flamer(flags = {}, system = {}) {
  // weaponType "flame" — как в packs-src (22 огнемёта); "flamer" в данных нет (ловушка формы фикстуры)
  const w = weaponFor({ weaponType: "flame", weaponClass: "heavy", range: 20, damage: "1d10", penetration: 2,
    magazineCur: 20, magazineMax: 20, rof_single: 1, weaponProps: [{ key: "spray", rating: 0, rating2: 0 }], ...system },
  { name: "Heavy Flamer / Тяжёлый Огнемёт", id: "w-flamer" });
  w.type = "weapon";
  const store = { ...flags };
  w.getFlag = (s, k) => store[`${s}.${k}`];
  w.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  w.update = async ch => { w.updates = [...(w.updates ?? []), ch]; };
  w.store = store;
  return w;
}
const WORKED = { [`warhammer-dbc.${TORRENT_WORKED_FLAG}`]: 1 };
const who = items => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), i: char(40) } });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Поток: настоящие огнемёты из packs-src", () => {
  it("Heavy Flamer и Assault Flamer из пака опознаются как огнемёт (weaponType из реальных данных)", () => {
    const docs = allPackDocuments("weapons").map(d => d.doc);
    for (const name of ["Heavy Flamer", "Assault Flamer"]) {
      const doc = docs.find(d => d.name?.startsWith(name));
      expect(doc, name).toBeTruthy();
      expect(isFlamerWeapon({ type: "weapon", system: doc.system }), name).toBe(true);
    }
    // ни одного огнемёта пака мимо опознания: все со свойством spray и типом flame
    const sprayFlame = docs.filter(d => d.type === "weapon" && d.system?.weaponType === "flame");
    expect(sprayFlame.length).toBeGreaterThan(10);
  });
});

describe("Поток: чистые правила", () => {
  it("Blast(Rng/5+1) и предел 2×Rng", () => {
    expect(torrentBlastRadius(20)).toBe(5);
    expect(torrentBlastRadius(12)).toBe(4);          // 12/5=2,4 → 3 (окр.▲) + 1
    expect(torrentMaxDistance(20)).toBe(40);
  });

  it("предложен только огнемёт в руках стрелка с Талантом; сработает только после ≥1 смены и с галочкой", () => {
    const w = flamer(WORKED), fresh = flamer();
    const a = who([byKey(TORRENT.key)]);
    expect(isFlamerWeapon(w)).toBe(true);
    expect(torrentOffered(a, { item: w, isMelee: false })).toBe(true);
    expect(torrentOffered(who([]), { item: w, isMelee: false })).toBe(false);
    expect(torrentOffered(a, { item: w, isMelee: true })).toBe(false);
    expect(torrentOffered(a, { item: weaponFor({ weaponType: "bolt" }, { name: "Болтер" }), isMelee: false })).toBe(false);
    expect(torrentActive(a, { item: w, isMelee: false, toggles: { torrent: true } })).toBe(true);
    expect(torrentActive(a, { item: w, isMelee: false, toggles: {} })).toBe(false);
    expect(torrentActive(a, { item: fresh, isMelee: false, toggles: { torrent: true } })).toBe(false);
    expect(torrentWorkedShifts(w)).toBe(1);
  });

  it("смена считается только с Tech-Use среди навыков теста", () => {
    expect(shiftCountsForTorrent(["group:trade:0", "skill:techUse"])).toBe(true);
    expect(shiftCountsForTorrent(["group:trade:0"])).toBe(false);
    expect(shiftCountsForTorrent(undefined)).toBe(false);
  });

  it("размещение: дальше 2×Rng и за стеной — отказ с причиной", () => {
    expect(torrentPlacementProblem({ distanceM: 30, maxM: 40, blocked: false })).toBeNull();
    expect(torrentPlacementProblem({ distanceM: 41, maxM: 40, blocked: false })).toContain("дальше");
    expect(torrentPlacementProblem({ distanceM: 10, maxM: 40, blocked: true })).toContain("видимости");
  });
});

describe("Поток: окно атаки и бросок", () => {
  it("галочка: доступна после смены, заблокирована с пояснением без неё; без Таланта блока нет", () => {
    const a = who([byKey(TORRENT.key)]);
    const ready = talentTogglesHtml(a, flamer(WORKED), { isMelee: false, sys: { range: 20 } });
    expect(ready).toContain('data-key="torrent"');
    expect(ready).not.toMatch(/data-key="torrent"[^>]*disabled/);
    expect(ready).toContain("Blast(5 м)");
    const fresh = talentTogglesHtml(a, flamer(), { isMelee: false, sys: { range: 20 } });
    expect(fresh).toMatch(/data-key="torrent"[^>]*disabled/);
    expect(fresh).toContain("ещё не работали");
    expect(talentTogglesHtml(who([]), flamer(WORKED), { isMelee: false, sys: { range: 20 } })).not.toContain('data-key="torrent"');
  });

  it("с галочкой: расход патронов вдвое, кнопка шаблона — круг Blast(5 м) с пределом 40 м", async () => {
    const run = async toggles => {
      resetCaptured();
      const w = flamer(WORKED);
      captured.dice = [50, 4, 4];
      await _executeAttackRoll(who([w, byKey(TORRENT.key)]), w, "bs", 45, "single", null, { talentToggles: toggles });
      return { html: card(), mag: w.updates.map(u => JSON.stringify(u)).join("|") };
    };
    const off = await run({});
    const on = await run({ torrent: true });
    const btn = h => h.match(/<button class="wh-place-template-btn"[^>]*>/)[0];
    expect(btn(off.html)).toContain('data-shape="cone"');
    expect(btn(on.html)).toContain('data-shape="circle"');
    expect(btn(on.html)).toContain('data-meters="5"');
    expect(btn(on.html)).toContain('data-torrent-max="40"');
    expect(btn(off.html)).not.toContain("data-torrent-max");
    expect(on.html).toContain("Поток: расход боеприпасов удвоен");
    // магазин 20: один выстрел тратит N, с Потоком — 2N
    const spent = s => 20 - Number(s.mag.match(/(\d+)/)?.[1] ?? 20);
    expect(spent(on)).toBe(spent(off) * 2);
    expect(spent(off)).toBeGreaterThan(0);
  });

  it("без отметки работы галочка Потока не действует даже если её прислали", async () => {
    const w = flamer();
    captured.dice = [50, 4, 4];
    await _executeAttackRoll(who([w, byKey(TORRENT.key)]), w, "bs", 45, "single", null, { talentToggles: { torrent: true } });
    expect(card()).not.toContain("data-torrent-max");
  });
});

describe("Поток: смена в Мастерской Крафта отмечает огнемёт", () => {
  function workshop(weapon, { skills = ["skill:techUse"], mode = "craft" } = {}) {
    const ws = Object.create(CraftWorkshop.prototype);
    const proj = newCraftProject();
    Object.assign(proj, { mode, torrentWeaponUuid: weapon.uuid });
    ws.projects = [proj];
    globalThis.fromUuid = async uuid => (uuid === weapon.uuid ? weapon : null);
    return { ws, proj, skills };
  }

  it("_markTorrentShift: +1 к счётчику на оружии и строка в карточке; не-огнемёт игнорируется", async () => {
    const w = flamer(); w.uuid = "Actor.a.Item.w";
    const { ws } = workshop(w);
    const note = await ws._markTorrentShift(w.uuid);
    expect(note).toContain("всего 1");
    expect(w.store[`warhammer-dbc.${TORRENT_WORKED_FLAG}`]).toBe(1);
    await ws._markTorrentShift(w.uuid);
    expect(w.store[`warhammer-dbc.${TORRENT_WORKED_FLAG}`]).toBe(2);
    const bolter = weaponFor({ weaponType: "bolt" }, { name: "Болтер" }); bolter.uuid = "Actor.a.Item.b"; bolter.type = "weapon";
    bolter.setFlag = vi.fn();
    globalThis.fromUuid = async () => bolter;
    expect(await ws._markTorrentShift(bolter.uuid)).toBe("");
    expect(bolter.setFlag).not.toHaveBeenCalled();
  });

  it("нет прав на оружие — понятное сообщение вместо тихой потери", async () => {
    const w = flamer(); w.uuid = "Actor.a.Item.w";
    w.setFlag = async () => { throw new Error("denied"); };
    const { ws } = workshop(w);
    expect(await ws._markTorrentShift(w.uuid)).toContain("не удалось");
  });
});
