console.log("split.js 加载完成");

let allData = [];
let csvData = [];
const itemsPerPage = 50; // 每页显示的行数
let currentPage = 1;

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM 加载完成，添加事件监听器");
    document.getElementById('matchButton').addEventListener('click', matchData);
    document.getElementById('csvFileInput').addEventListener('change', loadCSV);
    document.getElementById('exportButton').addEventListener('click', exportToCSV); // 新增导出按钮的事件监听器
    loadSplitData();
});

function loadCSV(event) {
    const file = event.target.files[0];
    Papa.parse(file, {
        complete: function(results) {
            console.log("原始CSV数据加载完成，总行数:", results.data.length);
            
            // 查找包含 Designator 和 Layer 的行
            const headerRowIndex = results.data.findIndex(row => 
                row.includes('Designator') && row.includes('Layer')
            );

            if (headerRowIndex === -1) {
                console.error("未找到包含 Designator 和 Layer 的行");
                alert("CSV文件格式不正确，未找到包含 Designator 和 Layer 的行");
                return;
            }

            // 删除头部多余的行
            csvData = results.data.slice(headerRowIndex);
            
            console.log("处理后的CSV数据，总行数:", csvData.length);
            console.log("处理后的CSV表头:", csvData[0]);
            console.log("处理后的CSV前5行数据:");
            for (let i = 1; i < Math.min(6, csvData.length); i++) {
                console.log(`第${i}行:`, csvData[i]);
            }
        }
    });
}

function matchData() {
    if (csvData.length === 0) {
        console.log("没有加载CSV数据");
        alert("请先选择CSV文件");
        return;
    }

    console.log("开始匹配数据");

    const csvHeaders = csvData[0];
    console.log("CSV表头:", csvHeaders);

    const requiredColumns = ['Designator', 'Layer', 'Center-X(mm)', 'Center-Y(mm)', 'Rotation'];
    const columnIndices = {};

    requiredColumns.forEach(column => {
        const index = csvHeaders.indexOf(column);
        columnIndices[column] = index;
        if (index === -1) {
            console.error(`未找到必要的列: ${column}`);
        } else {
            console.log(`找到列 ${column} 在索引 ${index}`);
        }
    });

    if (Object.values(columnIndices).includes(-1)) {
        console.error("CSV文件缺少必要的列");
        console.log("当前CSV表头:", csvHeaders);
        console.log("需要的列:", requiredColumns);
        console.log("找到的列索引:", columnIndices);
        alert("CSV文件格式不正确，请确保包含所有必要的列");
        return;
    }

    let matchCount = 0;
    allData.forEach((item, index) => {
        const csvRow = csvData.find(row => row[columnIndices['Designator']] === item.designator);
        if (csvRow) {
            item.xCoordinate = csvRow[columnIndices['Center-X(mm)']];
            item.yCoordinate = csvRow[columnIndices['Center-Y(mm)']];
            item.angle = csvRow[columnIndices['Rotation']];
            item.layer = csvRow[columnIndices['Layer']];
            matchCount++;
        }
        if (index < 10 || index % 100 === 0) {
            console.log(`处理第 ${index + 1} 行:`, item);
        }
    });

    console.log(`匹配完成，共匹配 ${matchCount} 项，总行数 ${allData.length}`);
    renderSplitTable(1);
}

function loadSplitData() {
    const storedData = localStorage.getItem('splitData');
    if (storedData) {
        allData = JSON.parse(storedData);
        console.log("从 localStorage 加载的数据长度:", allData.length);
        console.log("加载的数据前5项:", allData.slice(0, 5));
        renderSplitTable(1);
    } else {
        console.log("localStorage 中没有找到数据");
        document.getElementById('tableContainer').innerHTML = '<p>未找到数据，请返回主页面重新执行拆分操作。</p>';
    }
}

function renderSplitTable(page) {
    console.log("开始渲染拆分表格，页码:", page);
    const container = document.getElementById('tableContainer');
    if (!container) {
        console.error("未找到tableContainer元素");
        return;
    }

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allData.length);
    const pageData = allData.slice(startIndex, endIndex);

    let html = `
        <table class="split-table">
            <thead>
                <tr>
                    <th>索引</th>
                    <th>位号</th>
                    <th>X坐标</th>
                    <th>Y坐标</th>
                    <th>角度</th>
                    <th>层</th>
                    <th>物料名称</th>
                </tr>
            </thead>
            <tbody>
    `;

    pageData.forEach((item, index) => {
        html += `
            <tr>
                <td>${startIndex + index + 1}</td>
                <td>${item.designator || ''}</td>
                <td>${item.xCoordinate || ''}</td>
                <td>${item.yCoordinate || ''}</td>
                <td>${item.angle || ''}</td>
                <td>${item.layer || ''}</td>
                <td>${item.materialName || ''}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
    currentPage = page;
    updatePaginationButtons();
    console.log("拆分表格渲染完成，当前页:", page);
}

function setupPagination() {
    const totalPages = Math.ceil(allData.length / itemsPerPage);
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) {
        console.error("未找到paginationContainer元素");
        return;
    }
    paginationContainer.innerHTML = `
        <button id="prevPage" onclick="changePage(-1)">上一页</button>
        <span id="pageInfo">第 ${currentPage} 页，共 ${totalPages} 页</span>
        <button id="nextPage" onclick="changePage(1)">下一页</button>
    `;
    updatePaginationButtons();
}

function changePage(delta) {
    const newPage = currentPage + delta;
    const totalPages = Math.ceil(allData.length / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        renderSplitTable(newPage);
    }
}

function updatePaginationButtons() {
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const totalPages = Math.ceil(allData.length / itemsPerPage);
    
    if (prevButton && nextButton && pageInfo) {
        prevButton.disabled = (currentPage === 1);
        nextButton.disabled = (currentPage === totalPages);
        pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    } else {
        console.error("未找到分页按钮或页面信息元素");
    }
}

function exportToCSV() {
    console.log("开始导出CSV");

    // 检查是否有 BottomLayer 和 TopLayer
    const hasBottomLayer = allData.some(item => item.layer === 'BottomLayer');
    const hasTopLayer = allData.some(item => item.layer === 'TopLayer');

    if (hasBottomLayer && hasTopLayer) {
        exportLayerToCSV('TopLayer', 'T');
        setTimeout(() => exportLayerToCSV('BottomLayer', 'B'), 1000); // 延迟1秒导出第二个文件
    } else if (hasBottomLayer) {
        exportLayerToCSV('BottomLayer', 'B');
    } else if (hasTopLayer) {
        exportLayerToCSV('TopLayer', 'T');
    } else {
        exportLayerToCSV('', '');
    }

    console.log("CSV导出完成");
}

function exportLayerToCSV(layer, suffix) {
    let csvContent = "";

    // 筛选数据
    let filteredData = layer ? allData.filter(item => item.layer === layer) : allData;

    // 如果是 BottomLayer，找出 X 坐标的最大值
    let maxX = 0;
    if (layer === 'BottomLayer') {
        maxX = Math.max(...filteredData.map(item => parseFloat(item.xCoordinate) || 0));
        console.log("BottomLayer 最大 X 坐标:", maxX);
    }

    // 添加数据行
    filteredData.forEach((item, index) => {
        let xCoordinate = item.xCoordinate;
        if (layer === 'BottomLayer' && maxX > 0) {
            xCoordinate = (maxX - parseFloat(item.xCoordinate)).toFixed(3);
        }

        const row = [
            item.designator,
            xCoordinate,
            item.yCoordinate,
            item.angle,
            item.materialName
        ];
        csvContent += row.join(",") + "\n";
    });

    // 创建 Blob 对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 创建下载链接并自动点击
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `split_data${suffix}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    console.log(`${layer || '全部'}数据导出完成`);
}

// 导出函数到全局作用域，以便HTML中的onclick事件可以调用
window.changePage = changePage;
