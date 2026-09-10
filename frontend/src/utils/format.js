// Shared formatting helpers — extracted from OperationsPage.js so
// CustomerProfilePage.js (and any future page rendering operation rows)
// doesn't duplicate them.

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// Handles legacy receive-reward entries whose "amount" is actually a tier ID
// (large number) rather than a real quantity.
export const formatAmount = (op) => {
  const amount = op.amount;
  if (amount === null || amount === undefined) return '-';
  if (op.operation_type === 'receive-reward' && amount > 9999) {
    return 'N/A';
  }
  return amount;
};
