import React, { FunctionComponent } from 'react';
import { RcList } from '@ringcentral-integration/rcui';
import i18n from './i18n';

export interface SearchResultProps {
  filter: string;
  filteredOptions: object[];
  options: object[];
  renderListItem?({ option: object, index: number }): React.ReactNode;
  currentLocale: string;
  tipWhenNoOptions?: string;
  classes?: {
    root?: string;
    noResult?: string;
  };
}

export const SearchResult: FunctionComponent<SearchResultProps> = ({
  options,
  filteredOptions,
  filter,
  currentLocale,
  renderListItem,
  classes,
  tipWhenNoOptions,
}) => {
  const noResultMessage = i18n.getString('noResultFoundFor', currentLocale);
  return (
    <>
      {options.length ? (
        <div className={classes.root} data-sign="searchResult">
          {filteredOptions.length > 0 ? (
            <RcList>
              {filteredOptions.map((option, index) =>
                renderListItem({ option, index }),
              )}
            </RcList>
          ) : (
            <div className={classes.noResult}>
              {`${noResultMessage} "${filter}"`}
            </div>
          )}
        </div>
      ) : (
        tipWhenNoOptions || null
      )}
    </>
  );
};

SearchResult.defaultProps = {
  renderListItem: () => null,
  classes: {},
  tipWhenNoOptions: '',
};
