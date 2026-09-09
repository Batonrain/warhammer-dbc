// test/tools/worktree-guard.test.mjs
//
// СТОРОЖ МЕСТА ДЛЯ WORKTREE (wdbc-ncm7).
//
// 08.09.2026 прошлые сессии заводили git worktree прямо в
// Data/systems/warhammer-dbc/../ (cwd сессии) вместо
// C:/Users/Derbius/AppData/Local/Temp/claude/. Foundry сканирует Data/systems,
// находит там system.json с id "warhammer-dbc" в папке с другим именем и на
// каждом старте пишет "Invalid system ... detected in directory ...".
//
// Проверяется тот же сигнал, которым сам Foundry решает, ругаться ли на
// подпапку: id из её system.json должен совпасть с именем папки.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findMismatched, isMismatchedSystemDir } from "../../tools/worktree-guard.mjs";

describe("isMismatchedSystemDir — сигнал ровно как у Foundry", () => {
  it("id совпадает с именем папки — не ругается", () => {
    expect(isMismatchedSystemDir("warhammer-dbc", "warhammer-dbc")).toBe(false);
  });

  it("id другой — та самая ошибка Foundry", () => {
    expect(isMismatchedSystemDir("wt-bookdiff", "warhammer-dbc")).toBe(true);
  });

  it("manifest без id (или нечитаемый) не считается несовпадением", () => {
    expect(isMismatchedSystemDir("wt-x", undefined)).toBe(false);
    expect(isMismatchedSystemDir("wt-x", "")).toBe(false);
  });
});

describe("findMismatched — сканирует Data/systems как это делает Foundry", () => {
  let dir = null;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  const systemsDir = () => {
    dir = mkdtempSync(join(tmpdir(), "wdbc-worktree-guard-"));
    return dir;
  };
  const makeSystem = (systemsRoot, folderName, id) => {
    const p = join(systemsRoot, folderName);
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "system.json"), JSON.stringify({ id }));
    return p;
  };

  it("своя система на своём месте — пусто", () => {
    const root = systemsDir();
    makeSystem(root, "warhammer-dbc", "warhammer-dbc");
    expect(findMismatched(root)).toEqual([]);
  });

  it("worktree с другим именем папки — находит, ровно как ошибку Foundry", () => {
    const root = systemsDir();
    makeSystem(root, "warhammer-dbc", "warhammer-dbc");
    makeSystem(root, "wt-bookdiff", "warhammer-dbc");
    const found = findMismatched(root);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ dir: "wt-bookdiff", id: "warhammer-dbc" });
  });

  it("другая легитимная система (другой id, папка = имя) не мешает", () => {
    const root = systemsDir();
    makeSystem(root, "warhammer-dbc", "warhammer-dbc");
    makeSystem(root, "pf2e", "pf2e");
    expect(findMismatched(root)).toEqual([]);
  });

  it("папка без system.json пропускается молча (не каждая подпапка — система)", () => {
    const root = systemsDir();
    mkdirSync(join(root, ".claude-worktrees"), { recursive: true });
    expect(findMismatched(root)).toEqual([]);
  });

  it("несуществующая Data/systems — пустой список, а не падение", () => {
    expect(findMismatched(join(tmpdir(), "точно-нет-такой-папки-wdbc"))).toEqual([]);
  });
});
