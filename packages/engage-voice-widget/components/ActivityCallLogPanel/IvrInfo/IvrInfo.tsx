import {
  RcExpansionPanel,
  RcExpansionPanelDetails,
  RcExpansionPanelSummary,
  RcIcon,
} from '@ringcentral-integration/rcui';
import arrowDownSvg from '@ringcentral-integration/rcui/icons/icon-arrow_down.svg';
import classNames from 'classnames';
import React, { FunctionComponent, useEffect, useState } from 'react';

import {
  EvActivityCallUIFunctions,
  EvActivityCallUIProps,
} from '../../../interfaces';
import styles from './styles.scss';

export type IvrInfoProps = { isCallEnd: boolean } & Pick<
  EvActivityCallUIProps & EvActivityCallUIFunctions,
  'ivrAlertData'
>;
export const IvrInfo: FunctionComponent<IvrInfoProps> = ({
  isCallEnd,
  ivrAlertData,
}) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isCallEnd) {
      setExpanded(false);
    }
  }, [isCallEnd]);

  return (
    <div className={styles.ivrPanel}>
      <i className={styles.remain} />
      <div className={styles.container}>
        <RcExpansionPanel
          square
          onChange={() => setExpanded(!expanded)}
          expanded={expanded}
          classes={{
            root: classNames(styles.panelRoot, isCallEnd && styles.endCall),
            expanded: styles.expanded,
          }}
        >
          <RcExpansionPanelSummary
            classes={{
              root: styles.summaryRoot,
              content: styles.summaryContent,
            }}
            IconButtonProps={{
              size: 'small',
            }}
            expandIcon={<RcIcon symbol={arrowDownSvg} color={['grey', 500]} />}
          >
            <span className={styles.ivrMainSubject}>
              {ivrAlertData[0].subject || ''}
            </span>
            {ivrAlertData.length > 1 ? (
              <span className={styles.count}> +{ivrAlertData.length - 1}</span>
            ) : null}
          </RcExpansionPanelSummary>
          <RcExpansionPanelDetails
            classes={{
              root: styles.detailsRoot,
            }}
          >
            {ivrAlertData.map(({ subject = '', body = '' }, i) => {
              return (
                <div className={styles.item} key={i}>
                  {i !== 0 && subject.length > 0 && (
                    <div className={styles.subject}>{subject}</div>
                  )}
                  {body.length > 0 && <div className={styles.body}>{body}</div>}
                </div>
              );
            })}
          </RcExpansionPanelDetails>
        </RcExpansionPanel>
      </div>
    </div>
  );
};
