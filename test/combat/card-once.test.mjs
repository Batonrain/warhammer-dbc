// test/combat/card-once.test.mjs
//
// Одноразовые действия с карточки чата (module/combat/card-once.mjs,
// wdbc-6rjtc.2/.3): отметка «уже сделано» живёт во флаге самого ChatMessage;
// чужую карточку помечает активный ГМ сокетом; двойной клик, пришедший, пока
// первый ещё работает, не проходит.
//
// Ниже — сторож стыковки по исходникам (как test/rules/delegate-test-wiring):
// бесплатный переброс Огневой Точки раньше брал «уже переброшено» только из
// opts.skipAmmo кликнутой карточки — у исходной его нет, и пункт меню
// жался с неё бесконечно; платный переброс её тоже не помечал.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { CARD_ONCE_FLAGS, cardOnceUsed, markCardOnce, runCardOnce } from "../../module/combat/card-once.mjs";

const NS = "warhammer-dbc";
let seq = 0;

/** Сообщение-заглушка: у владельца setFlag пишет, у чужого — падает, как в Foundry. */
function fakeMessage({ isOwner = true } = {}) {
  return {
    id: `m${++seq}`, isOwner, flags: {}, setFlagCalls: 0,
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) {
      if (!this.isOwner) throw new Error("нет прав на сообщение");
      this.setFlagCalls++;
      (this.flags[ns] ??= {})[k] = v;
    }
  };
}

let prev;
let emitted;
beforeEach(() => {
  resetCaptured();
  emitted = [];
  prev = { socket: game.socket, users: game.users, user: game.user };
  game.socket = { emit: (ch, d) => emitted.push({ ch, ...d }) };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => { Object.assign(game, prev); });

describe("runCardOnce — раз на карточку", () => {
  it("своя карточка: двойной клик — действие один раз, флаг на сообщении", async () => {
    const message = fakeMessage();
    let runs = 0;
    const run = async () => { runs++; await new Promise(r => setTimeout(r, 5)); return true; };
    const [a, b] = await Promise.all([
      runCardOnce(message, "attackRerolled", run),
      runCardOnce(message, "attackRerolled", run)
    ]);
    expect([a, b]).toEqual([true, false]);
    expect(runs).toBe(1);
    expect(message.flags[NS].attackRerolled).toBe(true);
    expect(cardOnceUsed(message, "attackRerolled")).toBe(true);
    expect(await runCardOnce(message, "attackRerolled", run)).toBe(false);
    expect(runs).toBe(1);
  });

  it("чужая карточка при ГМе в игре: отметку ставит ГМ сокетом, setFlag не зовётся", async () => {
    const message = fakeMessage({ isOwner: false });
    let runs = 0;
    expect(await runCardOnce(message, "legionSurgeryUsed", async () => { runs++; return true; })).toBe(true);
    expect(runs).toBe(1);
    expect(emitted).toEqual([{ ch: "system.warhammer-dbc", action: "messageUsedFlag",
      messageId: message.id, key: "legionSurgeryUsed", userId: "u1" }]);
    // Пока ГМ не записал флаг — повтор на этом клиенте всё равно закрыт.
    expect(await runCardOnce(message, "legionSurgeryUsed", async () => { runs++; return true; })).toBe(false);
    expect(runs).toBe(1);
  });

  it("чужая карточка без ГМа: действие не выполняется (отметить некому)", async () => {
    game.users = Object.assign([], { activeGM: null });
    const message = fakeMessage({ isOwner: false });
    let runs = 0;
    expect(await runCardOnce(message, "infamyFailSuccessUsed", async () => { runs++; return true; })).toBe(false);
    expect(runs).toBe(0);
    expect(captured.warnings.at(-1)).toMatch(/Мастера нет/);
  });

  it("действие не состоялось (нет Очка) — карточка не помечена, можно снова", async () => {
    const message = fakeMessage();
    expect(await runCardOnce(message, "infamyFailSuccessUsed", async () => false)).toBe(false);
    expect(cardOnceUsed(message, "infamyFailSuccessUsed")).toBe(false);
    expect(await runCardOnce(message, "infamyFailSuccessUsed", async () => true)).toBe(true);
  });

  it("markCardOnce без действия (платный переброс) закрывает карточку", async () => {
    const message = fakeMessage();
    await markCardOnce(message, "attackRerolled");
    expect(message.flags[NS].attackRerolled).toBe(true);
    expect(await runCardOnce(message, "attackRerolled", async () => true)).toBe(false);
  });
});

// ── Стыковка по исходникам ────────────────────────────────────────────────
const ROOT  = path.resolve(import.meta.dirname, "../..");
const read  = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const HOOKS = read("module/hooks.mjs");

describe("стыковка: Огневая Точка (wdbc-6rjtc.2)", () => {
  it("пункт меню гаснет на уже переброшенной исходной карточке", () => {
    const at = HOOKS.indexOf("const atkRerolled");
    expect(at).toBeGreaterThan(0);
    expect(HOOKS.slice(at, at + 200)).toMatch(/cardOnceUsed\(message, "attackRerolled"\)/);
  });

  it("бесплатный переброс идёт через runCardOnce по исходному сообщению", () => {
    const at = HOOKS.indexOf("btnFirePoint?.addEventListener");
    expect(HOOKS.slice(at, at + 600)).toMatch(/runCardOnce\(message, "attackRerolled"/);
  });

  it("платный переброс атаки тоже помечает исходную карточку", () => {
    const at = HOOKS.indexOf("const doReroll");
    const atkBranch = HOOKS.slice(at, HOOKS.indexOf("// Перебрасываем все кости из сообщения", at));
    expect(atkBranch).toMatch(/markCardOnce\(message, "attackRerolled"\)/);
  });
});

describe("стыковка: Хирургия Легиона и «провал → успех» (wdbc-6rjtc.3)", () => {
  it("пункт Хирургии Легиона гаснет на уже засчитанной карточке, обработчик передаёт сообщение", () => {
    const at = HOOKS.indexOf("const btnLegionSurgery");
    expect(HOOKS.slice(at, at + 300)).toMatch(/!cardOnceUsed\(message, "legionSurgeryUsed"\)/);
    const click = HOOKS.indexOf("btnLegionSurgery?.addEventListener");
    expect(HOOKS.slice(click, click + 400)).toMatch(/legionSurgeryOnCard\(actor, [^)]*, message\)/);
  });

  it("кнопка «провал → успех» гаснет по той же отметке, что ставит обработчик", () => {
    const at = HOOKS.indexOf('".wh-infamy-fail-success-btn"');
    expect(HOOKS.slice(at, at + 200)).toMatch(/cardOnceUsed\(message, "infamyFailSuccessUsed"\)/);
  });
});

describe("стыковка: ретрансляция отметки ГМу", () => {
  it("warhammer-dbc.mjs принимает messageUsedFlag только из белого списка", () => {
    const main = read("warhammer-dbc.mjs");
    const at = main.indexOf('data.action === "messageUsedFlag"');
    expect(at).toBeGreaterThan(0);
    expect(main.slice(at, at + 600)).toMatch(/CARD_ONCE_FLAGS\.includes\(data\.key\)/);
  });

  it("каждый ключ, переданный в cardOnceUsed/markCardOnce/runCardOnce, есть в белом списке", () => {
    const files = fs.readdirSync(path.join(ROOT, "module"), { withFileTypes: true, recursive: true })
      .filter(e => !e.isDirectory() && e.name.endsWith(".mjs"))
      .map(e => path.join(e.parentPath ?? e.path, e.name));
    const keys = new Set();
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:cardOnceUsed|markCardOnce|runCardOnce)\([^,]+,\s*"([^"]+)"/g)) {
        keys.add(m[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(0);
    for (const k of keys) expect(CARD_ONCE_FLAGS).toContain(k);
  });
});
