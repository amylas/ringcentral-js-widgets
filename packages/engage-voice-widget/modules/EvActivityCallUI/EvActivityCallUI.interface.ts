import Alert from 'ringcentral-integration/modules/Alert';
import ConnectivityMonitor from 'ringcentral-integration/modules/ConnectivityMonitor';
import Locale from 'ringcentral-integration/modules/Locale';
import RateLimiter from 'ringcentral-integration/modules/RateLimiter';
import Storage from 'ringcentral-integration/modules/Storage';
import TabManager from 'ringcentral-integration/modules/TabManager';
import RouterInteraction from 'ringcentral-widgets/modules/RouterInteraction';

import { EvEnvironment } from '../../interfaces/Environment.interface';
import { EvActiveCallControl } from '../EvActiveCallControl';
import { EvAgentSession } from '../EvAgentSession';
import { EvAuth } from '../EvAuth';
import { EvCall } from '../EvCall';
import { EvCallDisposition } from '../EvCallDisposition';
import { EvCallMonitor } from '../EvCallMonitor';
import { EvIntegratedSoftphone } from '../EvIntegratedSoftphone';
import { EvRequeueCall } from '../EvRequeueCall';
import { EvTransferCall } from '../EvTransferCall';
import { EvWorkingState } from '../EvWorkingState';

export interface State {
  saveStatus: string;
  disabled: { [P: string]: any };
  required: { notes: boolean };
  validated: { dispositionId: boolean; notes: boolean };
}

export interface EvActivityCallUIOptions {
  //
}

export interface Deps {
  locale: Locale;
  alert: Alert;
  activeCallControl: EvActiveCallControl;
  evCall: EvCall;
  evCallMonitor: EvCallMonitor;
  evCallDisposition: EvCallDisposition;
  evRequeueCall: EvRequeueCall;
  evTransferCall: EvTransferCall;
  evWorkingState: EvWorkingState;
  evAgentSession: EvAgentSession;
  evIntegratedSoftphone: EvIntegratedSoftphone;
  routerInteraction: RouterInteraction;
  connectivityMonitor: ConnectivityMonitor;
  rateLimiter: RateLimiter;
  environment: EvEnvironment;
  storage: Storage;
  evAuth: EvAuth;
  tabManager?: TabManager;
  evActivityCallUIOptions?: EvActivityCallUIOptions;
}

export interface ActivityCallUI extends State {
  //
}
