/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addDecoration } from "@api/MessageDecorations";
import { addPreEditListener } from "@api/MessageEvents";
import { addButton, removeButton } from "@api/MessagePopover";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { DeleteIcon, PencilIcon } from "@components/Icons";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import {
    Avatar,
    Button,
    ChannelStore,
    Menu,
    MessageActions,
    MessageStore, UserStore
} from "@webpack/common";
import { Message } from "discord-types/general";

import { PKAPI } from "./api";
import pluralKit from "./index";
import {
    Author,
    authors,
    deleteMessage,
    generateAuthorData,
    getAuthorOfMessage,
    isOwnPkMessage,
    isPk,
    loadAuthors, loadData,
    localSystem,
    replaceTags,
    getUserSystem,
} from "./utils";

function GetAuthorMenuItem(author: Author, message: Message) {
    if (!author.member) return null;
    return (
        <Menu.MenuItem
            id={"pk_menu_item_" + author.member.uuid}
            iconLeft={() =>
                (<Avatar className="pk-menu-icon" src={author.member?.avatar_url ?? author.system.avatar_url ?? "https://pluralkit.me/favicon.png"} size="SIZE_20"/>)
            }
            label={
                <div className="pk-menu-item">
                    <div className="pk-menu-item">{author.member.display_name}</div>
                </div>
            }
            action={() => {
                const { guild_id } = ChannelStore.getChannel(message.channel_id);
                MessageActions.sendMessage(message.channel_id, // Replace with pluralkit's channel ID once reproxying works in DMs: 1276796961227276338
                                           {content: "pk;reproxy https://discord.com/channels/" + guild_id + "/" + message.channel_id + "/" + message.id + " " + author.member?.name},
                                           false);
                }
            }
        />);
}

const ctxMenuPatch: NavContextMenuPatchCallback = (children, {message}) => {
    if (!isOwnPkMessage(message, pluralKit.api)) return;

    let editMenuSection = children.find(child => child.props?.children?.find(child => child?.props?.id == "reply"));

    // Place at the beginning of the second menu section
    editMenuSection?.props?.children?.splice?.(0, 0,
        <Menu.MenuItem
            id="pk-edit"
            icon={PencilIcon}
            label={
                <div className="edit">
                    <div className="edit">Edit Message</div>
                </div>
            }
            action={() => MessageActions.startEditMessage(message.channel_id, message.id, message.content)}
        />
    );

    let proxyMenuItems = localSystem.map(author => GetAuthorMenuItem(author, message));

    let reproxyMenuSection = children.find(child => child.props?.children?.find(child => child?.props?.id == "copy-link"));

    // Place right after the apps dropdown
    reproxyMenuSection.props.children.push(
        <Menu.MenuItem
            id="pk-reproxy"
            label={
                <div className="reproxy">
                    <div className="reproxy">Reproxy As...</div>
                </div>
            }
            listClassName="pk-reproxy-list"
            children={proxyMenuItems}
        />
    );

    let deleteMenuSection = children.find(child => child.props?.children?.find(child => child?.props?.id == "delete"));

    // Override the regular delete button if it's not present
    if (deleteMenuSection)
        return;

    deleteMenuSection.props.children.push(
        <Menu.MenuItem
            id="pk-delete"
            icon={DeleteIcon}
            color="danger"
            label={
                <div className="pk-delete">
                    <div className="pk-delete">Delete Message</div>
                </div>
            }
            action={() => deleteMessage(message)}
        />
    );
};

export const settings = definePluginSettings({
    colorNames: {
        type: OptionType.BOOLEAN,
        description: "Display member colors in their names in chat",
        default: true
    },
    pkIcon: {
        type: OptionType.BOOLEAN,
        description: "Enables a PluralKit icon next to proxied messages",
        default: false
    },
    displayOther: {
        type: OptionType.STRING,
        description: "How to display proxied users (from other systems) in chat\n" +
            "{tag}, {webhookName}, {name}, {memberId}, {pronouns}, {systemId}, {systemName}, {color}, {avatar}, are valid variables (All lowercase)",
        default: "{webhookName}",
    },
    displayLocal: {
        type: OptionType.STRING,
        description: "How to display proxied users (from your system, defaults to displayOther if blank) in chat\n" +
            "{tag}, {webhookName}, {name}, {memberId}, {pronouns}, {systemId}, {systemName}, {color}, {avatar}, are valid variables (All lowercase)",
        default: "{name}{tag}",
    },
    load: {
        type: OptionType.COMPONENT,
        component: () => {
            return <Button label={"Load"} onClick = {async () => {
                await loadData();
            }}>LOAD</Button>;
        },
        description: "Load local system into memory"
    },
    token: {
        type: OptionType.STRING,
        description: "Your PluralKit Token, required for many actions",
        default: ""
    },
    printData: {
        type: OptionType.COMPONENT,
        component: () => {
            return <Button onClick = {() => {
                console.log(settings.store.data);
            }}>Print Data</Button>;
        },
        description: "Print stored data to console",
        hidden: !IS_DEV // showDebug
    },
    data: {
        type: OptionType.STRING,
        description: "Datastore",
        default: "{}",
        hidden: !IS_DEV // showDebug
    }
});

export default definePlugin({
    name: "Plural Kit",
    description: "Pluralkit integration for Vencord",
    authors: [{
        name: "Scyye",
        id: 553652308295155723n
    }],
    startAt: StartAt.WebpackReady,
    settings,
    contextMenus: {
        "message": ctxMenuPatch
    },
    patches: [
        {
            find: "let{colorRoleId:",
            replacement: {
                match: /let{colorRoleId:/,
                replace: "e.nick=$self.modifyNick(e);$&"
            }
        },
        {
            find: "getCurrentUser(){",
            replacement: {
                match: / I\[d\.default\.getId\(\)\]/,
                replace: " $self.getCurrentUser($&)"
            }
        },
        {
            find: ".hasAvatarForGuild(null==",
            replacement: {
                match: /\i\.pronouns/,
                replace: "$self.tryGetPkPronouns()??$&"
            }
        },
        {
            find: ".hasAvatarForGuild(null==",
            replacement: {
                match: /return\(0/,
                replace: "if(t){t.bio=$self.tryGetPkBio();}$&"
            }
        },
        {
            find: "type:\"USER_PROFILE_MODAL_OPEN\"",
            replacement: {
                match: /let{userId:/,
                replace: "e.userId=$self.getUserPopoutMessageSender(e)?.id ?? e.userId;$&"
            }
        },
        {
            find: "getRelationshipType(t.id):",
            replacement: {
                match: /user:t/,
                replace: "t=$self.getUserPopoutMessageSender(e) ?? e.user"
            }
        },
        {
            find: "renderUserGuildPopout: channel should never be null",
            replacement: {
                match: /if/,
                replace: "$self.renderUserGuildPopout(t);$&"
            }
        },
        {
            find: '?"@":""',
            replacement: {
                match: /(?<=onContextMenu:\i,children:).*?\)}/,
                replace: "$self.renderUsername(arguments[0])}"
            }
        },
        // make up arrow to edit most recent message work
        // this might conflict with messageLogger, but to be honest, if you're
        // using that plugin, you'll have enough problems with pk already
        // Stolen directly from https://github.com/lynxize/vencord-plugins/blob/plugins/src/userplugins/pk4vc/index.tsx
        {
            find: "getLastEditableMessage",
            replacement: {
                match: /return (.)\(\)\(this.getMessages\((.)\).{10,100}:.\.id\)/,
                replace: "return $1()(this.getMessages($2).toArray()).reverse().find(msg => $self.isOwnMessage(msg)"
            }
        },
    ],

    getCurrentUser: (defaultUser) => {
        if (!localSystem?.length) return defaultUser;

        const fronters = getUserSystem(defaultUser.id, pluralKit.api)?.switch?.memebers?.[0];
        if (!fronters) return defaultUser;

        var filtered = localSystem.filter((author) => {return author.member?.id == fronters[0]});
        if (!filtered[0].member) return defaultUser;
        defaultUser.globalName = filtered[0].member?.display_name;
        return defaultUser;
    },

    getUserPopoutMessageSender: ({channelId, messageId, user}) => {
        if (user) {
            const authorData = generateAuthorData(user);

            if (authors[authorData])
                return userPopoutMessageSender;
        }

        if (channelId && messageId) {
            const author = getAuthorOfMessage(MessageStore.getMessage(channelId, messageId), pluralKit.api);

            if (author?.member)
                return userPopoutMessageSender;
        }

        return undefined;
    },

    renderUserGuildPopout: (message: Message) => {
        if (message == userPopoutMessage)
            return;

        userPopoutMessage = message;
        pluralKit.api.getMessage({ message: message.id }).then(msg => {
            const sender = msg.sender ?? message.author.id;
            userPopoutMessageSender = UserStore.getUser(sender);
        });
    },

    tryGetPkPronouns: () => {
        if (!isPk(userPopoutMessage))
            return null;

        const pkAuthor = getAuthorOfMessage(userPopoutMessage, pluralKit.api);

        if (pkAuthor?.member === undefined)
            return null;

        return pkAuthor.member.pronouns ?? pkAuthor.system.pronouns;
    },

    tryGetPkBio: () => {
        if (!isPk(userPopoutMessage))
            return "";

        const pkAuthor = getAuthorOfMessage(userPopoutMessage, pluralKit.api);

        if (pkAuthor?.member === undefined)
            return "";

        return pkAuthor.member.description ?? pkAuthor.system.description;
    },

    modifyNick: ({user, nick}) => {
        if (!user)
            return nick;

        const pkAuthor = getUserSystem(user.id, pluralKit.api);

        if (!pkAuthor)
            return nick;

        if (!pkAuthor.switches)
            return nick;

        const [messageSwitch] = pkAuthor.switches?.values();
        const member = messageSwitch?.members ? messageSwitch.members.values().toArray()[0] ?? pkAuthor.member : undefined;

        if (!member)
            return nick;

        nick = member.display_name ?? member.name;
        return nick;
    },

    isOwnMessage: (message: Message) => isOwnPkMessage(message, pluralKit.api) || message.author.id === UserStore.getCurrentUser().id,

    renderUsername: ({ author, decorations, message, isRepliedMessage, withMentionPrefix }) => {
        const prefix = isRepliedMessage && withMentionPrefix ? "@" : "";

        try {
            const discordUsername = author.nick ?? message.author.globalName ?? message.author.username;

            const userSystem = getUserSystem(message.author.id, pluralKit.api)
            if (!isPk(message) && !userSystem)
                return <>{prefix}{discordUsername}</>;

            // PK mesasage, disable bot tag
            if (decorations)
                decorations[0] = null;

            let username = userSystem ? discordUsername : message.author.username ?? author.nick ?? message.author.globalName;

            // U-FE0F is the Emoji variant selector. This converts pictographics to emoticons
            username = username.replace(/\p{Emoji}/ug, "$&\uFE0F");

            if (!settings.store.colorNames)
                return <>{prefix}{username}</>;

            const pkAuthor = userSystem ?? getAuthorOfMessage(message, pluralKit.api);

            // A PK message without an author. It's likely still loading
            if (!pkAuthor)
                return <span style={{color: '#555555'}}>{prefix}{username}</span>;

            if (pkAuthor.switches) {
                const [messageSwitch] = pkAuthor.switches?.values()?.filter((switchObj) => {return message.timestamp >= switchObj.timestamp});

                pkAuthor.member = messageSwitch?.members ? messageSwitch.members.values().toArray()[0] ?? pkAuthor.member : undefined;
            }

            // A PK message that contains an author but no member, meaning the member was likely deleted
            if (!pkAuthor.member) {
                // If this is a user system, don't apply the red coloration
                let style = !userSystem ? {color: '#9A2D22'} : undefined;
                return <span style={style}>{prefix}{username}</span>;
            }

            // A valid member exists, set the author to not be a bot so we can link back to the sender
            message.author.bot = false;

            let color: string = "888888";

            color = pkAuthor.member?.color ?? pkAuthor.system?.color ?? color;

            const isMe = isOwnPkMessage(message, pluralKit.api);

            const messageGuildID = ChannelStore.getChannel(message.channel)?.guild_id;
            if (isMe && messageGuildID && !userSystem) {
                author.member.getGuildSettings(messageGuildID).then(guildSettings => {
                    author.guildSettings.set(messageGuildID, guildSettings);
                });

                author.system.getGuildSettings(messageGuildID).then(systemSettings => {
                    author.systemSettings.set(messageGuildID, systemSettings);
                });
            }

            let display: string;

            if (userSystem)
                display = "{name} {tag}";
            else if (isMe && settings.store.displayLocal !== "")
                display = settings.store.displayLocal;
            else
                display = settings.store.displayOther;

            const resultText = replaceTags(display, message, discordUsername, pkAuthor);

            return <span style={{color: `#${color}`}}>{resultText}</span>;
        } catch (e) {
            console.error(e);
            return <>{prefix}{author?.nick}</>;
        }
    },

    api: new PKAPI({}),

    async start() {
        await loadData();
        if (settings.store.data === "{}") {
            await loadAuthors();
        }

        addDecoration("pk-proxied", props => {
            if (!settings.store.pkIcon)
                return null;
            if (!isPk(props.message))
                return null;
            return <ErrorBoundary noop>
                <img src="https://pluralkit.me/favicon.png" height="17" style={{
                    marginLeft: 4,
                    verticalAlign: "sub"
                }}/>
            </ErrorBoundary>;
        });

        addButton("pk-edit", msg => {
            if (!msg) return null;
            if (!isOwnPkMessage(msg, pluralKit.api)) return null;

            return {
                label: "Edit",
                icon: () => {
                    return <PencilIcon/>;
                },
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => MessageActions.startEditMessage(msg.channel_id, msg.id, msg.content),
                onContextMenu: _ => {}
            };
        });

        addButton("pk-delete", msg => {
            if (!msg) return null;
            if (!isOwnPkMessage(msg, pluralKit.api)) return null;
            if (!shiftKey) return null;

            return {
                label: "Delete",
                dangerous: true,
                icon: () => {
                    return <DeleteIcon/>;
                },
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => deleteMessage(msg),
                onContextMenu: _ => {}
            };
        });

        // Stolen directly from https://github.com/lynxize/vencord-plugins/blob/plugins/src/userplugins/pk4vc/index.tsx
        this.preEditListener = addPreEditListener((channelId, messageId, messageObj) => {
            if (isPk(MessageStore.getMessage(channelId, messageId))) {
                const { guild_id } = ChannelStore.getChannel(channelId);
                MessageActions.sendMessage("1276796961227276338", {
                        content: "pk;e https://discord.com/channels/" + guild_id + "/" + channelId + "/" + messageId + " " + messageObj.content},
                    false);
                //return { cancel: true };
            }
        });

        document.addEventListener("keydown", onKey);
        document.addEventListener("keyup", onKey);
    },
    stop() {
        removeButton("pk-edit");
        removeButton("pk-delete");
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("keyup", onKey);
    },
});

var shiftKey = false;
function onKey(e: KeyboardEvent) {
    shiftKey = e.shiftKey;
}

var userPopoutMessage: Message | null = null;
var userPopoutMessageSender: any = null;
