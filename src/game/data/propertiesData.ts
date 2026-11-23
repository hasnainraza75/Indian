import { PropertyDef } from '../types';

export const PROPERTIES: PropertyDef[] = [
  {
    id: 'marina_mansion',
    name: 'Marina Luxury Mansion',
    district: 'Juhu Estates',
    price: 0,
    description:
      'Your flagship two-story luxury mansion with furnished living room, bedroom, kitchen, bathroom, roof terrace, swimming pool, garden, and personal garage.',
    x: -145,
    y: 0,
    z: -135,
    garageX: -124,
    garageY: 0,
    garageZ: -133,
    spawnRotY: 0,
    isStarter: true
  },
  {
    id: 'sealink_penthouse',
    name: 'Sea Link Sky Villa',
    district: 'Bandra Waterfront',
    price: 65000,
    description:
      'Modern coastal villa overlooking the cable-stayed bridge with private vehicle bay and oceanfront deck.',
    x: 165,
    y: 0,
    z: 140,
    garageX: 165,
    garageY: 0,
    garageZ: 158,
    spawnRotY: Math.PI
  },
  {
    id: 'ghat_estate',
    name: 'Sahyadri Hilltop Manor',
    district: 'Ghat Highlands',
    price: 95000,
    description:
      'Secluded mountain sanctuary along the winding ghat road with panoramic views of the city skyline.',
    x: -340,
    y: 12,
    z: 270,
    garageX: -322,
    garageY: 12,
    garageZ: 266,
    spawnRotY: -Math.PI / 2
  },
  {
    id: 'village_haveli',
    name: 'Surya Heritage Haveli',
    district: 'Kisanpur Village',
    price: 42000,
    description:
      'Spacious countryside estate surrounded by banyan trees, farmland, and rural off-road tracks.',
    x: 345,
    y: 0,
    z: -245,
    garageX: 328,
    garageY: 0,
    garageZ: -245,
    spawnRotY: Math.PI / 2
  }
];
