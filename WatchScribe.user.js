// ==UserScript==
// @name         WatchScribe
// @version      0.4
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
    async function sendMessage(message) {
        const fkeyEl = document.querySelector('input[name="fkey"]');
        if (!fkeyEl) {
            alert("No fkey found!");
            return;
        }
        const fkey = fkeyEl.value;
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

    function getSelectedText() {
        return window.getSelection().toString();
    }

    function generateForURL(url) {
        let regexes = [];
        let usedURL = url;
        if (!url.startsWith("http")) {
            usedURL = "https://" + url;
        }
        let urlObj = new URL(usedURL);

        let host = urlObj.hostname;

        if (host.startsWith("www.")) {
            host = host.slice(4);
        }

        let [hostname, ...tld] = host.split('.');
        tld = tld.join('.');


        console.log(hostname, tld);

        // Escape special characters
        hostname = hostname.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase();
        tld = tld.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase()

        // Remove any trailing /s

        while (tld.endsWith("/")) {
            tld = tld.slice(0, -1);
        }

        // Push a regex for the full domain, and only the hostname
        regexes.push(`${hostname}\\.${tld}`);
        regexes.push(`${hostname}(?!\\.${tld})`);
        return regexes;
    }

    function generateForText(text) {
        // Graciously stolen from Ryan M's bookmarklet: https://chat.stackexchange.com/transcript/11540?m=66059405#66059405
        return text.toLowerCase().trim().replaceAll(".", "\\.").replaceAll(" ", "[\\W_]*+");
    }

    function generateForNumber(number) {
        return `!!/watch-number- ${number}`;
    }

    function generateFor(input) {
        // check if the selected text is a domain, exactly matching a regex

        if (/^[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+$/.test(input)) {
            return generateForURL(input);
        } else if (/(?<=\D|^)\+?(?:\d[\W_]*){8,13}\d(?=\D|$)/.test(input)) {
            return [generateForNumber(input)];
        }
        else {
            return [generateForText(input)];
        }
    }

    function createListItem(forList, message) {
        const listItem = document.createElement('li');
        const itemHTML = document.createElement('div');
        const regexHTML = document.createElement('code');
        regexHTML.textContent = (!message.startsWith("!!/watch-number") ? "!!/watch- " : "") + message;
        itemHTML.appendChild(regexHTML);

        const sendButton = document.createElement('button');
        sendButton.textContent = "Send to chat";
        sendButton.style.marginLeft = "1em";
        sendButton.addEventListener('click', () => {
            sendMessage(message)
            sendButton.style.display = "none";
        });
        itemHTML.appendChild(sendButton);
        listItem.appendChild(itemHTML);
        forList.appendChild(listItem);
    }

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

        // check if the selected text is a domain, exactly matching a regex

        if (selectedElement && selectedElement.tagName === 'SPAN' && selectedElement.classList.contains('watchscribe-link')) {
            console.log("Anchor detected.");
            // Regexes for the anchor text IF it's not a URL
            if (!/[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+/.test(selectedText)) {
                let text = selectedElement.innerText;
                if (text.startsWith("[")) { text = text.slice(1); }
                if (text.endsWith("]")) { text = text.slice(0, -1); }
                regexes.push(generateForText(text));
            }
            // Regexes for the URL
            regexes = generateForURL(selectedElement.getAttribute("href"));
        } else {
            regexes = generateFor(selectedText);
        }

        for (let regex of regexes) {
            createListItem(list, regex);
        }
    }

    // HTML elements

    const INFO_ELEMENT = document.getElementById('info');

    let widgetHTML = `
        <div id="watchscribe-widget" style="padding-top: 2em; margin-left: 1em; z-index: 300">
            <h3>WatchScribe</h3>
            <p>Select some text, then click the button below to generate possible watch/blacklist regex(es).</p>
            <button id="watchscribe-generate">Generate Regex</button>
            <ul id="watchscribe-regexes"></ul>
        </div>
    `;

    let reportedPostWidgetHTML = `
        <div id="watchscribe-widget-%" style="padding-top: 2em; margin-left: 1em; z-index: 300">
            <h3>WatchScribe</h3>
            <p>Select some text, then click the button below to generate possible watch/blacklist regex(es).</p>
            <button id="watchscribe-button-%">Generate Regex</button>
            <button id="watchscribe-clear-%">Clear List</button>
            <button id="watchscribe-send-%">Send All Regexes To Chat</button>
            <input type="text" id="watchscribe-regex-%" placeholder="Enter text here">
            <button id="watchscribe-add-%">Add to list</button>
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

    document.head.insertAdjacentHTML('beforeend', customCSS);

    INFO_ELEMENT.insertAdjacentHTML('afterend', widgetHTML);

    const generateButton = document.getElementById('watchscribe-generate');
    const regexList = document.getElementById('watchscribe-regexes');

    generateButton.addEventListener('click', () => generateRegexes(regexList));

    window.addEventListener("fire-popup-open", function () {
        const widgetID = Math.random().toString(36).substring(7)
        const reportedPostDiv = document.querySelector('.fire-reported-post');
        reportedPostDiv.insertAdjacentHTML('afterend', reportedPostWidgetHTML.replace(/%/g, widgetID));

        const generateButton = document.getElementById(`watchscribe-button-${widgetID}`);
        const regexList = document.getElementById(`watchscribe-regexes-${widgetID}`);
        const clearButton = document.getElementById(`watchscribe-clear-${widgetID}`);
        const sendButton = document.getElementById(`watchscribe-send-${widgetID}`);
        const addButton = document.getElementById(`watchscribe-add-${widgetID}`);
        const regexInput = document.getElementById(`watchscribe-regex-${widgetID}`);

        clearButton.addEventListener('click', () => regexList.innerHTML = "");
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
            createListItem(regexList, message);
        });

        regexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        generateButton.addEventListener('click', () => generateRegexes(regexList));

        // Make it so that links aren't clickable in the popup (so that they can actually be selected)

        const reportElement = document.querySelector(".fire-reported-post");
        const links = Array.from(reportElement.querySelectorAll("a"));

        for (let link of links) {
            // Copy the link element into a new a element which is not clickable
            const newLink = document.createElement("span");
            newLink.textContent = link.textContent;
            newLink.setAttribute("href", link.href);
            newLink.setAttribute("data-tooltip", link.href);
            newLink.classList.add("watchscribe-link");

            // Italicize the link text
            newLink.style.fontWeight = "bold";
            newLink.style.textDecoration = "underline";
            newLink.style.position = "relative";
            link.replaceWith(newLink);
        }
    })
})();