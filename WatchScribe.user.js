// ==UserScript==
// @name         WatchScribe
// @version      0.17.1
// @description  A userscript to help generate regexes for SmokeDetector's watchlist feature. To be used in conjunction with FIRE.
// @author       lyxal
// @homepage     https://github.com/lyxal/WatchScribe
// @updateURL    https://github.com/lyxal/WatchScribe/raw/main/WatchScribe.user.js
// @downloadURL  https://github.com/lyxal/WatchScribe/raw/main/WatchScribe.user.js
// @match       *://chat.stackexchange.com/transcript/*
// @match       *://chat.meta.stackexchange.com/transcript/*
// @match       *://chat.stackoverflow.com/transcript/*
// @match       *://chat.stackexchange.com/rooms/11540/*
// @match       *://chat.meta.stackexchange.com/rooms/*
// @match       *://chat.stackoverflow.com/rooms/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    const charcoalHq = 11540;
    const COMMAND_TYPES = {
        "watch": "watch",
        "blacklist": "blacklist",
    };


    const LINK_CHAIN_INDICATOR = "​🔗​"; // The link indicator to use in the chat

    var commandType = COMMAND_TYPES.watch;
    var silent = true;
    var caseInsensitive = false;
    var regexSendingOverride = false;

    const LETTERING_ORDER = "123456789abcdefghijklmnopqrstuvwxyz,./[]\\;'`";

    const DONT_ACTUALLY_SEND_THIS_IS_DEBUG_MODE_FLAG = false;

    class SentMessage {
        // A generated command + has this been edit-actedupon yet
        /**
         * 
         * @param {GeneratedCommand} command 
         * @param {boolean} edited 
         */
        constructor(command, edited = false) {
            this.command = command;
            this.edited = edited;
        }
    }

    /** @type {Object<string, SentMessage>} */
    var sentMessages = {};

    const COMMAND_SUBTYPES = {
        url: "website",
        text: "keyword",
        number: "number",
        username: "username"
    }

    const isValidURL = (url) => { try { new URL(url); return true; } catch (e) { return false; } };


    class WatchedURL {
        /**
         * Represents a watched URL.
         * @param {string} SLD - The second-level domain (e.g. "example" in "example.com").
         * @param {string} TLD - The top-level domain (e.g. "com" in "example.com").
         * @param {string} fullURL - The full URL (e.g. "https://example.com").
         */
        constructor(SLD, TLD, fullURL) {
            this.SLD = SLD;
            this.TLD = TLD;
            this.fullURL = fullURL;
        }
    }
    /** @type {WatchedURL[]} */
    var watchedURLs = [];

    class GeneratedCommand {
        /**
         * @param {string} regex 
         * @param {COMMAND_SUBTYPES} originalType 
         * @param {string} description A description of the command, e.g. "Auto-generated regex for a URL"
         */
        constructor(regex, originalType, description = "") {
            this.regex = regex;
            this.originalType = originalType; // "url", "text", or "number"
            this.description = description;
            this.mode = commandType;
        }
    }

    /**
     * Send a message to chat
     * @param {string} message The message to send
     * @returns {Promise<number>} The ID of the sent message
     */
    async function sendMessage(message) {

        if (DONT_ACTUALLY_SEND_THIS_IS_DEBUG_MODE_FLAG) {
            alert(`Debug mode is enabled. Not sending message: ${message}`);
            // Return a randomly generated message ID
            return Math.floor(Math.random() * 1000000);
        }

        // Retrieve the fkey element
        const fkeyEl = document.querySelector('input[name="fkey"]');
        const fkey = fkeyEl && fkeyEl.value;

        if (!fkey) {
            alert("No fkey found!");
            return;
        }

        // Borrowed from FIRE Extra Functions
        // https://github.com/userscripters/fire-extra-functionality/blob/5e0c65f15dc993bf1d85d6c12c3416ef04501dd1/src/chat.ts#L32

        const params = new FormData();
        params.append('text', message);
        params.append('fkey', fkey);

        const url = `/chats/${charcoalHq}/messages/new`;
        const call = await fetch(url, {
            method: 'POST',
            body: params
        });

        const response = await call.json();

        if (call.status !== 200 || !call.ok) {
            toastr.error('Failed to send message to chat.');
        } else {
            toastr.success('Successfully sent message to chat.');
        }

        return response.id;
    }

    /**
     * Generate potentially multiple regexes for a given URL
     * @param {string} url 
     * @returns {GeneratedCommand[]} Regexes for the URL
     */
    function generateForURL(url) {
        let regexes = [];
        let usedURL = url;

        // URL objects get funny if the URL doesn't start with a protocol
        // so add https if it doesn't start with http. Note that it doesn't
        // actually matter whether the original URL is http or https.

        if (!url.startsWith("http")) {
            usedURL = "https://" + url;
        }

        // Create a URL object and extract the hostname
        if (!isValidURL(usedURL)) {
            return generateForText(usedURL.replace(/https:\/\/(www\.)?/, ""), "Invalid URL, so try URL as text");
        }
        const urlObj = new URL(usedURL);
        let host = urlObj.hostname;

        // Strip the www. if it's there at the start of the URL.
        // We don't want to be watching the www. part. That'd be silly.
        if (host.startsWith("www.")) {
            host = host.slice(4);
        }

        let [hostname, ...tld] = host.split('.');


        // tld will now be an array of the TLD parts, e.g. ["com", "uk", "co"]
        // Subsequent parts of the TLD after the first need to be joined with `(?:\\.${tld})`
        // This is because the TLD can be multiple parts, e.g. "co.uk" or "com.au"

        let [mainTLD, ...subTLD] = tld;
        // If there are sub-TLDs, join them with a dot
        tldFull = tld.join("\\.");
        subTLD = subTLD.reduce((acc, part) => {
            part = part.replace(/([()[{*+.$^|?\\])/g, '\\$1').toLowerCase();
            return acc + `(?:\\.${part})?`;
        }, '')

        tldDivided = mainTLD + (subTLD ? subTLD : "");

        // Escape special regex characters in the hostname and TLDs
        hostname = hostname.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase();
        tldFull = tldFull.replace(/([()[{*+$^|?])/g, '\\$1').toLowerCase();
        // Remove any trailing /s because sometimes URLs have those
        // and that's annoying. We don't want to watch those.

        while (tldFull.endsWith("/")) { // Basically a trim function at home
            tldFull = tldFull.slice(0, -1);
        }

        while (tldDivided.endsWith("/")) { // Same here
            tldDivided = tldDivided.slice(0, -1);
        }

        // Push a regex for the full domain, escaping the "."
        regexes.push(new GeneratedCommand(`${hostname}\\.${tldFull}`, COMMAND_SUBTYPES.url, "Normal URL Regex"));
        regexes.push(new GeneratedCommand(`${hostname}\\.${tldDivided}`, COMMAND_SUBTYPES.url, "URL Regex with Subsequent TLDs Optional"));

        // Push the hostname without the TLD, using a negative lookahead
        regexes.push(new GeneratedCommand(`${hostname}(?!\\.${tldFull})`, COMMAND_SUBTYPES.url, "Hostname without TLD (Full)"));
        regexes.push(new GeneratedCommand(`${hostname}(?!\\.${tldDivided})`, COMMAND_SUBTYPES.url, "Hostname without TLD (Divided)"));

        watchedURLs.push(new WatchedURL(hostname, `\\.${tldFull}`, `${hostname}\\.${tldFull}`));

        return regexes;
    }

    /**
     * Generate a regex for arbitrary text. Lowercases and inserts checks for arbitrary spaces/non-word characters
     * @param {string} text The text to generate a regex for
     * @returns {GeneratedCommand[]} Possible regexes for the text
     */
    function generateForText(text, description = undefined) {
        let regexes = [];
        // Replace spaces with non-word gaps
        let words = text.split(/ +/);
        let symbolWords = text.split(/\W+/);
        let defaultRegex = "";

        let makeSafe = (str) => str.replace(/([()[{*+.$^\\|?\]])/g, '\\$1');

        if (words.length > 1) {
            for (let word of words.slice(1)) {
                let sigil = /\W/.test(word[0]);
                defaultRegex += `[\\W_]*${sigil ? "" : "+"}${makeSafe(word.toLowerCase())}`;
            }
            defaultRegex = `${makeSafe(words[0].toLowerCase())}${defaultRegex}`;
        } else {
            defaultRegex = makeSafe(words[0].toLowerCase());
        }

        let symbolConsumingRegex = "";
        if (symbolWords.length > 1) {
            for (let word of symbolWords.slice(1)) {
                if (word.length !== 0) {
                    // Only add the symbol consuming regex if there are characters left after removing non-word characters
                    symbolConsumingRegex += `[\\W_]*+${makeSafe(word.toLowerCase())}`;
                }
            }
            symbolConsumingRegex = `${makeSafe(symbolWords[0].toLowerCase())}${symbolConsumingRegex}`;
        } else {
            symbolConsumingRegex = makeSafe(symbolWords[0].toLowerCase()); // Remove all non-word characters
        }



        if (caseInsensitive) {
            // If case-insensitive mode is enabled, add a case-insensitive version
            regexes.push(new GeneratedCommand(`(?-i:${makeSafe(text).trim().replaceAll(".", "\\.").replaceAll(" ", "[\\W_]*+")})`, COMMAND_SUBTYPES.text, description));

        } else {
            // Otherwise, just use the default regex
            regexes.push(new GeneratedCommand(defaultRegex, COMMAND_SUBTYPES.text, description));
            if (symbolConsumingRegex !== defaultRegex) {
                regexes.push(new GeneratedCommand(symbolConsumingRegex, COMMAND_SUBTYPES.text, "Symbol Consuming Text Regex"));
            }
        }

        for (let regex of regexes.slice()) {
            let r = "\\b" + regex.regex.replace(/\[\\W_]\*\+/g, "[\\W_]*") + "\\b";
            if (!r.includes("[\\W_]")) { continue; }
            let matchedURLs = watchedURLs.filter(url => new RegExp(r).test(url.SLD));
            for (let matchedURL of matchedURLs) {
                regexes.push(new GeneratedCommand(`${regex.regex}(?!${matchedURL.TLD}(?<=${matchedURL.fullURL}))`, COMMAND_SUBTYPES.text, "Text Matching Hostname Where Text Needs to be Broken Up"));
            }
        }


        return regexes;
    }

    // Homoglpyh to number mapping, taken directly from the SmokeDetector codebase

    const equivalents = {
        "0": [0x4f, 0x6f, 0xd8, 0x39f, 0x3bf, 0x3c3, 0x41e, 0x43e, 0x555, 0x585, 0x5e1, 0x647, 0x665, 0x6be, 0x6c1, 0x6d5,
            0x6f5, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb20, 0xb66, 0xbe6, 0xc02, 0xc66, 0xc82, 0xce6, 0xd02, 0xd20,
            0xd66, 0xd82, 0xe50, 0xed0, 0x101d, 0x1040, 0x10ff, 0x12d0, 0x1d0f, 0x1d11, 0x2134, 0x2c9e, 0x2c9f,
            0x2d54, 0x3007, 0xa4f3, 0xab3d, 0xfba6, 0xfba7, 0xfba8, 0xfba9, 0xfbaa, 0xfbab, 0xfbac, 0xfbad, 0xfee9,
            0xfeea, 0xfeeb, 0xfeec, 0xff10, 0xff2f, 0xff4f, 0x10292, 0x102ab, 0x10404, 0x1042c, 0x104c2, 0x104ea,
            0x10516, 0x114d0, 0x118b5, 0x118c8, 0x118d7, 0x118e0, 0x1d40e, 0x1d428, 0x1d442, 0x1d45c, 0x1d476,
            0x1d490, 0x1d4aa, 0x1d4de, 0x1d4f8, 0x1d512, 0x1d52c, 0x1d546, 0x1d560, 0x1d57a, 0x1d594, 0x1d5ae,
            0x1d5c8, 0x1d5e2, 0x1d5fc, 0x1d616, 0x1d630, 0x1d64a, 0x1d664, 0x1d67e, 0x1d698, 0x1d6b6, 0x1d6d0,
            0x1d6d4, 0x1d6f0, 0x1d70a, 0x1d70e, 0x1d72a, 0x1d744, 0x1d748, 0x1d764, 0x1d77e, 0x1d782, 0x1d79e,
            0x1d7b8, 0x1d7bc, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, 0x1ee24, 0x1ee64, 0x1ee84, 0x1fbf0,
            0x2298, 0x24ea, 0x24ff, 0x1f100, 0x1f10b, 0x1f10c, 0x104a0, 0x110f0, 0x11136, 0x1e950, 0x2205],
        "1": [0x49, 0x6c, 0x7c, 0x196, 0x1c0, 0x399, 0x406, 0x4c0, 0x5c0, 0x5d5, 0x5df, 0x627, 0x661, 0x6f1, 0x7ca,
            0x16c1, 0x2110, 0x2111, 0x2113, 0x2160, 0x217c, 0x2223, 0x23fd, 0x2c92, 0x2d4f, 0xa4f2, 0xfe8d, 0xfe8e,
            0xff11, 0xff29, 0xff4c, 0xffe8, 0x1028a, 0x10309, 0x10320, 0x16f28, 0x1d408, 0x1d425, 0x1d43c, 0x1d459,
            0x1d470, 0x1d48d, 0x1d4c1, 0x1d4d8, 0x1d4f5, 0x1d529, 0x1d540, 0x1d55d, 0x1d574, 0x1d591, 0x1d5a8,
            0x1d5c5, 0x1d5dc, 0x1d5f9, 0x1d610, 0x1d62d, 0x1d644, 0x1d661, 0x1d678, 0x1d695, 0x1d6b0, 0x1d6ea,
            0x1d724, 0x1d75e, 0x1d798, 0x1d7cf, 0x1d7d9, 0x1d7e3, 0x1d7ed, 0x1d7f7, 0x1e8c7, 0x1ee00, 0x1ee80,
            0x1fbf1, 0xb9, 0x215f, 0x2160, 0x2170, 0x217c, 0x1e951, 0x1e952],
        "2": [0x1a7, 0x3e8, 0x3e9, 0x14bf, 0xa644, 0xa6ef, 0xa75a, 0xff12, 0x1d7d0, 0x1d7da, 0x1d7e4, 0x1d7ee, 0x1d7f8,
            0x1fbf2, 0x577, 0xb2],
        "3": [0x1b7, 0x21c, 0x417, 0x4e0, 0xae9, 0x15f1, 0x2ccc, 0xa76a, 0xa7ab, 0xff13, 0x118ca, 0x16f3b, 0x1d206, 0x1d7d1,
            0x1d7db, 0x1d7e5, 0x1d7ef, 0x1d7f9, 0x1fbf3, 0x1d08, 0x1d1f, 0x1d23, 0x1d32, 0x1d94, 0x1d9a, 0x1dbe,
            0x4de, 0x4df, 0x4e0, 0x4e1, 0x4ec, 0x4ed, 0x498, 0x499, 0x417, 0x3f6, 0xb3],
        "4": [0xaeb, 0x13ce, 0x96b, 0xff14, 0x118af, 0x1d7d2, 0x1d7dc, 0x1d7e6, 0x1d7f0, 0x1d7fa, 0x1fbf4, 0xa78d, 0x4b6,
            0x4b7, 0x4cb, 0x4cc],
        "5": [0x1bc, 0xff15, 0x118bb, 0x1d7d3, 0x1d7dd, 0x1d7e7, 0x1d7f1, 0x1d7fb, 0x1fbf5, 0x405, 'S'],
        "6": [0x3ec, 0x3ed, 0x431, 0x13ee, 0x2cd2, 0xff16, 0x118d5, 0x1d7d4, 0x1d7de, 0x1d7e8, 0x1d7f2, 0x1d7fc, 0x1fbf6],
        "7": [0xff17, 0x104d2, 0x118c6, 0x1d212, 0x1d7d5, 0x1d7df, 0x1d7e9, 0x1d7f3, 0x1d7fd, 0x1fbf7],
        "8": [0x222, 0x223, 0x9ea, 0xa6a, 0xb03, 0x0b6b, 0xff18, 0x1031a, 0x1d7d6, 0x1d7e0, 0x1d7ea, 0x1d7f4, 0x1d7fe,
            0x1e8cb, 0x1fbf8],
        "9": [0x9ed, 0xa67, 0xaed, 0xb68, 0xd6d, 0x1564, 0x2cca, 0xa76e, 0xff19, 0x118ac, 0x118cc, 0x118d6, 0x1d7d7,
            0x1d7e1, 0x1d7eb, 0x1d7f5, 0x1d7ff, 0x1fbf9, 0x1113d],
        "03": [0x2189],
        "11": [0x2161, 0x2171],
        "12": [0xbd],
        "13": [0x2153],
        "14": [0xbc],
        "15": [0x2155],
        "16": [0x2159],
        "17": [0x2150],
        "18": [0x215b],
        "19": [0x2151],
        "23": [0x2154],
        "25": [0x2156],
        "34": [0xbe],
        "35": [0x2157],
        "38": [0x215c],
        "45": [0x2158],
        "56": [0x215a],
        "58": [0x215d],
        "78": [0x215e],
        "110": [0x2152],
        "111": [0x2162, 0x2172],
    };

    // (number_start, number_end, number_increment, code_point_start, code_point_increment)
    const sequences = [
        [1, 20, 1, 0x2460, 1],
        [21, 35, 1, 0x3251, 1],
        [36, 50, 1, 0x32B1, 1],
        [1, 10, 1, 0x2780, 1],
        [1, 20, 1, 0x2474, 1],
        [1, 20, 1, 0x2488, 1],
        [11, 20, 1, 0x24EB, 1],
        [1, 10, 1, 0x24F5, 1],
        [10, 80, 10, 0x3248, 1],
        [1, 10, 1, 0x3280, 1],
        [0, 9, 1, 0x2070, 1],
        [0, 9, 1, 0x2080, 1],
        [1, 10, 1, 0x2776, 1],
        [1, 10, 1, 0x278A, 1],
        [0, 9, 1, 0x1F101, 1],
    ];

    const translateTable = {};

    for (const into of Object.keys(equivalents)) {
        const from = equivalents[into];
        for (const codePoint of from) {
            translateTable[codePoint] = into;
        }
    }

    for (const [start, end, increment, codePointStart, codePointIncrement] of sequences) {
        for (let i = start; i <= end; i += increment) {
            const codePoint = codePointStart + (i - start) * codePointIncrement;
            translateTable[codePoint] = i.toString();
        }
    }

    /**
     * Normalises a number by converting it to a string and looking it up in the translation table
     * @param {string} number 
     * @returns {string} The normalised number as a string
     */
    function normaliseNumber(number) {
        // Convert the number to a string
        const str = number.toString();

        // If the string is empty, return it as is
        if (str === "") {
            return str;
        }

        // Create a new string to hold the normalised number
        let normalised = "";

        // Iterate over each character in the string
        for (const char of str) {
            // Get the code point of the character
            const codePoint = char.codePointAt(0);

            // If the code point is in the translation table, append the corresponding value
            if (codePoint in translateTable) {
                normalised += translateTable[codePoint];
            } else {
                normalised += char; // If not found, keep the original character
            }
        }

        return normalised;
    }


    /**
     * Generate a list of possible commands for a phone number. 
     * Phone number watching uses
     * a different checking format than regexes.
     * @param {string} number The phone number to generate a command for
     * @returns {GeneratedCommand[]} Possible commands for the phone number
     */
    function generateForNumber(number) {
        const normalised = normaliseNumber(number);
        const justNumbers = normalised.replace(/[^\d]/g, ""); // Remove all non-digit characters

        const regexes = [];

        if (justNumbers.length == 10) {
            // 10 digits, so add an option for it to be a non-american number
            regexes.push(new GeneratedCommand(`${justNumbers}(?#NO NorAm)`, COMMAND_SUBTYPES.number, "10 Digit Phone Number, Assumed to NOT be North American"));
            // As well as the normal 10 digit number
            regexes.push(new GeneratedCommand(`+1-${justNumbers}(?#IS NorAm)`, COMMAND_SUBTYPES.number, "10 Digit Phone Number, Assumed to be North American"));
        }

        // 11 digit numbers starting with a 0 can be written
        // without the 0, making it look like it could be a NANP
        // number. Therefore, add an option for the short version
        // but add the context back via No NorAm.
        if (justNumbers.startsWith("0") && justNumbers.length == 11) {
            regexes.push(new GeneratedCommand(`${justNumbers.slice(1)}(?#NO NorAm)`, COMMAND_SUBTYPES.number, "11 Digit Phone Number, Assumed to NOT be North American"));
        }

        // 12 digit numbers starting with 91 have the same problem.
        // This is what happens when convenience is prioritised over consistency.
        // Not that convenience is a bad thing to design around, but come on.
        // consistency please.

        if (justNumbers.startsWith("91") && justNumbers.length == 12) {
            regexes.push(new GeneratedCommand(`${justNumbers.slice(2)}(?#NO NorAm)`, COMMAND_SUBTYPES.number, "12 Digit Phone Number, Assumed to NOT be North American"));
        }

        regexes.push(new GeneratedCommand(`${justNumbers}`, COMMAND_SUBTYPES.number, "Default Phone Number Command"));


        return regexes;

    }

    /**
     * Genereate an array of regexes for a given input. Determines the kind
     * of regex to generate based on the input. Basically the brains of the operation.
     * @param {string} input A string to generate regexes for
     * @returns {string[]} An array of regexes for the input
     */
    function generateFor(input) {
        const numberedInput = input.replace(/[()\[\]{}\- ]/g, "");
        const isAllNumbers = (txt) => [...txt].every(char => /\p{Number}/u.test(char));
        // Check whether the input is something that looks like a URL
        if (/^[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+$/.test(input) && !isAllNumbers(input.replaceAll(".", "")) && isValidURL(input)) {
            return generateForURL(input);
        }
        // Perhaps it's a phone number?
        // Determined as 50% or more numerical characters
        // as defined as being in \p{Number} in Unicode.
        // after having removed brackets, dashes, and spaces.
        else if ([...numberedInput].filter(char => /\p{Number}/u.test(char)).length >= [...numberedInput].length / 2) {
            return generateForNumber(input); // Wrapped in a list for consistency with URL generation
        }
        // Otherwise, it's normal text
        else {
            return generateForText(input);
        }
    }

    /**
     * Add a watch command to the list of commands that can be sent to chat
     * @param {HTMLElement} forList The HTML element to append the command to
     * @param {GeneratedCommand} message The message to append
     */
    // Updated createListItem function with mobile-responsive button layout
    function createListItem(forList, message) {
        // Add prefix if needed
        let command = commandFrom(commandType, message.regex, message.originalType, silent);

        // Create list item wrapper
        const listItem = document.createElement('li');
        listItem.className = 'ws-list-item';
        listItem.setAttribute('data-type', message.originalType);
        listItem.setAttribute('data-mode', commandType);
        listItem.setAttribute('data-silent', silent ? 'true' : 'false');
        listItem.setAttribute('data-regex', message.regex);

        // Description container
        const descriptionContainer = document.createElement('div');
        descriptionContainer.className = 'ws-description-container';
        descriptionContainer.style.cssText = `
        display: inline-block;
        margin-bottom: 0px;
        padding: 4px 8px;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        font-size: 11px;
        color: #666;
        position: relative;
        z-index: 1;
        width: 100%;
        box-sizing: border-box;
        word-break: break-word;
    `;

        const descriptionText = document.createElement('span');
        descriptionText.className = 'ws-description-text';
        descriptionText.textContent = message.description || 'Auto-generated regex';
        descriptionContainer.appendChild(descriptionText);

        // Inner container for the existing content
        const itemHTML = document.createElement('div');
        itemHTML.className = 'ws-list-content';
        itemHTML.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 0.25em;
        background: #f5f5f5;
        border: 1px solid #ddd;
        padding: 0.5em;
        border-radius: 0 8px 8px 8px;
        font-size: 0.8em;
        box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
        flex-wrap: wrap;
        box-sizing: border-box;
    `;

        // Regex display
        const regexHTML = document.createElement('code');
        regexHTML.textContent = command;
        regexHTML.className = 'ws-code';
        regexHTML.style.cssText = `
        font-family: monospace;
        background: #e8e8e8;
        padding: 4px 6px;
        border-radius: 4px;
        color: #333;
        word-break: break-all;
        overflow-wrap: anywhere;
        flex: 1;
        min-width: 0;
        margin-right: 0.5em;
        margin-bottom: 1em;
        overflow-x: auto;
        font-size: 1em;
        line-height: 1.3;
    `;

        // Editable input (hidden by default)
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.value = command;
        editInput.className = 'ws-edit-input';
        editInput.style.display = 'none';
        editInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        // Create button group container for better mobile layout
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'ws-button-group';
        buttonGroup.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 0.25em;
        width: 100%;
    `;

        // Helper function to create buttons with consistent styling
        const createButton = (text, className, clickHandler, extraStyles = '') => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = className;
            button.style.cssText = `
            flex-shrink: 0;
            margin: 0 1px;
            padding: 3px 6px;
            font-size: 1em;
            border-radius: 3px;
            min-width: auto;
            border: none;
            cursor: pointer;
            ${extraStyles}
        `;
            button.addEventListener('click', clickHandler);
            return button;
        };

        // Send button
        const sendButton = createButton("Send to Chat", 'ws-send-button', async () => {
            const commandToSend = commandFrom(listItem.getAttribute('data-mode'), listItem.getAttribute('data-regex'), listItem.getAttribute('data-type'), listItem.getAttribute('data-silent') === 'true');
            let messageId = await sendMessage(commandToSend);
            sentMessages[messageId] = new SentMessage(message, false);
            sendButton.style.display = "none";
        }, 'background-color: #28a745; color: white; flex: 1; min-width: 50px;');

        // Edit button
        const editButton = createButton("✏️", 'ws-edit-button', () => {
            const editing = editInput.style.display === 'flex' || editInput.style.display === 'block';
            if (editing) {
                // Save logic here (same as original)
                command = editInput.value;
                if (!/!!\/(watch(-number)?|blacklist-(keyword|number|website|username))-? .+/.test(command)) {
                    alert("Invalid style of command");
                    return;
                }
                listItem.setAttribute('data-command', command);
                regexHTML.textContent = command;
                regexHTML.style.display = 'block';
                editInput.style.display = 'none';
                editButton.textContent = "✏️";
                sendButton.style.display = "flex";

                // Update attributes logic (same as original)
                const newParts = command.split(' ')[0].split('/')[1].split('-');
                const newMode = newParts[0];
                const newType = newParts[1] || 'text';
                const newSilent = newParts.length == 3;
                const newRegex = command.split(' ').slice(1).join(' ');



                listItem.setAttribute('data-mode', newMode);
                if (newMode === COMMAND_TYPES.blacklist) {
                    watchifyButton.textContent = "👀ify";
                    listItem.setAttribute('data-type', newType);
                } else {
                    watchifyButton.textContent = "⬛ify";
                }
                listItem.setAttribute('data-silent', newSilent ? 'true' : 'false');
                listItem.setAttribute('data-regex', newRegex);
            } else {
                // Begin editing
                editInput.value = command;
                editInput.style.display = 'block';
                regexHTML.style.display = 'none';
                sendButton.style.display = "none";
                editButton.textContent = "✔️";
            }
        }, 'background-color: #ffc107; color: black; title: "Edit this regex";');

        // Anchor button
        const anchorButton = createButton("⛓️", 'ws-anchor-button', () => {
            let regex = listItem.getAttribute('data-regex') || regexHTML.textContent;
            if (regex.startsWith("^") && regex.endsWith("$")) {
                regex = regex.slice(1, -1);
            } else {
                regex = `^${regex}$`;
            }
            let command = commandFrom(listItem.getAttribute('data-mode'), regex, listItem.getAttribute('data-type'), listItem.getAttribute('data-silent') === 'true');
            listItem.setAttribute('data-command', command);
            listItem.setAttribute('data-regex', regex);
            regexHTML.textContent = command;
        }, 'background: #007bff; color: white; title: "Anchor this regex";');

        // Hide anchor button for number commands
        if (command.split(' ')[0].includes("number")) {
            anchorButton.style.display = 'none';
        }

        // Watchify/Blacklistify button
        const WATCHIFY_TEXT = "👀ify";
        const BLACKLISTIFY_TEXT = "⬛ify";

        const watchifyButton = createButton(
            listItem.getAttribute('data-mode') === COMMAND_TYPES.watch ? BLACKLISTIFY_TEXT : WATCHIFY_TEXT,
            'ws-watchify-button',
            () => {
                let myCommandType = listItem.getAttribute('data-mode') || COMMAND_TYPES.watch;
                myCommandType = myCommandType === COMMAND_TYPES.watch ? COMMAND_TYPES.blacklist : COMMAND_TYPES.watch;
                listItem.setAttribute('data-mode', myCommandType);
                watchifyButton.textContent = myCommandType === COMMAND_TYPES.watch ? BLACKLISTIFY_TEXT : WATCHIFY_TEXT;
                regexHTML.textContent = commandFrom(myCommandType, listItem.getAttribute('data-regex'), listItem.getAttribute('data-type'), listItem.getAttribute('data-silent') === 'true');
            },
            'background: #6a0563; color: white; title: "Toggle between Watch and Blacklist commands";'
        );

        // Remove button
        const removeButton = createButton("🗑️", 'ws-remove-button', () => {
            listItem.remove();
        }, 'background: #aa2222; color: white; title: "Remove this regex";');

        // Assemble the item
        itemHTML.appendChild(regexHTML);
        itemHTML.appendChild(editInput);

        // Add buttons to button group
        buttonGroup.appendChild(sendButton);
        buttonGroup.appendChild(editButton);
        buttonGroup.appendChild(anchorButton);
        buttonGroup.appendChild(watchifyButton);
        buttonGroup.appendChild(removeButton);

        itemHTML.appendChild(buttonGroup);

        listItem.appendChild(descriptionContainer);
        listItem.appendChild(itemHTML);
        forList.appendChild(listItem);

        return [listItem, () => {
            let myCommandType = listItem.getAttribute('data-mode') || COMMAND_TYPES.watch;
            myCommandType = myCommandType === COMMAND_TYPES.watch ? COMMAND_TYPES.blacklist : COMMAND_TYPES.watch;
            listItem.setAttribute('data-mode', myCommandType);
            watchifyButton.textContent = myCommandType === COMMAND_TYPES.watch ? BLACKLISTIFY_TEXT : WATCHIFY_TEXT;
            regexHTML.textContent = commandFrom(myCommandType, listItem.getAttribute('data-regex'), listItem.getAttribute('data-type'), listItem.getAttribute('data-silent') === 'true');
        }];
    }

    function commandFrom(mode, regex, type, silent) {
        if (type === COMMAND_SUBTYPES.number) {
            return `!!/${mode}-${type}${silent ? "-" : ""} ${regex}`;
        } else if (mode === COMMAND_TYPES.watch) {
            return `!!/${mode}${silent ? "-" : ""} ${regex}`;
        } else {
            return `!!/${mode}-${type}${silent ? "-" : ""} ${regex}`;
        }
    }

    function commandFromListItem(listItem) {
        const mode = listItem.getAttribute('data-mode') || COMMAND_TYPES.watch;
        const regex = listItem.getAttribute('data-regex');
        const type = listItem.getAttribute('data-type');
        const silent = listItem.getAttribute('data-silent') === 'true';

        return commandFrom(mode, regex, type, silent);
    }

    function commandObjectFromListItem(listItem) {
        const mode = listItem.getAttribute('data-mode') || COMMAND_TYPES.watch;
        const regex = listItem.getAttribute('data-regex');
        const type = listItem.getAttribute('data-type');
        const silent = listItem.getAttribute('data-silent') === 'true';

        return new GeneratedCommand(mode, regex, type, silent);
    }

    /**
     * @param {string[]} linkParts
     * @returns {boolean} Whether the text could be an ID
     */
    function couldContainID(linkParts) {
        // Don't bother checking if it's only the domain and no path
        if (linkParts.length === 1) { return false; }

        if (linkParts.length === 2) {
            // If the link has only two parts, IDs are probably:
            // 1. A number (e.g. "12345")
            // 2. A hash-like string _if_ the domain is short enough

            return /^[0-9]+$/.test(linkParts[1]) || (linkParts[1].length <= 15 && /[a-zA-Z0-9_-]{4,15}/.test(linkParts[1]));
        }

        if (linkParts.length > 2) {
            return /[a-zA-Z0-9_-]{6,12}/.test(linkParts[linkParts.length - 1])
        }

    }


    /**
     * Generate all regexes for selected text, and render them as list items
     * @param {HTMLElement} list The list element to append the regexes to
     * @returns {HTMLElement[]} An array of list items containing the generated regexes
     */
    function generateRegexes(list) {

        let regexes = [];

        // Get both selected text _and_ selected element
        // This is so that you can select a link and auto-watch both url and anchor text
        let selectedElement = window.getSelection().focusNode ? window.getSelection().focusNode.parentElement : null;


        let selectedText = window.getSelection().toString().trim();
        if (selectedElement && selectedElement.querySelector('a[link-indicator="true"]')) {
            selectedText = selectedText.replace(LINK_CHAIN_INDICATOR, "")
        }

        if (selectedText === "") {
            alert("No text selected!");
            return;
        }

        // First, "normalise" the selected object if it's a <sup> with the "link-indicator" attribute
        // present and set to "true". If it is, retrieve the span from two levels up

        if (selectedElement && selectedElement.tagName === 'SUP' && selectedElement.hasAttribute('link-indicator') && selectedElement.getAttribute('link-indicator') === 'true') {
            // Get the parent element two levels up
            const parentElement = selectedElement.parentElement.parentElement;
            // Check if the parent element is a span with the "watchscribe-link" class
            if (parentElement.tagName === 'SPAN' && parentElement.classList.contains('watchscribe-link')) {
                // Set the selected element to the parent element
                selectedElement = parentElement.cloneNode(true); // Clone the element to avoid modifying the original
            } else {
                // If not, set it to null so we don't try to process it as a link
                selectedElement = null;
            }
        }

        let link = selectedElement && selectedElement.querySelector('a[link-indicator="true"]');

        if (link) {
            const clone = selectedElement.cloneNode(true); // clone the full element
            const cloneLink = clone.querySelector('a[link-indicator="true"]');
            if (cloneLink) cloneLink.remove();
            selectedElement = clone; // Use the cloned element without the link
        }



        console.log("Selected element:", selectedElement);
        console.log("Selected text:", selectedText);

        /*
        * If the selected element is an anchor tag (which will have been converted to a span),
        * it can have extra information that we can use to generate regexes.
        * 
        * Therefore, a regex will be generated for:
        * 
        * 1. (If the link text isn't like a URL) The link text
        * 2. The link url
        * 3. (If the link text matches the URL) The link text with a negative lookahead for the TLD
        * 4. (If the selected text isn't the entire link text) The selected text
        */

        if (selectedElement && selectedElement.tagName === 'SPAN' && selectedElement.classList.contains('watchscribe-link')) {
            const url = selectedElement.getAttribute("data-href");
            const text = selectedElement.innerText;
            const linkTextRegexes = generateForText(text, "Displayed Link Text");
            const textRegexes = linkTextRegexes.slice(); // Copy the link text regexes to modify them
            textRegexes.push(...generateForText(selectedText, "Selected Link Text")); // Add the selected text regexes as well

            const linkComponents = url.split("/");

            // Automatic ID detection
            if (couldContainID(linkComponents.slice(2))) {
                // Special case for wrapping potential IDs in a regex with a comment indicating
                // it's an ID from a site.
                const regexSafeID = linkComponents[linkComponents.length - 1].replace(/([()[{*+.$^\\|?])/g, '\\$1'); // Escape special regex characters
                textRegexes.push(new GeneratedCommand(`(?-i:${regexSafeID})(?# ${linkComponents[2]})`, COMMAND_SUBTYPES.text, "Potential ID from URL (Auto-detected)"));
            }

            // More manual ID detection
            if (url === text && linkComponents[linkComponents.length - 1].includes(selectedText) && !selectedText.includes("/")) {
                // Typically, if you're specifically selecting the end of a URL, it's going to be an ID
                const regexSafeID = selectedText.replace(/([()[{*+.$^\\|?])/g, '\\$1'); // Escape special regex characters
                textRegexes.push(new GeneratedCommand(`(?-i:${regexSafeID})(?# ${linkComponents[2]})`, COMMAND_SUBTYPES.text, "Potential ID from URL"));
            }

            // Regexes for the anchor text IF it's not a URL
            if (!/[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+/.test(selectedText)) {
                regexes = regexes.concat(textRegexes);
            }

            // Regexes for the URL
            const urlRegexes = generateForURL(url);
            regexes = regexes.concat(urlRegexes);
            // Generate a lookbehind variant if any link text regex matches the SLD

            if (isValidURL(url)) {
                let TLD = new URL(url).hostname.split('.').slice(1);
                TLD = "\\." + TLD.join('.').replace(/([()[{*+.$^\\|?])/g, '\\$1'); // Escape special regex characters

                for (let regex of linkTextRegexes) {
                    let r = "\\b" + regex.regex.replace(/\[\\W_]\*\+/g, "[\\W_]*") + "\\b";
                    if (new RegExp(r).test(url)) {
                        regexes.push(new GeneratedCommand(`${regex.regex}(?!${TLD}(?<=${urlRegexes[0].regex}))`, COMMAND_SUBTYPES.url, "Link Text with Lookbehind for SLD"));
                    }
                }
            }

        } else if (selectedElement && selectedElement.tagName === 'A' && selectedElement.classList.contains('fire-user-name')) {
            // If the selected element is a link to a user, generate a regex for the username
            const username = selectedElement.innerText.trim();
            let originalCaseInsensitive = caseInsensitive;
            caseInsensitive = true; // Always case-insensitive for usernames
            const usernameRegexes = generateForText(username, "Username Text");
            caseInsensitive = originalCaseInsensitive; // Reset case-insensitive flag
            regexes = regexes.concat(usernameRegexes);

        } else {
            regexes = generateFor(selectedText);
        }

        console.log("Before deduplication, regexes:", regexes);
        regexes = uniqueBy(regexes, r => r.regex);
        console.log("Generated regexes:", regexes);

        const madeItems = [];
        for (let regex of regexes) {
            const made = createListItem(list, regex);
            madeItems.push(made);
        }

        return madeItems;
    }

    // Helper function to uniquify a list
    function uniqueBy(list, keyFn) {
        const seen = new Set();
        return list.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }


    /**
     * Show send shortcuts for the given list element.
     * @param {HTMLElement} list 
     */
    function showSendShortcuts(list) {
        // If a user has more regexes than letters in LETTERING_ORDER, then I think
        // there's a good chance that user is doing something just a little
        // bit wrong.

        let letterIndex = 0;

        for (let i = 0; i < list.children.length; i++) {
            const item = list.children[i];
            if (item.tagName.toLowerCase() === 'li') {
                if (item.querySelector('.ws-send-shortcut')) {
                    // If the item already has a send shortcut, remove it
                    item.querySelector('.ws-send-shortcut').remove();
                }
                // Create a new send shortcut
                const sendShortcut = document.createElement('span');
                sendShortcut.className = 'ws-send-shortcut';
                sendShortcut.innerHTML = `<kbd>${LETTERING_ORDER[letterIndex]}</kbd>`;

                // Don't show the shortcut if the item has already been sent
                if (item.querySelector('.ws-send-button').style.display === 'none') {
                    sendShortcut.style.display = 'none';
                }

                // Insert this shortcut at the start of the item
                item.querySelector('.ws-list-content').insertAdjacentElement('afterbegin', sendShortcut);

                letterIndex++;
            }
        }

    }

    function hideSendShortcuts(list) {
        for (let i = 0; i < list.children.length; i++) {
            const item = list.children[i];
            if (item.tagName.toLowerCase() === 'li') {
                const sendShortcut = item.querySelector('.ws-send-shortcut');
                if (sendShortcut) {
                    sendShortcut.remove();
                }
            }
        }
    }


    //== HTML elements ==//


    let widgetHTML = `
<div id="watchscribe-widget-%" class="watchscribe-widget" style="padding: 1em; margin: 1em; background: #fdfdfd; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); font-family: sans-serif; z-index: 300; max-width: 100%; box-sizing: border-box;">
  <div id="watchscribe-header-%" class="watchscribe-header" style="font-weight: bold; font-size: 1.2em; margin-bottom: 1em; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1em;">
    <h3 style="margin: 0; flex: 1; min-width: 120px;" id="watchscribe-title-%" class="watchscribe-title">WatchScribe</h3>

    <div class="toggle-container-%" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
      <span id="labelOff-%" class="toggle-label active">Watch</span>
      <div class="toggle-switch">
        <div class="toggle-slider" id="toggleBtn-%"></div>
      </div>
      <span id="labelOn-%" class="toggle-label">Blacklist</span>
    </div>
  </div>

  <div id="watchscribe-toggle-silent-%" class="watchscribe-toggle-silent" style="margin-bottom: 1em;">
    <label class="toggle-container">
      <input type="checkbox" id="watchscribe-silent-%" checked>
      <span class="checkbox-slider"></span>
      <span class="toggle-label" id="labelSilent-%">Silent (!!/command-)</span>
    </label>
  </div>

  <p style="margin-top: 0.5em; font-size: 0.9em; line-height: 1.4;">Select some text, then click the button below to generate possible watch/blacklist regex(es).</p>

  <div style="margin-bottom: 1em; display: flex; flex-wrap: wrap; gap: 0.5em;" id="watchscribe-button-container-%" class="watchscribe-button-container">
    <button id="watchscribe-button-%" class="ws-button">Generate Regex</button>
    <button id="watchscribe-clear-%" class="ws-button">Clear List</button>
    <button id="watchscribe-send-%" class="ws-button">Send All Regexes To Chat</button>
  </div>

  <div id="watchscribe-sending-mode-%" class="watchscribe-sending-mode" style="
    display: none;
    margin-bottom: 1em;
    background-color: #f0f4ff;
    border-left: 4px solid #4a90e2;
    padding: 1em;
    border-radius: 6px;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    ">
    <strong style="display: block; font-size: 1rem; color: #2c3e50;">
        Regex sending mode is currently activated. Press <kbd style="background: #e1e4e8; padding: 2px 6px; border-radius: 3px; border: 1px solid #ccc;">]</kbd> to toggle it off.
    </strong>
    <em style="display: block; margin-top: 0.5em; color: #555;">
        No other FIRE keybindings will work while this is active, except 
        <kbd style="background: #e1e4e8; padding: 2px 6px; border-radius: 3px; border: 1px solid #ccc;">esc</kbd>.
    </em>
  </div>

  <div class="watchscribe-input-container" style="display: flex; gap: 0.5em; margin-bottom: 1em; flex-wrap: wrap;">
    <input type="text" id="watchscribe-regex-%" class="watchscribe-regex-input" placeholder="Enter text here" style="flex-grow: 1; padding: 0.6em; border-radius: 4px; border: 1px solid #ccc; font-size: 0.9em; min-width: 0; box-sizing: border-box;">
    <button id="watchscribe-add-%" class="ws-button" style="flex: none; min-width: auto; padding: 0.6em 12px;">(+)</button>
    <button id="watchscribe-send-as-is-%" class="ws-button" style="flex: none; min-width: auto; white-space: nowrap;">Prefix + Send</button>
  </div>

  <ul id="watchscribe-regexes-%" class="watchscribe-regexes" style="padding-left: 0; list-style-type: none; margin: 0;"></ul>

  <a id="watchscribe-version-%" class="watchscribe-version" href="https://github.com/lyxal/WatchScribe/raw/refs/heads/main/WatchScribe.user.js" target="_blank" title="Userscript version" style="
      font-size: 0.75em;
      color: #beedab;
      margin-top: 6px;
      padding-top: 2px;
      line-height: 1.2;
      transition: color 0.2s ease;
      display: block;
    ">
      v<span id="watchscribe-version-number-%">?</span>
    </a>

    <button id="watchscribe-debug-sent-messages-%">Debug Sent Messages</button>
</div>
`;

    let customCSS = `
    /* Mobile Responsive CSS for WatchScribe */
<style>
/* Base responsive styles */
[id^="watchscribe-widget-"] {
  padding: 1em;
  margin: 1em;
  background: #fdfdfd;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  font-family: sans-serif;
  z-index: 300;
  max-width: 100%;
  box-sizing: border-box;
}

/* Header responsive layout */
[id^="watchscribe-header-"] {
  font-weight: bold;
  font-size: 1.2em;
  margin-bottom: 1em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1em;
}

[id^="watchscribe-title-"] {
  margin: 0;
  flex: 1;
  min-width: 120px;
}

/* Toggle layout responsive */
[class^="toggle-container-"] {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Label styles */
.toggle-label {
  transition: font-weight 0.3s ease, color 0.3s ease;
  font-weight: normal;
  color: gray;
  white-space: nowrap;
}

.toggle-label.active {
  font-weight: bold;
  color: #333;
}

/* Custom toggle switch */
.toggle-switch {
  width: 50px;
  height: 24px;
  background-color: #ccc;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-slider {
  width: 22px;
  height: 22px;
  background-color: white;
  border-radius: 50%;
  position: absolute;
  top: 1px;
  left: 1px;
  transition: transform 0.3s ease;
}

.toggle-slider.on {
  transform: translateX(26px);
}

/* Silent toggle checkbox style */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  flex-wrap: wrap;
}

.toggle-container input[type="checkbox"] {
  display: none;
}

.checkbox-slider {
  display: inline-block;
  width: 40px;
  height: 20px;
  background-color: #ccc;
  border-radius: 10px;
  position: relative;
  vertical-align: middle;
  margin-right: 6px;
  flex-shrink: 0;
}

.checkbox-slider::before {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  top: 2px;
  left: 2px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.toggle-container input[type="checkbox"]:checked + .checkbox-slider::before {
  transform: translateX(20px);
}

.toggle-container input[type="checkbox"]:checked + .checkbox-slider {
  background-color: #4caf50;
}

/* Button container responsive */
[id^="watchscribe-button-container-"] {
  margin-bottom: 1em;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}

/* Button styling responsive */
.ws-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.3s ease;
  white-space: nowrap;
  flex: 1;
  min-width: 100px;
}

.ws-button:hover {
  background-color: #0056b3;
}

/* Input field responsive */
[id^="watchscribe-regex-"] {
  flex-grow: 1;
  padding: 0.6em;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1em;
  min-width: 0;
  box-sizing: border-box;
}

/* Input container responsive - target div containing the input and buttons */
.watchscribe-input-container {
  display: flex !important;
  gap: 0.5em !important;
  margin-bottom: 1em !important;
  flex-wrap: wrap !important;
}

/* List item responsive */
.ws-list-item {
  margin-bottom: 0.5em;
  list-style-type: none;
}

.ws-description-container {
  display: inline-block;
  margin-bottom: 0px;
  padding: 4px 8px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  font-size: 11px;
  color: #666;
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

.ws-list-content {
  display: flex;
  align-items: flex-start;
  gap: 0.25em;
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 0.5em;
  border-radius: 0 8px 8px 8px;
  font-size: 1em;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
  flex-wrap: wrap;
  box-sizing: border-box;
}

.ws-code {
  font-family: monospace;
  background: #e8e8e8;
  padding: 4px 6px;
  border-radius: 4px;
  color: #333;
  word-break: break-all;
  overflow-wrap: anywhere;
  flex: 1;
  min-width: 0;
  margin-right: 0.5em;
  overflow-x: auto;
  font-size: 1em;
  line-height: 1.3;
}

/* Button group for list items */
.ws-list-content > button {
  flex-shrink: 0;
  margin: 0 1px;
  padding: 3px 6px;
  font-size: 1em;
  border-radius: 3px;
  min-width: auto;
}

.ws-send-button {
  background-color: #28a745;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.ws-send-button:hover {
  background-color: #218838;
}

.ws-edit-button {
  background-color: #ffc107;
  color: black;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.ws-edit-button:hover {
  background-color: #e0a800;
}

.ws-edit-input {
  font-family: monospace;
  font-size: 1em;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #aaa;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  box-sizing: border-box;
}

.ws-remove-button {
  background: #aa2222;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.ws-remove-button:hover {
  background: #cc0000;
}

.ws-anchor-button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.ws-anchor-button:hover {
  background: #0056b3;
}

.ws-watchify-button {
  background: #6a0563;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.ws-watchify-button:hover {
  background: #8b0a7c;
}

.ws-send-shortcut {
  margin-right: 0.5em;
  flex-shrink: 0;
}

.ws-send-shortcut kbd {
  background: #e1e4e8;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
  font-size: 1em;
}

/* Mobile specific styles */
@media (max-width: 768px) {
  [id^="watchscribe-widget-"] {
    margin: 0.5em;
    padding: 0.75em;
    font-size: 0.9em;
  }

  [id^="watchscribe-header-"] {
    font-size: 1.1em;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5em;
  }

  [id^="watchscribe-title-"] {
    align-self: center;
  }

  [class^="toggle-container-"] {
    align-self: center;
  }

  [id^="watchscribe-button-container-"] {
    flex-direction: column;
  }

  .ws-button {
    flex: none;
    width: 100%;
    padding: 10px 12px;
  }

  .watchscribe-input-container {
    flex-direction: column !important;
  }

  [id^="watchscribe-regex-"] {
    margin-bottom: 0.5em;
  }

  .ws-list-content {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5em;
  }

  .ws-code {
    margin-right: 0;
    margin-bottom: 0.5em;
    flex: none;
    font-size: 1em;
  }

  .ws-edit-input {
    margin-bottom: 0.5em;
    flex: none;
  }

  /* Button group for mobile */
  .ws-button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25em;
    width: 100%;
  }

  .ws-list-content > button {
    flex: 1;
    min-width: 60px;
    font-size: 1em;
    padding: 6px 4px;
  }

  .ws-send-shortcut {
    margin-bottom: 0.25em;
  }

  /* Sending mode message responsive */
  [id^="watchscribe-sending-mode-"] {
    padding: 0.75em;
    font-size: 1em;
  }

  [id^="watchscribe-sending-mode-"] kbd {
    padding: 1px 4px;
    font-size: 1em;
  }
}

@media (max-width: 480px) {
  [id^="watchscribe-widget-"] {
    margin: 0.25em;
    padding: 0.5em;
    font-size: 0.85em;
  }

  [id^="watchscribe-header-"] {
    font-size: 1em;
  }

  .ws-button {
    padding: 12px;
    font-size: 0.85em;
  }

  .ws-code {
    font-size: 0.65em;
    padding: 3px 4px;
  }

  .ws-list-content > button {
    font-size: 0.6em;
    padding: 4px 2px;
    min-width: 50px;
  }

  .toggle-label {
    font-size: 0.8em;
  }

  .ws-description-container {
    font-size: 10px;
    padding: 3px 6px;
  }
}

/* Dark mode support (since user mentioned using dark mode extension) */
@media (prefers-color-scheme: dark) {
  .ws-code {
    background: #2d3748;
    color: #e2e8f0;
  }

  .ws-edit-input {
    background: #2d3748;
    color: #e2e8f0;
    border-color: #4a5568;
  }

  .ws-description-container {
    background-color: #2d3748;
    color: #a0aec0;
    border-color: #4a5568;
  }

  .ws-list-content {
    background: #1a202c;
    border-color: #4a5568;
  }
}
</style>`

    // Inject the CSS
    document.head.insertAdjacentHTML('beforeend', customCSS);

    // When the fire popup is opened, insert the widget
    window.addEventListener("fire-popup-open", function () {
        // Reset case-insensitive in case it persists between windows

        caseInsensitive = false;
        regexSendingOverride = false; // Reset the regex sending override

        // Create a (most likely) unique ID for the widget
        // just in case html is funky.
        const widgetID = Math.random().toString(36).substring(7)
        const reportedPostDiv = document.querySelector('.fire-reported-post');
        reportedPostDiv.insertAdjacentHTML('afterend', widgetHTML.replace(/%/g, widgetID));
        commandType = COMMAND_TYPES.watch; // Reset the command type to watch
        silent = GM_getValue('silent', true); // Get the silent mode from storage

        let lastGeneratedItems = [];
        watchedURLs = [];

        // Get the various components of the widget
        const generateButton = document.getElementById(`watchscribe-button-${widgetID}`);
        const regexList = document.getElementById(`watchscribe-regexes-${widgetID}`);
        const clearButton = document.getElementById(`watchscribe-clear-${widgetID}`);
        const sendButton = document.getElementById(`watchscribe-send-${widgetID}`);
        const addButton = document.getElementById(`watchscribe-add-${widgetID}`);
        const sendAsIsButton = document.getElementById(`watchscribe-send-as-is-${widgetID}`);
        const regexInput = document.getElementById(`watchscribe-regex-${widgetID}`);
        const labelOn = document.getElementById(`labelOn-${widgetID}`);
        const labelOff = document.getElementById(`labelOff-${widgetID}`);
        const title = document.getElementById(`watchscribe-title-${widgetID}`);
        const toggleBtn = document.getElementById(`toggleBtn-${widgetID}`);
        const silentToggle = document.getElementById(`watchscribe-silent-${widgetID}`);
        const silentLabel = document.getElementById(`labelSilent-${widgetID}`);
        const buttonContainer = document.getElementById(`watchscribe-button-container-${widgetID}`);
        const sendingMode = document.getElementById(`watchscribe-sending-mode-${widgetID}`);
        const versionNumber = document.getElementById(`watchscribe-version-number-${widgetID}`);
        const debugButton = document.getElementById(`watchscribe-debug-sent-messages-${widgetID}`);

        debugButton.addEventListener('click', () => {
            console.log("Sent Messages Debug Info:");
            for (const [messageId, command] of Object.entries(sentMessages)) {
                console.log(`Message ID: ${messageId}`, command);
            }
        });


        toggleBtn.parentElement.addEventListener('click', () => {
            commandType = commandType === COMMAND_TYPES.watch ? COMMAND_TYPES.blacklist : COMMAND_TYPES.watch;

            updateModeSwitch();
        });

        // Set the version number
        versionNumber.textContent = GM_info.script.version;

        const updateModeSwitch = () => {
            isOn = commandType === COMMAND_TYPES.blacklist;
            toggleBtn.classList.toggle('on', isOn);

            labelOn.classList.toggle('active', isOn);
            labelOff.classList.toggle('active', !isOn);

            title.innerHTML = isOn ? "<s>Watch</s> BlacklistScribe" : "WatchScribe";
        }

        const SILENT_MODE_ON = "Silent (!!/command-)";
        const SILENT_MODE_OFF = "No hyphen (!!/command)";

        silentToggle.addEventListener('change', () => {
            silent = silentToggle.checked;
            if (silent) {
                silentLabel.textContent = SILENT_MODE_ON;
            } else {
                silentLabel.textContent = SILENT_MODE_OFF;
            }
            GM_setValue('silent', silent);
        });

        // Set the initial state of the silent toggle
        silentToggle.checked = silent;
        silentLabel.textContent = silent ? SILENT_MODE_ON : SILENT_MODE_OFF;

        clearButton.addEventListener('click', () => regexList.innerHTML = "");

        // A listener for the send all commands button
        sendButton.addEventListener('click', () => {
            let messages = document.querySelectorAll('.ws-list-item');

            messages.forEach((item) => {
                let commandObject = commandObjectFromListItem(item);
                let command = commandFromListItem(item);
                sendMessage(command).then((messageId) => {
                    sentMessages[messageId] = new SentMessage(commandObject, false);
                    item.querySelector('.ws-send-button').style.display = "none"; // Hide the send button
                });
            });
        });

        const addFromInputField = () => {
            let message = regexInput.value;
            if (!message) {
                alert("No message entered!");
                return;
            }
            const regexes = generateFor(message);
            lastGeneratedItems = [];
            for (let regex of regexes) {
                const made = createListItem(regexList, regex);
                lastGeneratedItems.push(made);
            }
        }

        addButton.addEventListener('click', () => {
            addFromInputField();

        });

        sendAsIsButton.addEventListener('click', () => {
            let message = regexInput.value;

            if (!message) {
                alert("No message entered!");
                return;
            }
            const commandObj = new GeneratedCommand(message, COMMAND_SUBTYPES.text, "Sent from input field");
            sendMessage(commandFrom(commandType, commandObj.regex, commandObj.subtype, silent)).then((messageId) => {
                sentMessages[messageId] = new SentMessage(commandObj, false);
            });
        });

        regexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        generateButton.addEventListener('click', () => {
            lastGeneratedItems = generateRegexes(regexList)
            shiftMode = false;
            generateButton.innerText = "Generate Regex"; // Reset the button text
        });

        let shiftMode = false;
        let longPressTimer;

        // Long press on the button → enable shift mode
        generateButton.addEventListener("touchstart", () => {
            longPressTimer = setTimeout(() => {
                shiftMode = true;
                caseInsensitive = true;
                generateButton.innerText = "Generate Regex (case insensitive - `?-i:`)";
            }, 400);
        });

        generateButton.addEventListener("touchend", () => {
            clearTimeout(longPressTimer);
            // Don't do anything else here – wait for the next click
        });

        // Global click listener to handle what happens next
        document.addEventListener("click", (e) => {
            if (!shiftMode) return; // Normal behavior

            if (e.target === generateButton) {
                // Shift click behavior will happen automatically
                // (because caseInsensitive is true)
            } else {
                // User clicked somewhere else → cancel shift mode
                shiftMode = false;
                caseInsensitive = false;
                generateButton.innerText = "Generate Regex";
            }
        });

        const toggleButtonsContainer = () => {
            if (buttonContainer.style.display === "none") {
                buttonContainer.style.display = "";
                sendingMode.style.display = "none"; // Hide the sending mode message
            } else {
                buttonContainer.style.display = "none";
                sendingMode.style.display = ""; // Show the sending mode message
            }
        }

        function keyboardShortcuts(e) {
            const tag = e.target.tagName;

            if (e.altKey || e.ctrlKey || e.metaKey) {
                // Do nothing if any of the Alt, Ctrl, or Meta keys are pressed
                return;
            }

            if (regexSendingOverride && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                if (e.key !== 'Escape') {
                    e.preventDefault(); // Prevent default behavior for all keys except Escape
                    e.stopImmediatePropagation();
                }

                if (e.key === "]") {
                    // If the user presses ], disable the regex sending override
                    regexSendingOverride = false; // Reset the override flag
                    hideSendShortcuts(regexList); // Hide the send shortcuts
                    toggleButtonsContainer(); // Toggle the buttons container
                    return;
                } else if (LETTERING_ORDER.includes(e.key.toUpperCase())) {
                    // If the user presses a letter in LETTERING_ORDER, send the corresponding regex
                    // if present
                    const index = LETTERING_ORDER.indexOf(e.key.toUpperCase());
                    if (index < regexList.children.length) {
                        const item = regexList.children[index];
                        if (item && item.querySelector('.ws-code')) {
                            const command = commandFromListItem(item);
                            const commandObject = commandObjectFromListItem(item);
                            sendMessage(command).then((id) => {
                                sentMessages[id] = new SentMessage(commandObject, false);
                                item.querySelector('.ws-send-shortcut').remove(); // Remove the shortcut after sending
                                item.querySelector('.ws-send-button').style.display = "none"; // Hide the send button
                            });
                        } else {
                            console.warn(`No regex found for key: ${e.key}`);
                        }
                    }
                } else if (e.key === 'Tab') {
                    // Send all regexes when the user presses Tab
                    let messages = document.querySelectorAll('.ws-lis-item');

                    messages.forEach((item) => {
                        let commandObject = commandObjectFromListItem(item);
                        let command = commandFromListItem(item);
                        sendMessage(command).then((messageId) => {
                            sentMessages[messageId] = new SentMessage(commandObject, false);
                        });
                    });
                    hideSendShortcuts(regexList); // Hide the send shortcuts after sending
                    regexSendingOverride = false; // Reset the override flag
                    // Hide all send buttons
                    Array.from(regexList.querySelectorAll('.ws-send-button')).forEach(button => {
                        button.style.display = "none";
                    });
                } else if (e.key === 'Enter') {
                    // If the user presses Enter, send the first regex in the list
                    // and then remove the sent regex from the list
                    if (regexList.children.length > 0) {
                        const firstItem = regexList.children[0];
                        if (firstItem && firstItem.querySelector('.ws-code')) {
                            const command = commandFromListItem(firstItem);
                            sendMessage(command).then((id) => {
                                sentMessages[id] = new SentMessage(commandObjectFromListItem(firstItem), false);
                                firstItem.remove(); // Remove the sent regex from the list
                                hideSendShortcuts(regexList);
                                showSendShortcuts(regexList); // Update the send shortcuts
                            });

                        } else {
                            alert("No regex found to send.");
                        }
                    }
                }

                return;
            }

            if (e.key === 'Shift' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                generateButton.innerText = "Generate Regex (case insensitive - `?-i:`)";
                caseInsensitive = true;
            } else if (e.key === 'Enter' && tag === 'INPUT' && tag !== 'TEXTAREA') {
                // Generate regexes when the user presses Enter in the input field
                e.preventDefault(); // Prevent form submission if in a form
                addFromInputField(); // Call the function to add regexes from the input field
            } else if (e.key === 'Tab' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault(); // Prevent default tabbing behavior
                lastGeneratedItems = generateRegexes(regexList); // Generate regexes on tab press
            } else if (e.key === "`" && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
                // Watchify/Blacklistify the last generated regexes
                if (lastGeneratedItems.length === 0) {
                    alert("No regexes generated yet! Generate some first.");
                    return;
                }

                lastGeneratedItems.forEach((item) => {
                    const callback = item[1]; // Get the toggle callback
                    if (callback) {
                        callback(); // Call the toggle function to switch mode
                    }
                });
            } else if (e.key.toLowerCase() === 'w' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // If the user presses 'w', switch to watch mode
                e.preventDefault(); // Prevent default behavior
                commandType = COMMAND_TYPES.watch;
                updateModeSwitch(); // Update the mode switch
            } else if (e.key.toLowerCase() === 'b' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // If the user presses 'b', switch to blacklist mode
                e.preventDefault(); // Prevent default behavior
                commandType = COMMAND_TYPES.blacklist;
                updateModeSwitch(); // Update the mode switch
            } else if (e.key.toLowerCase() === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // If the user presses '/', toggle the command type
                e.preventDefault(); // Prevent default behavior
                commandType = commandType === COMMAND_TYPES.watch ? COMMAND_TYPES.blacklist : COMMAND_TYPES.watch;
                updateModeSwitch(); // Update the mode switch
            } else if (e.key.toLowerCase() === '-' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // If the user presses '-', toggle the silent mode
                e.preventDefault(); // Prevent default behavior
                silent = !silent;
                silentToggle.checked = silent; // Update the checkbox state
                silentLabel.textContent = silent ? "Silent (!!/command-)" : "No hyphen (!!/command)";
            } else if (e.key.toLowerCase() === ']' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // Enable sending either all or specific regexes to chat
                // but only if there's at least one regex in the list
                if (regexList.children.length === 0) {
                    alert("No regexes to send! Generate some first.");
                    return;
                }
                regexSendingOverride = true; // Set the override flag
                showSendShortcuts(regexList); // Show the send shortcuts
                toggleButtonsContainer(); // Toggle the buttons container
            } else if (e.key.toLowerCase() === 'c' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                // If the user presses 'c', clear the regex list
                e.preventDefault(); // Prevent default behavior
                regexList.innerHTML = ""; // Clear the list
                lastGeneratedItems = []; // Reset the last generated items
                hideSendShortcuts(regexList); // Hide the send shortcuts
            }
        }

        document.addEventListener('keydown', keyboardShortcuts, true); // Use capture phase to ensure it runs before the keyboard shortcuts
        // of FIRE

        document.addEventListener('fire-popup-closing', () => {
            document.removeEventListener('keydown', keyboardShortcuts, true); // Clean up the event listener
        })

        document.addEventListener('keyup', (e) => {
            const tag = e.target.tagName;
            if (e.key === 'Shift' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                generateButton.innerText = "Generate Regex";
                caseInsensitive = false;
            }
        });


        // Make it so that links aren't clickable in the popup (so that they can actually be selected)
        // Usually, trying to select link text will just open the link in a new tab.

        const reportElement = document.querySelector(".fire-reported-post");
        const links = Array.from(reportElement.querySelectorAll("a"));

        for (let link of links) {
            // Copy the link element into a new a element which is not clickable
            const newLink = document.createElement("span");
            newLink.setAttribute("data-href", link.href);
            newLink.setAttribute("data-tooltip", link.href);
            newLink.setAttribute("innerText", link.innerText);
            newLink.classList.add("watchscribe-link");

            // However, allow ctrl+click to open the link in a new tab
            newLink.addEventListener("click", (e) => {
                if (e.ctrlKey) {
                    window.open(link.href, "_blank");
                }
            });

            // Italicize the link text
            newLink.style.fontWeight = "bold";
            newLink.style.textDecoration = "underline";
            newLink.style.position = "relative";

            const linkIndicator = document.createElement("a");
            linkIndicator.innerHTML = `<sup link-indicator='true'>${LINK_CHAIN_INDICATOR}</sup>`;
            linkIndicator.href = link.href;
            linkIndicator.target = "_blank";
            linkIndicator.setAttribute("link-indicator", "true");

            // Make it so that hovering the link indicator highlights the link text
            linkIndicator.addEventListener("mouseover", () => {
                newLink.style.backgroundColor = "yellow";
                newLink.style.borderRadius = "4px";
            });
            linkIndicator.addEventListener("mouseout", () => {
                newLink.style.backgroundColor = "";
                newLink.style.borderRadius = "";
            });

            newLink.textContent = link.textContent;
            newLink.appendChild(linkIndicator);


            link.replaceWith(newLink);

        }
    })

    // === Tooltip Setup ===
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
  position: fixed;
  background: #eee;
  padding: 5px;
  border-radius: 4px;
  box-shadow: 0 0 10px 0 #888;
  border: 1px solid #bbb;
  white-space: pre-line;
  font-size: 12px;
  max-width: 70vw;
  word-wrap: break-word;
  z-index: 10000;
  display: none;
  pointer-events: none;
`;
    document.body.appendChild(tooltip);

    function showTooltip(el) {
        const text = el.getAttribute('data-tooltip');
        if (!text) return;
        tooltip.textContent = text;
        tooltip.style.display = 'block';

        const rect = el.getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight;
        const tooltipWidth = tooltip.offsetWidth;

        let top = rect.bottom + 8;
        if (top + tooltipHeight > window.innerHeight) {
            top = rect.top - tooltipHeight - 8;
        }

        let left = rect.left;
        if (left + tooltipWidth > window.innerWidth) {
            left = window.innerWidth - tooltipWidth - 8;
        }

        tooltip.style.top = `${Math.max(8, top)}px`;
        tooltip.style.left = `${Math.max(8, left)}px`;
    }

    function hideTooltip() {
        tooltip.style.display = 'none';
    }

    // === Tooltip Events for .watchscribe-link ===
    document.addEventListener('mouseover', (e) => {
        const el = e.target.closest('.watchscribe-link[data-tooltip]');
        if (el) showTooltip(el);
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.watchscribe-link[data-tooltip]')) {
            hideTooltip();
        }
    });

    $(document).ready(function () {
        CHAT.addEventHandlerHook(chatMessageRecieved);
    });

    const REPLY_EVENT_TYPE = 18;
    const SMOKEY_ID = 120914;

    function chatMessageRecieved(message) {
        const eventType = message.event_type;
        const userId = message.user_id;

        if (!(eventType === REPLY_EVENT_TYPE && userId === SMOKEY_ID)) {
            return false;
        }

        const parentID = message.parent_id;
        if (!parentID) {
            return false; // No parent ID, nothing to do
        }

        // Return early if the parent message is not found in
        // the sentMessages map

        const parentMessage = sentMessages[parentID];
        if (!parentMessage) {
            return false; // Parent message not found, nothing to do
        }

        if (parentMessage.edited) {
            return false;
        }

        const command = parentMessage.command;

        const RESEND_REGEX = /A normalized version, <code>\{\{.+\}\}<\/code>, of that pattern is already on the number watchlist and the pattern you provided is not an exact match to an existing entry on the number watchlist\./;

        const EXISTING_PATTERN_REGEX = /Matched by <code>(.+)<\/code> on/;

        if (command.mode === COMMAND_TYPES.blacklist && command.originalType === COMMAND_SUBTYPES.number) {
            if (RESEND_REGEX.test(message.content)) {
                // Perform the blacklist again, but with the already watched number
                const pattern = EXISTING_PATTERN_REGEX.exec(message.content);
                console.log("pattern", pattern);
                if (!pattern) {
                    return false;
                }
                const watchedNumber = pattern[1];
                sendMessage(commandFrom(COMMAND_TYPES.blacklist, watchedNumber, COMMAND_SUBTYPES.number, silent)).then((messageId) => {
                    sentMessages[messageId] = new SentMessage(new GeneratedCommand(watchedNumber, COMMAND_SUBTYPES.number, "Re-sent from existing watch"), false);
                    sentMessages[parentID].edited = true; // Mark the parent message as edited
                });
            }
        }
    }



})();