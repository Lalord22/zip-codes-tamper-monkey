// ==UserScript==
// @name         Auto Add Values to Test Page
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add values from clipboard to the test page
// @match        file:///*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const MAX_ENTRIES = 20;
    let entryCount = 0;

    // Create floating UI
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.padding = "10px";
    container.style.background = "white";
    container.style.border = "2px solid #333";
    container.style.zIndex = 9999;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Paste code here...";
    input.style.marginRight = "10px";
    container.appendChild(input);

    const button = document.createElement("button");
    button.textContent = "Paste and Add";
    container.appendChild(button);

    document.body.appendChild(container);

    button.addEventListener("click", async () => {
        // Paste from clipboard
        const text = await navigator.clipboard.readText();
        input.value = text;

        if (!text.trim()) return;

        // Add to list
        const list = document.getElementById("valueList");
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);

        input.value = "";
        entryCount++;

        // Click Save Draft if 20 entries added
        if (entryCount >= MAX_ENTRIES) {
            const saveBtn = document.getElementById("saveDraftBtn");
            if (saveBtn) {
                saveBtn.click();
                entryCount = 0; // reset
                alert("20 entries added. Draft saved.");
            }
        }
    });
})();
