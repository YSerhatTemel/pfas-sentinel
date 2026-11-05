export type SpeciesId = 'PFBA' | 'PFBS' | 'PFOA' | 'PFOS';
export type MediaType = 'GAC' | 'IX' | 'HYBRID';

/** Fixed species order used by the sensor channel groups, the twin and the Python mirror. */
export const SPECIES_ORDER: SpeciesId[] = ['PFBA', 'PFBS', 'PFOA', 'PFOS'];

export interface PfasSpeciesConfig {
  id: 'PFOA' | 'PFOS' | 'PFBS' | 'PFBA';
  name: string;
  fullName: string;
  chainType: 'Long-Chain (C8)' | 'Short-Chain (C4)';
  carbonLength: number;
  functionalGroup: 'Carboxylate (-COO⁻)' | 'Sulfonate (-SO₃⁻)';
  epaLimitPpt: number; // Operational SCADA trigger / MCL threshold (ng/L)
  epaRegulationType:
    | 'Binding Federal MCL (4.0 ppt)'
    | 'EPA Hazard Index (HI ≤ 1.0) & 4.0 ppt Trigger'
    | 'UCMR5 Sentinel Tracer & 4.0 ppt Trigger';
  statutoryLimitLabel: string; // Exact legal statutory standard (US EPA April 2024 / EU Jan 2026)
  scadaTriggerNote: string;    // Operational distinction between statutory MCL vs internal early-warning trigger
  epaHbvPpt?: number;  // EPA health-based water concentration used in the Hazard Index (PFBS only among these four)
  euLimitPpt: number;  // ng/L (Sum of 20 PFAS = 100 ng/L)
  defaultC0: number;   // Influent concentration (ppt / ng/L)
  kTh_GAC: number;     // Thomas rate constant in the twin's scaled kinetic units (model assumption, not a literature value)
  q0_GAC: number;      // Clean-water capacity in the same scaled units (model assumption)
  kTh_IX: number;
  q0_IX: number;
  rollupFactorGAC: number; // Testbench roll-up amplitude (fraction of C0 overshoot; assumption)
  rollupFactorIX: number;
  color: string;
  mipCavityAffinity: number; // Assumed MIP binding constant Ka (M^-1); design target, not measured
  pKaHeadgroup: number;      // Approximate headgroup pKa (descriptive only)
}

export const PFAS_SPECIES: Record<'PFOA' | 'PFOS' | 'PFBS' | 'PFBA', PfasSpeciesConfig> = {
  PFBA: {
    id: 'PFBA',
    name: 'PFBA',
    fullName: 'Perfluorobutanoic Acid',
    chainType: 'Short-Chain (C4)',
    carbonLength: 4,
    functionalGroup: 'Carboxylate (-COO⁻)',
    epaLimitPpt: 4.0,
    epaRegulationType: 'UCMR5 Sentinel Tracer & 4.0 ppt Trigger',
    statutoryLimitLabel: 'UCMR5 Sentinel Tracer | EU Sum-20 ≤ 100 ng/L',
    scadaTriggerNote: '4.0 ppt Mid-Bed MTZ Tracer Alert (refines forecast; does not actuate changeout)',
    euLimitPpt: 100.0,
    defaultC0: 28.0,
    // Short-chain PFBA has lowest q0 on GAC -> breaks through earliest & suffers chromatographic roll-up
    kTh_GAC: 0.0024,
    q0_GAC: 485,
    kTh_IX: 0.0021,
    q0_IX: 780,
    rollupFactorGAC: 0.28, // Up to 128% Ct/C0 overshoot due to displacement by PFOS/PFOA & NOM
    rollupFactorIX: 0.16,
    color: '#F59E0B', // Amber warning
    mipCavityAffinity: 4.2e7,
    pKaHeadgroup: 0.4,
  },
  PFBS: {
    id: 'PFBS',
    name: 'PFBS',
    fullName: 'Perfluorobutane Sulfonic Acid',
    chainType: 'Short-Chain (C4)',
    carbonLength: 4,
    functionalGroup: 'Sulfonate (-SO₃⁻)',
    epaLimitPpt: 4.0,
    epaRegulationType: 'EPA Hazard Index (HI ≤ 1.0) & 4.0 ppt Trigger',
    statutoryLimitLabel: 'US EPA Hazard Index HI ≤ 1.0 (HBWC: 2000 ppt)',
    scadaTriggerNote: '4.0 ppt Mid-Bed MTZ Tracer Alert (C4 breakthrough; does not actuate changeout)',
    epaHbvPpt: 2000.0,
    euLimitPpt: 100.0,
    defaultC0: 34.0,
    kTh_GAC: 0.0021,
    q0_GAC: 640,
    kTh_IX: 0.0019,
    q0_IX: 1120,
    rollupFactorGAC: 0.19, // Up to 119% Ct/C0 competitive displacement roll-up
    rollupFactorIX: 0.09,
    color: '#A855F7', // Purple
    mipCavityAffinity: 5.8e7,
    pKaHeadgroup: -3.3,
  },
  PFOA: {
    id: 'PFOA',
    name: 'PFOA',
    fullName: 'Perfluorooctanoic Acid',
    chainType: 'Long-Chain (C8)',
    carbonLength: 8,
    functionalGroup: 'Carboxylate (-COO⁻)',
    epaLimitPpt: 4.0, // Binding EPA April 2024 MCL: 4.0 ppt
    epaRegulationType: 'Binding Federal MCL (4.0 ppt)',
    statutoryLimitLabel: 'US EPA Binding Federal MCL: 4.0 ppt (ng/L)',
    scadaTriggerNote: '4.0 ppt Binding Federal Statutory MCL Threshold',
    euLimitPpt: 100.0,
    defaultC0: 42.0,
    kTh_GAC: 0.0016,
    q0_GAC: 1080,
    kTh_IX: 0.0015,
    q0_IX: 1450,
    rollupFactorGAC: 0.05, // Minimal displacement by PFOS
    rollupFactorIX: 0.03,
    color: '#EF4444', // Crimson
    mipCavityAffinity: 8.9e7,
    pKaHeadgroup: 0.5,
  },
  PFOS: {
    id: 'PFOS',
    name: 'PFOS',
    fullName: 'Perfluorooctane Sulfonic Acid',
    chainType: 'Long-Chain (C8)',
    carbonLength: 8,
    functionalGroup: 'Sulfonate (-SO₃⁻)',
    epaLimitPpt: 4.0, // Binding EPA April 2024 MCL: 4.0 ppt
    epaRegulationType: 'Binding Federal MCL (4.0 ppt)',
    statutoryLimitLabel: 'US EPA Binding Federal MCL: 4.0 ppt (ng/L)',
    scadaTriggerNote: '4.0 ppt Binding Federal Statutory MCL Threshold',
    euLimitPpt: 100.0,
    defaultC0: 48.0,
    kTh_GAC: 0.0014,
    q0_GAC: 1390,
    kTh_IX: 0.0013,
    q0_IX: 1820,
    rollupFactorGAC: 0.0, // Strongest adsorbate (displaces C4 species, does not roll up)
    rollupFactorIX: 0.0,
    color: '#00B4D8', // Xylem Cyan
    mipCavityAffinity: 1.1e8,
    pKaHeadgroup: -3.2,
  },
};
