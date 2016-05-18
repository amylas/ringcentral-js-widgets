import sdk from '../services/rc-sdk'
import phoneService from '../services/phone-service'
import loginService from '../services/login-service'
import callLogService from '../services/call-log-service'
import accountService from '../services/account-service'
import rcContactService from '../services/rc-contact-service'
import contactSearchService from '../services/contact-search-service'
import rcContactSearchProvider from '../services/rc-contact-search-provider'
import rcMessageService from '../services/rc-message-service'
import rcMessageProvider from '../services/rc-message-provider'
import rcConferenceSerivce from '../services/rc-conference-service'
import conversationService from '../services/rc-conversation-service'

import md5 from 'blueimp-md5'

import config from '../services/rc-config'
var dialPadSearchProviders = [rcContactSearchProvider]

var services = {}
services.rcPhone = {
    loadData: {
        method: function() {
            console.log('load data');
            rcMessageService.subscribeToMessageUpdate();
            // rcMessageService.syncMessages(this.props.cachedMessageHours);
            accountService.getAccountInfo();
            accountService.getPhoneNumber();
            rcContactService.cacheContacts();
            phoneService.init({
                incomingAudio: config.incomingAudio,
                outgoingAudio: config.outgoingAudio
            });
            callLogService.getCallLogs();
        }
    }
}
services['auth-panel'] = {
    login: {
        method: function() {
            console.log('login');
            return loginService.login(
                PhoneFormat.formatE164('US', this.props.username),
                this.props.extension,
                this.props.password
            )
        }
    }
}
services['dial-pad'] = {
    mount: {
        after: function() {
            console.log('mount');
            if (!accountService.hasServiceFeature("VoipCalling"))
                this.disable();
        }
    },
    callout: {
        method: function() {
            console.log(this.props.remoteVideo);
            return phoneService.call(
                this.props.fromNumber, 
                this.props.toNumber, {
                    remoteVideo: this.props.remoteVideo,
                    localVideo: this.props.localVideo
                })
        }
    },
    queryContacts: {
        method: function() {
            var dialPadSearchFunctions = dialPadSearchProviders.map(provider => {
                return provider.search(this.props.toNumber);
            });
            console.log(dialPadSearchFunctions);
            return contactSearchService.query(dialPadSearchFunctions);
        }
    },
    getOutboundCallerID: {
        method: function() {
            return accountService.getPhoneNumber().then(() => {
                return accountService.listNumber("VoiceFax", 'CallerId')
            })
        }
    }
}

services['conference'] = {
    getConferenceInfo: {
        method: function() {
            return rcConferenceSerivce.getConferenceInfo();
        }
    }
}
services['call-log'] = {
    init: {
        method: function() {
            return callLogService.getCallLogs();
        }
    }
}

services['time-line'] = {
    mount: {
        after: function() {
            rcMessageService.subscribeToMessageUpdate()
            rcMessageProvider.onMessageUpdated(msg => {
                this.updateTimeline(conversationService.syncContent(this.props.contacts, msg))
                if (this.props.currentConv) {
                    this.props.currentConv.confirmMessages()
                    this.props.currentConv.addIncomingMessages()
                }
            })
            return rcContactService.cacheContacts().then(contacts => this.props.contacts = contacts)
        }
    },
    fetchData: {
        method: function() {
            return Promise.all([
                rcContactService.cacheContacts(), // first one must be the contacts
                rcMessageService.syncMessages(conversationService.cachedHour),
                callLogService.getCallLogs(),
            ]).then(result => conversationService.organizeContent(...result))
        }
    }
}

services['contacts'] = {
    mount: {
        after: function() {
            this.fetchContacts()
        }
    },
    fetchRelatedContact: {
        method: function() {
            return Promise.all([
                rcMessageService.syncMessages(conversationService.cachedHour),
                callLogService.getCallLogs(),
                rcContactService.cacheContacts()
            ]).then(result => {
                var [msgs, logs, contacts] = result
                this.props.contacts = contacts.reduce((result, contact) => {
                    result[contact.id] = contact
                    return result
                }, {})
                return conversationService.getConversations(contacts, msgs, logs)
            }).then(relateContacts => {
                this.props.relateContacts = relateContacts
                return relateContacts
            }).then(relateContacts => 
                Object.keys(relateContacts).map(index => {
                    // adapt to messages template format
                    relateContacts[index].msg[0].contact = relateContacts[index].displayName
                    // for conversation-advance temaplate
                    relateContacts[index].msg[0].contactId = index
                    return relateContacts[index].msg[0]
                })
            )
        }
    },
    fetchContacts: {
        method: function() {
            // var dialPadSearchFunctions = dialPadSearchProviders.map(provider => {
            //     return provider.searchAll();
            // });
            // return contactSearchService.query(dialPadSearchFunctions);
            return rcContactService.cacheContacts().then(contacts => {
                this.props.contacts = contacts.reduce((result, contact) => {
                    result[contact.id] = contact
                    return result
                }, {})
                return contacts.map(contact => {
                    return {
                        name: contact.displayName,
                        type: 'rc',
                        id: contact.id,
                    }
                });
            }).catch(e => console.error(e))
        }
    }
}

services['conversation-advanced'] = {
    init: {
        after: function() {
            this.props.hourOffset = 3 * 24
            
        }
    },
    mount: {
        after: function() {
            return accountService.getAccountInfo()
                    .then(info => this.props.fromExtension = info.extensionNumber)
                    .then(this.getOutboundCallerID)
        }
    },
    send: {
        method: function() {
            if (this.props.toNumber === this.props.toExtension) {
                return rcMessageService.sendPagerMessage(
                    this.props.message,
                    this.props.fromExtension,
                    this.props.toExtension
                );
            }
            else {
                return rcMessageService.sendSMSMessage(
                    this.props.message,
                    this.props.fromNumber,
                    this.props.toNumber
                );
            }
        }
    },
    callout: {
        method: function() {
            console.log(this.props.remoteVideo);
            return phoneService.call(
                this.props.fromNumber, 
                this.props.toNumber, {
                    remoteVideo: this.props.remoteVideo,
                    localVideo: this.props.localVideo
                })
        }
    },
    queryContacts: {
        method: function() {
            var dialPadSearchFunctions = dialPadSearchProviders.map(provider => {
                return provider.search(this.props.to);
            });
            return contactSearchService.query(dialPadSearchFunctions);
        }
    },
    getOutboundCallerID: {
        method: function() {
            return accountService.getPhoneNumber().then(() => 
                accountService.listNumber("VoiceFax", 'SmsSender'));
        }
    },
    reachTop: {
        method: function() {
            return conversationService.loadContent(this.props.contact, this.props.hourOffset)
        }
    },
    getAvatar: {
        method: function() {
            if (!this.props.profileImage)
                return Promise.resolve(`http://www.gravatar.com/avatar/${md5(this.props.contact.id)}?d=retro`)
            return sdk.platform()
                .get(this.props.profileImage)
                .then(r => r.response())
                .then(r => {
                    // Real contact, no avatar
                    console.log(r)
                    if (r.status === 204 || r.status === 404) {
                        console.log('1');
                        var hash = md5(this.props.contact.id)
                        return `http://www.gravatar.com/avatar/${hash}?d=retro`
                    } else {
                        console.log('2');
                        console.log(this.props.profileImage);
                        console.log(`?access_token=${rcContactService.accessToken()}`);
                        // Real contact, has avatar
                        return
                            this.props.profileImage + `?access_token=${rcContactService.accessToken()}`
                    }
                })
                .catch(e => {
                    console.log('3');
                    // Real contact, no avatar
                    var hash = md5(this.props.contact.id)
                    return `http://www.gravatar.com/avatar/${hash}?d=retro`
                })
        }
    },
    transformURL: {
        method: function() {
            return this.props.transformee + `?access_token=${rcContactService.accessToken()}`
        }
    },
}
services['call-panel'] = {
    init: {
        after: function() {
            console.log('register progree on');
            phoneService.on('progress', () => {
                console.log('progress, ready to mount');
                console.log(this.props.target);
                this.mount(this.props.target)
            })
        }
    },
    mount: {
        after: function() {
            phoneService.on('bye', () => {
                this.unmount()
            })
            phoneService.on('terminated', () => {
                this.unmount()
            })
            phoneService.on('rejected', () => {
                this.unmount()
            })
            phoneService.on('failed', () => {
                this.unmount()
            })
            phoneService.on('accepted', () => {
                this.mount(this.props.target)
            })

        }
    },
    hangup: {
        method: function() {
            return phoneService.hangup()
        },
    },
    hold: {
        method: function() {
            return phoneService.hold()
        },
    },
    mute: {
        method: function() {
            return phoneService.mute()
        },
    },
    flip: {
        method: function() {
            return phoneService.flip()
        },
    },
    forward: {
        method: function() {
            return phoneService.forward()
        },
    },
    record: {
        method: function() {
            return phoneService.record()
        },
    },
}
services['call-panel-incoming'] = {
    init: {
        method: function() {
            phoneService.on('invite', session => {
                this.props.session = session
                this.setName(session.request.from.displayName)
                this.mount(this.props.target)
                console.log('register..');  
                phoneService.on('terminated', () => {
                    this.unmount()
                })
                phoneService.on('failed', () => {
                    this.unmount()
                })
            })
        }
    },
    accept: {
        method: function() {
            phoneService.accept({
                remoteVideo: this.props.remoteVideo,
                localVideo: this.props.localVideo,
            })
        }
    }
}
export default services
