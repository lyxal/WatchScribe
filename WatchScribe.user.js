// ==UserScript==
// @name         WatchScribe
// @version      0.3
// @description  A userscript to help generate regexes for SmokeDetector's watchlist feature. To be used in conjunction with FIRE.
// @author       lyxal
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
            throw new Error(
                `Failed to send message to chat. Returned error is ${call.status}`
            );
        }
    }






    function getSelectedText() {
        return window.getSelection().toString();
    }

    function generateForURL(url) {
        let regexes = [];
        let urlObj = new URL(url);

        let [hostname, ...tld] = urlObj.hostname.split('.');
        tld = tld.join('.');

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

        if (/^[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+$/.test(selectedText)) {
            console.log("Domain detected.");
            regexes = regexes.concat(generateForURL(selectedText));
        } else if (selectedElement && selectedElement.tagName === 'A') {
            console.log("Anchor detected.");
            // Regexes for the URL
            regexes = regexes.concat(generateForURL(selectedElement.href));

            // Regexes for the anchor text IF it's not a URL
            if (!/[a-zA-Z0-9_\-]*(\.[a-zA-Z0-9_\-]*)+/.test(selectedText)) {
                regexes.push(generateForText(selectedElement.innerText));
            }
        } else { // TODO: Account for phone numbers
            console.log("Text detected.");
            regexes.push(generateForText(selectedText));
        }

        list.innerHTML = "";

        for (let regex of regexes) {
            const message = "!!/watch- " + regex;
            const listItem = document.createElement('li');
            const itemHTML = document.createElement('div');
            const regexHTML = document.createElement('code');
            regexHTML.textContent = message;
            itemHTML.appendChild(regexHTML);

            const sendButton = document.createElement('button');
            sendButton.textContent = "Send to chat";
            sendButton.style.marginLeft = "1em";
            sendButton.addEventListener('click', () => sendMessage(message));
            itemHTML.appendChild(sendButton);
            listItem.appendChild(itemHTML);
            list.appendChild(listItem);
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
            <ul id="watchscribe-regexes-%"></ul>
        </div>
    `;

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

        generateButton.addEventListener('click', () => generateRegexes(regexList));

        // Make it so that links aren't clickable in the popup (so that they can actually be selected)

        const reportElement = document.querySelector(".fire-reported-post");
        const links = Array.from(reportElement.querySelectorAll("a"));

        for (let link of links) {
            // Copy the link element into a new a element which is not clickable
            const newLink = document.createElement("a");
            newLink.textContent = "[" + link.textContent + "]";
            newLink.href = link.href;
            newLink.style.pointerEvents = "none";

            // Italicize the link text
            newLink.style.fontStyle = "italic";
            link.insertAdjacentElement("afterend", newLink);
        }
    })
})();