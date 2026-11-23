import type { Bi } from '@mqr/shared';
import type { Message } from './types';
import { arNum } from './forms';

export const calculator = {
  annualInterest: { ar: 'نسبة الفايدة السنوية ٪', en: 'Annual interest %' },
  bankFinance: { ar: 'تمويل بنكي', en: 'Bank finance' },
  developerPlan0: { ar: 'خطة المطوّر (بدون فوايد)', en: 'Developer plan (0%)' },
  downPayment: { ar: 'المقدم (٪)', en: 'Down payment (%)' },
  downPaymentEgp: { ar: 'المقدم (جنيه)', en: 'Down payment (EGP)' },
  estimatesForGuidanceYourSales: { ar: 'أرقام تقديرية للتوضيح. مسؤول المبيعات بيأكد الخطة النهائية معاك وقت المعاينة.', en: 'Estimates for guidance. Your sales advisor confirms the final plan with you at the viewing.' },
  installments: { ar: 'عدد الأقساط', en: 'Installments' },
  monthly: { ar: 'شهري', en: 'Monthly' },
  paymentPeriodYears: { ar: 'مدة التقسيط (بالسنين)', en: 'Payment period (years)' },
  quarterly: { ar: 'ربع سنوي', en: 'Quarterly' },
  quarterlyInstallment: { ar: 'القسط الربع سنوي', en: 'Quarterly installment' },
  total: { ar: 'الإجمالي', en: 'Total' },
  unitPriceEgp: { ar: 'سعر الوحدة (جنيه)', en: 'Unit price (EGP)' },
  yourDownPayment: { ar: 'مقدمك', en: 'Your down payment' },
  downRange: (min: number, max: number): Bi => ({ ar: `المقدم من ${arNum(min)}٪ لـ ${arNum(max)}٪`, en: `The down payment is ${min}% to ${max}%` }),
  yearsRange: (min: number, max: number): Bi => ({ ar: `من ${arNum(min)} لـ ${arNum(max)} سنين`, en: `${min} to ${max} years` }),
} satisfies Record<string, Message>;
