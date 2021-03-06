import {
  ExtensionInfoEvent,
  UserPhoneNumberInfo,
} from '@rc-ex/core/definitions';
import { computed, watch } from '@ringcentral-integration/core';
import { filter, find } from 'ramda';
import { Unsubscribe } from 'redux';

import { usageTypes } from '../../constants/usageTypes';
import { subscriptionFilters } from '../../enums/subscriptionFilters';
import { subscriptionHints } from '../../enums/subscriptionHints';
import { Module } from '../../lib/di';
import fetchList from '../../lib/fetchList';
import { DataFetcherV2Consumer, DataSource } from '../DataFetcherV2';
import { Deps } from './ExtensionPhoneNumber.interface';

@Module({
  name: 'ExtensionPhoneNumber',
  deps: [
    'Client',
    'DataFetcherV2',
    'RolesAndPermissions',
    'Subscription',
    { dep: 'TabManager', optional: true },
    { dep: 'ExtensionPhoneNumberOptions', optional: true },
  ],
})
export class ExtensionPhoneNumber extends DataFetcherV2Consumer<
  Deps,
  UserPhoneNumberInfo[]
> {
  protected _stopWatching: Unsubscribe;

  constructor(deps: Deps) {
    super({
      deps,
    });
    this._source = new DataSource({
      ...deps.extensionPhoneNumberOptions,
      key: 'extensionPhoneNumber',
      cleanOnReset: true,
      fetchFunction: async (): Promise<UserPhoneNumberInfo[]> =>
        fetchList((params: any) =>
          this._deps.client
            .account()
            .extension()
            .phoneNumber()
            .list(params),
        ),
      readyCheckFunction: () =>
        !!(
          this._deps.rolesAndPermissions.ready && this._deps.subscription.ready
        ),
      permissionCheckFunction: () =>
        !!this._deps.rolesAndPermissions.permissions.ReadUserPhoneNumbers,
    });
    this._deps.dataFetcherV2.register(this._source);
  }

  protected _handleSubscription(message: ExtensionInfoEvent) {
    if (
      this.ready &&
      (this._source.disableCache || (this._deps.tabManager?.active ?? true)) &&
      message?.body?.hints?.includes(subscriptionHints.companyNumbers)
    ) {
      this.fetchData();
    }
  }

  onInit() {
    this._deps.subscription.subscribe([subscriptionFilters.extensionInfo]);
    this._stopWatching = watch(
      this,
      () => this._deps.subscription.message,
      (newMessage) => this._handleSubscription(newMessage),
    );
  }

  onReset() {
    this._stopWatching?.();
    this._stopWatching = null;
  }

  @computed<ExtensionPhoneNumber>(({ data }) => [data])
  get numbers() {
    return this.data ?? [];
  }

  @computed<ExtensionPhoneNumber>(({ numbers }) => [numbers])
  get companyNumbers() {
    return filter(
      (phoneNumber) => phoneNumber.usageType === usageTypes.CompanyNumber,
      this.numbers,
    );
  }

  @computed<ExtensionPhoneNumber>(({ numbers }) => [numbers])
  get mainCompanyNumber() {
    return find(
      (phoneNumber) => phoneNumber.usageType === usageTypes.MainCompanyNumber,
      this.numbers,
    );
  }

  @computed<ExtensionPhoneNumber>(({ numbers }) => [numbers])
  get directNumbers() {
    return filter(
      (phoneNumber) => phoneNumber === usageTypes.DirectNumber,
      this.numbers,
    );
  }

  @computed<ExtensionPhoneNumber>(({ numbers }) => [numbers])
  get callerIdNumbers() {
    return filter(
      (phoneNumber) =>
        phoneNumber.features?.indexOf('CallerId') !== -1 ||
        ((phoneNumber.usageType === usageTypes.ForwardedNumber ||
          phoneNumber.usageType === usageTypes.ForwardedCompanyNumber) &&
          (phoneNumber.status === 'PortedIn' ||
            phoneNumber.status === 'Normal')),
      this.numbers,
    );
  }

  @computed<ExtensionPhoneNumber>(({ numbers }) => [numbers])
  get smsSenderNumbers() {
    return filter(
      (phoneNumber) => phoneNumber.features?.indexOf('SmsSender') !== -1,
      this.numbers,
    );
  }
}
