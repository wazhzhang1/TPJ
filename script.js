let workbook, worksheet, fileName;
let saveCount = 0; // 添加一个计数器来跟踪保存次数
let isFormatted = false;
let rules = [];
let nameRules = [];
let packageRules = []; // 在文件顶部添加这行
let db;

document.getElementById('fileInput').addEventListener('change', handleFile, false);
document.getElementById('formatButton').addEventListener('click', formatTable, false);
document.getElementById('materialMatchButton').addEventListener('click', materialMatch, false);
document.getElementById('saveButton').addEventListener('click', saveChanges, false);
document.getElementById('openRulesEditor').addEventListener('click', openRulesEditor);
document.getElementById('addRule').addEventListener('click', addRule);
document.getElementById('saveRules').addEventListener('click', saveRules);
document.getElementById('closeRulesEditor').addEventListener('click', closeRulesEditor);
document.getElementById('insertMaterialNameButton').addEventListener('click', insertMaterialNameColumn);
document.getElementById('splitButton').addEventListener('click', handleSplit);

document.addEventListener('DOMContentLoaded', function() {
    // ... 其他事件监听器 ...
    document.getElementById('openRulesEditor').addEventListener('click', openRulesEditor);
    document.getElementById('closeRulesEditor').addEventListener('click', closeRulesEditor);
    initDB().then(() => {
        console.log('数据库初始化完成');
    }).catch(error => {
        console.error('数据库初始化失败:', error);
    });
});

function handleFile(e) {
    console.log("开始处理文件");
    const file = e.target.files[0];
    if (!file) {
        console.error("没有选择文件");
        return;
    }
    fileName = file.name;
    console.log("选择的文件名:", fileName);
    const reader = new FileReader();
    reader.onload = function(e) {
        let data = e.target.result;
        if (fileName.toLowerCase().endsWith('.csv')) {
            // 处理 CSV 文件
            console.log('Processing CSV file');
            Papa.parse(data, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    console.log('Parsed CSV data:', results.data);
                    workbook = XLSX.utils.book_new();
                    worksheet = XLSX.utils.json_to_sheet(results.data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
                    displayWorksheet();
                    document.getElementById('formatButton').style.display = 'inline-block';
                    console.log("CSV文件加载完成，'格式整理'按钮应该显示");
                }
            });
        } else {
            // 处理 Excel 文件
            console.log('Processing Excel file');
            const arrayBuffer = e.target.result;
            workbook = XLSX.read(arrayBuffer, {type: 'array'});
            worksheet = workbook.Sheets[workbook.SheetNames[0]];
            displayWorksheet();
            document.getElementById('formatButton').style.display = 'inline-block';
            console.log("Excel文件加载完成，'格式整理'按钮应该显示");
        }
    };
    if (fileName.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function displayWorksheet() {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let html = '<table>';
    
    // 添加列标识
    html += '<tr><th class="row-number"></th>';
    for (let C = range.s.c; C <= range.e.c; ++C) {
        html += `<th class="column-letter">${XLSX.utils.encode_col(C)}</th>`;
    }
    html += '</tr>';

    // 添加数据行和行号
    for (let R = range.s.r; R <= range.e.r; ++R) {
        html += '<tr>';
        html += `<td class="row-number">${R + 1}</td>`;
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = {c:C, r:R};
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            let cell = worksheet[cell_ref];
            let value = cell ? cell.v : '';
            html += `<td data-cell-ref="${cell_ref}">${value}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    document.getElementById('tableContainer').innerHTML = html;
    makeTableEditable();
    document.getElementById('saveButton').style.display = 'block';
    isFormatted = false; // 重置格式化状态
    console.log("表格已显示，等待格式整理");
}

function formatTable() {
    if (isFormatted) return;
    
    const expectedHeaders = ['Comment', 'Designator', 'Footprint', 'Quantity'];
    const table = document.querySelector('table');
    let headerRowIndex = -1;
    let columnsToKeep = [];

    // 找到包含所需标题的行
    for (let i = 0; i < table.rows.length; i++) {
        const row = table.rows[i];
        const potentialHeaders = Array.from(row.cells).map(cell => cell.textContent.trim());
        console.log(`Row ${i} headers:`, potentialHeaders);
        
        const foundHeaders = expectedHeaders.filter(header => 
            potentialHeaders.includes(header)
        );
        
        if (foundHeaders.length >= expectedHeaders.length) {
            headerRowIndex = i;
            // 找到需要保留的列
            for (let j = 0; j < row.cells.length; j++) {
                const cellText = row.cells[j].textContent.trim();
                if (expectedHeaders.includes(cellText)) {
                    columnsToKeep.push(j);
                }
            }
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.error('未找到包含足够所需标题的行');
        console.log('Table content:', table.innerHTML);
        return;
    }

    console.log('找到标题行:', headerRowIndex);
    console.log('保留的列:', columnsToKeep);

    // 删除标题之前的所有行，保留标题行
    table.tBodies[0].innerHTML = Array.from(table.rows)
        .slice(headerRowIndex)
        .map(row => row.outerHTML)
        .join('');

    // 删除不需要的列，但保留原始内容
    Array.from(table.rows).forEach(row => {
        const cellsToKeep = columnsToKeep.map(index => row.cells[index].outerHTML);
        row.innerHTML = cellsToKeep.join('');
    });

    // 添加行号列，包括表头
    Array.from(table.rows).forEach((row, index) => {
        const rowNumberCell = row.insertCell(0);
        if (index === 0) {
            rowNumberCell.textContent = "序号";
            rowNumberCell.style.fontWeight = "bold";
        } else {
            rowNumberCell.textContent = index;
        }
        rowNumberCell.classList.add('row-number');
    });

    // 更新表头为中文
    const headerRow = table.rows[0];
    const chineseHeaders = {
        'Comment': '物料名称',
        'Designator': '位号',
        'Footprint': '封装',
        'Quantity': '数量'
    };
    Array.from(headerRow.cells).forEach(cell => {
        const englishHeader = cell.textContent.trim();
        if (chineseHeaders[englishHeader]) {
            cell.textContent = chineseHeaders[englishHeader];
        }
    });

    isFormatted = true;
    document.getElementById('formatButton').style.display = 'none';
    document.getElementById('materialMatchButton').style.display = 'inline-block';

    console.log("表格格式化完成，保留了原始内容");
    // 打印内容以供验证
    Array.from(table.rows).forEach((row, index) => {
        console.log(`行 ${index}: ${Array.from(row.cells).map(cell => cell.textContent).join(' | ')}`);
    });
}

function makeTableEditable() {
    const table = document.querySelector('table');
    const cells = table.querySelectorAll('td:not(.row-number)');
    for (let cell of cells) {
        if (!cell.classList.contains('column-letter')) {
            cell.contentEditable = true;
            cell.addEventListener('focus', function() {
                this.parentElement.style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // 50%黄色
            });
            cell.addEventListener('blur', function() {
                // 可以在这里添加验证或格式化逻辑
                this.parentElement.style.backgroundColor = ''; // 恢复原的背景色
            });
        }
    }
}

function saveChanges() {
    const table = document.querySelector('table');
    const newWorksheet = XLSX.utils.table_to_sheet(table);
    
    // 更新工簿中的工表
    workbook.Sheets[workbook.SheetNames[0]] = newWorksheet;
    
    const newWorkbookData = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});
    
    // 生成新的文件名
    saveCount++;
    const fileExtension = fileName.split('.').pop();
    const baseFileName = fileName.slice(0, -fileExtension.length - 1);
    const newFileName = `修改后_${baseFileName}_${saveCount}.${fileExtension}`;
    
    saveAs(new Blob([newWorkbookData], {type: 'application/octet-stream'}), newFileName);
}

function saveAs(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function openRulesEditor() {
    console.log("Opening rules editor");
    const rulesWindow = window.open('rules.html', '_blank');
    rulesWindow.addEventListener('load', function() {
        rulesWindow.loadRulesFromDB().then(() => {
            rulesWindow.renderRules();
        });
    });
}

function closeRulesEditor() {
    document.getElementById('rulesEditor').style.display = 'none';
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RulesDB', 1);
        
        request.onerror = event => {
            console.error('数据库打开失败:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = event => {
            db = event.target.result;
            console.log('数据库打开成功');
            resolve(db);
        };

        request.onupgradeneeded = event => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('rules')) {
                db.createObjectStore('rules', { keyPath: 'id', autoIncrement: true });
            }
            console.log('数据库升级完成');
        };
    });
}

async function loadRulesFromDB() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['rules'], 'readonly');
        const objectStore = transaction.objectStore('rules');
        const request = objectStore.getAll();

        request.onsuccess = event => {
            const rules = event.target.result;
            packageRules = rules.filter(rule => rule.type === 'package');
            nameRules = rules.filter(rule => rule.type === 'name');
            console.log('从数据库加载的规则:', {packageRules, nameRules});
            resolve({packageRules, nameRules});
        };

        request.onerror = event => {
            console.error('加载规则失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

function renderRules() {
    console.log("渲染则表格");
    const container = document.getElementById('rulesTableContainer');
    let html = '<table id="rulesTable">';
    
    // 添加表头
    html += '<tr><th>名称</th><th>匹配名称</th><th>元件类别</th><th>操作</th></tr>';

    // 添加规则行
    rules.forEach((rule, index) => {
        html += `<tr>
            <td><input type="text" value="${rule.name || ''}" data-field="name" data-index="${index}"></td>
            <td><input type="text" value="${rule.matchName || ''}" data-field="matchName" data-index="${index}"></td>
            <td><input type="text" value="${rule.componentType || ''}" data-field="componentType" data-index="${index}"></td>
            <td>
                <button onclick="deleteRule(${index})">删除</button>
                <button onclick="copyRule(${index})">复制</button>
            </td>
        </tr>`;
    });

    html += '</table>';
    container.innerHTML = html;
    console.log("规则表格已渲");
}

function addRule() {
    rules.push({ matchColumn: '', resultColumn: '', matchRule: '' });
    renderRules();
}

function deleteRule(index) {
    rules.splice(index, 1);
    renderRules();
}

function copyRule(index) {
    const ruleToCopy = {...rules[index]};
    rules.push(ruleToCopy);
    renderRules();
}

function saveRules() {
    console.log("开始保存规则");
    const rulesTable = document.getElementById('rulesTable');
    if (!rulesTable) {
        console.error("未找到规则表格");
        return;
    }

    const rows = rulesTable.querySelectorAll('tr');
    const savedRules = [];

    rows.forEach((row, index) => {
        if (index === 0) return; // 跳过表头

        const inputs = row.querySelectorAll('input');
        if (inputs.length >= 3) {
            savedRules.push({
                type: 'name', // 假所有规则都是 name 类型
                name: inputs[0].value.trim(),
                matchName: inputs[1].value.trim(),
                componentType: inputs[2].value.trim()
            });
        }
    });

    console.log("准备保存的规则:", savedRules);
    localStorage.setItem('rules', JSON.stringify(savedRules));
    console.log("则已保存到 localStorage");
    alert('规则已保存');
}

async function materialMatch() {
    console.log("开始执行 materialMatch 函数");
    try {
        // 检查是否已经完成格式整理
        if (!isFormatted) {
            console.log("表格尚未格式化，先执行格式整理");
            formatTable();
        }

        await loadRulesFromDB();
        console.log("加载的规则数量:", nameRules.length, "封装规则数量:", packageRules.length);

        const table = document.querySelector('table');
        if (!table) {
            console.error("未找到表格元素");
            return;
        }

        const headerRow = table.rows[0];
        let headerCells = Array.from(headerRow.cells).map(cell => cell.textContent.trim());

        console.log("当前表头:", headerCells);

        // 检查并添加缺失的列
        const requiredColumns = ['整理后的名称', '整理后的封装', '贴片类别', '计算点数'];
        requiredColumns.forEach(columnName => {
            if (!headerCells.includes(columnName)) {
                const newIndex = headerRow.cells.length;
                const newCell = headerRow.insertCell(newIndex);
                newCell.textContent = columnName;
                newCell.classList.add('column-letter');
                
                // 为每一行添加新的单元格
                for (let i = 1; i < table.rows.length; i++) {
                    table.rows[i].insertCell(newIndex);
                }
                console.log(`添加了新列: ${columnName}`);
            }
        });

        // 更新headerCells数组
        headerCells = Array.from(headerRow.cells).map(cell => cell.textContent.trim());

        const commentIndex = headerCells.indexOf('物料名称');
        const footprintIndex = headerCells.indexOf('封装');
        const nameColumnIndex = headerCells.indexOf('整理后的名称');
        const packageColumnIndex = headerCells.indexOf('整理后的封装');
        const mountTypeColumnIndex = headerCells.indexOf('贴片类别');
        const processPointsColumnIndex = headerCells.indexOf('计算点数');

        if (commentIndex === -1 || footprintIndex === -1 || nameColumnIndex === -1 || 
            packageColumnIndex === -1 || mountTypeColumnIndex === -1 || processPointsColumnIndex === -1) {
            console.error("未找到必要的列");
            console.log("更新后的表头:", headerCells);
            return;
        }

        // 在创建规则映射之前
        packageRules = packageRules.filter(rule => rule && rule.filterPackage && rule.matchPackage);
        nameRules = nameRules.filter(rule => rule && rule.name && rule.matchName);

        console.log('过滤后封装规则:', packageRules);
        console.log('过滤后的名称规则:', nameRules);

        // 创建规则映射以提高查找效率
        const nameRuleMap = new Map(nameRules.map(rule => [removeAllSpaces(rule.name), rule]));
        const packageRuleMap = new Map(packageRules.map(rule => [rule.filterPackage, rule]));

        console.log('创建的名称规则映射:', nameRuleMap);
        console.log('创建的封装规则映射:', packageRuleMap);

        // 执行匹配
        let nameMatchCount = 0;
        let packageMatchCount = 0;
        Array.from(table.rows).slice(1).forEach((row, index) => {
            const cells = row.cells;

            const commentCell = cells[commentIndex];
            const footprintCell = cells[footprintIndex];
            const nameCell = cells[nameColumnIndex];
            const packageCell = cells[packageColumnIndex];
            const mountTypeCell = cells[mountTypeColumnIndex];
            const processPointsCell = cells[processPointsColumnIndex];

            if (!commentCell || !footprintCell || !nameCell || !packageCell || !mountTypeCell || !processPointsCell) {
                console.error(`行 ${index + 1} 缺少必要的单元格`);
                return;
            }

            const originalCommentValue = commentCell.textContent;
            const commentValue = removeAllSpaces(originalCommentValue);
            const footprintValue = footprintCell.textContent.trim();

            console.log(`处理第 ${index + 1} 行:`);
            console.log(`  原始 Comment 值: "${originalCommentValue}"`);
            console.log(`  处理后 Comment 值 (去除所有空格): "${commentValue}"`);
            console.log(`  Footprint 值: "${footprintValue}"`);

            const matchedNameRule = nameRuleMap.get(commentValue);
            const matchedPackageRule = packageRuleMap.get(footprintValue);

            console.log(`尝试匹配名称 "${commentValue}":`, matchedNameRule);
            console.log(`尝试匹配封装 "${footprintValue}":`, matchedPackageRule);

            if (matchedNameRule) {
                nameCell.textContent = matchedNameRule.matchName;
                nameCell.style.backgroundColor = ''; // 清除背景色
                nameMatchCount++;
                console.log(`  名称匹配成功: "${commentValue}" -> "${matchedNameRule.matchName}"`);
            } else {
                nameCell.textContent = commentValue; // 复制原始数据
                nameCell.style.backgroundColor = 'rgba(0, 255, 0, 0.5)'; // 50%绿色
                console.log(`  名称未找到匹配，使用原始值: "${commentValue}"`);
            }

            if (matchedPackageRule) {
                packageCell.textContent = matchedPackageRule.matchPackage;
                mountTypeCell.textContent = matchedPackageRule.mountType || '';
                processPointsCell.textContent = matchedPackageRule.processPoints || '';
                packageCell.style.backgroundColor = '';
                mountTypeCell.style.backgroundColor = '';
                processPointsCell.style.backgroundColor = '';
                packageMatchCount++;
                console.log(`  封装匹配成功: "${footprintValue}" -> "${matchedPackageRule.matchPackage}"`);
            } else {
                packageCell.textContent = footprintValue; // 复制原始数据
                packageCell.style.backgroundColor = 'rgba(0, 255, 0, 0.5)'; // 50%绿色
                console.log(`  封装未找到匹配，使用原始值: "${footprintValue}"`);

                // 尝试相似匹配
                const similarPackage = findSimilarPackage(footprintValue, packageRules);
                if (similarPackage) {
                    mountTypeCell.textContent = similarPackage.mountType || '';
                    processPointsCell.textContent = similarPackage.processPoints || '';
                    mountTypeCell.style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // 50%黄色
                    processPointsCell.style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // 50%黄色
                    console.log(`  找到相似封装: "${similarPackage.filterPackage}"`);
                } else {
                    mountTypeCell.textContent = '';
                    processPointsCell.textContent = '';
                    mountTypeCell.style.backgroundColor = 'rgba(0, 255, 0, 0.5)'; // 50%绿色
                    processPointsCell.style.backgroundColor = 'rgba(0, 255, 0, 0.5)'; // 50%绿色
                    console.log(`  未找到相似封装`);
                }
            }
        });

        console.log(`物料匹配完成，名称匹配 ${nameMatchCount} 项，封装匹配 ${packageMatchCount} 项，总行数 ${table.rows.length - 1}`);
        
        // 打印完整的表格内容
        console.log("完整的表格内容:");
        const fullHeaderCells = Array.from(table.rows[0].cells).map(cell => cell.textContent.trim());
        console.log("表头:", fullHeaderCells);
        
        for (let i = 1; i < Math.min(table.rows.length, 10); i++) {  // 只打印前10行，避免日志过长
            const rowData = Array.from(table.rows[i].cells).map(cell => cell.textContent.trim());
            console.log(`行 ${i}:`, rowData);
        }

        // 检查是否已存在整理后的物料名称列
        if (!fullHeaderCells.includes('整理后的物料名称')) {
            document.getElementById('insertMaterialNameButton').style.display = 'inline-block';
            console.log("整理后的物料名称列不存在，显示插入按钮");
        } else {
            document.getElementById('insertMaterialNameButton').style.display = 'none';
            console.log("整理后的物料名称列已存在，隐藏插入按钮");
        }

        // 打印按钮的当前显示状态
        const buttonDisplayStyle = document.getElementById('insertMaterialNameButton').style.display;
        console.log(`插入整理后的物料名称列按钮的当前显示状态: ${buttonDisplayStyle}`);
    } catch (error) {
        console.error("加载规则或执行匹配时出错:", error);
    }
}

function findSimilarPackage(footprint, packageRules) {
    console.log('Searching for similar package:', footprint);
    console.log('Available package rules:', packageRules);

    if (!Array.isArray(packageRules)) {
        console.error('packageRules is not an array:', packageRules);
        return null;
    }

    // 简单的相似度匹配，可以根据需要改进
    return packageRules.find(rule => {
        if (!rule || typeof rule.filterPackage !== 'string' || !rule.filterPackage) {
            console.warn('Invalid rule or filterPackage is not a valid string:', rule);
            return false;
        }
        const rulePackage = rule.filterPackage.toLowerCase();
        const searchPackage = footprint.toLowerCase();
        return rulePackage.includes(searchPackage) || searchPackage.includes(rulePackage);
    });
}

function addContextMenu(cell, type, originalValue) {
    cell.dataset.originalValue = originalValue;
    cell.dataset.type = type;
    cell.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        console.log(`右键菜单触发: ${type} - ${originalValue}`);
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = '<ul><li id="addRule">添加规则到数据库</li></ul>';
        menu.style.position = 'absolute';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        document.body.appendChild(menu);

        const addRuleItem = menu.querySelector('#addRule');
        addRuleItem.addEventListener('click', function() {
            alert(`右键菜单点击: ${type} - ${originalValue}`);
            const newValue = cell.textContent.trim();
            console.log(`尝试添加规则: ${type} - ${originalValue} -> ${newValue}`);
            if (type === 'package') {
                // 处理封装规则
                handleAddRule('package', originalValue, newValue);
            } else if (type === 'name') {
                // 处理名称规则
                handleAddRule('name', originalValue, newValue);
            }
            document.body.removeChild(menu);
        });

        document.addEventListener('click', function removeMenu() {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', removeMenu);
        });
    });

    // 使单元格可编辑
    cell.contentEditable = true;
    cell.addEventListener('focus', function() {
        this.style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // 50%黄色
        console.log(`单元格获得焦点: ${type} - ${originalValue}`);
    });
    cell.addEventListener('blur', function() {
        this.style.backgroundColor = ''; // 恢复原来的背色
        console.log(`单元格失去焦点: ${type} - ${originalValue}`);
        
        // 在失去焦点时保存修改
        const newValue = this.textContent.trim();
        if (newValue !== originalValue) {
            console.log(`单元内容已更改: ${originalValue} -> ${newValue}`);
            this.dataset.originalValue = newValue; // 更新 data-original-value 属性
            updateCellInMemory(type, originalValue, newValue);
        }
    });
}

function updateCellInMemory(type, originalValue, newValue) {
    console.log(`更新内存中的单元格值: ${type} - ${originalValue} -> ${newValue}`);
    // 这里可以添加更新内存中数据的逻辑
    // 例更新 nameRules 或 packageRules 数组
    if (type === 'name') {
        const ruleIndex = nameRules.findIndex(rule => rule.name === originalValue);
        if (ruleIndex !== -1) {
            nameRules[ruleIndex].name = newValue;
        }
    } else if (type === 'package') {
        const ruleIndex = packageRules.findIndex(rule => rule.filterPackage === originalValue);
        if (ruleIndex !== -1) {
            packageRules[ruleIndex].filterPackage = newValue;
        }
    }
}

async function addRuleToDatabase(type, from, to, mountType = '', processPoints = '') {
    console.log(`开始添加规则到数据库: ${type} - ${from} -> ${to}, 贴片类型: ${mountType}, 计算点数: ${processPoints}`);
    
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
        console.error('无效的规则数据:', { type, from, to, mountType, processPoints });
        throw new Error('规则的 from 和 to 字段必须是非空字符串');
    }

    try {
        const db = await openDatabase();
        const storeName = type === 'package' ? 'packageRules' : 'nameRules';
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);

        let rule;
        if (type === 'package') {
            rule = { 
                filterPackage: from, 
                matchPackage: to, 
                mountType, 
                processPoints 
            };
        } else if (type === 'name') {
            rule = { 
                name: from, 
                matchName: to 
            };
        } else {
            throw new Error('无效的规则类型');
        }

        const request = objectStore.add(rule);

        return new Promise((resolve, reject) => {
            request.onsuccess = function(event) {
                console.log("规则已成功添加到数据库，新规则ID:", event.target.result);
                if (type === 'package') {
                    packageRules.push(rule);
                } else if (type === 'name') {
                    nameRules.push(rule);
                }
                console.log('更新后的内存中规则:', { packageRules, nameRules });
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error("添加规则到数据库时出错:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("打开数据库或添加规则时出错:", error);
        throw error;
    }
}

// 新增函数：打印所有规则
function printAllRules(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["rules"], "readonly");
        const objectStore = transaction.objectStore("rules");
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const allRules = event.target.result;
            console.log("数据库中的所有规则:");
            console.table(allRules);
            resolve();
        };

        request.onerror = function(event) {
            console.error("获取所有规则时出错:", event.target.error);
            reject(event.target.error);
        };
    });
}

// 添加这个新函数来验证新添加的规则
function verifyAddedRule(db, ruleId) {
    const transaction = db.transaction(["rules"], "readonly");
    const objectStore = transaction.objectStore("rules");
    const request = objectStore.get(ruleId);

    request.onsuccess = function(event) {
        const rule = event.target.result;
        if (rule) {
            console.log("成功检索到新添加的规则:", rule);
            if (rule.type === 'package') {
                console.log(`封装规则: ${rule.from} -> ${rule.to}, 贴片类型: ${rule.mountType}, 计算点数: ${rule.processPoints}`);
            } else {
                console.log(`名称规则: ${rule.from} -> ${rule.to}`);
            }
        } else {
            console.error("无法检索到新添加的规则，ID:", ruleId);
        }
    };

    request.onerror = function(event) {
        console.error("检索新添加的规则时出错:", event.target.error);
    };
}

async function findPackageRule(footprint) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['rules'], 'readonly');
        const objectStore = transaction.objectStore('rules');
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const rules = event.target.result;
            const packageRule = rules.find(rule => rule.type === 'package' && rule.filterPackage === footprint);
            resolve(packageRule);
        };

        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

function getCount(objectStore) {
    return new Promise((resolve, reject) => {
        const countRequest = objectStore.count();
        countRequest.onsuccess = function() {
            resolve(countRequest.result);
        };
        countRequest.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

// 添加这个新函数来移除所有类型的空格
function removeAllSpaces(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[\s\uFEFF\xA0]+/g, '');
}

// 确保在规编辑器页面加载时调用这个函数来显示现有规则
function loadAndDisplayRules() {
    console.log("加载并示规则");
    const savedRules = localStorage.getItem('rules');
    if (savedRules) {
        rules = JSON.parse(savedRules);
        console.log("从 localStorage 加载的规则:", rules);
        renderRules();
    } else {
        console.log("localStorage 中没有找到保存的规则");
        rules = [];
    }
}

// 在规则编辑器页面加载时调用这个函数
document.addEventListener('DOMContentLoaded', function() {
    console.log("规则编辑器页面加载完成");
    loadAndDisplayRules();
    document.getElementById('addRule').addEventListener('click', addRule);
    document.getElementById('saveRules').addEventListener('click', saveRules);
});

// 在添加规则的地方（可能在右键菜单的点击事件处理程序中）

async function handleAddRule(type, from, to, mountType = '', processPoints = '') {
    try {
        const newRuleId = await addRuleToDatabase(type, from, to, mountType, processPoints);
        console.log(`新规则已添���，ID: ${newRuleId}`);
        alert(`规则添加成功！新规则ID: ${newRuleId}`);
        
        // 重新加载并显示规则
        await loadRulesFromDB();
        renderRules();
        
        // 重新应用规则到格
        materialMatch();
    } catch (error) {
        console.error("添加规则时出错:", error);
        alert("添加规则时出错: " + error.message);
    }
}

// 使用这个函数来处理添加规则的操作

// 在文件顶部添加这个函数定义

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RulesDB', 3);  // 将版本号改为 3
        
        request.onerror = event => {
            console.error('数据库打开失败:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = event => {
            const db = event.target.result;
            console.log('数据库打开成功');
            resolve(db);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('packageRules')) {
                db.createObjectStore('packageRules', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('nameRules')) {
                db.createObjectStore('nameRules', { keyPath: 'id', autoIncrement: true });
            }
            console.log('数据库升级完成');
        };
    });
}

// 添加这个新函数来显示所有规
function displayAllRules() {
    openDatabase().then(db => {
        const packageTransaction = db.transaction(['packageRules'], 'readonly');
        const nameTransaction = db.transaction(['nameRules'], 'readonly');
        const packageStore = packageTransaction.objectStore('packageRules');
        const nameStore = nameTransaction.objectStore('nameRules');

        Promise.all([
            new Promise(resolve => {
                packageStore.getAll().onsuccess = event => resolve(event.target.result);
            }),
            new Promise(resolve => {
                nameStore.getAll().onsuccess = event => resolve(event.target.result);
            })
        ]).then(([packageRules, nameRules]) => {
            console.log('数据库中的封装规则:', packageRules);
            console.log('数据库中的名称规则:', nameRules);
        });
    }).catch(error => {
        console.error('显示规则时出错:', error);
    });
}

// 添加这个新函数来从数据库加载规则
async function loadRulesFromDB() {
    const db = await openDatabase();
    packageRules = await loadRulesFromStore(db, 'packageRules');
    nameRules = await loadRulesFromStore(db, 'nameRules');
    console.log('从数据库加载的规则:', {packageRules, nameRules});
}

function loadRulesFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = event => {
            resolve(event.target.result);
        };

        request.onerror = event => {
            console.error(`Failed to load ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

function updateRulesEditor() {
    const rulesWindow = window.open('rules.html', 'rules');
    if (rulesWindow && !rulesWindow.closed) {
        rulesWindow.addEventListener('load', function() {
            if (typeof rulesWindow.loadRulesFromDB === 'function') {
                rulesWindow.loadRulesFromDB().then(() => {
                    rulesWindow.renderRules();
                });
            } else {
                console.error('loadRulesFromDB is not defined in the rules window');
                // 如果函数不存在，尝试直接调用主窗口的函数
                loadRulesFromDB().then(() => {
                    renderRules();
                });
            }
        });
    }
}

// 在 handleAddRule 函数的最后添加：
updateRulesEditor();

// 在 materialMatch 函数的最后添加：
displayAllRules();

function insertMaterialNameColumn() {
    console.log("开始插入整理后的物料名称列");
    const table = document.querySelector('table');
    if (!table) {
        console.error("未找到表格元素");
        return;
    }

    const headerRow = table.rows[0];
    const headerCells = Array.from(headerRow.cells).map(cell => cell.textContent.trim());

    // 检查是否已存在整理后的物料名称列
    if (headerCells.includes('整理后的物料名称')) {
        console.log("整理后的物料名称列已存在，不再插入");
        return;
    }

    const processPointsIndex = headerCells.indexOf('计算点数');
    if (processPointsIndex === -1) {
        console.error("未找到 '计算点数' 列");
        return;
    }

    const nameColumnIndex = headerCells.indexOf('整理后的名称');
    const packageColumnIndex = headerCells.indexOf('整理后的封装');
    if (nameColumnIndex === -1 || packageColumnIndex === -1) {
        console.error("未找到 '整理后的名称' 或 '整理后的封装' 列");
        return;
    }

    // 添加新的整理后的物料名称列
    const newMaterialNameIndex = processPointsIndex + 1;
    const newHeaderCell = headerRow.insertCell(newMaterialNameIndex);
    newHeaderCell.textContent = '整理后的物料名称';
    newHeaderCell.classList.add('column-letter');
    
    for (let i = 1; i < table.rows.length; i++) {
        const cell = table.rows[i].insertCell(newMaterialNameIndex);
        cell.contentEditable = true;
        cell.dataset.type = 'materialName';

        // 填充内容为"整理后的名称-整理后的封装"
        const nameCell = table.rows[i].cells[nameColumnIndex];
        const packageCell = table.rows[i].cells[packageColumnIndex];
        const name = nameCell.textContent.trim();
        const package = packageCell.textContent.trim();
        cell.textContent = `${name}-${package}`;

        // 添加右键菜单事件
        addContextMenu(cell, 'materialName', cell.textContent);
    }
    
    console.log("成功添加新的'整理后的物料名称'列并填充内容");
    makeTableEditable();

    // 隐藏插入按钮，防止重复插入
    document.getElementById('insertMaterialNameButton').style.display = 'none';
}

function handleSplit() {
    console.log("开始执行拆分操作");
    const table = document.querySelector('table');
    if (!table) {
        console.error("未找到表格元素");
        return;
    }

    const headerRow = table.rows[0];
    const headerCells = Array.from(headerRow.cells).map(cell => cell.textContent.trim());

    const designatorIndex = headerCells.indexOf('位号');
    const materialNameIndex = headerCells.indexOf('整理后的物料名称');
    const mountTypeIndex = headerCells.indexOf('贴片类别');

    if (designatorIndex === -1 || materialNameIndex === -1 || mountTypeIndex === -1) {
        console.error("未找到必要的列");
        console.log("当前表头:", headerCells);
        return;
    }

    console.log(`位号列索引: ${designatorIndex}, 整理后的物料名称列索引: ${materialNameIndex}, 贴片类别列索引: ${mountTypeIndex}`);

    const splitData = [];
    const problematicRows = [];

    // 从第二行开始处理数据（跳过表头）
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const designators = row.cells[designatorIndex].textContent.split(',');
        const materialName = row.cells[materialNameIndex].textContent.trim();
        const mountType = row.cells[mountTypeIndex].textContent.trim().toUpperCase();

        console.log(`处理第 ${i} 行:`);
        console.log(`  位号: ${designators.join(', ')}`);
        console.log(`  整理后的物料名称: ${materialName}`);
        console.log(`  贴片类别: ${mountType}`);

        let isProblematic = false;

        // 检查贴片类别
        if (!mountType) {
            console.warn(`行 ${i}: 贴片类别为空`);
            isProblematic = true;
        } else if (mountType !== 'SMT' && mountType !== 'DIP') {
            console.warn(`行 ${i}: 贴片类别 "${mountType}" 不是 SMT 或 DIP`);
            isProblematic = true;
        }

        designators.forEach(designator => {
            designator = designator.trim();
            if (!designator || !materialName) {
                console.warn(`行 ${i}: 位号 "${designator}" 或物料名称为空`);
                isProblematic = true;
            }
            splitData.push({
                designator: designator,
                xCoordinate: '',
                yCoordinate: '',
                angle: '',
                materialName: materialName,
                mountType: mountType
            });
        });

        if (isProblematic) {
            problematicRows.push(i);
        }
    }

    console.log("拆分后的数据总数:", splitData.length);
    console.log("拆分后的前10条数据:", splitData.slice(0, 10));

    if (problematicRows.length > 0) {
        console.warn("发现问题行:", problematicRows);
        alert("发现一些问题，请检查红色标记的行。");
        
        // 高亮有问题的行
        highlightProblematicRows(table, problematicRows);
        
        // 不继续处理，让用户先修正问题
        return;
    }

    // 将拆分后的数据保存到 localStorage
    localStorage.setItem('splitData', JSON.stringify(splitData));

    // 打开新窗口
    window.open('split.html', '_blank');
}

function highlightProblematicRows(table, problematicRows) {
    // 重置所有行的背景色
    Array.from(table.rows).forEach(row => row.style.backgroundColor = '');

    // 高亮有问题的行
    problematicRows.forEach(rowIndex => {
        if (table.rows[rowIndex]) {
            table.rows[rowIndex].style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // 50%红色
        }
    });
}

