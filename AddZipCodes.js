// ==UserScript==
// @name         Zip Code Entry UI
// @author       Gerardo Salazar
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Enter up to 20 zip codes and auto-save
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function renderUI(parent, sibling) {
        // Prevent duplicate UI
        if (document.getElementById('zipCodeEntryUI')) return;

        const container = document.createElement("div");
        container.id = "zipCodeEntryUI";
        container.style.width = "240px";
        container.style.marginLeft = "24px";
        container.style.padding = "16px";
        container.style.background = "white";
        container.style.border = "2px solid #333";
        container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        container.style.zIndex = 9999;

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

        if (parent && sibling) {
            parent.insertBefore(container, sibling.nextSibling);
        } else {
            // Fallback: fixed position
            container.style.position = "fixed";
            container.style.top = "24px";
            container.style.right = "24px";
            document.body.appendChild(container);
        }

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

                    for (const char of firstZip) {
                        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
                        document.execCommand('insertText', false, char);
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    searchInput.blur();
                    searchInput.focus();

                    // Wait for the "Include" button to appear, then click it
                    let attempts = 0;
                    const maxAttempts = 20; // 10 seconds max (20 * 500ms)
                    const interval = setInterval(() => {
                        const buttons = document.querySelectorAll('button.sc-storm-ui-20050465__sc-7di6d7-0.hsPBHj');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === "Include") {
                                btn.click();
                                clearInterval(interval);
                                return;
                            }
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                            clearInterval(interval);
                            console.warn('Include button not found after waiting.');
                        }
                    }, 500);

                    // After pasting the zip code, wait for the result div or "no results" message
                    let resultAttempts = 0;
                    const resultMaxAttempts = 40; // 20 seconds max (40 * 500ms)
                    const resultInterval = setInterval(() => {
                        // Get the selected country
                        const countryP = document.getElementById("country_0");
                        const selectedCountry = countryP ? countryP.textContent.trim() : null;

                        // Check for result divs
                        const resultDivs = document.querySelectorAll('div.sc-enHPVx.VQyKu');
                        for (const div of resultDivs) {
                            // Find the country in the result div (first <p>)
                            const countryInDiv = div.querySelector('p');
                            const countryText = countryInDiv ? countryInDiv.textContent.split('>')[0].trim() : null;

                            // Only click "Include" if country matches
                            if (countryText === selectedCountry) {
                                const includeBtn = div.querySelector('button.sc-storm-ui-20053392__sc-7di6d7-0.fiLRtv');
                                if (includeBtn && includeBtn.textContent.trim() === "Include") {
                                    includeBtn.click();
                                    clearInterval(resultInterval);
                                    return;
                                }
                            }
                        }
                        // Check for "no results" message
                        const noResultsDiv = document.querySelector('div.sc-bwsPYA.fbukVa');
                        if (noResultsDiv) {
                            clearInterval(resultInterval);
                            alert("No results found for this zip code.");
                            return;
                        }
                        resultAttempts++;
                        if (resultAttempts >= resultMaxAttempts) {
                            clearInterval(resultInterval);
                            console.warn('Result "Include" button or "no results" message not found after waiting.');
                        }
                    }, 500);
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
    }

    // Wait for the "Change" button, then start looking for flexParent and inner
    function waitForChangeButton() {
        const changeBtn = document.getElementById("geoTargetingChangeButton_0");
        if (changeBtn) {
            changeBtn.addEventListener("click", () => {
                // Start looking for flexParent and inner after "Change" is clicked
                let attempts = 0;
                const maxAttempts = 40; // 20 seconds max (40 * 500ms)
                const interval = setInterval(() => {
                    const flexParent = document.querySelector('div.sc-jDfIjF.xIVJD');
                    const inner = document.querySelector('div.sc-jhnTcL.cgMRHw');
                    if (flexParent && inner && inner.offsetParent !== null) {
                        clearInterval(interval);
                        renderUI(flexParent, inner);
                    }
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        console.warn('Could not find flexParent and inner div for Zip Code Entry UI.');
                    }
                }, 500);
            });
        } else {
            // Try again in 500ms if button not found yet
            setTimeout(waitForChangeButton, 500);
        }
    }

    waitForChangeButton();

})();
