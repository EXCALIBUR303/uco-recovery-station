/**
 * All on-screen text as a lookup table per language (spec §3.1), so adding a
 * language never means building new screens.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];

type Phrases = {
  chooseLanguage: string;
  scanTitle: string;
  scanBody: string;
  connected: string;
  pourTitle: string;
  pourBody: string;
  verifying: string;
  thankYou: string;
  paidAmount: string;
  rejectedTitle: string;
  disposed: string;
  warning: string;
  reason_not_oil: string;
  reason_water_contaminated: string;
  reason_low_quality: string;
  unavailableTitle: string;
  drumFull: string;
  rejectFull: string;
  balanceZero: string;
  offline: string;
  returning: string;
};

export const PHRASES: Record<LangCode, Phrases> = {
  en: {
    chooseLanguage: 'Choose your language',
    scanTitle: 'Scan to begin',
    scanBody: 'Scan this code with your phone camera to connect.',
    connected: 'Phone connected',
    pourTitle: 'Pour your oil now',
    pourBody: 'Empty your used cooking oil into the intake.',
    verifying: 'Checking your oil…',
    thankYou: 'Thank you',
    paidAmount: 'Paid to your UPI',
    rejectedTitle: 'Not accepted',
    disposed: 'What you poured has been sent to the waste tank.',
    warning:
      'Please do not pour anything else in. Repeated invalid deposits can restrict your account.',
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
    returning: 'Welcome back',
  },
  hi: {
    chooseLanguage: 'अपनी भाषा चुनें',
    scanTitle: 'शुरू करने के लिए स्कैन करें',
    scanBody: 'जुड़ने के लिए इस कोड को अपने फ़ोन कैमरे से स्कैन करें।',
    connected: 'फ़ोन जुड़ गया',
    pourTitle: 'अब अपना तेल डालें',
    pourBody: 'अपना इस्तेमाल किया हुआ खाना पकाने का तेल इनटेक में डालें।',
    verifying: 'आपके तेल की जाँच हो रही है…',
    thankYou: 'धन्यवाद',
    paidAmount: 'आपके UPI पर भेजा गया',
    rejectedTitle: 'स्वीकार नहीं किया गया',
    disposed: 'आपने जो डाला वह अपशिष्ट टैंक में भेज दिया गया है।',
    warning:
      'कृपया और कुछ न डालें। बार-बार अमान्य जमा करने से आपका खाता प्रतिबंधित हो सकता है।',
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
    returning: 'वापसी पर स्वागत है',
  },
  mr: {
    chooseLanguage: 'तुमची भाषा निवडा',
    scanTitle: 'सुरू करण्यासाठी स्कॅन करा',
    scanBody: 'जोडण्यासाठी हा कोड तुमच्या फोन कॅमेऱ्याने स्कॅन करा.',
    connected: 'फोन जोडला गेला',
    pourTitle: 'आता तुमचे तेल ओता',
    pourBody: 'तुमचे वापरलेले स्वयंपाकाचे तेल इनटेकमध्ये ओता.',
    verifying: 'तुमच्या तेलाची तपासणी सुरू आहे…',
    thankYou: 'धन्यवाद',
    paidAmount: 'तुमच्या UPI वर पाठवले',
    rejectedTitle: 'स्वीकारले नाही',
    disposed: 'तुम्ही ओतलेले कचरा टाकीत पाठवले आहे.',
    warning:
      'कृपया आणखी काही ओतू नका. वारंवार अवैध जमा केल्यास तुमचे खाते बंद होऊ शकते.',
    reason_not_oil: 'हे तेल असल्याचे दिसत नाही.',
    reason_water_contaminated: 'हे द्रव स्वीकारण्यासाठी खूप दूषित होते.',
    reason_low_quality: 'या तेलाची गुणवत्ता खूप कमी आहे.',
    unavailableTitle: 'तात्पुरते अनुपलब्ध',
    drumFull:
      'ही मशीन सध्या भरलेली आहे आणि तेल घेऊ शकत नाही. कृपया नंतर प्रयत्न करा.',
    rejectFull:
      'तेल घेण्यापूर्वी या मशीनची सर्व्हिसिंग आवश्यक आहे. कृपया नंतर प्रयत्न करा.',
    balanceZero:
      'ही मशीन तात्पुरती सेवेत नाही. कृपया नंतर प्रयत्न करा.',
    offline: 'ही मशीन जोडलेली नाही. कृपया नंतर प्रयत्न करा.',
    returning: 'पुन्हा स्वागत आहे',
  },
};

export const rupees = (paise: string | number | bigint): string => {
  const n = Number(paise) / 100;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
