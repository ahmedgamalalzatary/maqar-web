import { fmtMoney, fmtNum, installment } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
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

beforeEach(() => jest.clearAllMocks());

describe('The installment calculator', () => {
  it('starts from the given plan, with all four results', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);
    const plan = installment(PRICE, 20, 5);

    expect(screen.getByText('القسط الشهري')).toBeOnTheScreen();
    expect(screen.getByText(money(plan.payment))).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(plan.down, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText(fmtNum(plan.count, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(plan.total, 'ar'))).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '٥ سنين', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'خطة المطوّر (بدون فوايد)', checked: true })).toBeOnTheScreen();
  });

  it('changes with the years and the down payment', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={5} />);

    await pick('radio', '١٠ سنين');
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
    expect(screen.getByLabelText(RATE).props.value).toBe('18');
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

    expect(field().props.value).toBe('40');
    expect(screen.getByText(money(installment(PRICE, 20, 5, 40).payment))).toBeOnTheScreen();
  });

  it('offers a plan’s own years even when they are not a usual choice', async () => {
    await renderWithProviders(<InstallmentCalculator price={PRICE} defaultDown={20} defaultYears={9} />);
    expect(screen.getByRole('radio', { name: '٩ سنين', checked: true })).toBeOnTheScreen();
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
    expect(screen.getByRole('radio', { name: '5 years', checked: true })).toBeOnTheScreen();
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
});
