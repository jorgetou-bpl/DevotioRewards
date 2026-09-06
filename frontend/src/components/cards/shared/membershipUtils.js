// Shared membership-tier logic — used by both the display component
// (MembershipAction) and the redemption logic (ResultPage.handleAction) so
// the "Ilimitadas" label and the endpoint actually called always agree.
const PERIOD_PARAM_KEY = { day: 'dailyParameters', week: 'weeklyParameters', month: 'monthlyParameters', year: 'yearlyParameters' };

// Boomerangme uses 0 as "no cap" on these period limit fields. A limit of 0
// on the customer's active billing period means unlimited visits, not zero.
export const isUnlimitedMembership = (card) => {
  const membershipTier = card?.membershipTier || {};
  const customerSubscription = card?.customerSubscription || {};
  const periodParams = membershipTier[PERIOD_PARAM_KEY[customerSubscription.period]] || null;
  return periodParams ? periodParams.limit === 0 : false;
};
