/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
BSD 2-Clause License

Copyright (c) 2021, Grey Himmel
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import API from "../index";
import Member from "./member";
import System from "./system";

const KEYS: any = {
    timestamp: {
        init: (t: Date | string) => new Date(t)
    },
    id: { },
    original: { },
    sender: { },
    channel: { },
    guild: { },
    system: {
        init: (s: Partial<System>, api: API) => s ? new System(api, s) : null
    },
    member: {
        init: (m: Partial<Member>, api: API) => m ? new Member(api, m) : null
    }
};

export interface IMessage {
    timestamp: Date | string;
    id: string;
    original?: string;
    sender: string;
    channel: string;
    guild: string;
    system?: string | System;
    member?: string | Member;
}

export default class Message implements IMessage {
    [key: string]: any;

    #api: API;

    timestamp: Date | string = "";
    id: string = "";
    original?: string;
    sender: string = "";
    channel: string = "";
    guild: string = "";
    system?: string | System;
    member?: string | Member;

    constructor(api: API, data: Partial<Message>) {
        this.#api = api;
        for(const k in data) {
            if(KEYS[k]) {
                if(KEYS[k].init) data[k] = KEYS[k].init(data[k], api);
                this[k] = data[k];
            }
        }
    }
}
