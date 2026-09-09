// test/apps/infernal-armiger-ritual.test.mjs
//
// wdbc-1rno: Инфернальный Оруженосец (4 бога) — «может призвать его в
// Истинной Форме простым 10-минутным ритуалом, не требующим тестов, и
// контролировать его как Миньона без траты слотов Миньонов». Реализовано
// как выдача готового Ритуала (kind:"equipment", equipMode:"direct") с
// item.system.noTest/asMinion/demonName — тот же стандартный путь, что у
// module/apps/ritual-cast.mjs::castNoTestRitual (wdbc-1rno, шаг B).
//
// Страж на РЕАЛЬНЫЕ данные (тот же принцип, что submutation-mechanics
// тесты): equipSourceUuid каждой Мутации обязан указывать на РЕАЛЬНО
// существующий Ритуал с правильным демоном, а не на опечатку в id.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { applyRitualItem } from "../../module/constants/rituals.mjs";

const GODS = [
  { god: "Кхорн",   dir: "packs-src/mutations/Дары_Богов/Кхорн",   mutationId: "felvy1sj4gIJFbIQ", ritualId: "ArmigerKhorneQ1a", demon: "Кровопускатель" },
  { god: "Нургл",   dir: "packs-src/mutations/Дары_Богов/Нургл",   mutationId: "ai4mBT9bhVwZqx8t", ritualId: "ArmigerNurgleQ2b", demon: "Чумонос" },
  { god: "Слаанеш", dir: "packs-src/mutations/Дары_Богов/Слаанеш", mutationId: "Ot9gweExln1toPnn", ritualId: "ArmigerSlaanQ3c1", demon: "Демонетка" },
  { god: "Тзинч",   dir: "packs-src/mutations/Дары_Богов/Тзинч",   mutationId: "dhnszZq38C0nRzNH", ritualId: "ArmigerTzeenQ4d2", demon: "Розовый Ужас" }
];

const RITUALS_DIR = "packs-src/rituals/Архетипа";
const BESTIARY_DIR = "packs-src/bestiary/Демоны_Хаоса";
const BESTIARY_BY_GOD = {
  "Кхорн": { dir: "Кхорн", id: "ENFL0SqAMmG72gGd" },
  "Нургл": { dir: "Нургл", id: "xbOpfugnjpitK6yv" },
  "Слаанеш": { dir: "Слаанеш", id: "Jx6orGZGIj1iSLb1" },
  "Тзинч": { dir: "Тзинч", id: "irMvHXtsVKS7YJzR" }
};

describe.each(GODS)("Инфернальный Оруженосец ($god): ритуал призыва без слота", ({ god, dir, mutationId, ritualId, demon }) => {
  const mutation = packDocById(dir, mutationId);
  const entries = mutation.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("Мутация несёт запись kind:\"equipment\" (direct), ссылающуюся на реальный Ритуал", () => {
    const entry = entries.find(e => e.kind === "equipment");
    expect(entry, "нет entry kind:equipment у Мутации").toBeTruthy();
    expect(entry.equipMode).toBe("direct");
    expect(entry.equipSourceUuid).toBe(`Compendium.warhammer-dbc.rituals.Item.${ritualId}`);
  });

  it("Ритуал реально существует, называет верного демона, без теста и как Миньон без слота", () => {
    const ritual = packDocById(RITUALS_DIR, ritualId);
    expect(ritual.type).toBe("ritual");
    expect(ritual.system.noTest).toBe(true);
    expect(ritual.system.asMinion).toBe(true);
    expect(ritual.system.demonName).toBe(demon);
    expect(ritual.system.failureType).toBe("summon");
  });

  it("демон реально существует в Бестиарии под тем же именем (findBestiaryActor его найдёт)", () => {
    const bestiaryHint = BESTIARY_BY_GOD[god];
    const daemon = packDocById(`${BESTIARY_DIR}/${bestiaryHint.dir}`, bestiaryHint.id);
    expect(daemon.name).toBe(demon);
    expect(daemon.type).toBe("daemon");
  });

  it("applyRitualItem превращает Ритуал в R с noTest/asMinion/demonName — тем же путём, что castRitual", () => {
    const ritual = packDocById(RITUALS_DIR, ritualId);
    const applied = applyRitualItem(null, { ...ritual, system: ritual.system }, () => []);

    expect(applied.noTest).toBe(true);
    expect(applied.asMinion).toBe(true);
    expect(applied.demonName).toBe(demon);
    expect(applied.type).toBe("summon");
  });
});
