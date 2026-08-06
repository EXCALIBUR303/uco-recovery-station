/**
 * All on-screen text as a lookup table per language (spec §3.1), so adding a
 * language never means building new screens.
 *
 * Note on the machine plate (station / rate / status): it stays in English in
 * every language, deliberately. It renders before anyone has chosen a language,
 * and equipment nameplates are conventionally untranslated — it reads as the
 * machine's own stamped identity rather than as interface copy.
 */

/** `label` is the language in its own script; `roman` labels it for anyone who
 *  can't read that script yet still needs to find their own row. */
export const LANGUAGES = [
  { code: 'en', label: 'English', roman: 'English' },
  { code: 'hi', label: 'हिंदी', roman: 'Hindi' },
  { code: 'mr', label: 'मराठी', roman: 'Marathi' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];

type Phrases = {
  chooseLanguage: string;

  /* idle / offer */
  offerTitle: string;
  rateLabel: string;
  perKg: string;
  proofPaid: string;
  proofWeighed: string;
  proofFast: string;

  /* connect */
  scanTitle: string;
  scanBody: string;
  scanStep1: string;
  scanStep2: string;
  scanStep3: string;
  upiPrivacy: string;

  /* pour */
  connected: string;
  returning: string;
  pourTitle: string;
  pourBody: string;
  pourAim: string;
  guardLabel: string;
  guardText: string;

  /* processing */
  verifying: string;
  gateWeight: string;
  gatePurity: string;
  gateQuality: string;

  /* accepted */
  paidLabel: string;
  thankYou: string;
  paidAmount: string;
  docketWeight: string;
  docketRate: string;
  docketTotal: string;

  /* rejected */
  rejectedTitle: string;
  disposed: string;
  warning: string;
  pouredLabel: string;
  nextTimeLabel: string;
  reason_not_oil: string;
  reason_water_contaminated: string;
  reason_low_quality: string;

  /* unavailable */
  unavailableTitle: string;
  drumFull: string;
  rejectFull: string;
  balanceZero: string;
  offline: string;

  /* step spine */
  stepLanguage: string;
  stepConnect: string;
  stepPour: string;
  stepResult: string;
};

export const PHRASES: Record<LangCode, Phrases> = {
  en: {
    chooseLanguage: 'Choose your language',

    offerTitle: 'We buy your used cooking oil.',
    rateLabel: "Today's rate",
    perKg: 'per kilogram',
    proofPaid: 'Paid straight to your UPI',
    proofWeighed: 'Weighed the moment you pour',
    proofFast: 'Takes about a minute',

    scanTitle: 'Scan to get paid',
    scanBody: 'Your money is sent to your UPI, so the machine needs to know where.',
    scanStep1: 'Open the camera on your phone',
    scanStep2: 'Scan this code',
    scanStep3: 'Enter your UPI ID once',
    upiPrivacy:
      'Your UPI ID is used only to send your money. You type it on your own phone, never on this screen.',

    connected: 'Phone connected',
    returning: 'Welcome back',
    pourTitle: 'Pour your oil now',
    pourBody: 'Empty your used cooking oil into the intake.',
    pourAim: 'Into the intake below',
    guardLabel: 'Accepted',
    guardText: 'Used cooking oil only. No water, no food waste, no engine oil.',

    verifying: 'Checking your oil',
    gateWeight: 'Weight',
    gatePurity: 'Purity',
    gateQuality: 'Quality',

    paidLabel: 'Paid',
    thankYou: 'Thank you',
    paidAmount: 'Sent to your UPI',
    docketWeight: 'Weight',
    docketRate: 'Rate',
    docketTotal: 'Paid',

    rejectedTitle: 'Not accepted',
    disposed: 'What you poured has been sent to the waste tank.',
    warning:
      'Please do not pour anything else in. Repeated invalid deposits can restrict your account.',
    pouredLabel: 'Poured',
    nextTimeLabel: 'Next time',
    reason_not_oil: 'This does not appear to be oil.',
    reason_water_contaminated: 'This liquid was too contaminated to accept.',
    reason_low_quality: 'This oil’s quality is too low to accept.',

    unavailableTitle: 'Temporarily unavailable',
    drumFull:
      'This machine is currently full and cannot accept oil right now. Please try again later.',
    rejectFull:
      'This machine needs servicing before it can accept oil again. Please try again later.',
    balanceZero:
      'This machine is temporarily out of service. Please try again later.',
    offline: 'This machine is not connected. Please try again later.',

    stepLanguage: 'Language',
    stepConnect: 'Connect',
    stepPour: 'Pour',
    stepResult: 'Paid',
  },

  hi: {
    chooseLanguage: 'अपनी भाषा चुनें',

    offerTitle: 'हम आपका इस्तेमाल किया हुआ खाना पकाने का तेल खरीदते हैं।',
    rateLabel: 'आज का भाव',
    perKg: 'प्रति किलो',
    proofPaid: 'सीधे आपके UPI में भुगतान',
    proofWeighed: 'डालते ही तुलाई',
    proofFast: 'लगभग एक मिनट',

    scanTitle: 'भुगतान पाने के लिए स्कैन करें',
    scanBody:
      'पैसे आपके UPI पर भेजे जाते हैं, इसलिए मशीन को आपका UPI जानना ज़रूरी है।',
    scanStep1: 'अपने फ़ोन का कैमरा खोलें',
    scanStep2: 'इस कोड को स्कैन करें',
    scanStep3: 'एक बार अपनी UPI ID डालें',
    upiPrivacy:
      'आपकी UPI ID सिर्फ़ पैसे भेजने के लिए इस्तेमाल होती है। इसे अपने फ़ोन पर डालें, इस स्क्रीन पर नहीं।',

    connected: 'फ़ोन जुड़ गया',
    returning: 'वापसी पर स्वागत है',
    pourTitle: 'अब अपना तेल डालें',
    pourBody: 'अपना इस्तेमाल किया हुआ खाना पकाने का तेल इनटेक में डालें।',
    pourAim: 'नीचे दिए इनटेक में',
    guardLabel: 'स्वीकार्य',
    guardText:
      'सिर्फ़ इस्तेमाल किया हुआ खाना पकाने का तेल। पानी, खाना या इंजन ऑयल नहीं।',

    verifying: 'आपके तेल की जाँच हो रही है',
    gateWeight: 'वज़न',
    gatePurity: 'शुद्धता',
    gateQuality: 'गुणवत्ता',

    paidLabel: 'भुगतान हुआ',
    thankYou: 'धन्यवाद',
    paidAmount: 'आपके UPI पर भेजा गया',
    docketWeight: 'वज़न',
    docketRate: 'भाव',
    docketTotal: 'कुल भुगतान',

    rejectedTitle: 'स्वीकार नहीं किया गया',
    disposed: 'आपने जो डाला वह अपशिष्ट टैंक में भेज दिया गया है।',
    warning:
      'कृपया और कुछ न डालें। बार-बार अमान्य जमा करने से आपका खाता प्रतिबंधित हो सकता है।',
    pouredLabel: 'डाला गया',
    nextTimeLabel: 'अगली बार',
    reason_not_oil: 'यह तेल नहीं लगता।',
    reason_water_contaminated: 'यह तरल स्वीकार करने के लिए बहुत दूषित था।',
    reason_low_quality: 'इस तेल की गुणवत्ता बहुत कम है।',

    unavailableTitle: 'अस्थायी रूप से अनुपलब्ध',
    drumFull:
      'यह मशीन अभी भरी हुई है और तेल नहीं ले सकती। कृपया बाद में प्रयास करें।',
    rejectFull:
      'तेल लेने से पहले इस मशीन की सर्विसिंग ज़रूरी है। कृपया बाद में प्रयास करें।',
    balanceZero:
      'यह मशीन अस्थायी रूप से सेवा में नहीं है। कृपया बाद में प्रयास करें।',
    offline: 'यह मशीन जुड़ी नहीं है। कृपया बाद में प्रयास करें।',

    stepLanguage: 'भाषा',
    stepConnect: 'जुड़ें',
    stepPour: 'डालें',
    stepResult: 'भुगतान',
  },

  mr: {
    chooseLanguage: 'तुमची भाषा निवडा',

    offerTitle: 'आम्ही तुमचे वापरलेले स्वयंपाकाचे तेल विकत घेतो.',
    rateLabel: 'आजचा दर',
    perKg: 'प्रति किलो',
    proofPaid: 'थेट तुमच्या UPI मध्ये पैसे',
    proofWeighed: 'ओतल्याबरोबर वजन',
    proofFast: 'सुमारे एक मिनिट',

    scanTitle: 'पैसे मिळवण्यासाठी स्कॅन करा',
    scanBody:
      'पैसे तुमच्या UPI वर पाठवले जातात, म्हणून मशीनला तुमची UPI माहिती हवी.',
    scanStep1: 'तुमच्या फोनचा कॅमेरा उघडा',
    scanStep2: 'हा कोड स्कॅन करा',
    scanStep3: 'एकदा तुमची UPI ID टाका',
    upiPrivacy:
      'तुमची UPI ID फक्त पैसे पाठवण्यासाठी वापरली जाते. ती तुमच्या फोनवर टाका, या स्क्रीनवर नाही.',

    connected: 'फोन जोडला गेला',
    returning: 'पुन्हा स्वागत आहे',
    pourTitle: 'आता तुमचे तेल ओता',
    pourBody: 'तुमचे वापरलेले स्वयंपाकाचे तेल इनटेकमध्ये ओता.',
    pourAim: 'खालील इनटेकमध्ये',
    guardLabel: 'स्वीकार्य',
    guardText:
      'फक्त वापरलेले स्वयंपाकाचे तेल. पाणी, अन्न किंवा इंजिन ऑइल नाही.',

    verifying: 'तुमच्या तेलाची तपासणी सुरू आहे',
    gateWeight: 'वजन',
    gatePurity: 'शुद्धता',
    gateQuality: 'गुणवत्ता',

    paidLabel: 'पैसे दिले',
    thankYou: 'धन्यवाद',
    paidAmount: 'तुमच्या UPI वर पाठवले',
    docketWeight: 'वजन',
    docketRate: 'दर',
    docketTotal: 'एकूण',

    rejectedTitle: 'स्वीकारले नाही',
    disposed: 'तुम्ही ओतलेले कचरा टाकीत पाठवले आहे.',
    warning:
      'कृपया आणखी काही ओतू नका. वारंवार अवैध जमा केल्यास तुमचे खाते बंद होऊ शकते.',
    pouredLabel: 'ओतले',
    nextTimeLabel: 'पुढच्या वेळी',
    reason_not_oil: 'हे तेल असल्याचे दिसत नाही.',
    reason_water_contaminated: 'हे द्रव स्वीकारण्यासाठी खूप दूषित होते.',
    reason_low_quality: 'या तेलाची गुणवत्ता खूप कमी आहे.',

    unavailableTitle: 'तात्पुरते अनुपलब्ध',
    drumFull:
      'ही मशीन सध्या भरलेली आहे आणि तेल घेऊ शकत नाही. कृपया नंतर प्रयत्न करा.',
    rejectFull:
      'तेल घेण्यापूर्वी या मशीनची सर्व्हिसिंग आवश्यक आहे. कृपया नंतर प्रयत्न करा.',
    balanceZero: 'ही मशीन तात्पुरती सेवेत नाही. कृपया नंतर प्रयत्न करा.',
    offline: 'ही मशीन जोडलेली नाही. कृपया नंतर प्रयत्न करा.',

    stepLanguage: 'भाषा',
    stepConnect: 'जोडा',
    stepPour: 'ओता',
    stepResult: 'पैसे',
  },
};

export const rupees = (paise: string | number | bigint): string => {
  const n = Number(paise) / 100;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Whole rupees, no decimals — for the big idle-screen rate figure. */
export const rupeesWhole = (paise: string | number | bigint): string =>
  `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;

/** Grams as kilograms to 3dp. The depositor must be able to check the weight
 *  they were paid on, so this is never rounded away. */
export const kilos = (grams: number): string => `${(grams / 1000).toFixed(3)} kg`;
