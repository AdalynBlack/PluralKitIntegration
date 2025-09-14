/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

import { Switch, Member, MemberGuildSettings, PKAPI, System, SystemGuildSettings } from "./api";
import pluralKit, { savedTimestamp, settings } from "./index";


// I dont fully understand how to use datastores, if I used anything incorrectly please let me know
export const DATASTORE_KEY = "pk";
export let authors: Record<string, Author | null> = {};

export let localSystemNames: string[] = [];
export let localSystem: Author[] = [];

export const RELOAD_TIMEOUT = 60*1000;

export interface Author {
    discordID: string;
    guildSettings?: Map<string, MemberGuildSettings>;
    lastUpdated: number;
    member?: Member;
    system: System;
    systemSettings?: Map<string, SystemGuildSettings>;
    switches?: Map<Switch>;
}

export function isPk(msg: Message | null) {
    return (msg && msg.applicationId === "466378653216014359");
}

export function isOwnPkMessage(message: Message, pk: PKAPI): boolean {
    if (!isPk(message)) return false;
    if ([[], {}, undefined].includes(localSystem)) return false;

    const authorMemberID = getAuthorOfMessage(message, pk)?.member?.id;
    if (!authorMemberID) return false;

    return (localSystem??[]).map(author => author.member.id).some(id => id === authorMemberID);
}

export function replaceTags(content: string, message: Message, webhookName: string, author: Author) {
    if (!author?.member)
        throw new TypeError("The member who wrote this message cannot be found! Were they deleted?");

    const switchIter = author?.switches?.values();
    const messageSwitch = switchIter?.filter((switchObj) => {return savedTimestamp >= switchObj?.timestamp})?.next?.();
    const member = messageSwitch?.value?.members?.values?.()?.next?.()?.value;

    if (!member) return webhookName;

    const messageGuildID = ChannelStore.getChannel(message.channel_id).guild_id;

    var systemSettings = author.systemSettings?.[messageGuildID];

    var memberSettings = author.guildSettings?.[messageGuildID];

    const { system } = author;

    // prioritize guild settings, then system/member settings
    const { tag } = systemSettings ?? system;
    const name = memberSettings?.display_name ?? member.display_name ?? member.name;
    const avatar = memberSettings?.avatar_url ?? member.avatar;

    return content
        .replace(/{tag}/g, tag??"")
        .replace(/{webhookName}/g, webhookName??"")
        .replace(/{name}/g, name??"")
        .replace(/{memberid}/g, member.id??"")
        .replace(/{pronouns}/g, member.pronouns??"")
        .replace(/{systemid}/g, author.system.id??"")
        .replace(/{systemname}/g, author.system.name??"")
        .replace(/{color}/g, member.color??"ffffff")
        .replace(/{avatar}/g, avatar??"");
}

export async function loadAuthors() {
    authors = await DataStore.get<Record<string, Author>>(DATASTORE_KEY) ?? {};
    localSystem = JSON.parse(settings.store.data) ?? {};
    localSystemNames = localSystem.map(author => author.member?.display_name??author.member?.name ?? "");
}

export async function loadData() {
    const system = await pluralKit.api.getSystem({ system: UserStore.getCurrentUser().id });
    if (!system) {
        settings.store.data = "{}";
        return;
    }

    const localSystem: Author[] = [];

    (system.members??(await system.getMembers())).forEach((member: Member) => {
        localSystem.push({
            member,
            system,
            guildSettings: new Map(),
            systemSettings: new Map()
        });
    });

    settings.store.data = JSON.stringify(localSystem);

    await loadAuthors();
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

const addReaction = findByCodeLazy(".userHasReactedWithEmoji");
export function deleteMessage(msg: Message) {
    addReaction(msg.channel_id, msg.id, { name: "❌" });
}

export function generateAuthorData(discordAuthor) {
    return `${discordAuthor.username}##${discordAuthor.avatar}`;
}

export function getAuthorOfMessage(message: Message, pk: PKAPI) {
    const authorData = generateAuthorData(message.author);
    let author = authors[authorData] ?? undefined;

    if (author?.lastUpdated === null || Date.now() <= (author?.lastUpdated ?? 0) + RELOAD_TIMEOUT)
        return author;

    if (author)
        author.lastUpdated = Date.now();

    pk.getMessage({ message: message.id }).then(msg => {
        if (!author)
            author = {system: msg.system as System, lastUpdated: Date.now()};
        author.discordID = msg.sender
        author.member = msg.member as Member;
        author.system = msg.system as System;
        author.systemSettings = new Map();
        author.guildSettings = new Map();

        authors[authorData] = author;
        DataStore.set(DATASTORE_KEY, authors);
    });

    authors[authorData] = authors[authorData] ?? null;

    return author;
}

export function getUserSystem(discAuthor: string, pk: PKAPI) {
    let author = authors["@"+discAuthor];

    if (author === null || Date.now() <= (author?.lastUpdated ?? 0) + RELOAD_TIMEOUT)
        return author;

    if (author)
        author.lastUpdated = Date.now();

    try {
        pk.getSystem({system: discAuthor}).then(system => {
            if (!system?.id) return;

            if (!author)
                author = {system: system, lastUpdated: Date.now()};
            else {
                author.system = system;
            }
            author.discordID = discAuthor;

            authors["@"+discAuthor] = author;

            pluralKit.api.getSwitches({system: system.id}).then((switchObj) => {
                if (!switchObj) return;
                if (!author) return;

                author.switches = switchObj;

                const [latestSwitch] = switchObj.values();

                if (latestSwitch?.members) {
                    const [primaryFronter] = latestSwitch.members.values();
                    author.member = primaryFronter;
                }

                authors["@"+discAuthor] = author;
            });
        });
    } catch(e) {
        console.error(e)
        return author;
    }

    authors["@"+discAuthor] = authors["@"+discAuthor] ?? null;

    return author;
}

export function getUsernameStyle(color1: string | undefined, color2: string | undefined) {
    color2 ??= color1 ?? "var(--text-danger)";
    color1 ??= color2;

    // Gradient styling to be revisited later. Requires wrapping emojis in span tags so they aren't affected by the color gradient
    //const style = {background: `linear-gradient(in oklab 60deg, ${color1} 40%, ${color2} 80%)`, backgroundClip: "text", color: "transparent"};

    const style = {color: color1};
    return style;
}
