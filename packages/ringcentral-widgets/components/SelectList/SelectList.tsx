import formatMessage from 'format-message';
import React, { FunctionComponent, useEffect, useState } from 'react';

import { SelectListBasic, SelectListBasicProps } from '../SelectListBasic';
import i18n from './i18n';
import { ListView, ListViewProps } from './ListView';
import styles from './styles.scss';
import { WithScrollCheck } from './WithScrollCheck';

const SelectListBasicWithScrollCheck: FunctionComponent<SelectListBasicProps> = WithScrollCheck(
  SelectListBasic,
);

export { SelectListBasicWithScrollCheck };

export type SelectListProps = {
  title: string;
  otherOptions?: object[];
  associatedOptions?: object[];
  showAssociatedSection?: boolean;
  placeholder?: string;
  searchOption: (...args: any[]) => any;
  disabled?: boolean;
  field?: string;
  value?: any;
  rightIcon?: JSX.Element;
  onSelectViewVisible?: (...args: any[]) => any;
  currentLocale: string;
  matchedTitle?: string;
  otherTitle?: string;
  associatedTitle?: string;
  backHeaderClassName?: string;
  contactSearch?: (...args: any[]) => any;
  appName?: string;
  autoClose?: boolean;
  onBackClick: () => void;
} & Pick<
  ListViewProps,
  'options' | 'valueFunction' | 'renderFunction' | 'startAdornment' | 'onChange'
> &
  Pick<
    SelectListBasicProps,
    'foundFromServerEntities' | 'foundFromServerTitle' | 'showFoundFromServer'
  >;

export const SelectList: FunctionComponent<SelectListProps> = (props) => {
  const {
    field,
    appName,
    children,
    disabled,
    onChange,
    autoClose,
    otherTitle,
    onBackClick,
    matchedTitle,
    currentLocale,
    valueFunction,
    renderFunction,
    startAdornment,
    associatedTitle,
    value: sourceValue,
    backHeaderClassName,
    onSelectViewVisible,
    foundFromServerTitle,
  } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onSelectViewVisible(open, field);
  }, [field, onSelectViewVisible, open]);
  const renderListView = (data, type, filter, scrollCheck) => (
    <ListView
      filter={filter}
      options={data}
      value={sourceValue}
      onChange={(value) => {
        if (document.activeElement) {
          (document.activeElement as HTMLInputElement).blur();
        }
        onChange(value);
        // auto close select section after selected a value
        if (autoClose) {
          setOpen(false);
          onBackClick();
        }
      }}
      renderFunction={renderFunction}
      valueFunction={valueFunction}
      onSelect={(elm) => scrollCheck(elm, type)}
      startAdornment={startAdornment}
    />
  );
  return (
    <div
      className={disabled ? styles.disabled : null}
      data-sign="select-list-panel"
    >
      <div
        className={styles.field}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) {
            return;
          }
          setOpen(true);
        }}
      >
        {children}
      </div>
      <SelectListBasicWithScrollCheck
        {...props}
        matchedTitle={matchedTitle || i18n.getString('matched', currentLocale)}
        otherTitle={otherTitle || i18n.getString('other', currentLocale)}
        associatedTitle={
          associatedTitle || i18n.getString('associated', currentLocale)
        }
        foundFromServerTitle={
          foundFromServerTitle ||
          formatMessage(i18n.getString('foundFromServer', currentLocale), {
            appName,
          })
        }
        renderListView={renderListView}
        open={open}
        setOpen={setOpen}
        backHeaderClassName={backHeaderClassName}
      />
    </div>
  );
};
SelectList.defaultProps = {
  options: [],
  otherOptions: [],
  associatedOptions: [],
  showAssociatedSection: false,
  placeholder: '',
  disabled: false,
  matchedTitle: '',
  otherTitle: '',
  associatedTitle: '',
  field: '',
  value: {},
  rightIcon: null,
  onChange() {},
  startAdornment() {},
  onSelectViewVisible() {},
  backHeaderClassName: null,
  contactSearch: null,
  appName: null,
  showFoundFromServer: false,
  foundFromServerTitle: null,
  foundFromServerEntities: [],
  autoClose: true,
  onBackClick() {},
};
