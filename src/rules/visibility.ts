import type { AttributeKey, Character } from '../domain/schema'

/** MAG/RES are only shown when relevant (module active or a value entered). */
export function attributeVisible(key: AttributeKey, c: Character): boolean {
  if (key === 'MAG') return c.modules.magic || c.attributes.MAG.base !== null
  if (key === 'RES') return c.modules.technomancer || c.attributes.RES.base !== null
  return true
}
