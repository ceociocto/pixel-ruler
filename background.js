// 监听键盘快捷键命令
chrome.commands.onCommand.addListener((command) => {
    if (command === "start-measuring" || command === "stop-measuring") {
        // 获取当前激活的标签页
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                // 执行内容脚本发送事件
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (cmd) => {
                        // 触发内容脚本中的事件
                        const event = new CustomEvent(cmd === 'start-measuring' ? 'startMeasuring' : 'stopMeasuring');
                        document.dispatchEvent(event);

                        // 向所有iframe发送消息
                        try {
                            // 使用requestAnimationFrame延迟执行iframe消息发送，减少切换负载
                            requestAnimationFrame(() => {
                                const iframes = document.querySelectorAll('iframe');
                                if (iframes.length === 0) return; // 如果没有iframe，提前退出

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
