// test/apps/discipline-tooltip.test.mjs
//
// wdbc-pwx: сводка дисциплины психосил тултипом на заголовке папки Обозревателя
// компендиумов. module/constants/disciplines.mjs::disciplineDescByFolderName
// сопоставляет имя папки пака (ВЕРХНИМ РЕГИСТРОМ, «ТАУМАТУРГИЯ») с label
// PSY_DISCIPLINES без учёта регистра; renderNodeHtml кладёт найденный текст
// в атрибут title заголовка папки.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { disciplineDescByFolderName } from "../../module/constants/disciplines.mjs";
import { renderNodeHtml } from "../../module/apps/compendium-browser.mjs";

describe("disciplineDescByFolderName", () => {
  it("находит по имени папки ВЕРХНИМ РЕГИСТРОМ", () => {
    expect(disciplineDescByFolderName("ТАУМАТУРГИЯ")).toContain("Схоластика Псайкана");
  });

  it("нечувствительно к регистру и пробелам вокруг", () => {
    expect(disciplineDescByFolderName("  колдовство  ")).toContain("сырыми энергиями Варпа");
  });

  it("составное имя с пробелом («ВЫСШЕЕ КОЛДОВСТВО»)", () => {
    expect(disciplineDescByFolderName("ВЫСШЕЕ КОЛДОВСТВО")).toContain("Покровительства");
  });

  it("дисциплина без книжного текста (Фундаментальная) — пусто", () => {
    expect(disciplineDescByFolderName("ТЕЛЕКИНЕЗ")).toBe("");
  });

  it("имя не совпало ни с одной дисциплиной — пусто", () => {
    expect(disciplineDescByFolderName("ЧТО-ТО ПОСТОРОННЕЕ")).toBe("");
  });

  it("пустое/отсутствующее имя — пусто, не падает", () => {
    expect(disciplineDescByFolderName("")).toBe("");
    expect(disciplineDescByFolderName(null)).toBe("");
    expect(disciplineDescByFolderName(undefined)).toBe("");
  });
});

describe("renderNodeHtml: тултип дисциплины на заголовке папки", () => {
  it("папка-дисциплина с текстом — title на .cbrowse-folder-head", () => {
    const node = { items: [], folders: [{ name: "ДЕМОНОЛОГИЯ", items: [], folders: [] }] };
    const html = renderNodeHtml(node, false);
    expect(html).toContain('title="Психосилы Демонологии');
  });

  it("папка без совпадения — заголовок без title", () => {
    const node = { items: [], folders: [{ name: "СЛУЧАЙНАЯ ПАПКА", items: [], folders: [] }] };
    const html = renderNodeHtml(node, false);
    expect(html).not.toContain("title=");
  });
});
