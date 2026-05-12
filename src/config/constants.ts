export const NOUU_CATEGORIES = [
  { label: 'Hogar', value: 'hogar', icon: '🏠' },
  { label: 'Construcción', value: 'construccion', icon: '🏗️' },
  { label: 'Tecnología', value: 'tecnologia', icon: '💻' },
  { label: 'Transporte', value: 'transporte', icon: '🚚' },
  { label: 'Cuidados', value: 'cuidados', icon: '👶' },
  { label: 'Eventos', value: 'eventos', icon: '🎉' },
  { label: 'Educación', value: 'educacion', icon: '📚' },
  { label: 'Oficina', value: 'oficina', icon: '📁' },
  { label: 'Belleza', value: 'belleza', icon: '💄' },
  { label: 'Salud', value: 'salud', icon: '🏥' },
  { label: 'Gastronomía', value: 'gastronomia', icon: '🍽️' },
  { label: 'Otro', value: 'otro', icon: '✨' },
] as const;

export type NouuCategory = typeof NOUU_CATEGORIES[number]['value'];

export const JOB_CATEGORIES = [
  { label: 'Tecnología', value: 'tecnologia' },
  { label: 'Administración', value: 'administracion' },
  { label: 'Ventas', value: 'ventas' },
  { label: 'Salud', value: 'salud' },
  { label: 'Educación', value: 'educacion' },
  { label: 'Construcción', value: 'construccion' },
  { label: 'Manufactura', value: 'manufactura' },
  { label: 'Gastronomía', value: 'gastronomia' },
  { label: 'Transporte', value: 'transporte' },
  { label: 'Comercio', value: 'comercio' },
  { label: 'Finanzas', value: 'finanzas' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Jurídico', value: 'juridico' },
  { label: 'Otro', value: 'otro' },
] as const;

export type JobCategory = typeof JOB_CATEGORIES[number]['value'];

export const CHILE_REGIONS = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana', 'O\'Higgins', 'Maule', 'Ñuble',
  'Biobío', 'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
  'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
  'Metropolitana', 'O\'Higgins', 'Maule', 'Ñuble', 'Biobío',
  'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'
] as const;

export const COLORS = {
  informal: '#f83758', // Pink (Nouu — pegas/pololos)
  formal: '#0f70b7',   // Blue (Nouu Work — trabajos formales)
  maria: '#f83758',    // Pink (MarIA / brand accent)
} as const;

export const MAP_CONFIG = {
  center: [-33.45, -70.67] as [number, number],
  zoom: 6 as number,
} as const;
