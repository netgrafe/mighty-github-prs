/* https://github.com/fregante/webext-permissions-events-polyfill @ v1.0.1 */

(function () {
    'use strict';

    const events = [
        ['request', 'onAdded'],
        ['remove', 'onRemoved']
    ];
    if (chrome.permissions && !chrome.permissions.onAdded) {
        for (const [action, event] of events) {
            const act = chrome.permissions[action];
            const listeners = new Set();
            chrome.permissions[event] = {
                addListener(callback) {
                    listeners.add(callback);
                }
            };
            chrome.permissions[action] = (permissions, callback) => {
                const initial = browser.permissions.contains(permissions);
                const expected = action === 'request';
                act(permissions, async (successful) => {
                    if (callback) {
                        callback(successful);
                    }
                    if (!successful) {
                        return;
                    }
                    if (await initial !== expected) {
                        const fullPermissions = { origins: [], permissions: [], ...permissions };
                        chrome.permissions.getAll(() => {
                            for (const listener of listeners) {
                                setTimeout(listener, 0, fullPermissions);
                            }
                        });
                    }
                });
            };
            browser.permissions[event] = chrome.permissions[event];
            browser.permissions[action] = async (permissions) => new Promise((resolve, reject) => {
                chrome.permissions[action](permissions, result => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    }
                    else {
                        resolve(result);
                    }
                });
            });
        }
    }

}());
