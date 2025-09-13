// ==UserScript==
// @name         Zip Code Entry UI
// @author       Gerardo Salazar
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Enter up to 20 zip codes and auto-save
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function waitForFlexAndInner(callback, maxAttempts = 60) {
        let attempts = 0;
        const interval = setInterval(() => {
            const flexParent = document.querySelector('div.sc-jDfIjF.xIVJD');
            const inner = document.querySelector('div.sc-jhnTcL.cgMRHw');
            if (flexParent && inner && inner.offsetParent !== null) {
                clearInterval(interval);
                callback(flexParent, inner);
            }
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.warn('Zip Code Entry UI: flex parent or inner div not found after waiting.');
            }
        }, 500);
    }

    waitForFlexAndInner((flexParent, inner) => {
        // Prevent duplicate UI
        if (document.getElementById('zipCodeEntryUI')) return;

        const container = document.createElement("div");
        container.id = "zipCodeEntryUI";
        container.style.width = "240px";
        container.style.flex = "0 0 auto";
        container.style.marginLeft = "24px";
        container.style.padding = "16px";
        container.style.background = "white";
        container.style.border = "2px solid #333";
        container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

        const textarea = document.createElement("textarea");
        textarea.rows = 10;
        textarea.cols = 20;
        textarea.style.width = "100%";
        textarea.style.boxSizing = "border-box";
        textarea.placeholder = "Paste up to 20 zip codes,\none per line";
        textarea.style.display = "block";
        textarea.style.marginBottom = "8px";
        container.appendChild(textarea);

        const button = document.createElement("button");
        button.textContent = "Add Zip Codes";
        button.style.width = "100%";
        container.appendChild(button);

        const list = document.createElement("ul");
        list.id = "valueList";
        list.style.marginTop = "12px";
        list.style.paddingLeft = "18px";
        container.appendChild(list);

        // Insert the container right after the inner div, inside the flex parent
        flexParent.insertBefore(container, inner.nextSibling);

        let entryCount = 0;
        button.addEventListener("click", () => {
            const lines = textarea.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (lines.length === 0) return;

            let firstZip = null;
            for (const code of lines) {
                if (entryCount >= 20) break;
                const li = document.createElement("li");
                li.textContent = code;
                list.appendChild(li);
                entryCount++;
                if (firstZip === null) firstZip = code;
            }

            textarea.value = "";

            // Paste the first zip code into the search input
            if (firstZip) {
                const searchInput = document.getElementById("geoTargetingSearchInputId");
                if (searchInput) {
                    searchInput.focus();
                    searchInput.value = "";
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

                    // Simulate real typing using execCommand (works in most browsers)
                    for (const char of firstZip) {
                        // Set cursor at end
                        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
                        document.execCommand('insertText', false, char);
                        // Fire input event for React/Vue/Angular
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Optionally, blur and refocus to trigger any "onBlur" logic
                    searchInput.blur();
                    searchInput.focus();
                }
            }

            // Click Save Draft if 20 entries added
            if (entryCount >= 20) {
                const saveBtn = document.getElementById("saveDraftBtn");
                if (saveBtn) {
                    saveBtn.click();
                    entryCount = 0;
                    alert("20 entries added. Draft saved.");
                    list.innerHTML = "";
                }
            }
        });
    });
})();
