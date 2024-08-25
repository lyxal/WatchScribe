// ==UserScript==
// @name         WatchScribe
// @version      0.6.0
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
     * Return a list of domains watched/blacklisted in a FIRE report
     * @param {{reasonType: string, reason: string}[]} reasons The parsed reasons from a FIRE report. Use `parseReportReasons` to get this
     * @returns {string[]} The bad links from the report
     */
    function getBadLinksFromReport(reasons) {

        const watchOrBlacklist = reasons.filter(reason =>
            [
                "Potentially bad keyword in body",
                "Blacklisted website in body",
                "Potentially bad keyword in answer",
                "Bad keyword in answer"
            ].includes(reason.reasonType)
        )

        const badLinks = watchOrBlacklist.map(reason => reason.reason);

    }

    /**
     * Parse the reasons for a report from a report item
     * @param {HTMLUListElement} reportItem 
     * @returns {{reasonType: string, reason: string}[]}} The parsed report reasons
     */
    function parseReportReasons(reportItem) {
        if (!reportItem) {
            return {};
        }

        const reportElements = reportItem.childNodes;
        const reportReasons = Array.from(reportElements).map(el => { return { reasonType: el.firstChild.textContent, reason: el.lastChild.textContent } });

        return reportReasons;
    }

    /**
     * Get the report item for the current FIRE report
     * @returns {HTMLElement} The report item
     */
    function getReportItem() {
        const title = document.querySelector(".fire-post-title-container");
        const tooltip = title.getAttribute("fire-tooltip");
        const reportHTML = tooltip.slice(tooltip.indexOf("<ul"));
        const reportElement = new DOMParser().parseFromString(reportHTML, "text/html").body.firstChild;
        return reportElement;
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
        tld = tld.join('\\.'); // Reconstruct the TLD, escaping the "."s

        // Escape special regex characters in the hostname and TLD
        hostname = hostname.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase();
        tld = tld.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase()

        // Remove any trailing /s because sometimes URLs have those
        // and that's annoying. We don't want to watch those.

        while (tld.endsWith("/")) { // Basically a trim function at home
            tld = tld.slice(0, -1);
        }

        // Push a regex for the full domain, escaping the "."
        regexes.push(`${hostname}\\.${tld}`);

        // Push the hostname without the TLD, using a negative lookahead
        regexes.push(`${hostname}(?!\\.${tld})`);

        return regexes;
    }

    /**
     * Generate a regex for arbitrary text. Lowercases and inserts checks for arbitrary spaces/non-word characters
     * @param {string} text The text to generate a regex for
     * @returns {string} The regex for the text
     */
    function generateForText(text) {
        // Graciously stolen from Ryan M's bookmarklet: https://chat.stackexchange.com/transcript/11540?m=66059405#66059405
        return text.toLowerCase().trim().replaceAll(".", "\\.").replaceAll(" ", "[\\W_]*+");
    }

    /**
     * Generate a _command_ for a phone number. Phone number watching uses
     * a different checking format than regexes.
     * @param {string} number The phone number to generate a command for
     * @returns {string} The command for the phone number
     */
    function generateForNumber(number) {
        // TODO: Glean more information on how phone number watching works from the fine folks in Charcoal HQ
        return `!!/watch-number- ${number}`;
    }

    /**
     * Genereate an array of regexes for a given input. Determines the kind
     * of regex to generate based on the input. Basically the brains of the operation.
     * @param {string} input A string to generate regexes for
     * @returns {string[]} An array of regexes for the input
     */
    function generateFor(input) {
        // Check whether the input is something that looks like a URL
        if (/^[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+$/.test(input)) {
            return generateForURL(input);
        }
        // Perhaps it's a phone number?
        else if (/(?<=\D|^)\+?(?:\d[\W_]*){8,13}\d(?=\D|$)/.test(input)) {
            return [generateForNumber(input)]; // Wrapped in a list for consistency with URL generation
        }
        // Otherwise, it's normal text
        else {
            return [generateForText(input)];
        }
    }

    /**
     * Add a watch command to the list of commands that can be sent to chat
     * @param {HTMLElement} forList The HTML element to append the command to
     * @param {string} message The message to append
     */
    function createListItem(forList, message) {

        // If the message isn't already a watch-number command, prefix it with "!!/watch-"
        const command = (!message.startsWith("!!/watch-number") ? "!!/watch- " : "") + message

        // Create the list item and the code element
        const listItem = document.createElement('li');
        const itemHTML = document.createElement('div');
        const regexHTML = document.createElement('code');
        regexHTML.textContent = command;
        itemHTML.appendChild(regexHTML);

        // Create the send button
        const sendButton = document.createElement('button');
        sendButton.textContent = "Send to chat";
        sendButton.style.marginLeft = "1em";
        sendButton.addEventListener('click', () => {
            sendMessage(command)
            sendButton.style.display = "none";
        });

        // Append the code element and the send button to the list item
        itemHTML.appendChild(sendButton);
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
            const textRegex = generateForText(text);

            // Regexes for the anchor text IF it's not a URL
            if (!/[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+/.test(selectedText)) {
                regexes.push(textRegex);
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
                regexes.push(`${textRegex}(?!\\.${tld})`);
            }
        } else {
            regexes = generateFor(selectedText);
        }

        for (let regex of regexes) {
            createListItem(list, regex);
        }
    }

    //== HTML elements ==//


    let widgetHTML = `
    <div id="watchscribe-widget-%" style="padding-top: 2em; margin-left: 1em; z-index: 300">
        <h3>WatchScribe</h3>
        <p>Select some text, then click the button below to generate possible watch/blacklist regex(es).</p>
        <button id="watchscribe-button-%">Generate Regex</button>
        <button id="watchscribe-clear-%">Clear List</button>
        <button id="watchscribe-send-%">Send All Regexes To Chat</button>
        <br>
        <input type="text" id="watchscribe-regex-%" placeholder="Enter text here">
        <button id="watchscribe-add-%">(+)</button>
        <button id="watchscribe-send-as-is-%">Prefix and Send</button>
        <ul id="watchscribe-regexes-%"></ul>
    </div>
`;

    let customCSS = `
    <style>
.watchscribe-link:hover::after {
content: attr(data-tooltip);
position: fixed;
background: #eee;
padding: 5px;
border-radius: 4px;
box-shadow: 0 0 10px 0 #888;
border: 1px solid #bbb;
white-space: pre-line;
font-weight: normal;
font-style: normal;
font-size: 12px;
max-width: 70vw;
cursor: pointer;
word-wrap: break-word;
word-break: break-word;
cursor: auto;
z-index: 1000;
}
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

        // Get the various components of the widget
        const generateButton = document.getElementById(`watchscribe-button-${widgetID}`);
        const regexList = document.getElementById(`watchscribe-regexes-${widgetID}`);
        const clearButton = document.getElementById(`watchscribe-clear-${widgetID}`);
        const sendButton = document.getElementById(`watchscribe-send-${widgetID}`);
        const addButton = document.getElementById(`watchscribe-add-${widgetID}`);
        const sendAsIsButton = document.getElementById(`watchscribe-send-as-is-${widgetID}`);
        const regexInput = document.getElementById(`watchscribe-regex-${widgetID}`);

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
            sendMessage("!!/watch- " + message);
        });

        regexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        generateButton.addEventListener('click', () => generateRegexes(regexList));

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

            // Italicize the link text
            newLink.style.fontWeight = "bold";
            newLink.style.textDecoration = "underline";
            newLink.style.position = "relative";
            link.replaceWith(newLink);
        }
    })
})();