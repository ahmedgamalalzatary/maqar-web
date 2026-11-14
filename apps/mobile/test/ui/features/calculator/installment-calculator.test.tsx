import { DEFAULT_APP_SETTINGS, fmtMoney, fmtNum, installment } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { useAppConfig } from '@/core/app-config/store';
import { InstallmentCalculator } from '@/features/calculator/components/installment-calculator';
import { CalculatorScreen } from '@/features/calculator/screens/calculator-screen';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const PRICE = 10_000_000;
const money = (n: number) => fmtMoney(Math.round(n), 'ar', false);
const pick = (role: 'radio', name: string) => fireEvent.press(screen.getByRole(role, { name }));
const slide = (name: string, actionName: 'increment' | 'decrement') =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', { nativeEvent: { actionName } });

beforeEach(() => {
  jest.clearAllMocks();
  useAppConfig.setState({ config: DEFAULT_APP_SETTINGS });
});

describe('The installment calculator', () => {
  it('starts from the given plan, with all four results', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    const plan = installment(PRICE, 20, 5);

    expect(screen.getByText('القسط الشهري')).toBeOnTheScreen();
    expect(screen.getByText(money(plan.payment))).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(plan.down, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText(fmtNum(plan.count, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(plan.total, 'ar'))).toBeOnTheScreen();
    expect(screen.getByLabelText('مدة التقسيط (بالسنين)').props.value).toBe('٥');
    expect(screen.getByRole('radio', { name: 'خطة المطوّر (بدون فوايد)', checked: true })).toBeOnTheScreen();
  });

  it('changes with the years and the down payment', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);

    await fireEvent.changeText(screen.getByLabelText('مدة التقسيط (بالسنين)'), '١٠');
    expect(screen.getByText(money(installment(PRICE, 20, 10).payment))).toBeOnTheScreen();

    await slide('المقدم', 'increment');
    expect(screen.getByText(money(installment(PRICE, 25, 10).payment))).toBeOnTheScreen();
  });

  it('pays quarterly when asked', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);

    await pick('radio', 'ربع سنوي');

    const plan = installment(PRICE, 20, 5, 0, true);
    expect(screen.getByText('القسط الربع سنوي')).toBeOnTheScreen();
    expect(screen.getByText(money(plan.payment))).toBeOnTheScreen();
    expect(screen.getByText(fmtNum(plan.count, 'ar'))).toBeOnTheScreen();
  });

  it('adds interest for bank finance, 18% by default, and hides the rate for a developer plan', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    const RATE = 'نسبة الفايدة السنوية ٪';
    expect(screen.queryByLabelText(RATE)).toBeNull();

    await pick('radio', 'تمويل بنكي');
    expect(screen.getByLabelText(RATE).props.value).toBe('١٨');
    expect(screen.getByText(money(installment(PRICE, 20, 5, 18).payment))).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(RATE), '٢٠');
    expect(screen.getByText(money(installment(PRICE, 20, 5, 20).payment))).toBeOnTheScreen();

    await pick('radio', 'ربع سنوي');
    expect(screen.getByText(money(installment(PRICE, 20, 5, 20, true).payment))).toBeOnTheScreen();

    await pick('radio', 'خطة المطوّر (بدون فوايد)');
    expect(screen.queryByLabelText(RATE)).toBeNull();
    expect(screen.getByText(money(installment(PRICE, 20, 5, 0, true).payment))).toBeOnTheScreen();
  });

  it('shows the capped rate once typing ends', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    await pick('radio', 'تمويل بنكي');
    const field = () => screen.getByLabelText('نسبة الفايدة السنوية ٪');

    await fireEvent.changeText(field(), '99');
    await fireEvent(field(), 'endEditing');

    expect(field().props.value).toBe('٤٠');
    expect(screen.getByText(money(installment(PRICE, 20, 5, 40).payment))).toBeOnTheScreen();
  });

  it('takes typed years from 1 to 10; an empty or zero field keeps the last good number until typing ends', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    const field = () => screen.getByLabelText('مدة التقسيط (بالسنين)');
    await fireEvent.changeText(field(), '7');
    expect(screen.getByText(money(installment(PRICE, 20, 7).payment))).toBeOnTheScreen();
    await fireEvent.changeText(field(), '');
    expect(screen.getByText(money(installment(PRICE, 20, 7).payment))).toBeOnTheScreen();
    await fireEvent(field(), 'endEditing');
    expect(field().props.value).toBe('٧');
  });

  // Phone check 2026-11-12: typing "15" passed through "1", and the plan showed 1 year.
  it('counts more than 10 years as 10, and says so', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    const field = () => screen.getByLabelText('مدة التقسيط (بالسنين)');
    await fireEvent.changeText(field(), '1');
    await fireEvent.changeText(field(), '15');
    expect(screen.getByText('من ١ لـ ١٠ سنين')).toBeOnTheScreen();
    expect(screen.getByText(money(installment(PRICE, 20, 10).payment))).toBeOnTheScreen();
    await fireEvent(field(), 'endEditing');
    expect(field().props.value).toBe('١٠');
  });

  it('allows a listing’s own plan to run longer than 10 years', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={12} ownPlan />);
    expect(screen.getByLabelText('مدة التقسيط (بالسنين)').props.value).toBe('١٢');
    expect(screen.getByText('من ١ لـ ١٢ سنين')).toBeOnTheScreen();
  });

  it('lets the price change only when asked to', async () => {
    const { unmount } = await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    expect(screen.queryByRole('adjustable', { name: 'سعر الوحدة' })).toBeNull();
    await unmount();

    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} editablePrice />);
    await slide('سعر الوحدة', 'increment');
    expect(screen.getByText(money(installment(PRICE + 100_000, 20, 5).payment))).toBeOnTheScreen();
  });

  it('works in English', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />, { lang: 'en' });
    expect(screen.getByText('Monthly installment')).toBeOnTheScreen();
    expect(screen.getByLabelText('Payment period (years)').props.value).toBe('5');
    expect(screen.getByText(fmtMoney(Math.round(installment(PRICE, 20, 5).payment), 'en', false))).toBeOnTheScreen();
  });
});

describe('The /calculator screen', () => {
  it('starts like the demo: 8 million, 10% down, 6 years, and the price can change', async () => {
    await renderWithProviders(<CalculatorScreen />);

    expect(screen.getByRole('header', { name: 'حاسبة التقسيط' })).toBeOnTheScreen();
    expect(screen.getByText(money(installment(8_000_000, 10, 6).payment))).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'سعر الوحدة' })).toBeOnTheScreen();
  });

  it('goes back', async () => {
    await renderWithProviders(<CalculatorScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  // Phase 29: an admin sets the least down payment and the years the calculator takes.
  describe('with the admin’s limits', () => {
    beforeEach(() => useAppConfig.setState({ config: { ...DEFAULT_APP_SETTINGS, calculator: { minDownPct: 15, minYears: 3, maxYears: 8 } } }));
    const years = () => screen.getByLabelText('مدة التقسيط (بالسنين)');

    it('starts inside them, and says which years it takes', async () => {
      await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={10} defaultYears={2} />);
      expect(screen.getByText('من ٣ لـ ٨ سنين')).toBeOnTheScreen();
      expect(years().props.value).toBe('٣');
      expect(screen.getByText(money(installment(PRICE, 15, 3).payment))).toBeOnTheScreen();
    });

    it('does not let the down payment go under the least, or the years outside the range', async () => {
      await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
      await slide('المقدم', 'decrement');
      await slide('المقدم', 'decrement');
      expect(screen.getByText(money(installment(PRICE, 15, 5).payment))).toBeOnTheScreen();
      expect(screen.getByRole('adjustable', { name: 'المقدم' }).props.accessibilityValue).toMatchObject({ min: 15 });

      await fireEvent.changeText(years(), '12');
      expect(screen.getByText(money(installment(PRICE, 15, 8).payment))).toBeOnTheScreen();
      await fireEvent.changeText(years(), '2');
      await fireEvent(years(), 'endEditing');
      expect(years().props.value).toBe('٣');
      expect(screen.getByText(money(installment(PRICE, 15, 3).payment))).toBeOnTheScreen();
    });

    it('keeps a listing’s own plan, even outside them', async () => {
      await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={5} defaultYears={12} ownPlan />);
      expect(years().props.value).toBe('١٢');
      expect(screen.getByText('من ٣ لـ ١٢ سنين')).toBeOnTheScreen();
      expect(screen.getByText(money(installment(PRICE, 5, 12).payment))).toBeOnTheScreen();
    });
  });
});
