// Shared tier-matching logic for discount/cashback cards.
// Used by both the display component (DiscountCashbackAction) and the
// transaction submission logic (ResultPage.handleAction) so the percentage
// shown to the operator is always exactly the percentage that gets charged —
// previously these were computed independently and could drift apart.

export const getCurrentTierInfo = (discountTiers, tierProgress, balance) => {
  const discountLevel = balance?.discountLevel ?? balance?.discountPercentage ?? null;
  const totalTransactions = balance?.transactionsAmount ?? balance?.discountAmount ?? 0;
  const accumulatedAmount = tierProgress ? tierProgress.accumulated_amount : (totalTransactions / 100);

  let tierName = tierProgress?.current_tier || null;
  let nextTierName = tierProgress?.next_tier || null;
  let nextThreshold = tierProgress?.next_threshold || null;
  let amountToNext = tierProgress?.amount_to_next || null;
  let percentage = discountLevel;

  const sortedTiers = discountTiers && discountTiers.length > 0
    ? [...discountTiers].sort((a, b) => a.threshold - b.threshold)
    : [];

  if (tierName && sortedTiers.length > 0) {
    const matchedTier = sortedTiers.find((t) => t.name === tierName);
    if (matchedTier) percentage = matchedTier.percentage;
  }

  if (!tierName && sortedTiers.length > 0) {
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if (accumulatedAmount >= sortedTiers[i].threshold) {
        tierName = sortedTiers[i].name;
        percentage = sortedTiers[i].percentage;
        if (i < sortedTiers.length - 1) {
          nextTierName = sortedTiers[i + 1].name;
          nextThreshold = sortedTiers[i + 1].threshold;
          amountToNext = Math.max(0, sortedTiers[i + 1].threshold - accumulatedAmount);
        }
        break;
      }
    }
    if (!tierName) {
      tierName = sortedTiers[0]?.name;
      percentage = sortedTiers[0]?.percentage ?? discountLevel;
      if (sortedTiers.length > 1) {
        nextTierName = sortedTiers[1].name;
        nextThreshold = sortedTiers[1].threshold;
        amountToNext = Math.max(0, sortedTiers[1].threshold - accumulatedAmount);
      }
    }
  }

  let nextTierPercentage = null;
  if (nextTierName && sortedTiers.length > 0) {
    const nt = sortedTiers.find((t) => t.name === nextTierName);
    if (nt) nextTierPercentage = nt.percentage;
  }

  return {
    percentage,
    tierName,
    accumulatedAmount,
    nextTierName,
    nextThreshold,
    amountToNext,
    nextTierPercentage
  };
};
