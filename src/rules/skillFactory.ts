import { newId } from '../domain/factory'
import type { Skill } from '../domain/schema'
import { SKILL_CATALOG } from './skillCatalog'

export function makeSkillFromCatalog(key: string): Skill {
  const cat = SKILL_CATALOG.find((s) => s.key === key)!
  return {
    id: newId(),
    name: cat.name,
    catalogKey: cat.key,
    attribute: cat.attribute,
    rating: null,
    groupId: null,
    category: cat.category,
    specializations: [],
    defaultable: cat.defaultable,
    limit: 'auto',
    favorite: false,
    source: `SR5 p. ${cat.page}`,
    notes: '',
  }
}
