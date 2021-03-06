import { ObjectMap } from '@ringcentral-integration/core/lib/ObjectMap';

export const messageTypes = ObjectMap.fromKeys([
  'OPEN_SOCKET',
  'AGENT_LOGIN',
  'AGENT_LOGOUT',
  'CALL_HOLD',
  'CONFIGURE_AGENT',
  'OFFHOOK_INIT',
  'AGENT_STATE',
  // RcModule
  'NO_AGENT',
  'CONNECT_ERROR',
  'UNEXPECTED_AGENT',
  'INVALID_BROWSER',
  'CONNECT_TIMEOUT',
  'OPEN_SOCKET_ERROR',
  'OVER_BREAK_TIME',
  'INVALID_STATE_CHANGE',
  'INVALID_PHONE_NUMBER',
  'EMPTY_PHONE_NUMBER',
  'NO_AGENT_SELECTED',
  'INVALID_PHONE_NUMBER',
  'AGENT_CONFIG_ERROR',
  'AGENT_CONFIG_DETAIL_ERROR',
  'UPDATE_AGENT_ERROR',
  'UPDATE_AGENT_SUCCESS',
  'NO_SUPPORT_COUNTRY',
  'FAILED_TO_CALL',
  'INVALID_NUMBER',
  'COPY_UII_SUCCESS',
  // login fail reason
  'EXISTING_LOGIN_FOUND',
  'EXISTING_LOGIN_ENGAGED',
  'FORCE_LOGOUT',
  // Presence error
  'OFFHOOK_INIT_ERROR',
  'OFFHOOK_TERM_ERROR',
  'ADD_SESSION_ERROR',
  'DROP_SESSION_ERROR',
  'HOLD_ERROR',
  // auth
  'LOGOUT_FAIL_WITH_CALL_CONNECTED',
]);

export type MessageTypes = keyof typeof messageTypes;
