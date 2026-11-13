export async function spendExpendable(item) {
  const qty = Number(item.system?.quantity) || 1;
  if (qty > 1) {
    await item.update({ "system.quantity": qty - 1 });
    return qty - 1;
  }
  await item.delete();
  return 0;
}
