import { callingOptions, CallingOptionsType } from './callingOptions';
import { callingModes } from './callingModes';

export function mapOptionToMode(callWith: CallingOptionsType) {
  switch (callWith) {
    case callingOptions.softphone:
      return callingModes.softphone;
    case callingOptions.ringout:
      return callingModes.ringout;
    case callingOptions.browser:
      return callingModes.webphone;
    case callingOptions.jupiter:
      return callingModes.jupiter;
    default:
      return callingModes.softphone;
  }
}
