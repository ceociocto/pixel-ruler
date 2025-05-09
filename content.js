// Global variables
let measuring = false;
let startElement = null;
let endElement = null;
let marker1 = null;
let marker2 = null;
let line = null;
let label = null;
let permanentRulers = []; // 用于存储持久的永久标尺
let parentOrigin = window !== window.top ? window.parent.origin : null; // 当前脚本如果在iframe内则记录父iframe
let lastMouseOverTime = 0; // 用于iframe的鼠标防抖
const THROTTLE_DELAY = 30; // 鼠标移动防抖延迟，约33fps
let hoverElementCache = null; // 用于缓存上一个悬停的元素，避免重复标记

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

function startMeasuring() {
    if (measuring) return; // 避免重复启动

    measuring = true;

    // 更改鼠标光标
    document.body.style.cursor = 'crosshair';

    // 移除所有标记元素
    removeAllMarkers();

    // 只添加一次事件监听，避免重复添加
    document.removeEventListener('click', handleClick);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', preventDefault);

    // 添加点击事件
    document.addEventListener('click', handleClick, { passive: false });

    // 添加鼠标移动事件以进行可视化
    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 阻止默认点击行为
    document.addEventListener('click', preventDefault, { passive: false });

    console.log('测量模式已启动');
}

function stopMeasuring() {
    if (!measuring) return;
    measuring = false;
    document.body.style.cursor = '';
    removeAllMarkers();
    document.removeEventListener('click', handleClick);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', preventDefault);
    console.log('测量模式已停止');
}

function handleClick(e) {
    if (!measuring) return;
    if (!startElement) {
        startElement = document.elementFromPoint(e.clientX, e.clientY);
        marker1 = createMarker(startElement, 'first');
    } else {
        endElement = document.elementFromPoint(e.clientX, e.clientY);
        marker2 = createMarker(endElement, 'second');
        line = createLine(marker1, marker2);
        label = createLabel(marker1, marker2, line);
        permanentRulers.push({ marker1, marker2, line, label });
        measuring = false;
        document.body.style.cursor = '';
        startElement = null;
        endElement = null;
        marker1 = null;
        marker2 = null;
        line = null;
        label = null;
        document.removeEventListener('click', handleClick);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', preventDefault);
        console.log('测量完成');
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
    // 移除所有标记和线条
    document.querySelectorAll('.chrome-ruler-marker, .chrome-ruler-line, .chrome-ruler-label').forEach(el => el.remove());
}

function createMarker(element, type) {
    // 创建标记元素
    const rect = element.getBoundingClientRect();
    const marker = document.createElement('div');
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

function createLine(marker1, marker2) {
    // 创建连接两点的线
    const rect1 = marker1.getBoundingClientRect();
    const rect2 = marker2.getBoundingClientRect();
    const line = document.createElement('div');
    line.className = 'chrome-ruler-line';
    line.style.position = 'fixed';
    line.style.left = Math.min(rect1.left, rect2.left) + 'px';
    line.style.top = Math.min(rect1.top, rect2.top) + 'px';
    line.style.width = Math.abs(rect1.left - rect2.left) + 'px';
    line.style.height = Math.abs(rect1.top - rect2.top) + 'px';
    line.style.border = '1px dashed #0f0';
    line.style.zIndex = 99999;
    document.body.appendChild(line);
    return line;
}

function createLabel(marker1, marker2, line) {
    // 创建距离标签
    const rect1 = marker1.getBoundingClientRect();
    const rect2 = marker2.getBoundingClientRect();
    const label = document.createElement('div');
    label.className = 'chrome-ruler-label';
    label.style.position = 'fixed';
    label.style.left = ((rect1.left + rect2.left) / 2) + 'px';
    label.style.top = ((rect1.top + rect2.top) / 2) + 'px';
    label.style.background = '#fff';
    label.style.color = '#333';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '3px';
    label.style.fontSize = '12px';
    label.style.zIndex = 100000;
    label.textContent = getDistanceText(rect1, rect2);
    document.body.appendChild(label);
    return label;
}

function getDistanceText(rect1, rect2) {
    const dx = Math.abs(rect1.left - rect2.left);
    const dy = Math.abs(rect1.top - rect2.top);
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
    return `距离: ${distance}px (水平: ${dx}px, 垂直: ${dy}px)`;
}

function calculateDistance(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    // 计算实际像素距离，适配高DPI设备
    const dpr = window.devicePixelRatio || 1;

    // 计算水平距离，只考虑元素之间的空隙
    let horizontal = 0;
    if (rect2.left > rect1.right) {
        // 元素2在元素1右侧
        horizontal = rect2.left - rect1.right;
    } else if (rect1.left > rect2.right) {
        // 元素1在元素2右侧
        horizontal = rect1.left - rect2.right;
    } else {
        // 有重叠，算为0
        horizontal = 0;
    }

    // 计算垂直距离，两元素的边之间的空隙
    let vertical = 0;
    if (rect2.top > rect1.bottom) {
        // 元素2在元素1下方
        vertical = rect2.top - rect1.bottom;
    } else if (rect1.top > rect2.bottom) {
        // 元素1在元素2下方
        vertical = rect1.top - rect2.bottom;
    } else {
        // 有重叠，算为0
        vertical = 0;
    }

    // 如果两元素在两个方向都重叠，则使用中心点计算对角线距离
    if (horizontal === 0 && vertical === 0) {
        const center1 = {
            x: rect1.left + (rect1.width / 2),
            y: rect1.top + (rect1.height / 2)
        };
        const center2 = {
            x: rect2.left + (rect2.width / 2),
            y: rect2.top + (rect2.height / 2)
        };
        horizontal = Math.abs(center2.x - center1.x) - (rect1.width / 2) - (rect2.width / 2);
        vertical = Math.abs(center2.y - center1.y) - (rect1.height / 2) - (rect2.height / 2);
    }
    // 保证距离不为负
    horizontal = Math.max(0, horizontal);
    vertical = Math.max(0, vertical);

    // 得到最终距离值并返回测量结果
    const distance = Math.sqrt(horizontal * horizontal + vertical * vertical);
    return {
        horizontal: parseFloat(horizontal.toFixed(1)),
        vertical: parseFloat(vertical.toFixed(1)),
        distance: parseFloat(distance.toFixed(1))
    };
}

function updateTemporaryRuler(measurements, event) {
    if (ruler) {
        ruler = document.createElement('div');
        ruler.className = 'chrome-ruler-line';
        ruler.style.position = 'absolute';
        ruler.style.backgroundColor = 'rgba(255, 193, 7, 0.5)';
        ruler.style.zIndex = '99998';
        ruler.style.transformOrigin = 'top left';
        ruler.style.pointerEvents = 'none';

        const label = document.createElement('div');
        label.className = 'chrome-ruler-label';
        label.style.position = 'absolute';
        label.style.background = '#fff7c7';
        label.style.color = '#000';
        label.style.border = '1px solid #FFC107';
        label.style.padding = '2px 5px';
        label.style.borderRadius = '2px';
        label.style.fontSize = '12px';
        label.style.zIndex = 100000;
        label.style.pointerEvents = 'none';
        label.style.transform = 'rotate(0deg)'; // 始终保持标签水平
        label.style.whiteSpace = 'nowrap'; // 防止文字折行

        ruler.appendChild(label);
        document.body.appendChild(ruler);
    }

    const rect1 = firstElement.getBoundingClientRect();
    // 获取当前鼠标指向的元素
    const currentElement = document.elementFromPoint(event.clientX, event.clientY);
    const rect2 = currentElement.getBoundingClientRect();
    let startPoint = { x: 0, y: 0 };
    let endPoint = { x: 0, y: 0 };
    let isVertical = false;

    // 水平方式
    if ((measurements.horizontal > 0) && measurements.vertical === 0) {
        if (rect2.left > rect1.right) {
            // 元素2在右侧
            startPoint.x = window.scrollX + rect1.right;
            endPoint.x = window.scrollX + rect2.left;
        } else {
            // 元素1在右侧
            startPoint.x = window.scrollX + rect2.right;
            endPoint.x = window.scrollX + rect1.left;
        }
        startPoint.y = window.scrollY + rect1.top + rect1.height / 2;
        endPoint.y = window.scrollY + rect2.top + rect2.height / 2;
        isVertical = false;
    } else if ((measurements.vertical > 0) && measurements.horizontal === 0) {
        if (rect2.top > rect1.bottom) {
            // 元素2在下方
            startPoint.y = window.scrollY + rect1.bottom;
            endPoint.y = window.scrollY + rect2.top;
        } else {
            // 元素1在下方
            startPoint.y = window.scrollY + rect2.bottom;
            endPoint.y = window.scrollY + rect1.top;
        }
        startPoint.x = window.scrollX + rect1.left + rect1.width / 2;
        endPoint.x = window.scrollX + rect2.left + rect2.width / 2;
        isVertical = true;
    } else {
        if (rect1.left > rect2.right) {
            // 元素1在右侧
            startPoint.x = window.scrollX + rect1.left;
            endPoint.x = window.scrollX + rect2.right;
        } else if (rect2.left > rect1.right) {
            // 元素2在右侧
            startPoint.x = window.scrollX + rect2.left;
            endPoint.x = window.scrollX + rect1.right;
        } else {
            // 对齐中心
            startPoint.x = window.scrollX + rect1.left + rect1.width / 2;
            endPoint.x = window.scrollX + rect2.left + rect2.width / 2;
        }
        if (rect1.top > rect2.bottom) {
            // 元素1在下方
            startPoint.y = window.scrollY + rect1.top;
            endPoint.y = window.scrollY + rect2.bottom;
        } else if (rect2.top > rect1.bottom) {
            // 元素2在下方
            startPoint.y = window.scrollY + rect2.top;
            endPoint.y = window.scrollY + rect1.bottom;
        } else {
            // 对齐中心
            startPoint.y = window.scrollY + rect1.top + rect1.height / 2;
            endPoint.y = window.scrollY + rect2.top + rect2.height / 2;
        }
    }

    // 兼容主方向
    isVertical = Math.abs(endPoint.y - startPoint.y) > Math.abs(endPoint.x - startPoint.x);

    // 计算长度和夹角
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ruler.style.width = isVertical ? distance + 'px' : distance + 'px';
    ruler.style.height = isVertical ? '2px' : '2px';
    ruler.style.left = startPoint.x + 'px';
    ruler.style.top = startPoint.y + 'px';

    // 只有水平和垂直不需要旋转
    if (isVertical) {
        ruler.style.transform = 'none';
    } else {
        ruler.style.transform = `rotate(${angle}rad)`;
    }

    const label = ruler.querySelector('.chrome-ruler-label');
    label.textContent = `${measurements.distance}px (H: ${measurements.horizontal}px, V: ${measurements.vertical}px)`;

    // 标签位置
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

function removeAllMarkers() {
    // Remove any existing markers and rulers
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

