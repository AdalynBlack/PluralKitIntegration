/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { insertTextIntoChatInputBox } from "@utils/discord";
import { findByCode } from "@webpack";
import { ChannelStore, FluxDispatcher, UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

import { Switch, Member, MemberGuildSettings, PKAPI, System, SystemGuildSettings } from "./api";
import pluralKit, { settings } from "./index";
import { Author, State } from "./author";


// I dont fully understand how to use datastores, if I used anything incorrectly please let me know
export function isPk(msg: Message | null) {
    return (msg && msg.applicationId === "466378653216014359");
}

export function isOwnPkMessage(message: Message, pk: PKAPI): boolean {
    if (!isPk(message)) return false;
    if ([[], {}, undefined].includes(Author.localSystem)) return false;

    const authorMember = Author.getAuthorOfMessage(message).member;
    if (!authorMember?.id) return false;

    return (Author.localSystem??[]).map(author => author.member?.id).some(id => id === authorMember.id);
}

export function replaceTags(content: string, message: Message, webhookName: string, author: Author) {
    if (typeof(author.member) == "number")
        throw new TypeError("The member who wrote this message cannot be found! Were they deleted?");

    const messageGuildID = ChannelStore.getChannel(message.channel_id).guild_id;

    let systemSettings = typeof(author.systemSettings) == "number" ? undefined : author.systemSettings;
    let memberSettings = typeof(author.memberSettings) == "number" ? undefined : author.memberSettings;

    const system = typeof(author.system) == "number" ? undefined : author.system;

    // prioritize guild settings, then system/member settings
    const { tag } = systemSettings ?? system;

    const name = memberSettings?.display_name ?? author.member.display_name ?? author.member.name;
    const avatar = memberSettings?.avatar_url ?? author.member.avatar;

    return content
        .replace(/{tag}/g, tag??"")
        .replace(/{webhookName}/g, webhookName??"")
        .replace(/{name}/g, name??"")
        .replace(/{memberid}/g, author.member.id??"")
        .replace(/{pronouns}/g, author.member.pronouns??"")
        .replace(/{systemid}/g, author.system.id??"")
        .replace(/{systemname}/g, author.system.name??"")
        .replace(/{color}/g, author.member.color??"ffffff")
        .replace(/{avatar}/g, avatar??"");
}


export async function loadData() {
    const system = await pluralKit.api.getSystem({ system: UserStore.getCurrentUser().id });
    if (!system) {
        settings.store.data = "{}";
        return;
    }

    const localSystem: Author[] = [];

    console.log(system);

    (system.members??(await system.getMembers())).forEach((member: Member) => {
        localSystem.push({
            member,
            system,
            guildSettings: new Map(),
            systemSettings: new Map()
        });
    });

    settings.store.data = JSON.stringify(localSystem);

    await Author.loadAuthors();
}

export function replyToMessage(msg: Message, mention: boolean, hideMention: boolean, content?: string | undefined) {
    FluxDispatcher.dispatch({
        type: "CREATE_PENDING_REPLY",
        channel: ChannelStore.getChannel(msg.channel_id),
        message: msg,
        shouldMention: mention,
        showMentionToggle: !hideMention,
    });
    if (content) {
        insertTextIntoChatInputBox(content);
    }
}

export function deleteMessage(msg: Message) {
    const addReaction = findByCode(".userHasReactedWithEmoji");

    addReaction(msg.channel_id, msg.id, { name: "❌" });
}
