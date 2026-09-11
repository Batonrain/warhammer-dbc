// test/rules/lightning-reflexes-docs.test.mjs
//
// wdbc-yqh: тот же приём, что и в dual-wield-talent-docs.test.mjs — проверка
// НАСТОЯЩИХ документов пака, а не самодельного актора-фикстуры.
//
// Правило (module/rules/initiative.mjs::initiativeRolls) и подмена кубика
// (module/documents/combatant.mjs) были написаны и покрыты тестами верно —
// «Молниеносные Рефлексы» даёт +1 бросок через capability
// combat.initiativeExtraRoll (2 броска всего, книга). Но живая проверка нашла
// 8 акторов Бестиария, где embedded-копия Таланта была заведена ДО того, как
// библиотечная запись получила эту capability (wdbc-7zzr), и осталась пустой
// (flags: {}, notes «Не смоделировано») — за столом эти монстры бросали
// Инициативу один раз вместо двух, хотя лист называл Талант.
//
// Здесь читаются те самые файлы, из которых собирается компендиум, и
// проверяется, что КАЖДАЯ копия Таланта — и библиотечная, и все embedded на
// акторах Бестиария — несёт нужный ключ Возможности.

import path from "node:path";
import { describe, it, expect } from "vitest";
import { itemHasKey } from "../../module/rules/item-marker.mjs";
import { INITIATIVE_EXTRA_ROLL_CAPABILITY } from "../../module/rules/initiative.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

// Пути — подпись «о ком речь», искать по ним нельзя (test/tools/pack-path-in-
// tests.test.mjs): packDocByFileHint достаёт из хвоста только id и ищет им.
const CANON_HINT =
  "packs-src/talents/Общие/Lightning_Reflexes___Молниеносные_Рефлек_D5cYACbielvSDp49.json";

// Акторы Бестиария, у которых лист называет Талант «Молниеносные Рефлексы»
// (wdbc-yqh — ревью третьей стопки PR нашло минимум эти 8).
const BESTIARY_HINTS = [
  "packs-src/bestiary/Демоны_Хаоса/Слаанеш/Хранитель_Секретов_BgwRB2LlKpRaW8np.json",
  "packs-src/bestiary/Друкхари/Звери_Укротителя/Адский_Паук_NfvFMrLBCYfBO8P5.json",
  "packs-src/bestiary/Друкхари/Звери_Укротителя/Бритвокрыл_W05o5QstWbJPoPge.json",
  "packs-src/bestiary/Друкхари/Кабал/Trueborn___Истиннорожд_нный_Xv0ZkH4WKbRiNxkB.json",
  "packs-src/bestiary/Друкхари/Кабал/Архонт_VAqJ8PlcRNH1XNtn.json",
  "packs-src/bestiary/Скакуны/Марру___Marru_ZkqNJlPScjwDaTlZ.json",
  "packs-src/bestiary/Скакуны/Раптор___Raptor_LmFzf2A096YvScVM.json",
  "packs-src/bestiary/Смертные_Хаоса/Культисты/Культист_Разведчик_zO7skH15SwIpO5tO.json",
];

/** Находит embedded-предмет «Lightning Reflexes» среди items актора. */
function lightningReflexesOf(actor) {
  return (actor.items ?? []).find(
    it => it.type === "talent" && it.name.startsWith("Lightning Reflexes"));
}

describe("Библиотечная запись «Молниеносные Рефлексы» несёт свою Возможность", () => {
  it("даёт combat.initiativeExtraRoll — иначе бросков не прибавится вовсе", () => {
    const talent = packDocByFileHint(CANON_HINT);
    expect(itemHasKey(talent, INITIATIVE_EXTRA_ROLL_CAPABILITY)).toBe(true);
  });
});

describe("Акторы Бестиария с «Молниеносными Рефлексами» несут ту же Возможность (wdbc-yqh)", () => {
  it.each(BESTIARY_HINTS.map(hint => [path.basename(hint), hint]))(
    "%s: embedded-копия Таланта не отстала от библиотечной", (_label, hint) => {
      const actor = packDocByFileHint(hint);
      const item = lightningReflexesOf(actor);
      expect(item, `на "${path.basename(hint)}" нет предмета «Lightning Reflexes»`).toBeTruthy();
      expect(itemHasKey(item, INITIATIVE_EXTRA_ROLL_CAPABILITY),
        `embedded-копия на "${path.basename(hint)}" не несёт combat.initiativeExtraRoll`).toBe(true);
    });
});
