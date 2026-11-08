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
// 2. 精编深度文化知识库（高水准权威兜底）
// ==========================================
const CURATED_KNOWLEDGE_BASE: Record<string, GuideSection[]> = {
  南禅寺: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '南禅寺大殿位于山西省忻州市五台县东冶镇李家庄，是中国现存最早的木结构建筑。根据殿内西平梁底部的墨书题记，该大殿重建于唐德宗建中三年（公元782年），距今已有一千二百余年历史。它不仅早于著名的佛光寺东大殿整整75年，而且因地处偏远、规模精炼，奇迹般躲过了唐武宗“会昌灭法”以及千百年来战火地震的浩劫，是弥足珍贵的唐代木构建筑实物孤例。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '大殿为单檐歇山顶建筑，面阔三间、进深三间，平面近方形。内部采用“彻上露明造”，没有天花板遮挡，梁架结构一览无余。其斗拱硕大雄健，出檐深远平缓，柱头微向内倾并带有生起，呈现出盛唐木构特有的沉稳浑厚与博大洗练。梁架间运用托脚和叉手承托脊檩，力学传递清晰纯粹，被建筑史学界誉为“中国古代大木作的活化石”。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '核心看点有三：第一是大殿木构本体，特别是雄大简练的五铺作双杪单栱与月梁，展示了唐代极高的木作几何力学水准；第二是殿内宽大的佛坛上供奉的17尊唐代泥塑彩绘造像，主尊释迦牟尼端坐中央，神态丰腴慈穆，衣褶线条如行云流水，与莫高窟唐代塑像同出一辙；第三是平梁下的珍贵唐代墨书题记，是实证其准确年代的国宝级铁证。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '南禅寺大殿的重新发现是中国近现代文博史上的一段传奇。20世纪初，日本学者曾断言“中国境内已无唐代木构建筑”。直到1953年，山西省文管会文物调查组在五台山区进行野外普查时，意外在偏僻的李家庄村发现了这座低调的山村小庙。当调查人员拂去梁架上的千年尘埃，辨认出“因旧名（时）大唐建中三年”的墨书纪年时，全中国乃至全世界建筑界为之震撼，彻底打破了昔日的学术偏见。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 唐代（782年）：唐建中三年完成大殿重修，奠定今日木构与彩塑主体；\n· 宋元明清：历代虽有小规模装修与补葺，但未改动唐代核心骨架与梁枋体系；\n· 1961年：被国务院公布为第一批全国重点文物保护单位；\n· 1974-1975年：国家组织落架大修，科学复原唐代歇山屋顶与构件，加固地基以传之永久。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '建议选择阳光晴好的上午参观，此时晨光斜照殿内，佛坛彩塑的光影轮廓最为分明动人；建议携带小型弱光手电筒，在不触碰文物的前提下仰观梁架交接与斗拱榫卯构造；参观时务必遵守保护规定，殿内严禁拍照与开启闪光灯，静心感受唐代殿堂静穆深远的宏大意境。',
    },
  ],
  陕西历史博物馆: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '陕西历史博物馆坐落于古都西安大雁塔西北侧，筹建于1983年，1991年正式建成开放，是中国第一座拥有现代设施的大型国家级博物馆。馆区建筑由建筑大师张锦秋领衔设计，采用“中央殿堂、四隅崇楼”的盛唐风貌与轴线对称格局，被誉为“古都明珠，华夏宝库”。馆藏文物多达170余万件（组），上起远古旧石器时代，下至明清，时间跨度达一百多万年。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '陕历博不仅是一座展示文物的殿堂，更是一部立体生动的中华五千年文明演进史。陕西作为周、秦、汉、唐等十四个王朝建都的核心腹地，馆藏以商周青铜器、历代陶俑、汉唐金银玉器以及唐墓壁画最为卓绝。这些文物系统反映了中国统一多民族国家的形成与繁荣，展现了兼容并包的盛唐气度与丝绸之路东西方文明交融碰撞的辉煌篇章。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '四大绝世镇馆之宝不容错过：其一是被列为首批禁止出国（境）展览文物的“镶金兽首玛瑙杯”，材质晶莹雕琢鬼斧神工；其二是战国晚期体现秦国高度严密军令制度的“杜虎符”，错金铭文清晰可辨；其三是出土于何家村窖藏的“舞马衔杯纹银壶”，生动再现了玄宗千秋节宫廷驯马衔杯祝寿的传奇；其四是唐代壁画珍品馆中的《客使图》与《阙楼图》，笔触磅礴，为中国古代绘画最高水准。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '陕历博的创立承载着周恩来总理的深切嘱托。早在1973年，周总理陪同外宾访问延安与西安时，看到陕西出土的浩瀚瑰宝受制于简陋展馆而无法妥善展陈，深情嘱托：“陕西文物很多，应该在西安建一座现代化的高水平博物馆。”这一嘱托成为后来国家重点立项建设陕西历史博物馆的渊源，几代文博学者历经数十载发掘与守护，终使国宝在今日得以震撼世人。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 史前至西周（第一展厅）：从蓝田猿人、半坡聚落到西周宗法礼乐青铜鼎盛；\n· 秦汉时期（第二展厅）：从秦扫六合的大一统帝国气派到汉代丝路通达的汉家威仪；\n· 魏晋至盛唐（第三展厅）：民族大融合直至隋唐万国来朝的极盛文明顶峰；\n· 1991年至今：新馆落成，享誉海内外，成为世界了解中华文明的必到首选。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '务必提前通过官方公众号实名预约基础门票；强烈建议加购“大唐遗宝——何家村窖藏展”与“唐代壁画珍品馆”专题票，方能领略陕历博最高艺术价值所在；参观建议预留3至4小时，可租借智能导览机或预约专业讲解员深度导览，避开周末节假日的入场高峰。',
    },
  ],
  秦始皇帝陵博物院: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '秦始皇帝陵博物院位于陕西省西安市临潼区，是建立在世界上规模最大、结构最奇特、内涵最丰富的帝王陵墓——秦始皇陵遗址之上的国家5A级风景名胜区。秦陵始建于公元前247年（秦王嬴政即位之初），历时39年营建完成。1974年春兵马俑坑被偶然发现，1979年秦始皇兵马俑博物馆正式开馆，1987年被联合国教科文组织列入中国首批《世界遗产名录》，被誉为“世界第八大奇迹”。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '兵马俑军阵是秦代军事组织、军备生产以及雕塑艺术的集大成者。近八千件陶俑、陶马均按照实战编制排列，面部神态千人千面，身着不同铠甲服饰，真实复刻了大秦帝国横扫六合、一统天下的雄壮军威。秦俑不仅是古代丧葬制度由“人殉”向“俑殉”的历史性进步，其高超的模塑结合写实技艺与青铜冷兵器防腐工艺，更代表了公元前三世纪人类工业文明与造型艺术的最高巅峰。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '核心必看精华：其一是“一号坑”，庞大的步车混编主力军阵前后呼应，六千余件秦俑气吞万里；其二是“二号坑”，展示了弩兵、骑兵、战车混编的高机动精锐方阵，国宝级“跪射俑”靴底纳线与发髻肌理栩栩如生；其三是“三号坑”，为整个地下军阵的统帅指挥部；其四是铜车马展厅，出土的两乘大型彩绘青铜车马，零件过万，被誉为“青铜之冠”。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '1974年3月，临潼西杨村村民杨志发等人在抗旱打井时，偶然从地下深处挖出了一尊陶俑头和残缺的铜镞。当地文化馆考古干事赵康民敏锐意识到这是重要文物，迅速进行了清理与拼对。随后，以袁仲一先生为代表的陕西省考古队入驻麦田现场进行科学钻探，终于揭开了沉睡两千二百余年的地下军阵全貌，袁仲一先生也因此被誉为“兵马俑之父”。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 公元前247年-前208年：秦王嬴政主持营建陵园与地下陪葬军阵；\n· 秦末汉初：历经项羽入关兵火焚毁木构顶棚，兵马俑坑发生坍塌并深埋于厚土；\n· 1974年：当地农民打井意外揭开兵马俑发现序幕，考古队进驻发掘；\n· 1987年：列入《世界遗产名录》；2009年秦始皇帝陵遗址公园整体向公众开放。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '推荐最佳游览动线：一号坑（宏观感受军阵气势）→ 三号坑（统帅指挥幕僚部）→ 二号坑（近距离观摩跪射俑精微细节）→ 铜车马博物馆（欣赏青铜冶炼巅峰）；随后可乘坐景区免费摆渡车前往秦始皇陵丽山园遗址，登封土堆、看百戏俑坑与文官俑坑，体验完整的秦始皇陵文明全貌。',
    },
  ],
  云冈石窟: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '云冈石窟位于山西省大同市城西十六公里的武周山南麓，始凿于北魏文成帝和平初年（公元460年），是由北魏皇室主持开凿的第一座皇家石窟寺，被列为第一批全国重点文物保护单位与世界文化遗产。石窟依山开凿，东西绵延一公里，主要洞窟45个，大小造像59000余尊，是中国早期佛教石窟艺术的杰出代表，被誉为东方石雕艺术精魂。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '云冈石窟在学术上被视为中西文化交融与中华民族融合的艺术丰碑。早期由高僧昙曜主持开凿的“昙曜五窟”，具有深目高鼻、宽肩厚胸的健陀罗与马图拉艺术特征，气魄雄伟；中期洞窟汉化色彩渐浓，褒衣博带、面容清秀；晚期则彻底转变为中国传统温婉内敛的“秀骨清像”风格。它完整见证了外来印度佛教造像艺术中国化的全过程。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '核心看点首推第20窟露天大佛（高13.7米），大佛面相丰润，嘴角微翘，双目凝神，兼具神圣威严与北方拓跋鲜卑的雄健豪迈；其次是第5窟高达17米的云冈最大坐佛；再次是第6窟“第一伟窟”，中心塔柱上下两层雕刻佛传故事图33幅，宛如连环画般精微传神；此外“音乐窟”（第12窟）雕刻的排箫、箜篌、琵琶乐伎，是研究中国古代音乐舞蹈的无价宝藏。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '云冈石窟的开凿源于北魏高僧昙曜的坚定信仰与政治智慧。北魏太武帝拓跋焘曾发动惨烈的“太武灭佛”，佛教寺院造像毁坏殆尽。文成帝即位后下诏复兴佛法，昙曜上书建议：“在京城西武周塞，凿山石壁，开窟五所，镌建佛像各一，高者七十尺，中者六十尺，雕饰奇伟，冠于一世。”文成帝欣然恩准，将北魏五位皇帝的形象与大佛合二为一，从此开启了武周山石壁上的千古奇观。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 北魏和平初年（460-465年）：高僧昙曜主持开凿第16至20窟（昙曜五窟）；\n· 北魏迁都洛阳前（471-494年）：孝文帝时期皇家倾国力开凿，进入极盛中期；\n· 辽金元明清：历代建木构窟檐与补彩，明清设防卫城堡；\n· 1961年与2001年：入选第一批全国重点文物保护单位与世界文化遗产。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '建议由东向西按编号顺序参观，重点细看第5、6窟以及第16至20窟（昙曜五窟）；午后阳光斜照进第20窟露天大佛，是拍摄大佛光影层次的最佳时刻；窟内石雕表面历经千年风化较为脆弱，请勿用手触摸，禁止开启强光闪光灯，配合耳机讲解深度感受北魏刀斧之间的文明温度。',
    },
  ],
  故宫: [
    {
      type: 'background',
      title: '历史背景',
      content:
        '故宫（北京故宫博物院），旧称紫禁城，位于北京中轴线的中心，是中国明清两代的皇家宫殿，始建于明成祖永乐四年（1406年），永乐十八年（1420年）落成。这里曾先后有明清二十四位皇帝在此君临天下、处理政务与起居生活。故宫占地面积达72万平方米，建筑面积约15万平方米，是世界上现存规模最大、保存最为完整的木质结构古建筑群，被联合国教科文组织列为世界文化遗产。',
    },
    {
      type: 'cultural',
      title: '文化解读',
      content:
        '紫禁城的总体布局严格依据《周礼·考工记》中“前朝后寝、左祖右社”的皇城营建规制。前朝以太和、中和、保和三大殿为核心，体量巍峨、殿陛高广，彰显至高无上的天子王权；后寝以乾清、交泰、坤宁三宫及东西六宫为中心，严整雅致。黄琉璃瓦顶、青白石台基、金扉朱柱的色调搭配，不仅是皇家最高等级建筑的巅峰艺术表达，更是中国古代“天人合一”与封建礼制哲学的实体具象化。',
    },
    {
      type: 'poetry',
      title: '主要看点',
      content:
        '不可错过的国宝精华：第一是“太和殿”，中国现存规制最高、屋顶重檐庑殿顶上饰有十只整套脊兽的唯一大殿，殿内金砖铺地，雕龙宝座气度恢弘；第二是保和殿后重达两百余吨的“大石雕”，上面雕刻九条蟠龙飞腾于祥云海浪之中；第三是珍宝馆内的金瓯永固杯、九龙壁以及乾隆花园的精巧亭阁；第四是钟表馆内数百件巧夺天工、机关精密的明清十八世纪西洋宫廷机械钟表。',
    },
    {
      type: 'story',
      title: '人物故事',
      content:
        '紫禁城的落成不仅凝聚了蒯祥等传奇御用木作大匠的匠心，更在近代经历了惊心动魄的“故宫文物南迁”。1931年九一八事变后，华北危急。为避免国宝毁于侵华日军战火，以易培基、马衡为代表的故宫学人毅然将近两万箱国宝古物装箱南迁，辗转万余里，翻越秦岭、蜀道，历经十余年烽火连天，数百万件绝世珍宝奇迹般几无损失，谱写了一曲中华知识分子用生命守护文明命脉的悲壮史诗。',
    },
    {
      type: 'timeline',
      title: '朝代演变',
      content:
        '· 明永乐十八年（1420年）：紫禁城初建落成，明成祖朱棣正式迁都北京；\n· 明清两代：历经明末战火毁损与清顺治、康熙、乾隆朝屡次复建重修与扩规；\n· 1925年：紫禁城收归国有，故宫博物院正式宣告成立并对公众开放；\n· 1987年：列入联合国教科文组织《世界遗产名录》。',
    },
    {
      type: 'attraction',
      title: '参观建议',
      content:
        '经典参观路线建议遵循“单向参观”原则：午门进入 → 金水桥 → 太和门 → 太和殿/中和殿/保和殿 → 乾清门/乾清宫/坤宁宫 → 御花园 → 神武门出；若时间充裕，强烈建议由东六宫分流前往宁寿宫区（珍宝馆、石鼓馆、九龙壁）；建议提前7天通过官方小程序实名预约，携带身份证件，穿舒适平底鞋步行。',
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
// 3. 通用高品质文化兜底生成器（结合真实属性）
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
        content: `${poiName}作为我国重要的${typeLabel}${batchText}，${regionText}。根据史料考证与文博档案，该地标${eraText}。千百年来，这里经历了不同历史时期的营建、修缮与传承，不仅是地方历史变迁的鲜活见证，更是中华优秀传统文化在特定地域空间中的璀璨结晶，具有极高的人文历史与科学考证价值。`,
      },
      {
        type: 'cultural',
        title: '文化解读',
        content: `深入解读${poiName}，其核心魅力在于其独特的规制风貌与思想意蕴。在空间形态上，它巧妙融汇了中国传统堪舆哲理与造物智慧，建筑形制、空间序列与周遭自然环境浑然一体。在文化内涵上，它承载着古代社会礼制制度、哲学审美或宗教民俗记忆，凝结了古代劳动人民卓绝的营造技艺与独特的精神气象。`,
      },
      {
        type: 'poetry',
        title: '主要看点',
        content: `游览${poiName}，建议重点聚焦以下核心精粹：首先是其标志性主体空间或代表性殿堂展厅，体察整体布局的大气恢弘；其次是仔细品鉴古建构件、彩绘石雕、传世造像或珍贵碑刻题记等细部工艺，感受古代工匠精益求精的微观造诣；最后留心具有代表性的陈列文物或历史痕迹，这些往往是解码其千年文脉的最佳切口。`,
      },
      {
        type: 'story',
        title: '人物故事',
        content: `在漫长的历史长河中，${poiName}曾吸引了诸多文人贤达、名士重臣或高僧名匠在此留下履痕。他们或在此主持营缮、或登临凭吊赋诗留墨、或为守护这方文脉倾注心血。近现代以来，更有数代考古学家与文保工作者深入乡野，开展科学考辨与保护抢救，这些生动的故事为这座古老地标注入了历久弥新的温度与力量。`,
      },
      {
        type: 'timeline',
        title: '朝代演变',
        content: `· 营建奠基：${eraText}，奠定核心空间格局与营造基底；\n· 历代兴盛：宋元明清历代迭有增修或扩建，持续丰富其文化内涵；\n· 沧桑变迁：近代饱经风雨沧桑，文脉弦歌不辍；\n· 当代保护：列入重点文物保护名录并实施科学修缮，成为向公众弘扬文化自信的重要阵地。`,
      },
      {
        type: 'attraction',
        title: '参观建议',
        content: `建议参观时遵循“主线通览、重点精读、周边体悟”的节奏进行。先沿中轴主线通览全貌，再对核心展陈或经典古建进行沉浸式细致观摹；建议尽量选择光线充沛的时段出行，便于欣赏建筑结构与装饰细节；参观过程中结合现场说明标牌或专业语音播报慢步细品，更能深切体会其历经千载的文化回响。`,
      },
    ],
  };
}

// ==========================================
// 4. 高质量专业 Prompt 构造器
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
      '你的任务是为中国著名文化景点创作一份高水准、详实、引人入胜的深度结构化导游讲解。',
      '【写作核心原则】',
      '1. 言之有物、拒绝空话：充分调用你对该文化地标的真实历史知识储备，准确阐明真实历史朝代、营建时间、核心建筑形制、镇馆之宝、历史名人典故等，严禁“这里历史悠久、建议多看”等泛泛而谈的套话。',
      '2. 文辞生动优美、兼具深度与普及性：既要有文史与建筑学术底蕴，又要语言通俗流畅、画面感强，非常适合游客在手机端沉浸式阅读或语音朗读播报。',
      '3. 严格遵循输出格式：输出必须是严格的纯 JSON 格式，绝不能带有 Markdown 代码块包裹，不要输出任何额外闲聊。',
      '4. 字段规范：JSON 顶层必须且仅包含 `sections`、`disclaimer`、`poi_name`、`generated_at`。',
      '5. sections 必须包含且正好包含以下 6 个结构对象（顺序不可颠倒）：',
      '  (1) type="background", title="历史背景"：详述营建年代、选址历史缘由、当时政治文化背景及在华夏文脉中的重要地位。字数 150-250 字。',
      '  (2) type="cultural", title="文化解读"：从大木构架、斗拱形制、艺术流派、宗教哲学或思想制度等维度深入剖析“门道”，讲出其艺术与文化精髓。字数 150-250 字。',
      '  (3) type="poetry", title="主要看点"：聚焦 2~3 个绝不能错过的镇馆之宝/核心殿堂/彩塑壁画/碑刻细节，进行特写镜头式的具象生动描绘。字数 150-250 字。',
      '  (4) type="story", title="人物故事"：讲述与该地标紧密相连的真实历史人物（帝王名将、文人墨客、守护名僧、考古学家梁思成林徽因等）的具体真实轶事。字数 150-250 字。',
      '  (5) type="timeline", title="朝代演变"：按历史朝代脉络（用换行和“· ”）清晰交代始建、历代修缮、近代发现与当代保护的关键时间节点。字数 120-200 字。',
      '  (6) type="attraction", title="参观建议"：给出实操性极高的行家导览路线、最佳观赏时间/光线机位、细部观摩建议与注意事项。字数 120-200 字。',
      '6. disclaimer 统一输出："以上内容由 AI 文化向导生成，仅供参考；如需权威考古结论，请以文博机构官方资料为准。"',
      `7. 输出语言区域 locale=${locale}（简体中文）。`,
    ].join('\n'),
    user: [
      `请为下列地点生成专业深度的 AI 文化导游讲解：`,
      ...metaLines,
      '请根据该景点的真实档案，撰写一份详实、专业、生动的高水准导览。',
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
