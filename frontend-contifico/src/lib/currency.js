// Contífico's client operates in Ecuador, whose official currency is USD —
// hardcoding USD here is a fact about this specific client, not a generic
// assumption to generalize elsewhere.
const formatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
});

export const formatCurrency = (value) => formatter.format(Number(value) || 0);
