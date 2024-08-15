// ==UserScript==
// @name         WatchScribe
// @version      0.1
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

    function getSelectedText() {
        return window.getSelection().toString();
    }

    function generateForURL(url) {
        let regexes = [];
        let protocollessURL = url.replace(/(^\w+:|^)\/\/(www\.)?/, '');
        let hostname = protocollessURL.split('.')[0];
        let tld = protocollessURL.split('.').splice(1).join('.');

        // Escape special characters
        hostname = hostname.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase();
        tld = tld.replace(/([()[{*+.$^\\|?])/g, '\\$1').toLowerCase().replace(/\//g, "");

        console.log(`Hostname: ${hostname}`);
        console.log(`TLD: ${tld}`);

        regexes.push(`${hostname}\\.${tld}`);
        regexes.push(`${hostname}(?!\.${tld})`);
        regexes.push(`${hostname}`);
        return regexes;
    }

    function generateForText(text) {
        return text.toLowerCase().trim().replaceAll(".", "\\.").replaceAll(" ", "[\\W_]*+");
    }

    function generateRegexes(list) {

        let regexes = [];

        const selectedText = getSelectedText();
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
            const listItem = document.createElement('li');
            listItem.textContent = "!!/watch " + regex;
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
        const links = reportElement.getElementsByTagName("a");
        for (let link of links) {
            link.style.pointerEvents = "none";
        }
    })
})();