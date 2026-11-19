import { newCharacter, newId } from './factory'
import type { Character, Skill } from './schema'
import { SKILL_CATALOG } from '../rules/skillCatalog'

/**
 * A clearly marked EXAMPLE character for demonstration and testing only.
 * All values are invented; it is not anyone's real character.
 */
export function exampleCharacter(): Character {
  const c = newCharacter('EXAMPLE – Demo Runner')
  c.isExample = true
  c.identity = {
    ...c.identity,
    alias: 'Static (example)',
    metatype: 'Elf',
    player: 'Example data',
    age: '27',
    sex: 'F',
    height: '1.85 m',
    weight: '62 kg',
    ethnicity: 'Example',
    description: 'Demonstration character with all modules enabled. Not a real character.',
  }
  c.modules = { rigger: true, decker: true, magic: true, technomancer: true }
  const base: Record<string, number> = {
    BOD: 3,
    AGI: 5,
    REA: 4,
    STR: 2,
    WIL: 4,
    LOG: 5,
    INT: 5,
    CHA: 4,
    EDG: 3,
    MAG: 4,
    RES: 3,
  }
  for (const [k, v] of Object.entries(base)) c.attributes[k as keyof typeof c.attributes].base = v

  const add = (name: string, rating: number, specs: string[] = [], favorite = false): Skill => {
    const cat = SKILL_CATALOG.find((s) => s.name === name)!
    const sk: Skill = {
      id: newId(),
      name: cat.name,
      catalogKey: cat.key,
      attribute: cat.attribute,
      rating,
      groupId: null,
      category: cat.category,
      specializations: specs,
      defaultable: cat.defaultable,
      limit: 'auto',
      favorite,
      source: `SR5 p. ${cat.page}`,
      notes: '',
    }
    c.skills.push(sk)
    return sk
  }
  const pistols = add('Pistols', 5, ['Semi-Automatics'], true)
  const blades = add('Blades', 3, ['Knives'])
  add('Perception', 4, ['Visual'], true)
  add('Sneaking', 4, ['Urban'])
  add('Gymnastics', 2)
  add('Hacking', 5, ['Devices'], true)
  add('Cybercombat', 4)
  add('Electronic Warfare', 3)
  add('Spellcasting', 4, ['Combat Spells'], true)
  add('Counterspelling', 2)
  const pilotGround = add('Pilot Ground Craft', 3, ['Wheeled'])
  const gunnery = add('Gunnery', 3)
  add('Compiling', 2)
  add('Registering', 2)
  add('Etiquette', 3, ['Street'])
  add('Negotiation', 2)
  add('Unarmed Combat', 1)
  add('First Aid', 0)
  c.skills.push({
    id: newId(),
    name: 'Exotic Melee Weapon (Monofilament Whip) — a deliberately long skill name',
    catalogKey: 'exotic-melee-weapon',
    attribute: 'AGI',
    rating: 2,
    groupId: null,
    category: 'combat',
    specializations: [],
    defaultable: null,
    limit: 'auto',
    favorite: false,
    source: 'SR5 p. 151',
    notes: '',
  })
  c.knowledgeSkills = [
    {
      id: newId(),
      name: 'Seattle Gangs',
      type: 'street',
      rating: 3,
      specializations: [],
      notes: '',
    },
    {
      id: newId(),
      name: 'Magical Theory',
      type: 'academic',
      rating: 3,
      specializations: [],
      notes: '',
    },
    {
      id: newId(),
      name: 'Corporate Security Procedures',
      type: 'professional',
      rating: 2,
      specializations: [],
      notes: '',
    },
  ]
  c.languages = [
    { id: newId(), name: 'English', native: true, rating: null, specializations: [], notes: '' },
    { id: newId(), name: 'Sperethiel', native: false, rating: 3, specializations: [], notes: '' },
  ]
  c.qualities = [
    {
      id: newId(),
      name: 'Example Positive Quality',
      type: 'positive',
      karma: 5,
      rating: null,
      source: '',
      notes: 'Demo only',
    },
    {
      id: newId(),
      name: 'Example Negative Quality',
      type: 'negative',
      karma: -5,
      rating: null,
      source: '',
      notes: 'Demo only',
    },
  ]
  const droneId = newId()
  const lmgId = newId()
  c.rangedWeapons = [
    {
      id: newId(),
      name: 'Example Heavy Pistol',
      skillId: pistols.id,
      accuracy: 5,
      damage: '8P',
      ap: '-1',
      mode: 'SA',
      rc: '0',
      ammoCapacity: 15,
      ammoCurrent: 15,
      ammoType: 'Regular',
      ammoSpare: '2 clips',
      active: true,
      carried: true,
      mountedOn: null,
      source: '',
      notes: '',
    },
    {
      id: lmgId,
      name: 'Example Drone LMG (mounted)',
      skillId: gunnery.id,
      accuracy: 5,
      damage: '9P',
      ap: '-2',
      mode: 'FA',
      rc: '5',
      ammoCapacity: 50,
      ammoCurrent: 50,
      ammoType: 'Regular',
      ammoSpare: '1 belt',
      active: false,
      carried: false,
      mountedOn: droneId,
      source: '',
      notes: 'Example weapon mounted on the example drone.',
    },
  ]
  c.meleeWeapons = [
    {
      id: newId(),
      name: 'Example Combat Knife',
      skillId: blades.id,
      reach: 0,
      accuracy: 6,
      damage: '(STR+2)P',
      ap: '-3',
      active: true,
      carried: true,
      source: '',
      notes: '',
    },
  ]
  c.armor = [
    {
      id: newId(),
      name: 'Example Armor Jacket',
      rating: 12,
      accessory: false,
      equipped: true,
      carried: true,
      source: '',
      notes: '',
    },
    {
      id: newId(),
      name: 'Example Helmet',
      rating: 2,
      accessory: true,
      equipped: true,
      carried: true,
      source: '',
      notes: '',
    },
  ]
  c.augmentations = [
    {
      id: newId(),
      name: 'Example Datajack',
      type: 'cyberware',
      grade: 'Standard',
      rating: null,
      essence: 0.1,
      source: '',
      notes: '',
    },
  ]
  c.contacts = [
    {
      id: newId(),
      name: 'Example Fixer',
      archetype: 'Fixer',
      connection: 4,
      loyalty: 2,
      favor: '',
      notes: '',
    },
  ]
  c.sins = [{ id: newId(), name: 'Example Fake SIN', rating: 4, fake: true, notes: '' }]
  c.lifestyles = [
    {
      id: newId(),
      name: 'Example Apartment',
      level: 'Low',
      monthlyCost: 2000,
      monthsPaid: 1,
      primary: true,
      notes: '',
    },
  ]
  c.reputation = { streetCred: 2, notoriety: 1, publicAwareness: 0 }
  c.resources = { nuyen: 1500, karma: 4, karmaTotal: 12 }
  // Example log: 7 + 1 = 8 spent, 12 earned → expected 4 unspent (balanced).
  c.karmaHistory = [
    {
      id: newId(),
      date: '2026-01-10',
      category: 'Specialization',
      name: 'Example: Perception specialization',
      before: '—',
      after: 'Visual',
      karmaSpent: 7,
      entryType: 'historical',
      comment: 'Example entry',
      source: 'SR5 p. 107',
      fromLedgerId: null,
    },
    {
      id: newId(),
      date: '2026-02-02',
      category: 'Knowledge/Language',
      name: 'Example: new knowledge skill',
      before: '—',
      after: '1',
      karmaSpent: 1,
      entryType: 'new',
      comment: 'Example entry',
      source: 'SR5 p. 107',
      fromLedgerId: null,
    },
  ]
  c.modifiers = [
    {
      id: newId(),
      name: 'Example: Smartlink',
      value: 2,
      kind: 'permanent',
      active: false,
      targets: [`weapon:${c.rangedWeapons[0]!.id}`],
      condition: '',
      source: '',
      notes: '',
      itemId: null,
    },
    {
      id: newId(),
      name: 'Example: Running',
      value: -2,
      kind: 'situational',
      active: false,
      targets: ['allTests'],
      condition: '',
      source: 'SR5 p. 162',
      notes: '',
      itemId: null,
    },
    {
      id: newId(),
      name: 'Example: Low-light vision helps',
      value: 2,
      kind: 'conditional',
      active: false,
      targets: [`skill:${c.skills[2]!.id}`],
      condition: 'in dim light (example)',
      source: '',
      notes: '',
      itemId: null,
    },
  ]
  c.matrix.devices = [
    {
      id: newId(),
      name: 'Example Cyberdeck',
      type: 'cyberdeck',
      deviceRating: 4,
      attack: 6,
      sleaze: 5,
      dataProcessing: 4,
      firewall: 5,
      programSlots: 4,
      matrixDamage: 0,
      active: true,
      carried: true,
      notes: '',
    },
  ]
  c.matrix.programs = [
    { id: newId(), name: 'Example Program', type: 'hacking', loaded: true, notes: '' },
  ]
  c.rigger.controlRig = 1
  c.rigger.rcc = {
    name: 'Example RCC',
    deviceRating: 4,
    dataProcessing: 4,
    firewall: 4,
    noiseReduction: 2,
    sharing: 2,
    matrixDamage: 0,
    carried: true,
    notes: '',
  }
  c.rigger.vehicles = [
    {
      id: droneId,
      name: 'Example Ground Drone',
      kind: 'drone',
      handling: '4/4',
      speed: '3',
      acceleration: '1',
      body: 4,
      armor: 6,
      pilot: 3,
      sensor: 3,
      seats: null,
      damage: 0,
      matrixDamage: 0,
      deviceRating: 3,
      mods: '',
      weapons: 'Example LMG',
      sensors: '',
      ammo: '',
      active: true,
      carried: true,
      pilotSkillId: pilotGround.id,
      source: '',
      notes: '',
    },
  ]
  c.rigger.autosofts = [
    {
      id: newId(),
      name: 'Example Clearsight',
      rating: 3,
      skill: 'Perception',
      kind: 'clearsight',
      weaponId: null,
      vehicleIds: [droneId],
      sharedOnRcc: false,
      notes: '',
    },
    {
      id: newId(),
      name: 'Example LMG Targeting',
      rating: 3,
      skill: 'Gunnery',
      kind: 'targeting',
      weaponId: lmgId,
      vehicleIds: [droneId],
      sharedOnRcc: false,
      notes: '',
    },
  ]
  c.magic.tradition = 'Example Tradition'
  c.magic.drainAttribute = 'LOG'
  c.magic.spells = [
    {
      id: newId(),
      name: 'Example Spell',
      category: 'Combat',
      type: 'M',
      range: 'LOS',
      duration: 'I',
      drain: 'F-3',
      isRitual: false,
      source: '',
      notes: '',
    },
  ]
  c.technomancer.complexForms = [
    {
      id: newId(),
      name: 'Example Complex Form',
      target: 'Device',
      duration: 'S',
      fading: 'L+1',
      source: '',
      notes: '',
    },
  ]
  c.background = 'Example background text.'
  return c
}
