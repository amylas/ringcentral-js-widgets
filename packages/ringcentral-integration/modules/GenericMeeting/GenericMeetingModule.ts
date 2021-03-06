import EventEmitter from 'events';
import RcModule from '../../lib/RcModule';
import { Module } from '../../lib/di';
import Meeting from '../Meeting';
import Brand from '../Brand';
import ExtensionInfo from '../ExtensionInfo';
import proxify from '../../lib/proxy/proxify';
import background from '../../lib/background';

import {
  IGenericMeeting,
  MeetingEvents,
  ScheduleModel,
  ScheduledCallback,
} from './interface';

import MeetingProvider from '../MeetingProvider';

import { actionTypes } from './actionTypes';

import { RcVideo } from '../RcVideo';

import getGenericMeetingReducer from './getGenericMeetingReducer';
import { RcVMeetingModel } from '../../models/rcv.model';

@Module({
  deps: ['MeetingProvider', 'ExtensionInfo', 'Brand', 'Meeting', 'RcVideo'],
})
export class GenericMeeting extends RcModule implements IGenericMeeting {
  protected _meetingProvider: MeetingProvider;
  protected _meeting: Meeting;
  protected _rcVideo: RcVideo;
  protected _brand: Brand;
  protected _extensionInfo: ExtensionInfo;
  protected _eventEmitter = new EventEmitter();

  constructor({
    meeting,
    meetingProvider,
    rcVideo,
    brand,
    reducers,
    extensionInfo,
    ...options
  }) {
    super({
      ...options,
      actionTypes: options.actionTypes || actionTypes,
    });
    this._reducer = getGenericMeetingReducer(this.actionTypes, reducers);
    this._meeting = meeting;
    this._meetingProvider = meetingProvider;
    this._rcVideo = rcVideo;
    this._brand = brand;
    this._extensionInfo = extensionInfo;
  }

  initialize() {
    this.store.subscribe(() => this._onStateChange());
  }

  @background
  init() {
    return this._meetingModule && this._meetingModule.init();
  }

  @proxify
  reload() {
    return this._meetingModule && this._meetingModule.reload();
  }

  @proxify
  switchUsePersonalMeetingId(usePersonalMeetingId: boolean) {
    return (
      this._meetingModule &&
      this._meetingModule.switchUsePersonalMeetingId &&
      this._meetingModule.switchUsePersonalMeetingId(usePersonalMeetingId)
    );
  }

  @proxify
  updateScheduleFor(userExtensionId: string) {
    return (
      this._meetingModule &&
      this._meetingModule.updateScheduleFor &&
      this._meetingModule.updateScheduleFor(userExtensionId)
    );
  }

  /* TODO: any is reserved for RcM */
  @proxify
  updateMeetingSettings(
    meeting: RcVMeetingModel | any,
    patch: boolean = true,
  ): void {
    const fn =
      this._meetingModule &&
      (this._meetingModule.update || this._meetingModule.updateMeetingSettings);
    return fn && (fn as Function).call(this._meetingModule, meeting, patch);
  }

  @proxify
  async schedule(
    meeting: ScheduleModel,
    config?: { isAlertSuccess: boolean },
    opener?: Window,
  ) {
    let result;
    if (this.isRCM) {
      result = await this._meeting.schedule(meeting, config, opener);
    } else if (this.isRCV) {
      result = await this._rcVideo.createMeeting(
        meeting as RcVMeetingModel,
        config,
      );
    } else {
      console.error('Unknown meeting provider, please check module runtime');
      return;
    }
    if (result) {
      this._eventEmitter.emit(MeetingEvents.afterSchedule, result, opener);
    } else if (opener && opener.close) {
      opener.close();
    }
    return result;
  }

  // TODO: any infer the type of rcm meeting, should be more specific
  async instantMeeting(meeting: RcVMeetingModel | any) {
    if (this.isRCV) {
      return this._rcVideo.instantMeeting(meeting as RcVMeetingModel);
    }
    return this._meeting.schedule(meeting);
  }

  @proxify
  async getMeeting(meetingId: string) {
    return this._meetingModule && this._meetingModule.getMeeting(meetingId);
  }

  @proxify
  async getMeetingServiceInfo() {
    return (
      this._meetingModule &&
      this._meetingModule.getMeetingServiceInfo &&
      this._meetingModule.getMeetingServiceInfo()
    );
  }

  @proxify
  async updateMeeting(...args) {
    const fn = this._meetingModule && this._meetingModule.updateMeeting;
    return fn && (fn as Function).apply(this._meetingModule, args);
  }

  addScheduledCallBack(cb: ScheduledCallback) {
    this._eventEmitter.on(MeetingEvents.afterSchedule, cb);
  }

  removeScheduledCallBack(cb: ScheduledCallback) {
    this._eventEmitter.removeListener(MeetingEvents.afterSchedule, cb);
  }

  validatePasswordSettings(password: string, isSecret: boolean): boolean {
    return (
      this._meetingModule &&
      this._meetingModule.validatePasswordSettings(password, isSecret)
    );
  }

  generateRcvMeetingPassword() {
    return this._rcVideo.generateRandomPassword();
  }

  _onStateChange() {
    if (this._shouldInit()) {
      this._init();
    } else if (this._shouldReset()) {
      this._reset();
    }
  }

  private _shouldInit() {
    return (
      this.pending &&
      this._brand.ready &&
      this._extensionInfo.ready &&
      this._meetingProvider.ready &&
      this._meetingProvider.provider &&
      this._meetingModule &&
      this._meetingModule.ready
    );
  }

  private _shouldReset() {
    return (
      this.ready &&
      (!this._brand.ready ||
        !this._extensionInfo.ready ||
        !this._meetingProvider.ready ||
        !this._meetingProvider.provider ||
        (this._meetingModule && !this._meetingModule.ready))
    );
  }

  private _init() {
    this.store.dispatch({
      type: this.actionTypes.initSuccess,
    });
  }

  private _reset() {
    this.store.dispatch({
      type: this.actionTypes.resetSuccess,
    });
  }

  get meetingProviderType() {
    return this._meetingProvider.provider;
  }

  get isRCV() {
    return this._meetingProvider.isRCV;
  }

  get isRCM() {
    return this._meetingProvider.isRCM;
  }

  get extensionInfo() {
    return this._extensionInfo.info;
  }

  protected get _meetingModule() {
    if (this.isRCM) {
      return this._meeting;
    }
    if (this.isRCV) {
      return this._rcVideo;
    }
    throw new Error(
      'Unknown meeting provider, please check the module runtime',
    );
  }

  get meeting() {
    return this._meetingModule && this._meetingModule.meeting;
  }

  /** TODO: assistedUsers and scheduleForUser are
   *  used for 'Schedule For' Feature
   * Now it only applies to RCM
   */
  get assistedUsers() {
    return this._meetingModule && this._meetingModule.assistedUsers;
  }

  get scheduleForUser() {
    return this._meetingModule && this._meetingModule.scheduleForUser;
  }

  get defaultSetting() {
    if (this.isRCM) {
      return this._meeting.defaultMeetingSetting;
    }
    if (this.isRCV) {
      return this._rcVideo.defaultVideoSetting;
    }
    return null;
  }

  get isScheduling() {
    return !!(this._meetingModule && this._meetingModule.isScheduling);
  }

  get showSaveAsDefault() {
    return !!(this._meetingModule && this._meetingModule.showSaveAsDefault);
  }

  get isPreferencesChanged() {
    return !!(this._meetingModule && this._meetingModule.isPreferencesChanged);
  }

  get brandName() {
    return this._brand.name;
  }

  get status() {
    return this.state.status;
  }

  get personalMeeting() {
    return this._meetingModule && this._meetingModule.personalMeeting;
  }
}
