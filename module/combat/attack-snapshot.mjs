import { isExpendableOrdnance } from "../rules/no-magazine.mjs";

export function weaponSnapshot(item) {
  if (!isExpendableOrdnance(item) || typeof item.toObject !== "function") return null;
  return item.toObject();
}

function inert(doc) {
  doc.update = async () => doc;
  doc.delete = async () => doc;
  doc.setFlag = async () => doc;
  doc.unsetFlag = async () => doc;
  return doc;
}

function plainWeapon(actor, snapshot) {
  const data = structuredClone(snapshot);
  return inert({
    ...data,
    id: data._id,
    uuid: `${actor.uuid ?? `Actor.${actor.id}`}.Item.${data._id}`,
    actor,
    parent: actor,
    getFlag: (scope, key) => data.flags?.[scope]?.[key],
    toObject: () => structuredClone(data)
  });
}

export function virtualWeapon(actor, snapshot) {
  const DocumentClass = globalThis.CONFIG?.Item?.documentClass;
  if (DocumentClass) {
    try {
      return inert(new DocumentClass(structuredClone(snapshot), { parent: actor }));
    } catch {
      return plainWeapon(actor, snapshot);
    }
  }
  return plainWeapon(actor, snapshot);
}

export function attackWeapon(actor, atk) {
  if (!actor || !atk) return null;
  const live = actor.items?.get(atk.itemId);
  if (live) return live;
  return atk.itemSnapshot ? virtualWeapon(actor, atk.itemSnapshot) : null;
}
