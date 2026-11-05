/**
 * Servitization economics for one utility. Every figure is an assumption-driven estimate; the
 * bed-life extension in particular is a hypothesis to be measured in the TRL 6 pilot.
 */
export interface EconomicsInputs {
  vessels: number;
  mediaCostPerVesselYear: number;
  mediaTonnesPerVessel: number;
  bedLifeExtension: number;
  labSamplesPerVesselYear: number;
  labCostPerSample: number;
  labReductionFraction: number;
  feePerVesselYear: number;
  co2PerTonneMedia: number;
}

/**
 * 2.4 t CO2e per tonne of media: assumed value for reactivated coal-based GAC. Vilen et al. (2022)
 * report a 72-80% lower GWP for reactivated than for virgin activated carbons; published cradle-to-gate
 * estimates for virgin coal-based carbon span roughly 11-18 kg CO2e/kg, i.e. about 2-5 t per tonne.
 */
export const BASE_ECONOMICS: EconomicsInputs = {
  vessels: 6,
  mediaCostPerVesselYear: 85000,
  mediaTonnesPerVessel: 9.1,
  bedLifeExtension: 0.28,
  labSamplesPerVesselYear: 26,
  labCostPerSample: 420,
  labReductionFraction: 0.85,
  feePerVesselYear: 14400,
  co2PerTonneMedia: 2.4,
};

export interface EconomicsResult {
  mediaBaseline: number;
  mediaSavings: number;
  labBaseline: number;
  labSavings: number;
  fee: number;
  net: number;
  mediaAvoidedTonnes: number;
  co2AvoidedTonnes: number;
  breakEvenExtension: number;
}

export function computeEconomics(i: EconomicsInputs): EconomicsResult {
  const mediaBaseline = i.vessels * i.mediaCostPerVesselYear;
  const mediaSavings = mediaBaseline * i.bedLifeExtension;
  const labBaseline = i.vessels * i.labSamplesPerVesselYear * i.labCostPerSample;
  const labSavings = labBaseline * i.labReductionFraction;
  const fee = i.vessels * i.feePerVesselYear;
  const mediaAvoidedTonnes = i.vessels * i.mediaTonnesPerVessel * i.bedLifeExtension;
  const perVesselLabSavings = i.labSamplesPerVesselYear * i.labCostPerSample * i.labReductionFraction;
  return {
    mediaBaseline,
    mediaSavings,
    labBaseline,
    labSavings,
    fee,
    net: mediaSavings + labSavings - fee,
    mediaAvoidedTonnes,
    co2AvoidedTonnes: mediaAvoidedTonnes * i.co2PerTonneMedia,
    breakEvenExtension: Math.max(0, (i.feePerVesselYear - perVesselLabSavings) / i.mediaCostPerVesselYear),
  };
}

export const ECONOMIC_SCENARIOS: { id: string; label: string; inputs: EconomicsInputs }[] = [
  {
    id: 'conservative',
    label: 'Conservative (10% extension, monthly lab baseline)',
    inputs: { ...BASE_ECONOMICS, bedLifeExtension: 0.1, labSamplesPerVesselYear: 12 },
  },
  { id: 'base', label: 'Base case (28% extension, bi-weekly lab baseline)', inputs: BASE_ECONOMICS },
  { id: 'optimistic', label: 'Optimistic (35% extension, bi-weekly lab baseline)', inputs: { ...BASE_ECONOMICS, bedLifeExtension: 0.35 } },
];
