import type { MunicipalDecisionPlan } from '../types/decision';

export const SAMPLE_DECISION_PLANS: Record<string, MunicipalDecisionPlan> = {
  mahinigam: {
    id: 'decision_mahinigam_curated',
    username: 'mahinigam',
    generatedAt: Date.now() - 3600000,
    model: 'gemini-2.0-flash',
    citySummary: {
      civicTitle: 'Mahinigam Solarium Metropolis',
      foundingMotto: 'Harmonizing Intelligent Agents with Systems Reliability',
      developerArchetype: 'The Distributed Systems Engineer',
      vitalityAssessment: 98,
      climateRationale: 'Sustained velocity across generative systems, automated testing, and risk control repositories.',
      suggestedWeather: 'clear',
      suggestedTimeOfDay: 14.5,
    },
    districts: [
      {
        repoName: 'ai-risk-manager',
        assignedZone: 'cybernetics_ai_biosphere',
        civicCritique: {
          prosperityScore: 88,
          fulfillmentScore: 92,
          municipalRole: 'Autonomous AI Risk & Safety Observatory',
          architecturalFeatures: ['Reinforced Neural Bastion', 'Continuous Audit Beacon', 'Active Risk Chamber'],
          urbanPlanningRationale: 'Anchored on the northern biosphere overlooking high-frequency inference corridors.',
        },
      },
      {
        repoName: 'aether',
        assignedZone: 'civic_arts_district',
        civicCritique: {
          prosperityScore: 84,
          fulfillmentScore: 86,
          municipalRole: 'Central Cybernetic Command Terminal',
          architecturalFeatures: ['Dual Neon Glazed Spires', 'Glass Solarium Atrium', 'Fiber Routing Spire'],
          urbanPlanningRationale: 'Front-facing command center bridging AI models with citizen user interfaces.',
        },
      },
      {
        repoName: 'breakpoint',
        assignedZone: 'logistics_cloud_docks',
        civicCritique: {
          prosperityScore: 78,
          fulfillmentScore: 82,
          municipalRole: 'Automated Diagnostic & Debugging Depository',
          architecturalFeatures: ['Brutalist Test Bunkers', 'Telemetry Monitoring Rig', 'Signal Flare Mast'],
          urbanPlanningRationale: 'Positioned adjacent to cloud corridors for real-time fault isolation.',
        },
      },
      {
        repoName: 'atlas-intelligence',
        assignedZone: 'downtown_financial_core',
        civicCritique: {
          prosperityScore: 90,
          fulfillmentScore: 88,
          municipalRole: 'High-Dimensional Knowledge Graph Treasury',
          architecturalFeatures: ['Ivory Classical Colonnade', 'Gold Plinth Curb', 'Geodesic Data Vault'],
          urbanPlanningRationale: 'The intellectual flagship anchor of downtown ring 1.',
        },
      },
    ],
    interDistrictConnections: [
      {
        sourceRepo: 'ai-risk-manager',
        targetRepo: 'aether',
        connectionType: 'hyperloop_arterial',
        synergyReason: 'Aether serves as the real-time telemetry dashboard for AI risk policies.',
        bandwidthWeight: 5,
      },
      {
        sourceRepo: 'breakpoint',
        targetRepo: 'ai-risk-manager',
        connectionType: 'elevated_rail',
        synergyReason: 'Automated test suite feeding crash and error vectors into risk classifiers.',
        bandwidthWeight: 4,
      },
      {
        sourceRepo: 'atlas-intelligence',
        targetRepo: 'aether',
        connectionType: 'pedestrian_boulevard',
        synergyReason: 'Shared cognitive intelligence visualization layer.',
        bandwidthWeight: 3,
      },
    ],
    historicalChronicles: [
      {
        epochName: 'The Genesis of Autonomous Intelligence',
        timeRange: '2022 - 2023',
        narrative: 'Foundational models and data infrastructure were laid, giving rise to the central downtown ring.',
        monument: {
          name: 'The Pillar of Algorithmic Genesis',
          era: 'First Code Push',
          lore: 'Dedicated to the first neural pipelines that initiated the living metropolis.',
          monumentType: 'obelisk',
        },
      },
      {
        epochName: 'The Great Architectural Refactor',
        timeRange: '2023 - 2024',
        narrative: 'Monoliths were disassembled into specialized microservices, accompanied by strict risk governance.',
        monument: {
          name: 'The Arch of Modular Harmony',
          era: 'Polyglot Scaling',
          lore: 'Erected when core systems achieved zero-downtime resilience.',
          monumentType: 'triumphal_arch',
        },
      },
      {
        epochName: 'The Era of Distributed Autonomous Agents',
        timeRange: '2024 - Present',
        narrative: 'Multi-agent orchestration and human-in-the-loop interfaces unlocked nationwide civic prosperity.',
        monument: {
          name: 'The Spire of the Digital Horizon',
          era: 'Contemporary Metropolis',
          lore: 'Broadcasting telemetry and synchronized commuter transit across all coastal districts.',
          monumentType: 'beacon_spire',
        },
      },
    ],
  },
};
