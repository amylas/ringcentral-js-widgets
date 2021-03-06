import Alert from 'ringcentral-integration/modules/Alert';
import { Auth } from 'ringcentral-integration/modules/AuthV2';
import Locale from 'ringcentral-integration/modules/Locale';
import Storage from 'ringcentral-integration/modules/Storage';
import TabManager from 'ringcentral-integration/modules/TabManager';
import { Beforeunload } from 'ringcentral-widgets/modules/Beforeunload';
import { Block } from 'ringcentral-widgets/modules/Block';
import { Modal } from 'ringcentral-widgets/modules/Modal';
import RouterInteraction from 'ringcentral-widgets/modules/RouterInteraction';

import { EvClient } from '../../lib/EvClient';
import { EvAgentSession } from '../EvAgentSession';
import { EvAuth } from '../EvAuth';
import { EvPresence } from '../EvPresence';
import { EvSettings } from '../EvSettings';
import { EvSubscription } from '../EvSubscription';

export interface State {
  // dtmfString: string;
  webRTCTabId: string;
  connectingAlertId: string;
  muteActive: boolean;
  sipRegisterSuccess: boolean;
  sipRegistering: boolean;
}

export interface EvIntegratedSoftphoneOptions {
  heartBeatInterval?: number;
}

export interface Deps {
  routerInteraction: RouterInteraction;
  locale: Locale;
  evAgentSession: EvAgentSession;
  evSubscription: EvSubscription;
  beforeunload: Beforeunload;
  evSettings: EvSettings;
  evClient: EvClient;
  storage: Storage;
  presence: EvPresence;
  modal: Modal;
  alert: Alert;
  block: Block;
  evAuth: EvAuth;
  auth: Auth;
  tabManager?: TabManager;
  evIntegratedSoftphoneOptions?: EvIntegratedSoftphoneOptions;
}

export interface IntegratedSoftphone extends State {
  isWebRTCTab: boolean;
}
