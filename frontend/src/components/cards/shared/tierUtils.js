// Shared tier-matching logic for discount/cashback cards.
// Used by both the display component (DiscountCashbackAction) and the
// transaction submission logic (ResultPage.handleAction) so the percentage
// shown to the operator is always exactly the percentage that gets charged.
//
// The current PERCENTAGE always comes from Boomerangme's own live balance —
// it reflects every purchase channel (this Scanner *and* Boomerangme's own
// native app/portal), unlike our own tier_progress accumulator, which only
// sees purchases made through this Scanner and can silently drift from
// Boomerangme's true tier whenever a purchase happens elsewhere. Confirmed
// live: a card sitting at Boomerangme's "Plata" (3%) was showing as "Oro"
// (5%) here, because our own counter had accumulated past our Oro threshold
// while Boomerangme's own total (updated by a purchase made through its
// native app) hadn't. Our discountTiers config is only used to find a
// matching tier NAME for that live percentage; tierProgress is only used
// for the "next tier" progress estimate, which is informational and not
// what actually gets charged.
export const getCurrentTierInfo = (discountTiers, tierProgress, balance) => {
  const percentage = balance?.discountLevel ?? balance?.discountPercentage ?? null;
  const totalTransactions = balance?.transactionsAmount ?? balance?.discountAmount ?? 0;
  const accumulatedAmount = tierProgress ? tierProgress.accumulated_amount : (totalTransactions / 100);

  const sortedTiers = discountTiers && discountTiers.length > 0
    ? [...discountTiers].sort((a, b) => a.threshold - b.threshold)
    : [];

  // Name the tier by matching Boomerangme's live percentage against our
  // configured tiers — not by looking up our own accumulated purchase total.
  let tierName = null;
  if (percentage != null && sortedTiers.length > 0) {
    const byPercentage = [...sortedTiers].sort((a, b) => a.percentage - b.percentage);
    for (let i = byPercentage.length - 1; i >= 0; i--) {
      if (percentage >= byPercentage[i].percentage) { tierName = byPercentage[i].name; break; }
    }
    if (!tierName) tierName = byPercentage[0]?.name ?? null;
  }

  // "Next tier" is only an estimate based on purchases made through this
  // Scanner — useful context, but not authoritative like percentage above.
  let nextTierName = null;
  let nextThreshold = null;
  let amountToNext = null;
  let nextTierPercentage = null;
  for (const tier of sortedTiers) {
    if (accumulatedAmount < tier.threshold) {
      nextTierName = tier.name;
      nextThreshold = tier.threshold;
      amountToNext = Math.max(0, tier.threshold - accumulatedAmount);
      nextTierPercentage = tier.percentage;
      break;
    }
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
