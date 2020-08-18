import { reduce, forEach, map, join, keys } from 'ramda';
import {
  RcModuleV2,
  state,
  action,
  computed,
} from '@ringcentral-integration/core';
import { PresenceInfoResponse, ValidationError } from '@rc-ex/core/definitions';
import phoneTypes from '../../enums/phoneTypes';
import { Module } from '../../lib/di';
import isBlank from '../../lib/isBlank';
import { batchGetApi } from '../../lib/batchApiHelper';
import { getMatchContacts, getFindContact } from '../../lib/contactHelper';
import proxify from '../../lib/proxy/proxify';
import {
  Deps,
  ProfileImages,
  Presences,
  Contact,
  PresenceContexts,
  PresenceMap,
} from './AccountContacts.interfaces';

const MaximumBatchGetPresence = 30;
const DEFAULT_TTL = 30 * 60 * 1000; // 30 mins
const DEFAULT_PRESENCETTL = 10 * 60 * 1000; // 10 mins
const DEFAULT_AVATARTTL = 2 * 60 * 60 * 1000; // 2 hour
const DEFAULT_AVATARQUERYINTERVAL = 2 * 1000; // 2 seconds

@Module({
  name: 'AccountContacts',
  deps: [
    'Client',
    { dep: 'CompanyContacts' },
    { dep: 'ExtensionInfo', optional: true },
    { dep: 'AccountContactsOptions', optional: true },
  ],
})
export class AccountContacts extends RcModuleV2<Deps> {
  protected _getPresenceContexts?: PresenceContexts;

  protected _enqueueTimeoutId: NodeJS.Timeout;

  constructor(deps: Deps) {
    super({
      deps,
    });
  }

  @state
  profileImages: ProfileImages = {};

  @state
  presences: Presences = {};

  @action
  fetchImageSuccess({
    imageId,
    imageUrl,
    ttl,
  }: {
    imageId: string;
    imageUrl: string;
    ttl: number;
  }) {
    const data: ProfileImages = {};
    Object.keys(this.profileImages).forEach((key) => {
      if (Date.now() - this.profileImages[key].timestamp < ttl) {
        data[key] = this.profileImages[key];
      } else {
        URL.revokeObjectURL(this.profileImages[key].imageUrl);
      }
    });
    this.profileImages = data;
    this.profileImages[imageId] = {
      imageUrl,
      timestamp: Date.now(),
    };
  }

  @action
  batchFetchPresenceSuccess({
    presenceMap = {},
    ttl,
  }: {
    presenceMap?: PresenceMap;
    ttl: number;
  }) {
    const data: Presences = {};
    Object.keys(this.presences).forEach((key) => {
      if (Date.now() - this.presences[key].timestamp < ttl) {
        data[key] = this.presences[key];
      }
    });
    this.presences = data;
    Object.keys(presenceMap).forEach((key) => {
      this.presences[key] = {
        presence: presenceMap[key],
        timestamp: Date.now(),
      };
    });
  }

  onReset() {
    Object.keys(this.profileImages).forEach((key) => {
      URL.revokeObjectURL(this.profileImages[key].imageUrl);
    });
    this.profileImages = {};
    this.presences = {};
  }

  get _ttl() {
    return this._deps.accountContactsOptions?.ttl ?? DEFAULT_TTL;
  }

  get _avatarTtl() {
    return this._deps.accountContactsOptions?.avatarTtl ?? DEFAULT_AVATARTTL;
  }

  get _presenceTtl() {
    return (
      this._deps.accountContactsOptions?.presenceTtl ?? DEFAULT_PRESENCETTL
    );
  }

  get _avatarQueryInterval() {
    return (
      this._deps.accountContactsOptions?.avatarQueryInterval ??
      DEFAULT_AVATARQUERYINTERVAL
    );
  }

  _shouldInit() {
    return this._deps.companyContacts.ready && this.pending;
  }

  _shouldReset() {
    return !this._deps.companyContacts.ready && this.ready;
  }

  // interface of contact source
  @proxify
  async getProfileImage(contact: Contact, useCache = true) {
    if (
      !contact ||
      !contact.id ||
      contact.type !== 'company' ||
      !contact.hasProfileImage
    ) {
      return null;
    }

    const imageId = contact.id;
    if (
      useCache &&
      this.profileImages[imageId] &&
      Date.now() - this.profileImages[imageId].timestamp < this._avatarTtl
    ) {
      const image = this.profileImages[imageId].imageUrl;
      return image;
    }
    let imageUrl = null;
    try {
      const response = await this._deps.client
        .account(contact.account.id)
        .extension(contact.id)
        .profileImage('195x195')
        .get();
      imageUrl = URL.createObjectURL(await response._response.blob());
      this.fetchImageSuccess({
        imageId,
        imageUrl,
        ttl: this._avatarTtl,
      });
    } catch (e) {
      console.error(e);
    }
    return imageUrl;
  }

  // interface of contact source
  @proxify
  getPresence(contact: Contact, useCache = true) {
    return new Promise((resolve) => {
      if (!contact || !contact.id || contact.type !== 'company') {
        resolve(null);
        return;
      }

      const presenceId = `${contact.id}`;
      if (
        useCache &&
        this.presences[presenceId] &&
        Date.now() - this.presences[presenceId].timestamp < this._presenceTtl
      ) {
        const { presence } = this.presences[presenceId];
        resolve(presence);
        return;
      }

      if (!this._getPresenceContexts) {
        this._getPresenceContexts = [];
      }
      this._getPresenceContexts.push({
        contact,
        resolve,
      });

      clearTimeout(this._enqueueTimeoutId);
      if (this._getPresenceContexts.length === MaximumBatchGetPresence) {
        this._processQueryPresences(this._getPresenceContexts);
        this._getPresenceContexts = null;
      } else {
        this._enqueueTimeoutId = setTimeout(() => {
          this._processQueryPresences(this._getPresenceContexts);
          this._getPresenceContexts = null;
        }, 1000);
      }
    });
  }

  // interface of contact source
  matchPhoneNumber(phoneNumber: string) {
    const { isMultipleSiteEnabled, site } = this._deps.extensionInfo;
    return getMatchContacts({
      contacts: [...this.contacts, ...this._deps.companyContacts.ivrContacts],
      phoneNumber,
      entityType: 'rcContact',
      findContact: getFindContact({
        phoneNumber,
        options: {
          isMultipleSiteEnabled,
          site,
        },
      }),
    });
  }

  async _processQueryPresences(getPresenceContexts: PresenceContexts) {
    const contacts = getPresenceContexts.map<Contact>((x) => x.contact);
    const responses = await this._batchQueryPresences(contacts);
    const presenceMap: PresenceMap = {};
    getPresenceContexts.forEach((ctx) => {
      const response = responses[ctx.contact.id];
      if (!response) {
        ctx.resolve(null);
        return;
      }
      const {
        dndStatus,
        presenceStatus,
        telephonyStatus,
        userStatus,
      } = response;
      const presenceId = ctx.contact.id;
      presenceMap[presenceId] = {
        dndStatus,
        presenceStatus,
        telephonyStatus,
        userStatus,
      };
      ctx.resolve(presenceMap[presenceId]);
    });
    this.batchFetchPresenceSuccess({
      presenceMap,
      ttl: this._presenceTtl,
    });
  }

  async _batchQueryPresences(contacts: Contact[]) {
    const presenceSet: Record<string, PresenceInfoResponse> = {};
    try {
      const accountExtensionMap = reduce(
        (acc: Record<string, string[]>, item) => {
          if (!acc[item.account.id]) {
            acc[item.account.id] = [];
          }
          acc[item.account.id].push(item.id);
          return acc;
        },
        {},
        contacts,
      );
      const batchResponses = await Promise.all<
        (PresenceInfoResponse | ValidationError)[]
      >(
        map(async (accountId) => {
          if (accountExtensionMap[accountId].length > 1) {
            const ids = join(',', accountExtensionMap[accountId]);
            // extract json data now so the data appears in the same format
            // as single requests
            return Promise.all(
              map(
                async (resp) => resp.json(),
                await batchGetApi({
                  platform: this._deps.client.service.platform(),
                  url: `/restapi/v1.0/account/${accountId}/extension/${ids}/presence`,
                }),
              ),
            );
          }
          // wrap single request response data in array to keep the same
          // format as batch requests
          return [
            await this._deps.client
              .account(accountId)
              .extension(accountExtensionMap[accountId][0])
              .presence()
              .get(),
          ];
        }, keys(accountExtensionMap)),
      );
      // treat all data as batch since the data is normalized
      forEach(
        (batch) =>
          forEach((data) => {
            if ((data as ValidationError).errorCode) {
              console.warn(data);
              return;
            }
            const _data: PresenceInfoResponse = data;
            const { id } = _data.extension;
            presenceSet[id] = _data;
          }, batch),
        batchResponses,
      );
    } catch (e) {
      console.error(e);
    }
    return presenceSet;
  }

  // interface of contact source
  get sourceName() {
    return 'company';
  }

  // interface of contact source
  @computed<AccountContacts>(({ _deps, presences, profileImages }) => [
    _deps.companyContacts.filteredContacts,
    profileImages,
    presences,
  ])
  get directoryContacts(): Contact[] {
    return reduce(
      (result, item) => {
        const id = `${item.id}`;
        const contact: Contact = {
          ...item,
          type: this.sourceName,
          id,
          emails: [item.email],
          extensionNumber: item.extensionNumber,
          hasProfileImage: !!item.profileImage,
          phoneNumbers: [
            {
              phoneNumber: item.extensionNumber,
              phoneType: phoneTypes.extension,
            },
          ],
          profileImageUrl:
            this.profileImages[id] && this.profileImages[id].imageUrl,
          presence: this.presences[id] && this.presences[id].presence,
          contactStatus: item.status,
        };
        contact.name = item.name
          ? item.name
          : `${contact.firstName || ''} ${contact.lastName || ''}`;
        if (isBlank(contact.extensionNumber)) {
          return result;
        }
        if (item.phoneNumbers && item.phoneNumbers.length > 0) {
          item.phoneNumbers.forEach((phone) => {
            if (phone.type) {
              contact.phoneNumbers.push({
                ...phone,
                phoneType: phoneTypes.direct,
              });
            }
          });
        }
        result.push(contact);
        return result;
      },
      [],
      this._deps.companyContacts.filteredContacts,
    );
  }

  get contacts() {
    return this.directoryContacts;
  }

  get sourceReady() {
    return this.ready;
  }
}
