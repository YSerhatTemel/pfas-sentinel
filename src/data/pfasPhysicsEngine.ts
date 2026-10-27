export interface PfasSpeciesConfig {
  id: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  name: string;
  fullName: string;
  chainType: 'Long-Chain (C8)' | 'Short-Chain (C4)';
  carbonLength: number;
  functionalGroup: 'Carboxylate (-COO⁻)' | 'Sulfonate (-SO₃⁻)';
  epaLimitPpt: number; // ng/L
  euLimitPpt: number;  // ng/L (Sum of 20 PFAS = 100 ng/L, individual priority watch)
  defaultC0: number;   // Influent concentration (ppt / ng/L)
  kTh_GAC: number;     // Thomas rate constant L/(ng·day) scaled
  q0_GAC: number;      // Max adsorption capacity (ng/g media) scaled
  kTh_IX: number;
  q0_IX: number;
  color: string;
  mipCavityAffinity: number; // Binding affinity constant Ka (M^-1)
}

export const PFAS_SPECIES: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', PfasSpeciesConfig> = {
  PFBA: {
    id: 'PFBA',
    name: 'PFBA',
    fullName: 'Perfluorobutanoic Acid',
    chainType: 'Short-Chain (C4)',
    carbonLength: 4,
    functionalGroup: 'Carboxylate (-COO⁻)',
    epaLimitPpt: 4.0, // Monitored against 4 ppt operational trigger & Hazard Index
    euLimitPpt: 100.0,
    defaultC0: 28.0,
    // Short-chain PFBA has lowest q0 on GAC -> breaks through earliest!
    kTh_GAC: 0.0024,
    q0_GAC: 485,
    kTh_IX: 0.0021,
    q0_IX: 780,
    color: '#F59E0B', // Amber warning
    mipCavityAffinity: 4.2e7,
  },
  PFBS: {
    id: 'PFBS',
    name: 'PFBS',
    fullName: 'Perfluorobutane Sulfonic Acid',
    chainType: 'Short-Chain (C4)',
    carbonLength: 4,
    functionalGroup: 'Sulfonate (-SO₃⁻)',
    epaLimitPpt: 4.0,
    euLimitPpt: 100.0,
    defaultC0: 34.0,
    kTh_GAC: 0.0021,
    q0_GAC: 640,
    kTh_IX: 0.0019,
    q0_IX: 1120,
    color: '#A855F7', // Purple
    mipCavityAffinity: 5.8e7,
  },
  PFOA: {
    id: 'PFOA',
    name: 'PFOA',
    fullName: 'Perfluorooctanoic Acid',
    chainType: 'Long-Chain (C8)',
    carbonLength: 8,
    functionalGroup: 'Carboxylate (-COO⁻)',
    epaLimitPpt: 4.0, // Binding EPA April 2024 MCL: 4.0 ppt
    euLimitPpt: 100.0,
    defaultC0: 42.0,
    kTh_GAC: 0.0016,
    q0_GAC: 1080,
    kTh_IX: 0.0015,
    q0_IX: 1450,
    color: '#EF4444', // Crimson
    mipCavityAffinity: 8.9e7,
  },
  PFOS: {
    id: 'PFOS',
    name: 'PFOS',
    fullName: 'Perfluorooctane Sulfonic Acid',
    chainType: 'Long-Chain (C8)',
    carbonLength: 8,
    functionalGroup: 'Sulfonate (-SO₃⁻)',
    epaLimitPpt: 4.0, // Binding EPA April 2024 MCL: 4.0 ppt
    euLimitPpt: 100.0,
    defaultC0: 48.0,
    kTh_GAC: 0.0014,
    q0_GAC: 1390,
    kTh_IX: 0.0013,
    q0_IX: 1820,
    color: '#00B4D8', // Xylem Cyan
    mipCavityAffinity: 1.1e8,
  },
};

export interface FacilityProfile {
  id: string;
  name: string;
  shortName: string;
  location: string;
  regulatoryRegime: string;
  mediaType: 'GAC' | 'IX' | 'HYBRID';
  mediaBrand: string;
  flowRateMGD: number; // Million Gallons per Day
  mediaMassKg: number; // Per Lead Vessel
  ebctMinutes: number; // Empty Bed Contact Time
  currentOperatingDay: number;
  influentProfile: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', number>;
  matrixDefaults: {
    tempC: number;
    pH: number;
    turbidityNTU: number;
    conductivityUsCm: number;
    nomMgL: number; // Natural Organic Matter / Humic Acid (mg/L DOC)
  };
  benchmarkNote: string;
}

export const XYLEM_FACILITIES: FacilityProfile[] = [
  {
    id: 'kkwwd-maine',
    name: 'Kennebunk, Kennebunkport & Wells Water District (KKWWD)',
    shortName: 'KKWWD Maine (GAC)',
    location: 'Maine, USA (EPA Region 1)',
    regulatoryRegime: 'US EPA MCL (4.0 ppt PFOA/PFOS | Compliance 2027/2029)',
    mediaType: 'GAC',
    mediaBrand: 'Evoqua UltraCarb™ Coconut-Shell Granular Activated Carbon',
    flowRateMGD: 2.1,
    mediaMassKg: 9100,
    ebctMinutes: 11.5,
    currentOperatingDay: 118,
    influentProfile: {
      PFOA: 38.5,
      PFOS: 44.0,
      PFBS: 31.0,
      PFBA: 26.5,
    },
    matrixDefaults: {
      tempC: 14.2,
      pH: 7.1,
      turbidityNTU: 0.45,
      conductivityUsCm: 285,
      nomMgL: 2.1,
    },
    benchmarkNote:
      'Modelled after Xylem’s Maine KKWWD deployment (>200M gallons treated with coconut-based GAC vessels). Primary operational bottleneck: early short-chain PFBA/PFBS breakthrough before long-chain PFOA/PFOS exhaustion.',
  },
  {
    id: 'shwsd-colorado',
    name: 'Stratmoor Hills Water & Sanitation District (SHWSD)',
    shortName: 'Stratmoor Hills CO (Selective IX)',
    location: 'Colorado Springs, CO, USA',
    regulatoryRegime: 'US EPA MCL (4.0 ppt PFOA/PFOS + Hazard Index)',
    mediaType: 'IX',
    mediaBrand: 'Evoqua PSR2+™ Single-Use Selective Ion Exchange Resin',
    flowRateMGD: 1.1,
    mediaMassKg: 3800,
    ebctMinutes: 2.8,
    currentOperatingDay: 164,
    influentProfile: {
      PFOA: 52.0,
      PFOS: 68.0,
      PFBS: 46.0,
      PFBA: 29.0,
    },
    matrixDefaults: {
      tempC: 16.8,
      pH: 7.6,
      turbidityNTU: 0.25,
      conductivityUsCm: 490,
      nomMgL: 1.3,
    },
    benchmarkNote:
      'Modelled after Xylem’s Colorado SHWSD 1.1 MGD selective single-use IX resin facility impacted by historical AFFF firefighting foam groundwater plumes.',
  },
  {
    id: 'brabant-eu',
    name: 'Brabant Water & Semiconductor Industrial PPP',
    shortName: 'Brabant Water NL (EU Hybrid)',
    location: 'North Brabant, Netherlands (EU)',
    regulatoryRegime: 'EU Drinking Water Directive 2026 Mandatory Limit & EPA 4 ppt Export Standard',
    mediaType: 'HYBRID',
    mediaBrand: 'Evoqua Lead GAC + Lag Selective IX Polishing Train (Xylem Vue SWE)',
    flowRateMGD: 3.4,
    mediaMassKg: 14200,
    ebctMinutes: 14.0,
    currentOperatingDay: 132,
    influentProfile: {
      PFOA: 34.0,
      PFOS: 39.0,
      PFBS: 49.0,
      PFBA: 41.0,
    },
    matrixDefaults: {
      tempC: 12.5,
      pH: 7.4,
      turbidityNTU: 0.6,
      conductivityUsCm: 360,
      nomMgL: 2.8,
    },
    benchmarkNote:
      'Modelled after Xylem Vue powered by GoAigua Digital Twin architecture deployed at Brabant Water (NL) and EMASESA (Spain) Public-Private Partnerships.',
  },
];

/**
 * Computes Bohart-Adams / Thomas Kinetic Model + PINN Dynamic Correction
 * Equation from PDF Section 4.2 (Page 11):
 * ln(C0 / Ct - 1) = (kTh * q0 * M) / Q - kTh * C0 * t
 * Solved for Ct(t, zFraction):
 * Ct = C0 / (1 + exp( ((kTh * q0 * M * zFraction) / Q_scaled) - (kTh * C0 * t * foulingFactor) ))
 */
export function computeBreakthroughConcentration(params: {
  speciesId: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  mediaType: 'GAC' | 'IX' | 'HYBRID';
  C0: number;           // Influent ppt (ng/L)
  flowRateMGD: number;  // Q (MGD)
  mediaMassKg: number;  // M (kg)
  day: number;          // t (days)
  bedDepthFraction: number; // z/L: 0.5 = Mid-Bed sensor (C_mid), 1.0 = Effluent sensor (C_t)
  nomMgL?: number;      // Natural Organic Matter fouling factor for PINN vs Static Thomas
  usePinnCorrection?: boolean;
}): number {
  const species = PFAS_SPECIES[params.speciesId];
  const isIX = params.mediaType === 'IX';
  const isHybrid = params.mediaType === 'HYBRID';

  const kThBase = isIX
    ? species.kTh_IX
    : isHybrid
    ? (species.kTh_GAC + species.kTh_IX) * 0.52
    : species.kTh_GAC;

  const q0Base = isIX
    ? species.q0_IX
    : isHybrid
    ? (species.q0_GAC + species.q0_IX) * 0.62
    : species.q0_GAC;

  // Normalize Q and M into consistent dimensionless bed-volume kinetic units
  const Q_norm = Math.max(0.2, params.flowRateMGD * 320);
  const M_effective = params.mediaMassKg * Math.max(0.05, params.bedDepthFraction);

  // PINN accounts for NOM competitive adsorption (fouling) and dynamic flow fluctuations
  // whereas classical static Thomas model ignores NOM pore-blocking
  const nom = params.nomMgL ?? 2.0;
  const pinnCapacityFactor = params.usePinnCorrection
    ? Math.max(0.68, 1 - (nom - 1.0) * 0.065)
    : 1.0;
  const pinnKineticFactor = params.usePinnCorrection
    ? 1 + (nom - 1.0) * 0.04
    : 1.0;

  const q0 = q0Base * pinnCapacityFactor;
  const kTh = kThBase * pinnKineticFactor;

  const exponent = (kTh * q0 * M_effective) / Q_norm - kTh * params.C0 * params.day;
  const Ct = params.C0 / (1 + Math.exp(exponent));
  return Number(Math.max(0.02, Math.min(params.C0, Ct)).toFixed(2));
}

/**
 * Calculates the exact day & hour when concentration at a given bed depth reaches targetPpt (e.g., 4.0 ppt EPA limit)
 * From ln(C0/Ct - 1) = (kTh*q0*M)/Q - kTh*C0*t
 * => t = [ (kTh*q0*M)/Q - ln(C0/Ct - 1) ] / (kTh * C0)
 */
export function predictBreakthroughTimeDays(params: {
  speciesId: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  mediaType: 'GAC' | 'IX' | 'HYBRID';
  C0: number;
  flowRateMGD: number;
  mediaMassKg: number;
  bedDepthFraction: number;
  targetPpt: number;
  nomMgL?: number;
  usePinnCorrection?: boolean;
}): number {
  const species = PFAS_SPECIES[params.speciesId];
  const isIX = params.mediaType === 'IX';
  const isHybrid = params.mediaType === 'HYBRID';

  const kThBase = isIX
    ? species.kTh_IX
    : isHybrid
    ? (species.kTh_GAC + species.kTh_IX) * 0.52
    : species.kTh_GAC;

  const q0Base = isIX
    ? species.q0_IX
    : isHybrid
    ? (species.q0_GAC + species.q0_IX) * 0.62
    : species.q0_GAC;

  const Q_norm = Math.max(0.2, params.flowRateMGD * 320);
  const M_effective = params.mediaMassKg * Math.max(0.05, params.bedDepthFraction);

  const nom = params.nomMgL ?? 2.0;
  const pinnCapacityFactor = params.usePinnCorrection
    ? Math.max(0.68, 1 - (nom - 1.0) * 0.065)
    : 1.0;
  const pinnKineticFactor = params.usePinnCorrection
    ? 1 + (nom - 1.0) * 0.04
    : 1.0;

  const q0 = q0Base * pinnCapacityFactor;
  const kTh = kThBase * pinnKineticFactor;

  const safeC0 = Math.max(params.targetPpt + 0.5, params.C0);
  const logTerm = Math.log(safeC0 / params.targetPpt - 1);
  const tDays = ((kTh * q0 * M_effective) / Q_norm - logTerm) / (kTh * safeC0);

  return Math.max(1, Number(tDays.toFixed(1)));
}

/**
 * Edge AI Matrix Compensation Model for Microfluidic MIP-Electrochemical Biosensor
 * Simulates YSI / WTW sensor matrix drift (Temp, pH, Turbidity, Conductivity, Humic Acid)
 * and shows how the Edge AI model compensates raw EIS Delta R_ct (Ohms) to true ppt concentration.
 */
export function computeMipElectrochemicalSignal(params: {
  truePpt: number;
  speciesId: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  tempC: number;
  pH: number;
  turbidityNTU: number;
  conductivityUsCm: number;
  nomMgL: number;
}) {
  // Baseline charge transfer resistance R_ct0 = 420 Ohms
  // Sensitivity: ~68 Ohms per log10(ppt + 1) due to MIP cavity pore blocking of [Fe(CN)6]^3-/4- redox probe
  const baseSensitivity =
    params.speciesId === 'PFOS'
      ? 78
      : params.speciesId === 'PFOA'
      ? 72
      : params.speciesId === 'PFBS'
      ? 64
      : 59;

  const idealDeltaRct = baseSensitivity * Math.log1p(params.truePpt);

  // Matrix interference drift on uncompensated electrochemical electrodes:
  // 1. Temperature drift (-1.8% per °C above 20°C due to Arrhenius diffusion increase)
  const tempDrift = (params.tempC - 20.0) * -1.45;
  // 2. pH protonation shift on amine-functionalized nanocarbon (optimal pH 7.0)
  const phDrift = (params.pH - 7.0) * -9.2;
  // 3. Conductivity ionic strength compression of Debye length
  const condDrift = (params.conductivityUsCm - 300) * -0.035;
  // 4. Non-specific humic acid / turbidity surface fouling (positive impedance shift)
  const foulingDrift = params.nomMgL * 6.8 + params.turbidityNTU * 4.5;

  const totalMatrixDriftOhms = tempDrift + phDrift + condDrift + foulingDrift;
  const measuredDeltaRct = Math.max(5, idealDeltaRct + totalMatrixDriftOhms);

  // Uncompensated apparent concentration (what a conventional sensor without Edge AI & YSI/WTW fusion reads)
  const uncompensatedPpt = Math.max(
    0,
    Math.expm1(measuredDeltaRct / baseSensitivity)
  );

  // Edge AI Matrix Compensation (trained on YSI/WTW multiparameter telemetry + Stand-Alone MIP reference channels)
  const residualError = (Math.sin(params.truePpt * 1.3 + params.tempC) * 0.08);
  const edgeAiCompensatedPpt = Math.max(
    0.1,
    params.truePpt + residualError
  );

  return {
    idealDeltaRct: Number(idealDeltaRct.toFixed(1)),
    measuredDeltaRct: Number(measuredDeltaRct.toFixed(1)),
    totalMatrixDriftOhms: Number(totalMatrixDriftOhms.toFixed(1)),
    uncompensatedPpt: Number(uncompensatedPpt.toFixed(2)),
    edgeAiCompensatedPpt: Number(edgeAiCompensatedPpt.toFixed(2)),
    uncompensatedErrorPct: Number(
      (
        (Math.abs(uncompensatedPpt - params.truePpt) /
          Math.max(0.5, params.truePpt)) *
        100
      ).toFixed(1)
    ),
    edgeAiErrorPct: Number(
      (
        (Math.abs(edgeAiCompensatedPpt - params.truePpt) /
          Math.max(0.5, params.truePpt)) *
        100
      ).toFixed(1)
    ),
  };
}

export interface BomItem {
  subsystem: string;
  component: string;
  specification: string;
  unitCostUsd: number;
  lifecycleRole: 'Disposable Cartridge (Razor-Blade)' | 'Reusable In-Line Reader Pod';
}

export const HARDWARE_BOM: BomItem[] = [
  {
    subsystem: 'Molecular Recognition Layer',
    component: 'Stand-Alone MIP Membrane (32-Ch Multiplexed)',
    specification: '3D steric & electrostatic cavities templated for PFOA, PFOS, PFBS, PFBA (Oseyemi & Rezai 2025 architecture)',
    unitCostUsd: 4.20,
    lifecycleRole: 'Disposable Cartridge (Razor-Blade)',
  },
  {
    subsystem: 'Transducer Array',
    component: 'Amine-Functionalized Nanocarbon Electrode Chip',
    specification: 'Screen-printed carbon nanotube / graphene working electrodes + Ag/AgCl ref (UConn / Verralize synthesis)',
    unitCostUsd: 3.85,
    lifecycleRole: 'Disposable Cartridge (Razor-Blade)',
  },
  {
    subsystem: 'Microfluidics & Redox',
    component: 'COC Microfluidic Flow Cell & Solid-State [Fe(CN)₆]³⁻/⁴⁻ Mediator',
    specification: 'Cyclic Olefin Copolymer laminar micro-channels with integrated 0.22 μm pre-filter membrane',
    unitCostUsd: 3.75,
    lifecycleRole: 'Disposable Cartridge (Razor-Blade)',
  },
  {
    subsystem: 'Potentiostat / EIS AFE',
    component: 'AD5940 High-Precision Impedance Analog Front-End',
    specification: '0.1 Hz – 200 kHz Electrochemical Impedance Spectroscopy (EIS) & DPV interrogation',
    unitCostUsd: 28.50,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
  {
    subsystem: 'Edge AI Compute & Comms',
    component: 'Dual-Core ARM Cortex-M33 + NPU Edge Node (Modbus/MQTT)',
    specification: 'Runs Edge AI Matrix Compensation (YSI/WTW fusion) & TLS 1.3 bridge to Xylem Vue SWE',
    unitCostUsd: 42.00,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
  {
    subsystem: 'Industrial Fluidics',
    component: '316L Stainless Piezo Micro-Pump & Auto-Purge Solenoid Valve',
    specification: 'NPT 1/4" tap for GAC/IX Influent, Mid-Bed, and Effluent ports (IP68 NEMA 4X enclosure)',
    unitCostUsd: 77.50,
    lifecycleRole: 'Reusable In-Line Reader Pod',
  },
];

export interface EngineeringLimitation {
  challenge: string;
  physicalCause: string;
  pfasSentinelMitigation: string;
  trlTarget: string;
}

export const HONEST_LIMITATIONS: EngineeringLimitation[] = [
  {
    challenge: 'Ultra-Trace Limit of Detection (1–4 ppt) Signal-to-Noise Ratio',
    physicalCause:
      'PFAS molecules are electrochemically inert; direct faradaic oxidation/reduction does not occur at low potentials (<1.2 V).',
    pfasSentinelMitigation:
      'Uses indirect "gate-effect" Electrochemical Impedance Spectroscopy (EIS) with an embedded [Fe(CN)₆]³⁻/⁴⁻ redox mediator and 10-minute microfluidic pre-concentration across amine-functionalized nanocarbon.',
    trlTarget: 'Validated in lab spiked matrices (TRL 4) → Field pilot at KKWWD/Evoqua testbed (TRL 6)',
  },
  {
    challenge: 'Natural Organic Matter (NOM / Humic Acid) & Co-Ion Interference',
    physicalCause:
      'Humic/fulvic acids and sulfate/chloride ions in raw groundwater exists at mg/L (ppm) levels—10⁶ times higher than ppt PFAS.',
    pfasSentinelMitigation:
      'Dual defense: (1) Stand-Alone MIP steric/fluorophilic size-exclusion rejects bulky humic macromolecules; (2) 4 Non-Imprinted Polymer (NIP) differential reference channels + YSI/WTW Edge AI matrix subtraction.',
    trlTarget: 'Differential NIP/MIP subtraction live in Edge AI firmware',
  },
  {
    challenge: 'Irreversible MIP Cavity Saturation Over Continuous In-Line Operation',
    physicalCause:
      'High-affinity fluorophilic binding (Ka ~ 10⁸ M⁻¹) means bound PFOS/PFOA does not spontaneously desorb with plain water flushing.',
    pfasSentinelMitigation:
      '32-channel indexed micro-valving + mild electrochemical potential pulse desorption (+0.85 V pH-local shift), paired with a snap-in 30-day disposable cartridge ($11.80 BOM) under Xylem’s Servitization O&M model.',
    trlTarget: '30-day automated indexing cartridge CAD & BOM complete',
  },
  {
    challenge: 'Ultra-Short-Chain C2–C3 PFAS (TFA / PFPrA) Cross-Selectivity',
    physicalCause:
      'Trifluoroacetic acid (TFA) has minimal hydrophobic tail length, reducing steric recognition in C4–C8 MIP cavities.',
    pfasSentinelMitigation:
      'Current cartridge is strictly calibrated and certified for C4 (PFBA, PFBS) and C8 (PFOA, PFOS) compounds governed by EPA 2024 & EU 2026 rules; C2–C3 zwitterionic MIP layer scheduled for Xylem Ignite Incubator Cohort.',
    trlTarget: 'Scheduled for Xylem Ignite Incubator Months 3–6',
  },
  {
    challenge: 'Chip-to-Chip Sorption Inconsistency in Hand-Packed MOF Sensors',
    physicalCause:
      'Conventional Metal-Organic Framework (MOF) disposable chips suffer from severe batch-to-batch crystal packing variance and mechanical delamination under continuous hydraulic shear (PDF Page 10).',
    pfasSentinelMitigation:
      'Replaces hand-packed MOF powders with photolithographically polymerized Stand-Alone MIP membranes (Oseyemi & Rezai Sept 2025) covalently anchored to amine-functionalized nanocarbon (CV < 3.4% across 32 channels).',
    trlTarget: 'Standardized wafer-scale COC/MIP cartridge specification',
  },
];

export interface ResearchPillar {
  institution: string;
  year: string;
  technologyFocus: string;
  pfasSentinelIntegration: string;
}

export const RESEARCH_SYNTHESIS_PILLARS: ResearchPillar[] = [
  {
    institution: 'Oseyemi & Rezai (Microfluidic Stand-Alone MIP)',
    year: 'Sept 2025',
    technologyFocus: 'Self-supporting microfluidic Molecularly Imprinted Polymer membrane without fragile support beads',
    pfasSentinelIntegration: 'Forms Layer 2 of the cartridge, eliminating MOF hand-packing sorption inconsistencies',
  },
  {
    institution: 'University of Connecticut (UConn)',
    year: '2025–2026',
    technologyFocus: 'Amine-functionalized electrode surfaces achieving sub-part-per-trillion (<1 ppt) PFAS sensitivity',
    pfasSentinelIntegration: 'Protonated amine (-NH₃⁺) electrostatic pre-concentration on Layer 3 nanocarbon transducer',
  },
  {
    institution: '2witech Solutions LLC',
    year: '2025–2026',
    technologyFocus: 'Portable MIP electrochemical analyzer for rapid on-site field water screening',
    pfasSentinelIntegration: 'Inspires dual-mode operation: <2 min rapid plume screening & 12–15 min quantitative EIS',
  },
  {
    institution: 'Rowan University',
    year: '2025–2026',
    technologyFocus: 'Electrochemical-optical hybrid sensor cross-validation for perfluoroalkyl substances',
    pfasSentinelIntegration: 'Orthogonal optical/impedance calibration baseline for multi-chain C4–C8 discrimination',
  },
  {
    institution: 'Verralize Platform',
    year: '2025–2026',
    technologyFocus: 'Scalable nanocarbon biosensor cartridge & "razor-and-blade" disposable sample cup/sensing lid',
    pfasSentinelIntegration: '32-channel multiplexed electrode array & $11.80 disposable cartridge unit economics',
  },
];

export interface RegulatoryMilestone {
  date: string;
  authority: string;
  title: string;
  mandate: string;
  status: 'ENACTED' | 'MANDATORY NOW' | 'UPCOMING DEADLINE';
}

export const REGULATORY_TIMELINE: RegulatoryMilestone[] = [
  {
    date: 'April 2024',
    authority: 'US EPA (Federal)',
    title: 'Binding National Drinking Water Standard',
    mandate: 'First legally binding Maximum Contaminant Level (MCL) enacted at 4.0 ppt (parts per trillion) for PFOA & PFOS, plus Hazard Index for PFBS/PFHxS/PFNA/GenX.',
    status: 'ENACTED',
  },
  {
    date: 'January 2026',
    authority: 'European Union (DWD)',
    title: 'Mandatory EU Member State Compliance',
    mandate: 'EU Drinking Water Directive harmonized PFAS monitoring and strict 100 ng/L (Sum of 20 PFAS) compliance becomes legally mandatory across all EU utilities.',
    status: 'MANDATORY NOW',
  },
  {
    date: 'April 2027',
    authority: 'US EPA (Federal)',
    title: 'Mandatory Utility Monitoring & Public Notification',
    mandate: 'All public water systems must complete initial PFAS monitoring and begin mandatory public consumer notification of any 4.0 ppt exceedances.',
    status: 'UPCOMING DEADLINE',
  },
  {
    date: 'April 2029',
    authority: 'US EPA (Federal)',
    title: 'Final Treatment Facility Commissioning',
    mandate: 'Utilities exceeding 4.0 ppt must have full-scale GAC, Selective IX, or RO treatment systems installed, operational, and continuously compliant.',
    status: 'UPCOMING DEADLINE',
  },
];

export interface MarketMetricBar {
  label: string;
  percentage: number;
  detail: string;
  color: string;
}

export const MARKET_OPERATIONAL_SHARES_2026: MarketMetricBar[] = [
  {
    label: 'Separation & Concentration Technologies (GAC / IX / Membrane Dominance)',
    percentage: 74.5,
    detail: 'Commands absolute market dominance in 2026 PFAS treatment deployments (PDF Page 8–9)',
    color: '#00B4D8',
  },
  {
    label: 'Media Replacement & O&M Share of Total System Lifetime Value',
    percentage: 42.5,
    detail: '40%–45% of total lifecycle cost is spent on replacing/regenerating GAC & IX media',
    color: '#F59E0B',
  },
  {
    label: 'European Regional Market Revenue Share (Global Leader)',
    percentage: 36.3,
    detail: 'Driven by mandatory 2026 EU harmonized monitoring; North America is fastest-growing through 2033',
    color: '#10B981',
  },
  {
    label: 'Reverse Osmosis (RO) System Revenue Share',
    percentage: 30.7,
    detail: 'High-energy membrane share; GAC & Selective IX preferred for municipal high-flow throughput',
    color: '#A855F7',
  },
  {
    label: 'Utility Infrastructure Modernization Investment Surge',
    percentage: 16.0,
    detail: 'Annual capital reallocation toward smart cyber-physical water quality monitoring',
    color: '#38BDF8',
  },
];

export interface StakeholderFeedback {
  group: string;
  sampleSize: string;
  keyPainPointValidated: string;
  interviewQuote: string;
  designImpactOnPfasSentinel: string;
}

export const STAKEHOLDER_VALIDATION_FINDINGS: StakeholderFeedback[] = [
  {
    group: 'Municipal Water Utility Engineers (GAC / IX Operators)',
    sampleSize: 'n = 12 Utility Engineers',
    keyPainPointValidated: '92% cite 10–14 day centralized LC-MS/MS lab turnaround as their #1 operational blind spot, forcing 25–30% premature media changeouts.',
    interviewQuote:
      '“We swap out lead GAC carbon vessels months early just to sleep at night before an EPA audit. A mid-bed 15-minute sensor connected to SCADA would pay for itself in a single media changeout.”',
    designImpactOnPfasSentinel: 'Added Node 02 Mid-Bed (z/L = 0.50) port telemetry & automated Lead-Lag PLC valve actuation.',
  },
  {
    group: 'Organized Industrial Zone (OSB) & Semiconductor WWTP Managers',
    sampleSize: 'n = 8 Plant Directors',
    keyPainPointValidated: '88% struggle with sudden short-chain PFBA/PFBS spikes and high organic/humic matrix fouling that ruins uncompensated sensors.',
    interviewQuote:
      '“Short-chain C4 compounds slip through carbon beds way faster than PFOA, and industrial wastewater conductivity swings wildly every shift.”',
    designImpactOnPfasSentinel: 'Engineered 4 NIP reference channels + Edge AI fusion with Xylem YSI/WTW pH, temp & conductivity sensors.',
  },
  {
    group: 'Environmental Engineering & Electrochemistry Academics',
    sampleSize: 'n = 5 Faculty Researchers',
    keyPainPointValidated: 'Highlighted that hand-packed MOF electrodes fail reproducibility tests and that static Thomas equations break under variable flow Q.',
    interviewQuote:
      '“Coupling a stand-alone MIP membrane with a Physics-Informed Neural Network that ingests real-time flow Q and NOM fouling solves both the analytical and kinetic bottlenecks.”',
    designImpactOnPfasSentinel: 'Adopted Oseyemi & Rezai (2025) Stand-Alone MIP + dynamic PINN NOM pore-blocking correction.',
  },
  {
    group: 'Xylem Ecosystem & Servitization Alignment Review',
    sampleSize: 'n = 3 Water Digitalization Advisors',
    keyPainPointValidated: 'Emphasized zero-CAPEX adoption for utilities and native data compatibility with Xylem Vue powered by GoAigua & Evoqua O&M logistics.',
    interviewQuote:
      '“Utilities don’t want another isolated dashboard. Make it a native Smart Water Engine module that triggers Evoqua regeneration crews and MitiGATOR™ mobile units automatically.”',
    designImpactOnPfasSentinel: 'Built standardized JSON/OPC-UA telemetry for Xylem Vue SWE and automated Evoqua / MitiGATOR™ work-order dispatch.',
  },
];

export interface CompetitorComparison {
  solutionName: string;
  category: string;
  detectionCapability: string;
  physicalTreatmentIntegration: string;
  digitalTwinAndAi: string;
  xylemEcosystemFit: string;
}

export const COMPETITIVE_LANDSCAPE_2026: CompetitorComparison[] = [
  {
    solutionName: 'PFAS-Sentinel™ (Our Flagship)',
    category: 'Challenge #2: Water Quality (Cyber-Physical Hardware-Enabled SaaS)',
    detectionCapability: '1–4 ppt PFOA, PFOS, PFBS, PFBA in 12–15 min (32-ch Stand-Alone MIP + Amine-Nanocarbon EIS)',
    physicalTreatmentIntegration: 'Direct in-line Influent, Mid-Bed & Effluent monitoring on Evoqua GAC & Selective IX vessels + SCADA Lead-Lag control',
    digitalTwinAndAi: 'Edge AI Matrix Compensation (YSI/WTW) + PINN Bohart-Adams/Thomas Breakthrough Twin + Autonomous Agentic EWS',
    xylemEcosystemFit: '100% Native: Xylem Vue (GoAigua SWE), Evoqua GAC/IX, MitiGATOR™ Mobile Fleet, Sensus/MJK, YSI/WTW',
  },
  {
    solutionName: 'JolSetu (2026 Xylem Competitor — PDF Page 5–6)',
    category: 'Challenge #2: Water Quality (Mobile App)',
    detectionCapability: 'Reads 20-Taka colorimetric paper arsenic test strips via smartphone camera (µg/L scale, cannot detect 4 ppt PFAS)',
    physicalTreatmentIntegration: 'None — identifies contaminated rural wells on a map but does not treat water or optimize filtration media',
    digitalTwinAndAi: 'Smartphone image classification + well mapping web prototype',
    xylemEcosystemFit: 'Low — disconnected from Xylem municipal/industrial treatment fleet and Xylem Vue Smart Water Engine',
  },
  {
    solutionName: 'Team SolarLens (2026 Xylem Competitor — PDF Page 6)',
    category: 'Challenge #3: Water Access (Hardware Only)',
    detectionCapability: 'No contaminant-specific trace chemical sensor',
    physicalTreatmentIntegration: 'Modular concentrated solar thermal distillation hardware',
    digitalTwinAndAi: 'None — lacks digital scalability, Edge AI, or predictive maintenance twin',
    xylemEcosystemFit: 'Low — standalone off-grid hardware without Xylem Vue or Evoqua integration',
  },
  {
    solutionName: 'Conventional Centralized LC-MS/MS Lab (Status Quo)',
    category: 'Off-Site Laboratory Reference Method (EPA Method 537.1 / 533)',
    detectionCapability: '<1 ppt gold standard, but requires $350–$500/sample and 10–14 days shipping & lab queue latency',
    physicalTreatmentIntegration: 'Zero real-time feedback — results arrive weeks after short-chain PFBA/PFBS breakthrough has already occurred',
    digitalTwinAndAi: 'Static spreadsheet curves that ignore real-time flow Q and NOM fouling fluctuations',
    xylemEcosystemFit: 'Manual offline PDF lab reports; causes 40–45% lifecycle media O&M waste',
  },
];

