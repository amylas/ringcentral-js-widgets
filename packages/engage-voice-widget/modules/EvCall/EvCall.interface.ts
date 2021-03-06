import Alert from 'ringcentral-integration/modules/Alert';
import Storage from 'ringcentral-integration/modules/Storage';
import TabManager from 'ringcentral-integration/modules/TabManager';

import { EvClient } from '../../lib/EvClient';
import { EvAgentSession } from '../EvAgentSession';
import { EvAuth } from '../EvAuth';
import { EvCallMonitor } from '../EvCallMonitor';
import { EvIntegratedSoftphone } from '../EvIntegratedSoftphone';
import { EvPresence } from '../EvPresence';
import { EvSettings } from '../EvSettings';
import { EvSubscription } from '../EvSubscription';

export interface State {
  dialoutCallerId: string;
  dialoutQueueId: string;
  dialoutCountryId: string;
  dialoutRingTime: number;
  formGroup: Pick<
    State,
    | 'dialoutCallerId'
    | 'dialoutQueueId'
    | 'dialoutCountryId'
    | 'dialoutRingTime'
  >;
}

export interface EvCallOptions {
  //
}

export interface Deps {
  evSettings: EvSettings;
  alert: Alert;
  evAuth: EvAuth;
  evSubscription: EvSubscription;
  storage: Storage;
  evClient: EvClient;
  evAgentSession: EvAgentSession;
  evIntegratedSoftphone: EvIntegratedSoftphone;
  evCallMonitor: EvCallMonitor;
  presence: EvPresence;
  tabManager?: TabManager;
  evCallOptions?: EvCallOptions;
}

export interface Call extends State {
  //
}
