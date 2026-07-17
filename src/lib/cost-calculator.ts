export type CalculatorMode = "products" | "services" | "seasonal" | "plan";
export type PlanGoal = "sales" | "messages";

export type ExtraCost = {
  id: string;
  name: string;
  amount: number;
};

export type ProductInputs = {
  ticket: number;
  productCost: number;
  shipping: number;
  fees: number;
  extras: ExtraCost[];
  targetNetMargin: number;
  storeConversion: number;
  dailyBudget: number;
  cpm: number;
  ctr: number;
};

export type ServiceInputs = {
  price: number;
  deliveryCost: number;
  extras: ExtraCost[];
  targetNetMargin: number;
  appointmentRatePerTen: number;
  closeRatePerTen: number;
  desiredClients: number;
  dailyBudget: number;
  cpm: number;
  ctr: number;
};

export type PlanInputs = {
  goal: PlanGoal;
  quantity: number;
};

export type SeasonalCampaignInputs = {
  productOrPromo: string;
  revenueGoal: number;
  durationDays: number;
  availableBudget: number;
  discountPerSale: number;
  seasonalTicket: number;
  variableCosts: number;
  minimumProfitPerSale: number;
  fixedCostContributionPerSale: number;
};

const nonNegative = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);
const ratio = (value: number) => Math.min(nonNegative(value), 100) / 100;
const perTenRatio = (value: number) => Math.min(nonNegative(value), 10) / 10;

export function extraCostsTotal(extras: ExtraCost[]) {
  return extras.reduce((total, item) => total + nonNegative(item.amount), 0);
}

export function calculateProducts(input: ProductInputs) {
  const ticket = nonNegative(input.ticket);
  const variableCost =
    nonNegative(input.productCost) +
    nonNegative(input.shipping) +
    nonNegative(input.fees) +
    extraCostsTotal(input.extras);
  const rawContribution = ticket - variableCost;
  const contribution = Math.max(rawContribution, 0);
  const contributionMargin = ticket > 0 ? contribution / ticket : 0;
  const targetProfit = ticket * ratio(input.targetNetMargin);
  const targetCpa = Math.max(contribution - targetProfit, 0);
  const breakEvenRoas = contribution > 0 ? ticket / contribution : 0;
  const targetRoas = targetCpa > 0 ? ticket / targetCpa : 0;
  const storeConversion = ratio(input.storeConversion);
  const maxCpl = targetCpa * storeConversion;
  const monthlySpend = nonNegative(input.dailyBudget) * 30;
  const impressions = input.cpm > 0 ? (monthlySpend / input.cpm) * 1000 : 0;
  const clicks = impressions * ratio(input.ctr);
  const sales = clicks * storeConversion;
  const revenue = sales * ticket;
  const projectedProfit = sales * contribution - monthlySpend;
  const projectedRoas = monthlySpend > 0 ? revenue / monthlySpend : 0;

  return {
    variableCost,
    rawContribution,
    contribution,
    contributionMargin,
    breakEvenCpa: contribution,
    breakEvenRoas,
    targetCpa,
    targetRoas,
    maxCpl,
    monthlySpend,
    impressions,
    clicks,
    sales,
    revenue,
    projectedProfit,
    projectedRoas,
  };
}

export function calculateServices(input: ServiceInputs) {
  const price = nonNegative(input.price);
  const variableCost = nonNegative(input.deliveryCost) + extraCostsTotal(input.extras);
  const rawContribution = price - variableCost;
  const contribution = Math.max(rawContribution, 0);
  const contributionMargin = price > 0 ? contribution / price : 0;
  const targetProfit = price * ratio(input.targetNetMargin);
  const targetCpa = Math.max(contribution - targetProfit, 0);
  const appointmentRate = perTenRatio(input.appointmentRatePerTen);
  const closeRate = perTenRatio(input.closeRatePerTen);
  const maxAppointmentCost = targetCpa * closeRate;
  const maxCpl = maxAppointmentCost * appointmentRate;
  const breakEvenRoas = contribution > 0 ? price / contribution : 0;
  const targetRoas = targetCpa > 0 ? price / targetCpa : 0;
  const monthlySpend = nonNegative(input.dailyBudget) * 30;
  const impressions = input.cpm > 0 ? (monthlySpend / input.cpm) * 1000 : 0;
  const messages = impressions * ratio(input.ctr);
  const appointments = messages * appointmentRate;
  const clients = appointments * closeRate;
  const revenue = clients * price;
  const projectedProfit = clients * contribution - monthlySpend;
  const messagesForGoal = appointmentRate > 0 && closeRate > 0
    ? nonNegative(input.desiredClients) / (appointmentRate * closeRate)
    : 0;
  const expectedMessageCost = messages > 0 ? monthlySpend / messages : 0;
  const expectedAppointmentCost = appointments > 0 ? monthlySpend / appointments : 0;
  const expectedClientCost = clients > 0 ? monthlySpend / clients : 0;

  return {
    variableCost,
    rawContribution,
    contribution,
    contributionMargin,
    targetCpa,
    breakEvenRoas,
    targetRoas,
    maxAppointmentCost,
    maxCpl,
    monthlySpend,
    impressions,
    messages,
    appointments,
    clients,
    revenue,
    projectedProfit,
    messagesForGoal,
    expectedMessageCost,
    expectedAppointmentCost,
    expectedClientCost,
  };
}

export function calculateSeasonalCampaign(input: SeasonalCampaignInputs) {
  const revenueGoal = nonNegative(input.revenueGoal);
  const durationDays = Math.max(nonNegative(input.durationDays), 1);
  const availableBudget = nonNegative(input.availableBudget);
  const ticket = nonNegative(input.seasonalTicket);
  const discount = nonNegative(input.discountPerSale);
  const variableCosts = nonNegative(input.variableCosts);
  const minimumProfit = nonNegative(input.minimumProfitPerSale);
  const fixedContribution = nonNegative(input.fixedCostContributionPerSale);
  const marginGrossPerSale = Math.max(ticket - discount - variableCosts, 0);
  const targetCpa = Math.max(marginGrossPerSale - fixedContribution - minimumProfit, 0);
  const requiredSalesTotal = ticket > 0 ? revenueGoal / ticket : 0;
  const requiredSalesPerDay = requiredSalesTotal / durationDays;
  const requiredBudgetTotal = requiredSalesTotal * targetCpa;
  const requiredBudgetDaily = requiredBudgetTotal / durationDays;
  const possibleSales = targetCpa > 0 ? availableBudget / targetCpa : 0;
  const estimatedProfit = possibleSales * marginGrossPerSale - availableBudget;
  const budgetCoverage = requiredBudgetTotal > 0 ? availableBudget / requiredBudgetTotal : 0;
  const diagnosis =
    marginGrossPerSale <= 0
      ? "El ticket no cubre descuento y costos variables. Hay que subir precio o bajar costos antes de pautar."
      : targetCpa <= 0
        ? "La utilidad mínima y costos fijos consumen todo el margen. Ajusta la meta de utilidad o la oferta."
        : availableBudget >= requiredBudgetTotal
          ? "La campaña tiene presupuesto suficiente para perseguir la meta completa."
          : budgetCoverage >= 0.6
            ? "La campaña puede correr, pero conviene priorizar los anuncios con mejor CPA y revisar a mitad del periodo."
            : "El presupuesto disponible se queda corto para la meta. Reduce meta, aumenta presupuesto o mejora ticket/margen.";

  return {
    marginGrossPerSale,
    fixedCostContributionPerSale: fixedContribution,
    targetCpa,
    requiredSalesTotal,
    requiredSalesPerDay,
    requiredBudgetTotal,
    requiredBudgetDaily,
    estimatedProfit,
    possibleSales,
    budgetCoverage,
    diagnosis,
  };
}

export function calculatePlan(
  plan: PlanInputs,
  products: ReturnType<typeof calculateProducts>,
  services: ReturnType<typeof calculateServices>,
  productInput: ProductInputs,
  serviceInput: ServiceInputs,
) {
  const quantity = nonNegative(plan.quantity);
  const clickCost = productInput.cpm > 0 && productInput.ctr > 0
    ? productInput.cpm / (1000 * ratio(productInput.ctr))
    : 0;

  if (plan.goal === "sales") {
    const conversion = ratio(productInput.storeConversion);
    const expectedCostPerResult = conversion > 0 ? clickCost / conversion : 0;
    const monthlyBudget = quantity * expectedCostPerResult;
    const dailyBudget = monthlyBudget / 30;
    const projectedRevenue = quantity * nonNegative(productInput.ticket);
    const projectedProfit = quantity * products.contribution - monthlyBudget;
    const exceedsCurrentBudget = dailyBudget > nonNegative(productInput.dailyBudget) * 2;
    const exceedsEconomics = products.targetCpa > 0 && expectedCostPerResult > products.targetCpa;

    return {
      expectedCostPerResult,
      monthlyBudget,
      dailyBudget,
      projectedRevenue,
      projectedProfit,
      affordableCostPerResult: products.targetCpa,
      isUnrealistic: exceedsCurrentBudget || exceedsEconomics || products.rawContribution <= 0,
      exceedsCurrentBudget,
      exceedsEconomics,
    };
  }

  const serviceClickCost = serviceInput.cpm > 0 && serviceInput.ctr > 0
    ? serviceInput.cpm / (1000 * ratio(serviceInput.ctr))
    : 0;
  const monthlyBudget = quantity * serviceClickCost;
  const dailyBudget = monthlyBudget / 30;
  const appointmentRate = perTenRatio(serviceInput.appointmentRatePerTen);
  const closeRate = perTenRatio(serviceInput.closeRatePerTen);
  const projectedClients = quantity * appointmentRate * closeRate;
  const projectedRevenue = projectedClients * nonNegative(serviceInput.price);
  const projectedProfit = projectedClients * services.contribution - monthlyBudget;
  const exceedsCurrentBudget = dailyBudget > nonNegative(serviceInput.dailyBudget) * 2;
  const exceedsEconomics = services.maxCpl > 0 && serviceClickCost > services.maxCpl;

  return {
    expectedCostPerResult: serviceClickCost,
    monthlyBudget,
    dailyBudget,
    projectedRevenue,
    projectedProfit,
    affordableCostPerResult: services.maxCpl,
    projectedClients,
    isUnrealistic: exceedsCurrentBudget || exceedsEconomics || services.rawContribution <= 0,
    exceedsCurrentBudget,
    exceedsEconomics,
  };
}
