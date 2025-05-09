// Global variables
let measuring = false;
let firstElement = null;
let secondElement = null;
let marker1 = null;
let marker2 = null;
let line = null;
let label = null;
let permanentRulers = []; // Store all permanent rulers
let parentOrigin = window !== window.top ? window.parent.origin : null; // If running in iframe, record parent
let lastMouseOverTime = 0; // Mouse throttle for iframe
const THROTTLE_DELAY = 30; // Mouse move throttle delay, about 33fps
let hoverElementCache = null; // Cache last hovered element to avoid duplicate highlight
let ruler = null; // Temporary ruler global variable
let rulerButtonContainer = null;

// 监听自定义事件
document.addEventListener('startMeasuring', function() {
    console.log('Start measuring event received...');
    startMeasuring();
});

document.addEventListener('stopMeasuring', function() {
    console.log('Stop measuring event received');
    stopMeasuring();
});

// 监听iframe之间的消息传递
window.addEventListener('message', function(event) {
    if (event.data.action === 'startMeasuring') {
        console.log('Start measuring message received from parent frame');
        startMeasuring();
    } else if (event.data.action === 'stopMeasuring') {
        console.log('Stop measuring message received from parent frame');
        stopMeasuring();
    }
});

// 监听background script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'startMeasuring') {
        console.log('Start measuring message received');
        startMeasuring();
    } else if (request.action === 'stopMeasuring') {
        console.log('Stop measuring message received');
        stopMeasuring();
    }
});

function showRulerButtons() {
    if (rulerButtonContainer) return;
    rulerButtonContainer = document.createElement('div');
    rulerButtonContainer.style.position = 'fixed';
    rulerButtonContainer.style.right = '32px';
    rulerButtonContainer.style.bottom = '32px';
    rulerButtonContainer.style.zIndex = '100001';
    rulerButtonContainer.style.display = 'flex';
    rulerButtonContainer.style.flexDirection = 'column';
    rulerButtonContainer.style.gap = '12px';

    // Undo button
    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo Last';
    undoBtn.style.padding = '8px 16px';
    undoBtn.style.background = '#fff';
    undoBtn.style.border = '1px solid #2196F3';
    undoBtn.style.color = '#2196F3';
    undoBtn.style.borderRadius = '6px';
    undoBtn.style.fontSize = '14px';
    undoBtn.style.cursor = 'pointer';
    undoBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    undoBtn.onclick = function() {
        if (permanentRulers.length > 0) {
            const last = permanentRulers.pop();
            if (last.marker1) last.marker1.remove();
            if (last.marker2) last.marker2.remove();
            if (last.line) last.line.remove();
            if (last.label) last.label.remove();
        }
    };

    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All';
    clearBtn.style.padding = '8px 16px';
    clearBtn.style.background = '#fff';
    clearBtn.style.border = '1px solid #F44336';
    clearBtn.style.color = '#F44336';
    clearBtn.style.borderRadius = '6px';
    clearBtn.style.fontSize = '14px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    clearBtn.onclick = function() {
        removeAllMarkers();
        permanentRulers.length = 0;
    };

    rulerButtonContainer.appendChild(undoBtn);
    rulerButtonContainer.appendChild(clearBtn);
    document.body.appendChild(rulerButtonContainer);
}

function hideRulerButtons() {
    if (rulerButtonContainer) {
        rulerButtonContainer.remove();
        rulerButtonContainer = null;
    }
}

function startMeasuring() {
    if (measuring) return; // Avoid duplicate start
    measuring = true;
    document.body.style.cursor = 'crosshair';
    removeAllMarkers();
    document.removeEventListener('click', handleClick);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', preventDefault);
    document.addEventListener('click', handleClick, { passive: false });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', preventDefault, { passive: false });
    showRulerButtons();
    console.log('Measuring mode started');
}

function stopMeasuring() {
    if (!measuring) return;
    measuring = false;
    document.body.style.cursor = '';
    removeAllMarkers();
    document.removeEventListener('click', handleClick);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', preventDefault);
    hideRulerButtons();
    console.log('Measuring mode stopped');
}

function handleClick(e) {
    if (!measuring) return;
    if (!firstElement) {
        // Hide all markers to avoid blocking
        document.querySelectorAll('.chrome-ruler-marker').forEach(el => el.style.display = 'none');
        firstElement = document.elementFromPoint(e.clientX, e.clientY);
        document.querySelectorAll('.chrome-ruler-marker').forEach(el => el.style.display = '');
        marker1 = createMarker(firstElement, 'first');
    } else {
        // Hide all markers to avoid blocking
        document.querySelectorAll('.chrome-ruler-marker').forEach(el => el.style.display = 'none');
        secondElement = document.elementFromPoint(e.clientX, e.clientY);
        document.querySelectorAll('.chrome-ruler-marker').forEach(el => el.style.display = '');
        marker2 = createMarker(secondElement, 'second');
        line = createLine(marker1, marker2);
        label = createLabel(marker1, marker2, line);
        permanentRulers.push({ marker1, marker2, line, label });
        // Remove temporary ruler
        if (ruler) {
            ruler.remove();
            ruler = null;
        }
        // Reset state for next measurement
        firstElement = null;
        secondElement = null;
        marker1 = null;
        marker2 = null;
        line = null;
        label = null;
        document.body.style.cursor = 'crosshair';
        console.log('Measurement finished, waiting for next measurement');
    }
}

function handleMouseMove(event) {
    if (!measuring) return;

    // 应用节流技术，限制事件处理频率
    const now = Date.now();
    if (now - lastMouseOverTime < THROTTLE_DELAY) return;
    lastMouseOverTime = now;

    // 获取当前鼠标指向的元素
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return;

    // 高亮显示当前鼠标指向的元素
    createHoverMarker(element);

    // 如果已经选择了第一个元素但还没有选择第二个元素，则更新临时标尺
    if (firstElement && !secondElement) {
        const measurements = calculateDistance(firstElement, element);
        updateTemporaryRuler(measurements, event);
    }
}

function preventDefault(e) {
    e.preventDefault();
}

function removeAllMarkers() {
    // Remove all markers and rulers
    const markers = document.querySelectorAll('.chrome-ruler-marker, .chrome-ruler-line, .chrome-ruler-permanent, .chrome-ruler-label');
    markers.forEach(marker => marker.remove());
    // Reset variables
    firstElement = null;
    secondElement = null;
    marker1 = null;
    marker2 = null;
    ruler = null;
    hoverMarker = null;
}

function createMarker(element, type) {
    // Create marker element
    const rect = element.getBoundingClientRect();
    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = (window.scrollX + rect.left) + 'px';
    marker.style.top = (window.scrollY + rect.top) + 'px';
    marker.style.width = rect.width + 'px';
    marker.style.height = rect.height + 'px';
    marker.style.border = '2px solid ' + (type === 'first' ? '#FFA801' : '#2196F3');
    marker.style.backgroundColor = (type === 'first' ? 'rgba(255, 64, 129, 0.2)' : 'rgba(33, 150, 243, 0.2)');
    marker.style.zIndex = '99996';
    marker.style.pointerEvents = 'none';
    marker.className = 'chrome-ruler-marker';

    document.body.appendChild(marker);
    if (type === 'first') {
        marker1 = marker;
    } else {
        marker2 = marker;
    }
    return marker;
}

function calculateDistance(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    // 计算最近水平距离
    const leftToRight = Math.abs(rect1.right - rect2.left);
    const rightToLeft = Math.abs(rect2.right - rect1.left);
    // 计算最近垂直距离
    const topToBottom = Math.abs(rect1.bottom - rect2.top);
    const bottomToTop = Math.abs(rect2.bottom - rect1.top);
    const horizontal = Math.min(leftToRight, rightToLeft);
    const vertical = Math.min(topToBottom, bottomToTop);
    return { horizontal, vertical, distance: Math.sqrt(horizontal * horizontal + vertical * vertical) };
}

function getNearestHorizontalPoints(rect1, rect2) {
    const leftToRight = Math.abs(rect1.right - rect2.left);
    const rightToLeft = Math.abs(rect2.right - rect1.left);
    if (leftToRight < rightToLeft) {
        return {
            start: { x: rect1.right, y: rect1.top + rect1.height / 2 },
            end: { x: rect2.left, y: rect2.top + rect2.height / 2 }
        };
    } else {
        return {
            start: { x: rect2.right, y: rect2.top + rect2.height / 2 },
            end: { x: rect1.left, y: rect1.top + rect1.height / 2 }
        };
    }
}

function getNearestVerticalPoints(rect1, rect2) {
    const topToBottom = Math.abs(rect1.bottom - rect2.top);
    const bottomToTop = Math.abs(rect2.bottom - rect1.top);
    if (topToBottom < bottomToTop) {
        return {
            start: { x: rect1.left + rect1.width / 2, y: rect1.bottom },
            end: { x: rect2.left + rect2.width / 2, y: rect2.top }
        };
    } else {
        return {
            start: { x: rect2.left + rect2.width / 2, y: rect2.bottom },
            end: { x: rect1.left + rect1.width / 2, y: rect1.top }
        };
    }
}

function createLine(marker1, marker2) {
    const rect1 = marker1.getBoundingClientRect();
    const rect2 = marker2.getBoundingClientRect();
    const dx = Math.abs(rect1.right - rect2.left);
    const dx2 = Math.abs(rect2.right - rect1.left);
    const dy = Math.abs(rect1.bottom - rect2.top);
    const dy2 = Math.abs(rect2.bottom - rect1.top);
    const minH = Math.min(dx, dx2);
    const minV = Math.min(dy, dy2);
    const line = document.createElement('div');
    line.className = 'chrome-ruler-line';
    line.style.position = 'absolute';
    if (minH <= minV) {
        // 水平线，连接最近的水平边
        const { start, end } = getNearestHorizontalPoints(rect1, rect2);
        line.style.left = (window.scrollX + Math.min(start.x, end.x)) + 'px';
        line.style.top = (window.scrollY + start.y) + 'px';
        line.style.width = Math.abs(start.x - end.x) + 'px';
        line.style.height = '2px';
        line.style.transform = 'none';
    } else {
        // 垂直线，连接最近的垂直边
        const { start, end } = getNearestVerticalPoints(rect1, rect2);
        line.style.left = (window.scrollX + start.x) + 'px';
        line.style.top = (window.scrollY + Math.min(start.y, end.y)) + 'px';
        line.style.width = '2px';
        line.style.height = Math.abs(start.y - end.y) + 'px';
        line.style.transform = 'none';
    }
    line.style.border = '1px dashed #0f0';
    line.style.zIndex = 99999;
    document.body.appendChild(line);
    return line;
}

function createLabel(marker1, marker2, line) {
    const rect1 = marker1.getBoundingClientRect();
    const rect2 = marker2.getBoundingClientRect();
    const dx = Math.abs(rect1.right - rect2.left);
    const dx2 = Math.abs(rect2.right - rect1.left);
    const dy = Math.abs(rect1.bottom - rect2.top);
    const dy2 = Math.abs(rect2.bottom - rect1.top);
    const minH = Math.min(dx, dx2);
    const minV = Math.min(dy, dy2);
    const label = document.createElement('div');
    label.className = 'chrome-ruler-label';
    label.style.position = 'absolute';
    label.style.background = '#1976D2';
    label.style.color = '#fff';
    label.style.padding = '6px 16px';
    label.style.borderRadius = '12px';
    label.style.fontSize = '18px';
    label.style.fontWeight = 'bold';
    label.style.zIndex = '100000';
    label.style.border = '2px solid #fff';
    label.style.boxShadow = '0 2px 12px rgba(25, 118, 210, 0.25)';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '12px';
    // Highlight numbers, gray px
    label.innerHTML = `H: <span style="color:#FFEB3B;">${minH}</span><span style="color:#bbb;font-size:14px;font-weight:normal;">px</span>, V: <span style="color:#FFEB3B;">${minV}</span><span style="color:#bbb;font-size:14px;font-weight:normal;">px</span>`;
    if (minH <= minV) {
        // Horizontal, label centered on the line
        const { start, end } = getNearestHorizontalPoints(rect1, rect2);
        label.style.left = (window.scrollX + ((start.x + end.x) / 2 - 40)) + 'px';
        label.style.top = (window.scrollY + (start.y - 36)) + 'px';
    } else {
        // Vertical, label centered on the line
        const { start, end } = getNearestVerticalPoints(rect1, rect2);
        label.style.left = (window.scrollX + start.x + 16) + 'px';
        label.style.top = (window.scrollY + ((start.y + end.y) / 2 - 18)) + 'px';
    }
    document.body.appendChild(label);
    return label;
}

function updateTemporaryRuler(measurements, event) {
    if (!ruler) {
        ruler = document.createElement('div');
        ruler.className = 'chrome-ruler-line';
        ruler.style.position = 'absolute';
        ruler.style.backgroundColor = 'rgba(25, 118, 210, 0.2)';
        ruler.style.zIndex = '99998';
        ruler.style.transformOrigin = 'top left';
        ruler.style.pointerEvents = 'none';
        const label = document.createElement('div');
        label.className = 'chrome-ruler-label';
        label.style.position = 'absolute';
        label.style.background = '#1976D2';
        label.style.color = '#fff';
        label.style.padding = '6px 16px';
        label.style.borderRadius = '12px';
        label.style.fontSize = '18px';
        label.style.fontWeight = 'bold';
        label.style.zIndex = 100000;
        label.style.border = '2px solid #fff';
        label.style.boxShadow = '0 2px 12px rgba(25, 118, 210, 0.25)';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '12px';
        ruler.appendChild(label);
        document.body.appendChild(ruler);
    }
    const rect1 = firstElement.getBoundingClientRect();
    const currentElement = document.elementFromPoint(event.clientX, event.clientY);
    const rect2 = currentElement.getBoundingClientRect();
    const dx = Math.abs(rect1.right - rect2.left);
    const dx2 = Math.abs(rect2.right - rect1.left);
    const dy = Math.abs(rect1.bottom - rect2.top);
    const dy2 = Math.abs(rect2.bottom - rect1.top);
    const minH = Math.min(dx, dx2);
    const minV = Math.min(dy, dy2);
    let isHorizontal = minH <= minV;
    if (isHorizontal) {
        const { start, end } = getNearestHorizontalPoints(rect1, rect2);
        ruler.style.left = (window.scrollX + Math.min(start.x, end.x)) + 'px';
        ruler.style.top = (window.scrollY + start.y) + 'px';
        ruler.style.width = Math.abs(start.x - end.x) + 'px';
        ruler.style.height = '2px';
        ruler.style.transform = 'none';
    } else {
        const { start, end } = getNearestVerticalPoints(rect1, rect2);
        ruler.style.left = (window.scrollX + start.x) + 'px';
        ruler.style.top = (window.scrollY + Math.min(start.y, end.y)) + 'px';
        ruler.style.width = '2px';
        ruler.style.height = Math.abs(start.y - end.y) + 'px';
        ruler.style.transform = 'none';
    }
    const label = ruler.querySelector('.chrome-ruler-label');
    label.innerHTML = `H: <span style=\"color:#FFEB3B;\">${minH}</span><span style=\"color:#bbb;font-size:14px;font-weight:normal;\">px</span>, V: <span style=\"color:#FFEB3B;\">${minV}</span><span style=\"color:#bbb;font-size:14px;font-weight:normal;\">px</span>`;
    if (isHorizontal) {
        const { start, end } = getNearestHorizontalPoints(rect1, rect2);
        label.style.left = (Math.abs(start.x - end.x) / 2 - 40) + 'px';
        label.style.top = '-36px';
    } else {
        const { start, end } = getNearestVerticalPoints(rect1, rect2);
        label.style.left = '16px';
        label.style.top = (Math.abs(start.y - end.y) / 2 - 18) + 'px';
    }
}

function displayMeasurement(measurements) {
    // 先移除临时标尺
    if (ruler) {
        ruler.remove();
        ruler = null;
    }
    // Draw final ruler
    drawRuler(measurements);
    // 发送测量结果到 popup
    chrome.runtime.sendMessage({
        action: 'updateMeasurement',
        distance: measurements.distance,
        horizontal: measurements.horizontal,
        vertical: measurements.vertical
    });
}

function drawRuler(measurements) {
    // 移除旧的永久标尺
    const oldRulers = document.querySelectorAll('.chrome-ruler-permanent');
    oldRulers.forEach(ruler => ruler.remove());
    const rect1 = firstElement.getBoundingClientRect();
    const rect2 = secondElement.getBoundingClientRect();
    let startPoint = { x: 0, y: 0 };
    let endPoint = { x: 0, y: 0 };
    let isVertical = false;
    // 水平方式
    if (measurements.horizontal > 0 && measurements.vertical === 0) {
        if (rect2.left > rect1.right) {
            startPoint.x = window.scrollX + rect1.right;
            endPoint.x = window.scrollX + rect2.left;
        } else {
            startPoint.x = window.scrollX + rect2.right;
            endPoint.x = window.scrollX + rect1.left;
        }
        startPoint.y = window.scrollY + rect1.top + rect1.height / 2;
        endPoint.y = window.scrollY + rect2.top + rect2.height / 2;
        isVertical = false;
    } else if (measurements.vertical > 0 && measurements.horizontal === 0) {
        if (rect2.top > rect1.bottom) {
            startPoint.y = window.scrollY + rect1.bottom;
            endPoint.y = window.scrollY + rect2.top;
        } else {
            startPoint.y = window.scrollY + rect2.bottom;
            endPoint.y = window.scrollY + rect1.top;
        }
        startPoint.x = window.scrollX + rect1.left + rect1.width / 2;
        endPoint.x = window.scrollX + rect2.left + rect2.width / 2;
        isVertical = true;
    } else {
        startPoint.x = window.scrollX + rect1.left + rect1.width / 2;
        endPoint.x = window.scrollX + rect2.left + rect2.width / 2;
        startPoint.y = window.scrollY + rect1.top + rect1.height / 2;
        endPoint.y = window.scrollY + rect2.top + rect2.height / 2;
    }
    // 兼容主方向
    isVertical = Math.abs(endPoint.y - startPoint.y) > Math.abs(endPoint.x - startPoint.x);
    // 计算长度和夹角
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    // 创建永久标尺
    const permanentRuler = document.createElement('div');
    permanentRuler.className = 'chrome-ruler-permanent';
    permanentRuler.style.position = 'absolute';
    permanentRuler.style.backgroundColor = 'rgba(255, 193, 7, 0.8)';
    permanentRuler.style.zIndex = '99998';
    permanentRuler.style.transformOrigin = 'top left';
    permanentRuler.style.pointerEvents = 'none';
    if (isVertical) {
        permanentRuler.style.width = '2px';
        permanentRuler.style.height = distance + 'px';
        permanentRuler.style.transform = 'none';
    } else {
        permanentRuler.style.height = '2px';
        permanentRuler.style.width = distance + 'px';
        permanentRuler.style.transform = `rotate(${angle}rad)`;
    }
    permanentRuler.style.left = startPoint.x + 'px';
    permanentRuler.style.top = startPoint.y + 'px';
    // 添加标签
    const label = document.createElement('div');
    label.className = 'chrome-ruler-label';
    label.style.backgroundColor = '#FFC107';
    label.style.color = 'black';
    label.style.padding = '2px 5px';
    label.style.borderRadius = '2px';
    label.style.fontSize = '12px';
    label.style.zIndex = '10000';
    label.style.pointerEvents = 'none';
    label.style.transform = `rotate(0deg)`; // 保持标签始终水平
    label.style.whiteSpace = 'nowrap'; // 防止文字折行
    label.textContent = `${measurements.distance}px (H: ${measurements.horizontal}px, V: ${measurements.vertical}px)`;
    // 标签居中显示在标尺中点
    let labelLeft, labelTop;
    if (isVertical) {
        labelLeft = 0;
        labelTop = distance / 2 - (label.offsetHeight / 2);
    } else {
        labelLeft = distance / 2 - (label.offsetWidth / 2);
        labelTop = -label.offsetHeight - 5;
    }
    label.style.left = labelLeft + 'px';
    label.style.top = labelTop + 'px';
    permanentRuler.appendChild(label);
    document.body.appendChild(permanentRuler);
}

function preventDefault(e) {
    if (measuring) {
        e.preventDefault();
        return false;
    }
}

function createHoverMarker(element) {
    // 如果是已选中的元素则不高亮，不重复显示
    if ((firstElement && element === firstElement) || (secondElement && element === secondElement)) {
        return;
    }
    // 如果是同一个元素，不重新创建标记
    if (hoverElementCache === element) {
        return;
    }
    // 记录悬停的元素
    hoverElementCache = element;
    // 移除先前的高亮标记
    if (hoverMarker) {
        hoverMarker.remove();
        hoverMarker = null;
    }
    // 获取元素的矩形大小
    const rect = element.getBoundingClientRect();
    // 创建高亮标记
    const marker = document.createElement('div');
    marker.className = 'chrome-ruler-hover-marker';
    marker.style.position = 'absolute';
    marker.style.top = (window.scrollY + rect.top) + 'px';
    marker.style.left = (window.scrollX + rect.left) + 'px';
    marker.style.width = rect.width + 'px';
    marker.style.height = rect.height + 'px';
    marker.style.border = '1px dashed #4CAF50';
    marker.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    marker.style.zIndex = '99997'; // 低于主标记的高亮标记
    marker.style.pointerEvents = 'none';
    // 添加元素标签
    const label = document.createElement('div');
    label.className = 'chrome-ruler-label';
    label.style.position = 'absolute';
    label.style.top = '-20px';
    label.style.left = '0px';
    label.style.backgroundColor = '#4CAF50';
    label.style.color = 'white';
    label.style.padding = '2px 4px';
    label.style.borderRadius = '2px';
    label.style.fontSize = '10px';
    label.style.zIndex = '99998';
    label.style.whiteSpace = 'nowrap';
    // 显示元素类型和id（如果有）
    let labelText = element.tagName.toLowerCase();
    if (element.id) {
        labelText += '#' + element.id;
    }
    if (element.className && typeof element.className === 'string' && element.className.trim() !== '') {
        const mainClass = element.className.split(' ')[0];
        labelText += '.' + mainClass;
    }
    label.textContent = labelText;
    marker.appendChild(label);
    document.body.appendChild(marker);
    // 记录
    hoverMarker = marker;
}

