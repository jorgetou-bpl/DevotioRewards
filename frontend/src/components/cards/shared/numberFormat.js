// Thousands-separator helpers for monetary inputs. The underlying state stays
// a plain numeric string (no commas) so parseFloat()/parseInt() calls
// elsewhere keep working unchanged — only the on-screen display is formatted.

export const stripThousandsFormatting = (displayValue) => {
  if (displayValue === null || displayValue === undefined) return '';
  const cleaned = String(displayValue).replace(/,/g, '');
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : displayValue.toString().replace(/[^\d.]/g, '');
};

export const formatWithThousands = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '';
  const [intPart, decimalPart] = String(rawValue).split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
};
