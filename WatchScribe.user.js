// ==UserScript==
// @name         WatchScribe
// @version      0.11.1
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
// @grant        none
// ==/UserScript==

(() => {
    const charcoalHq = 11540;
    const COMMAND_TYPES = {
        "watch": "watch",
        "blacklist": "blacklist",
    };

    var commandType = COMMAND_TYPES.watch;
    var silent = true;
    var caseInsensitive = false;

    /**
     * Send a message to chat
     * @param {string} message The message to send
     * @returns void
     */
    async function sendMessage(message) {
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

        if (call.status !== 200 || !call.ok) {
            toastr.error('Failed to send message to chat.');
        } else {
            toastr.success('Successfully sent message to chat.');
        }
    }


    /**
     * A small helper function to get the currently selected text
     * @returns {string} The selected text
     */
    const getSelectedText = () => window.getSelection().toString();

    /**
     * Generate potentially multiple regexes for a given URL
     * @param {string} url 
     * @returns {string[]} Regexes for the URL
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
        regexes.push(`${hostname}\\.${tldFull}`);
        regexes.push(`${hostname}\\.${tldDivided}`);

        // Push the hostname without the TLD, using a negative lookahead
        regexes.push(`${hostname}(?!\\.${tldFull})`);
        regexes.push(`${hostname}(?!\\.${tldDivided})`);

        commands = [];

        for (let regex of regexes) {
            if (commandType === COMMAND_TYPES.blacklist) {
                commands.push(`!!/blacklist-url${silent ? "-" : ""} ${regex}`);
            } else {
                commands.push(`!!/watch${silent ? "-" : ""} ${regex}`);
            }
        }

        return commands;
    }

    /**
     * Generate a regex for arbitrary text. Lowercases and inserts checks for arbitrary spaces/non-word characters
     * @param {string} text The text to generate a regex for
     * @returns {string[]} Possible regexes for the text
     */
    function generateForText(text) {
        let regexes = [];
        let safetext = text.replace(/([()[{*+.$^\\|?\]])/g, '\\$1'); // Escape special regex characters

        // Graciously stolen from Ryan M's bookmarklet: https://chat.stackexchange.com/transcript/11540?m=66059405#66059405
        let defaultRegex = safetext.trim().toLowerCase().replaceAll(" ", "[\\W_]*+");


        if (caseInsensitive) {
            // If case-insensitive mode is enabled, add a case-insensitive version
            regexes.push(`(?-i:${safetext.trim().replaceAll(".", "\\.").replaceAll(" ", "[\\W_]*+")})`);
        }

        // If the text has no spaces, and contains uppercase letters, wrap in a case-insensitive group
        else if (!text.includes(" ") && /[A-Z]/.test(text)) {
            regexes.push(`(?-i:${defaultRegex})`);
            regexes.push(`${defaultRegex}`);
        } else {
            // Otherwise, just use the default regex
            regexes.push(defaultRegex);
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
     * @returns {string[]} Possible commands for the phone number
     */
    function generateForNumber(number) {
        const normalised = normaliseNumber(number);
        const justNumbers = normalised.replace(/[^\d]/g, ""); // Remove all non-digit characters

        const regexes = [];

        if (justNumbers.length == 10) {
            // 10 digits, so add an option for it to be a non-american number
            regexes.push(`!!/${commandType}-number${silent ? "-" : ""} ${justNumbers}(?#NO NorAm)`);
            // As well as the normal 10 digit number
            regexes.push(`!!/${commandType}-number${silent ? "-" : ""} +1-${justNumbers}(?#IS NorAm)`);
        }

        // 11 digit numbers starting with a 0 can be written
        // without the 0, making it look like it could be a NANP
        // number. Therefore, add an option for the short version
        // but add the context back via No NorAm.
        if (justNumbers.startsWith("0") && justNumbers.length == 11) {
            regexes.push(`!!/${commandType}-number${silent ? "-" : ""} ${justNumbers.slice(1)}(?#NO NorAm)`);
        }

        // 12 digit numbers starting with 91 have the same problem.
        // This is what happens when convenience is prioritised over consistency.
        // Not that convenience is a bad thing to design around, but come on.
        // consistency please.

        if (justNumbers.startsWith("91") && justNumbers.length == 12) {
            regexes.push(`!!/${commandType}-number${silent ? "-" : ""} ${justNumbers.slice(2)}(?#NO NorAm)`);
        }

        regexes.push(`!!/${commandType}-number${silent ? "-" : ""} ${justNumbers}`);


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
        if (/^[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+$/.test(input) && !isAllNumbers(input.replaceAll(".", ""))) {
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
            regexes = generateForText(input);
            if (commandType === COMMAND_TYPES.blacklist) {
                return regexes.map(regex => `!!/blacklist-keyword${silent ? "-" : ""} ${regex}`);
            }
            return regexes.map(regex => `!!/watch${silent ? "-" : ""} ${regex}`);
        }
    }

    /**
     * Add a watch command to the list of commands that can be sent to chat
     * @param {HTMLElement} forList The HTML element to append the command to
     * @param {string} message The message to append
     */
    function createListItem(forList, message) {
        // Add prefix if needed
        let command = (!message.startsWith(`!!/${commandType}`)
            ? `!!/${commandType}${silent ? "-" : ""} `
            : "") + message;

        // Create list item wrapper
        const listItem = document.createElement('li');
        listItem.className = 'ws-list-item';

        // Inner container
        const itemHTML = document.createElement('div');
        itemHTML.className = 'ws-list-content';

        // Regex display
        const regexHTML = document.createElement('code');
        regexHTML.textContent = command;
        regexHTML.className = 'ws-code';

        // Editable input (hidden by default)
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.value = command;
        editInput.className = 'ws-edit-input';
        editInput.style.display = 'none';
        editInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        // Send button
        const sendButton = document.createElement('button');
        sendButton.textContent = "Send to Chat";
        sendButton.className = 'ws-send-button';
        sendButton.addEventListener('click', () => {
            sendMessage(command);
            sendButton.style.display = "none";
        });

        // Edit button
        const editButton = document.createElement('button');
        editButton.textContent = "✏️";
        editButton.className = 'ws-edit-button';
        editButton.title = "Edit this regex";
        editButton.addEventListener('click', () => {
            const editing = editInput.style.display === 'inline-block';
            if (editing) {
                // Save
                command = editInput.value;
                regexHTML.textContent = command;
                regexHTML.style.display = 'inline';
                editInput.style.display = 'none';
                editButton.textContent = "✏️";
                sendButton.style.display = "inline"; // Show again if edited
            } else {
                // Begin editing
                editInput.value = command;
                editInput.style.display = 'inline-block';
                regexHTML.style.display = 'none';
                editButton.textContent = "✔️"; // Change button to save icon
            }
        });

        // Anchor button (⛓️)
        const anchorButton = document.createElement('button');
        anchorButton.textContent = "⛓️"; // Or "Anchor"
        anchorButton.title = "Anchor this regex (wrap in ^ and $)";
        anchorButton.addEventListener('click', () => {
            let currentCommand = editInput.style.display === 'inline-block' ? editInput.value : regexHTML.textContent
            // Split the command into prefix and regex parts
            let [prefix, ...regexParts] = currentCommand.split(' ');
            let regex = regexParts.join(' ');
            // If the regex already starts with ^ and ends with $, just remove them
            if (regex.startsWith('^') && regex.endsWith('$')) {
                regex = regex.slice(1, -1);
            } else {
                regex = `^${regex}$`;
            }
            editInput.value = `${prefix} ${regex}`;
            regexHTML.textContent = `${prefix} ${regex}`;
        });
        anchorButton.className = 'ws-anchor-button';
        anchorButton.style.display = command.split(' ')[0].includes("number") ? 'none' : 'inline-block'; // Hide for number commands

        // 🗑 Remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = "🗑️"; // Or "Remove"
        removeButton.className = 'ws-remove-button';
        removeButton.title = "Remove this regex";
        removeButton.addEventListener('click', () => {
            listItem.remove();
        });

        // Assemble
        itemHTML.appendChild(regexHTML);
        itemHTML.appendChild(editInput);
        itemHTML.appendChild(sendButton);
        itemHTML.appendChild(editButton);
        itemHTML.appendChild(anchorButton); // Add anchor button
        itemHTML.appendChild(removeButton); // Add last for UI spacing
        listItem.appendChild(itemHTML);
        forList.appendChild(listItem);
    }



    /**
     * Generate all regexes for selected text, and render them as list items
     * @param {HTMLElement} list The list element to append the regexes to
     * @returns void
     */
    function generateRegexes(list) {

        let regexes = [];

        // Get both selected text _and_ selected element
        const selectedText = getSelectedText();
        // This is so that you can select a link and auto-watch both url and anchor text
        const selectedElement = window.getSelection().focusNode ? window.getSelection().focusNode.parentElement : null;

        if (selectedText === "") {
            alert("No text selected!");
            return;
        }

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
            const url = selectedElement.getAttribute("href");
            const text = selectedElement.innerText;
            const textRegexes = generateForText(text);
            textRegexes.push(...generateForText(selectedText)); // Add the selected text regexes as well

            // Regexes for the anchor text IF it's not a URL
            if (!/[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+/.test(selectedText)) {
                for (let textRegex of textRegexes) {
                    if (commandType === COMMAND_TYPES.blacklist) {
                        regexes.push(`!!/blacklist-keyword- ${textRegex}`);
                    } else {
                        regexes.push(textRegex);
                    }
                }
            }

            // Regexes for the URL
            regexes = regexes.concat(generateForURL(url));

            // A special check: if the text, lowercased, without spaces, matches the URL,
            // add a regex that watches the text with a negative lookahead for the URL tld

            const processedText = text.toLowerCase().replaceAll(" ", "");
            const hostname = new URL(url).hostname

            // Remove the www. if it's there
            const wwwless = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
            const processedHostname = wwwless.toLowerCase().replaceAll(" ", "");
            const tld = new URL(url).hostname.split(".").pop().toLowerCase();

            if (processedHostname.match(processedText)) {
                for (let textRegex of textRegexes) {
                    if (commandType === COMMAND_TYPES.blacklist) {
                        regexes.push(`!!/blacklist-url${silent ? "-" : ""} ${textRegex}(?!\\.${tld})`);
                    } else {
                        regexes.push(`!!/watch${silent ? "-" : ""} ${textRegex}(?!\\.${tld})`);
                    }
                }
            }
        } else if (selectedElement && selectedElement.tagName === 'A' && selectedElement.classList.contains('fire-user-name')) {
            // If the selected element is a link to a user, generate a regex for the username
            const username = selectedElement.innerText.trim();
            let originalCaseInsensitive = caseInsensitive;
            caseInsensitive = true; // Always case-insensitive for usernames
            const usernameRegexes = generateForText(username);
            caseInsensitive = originalCaseInsensitive; // Reset case-insensitive flag
            for (let usernameRegex of usernameRegexes) {
                if (commandType === COMMAND_TYPES.blacklist) {
                    regexes.push(`!!/blacklist-username${silent ? "-" : ""} ${usernameRegex}`);
                } else {
                    regexes.push(`!!/watch${silent ? "-" : ""} ${usernameRegex}`);
                }
            }

        } else {
            regexes = generateFor(selectedText);
        }

        regexes = [...new Set(regexes)]; // Remove duplicates
        console.log("Generated regexes:", regexes);

        for (let regex of regexes) {
            createListItem(list, regex);
        }
    }

    //== HTML elements ==//


    let widgetHTML = `
<div id="watchscribe-widget-%" style="padding: 1em; margin: 1em; background: #fdfdfd; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); font-family: sans-serif; z-index: 300;">
  <div id="watchscribe-header-%" style="font-weight: bold; font-size: 1.2em; margin-bottom: 1em; display: flex; align-items: center; justify-content: space-between;">
    <h3 style="margin: 0;" id="watchscribe-title-%">WatchScribe</h3>

    <div class="toggle-container-%" style="display: flex; align-items: center; gap: 8px;">
      <span id="labelOff-%" class="toggle-label active">Watch</span>
      <div class="toggle-switch">
        <div class="toggle-slider" id="toggleBtn-%"></div>
      </div>
      <span id="labelOn-%" class="toggle-label">Blacklist</span>
    </div>
  </div>

  <div id="watchscribe-toggle-silent-%" style="margin-bottom: 1em;">
    <label class="toggle-container">
      <input type="checkbox" id="watchscribe-silent-%" checked>
      <span class="checkbox-slider"></span>
      <span class="toggle-label" id="labelSilent-%">Silent (!!/command-)</span>
    </label>
  </div>

  <p style="margin-top: 0.5em;">Select some text, then click the button below to generate possible watch/blacklist regex(es).</p>

  <div style="margin-bottom: 1em;">
    <button id="watchscribe-button-%" class="ws-button">Generate Regex</button>
    <button id="watchscribe-clear-%" class="ws-button">Clear List</button>
    <button id="watchscribe-send-%" class="ws-button">Send All Regexes To Chat</button>
  </div>

  <div style="display: flex; gap: 0.5em; margin-bottom: 1em;">
    <input type="text" id="watchscribe-regex-%" placeholder="Enter text here" style="flex-grow: 1; padding: 0.4em; border-radius: 4px; border: 1px solid #ccc;">
    <button id="watchscribe-add-%" class="ws-button">(+)</button>
    <button id="watchscribe-send-as-is-%" class="ws-button">Prefix + Send</button>
  </div>

  <ul id="watchscribe-regexes-%" style="padding-left: 1.2em; list-style-type: disc;"></ul>
</div>
`;

    let customCSS = `
    <style>
/* Tooltip styling */
.watchscribe-link:hover::after {
  content: attr(data-tooltip);
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
  z-index: 1000;
}

/* Toggle layout */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
}

/* Label styles */
.toggle-label {
  transition: font-weight 0.3s ease, color 0.3s ease;
  font-weight: normal;
  color: gray;
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

/* Button styling */
.ws-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.ws-button:hover {
  background-color: #0056b3;
}

.ws-list-item {
  margin-bottom: 0.5em;
  list-style-type: none;
}

.ws-list-content {
  display: flex;
  align-items: center;
  gap: 0.5em;
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 0.5em 0.75em;
  border-radius: 6px;
  font-size: 0.9em;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
  
}

.ws-code {
  font-family: monospace;
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
  color: #333;
  word-break: break-word;
  width: 60%;
  overflow-wrap: anywhere;
  flex-grow: 1;
  margin-right: 1em;
  overflow-x: auto;
}

.ws-send-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  margin-left: 1em;
  transition: background-color 0.3s ease;
}

.ws-send-button:hover {
  background-color: #218838;
}

.ws-edit-button {
  background-color: #ffc107;
  color: black;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  margin-left: 0.5em;
  transition: background-color 0.3s ease;
}

.ws-edit-button:hover {
  background-color: #e0a800;
}

.ws-edit-input {
  font-family: monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #aaa;
  width: 60%;
  flex-grow: 1;
  overflow-x: auto;
}

.ws-remove-button {
  background: #aa2222;
  color: white;
  border: none;
  padding: 4px 8px;
  margin-left: 0.5em;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9em;
}
.ws-remove-button:hover {
  background: #cc0000;
}

.ws-anchor-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9em;
}
.ws-anchor-button:hover {
  background: #0056b3;
}
</style>
`

    // Inject the CSS
    document.head.insertAdjacentHTML('beforeend', customCSS);

    // When the fire popup is opened, insert the widget
    window.addEventListener("fire-popup-open", function () {
        // Create a (most likely) unique ID for the widget
        // just in case html is funky.
        const widgetID = Math.random().toString(36).substring(7)
        const reportedPostDiv = document.querySelector('.fire-reported-post');
        reportedPostDiv.insertAdjacentHTML('afterend', widgetHTML.replace(/%/g, widgetID));
        commandType = COMMAND_TYPES.watch; // Reset the command type to watch

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


        toggleBtn.parentElement.addEventListener('click', () => {
            commandType = commandType === COMMAND_TYPES.watch ? COMMAND_TYPES.blacklist : COMMAND_TYPES.watch;
            isOn = commandType === COMMAND_TYPES.blacklist;
            toggleBtn.classList.toggle('on', isOn);

            labelOn.classList.toggle('active', isOn);
            labelOff.classList.toggle('active', !isOn);

            title.innerHTML = isOn ? "<s>Watch</s> BlacklistScribe" : "WatchScribe";
        });

        silentToggle.addEventListener('change', () => {
            silent = silentToggle.checked;
            if (silent) {
                toggleBtn.classList.add('silent');
                silentLabel.textContent = "Silent (!!/command-)";
            } else {
                toggleBtn.classList.remove('silent');
                silentLabel.textContent = "No hyphen (!!/command)";
            }
        });

        clearButton.addEventListener('click', () => regexList.innerHTML = "");

        // A listener for the send all commands button
        sendButton.addEventListener('click', () => {
            let messages = Array.from(regexList.querySelectorAll('code')).map(el => el.textContent);
            messages.forEach(message => sendMessage(message));
        });

        addButton.addEventListener('click', () => {
            let message = regexInput.value;

            if (!message) {
                alert("No message entered!");
                return;
            }
            const regexes = generateFor(message);
            regexes.forEach(regex => createListItem(regexList, regex));
        });

        sendAsIsButton.addEventListener('click', () => {
            let message = regexInput.value;

            if (!message) {
                alert("No message entered!");
                return;
            }
            sendMessage(`!!/${commandType}${silent ? "-" : ""} ${message}`);
        });

        regexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        generateButton.addEventListener('click', () => generateRegexes(regexList));

        document.addEventListener('keydown', (e) => {
            const tag = e.target.tagName;
            if (e.key === 'Shift' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                generateButton.innerText = "Generate Regex (case insensitive - `?-i:`)";
                caseInsensitive = true;

            }
        });

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
            newLink.textContent = link.textContent;
            newLink.setAttribute("href", link.href);
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
            link.replaceWith(newLink);
        }
    })
})();