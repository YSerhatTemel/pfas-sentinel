export interface GlossaryTerm {
  term: string;
  meaning: string;
  whyItMatters: string;
}

export interface GlossaryGroup {
  group: string;
  terms: GlossaryTerm[];
}

/**
 * Key terms used across the demo, explained in full rather than simplified away.
 * Mirrored in README.md ("Key terms, explained") — keep both in sync.
 */
export const GLOSSARY: GlossaryGroup[] = [
  {
    group: 'Water treatment',
    terms: [
      {
        term: 'PFAS (short-chain C4 vs long-chain C8)',
        meaning:
          'Per- and polyfluoroalkyl substances, "forever chemicals". The number is the length of the carbon chain: PFBA/PFBS have 4 carbons, PFOA/PFOS have 8.',
        whyItMatters:
          'Short chains stick to carbon weakly and move through the filter first; long chains stick strongly and are the ones the US limit (4 ppt) targets.',
      },
      {
        term: 'GAC / Selective IX',
        meaning:
          'Granular activated carbon and selective ion-exchange resin: the two main media used in pressure vessels to remove PFAS from drinking water.',
        whyItMatters:
          'Both get "used up" over time and must be replaced; replacing too early wastes money and creates hazardous waste.',
      },
      {
        term: 'Lead-lag train',
        meaning:
          'Two vessels in series. The lead vessel does most of the work; the lag vessel polishes and acts as a safety barrier.',
        whyItMatters:
          'When the lead vessel is spent, valves swap the roles and only the lead media is replaced. Timing this swap is the decision PFAS-Sentinel supports.',
      },
      {
        term: 'Mid-bed port (z/L = 0.50)',
        meaning:
          'A sampling tap halfway down the vessel. z is the depth from the top, L the total bed depth, so z/L = 0.50 is the middle.',
        whyItMatters:
          'Contaminants reach the middle months before the outlet, so a reading here is an early look at what the outlet will see later.',
      },
      {
        term: 'Mass Transfer Zone (MTZ)',
        meaning:
          'The band of media that is actively adsorbing. Above it the media is saturated; below it the media is still clean.',
        whyItMatters:
          'The MTZ moves down the bed like a slow wave. Tracking its position is what lets the twin forecast when the outlet will exceed the limit.',
      },
      {
        term: 'Breakthrough & Bed Volumes (BV)',
        meaning:
          'Breakthrough is when a contaminant starts appearing at the outlet. One bed volume is the amount of water equal to the volume of the media bed.',
        whyItMatters:
          'Bed volumes let results from columns of different sizes be compared; the literature reports PFAS breakthrough in BV.',
      },
      {
        term: 'Chromatographic roll-up (Cₜ > C₀)',
        meaning:
          'Strongly held long-chain PFAS push weakly held short-chain PFAS back off the carbon, so the outlet can briefly carry more short-chain PFAS than the inlet.',
        whyItMatters:
          'Grab samples taken every few weeks can miss these spikes completely; continuous mid-bed data can see them coming.',
      },
      {
        term: 'MCL / Hazard Index',
        meaning:
          'Maximum Contaminant Level: the legal limit in drinking water (4.0 ppt for PFOA and PFOS in the US). The Hazard Index is a combined score for a PFAS mixture.',
        whyItMatters:
          'EPA has proposed to keep the PFOA/PFOS MCLs and rescind the Hazard Index (not final as of September 2026), so PFOA/PFOS are the targets that drive actuation in this design.',
      },
      {
        term: 'LC-MS/MS (EPA Method 533 / 537.1)',
        meaning:
          'Liquid chromatography with tandem mass spectrometry: the certified laboratory method for measuring PFAS at parts-per-trillion levels.',
        whyItMatters:
          'It is accurate but slow and costly (the project assumes 10–14 days and $300–$500 per sample, to be confirmed with labs). PFAS-Sentinel keeps it for compliance and adds continuous data in between.',
      },
      {
        term: 'RSSCT',
        meaning:
          'Rapid Small-Scale Column Test: a lab column filled with crushed media that reproduces months of full-scale operation in days or weeks.',
        whyItMatters:
          'It is the planned TRL 5 step for testing the sensor cartridge and the twin on real breakthrough curves without a full-scale plant.',
      },
    ],
  },
  {
    group: 'Sensor',
    terms: [
      {
        term: 'MIP / NIP',
        meaning:
          'A molecularly imprinted polymer has cavities shaped like the target molecule, so PFAS fit in and most other molecules do not. A non-imprinted polymer (NIP) is the same material without the cavities.',
        whyItMatters:
          'The NIP picks up everything except specific PFAS binding, so subtracting NIP from MIP removes background signal from organic matter and salts.',
      },
      {
        term: 'EIS & ΔRct',
        meaning:
          'Electrochemical impedance spectroscopy measures how easily charge passes through the electrode surface. Rct is the charge-transfer resistance.',
        whyItMatters:
          'When PFAS fill the MIP cavities they block a redox probe, Rct rises, and that change (ΔRct) is converted into a concentration.',
      },
      {
        term: '4×4 Tikhonov deconvolution',
        meaning:
          'A matrix calculation that separates four overlapping signals (PFBA, PFBS, PFOA, PFOS), because each sensor channel responds a little to all four. Tikhonov regularization keeps the answer stable when the data is noisy.',
        whyItMatters:
          'Without it, a high PFOS level could be misread as PFOA, which would distort the forecast.',
      },
      {
        term: 'fDOM / NOM',
        meaning:
          'Natural organic matter (NOM) is dissolved material from soil and plants. fDOM is its fluorescent part, measured optically by the YSI EXO2 sonde.',
        whyItMatters:
          'NOM competes with PFAS for carbon and fouls sensors; the fDOM reading lets both the sensor and the twin correct for it.',
      },
      {
        term: 'Debye length',
        meaning:
          'The thin layer near a charged surface where ions in the water screen the charge (Gouy-Chapman theory). It shrinks as the water gets saltier.',
        whyItMatters:
          'It changes how strongly charged PFAS are attracted to the electrode, so the edge estimator corrects for conductivity (learned from calibration runs).',
      },
    ],
  },
  {
    group: 'Digital twin & business',
    terms: [
      {
        term: 'Breakthrough twin (and the PINN-style option)',
        meaning:
          'The twin uses the travelling-wave (Thomas) solution of the 1D advection-sorption equation and learns two bed-condition factors (capacity and kinetics) shared by all four PFAS. A physics-informed neural network (PINN-style) correction was also built and tested.',
        whyItMatters:
          'Sharing the bed condition lets early PFBA/PFBS data improve the PFOA/PFOS forecast, but only for effects that act on all four species alike (the biggest gain in the synthetic ablation; limits in README Section 5). The PINN-style correction helps only with the PDE penalty and gives a small further gain on the testbench, so it is offered as an option; the 2-parameter model stays the default for decisions.',
      },
      {
        term: 'Uncertainty band (±days)',
        meaning:
          'Parameter uncertainty plus a model-form term that grows with the distance from the last data point. Nominal 95%; on held-out synthetic plants it covered the true breach about 91% of the time.',
        whyItMatters:
          'Actuation uses the early end of the band (breach day minus band), so uncertainty makes the system act earlier, not later. It is a decision aid, not a certified interval.',
      },
      {
        term: 'Early-warning system (EWS) and interlocks',
        meaning:
          'Software steps that read data, forecast, decide and prepare actions (valve rotation, service order). Three computed interlocks (sonde heartbeat, electrode agreement, pressure drop) and operator sign-off must pass before anything moves; every action is logged.',
        whyItMatters:
          'It turns a forecast into a scheduled action instead of a chart someone must remember to check.',
      },
      {
        term: 'Servitization',
        meaning:
          'Selling an outcome as a service (here a per-vessel subscription with cartridges included) instead of selling equipment up front.',
        whyItMatters:
          'Utilities avoid capital cost and pay from the media savings; Xylem gains recurring revenue alongside Evoqua media service.',
      },
      {
        term: 'TRL (Technology Readiness Level)',
        meaning:
          'A 1–9 scale of maturity: TRL 3 is a proof of concept, TRL 4 lab validation, TRL 5 validation in a relevant environment, TRL 6 a prototype demonstrated in that environment.',
        whyItMatters:
          'PFAS-Sentinel is at TRL 2–3 (simulation); the 12-month roadmap targets TRL 6.',
      },
    ],
  },
];
