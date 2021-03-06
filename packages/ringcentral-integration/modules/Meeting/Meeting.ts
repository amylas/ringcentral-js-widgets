import { computed } from '@ringcentral-integration/core';
import moment from 'moment';
import { find, pick, isEmpty } from 'ramda';
import Client from 'ringcentral-client';

import {
  comparePreferences,
  getDefaultMeetingSettings,
  getInitializedStartTime,
  getMobileDialingNumberTpl,
  getPhoneDialingNumberTpl,
  MeetingType,
  prunePreferencesObject,
  UTC_TIMEZONE_ID,
} from '../../helpers/meetingHelper';
import background from '../../lib/background';
import { Module } from '../../lib/di';
import proxify from '../../lib/proxy/proxify';
import RcModule from '../../lib/RcModule';
import { selector } from '../../lib/selector';
import actionTypes, { MeetingActionTypes } from './actionTypes';
import getMeetingReducer, {
  getDefaultMeetingSettingReducer,
  getMeetingStorageReducer,
  getPersonalMeetingReducer,
} from './getMeetingReducer';
import {
  MeetingInfoResponse,
  MeetingScheduleResource,
  RcmInvitationInfo,
  RcMMeetingModel,
  ScheduleMeetingResponse,
  MeetingAssistedResponse,
  MeetingAssistedUser,
  MeetingInitialExtraData,
} from './interface';
import { MeetingErrors } from './meetingErrors';
import meetingStatus from './meetingStatus';
import scheduleStatus from './scheduleStatus';
import {
  RCM_PASSWORD_REGEX,
  ASSISTED_USERS_MYSELF,
  PMIRequirePassword,
  COMMON_SETTINGS,
  DEFAULT_LOCK_SETTINGS,
} from './constants';

// eslint-disable-next-line
@Module({
  deps: [
    'Brand',
    'Alert',
    'Client',
    'ExtensionInfo',
    'Storage',
    'MeetingProvider',
    { dep: 'AvailabilityMonitor', optional: true },
    { dep: 'MeetingOptions', optional: true },
  ],
})
export class Meeting extends RcModule<Record<string, any>, MeetingActionTypes> {
  // TODO: add state interface
  private _brand: any;
  public _alert: any;
  public _client: Client;
  private _extensionInfo: any;
  private _storage: any;
  private _availabilityMonitor: any;
  private _lastMeetingSettingKey: any;
  private _defaultMeetingSettingKey: any;
  private _showSaveAsDefault: boolean;
  private _enableInvitationApi: boolean;
  private _personalMeetingKey: string;
  private _enablePersonalMeeting: boolean;
  private _enableReloadAfterSchedule: boolean;
  private _enableServiceWebSettings: boolean;
  private _enableScheduleFor: boolean;
  private _fetchPersonMeetingTimeout: NodeJS.Timeout;
  private _meetingProvider: any;
  private _fetchAssistedUsersTimeout: NodeJS.Timeout;

  constructor({
    brand,
    alert,
    client,
    extensionInfo,
    storage,
    availabilityMonitor,
    reducers,
    meetingProvider,
    showSaveAsDefault = false,
    enableInvitationApi = false,
    enablePersonalMeeting = false,
    enableReloadAfterSchedule = true,
    enableServiceWebSettings = false,
    enableScheduleFor = false,
    ...options
  }) {
    super({
      ...options,
      actionTypes: options.actionTypes || actionTypes,
    });
    this._brand = brand;
    this._alert = alert;
    this._client = client;
    this._storage = storage;
    this._extensionInfo = extensionInfo;
    this._meetingProvider = meetingProvider;
    this._showSaveAsDefault = showSaveAsDefault;
    this._enableInvitationApi = enableInvitationApi;
    this._enableReloadAfterSchedule = enableReloadAfterSchedule;
    this._enablePersonalMeeting = enablePersonalMeeting;
    this._enableServiceWebSettings = enableServiceWebSettings;
    this._enableScheduleFor = enableScheduleFor;
    this._availabilityMonitor = availabilityMonitor;
    this._lastMeetingSettingKey = 'lastMeetingSetting';
    this._defaultMeetingSettingKey = 'defaultMeetingSetting';
    this._personalMeetingKey = 'personalMeeting';
    this._reducer = getMeetingReducer(this.actionTypes, reducers);
    this._storage.registerReducer({
      key: this._lastMeetingSettingKey,
      reducer: getMeetingStorageReducer(this.actionTypes),
    });
    if (this._showSaveAsDefault) {
      this._storage.registerReducer({
        key: this._defaultMeetingSettingKey,
        reducer: getDefaultMeetingSettingReducer(this.actionTypes),
      });
    }
    if (this._enablePersonalMeeting) {
      this._storage.registerReducer({
        key: this._personalMeetingKey,
        reducer: getPersonalMeetingReducer(this.actionTypes),
      });
    }
  }

  initialize() {
    this.store.subscribe(() => this._onStateChange());
  }

  async _onStateChange() {
    if (this._shouldInit()) {
      await this._init();
    } else if (this._shouldReset()) {
      this._reset();
    }
  }

  private _shouldInit() {
    return (
      this.pending &&
      this._alert.ready &&
      this._storage.ready &&
      this._extensionInfo.ready &&
      this._meetingProvider.ready &&
      this._meetingProvider.isRCM &&
      (!this._availabilityMonitor || this._availabilityMonitor.ready)
    );
  }

  private async _init() {
    this.store.dispatch({
      type: this.actionTypes.init,
    });

    if (this._enablePersonalMeeting) {
      await this._initPersonalMeeting();
    }

    if (this._enableServiceWebSettings) {
      await this._updateServiceWebSettings();
    }

    this._initMeeting();

    if (this._enableScheduleFor) {
      await this._initScheduleFor();
      this.updateScheduleFor(this.extensionInfo.id);
    }

    this.store.dispatch({
      type: this.actionTypes.initSuccess,
    });
  }

  private _shouldReset() {
    return (
      this.ready &&
      (!this._alert.ready ||
        !this._storage.ready ||
        !this._extensionInfo.ready ||
        !this._meetingProvider.ready ||
        !this._meetingProvider.isRCM ||
        (this._availabilityMonitor && !this._availabilityMonitor.ready))
    );
  }

  private _reset() {
    this.store.dispatch({
      type: this.actionTypes.resetSuccess,
    });
  }

  /**
   * Init basic meeting information
   * also load meeting setting from previous one.
   */
  @background
  init() {
    this._initMeeting();
  }

  @proxify
  reload() {
    this._initMeeting();
  }

  private _initMeeting() {
    this.update(this.defaultMeetingSetting);
    this._updatePreferences();
  }

  async _initPersonalMeeting() {
    if (this._fetchPersonMeetingTimeout) {
      clearTimeout(this._fetchPersonMeetingTimeout);
    }
    try {
      await this.setPersonalMeeting();
    } catch (e) {
      console.error('fetch default meeting error:', e);
      console.warn('retry after 10s');
      this._fetchPersonMeetingTimeout = setTimeout(() => {
        this._initPersonalMeeting();
      }, 10000);
    }
  }

  async _initScheduleFor() {
    if (this._fetchAssistedUsersTimeout) {
      clearTimeout(this._fetchAssistedUsersTimeout);
    }
    try {
      await this.setAssistedUsers();
    } catch (e) {
      console.error('fetch default meeting error:', e);
      console.warn('retry after 10s');
      this._fetchAssistedUsersTimeout = setTimeout(() => {
        this._initPersonalMeeting();
      }, 10000);
    }
  }

  combineWithSettings(_meeting: RcMMeetingModel) {
    let meeting = _meeting;
    if (this._enableServiceWebSettings) {
      meeting = this._combineWithSWSettings(_meeting);
    }
    return {
      ...meeting,
      isMeetingPasswordValid: this.validatePasswordSettings(
        meeting.password,
        meeting._requireMeetingPassword,
      ),
    };
  }

  @proxify
  update(_meeting: RcMMeetingModel) {
    const meeting = this.combineWithSettings(_meeting);
    this.store.dispatch({
      type: this.actionTypes.updateMeeting,
      meeting,
    });
    this._comparePreferences();
  }

  @proxify
  async switchUsePersonalMeetingId(usePersonalMeetingId: boolean) {
    this.update(
      usePersonalMeetingId
        ? this.pmiDefaultSettings
        : this.generalDefaultSettings,
    );
  }

  @proxify
  async updateScheduleFor(userExtensionId: string | number) {
    if (!userExtensionId) {
      return;
    }
    const user = find(
      (item) => item.id === `${userExtensionId}`,
      this.assistedUsers,
    );
    if (user) {
      this.store.dispatch({
        type: this.actionTypes.updateScheduleForUser,
        user,
      });
      const isMySelf = userExtensionId === this.extensionInfo.id;
      this.switchUsePersonalMeetingId(isMySelf && this.usePmiDefaultFromSW);
    }
  }

  private _updatePreferences() {
    this.store.dispatch({
      type: this.actionTypes.updateMeetingPreferences,
      preferences: prunePreferencesObject(this.meeting),
    });
  }

  private _comparePreferences() {
    const { preferences, meeting } = this;
    this.store.dispatch({
      type: this.actionTypes.saveMeetingPreferencesState,
      isPreferencesChanged: comparePreferences(preferences, meeting),
    });
  }

  @proxify
  private async _updateServiceWebSettings() {
    const [userSettings, lockedSettings] = await Promise.all([
      this.getUserSettings(),
      this.getLockedSettings(),
    ]);
    this.store.dispatch({
      type: this.actionTypes.updateUserSettings,
      userSettings,
    });
    this.store.dispatch({
      type: this.actionTypes.updateLockedSettings,
      lockedSettings,
    });
  }

  _initDefaultData(
    meeting: RcMMeetingModel,
    { userSettings, personalMeetingSettings }: MeetingInitialExtraData,
    usePmi: boolean,
  ): RcMMeetingModel {
    if (!this._enableServiceWebSettings) {
      return meeting;
    }
    const {
      requirePasswordForSchedulingNewMeetings = false,
      requirePasswordForPmiMeetings,
    } = this.scheduleUserSettings;
    const {
      requirePasswordForSchedulingNewMeetings: lockedRequirePasswordForSchedulingNewMeetings,
      requirePasswordForPmiMeetings: lockedRequirePasswordForPmiMeetings,
    } = this.scheduleLockedSettings;

    // For PMI meetings
    if (usePmi) {
      const processedMeeting = {
        ...meeting,
        ...personalMeetingSettings,
        usePersonalMeetingId: true,
      };
      const { allowJoinBeforeHost, password = '' } = processedMeeting;

      if (password !== '') {
        processedMeeting._pmiPassword = password;
      }

      let pmiRequiresPwd;
      switch (requirePasswordForPmiMeetings) {
        case PMIRequirePassword.NONE:
          pmiRequiresPwd = password !== '';
          break;
        case PMIRequirePassword.ALL:
          pmiRequiresPwd = true;
          break;
        case PMIRequirePassword.JBH_ONLY:
          pmiRequiresPwd = allowJoinBeforeHost || password !== '';
          break;
        default:
          pmiRequiresPwd = processedMeeting._requireMeetingPassword;
      }

      let pmiRequiresPwdLocked = processedMeeting._lockRequireMeetingPassword;
      if (requirePasswordForPmiMeetings === PMIRequirePassword.JBH_ONLY) {
        pmiRequiresPwdLocked =
          lockedRequirePasswordForPmiMeetings && allowJoinBeforeHost;
      } else if (
        requirePasswordForPmiMeetings !== PMIRequirePassword.JBH_ONLY
      ) {
        pmiRequiresPwdLocked = lockedRequirePasswordForPmiMeetings;
      }

      processedMeeting._requireMeetingPassword = pmiRequiresPwd;
      processedMeeting._lockRequireMeetingPassword = pmiRequiresPwdLocked;

      return processedMeeting;
    }

    // For non-PMI meetings
    const processedMeeting = {
      ...meeting,
      ...userSettings,
      usePersonalMeetingId: false,
    };
    if (requirePasswordForSchedulingNewMeetings) {
      processedMeeting._requireMeetingPassword = true;
    }
    if (lockedRequirePasswordForSchedulingNewMeetings) {
      processedMeeting._lockRequireMeetingPassword = true;
    }

    return processedMeeting;
  }

  _combineWithSWSettings(meeting: RcMMeetingModel): RcMMeetingModel {
    if (!meeting.usePersonalMeetingId) {
      return meeting;
    }

    const processedMeeting = { ...meeting };
    const { allowJoinBeforeHost } = processedMeeting;
    const { requirePasswordForPmiMeetings } = this.scheduleUserSettings;
    const {
      requirePasswordForPmiMeetings: lockedRequirePasswordForPmiMeetings,
    } = this.scheduleLockedSettings;

    if (
      lockedRequirePasswordForPmiMeetings &&
      requirePasswordForPmiMeetings === PMIRequirePassword.JBH_ONLY
    ) {
      processedMeeting._lockRequireMeetingPassword = allowJoinBeforeHost;
      if (allowJoinBeforeHost) {
        processedMeeting._requireMeetingPassword = true;
      }
    }

    return processedMeeting;
  }

  @proxify
  private async fetchPersonalMeeting(): Promise<MeetingInfoResponse> {
    let personalMeetingId = this.personalMeeting && this.personalMeeting.id;
    if (!personalMeetingId) {
      const serviceInfo = await this.getMeetingServiceInfo();
      personalMeetingId = serviceInfo.externalUserInfo.personalMeetingId;
    }
    const meetingInfoResponse = await this.getMeeting(personalMeetingId);
    return meetingInfoResponse;
  }

  private formatPersonalMeeting(
    meetingInfo: MeetingInfoResponse,
  ): RcMMeetingModel {
    const settings = {
      ...this.initialMeetingSetting,
      ...meetingInfo,
      shortId: meetingInfo.id,
      usePersonalMeetingId: true,
    };
    return {
      ...settings,
      _requireMeetingPassword: !!settings.password,
    };
  }

  @proxify
  private async setPersonalMeeting() {
    try {
      const meetingInfoResponse = await this.fetchPersonalMeeting();
      const meeting = this.formatPersonalMeeting(meetingInfoResponse);
      this.store.dispatch({
        type: this.actionTypes.updatePersonalMeeting,
        meeting,
      });
    } catch (e) {
      console.log('failed to get personal meeting id:', e);
    }
  }

  @proxify
  private async setAssistedUsers() {
    const { records } = await this.getAssistedUsers();
    this.store.dispatch({
      type: this.actionTypes.updateAssistedUsers,
      assistedUsers: records,
    });
  }

  @proxify
  async schedule(
    meeting: RcMMeetingModel,
    { isAlertSuccess = true } = {},
    opener: any,
  ): Promise<ScheduleMeetingResponse> {
    if (this.isScheduling) return (this.schedule as any)._promise;
    meeting = meeting || this.meeting;
    try {
      this.store.dispatch({
        type: this.actionTypes.initScheduling,
      });
      // Validate meeting
      this._validate(meeting);
      const formattedMeeting = this._format(meeting);

      if (this._showSaveAsDefault && meeting.saveAsDefault) {
        this.saveAsDefaultSetting(meeting);
      }

      (this.schedule as any)._promise = Promise.all([
        this.postMeeting(formattedMeeting),
        this.getMeetingServiceInfo(),
      ]);

      const [resp, serviceInfo] = await (this.schedule as any)._promise;
      const invitationInfo = await this.getMeetingInvitation(resp.id);
      this.store.dispatch({
        type: this.actionTypes.scheduled,
        meeting: {
          ...formattedMeeting,
          id: resp.id,
          _saved: meeting._saved,
        },
      });

      const result = await this._createDialingNumberTpl(
        serviceInfo,
        resp,
        opener,
        invitationInfo,
      );

      // Reload meeting info
      if (this._enableReloadAfterSchedule) {
        this._initMeeting();
      }

      // Update personal meeting setting
      if (this._enablePersonalMeeting && resp.usePersonalMeetingId) {
        this.store.dispatch({
          type: this.actionTypes.updatePersonalMeeting,
          meeting: this.formatPersonalMeeting(resp),
        });
        if (this._enableServiceWebSettings) {
          this.update({
            ...this.meeting,
            _pmiPassword: resp.password,
          });
        }
      }

      // Notify user the meeting has been scheduled
      if (isAlertSuccess) {
        setTimeout(() => {
          this._alert.success({
            message: meetingStatus.scheduledSuccess,
          });
        }, 50);
      }
      return result;
    } catch (errors) {
      this.store.dispatch({
        type: this.actionTypes.resetScheduling,
      });
      await this._errorHandle(errors);
      return null;
    } finally {
      delete (this.schedule as any)._promise;
    }
  }

  @proxify
  async getMeetingServiceInfo(extensionId?: string) {
    return this._client
      .account()
      .extension(extensionId)
      .meeting()
      .serviceInfo()
      .get();
  }

  @proxify
  async getMeeting(meetingId: string, { isAlertError = true } = {}) {
    try {
      const settings = await this._client
        .account()
        .extension()
        .meeting(meetingId)
        .get();
      return {
        ...settings,
        _requireMeetingPassword: !!settings.password,
      };
    } catch (e) {
      const error = await e.response.clone().json();
      console.log(`failed to get meeting info: ${meetingId}, ${e}`);
      const isMeetingDeleted =
        error.errorCode === 'CMN-102' &&
        error.message.indexOf('[meetingId] is not found') > -1;
      if (isAlertError && isMeetingDeleted) {
        setTimeout(() => {
          this._alert.danger({
            message: meetingStatus.meetingIsDeleted,
          });
        }, 50);
      }
      return null;
    }
  }

  async postMeeting(formattedMeeting: RcMMeetingModel) {
    return this._client
      .account()
      .extension()
      .meeting()
      .post(formattedMeeting);
  }

  @proxify
  async putMeeting(meetingId: string, formattedMeeting: RcMMeetingModel) {
    return this._client
      .account()
      .extension()
      .meeting(meetingId)
      .put(formattedMeeting);
  }

  @proxify
  async getAssistedUsers(): Promise<MeetingAssistedResponse> {
    const res = await this._client.service
      .platform()
      .get(
        '/restapi/v1.0/account/~/extension/~/meetings-configuration/assisted',
      );
    return res.json();
  }

  @proxify
  async getMeetingInvitation(meetingId: string): Promise<RcmInvitationInfo> {
    if (!this._enableInvitationApi) {
      return null;
    }
    // only rc brand is supported for now
    if (this._brand.code !== 'rc') {
      return null;
    }
    try {
      const platform = this._client.service.platform();
      const apiResponse = await platform.send({
        method: 'GET',
        url: `/restapi/v1.0/account/~/extension/~/meeting/${meetingId}/invitation`,
      });
      const { invitation } = await apiResponse.json();
      return {
        invitation,
      };
    } catch (ex) {
      console.warn(ex);
      return null;
    }
  }

  @proxify
  async getUserSettings() {
    try {
      const platform = this._client.service.platform();
      const apiResponse = await platform.send({
        method: 'GET',
        url: '/restapi/v1.0/account/~/extension/~/meeting/user-settings',
      });
      const { recording = {}, scheduleMeeting = {} } = await apiResponse.json();
      return {
        recording,
        scheduleMeeting,
      };
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  @proxify
  async getLockedSettings() {
    try {
      const platform = this._client.service.platform();
      const apiResponse = await platform.send({
        method: 'GET',
        url: '/restapi/v1.0/account/~/meeting/locked-settings',
      });
      const { recording = {}, scheduleMeeting = {} } = await apiResponse.json();
      const {
        startParticipantsVideo,
        startParticipantVideo,
        ...restScheduleOptions
      } = scheduleMeeting;
      const processedScheduleMeeting = {
        ...restScheduleOptions,
        startParticipantsVideo:
          startParticipantsVideo || startParticipantVideo || false,
      };
      return {
        recording,
        scheduleMeeting: processedScheduleMeeting,
      };
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  @proxify
  async updateMeeting(
    meetingId: string,
    meeting: RcMMeetingModel,
    { isAlertSuccess = false } = {},
    opener,
  ) {
    if (this._isUpdating(meetingId)) {
      return (this.updateMeeting as any)._promise;
    }
    meeting = meeting || this.meeting;
    try {
      this.store.dispatch({
        type: this.actionTypes.initUpdating,
        meetingId,
      });
      // Validate meeting
      this._validate(meeting);
      const formattedMeeting = this._format(meeting);
      if (this._showSaveAsDefault && meeting.saveAsDefault) {
        this.saveAsDefaultSetting(meeting);
      }

      (this.updateMeeting as any)._promise = Promise.all([
        this.putMeeting(meetingId, formattedMeeting),
        this.getMeetingServiceInfo(),
      ]);

      const [resp, serviceInfo] = await (this.updateMeeting as any)._promise;
      const invitationInfo = await this.getMeetingInvitation(meetingId);

      this.store.dispatch({
        type: this.actionTypes.updated,
        meeting: {
          ...formattedMeeting,
          _saved: meeting._saved,
        },
        meetingId,
      });

      const result = await this._createDialingNumberTpl(
        serviceInfo,
        resp,
        opener,
        invitationInfo,
      );

      // Reload meeting info
      if (this._enableReloadAfterSchedule) {
        this._initMeeting();
      }

      // Update personal meeting setting
      if (this._enablePersonalMeeting && resp.usePersonalMeetingId) {
        this.store.dispatch({
          type: this.actionTypes.updatePersonalMeeting,
          meeting: this.formatPersonalMeeting(resp),
        });
        if (this._enableServiceWebSettings) {
          this.update({
            ...this.meeting,
            _pmiPassword: resp.password,
          });
        }
      }

      // Notify user the meeting has been updated
      if (isAlertSuccess) {
        setTimeout(() => {
          this._alert.success({
            message: meetingStatus.updatedSuccess,
          });
        }, 50);
      }
      return result;
    } catch (errors) {
      this.store.dispatch({
        type: this.actionTypes.resetUpdating,
        meetingId,
      });
      await this._errorHandle(errors);
      return null;
    } finally {
      delete (this.updateMeeting as any)._promise;
    }
  }

  async _createDialingNumberTpl(
    serviceInfo: any,
    resp: any,
    opener: any,
    invitationInfo: RcmInvitationInfo,
  ) {
    serviceInfo.mobileDialingNumberTpl = getMobileDialingNumberTpl(
      serviceInfo.dialInNumbers,
      resp.id,
    );
    serviceInfo.phoneDialingNumberTpl = getPhoneDialingNumberTpl(
      serviceInfo.dialInNumbers,
    );
    const result = {
      meeting: resp,
      serviceInfo,
      extensionInfo: this.extensionInfo,
      invitationInfo,
    };

    if (typeof this.scheduledHook === 'function') {
      await this.scheduledHook(result, opener);
    }
    return result;
  }

  async _errorHandle(errors: any) {
    if (errors instanceof MeetingErrors) {
      for (const error of errors.all) {
        this._alert.warning(error);
      }
    } else if (errors && errors.response) {
      const {
        errorCode,
        permissionName,
      } = await errors.response.clone().json();
      if (errorCode === 'InsufficientPermissions' && permissionName) {
        this._alert.danger({
          message: meetingStatus.insufficientPermissions,
          payload: {
            permissionName,
          },
        });
      } else if (
        !this._availabilityMonitor ||
        !(await this._availabilityMonitor.checkIfHAError(errors))
      ) {
        this._alert.danger({ message: meetingStatus.internalError });
      }
    } else {
      console.log('errors:', errors);
      this._alert.danger({ message: meetingStatus.internalError });
    }
  }

  /**
   * @param {number} meetingId
   */
  _isUpdating(meetingId: string) {
    return (
      this.state.updatingStatus &&
      find((obj: any) => obj.meetingId === meetingId, this.state.updatingStatus)
    );
  }

  /**
   * Format meeting information.
   * @param {Object} meeting
   */
  _format(meeting: RcMMeetingModel): RcMMeetingModel {
    const {
      topic,
      meetingType,
      allowJoinBeforeHost,
      startHostVideo,
      startParticipantsVideo,
      audioOptions,
      password,
      schedule,
      recurrence,
      usePersonalMeetingId,
      _requireMeetingPassword,
      host,
    } = meeting;
    const formatted = {
      host,
      topic,
      meetingType,
      allowJoinBeforeHost,
      startHostVideo,
      startParticipantsVideo,
      audioOptions,
      password: _requireMeetingPassword ? password : '',
      recurrence,
      usePersonalMeetingId,
    } as RcMMeetingModel;
    // Recurring meetings do not have schedule info
    if (meetingType !== MeetingType.RECURRING) {
      const _schedule: MeetingScheduleResource = {
        durationInMinutes: schedule.durationInMinutes,
        timeZone: { id: UTC_TIMEZONE_ID },
      };
      if (schedule.startTime) {
        // Format selected startTime to utc standard time
        // Timezone information is not included here
        _schedule.startTime = moment.utc(schedule.startTime).format();
      }
      formatted.schedule = _schedule;

      if (recurrence && recurrence.until) {
        formatted.recurrence.until = moment.utc(recurrence.until).format();
      }
    }

    // Schedule For
    if (this._enableScheduleFor) {
      formatted.host = {
        id:
          (this.scheduleForUser && this.scheduleForUser.id) ||
          (host && host.id),
      };
    }

    // For PMI
    formatted.meetingType =
      formatted.meetingType === MeetingType.PMI
        ? MeetingType.SCHEDULED
        : formatted.meetingType;
    return formatted;
  }

  /**
   * Validate meeting information format.
   * @param {Object} meeting
   * @throws
   */
  _validate(meeting) {
    if (!meeting) {
      throw new MeetingErrors(meetingStatus.invalidMeetingInfo);
    }
    const { topic, password, schedule, _requireMeetingPassword } = meeting;
    const errors = new MeetingErrors();
    if (topic.length <= 0) {
      errors.push(meetingStatus.emptyTopic);
    }
    if (_requireMeetingPassword && (!password || password.length <= 0)) {
      errors.push(meetingStatus.noPassword);
    }
    if (schedule) {
      if (schedule.durationInMinutes < 0) {
        errors.push(meetingStatus.durationIncorrect);
      }
    }
    if (errors.length > 0) {
      throw errors;
    }
  }

  saveAsDefaultSetting(meeting) {
    const formattedMeeting = this._format(meeting);
    this.store.dispatch({
      type: this.actionTypes.saveAsDefaultSetting,
      meeting: {
        ...formattedMeeting,
        _saved: meeting.notShowAgain,
      },
    });
  }

  validatePasswordSettings(password: string, isSecret: boolean): boolean {
    if (!isSecret) {
      return true;
    }
    if (password && RCM_PASSWORD_REGEX.test(password)) {
      return true;
    }
    return false;
  }

  get extensionInfo() {
    return this._extensionInfo.info;
  }

  get meeting() {
    return this.state.meeting;
  }

  get isScheduling() {
    return this.state.schedulingStatus === scheduleStatus.scheduling;
  }

  get isUpdating() {
    return this.meeting && this.meeting.id && this._isUpdating(this.meeting.id);
  }

  get status() {
    return this.state.status;
  }

  get preferences() {
    return this.state.preferences;
  }

  @computed(({ _enableServiceWebSettings, scheduleUserSettings }: Meeting) => [
    _enableServiceWebSettings,
    scheduleUserSettings,
  ])
  get commonUserSettings() {
    if (!this._enableServiceWebSettings) {
      return {};
    }
    return pick(COMMON_SETTINGS, this.scheduleUserSettings);
  }

  @computed(({ _enablePersonalMeeting, personalMeeting }: Meeting) => [
    _enablePersonalMeeting,
    personalMeeting,
  ])
  get commonPersonalMeetingSettings() {
    if (!this._enablePersonalMeeting) {
      return {};
    }
    return pick([...COMMON_SETTINGS, 'password'], this.personalMeeting);
  }

  @computed(
    ({ _enableServiceWebSettings, scheduleLockedSettings }: Meeting) => [
      _enableServiceWebSettings,
      scheduleLockedSettings,
    ],
  )
  get defaultLockedSettings() {
    if (!this._enableServiceWebSettings) {
      return {};
    }
    return {
      _lockSettings: pick(COMMON_SETTINGS, this.scheduleLockedSettings),
    };
  }

  @computed<Meeting>(
    ({
      initialMeetingSetting,
      defaultLockedSettings,
      commonUserSettings,
      commonPersonalMeetingSettings,
    }) => [
      initialMeetingSetting,
      defaultLockedSettings,
      commonUserSettings,
      commonPersonalMeetingSettings,
    ],
  )
  get pmiDefaultSettings() {
    if (!this._enableServiceWebSettings) {
      return this.personalMeeting;
    }
    return this._initDefaultData(
      {
        ...this.initialMeetingSetting,
        ...this.defaultLockedSettings,
      },
      {
        userSettings: this.commonUserSettings,
        personalMeetingSettings: this.commonPersonalMeetingSettings,
      },
      true,
    );
  }

  @computed<Meeting>(
    ({
      initialMeetingSetting,
      defaultLockedSettings,
      commonUserSettings,
      commonPersonalMeetingSettings,
      savedDefaultMeetingSetting,
      lastMeetingSetting,
    }) => [
      initialMeetingSetting,
      defaultLockedSettings,
      commonUserSettings,
      commonPersonalMeetingSettings,
      savedDefaultMeetingSetting,
      lastMeetingSetting,
    ],
  )
  get generalDefaultSettings() {
    if (!this._enableServiceWebSettings) {
      const savedSetting = this._showSaveAsDefault
        ? this.savedDefaultMeetingSetting
        : this.lastMeetingSetting;
      return {
        ...this.initialMeetingSetting,
        ...savedSetting,
        meetingType: MeetingType.SCHEDULED,
      };
    }
    return this._initDefaultData(
      {
        ...this.initialMeetingSetting,
        ...this.defaultLockedSettings,
      },
      {
        userSettings: this.commonUserSettings,
        personalMeetingSettings: this.commonPersonalMeetingSettings,
      },
      false,
    );
  }

  @selector
  defaultMeetingSetting: any = [
    () => this.initialMeetingSetting,
    () => this.usePmiDefaultFromSW,
    () => this.userSettings,
    () => this.pmiDefaultSettings,
    () => this.generalDefaultSettings,
    () => {
      const savedSetting = this._showSaveAsDefault
        ? this.savedDefaultMeetingSetting
        : this.lastMeetingSetting;
      return savedSetting;
    },
    (
      initialSetting: RcMMeetingModel,
      usePmi: boolean,
      userSettings: Partial<RcMMeetingModel>,
      pmiDefaultSettings: Partial<RcMMeetingModel>,
      generalDefaultSettings: Partial<RcMMeetingModel>,
      savedSetting: Partial<RcMMeetingModel>,
    ) => {
      if (this._enableServiceWebSettings) {
        if (!isEmpty(userSettings)) {
          return usePmi ? pmiDefaultSettings : generalDefaultSettings;
        }
        return initialSetting;
      }
      return {
        ...initialSetting,
        ...savedSetting,
        meetingType: MeetingType.SCHEDULED,
      };
    },
  ];

  @selector
  initialMeetingSetting: any = [
    () => this._extensionInfo.info.name || '',
    () => getInitializedStartTime(),
    () => `${this._extensionInfo.info.id}` || '',
    () => `${this.scheduleForUser?.name || ''}`,
    (
      extensionName: string,
      startTime: string,
      extensionId: string,
      scheduleForName: string,
    ): RcMMeetingModel => {
      const meetingName =
        scheduleForName && scheduleForName !== ASSISTED_USERS_MYSELF
          ? scheduleForName
          : extensionName;
      const setting = getDefaultMeetingSettings(
        meetingName,
        startTime,
        extensionId,
      );
      if (!this._enableServiceWebSettings) {
        return setting;
      }
      return {
        ...setting,
        ...DEFAULT_LOCK_SETTINGS,
        _pmiPassword: '',
      };
    },
  ];

  @computed(
    ({
      _enablePersonalMeeting,
      _enableServiceWebSettings,
      scheduleUserSettings,
    }: Meeting) => [
      _enablePersonalMeeting,
      _enableServiceWebSettings,
      scheduleUserSettings,
    ],
  )
  get usePmiDefaultFromSW() {
    return (
      this._enablePersonalMeeting &&
      this._enableServiceWebSettings &&
      this.scheduleUserSettings.usePmiForScheduledMeetings
    );
  }

  @computed(({ userSettings }: Meeting) => [userSettings])
  get recordingUserSettings() {
    const { recording = {} } = this.userSettings;
    return recording;
  }

  @computed(({ userSettings }: Meeting) => [userSettings])
  get scheduleUserSettings() {
    const { scheduleMeeting = {} } = this.userSettings;
    return scheduleMeeting;
  }

  @computed(({ lockedSettings }: Meeting) => [lockedSettings])
  get recordingLockedSettings() {
    const { recording = {} } = this.lockedSettings;
    return recording;
  }

  @computed(({ lockedSettings }: Meeting) => [lockedSettings])
  get scheduleLockedSettings() {
    const { scheduleMeeting = {} } = this.lockedSettings;
    return scheduleMeeting;
  }

  get savedDefaultMeetingSetting() {
    return this._storage.getItem(this._defaultMeetingSettingKey);
  }

  get lastMeetingSetting() {
    return this._storage.getItem(this._lastMeetingSettingKey);
  }

  get showSaveAsDefault() {
    return this._showSaveAsDefault;
  }

  get isPreferencesChanged() {
    return this.state.isPreferencesChanged;
  }

  @computed(({ state }: Meeting) => [state.userSettings])
  get userSettings() {
    return this.state.userSettings || {};
  }

  @computed(({ state }: Meeting) => [state.lockedSettings])
  get lockedSettings() {
    return this.state.lockedSettings || {};
  }

  get personalMeeting() {
    return this._storage.getItem(this._personalMeetingKey);
  }

  @computed(({ state, selfUser }: Meeting) => [state, selfUser])
  get assistedUsers(): MeetingAssistedUser[] {
    if (this.state.assistedUsers.length === 0) {
      return [];
    }
    return [this.selfUser, ...this.state.assistedUsers];
  }

  @computed(({ extensionInfo }: Meeting) => [extensionInfo])
  get selfUser() {
    const myself: MeetingAssistedUser = {
      id: `${this.extensionInfo.id}`,
      name: ASSISTED_USERS_MYSELF,
    };
    return myself;
  }

  @computed(({ state }: Meeting) => [state])
  get scheduleForUser() {
    return this.state.scheduleForUser;
  }
}
