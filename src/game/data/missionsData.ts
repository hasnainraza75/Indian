import { MissionDef } from '../types';

export const MISSIONS: MissionDef[] = [
  {
    id: 'mumbai_night_run',
    order: 1,
    title: 'Chapter 1: Sea Link Midnight Sprint',
    category: 'racing',
    description:
      'Race across the central avenue and blast over the coastal cable-stayed bridge before the timer runs out.',
    reward: 8500,
    bonus: 2500,
    timeLimitSec: 120,
    startX: -40,
    startY: 0,
    startZ: -35,
    suggestedVehicleId: 'supra',
    checkpoints: [
      { x: 40, y: 0, z: -35, radius: 14, label: 'Metro Plaza Gate' },
      { x: 110, y: 0, z: 35, radius: 14, label: 'Bandra Approach' },
      { x: 180, y: 4, z: 110, radius: 16, label: 'Sea Link Bridge Crest' },
      { x: 240, y: 0, z: 195, radius: 16, label: 'Waterfront Finish' }
    ]
  },
  {
    id: 'marina_stunt_show',
    order: 2,
    title: 'Chapter 2: Bullet & Duke Stunt Mania',
    category: 'stunt',
    description:
      'Grab a motorcycle and hit highway stunt ramps to rack up 3.5 seconds of total airtime and clear the dock checkpoints.',
    reward: 7000,
    bonus: 3000,
    timeLimitSec: 130,
    startX: -110,
    startY: 0,
    startZ: -115,
    suggestedVehicleId: 'ktm_duke',
    targetAirtimeSec: 3.5,
    checkpoints: [
      { x: -30, y: 0, z: -95, radius: 14, label: 'Highway Launch Ramp' },
      { x: 55, y: 0, z: -95, radius: 15, label: 'Showroom Jump' }
    ]
  },
  {
    id: 'showroom_express',
    order: 3,
    title: 'Chapter 3: VIP Supercar Delivery',
    category: 'delivery',
    description:
      'Deliver a brand-new Lamborghini from the City Showroom to the Luxury Mansion Garage cleanly.',
    reward: 9500,
    bonus: 2500,
    timeLimitSec: 110,
    startX: 45,
    startY: 0,
    startZ: -80,
    suggestedVehicleId: 'lamborghini',
    checkpoints: [
      { x: -124, y: 0, z: -133, radius: 16, label: 'Marina Mansion Garage' }
    ]
  },
  {
    id: 'heat_level_escape',
    order: 4,
    title: 'Chapter 4: Heat Wave Escape',
    category: 'police_escape',
    description:
      'Shake off a 3-star police pursuit and reach the safe zone at Kisanpur Village without getting busted.',
    reward: 12000,
    bonus: 4000,
    timeLimitSec: 150,
    startX: 10,
    startY: 0,
    startZ: 20,
    suggestedVehicleId: 'fortuner',
    minWantedStars: 3,
    checkpoints: [
      { x: 320, y: 0, z: -220, radius: 22, label: 'Village Safe Barn' }
    ]
  },
  {
    id: 'luxury_collector',
    order: 5,
    title: 'Chapter 5: Exotic Import Collection',
    category: 'collection',
    description:
      'Collect the exotic cargo crates from the Airport Hangar and City Bazaar, then return to Downtown Plaza.',
    reward: 11000,
    bonus: 3000,
    timeLimitSec: 145,
    startX: 0,
    startY: 0,
    startZ: 0,
    suggestedVehicleId: 'gtr',
    checkpoints: [
      { x: -290, y: 0, z: -260, radius: 18, label: 'Airport Cargo Hangar' },
      { x: 95, y: 0, z: -145, radius: 16, label: 'City Bazaar Drop' },
      { x: 0, y: 0, z: 0, radius: 16, label: 'Central Clocktower' }
    ]
  },
  {
    id: 'ghat_hairpin_blitz',
    order: 6,
    title: 'Chapter 6: Sahyadri Ghat Time Trial',
    category: 'time_trial',
    description:
      'Master the steep mountain ghat road hairpins at high speed in a blistering time-trial climb.',
    reward: 10500,
    bonus: 3500,
    timeLimitSec: 115,
    startX: -220,
    startY: 0,
    startZ: 150,
    suggestedVehicleId: 'porsche',
    checkpoints: [
      { x: -275, y: 5, z: 210, radius: 16, label: 'Ghat Turn 1' },
      { x: -330, y: 11, z: 265, radius: 18, label: 'Hilltop Overlook' },
      { x: -370, y: 16, z: 320, radius: 18, label: 'Mountain Summit' }
    ]
  },
  {
    id: 'thar_offroad_trail',
    order: 7,
    title: 'Chapter 7: Thar Off-Road Expedition',
    category: 'offroad',
    description:
      'Take an SUV off the asphalt across riverbanks, forest trails, and village mud tracks.',
    reward: 9000,
    bonus: 2500,
    timeLimitSec: 135,
    startX: 210,
    startY: 0,
    startZ: -120,
    suggestedVehicleId: 'thar',
    checkpoints: [
      { x: 270, y: 0, z: -170, radius: 16, label: 'Forest Clearing' },
      { x: 345, y: 0, z: -245, radius: 16, label: 'Kisanpur Pond' },
      { x: 295, y: 0, z: -310, radius: 16, label: 'Farmland Ridge' }
    ]
  },
  {
    id: 'cargo_convoy',
    order: 8,
    title: 'Chapter 8: Heavy Highway Transport',
    category: 'transport',
    description:
      'Haul essential supplies using a heavy Tata Truck from the Industrial Yard to the Rural Market.',
    reward: 11500,
    bonus: 3000,
    timeLimitSec: 140,
    startX: 140,
    startY: 0,
    startZ: -40,
    suggestedVehicleId: 'truck',
    checkpoints: [
      { x: 220, y: 0, z: -110, radius: 16, label: 'Toll Gate East' },
      { x: 330, y: 0, z: -230, radius: 18, label: 'Village Market Depot' }
    ]
  },
  {
    id: 'syndicate_takedown',
    order: 9,
    title: 'Chapter 9: Cyber Dock Takedown',
    category: 'combat',
    description:
      'Use your combat arsenal to neutralize 5 hostile rogue operatives guarding the Neon Cyber Yard.',
    reward: 15000,
    bonus: 5000,
    timeLimitSec: 160,
    startX: -95,
    startY: 0,
    startZ: 120,
    targetKills: 5,
    checkpoints: [
      { x: -135, y: 0, z: 165, radius: 24, label: 'Neon Cyber Yard' }
    ]
  },
  {
    id: 'chopper_extraction',
    order: 10,
    title: 'Chapter 10: Airport Helipad Airlift',
    category: 'special',
    description:
      'Pilot a Helicopter from the Airport Runway and touch down on the Police HQ Sky Helipad.',
    reward: 18000,
    bonus: 5000,
    timeLimitSec: 140,
    startX: -280,
    startY: 0,
    startZ: -250,
    suggestedVehicleId: 'helicopter',
    checkpoints: [
      { x: -120, y: 20, z: -100, radius: 24, label: 'City Air Corridor' },
      { x: 65, y: 12, z: 55, radius: 20, label: 'Police HQ Helipad' }
    ]
  },
  {
    id: 'cyber_volt_circuit',
    order: 11,
    title: 'Chapter 11: Electric Tron Volt GP',
    category: 'driving',
    description:
      'Push the electric Tron Light Bike to peak speed through the neon downtown circuit.',
    reward: 16500,
    bonus: 4500,
    timeLimitSec: 105,
    startX: -60,
    startY: 0,
    startZ: 60,
    suggestedVehicleId: 'tron_bike',
    checkpoints: [
      { x: 60, y: 0, z: 60, radius: 14, label: 'Volt Sector A' },
      { x: 60, y: 0, z: -60, radius: 14, label: 'Volt Sector B' },
      { x: -60, y: 0, z: -60, radius: 14, label: 'Volt Sector C' },
      { x: -60, y: 0, z: 60, radius: 15, label: 'Finish Arch' }
    ]
  },
  {
    id: 'tank_rampage_test',
    order: 12,
    title: 'Chapter 12: Arjun Armor Showdown',
    category: 'special',
    description:
      'Commandeer the Arjun Battle Tank and clear 6 hostile units around the Industrial Perimeter.',
    reward: 25000,
    bonus: 7500,
    timeLimitSec: 170,
    startX: 165,
    startY: 0,
    startZ: -175,
    suggestedVehicleId: 'tank',
    targetKills: 6,
    checkpoints: [
      { x: 185, y: 0, z: -195, radius: 28, label: 'Industrial Proving Ground' }
    ]
  }
];
