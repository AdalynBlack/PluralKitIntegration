/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { ChannelStore, FluxDispatcher, Toasts } from "@webpack/common";
import { Message } from "discord-types/general";

import { Member, MemberGuildSettings, PKAPI, System, SystemGuildSettings } from "./pkapi.js/lib";


// I dont fully understand how to use datastores, if I used anything incorrectly please let me know
export const DATASTORE_KEY = "pk";
export let authors: Record<string, Author> = {};

export interface Author {
    messageIds: string[];
    member: Member;
    system: System;
    guildSettings: Map<string, MemberGuildSettings>;
    systemSettings: Map<string, SystemGuildSettings>;
}

export function isPk(msg: Message) {
    return (msg && msg.applicationId === "466378653216014359");
}

export function isOwnPkMessage(message: Message, localSystemData: string): boolean {
    if (!isPk(message)) return false;
    const localSystem: Author[] = JSON.parse(localSystemData);
    return localSystem.map(author => author.member.id).some(id => id === getAuthorOfMessage(message, new PKAPI()).member.id);
}

export function replaceTags(content: string, message: Message, localSystemData: string) {
    const author = getAuthorOfMessage(message, new PKAPI());
    const localSystem: Author[] = JSON.parse(localSystemData);

    const systemSettings: SystemGuildSettings = author.systemSettings[ChannelStore.getChannel(message.channel_id).guild_id];
    const memberSettings: MemberGuildSettings = author.guildSettings[ChannelStore.getChannel(message.channel_id).guild_id];
    const { system } = author;

    // prioritize guild settings, then system/member settings
    const { tag } = systemSettings??system;
    const name = memberSettings ? memberSettings.display_name : author.member.display_name??author.member.name;
    const avatar = memberSettings ? memberSettings.avatar_url : author.member.avatar;

    return content
        .replace(/{tag}/g, tag??"")
        .replace(/{name}/g, name??"")
        .replace(/{memberid}/g, author.member.id??"")
        .replace(/{pronouns}/g, author.member.pronouns??"")
        .replace(/{systemid}/g, author.system.id??"")
        .replace(/{systemname}/g, author.system.name??"")
        .replace(/{color}/g, author.member.color??"ffffff")
        .replace(/{avatar}/g, avatar??"")
        .replace(/{messagecount}/g, author.messageIds.length.toString()??"")
        .replace(/{systemmessagecount}/g, localSystem.map(author => author.messageIds.length).reduce((acc, val) => acc + val).toString());
}

export async function loadAuthors() {
    authors = await DataStore.get<Record<string, Author>>(DATASTORE_KEY) ?? {};
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
    // todo: fix
    FluxDispatcher.dispatch({
        type: "MESSAGE_REACTION_ADD",
        message: msg,
        emoji: { name: "❌" },
    });
    Toasts.show({
        message: "This needs to be fixed, use :x: to delete messages for now.",
        id: Toasts.genId(),
        type: Toasts.Type.FAILURE,
        options: {
            duration: 3000
        }
    });
}

export function generateAuthorData(message: Message) {
    return `${message.author.username}##${message.author.avatar}`;
}

export function getAuthorOfMessage(message: Message, pk: PKAPI) {
    const authorData = generateAuthorData(message);
    let author: Author = authors[authorData]??undefined;

    if (author) {
        author.messageIds.push(message.id);
        authors[authorData] = author;
        DataStore.set(DATASTORE_KEY, authors);
        return author;
    }

    pk.getMessage({ message: message.id }).then(msg => {
        author = ({ messageIds: [msg.id], member: msg.member as Member, system: msg.system as System, systemSettings: new Map(), guildSettings: new Map() });
        author.member.getGuildSettings(ChannelStore.getChannel(msg.channel).guild_id).then(guildSettings => {
            author.guildSettings?.set(ChannelStore.getChannel(msg.channel).guild_id, guildSettings);
        });

        author.system.getGuildSettings(ChannelStore.getChannel(msg.channel).guild_id).then(guildSettings => {
            author.systemSettings?.set(ChannelStore.getChannel(msg.channel).guild_id, guildSettings);
        });

        authors[authorData] = author;
        DataStore.set(DATASTORE_KEY, authors);
    });

    return authors[authorData];
}

