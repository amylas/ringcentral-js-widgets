import { RcThemeProvider } from '@ringcentral-integration/rcui';
import { mount } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { RecipientsInput } from 'ringcentral-widgets/components/Rcui/RecipientsInput';
import { DialerPanel } from './DialerPanel';
import { DialoutStatusesType } from '../../enums/dialoutStatus';

let wrapper;
const currentLocale = 'en-US';
const size = 'medium';

function setup({
  toNumber = '',
  setToNumber = () => {},
  dialout = () => {},
  hasDialer = true,
  dialoutStatus = 'idle' as DialoutStatusesType,
  goToManualDialSettings = () => {},
  hangup = () => {},
  checkOnCall = () => {},
  dialButtonDisabled = false,
} = {}) {
  return mount(
    <RcThemeProvider>
      <DialerPanel
        currentLocale={currentLocale}
        dialout={dialout}
        toNumber={toNumber}
        size={size}
        dialButtonDisabled={dialButtonDisabled}
        hasDialer={hasDialer}
        setToNumber={setToNumber}
        goToManualDialSettings={goToManualDialSettings}
        dialoutStatus={dialoutStatus}
        hangup={hangup}
        checkOnCall={checkOnCall}
      />
    </RcThemeProvider>,
  );
}

const getCallButton = () => wrapper.find('[data-sign="callButton"]').at(0);
const getDeleteButton = () => wrapper.find('[data-sign="deleteButton"]').at(0);

afterEach(async () => {
  wrapper.unmount();
});

describe('<DialerPanel />', async () => {
  it('Has no dialer permission', () => {
    wrapper = setup({ hasDialer: false });
    expect(wrapper.text()).toBe('');
  });

  [
    { toNumber: '', desc: 'with no number filled' },
    { toNumber: '6508652493', desc: 'without number filled' },
  ].forEach(({ toNumber, desc }) => {
    it(`Default state of dialpad(${desc}): Call Button be highlighted and can be clicked to dialout`, () => {
      const dialout = jest.fn(() => {});
      wrapper = setup({ toNumber, dialout });
      const recipientsInput = wrapper.find(RecipientsInput).at(0);
      const callButton = getCallButton();
      expect(recipientsInput.prop('value')).toBe(toNumber);
      expect(callButton.prop('color').join(',')).toBe(
        ['semantic', 'positive'].join(','),
      );
      expect(callButton.prop('data-icon')).toBe('answer');
      callButton.simulate('click');
      expect(dialout).toBeCalled();
    });
  });

  it('User can manually input numbers in the recipientsInput', async () => {
    const toNumber = '';
    const setToNumber = jest.fn(() => {});
    wrapper = setup({ toNumber, setToNumber });
    const recipientsInput = wrapper.find(RecipientsInput).at(0);
    const eventObj = { target: { value: '1243' } };
    recipientsInput
      .find('input')
      .at(0)
      .simulate('change', eventObj);
    expect(setToNumber).toBeCalledWith('1243');
  });

  it('dialButtonDisabled can set dial button disable attribute', () => {
    const getDialButtonDisabled = () =>
      getCallButton()
        .render()
        .attr('disabled');

    wrapper = setup({ dialButtonDisabled: true });
    expect(getDialButtonDisabled()).toBe('disabled');

    wrapper = setup({ dialButtonDisabled: false });
    expect(getDialButtonDisabled()).toBe(undefined);
  });

  it('Click Delete Button', async () => {
    const toNumber = '6508652493';
    const setToNumber = jest.fn(() => {});
    wrapper = setup({ toNumber, setToNumber });

    const deleteButton = getDeleteButton();
    deleteButton.simulate('mouseDown');
    deleteButton.simulate('mouseUp');
    expect(setToNumber).toBeCalledWith(toNumber.slice(0, -1));
  });

  it('Long press Delete Button', async () => {
    jest.useFakeTimers();
    const toNumber = '6508652493';
    const setToNumber = jest.fn(() => {});
    wrapper = setup({ toNumber, setToNumber });
    const deleteButton = getDeleteButton();
    await act(async () => {
      deleteButton.simulate('mouseDown');
      jest.advanceTimersByTime(1100);
      // here will hiden deleteButton when clear toNumber, so we don't need mouseUp
      // deleteButton.simulate('mouseUp');
    });
    expect(setToNumber).toBeCalledWith('');
  });

  it('Delete button show switch', async () => {
    wrapper = setup({ toNumber: '' });
    let deleteButton = getDeleteButton();
    expect(deleteButton.exists()).toBeFalsy();

    wrapper = setup({ toNumber: '6508652493' });
    deleteButton = getDeleteButton();
    expect(deleteButton.exists()).toBeTruthy();
  });

  it(`Dialpad is not allowed to dialout in the state of dialing`, async () => {
    const toNumber = '6508652493';
    const dialoutStatus = 'dialing' as DialoutStatusesType;
    const dialout = jest.fn(() => {});
    wrapper = setup({ toNumber, dialout, dialoutStatus });
    const callButton = getCallButton();
    expect(callButton.prop('data-icon')).toBe('hand-up');
    callButton.simulate('click');
    expect(dialout).not.toBeCalled();
  });

  it(`User can hangup a call in the state of callConnected`, async () => {
    const toNumber = '6508652493';
    const dialoutStatus = 'callConnected' as DialoutStatusesType;
    const dialout = jest.fn(() => {});
    const hangup = jest.fn(() => {});
    wrapper = setup({ toNumber, dialout, hangup, dialoutStatus });
    const callButton = getCallButton();
    expect(callButton.prop('data-icon')).toBe('hand-up');
    callButton.simulate('click');
    expect(dialout).not.toBeCalled();
    expect(hangup).toBeCalled();
  });

  it('User clicks manualDialSettings', () => {
    const goToManualDialSettings = jest.fn(() => {});
    wrapper = setup({ goToManualDialSettings });
    const manualDialSettings = wrapper
      .find('[data-sign="manualDialSettings"]')
      .at(0);
    manualDialSettings
      .find('span')
      .at(0)
      .simulate('click');
    expect(goToManualDialSettings).toBeCalled();
  });

  it("User can use digit virtual keyboard to input numbers, and press zero for 1 second will typing '+'", async () => {
    jest.useFakeTimers();
    const toNumber = '1234';
    const setToNumber = jest.fn(() => {});
    wrapper = setup({ toNumber, setToNumber });
    const dialPad = wrapper.find('DialPad').at(0);
    const digitButtons = dialPad.find('button');

    const typingIcons = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '*',
      '0',
      '#',
    ];

    digitButtons.forEach((button, i) => {
      button.simulate('mousedown');
      button.simulate('mouseup');
      expect(setToNumber).toBeCalledWith(`${toNumber}${typingIcons[i]}`);
    });

    const buttonZero = digitButtons.at(10);

    buttonZero.simulate('mousedown');
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    buttonZero.simulate('mouseup');

    expect(setToNumber).toBeCalledWith('1234+');
  });
});
