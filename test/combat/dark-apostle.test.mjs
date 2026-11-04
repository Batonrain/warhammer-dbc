// test/combat/dark-apostle.test.mjs
//
// Тёмный Апостол (Sahara 1-54b9), Foundry-обвязка module/combat/dark-apostle.mjs и места подключения:
// Истинная Молитва, Тёмное Поклонение, обращение и Правоверный Предвестника Ереси, Литания Хаоса (метки, временные
// предметы, конец боя), Возложение Рук (Порча, мутация, раз в месяц, ГМ-релей), Мученик, Смертный Инструмент
// (раз в сессию, мистический щит в конвейере урона). Актор — со схемой персонажа; Черты и Таланты — настоящие
// документы packs-src.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import {
  useTruePrayer, buildMonument, convertNpc, makeFaithful, useLitanyOfChaos, clearLitanyOnCombatEnd, clearLitanyFrom,
  useLayOnHands, performLayOnHands, useMartyr, finishMartyr, faithfulInSight, gmPickMartyrDemon, useMortalInstrument,
  grantMortalShield, mortalShieldOnDamage, darkApostleStatus, performDarkApostleWrite
} from "../../module/combat/dark-apostle.mjs";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";
import { mutationByRoll } from "../../module/constants/mutations.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { HATRED_PACK_ID, FRENZY_PACK_ID, FANATIC_PACK_ID } from "../../module/rules/dark-apostle.mjs";

const NS = "warhammer-dbc";
const TRAITS = "packs-src/traits/Элитные_архетипы/Т_мный_Апостол";
const TALENTS = "packs-src/talents/Элитные_архетипы/Т_мный_Апостол";
const HARBINGER = packDocById(TRAITS, "WKCWM6yQ5xrJyI2o");
const DEVOTION = packDocById(TRAITS, "l9fH4i9tP62kpX1T");
const PRAYER = packDocById(TALENTS, "ycZ1I5WtPWl18PUA");
const HANDS = packDocById(TALENTS, "RWPFDaUCBKK0LyDD");
const LITANY = packDocById(TALENTS, "e1ZeM9l6D9VgaViU");
const MARTYR = packDocById(TALENTS, "QgufMimQz6VN3HN3");
const MORTAL = packDocById(TALENTS, "mbCbCFSDjg2km7dG");
const HATRED = packDocById("packs-src/talents/Берсерк", HATRED_PACK_ID);
const FRENZY = packDocById("packs-src/talents/Берсерк", FRENZY_PACK_ID);
const FANATIC = packDocById("packs-src/traits", FANATIC_PACK_ID);
const TEMPLATES = {
  [`Compendium.${NS}.talents.Item.${HATRED_PACK_ID}`]: HATRED,
  [`Compendium.${NS}.talents.Item.${FRENZY_PACK_ID}`]: FRENZY,
  [`Compendium.${NS}.traits.Item.${FANATIC_PACK_ID}`]: FANATIC
};

let seq = 0;
const itemOf = (doc, extra = {}) => {
  const flags = JSON.parse(JSON.stringify(doc.flags ?? {}));
  return { id: `i${++seq}`, uuid: `Item.i${seq}`, type: doc.type, name: doc.name, img: doc.img,
    system: { ...doc.system, equipped: true, ...extra }, flags, getFlag: (s, k) => flags[s]?.[k] };
};

function hero({ items = [], uuid = "Actor.apostle", name = "Апостол", type = "character", infamy = 3, infamyMax = 5, cor = 60,
  lore = 60, wounds = 20, patron = "undivided", flags = {}, owner = true, followers = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.characteristics.inf.base = 50;
  system.wounds.max = 20;
  system.wounds.value = wounds;
  system.fate.value = infamy;
  system.fate.max = infamyMax;
  system.alignment = "heretic";
  system.corruption.value = cor;
  system.patronGod = patron;
  system.followers = followers;
  system.actionPoints = { ...(system.actionPoints ?? {}), value: 2, max: 2 };
  system.groupSkills = { forbiddenLore: [{ specialty: "Heresy", rank: "known", total: lore }] };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const store = { ...flags };
  const self = {
    id: uuid.split(".").at(-1), uuid, name, type, system, items: list, isOwner: owner,
    effects: Object.assign([], { contents: [] }), isToken: false, created: [], deleted: [],
    getFlag: (scope, key) => (scope === NS ? store[key] : undefined),
    setFlag: async (scope, key, value) => { store[key] = value; return self; },
    unsetFlag: async (scope, key) => { delete store[key]; return self; },
    getActiveTokens: () => [],
    update: async patch => {
      captured.updates.push(patch);
      for (const [p, value] of Object.entries(patch)) {
        if (p.startsWith("system.")) {
          const keys = p.slice("system.".length).split(".");
          let node = self.system;
          for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
          node[keys.at(-1)] = value;
        } else if (p.startsWith(`flags.${NS}.-=`)) delete store[p.slice(`flags.${NS}.-=`.length)];
        else if (p.startsWith(`flags.${NS}.`)) store[p.slice(`flags.${NS}.`.length)] = value;
      }
      return self;
    },
    createEmbeddedDocuments: async (kind, docs) => {
      self.created.push(...docs);
      const made = docs.map(d => itemOf(d));
      list.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (kind, ids) => {
      self.deleted.push(...ids);
      for (const id of ids) { const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1); }
      return [];
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(self);
  self.system.groupSkills.forbiddenLore[0].total = lore;
  self.store = store;
  return self;
}

const cards = () => captured.chat.map(c => String(c.content));
const lastCard = () => cards().at(-1) ?? "";
const prompt = answer => { foundry.applications.api.DialogV2.prompt = async () => answer; };
const inCombat = (actor = null, id = "c1") => {
  globalThis.game.combat = { id, round: 1, started: true, combatant: actor ? { actor } : null, combatants: actor ? [{ actor }] : [] };
  globalThis.game.combats = [globalThis.game.combat];
};
const fate = a => a.system.fate.value;

const realGetProperty = globalThis.foundry.utils.getProperty;
const realDeepClone = globalThis.foundry.utils.deepClone;
const realFromUuidSync = globalThis.fromUuidSync;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  globalThis.game.time = { worldTime: 600 };
  globalThis.game.user = { isGM: true, targets: new Set() };
  globalThis.game.actors = [];
  globalThis.game.combat = undefined;
  globalThis.game.combats = [];
  globalThis.fromUuid = async uuid => TEMPLATES[uuid] ? { ...TEMPLATES[uuid], toObject: () => JSON.parse(JSON.stringify(TEMPLATES[uuid])) } : null;
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.foundry.utils.deepClone = realDeepClone;
  globalThis.fromUuidSync = realFromUuidSync;
  globalThis.game.combat = undefined; delete globalThis.game.combats;
  globalThis.game.actors = [];
  globalThis.fromUuid = async () => null;
  delete globalThis.canvas.scene;
  delete foundry.applications.api.DialogV2.prompt;
  delete globalThis.game.packs;
  delete globalThis.Actor.create;
});

describe("Истинная Молитва", () => {
  it("в бою: полудействие, успех For.Lore (Heresy)+0 возвращает Очко Бесчестия", async () => {
    const a = hero({ items: [itemOf(PRAYER)], infamy: 2 });
    inCombat(a);
    captured.nextRoll = 30;
    expect(await useTruePrayer(a)).toBe(true);
    expect(fate(a)).toBe(3);
    expect(a.system.actionPoints.value).toBe(1);
    expect(lastCard()).toContain("Очко Бесчестия восстановлено: 3/5");
    expect(lastCard()).toContain("<b>30</b>");
  });

  it("провал — Очко не возвращается, полудействие потрачено", async () => {
    const a = hero({ items: [itemOf(PRAYER)], infamy: 2, lore: 40 });
    inCombat(a);
    captured.nextRoll = 90;
    expect(await useTruePrayer(a)).toBe(false);
    expect(fate(a)).toBe(2);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("вне боя не работает, ничего не тратится", async () => {
    const a = hero({ items: [itemOf(PRAYER)], infamy: 2 });
    expect(await useTruePrayer(a)).toBe(false);
    expect(fate(a)).toBe(2);
    expect(captured.chat).toHaveLength(0);
  });

  it("все Очки на месте — восстанавливать нечего, действие не тратится", async () => {
    const a = hero({ items: [itemOf(PRAYER)], infamy: 5 });
    inCombat(a);
    expect(await useTruePrayer(a)).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("без Таланта — ничего", async () => {
    const plain = hero({ infamy: 1 });
    inCombat(plain);
    expect(await useTruePrayer(plain)).toBe(false);
  });
});

describe("Тёмное Поклонение", () => {
  it("тратит Очко Бесчестия, записывает монумент и пишет карточку", async () => {
    const a = hero({ items: [itemOf(DEVOTION)], infamy: 2 });
    prompt({ name: "Алтарь из распятого трупа", god: "khorne", size: "altar", materials: "кости" });
    expect(await buildMonument(a)).toBe(true);
    expect(fate(a)).toBe(1);
    const list = a.getFlag(NS, "monuments");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Алтарь из распятого трупа", god: "khorne", size: "altar", materials: "кости" });
    expect(lastCard()).toContain("Алтарь из распятого трупа");
    expect(lastCard()).toContain("Кхорн");
    expect(darkApostleStatus(a).monuments).toBe(1);
  });

  it("без Очка Бесчестия монумент не воздвигнут, отмена диалога ничего не тратит", async () => {
    const empty = hero({ items: [itemOf(DEVOTION)], infamy: 0 });
    expect(await buildMonument(empty)).toBe(false);
    const a = hero({ items: [itemOf(DEVOTION)], infamy: 2 });
    prompt(null);
    expect(await buildMonument(a)).toBe(false);
    expect(fate(a)).toBe(2);
  });
});

describe("Предвестник Ереси: обращение и Правоверный", () => {
  const npcOf = (extra = {}) => hero({ uuid: "Actor.npc", name: "Гвардеец", type: "character", infamy: 0, ...extra });
  const target = npc => { globalThis.game.user.targets = new Set([{ actor: npc }]); };

  it("победа в Charm+0 против W+0 помечает NPC обращённым", async () => {
    const a = hero({ items: [itemOf(HARBINGER)] });
    const npc = npcOf();
    target(npc);
    captured.dice = [5, 95];
    expect(await convertNpc(a, npc)).toBe(true);
    expect(npc.getFlag(NS, "converted")).toEqual({ apostleUuid: "Actor.apostle", apostleName: "Апостол" });
    expect(lastCard()).toContain("разделяет веру");
  });

  it("проигрыш — метки нет", async () => {
    const a = hero({ items: [itemOf(HARBINGER)] });
    const npc = npcOf();
    captured.dice = [95, 5];
    expect(await convertNpc(a, npc)).toBe(false);
    expect(npc.getFlag(NS, "converted")).toBeUndefined();
  });

  it("Правоверный: Очко Бесчестия и Charm+10, метка faithful; обращённый не переспрашивается", async () => {
    const a = hero({ items: [itemOf(HARBINGER)], infamy: 2 });
    const npc = npcOf({ flags: { converted: { apostleUuid: "Actor.apostle", apostleName: "Апостол" } } });
    captured.nextRoll = 10;
    captured.confirmAnswer = false;
    expect(await makeFaithful(a, npc)).toBe(true);
    expect(fate(a)).toBe(1);
    expect(npc.getFlag(NS, "faithful")).toEqual({ apostleUuid: "Actor.apostle", apostleName: "Апостол" });
    expect(lastCard()).toContain("стал Правоверным");
  });

  it("не разделяющий веру (отказ в подтверждении) не становится Правоверным, Очко цело", async () => {
    const a = hero({ items: [itemOf(HARBINGER)], infamy: 2 });
    const npc = npcOf();
    captured.confirmAnswer = false;
    expect(await makeFaithful(a, npc)).toBe(false);
    expect(fate(a)).toBe(2);
    expect(npc.getFlag(NS, "faithful")).toBeUndefined();
  });

  it("провал Charm+10 — Очко потрачено, метки нет", async () => {
    const a = hero({ items: [itemOf(HARBINGER)], infamy: 2 });
    const npc = npcOf();
    captured.nextRoll = 99;
    expect(await makeFaithful(a, npc)).toBe(false);
    expect(fate(a)).toBe(1);
    expect(npc.getFlag(NS, "faithful")).toBeUndefined();
  });

  it("без таргета — предупреждение, ничего не сделано", async () => {
    const a = hero({ items: [itemOf(HARBINGER)], infamy: 2 });
    expect(await makeFaithful(a, null)).toBe(false);
    expect(await convertNpc(a, null)).toBe(false);
    expect(fate(a)).toBe(2);
  });
});

describe("Литания Хаоса", () => {
  const sub = (n, extra = {}) => hero({ uuid: `Actor.sub${n}`, name: `Боец ${n}`, type: "character", infamy: 0, ...extra });
  const wire = (apostle, subs) => {
    globalThis.game.actors = [apostle, ...subs];
    const map = Object.fromEntries([apostle, ...subs].map(a => [a.uuid, a]));
    globalThis.fromUuidSync = uuid => map[uuid] ?? null;
    apostle.system.followers = subs.map(s => ({ uuid: s.uuid }));
  };

  it("Кхорн: подчинённые получают метку, временные Frenzy и Hatred (Все!); Очко потрачено", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    const s1 = sub(1), s2 = sub(2);
    wire(a, [s1, s2]);
    expect(await useLitanyOfChaos(a)).toBe(true);
    expect(fate(a)).toBe(1);
    for (const s of [s1, s2]) {
      expect(s.getFlag(NS, "litanyBlessing")).toMatchObject({ god: "khorne", apostleUuid: "Actor.apostle", combatId: "c1" });
      expect(s.created.map(i => i.name)).toEqual([FRENZY.name, "Hatred / Ненависть (Все!)"]);
      expect(s.items.every(i => i.flags[NS].litanyGrant.apostleUuid === "Actor.apostle")).toBe(true);
      expect(s.created[1].system.targets[0].kind).toBe("all");
    }
    expect(a.getFlag(NS, "litany")).toMatchObject({ god: "khorne", combatId: "c1" });
    expect(lastCard()).toContain("Кхорн");
    expect(lastCard()).toContain("Боец 1, Боец 2");
  });

  it("Апостол Пантеона выбирает Бога в диалоге; Неделимый и Нургл предметов не выдают", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "undivided", infamy: 2 });
    const s1 = sub(1);
    wire(a, [s1]);
    prompt("undivided");
    expect(await useLitanyOfChaos(a)).toBe(true);
    expect(s1.getFlag(NS, "litanyBlessing").god).toBe("undivided");
    expect(s1.created).toEqual([]);
    expect(foundry.applications.api.DialogV2.prompt).toBeTypeOf("function");
  });

  it("посвящённый Богу не может выбрать чужую литанию: диалога нет, берётся своя", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "tzeentch", infamy: 2 });
    const s1 = sub(1);
    wire(a, [s1]);
    let asked = false;
    foundry.applications.api.DialogV2.prompt = async () => { asked = true; return "khorne"; };
    expect(await useLitanyOfChaos(a)).toBe(true);
    expect(asked).toBe(false);
    expect(s1.getFlag(NS, "litanyBlessing").god).toBe("tzeentch");
    expect(s1.created.map(i => i.name)).toEqual([FANATIC.name]);
  });

  it("повторная литания заменяет прежнюю: временные предметы Кхорна уходят, приходит Fanatic", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "undivided", infamy: 3 });
    const s1 = sub(1);
    wire(a, [s1]);
    prompt("khorne");
    await useLitanyOfChaos(a);
    expect(s1.items).toHaveLength(2);
    prompt("tzeentch");
    await useLitanyOfChaos(a);
    expect(s1.items.map(i => i.name)).toEqual([FANATIC.name]);
    expect(s1.getFlag(NS, "litanyBlessing").god).toBe("tzeentch");
    expect(fate(a)).toBe(1);
    expect(lastCard()).toContain("Прежняя литания (Кхорн) заменена");
  });

  it("своя Frenzy у подчинённого не дублируется и не снимается в конце боя", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    const own = itemOf(FRENZY);
    const s1 = sub(1, { items: [own] });
    wire(a, [s1]);
    await useLitanyOfChaos(a);
    expect(s1.items.filter(i => i.name === FRENZY.name)).toHaveLength(1);
    await clearLitanyOnCombatEnd();
    expect(s1.items.map(i => i.id)).toContain(own.id);
    expect(s1.items.some(i => i.flags[NS]?.litanyGrant)).toBe(false);
  });

  it("конец боя снимает метки и выданные предметы у всех, и метку Апостола", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    const s1 = sub(1), s2 = sub(2);
    wire(a, [s1, s2]);
    await useLitanyOfChaos(a);
    await clearLitanyOnCombatEnd();
    for (const s of [s1, s2]) {
      expect(s.getFlag(NS, "litanyBlessing")).toBeUndefined();
      expect(s.items).toHaveLength(0);
    }
    expect(a.getFlag(NS, "litany")).toBeUndefined();
  });

  it("вне боя, без подчинённых или без Очка Бесчестия — литания не произнесена, Очко цело", async () => {
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    wire(a, [sub(1)]);
    expect(await useLitanyOfChaos(a)).toBe(false);
    inCombat();
    const lonely = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    wire(lonely, []);
    expect(await useLitanyOfChaos(lonely)).toBe(false);
    const broke = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 0 });
    wire(broke, [sub(1)]);
    expect(await useLitanyOfChaos(broke)).toBe(false);
    expect(fate(a)).toBe(2);
  });

  it("мёртвые подчинённые литании не получают", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    const dead = sub(1, { flags: { deceased: true } });
    const alive = sub(2);
    wire(a, [dead, alive]);
    await useLitanyOfChaos(a);
    expect(dead.getFlag(NS, "litanyBlessing")).toBeUndefined();
    expect(alive.getFlag(NS, "litanyBlessing")).toBeTruthy();
  });

  it("clearLitanyFrom снимает только предметы своего Апостола", async () => {
    const s1 = sub(1);
    s1.items.push(itemOf({ ...FANATIC, flags: { [NS]: { litanyGrant: { apostleUuid: "Actor.other" } } } }));
    expect(await clearLitanyFrom(s1, "Actor.apostle")).toBe(false);
    expect(s1.items).toHaveLength(1);
    expect(await clearLitanyFrom(s1)).toBe(true);
    expect(s1.items).toHaveLength(0);
  });

  it("запись litanyBlessing по ГМ-релею допустима только Апостолу с Талантом, своей литании и своему подчинённому", () => {
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne" });
    const s1 = sub(1);
    const stranger = sub(9);
    const allActors = [{ type: "squad", system: { posts: { commander: { uuid: a.uuid } }, members: [{ uuid: s1.uuid }] } }];
    const ctx = { initiatorOwned: true, initiator: a, target: s1, allActors };
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "khorne" }, ctx).ok).toBe(true);
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "nurgle" }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "khorne", extra: 1 }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "khorne" }, { ...ctx, target: stranger }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "khorne" }, { ...ctx, initiator: hero() }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "litanyBlessing", god: "khorne" }, { ...ctx, initiatorOwned: false }).ok).toBe(false);
  });

  it("не-ГМ без владения подчинённым отправляет запись активному ГМу сокетом", async () => {
    inCombat();
    const a = hero({ items: [itemOf(LITANY)], patron: "khorne", infamy: 2 });
    const s1 = sub(1, { owner: false });
    wire(a, [s1]);
    globalThis.game.user = { isGM: false, targets: new Set() };
    globalThis.game.users = { activeGM: { id: "gm" } };
    const sent = [];
    globalThis.game.socket = { emit: (ch, data) => sent.push(data) };
    await useLitanyOfChaos(a);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ action: "targetActorWrite", targetUuid: "Actor.sub1", op: { kind: "litanyBlessing", god: "khorne" } });
    expect(s1.getFlag(NS, "litanyBlessing")).toBeUndefined();
    delete globalThis.game.users; delete globalThis.game.socket;
  });
});

describe("Возложение Рук", () => {
  const targetOf = (cor = 12, extra = {}) => hero({ uuid: "Actor.pc", name: "Бродяга", infamy: 0, cor, ...extra });
  const dice = (...d) => { captured.dice = d; };

  it("Порча до Порога, три броска Апостола, выбранная мутация — цели; метка «раз в месяц»", async () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 60 });
    const t = targetOf(12);
    dice(5, 50, 95);
    const pick = mutationByRoll(50);
    prompt(pick);
    expect(await useLayOnHands(a, t)).toBe(true);
    expect(t.system.corruption.value).toBe(20);
    expect(t.created).toHaveLength(1);
    expect(t.created[0].name).toBe(pick);
    expect(t.getFlag(NS, "darkApostle")).toBeUndefined();
    expect(t.getFlag(NS, "darkApostle.layOnHands")).toBe(600);
    expect(lastCard()).toContain("<b>5, 50, 95</b>");
    expect(lastCard()).toContain("Порча цели +8");
    expect(a.system.corruption.value).toBe(60);
  });

  it("мутация вне достижимого пула не принимается", async () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 60 });
    const t = targetOf(12);
    dice(5, 50, 95);
    prompt("Несуществующая мутация");
    expect(await useLayOnHands(a, t)).toBe(false);
    expect(t.system.corruption.value).toBe(12);
    expect(t.created).toHaveLength(0);
  });

  it("раз в месяц: повтор через день отказан, через 30 суток — разрешён", async () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 60 });
    const t = targetOf(12);
    dice(5, 50, 95);
    prompt(mutationByRoll(50));
    await useLayOnHands(a, t);
    t.system.corruption.value = 25;
    globalThis.game.time.worldTime = 600 + 86400;
    expect(await useLayOnHands(a, t)).toBe(false);
    expect(t.created).toHaveLength(1);
    globalThis.game.time.worldTime = 600 + 31 * 86400;
    dice(5, 50, 95);
    expect(await useLayOnHands(a, t)).toBe(true);
    expect(t.created).toHaveLength(2);
  });

  it("недостающая Порча выше Cor Апостола — отказ, ничего не записано", async () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 5 });
    const t = targetOf(12);
    expect(await useLayOnHands(a, t)).toBe(false);
    expect(t.system.corruption.value).toBe(12);
  });

  it("цель не согласна — ритуал не проведён", async () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 60 });
    const t = targetOf(12);
    captured.confirmAnswer = false;
    expect(await useLayOnHands(a, t)).toBe(false);
    expect(t.system.corruption.value).toBe(12);
  });

  it("исполнитель не пишет, если Порча цели изменилась после броска", async () => {
    const t = targetOf(12);
    expect(await performLayOnHands(t, { kind: "layOnHands", corruption: 3, mutation: mutationByRoll(50) }, hero())).toBeNull();
    expect(t.created).toHaveLength(0);
  });

  it("ГМ-релей: проверка записи layOnHands", () => {
    const a = hero({ items: [itemOf(HANDS)], cor: 60 });
    const t = targetOf(12);
    const ctx = { initiatorOwned: true, initiator: a, target: t };
    const op = { kind: "layOnHands", corruption: 8, mutation: mutationByRoll(50) };
    expect(checkTargetWrite(op, ctx).ok).toBe(true);
    expect(checkTargetWrite({ ...op, mutation: "Выдуманная" }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ ...op, corruption: 61 }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ ...op, corruption: 0 }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ ...op, extra: true }, ctx).ok).toBe(false);
    expect(checkTargetWrite(op, { ...ctx, initiator: hero() }).ok).toBe(false);
    const blessed = targetOf(12, { flags: { "darkApostle.layOnHands": 500 } });
    expect(checkTargetWrite(op, { ...ctx, target: blessed }).ok).toBe(false);
  });
});

describe("Мученик", () => {
  const faithfulNpc = (n = 1, extra = {}) => hero({ uuid: `Actor.f${n}`, name: `Правоверный ${n}`, infamy: 0,
    flags: { faithful: { apostleUuid: "Actor.apostle", apostleName: "Апостол" } }, ...extra });
  const scene = (...actors) => {
    globalThis.canvas.scene = { tokens: actors.map(a => ({ actor: a, x: 0, y: 0, width: 1, height: 1 })), grid: { size: 100, distance: 1 } };
  };

  it("в поле зрения — только живые Правоверные именно этого Апостола", () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const mine = faithfulNpc(1);
    const dead = faithfulNpc(2, { flags: { faithful: { apostleUuid: "Actor.apostle" }, deceased: true } });
    const foreign = faithfulNpc(3, { flags: { faithful: { apostleUuid: "Actor.other" } } });
    scene(mine, dead, foreign, hero({ uuid: "Actor.plain", name: "Прохожий" }));
    expect(faithfulInSight(a).map(x => x.name)).toEqual(["Правоверный 1"]);
  });

  it("4+ Успеха: Апостол называет демона, ГМ-исполнитель ставит токен и убивает Правоверного", async () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const f = faithfulNpc(1);
    scene(f);
    const demon = { name: "Nurgling / Нурглинг", toObject: () => ({ name: "Nurgling / Нурглинг", type: "character", system: {} }) };
    globalThis.game.packs = { get: () => ({ getIndex: async () => [{ _id: "d1", name: demon.name }], getDocument: async () => demon }) };
    const tokens = [];
    globalThis.canvas.scene.createEmbeddedDocuments = async (kind, docs) => { tokens.push(...docs); return docs; };
    globalThis.Actor.create = async data => ({ name: data.name, uuid: "Actor.demon", getTokenDocument: async () => ({ toObject: () => ({ name: data.name }) }) });
    globalThis.fromUuid = async uuid => (uuid === f.uuid ? f : null);
    prompt("Нурглинг");
    captured.nextRoll = 5;
    expect(await useMartyr(a)).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    expect(tokens).toHaveLength(1);
    expect(f.getFlag(NS, "deceased")).toBe(true);
    expect(f.getFlag(NS, "faithful")).toBeUndefined();
    expect(cards().join("\n")).toContain("Нурглинг");
    expect(cards().join("\n")).toContain("подчиняется ГМу");
  });

  it("1–3 Успеха: карточка с кнопкой для ГМа, демон не назначается, жертва жива", async () => {
    const a = hero({ items: [itemOf(MARTYR)], lore: 20 });
    inCombat(a);
    const f = faithfulNpc(1);
    scene(f);
    captured.nextRoll = 15;
    expect(await useMartyr(a)).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
    expect(lastCard()).toContain("wh-martyr-gm-btn");
    expect(lastCard()).toContain(`data-faithful-uuid="${f.uuid}"`);
    expect(f.getFlag(NS, "deceased")).toBeUndefined();
  });

  it("провал теста — Правоверный жив, демона нет", async () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const f = faithfulNpc(1);
    scene(f);
    captured.nextRoll = 99;
    expect(await useMartyr(a)).toBe(false);
    expect(f.getFlag(NS, "deceased")).toBeUndefined();
    expect(lastCard()).not.toContain("wh-martyr-gm-btn");
  });

  it("нет Правоверных — предупреждение, действие не тратится", async () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    inCombat(a);
    scene(hero({ uuid: "Actor.plain", name: "Прохожий" }));
    expect(await useMartyr(a)).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("имя демона, которого нет в Бестиарии, — Правоверный не умирает", async () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const f = faithfulNpc(1);
    globalThis.game.packs = { get: () => ({ getIndex: async () => [], getDocument: async () => null }) };
    expect(await finishMartyr(a, f, "Выдумка")).toBe(true);
    expect(f.getFlag(NS, "deceased")).toBeUndefined();
  });

  it("ГМ выбирает демона по карточке (gmPickMartyrDemon) тем же путём", async () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const f = faithfulNpc(1);
    scene(f);
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === f.uuid ? f : null);
    const demon = { name: "Бес", toObject: () => ({ name: "Бес", type: "character", system: {} }) };
    globalThis.game.packs = { get: () => ({ getIndex: async () => [{ _id: "d1", name: "Бес" }], getDocument: async () => demon }) };
    globalThis.canvas.scene.createEmbeddedDocuments = async (k, docs) => docs;
    globalThis.Actor.create = async data => ({ name: data.name, uuid: "Actor.demon", getTokenDocument: async () => ({ toObject: () => ({}) }) });
    prompt("Бес");
    expect(await gmPickMartyrDemon(a.uuid, f.uuid)).toBe(true);
    expect(f.getFlag(NS, "deceased")).toBe(true);
  });

  it("ГМ-релей: запись martyrSummon допустима только Апостолу с Талантом и только на его Правоверного", () => {
    const a = hero({ items: [itemOf(MARTYR)] });
    const f = faithfulNpc(1);
    const ctx = { initiatorOwned: true, initiator: a, target: f };
    expect(checkTargetWrite({ kind: "martyrSummon", name: "Бес" }, ctx).ok).toBe(true);
    expect(checkTargetWrite({ kind: "martyrSummon", name: "" }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ kind: "martyrSummon", name: "Бес" }, { ...ctx, target: hero({ uuid: "Actor.plain" }) }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "martyrSummon", name: "Бес" }, { ...ctx, initiator: hero() }).ok).toBe(false);
  });
});

describe("Предвестник Ереси: запись метки по ГМ-релею", () => {
  it("harbingerMark допустим только владельцу Черты и только двум меткам", () => {
    const a = hero({ items: [itemOf(HARBINGER)] });
    const ctx = { initiatorOwned: true, initiator: a, target: hero({ uuid: "Actor.npc" }) };
    expect(checkTargetWrite({ kind: "harbingerMark", mark: "faithful" }, ctx).ok).toBe(true);
    expect(checkTargetWrite({ kind: "harbingerMark", mark: "convert" }, ctx).ok).toBe(true);
    expect(checkTargetWrite({ kind: "harbingerMark", mark: "godhood" }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ kind: "harbingerMark", mark: "faithful" }, { ...ctx, initiator: hero() }).ok).toBe(false);
  });

  it("исполнитель пишет разные метки по виду", async () => {
    const npc = hero({ uuid: "Actor.npc" });
    await performDarkApostleWrite(npc, { kind: "harbingerMark", mark: "convert" }, { uuid: "Actor.apostle", name: "А" });
    expect(npc.getFlag(NS, "converted")).toBeTruthy();
    expect(npc.getFlag(NS, "faithful")).toBeUndefined();
    await performDarkApostleWrite(npc, { kind: "harbingerMark", mark: "faithful" }, { uuid: "Actor.apostle", name: "А" });
    expect(npc.getFlag(NS, "faithful")).toBeTruthy();
  });
});

describe("Смертный Инструмент", () => {
  it("раз в сессию: Очко потрачено, метка поставлена, повторное применение отказано", async () => {
    const a = hero({ items: [itemOf(MORTAL)], infamy: 3 });
    expect(await useMortalInstrument(a)).toBe(true);
    expect(fate(a)).toBe(2);
    expect(lastCard()).toContain("wh-mortal-btn");
    expect(lastCard()).toContain('data-kind="shield"');
    expect(darkApostleStatus(a).mortalReady).toBe(false);
    expect(await useMortalInstrument(a)).toBe(false);
    expect(fate(a)).toBe(2);
  });

  it("отмена подтверждения или нехватка Очка — ничего не тратится и метки нет", async () => {
    const a = hero({ items: [itemOf(MORTAL)], infamy: 3 });
    captured.confirmAnswer = false;
    expect(await useMortalInstrument(a)).toBe(false);
    expect(fate(a)).toBe(3);
    expect(darkApostleStatus(a).mortalReady).toBe(true);
    captured.confirmAnswer = true;
    expect(await useMortalInstrument(hero({ items: [itemOf(MORTAL)], infamy: 0 }))).toBe(false);
  });

  it("мистический щит: ставит метку и отражает один смертельный удар, затем исчезает", async () => {
    const a = hero({ items: [itemOf(MORTAL)], wounds: 5 });
    await grantMortalShield(a);
    expect(a.getFlag(NS, "mortalShield")).toBe(true);
    expect(await mortalShieldOnDamage(a, 3)).toEqual({ net: 3, note: "" });
    expect(a.getFlag(NS, "mortalShield")).toBe(true);
    const res = await mortalShieldOnDamage(a, 200);
    expect(res.net).toBe(0);
    expect(res.note).toContain("отразил смертельный удар");
    expect(a.getFlag(NS, "mortalShield")).toBeUndefined();
    expect(await mortalShieldOnDamage(a, 200)).toEqual({ net: 200, note: "" });
  });

  it("в конвейере урона щит гасит смертельное попадание: Раны целы, щит снят, в карточке пояснение", async () => {
    const a = hero({ items: [itemOf(MORTAL)], wounds: 5, flags: { mortalShield: true } });
    await applyDamageToActor(a, { rawDamage: 200, penetration: 0, damageType: "rending", hitLocation: "Торс", attackerName: "Враг", weaponName: "Тест" });
    expect(a.system.wounds.value).toBe(5);
    expect(a.system.wounds.critical).toBe(0);
    expect(a.getFlag(NS, "mortalShield")).toBeUndefined();
    expect(cards().join("\n")).toContain("Мистический щит Богов отразил смертельный удар");
  });

  it("без щита то же попадание убивает: Критические Раны выросли", async () => {
    const a = hero({ items: [itemOf(MORTAL)], wounds: 5 });
    await applyDamageToActor(a, { rawDamage: 200, penetration: 0, damageType: "rending", hitLocation: "Торс", attackerName: "Враг", weaponName: "Тест" });
    expect(a.system.wounds.critical).toBeGreaterThan(0);
  });

  it("не смертельное попадание щит не тратит", async () => {
    const a = hero({ items: [itemOf(MORTAL)], wounds: 20, flags: { mortalShield: true } });
    await applyDamageToActor(a, { rawDamage: 12, penetration: 0, damageType: "rending", hitLocation: "Торс", attackerName: "Враг", weaponName: "Тест" });
    expect(a.getFlag(NS, "mortalShield")).toBe(true);
  });
});

describe("стыковка карточек", () => {
  it("одноразовые метки карточек Апостола есть в белом списке сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain("martyrDemonPicked");
    expect(CARD_ONCE_FLAGS).toContain("mortalInstrumentUsed");
  });
});
