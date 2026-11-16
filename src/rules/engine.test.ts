import { describe, expect, it } from 'vitest'
import { newCharacter, newId } from '../domain/factory'
import type { AttributeKey, Character, Modifier, Skill } from '../domain/schema'
import {
  armorValue,
  attribute,
  conditionMonitor,
  essence,
  initiative,
  limit,
  matrixMonitor,
  movement,
  overflow,
  vehicleMonitor,
  woundModifier,
} from './engine'
import { customPool, generalPools, rangedWeaponPool, skillPool } from './pools'
import { catalogByKey } from './skillCatalog'

function char(attrs: Partial<Record<AttributeKey, number>>): Character {
  const c = newCharacter('Test')
  for (const [k, v] of Object.entries(attrs)) c.attributes[k as AttributeKey].base = v
  return c
}

function mod(partial: Partial<Modifier> & { targets: string[]; value: number }): Modifier {
  return {
    id: newId(),
    name: 'Mod',
    kind: 'permanent',
    active: false,
    condition: '',
    source: '',
    notes: '',
    ...partial,
  }
}

function skill(c: Character, key: string, rating: number | null, specs: string[] = []): Skill {
  const cat = catalogByKey(key)!
  const s: Skill = {
    id: newId(),
    name: cat.name,
    catalogKey: key,
    attribute: cat.attribute,
    rating,
    groupId: null,
    category: cat.category,
    specializations: specs,
    defaultable: cat.defaultable,
    limit: 'auto',
    favorite: false,
    source: '',
    notes: '',
  }
  c.skills.push(s)
  return s
}

const ALL = { BOD: 4, AGI: 5, REA: 3, STR: 3, WIL: 3, LOG: 4, INT: 5, CHA: 2, EDG: 2 }

describe('limits (p. 101)', () => {
  it('rounds up the physical and mental limits', () => {
    const c = char(ALL)
    // (3*2 + 4 + 3)/3 = 13/3 = 4.33 -> 5
    expect(limit(c, 'physical').value).toBe(5)
    // (4*2 + 5 + 3)/3 = 16/3 -> 6
    expect(limit(c, 'mental').value).toBe(6)
  })

  it('rounds Essence up before calculating the social limit (p. 100)', () => {
    const c = char(ALL)
    c.augmentations.push({
      id: newId(),
      name: 'Ware',
      type: 'cyberware',
      grade: '',
      rating: null,
      essence: 0.5,
      source: '',
      notes: '',
    })
    expect(essence(c).value).toBe(5.5)
    // (2*2 + 3 + ceil(5.5)=6)/3 = 13/3 -> 5
    expect(limit(c, 'social').value).toBe(5)
  })

  it('uses augmented attributes and adds limit modifiers after rounding', () => {
    const c = char(ALL)
    c.modifiers.push(mod({ targets: ['attr:STR'], value: 2 }))
    // (5*2 + 4 + 3)/3 = 17/3 -> 6
    expect(limit(c, 'physical').value).toBe(6)
    c.modifiers.push(mod({ targets: ['limit:physical'], value: 1 }))
    expect(limit(c, 'physical').value).toBe(7)
  })

  it('returns null (not 0) when an attribute is missing', () => {
    const c = char({ BOD: 4, REA: 3 })
    const l = limit(c, 'physical')
    expect(l.value).toBeNull()
    expect(l.missing).toContain('Strength')
  })

  it('astral limit is the higher of mental and social (p. 278)', () => {
    const c = char(ALL)
    expect(limit(c, 'astral').value).toBe(6)
  })
})

describe('attributes', () => {
  it('caps augmentation bonuses at +4 for physical/mental attributes (p. 94)', () => {
    const c = char(ALL)
    c.modifiers.push(
      mod({ targets: ['attr:AGI'], value: 3 }),
      mod({ targets: ['attr:AGI'], value: 3 }),
    )
    const a = attribute(c, 'AGI')
    expect(a.capped).toBe(true)
    expect(a.current).toBe(9)
  })

  it('situational modifiers only count while active; conditional never auto-applies', () => {
    const c = char(ALL)
    const sit = mod({ targets: ['attr:REA'], value: 2, kind: 'situational' })
    c.modifiers.push(
      sit,
      mod({ targets: ['attr:REA'], value: 5, kind: 'conditional', condition: 'never' }),
    )
    expect(attribute(c, 'REA').current).toBe(3)
    sit.active = true
    expect(attribute(c, 'REA').current).toBe(5)
    expect(attribute(c, 'REA').conditional).toHaveLength(1)
  })
})

describe('armor (p. 169)', () => {
  it('uses the highest armor plus accessories and applies encumbrance', () => {
    const c = char(ALL) // STR 3
    c.armor.push(
      {
        id: newId(),
        name: 'Jacket',
        rating: 12,
        accessory: false,
        equipped: true,
        source: '',
        notes: '',
      },
      {
        id: newId(),
        name: 'Vest',
        rating: 9,
        accessory: false,
        equipped: true,
        source: '',
        notes: '',
      },
      {
        id: newId(),
        name: 'Shield',
        rating: 6,
        accessory: true,
        equipped: true,
        source: '',
        notes: '',
      },
      {
        id: newId(),
        name: 'Unworn',
        rating: 20,
        accessory: false,
        equipped: false,
        source: '',
        notes: '',
      },
    )
    // accessories 6 > STR 3: counted bonus limited to 3; excess 3 -> -1 AGI/REA
    expect(armorValue(c).value).toBe(15)
    expect(attribute(c, 'AGI').current).toBe(4)
    expect(attribute(c, 'REA').current).toBe(2)
  })
})

describe('condition monitors & wounds (p. 169–170)', () => {
  it('computes 8 + ceil(attr/2) with augmented attributes', () => {
    const c = char(ALL)
    expect(conditionMonitor(c, 'physical').value).toBe(10)
    expect(conditionMonitor(c, 'stun').value).toBe(10) // WIL 3 -> ceil 1.5 = 2
    c.modifiers.push(mod({ targets: ['attr:BOD'], value: 1 }))
    expect(conditionMonitor(c, 'physical').value).toBe(11)
    expect(overflow(c).value).toBe(5)
  })

  it('wound modifiers are cumulative across tracks', () => {
    const c = char(ALL)
    c.play.physicalDamage = 4
    c.play.stunDamage = 6
    expect(woundModifier(c).value).toBe(-3)
  })

  it('applies wounds to action tests and initiative but not to damage resistance', () => {
    const c = char(ALL)
    c.play.physicalDamage = 3
    const pools = generalPools(c)
    expect(pools.find((p) => p.id === 'pool.defense')!.value).toBe(7) // 3+5-1
    expect(pools.find((p) => p.id === 'pool.damageResistance')!.value).toBe(4)
    expect(initiative(c, 'physical').score.value).toBe(7)
  })
})

describe('initiative (p. 159)', () => {
  it('physical uses REA+INT with dice bonuses', () => {
    const c = char(ALL)
    c.modifiers.push(mod({ targets: ['attr:REA', 'initDice:physical'], value: 1 }))
    const i = initiative(c, 'physical')
    expect(i.score.value).toBe(9)
    expect(i.dice.value).toBe(2)
  })

  it('astral is INT×2 + 2D6 and matrix VR uses Data Processing', () => {
    const c = char(ALL)
    expect(initiative(c, 'astral').score.value).toBe(10)
    expect(initiative(c, 'astral').dice.value).toBe(2)
    expect(initiative(c, 'matrixHot').score.value).toBeNull()
    c.modules.decker = true
    c.matrix.devices.push({
      id: newId(),
      name: 'Deck',
      type: 'cyberdeck',
      deviceRating: 4,
      attack: 5,
      sleaze: 4,
      dataProcessing: 6,
      firewall: 5,
      programSlots: 3,
      matrixDamage: 0,
      active: true,
      notes: '',
    })
    expect(initiative(c, 'matrixHot').score.value).toBe(11)
    expect(initiative(c, 'matrixHot').dice.value).toBe(4)
    expect(initiative(c, 'matrixCold').dice.value).toBe(3)
  })
})

describe('overrides', () => {
  it('replaces the value, keeps the automatic value, and can be removed', () => {
    const c = char(ALL)
    c.overrides['limit.physical'] = 9
    const l = limit(c, 'physical')
    expect(l.overridden).toBe(true)
    expect(l.value).toBe(9)
    expect(l.auto).toBe(5)
    delete c.overrides['limit.physical']
    expect(limit(c, 'physical').value).toBe(5)
  })
})

describe('skills, specializations and defaulting (p. 129–130)', () => {
  it('adds rating + attribute; specialization is listed separately, not in the total', () => {
    const c = char(ALL)
    const s = skill(c, 'pistols', 4, ['Semi-Automatics'])
    const p = skillPool(c, s)
    expect(p.value).toBe(9)
    expect(p.specializations).toEqual(['Semi-Automatics +2'])
    expect(p.limit?.label).toBe('Weapon Accuracy')
  })

  it('defaults at attribute −1 when allowed', () => {
    const c = char(ALL)
    const s = skill(c, 'sneaking', 0)
    expect(skillPool(c, s).value).toBe(4)
  })

  it('refuses to default skills that cannot default, and flags unverified ones', () => {
    const c = char(ALL)
    const s = skill(c, 'hardware', 0)
    expect(skillPool(c, s).value).toBeNull()
    expect(skillPool(c, s).missing).toContain('Cannot default (untrained)')
    const ex = skill(c, 'exotic-melee-weapon', 0)
    expect(skillPool(c, ex).missing).toContain('Defaulting not verified for this skill')
  })

  it('a skill without an entered rating is incomplete, not zero', () => {
    const c = char(ALL)
    const s = skill(c, 'pistols', null)
    expect(skillPool(c, s).value).toBeNull()
  })

  it('uses inherent limits by linked attribute', () => {
    const c = char(ALL)
    expect(skillPool(c, skill(c, 'perception', 3)).limit?.value).toBe(6) // mental
    expect(skillPool(c, skill(c, 'con', 3)).limit?.label).toBe('Social')
    expect(skillPool(c, skill(c, 'unarmed-combat', 3)).limit?.label).toBe('Physical')
    expect(skillPool(c, skill(c, 'assensing', 3)).limit?.label).toBe('Astral')
  })

  it('uses skill group ratings', () => {
    const c = char(ALL)
    const g = { id: newId(), name: 'Firearms', rating: 3, notes: '' }
    c.skillGroups.push(g)
    const s = skill(c, 'pistols', null)
    s.groupId = g.id
    expect(skillPool(c, s).value).toBe(8)
  })
})

describe('modifier targeting & no double counting', () => {
  it('a modifier listing several matching targets counts once', () => {
    const c = char(ALL)
    const s = skill(c, 'pistols', 4)
    c.modifiers.push(
      mod({ targets: [`skill:${s.id}`, 'allTests'], value: 2, kind: 'situational', active: true }),
    )
    expect(skillPool(c, s).value).toBe(11)
  })

  it('all-tests situational penalty does not hit resistance tests', () => {
    const c = char(ALL)
    c.modifiers.push(mod({ targets: ['allTests'], value: -2, kind: 'situational', active: true }))
    const pools = generalPools(c)
    expect(pools.find((p) => p.id === 'pool.defense')!.value).toBe(6)
    expect(pools.find((p) => p.id === 'pool.damageResistance')!.value).toBe(4)
  })

  it('weapon modifiers apply only to that weapon', () => {
    const c = char(ALL)
    const s = skill(c, 'pistols', 4)
    const w = {
      id: newId(),
      name: 'Gun',
      skillId: s.id,
      accuracy: 5,
      damage: '8P',
      ap: '-1',
      mode: 'SA',
      rc: '',
      ammoCapacity: 15,
      ammoCurrent: 15,
      ammoType: '',
      ammoSpare: '',
      active: true,
      source: '',
      notes: '',
    }
    c.rangedWeapons.push(w)
    c.modifiers.push(
      mod({ targets: [`weapon:${w.id}`], value: 2 }),
      mod({ targets: [`weaponAcc:${w.id}`], value: 1 }),
    )
    const p = rangedWeaponPool(c, w)
    expect(p.value).toBe(11)
    expect(p.limit?.value).toBe(6)
    expect(skillPool(c, s).value).toBe(9)
  })
})

describe('general and custom pools', () => {
  it('computes attribute-only tests without limits (p. 47, 152)', () => {
    const c = char(ALL)
    const pools = generalPools(c)
    const get = (id: string) => pools.find((p) => p.id === `pool.${id}`)!
    expect(get('composure').value).toBe(5)
    expect(get('judgeIntentions').value).toBe(7)
    expect(get('memory').value).toBe(7)
    expect(get('liftCarry').value).toBe(7)
    expect(get('composure').limit).toBeNull()
    expect(get('fullDefense').value).toBe(11)
    expect(get('dodge').limit?.label).toBe('Physical')
  })

  it('builds custom pools from structured parts', () => {
    const c = char(ALL)
    const s = skill(c, 'pistols', 4)
    const p = customPool(c, {
      id: 'x',
      name: 'Called shot',
      parts: [
        { kind: 'skill', skillId: s.id },
        { kind: 'attribute', key: 'AGI' },
        { kind: 'constant', value: -4, label: 'Called shot' },
      ],
      limit: 'physical',
      customLimit: null,
      applyWounds: true,
      conditions: 'vs. visible target',
      favorite: true,
    })
    expect(p.value).toBe(5)
    expect(p.limit?.value).toBe(5)
  })

  it('drain uses Willpower + tradition attribute', () => {
    const c = char({ ...ALL, MAG: 5 })
    c.modules.magic = true
    expect(generalPools(c).find((p) => p.id === 'pool.drain')!.value).toBeNull()
    c.magic.drainAttribute = 'LOG'
    expect(generalPools(c).find((p) => p.id === 'pool.drain')!.value).toBe(7)
  })
})

describe('movement, matrix and vehicle monitors', () => {
  it('walk/run are AGI×2 / AGI×4 (p. 162)', () => {
    const c = char(ALL)
    expect(movement(c, 'walk').value).toBe(10)
    expect(movement(c, 'run').value).toBe(20)
  })

  it('matrix monitor requires a manual value for odd Device Ratings', () => {
    const c = char(ALL)
    expect(matrixMonitor(c, 'd', 4, 'Deck').value).toBe(10)
    expect(matrixMonitor(c, 'd', 3, 'Deck').value).toBeNull()
    c.overrides['d'] = 10
    expect(matrixMonitor(c, 'd', 3, 'Deck').value).toBe(10)
  })

  it('vehicles 12+⌈Body/2⌉, drones 6+Body/2', () => {
    const c = char(ALL)
    const base = {
      id: 'v',
      name: 'V',
      handling: '',
      speed: '',
      acceleration: '',
      armor: null,
      pilot: 3,
      sensor: null,
      seats: null,
      damage: 0,
      matrixDamage: 0,
      deviceRating: null,
      mods: '',
      weapons: '',
      sensors: '',
      ammo: '',
      active: true,
      source: '',
      notes: '',
    }
    expect(vehicleMonitor(c, { ...base, kind: 'vehicle', body: 11 }).value).toBe(18)
    expect(vehicleMonitor(c, { ...base, kind: 'drone', body: 4 }).value).toBe(8)
    expect(vehicleMonitor(c, { ...base, kind: 'drone', body: 3 }).value).toBeNull()
  })
})
