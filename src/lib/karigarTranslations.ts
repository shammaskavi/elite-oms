export type KarigarLang = "gu" | "en";

export const KARIGAR_LANG_KEY = "spe_karigar_portal_lang";

export function getSavedKarigarLang(): KarigarLang {
  if (typeof window === "undefined") return "gu"; // Default to Gujarati for karigars
  try {
    const saved = window.localStorage.getItem(KARIGAR_LANG_KEY);
    return saved === "en" ? "en" : "gu";
  } catch {
    return "gu";
  }
}

export function saveKarigarLang(lang: KarigarLang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KARIGAR_LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

export const TRANSLATIONS = {
  gu: {
    portal_title: "કારીગર પોર્ટલ",
    subtitle: "લાઈવ કામ અને માપની વિગતો",
    assigned_tasks: "સોંપાયેલ કામ",
    search_placeholder: "ગ્રાહક, બિલ નં., સાડી કે ડ્રેસ શોધો…",
    sort_by: "ક્રમ ગોઠવો:",
    sort_order_date: "નવા ઓર્ડર",
    sort_delivery_date: "ડિલિવરી તારીખ",
    clear_search: "સાફ કરો",
    
    // Statuses
    due_today: "આજે આપવાનો",
    due_tomorrow: "કાલે આપવાનો",
    due_in: "{days} દિવસમાં",
    overdue: "મુદત વીતી ગઈ ({days} દિવસ)",
    completed: "પૂર્ણ થયેલ ✓",
    no_date: "તારીખ નથી",
    
    // Order Detail
    invoice: "બિલ નં.",
    customer: "ગ્રાહક",
    work_instructions: "કામની વિગતો અને સૂચનાઓ",
    item: "વસ્તુ",
    piece: "પીસ",
    work_notes: "કારીગર નોંધ અને વિશેષ સૂચનાઓ",
    no_notes: "કોઈ વિશેષ સૂચના નથી.",
    cutting_specs: "માપ અને કટિંગ વિગત",
    copy_specs: "માપ કોપી કરો",
    copied: "કોપી થઈ ગયું ✓",
    artisan_note: "કારીગર નોંધ:",
    no_measurements: "આ વસ્તુ માટે કોઈ માપ જોડાયેલ નથી.",
    
    // Security & Errors
    loading: "કામની વિગતો લોડ થઈ રહી છે...",
    task_not_assigned: "આ કામ તમને સોંપેલ નથી",
    task_not_assigned_desc: "આ ઓર્ડર હાલમાં તમારા ખાતા સાથે જોડાયેલ નથી.",
    return_to_tasks: "← કામની યાદી પર પાછા જાઓ",
    no_tasks_title: "હાલમાં કોઈ નવું કામ સોંપેલ નથી",
    no_tasks_desc: "તમારું બધું કામ પૂર્ણ થઈ ગયું છે!",
    no_results_title: "કોઈ મેળ ખાતું કામ મળ્યું નથી",
    no_results_desc: "અન્ય નામ અથવા બિલ નંબરથી શોધી જુઓ.",
    language_toggle: "ગુજરાતી / English",
  },
  en: {
    portal_title: "Karigar Work Portal",
    subtitle: "Live Task Queue & Measurement Specs",
    assigned_tasks: "Assigned Work",
    search_placeholder: "Search customer, invoice, garment…",
    sort_by: "Sort by:",
    sort_order_date: "Newest First",
    sort_delivery_date: "Delivery Date",
    clear_search: "Clear",
    
    // Statuses
    due_today: "Due Today",
    due_tomorrow: "Due Tomorrow",
    due_in: "Due in {days}d",
    overdue: "Overdue ({days}d)",
    completed: "Completed ✓",
    no_date: "No Date",
    
    // Order Detail
    invoice: "Invoice",
    customer: "Customer",
    work_instructions: "Work Instructions",
    item: "Item",
    piece: "Piece",
    work_notes: "Work Instructions & Notes",
    no_notes: "No specific notes for this piece.",
    cutting_specs: "Garment Cutting Dimensions",
    copy_specs: "Copy Specs",
    copied: "Copied ✓",
    artisan_note: "Artisan Note:",
    no_measurements: "No body measurements attached for this piece.",
    
    // Security & Errors
    loading: "Loading order details…",
    task_not_assigned: "Task Not Assigned",
    task_not_assigned_desc: "This order is not currently assigned to your account.",
    return_to_tasks: "← Return to Tasks",
    no_tasks_title: "No tasks currently assigned",
    no_tasks_desc: "You're all caught up! Check back later.",
    no_results_title: "No matching tasks found",
    no_results_desc: "Try searching with a different customer name or invoice number.",
    language_toggle: "ગુજરાતી / English",
  },
};

// Common Garment Templates & Badges
export const TEMPLATE_TRANSLATIONS: Record<string, { gu: string; en: string }> = {
  skirt: { gu: "સ્કર્ટ / ઘાઘરો (Skirt)", en: "Skirt" },
  blouse: { gu: "બ્લાઉઝ (Blouse)", en: "Blouse" },
  lehenga: { gu: "લહેંગા (Lehenga)", en: "Lehenga" },
  kurti: { gu: "કુર્તી (Kurti)", en: "Kurti" },
  salwar: { gu: "સલવાર (Salwar)", en: "Salwar" },
  gown: { gu: "ગાઉન (Gown)", en: "Gown" },
  dress: { gu: "ડ્રેસ (Dress)", en: "Dress" },
  saree: { gu: "સાડી (Saree)", en: "Saree" },
  dupatta: { gu: "દુપટ્ટો (Dupatta)", en: "Dupatta" },
  anarkali: { gu: "અનારકલી (Anarkali)", en: "Anarkali" },
  suit: { gu: "સૂટ (Suit)", en: "Suit" },
  specs: { gu: "માપ વિગત", en: "Specs" },
  garment: { gu: "કપડાંનું માપ", en: "Garment" },
};

// Common Garment Terms & Measurements in Gujarati & English
export const MEASUREMENT_FIELD_TRANSLATIONS: Record<string, { gu: string; en: string }> = {
  bust: { gu: "છાતી (Bust)", en: "Bust / Chest" },
  chest: { gu: "છાતી (Chest)", en: "Chest" },
  waist: { gu: "કમર (Waist)", en: "Waist" },
  underbust: { gu: "અંડરબસ્ટ / કમર", en: "Underbust / Waist" },
  length: { gu: "લંબાઈ (Length)", en: "Length" },
  shoulder: { gu: "શોલ્ડર / ખભા (Shoulder)", en: "Shoulder" },
  armhole: { gu: "મુઢો / આરમહોલ (Armhole)", en: "Armhole" },
  sleeve_length: { gu: "બાય લંબાઈ (Sleeve Length)", en: "Sleeve Length" },
  "sleeve length": { gu: "બાય લંબાઈ (Sleeve Length)", en: "Sleeve Length" },
  sleeve_round: { gu: "બાય ગોળાઈ (Sleeve Round)", en: "Sleeve Round / Bicep" },
  "sleeve round": { gu: "બાય ગોળાઈ (Sleeve Round)", en: "Sleeve Round / Bicep" },
  bicep: { gu: "બાય ગોળાઈ (Bicep)", en: "Bicep" },
  front_neck: { gu: "આગળનું ગળું (Front Neck)", en: "Front Neck Depth" },
  "front neck": { gu: "આગળનું ગળું (Front Neck)", en: "Front Neck Depth" },
  front_neck_depth: { gu: "આગળનું ગળું (Front Neck)", en: "Front Neck Depth" },
  back_neck: { gu: "પાછળનું ગળું (Back Neck)", en: "Back Neck Depth" },
  "back neck": { gu: "પાછળનું ગળું (Back Neck)", en: "Back Neck Depth" },
  back_neck_depth: { gu: "પાછળનું ગળું (Back Neck)", en: "Back Neck Depth" },
  neck_depth: { gu: "ગળાની ઊંડાઈ (Neck Depth)", en: "Neck Depth" },
  neck_width: { gu: "ગળાની પહોળાઈ (Neck Width)", en: "Neck Width" },
  cross_front: { gu: "આગળનો ભાગ (Cross Front)", en: "Cross Front" },
  "cross front": { gu: "આગળનો ભાગ (Cross Front)", en: "Cross Front" },
  cross_back: { gu: "પાછળનો ભાગ (Cross Back)", en: "Cross Back" },
  "cross back": { gu: "પાછળનો ભાગ (Cross Back)", en: "Cross Back" },
  cup_point: { gu: "ટક્સ પોઇન્ટ (Apex / Cup)", en: "Cup Point / Apex" },
  "cup point": { gu: "ટક્સ પોઇન્ટ (Apex / Cup)", en: "Cup Point / Apex" },
  apex: { gu: "ટક્સ પોઇન્ટ (Apex)", en: "Apex / Cup Point" },
  hip: { gu: "સીટ / હિપ (Hips)", en: "Hips" },
  hips: { gu: "સીટ / હિપ (Hips)", en: "Hips" },
  flare: { gu: "ઘેર / ઘેરો (Ghera)", en: "Flare / Ghera" },
  ghera: { gu: "ઘેર / ઘેરો (Ghera)", en: "Flare / Ghera" },
  cancan: { gu: "કેનકેન અસ્તર (Cancan)", en: "Cancan Layers" },
  cancan_layers: { gu: "કેનકેન અસ્તર (Cancan)", en: "Cancan Layers" },
  "cancan layers": { gu: "કેનકેન અસ્તર (Cancan)", en: "Cancan Layers" },
  closure: { gu: "બંધ કરવાની રીત (Closure)", en: "Closure" },
  mori: { gu: "મોરી (Bottom Opening)", en: "Mori / Bottom Opening" },
  bottom_opening: { gu: "મોરી (Bottom Opening)", en: "Mori / Bottom Opening" },
  "bottom opening": { gu: "મોરી (Bottom Opening)", en: "Mori / Bottom Opening" },
  thigh: { gu: "સાથળ ગોળાઈ (Thigh)", en: "Thigh Round" },
  thigh_round: { gu: "સાથળ ગોળાઈ (Thigh)", en: "Thigh Round" },
  knee: { gu: "ઘૂંટણ ગોળાઈ (Knee)", en: "Knee Round" },
  calf: { gu: "પિંડી ગોળાઈ (Calf)", en: "Calf Round" },
  crotch: { gu: "ક્રોચ / આસન (Crotch)", en: "Crotch / Asan" },
  slit_opening: { gu: "સાઈડ કટ / સ્લિટ", en: "Side Slit Opening" },
  "slit opening": { gu: "સાઈડ કટ / સ્લિટ", en: "Side Slit Opening" },
  shoulder_to_waist: { gu: "શોલ્ડરથી કમર", en: "Shoulder to Waist" },
  "shoulder to waist": { gu: "શોલ્ડરથી કમર", en: "Shoulder to Waist" },
  full_length: { gu: "કુલ લંબાઈ (Full Length)", en: "Full Length (Heels Included)" },
  "full length": { gu: "કુલ લંબાઈ (Full Length)", en: "Full Length (Heels Included)" },
  blouse_length: { gu: "બ્લાઉઝ લંબાઈ (Blouse Length)", en: "Blouse Length" },
  lehenga_length: { gu: "લહેંગા લંબાઈ (Lehenga Length)", en: "Lehenga Length" },
  kurti_length: { gu: "કુર્તી લંબાઈ (Kurti Length)", en: "Kurti Length" },
  salwar_length: { gu: "સલવાર લંબાઈ (Salwar Length)", en: "Salwar Length" },
  pads: { gu: "પેડ્સ / કપ્સ (Pads)", en: "Pads" },
  padded: { gu: "પેડ્સ / કપ્સ (Pads)", en: "Padded" },
  lining: { gu: "અસ્તર (Lining)", en: "Lining" },
  astur: { gu: "અસ્તર (Lining)", en: "Lining" },
  tassels: { gu: "લટકણ / ટસલ્સ (Latkan)", en: "Latkan / Tassels" },
  latkan: { gu: "લટકણ / ટસલ્સ (Latkan)", en: "Latkan / Tassels" },
  dori: { gu: "દોરી / નાડું (Dori)", en: "Dori / Strings" },
  margin: { gu: "સાઈડ માર્જિન (Margin)", en: "Margin" },
};

// Workflow Stages in Gujarati & English
export const STAGE_TRANSLATIONS: Record<string, { gu: string; en: string }> = {
  Fabric: { gu: "કાપડ / ફેબ્રિક", en: "Fabric" },
  Dyeing: { gu: "ડાઇંગ / રંગકામ", en: "Dyeing" },
  Polishing: { gu: "પોલિશિંગ / ચરક", en: "Polishing" },
  Embroidery: { gu: "ભરતકામ / એમ્બ્રોઇડરી", en: "Embroidery" },
  Stitching: { gu: "સિલાઈ / સ્ટીચિંગ", en: "Stitching" },
  "Dangling / Jhalar": { gu: "ઝાલર / લટકણ", en: "Dangling / Jhalar" },
  "Fall & Beading": { gu: "ફોલ-પીકો / બીડિંગ", en: "Fall & Beading" },
  Packed: { gu: "પેકિંગ થયેલ", en: "Packed" },
  Dispatched: { gu: "મોકલી આપેલ", en: "Dispatched" },
  Delivered: { gu: "ડિલિવર થયેલ", en: "Delivered" },
};

// Phrase and word replacements for garment titles
const GARMENT_WORD_MAP: Array<[RegExp, string]> = [
  // Products & Items
  [/\bProduct\s*(\d+)\b/gi, "પીસ $1"],
  [/\bItem\s*(\d+)\b/gi, "વસ્તુ $1"],
  [/\bPiece\s*(\d+)\b/gi, "પીસ $1"],

  // Garment Types & Sets
  [/\bChaniya\s*Choli\b/gi, "ચણિયા ચોળી"],
  [/\bChaniyaCholi\b/gi, "ચણિયા ચોળી"],
  [/\bChaniyo\b/gi, "ચણિયો"],
  [/\bLehenga\s*Choli\b/gi, "લહેંગા ચોળી"],
  [/\bLehenga\b/gi, "લહેંગા"],
  [/\bLehengas\b/gi, "લહેંગા"],
  [/\bBlouse\b/gi, "બ્લાઉઝ"],
  [/\bCholi\b/gi, "ચોળી"],
  [/\bSaree\b/gi, "સાડી"],
  [/\bSari\b/gi, "સાડી"],
  [/\bDupatta\b/gi, "દુપટ્ટો"],
  [/\bKurti\b/gi, "કુર્તી"],
  [/\bKurta\b/gi, "કુર્તા"],
  [/\bSalwar\s*Suit\b/gi, "સલવાર સૂટ"],
  [/\bSalwar\b/gi, "સલવાર"],
  [/\bSuit\b/gi, "સૂટ"],
  [/\bDress\b/gi, "ડ્રેસ"],
  [/\bGown\b/gi, "ગાઉન"],
  [/\bSkirt\b/gi, "સ્કર્ટ / ઘાઘરો"],
  [/\bAnarkali\b/gi, "અનારકલી"],
  [/\bKameez\b/gi, "કમીઝ"],
  [/\bPalazzo\b/gi, "પ્લાઝો"],
  [/\bPlazo\b/gi, "પ્લાઝો"],
  [/\bPants?\b/gi, "પેન્ટ"],
  [/\bTop\b/gi, "ટોપ"],
  [/\bBottom\b/gi, "બોટમ"],
  [/\bSet\b/gi, "સેટ"],
  [/\bFrock\b/gi, "ફ્રોક"],

  // Occasions & Styles
  [/\bBridal\b/gi, "બ્રાઇડલ"],
  [/\bWedding\b/gi, "લગ્ન / વેડિંગ"],
  [/\bDesigner\b/gi, "ડિઝાઇનર"],
  [/\bHeavy\b/gi, "હેવી"],
  [/\bParty\s*Wear\b/gi, "પાર્ટી વેર"],
  [/\bCasual\b/gi, "કેઝ્યુઅલ"],
  [/\bReady\s*Made\b/gi, "રેડીમેડ"],

  // Work & Crafts
  [/\bHandwork\b/gi, "હાથકામ (હેન્ડવર્ક)"],
  [/\bHand\s*Work\b/gi, "હાથકામ"],
  [/\bMirror\s*Work\b/gi, "આભલા કામ (મિરર વર્ક)"],
  [/\bMirrorwork\b/gi, "આભલા કામ"],
  [/\bEmbroidery\b/gi, "ભરતકામ"],
  [/\bEmbroidered\b/gi, "ભરતકામ"],
  [/\bZari\b/gi, "ઝરી"],
  [/\bGota\s*Patti\b/gi, "ગોટા પત્તી"],
  [/\bGotapatti\b/gi, "ગોટા પત્તી"],
  [/\bSequins?\b/gi, "ટીકી / સિક્વન્સ"],
  [/\bThread\s*Work\b/gi, "દોરા કામ"],
  [/\bCutwork\b/gi, "કટવર્ક"],
  [/\bFall\s*Pico\b/gi, "ફોલ-પીકો"],
  [/\bFall-Pico\b/gi, "ફોલ-પીકો"],
  [/\bFinishing\b/gi, "ફિનિશિંગ"],
  [/\bAlteration\b/gi, "અલ્ટરેશન"],
  [/\bStitching\b/gi, "સિલાઈ"],
  [/\bCutting\b/gi, "કટિંગ"],
  [/\bDyeing\b/gi, "ડાઇંગ / રંગકામ"],

  // Fabrics & Weaves
  [/\bOff\s*White\b/gi, "ઓફવ્હાઇટ"],
  [/\bOffwhite\b/gi, "ઓફવ્હાઇટ"],
  [/\bSilkenza\b/gi, "સિલ્કેન્ઝા"],
  [/\bVintage\b/gi, "વિન્ટેજ"],
  [/\bRangkaat\b/gi, "રંગકાટ"],
  [/\bRangkat\b/gi, "રંગકાટ"],
  [/\bMethi\b/gi, "મેથી"],
  [/\bNeck\b/gi, "નેક (ગળું)"],
  [/\bPearl\b/gi, "પર્લ (મોતી)"],
  [/\bYolk\b/gi, "યોક"],
  [/\bYoke\b/gi, "યોક"],
  [/\bZardozi\b/gi, "જરદોશી"],
  [/\bAari\b/gi, "આરી વર્ક"],
  [/\bCutdana\b/gi, "કટદાણા"],
  [/\bKundan\b/gi, "કુંદન"],
  [/\bChikankari\b/gi, "ચિકનકારી"],
  [/\bPaithani\b/gi, "પૈઠણી"],
  [/\bKanjivaram\b/gi, "કાંજીવરમ"],
  [/\bTussar\b/gi, "ટસર સિલ્ક"],
  [/\bMunga\b/gi, "મૂંગા સિલ્ક"],
  [/\bRaw\s*Silk\b/gi, "રો સિલ્ક"],
  [/\bKota\s*Doria\b/gi, "કોટા ડોરિયા"],
  [/\bKota\b/gi, "કોટા"],
  [/\bPrinted\b/gi, "પ્રિન્ટેડ"],
  [/\bPrint\b/gi, "પ્રિન્ટ"],
  [/\bFloral\b/gi, "ફ્લોરલ"],
  [/\bBorder\b/gi, "બોર્ડર"],
  [/\bPallu\b/gi, "પલ્લું"],
  [/\bPleats\b/gi, "પ્લીટ્સ (પાટલી)"],
  [/\bFlared\b/gi, "ઘેરવાળું"],
  [/\bSleeveless\b/gi, "સ્લીવલેસ (બાય વગરનું)"],
  [/\bFull\s*Sleeves?\b/gi, "આખી બાય (ફુલ સ્લીવ)"],
  [/\bHalf\s*Sleeves?\b/gi, "અડધી બાય (હાફ સ્લીવ)"],
  [/\bV[- ]Neck\b/gi, "વી નેક (V ગળું)"],
  [/\bRound\s*Neck\b/gi, "ગોળ ગળું"],
  [/\bSquare\s*Neck\b/gi, "ચોરસ ગળું"],
  [/\bCollar\b/gi, "કોલર"],
  [/\bDeep\s*Neck\b/gi, "ડીપ ગળું"],
  [/\bBackless\b/gi, "બેકલેસ"],
  [/\bPlain\b/gi, "પ્લેન / સાદું"],
  [/\bContrast\b/gi, "કોન્ટ્રાસ્ટ"],
  [/\bSilk\b/gi, "સિલ્ક"],
  [/\bCotton\b/gi, "કોટન"],
  [/\bGeorgette\b/gi, "જ્યોર્જેટ"],
  [/\bBandhani\b/gi, "બાંધણી"],
  [/\bPatola\b/gi, "પટોળાં"],
  [/\bBanarasi\b/gi, "બનારસી"],
  [/\bOrganza\b/gi, "ઓર્ગેન્ઝા"],
  [/\bNet\b/gi, "નેટ"],
  [/\bVelvet\b/gi, "વેલ્વેટ"],
  [/\bChiffon\b/gi, "શિફોન"],
  [/\bDola\s*Silk\b/gi, "ડોલા સિલ્ક"],
  [/\bTissue\b/gi, "ટિશ્યુ"],
  [/\bCrepe\b/gi, "ક્રેપ"],
  [/\bSatin\b/gi, "સાટિન"],
  [/\bLinen\b/gi, "લિનેન"],

  // Colors
  [/\bCreme\b/gi, "ક્રીમ"],
  [/\bCream\b/gi, "ક્રીમ"],
  [/\bRed\b/gi, "લાલ (Red)"],
  [/\bPink\b/gi, "ગુલાબી (Pink)"],
  [/\bRani\s*Pink\b/gi, "રાણી પિંક"],
  [/\bRani\b/gi, "રાણી કલર"],
  [/\bYellow\b/gi, "પીળો (Yellow)"],
  [/\bGreen\b/gi, "લીલો (Green)"],
  [/\bBlue\b/gi, "વાદળી (Blue)"],
  [/\bNavy\s*Blue\b/gi, "નેવી બ્લૂ"],
  [/\bNavy\b/gi, "નેવી બ્લૂ"],
  [/\bMaroon\b/gi, "મરૂન"],
  [/\bWhite\b/gi, "સફેદ (White)"],
  [/\bBlack\b/gi, "કાળો (Black)"],
  [/\bGold\b/gi, "ગોલ્ડન"],
  [/\bGolden\b/gi, "ગોલ્ડન"],
  [/\bSilver\b/gi, "સિલ્વર"],
  [/\bOrange\b/gi, "નારંગી / ઓરેન્જ"],
  [/\bPeach\b/gi, "પીચ"],
  [/\bPurple\b/gi, "જાંબલી / પર્પલ"],
  [/\bWine\b/gi, "વાઇન કલર"],
  [/\bMustard\b/gi, "મસ્ટર્ડ"],
  [/\bTeal\b/gi, "ટીલ બ્લૂ"],
  [/\bPista\b/gi, "પિસ્તા"],
  [/\bGrey\b/gi, "ગ્રે / રાખોડી"],
  [/\bGray\b/gi, "ગ્રે / રાખોડી"],
  [/\bBeige\b/gi, "બેજ"],
  [/\bBrown\b/gi, "કથ્થઈ / બ્રાઉન"],
];

/**
 * Smart translator for garment titles and names with full phonetic fallback
 */
export function translateGarmentName(name: string, lang: KarigarLang): string {
  if (!name || lang === "en") return name;

  let translated = name;
  for (const [regex, replacement] of GARMENT_WORD_MAP) {
    translated = translated.replace(regex, replacement);
  }

  // Any remaining English words (e.g. custom product titles or inventory tags)
  // are transliterated phonetically into Gujarati script so 100% of text is readable in Gujarati!
  translated = translated.replace(/\b[a-zA-Z]+\b/g, (match) => {
    const lower = match.toLowerCase();
    if (CUSTOMER_NAME_DICT[lower]) return CUSTOMER_NAME_DICT[lower];
    return phoneticTransliterate(match) || match;
  });

  return translated;
}


/**
 * Translate template name / badge
 */
export function translateTemplateName(template: string, lang: KarigarLang): string {
  if (!template) return "";
  if (lang === "en") return template;
  const key = template.toLowerCase().trim();
  const entry = TEMPLATE_TRANSLATIONS[key];
  if (entry) return entry.gu;
  return translateGarmentName(template, lang);
}

/**
 * Translate field key (e.g. bust, waist, cancan_layers, closure)
 */
export function translateFieldKey(key: string, lang: KarigarLang): string {
  const normKey = key.toLowerCase().trim();
  const entry = MEASUREMENT_FIELD_TRANSLATIONS[normKey];
  if (entry) {
    return lang === "gu" ? entry.gu : entry.en;
  }
  // Fallback cleanup
  const clean = key.replace(/_/g, " ");
  if (lang === "gu") {
    return translateGarmentName(clean, "gu");
  }
  return clean;
}

/**
 * Format and translate measurement values (handles boolean, string, numbers, inches)
 */
export function formatMeasurementValue(val: any, key: string, lang: KarigarLang): string {
  if (val === null || val === undefined) return "—";

  const valStr = String(val).trim();
  const lowerVal = valStr.toLowerCase();

  // Handle Boolean
  if (typeof val === "boolean" || lowerVal === "true" || lowerVal === "yes") {
    return lang === "gu" ? "હા (છે) / Yes" : "Yes";
  }
  if (lowerVal === "false" || lowerVal === "no") {
    return lang === "gu" ? "ના (નથી) / No" : "No";
  }

  // Handle common string values like Closure types, side options, cuts
  const STRING_VALUE_MAP: Record<string, { gu: string; en: string }> = {
    strings: { gu: "દોરી / નાડું (Strings)", en: "Strings" },
    string: { gu: "દોરી / નાડું (Strings)", en: "Strings" },
    dori: { gu: "દોરી / નાડું (Dori)", en: "Dori / Strings" },
    zipper: { gu: "ચેઇન / ઝિપ (Zipper)", en: "Zipper" },
    zip: { gu: "ચેઇન / ઝિપ (Zip)", en: "Zip" },
    hooks: { gu: "હૂક (Hooks)", en: "Hooks" },
    hook: { gu: "હૂક (Hook)", en: "Hook" },
    elastic: { gu: "ઇલાસ્ટિક (Elastic)", en: "Elastic" },
    "side zip": { gu: "સાઇડ ઝિપ (Side Zip)", en: "Side Zip" },
    "side zipper": { gu: "સાઇડ ઝિપ (Side Zip)", en: "Side Zip" },
    "back hooks": { gu: "પાછળ હૂક (Back Hooks)", en: "Back Hooks" },
    "front hooks": { gu: "આગળ હૂક (Front Hooks)", en: "Front Hooks" },
    "back zip": { gu: "પાછળ ઝિપ (Back Zip)", en: "Back Zip" },
    left: { gu: "ડાબી બાજુ (Left)", en: "Left" },
    right: { gu: "જમણી બાજુ (Right)", en: "Right" },
    center: { gu: "વચ્ચે (Center)", en: "Center" },
    padded: { gu: "પેડેડ / કપ્સ (Padded)", en: "Padded" },
    unpadded: { gu: "પેડ વગર (Unpadded)", en: "Unpadded" },
  };

  if (STRING_VALUE_MAP[lowerVal]) {
    return lang === "gu" ? STRING_VALUE_MAP[lowerVal].gu : STRING_VALUE_MAP[lowerVal].en;
  }

  // Check if it's a numeric dimension (e.g. 39, 32.5, 14, 40)
  if (!isNaN(Number(valStr)) && valStr !== "") {
    return `${valStr}"`;
  }

  // Return regular string with garment translation if Gujarati
  return lang === "gu" ? translateGarmentName(valStr, "gu") : valStr;
}

// Customer Names & Relations Dictionary in Gujarati
export const CUSTOMER_NAME_DICT: Record<string, string> = {
  // Suffixes & Honorifics
  ben: "બેન",
  bahen: "બહેન",
  behn: "બહેન",
  bhai: "ભાઈ",
  bhabhi: "ભાભી",
  kaki: "કાકી",
  masi: "માસી",
  mama: "મામા",
  kaka: "કાકા",
  fui: "ફોઈ",
  seth: "શેઠ",
  babu: "બાબુ",
  kumar: "કુમાર",
  lal: "લાલ",
  ji: "જી",
  shree: "શ્રી",
  shrimati: "શ્રીમતી",
  mrs: "શ્રીમતી",
  mr: "શ્રી",
  dr: "ડો.",
  bride: "દુલ્હન (Bride)",
  groom: "વરરાજા (Groom)",
  sister: "બહેન",
  mother: "માતા",
  aunty: "આંટી",
  urgent: "અર્જન્ટ (તાત્કાલિક)",

  // First Names (Female & Male)
  mona: "મોના",
  gopi: "ગોપી",
  pooja: "પૂજા",
  puja: "પૂજા",
  sunita: "સુનીતા",
  priya: "પ્રિયા",
  sneha: "સ્નેહા",
  neha: "નેહા",
  ritu: "રીતુ",
  swati: "સ્વાતિ",
  nirali: "નિરાલી",
  kinjal: "કિંજલ",
  hetal: "હેતલ",
  sheetal: "શીતલ",
  shital: "શીતલ",
  drashti: "દ્રષ્ટિ",
  drishti: "દ્રષ્ટિ",
  kajal: "કાજલ",
  payal: "પાયલ",
  rupal: "રૂપલ",
  krupa: "કૃપા",
  divya: "દિવ્યા",
  falguni: "ફાલ્ગુની",
  jayshree: "જયશ્રી",
  jaishree: "જયશ્રી",
  jigna: "જીજ્ઞા",
  parul: "પારુલ",
  alka: "અલકા",
  anita: "અનિતા",
  geeta: "ગીતા",
  gita: "ગીતા",
  meena: "મીના",
  mina: "મીના",
  seema: "સીમા",
  sima: "સીમા",
  rekha: "રેખા",
  varsha: "વર્ષા",
  sonal: "સોનલ",
  bijal: "બીજલ",
  chetna: "ચેતના",
  darshana: "દર્શના",
  devangi: "દેવાંગી",
  dimple: "ડિમ્પલ",
  hansha: "હંસા",
  hansa: "હંસા",
  ila: "ઈલા",
  jagruti: "જાગૃતિ",
  kavita: "કવિતા",
  kusum: "કુસુમ",
  leela: "લીલા",
  lila: "લીલા",
  mamta: "મમતા",
  nayana: "નયના",
  neelam: "નીલમ",
  nilam: "નીલમ",
  pratima: "પ્રતિમા",
  pushpa: "પુષ્પા",
  ranjana: "રંજના",
  rashmi: "રશ્મિ",
  reena: "રીના",
  rina: "રીના",
  sangita: "સંગીતા",
  sangeeta: "સંગીતા",
  saroj: "સરોજ",
  shobha: "શોભા",
  sudha: "સુધા",
  sujata: "સુજાતા",
  sunayana: "સુનયના",
  sushila: "સુશીલા",
  taruna: "તરુણા",
  usha: "ઉષા",
  vimla: "વિમલા",
  yogita: "યોગિતા",
  ananya: "અનન્યા",
  anjali: "અંજલિ",
  aaradhya: "આરાધ્યા",
  aarti: "આરતી",
  arti: "આરતી",
  avni: "અવનિ",
  bhavna: "ભાવના",
  bhavana: "ભાવના",
  charu: "ચારુ",
  deepa: "દીપા",
  disha: "દિશા",
  diya: "દિયા",
  dolly: "ડોલી",
  garima: "ગરિમા",
  heena: "હીના",
  hina: "હીના",
  isha: "ઇશા",
  jaya: "જયા",
  juhi: "જુહી",
  jyoti: "જ્યોતિ",
  kavya: "કાવ્યા",
  khushi: "ખુશી",
  krishna: "કૃષ્ણા",
  latika: "લતિકા",
  lata: "લતા",
  madhu: "મધુ",
  manju: "મંજૂ",
  mansi: "માનસી",
  maya: "માયા",
  megha: "મેઘા",
  minal: "મીનલ",
  nandini: "નંદિની",
  nikita: "નિકિતા",
  nisha: "નિશા",
  pallavi: "પલ્લવી",
  prachi: "પ્રાચી",
  prerna: "પ્રેરણા",
  priti: "પ્રીતિ",
  preeti: "પ્રીતિ",
  radha: "રાધા",
  riddhi: "રિદ્ધિ",
  siddhi: "સિદ્ધિ",
  roshni: "રોશની",
  sakshi: "સાક્ષી",
  sapna: "સપના",
  sarita: "સરિતા",
  shreya: "શ્રેયા",
  shruti: "શ્રુતિ",
  smita: "સ્મિતા",
  suman: "સુમન",
  tanya: "તાન્યા",
  tanvi: "તન્વી",
  trisha: "ત્રિશા",
  urvashi: "ઉર્વશી",
  urvi: "ઉર્વી",
  vaishali: "વૈશાલી",
  vandana: "વંદના",
  vidhi: "વિધિ",
  ali: "અલી",
  amit: "અમિત",
  anand: "આનંદ",
  anil: "અનિલ",
  ashok: "અશોક",
  bharat: "ભરત",
  bhavesh: "ભાવેશ",
  chetan: "ચેતન",
  chirag: "ચિરાગ",
  deepak: "દીપક",
  dharmesh: "ધર્મેશ",
  dinesh: "દિનેશ",
  harish: "હરીશ",
  hitesh: "હિતેશ",
  jagdish: "જગદીશ",
  jay: "જય",
  jignesh: "જીજ્ઞેશ",
  kalpesh: "કલ્પેશ",
  kamlesh: "કમલેશ",
  kaushik: "કૌશિક",
  kirit: "કિરીટ",
  mahesh: "મહેશ",
  manish: "મનીષ",
  mayur: "મયૂર",
  mehool: "મેહુલ",
  mehul: "મેહુલ",
  mukesh: "મુકેશ",
  naresh: "નરેશ",
  navin: "નવીન",
  nikunj: "નિકુંજ",
  nilesh: "નિલેશ",
  paresh: "પરેશ",
  parth: "પાર્થ",
  pankaj: "પંકજ",
  piyush: "પીયૂષ",
  pradip: "પ્રદીપ",
  pradeep: "પ્રદીપ",
  prakash: "પ્રકાશ",
  prashant: "પ્રશાંત",
  pravin: "પ્રવીણ",
  rahul: "રાહુલ",
  raj: "રાજ",
  rajesh: "રાજેશ",
  rakesh: "રાકેશ",
  ramesh: "રમેશ",
  ravi: "રવિ",
  rohit: "રોહિત",
  ronak: "રોનક",
  sachin: "સચિન",
  samir: "સમીર",
  sameer: "સમીર",
  sanjay: "સંજય",
  suresh: "સુરેશ",
  tarun: "તરુણ",
  tushar: "તુષાર",
  umesh: "ઉમેશ",
  vijay: "વિજય",
  vinod: "વિનોદ",
  vipul: "વિપુલ",
  vishal: "વિશાલ",
  yash: "યશ",

  // Surnames
  patel: "પટેલ",
  shah: "શાહ",
  mehta: "મહેતા",
  desai: "દેસાઈ",
  joshi: "જોશી",
  panchal: "પંચાલ",
  soni: "સોની",
  gala: "ગાલા",
  chheda: "છેડા",
  kothari: "કોઠારી",
  bhanushali: "ભાનુશાળી",
  thakkar: "ઠક્કર",
  dave: "દવે",
  pandya: "પંડ્યા",
  trivedi: "ત્રિવેદી",
  vora: "વોરા",
  gandhi: "ગાંધી",
  modi: "મોદી",
  parikh: "પરીખ",
  merchant: "મર્ચન્ટ",
  gada: "ગડા",
  bhatt: "ભટ્ટ",
  doshi: "દોશી",
  raval: "રાવલ",
  vyas: "વ્યાસ",
  zaveri: "ઝવેરી",
  chauhan: "ચૌહાણ",
  solanki: "સોલંકી",
  rathod: "રાઠોડ",
  parmar: "પરમાર",
  gohil: "ગોહિલ",
  makwana: "મકવાણા",
  prajapati: "પ્રજાપતિ",
  gajjar: "ગજ્જર",
  sutaria: "સુતરીયા",
  sanghvi: "સંઘવી",
  vakil: "વકીલ",
  dalal: "દલાલ",
  shroff: "શ્રોફ",
  amin: "અમીન",
  chitroda: "ચિત્રોડા",
  savla: "સાવલા",
  bheda: "ભેડા",
  dedhia: "ડેઢિયા",
  sharma: "શર્મા",
  verma: "વર્મા",
  gupta: "ગુપ્તા",
  agarwal: "અગ્રવાલ",
  jain: "જૈન",
};

/**
 * Phonetic transliteration fallback for any name not in the static dictionary
 */
function phoneticTransliterate(word: string): string {
  if (!word) return "";
  const lower = word.toLowerCase();

  const rules: Array<[RegExp, string]> = [
    // Complex conjuncts
    [/ksh/g, "ક્ષ"],
    [/shh/g, "ષ"],
    [/chh/g, "છ"],
    [/ch/g, "ચ"],
    [/sh/g, "શ"],
    [/th/g, "થ"],
    [/dh/g, "ધ"],
    [/bh/g, "ભ"],
    [/gh/g, "ઘ"],
    [/kh/g, "ખ"],
    [/ph/g, "ફ"],
    [/jh/g, "ઝ"],
    [/zh/g, "ઝ"],
    [/tr/g, "ત્ર"],
    [/pr/g, "પ્ર"],
    [/kr/g, "ક્ર"],
    [/gr/g, "ગ્ર"],
    [/dr/g, "દ્ર"],
    [/br/g, "બ્ર"],
    [/gn/g, "જ્ઞ"],
    [/gy/g, "જ્ઞ"],

    // Vowels
    [/ee/g, "ી"],
    [/oo/g, "ૂ"],
    [/ai/g, "ૈ"],
    [/au/g, "ૌ"],
    [/ou/g, "ૌ"],
    [/aa/g, "ા"],
    [/ae/g, "ે"],

    // Consonants + basic vowels
    [/ka/g, "કા"],
    [/ki/g, "કી"],
    [/ku/g, "કુ"],
    [/ke/g, "કે"],
    [/ko/g, "કો"],
    [/k/g, "ક"],

    [/ga/g, "ગા"],
    [/gi/g, "ગી"],
    [/gu/g, "ગુ"],
    [/ge/g, "ગે"],
    [/go/g, "ગો"],
    [/g/g, "ગ"],

    [/ja/g, "જા"],
    [/ji/g, "જી"],
    [/ju/g, "જુ"],
    [/je/g, "જે"],
    [/jo/g, "જો"],
    [/j/g, "જ"],

    [/ta/g, "તા"],
    [/ti/g, "તી"],
    [/tu/g, "તુ"],
    [/te/g, "તે"],
    [/to/g, "તો"],
    [/t/g, "ત"],

    [/da/g, "દા"],
    [/di/g, "દી"],
    [/du/g, "દુ"],
    [/de/g, "દે"],
    [/do/g, "દો"],
    [/d/g, "દ"],

    [/na/g, "ના"],
    [/ni/g, "ની"],
    [/nu/g, "નુ"],
    [/ne/g, "ને"],
    [/no/g, "નો"],
    [/n/g, "ન"],

    [/pa/g, "પા"],
    [/pi/g, "પી"],
    [/pu/g, "પુ"],
    [/pe/g, "પે"],
    [/po/g, "પો"],
    [/p/g, "પ"],

    [/fa/g, "ફા"],
    [/fi/g, "ફી"],
    [/fu/g, "ફુ"],
    [/fe/g, "ફે"],
    [/fo/g, "ફો"],
    [/f/g, "ફ"],

    [/ba/g, "બા"],
    [/bi/g, "બી"],
    [/bu/g, "બુ"],
    [/be/g, "બે"],
    [/bo/g, "બો"],
    [/b/g, "બ"],

    [/ma/g, "મા"],
    [/mi/g, "મી"],
    [/mu/g, "મુ"],
    [/me/g, "મે"],
    [/mo/g, "મો"],
    [/m/g, "મ"],

    [/ya/g, "યા"],
    [/yi/g, "યી"],
    [/yu/g, "યુ"],
    [/ye/g, "યે"],
    [/yo/g, "યો"],
    [/y/g, "ય"],

    [/ra/g, "રા"],
    [/ri/g, "રી"],
    [/ru/g, "રુ"],
    [/re/g, "રે"],
    [/ro/g, "રો"],
    [/r/g, "ર"],

    [/la/g, "લા"],
    [/li/g, "લી"],
    [/lu/g, "લુ"],
    [/le/g, "લે"],
    [/lo/g, "લો"],
    [/l/g, "લ"],

    [/va/g, "વા"],
    [/vi/g, "વી"],
    [/vu/g, "વુ"],
    [/ve/g, "વે"],
    [/vo/g, "વો"],
    [/v/g, "વ"],
    [/wa/g, "વા"],
    [/wi/g, "વી"],
    [/wu/g, "વુ"],
    [/we/g, "વે"],
    [/wo/g, "વો"],
    [/w/g, "વ"],

    [/sa/g, "સા"],
    [/si/g, "સી"],
    [/su/g, "સુ"],
    [/se/g, "સે"],
    [/so/g, "સો"],
    [/s/g, "સ"],

    [/ha/g, "હા"],
    [/hi/g, "હી"],
    [/hu/g, "હુ"],
    [/he/g, "હે"],
    [/ho/g, "હો"],
    [/h/g, "હ"],

    [/za/g, "ઝા"],
    [/zi/g, "ઝી"],
    [/zu/g, "ઝુ"],
    [/ze/g, "ઝે"],
    [/zo/g, "ઝો"],
    [/z/g, "ઝ"],

    // Standalone vowels
    [/^a/g, "અ"],
    [/a$/g, "ા"],
    [/a/g, ""],
    [/i/g, "િ"],
    [/u/g, "ુ"],
    [/e/g, "ે"],
    [/o/g, "ો"],
  ];

  let res = lower;
  for (const [regex, rep] of rules) {
    res = res.replace(regex, rep);
  }
  return res;
}

/**
 * Translate customer name into Gujarati (e.g. "Mona Ben (Gopi)" -> "મોના બેન (ગોપી)")
 */
export function translateCustomerName(name: string, lang: KarigarLang): string {
  if (!name || lang === "en") return name;

  // Split name while preserving punctuation and spaces
  const parts = name.split(/(\s+|[()\-–,./#]+)/);

  const translatedParts = parts.map((part) => {
    if (!part || /^\s+$/.test(part) || /^[()\-–,./#]+$/.test(part) || /^\d+$/.test(part)) {
      return part;
    }

    const clean = part.toLowerCase().trim();
    if (CUSTOMER_NAME_DICT[clean]) {
      return CUSTOMER_NAME_DICT[clean];
    }

    // Try transliterating individual word
    return phoneticTransliterate(part) || part;
  });

  return translatedParts.join("");
}

/**
 * Translate stage name
 */
export function translateStageName(stage: string, lang: KarigarLang): string {
  if (!stage) return "";
  const entry = STAGE_TRANSLATIONS[stage];
  if (entry) {
    return lang === "gu" ? entry.gu : entry.en;
  }
  return lang === "gu" ? translateGarmentName(stage, "gu") : stage;
}


