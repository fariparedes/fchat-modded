<template>
    <div style="height:100%; display: flex; position: relative;" id="chatView" @click="userMenuHandle" @contextmenu="userMenuHandle" @touchstart.passive="userMenuHandle"
        @touchend="userMenuHandle">
        <sidebar id="sidebar" :label="l('chat.menu')" icon="fa-bars">
            <img :src="characterImage(ownCharacter.name)" v-if="showAvatars" style="float:left;margin-right:5px;width:60px"/>
            <a target="_blank" :href="ownCharacterLink" class="btn" style="margin-right:5px">{{ownCharacter.name}}</a>
            <a href="#" @click.prevent="logOut()" class="btn"><i class="fas fa-sign-out-alt"></i>{{l('chat.logout')}}</a><br/>
            <div>
                {{l('chat.status')}}
                <a href="#" @click.prevent="showStatus()" class="btn">
                    <span class="fas fa-fw" :class="getStatusIcon(ownCharacter.status)"></span>{{l('status.' + ownCharacter.status)}}
                </a>
            </div>
            <div style="clear:both">
                <a href="#" @click.prevent="showSearch()" class="btn"><span class="fas fa-search"></span>
                    {{l('characterSearch.open')}}</a>
            </div>
            <div><a href="#" @click.prevent="showSettings()" class="btn"><span class="fas fa-cog"></span>
                {{l('settings.open')}}</a></div>
            <div><a href="#" @click.prevent="showRecent()" class="btn"><span class="fas fa-history"></span>
                {{l('chat.recentConversations')}}</a></div>
            <div class="list-group conversation-nav">
                <a :class="getClasses(conversations.consoleTab)" href="#" @click.prevent="conversations.consoleTab.show()"
                    class="list-group-item list-group-item-action">
                    {{conversations.consoleTab.name}}
                </a>
            </div>
            {{l('chat.pms')}}
            <div class="list-group conversation-nav" ref="privateConversations">
                <a v-for="conversation in conversations.privateConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" :data-character="conversation.character.name" data-touch="false"
                    class="list-group-item list-group-item-action item-private" :key="conversation.key"
                    @click.middle.prevent="conversation.close()">
                    <img :src="characterImage(conversation.character.name)" v-if="showAvatars"/>
                    <div class="name">
                        <span>{{conversation.character.name}}</span>
                        <div style="line-height:0;display:flex">
                            <span class="fas fa-reply" v-show="needsReply(conversation)"></span>
                            <span class="fas"
                                :class="{'fa-comment-dots': conversation.typingStatus == 'typing', 'fa-comment': conversation.typingStatus == 'paused'}"
                            ></span>
                            <span style="flex:1"></span>
                            <span class="pin fas fa-thumbtack" :class="{'active': conversation.isPinned}"
                                @click="conversation.isPinned = !conversation.isPinned" :aria-label="l('chat.pinTab')"></span>
                            <span class="fas fa-times leave" @click.stop="conversation.close()" :aria-label="l('chat.closeTab')"></span>
                        </div>
                    </div>
                </a>
            </div>
            <a href="#" @click.prevent="showChannels()" class="btn"><span class="fas fa-list"></span>
                {{l('chat.channels')}}</a>
            <div class="list-group conversation-nav" ref="channelConversations">
                <a v-for="conversation in conversations.channelConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" class="list-group-item list-group-item-action item-channel" :key="conversation.key"
                    @click.middle.prevent="conversation.close()">
                    <span class="name">{{conversation.name}}</span>
                    <span>
                        <span class="pin fas fa-thumbtack" :class="{'active': conversation.isPinned}" :aria-label="l('chat.pinTab')"
                            @click.stop="conversation.isPinned = !conversation.isPinned" @mousedown.prevent></span>
                        <span class="fas fa-times leave" @click.stop="conversation.close()" :aria-label="l('chat.closeTab')"></span>
                    </span>
                </a>
            </div>
        </sidebar>
        <div style="display:flex;flex-direction:column;flex:1;min-width:0">
            <div id="quick-switcher" class="list-group">
                <a :class="getClasses(conversations.consoleTab)" href="#" @click.prevent="conversations.consoleTab.show()"
                    class="list-group-item list-group-item-action">
                    <span class="fas fa-home conversation-icon"></span>
                    {{conversations.consoleTab.name}}
                </a>
                <a v-for="conversation in conversations.privateConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" class="list-group-item list-group-item-action" :key="conversation.key">
                    <img :src="characterImage(conversation.character.name)" v-if="showAvatars"/>
                    <span class="far fa-user-circle conversation-icon" v-else></span>
                    <div class="name">{{conversation.character.name}}</div>
                </a>
                <a v-for="conversation in conversations.channelConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" class="list-group-item list-group-item-action" :key="conversation.key">
                    <span class="fas fa-hashtag conversation-icon"></span>
                    <div class="name">{{conversation.name}}</div>
                </a>
            </div>
            <conversation :reportDialog="$refs['reportDialog']"></conversation>
        </div>
        <user-list></user-list>
        <channels ref="channelsDialog"></channels>
        <status-switcher ref="statusDialog"></status-switcher>
        <character-search ref="searchDialog"></character-search>
        <settings ref="settingsDialog"></settings>
        <report-dialog ref="reportDialog"></report-dialog>
        <user-menu ref="userMenu" :reportDialog="$refs['reportDialog']"></user-menu>
        <recent-conversations ref="recentDialog"></recent-conversations>
    </div>
</template>

<script lang="ts">
    import {Component, Hook} from '@f-list/vue-ts';
    //tslint:disable-next-line:no-require-imports
    import Sortable from 'sortablejs';
    import Vue from 'vue';
    import {Keys} from '../keys';
    import ChannelList from './ChannelList.vue';
    import CharacterSearch from './CharacterSearch.vue';
    import {characterImage, getKey, profileLink} from './common';
    import ConversationView from './ConversationView.vue';
    import core from './core';
    import {Character, Connection, Conversation} from './interfaces';
    import l from './localize';
    import RecentConversations from './RecentConversations.vue';
    import ReportDialog from './ReportDialog.vue';
    import SettingsView from './SettingsView.vue';
    import Sidebar from './Sidebar.vue';
    import StatusSwitcher from './StatusSwitcher.vue';
    import {getStatusIcon} from './user_view';
    import UserList from './UserList.vue';
    import UserMenu from './UserMenu.vue';

    const unreadClasses = {
        [Conversation.UnreadState.None]: '',
        [Conversation.UnreadState.Mention]: 'list-group-item-warning',
        [Conversation.UnreadState.Unread]: 'list-group-item-danger'
    };

    @Component({
        components: {
            'user-list': UserList, channels: ChannelList, 'status-switcher': StatusSwitcher, 'character-search': CharacterSearch,
            settings: SettingsView, conversation: ConversationView, 'report-dialog': ReportDialog, sidebar: Sidebar,
            'user-menu': UserMenu, 'recent-conversations': RecentConversations
        }
    })
    export default class ChatView extends Vue {
        l = l;
        sidebarExpanded = false;
        characterImage = characterImage;
        conversations = core.conversations;
        getStatusIcon = getStatusIcon;
        keydownListener!: (e: KeyboardEvent) => void;
        focusListener!: () => void;
        blurListener!: () => void;

        @Hook('mounted')
        mounted(): void {
            this.keydownListener = (e: KeyboardEvent) => this.onKeyDown(e);
            window.addEventListener('keydown', this.keydownListener);
            this.setFontSize(core.state.settings.fontSize);
            Sortable.create(<HTMLElement>this.$refs['privateConversations'], {
                animation: 50,
                fallbackTolerance: 5,
                onEnd: async(e) => {
                    if(e.oldIndex === e.newIndex) return;
                    return core.conversations.privateConversations[e.oldIndex!].sort(e.newIndex!);
                }
            });
            Sortable.create(<HTMLElement>this.$refs['channelConversations'], {
                animation: 50,
                fallbackTolerance: 5,
                onEnd: async(e) => {
                    if(e.oldIndex === e.newIndex) return;
                    return core.conversations.channelConversations[e.oldIndex!].sort(e.newIndex!);
                }
            });
            const ownCharacter = core.characters.ownCharacter;
            let idleTimer: number | undefined, idleStatus: Connection.ClientCommands['STA'] | undefined, lastUpdate = 0;
            window.addEventListener('focus', this.focusListener = () => {
                core.notifications.isInBackground = false;
                if(idleTimer !== undefined) {
                    clearTimeout(idleTimer);
                    idleTimer = undefined;
                }
                if(idleStatus !== undefined) {
                    const status = idleStatus;
                    window.setTimeout(() => core.connection.send('STA', status),
                        Math.max(lastUpdate + core.connection.vars.sta_flood * 1000 + 1000 - Date.now(), 0));
                    idleStatus = undefined;
                }
            });
            window.addEventListener('blur', this.blurListener = () => {
                core.notifications.isInBackground = true;
                if(idleTimer !== undefined) clearTimeout(idleTimer);
                if(core.state.settings.idleTimer > 0 && core.characters.ownCharacter.status !== 'dnd')
                    idleTimer = window.setTimeout(() => {
                        lastUpdate = Date.now();
                        idleStatus = {status: ownCharacter.status, statusmsg: ownCharacter.statusText};
                        core.connection.send('STA', {status: 'idle', statusmsg: ownCharacter.statusText});
                    }, core.state.settings.idleTimer * 60000);
            });
            core.connection.onEvent('closed', () => {
                if(idleTimer !== undefined) {
                    window.clearTimeout(idleTimer);
                    idleTimer = undefined;
                }
            });
            core.watch<number>(function(): number {
                return this.state.settings.fontSize;
            }, (value) => {
                this.setFontSize(value);
            });
        }

        @Hook('destroyed')
        destroyed(): void {
            window.removeEventListener('keydown', this.keydownListener);
            window.removeEventListener('focus', this.focusListener);
            window.removeEventListener('blur', this.blurListener);
        }

        needsReply(conversation: Conversation): boolean {
            if(!core.state.settings.showNeedsReply) return false;
            for(let i = conversation.messages.length - 1; i >= 0; --i) {
                const sender = (<Partial<Conversation.ChatMessage>>conversation.messages[i]).sender;
                if(sender !== undefined)
                    return sender !== core.characters.ownCharacter;
            }
            return false;
        }

        onKeyDown(e: KeyboardEvent): void {
            const selected = this.conversations.selectedConversation;
            const pms = this.conversations.privateConversations;
            const channels = this.conversations.channelConversations;
            const console = this.conversations.consoleTab;
            if(getKey(e) === Keys.ArrowUp && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey)
                if(selected === console) { //tslint:disable-line:curly
                    if(channels.length > 0) channels[channels.length - 1].show();
                    else if(pms.length > 0) pms[pms.length - 1].show();
                } else if(Conversation.isPrivate(selected)) {
                    const index = pms.indexOf(selected);
                    if(index === 0) console.show();
                    else pms[index - 1].show();
                } else {
                    const index = channels.indexOf(<Conversation.ChannelConversation>selected);
                    if(index === 0)
                        if(pms.length > 0) pms[pms.length - 1].show();
                        else console.show();
                    else channels[index - 1].show();
                }
            else if(getKey(e) === Keys.ArrowDown && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey)
                if(selected === console) { //tslint:disable-line:curly - false positive
                    if(pms.length > 0) pms[0].show();
                    else if(channels.length > 0) channels[0].show();
                } else if(Conversation.isPrivate(selected)) {
                    const index = pms.indexOf(selected);
                    if(index === pms.length - 1) {
                        if(channels.length > 0) channels[0].show();
                    } else pms[index + 1].show();
                } else {
                    const index = channels.indexOf(<Conversation.ChannelConversation>selected);
                    if(index < channels.length - 1) channels[index + 1].show();
                    else console.show();
                }
        }

        setFontSize(fontSize: number): void {
            let overrideEl = <HTMLStyleElement | null>document.getElementById('overrideFontSize');
            if(overrideEl !== null)
                document.body.removeChild(overrideEl);
            overrideEl = document.createElement('style');
            overrideEl.id = 'overrideFontSize';
            document.body.appendChild(overrideEl);
            const sheet = <CSSStyleSheet>overrideEl.sheet;
            sheet.insertRule(`#chatView, .btn, .form-control, .custom-select { font-size: ${fontSize}px; }`, sheet.cssRules.length);
            sheet.insertRule(`.form-control, select.form-control { line-height: 1.428571429 }`, sheet.cssRules.length);
        }

        logOut(): void {
            if(confirm(l('chat.confirmLeave'))) core.connection.close();
        }

        showSettings(): void {
            (<SettingsView>this.$refs['settingsDialog']).show();
        }

        showSearch(): void {
            (<CharacterSearch>this.$refs['searchDialog']).show();
        }

        showRecent(): void {
            (<RecentConversations>this.$refs['recentDialog']).show();
        }

        showChannels(): void {
            (<ChannelList>this.$refs['channelsDialog']).show();
        }

        showStatus(): void {
            (<StatusSwitcher>this.$refs['statusDialog']).show();
        }

        userMenuHandle(e: MouseEvent | TouchEvent): void {
            (<UserMenu>this.$refs['userMenu']).handleEvent(e);
        }

        get showAvatars(): boolean {
            return core.state.settings.showAvatars;
        }

        get ownCharacter(): Character {
            return core.characters.ownCharacter;
        }

        get ownCharacterLink(): string {
            return profileLink(core.characters.ownCharacter.name);
        }

        getClasses(conversation: Conversation): string {
            return conversation === core.conversations.selectedConversation ? ' active' : unreadClasses[conversation.unread];
        }
    }
</script>

<style lang="scss">
    @import "~bootstrap/scss/functions";
    @import "~bootstrap/scss/variables";
    @import "~bootstrap/scss/mixins/breakpoints";

    body {
        user-select: none;
    }

    .bbcode, .message, .profile-viewer {
        user-select: text;
    }

    .list-group.conversation-nav {
        margin-bottom: 10px;
        .list-group-item {
            padding: 5px;
            display: flex;
            align-items: center;
            border-right: 0;
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            .name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .fas {
                font-size: 16px;
                padding: 0 3px;
                &:last-child {
                    padding-right: 0;
                }
            }
            &.item-private {
                padding-left: 0;
                padding-top: 0;
                padding-bottom: 0;
            }
            img {
                height: 40px;
                margin: -1px 5px -1px -1px;
            }
            &:first-child img {
                border-top-left-radius: 4px;
            }
            &:last-child img {
                border-bottom-left-radius: 4px;
            }
        }

        .list-group-item-danger:not(.active) {
            color: inherit;
        }
    }

    #quick-switcher {
        margin: 0 45px 5px;
        overflow: auto;
        display: none;
        align-items: stretch;
        flex-direction: row;

        @media (max-width: breakpoint-max(sm)) {
            display: flex;
        }

        a {
            width: 40px;
            text-align: center;
            line-height: 1;
            padding: 5px 5px 0;
            overflow: hidden;
            flex-shrink: 0;
            &:first-child {
                border-radius: 4px 0 0 4px;
                &:last-child {
                    border-radius: 4px;
                }
            }
            &:last-child {
                border-radius: 0 4px 4px 0;
            }
        }

        img {
            width: 30px;
        }

        .name {
            overflow: hidden;
            white-space: nowrap;
        }

        .conversation-icon {
            font-size: 2em;
            height: 30px;
        }

        .list-group-item-danger:not(.active) {
            color: inherit;
        }
    }

    #sidebar {
        .body a.btn {
            padding: 2px 0;
            text-align: left;
        }
        @media (min-width: breakpoint-min(md)) {
            .sidebar {
                position: static;
                margin: 0;
                padding: 0;
                height: 100%;
            }

            .body {
                display: block;
            }

            .expander {
                display: none;
            }
        }
    }
</style>