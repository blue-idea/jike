import { createClient } from 'jsr:@supabase/supabase-js@2';

type PoiType = 'scenic' | 'heritage' | 'museum';
type GuideSectionType =
  | 'background'
  | 'cultural'
  | 'poetry'
  | 'story'
  | 'timeline'
  | 'attraction';

interface GuideSection {
  type: GuideSectionType;
  title: string;
  content: string;
}

interface AiGuideResult {
  sections: GuideSection[];
  disclaimer: string;
  poi_name: string;
  generated_at: string;
}

interface AiGuideRequest {
  poi_id?: string;
  poi_type?: PoiType;
  poi_name?: string;
  locale?: string;
}

interface EdgeError {
  code: string;
  message_zh: string;
}

interface PoiMetadata {
  name: string;
  region?: string;
  address?: string;
  era?: string;
  category?: string;
  batch?: string;
  rating?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_DISCLAIMER =
  '以上内容由 AI 文化向导生成，仅供参考；如需权威考古结论，请以文博机构官方资料为准。';

const MODEL_TIMEOUT_MS = 60_000;

const POI_TYPE_LABELS: Record<PoiType, string> = {
  scenic: '景区',
  heritage: '文保单位',
  museum: '博物馆',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(code: string, messageZh: string, status = 400): Response {
  const error: EdgeError = { code, message_zh: messageZh };
  return jsonResponse({ error }, status);
}

function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blockMatch?.[1]) {
      return JSON.parse(blockMatch[1].trim());
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error('无法解析模型返回 JSON');
  }
}

function normalizePoiName(request: AiGuideRequest): string {
  const poiName = request.poi_name?.trim();
  if (poiName) return poiName;

  const fallback = request.poi_id?.trim();
  if (fallback) return fallback;

  return '文化地标';
}

function normalizeGuideResult(payload: unknown, poiName: string): AiGuideResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('模型输出为空');
  }

  const raw = payload as Partial<AiGuideResult>;
  const sections = Array.isArray(raw.sections)
    ? raw.sections.filter((item): item is GuideSection => {
        if (!item || typeof item !== 'object') return false;
        const section = item as Partial<GuideSection>;
        return (
          typeof section.type === 'string' &&
          typeof section.title === 'string' &&
          typeof section.content === 'string'
        );
      })
    : [];

  if (sections.length === 0) {
    throw new Error('模型未返回有效 sections');
  }

  return {
    sections,
    disclaimer:
      typeof raw.disclaimer === 'string' && raw.disclaimer.trim().length > 0
        ? raw.disclaimer
        : DEFAULT_DISCLAIMER,
    poi_name:
      typeof raw.poi_name === 'string' && raw.poi_name.trim().length > 0
        ? raw.poi_name
        : poiName,
    generated_at:
      typeof raw.generated_at === 'string' && raw.generated_at.trim().length > 0
        ? raw.generated_at
        : new Date().toISOString(),
  };
}

// ==========================================
// 1. POI 权威元数据检索（RAG 上下文增强）
// ==========================================
// deno-lint-ignore no-explicit-any
async function fetchPoiMetadata(
  client: any,
  poiType: PoiType,
  poiName: string,
  poiId?: string,
): Promise<PoiMetadata> {
  const result: PoiMetadata = { name: poiName };
  try {
    const isUuid = Boolean(poiId && /^[0-9a-f-]{36}$/i.test(poiId));

    if (poiType === 'heritage') {
      let query = client
        .from('catalog_heritage_sites')
        .select('name, provincial, city, county, category, era, batch, address_1');
      if (isUuid) {
        query = query.or(`id.eq.${poiId},name.eq.${poiName}`);
      } else {
        query = query.ilike('name', `%${poiName}%`);
      }
      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        result.name = data.name || poiName;
        result.region = [data.provincial, data.city, data.county].filter(Boolean).join(' · ');
        result.address = data.address_1 || '';
        result.era = data.era || '';
        result.category = data.category || '';
        result.batch = data.batch
          ? (data.batch.includes('文保') || data.batch.includes('国保')
              ? data.batch
              : (data.batch.includes('批') ? `${data.batch}全国重点文物保护单位` : `第${data.batch}批全国重点文物保护单位`))
          : '';
      }
    } else if (poiType === 'museum') {
      let query = client
        .from('catalog_museums')
        .select('name, pname, cityname, adname, address');
      if (isUuid) {
        query = query.or(`id.eq.${poiId},name.eq.${poiName}`);
      } else {
        query = query.ilike('name', `%${poiName}%`);
      }
      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        result.name = data.name || poiName;
        result.region = [data.pname, data.cityname, data.adname].filter(Boolean).join(' · ');
        result.address = data.address || '';
        result.category = '博物馆';
      }
    } else if (poiType === 'scenic') {
      let query = client
        .from('catalog_scenic_spots')
        .select('name, provincial, city, rating, address');
      if (isUuid) {
        query = query.or(`id.eq.${poiId},name.eq.${poiName}`);
      } else {
        query = query.ilike('name', `%${poiName}%`);
      }
      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        result.name = data.name || poiName;
        result.region = [data.provincial, data.city].filter(Boolean).join(' · ');
        result.address = data.address || '';
        result.rating = data.rating ? `${data.rating}级旅游景区` : '';
      }
    }
  } catch (err) {
    console.warn('[fetchPoiMetadata] warning:', err);
  }
  return result;
}

// ==========================================
// 2. 精编深度文化知识库（高水准权威兜底，严格 60-140 字）
// ==========================================
const CURATED_KNOWLEDGE_BASE: Record<string, GuideSection[]> = {
  南禅寺: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '南禅寺大殿位于山西五台县李家庄，重建于唐德宗建中三年（782年），是中国现存最早的木结构古建筑。因规模精巧且地处偏远，奇迹般躲过了唐武宗“会昌灭法”与千百年来的战火地震，早于佛光寺东大殿75年，是极为罕见的盛唐木构孤例。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '大殿为单檐歇山顶，面阔进深各三间。内部采用“彻上露明造”无天花板遮挡，梁架纯净洗练。斗拱硕大雄健（五铺作双杪），出檐深远平缓，柱头微倾带生起，梁架用托脚叉手承重，体现了盛唐木构雄浑凝练的力学之美，堪称中国大木作活化石。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '核心看点有三：第一是大殿朴素雄健的唐代五铺作斗拱与月梁；第二是佛坛上供奉的17尊唐代彩塑，主尊面相丰腴安详，衣褶如行云流水，与敦煌莫高窟唐塑同源；第三是西平梁底部完好保存的“大唐建中三年”墨书题记，是断定建造年代的国宝级铁证。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '20世纪初，日本学者曾断言“中国境内已无唐代木构”。直到1953年，山西省文管会调查组在偏僻李家庄普查时，意外发现了这座被尘封的山村古刹，拂去梁架积尘确认了唐建中题记，一举打破了昔日学术偏见，成为新中国古建考古史上的重大发现。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 唐代（782年）：大唐建中三年重建，奠定木构与彩塑主体；\n· 宋元明清：历代虽有补葺，但未改动唐代核心骨架与梁枋；\n· 1961年：被公布为首批全国重点文物保护单位；\n· 1975年：国家组织落架大修，科学复原唐代歇山屋顶并加固传世。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '建议选择晴朗上午探访，晨光斜照时佛坛唐塑光影轮廓最为生动；可自备微光手电筒，在不触碰文物的前提下仰观斗拱梁枋榫卯；殿内严格禁止开闪光灯拍照，静心感受大唐殿堂的静谧与空灵气韵。',
    },
  ],
  陕西历史博物馆: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '陕西历史博物馆位于西安大雁塔西北侧，1991年落成开放，是中国第一座拥有现代设施的大型国家级博物馆。馆舍由建筑大师张锦秋领衔设计，呈“中央殿堂、四隅崇楼”唐风格局，被誉为“古都明珠，华夏宝库”，馆藏文物逾170万件，时间跨度逾百万年。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '陕历博是一部立体的中华文明演进史。依托周秦汉唐等王朝建都核心腹地，馆藏以商周青铜器、历代陶俑、汉唐金银器及唐墓壁画最为卓绝，集中展现了中国统一多民族国家的形成与繁荣，生动折射出丝路东西交融与大唐盛世兼容并包的恢弘气象。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '绝世镇馆之宝不容错过：首批禁止出境展览的“镶金兽首玛瑙杯”雕工出神入化；战国晚期体现秦国严密军令制度的“杜虎符”错金璀璨；盛唐玄宗朝宫廷驯马祝寿的“舞马衔杯纹银壶”；以及唐墓壁画馆中笔墨磅礴、气势非凡的《客使图》与《阙楼图》。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '陕历博的创设源自周恩来总理的深切嘱托。1973年周总理陪外宾访陕时，见陕西出土文物极其丰厚却受制于展陈条件，深情嘱托要在西安建立一座现代化高水平博物馆。数代文博学者历经十余年勘选营建与发掘守护，终使华夏国宝在古都以崭新风貌震撼世人。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 史前周秦：从蓝田猿人、半坡聚落走向西周礼乐与大秦一统；\n· 汉唐盛世：汉家丝路开辟，至大唐万国来朝达到古代文明极盛；\n· 明清及近现代：十三朝古都文脉汇聚；\n· 1991年至今：新馆落成开放，成为世界感知中华文明的璀璨窗口。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '务必提前通过官方公众号实名预约；强烈建议加购“何家村窖藏展”与“唐代壁画珍品馆”专题票，欣赏最高等级馆藏；建议预留3小时，配合专业语音导览慢行细品，避开节假日入场高峰。',
    },
  ],
  秦始皇帝陵博物院: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '秦始皇帝陵博物院位于西安临潼，以世界规模最大帝王陵墓——秦始皇陵遗址及兵马俑坑为主体，为国家5A级景区。陵园始建于公元前247年，历时39年营建。1974年兵马俑偶然出土重见天日，1987年被列入《世界遗产名录》，被誉为“世界第八大奇迹”。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '近八千件陶俑陶马按照战国至秦代实战军阵编列，面孔千人千面，复刻了大秦帝国扫平六合的强盛军威。秦俑标志着从“人殉”向“俑殉”的历史文明进步，其模塑结合写实造型与高超的青铜兵器防腐工艺，代表了公元前三世纪人类工业雕塑与冶金技术的顶峰。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '核心必看：其一为“一号坑”，六千余件步车混编主力军阵气吞万里；其二为“二号坑”，机动弩兵与骑兵精锐荟萃，国宝级“跪射俑”靴底发髻毫发毕现；其三为“三号坑”统帅指挥部；以及铜车马博物馆出土的“青铜之冠”——两乘结构精绝的彩绘铜车马。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '1974年春，临潼西杨村村民杨志发等人在抗旱打井时意外挖出陶俑残片，当地文化馆赵康民随即抢救拼对。随后以袁仲一为代表的考古队入驻麦田钻探，让沉睡两千二百余年的地下军团大白于天下，袁仲一先生也因半生守护与考据被誉为“兵马俑之父”。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 公元前247-前208年：秦王嬴政即位起营建皇陵与地下陪葬军阵；\n· 秦末汉初：历经项羽兵火焚毁顶棚，军阵坍塌深埋地下；\n· 1974年：当地农民打井揭开序幕，国家组织科学发掘；\n· 1987年至今：列入世界遗产，全面开放丽山园遗址区。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '推荐游览动线：一号坑（感受军阵磅礴）→ 三号坑（统帅幕僚部）→ 二号坑（近观跪射俑细部）→ 铜车马博物馆；随后可乘免费摆渡车至秦始皇陵丽山园看百戏俑坑，领略完整秦陵风貌。',
    },
  ],
  云冈石窟: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '云冈石窟位于山西大同武周山南麓，始凿于北魏文成帝和平初年（公元460年），是北魏皇室主持开凿的首座大型皇家石窟寺，为首批全国重点文保单位与世界文化遗产。石窟依山开凿绵延一公里，存主要洞窟45个、造像5.9万余尊，是东方早期石雕艺术巅峰。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '云冈石窟是中西文明与民族交融的艺术丰碑。早期昙曜五窟具深目高鼻、宽肩厚胸的健陀罗造像特征，雄健浑厚；中期汉化色彩渐浓，变为褒衣博带；晚期则转为汉族传统温润清秀的“秀骨清像”。它完整记录了印度佛教艺术本土化与中国化的演变脉络。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '精粹必赏：第20窟露天大佛（高13.7米），面相丰润嘴角微翘，兼具神圣庄严与鲜卑拓跋英武之气；第5窟高达17米的云冈第一大佛；第6窟雕满33幅佛传故事连环浮雕；以及第12窟“音乐窟”飞天乐伎所持排箫、琵琶，是古代乐舞艺术无价瑰宝。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '石窟开凿源自北魏高僧昙曜的坚定信仰。北魏太武帝曾发动惨烈“太武灭佛”，寺像尽毁。文成帝即位复兴佛法后，昙曜上书建议在武周塞开窟五所镌造大佛，将北魏开国五位帝王形象化为佛陀，文成帝欣然敕准，由此成就了武周山石壁上的千古艺术奇观。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 北魏早期（460-465年）：高僧昙曜奉旨开凿第16至20窟（昙曜五窟）；\n· 北魏盛期（471-494年）：孝文帝迁都前皇家开凿鼎盛；\n· 辽金明清：修筑木构窟檐保护石雕；\n· 1961与2001年：入选首批全国重点文保与世界文化遗产。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '建议由东向西按次序参观，重点细读第5、6窟及第16至20窟；午后斜阳映照第20窟露天大佛，是拍摄大佛光影立体感的黄金时刻；窟内请勿触碰风化岩壁，严禁开闪光灯，带耳机聆听更具沉浸感。',
    },
  ],
  故宫: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '北京故宫旧称紫禁城，地处北京中轴线核心，为明清两代皇家宫殿，始建于明永乐四年（1406年），永乐十八年落成。明清二十四位帝王在此执政起居。总占地72万平方米，建筑面积约15万平方米，是世界现存规模最大、保存最完好的木结构古建筑群与世界文化遗产。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '紫禁城总体布局严格遵循《周礼·考工记》“前朝后寝、左祖右社”规制。前朝三大殿体量巍峨、高台层叠，彰显天子王权；后寝六宫错落严整。黄琉璃瓦顶、青白石台基与朱红门柱交相辉映，是古代“天人合一”宇宙观与封建礼制哲学的实体空间集大成者。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '不可错过的国宝精华：太和殿屋脊十只整套脊兽与殿内金砖金漆雕龙宝座；保和殿后重达两百吨、雕有九条飞腾蟠龙的“大石雕”；珍宝馆内的九龙壁、金瓯永固杯；以及钟表馆内数百件机关精巧、报时精绝的十八世纪中外宫廷机械钟表。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '故宫不仅凝结了蒯祥等一代木作大匠的心血，更见证了“故宫文物南迁”的传奇。九一八事变后华北危殆，以马衡为代表的故宫学人将近两万箱绝世国宝装箱南迁，跋涉万余里翻越秦岭蜀道，历经十余年烽火硝烟，数百万件珍宝奇迹般无一损毁，守护了中华文脉薪火。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 明永乐十八年（1420年）：紫禁城落成，明成祖正式迁都北京；\n· 清代康乾盛世：多次修缮扩规，宫苑格局臻于完善；\n· 1925年：紫禁城收归国有，故宫博物院正式成立开放；\n· 1987年：被联合国教科文组织列入《世界遗产名录》。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '路线遵循中轴单向通行：午门入 → 太和门 → 前朝三大殿 → 后三宫 → 御花园 → 神武门出；强烈建议加购珍宝馆与钟表馆；务必提前7天实名预约门票，穿平底鞋游览并携带身份证件。',
    },
  ],
};

function matchCuratedKnowledge(poiName: string): GuideSection[] | null {
  for (const [key, sections] of Object.entries(CURATED_KNOWLEDGE_BASE)) {
    if (poiName.includes(key) || key.includes(poiName)) {
      return sections;
    }
  }
  return null;
}

// ==========================================
// 3. 通用高品质文化兜底生成器（结合真实属性，严格 60-140 字）
// ==========================================
function fallbackGuideContent(
  poiName: string,
  poiType: PoiType,
  meta?: PoiMetadata,
): AiGuideResult {
  const curated = matchCuratedKnowledge(poiName);
  if (curated) {
    return {
      poi_name: poiName,
      generated_at: new Date().toISOString(),
      disclaimer: DEFAULT_DISCLAIMER,
      sections: curated,
    };
  }

  const typeLabel = POI_TYPE_LABELS[poiType];
  const regionText = meta?.region ? `地处${meta.region}` : '具有深厚的地域文脉依托';
  const eraText = meta?.era ? `始建或兴盛于${meta.era}` : '承载着跨越时代的丰富历史遗存';
  const batchText = meta?.batch ? `，现为${meta.batch}` : (meta?.rating ? `，为国家${meta.rating}` : '');

  return {
    poi_name: poiName,
    generated_at: new Date().toISOString(),
    disclaimer: DEFAULT_DISCLAIMER,
    sections: [
      {
        type: 'background',
        title: '历史背景',
        content: `${poiName}为我国重要${typeLabel}${batchText}，${regionText}。史料与档案考证其${eraText}。千百年来历经不同时期的营建修缮与文脉传承，既是区域历史风貌的实物见证，更是中华优秀传统文化的重要空间遗存，具有很高的历史人文与学术考察价值。`,
      },
      {
        type: 'cultural',
        title: '文化解读',
        content: `解读${poiName}，核心在于领略其独特的营造风貌与思想意蕴。其建筑布局与空间序列巧妙融入传统堪舆哲理与自然山水，浑然天成；在文化内涵上承载着古代社会礼制思想或地域民俗审美，凝结着古代工匠的高超营造智慧与独特的精神气象。`,
      },
      {
        type: 'poetry',
        title: '主要看点',
        content: `游览${poiName}建议聚焦三大要点：一是标志性主体空间或殿堂展厅，感受宏大规制与严整格局；二是驻足细品古建构件、彩绘石雕、传世造像或珍贵碑刻题记，体悟精雕细琢之美；三是留心具有代表性的历史实物与陈列，这些是理解其文化底蕴的核心窗口。`,
      },
      {
        type: 'story',
        title: '人物故事',
        content: `漫长岁月里，${poiName}曾吸引众多名士贤达、文人墨客或能工巧匠在此驻留履痕。他们或主持营造、或游历题咏、或竭力守护文脉。近现代以来更有数代文博考古工作者深入田野开展调查与保护，这些真实的故事赋予了这座文化地标鲜活温润的历史温度。`,
      },
      {
        type: 'timeline',
        title: '朝代演变',
        content: `· 营造奠基：${eraText}，奠定核心空间格局与营造基底；\n· 历代传承：唐宋元明清历代迭有增修，丰富其文脉内涵；\n· 近现代保护：经历风霜修葺，列入文保名录实施科学保护；\n· 当代展示：成为传承优秀历史文化与增强文化自信的重要窗口。`,
      },
      {
        type: 'attraction',
        title: '参观建议',
        content: `建议参观遵循“通览全貌、精读重点、体悟文脉”的节奏。沿主线游览后，对核心古建或特色展品作慢速深度观摩；尽量选择光线充沛的时段，便于看清木石细节；配合现场说明标牌或语音讲解慢品细看，能更深切体悟其穿越千年的文化魅力。`,
      },
    ],
  };
}

// ==========================================
// 4. 高质量专业 Prompt 构造器（严格限制 60 到 140 汉字）
// ==========================================
function buildPrompt(
  poiName: string,
  poiType: PoiType,
  locale: string,
  meta?: PoiMetadata,
): { system: string; user: string } {
  const typeLabel = POI_TYPE_LABELS[poiType];
  const metaLines: string[] = [`- 景点名称：${poiName}`, `- 类别属性：${typeLabel}`];
  if (meta?.region) metaLines.push(`- 所在地区：${meta.region}`);
  if (meta?.address) metaLines.push(`- 详细地址：${meta.address}`);
  if (meta?.era) metaLines.push(`- 历史时代：${meta.era}`);
  if (meta?.category) metaLines.push(`- 遗存分类：${meta.category}`);
  if (meta?.batch) metaLines.push(`- 保护级别：${meta.batch}`);
  if (meta?.rating) metaLines.push(`- 旅游评级：${meta.rating}`);

  return {
    system: [
      '你是一位国家级金牌文化向导、资深古建筑研究员与文博学者。',
      '你的任务是为中国著名文化景点创作一份高水准、详实、凝练的深度结构化导游讲解。',
      '【写作核心原则】',
      '1. 言之有物、拒绝空话：充分调用你对该文化地标的真实历史知识储备，准确阐明真实历史朝代、营建时间、核心建筑形制、镇馆之宝、历史名人典故等，严禁泛泛而谈的套话。',
      '2. 字数严格限制：每个 section 的 content 长度必须严格控制在 60 到 140 个汉字，内容要精练详实、重点突出，适合移动端卡片阅读和语音朗读播报。',
      '3. 严格遵循输出格式：输出必须是严格的纯 JSON 格式，绝不能带有 Markdown 代码块包裹，不要输出任何额外闲聊。',
      '4. 字段规范：JSON 顶层必须且仅包含 `sections`、`disclaimer`、`poi_name`、`generated_at`。',
      '5. sections 必须包含且正好包含以下 6 个结构对象（顺序不可颠倒，每个 section 长度必须严格控制在 60 到 140 个汉字）：',
      '  (1) type="background", title="历史背景"：详述营建年代、历史背景及在华夏文脉中的重要地位。长度严格控制在 60 到 140 个汉字。',
      '  (2) type="cultural", title="文化解读"：从大木构架、斗拱形制、艺术流派、宗教哲学或思想制度等维度深入剖析“门道”。长度严格控制在 60 到 140 个汉字。',
      '  (3) type="poetry", title="主要看点"：聚焦 2~3 个绝不能错过的镇馆之宝/核心殿堂/彩塑壁画/碑刻细节。长度严格控制在 60 到 140 个汉字。',
      '  (4) type="story", title="人物故事"：讲述与该地标紧密相连的真实历史人物（帝王名将、文人墨客、守护名僧、考古学家梁思成林徽因等）的真实生动轶事。长度严格控制在 60 到 140 个汉字。',
      '  (5) type="timeline", title="朝代演变"：按历史朝代脉络（用换行和“· ”）清晰交代始建、历代修缮与保护的关键时间节点。长度严格控制在 60 到 140 个汉字。',
      '  (6) type="attraction", title="参观建议"：给出实操性极高的游览路线、最佳观赏时间/光线机位与注意事项。长度严格控制在 60 到 140 个汉字。',
      '6. disclaimer 统一输出："以上内容由 AI 文化向导生成，仅供参考；如需权威考古结论，请以文博机构官方资料为准。"',
      `7. 输出语言区域 locale=${locale}（简体中文）。`,
    ].join('\n'),
    user: [
      `请为下列地点生成专业深度的 AI 文化导游讲解：`,
      ...metaLines,
      '请根据该景点的真实档案，撰写一份详实、专业、生动的高水准导览。每个 section 内容长度必须严格控制在 60 到 140 个汉字之间。',
    ].join('\n'),
  };
}

// ==========================================
// 5. LLM 模型调用层（多供应商支持与容灾）
// ==========================================
async function callDeepSeekGuide(
  apiKey: string,
  prompt: { system: string; user: string },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.6,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('DeepSeek 未返回有效内容');
    }

    return extractJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function callQwenGuide(
  apiKey: string,
  prompt: { system: string; user: string },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          temperature: 0.6,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DashScope HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('DashScope 未返回有效内容');
    }

    return extractJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// 6. 服务主入口
// ==========================================
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', '仅支持 POST 请求。', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse('MISSING_SUPABASE_ENV', '服务端缺少 Supabase 环境变量配置。', 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('UNAUTHORIZED', '请先登录后再使用 AI 讲解功能。', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse('UNAUTHORIZED', '登录状态已失效，请重新登录。', 401);
    }

    const body = (await req.json()) as AiGuideRequest;
    const poiType = body.poi_type;
    const locale = (body.locale ?? 'zh-CN').trim();
    const poiName = normalizePoiName(body);

    if (!poiType || !POI_TYPE_LABELS[poiType]) {
      return errorResponse('INVALID_PARAMS', '景点类型缺失，请重新选择后重试。', 400);
    }

    if (!poiName || poiName === '文化地标') {
      return errorResponse('INVALID_PARAMS', '景点名称缺失，请重新选择后重试。', 400);
    }

    // 1. 获取 POI 权威元数据
    const meta = await fetchPoiMetadata(userClient, poiType, poiName, body.poi_id);

    // 2. 尝试大模型生成
    const deepSeekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const qwenKey = Deno.env.get('DASHSCOPE_API_KEY');

    if (deepSeekKey || qwenKey) {
      const prompt = buildPrompt(poiName, poiType, locale, meta);

      // 先尝试 DeepSeek
      if (deepSeekKey) {
        try {
          const llmPayload = await callDeepSeekGuide(deepSeekKey, prompt);
          const guideResult = normalizeGuideResult(llmPayload, poiName);
          return jsonResponse({ data: guideResult, error: null });
        } catch (dsErr) {
          console.error('[ai-guide] DeepSeek 调用失败，尝试备用方案:', dsErr);
        }
      }

      // 再尝试 Qwen / DashScope
      if (qwenKey) {
        try {
          const qwenPayload = await callQwenGuide(qwenKey, prompt);
          const guideResult = normalizeGuideResult(qwenPayload, poiName);
          return jsonResponse({ data: guideResult, error: null });
        } catch (qwErr) {
          console.error('[ai-guide] DashScope 调用失败:', qwErr);
        }
      }
    }

    // 3. 模型不可用或全部失败时，平滑降级至高水准文化知识库
    const fallbackResult = fallbackGuideContent(poiName, poiType, meta);
    return jsonResponse({ data: fallbackResult, error: null });
  } catch (err) {
    console.error('[ai-guide] 全局异常:', err);
    return errorResponse('INTERNAL_ERROR', 'AI 导游服务暂时不可用，请稍后重试。', 500);
  }
});
