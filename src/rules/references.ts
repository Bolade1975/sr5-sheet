/**
 * Rule references for automatic calculations. Each entry was checked against
 * the text of the Shadowrun, Fifth Edition core rulebook (CAT27000, printed
 * page numbers). Only verified references belong here — anything else must be
 * a manual field in the UI. `note` records interpretation choices.
 */
export type RuleRef = { book: 'SR5'; page: string; title: string; note?: string }

const r = (page: string, title: string, note?: string): RuleRef =>
  note === undefined ? { book: 'SR5', page, title } : { book: 'SR5', page, title, note }

export const RULES = {
  limitPhysical: r('101', 'Final Calculations: Physical limit [(STR×2)+BOD+REA]/3, round up'),
  limitMental: r('101', 'Final Calculations: Mental limit [(LOG×2)+INT+WIL]/3, round up'),
  limitSocial: r(
    '100–101',
    'Final Calculations: Social limit [(CHA×2)+WIL+Essence]/3, round up',
    'Essence is rounded up before calculating (p. 100).',
  ),
  limitAstral: r('278', 'Astral limit = higher of Mental and Social limit'),
  skillLimitByAttribute: r(
    '47',
    'Inherent limit chosen by the linked attribute (Physical/Mental/Social)',
    'App convention matching the book’s test notation (e.g. Perception + Intuition [Mental], Con + Charisma [Social], Dodge [Physical]). Weapon, Matrix, magic and vehicle skills use gear/Force limits. Change per skill if needed.',
  ),
  unarmedLimit: r('168', 'Unarmed attacks use the Physical limit'),
  limitsUsage: r(
    '47',
    'Limits apply to skill + attribute tests; attribute-only tests have no limit; gear limits replace inherent limits',
  ),
  initiativeTable: r('159', 'Initiative Attribute Chart'),
  initiativeAugment: r('101', 'Final Calculations: add attribute and Initiative Dice bonuses'),
  conditionMonitor: r(
    '101, 169',
    'Physical 8+⌈BOD/2⌉, Stun 8+⌈WIL/2⌉ (bonuses added before calculating)',
  ),
  overflow: r('101', 'Overflow: Body + augmentation bonuses'),
  woundModifiers: r(
    '169–170',
    'Wound modifiers: −1 per 3 boxes per track, cumulative across tracks; also applied to Initiative; not applied to tests that resist damage',
  ),
  armorStacking: r(
    '169',
    'Highest armor counts; "+" accessories add, max bonus = STR; −1 AGI/REA per 2 full points over STR',
  ),
  defense: r('173', 'Defense test: Reaction + Intuition'),
  fullDefense: r('168, 191', 'Full Defense adds Willpower to Defense tests for the Combat Turn'),
  dodge: r('191', 'Dodge: Reaction + Intuition + Gymnastics [Physical]'),
  block: r('191', 'Block uses Unarmed Combat added to the Defense test [Physical]'),
  parry: r('168', 'Parry adds the melee weapon skill to the Defense test'),
  damageResistance: r('173', 'Damage Resistance: Body + Armor (AP modifies armor)'),
  fatigue: r('172', 'Fatigue damage resisted with Body + Willpower, no armor'),
  composure: r('152', 'Composure (CHA + WIL)'),
  judgeIntentions: r('152', 'Judge Intentions (CHA + INT)'),
  memory: r('152', 'Memory (LOG + WIL)'),
  liftCarry: r('152', 'Lifting/Carrying (BOD + STR); carry STR×10 kg, lift STR×15 kg'),
  movement: r('162', 'Movement Table: Walk AGI×2, Run AGI×4'),
  specialization: r('129', 'Specialization: +2 dice when it applies, one at a time'),
  defaulting: r('130', 'Defaulting: attribute only, −1 dice; some skills cannot default'),
  skillList: r('151', 'Active Skill List (linked attributes)'),
  augmentedMax: r('94', 'Augmentation bonus to an attribute is capped at +4'),
  essence: r('52', 'Characters start with Essence 6'),
  matrixInitiative: r('159', 'Matrix AR REA+INT+1D6; cold-sim DP+INT+3D6; hot-sim DP+INT+4D6'),
  matrixCondition: r(
    '228',
    'Matrix Condition Monitor 8 + (Device Rating / 2)',
    'Rounding is not stated; odd Device Ratings need a manual value.',
  ),
  matrixResist: r('228', 'Matrix damage resisted with Device Rating + Firewall'),
  biofeedback: r('229', 'Biofeedback resisted with Willpower + Firewall'),
  riggingInitiative: r(
    '159, 266–267',
    'Rigging AR REA+INT+1D6; jumped in: RCC Data Processing + INT with 3D6 (cold) / 4D6 (hot)',
  ),
  vehicleCondition: r(
    '199',
    'Vehicles 12 + ⌈Body/2⌉; drones 6 + Body/2',
    'Drone rounding is not stated; odd Body needs a manual value.',
  ),
  droneInitiative: r('270', 'Autonomous drone Initiative Pilot×2 + 4D6'),
  astralInitiative: r('159', 'Astral Initiative INT×2 + 2D6'),
  drain: r('279–281', 'Drain resistance: Willpower + tradition attribute'),
  livingPersona: r('251', 'Living Persona: DR=RES, Attack=CHA, Sleaze=INT, DP=LOG, Firewall=WIL'),
  fading: r('251', 'Fading resisted with Resonance + Willpower'),
  knowledgeAttributes: r('151', 'Street/Interests/Language: INT; Academic/Professional: LOG'),
} satisfies Record<string, RuleRef>

export type RuleKey = keyof typeof RULES

export function formatRef(ref: RuleRef): string {
  return `${ref.book} p. ${ref.page}`
}
