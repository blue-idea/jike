export interface ScenicFeature {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tags: string[];
  distance?: string;
  rating?: string;
  badge?: string;
}

export interface MuseumCardItem {
  id: string;
  title: string;
  location: string;
  distance: string;
  image: string;
  tags: string[];
}

export const SCENIC_CATEGORY_TABS = [
  { id: 'scenic', label: 'A级景区' },
  { id: 'heritage', label: '重点文保' },
  { id: 'museum', label: '博物馆' },
];

export const SCENIC_FILTERS = [
  { id: 'level', label: 'A级等级', value: '全部等级' },
  { id: 'province', label: '省份', value: '陕西省' },
  { id: 'city', label: '城市', value: '西安市' },
];

export const SCENIC_FEATURED: ScenicFeature[] = [
  {
    id: 'dayanta',
    title: '大雁塔',
    subtitle: '唐代佛塔',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDvAN_6bWlc5fjPTLnjhqTbScs0nWulfJ88Ncjx3YYfQc_iyT4nQN90IKGne5vAVM-cHf3xoG24r0dulmEGBhx4V6wXLS5D3sZS1ooBHcVXLuqZf-YV_KVWlNWjWPXyYYvzI7HdpdEGQZsif-xXSkx3y0OQC1tv5bau5SIyQRqhfHRuNDqhhDzGEdrQgzPq6Khz-XdahGFMNK73_6s6o0JS7Kc1mmW2q5voTpoFAcc9jhaNMijZFBhnQ6yIZVO82-rOakRNAoG4xOY',
    tags: ['Top Rated', 'AAAAA级'],
    distance: '4.8km',
  },
  {
    id: 'beilin',
    title: '西安碑林',
    subtitle: '历代碑刻',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBDNGdvOqLomtd3RMdaWRrCe59ezvIXNhAg_TXmaobcy3HDEuoekHjcEZ_9HghZhP63fi993HQ5EYdFsJ8s1fsHawXUeWoTc-OTX7VjLLj9VxBjBPr34Tngm0NqpOcW5h-Cj6nT4rQaK5OEvPMRAAyi9r2OVUg52IRzCPil8PQPu_lw8ZDUBjLWusixC_qQvpUkcFTzREa86RTY_VnPq2is2FkzTlE3JM4yqiSel2n6hoq3kdYTkvFd2HOHYqTLvSRMDJOly6mwIjA',
    tags: ['石刻', '全国重点'],
    distance: '1.2km',
    rating: '4.9',
  },
  {
    id: 'xiaoyanta',
    title: '小雁塔',
    subtitle: '荐福寺内',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDs4Wy3RTzV9spLoqXWWeGT8zYWPSgmwHzM0UYYv40mAV9HoML8qn_R3km7bRPkh5-fdOL3kBJufnqf8jIg5H643GajdL6xKgZ7waRArZktVkqfALlZjYG-jttaxTJTHMdxbFr0YxOyCFo7PTickcIF-NqPnAA1Kw1kI1Hu1QOYiYyx2AJTvlldoPvwUGFNHrLbMacyRC3FLRLCRaHJ8q4AsxyRpRoSDkjzKRog5_jOwXjYU1FQHcRNbt-MmVkKtCWy3meuJ8_X6tw',
    tags: ['古建筑', 'AAAA级'],
    distance: '3.5km',
    rating: '4.7',
  },
];

export const SCENIC_MAP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuASW1aSFus71GfpmYe43WJik4YmLh2csXxyRvAsQoqjZC6yPHrM-maCBPDmcRC1KMKrYqFksu9DrdKxwUOON4QX1Tu5hLBMTGLmPFZRgNWSiXyh_4AhvA7nb_ugZAZATdemLHi4QEpDT9LcFqTdM4BRQ7ZoXoV19Ah68LqRO5azEicIBMeo1u6osb78-5wCE38Oj-vhSya1TLVuu_pLjrbd6AHgHiJ4dfYkNC-6xWdOSd213RFrn2Tt6mkrcO0mq3rtSfXOeQW2MJw';

export const HERITAGE_DYNASTIES = [
  { label: '汉', years: '公元前202-220', active: false },
  { label: '唐', years: '公元618-907', active: true },
  { label: '宋', years: '公元960-1279', active: false },
  { label: '元', years: '公元1271-1368', active: false },
  { label: '明', years: '公元1368-1644', active: false },
  { label: '清', years: '公元1636-1912', active: false },
];

export const HERITAGE_TYPES = [
  {
    id: 'architecture',
    title: '古建筑',
    subtitle: 'Ancient Architecture',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA6JFireQVTabJYWFINH_FS7Vqg3nYWmGQUTdRPLkwz8rokfVwGtsPjLlnwsCjkDo-K9CIVnxuFiEbJCSBvAB1OTZFjj-fbbS0zz_MFmby_O5829aajmFmctOlDK-A7FmIvOaFE9_J5wuHYfTYEp-UlMHcGDuJzBueyHiCBTdA9UcdtuHeZQjEGQkyOC2WoI-grgm2A5mrZ6K2CeIDKSGDwVcq7chScDbGpTJtxrzom-aUFmM5MV68PLQtIanEc-y_D9L97MgEq1xM',
    tall: false,
  },
  {
    id: 'grotto',
    title: '石窟寺',
    subtitle: 'Grottoes',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvEB9Z8svtjGfHsOZDwq4j344M40tvgz8xLX3rEKiUwpNOGWRI-P5BbG-3vTOeUrOA5YlHFP8eKxSacVwTXMsOk4AWMu_G-k7rH3ZT_QrNXwB_l6boF9JlTc1TxALhVE9IKOyujPoC_OkNS5Rn3AKMy3toZl0PlgL1cJGl6Bj4FPqyhSarBYVrpIUMNdHh0fXOIDZi0e372TOIUE1iDNUOdnnw7xGgQBTxs2mlxFrETD4Ff4Jf5DAf72MoumT9GZot-RgIhH7ykhU',
    tall: true,
  },
  {
    id: 'tomb',
    title: '陵寝墓葬',
    subtitle: 'Tombs',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDyN_g49cmX7OEUIlf_C94xvb__-q3Fv1LSffcUgR5kHSG5n2LpAgXcyNw9bCMNLi6xkHlfPO5IjEz-c80QmNo2f4569hEP2GPxJnOETOkjb_WqiwzL4qFzIM_rD9TxLPuihFnxKRBqKkPjzkzZY4CmZgH6LnoMJxaWdwhPEGo4V2VALFQynTMuvSg8Ner3cCg6dL6sQyzaeeZTxpIb00MxrqfXNIZytnd2J3Fchn1vgW4KBdkxQHkBXmjBXy_8Yq1cZJaNbVtTA4k',
    tall: true,
  },
  {
    id: 'battlefield',
    title: '古战场',
    subtitle: 'Battlefields',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA_GQP_2a_RLDPRuvCE15kwESGO1fjwvLvxiBRa2Ohrdi1LUKn_NQrXaNbuBJGzMoT6uRKxsCNmmuF_XKJEkPyF5gO2XUKiBj-DQYmxp_liKfgHF9QLDAeHyDrl6j2kqW3fMOd4lFe3RwrIJ3REyXXADcsA4AG4eyN6WZCAWMFtIQVZGoyo56JAzqCEXNLt8lgTwM7Td2UQuLUxrnI9pzq223AyrrsnZtYfa3ZX10ybzYQnlNWgmIAPjEAToh_8giv38-RftY431tY',
    tall: false,
  },
];

export const MUSEUM_PROVINCES = ['全境', '北京', '陕西', '上海', '四川', '江苏', '浙江'];

export const MUSEUM_CARDS: MuseumCardItem[] = [
  {
    id: 'national',
    title: '中国国家博物馆',
    location: '北京 · 东城区',
    distance: '1.2km',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAGmOmdc0Dc--7WkV05BQ4gj2Nk5VrsxINzaBkDAsshr7hvxTvVwN4XCvdA0aCMO62E5JP1CdJN2gyKdVq8PqlUfmo1Lwb6M62QMseJlku1_o_eqLyWBZg-vbUtcq-HunJgJE1ltCVisW1AdR1CMIGoz2DG9S6Ei7irdTvymcoon4obJhxBF2rXgaexaYPRGdOkWBHw62Wv1yoS6vg1ale-eu8-Cy3ds_r0Ch3f4mMc2VOBquwI0NDUqe4jzglFw_kMlom9YRU1JrE',
    tags: ['一级博物馆', '免费'],
  },
  {
    id: 'forbidden',
    title: '故宫博物院',
    location: '北京 · 东城区',
    distance: '2.5km',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCcACBzTjb99ZpgCqDO_aCAfY29uIJpnNVgtFp48oAIG9B_0M-eMBowuOOTiMSCrZ4HwgPnmt-lzGyIm_BOdhJmrjqZ-ZFd5dBWSTydShhtbUPcyl5uHmKS23NCqYdk9SXg8_qAh7-wwArHBQWqEpEJ_r_YkLhC7Z01cQYKa_Ur5F-GijsUEtCcpkunDXF3BZMco7KCxKio8q_H-9Ib-dJ4PAiW9BCwKIhEUxEhrrZ1FsPppHEt0KMpg4YZ9_vMlqp5QsIgIL9xqGk',
    tags: ['一级博物馆'],
  },
  {
    id: 'nanjing',
    title: '南京博物院',
    location: '江苏 · 南京',
    distance: '290km',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBjtg6Q4FCcnj1_FlYdTISf8E8XwutH1wphfbZkCwbjbnmb4u8kzmU_MO0UoOwk4dN2zt4tPlQ_uBLB8k2j2PRKBKgCBF-VvNaQgImS_tI8qoXwbz637tAoIzs_ccEpKzT42hsjsrhAtudXiZfyG0RS6oW0eqKLeR7oYJnpc9DrBqOXO1NmTjX3TGmRfiNCqxiy-ZGDOWilTTlAYopz7N4ZWCwhrzBHvG5pN6MhnfnwMLGflGk0qa-uXrQaa-IuzX0cajJHhP3Y7gA',
    tags: ['一级博物馆', '免费'],
  },
  {
    id: 'xian',
    title: '西安博物院',
    location: '陕西 · 西安',
    distance: '912km',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDh2FKxvsAREOlEQ4-XNT5j-Va8susrSA41SwiDpHWcBOrOQ0Nt2L5t2y_IS3HdpSu5TDyiPJowfdITDjoiF4ACkFhE2MhUXK9LuhqePsaXB29qFaT8r_wPCFjK7cjH3_IvKUEA-vTWjpUJuURI8x45eDH-IodU-uP17mxLv2EGzSWq7BUvKtvtsKWsd6Y9hJ8x51QbIeCqUeSXswUNbcHKVQ74GPcRHB2d2KqP17DKEwjktmqgfY5aNmmyMVY6f_FB7ZjTeAWxKnk',
    tags: ['二级博物馆', '免费'],
  },
  {
    id: 'shanghai',
    title: '上海博物馆',
    location: '上海 · 黄浦区',
    distance: '1,060km',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCbEFcH385R3PXk0WHxwpuxXXuaqsQnvovgge8fyz_CYm0Nv7EwYQYbpRUo9DtxEPy7CputTqBpFO6GFfUix3cRSebR0-J04SEc0ShwbYgxM-JToueLbWITCrPOwzp1RVG-UuOP8qEI2xBC0K_Vrmg5W8uBkYb_GkwBeRPaeXuoChjsWKYot-G8WCxH1eazpX9NTOjNOIHtRZsKvxrdPg9Lqnkfk9s08I3U3xBOVog1nIcKg5TiH_geCALfvsO0M-15w534CNr95G8',
    tags: ['一级博物馆'],
  },
];
