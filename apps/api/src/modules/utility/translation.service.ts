import { Injectable } from "@nestjs/common";

const DICTIONARY: Record<string, string> = {
  // Products & Materials
  "iron": "حديد",
  "steel": "صلب",
  "cement": "أسمنت",
  "rebar": "حديد تسليح",
  "sand": "رمل",
  "gravel": "حصى",
  "aluminum": "ألومنيوم",
  "copper": "نحاس",
  "wood": "خشب",
  "concrete": "خرسانة",
  "brick": "طوب",
  "block": "بلوك",
  "glass": "زجاج",
  "paint": "دهان",
  "cable": "كابل",
  "wire": "سلك",
  "pipe": "أنبوب",
  "valve": "صمام",
  "fitting": "وصلة",
  "pump": "مضخة",
  "engine": "محرك",
  "machine": "آلة",
  "tool": "أداة",
  "equipment": "معدات",
  "material": "مواد",
  "casing": "غلاف",
  "sheet": "لوح",
  "plate": "صفيحة",
  "beam": "عارضة",
  "angle": "زاوية",
  "channel": "قناة",
  "tube": "أنبوب",
  "rod": "قضيب",
  "bar": "شريط",
  "bolt": "برغي",
  "nut": "صامولة",
  "screw": "مسمار لولبي",
  "washer": "حلقة معدنية",
  "gasket": "حشية",
  "seal": "ختم",
  "bearing": "محمل",
  "gear": "ترس",
  "shaft": "عمود دوران",
  "clutch": "قابض",
  "brake": "فرامل",
  "wheel": "عجلة",
  "tire": "إطار",
  "filter": "مرشح",
  "belt": "حزام",
  "hose": "خرطوم",
  "battery": "بطارية",
  "sensor": "مستشعر",
  "switch": "مفتاح",
  "relay": "مرحل",
  "fuse": "منصهر",
  
  // Services
  "service": "خدمة",
  "labor": "عمالة",
  "transportation": "نقل",
  "delivery": "توصيل",
  "installation": "تركيب",
  "maintenance": "صيانة",
  "repair": "إصلاح",
  "consulting": "استشارات",
  "design": "تصميم",
  "engineering": "هندسة",
  "management": "إدارة",
  "support": "دعم",
  "training": "تدريب",
  "rent": "إيجار",
  "lease": "تأجير",
  "fee": "رسوم",
  "charge": "تكلفة",
  "cost": "تكلفة",
  "price": "سعر",
  "discount": "خصم",
  "tax": "ضريبة",
  "vat": "ضريبة القيمة المضافة",

  // Business & Names
  "ali": "علي",
  "mughal": "مغال",
  "trading": "التجارية",
  "est": "مؤسسة",
  "establishment": "مؤسسة",
  "company": "شركة",
  "enterprise": "مؤسسة",
  "group": "مجموعة",
  "sons": "وأولاده",
  "brother": "أخ",
  "brothers": "إخوان",
  "industry": "صناعة",
  "industries": "صناعات",
  "contracting": "مقاولات",
  "logistics": "خدمات لوجستية",
  "supplies": "توريدات",
  "supply": "توريد",
  
  // Units & Quantities
  "tons": "أطنان",
  "ton": "طن",
  "kg": "كجم",
  "pcs": "قطع",
  "piece": "قطعة",
  "boxes": "صناديق",
  "box": "صندوق",
  "meters": "أمتار",
  "meter": "متر",
  "bag": "كيس",
  "bags": "أكياس",
  "pack": "حزمة",
  "packs": "حزم",
};

@Injectable()
export class TranslationService {
  translateEnToAr(text: string): string {
    if (!text) return "";
    const cleaned = text.trim().toLowerCase();

    // Direct match check
    if (DICTIONARY[cleaned]) {
      return DICTIONARY[cleaned];
    }

    // Split compound noun checks
    const words = cleaned.split(/\s+/);
    if (words.length > 1) {
      const translatedWords = words.map(w => DICTIONARY[w] || w);
      
      // If we recognized all words, and it's a 2-word noun (like "steel pipe"),
      // reverse it to match Arabic noun-adjective order ("أنبوب صلب").
      if (words.length === 2 && DICTIONARY[words[0]] && DICTIONARY[words[1]]) {
        return `${translatedWords[1]} ${translatedWords[0]}`;
      }
      
      // Otherwise, return translated words in original order
      return translatedWords.join(" ");
    }

    // Return capitalized first letter of original text as fallback, or original text
    return text;
  }
}
