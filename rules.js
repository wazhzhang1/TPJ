let db;
let packageRules = [];
let nameRules = [];
let columnWidths = {};

// 在文件顶部添加这些行
window.loadRulesFromDB = loadRulesFromDB;
window.renderRules = renderRules;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    initDB().then(() => {
        console.log('Database initialized');
        document.getElementById('addRule1').addEventListener('click', () => addRule('package'));
        document.getElementById('addRule2').addEventListener('click', () => addRule('name'));
        document.getElementById('exportRules').addEventListener('click', exportRulesToExcel);
        document.getElementById('importRules').addEventListener('click', importRulesFromExcel);
        document.getElementById('saveColumnWidths').addEventListener('click', saveColumnWidths);
        document.getElementById('saveRules').addEventListener('click', saveRulesToDB);
        
        return loadRulesFromDB();
    }).then(() => {
        loadColumnWidths();
        console.log('Initialization complete, rules loaded');
    }).catch(error => {
        console.error('Error during initialization or loading rules:', error);
    });
});

function initDB() {
    console.log('Initializing database');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RulesDB', 3); // 增加版本号以触发 onupgradeneeded

        request.onupgradeneeded = event => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('packageRules')) {
                db.createObjectStore('packageRules', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('nameRules')) {
                db.createObjectStore('nameRules', { keyPath: 'id', autoIncrement: true });
            }
            console.log('Database upgrade completed');
        };

        request.onsuccess = event => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve();
        };

        request.onerror = event => {
            console.error('Database opening failed:', event.target.error);
            reject(event.target.error);
        };
    });
}

function loadRulesFromDB() {
    console.log('Loading rules from database');
    return Promise.all([
        loadRulesFromStore('packageRules'),
        loadRulesFromStore('nameRules')
    ]).then(([loadedPackageRules, loadedNameRules]) => {
        packageRules = loadedPackageRules;
        nameRules = loadedNameRules;
        console.log('Rules loaded from database:', {packageRules, nameRules});
        renderRules();
    });
}

function loadRulesFromStore(storeName) {
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

function renderRules() {
    console.log('Rendering rules, package rules:', packageRules.length, 'name rules:', nameRules.length);
    try {
        const container1 = document.getElementById('rulesTableContainer1');
        const container2 = document.getElementById('rulesTableContainer2');
        
        if (!container1 || !container2) {
            console.error('Rule containers not found');
            return;
        }
        
        // 渲染封装规则表格
        let html1 = '<h2>封装规则</h2><table id="rulesTable1" class="rules-table">';
        html1 += '<tr><th>索引</th><th>筛选封装</th><th>匹配后封装</th><th>贴装类别</th><th>计算点数</th></tr>';
        packageRules.forEach((rule, index) => {
            html1 += `<tr>
                <td>${index + 1}</td>
                <td>${rule.filterPackage || ''}</td>
                <td>${rule.matchPackage || ''}</td>
                <td>${rule.mountType || ''}</td>
                <td>${rule.processPoints || ''}</td>
            </tr>`;
        });
        html1 += '</table>';
        container1.innerHTML = html1;

        // 渲染名称规则表格
        let html2 = '<h2>名称规则</h2><table id="rulesTable2" class="rules-table">';
        html2 += '<tr><th>索引</th><th>名称</th><th>匹配后名称</th><th>元件类别</th></tr>';
        nameRules.forEach((rule, index) => {
            html2 += `<tr>
                <td>${index + 1}</td>
                <td>${rule.name || ''}</td>
                <td>${rule.matchName || ''}</td>
                <td>${rule.componentType || ''}</td>
            </tr>`;
        });
        html2 += '</table>';
        container2.innerHTML = html2;
        
        console.log('Rules tables rendered');
    } catch (error) {
        console.error('Error in renderRules function:', error);
        alert('渲染规则时发生错误，请查看控制台以获取更多信。');
    }
}

function addResizeListeners() {
    const resizeHandles = document.querySelectorAll('.resize-handle');
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', initResize);
    });
}

function initResize(e) {
    const table = e.target.dataset.table;
    const column = e.target.dataset.column;
    const th = e.target.closest('th');
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    function doResize(e) {
        const newWidth = startWidth + e.clientX - startX;
        th.style.width = `${newWidth}px`;
        columnWidths[`table${table}_${column}`] = newWidth;
    }

    function stopResize() {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
    }

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
}

function updateRule(input, type) {
    const index = parseInt(input.dataset.index);
    const field = input.dataset.field;
    const rules = type === 'package' ? packageRules : nameRules;
    rules[index][field] = input.value;
    
    // 不再实时保存规则
    // saveRulesToDB();
}

function addRule(type) {
    console.log(`Attempting to add new ${type} rule`);
    
    try {
        const newRule = type === 'package' 
            ? {
                filterPackage: '',
                matchPackage: '',
                mountType: '',
                processPoints: ''
            }
            : {
                name: '',
                matchName: '',
                componentType: ''
            };
        
        if (type === 'package') {
            packageRules.unshift(newRule);
        } else {
            nameRules.unshift(newRule);
        }
        
        renderRules();
        
        // 聚焦到新添加的规则的第一个输入框
        setTimeout(() => {
            const firstInput = document.querySelector(`#rulesTable${type === 'package' ? '1' : '2'} input[data-index="0"]`);
            if (firstInput) {
                firstInput.focus();
                firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 0);
    } catch (error) {
        console.error('Error in addRule function:', error);
        alert('添加规则时发生错误，请查看控制台以获取更多信息。');
    }
}

function saveRulesToDB() {
    console.log('Saving rules to DB');
    
    const packageTransaction = db.transaction(['packageRules'], 'readwrite');
    const nameTransaction = db.transaction(['nameRules'], 'readwrite');
    const packageStore = packageTransaction.objectStore('packageRules');
    const nameStore = nameTransaction.objectStore('nameRules');

    // 清除现有规则
    packageStore.clear();
    nameStore.clear();

    // 添加封装规则
    packageRules.forEach(rule => {
        packageStore.add(rule);
    });

    // 添加名称规则
    nameRules.forEach(rule => {
        nameStore.add(rule);
    });

    packageTransaction.oncomplete = () => {
        console.log('Package rules saved successfully.');
    };

    nameTransaction.oncomplete = () => {
        console.log('Name rules saved successfully.');
        alert('规则已成功保存');
        renderRules();
    };

    packageTransaction.onerror = nameTransaction.onerror = event => {
        console.error('Failed to save rules:', event.target.error);
        alert('保存规则失败，请查看控制台以获取更多信息。');
    };
}

function exportRulesToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(rules);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rules");
    XLSX.writeFile(workbook, "exported_rules.xlsx");
}

function importRulesFromExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = function(e) {
        const file = e.target.files[0];
        console.log('Selected file:', file.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('File read successfully');
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            console.log('Workbook read successfully, sheet names:', workbook.SheetNames);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            console.log('Parsed data:', jsonData);
            
            // 重置规则数组
            packageRules = [];
            nameRules = [];

            jsonData.forEach(row => {
                if (row['筛选封装'] !== undefined) {
                    packageRules.push({
                        type: 'package',
                        filterPackage: row['筛选封装'] || '',
                        matchPackage: row['匹配后封装'] || '',
                        mountType: row['贴装类别'] || '',
                        processPoints: row['加工点数'] || ''
                    });
                }
                if (row['名称'] !== undefined || row['Name'] !== undefined) {
                    nameRules.push({
                        type: 'name',
                        name: row['名称'] || row['Name'] || '',
                        matchName: row['匹配后名称'] || '',
                        componentType: row['元件类别'] || ''
                    });
                }
            });
            
            console.log('Imported package rules:', packageRules);
            console.log('Imported name rules:', nameRules);
            
            saveRulesToDB();
        };
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

function saveColumnWidths() {
    localStorage.setItem('columnWidths', JSON.stringify(columnWidths));
    alert('列宽设置已保存');
}

function loadColumnWidths() {
    const savedWidths = localStorage.getItem('columnWidths');
    if (savedWidths) {
        columnWidths = JSON.parse(savedWidths);
    }
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
                type: 'name', // 假设所有规则都是 name 类型
                name: inputs[0].value.trim(),
                matchName: inputs[1].value.trim(),
                componentType: inputs[2].value.trim()
            });
        }
    });

    console.log("准备保存的规则:", savedRules);

    const transaction = db.transaction(['rules'], 'readwrite');
    const objectStore = transaction.objectStore('rules');

    // 清除所有现有规则
    const clearRequest = objectStore.clear();
    clearRequest.onsuccess = () => {
        console.log('现有规则已清除');
        // 添加新规则
        savedRules.forEach(rule => {
            objectStore.add(rule);
        });
    };

    transaction.oncomplete = () => {
        console.log("规则已成功保存到数据库");
        alert('规则已保存');
    };

    transaction.onerror = event => {
        console.error('保存规则失败:', event.target.error);
        alert('保存规则失败');
    };
}

