// ==UserScript==
// @name         Zip Code Entry UI
// @author       Gerardo Salazar
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Enter up to 20 zip codes and auto-save
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function waitForHeader(callback, maxAttempts = 60) {
        let attempts = 0;
        const interval = setInterval(() => {
            const header = document.getElementById('headerText_0');
            if (header && header.offsetParent !== null) { // checks if visible
                clearInterval(interval);
                callback(header);
            }
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.warn('Zip Code Entry UI: headerText_0 not found after waiting.');
            }
        }, 500); // check every 500ms
    }

    waitForHeader((header) => {
        // Prevent duplicate UI
        if (document.getElementById('zipCodeEntryUI')) return;

        const container = document.createElement("div");
        container.id = "zipCodeEntryUI";
        container.style.display = "inline-block";
        container.style.verticalAlign = "middle";
        container.style.marginLeft = "24px";
        container.style.padding = "16px";
        container.style.background = "white";
        container.style.border = "2px solid #333";
        container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

        const textarea = document.createElement("textarea");
        textarea.rows = 10;
        textarea.cols = 20;
        textarea.placeholder = "Paste up to 20 zip codes,\none per line";
        textarea.style.display = "block";
        textarea.style.marginBottom = "8px";
        container.appendChild(textarea);

        const button = document.createElement("button");
        button.textContent = "Add Zip Codes";
        container.appendChild(button);

        const list = document.createElement("ul");
        list.id = "valueList";
        list.style.marginTop = "12px";
        container.appendChild(list);

        // Insert the container right after the header
        header.parentNode.insertBefore(container, header.nextSibling);

        let entryCount = 0;
        button.addEventListener("click", () => {
            const lines = textarea.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (lines.length === 0) return;

            for (const code of lines) {
                if (entryCount >= 20) break;
                const li = document.createElement("li");
                li.textContent = code;
                list.appendChild(li);
                entryCount++;
            }

            textarea.value = "";

            // Click Save Draft if 20 entries added
            if (entryCount >= 20) {
                const saveBtn = document.getElementById("saveDraftBtn");
                if (saveBtn) {
                    saveBtn.click();
                    entryCount = 0; // reset
                    alert("20 entries added. Draft saved.");
                    list.innerHTML = ""; // clear list
                }
            }
        });
    });
})();
