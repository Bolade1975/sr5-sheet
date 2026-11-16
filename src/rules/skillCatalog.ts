import type { AttributeKey, SkillCategory } from '../domain/schema'

/**
 * Core-rulebook active skills (SR5 pp. 130–147, Active Skill List p. 151).
 * `defaultable` and `group` come from each skill's description block;
 * `null` means the core text gives no explicit "Default:" line, so the app
 * shows "verify" instead of guessing.
 */
export type CatalogSkill = {
  key: string
  name: string
  attribute: AttributeKey
  category: SkillCategory
  group: string | null
  defaultable: boolean | null
  page: string
}

const s = (
  name: string,
  attribute: AttributeKey,
  category: SkillCategory,
  group: string | null,
  defaultable: boolean | null,
  page: string,
): CatalogSkill => ({
  key: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  attribute,
  category,
  group,
  defaultable,
  page,
})

export const SKILL_CATALOG: readonly CatalogSkill[] = [
  // Combat (p. 130–132)
  s('Archery', 'AGI', 'combat', null, true, '130'),
  s('Automatics', 'AGI', 'combat', 'Firearms', true, '130'),
  s('Blades', 'AGI', 'combat', 'Close Combat', true, '130'),
  s('Clubs', 'AGI', 'combat', 'Close Combat', true, '131'),
  s('Exotic Melee Weapon', 'AGI', 'combat', null, null, '151'),
  s('Exotic Ranged Weapon', 'AGI', 'combat', null, false, '131'),
  s('Heavy Weapons', 'AGI', 'combat', null, true, '132'),
  s('Longarms', 'AGI', 'combat', 'Firearms', true, '132'),
  s('Pistols', 'AGI', 'combat', 'Firearms', true, '132'),
  s('Throwing Weapons', 'AGI', 'combat', null, true, '132'),
  s('Unarmed Combat', 'AGI', 'combat', 'Close Combat', true, '132'),
  // Physical (p. 133–135)
  s('Disguise', 'INT', 'physical', 'Stealth', true, '133'),
  s('Diving', 'BOD', 'physical', null, true, '133'),
  s('Escape Artist', 'AGI', 'physical', null, true, '133'),
  s('Free-Fall', 'BOD', 'physical', null, true, '133'),
  s('Gymnastics', 'AGI', 'physical', 'Athletics', true, '133'),
  s('Palming', 'AGI', 'physical', 'Stealth', false, '133'),
  s('Perception', 'INT', 'physical', null, true, '133'),
  s('Running', 'STR', 'physical', 'Athletics', true, '133'),
  s('Sneaking', 'AGI', 'physical', 'Stealth', true, '133'),
  s('Survival', 'WIL', 'physical', 'Outdoors', true, '133'),
  s('Swimming', 'STR', 'physical', 'Athletics', true, '134'),
  s('Tracking', 'INT', 'physical', 'Outdoors', true, '134'),
  // Social (p. 138–139)
  s('Con', 'CHA', 'social', 'Acting', true, '138'),
  s('Etiquette', 'CHA', 'social', 'Influence', true, '138'),
  s('Impersonation', 'CHA', 'social', 'Acting', true, '138'),
  s('Instruction', 'CHA', 'social', null, true, '138'),
  s('Intimidation', 'CHA', 'social', null, true, '139'),
  s('Leadership', 'CHA', 'social', 'Influence', true, '139'),
  s('Negotiation', 'CHA', 'social', 'Influence', true, '139'),
  s('Performance', 'CHA', 'social', 'Acting', true, '139'),
  // Magical (p. 142–143)
  s('Alchemy', 'MAG', 'magical', 'Enchanting', false, '142'),
  s('Arcana', 'LOG', 'magical', null, false, '142'),
  s('Artificing', 'MAG', 'magical', 'Enchanting', false, '142'),
  s('Assensing', 'INT', 'magical', null, false, '142'),
  s('Astral Combat', 'WIL', 'magical', null, false, '142'),
  s('Banishing', 'MAG', 'magical', 'Conjuring', false, '142'),
  s('Binding', 'MAG', 'magical', 'Conjuring', false, '142'),
  s('Counterspelling', 'MAG', 'magical', 'Sorcery', false, '142'),
  s('Disenchanting', 'MAG', 'magical', 'Enchanting', false, '142'),
  s('Ritual Spellcasting', 'MAG', 'magical', 'Sorcery', false, '142'),
  s('Spellcasting', 'MAG', 'magical', 'Sorcery', false, '143'),
  s('Summoning', 'MAG', 'magical', 'Conjuring', false, '143'),
  // Resonance (p. 143)
  s('Compiling', 'RES', 'resonance', 'Tasking', false, '143'),
  s('Decompiling', 'RES', 'resonance', 'Tasking', false, '143'),
  s('Registering', 'RES', 'resonance', 'Tasking', false, '143'),
  // Technical (p. 143–146)
  s('Aeronautics Mechanic', 'LOG', 'technical', 'Engineering', false, '143'),
  s('Animal Handling', 'CHA', 'technical', null, true, '143'),
  s('Armorer', 'LOG', 'technical', null, true, '143'),
  s('Artisan', 'INT', 'technical', null, false, '143'),
  s('Automotive Mechanic', 'LOG', 'technical', 'Engineering', false, '143'),
  s('Biotechnology', 'LOG', 'technical', null, false, '144'),
  s('Chemistry', 'LOG', 'technical', null, false, '144'),
  s('Computer', 'LOG', 'technical', 'Electronics', true, '144'),
  s('Cybercombat', 'LOG', 'technical', 'Cracking', true, '144'),
  s('Cybertechnology', 'LOG', 'technical', 'Biotech', false, '144'),
  s('Demolitions', 'LOG', 'technical', null, true, '144'),
  s('Electronic Warfare', 'LOG', 'technical', 'Cracking', false, '144'),
  s('First Aid', 'LOG', 'technical', 'Biotech', true, '144'),
  s('Forgery', 'LOG', 'technical', null, true, '144'),
  s('Hacking', 'LOG', 'technical', 'Cracking', true, '145'),
  s('Hardware', 'LOG', 'technical', 'Electronics', false, '145'),
  s('Industrial Mechanic', 'LOG', 'technical', 'Engineering', false, '145'),
  s('Locksmith', 'AGI', 'technical', null, false, '145'),
  s('Medicine', 'LOG', 'technical', 'Biotech', false, '145'),
  s('Nautical Mechanic', 'LOG', 'technical', 'Engineering', false, '145'),
  s('Navigation', 'INT', 'technical', 'Outdoors', true, '145'),
  s('Software', 'LOG', 'technical', 'Electronics', false, '145'),
  // Vehicle (p. 146–147)
  s('Gunnery', 'AGI', 'vehicle', null, true, '146'),
  s('Pilot Aerospace', 'REA', 'vehicle', null, false, '146'),
  s('Pilot Aircraft', 'REA', 'vehicle', null, false, '147'),
  s('Pilot Walker', 'REA', 'vehicle', null, false, '147'),
  s('Pilot Exotic Vehicle', 'REA', 'vehicle', null, false, '147'),
  s('Pilot Ground Craft', 'REA', 'vehicle', null, true, '147'),
  s('Pilot Watercraft', 'REA', 'vehicle', null, true, '147'),
]

export const SKILL_GROUPS: readonly string[] = [
  ...new Set(SKILL_CATALOG.flatMap((sk) => (sk.group ? [sk.group] : []))),
].sort()

export function catalogByKey(key: string | null): CatalogSkill | undefined {
  if (key === null) return undefined
  return SKILL_CATALOG.find((sk) => sk.key === key)
}

export function groupMembers(group: string): CatalogSkill[] {
  return SKILL_CATALOG.filter((sk) => sk.group === group)
}
