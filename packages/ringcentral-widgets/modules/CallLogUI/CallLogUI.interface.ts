import Locale from 'ringcentral-integration/modules/Locale';
import CallLogger from 'ringcentral-integration/modules/CallLogger';
import RateLimiter from 'ringcentral-integration/modules/RateLimiter';
import RegionSettings from 'ringcentral-integration/modules/RegionSettings';
import DateTimeFormat from 'ringcentral-integration/modules/DateTimeFormat';
import ActiveCallControl from 'ringcentral-integration/modules/ActiveCallControl';
import RolesAndPermissions from 'ringcentral-integration/modules/RolesAndPermissions';
import ConnectivityMonitor from 'ringcentral-integration/modules/ConnectivityMonitor';
import RouterInteraction from '../RouterInteraction';
import CallLogSection from '../CallLogSection';
import { CallLogPanelProps } from '../../components/CallLogPanel';

export interface State {}

export interface CallLogUIOptions {
  //
}

export interface Deps {
  locale: Locale;
  callLogger: CallLogger;
  rateLimiter: RateLimiter;
  regionSettings: RegionSettings;
  dateTimeFormat: DateTimeFormat;
  callLogSection: CallLogSection;
  routerInteraction: RouterInteraction;
  activeCallControl: ActiveCallControl;
  // TODO: more to Environment based on RcModuleV2
  environmentOptions: {
    app: {
      isLightning: boolean;
      ENTITY_WHITE_LIST: object;
    };
    sdkConfig: object;
  };
  rolesAndPermissions: RolesAndPermissions;
  connectivityMonitor: ConnectivityMonitor;
  callLogUIOptions: CallLogUIOptions;
}

export interface CallLogUIInterface extends State {
  getUIProps(): CallLogUIProps;
  getUIFunctions(): CallLogUIFunctions;
}

export type CallLogUIProps = Partial<CallLogPanelProps>;

export type CallLogUIFunctions = Partial<CallLogPanelProps>;
