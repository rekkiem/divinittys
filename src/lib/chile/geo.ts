/** Regiones y comunas de Chile (CUT). Usado en checkout para validar destino. */
export type ChileRegion = { name: string; communes: string[] };

export const CHILE_REGIONS: ChileRegion[] = [
  {
    name: 'Arica y Parinacota',
    communes: ['Arica', 'Camarones', 'Putre', 'General Lagos'],
  },
  {
    name: 'Tarapacá',
    communes: ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'],
  },
  {
    name: 'Antofagasta',
    communes: ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe', 'San Pedro de Atacama', 'Tocopilla', 'María Elena'],
  },
  {
    name: 'Atacama',
    communes: ['Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'],
  },
  {
    name: 'Coquimbo',
    communes: ['La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paiguano', 'Vicuña', 'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado'],
  },
  {
    name: 'Valparaíso',
    communes: ['Valparaíso', 'Casablanca', 'Concón', 'Juan Fernández', 'Puchuncaví', 'Quintero', 'Viña del Mar', 'Isla de Pascua', 'Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca', 'Zapallar', 'Quillota', 'Calera', 'Hijuelas', 'La Cruz', 'Nogales', 'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María', 'Quilpué', 'Limache', 'Olmué', 'Villa Alemana'],
  },
  {
    name: "O'Higgins",
    communes: ['Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'Las Cabras', 'Machalí', 'Malloa', 'Mostazal', 'Olivar', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rengo', 'Requínoa', 'San Vicente', 'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad', 'Paredones', 'San Fernando', 'Chépica', 'Chimbarongo', 'Lolol', 'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'Santa Cruz'],
  },
  {
    name: 'Maule',
    communes: ['Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas'],
  },
  {
    name: 'Ñuble',
    communes: ['Chillán', 'Bulnes', 'Chillán Viejo', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Ignacio', 'Yungay', 'Quirihue', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Ránquil', 'Treguaco', 'San Carlos', 'Coihueco', 'Ñiquén', 'San Fabián', 'San Nicolás'],
  },
  {
    name: 'Biobío',
    communes: ['Concepción', 'Coronel', 'Chiguayante', 'Florida', 'Hualpén', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz', 'Santa Juana', 'Talcahuano', 'Tomé', 'Hualpén', 'Lebu', 'Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa', 'Los Ángeles', 'Antuco', 'Cabrero', 'Laja', 'Mulchén', 'Nacimiento', 'Negrete', 'Quilleco', 'San Rosendo', 'Santa Bárbara', 'Tucapel', 'Yumbel', 'Alto Biobío'],
  },
  {
    name: 'Araucanía',
    communes: ['Temuco', 'Carahue', 'Cholchol', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Saavedra', 'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Villarrica', 'Angol', 'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén', 'Renaico', 'Traiguén', 'Victoria'],
  },
  {
    name: 'Los Ríos',
    communes: ['Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'La Unión', 'Futrono', 'Lago Ranco', 'Río Bueno'],
  },
  {
    name: 'Los Lagos',
    communes: ['Puerto Montt', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos', 'Llanquihue', 'Maullín', 'Puerto Varas', 'Castro', 'Ancud', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena'],
  },
  {
    name: 'Aysén',
    communes: ['Coyhaique', 'Lago Verde', 'Aysén', 'Cisnes', 'Guaitecas', 'Cochrane', "O'Higgins", 'Tortel', 'Chile Chico', 'Río Ibáñez'],
  },
  {
    name: 'Magallanes',
    communes: ['Punta Arenas', 'Laguna Blanca', 'Río Verde', 'San Gregorio', 'Cabo de Hornos', 'Antártica', 'Porvenir', 'Primavera', 'Timaukel', 'Natales', 'Torres del Paine'],
  },
  {
    name: 'Metropolitana',
    communes: [
      'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia',
      'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo',
      'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel',
      'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura',
      'Puente Alto', 'Pirque', 'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin',
      'Calera de Tango', 'Paine', 'Melipilla', 'Alhué', 'Curacaví', 'María Pinto', 'San Pedro', 'Talagante',
      'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor',
    ],
  },
];

export const CHILE_REGION_NAMES = CHILE_REGIONS.map((r) => r.name);

export function communesForRegion(region: string): string[] {
  const found = CHILE_REGIONS.find((r) => r.name.toLowerCase() === region.trim().toLowerCase());
  return found ? found.communes : [];
}

export function findRegionForCommune(commune: string): string | null {
  const c = commune.trim().toLowerCase();
  for (const r of CHILE_REGIONS) {
    if (r.communes.some((x) => x.toLowerCase() === c)) return r.name;
  }
  return null;
}

export function isValidChileCommune(region: string, commune: string): boolean {
  return communesForRegion(region).some((x) => x.toLowerCase() === commune.trim().toLowerCase());
}

export type ShippingAddress = {
  firstName?: string;
  lastName?: string;
  name?: string;
  street?: string;
  number?: string;
  apartment?: string;
  address?: string;
  commune?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
};

/** Normaliza shippingData histórico (name/address) y el formato actual (firstName/street). */
export function formatShippingAddress(raw: ShippingAddress | null | undefined) {
  if (!raw || typeof raw !== 'object') {
    return { fullName: '', line1: '', line2: '', contact: '', isComplete: false };
  }
  const first = (raw.firstName || '').trim();
  const last = (raw.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ') || (raw.name || '').trim();
  const street = (raw.street || '').trim();
  const number = (raw.number || '').trim();
  const apt = (raw.apartment || '').trim();
  const legacy = (raw.address || '').trim();
  const line1 = [street && number ? `${street} ${number}` : street || number, apt].filter(Boolean).join(', ') || legacy;
  const line2 = [raw.commune, raw.city, raw.region].filter(Boolean).join(', ');
  const contact = [raw.email, raw.phone].filter(Boolean).join(' · ');
  const isComplete = Boolean(fullName && line1 && (raw.commune || raw.city));
  return { fullName, line1, line2, contact, isComplete };
}
