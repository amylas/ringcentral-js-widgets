import React from 'react';
import { render } from '@testing-library/react';
import { toContainElement } from '@testing-library/jest-dom/matchers';
import phoneTypes from 'ringcentral-integration/enums/phoneTypes';
import ContactDropdownList from '../components/ContactDropdownList';

expect.extend({ toContainElement });

const expectedName = 'Bob';
const expectedNumber = '123456';
const mockedProps = {
  currentLocale: '',
  items: [
    {
      name: expectedName,
      entityType: 'rcContact',
      phoneType: phoneTypes.extension,
      phoneNumber: expectedNumber,
    },
  ],
  formatContactPhone: (number) => number,
  addToRecipients() {},
  setSelectedIndex() {},
  selectedIndex: 0,
};

describe('Given at least one contact item', () => {
  test('When visibility is false, should not render dropdown', () => {
    const { queryByRole } = render(
      <ContactDropdownList {...mockedProps} visibility={false} />,
    );
    expect(queryByRole('list')).toBeNull();
  });
  test('When visibility is true, should render dropdown', () => {
    const { queryByRole, queryByText, getByRole } = render(
      <ContactDropdownList {...mockedProps} visibility />,
    );
    const list = queryByRole('list');
    expect(list).not.toBeNull();
    const name = queryByText(expectedName);
    expect(name).not.toBeNull();
    expect(list).toContainElement(name);
    const phone = queryByText(expectedNumber);
    expect(phone).not.toBeNull();
    expect(list).toContainElement(phone);
    const extension = queryByText('Extension Number');
    expect(extension).not.toBeNull();
    expect(list).toContainElement(extension);
  });
});
