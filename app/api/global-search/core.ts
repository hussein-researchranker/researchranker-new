import path from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";

type GlobalArticle = {
  id: string;
  pmid?: string;
  title: string;
  journal: string;
  pubdate: string;
  authors: string;
  doi: string;
  abstract: string;
  source: string;
  sourceUrl: string;
  pubmedUrl?: string;
  quartile: string;
  indexingStatus: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  issn: string;
  matchConfidence: string;
};

type ScimagoJournal = {
  title: string;
  normalizedTitle: string;
  titleTokens: string[];
  issns: string[];
  quartile: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  categories: string;
};

type CrossrefAuthor = {
  given?: string;
  family?: string;
  name?: string;
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  subtitle?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  publisher?: string;
  ISSN?: string[];
  "issn-type"?: Array<{
    value?: string;
    type?: string;
  }>;
  issued?: {
    "date-parts"?: number[][];
  };
  published?: {
    "date-parts"?: number[][];
  };
  URL?: string;
  type?: string;
  subject?: string[];
};

type CrossrefListResponse = {
  message?: {
    items?: CrossrefWork[];
  };
};

type CrossrefSingleResponse = {
  message?: CrossrefWork;
};
type OpenAlexSource = {
  display_name?: string;
  issn_l?: string;
  issn?: string[];
  host_organization_name?: string;
};

type OpenAlexWork = {
  id?: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  publication_date?: string;
  primary_location?: {
    source?: OpenAlexSource | null;
    landing_page_url?: string;
    pdf_url?: string;
  } | null;
  locations?: Array<{
    source?: OpenAlexSource | null;
    landing_page_url?: string;
    pdf_url?: string;
  }>;
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
    any_repository_has_fulltext?: boolean;
  };
};

type OpenAlexResponse = {
  results?: OpenAlexWork[];
};
let scimagoCache: ScimagoJournal[] | null = null;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPublicationDate(work: CrossrefWork) {
  const dateParts =
    work.published?.["date-parts"]?.[0] ||
    work.issued?.["date-parts"]?.[0] ||
    [];

  if (!dateParts.length) return "";

  const [year, month, day] = dateParts;

  return [year, month, day].filter(Boolean).join("-");
}

function getAuthors(authors?: CrossrefAuthor[]) {
  if (!authors || authors.length === 0) {
    return "";
  }

  return authors
    .slice(0, 8)
    .map((author) => {
      if (author.name) return cleanText(author.name);

      const given = cleanText(author.given);
      const family = cleanText(author.family);

      return [given, family].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function getYearFromDate(value: string) {
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function parseYear(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function looksLikeDoi(value: string) {
  return /^10\.\d{4,9}\/\S+$/i.test(value.trim());
}
function normalizeArabicText(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/گ/g, "ك")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ژ/g, "ز")
    .replace(/\s+/g, " ")
    .trim();
}

function hasArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

type ArabicExpansionGroup = {
  keys: string[];
  terms: string[];
};

const arabicExpansionGroups: ArabicExpansionGroup[] = [
  {
    keys: ["غسيل الكلى", "غسل الكلى", "الديلزه", "ديالز", "ديلزة", "غسيل كلوي", "الفشل الكلوي", "قصور الكلى", "امراض الكلى", "الكلى"],
    terms: [
      "hemodialysis",
      "dialysis",
      "renal dialysis",
      "chronic kidney disease",
      "CKD",
      "end stage renal disease",
      "ESRD",
      "renal failure",
      "kidney failure",
      "renal replacement therapy",
      "uremia",
      "uremic toxins",
    ],
  },
  {
    keys: ["البريتون", "غسيل بريتوني", "الغسيل البريتوني", "الديلزه البريتونيه"],
    terms: [
      "peritoneal dialysis",
      "continuous ambulatory peritoneal dialysis",
      "CAPD",
      "automated peritoneal dialysis",
      "peritoneal membrane",
    ],
  },
  {
    keys: ["زراعة الكلى", "زرع الكلى", "الكلية المزروعة", "زرع كلية"],
    terms: [
      "kidney transplantation",
      "renal transplantation",
      "graft survival",
      "transplant rejection",
      "immunosuppression",
    ],
  },
  {
    keys: ["سكري", "السكري", "مرض السكري", "داء السكري", "السكر", "سكر الدم"],
    terms: [
      "diabetes mellitus",
      "type 2 diabetes",
      "T2DM",
      "type 1 diabetes",
      "hyperglycemia",
      "blood glucose",
      "insulin resistance",
      "glycemic control",
      "HbA1c",
    ],
  },
  {
    keys: ["ما قبل السكري", "قبل السكري", "مقدمات السكري", "اختلال السكر"],
    terms: [
      "prediabetes",
      "impaired fasting glucose",
      "impaired glucose tolerance",
      "insulin resistance",
      "metabolic syndrome",
    ],
  },
  {
    keys: ["السمنه", "السمنة", "زيادة الوزن", "البدانه"],
    terms: [
      "obesity",
      "overweight",
      "body mass index",
      "BMI",
      "adiposity",
      "visceral fat",
      "metabolic syndrome",
    ],
  },
  {
    keys: ["الدهون", "دهون الدم", "الكولسترول", "الكوليسترول", "الشحوم", "بروفايل الدهون"],
    terms: [
      "lipid profile",
      "cholesterol",
      "triglycerides",
      "HDL cholesterol",
      "LDL cholesterol",
      "VLDL",
      "dyslipidemia",
      "atherogenic index",
    ],
  },
  {
    keys: ["الكبد", "وظائف الكبد", "التهاب الكبد", "الكبد الدهني", "اليرقان"],
    terms: [
      "liver function tests",
      "LFT",
      "ALT",
      "AST",
      "bilirubin",
      "albumin",
      "fatty liver disease",
      "NAFLD",
      "hepatitis",
      "jaundice",
    ],
  },
  {
    keys: ["القلب", "امراض القلب", "الاوعيه الدمويه", "الشرايين", "جلطه", "احتشاء"],
    terms: [
      "cardiovascular disease",
      "heart disease",
      "coronary artery disease",
      "myocardial infarction",
      "atherosclerosis",
      "vascular disease",
      "cardiac biomarkers",
    ],
  },
  {
    keys: ["ضغط الدم", "ارتفاع الضغط", "الضغط"],
    terms: [
      "hypertension",
      "blood pressure",
      "systolic blood pressure",
      "diastolic blood pressure",
      "cardiovascular risk",
    ],
  },
  {
    keys: ["الغده الدرقيه", "الغدة الدرقية", "الدرقيه", "الثيروكسين", "خمول الغده"],
    terms: [
      "thyroid gland",
      "hypothyroidism",
      "hyperthyroidism",
      "TSH",
      "free T4",
      "thyroxine",
      "levothyroxine",
      "thyroid hormones",
    ],
  },
  {
    keys: ["العظام", "هشاشه العظام", "هشاشة العظام", "الكسر", "الكسور", "فيتامين د", "الكالسيتونين", "الغده جار الدرقيه"],
    terms: [
      "bone mineral density",
      "osteoporosis",
      "fracture risk",
      "bone fracture",
      "vitamin D",
      "calcitonin",
      "parathyroid hormone",
      "PTH",
      "CKD-MBD",
      "mineral bone disorder",
    ],
  },
  {
    keys: ["الزهايمر", "الخرف", "الذاكره", "التدهور المعرفي"],
    terms: [
      "Alzheimer disease",
      "dementia",
      "cognitive decline",
      "memory impairment",
      "neurodegeneration",
      "amyloid beta",
      "tau protein",
    ],
  },
  {
    keys: ["التوحد", "طيف التوحد", "اعراض التوحد", "الاطفال التوحد", "التوحد عند الاطفال"],
    terms: [
      "autism",
      "autism spectrum disorder",
      "ASD",
      "autistic symptoms",
      "children",
      "neurodevelopmental disorder",
      "behavioral symptoms",
      "childhood autism",
    ],
  },
  {
    keys: ["الرصاص", "تسمم الرصاص", "رصاص الدم", "المعادن الثقيله", "المعادن الثقيلة"],
    terms: [
      "lead poisoning",
      "blood lead level",
      "BLL",
      "heavy metals",
      "lead exposure",
      "environmental lead",
      "neurotoxicity",
      "childhood lead exposure",
    ],
  },
  {
    keys: ["الكادميوم", "الزئبق", "الزرنيخ", "النحاس", "الزنك", "العناصر النادره", "العناصر الزهيده"],
    terms: [
      "cadmium",
      "mercury",
      "arsenic",
      "copper",
      "zinc",
      "trace elements",
      "toxic metals",
      "environmental toxicology",
      "bioaccumulation",
    ],
  },
  {
    keys: ["الاجهاد التاكسدي", "الاجهاد التأكسدي", "الاكسده", "مضادات الاكسده", "الجذور الحره"],
    terms: [
      "oxidative stress",
      "antioxidant",
      "reactive oxygen species",
      "ROS",
      "free radicals",
      "MDA",
      "malondialdehyde",
      "TAS",
      "SOD",
      "CAT",
      "GPx",
    ],
  },
  {
    keys: ["الالتهاب", "التهابات", "السيتوكينات", "انترلوكين", "انترلوكين 6"],
    terms: [
      "inflammation",
      "inflammatory biomarkers",
      "cytokines",
      "interleukin",
      "IL-6",
      "TNF alpha",
      "CRP",
      "systemic inflammation",
    ],
  },
  {
    keys: ["المناعه", "المناعة", "امراض مناعيه", "المناعه الذاتيه"],
    terms: [
      "immune system",
      "immunity",
      "autoimmune disease",
      "autoimmunity",
      "immune response",
      "immunology",
    ],
  },
  {
    keys: ["السرطان", "اورام", "الاورام", "سرطان الثدي", "سرطان القولون", "سرطان الرئه"],
    terms: [
      "cancer",
      "tumor",
      "neoplasm",
      "oncology",
      "breast cancer",
      "colorectal cancer",
      "lung cancer",
      "cancer biomarkers",
      "carcinogenesis",
    ],
  },
  {
    keys: ["فقر الدم", "الانيميا", "الهيموغلوبين", "نقص الحديد"],
    terms: [
      "anemia",
      "hemoglobin",
      "iron deficiency",
      "ferritin",
      "transferrin",
      "erythropoietin",
    ],
  },
  {
    keys: ["البكتريا", "البكتيريا", "جراثيم", "الميكروبات", "الميكروبيوم", "الاحياء المجهريه"],
    terms: [
      "bacteria",
      "bacterial infection",
      "microbiology",
      "microbiome",
      "microbial",
      "pathogens",
      "antimicrobial resistance",
    ],
  },
  {
    keys: ["الفايروس", "الفيروس", "الفيروسات", "كورونا", "كوفيد"],
    terms: [
      "virus",
      "viral infection",
      "virology",
      "COVID-19",
      "SARS-CoV-2",
      "coronavirus",
      "viral disease",
    ],
  },
  {
    keys: ["المضادات الحيويه", "المضاد الحيوي", "مقاومة المضادات", "مقاومه المضادات"],
    terms: [
      "antibiotics",
      "antimicrobial resistance",
      "antibiotic resistance",
      "multidrug resistance",
      "bacterial resistance",
    ],
  },
  {
    keys: ["البروتين", "البروتينات", "الانزيم", "الانزيمات", "الايض", "التمثيل الغذائي"],
    terms: [
      "protein",
      "proteins",
      "enzyme",
      "enzymes",
      "metabolism",
      "metabolic pathway",
      "biochemical pathway",
      "protein structure",
      "enzyme kinetics",
    ],
  },
  {
    keys: ["الجينات", "الوراثه", "الوراثة", "دي ان اي", "الدنا", "الحمض النووي", "التعبير الجيني"],
    terms: [
      "genes",
      "genetics",
      "genomics",
      "DNA",
      "RNA",
      "gene expression",
      "genetic variation",
      "mutation",
      "polymorphism",
    ],
  },
  {
    keys: ["الخلايا", "الخليه", "الخلية", "موت الخلايا", "الاستماته"],
    terms: [
      "cell",
      "cells",
      "cell biology",
      "apoptosis",
      "cell death",
      "cell signaling",
      "cell proliferation",
    ],
  },
  {
    keys: ["الماء", "المياه", "تلوث المياه", "الانهار", "دجله", "الفرات", "شط العرب"],
    terms: [
      "water pollution",
      "water quality",
      "rivers",
      "Tigris River",
      "Euphrates River",
      "Shatt Al-Arab",
      "aquatic environment",
      "environmental contamination",
    ],
  },
  {
    keys: ["اللدائن الدقيقه", "البلاستيك الدقيق", "الميكروبلاستك", "الميكروبلاستيك", "جسيمات البلاستيك"],
    terms: [
      "microplastics",
      "plastic particles",
      "nanoplastics",
      "microplastic exposure",
      "environmental microplastics",
      "endocrine disruption",
      "oxidative stress",
    ],
  },
  {
    keys: ["التلوث", "تلوث الهواء", "تلوث البيئه", "الملوثات", "المخاطر البيئيه"],
    terms: [
      "pollution",
      "air pollution",
      "environmental pollution",
      "environmental risk",
      "contaminants",
      "toxicology",
      "public health",
    ],
  },
  {
    keys: ["النبات", "النباتات", "الزراعه", "المحاصيل", "التربه", "الري"],
    terms: [
      "plants",
      "plant science",
      "agriculture",
      "crops",
      "soil",
      "irrigation",
      "crop yield",
      "plant physiology",
    ],
  },
  {
    keys: ["الذكاء الاصطناعي", "ذكاء اصطناعي", "تعلم الاله", "تعلم الآلة", "التعلم العميق", "الشبكات العصبيه", "الشبكات العصبية"],
    terms: [
      "artificial intelligence",
      "AI",
      "machine learning",
      "deep learning",
      "neural network",
      "computer vision",
      "natural language processing",
      "data science",
      "algorithm",
    ],
  },
  {
    keys: ["الامن السيبراني", "الأمن السيبراني", "امن المعلومات", "اختراق", "الهجمات الالكترونيه"],
    terms: [
      "cybersecurity",
      "information security",
      "cyber attack",
      "intrusion detection",
      "malware detection",
      "network security",
      "threat detection",
    ],
  },
  {
    keys: ["الحاسوب", "الحاسبات", "علوم الحاسوب", "البرمجه", "البرمجة", "البيانات", "الخوارزميات"],
    terms: [
      "computer science",
      "programming",
      "software engineering",
      "data mining",
      "big data",
      "algorithms",
      "database",
      "information systems",
    ],
  },
  {
    keys: ["الشبكات", "انترنت الاشياء", "انترنت الأشياء", "الحوسبه السحابيه", "الحوسبة السحابية"],
    terms: [
      "computer networks",
      "internet of things",
      "IoT",
      "cloud computing",
      "edge computing",
      "wireless networks",
      "network protocols",
    ],
  },
  {
    keys: ["الهندسه", "الهندسة", "كهرباء", "ميكانيك", "مدني", "مواد"],
    terms: [
      "engineering",
      "electrical engineering",
      "mechanical engineering",
      "civil engineering",
      "materials engineering",
      "optimization",
      "design",
    ],
  },
  {
    keys: ["الفيزياء", "فيزياء", "الكم", "الضوء", "البصريات", "الحراره"],
    terms: [
      "physics",
      "quantum physics",
      "optics",
      "thermodynamics",
      "mechanics",
      "electromagnetism",
      "materials physics",
    ],
  },
  {
    keys: ["الكيمياء", "كيمياء", "التحليل الكيميائي", "المركبات", "الجزيئات"],
    terms: [
      "chemistry",
      "analytical chemistry",
      "organic chemistry",
      "inorganic chemistry",
      "chemical compounds",
      "molecules",
      "synthesis",
    ],
  },
  {
    keys: ["الكيمياء الحياتيه", "الكيمياء الحيويه", "الكيمياء الحياتية", "الكيمياء الحيوية", "بايوكيمياء"],
    terms: [
      "biochemistry",
      "biochemical",
      "clinical biochemistry",
      "molecular biology",
      "enzymes",
      "proteins",
      "metabolism",
      "biomarkers",
    ],
  },
  {
    keys: ["التربيه", "التربية", "التعليم", "التعلم", "طرائق التدريس", "طرق التدريس", "المناهج", "الطلاب", "الطلبه"],
    terms: [
      "education",
      "teaching",
      "learning",
      "curriculum",
      "students",
      "pedagogy",
      "teaching methods",
      "instructional strategy",
      "classroom",
    ],
  },
  {
    keys: ["الذكاءات المتعدده", "الذكاءات المتعددة", "جاردنر"],
    terms: [
      "multiple intelligences",
      "Gardner theory",
      "teaching strategy",
      "educational strategy",
      "student skills",
      "oral expression",
    ],
  },
  {
    keys: ["التعبير الشفوي", "المهارات الشفويه", "المهارات الشفوية", "اللغة العربية", "اللغه العربيه"],
    terms: [
      "oral expression",
      "speaking skills",
      "oral communication",
      "Arabic language",
      "language teaching",
      "language learning",
    ],
  },
  {
    keys: ["علم النفس", "النفس", "السلوك", "الادراك", "الصحه النفسيه"],
    terms: [
      "psychology",
      "behavior",
      "cognition",
      "mental health",
      "psychological",
      "emotion",
      "personality",
    ],
  },
  {
    keys: ["الاجتماع", "علم الاجتماع", "المجتمع", "الثقافه", "الثقافة"],
    terms: [
      "sociology",
      "social science",
      "society",
      "community",
      "culture",
      "social behavior",
    ],
  },
  {
    keys: ["الاداره", "الإدارة", "الاعمال", "الأعمال", "القياده", "التسويق"],
    terms: [
      "management",
      "business",
      "leadership",
      "marketing",
      "organization",
      "human resources",
      "strategic management",
    ],
  },
  {
    keys: ["الاقتصاد", "اقتصاد", "التمويل", "السوق", "التجاره", "التجارة"],
    terms: [
      "economics",
      "finance",
      "market",
      "trade",
      "economic development",
      "investment",
      "financial management",
    ],
  },
  {
    keys: ["القانون", "قانون", "تشريع", "التشريعات", "السياسات", "العداله"],
    terms: [
      "law",
      "legal",
      "legislation",
      "regulation",
      "policy",
      "justice",
      "legal studies",
    ],
  },
  {
    keys: ["الادب", "الأدب", "الشعر", "الروايه", "الرواية", "النقد", "النصوص"],
    terms: [
      "literature",
      "literary",
      "poetry",
      "novel",
      "narrative",
      "literary criticism",
      "text analysis",
    ],
  },
  {
    keys: ["اللسانيات", "اللغه", "اللغة", "النحو", "الصرف", "الدلاله", "الخطاب"],
    terms: [
      "linguistics",
      "language",
      "syntax",
      "semantics",
      "phonology",
      "discourse analysis",
      "morphology",
    ],
  },
  {
    keys: ["التاريخ", "حضاره", "حضارة", "تراث", "ارشيف", "الاثار"],
    terms: [
      "history",
      "historical",
      "civilization",
      "heritage",
      "archive",
      "archaeology",
      "cultural heritage",
    ],
  },
  {
    keys: ["الجغرافية", "الجغرافيا", "خرائط", "نظم المعلومات الجغرافيه", "المكان", "المكاني"],
    terms: [
      "geography",
      "geographic",
      "GIS",
      "spatial analysis",
      "urban",
      "regional",
      "mapping",
    ],
  },
];

function enhanceArabicQuery(query: string, field: string) {
  const originalQuery = cleanText(query);

  if (!hasArabic(originalQuery)) {
    return originalQuery;
  }

  const normalizedQuery = normalizeArabicText(originalQuery);
  const expandedTerms = new Set<string>();

  expandedTerms.add(originalQuery);

  for (const group of arabicExpansionGroups) {
    const hasMatch = group.keys.some((key) =>
      normalizedQuery.includes(normalizeArabicText(key))
    );

    if (hasMatch) {
      group.terms.forEach((term) => expandedTerms.add(term));
    }
  }

  const fieldFallbackTerms: Record<string, string[]> = {
    medicine: ["medicine", "clinical", "patient", "disease", "healthcare"],
    "life-sciences": ["biology", "cell biology", "molecular biology", "genetics"],
    biochemistry: ["biochemistry", "biochemical", "enzymes", "proteins", "metabolism", "biomarkers"],
    chemistry: ["chemistry", "chemical", "analytical chemistry", "molecules"],
    physics: ["physics", "quantum", "optics", "thermodynamics"],
    "computer-science": ["computer science", "artificial intelligence", "machine learning", "software"],
    engineering: ["engineering", "optimization", "design", "materials"],
    mathematics: ["mathematics", "statistics", "modeling", "probability"],
    "environmental-science": ["environment", "pollution", "sustainability", "toxicology"],
    agriculture: ["agriculture", "crop", "soil", "plant"],
    education: ["education", "teaching", "learning", "students", "curriculum"],
    psychology: ["psychology", "behavior", "cognition", "mental health"],
    "social-sciences": ["social science", "sociology", "society", "culture"],
    business: ["business", "management", "marketing", "leadership"],
    economics: ["economics", "finance", "market", "trade"],
    law: ["law", "legal", "legislation", "policy"],
    "arts-humanities": ["humanities", "arts", "culture", "philosophy"],
    linguistics: ["linguistics", "language", "discourse", "syntax"],
    literature: ["literature", "literary", "poetry", "novel"],
    history: ["history", "historical", "heritage", "archive"],
    geography: ["geography", "GIS", "spatial", "regional"],
  };

  const fallback = fieldFallbackTerms[field] || [];

  fallback.forEach((term) => expandedTerms.add(term));

  return Array.from(expandedTerms).join(" ");
}
function buildFieldQuery(query: string, field: string) {
const cleanQuery = enhanceArabicQuery(query, field);
  if (!cleanQuery || field === "all") {
    return cleanQuery;
  }

  const fieldFilters: Record<string, string> = {
    medicine:
      "medicine clinical patient disease diagnosis therapy hospital healthcare",
    "life-sciences":
      "biology biological cell molecular genetics physiology",
    biochemistry:
      "biochemistry biochemical enzyme protein metabolism biomarker",
    chemistry:
      "chemistry chemical synthesis compound molecule analytical",
    physics:
      "physics physical quantum optics mechanics thermodynamics",
    "computer-science":
      "computer science artificial intelligence machine learning deep learning software algorithm data mining neural network information technology cybersecurity computer vision natural language processing",
    engineering:
      "engineering mechanical electrical civil materials design optimization",
    mathematics:
      "mathematics mathematical statistics probability algebra geometry modeling",
    "environmental-science":
      "environment environmental pollution climate ecosystem sustainability",
    agriculture:
      "agriculture crop soil plant irrigation livestock",
    education:
      "education teaching learning curriculum students classroom pedagogy",
    psychology:
      "psychology psychological behavior cognition mental emotion",
    "social-sciences":
      "social science sociology society community culture",
    business:
      "business management marketing organization leadership",
    economics:
      "economics economic finance market trade development",
    law:
      "law legal legislation regulation policy",
    "arts-humanities":
      "humanities philosophy arts culture ethics",
    linguistics:
      "linguistics language discourse phonology syntax semantics",
    literature:
      "literature literary novel poetry narrative text analysis",
    history:
      "history historical archive civilization heritage",
    geography:
      "geography geographic spatial GIS urban regional",
  };

  const filter = fieldFilters[field];

  if (!filter) {
    return cleanQuery;
  }

  return `${cleanQuery} ${filter}`;
}

function normalizeIssn(value: string) {
  return cleanText(value)
    .replace(/[^0-9xX]/g, "")
    .toUpperCase();
}

function splitIssns(value: string) {
  return cleanText(value)
    .split(/[,; ]+/)
    .map(normalizeIssn)
    .filter(Boolean);
}

function getCrossrefIssns(work: CrossrefWork) {
  const issnsFromIssn = Array.isArray(work.ISSN) ? work.ISSN : [];
  const issnsFromIssnType = Array.isArray(work["issn-type"])
    ? work["issn-type"]
        .map((item) => item.value || "")
        .filter(Boolean)
    : [];

  return Array.from(new Set([...issnsFromIssn, ...issnsFromIssnType]))
    .map(cleanText)
    .filter(Boolean);
}

function normalizeJournalTitle(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/\bjournal of\b/g, "journal")
    .replace(/\binternational journal of\b/g, "international journal")
    .replace(/\bproceedings of\b/g, "proceedings")
    .replace(/\btransactions on\b/g, "transactions")
    .replace(/\bmagazine\b/g, "")
    .replace(/\bletters\b/g, "")
    .replace(/\breview\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleTokens(value: string) {
  const stopWords = new Set([
    "and",
    "of",
    "the",
    "in",
    "on",
    "for",
    "to",
    "a",
    "an",
    "journal",
    "international",
  ]);

  return normalizeJournalTitle(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function tokenSimilarity(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;

  const aSet = new Set(a);
  const bSet = new Set(b);

  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;

  return union === 0 ? 0 : intersection / union;
}

function normalizeCrossrefWork(work: CrossrefWork): GlobalArticle | null {
  if (work.type && work.type !== "journal-article") {
    return null;
  }

  const doi = cleanText(work.DOI);
  const title = cleanText(
    [work.title?.[0], work.subtitle?.[0]].filter(Boolean).join(": ")
  );

  if (!title && !doi) {
    return null;
  }

  const journal = cleanText(work["container-title"]?.[0]);
  const pubdate = getPublicationDate(work);
  const sourceUrl = doi ? `https://doi.org/${doi}` : cleanText(work.URL);
  const issns = getCrossrefIssns(work);

  return {
    id: doi || encodeURIComponent(title.toLowerCase()),
    title,
    journal,
    pubdate,
    authors: getAuthors(work.author),
    doi,
    abstract: cleanText(work.abstract),
    source: "Crossref",
    sourceUrl,
    quartile: "Not found",
    indexingStatus: journal
      ? "Crossref metadata / journal quartile requires SCImago matching"
      : "Crossref metadata / source not clearly identified",
    sjr: "",
    hIndex: "",
    publisher: cleanText(work.publisher),
    issn: issns.join(", "),
    matchConfidence: "Crossref metadata",
  };
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function detectDelimiter(headerLine: string) {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  return semicolonCount > commaCount ? ";" : ",";
}

function getRowValue(row: Record<string, string>, possibleNames: string[]) {
  for (const name of possibleNames) {
    const value = row[name];

    if (value) {
      return cleanText(value);
    }
  }

  return "";
}

function extractQuartile(row: Record<string, string>) {
  const directQuartile = getRowValue(row, [
    "SJR Best Quartile",
    "Best Quartile",
    "Quartile",
    "quartile",
  ]);

  if (/^Q[1-4]$/i.test(directQuartile)) {
    return directQuartile.toUpperCase();
  }

  const categories = getRowValue(row, ["Categories", "categories"]);
  const match = categories.match(/\bQ[1-4]\b/i);

  return match ? match[0].toUpperCase() : "Not found";
}

async function loadScimagoJournals() {
  if (scimagoCache) {
    return scimagoCache;
  }

  const filePath = path.join(process.cwd(), "public", "scimagojr.csv");
  const fileContent = await readFile(filePath, "utf8");

  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    scimagoCache = [];
    return scimagoCache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) =>
    cleanText(header).replace(/^\uFEFF/, "")
  );

  const journals: ScimagoJournal[] = lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line, delimiter);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      const title = getRowValue(row, ["Title", "title", "Journal", "journal"]);
      const issn = getRowValue(row, ["Issn", "ISSN", "issn"]);
      const quartile = extractQuartile(row);

      if (!title && !issn) {
        return null;
      }

      return {
        title,
        normalizedTitle: normalizeJournalTitle(title),
        titleTokens: getTitleTokens(title),
        issns: splitIssns(issn),
        quartile,
        sjr: getRowValue(row, ["SJR", "sjr"]),
        hIndex: getRowValue(row, ["H index", "H Index", "hIndex"]),
        publisher: getRowValue(row, ["Publisher", "publisher"]),
        categories: getRowValue(row, ["Categories", "categories"]),
      };
    })
    .filter((journal): journal is ScimagoJournal => Boolean(journal));

  scimagoCache = journals;

  return scimagoCache;
}

function findScimagoMatch(article: GlobalArticle, journals: ScimagoJournal[]) {
  const articleIssns = splitIssns(article.issn);

  if (articleIssns.length > 0) {
    const issnMatch = journals.find((journal) =>
      journal.issns.some((journalIssn) => articleIssns.includes(journalIssn))
    );

    if (issnMatch) {
      return {
        journal: issnMatch,
        confidence: "ISSN exact match",
      };
    }
  }

  const articleJournalTitle = normalizeJournalTitle(article.journal);

  if (!articleJournalTitle) {
    return null;
  }

  const exactTitleMatch = journals.find(
    (journal) => journal.normalizedTitle === articleJournalTitle
  );

  if (exactTitleMatch) {
    return {
      journal: exactTitleMatch,
      confidence: "Journal title exact match",
    };
  }

  const articleTokens = getTitleTokens(article.journal);

  let bestMatch: {
    journal: ScimagoJournal;
    score: number;
  } | null = null;

  for (const journal of journals) {
    if (!journal.normalizedTitle || journal.normalizedTitle.length < 10) {
      continue;
    }

    const score = tokenSimilarity(articleTokens, journal.titleTokens);

    if (score >= 0.92 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        journal,
        score,
      };
    }
  }

  if (bestMatch) {
    return {
      journal: bestMatch.journal,
      confidence: `Journal title strict token match (${bestMatch.score.toFixed(2)})`,
    };
  }

  return null;
}

function enrichWithScimago(
  article: GlobalArticle,
  journals: ScimagoJournal[]
): GlobalArticle {
  const match = findScimagoMatch(article, journals);

  if (!match) {
    return article;
  }

  return {
    ...article,
    quartile: match.journal.quartile || article.quartile,
    sjr: match.journal.sjr || article.sjr,
    hIndex: match.journal.hIndex || article.hIndex,
    publisher: match.journal.publisher || article.publisher,
    indexingStatus:
      match.journal.quartile && match.journal.quartile !== "Not found"
        ? `SCImago indexed / ${match.journal.quartile}`
        : "SCImago indexed / quartile not clearly found",
    matchConfidence: match.confidence,
  };
}
function normalizeDoiForOpenAlex(doi: string) {
  return cleanText(doi)
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim();
}

async function fetchOpenAlexByDoi(doi: string) {
  const cleanDoi = normalizeDoiForOpenAlex(doi);

  if (!cleanDoi) {
    return null;
  }

  const params = new URLSearchParams({
    filter: `doi:https://doi.org/${cleanDoi}`,
    per_page: "1",
  });

  const apiKey = process.env.OPENALEX_API_KEY;

  if (apiKey) {
    params.set("api_key", apiKey);
  }

  const response = await fetch(`https://api.openalex.org/works?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
    },
    next: {
      revalidate: 60 * 60,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OpenAlexResponse;

  return data.results?.[0] || null;
}
function getOpenAlexSource(work: OpenAlexWork) {
  const primarySource = work.primary_location?.source;

  if (primarySource?.display_name || primarySource?.issn_l || primarySource?.issn?.length) {
    return primarySource;
  }

  const locationWithSource = work.locations?.find(
    (location) =>
      location.source?.display_name ||
      location.source?.issn_l ||
      location.source?.issn?.length
  );

  return locationWithSource?.source || null;
}

function getOpenAlexIssns(source: OpenAlexSource | null) {
  if (!source) {
    return "";
  }

  const issns = [
    source.issn_l || "",
    ...(Array.isArray(source.issn) ? source.issn : []),
  ]
    .map(cleanText)
    .filter(Boolean);

  return Array.from(new Set(issns)).join(", ");
}

function improveArticleWithOpenAlexSource(
  article: GlobalArticle,
  openAlexWork: OpenAlexWork
): GlobalArticle {
  const source = getOpenAlexSource(openAlexWork);

  if (!source) {
    return article;
  }

  const openAlexJournal = cleanText(source.display_name);
  const openAlexIssn = getOpenAlexIssns(source);
  const openAlexPublisher = cleanText(source.host_organization_name);

  return {
    ...article,
    journal: article.journal || openAlexJournal,
    issn: article.issn || openAlexIssn,
    publisher: article.publisher || openAlexPublisher,
    sourceUrl:
      article.sourceUrl ||
      cleanText(workUrlFromOpenAlex(openAlexWork)) ||
      article.sourceUrl,
    matchConfidence:
      article.matchConfidence === "Crossref metadata"
        ? "Crossref metadata + OpenAlex source metadata"
        : article.matchConfidence,
  };
}

function workUrlFromOpenAlex(work: OpenAlexWork) {
  return (
    cleanText(work.primary_location?.landing_page_url) ||
    cleanText(work.primary_location?.pdf_url) ||
    cleanText(work.open_access?.oa_url) ||
    ""
  );
}
async function fetchCrossrefByDoi(doi: string) {
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
      },
      next: {
        revalidate: 60 * 60,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as CrossrefSingleResponse;

  return data.message || null;
}

async function fetchCrossrefWorks(
  fieldAwareQuery: string,
  fromYear: number,
  toYear: number,
  maxResults: number
) {
  const params = new URLSearchParams({
    "query.bibliographic": fieldAwareQuery,
    rows: String(maxResults),
    select:
      "DOI,title,subtitle,author,container-title,publisher,ISSN,issn-type,issued,published,URL,type,subject,abstract",
    sort: "relevance",
    order: "desc",
    filter: `from-pub-date:${fromYear},until-pub-date:${toYear},type:journal-article`,
  });

  const response = await fetch(`https://api.crossref.org/works?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
    },
    next: {
      revalidate: 60 * 30,
    },
  });

  if (!response.ok) {
    throw new Error("Crossref search failed.");
  }

  const data = (await response.json()) as CrossrefListResponse;

  return data.message?.items || [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = cleanText(
      searchParams.get("query") || searchParams.get("q") || ""
    );
    const field = cleanText(searchParams.get("field") || "all");
    const currentYear = new Date().getFullYear();
    const fromYear = parseYear(searchParams.get("fromYear"), 1990);
    const toYear = parseYear(searchParams.get("toYear"), currentYear);
    const maxResults = Math.min(
      Math.max(Number(searchParams.get("maxResults") || "50"), 1),
      100
    );

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    const scimagoJournals = await loadScimagoJournals();

    const works = looksLikeDoi(query)
      ? [await fetchCrossrefByDoi(query)]
      : await fetchCrossrefWorks(
          buildFieldQuery(query, field),
          fromYear,
          toYear,
          maxResults
        );

    const normalizedArticles = works
  .filter((work): work is CrossrefWork => Boolean(work))
  .map(normalizeCrossrefWork)
  .filter((article): article is GlobalArticle => Boolean(article));

const articlesWithScimago = await Promise.all(
  normalizedArticles.map(async (article) => {
    const scimagoMatchedArticle = enrichWithScimago(
      article,
      scimagoJournals
    );

    if (
      scimagoMatchedArticle.quartile !== "Not found" ||
      !scimagoMatchedArticle.doi
    ) {
      return scimagoMatchedArticle;
    }

    const openAlexWork = await fetchOpenAlexByDoi(scimagoMatchedArticle.doi);

    if (!openAlexWork) {
      return scimagoMatchedArticle;
    }

    const openAlexImprovedArticle = improveArticleWithOpenAlexSource(
      scimagoMatchedArticle,
      openAlexWork
    );

    return enrichWithScimago(openAlexImprovedArticle, scimagoJournals);
  })
);

const articles = articlesWithScimago.filter((article) => {
  const year = getYearFromDate(article.pubdate);

  if (!year) return true;

  return year >= fromYear && year <= toYear;
});

    return Response.json(articles);
  } catch (error) {
    console.error("Global search route error:", error);

    return Response.json(
      { error: "Global search failed because of a server error." },
      { status: 500 }
    );
  }
}