import { DataStore } from "@api/index";
import pluralKit, { settings } from "./index";

export interface IAuthor {
    member?: Member;
    system: System;
    memberSettings?: Map<string, MemberGuildSettings>;
    systemSettings?: Map<string, SystemGuildSettings>;
    switches?: Map<Switch>;
    lastUpdated: number;
}

export enum State {
    READY,
    UPDATING,
    UNOBTAINABLE,
    NONE,
}

export interface SynchronizedData<T> {
    timestamp: Date;
    data: T;
    state: State;
}

export function toState(check) {
    return check ? State.READY : State.NONE;
}

const PK_AUTHOR_KEY = "pkAuthors";
const SYSTEM_RELOAD_TIMEOUT = 5 * 60 * 1000;
const MEMBER_RELOAD_TIMEOUT = 60 * 1000;
const SWITCHES_RELOAD_TIMEOUT = 60 * 1000;

export class Author {
    private _member: SynchronizedData<Member>;
    private _system: SynchronizedData<System>;
    private _memberSettings: SynchronizedData<Map<string, MemberGuildSettings>>;
    private _systemSettings: SynchronizedData<Map<string, SystemGuildSettings>>;
    private _switches: SynchronizedData<Map<Switch>>;

    public static authors: Author[] = [];
    public static localSystemNames: string[] = [];
    public static localSystem: Author[] = [];

    constructor(authorData: Partial<IAuthor>) {
        this._system = {timestamp: new Date(), data: authorData?.system, state: toState(authorData?.system)};
        this._member = {timestamp: new Date(), data: authorData?.member, state: toState(authorData?.member)};
        this._memberSettings = {timestamp: new Date(), data: authorData?.memberSettings, state: toState(authorData?.memberSettings)};
        this._systemSettings = {timestamp: new Date(), data: authorData?.systemSettings, state: toState(authorData?.systemSettings)};
        this._switches = {timestamp: new Date(), data: authorData?.switches, state: toState(authorData?.switches)};
    }

    public get system() {
        return isValid(this._system) ? this._system.data : this._system.state;
    }

    public set system(newData) {
        if (typeof(newData) == "number") {
            this._system.state = newData;
            return;
        }

        this._system.data = newData;
        this._system.state = newData ? State.READY : State.UNOBTAINABLE;
        this._system.timestamp = new Date();
    }

    public get member() {
        return isValid(this._member) ? this._member.data : this._member.state;
    }

    public set member(newData) {
        if (typeof(newData) == "number") {
            this._member.state = newData;
            return;
        }

        this._member.data = newData;
        this._member.state = newData ? State.READY : State.UNOBTAINABLE;
        this._member.timestamp = new Date();
    }

    public get memberSettings() {
        return isValid(this._memberSettings) ? this._memberSettings.data : this._memberSettings.state;
    }

    public set memberSettings(newData) {
        if (typeof(newData) == "number") {
            this._memberSettings.state = newData;
            return;
        }

        this._memberSettings.data = newData;
        this._memberSettings.state = newData ? State.READY : State.UNOBTAINABLE;
        this._memberSettings.timestamp = new Date();
    }

    public get systemSettings() {
        return isValid(this._systemSettings) ? this._systemSettings.data : this._systemSettings.state;
    }

    public set systemSettings(newData) {
        if (typeof(newData) == "number") {
            this._systemSettings.state = newData;
            return;
        }

        this._systemSettings.data = newData;
        this._systemSettings.state = newData ? State.READY : State.UNOBTAINABLE;
        this._systemSettings.timestamp = new Date();
    }

    public get switches() {
        return isValid(this._switches) ? this._switches.data : this._switches.state;
    }

    public set switches(newData) {
        if (typeof(newData) == "number") {
            this._switches.state = newData;
            return;
        }

        this._switches.data = newData;
        this._switches.state = newData ? State.READY : State.UNOBTAINABLE;
        this._switches.timestamp = new Date();
    }

    public static generateAuthorData(user: User) {
        return `${user.username}##${user.avatar}`;
    }

    public static getAuthorOfMessage(message: Message) {
        const authorData = Author.generateAuthorData(message.author);
        let author = Author.authors[authorData];

        if (!author)
            author = new Author({});

        if (!(shouldUpdateValue(author._member, MEMBER_RELOAD_TIMEOUT) || shouldUpdateValue(author._system, SYSTEM_RELOAD_TIMEOUT)))
            return author;

        author.member = State.UPDATING;
        author.system = State.UPDATING;

        pluralKit.api.getMessage({ message: message.id }).then(msg => {
            author.member = msg.member as Member;
            author.system = msg.system as System;
        }).catch(e => {
            console.error(e);

            author.member = State.UNOBTAINABLE;
            author.system = State.UNOBTAINABLE;
        }).finally(() => {
            Author.syncAuthor(author, authorData);
        });

        Author.syncAuthor(author, authorData);

        return author;
    }

    public static syncAuthor(author: Author, authorData: string) {
        Author.authors[authorData] = author;
        DataStore.set(PK_AUTHOR_KEY, Author.authors);
    }

    public static getAuthorFromUser(user: User) {
        const authorData = Author.generateAuthorData(user);
        let author = Author.authors[authorData];

        if (!author)
            author = new Author({});

        if (shouldUpdateValue(author._system, SYSTEM_RELOAD_TIMEOUT)) {
            author.system = State.UPDATING;

            pluralKit.api.getSystem({system: user.id}).then(system => {
                author.system = system;
            }).catch(e => {
                console.error(e);

                author.system = State.UNOBTAINABLE;
            }).finally(() => {
                Author.syncAuthor(author, authorData);
            });
        }

        if (author._system.data?.id && (shouldUpdateValue(author._switches, SWITCHES_RELOAD_TIMEOUT) || shouldUpdateValue(author._member, MEMBER_RELOAD_TIMEOUT))) {
            author.member = State.UPDATING;
            author.switches = State.UPDATING;

            pluralKit.api.getSwitches({system: author._system.data?.id}).then(switchObj => {
                author.switches = switchObj

                if (!isValid(author._switches)) {
                    author.member.state = State.UNOBTAINABLE;
                    return;
                }

                const [latestSwitch] = switchObj.values();
                const [primaryFronter] = latestSwitch?.members?.values?.() ?? [];

                author.member = primaryFronter
            }).catch(e => {
                console.error(e);

                author.switches = State.UNOBTAINABLE;
                author.member = State.UNOBTAINABLE;
            }).finally(() => {
                Author.syncAuthor(author, authorData);
            });
        }

        Author.syncAuthor(author, authorData);

        return author;
    }

    public static async loadAuthors() {
        Author.authors = await DataStore.get<Record<string, Author>>(PK_AUTHOR_KEY) ?? [];
        Author.localSystem = JSON.parse(settings.store.data) ?? [];
        Author.localSystemNames = Author.localSystem.map(author => author.member?.display_name??author.member?.name ?? "");
    }
}

function hasTimeExpired(synchronizedData: SynchronizedData<any>, offset: number) {
    return Date.now() > synchronizedData.timestamp.valueOf() + offset;
}

function shouldUpdateValue(synchronizedData?: SynchronizedData<any>, offset: number) {
    if (!synchronizedData)
        return true;

    if (synchronizedData.state == State.UPDATING)
        return false;

    if (synchronizedData.state == State.NONE)
        return true;

    return hasTimeExpired(synchronizedData, offset);
}

function isValid(synchronizedData: SynchronizedData<any>) {
    return synchronizedData.data && (synchronizedData.state == State.READY || synchronizedData.state == State.UPDATING);
}
