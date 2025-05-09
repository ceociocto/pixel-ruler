// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
    if (command === "start-measuring" || command === "stop-measuring") {
        // Get the currently active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                // Execute content script to send event
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (cmd) => {
                        // Trigger custom event in content script
                        const event = new CustomEvent(cmd === 'start-measuring' ? 'startMeasuring' : 'stopMeasuring');
                        document.dispatchEvent(event);

                        // Send message to all iframes
                        try {
                            // Use requestAnimationFrame to delay iframe message sending, reduce switching load
                            requestAnimationFrame(() => {
                                const iframes = document.querySelectorAll('iframe');
                                if (iframes.length === 0) return; // If no iframe, exit early

                                iframes.forEach(iframe => {
                                    if (iframe.contentWindow) {
                                        iframe.contentWindow.postMessage({
                                            action: cmd === 'start-measuring' ? 'startMeasuring' : 'stopMeasuring'
                                        }, '*');
                                    }
                                });
                            });
                        } catch(e) {
                            console.error('Error sending message to iframes:', e);
                        }
                    },
                    args: [command]
                });
            }
        });
    }
});
