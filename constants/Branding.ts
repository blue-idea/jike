export const BrandingOptions = {
  STAMP: {
    id: 'stamp',
    name: '现代印章',
    image: require('@/assets/images/branding/jike_logo_option_1_stamp_1777198874064.png'),
  },
  ARCHITECTURE: {
    id: 'architecture',
    name: '古建剪影',
    image: require('@/assets/images/branding/jike_logo_option_2_architecture_1777198888184.png'),
  },
  DIGITAL: {
    id: 'digital',
    name: '数字文化',
    image: require('@/assets/images/branding/jike_logo_option_3_digital_heritage_1777198904996.png'),
  },
  ZEN: {
    id: 'zen',
    name: '极简禅意',
    image: require('@/assets/images/branding/jike_logo_option_4_minimalist_elegant_circle_1777198922284.png'),
  },
  LANDSCAPE: {
    id: 'landscape',
    name: '千里江山',
    image: require('@/assets/images/branding/logo_landscape_transparent.png'),
  },
  EAVESTILE: {
    id: 'eavestile',
    name: '瓦当艺术',
    image: require('@/assets/images/branding/jike_logo_option_6_eavestile_v2_1777199186415.png'),
  },
  SINAN: {
    id: 'sinan',
    name: '司南探索',
    image: require('@/assets/images/branding/jike_logo_option_7_sinan_v2_1777199198739.png'),
  },
  INK: {
    id: 'ink',
    name: '墨韵书法',
    image: require('@/assets/images/branding/jike_logo_option_8_ink_v2_1777199216501.png'),
  },
  LATTICE: {
    id: 'lattice',
    name: '窗棂美学',
    image: require('@/assets/images/branding/jike_logo_option_9_lattice_v2_1777199230732.png'),
  },
} as const;

export type BrandingOptionKey = keyof typeof BrandingOptions;

export const CURRENT_BRANDING: BrandingOptionKey = 'LANDSCAPE'; // 使用千里江山透明方案
