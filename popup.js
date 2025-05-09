document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startMeasuring');
    const stopButton = document.getElementById('stopMeasuring');
    const resultDiv = document.getElementById('result');
    const distanceSpan = document.getElementById('distance');
    const horizontalSpan = document.getElementById('horizontal');
    const verticalSpan = document.getElementById('vertical');

    startButton.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) return;

            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: function() {
                    // 直接在页面上执行startMeasuring功能
                    const event = new CustomEvent('startMeasuring');
                    document.dispatchEvent(event);

                    // 向所有iframe发送开始测量的消息
                    try {
                        // 使用requestAnimationFrame延迟iframe消息发送
                        requestAnimationFrame(() => {
                            const iframes = document.querySelectorAll('iframe');
                            if (iframes.length === 0) return; // 如果没有iframe，提前退出

                            iframes.forEach(iframe => {
                                if (iframe.contentWindow) {
                                    iframe.contentWindow.postMessage({ action: 'startMeasuring' }, '*');
                                }
                            });
                        });
                    } catch(e) {
                        console.error('Error sending message to iframes:', e);
                    }
                }
            });
            window.close(); // 关闭弹出窗口，降低内存占用
        });
    });

    stopButton.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) return;

            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: function() {
                    // 直接在页面上执行stopMeasuring功能
                    const event = new CustomEvent('stopMeasuring');
                    document.dispatchEvent(event);

                    // 向所有iframe发送停止测量的消息
                    try {
                        // 使用requestAnimationFrame延迟iframe消息发送
                        requestAnimationFrame(() => {
                            const iframes = document.querySelectorAll('iframe');
                            if (iframes.length === 0) return; // 如果没有iframe，提前退出

                            iframes.forEach(iframe => {
                                if (iframe.contentWindow) {
                                    iframe.contentWindow.postMessage({ action: 'stopMeasuring' }, '*');
                                }
                            });
                        });
                    } catch(e) {
                        console.error('Error sending message to iframes:', e);
                    }
                }
            });
        });
    });

    // 监听content script的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateMeasurement') {
            distanceSpan.textContent = request.distance;
            horizontalSpan.textContent = request.horizontal;
            verticalSpan.textContent = request.vertical;
            resultDiv.style.display = 'block';
        }
    });
});
