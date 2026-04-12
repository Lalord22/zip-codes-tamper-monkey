// ==UserScript==
// @name         Audience Entry UI
// @author       Gerardo Salazar
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enter up to 50 audience codes
// @match        https://advertising.amazon.com/dsp/*/oms/app/campaign/*/inventories/edit*
// @match        https://advertising.amazon.com/dsp/*/oms/app/inventory/*/settings*
// @match        https://advertising.amazon.uk/dsp/*/oms/app/campaign/*/inventories/edit*
// @match        https://advertising.amazon.uk/dsp/*/oms/app/inventory/*/settings*
// @match        https://advertising.amazon.jp/dsp/*/oms/app/campaign/*/inventories/edit*
// @match        https://advertising.amazon.jp/dsp/*/oms/app/inventory/*/settings*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    let isRenderPaused = false;
    let detachAnchorTracking = null;
    const MAP_STORAGE_KEY = 'audience-map-json-v1';

    // Audience code → exact audience path text to match in results
    const AUDIENCE_MAP = {
        "42624": "In-Market > Household & Grocery > IM - Off-Amazon Toothpaste Shoppers",
        "42626": "In-Market > Collectibles & Fine Art > IM - Decorative Collectibles",
        // Add more mappings here:
        // "CODE": "Category > Subcategory > Audience Name",
    };
    let importedAudienceMap = null;

    function normalizeAudienceMap(rawMap) {
        if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
            return null;
        }

        const normalized = {};
        for (const [key, value] of Object.entries(rawMap)) {
            const code = String(key || '').trim();
            const path = String(value || '').trim();
            if (code && path) {
                normalized[code] = path;
            }
        }

        return Object.keys(normalized).length > 0 ? normalized : null;
    }

    function getActiveAudienceMap() {
        return importedAudienceMap || AUDIENCE_MAP;
    }

    function loadStoredAudienceMap() {
        if (typeof GM_getValue !== 'function') {
            return;
        }

        try {
            const stored = GM_getValue(MAP_STORAGE_KEY, '');
            if (!stored) {
                return;
            }

            const parsed = JSON.parse(stored);
            const normalized = normalizeAudienceMap(parsed);
            if (normalized) {
                importedAudienceMap = normalized;
            }
        } catch (error) {
            console.warn('Failed to load stored audience map.', error);
        }
    }

    function registerAudienceMapMenu() {
        if (typeof GM_registerMenuCommand !== 'function') {
            return;
        }

        const importMapObject = (parsed) => {
            const normalized = normalizeAudienceMap(parsed);
            if (!normalized) {
                alert('Invalid JSON. Expected an object: { "42624": "Path > To > Audience" }');
                return false;
            }

            importedAudienceMap = normalized;
            let persisted = false;
            if (typeof GM_setValue === 'function') {
                try {
                    GM_setValue(MAP_STORAGE_KEY, JSON.stringify(normalized));
                    persisted = true;
                } catch (error) {
                    console.warn('Audience map imported in memory, but could not be persisted to Tampermonkey storage.', error);
                }
            }

            if (persisted) {
                alert(`Imported ${Object.keys(normalized).length} audience mappings.\nSource is now Imported JSON (persisted).`);
            } else {
                alert(`Imported ${Object.keys(normalized).length} audience mappings.\nRunning from memory for this tab only (storage limit or save blocked).`);
            }
            return true;
        };

        GM_registerMenuCommand('Import Audience JSON (File)', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,application/json,text/plain';

            fileInput.addEventListener('change', () => {
                const selectedFile = fileInput.files && fileInput.files[0];
                if (!selectedFile) {
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const text = String(reader.result || '');
                        const parsed = JSON.parse(text);
                        importMapObject(parsed);
                    } catch (error) {
                        alert('Could not parse JSON file. Please validate audiences-map.json format and try again.');
                    }
                };
                reader.onerror = () => {
                    alert('Could not read selected file. Please try again.');
                };
                reader.readAsText(selectedFile, 'utf-8');
            }, { once: true });

            fileInput.click();
        });

        GM_registerMenuCommand('Clear Imported Audience JSON', () => {
            importedAudienceMap = null;
            if (typeof GM_setValue === 'function') {
                GM_setValue(MAP_STORAGE_KEY, '');
            }
            alert('Imported audience mappings cleared. Using inline AUDIENCE_MAP.');
        });

        GM_registerMenuCommand('Show Active Mapping Source', () => {
            const map = getActiveAudienceMap();
            const source = importedAudienceMap ? 'Imported JSON' : 'Inline AUDIENCE_MAP';
            let persistedNote = '';
            if (typeof GM_getValue === 'function') {
                try {
                    const stored = GM_getValue(MAP_STORAGE_KEY, '');
                    persistedNote = stored ? '\nStored copy: yes' : '\nStored copy: no';
                } catch (error) {
                    persistedNote = '\nStored copy: unknown';
                }
            }
            alert(`${source}\nEntries: ${Object.keys(map).length}${persistedNote}`);
        });
    }

    loadStoredAudienceMap();
    registerAudienceMapMenu();

    function setNativeInputValue(input, value) {
        const ownDescriptor = Object.getOwnPropertyDescriptor(input, 'value');
        const prototype = Object.getPrototypeOf(input);
        const prototypeDescriptor = prototype
            ? Object.getOwnPropertyDescriptor(prototype, 'value')
            : null;

        if (prototypeDescriptor && prototypeDescriptor.set) {
            prototypeDescriptor.set.call(input, value);
        } else if (ownDescriptor && ownDescriptor.set) {
            ownDescriptor.set.call(input, value);
        } else {
            input.value = value;
        }

        try {
            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                data: value,
                inputType: 'insertText'
            }));
        } catch (error) {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findRenderTarget() {
        const audienceFeeColumn = Array.from(document.querySelectorAll('div.a-column.a-span5.a-span-last'))
            .find((col) => {
                const heading = col.querySelector('h5');
                return heading && heading.textContent && heading.textContent.trim().toLowerCase() === 'audience fee';
            });
        if (audienceFeeColumn && audienceFeeColumn.offsetParent !== null && audienceFeeColumn.parentElement) {
            const heading = audienceFeeColumn.querySelector('h5');
            const headerRow = heading ? heading.closest('div[style*="justify-content: space-between"]') : null;
            const topAnchor = headerRow || heading || audienceFeeColumn;
            return { parent: audienceFeeColumn.parentElement, sibling: audienceFeeColumn, anchor: audienceFeeColumn, topAnchor };
        }

        const searchInput = document.getElementById("test:quickFilter:input");
        if (searchInput && searchInput.offsetParent !== null) {
            const sibling = searchInput.closest("div");
            const parent = sibling ? sibling.parentElement : null;
            if (parent && sibling) {
                return { parent, sibling, anchor: null };
            }
        }

        const container = document.querySelector('div.sc-storm-ui-20059654__sc-1ofhy6d-0.edFtWy');
        const inner = document.querySelector('div.sc-storm-ui-20059654__sc-1ofhy6d-1.eKyPWa');
        if (container && inner && inner.offsetParent !== null) {
            return { parent: container, sibling: inner, anchor: null, topAnchor: null };
        }

        return { parent: null, sibling: null, anchor: null, topAnchor: null };
    }

    function tryRenderUI() {
        if (isRenderPaused) {
            return false;
        }

        if (document.getElementById('audienceEntryUI')) {
            return true;
        }

        const { parent, sibling, anchor, topAnchor } = findRenderTarget();
        if (parent && sibling) {
            renderUI(parent, sibling, anchor, topAnchor);
            return true;
        }

        const searchInput = document.getElementById("test:quickFilter:input");
        if (searchInput && searchInput.offsetParent !== null) {
            renderUI(null, null, null, null);
            return true;
        }

        return false;
    }

    function watchForAudienceUI() {
        if (tryRenderUI()) {
            return;
        }

        let attempts = 0;
        const maxAttempts = 40;

        const observer = new MutationObserver(() => {
            if (tryRenderUI()) {
                clearInterval(interval);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const interval = setInterval(() => {
            if (tryRenderUI()) {
                clearInterval(interval);
                observer.disconnect();
                return;
            }

            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                observer.disconnect();
                console.warn('Could not find inline location for Audience Entry UI. Rendering fixed fallback if possible.');

                const searchInput = document.getElementById("test:quickFilter:input");
                if (searchInput && searchInput.offsetParent !== null) {
                    renderUI(null, null, null, null);
                }
            }
        }, 500);
    }

    function attachAnchorTracking(container, anchor, topAnchor) {
        if (!container || !anchor) {
            return;
        }

        if (detachAnchorTracking) {
            detachAnchorTracking();
        }

        const updatePosition = () => {
            if (!document.body.contains(container)) {
                if (detachAnchorTracking) {
                    detachAnchorTracking();
                    detachAnchorTracking = null;
                }
                return;
            }

            const anchorRect = anchor.getBoundingClientRect();
            const topRect = (topAnchor || anchor).getBoundingClientRect();
            container.style.top = `${Math.max(8, topRect.top)}px`;
            container.style.left = `${Math.min(window.innerWidth - 260, anchorRect.right + 12)}px`;
        };

        const onScrollOrResize = () => updatePosition();

        window.addEventListener('resize', onScrollOrResize);
        document.addEventListener('scroll', onScrollOrResize, true);

        updatePosition();

        detachAnchorTracking = () => {
            window.removeEventListener('resize', onScrollOrResize);
            document.removeEventListener('scroll', onScrollOrResize, true);
        };
    }

    function renderUI(parent, sibling, anchor, topAnchor) {
        if (document.getElementById('audienceEntryUI')) return;

        const container = document.createElement("div");
        container.id = "audienceEntryUI";
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
        textarea.placeholder = "Paste up to 50 audience codes,\none per line";
        textarea.style.display = "block";
        textarea.style.marginBottom = "8px";
        container.appendChild(textarea);

        const button = document.createElement("button");
        button.textContent = "Add Audiences";
        button.style.width = "100%";
        container.appendChild(button);

        const title = document.createElement("div");
        title.textContent = "Codes not found / no match:";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "4px";
        title.style.marginTop = "12px";
        container.appendChild(title);

        const list = document.createElement("ul");
        list.id = "audienceValueList";
        list.style.maxHeight = "100px";
        list.style.overflowY = "auto";
        list.style.border = "1px solid #ccc";
        list.style.padding = "8px";
        list.style.background = "#f9f9f9";
        container.appendChild(list);

        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            const topRect = (topAnchor || anchor).getBoundingClientRect();
            container.style.position = "fixed";
            container.style.top = `${Math.max(8, topRect.top)}px`;
            container.style.left = `${Math.min(window.innerWidth - 260, rect.right + 12)}px`;
            container.style.marginLeft = "0";
            container.style.zIndex = "99999";
            document.body.appendChild(container);
            attachAnchorTracking(container, anchor, topAnchor);
        } else if (parent && sibling) {
            if (detachAnchorTracking) {
                detachAnchorTracking();
                detachAnchorTracking = null;
            }
            parent.insertBefore(container, sibling.nextSibling);
        } else {
            if (detachAnchorTracking) {
                detachAnchorTracking();
                detachAnchorTracking = null;
            }
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

            textarea.value = "";
            list.innerHTML = "";
            entryCount = 0;

            function processAudience(index) {
                if (index >= lines.length || entryCount >= 50) {
                    if (entryCount >= 50) {
                        const saveBtn = document.getElementById("saveDraftBtn");
                        if (saveBtn) {
                            saveBtn.click();
                            entryCount = 0;
                            alert("50 entries added. Draft saved.");
                        }
                    }
                    return;
                }

                const code = lines[index];
                const expectedPath = getActiveAudienceMap()[code];

                if (!expectedPath) {
                    // Code not in map — add to not-found list immediately
                    const li = document.createElement("li");
                    li.textContent = `${code} (not in map)`;
                    list.appendChild(li);
                    setTimeout(() => processAudience(index + 1), 300);
                    return;
                }

                const searchInput = document.getElementById("test:quickFilter:input");
                if (!searchInput) {
                    console.warn('Behavioral targeting search input not found.');
                    return;
                }

                searchInput.focus();
                setNativeInputValue(searchInput, code);

                const enterEventOptions = {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                };
                searchInput.dispatchEvent(new KeyboardEvent("keydown", enterEventOptions));
                searchInput.dispatchEvent(new KeyboardEvent("keypress", enterEventOptions));
                searchInput.dispatchEvent(new KeyboardEvent("keyup", enterEventOptions));

                searchInput.blur();
                searchInput.focus();

                let resultAttempts = 0;
                const resultMaxAttempts = 20;
                let noMatchRowCycles = 0;

                const resultInterval = setInterval(() => {
                    // Detect AG Grid "No Rows To Show" overlay immediately
                    const noRowsOverlay = document.querySelector('.ag-overlay-no-rows-wrapper');
                    if (noRowsOverlay) {
                        clearInterval(resultInterval);
                        const li = document.createElement("li");
                        li.textContent = code;
                        list.appendChild(li);
                        setTimeout(() => processAudience(index + 1), 300);
                        return;
                    }

                    const resultRows = document.querySelectorAll('div.ag-row[role="row"]');
                    let included = false;
                    let foundDisabled = false;
                    let foundMatchingRow = false;

                    for (const row of resultRows) {
                        const pathCell = row.querySelector('div[col-id="targetingName"]');
                        const pathText = pathCell ? pathCell.textContent.trim().replace(/\s+/g, ' ') : "";
                        const normalizedExpectedPath = expectedPath.trim().replace(/\s+/g, ' ');

                        if (pathText === normalizedExpectedPath) {
                            foundMatchingRow = true;
                            const actionControl = row.querySelector('div[col-id="selected"] div[role="button"]');
                            const actionBtn = row.querySelector('div[col-id="selected"] button');

                            if (actionControl || actionBtn) {
                                if (actionBtn && actionBtn.disabled) {
                                    foundDisabled = true;
                                    break;
                                }
                                const btnText = actionBtn ? actionBtn.textContent.trim() : "";
                                if (btnText === "Include" || btnText === "Exclude") {
                                    if (actionBtn) {
                                        actionBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                                        actionBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                                        actionBtn.click();
                                    }
                                    if (!actionBtn && actionControl) {
                                        actionControl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                                        actionControl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                                        actionControl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                                    }
                                    included = true;
                                    entryCount++;
                                    break;
                                }
                            }
                        }
                    }

                    if (included || foundDisabled) {
                        clearInterval(resultInterval);
                        setTimeout(() => processAudience(index + 1), 1000);
                        return;
                    }

                    const noResultsDiv = document.querySelector('div.sc-bwsPYA.fbukVa');
                    if (noResultsDiv) {
                        clearInterval(resultInterval);
                        const li = document.createElement("li");
                        li.textContent = code;
                        list.appendChild(li);
                        setTimeout(() => processAudience(index + 1), 300);
                        return;
                    }

                    if (resultRows.length > 0 && !foundMatchingRow) {
                        noMatchRowCycles++;
                        if (noMatchRowCycles >= 8) {
                            clearInterval(resultInterval);
                            const li = document.createElement("li");
                            li.textContent = code;
                            list.appendChild(li);
                            setTimeout(() => processAudience(index + 1), 300);
                            return;
                        }
                    } else {
                        noMatchRowCycles = 0;
                    }

                    resultAttempts++;
                    if (resultAttempts >= resultMaxAttempts) {
                        clearInterval(resultInterval);
                        console.warn(`Timed out waiting for results for code: ${code}`);
                        const li = document.createElement("li");
                        li.textContent = foundMatchingRow ? `${code} (found row, include failed)` : `${code} (timeout)`;
                        list.appendChild(li);
                        setTimeout(() => processAudience(index + 1), 300);
                    }
                }, 300);
            }

            processAudience(0);
        });
    }

    document.addEventListener("click", (event) => {
        const clickedButton = event.target.closest("button");
        const buttonText = clickedButton && clickedButton.textContent ? clickedButton.textContent.trim() : "";
        if (clickedButton && clickedButton.type === "button" && (buttonText === "Save Changes" || buttonText === "Cancel")) {
            isRenderPaused = true;
            const ui = document.getElementById("audienceEntryUI");
            if (ui) {
                ui.remove();
            }
            if (detachAnchorTracking) {
                detachAnchorTracking();
                detachAnchorTracking = null;
            }
            return;
        }

        const changeBtn = event.target.closest("#behavioralTargetingChangeButton_0");
        if (changeBtn) {
            isRenderPaused = false;
            setTimeout(watchForAudienceUI, 0);
        }
    }, true);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            if (document.getElementById("test:quickFilter:input")) {
                watchForAudienceUI();
            }
        }, { once: true });
    } else if (document.getElementById("test:quickFilter:input")) {
        watchForAudienceUI();
    }

})();
