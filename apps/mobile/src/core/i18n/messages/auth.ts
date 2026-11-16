import type { Bi } from '@maqar/shared';
import type { Message } from './types';
import { arNum } from './forms';

export const auth = {
  aNewCodeIsOn: { ar: 'بعتنا كود جديد', en: 'A new code is on its way' },
  code: { ar: 'الكود', en: 'Code' },
  createAccount: { ar: 'إنشاء حساب', en: 'Create account' },
  createAnAccount: { ar: 'حساب جديد', en: 'Create an account' },
  forgotPassword: { ar: 'نسيت كلمة السر', en: 'Forgot password' },
  haveAnAccountSignIn: { ar: 'عندك حساب؟ ادخل', en: 'Have an account? Sign in' },
  n8CharactersALetterAnd: { ar: '٨ حروف على الأقل، فيها حرف ورقم', en: '8+ characters, a letter and a digit' },
  noAccountCreateOne: { ar: 'معندكش حساب؟ اعمل حساب', en: 'No account? Create one' },
  notNow: { ar: 'مش دلوقتي', en: 'Not now' },
  saveHomesFollowPricesAnd: { ar: 'احفظ الوحدات، تابع الأسعار، واحجز معاينات.', en: 'Save homes, follow prices and book viewings.' },
  sendMeTheCode: { ar: 'ابعتلي الكود', en: 'Send me the code' },
  sendTheCodeAgain: { ar: 'ابعت الكود تاني', en: 'Send the code again' },
  signIn: { ar: 'دخول', en: 'Sign in' },
  signInFirst: { ar: 'سجّل دخولك الأول', en: 'Sign in first' },
  soYourAdvisorCanCall: { ar: 'عشان المسؤول يقدر يكلمك', en: 'So your advisor can call you' },
  theCodeIsWrongOr: { ar: 'الكود غلط أو وقته خلص. اطلب كود جديد لو محتاج.', en: 'The code is wrong or has expired. Ask for a new one if you need to.' },
  typeYourAccountsEmailAnd: { ar: 'اكتب إيميل حسابك، وهنبعتلك كود تعمل بيه كلمة سر جديدة.', en: 'Type your account’s email and we’ll send you a code to set a new password.' },
  welcomeBack: { ar: 'أهلًا بيك تاني', en: 'Welcome back' },
  youNeedAnAccountTo: { ar: 'محتاج حساب عشان تحفظ البيوت، تتابع الأسعار، تحجز معاينة أو تكلّم المستشار.', en: 'You need an account to save homes, follow prices, book viewings or chat with an advisor.' },
  codeSent: (email: string, minutes: number): Bi => ({
    ar: `لو الإيميل ${email} عليه حساب، هيوصله كود من ٦ أرقام شغال ${arNum(minutes)} دقيقة. بص في الـ Spam لو مش لاقيه.`,
    en: `If ${email} has an account, it gets a 6-digit code that works for ${minutes} minutes. Check spam if you can’t find it.`,
  }),
  cantReachServer: { ar: 'مش قادرين نوصل للخادم، اتأكد من النت.', en: "Can't reach the server. Check your connection." },
  wrongEmailOrPassword: { ar: 'الإيميل أو كلمة السر غلط', en: 'Wrong email or password' },
  thisEmailAlreadyHasAn: { ar: 'الإيميل ده عليه حساب بالفعل', en: 'This email already has an account' },
  tooManyAttemptsWaitA: { ar: 'محاولات كتير، استنى دقيقة وجرّب تاني', en: 'Too many attempts. Wait a minute and try again.' },
  checkYourDetailsAValid: { ar: 'اتأكد من البيانات: إيميل صحيح، وكلمة سر ٨ حروف على الأقل فيها حرف ورقم.', en: 'Check your details: a valid email, and a password of 8+ characters with a letter and a digit.' },
} satisfies Record<string, Message>;
