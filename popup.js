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

window.addEventListener('message', function(event) {
    // 如果当前脚本运行在iframe中，直接return
    if (window.self !== window.top) return;
    // ...原有逻辑
});
