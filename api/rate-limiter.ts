/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Borrowed and modified from aishek's axios-rate-limit npm package
 * Modified to automatically work with common REST api rate limit headers
 */

function AxiosRateLimit (axios) {
	this.queue = [];

	this.interceptors = {
		request: null,
		response: null
	};

	this.handleRequest = this.handleRequest.bind(this);
	this.handleResponse = this.handleResponse.bind(this);

    this.rateLimitLimit = 2;
    this.rateLimitRemaining = 2;
    this.rateLimitReset = 0;
    this.rateLimitBurst = 10;

	this.enable(axios);
}

AxiosRateLimit.prototype.enable = function (axios) {
	function handleError (error) {
		return Promise.reject(error);
	}

	this.interceptors.request = axios.interceptors.request.use(
		this.handleRequest,
		handleError
	);

	this.interceptors.response = axios.interceptors.response.use(
		this.handleResponse,
		handleError
	);
}

/*
 * from axios library (dispatchRequest.js:11)
 * @param config
 */
function throwIfCancellationRequested (config) {
	if (config.cancelToken)
		config.cancelToken.throwIfRequested();
}

AxiosRateLimit.prototype.handleRequest = function (request) {
	return new Promise(function (resolve, reject) {
		this.push({
			/*
			 * rejects a cancelled request and returns request has been resolved or not
			 * @returns {boolean}
			 */
			resolve: function () {
				try {
					throwIfCancellationRequested(request);
				} catch (error) {
					reject(error);
					return false;
				}
				resolve(request);
				return true;
			}
		})
	}.bind(this));
}

AxiosRateLimit.prototype.handleResponse = function (response) {
    try {
        var rateLimitReset = (+response.headers['x-ratelimit-reset']) ?? this.rateLimitReset;

        // Only accept messages newer than the previous message
        if (rateLimitReset > this.rateLimitReset) {
            this.rateLimitReset = rateLimitReset;

            this.rateLimitLimit = +response.headers['x-ratelimit-limit'];

            // PluralKit does some weird math with the rate limit, so we have to undo it
            this.rateLimitRemaining = +response.headers['x-ratelimit-remaining'];
            this.rateLimitRemaining += (this.rateLimitBurst - this.rateLimitLimit);
        }
    } catch (e) {
        console.error(e);
    }

    return response;
}

AxiosRateLimit.prototype.push = function (requestHandler) {
	this.queue.push(requestHandler);
	this.shiftInitial();
}

AxiosRateLimit.prototype.shifting = false;

AxiosRateLimit.prototype.shiftInitial = function () {
    if (this.shifting)
        return;

    this.shifting = true;
	setTimeout(function () { return this.shift() }.bind(this), 0);
}

AxiosRateLimit.prototype.shift = function () {
    try {
        if (!this.queue.length) {
            this.shifting = false;
            return;
        }

        this.startTimeout();

        if (this.rateLimitRemaining <= 0) {
            this.shifting = false;
            return;
        }

        var queued = this.queue.shift();
        var resolved = queued.resolve();
        this.rateLimitRemaining -= 1;
    } catch (e) {
        console.error(e);
        this.shifting = false;
    }
}

AxiosRateLimit.prototype.startTimeout = function () {
    if (this.timeoutId?.ref?.())
        return

    if (this.timeoutId != undefined && this.timeoutId != null)
        return;

    const timeoutBase = 1000 / this.rateLimitLimit;
    const timeoutOffset = (timeoutBase / 30) * (this.rateLimitRemaining - (this.rateLimitBurst * 0.65));

    this.timeoutId = setTimeout(function () {
        this.timeoutId = null;

        this.rateLimitRemaining += 1;

        this.shift();

    }.bind(this), timeoutBase - timeoutOffset);
}

AxiosRateLimit.prototype.stopTimeout = function () {
    if (this.timeoutId?.unref?.())
        return;

    if (this.timeoutId == undefined || this.timeoutId == null)
        return;

    clearTimeout(this.timeoutId);
    this.timeoutId = null;
}

/**
 * Apply rate limit to axios instance.
 *
 * @example
 *	 import axios from 'axios';
 *	 import rateLimit from 'pk-axios-limiter';
 *
 *	 const http = rateLimit(axios.create()) // Assumes 2 messages per 1000 milliseconds until the API responds with overriding headers
 *   http.get('https://example.com/api/v1/users.json?page=1') // will perform immediately
 *	 http.get('https://example.com/api/v1/users.json?page=2') // will perform immediately
 *	 http.get('https://example.com/api/v1/users.json?page=3') // will perform EITHER after 1 second from the first message, OR sooner if the API responds with x-ratelimit-remaining and/or x-ratelimit-reset
 *
 * @param {Object} axios axios instance
 * @returns {Object} axios instance with interceptors added
 */
function axiosRateLimit (axios) {
	var rateLimitInstance = new AxiosRateLimit(axios);

	return axios;
}

module.exports = axiosRateLimit;
