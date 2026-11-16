import { z } from 'zod'

/**
 * Character data model — single source of truth for types, import validation
 * and defaults. Every field has a default so older/partial records parse into
 * a complete character (forward-compatible). Bump CHARACTER_SCHEMA_VERSION and
 * add a step to migrations.ts whenever a change needs more than a default.
 *
 * Convention: numeric values the player has not entered are `null`, never 0,
 * so calculations can report "missing input" instead of a misleading total.
 */
export const CHARACTER_SCHEMA_VERSION = 1

const id = z.string().min(1)
const str = z.string().default('')
const int = z.number().int()
const nInt = int.nullable().default(null)
const num = z.number()
const nNum = num.nullable().default(null)
const bool = (d: boolean) => z.boolean().default(d)

export const ATTRIBUTE_KEYS = [
  'BOD',
  'AGI',
  'REA',
  'STR',
  'WIL',
  'LOG',
  'INT',
  'CHA',
  'EDG',
  'MAG',
  'RES',
] as const
export const AttributeKey = z.enum(ATTRIBUTE_KEYS)
export type AttributeKey = z.infer<typeof AttributeKey>

export const AttributeSchema = z.object({
  /** Natural rating (metatype + Karma), without augmentations. */
  base: nInt,
  notes: str,
})

const attributesShape = Object.fromEntries(
  ATTRIBUTE_KEYS.map((k) => [k, AttributeSchema.prefault({})]),
) as Record<AttributeKey, z.ZodPrefault<typeof AttributeSchema>>
export const AttributesSchema = z.object(attributesShape)

/**
 * A named bonus/penalty. `kind` decides when it counts:
 *  - permanent: always applied (cyberware, qualities, adept powers)
 *  - situational: applied only while `active` (toggled on the Play dashboard)
 *  - conditional: never added automatically; shown as a reminder next to the
 *    pools it targets ("+2 when …"), so it can't be double counted.
 */
export const ModifierKind = z.enum(['permanent', 'situational', 'conditional'])
export const ModifierSchema = z.object({
  id,
  name: str,
  value: int.default(0),
  kind: ModifierKind.default('permanent'),
  active: bool(false),
  /** Target keys, see rules/targets.ts (e.g. "attr:REA", "pool:defense", "skill:<id>"). */
  targets: z.array(z.string()).default([]),
  condition: str,
  source: str,
  notes: str,
})
export type Modifier = z.infer<typeof ModifierSchema>

export const SkillCategory = z.enum([
  'combat',
  'physical',
  'social',
  'magical',
  'resonance',
  'technical',
  'vehicle',
  'other',
])
export type SkillCategory = z.infer<typeof SkillCategory>

export const LimitChoice = z.enum([
  'auto',
  'physical',
  'mental',
  'social',
  'astral',
  'gear',
  'none',
])
export type LimitChoice = z.infer<typeof LimitChoice>

export const SkillSchema = z.object({
  id,
  name: str,
  /** Key into the built-in core skill catalog, or null for custom skills. */
  catalogKey: z.string().nullable().default(null),
  attribute: AttributeKey.default('AGI'),
  rating: nInt,
  /** If set and the group exists, the group's rating is used. */
  groupId: z.string().nullable().default(null),
  category: SkillCategory.default('other'),
  specializations: z.array(z.string()).default([]),
  /** true/false from the rulebook; null = not verified, the UI asks to check. */
  defaultable: z.boolean().nullable().default(null),
  limit: LimitChoice.default('auto'),
  favorite: bool(false),
  source: str,
  notes: str,
})
export type Skill = z.infer<typeof SkillSchema>

export const SkillGroupSchema = z.object({ id, name: str, rating: nInt, notes: str })
export type SkillGroup = z.infer<typeof SkillGroupSchema>

export const KnowledgeType = z.enum(['street', 'academic', 'professional', 'interests'])
export const KnowledgeSkillSchema = z.object({
  id,
  name: str,
  type: KnowledgeType.default('street'),
  rating: nInt,
  specializations: z.array(z.string()).default([]),
  notes: str,
})
export type KnowledgeSkill = z.infer<typeof KnowledgeSkillSchema>

export const LanguageSchema = z.object({
  id,
  name: str,
  native: bool(false),
  rating: nInt,
  specializations: z.array(z.string()).default([]),
  notes: str,
})
export type Language = z.infer<typeof LanguageSchema>

export const QualitySchema = z.object({
  id,
  name: str,
  type: z.enum(['positive', 'negative']).default('positive'),
  karma: nInt,
  rating: nInt,
  source: str,
  notes: str,
})
export type Quality = z.infer<typeof QualitySchema>

export const RangedWeaponSchema = z.object({
  id,
  name: str,
  skillId: z.string().nullable().default(null),
  accuracy: nInt,
  damage: str,
  ap: str,
  mode: str,
  rc: str,
  ammoCapacity: nInt,
  ammoCurrent: nInt,
  ammoType: str,
  /** Spare clips / rounds carried, free text e.g. "3 clips regular, 1 APDS". */
  ammoSpare: str,
  active: bool(false),
  source: str,
  notes: str,
})
export type RangedWeapon = z.infer<typeof RangedWeaponSchema>

export const MeleeWeaponSchema = z.object({
  id,
  name: str,
  skillId: z.string().nullable().default(null),
  reach: nInt,
  accuracy: nInt,
  damage: str,
  ap: str,
  active: bool(false),
  source: str,
  notes: str,
})
export type MeleeWeapon = z.infer<typeof MeleeWeaponSchema>

export const ArmorSchema = z.object({
  id,
  name: str,
  rating: nInt,
  /** Armor accessories ("+" rating, p. 169) add to the highest armor. */
  accessory: bool(false),
  equipped: bool(false),
  source: str,
  notes: str,
})
export type Armor = z.infer<typeof ArmorSchema>

export const GearSchema = z.object({
  id,
  name: str,
  rating: nInt,
  quantity: nInt,
  category: str,
  source: str,
  notes: str,
})
export type Gear = z.infer<typeof GearSchema>

export const AugmentationSchema = z.object({
  id,
  name: str,
  type: z.enum(['cyberware', 'bioware', 'other']).default('cyberware'),
  grade: str,
  rating: nInt,
  essence: nNum,
  source: str,
  notes: str,
})
export type Augmentation = z.infer<typeof AugmentationSchema>

export const ContactSchema = z.object({
  id,
  name: str,
  archetype: str,
  connection: nInt,
  loyalty: nInt,
  favor: str,
  notes: str,
})
export type Contact = z.infer<typeof ContactSchema>

export const SinSchema = z.object({ id, name: str, rating: nInt, fake: bool(true), notes: str })
export const LicenseSchema = z.object({
  id,
  name: str,
  rating: nInt,
  sinId: z.string().nullable().default(null),
  notes: str,
})
export const LifestyleSchema = z.object({
  id,
  name: str,
  level: str,
  monthlyCost: nInt,
  monthsPaid: nInt,
  primary: bool(false),
  notes: str,
})

export const LedgerEntrySchema = z.object({
  id,
  date: str,
  currency: z.enum(['karma', 'nuyen']).default('karma'),
  amount: int.default(0),
  description: str,
})
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>

export const PoolPartSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attribute'), key: AttributeKey }),
  z.object({ kind: z.literal('skill'), skillId: z.string() }),
  z.object({ kind: z.literal('constant'), value: int, label: str }),
])
export type PoolPart = z.infer<typeof PoolPartSchema>

/** User-defined pool built from structured parts (never evaluated text). */
export const CustomPoolSchema = z.object({
  id,
  name: str,
  parts: z.array(PoolPartSchema).default([]),
  limit: z.enum(['none', 'physical', 'mental', 'social', 'astral', 'custom']).default('none'),
  customLimit: nInt,
  applyWounds: bool(true),
  conditions: str,
  favorite: bool(false),
})
export type CustomPool = z.infer<typeof CustomPoolSchema>

// ---------- Special modules ----------

export const VehicleSchema = z.object({
  id,
  name: str,
  kind: z.enum(['vehicle', 'drone']).default('drone'),
  handling: str,
  speed: str,
  acceleration: str,
  body: nInt,
  armor: nInt,
  pilot: nInt,
  sensor: nInt,
  seats: nInt,
  damage: int.default(0),
  matrixDamage: int.default(0),
  /** Device rating for the Matrix condition monitor (often equal to Pilot). */
  deviceRating: nInt,
  mods: str,
  weapons: str,
  sensors: str,
  ammo: str,
  active: bool(false),
  source: str,
  notes: str,
})
export type Vehicle = z.infer<typeof VehicleSchema>

export const AutosoftSchema = z.object({
  id,
  name: str,
  rating: nInt,
  skill: str,
  /** Vehicle ids the autosoft is installed on / RCC-shared when empty. */
  vehicleIds: z.array(z.string()).default([]),
  sharedOnRcc: bool(false),
  notes: str,
})

export const RiggerSchema = z.object({
  controlRig: nInt,
  rcc: z
    .object({
      name: str,
      deviceRating: nInt,
      dataProcessing: nInt,
      firewall: nInt,
      noiseReduction: nInt,
      sharing: nInt,
      matrixDamage: int.default(0),
      notes: str,
    })
    .prefault({}),
  vehicles: z.array(VehicleSchema).default([]),
  autosofts: z.array(AutosoftSchema).default([]),
  notes: str,
})

export const MatrixDeviceSchema = z.object({
  id,
  name: str,
  type: z.enum(['commlink', 'cyberdeck', 'other']).default('cyberdeck'),
  deviceRating: nInt,
  attack: nInt,
  sleaze: nInt,
  dataProcessing: nInt,
  firewall: nInt,
  programSlots: nInt,
  matrixDamage: int.default(0),
  active: bool(false),
  notes: str,
})
export type MatrixDevice = z.infer<typeof MatrixDeviceSchema>

export const ProgramSchema = z.object({
  id,
  name: str,
  type: z.enum(['common', 'hacking', 'other']).default('common'),
  loaded: bool(false),
  notes: str,
})

export const MatrixSchema = z.object({
  devices: z.array(MatrixDeviceSchema).default([]),
  programs: z.array(ProgramSchema).default([]),
  notes: str,
})

export const SpellSchema = z.object({
  id,
  name: str,
  category: str,
  type: z.enum(['P', 'M', '']).default(''),
  range: str,
  duration: str,
  drain: str,
  isRitual: bool(false),
  source: str,
  notes: str,
})
export const PreparationSchema = z.object({
  id,
  name: str,
  force: nInt,
  trigger: str,
  potency: nInt,
  notes: str,
})
export const AdeptPowerSchema = z.object({
  id,
  name: str,
  level: nInt,
  powerPoints: nNum,
  source: str,
  notes: str,
})
export const FocusSchema = z.object({
  id,
  name: str,
  type: str,
  force: nInt,
  bonded: bool(true),
  active: bool(false),
  notes: str,
})
export const SpiritSchema = z.object({
  id,
  type: str,
  force: nInt,
  services: nInt,
  bound: bool(false),
  notes: str,
})

export const MagicSchema = z.object({
  awakenedType: z
    .enum(['magician', 'adept', 'mysticAdept', 'aspectedMagician', 'other'])
    .default('magician'),
  tradition: str,
  /** The attribute added to Willpower for Drain (tradition-defined, p. 279). */
  drainAttribute: AttributeKey.nullable().default(null),
  mentorSpirit: str,
  initiateGrade: nInt,
  metamagics: str,
  powerPointsTotal: nNum,
  spells: z.array(SpellSchema).default([]),
  preparations: z.array(PreparationSchema).default([]),
  adeptPowers: z.array(AdeptPowerSchema).default([]),
  foci: z.array(FocusSchema).default([]),
  spirits: z.array(SpiritSchema).default([]),
  notes: str,
})

export const ComplexFormSchema = z.object({
  id,
  name: str,
  target: str,
  duration: str,
  fading: str,
  source: str,
  notes: str,
})
export const SpriteSchema = z.object({
  id,
  type: str,
  level: nInt,
  tasks: nInt,
  registered: bool(false),
  notes: str,
})
export const TechnomancerSchema = z.object({
  submersionGrade: nInt,
  echoes: str,
  complexForms: z.array(ComplexFormSchema).default([]),
  sprites: z.array(SpriteSchema).default([]),
  notes: str,
})

export const MatrixMode = z.enum(['ar', 'coldVR', 'hotVR'])
export type MatrixMode = z.infer<typeof MatrixMode>

export const CharacterSchema = z.object({
  id,
  schemaVersion: int.default(CHARACTER_SCHEMA_VERSION),
  /** Marks built-in demo data so it can never be mistaken for a real character. */
  isExample: bool(false),
  createdAt: str,
  updatedAt: str,
  identity: z
    .object({
      name: str,
      alias: str,
      player: str,
      metatype: str,
      ethnicity: str,
      age: str,
      sex: str,
      height: str,
      weight: str,
      description: str,
      /** Data URL (downscaled JPEG) or empty. */
      portrait: str,
    })
    .prefault({}),
  modules: z
    .object({
      rigger: bool(false),
      decker: bool(false),
      magic: bool(false),
      technomancer: bool(false),
    })
    .prefault({}),
  attributes: AttributesSchema.prefault({}),
  /** Manual essence adjustment beyond listed augmentations (e.g. holes), usually negative. */
  essenceAdjustment: num.default(0),
  modifiers: z.array(ModifierSchema).default([]),
  /** Manual overrides of derived values, keyed by derived id (see rules/derivedIds.ts). */
  overrides: z.record(z.string(), num).default({}),
  skills: z.array(SkillSchema).default([]),
  skillGroups: z.array(SkillGroupSchema).default([]),
  knowledgeSkills: z.array(KnowledgeSkillSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  qualities: z.array(QualitySchema).default([]),
  rangedWeapons: z.array(RangedWeaponSchema).default([]),
  meleeWeapons: z.array(MeleeWeaponSchema).default([]),
  armor: z.array(ArmorSchema).default([]),
  gear: z.array(GearSchema).default([]),
  augmentations: z.array(AugmentationSchema).default([]),
  contacts: z.array(ContactSchema).default([]),
  sins: z.array(SinSchema).default([]),
  licenses: z.array(LicenseSchema).default([]),
  lifestyles: z.array(LifestyleSchema).default([]),
  reputation: z.object({ streetCred: nInt, notoriety: nInt, publicAwareness: nInt }).prefault({}),
  resources: z.object({ nuyen: nInt, karma: nInt, karmaTotal: nInt }).prefault({}),
  ledger: z.array(LedgerEntrySchema).default([]),
  customPools: z.array(CustomPoolSchema).default([]),
  /** Ids of built-in pools pinned to the Play dashboard. */
  favoritePools: z.array(z.string()).default(['defense', 'damageResistance', 'perception']),
  /** Live play state — never changes base data. */
  play: z
    .object({
      physicalDamage: int.default(0),
      stunDamage: int.default(0),
      overflowDamage: int.default(0),
      edgeSpent: int.default(0),
      matrixMode: MatrixMode.default('ar'),
      fullDefense: bool(false),
      /** Initiative modes shown on the dashboard. */
      notes: str,
    })
    .prefault({}),
  rigger: RiggerSchema.prefault({}),
  matrix: MatrixSchema.prefault({}),
  magic: MagicSchema.prefault({}),
  technomancer: TechnomancerSchema.prefault({}),
  background: str,
  notes: str,
})
export type Character = z.infer<typeof CharacterSchema>
export type CharacterInput = z.input<typeof CharacterSchema>
