import React, { FunctionComponent } from 'react';

import {
  HoldCallButton,
  MuteCallButton,
  SmallCallControl,
  HandUpButton,
  TransferCallButton,
  SmallCallControlProps,
} from '../SmallCallControl';
import { ActiveCallButton, ActiveCallButtonProps } from './components';

export type EvSmallCallControlProps = ActiveCallButtonProps &
  SmallCallControlProps & {
    isOnActive?: boolean;
    showMuteButton?: boolean;
  };

export const EvSmallCallControl: FunctionComponent<EvSmallCallControlProps> = ({
  isOnActive,
  showMuteButton,
  ...rest
}) => {
  return (
    <SmallCallControl {...rest}>
      <HoldCallButton {...rest} />
      {showMuteButton && <MuteCallButton {...rest} />}
      <TransferCallButton {...rest} />
      {isOnActive ? <ActiveCallButton {...rest} /> : <HandUpButton {...rest} />}
    </SmallCallControl>
  );
};

EvSmallCallControl.defaultProps = {
  ...ActiveCallButton.defaultProps,
  ...SmallCallControl.defaultProps,
  isOnActive: false,
  showMuteButton: false,
};
