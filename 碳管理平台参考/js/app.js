/**
 * 碳管理平台 - 主应用逻辑
 * 包含：路由、侧边栏交互、产品碳模型表格页
 */
(function () {
    'use strict';

    /* ============ 模拟数据 ============ */
    const SYSTEM_BOUNDARIES = [
        { value: 'cradle-to-gate', label: '从摇篮到大门' },
        { value: 'cradle-to-grave', label: '从摇篮到坟墓' }
    ];

    const STORAGE_KEY = 'cmp:product-carbon-models:v4';

    const SEED_MODELS = [
        {
            code: 'PCM-2024-001',
            name: '光伏发电',
            boundary: 'cradle-to-grave',
            baseYear: 2024,
            scope: '多晶硅制备 - 硅片 - 电池片 - 组件 - 电站安装 - 并网发电 - 退役回收',
            referenceStandard: 'GB/T 24067-2024, ISO 14067:2018',
            quantificationPurpose: '核算光伏发电产品在整个生命周期内的温室气体排放，识别关键排放环节，为产品碳足迹评价与减碳决策提供数据支撑。',
            functionalUnit: '1 kW·h 上网电量',
            boundaryDiagram: ''
        },
        {
            code: 'PCM-2024-002',
            name: '光热发电',
            boundary: 'cradle-to-grave',
            baseYear: 2024,
            scope: '聚光镜场 - 吸热器 - 储热系统 - 汽轮发电 - 并网 - 退役回收',
            referenceStandard: 'GB/T 24067-2024, ISO 14067:2018',
            quantificationPurpose: '',
            functionalUnit: '1 kW·h 上网电量',
            boundaryDiagram: ''
        },
        {
            code: 'PCM-2024-003',
            name: '风力发电',
            boundary: 'cradle-to-grave',
            baseYear: 2024,
            scope: '钢材/玻璃纤维 - 叶片/塔架/齿轮箱制造 - 吊装 - 运行发电 - 退役回收',
            referenceStandard: 'GB/T 24067-2024, ISO 14067:2018',
            quantificationPurpose: '',
            functionalUnit: '1 kW·h 上网电量',
            boundaryDiagram: ''
        },
        {
            code: 'PCM-2024-004',
            name: '电动汽车充电设备',
            boundary: 'cradle-to-gate',
            baseYear: 2024,
            scope: '原材料获取 - 结构件/电气元件制造 - 整机装配 - 出厂检测',
            referenceStandard: 'GB/T 24067-2024, ISO 14067:2018',
            quantificationPurpose: '',
            functionalUnit: '1 台充电桩',
            boundaryDiagram: ''
        },
        {
            code: 'PCM-2024-005',
            name: '光伏玻璃',
            boundary: 'cradle-to-gate',
            baseYear: 2024,
            scope: '石英砂开采 - 玻璃熔制 - 镀膜 - 钢化 - 包装出厂',
            referenceStandard: 'GB/T 24067-2024, GB/T 30983-2014',
            quantificationPurpose: '',
            functionalUnit: '1 m² 光伏玻璃',
            boundaryDiagram: ''
        }
    ];

    // 归一化模型数据：为旧数据补充新增字段，避免 undefined
    function normalizeModel(m) {
        if (!m) return m;
        if (m.quantificationPurpose == null) m.quantificationPurpose = '';
        if (m.functionalUnit == null) m.functionalUnit = '';
        if (m.boundaryDiagram == null) m.boundaryDiagram = '';
        return m;
    }

    function loadModels() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return SEED_MODELS.slice().map(normalizeModel);
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeModel);
            return SEED_MODELS.slice().map(normalizeModel);
        } catch (e) {
            return SEED_MODELS.slice().map(normalizeModel);
        }
    }

    function saveModels() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
        } catch (e) {
            // 存储失败时忽略，不影响使用
        }
    }

    const models = loadModels();

    /* ============ 产品碳模型-实训 数据 ============ */
    const TRAIN_STORAGE_KEY = 'cmp:product-carbon-model-train:v4';

    const TRAIN_SEED_MODELS = [
        {
            code: 'PCM-2024-T01',
            name: '光伏发电系统',
            functionalUnit: '1 kW·h 上网电量',
            boundary: 'cradle-to-grave',
            boundaryDiagram: '',
            referenceStandard: 'GB/T 24067-2024, ISO 14067:2018',
            description: '以光伏发电系统为产品，核算从多晶硅制备、硅片生产、电池片制造、组件封装、电站安装、并网发电到退役回收全生命周期的温室气体排放量。',
            modelCreator: '张工程师',
            modelReviewer: '李总工',
            status: '已审核',
            stages: null // 占位，loadTrainModels 中赋值为 TRAIN_DEF_SEED 深拷贝
        }
    ];

    // 归一化模型数据：为旧模型补 stages / modelCreator / modelReviewer 字段
    function normalizeTrainModel(m) {
        if (!m) return m;
        if (m.modelCreator == null) m.modelCreator = '';
        if (m.modelReviewer == null) m.modelReviewer = '';
        if (m.status == null) m.status = m.modelReviewer ? '已审核' : '待审核';
        if (!m.stages || !Array.isArray(m.stages) || !m.stages.length) {
            // 种子模型 PCM-2024-T01 赋予预置阶段数据；其他模型赋空数组
            m.stages = (m.code === 'PCM-2024-T01')
                ? JSON.parse(JSON.stringify(getTrainDefSeed()))
                : [];
        } else {
            // 已有 stages，归一化行数据
            m.stages.forEach(stage => {
                if (stage.categories) stage.categories.forEach(cat => {
                    if (cat.rows) cat.rows.forEach(normalizeTrainDefRow);
                });
            });
        }
        return m;
    }

    function loadTrainModels() {
        try {
            const raw = localStorage.getItem(TRAIN_STORAGE_KEY);
            if (!raw) {
                const seed = TRAIN_SEED_MODELS.map(m => Object.assign({}, m));
                seed.forEach(normalizeTrainModel);
                return seed;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) {
                const seed = TRAIN_SEED_MODELS.map(m => Object.assign({}, m));
                seed.forEach(normalizeTrainModel);
                return seed;
            }
            parsed.forEach(normalizeTrainModel);
            return parsed;
        } catch (e) {
            const seed = TRAIN_SEED_MODELS.map(m => Object.assign({}, m));
            seed.forEach(normalizeTrainModel);
            return seed;
        }
    }

    function saveTrainModels() {
        localStorage.setItem(TRAIN_STORAGE_KEY, JSON.stringify(trainModels));
    }

    const trainModels = loadTrainModels();

    /* ============ 产品碳模型-实训 模型定义数据 ============ */
    const TRAIN_DEF_STORAGE_KEY = 'cmp:train-model-definition:v1';

    function getTrainDefSeed() {
        return [
        {
            stageId: 'raw-materials',
            stageName: '原材料及生产设备获取',
            categories: [
                { categoryName: '光伏组件', rows: [
                    { dataName: '多晶硅', specModel: '太阳能级', manufacturer: '通威股份', emissionCoefficient: '190', functionalUnit: 'kg', emissionFactor: '190 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' },
                    { dataName: '硅片', specModel: 'M10(182mm)', manufacturer: '隆基绿能', emissionCoefficient: '35', functionalUnit: 'kg', emissionFactor: '35 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' },
                    { dataName: '电池片', specModel: 'PERC 182mm', manufacturer: '通威股份', emissionCoefficient: '42', functionalUnit: 'kg', emissionFactor: '42 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '支架', rows: [
                    { dataName: '铝合金支架', specModel: 'A6005', manufacturer: '中信博', emissionCoefficient: '12.5', functionalUnit: 'kg', emissionFactor: '12.5 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' },
                    { dataName: '钢支架', specModel: 'Q235B', manufacturer: '中信博', emissionCoefficient: '2.8', functionalUnit: 'kg', emissionFactor: '2.8 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '逆变器', rows: [
                    { dataName: '光伏逆变器', specModel: 'SUN2000-50KTL', manufacturer: '华为', emissionCoefficient: '85', functionalUnit: '台', emissionFactor: '85 kgCO₂e/台', factorSource: 'Ecoinvent', dataSource: '行业平均' }
                ]},
                { categoryName: '变压器', rows: [
                    { dataName: '箱式变压器', specModel: 'S13-1000kVA', manufacturer: '特变电工', emissionCoefficient: '320', functionalUnit: '台', emissionFactor: '320 kgCO₂e/台', factorSource: 'Ecoinvent', dataSource: '行业平均' }
                ]},
                { categoryName: '电气辅助设备', rows: [
                    { dataName: '电缆', specModel: 'ZR-YJV 0.6/1kV', manufacturer: '远东电缆', emissionCoefficient: '3.2', functionalUnit: 'kg', emissionFactor: '3.2 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '运维车辆', rows: [
                    { dataName: '运维车辆', specModel: '电动轻卡', manufacturer: '比亚迪', emissionCoefficient: '0.52', functionalUnit: 'kg/km', emissionFactor: '0.52 kgCO₂e/km', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '建筑材料', rows: [
                    { dataName: '混凝土', specModel: 'C30', manufacturer: '华润水泥', emissionCoefficient: '0.35', functionalUnit: 'kg', emissionFactor: '0.35 kgCO₂e/kg', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]}
            ]
        },
        {
            stageId: 'transport',
            stageName: '运输',
            categories: [
                { categoryName: '铁路运输', rows: [
                    { dataName: '铁路货运', specModel: '通用货运', manufacturer: '中国铁路', emissionCoefficient: '0.010', functionalUnit: 't·km', emissionFactor: '0.010 kgCO₂e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '公路运输', rows: [
                    { dataName: '公路货运（柴油重卡）', specModel: 'J6P 420PS', manufacturer: '一汽解放', emissionCoefficient: '0.050', functionalUnit: 't·km', emissionFactor: '0.050 kgCO₂e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '海运运输', rows: [
                    { dataName: '海洋货轮', specModel: '万吨级散货船', manufacturer: '中远海运', emissionCoefficient: '0.005', functionalUnit: 't·km', emissionFactor: '0.005 kgCO₂e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]},
                { categoryName: '内河运输', rows: [
                    { dataName: '内河船舶', specModel: '千吨级货船', manufacturer: '内河航运', emissionCoefficient: '0.008', functionalUnit: 't·km', emissionFactor: '0.008 kgCO₂e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业平均' }
                ]}
            ]
        },
        {
            stageId: 'construction',
            stageName: '设施建设',
            categories: [
                { categoryName: '化石能源', rows: [
                    { dataName: '柴油', specModel: '0#车用柴油', manufacturer: '中国石化', emissionCoefficient: '3160', functionalUnit: 't', emissionFactor: '3160 kgCO₂e/t', factorSource: 'IPCC 2006', dataSource: '施工台账' },
                    { dataName: '汽油', specModel: '92#车用汽油', manufacturer: '中国石化', emissionCoefficient: '2925', functionalUnit: 't', emissionFactor: '2925 kgCO₂e/t', factorSource: 'IPCC 2006', dataSource: '施工台账' },
                    { dataName: '天然气', specModel: '管道天然气', manufacturer: '中国石油', emissionCoefficient: '2.16', functionalUnit: 'm³', emissionFactor: '2.16 kgCO₂e/m³', factorSource: 'IPCC 2006', dataSource: '施工台账' }
                ]},
                { categoryName: '外购电力', rows: [
                    { dataName: '施工用电', specModel: '380V三相', manufacturer: '国家电网', emissionCoefficient: '0.5810', functionalUnit: 'kWh', emissionFactor: '0.5810 kgCO₂e/kWh', factorSource: '区域电网', dataSource: '电网公司' }
                ]}
            ]
        },
        {
            stageId: 'production-retirement',
            stageName: '生产及退役',
            categories: [
                { categoryName: '化石能源', rows: [
                    { dataName: '柴油', specModel: '0#车用柴油', manufacturer: '中国石化', emissionCoefficient: '3160', functionalUnit: 't', emissionFactor: '3160 kgCO₂e/t', factorSource: 'IPCC 2006', dataSource: '运行数据' },
                    { dataName: '天然气', specModel: '管道天然气', manufacturer: '中国石油', emissionCoefficient: '2.16', functionalUnit: 'm³', emissionFactor: '2.16 kgCO₂e/m³', factorSource: 'IPCC 2006', dataSource: '运行数据' }
                ]},
                { categoryName: '外购电力', rows: [
                    { dataName: '生产用电', specModel: '380V三相', manufacturer: '国家电网', emissionCoefficient: '0.5810', functionalUnit: 'kWh', emissionFactor: '0.5810 kgCO₂e/kWh', factorSource: '区域电网', dataSource: '电网公司' }
                ]}
            ]
        },
        {
            stageId: 'transmission',
            stageName: '输配电',
            categories: [
                { categoryName: '上网电量', rows: [
                    { dataName: '上网电量', specModel: '10kV并网', manufacturer: '国家电网', emissionCoefficient: '0.0014', functionalUnit: 'kWh', emissionFactor: '0.0014 kgCO₂e/kWh', factorSource: '附录A 表A.6', dataSource: '电网公司' }
                ]},
                { categoryName: '自供电量', rows: [
                    { dataName: '自供电量', specModel: '380V自用', manufacturer: '国家电网', emissionCoefficient: '0.0014', functionalUnit: 'kWh', emissionFactor: '0.0014 kgCO₂e/kWh', factorSource: '附录A 表A.6', dataSource: '运行数据' }
                ]}
            ]
        },
        {
            stageId: 'grid-supply',
            stageName: '光伏发电总上网量',
            categories: [] // 该阶段使用独立计算页（装机容量×满负荷小时数×系统能效×衰减级数），无需从模型选取数据行
        }
    ];
    }

    // 归一化旧数据：为缺失 specModel/manufacturer 的数据行补默认值
    function normalizeTrainDefRow(r) {
        if (!r) return r;
        if (r.specModel == null) r.specModel = '';
        if (r.manufacturer == null) r.manufacturer = '';
        // 为每个数据行生成稳定的 rowId（基于内容确定性生成，保证种子数据跨刷新一致）
        if (!r.rowId) {
            r.rowId = 'seed-' + encodeURIComponent((r.dataName || '')) + '-' + encodeURIComponent((r.specModel || '')) + '-' + encodeURIComponent((r.manufacturer || ''));
        }
        return r;
    }

    function loadTrainDef() {
        try {
            const raw = localStorage.getItem(TRAIN_DEF_STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(getTrainDefSeed()));
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) return JSON.parse(JSON.stringify(getTrainDefSeed()));
            // 归一化：为旧数据补字段
            parsed.forEach(stage => {
                if (stage.categories) stage.categories.forEach(cat => {
                    if (cat.rows) cat.rows.forEach(normalizeTrainDefRow);
                });
            });
            return parsed;
        } catch (e) {
            return JSON.parse(JSON.stringify(getTrainDefSeed()));
        }
    }

    function saveTrainDef() {
        // 保留函数以兼容旧调用，但实际保存已由 saveTrainModels 统一处理
    }

    /* ============ 产品碳排放核算 数据 ============ */
    const ACCOUNTING_STORAGE_KEY = 'cmp:product-carbon-accounting:v2';
    // 核算采用的电网平均排放因子（kgCO₂e/kWh）
    const GRID_EMISSION_FACTOR = 0.581;

    // 核算模型 → 规格型号建议选项（光伏发电系统对应集中式/分布式/户用电站）
    const SPEC_OPTIONS = {
        '光伏发电': ['集中式电站', '分布式电站', '户用电站']
    };

    const SEED_ACCOUNTING = [
        {
            id: 'acc-001',
            productName: '光伏发电系统',
            specModel: '户用电站',
            capacity: '100',
            enterprise: 'XX新能源科技有限公司',
            model: '光伏发电',
            period: '2025-01-01 ~ 2025-12-31',
            createdAt: '2026-01-08 10:24',
            stageEmissions: {},
            status: '未核算',
            result: null,
            accountedAt: ''
        },
        {
            id: 'acc-002',
            productName: '光伏发电系统',
            specModel: '集中式电站',
            capacity: '50000',
            enterprise: 'XX光伏电力股份有限公司',
            model: '光伏发电',
            period: '2025-01-01 ~ 2025-06-30',
            createdAt: '2026-07-03 14:06',
            stageEmissions: {},
            status: '未核算',
            result: null,
            accountedAt: ''
        },
        {
            id: 'acc-003',
            productName: '光伏发电系统',
            specModel: '分布式电站',
            capacity: '5000',
            enterprise: 'XX分布式能源有限公司',
            model: '光伏发电',
            period: '2024-01-01 ~ 2024-12-31',
            createdAt: '2025-02-11 09:38',
            stageEmissions: {},
            status: '未核算',
            result: null,
            accountedAt: ''
        }
    ];

    function loadAccounting() {
        try {
            const raw = localStorage.getItem(ACCOUNTING_STORAGE_KEY);
            if (!raw) return SEED_ACCOUNTING.map(r => Object.assign({}, r));
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : SEED_ACCOUNTING.map(r => Object.assign({}, r));
        } catch (e) {
            return SEED_ACCOUNTING.map(r => Object.assign({}, r));
        }
    }

    function saveAccounting() {
        try {
            localStorage.setItem(ACCOUNTING_STORAGE_KEY, JSON.stringify(accountingRecords));
        } catch (e) {
            // 存储失败时忽略
        }
    }

    const accountingRecords = loadAccounting();

    function nowText() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    /* ============ 模型定义 - 阶段定义 ============ */
    const STAGE_DEFINITIONS = [
        { id: 'raw-materials', name: '原材料及生产设备获取' },
        { id: 'transport', name: '运输' },
        { id: 'construction', name: '设施建设' },
        { id: 'production-retirement', name: '生产及退役' },
        { id: 'transmission', name: '输配电' }
    ];

    // 光伏发电模型 code
    const PV_MODEL_CODE = 'PCM-2024-001';

    // 《GB/T 47652-2026 温室气体 产品碳足迹量化方法与要求 光伏发电》各阶段大类
    const PV_STAGE_CATEGORIES = {
        'raw-materials': ['光伏组件', '支架', '逆变器', '变压器', '电气辅助设备', '运维车辆', '建筑材料'],
        'transport': ['铁路运输', '公路运输', '海运运输', '内河运输'],
        'construction': ['化石能源', '外购电力'],
        'production-retirement': ['化石能源', '外购电力'],
        'transmission': ['上网电量', '自供电量']
    };

    // 光伏发电 - 运输阶段各运输方式默认碳足迹因子行 [kgCO2e/(t·km)]
    const PV_TRANSPORT_SEED_ROWS = {
        '铁路运输': [
            { dataName: '铁路货运', emissionCoefficient: '0.010', functionalUnit: 't·km', emissionFactor: '0.010 kgCO2e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业统计' }
        ],
        '公路运输': [
            { dataName: '公路货运（柴油重卡）', emissionCoefficient: '0.050', functionalUnit: 't·km', emissionFactor: '0.050 kgCO2e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业统计' }
        ],
        '海运运输': [
            { dataName: '海洋货轮运输', emissionCoefficient: '0.005', functionalUnit: 't·km', emissionFactor: '0.005 kgCO2e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业统计' }
        ],
        '内河运输': [
            { dataName: '内河船舶运输', emissionCoefficient: '0.008', functionalUnit: 't·km', emissionFactor: '0.008 kgCO2e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业统计' }
        ]
    };

    // 光伏发电 - 设施建设阶段默认碳足迹因子行
    // 化石能源：汽油/柴油等单位为吨(t)，燃气为立方米(m³)；外购电力为千瓦时(kW·h)
    const PV_CONSTRUCTION_SEED_ROWS = {
        '化石能源': [
            { dataName: '柴油', emissionCoefficient: '3160', functionalUnit: 't', emissionFactor: '3160 kgCO2e/t', factorSource: 'IPCC 2006', dataSource: '施工台账' },
            { dataName: '汽油', emissionCoefficient: '2925', functionalUnit: 't', emissionFactor: '2925 kgCO2e/t', factorSource: 'IPCC 2006', dataSource: '施工台账' },
            { dataName: '天然气', emissionCoefficient: '2.16', functionalUnit: 'm³', emissionFactor: '2.16 kgCO2e/m³', factorSource: 'IPCC 2006', dataSource: '施工台账' }
        ],
        '外购电力': [
            { dataName: '施工用电', emissionCoefficient: '0.5810', functionalUnit: 'kWh', emissionFactor: '0.5810 kgCO2e/kWh', factorSource: '区域电网', dataSource: '电网公司' }
        ]
    };

    // 光伏发电 - 生产及退役阶段默认碳足迹因子行（能源消耗量 × 碳足迹因子）
    const PV_PRODUCTION_SEED_ROWS = {
        '化石能源': [
            { dataName: '柴油', emissionCoefficient: '3160', functionalUnit: 't', emissionFactor: '3160 kgCO2e/t', factorSource: 'IPCC 2006', dataSource: '运行数据' },
            { dataName: '汽油', emissionCoefficient: '2925', functionalUnit: 't', emissionFactor: '2925 kgCO2e/t', factorSource: 'IPCC 2006', dataSource: '运行数据' },
            { dataName: '天然气', emissionCoefficient: '2.16', functionalUnit: 'm³', emissionFactor: '2.16 kgCO2e/m³', factorSource: 'IPCC 2006', dataSource: '运行数据' }
        ],
        '外购电力': [
            { dataName: '生产用电', emissionCoefficient: '0.5810', functionalUnit: 'kWh', emissionFactor: '0.5810 kgCO2e/kWh', factorSource: '区域电网', dataSource: '电网公司' }
        ]
    };

    // 光伏发电 - 输配电阶段默认碳足迹因子行
    // Em_td = CFP_td × E_oge；CFP_td 为全国输配电碳足迹因子(不含线损)，直供电产品取 0
    const PV_TRANSMISSION_SEED_ROWS = {
        '上网电量': [
            { dataName: '上网电量', emissionCoefficient: '0.0014', functionalUnit: 'kWh', emissionFactor: '0.0014 kgCO2e/kWh', factorSource: '附录A 表A.6', dataSource: '电网公司' }
        ],
        '自供电量': [
            { dataName: '自供电量', emissionCoefficient: '0.0014', functionalUnit: 'kWh', emissionFactor: '0.0014 kgCO2e/kWh', factorSource: '附录A 表A.6', dataSource: '运行数据' }
        ]
    };

    // 一次性迁移：为光伏发电模型指定阶段的空大类补充默认因子行（不覆盖用户已录入的数据）
    function migratePvStageSeedRows(stageId, seedMap) {
        const pv = models.find(m => m.code === PV_MODEL_CODE);
        if (!pv) return false;
        ensureModelStages(pv);
        let changed = false;
        (pv.stages[stageId] || []).forEach(cat => {
            const seeds = seedMap[cat.name];
            if (seeds && (!cat.rows || !cat.rows.length)) {
                cat.rows = seeds.map(r => Object.assign({ id: newRowId() }, r));
                changed = true;
            }
        });
        return changed;
    }

    function migratePvSeedRows() {
        let changed = false;
        changed = migratePvStageSeedRows('transport', PV_TRANSPORT_SEED_ROWS) || changed;
        changed = migratePvStageSeedRows('construction', PV_CONSTRUCTION_SEED_ROWS) || changed;
        changed = migratePvStageSeedRows('production-retirement', PV_PRODUCTION_SEED_ROWS) || changed;
        changed = migratePvStageSeedRows('transmission', PV_TRANSMISSION_SEED_ROWS) || changed;
        if (changed) saveModels();
    }

    // 非光伏发电模型的通用示例数据行（放在"默认"大类下）
    const GENERIC_STAGE_ROWS = {
        'raw-materials': [
            { id: 'rd-rm-001', dataName: '多晶硅料', emissionCoefficient: '50.0', functionalUnit: 'kg', emissionFactor: '50.0 kgCO2e/kg', factorSource: 'ecoinvent', dataSource: '行业文献' },
            { id: 'rd-rm-002', dataName: '钢材', emissionCoefficient: '2.1', functionalUnit: 'kg', emissionFactor: '2.1 kgCO2e/kg', factorSource: 'CLCD-China', dataSource: '统计年鉴' },
            { id: 'rd-rm-003', dataName: '玻璃纤维', emissionCoefficient: '2.5', functionalUnit: 'kg', emissionFactor: '2.5 kgCO2e/kg', factorSource: 'CLCD-China', dataSource: '企业报告' }
        ],
        'transport': [
            { id: 'rd-tp-001', dataName: '公路运输', emissionCoefficient: '0.05', functionalUnit: 't·km', emissionFactor: '0.05 kgCO2e/(t·km)', factorSource: 'CLCD-China', dataSource: '行业统计' },
            { id: 'rd-tp-002', dataName: '铁路运输', emissionCoefficient: '0.01', functionalUnit: 't·km', emissionFactor: '0.01 kgCO2e/(t·km)', factorSource: 'ecoinvent', dataSource: '文献' }
        ],
        'construction': [
            { id: 'rd-cs-001', dataName: '混凝土', emissionCoefficient: '0.12', functionalUnit: 'kg', emissionFactor: '0.12 kgCO2e/kg', factorSource: 'CLCD-China', dataSource: '施工台账' },
            { id: 'rd-cs-002', dataName: '柴油', emissionCoefficient: '0.74', functionalUnit: 'kg', emissionFactor: '0.74 kgCO2e/kg', factorSource: 'IPCC', dataSource: '燃料统计' }
        ],
        'production-retirement': [
            { id: 'rd-pr-001', dataName: '燃煤', emissionCoefficient: '2.46', functionalUnit: 'kg', emissionFactor: '2.46 kgCO2e/kg', factorSource: 'IPCC', dataSource: '运行数据' },
            { id: 'rd-pr-002', dataName: '电力消费', emissionCoefficient: '0.58', functionalUnit: 'kWh', emissionFactor: '0.58 kgCO2e/kWh', factorSource: '区域电网', dataSource: '电网公司' },
            { id: 'rd-pr-003', dataName: '退役回收', emissionCoefficient: '-0.5', functionalUnit: 'kg', emissionFactor: '-0.5 kgCO2e/kg', factorSource: 'CLCD-China', dataSource: '回收企业' }
        ],
        'transmission': [
            { id: 'rd-tm-001', dataName: '电网输配损耗', emissionCoefficient: '0.02', functionalUnit: 'kWh', emissionFactor: '0.02 kgCO2e/kWh', factorSource: '区域电网', dataSource: '电网公司' },
            { id: 'rd-tm-002', dataName: 'SF6 逸散', emissionCoefficient: '23500', functionalUnit: 'kg', emissionFactor: '23500 kgCO2e/kg', factorSource: 'IPCC', dataSource: '设备台账' }
        ]
    };

    function newCatId() {
        return 'cat-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    // 按模型+阶段生成大类种子（大类下数据行初始为空，由用户录入）
    function getStageSeed(modelCode, stageId) {
        if (modelCode === PV_MODEL_CODE && PV_STAGE_CATEGORIES[stageId]) {
            return PV_STAGE_CATEGORIES[stageId].map(name => ({
                id: newCatId(),
                name: name,
                rows: []
            }));
        }
        // 其他模型：单"默认"大类，保留原有示例数据行
        const rows = (GENERIC_STAGE_ROWS[stageId] || []).map(r => Object.assign({}, r));
        return [{ id: newCatId(), name: '默认', rows: rows }];
    }

    function ensureModelStages(model) {
        if (!model.stages || typeof model.stages !== 'object') model.stages = {};
        STAGE_DEFINITIONS.forEach(s => {
            if (!model.stages[s.id]) model.stages[s.id] = getStageSeed(model.code, s.id);
        });
    }

    function getModelStageCategories(model, stageId) {
        ensureModelStages(model);
        return model.stages[stageId] || [];
    }

    function newRowId() {
        return 'rd-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function getStageName(model, stageId) {
        if (model.stageNames && model.stageNames[stageId]) return model.stageNames[stageId];
        const def = STAGE_DEFINITIONS.find(s => s.id === stageId);
        return def ? def.name : stageId;
    }

    /* ============ 通用工具 ============ */
    const $ = (sel, root = document) => root.querySelector(sel);
    const el = (tag, attrs = {}, children = []) => {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'class') node.className = v;
            else if (k === 'html') node.innerHTML = v;
            else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
            else if (['readonly', 'disabled', 'checked', 'selected', 'multiple', 'autofocus', 'required', 'hidden'].indexOf(k) >= 0) {
                if (v) node.setAttribute(k, k);
            }
            else node.setAttribute(k, v);
        });
        (Array.isArray(children) ? children : [children]).forEach(c => {
            if (c == null) return;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return node;
    };

    const boundaryLabel = (val) => (SYSTEM_BOUNDARIES.find(b => b.value === val) || {}).label || val;

    /* ============ 模块配置（侧边栏一级/二级模块启停 + 名称自定义） ============ */
    const MODULE_CONFIG_KEY = 'cmp:module-config:v2';
    let moduleConfig = null;

    // 系统内置模块名称（恢复默认时使用，独立于已被自定义改写的 DOM 文案）
    const DEFAULT_MODULE_NAMES = {
        'product-carbon-footprint': '产品碳足迹'
    };
    const DEFAULT_CHILD_NAMES = {
        'product-carbon-model': '碳模型',
        'product-carbon-model-train': '碳足迹模型',
        'product-carbon-accounting': '产品碳排放',
        'product-carbon-accounting-train': '碳足迹核算',
        'carbon-footprint-report': '碳足迹报告'
    };

    // 默认配置：模块结构从侧边栏 DOM 采集，名称取系统内置常量（缺省回退 DOM 文案），全部启用
    function getDefaultModuleConfig() {
        const cfg = {};
        document.querySelectorAll('.sidebar .nav-item[data-module]').forEach(item => {
            const modKey = item.dataset.module;
            const domText = ((item.querySelector('.nav-item-title .nav-text') || {}).textContent || modKey).trim();
            cfg[modKey] = { name: DEFAULT_MODULE_NAMES[modKey] || domText, enabled: true, children: {} };
            item.querySelectorAll('.nav-child[data-route]').forEach(li => {
                const routeKey = li.dataset.route;
                const childText = ((li.querySelector('a') || {}).textContent || routeKey).trim();
                cfg[modKey].children[routeKey] = { name: DEFAULT_CHILD_NAMES[routeKey] || childText, enabled: true };
            });
        });
        return cfg;
    }

    function loadModuleConfig() {
        const def = getDefaultModuleConfig();
        try {
            const raw = localStorage.getItem(MODULE_CONFIG_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                // 以 DOM 默认结构为准合并：启用状态与自定义名称以保存值为准，新增模块取默认值
                Object.keys(def).forEach(mk => {
                    if (saved[mk]) {
                        def[mk].enabled = saved[mk].enabled !== false;
                        if (typeof saved[mk].name === 'string' && saved[mk].name.trim()) {
                            def[mk].name = saved[mk].name.trim();
                        }
                        Object.keys(def[mk].children).forEach(ck => {
                            if (saved[mk].children && saved[mk].children[ck]) {
                                def[mk].children[ck].enabled = saved[mk].children[ck].enabled !== false;
                                if (typeof saved[mk].children[ck].name === 'string' && saved[mk].children[ck].name.trim()) {
                                    def[mk].children[ck].name = saved[mk].children[ck].name.trim();
                                }
                            }
                        });
                    }
                });
            }
        } catch (e) {}
        moduleConfig = def;
        return def;
    }

    function saveModuleConfig() {
        try { localStorage.setItem(MODULE_CONFIG_KEY, JSON.stringify(moduleConfig)); } catch (e) {}
    }

    // 根据配置更新侧边栏模块名称与显隐
    function applyModuleConfig() {
        if (!moduleConfig) loadModuleConfig();
        document.querySelectorAll('.sidebar .nav-item[data-module]').forEach(item => {
            const modKey = item.dataset.module;
            const modCfg = moduleConfig[modKey];
            if (!modCfg) { item.style.display = ''; return; }
            // 一级模块名称与显隐
            item.style.display = modCfg.enabled ? '' : 'none';
            const nameEl = item.querySelector('.nav-item-title .nav-text');
            if (nameEl) nameEl.textContent = modCfg.name;
            // 二级模块名称与显隐
            item.querySelectorAll('.nav-child[data-route]').forEach(li => {
                const ck = li.dataset.route;
                const cc = modCfg.children[ck];
                li.style.display = (!cc || cc.enabled) ? '' : 'none';
                const a = li.querySelector('a');
                if (a && cc) a.textContent = cc.name;
            });
        });
    }

    // 路由归属：将所有子页面路由映射回侧边栏二级模块 key
    function getSidebarKeyOfRoute(route) {
        if (route === 'carbon-accounting' || route === 'stage-calculation' || route === 'grid-supply-calculation') {
            return 'product-carbon-accounting';
        }
        if (route === 'train-new-model' || route === 'train-model-list' || route === 'train-model-view' || route === 'train-model-definition') {
            return 'product-carbon-model-train';
        }
        if (route === 'train-accounting-new' || route === 'train-accounting-list' || route === 'train-accounting-detail' || route === 'train-accounting-view' || route === 'train-stage-calculation' || route === 'train-grid-supply-calculation') {
            return 'product-carbon-accounting-train';
        }
        if (route === 'train-report-write' || route === 'train-report-list' || route === 'train-report-edit' || route === 'train-report-preview') {
            return 'carbon-footprint-report';
        }
        return route;
    }

    // 判断路由所属模块是否启用
    function isRouteEnabled(route) {
        if (!route) return true;
        const cfg = moduleConfig || loadModuleConfig();
        const modEntry = Object.entries(cfg).find(([mk, mv]) => mv.children[getSidebarKeyOfRoute(route)]);
        if (!modEntry) return true; // 未纳入管理的路由放行
        const [modKey, modCfg] = modEntry;
        if (!modCfg.enabled) return false;
        const cc = modCfg.children[getSidebarKeyOfRoute(route)];
        return !cc || cc.enabled;
    }

    // 模块管理弹窗
    function openModuleManageModal() {
        const existed = $('.modal-mask');
        if (existed) existed.remove();
        const cfg = moduleConfig || loadModuleConfig();
        const defaults = getDefaultModuleConfig();
        const modKeys = Object.keys(cfg);

        // 弹窗内临时状态（名称 + 启停），点保存后才写回
        const state = {};
        modKeys.forEach(mk => {
            state[mk] = { name: cfg[mk].name, enabled: cfg[mk].enabled, children: {} };
            Object.keys(cfg[mk].children).forEach(ck => {
                state[mk].children[ck] = { name: cfg[mk].children[ck].name, enabled: cfg[mk].children[ck].enabled };
            });
        });

        const list = el('div', { class: 'module-config-list' });

        modKeys.forEach(modKey => {
            const modCfg = cfg[modKey];
            const group = el('div', { class: 'module-config-group' });

            // 一级模块行：复选框 + 名称输入框
            const parentCb = el('input', { type: 'checkbox' });
            parentCb.checked = state[modKey].enabled;
            const parentNameInput = el('input', {
                type: 'text',
                class: 'module-name-input module-name-input-parent',
                value: state[modKey].name,
                maxlength: '20',
                placeholder: '请输入一级模块名称'
            });
            parentNameInput.addEventListener('input', e => { state[modKey].name = e.target.value; });
            parentCb.addEventListener('change', e => {
                state[modKey].enabled = e.target.checked;
                syncChildState();
            });
            const header = el('div', { class: 'module-config-group-header' }, [
                parentCb, parentNameInput,
                el('span', { class: 'module-level-tag' }, ['一级模块'])
            ]);
            group.appendChild(header);

            // 二级模块列表
            const childBox = el('div', { class: 'module-config-children' });
            const childRows = [];
            Object.keys(modCfg.children).forEach(childKey => {
                const cc = modCfg.children[childKey];
                const cb = el('input', { type: 'checkbox' });
                cb.checked = state[modKey].children[childKey].enabled;
                cb.addEventListener('change', e => {
                    state[modKey].children[childKey].enabled = e.target.checked;
                });
                const nameInput = el('input', {
                    type: 'text',
                    class: 'module-name-input',
                    value: state[modKey].children[childKey].name,
                    maxlength: '20',
                    placeholder: '请输入模块名称'
                });
                nameInput.addEventListener('input', e => {
                    state[modKey].children[childKey].name = e.target.value;
                });
                const row = el('div', { class: 'module-config-child' }, [cb, nameInput]);
                childBox.appendChild(row);
                childRows.push({ cb, nameInput, row });
            });

            // 取消一级勾选时，二级复选框与名称输入框置灰不可操作
            function syncChildState() {
                childRows.forEach(x => {
                    x.cb.disabled = !state[modKey].enabled;
                    x.nameInput.disabled = !state[modKey].enabled;
                    x.row.classList.toggle('disabled-item', !state[modKey].enabled);
                });
            }
            syncChildState();

            group.appendChild(childBox);
            list.appendChild(group);
        });

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;margin-top:8px;min-height:18px;' }, ['']);

        const mask = el('div', { class: 'modal-mask' });
        const dlg = el('div', { class: 'modal', style: 'width:520px;' });
        dlg.appendChild(el('div', { class: 'modal-header' }, ['模块管理']));
        dlg.appendChild(el('div', { class: 'modal-body' }, [
            el('div', { class: 'form-tip', style: 'margin-bottom:12px;color:#6b7280;' }, ['可直接编辑模块显示名称；勾选需要显示的一级、二级模块，取消勾选后将从左侧导航隐藏。']),
            list,
            errBox
        ]));
        dlg.appendChild(el('div', { class: 'modal-footer' }, [
            el('button', {
                class: 'btn',
                onclick: () => {
                    // 恢复默认：全部启用 + 名称恢复为系统默认
                    modKeys.forEach(mk => {
                        state[mk].enabled = true;
                        state[mk].name = defaults[mk] ? defaults[mk].name : state[mk].name;
                        Object.keys(state[mk].children).forEach(ck => {
                            state[mk].children[ck].enabled = true;
                            state[mk].children[ck].name = (defaults[mk] && defaults[mk].children[ck]) ? defaults[mk].children[ck].name : state[mk].children[ck].name;
                        });
                    });
                    // 同步弹窗输入框
                    list.querySelectorAll('.module-config-group').forEach((g, gi) => {
                        const mk = modKeys[gi];
                        g.querySelector('.module-name-input-parent').value = state[mk].name;
                        g.querySelector('.module-config-group-header input[type="checkbox"]').checked = true;
                        g.querySelectorAll('.module-config-child').forEach((row, ci) => {
                            const ck = Object.keys(state[mk].children)[ci];
                            row.querySelector('input[type="checkbox"]').checked = true;
                            row.querySelector('.module-name-input').value = state[mk].children[ck].name;
                        });
                    });
                    errBox.textContent = '';
                }
            }, ['恢复默认']),
            el('button', { class: 'btn', onclick: close }, ['取消']),
            el('button', { class: 'btn btn-primary', onclick: () => { if (commitState()) close(); } }, ['保存'])
        ]));

        // 返回 true 表示校验通过并已保存
        function commitState() {
            // 校验：名称不能为空
            for (let i = 0; i < modKeys.length; i++) {
                const mk = modKeys[i];
                if (!state[mk].name.trim()) {
                    errBox.textContent = '一级模块名称不能为空';
                    return false;
                }
                for (let j = 0; j < Object.keys(state[mk].children).length; j++) {
                    const ck = Object.keys(state[mk].children)[j];
                    if (!state[mk].children[ck].name.trim()) {
                        errBox.textContent = '二级模块名称不能为空';
                        return false;
                    }
                }
            }
            modKeys.forEach(mk => {
                cfg[mk].enabled = state[mk].enabled;
                cfg[mk].name = state[mk].name.trim();
                Object.keys(cfg[mk].children).forEach(ck => {
                    cfg[mk].children[ck].enabled = state[mk].children[ck].enabled;
                    cfg[mk].children[ck].name = state[mk].children[ck].name.trim();
                });
            });
            saveModuleConfig();
            applyModuleConfig();
            // 若当前页面所属模块已停用，回到首页
            const full = (location.hash || '').replace(/^#\/?/, '');
            const curRoute = full.split('/')[0] || '';
            if (curRoute && !isRouteEnabled(curRoute)) navigate('#/home');
            return true;
        }
        function close() { document.body.removeChild(mask); }

        mask.appendChild(dlg);
        mask.addEventListener('click', e => { if (e.target === mask) close(); });
        document.body.appendChild(mask);
    }

    /* ============ 路由 ============ */
    const routes = {
        'product-carbon-model': renderProductCarbonModel,
        'product-carbon-model-train': renderProductCarbonModelTrain,
        'train-new-model': renderTrainNewModel,
        'train-model-list': renderTrainModelList,
        'train-model-view': (container, param) => renderTrainModelDefinition(container, param, true),
        'train-model-definition': renderTrainModelDefinition,
        'model-definition': renderModelDefinition,
        'product-carbon-accounting': renderProductCarbonAccounting,
        'carbon-accounting': renderCarbonAccounting,
        'stage-calculation': renderStageCalculation,
        'grid-supply-calculation': renderGridSupplyCalculation,
        'product-carbon-accounting-train': renderProductCarbonAccountingTrain,
        'train-accounting-new': renderTrainAccountingNew,
        'train-accounting-list': renderTrainAccountingList,
        'train-accounting-detail': renderTrainAccountingDetail,
        'train-accounting-view': (container, param) => renderTrainAccountingDetail(container, param, true),
        'train-stage-calculation': renderTrainStageCalculation,
        'train-grid-supply-calculation': renderTrainGridSupplyCalculation,
        'carbon-footprint-report': renderTrainReportHome,
        'train-report-write': renderTrainReportWriteList,
        'train-report-list': renderTrainReportListPage,
        'train-report-edit': renderTrainReportEdit,
        'train-report-preview': renderTrainReportPreview
    };

    function currentRouteKey() {
        const hash = (location.hash || '').replace(/^#\/?/, '');
        const [key] = hash.split('/');
        return key;
    }

    function navigate(hash) {
        location.hash = hash;
    }

    function router() {
        const key = currentRouteKey();
        const full = (location.hash || '').replace(/^#\/?/, '');
        const [route, ...rest] = full.split('/');
        const param = rest.join('/') || null;
        const container = $('#page-container');
        // 路由守卫：已停用模块的页面回到首页
        if (route && !isRouteEnabled(route)) {
            container.innerHTML = '';
            renderHome(container);
            syncSidebarActive('');
            const guardMain = document.querySelector('.main');
            if (guardMain) guardMain.scrollTop = 0;
            return;
        }
        const renderer = routes[route] || renderHome;
        container.innerHTML = '';
        renderer(container, param);
        syncSidebarActive(route);
        // 主内容区滚动条复位（App Shell 布局下由 .main 独立滚动）
        const mainEl = document.querySelector('.main');
        if (mainEl) mainEl.scrollTop = 0;
    }

    function syncSidebarActive(route) {
        // 核算详情页 / 阶段计算页 / 上网电量计算页归属「产品碳排放核算」菜单
        // 实训子页面（train-new-model / train-model-list / train-model-view / train-model-definition）归属「产品碳模型-实训」菜单
        let effective = route;
        if (route === 'carbon-accounting' || route === 'stage-calculation' || route === 'grid-supply-calculation') {
            effective = 'product-carbon-accounting';
        } else if (route === 'train-new-model' || route === 'train-model-list' || route === 'train-model-view' || route === 'train-model-definition') {
            effective = 'product-carbon-model-train';
        } else if (route === 'train-accounting-new' || route === 'train-accounting-list' || route === 'train-accounting-detail' || route === 'train-accounting-view' || route === 'train-stage-calculation' || route === 'train-grid-supply-calculation') {
            effective = 'product-carbon-accounting-train';
        } else if (route === 'train-report-write' || route === 'train-report-list' || route === 'train-report-edit' || route === 'train-report-preview') {
            effective = 'carbon-footprint-report';
        }
        document.querySelectorAll('.nav-child').forEach(li => {
            const r = li.dataset.route;
            li.classList.toggle('active', r === effective);
        });
    }

    /* ============ 首页 ============ */
    function renderHome(container) {
        container.appendChild(el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, ['首页']),
                el('div', { class: 'page-title' }, ['碳管理平台'])
            ])
        ]));
        container.appendChild(el('div', { class: 'placeholder-card' }, [
            '欢迎使用碳管理平台。请从左侧导航选择功能模块。'
        ]));
    }

    /* ============ 产品碳模型列表页 ============ */
    function renderProductCarbonModel(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    '碳模型'
                ]),
                el('div', { class: 'page-title' }, ['碳模型'])
            ]),
            el('div', { class: 'toolbar-left' }, [
                el('button', { class: 'btn btn-primary', onclick: () => openCreateModal(rebuildTable) }, ['+ 新建模型'])
            ])
        ]);

        const toolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left' }, [
                el('input', { type: 'text', placeholder: '搜索模型编码 / 模型名称', oninput: (e) => onSearch(e.target.value) })
            ]),
            el('div', {}, [
                el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['共 ' + models.length + ' 条记录'])
            ])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        let currentKeyword = '';
        let table = buildTable(models, openEditModal, deleteModel, rebuildTable);

        container.appendChild(header);
        container.appendChild(toolbar);
        tableCard.appendChild(table);
        container.appendChild(tableCard);

        function getFiltered() {
            const key = currentKeyword.trim().toLowerCase();
            return !key ? models.slice() : models.filter(m =>
                m.code.toLowerCase().includes(key) || m.name.toLowerCase().includes(key)
            );
        }

        function rebuildTable() {
            const filtered = getFiltered();
            const newTable = buildTable(filtered, openEditModal, deleteModel, rebuildTable);
            tableCard.replaceChild(newTable, table);
            table = newTable;
            const countEl = $('.toolbar .form-tip');
            if (countEl) countEl.textContent = '共 ' + filtered.length + ' 条记录';
        }

        function onSearch(kw) {
            currentKeyword = kw;
            rebuildTable();
        }
    }

    function buildTable(rows, openEditModal, deleteModel, onSaved) {
        if (!rows.length) {
            return el('div', { class: 'empty' }, ['暂无数据']);
        }
        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['模型编码', '模型名称', '功能单位', '系统边界', '基准年', '实景过程范围', '引用标准', '操作'].forEach(t => {
            trh.appendChild(el('th', {}, [t]));
        });
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        rows.forEach(m => {
            const tr = el('tr');

            // 模型编码
            tr.appendChild(el('td', {}, [m.code]));

            // 模型名称
            tr.appendChild(el('td', {}, [m.name]));

            // 功能单位
            tr.appendChild(el('td', {}, [m.functionalUnit || '']));

            // 系统边界（下拉）
            const select = el('select', { class: 'cell-select', onchange: (e) => onBoundaryChange(m, e.target.value) });
            SYSTEM_BOUNDARIES.forEach(b => {
                const opt = el('option', { value: b.value }, [b.label]);
                if (b.value === m.boundary) opt.selected = true;
                select.appendChild(opt);
            });
            tr.appendChild(el('td', {}, [select]));

            // 基准年
            tr.appendChild(el('td', {}, [String(m.baseYear)]));

            // 实景过程范围
            tr.appendChild(el('td', {}, [m.scope]));

            // 引用标准
            tr.appendChild(el('td', {}, [m.referenceStandard || '']));

            // 操作 - 编辑 | 模型定义 | 删除
            const editBtn = el('button', { class: 'btn-link', onclick: () => openEditModal(m, onSaved) }, ['编辑']);
            const sep1 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const defBtn = el('button', { class: 'btn-link', onclick: () => navigate('#/model-definition/' + encodeURIComponent(m.code)) }, ['模型定义']);
            const sep2 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const delBtn = el('button', { class: 'btn-link btn-danger', onclick: () => deleteModel(m, onSaved) }, ['删除']);
            tr.appendChild(el('td', {}, [editBtn, sep1, defBtn, sep2, delBtn]));

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    /* ============ 删除模型（确认弹窗） ============ */
    function deleteModel(model, onSaved) {
        openConfirmModal(
            '确认删除',
            '确定要删除模型「' + model.name + '」（编码：' + model.code + '）吗？此操作不可恢复。',
            function onConfirm() {
                const idx = models.indexOf(model);
                if (idx > -1) {
                    models.splice(idx, 1);
                    saveModels();
                }
                if (typeof onSaved === 'function') onSaved();
            }
        );
    }

    /* ============ 通用确认弹窗 ============ */
    function openConfirmModal(title, message, onConfirm) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        function close() { mask.remove(); }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal', style: 'width:420px;' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, [title]),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                el('div', { class: 'modal-body' }, [message]),
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: confirm }, ['确定'])
                ])
            ])
        ]);

        function confirm() {
            const result = onConfirm ? onConfirm() : undefined;
            close();
            return result;
        }

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    /* ============ 系统边界示意图上传组件 ============ */
    // 返回 { el, getValue }，图片以 base64 存储
    function buildDiagramUpload(currentSrc) {
        let value = currentSrc || '';
        const wrap = el('div', {});
        const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
        const preview = el('div', { style: 'margin-top:8px;' });

        const uploadBtn = el('button', {
            class: 'btn',
            type: 'button',
            onclick: () => fileInput.click()
        }, [value ? '重新上传示意图' : '上传系统边界示意图']);

        const removeBtn = el('button', {
            class: 'btn',
            type: 'button',
            style: 'margin-left:8px;color:#dc2626;',
            onclick: () => {
                value = '';
                fileInput.value = '';
                renderPreview();
            }
        }, ['移除']);

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('请选择图片文件');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('图片大小不能超过 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                value = reader.result;
                renderPreview();
            };
            reader.readAsDataURL(file);
        });

        function renderPreview() {
            preview.innerHTML = '';
            uploadBtn.textContent = value ? '重新上传示意图' : '上传系统边界示意图';
            if (value) {
                preview.appendChild(el('img', {
                    src: value,
                    style: 'max-width:100%;max-height:220px;border:1px solid #e5e7eb;border-radius:4px;display:block;'
                }));
                removeBtn.style.display = '';
            } else {
                removeBtn.style.display = 'none';
            }
        }

        wrap.appendChild(el('div', {}, [uploadBtn, removeBtn]));
        wrap.appendChild(fileInput);
        wrap.appendChild(preview);
        renderPreview();

        return { el: wrap, getValue: () => value };
    }

    /* ============ 产品碳模型-实训 落地页 ============ */
    function renderProductCarbonModelTrain(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    '碳足迹模型'
                ]),
                el('div', { class: 'page-title' }, ['碳足迹模型'])
            ])
        ]);

        // 流程卡片
        const cards = el('div', { class: 'flow-cards' }, [
            // 新建模型
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-new-model') }, [
                el('div', { class: 'flow-icon' }, ['📋']),
                el('div', { class: 'flow-title' }, ['新建模型']),
                el('div', { class: 'flow-desc' }, [
                    '以列表形式展示碳足迹模型信息，支持新建、编辑和删除。',
                    el('br'),
                    '字段包括：模型编码、模型名称、功能单位、系统边界（含示意图上传）、引用标准和说明。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ]),
            // 模型列表
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-model-list') }, [
                el('div', { class: 'flow-icon' }, ['🔧']),
                el('div', { class: 'flow-title' }, ['模型列表']),
                el('div', { class: 'flow-desc' }, [
                    '展示所有已创建的模型，',
                    el('br'),
                    '包含阶段划分、大类配置和碳足迹因子数据行，支持按模型编码和模型名称筛选。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ])
        ]);

        // 操作说明
        const notice = el('div', { class: 'train-notice' }, [
            el('h3', {}, ['操作说明']),
            el('ol', {}, [
                el('li', {}, ['点击"新建模型"进行产品类型模型创建（例如光伏发电系统），包括模型编码、模型名称等基本信息；']),
                el('li', {}, ['点击"模型定义"进行产品分类、碳足迹因子等数据录入和审核；']),
                el('li', {}, ['点击"模型列表"，查看已创建的模型数据。'])
            ])
        ]);

        container.appendChild(header);
        container.appendChild(cards);
        container.appendChild(notice);
    }

    /* ============ 产品碳模型-实训 新建模型列表页 ============ */
    function renderTrainNewModel(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-model-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹模型']),
                    el('span', { class: 'sep' }, ['/']),
                    '新建模型'
                ]),
                el('div', { class: 'page-title' }, ['新建模型'])
            ]),
            el('div', { class: 'toolbar-left' }, [
                el('button', { class: 'btn btn-primary', onclick: () => openTrainCreateModal(rebuildTrainTable) }, ['+ 新建模型'])
            ])
        ]);

        const toolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left' }, [
                el('input', { type: 'text', placeholder: '搜索模型编码 / 模型名称', oninput: (e) => onSearch(e.target.value) })
            ]),
            el('div', {}, [
                el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['共 ' + trainModels.length + ' 条记录'])
            ])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        let currentKeyword = '';
        let table = buildTrainTable(trainModels, openTrainEditModal, deleteTrainModel, rebuildTrainTable);

        container.appendChild(header);
        container.appendChild(toolbar);
        tableCard.appendChild(table);
        container.appendChild(tableCard);

        function getFiltered() {
            const key = currentKeyword.trim().toLowerCase();
            return !key ? trainModels.slice() : trainModels.filter(m =>
                m.code.toLowerCase().includes(key) || m.name.toLowerCase().includes(key)
            );
        }

        function rebuildTrainTable() {
            const filtered = getFiltered();
            const newTable = buildTrainTable(filtered, openTrainEditModal, deleteTrainModel, rebuildTrainTable);
            tableCard.replaceChild(newTable, table);
            table = newTable;
            const countEl = $('.toolbar .form-tip');
            if (countEl) countEl.textContent = '共 ' + filtered.length + ' 条记录';
        }

        function onSearch(kw) {
            currentKeyword = kw;
            rebuildTrainTable();
        }
    }

    // 系统边界列提示内容
    const BOUNDARY_TIP = '系统边界定义产品碳足迹评价的范围。从摇篮到大门：涵盖原材料获取到产品出厂；从摇篮到坟墓：涵盖原材料获取到产品退役回收全生命周期。可上传系统边界示意图以直观展示评价范围。';

    function buildTrainTable(rows, openEditModal, deleteModel, onSaved) {
        if (!rows.length) {
            return el('div', { class: 'empty' }, ['暂无数据']);
        }
        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        // 表头：模型编码、模型名称、功能单位、系统边界（含提示符号）、引用标准、说明、创建人、审核确定人、操作
        const thBoundary = el('th', {}, [
            '系统边界',
            el('span', { class: 'tip-icon' }, [
                '?',
                el('span', { class: 'tip-text' }, [BOUNDARY_TIP])
            ])
        ]);
        ['模型编码', '模型名称', '功能单位'].forEach(t => trh.appendChild(el('th', {}, [t])));
        trh.appendChild(thBoundary);
        ['引用标准', '说明', '操作', '创建人', '审核人', '状态'].forEach(t => trh.appendChild(el('th', {}, [t])));
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        rows.forEach(m => {
            const tr = el('tr');

            // 模型编码
            tr.appendChild(el('td', {}, [m.code]));

            // 模型名称
            tr.appendChild(el('td', {}, [m.name]));

            // 功能单位
            tr.appendChild(el('td', {}, [m.functionalUnit || '']));

            // 系统边界（下拉 + 缩略图/上传入口）
            const tdBoundary = el('td', {});
            const select = el('select', { class: 'cell-select', onchange: (e) => { m.boundary = e.target.value; saveTrainModels(); } });
            SYSTEM_BOUNDARIES.forEach(b => {
                const opt = el('option', { value: b.value }, [b.label]);
                if (b.value === m.boundary) opt.selected = true;
                select.appendChild(opt);
            });
            tdBoundary.appendChild(el('div', {}, [select]));

            // 示意图缩略图或上传提示
            if (m.boundaryDiagram) {
                const thumb = el('img', {
                    src: m.boundaryDiagram,
                    style: 'max-width:60px;max-height:40px;border:1px solid #e5e7eb;border-radius:3px;margin-top:4px;cursor:pointer;',
                    title: '点击查看大图',
                    onclick: () => openTrainDiagramPreview(m.boundaryDiagram)
                });
                tdBoundary.appendChild(thumb);
            } else {
                tdBoundary.appendChild(el('div', { class: 'form-tip', style: 'margin-top:4px;' }, ['未上传示意图']));
            }
            tr.appendChild(tdBoundary);

            // 引用标准
            tr.appendChild(el('td', {}, [m.referenceStandard || '']));

            // 说明
            tr.appendChild(el('td', { style: 'max-width:240px;' }, [m.description || '']));

            // 操作 - 模型定义 | 编辑 | 删除
            const defBtn = el('button', { class: 'btn-link', style: 'color:#0f766e;', onclick: () => navigate('#/train-model-definition/' + encodeURIComponent(m.code)) }, ['模型定义']);
            const sep0 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const editBtn = el('button', { class: 'btn-link', onclick: () => openEditModal(m, onSaved) }, ['编辑']);
            const sep1 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const delBtn = el('button', { class: 'btn-link btn-danger', onclick: () => deleteModel(m, onSaved) }, ['删除']);
            tr.appendChild(el('td', {}, [defBtn, sep0, editBtn, sep1, delBtn]));

            // 创建人
            tr.appendChild(el('td', {}, [m.modelCreator || '']));

            // 审核人
            tr.appendChild(el('td', {}, [m.modelReviewer || '']));

            // 状态
            const isReviewed = m.status === '已审核' || (m.modelReviewer && !m.status);
            tr.appendChild(el('td', {}, [
                el('span', {
                    style: 'font-size:12px;padding:2px 8px;border-radius:4px;' +
                        (isReviewed ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#d97706;')
                }, [isReviewed ? '已审核' : '待审核'])
            ]));

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    // 示意图大图预览
    function openTrainDiagramPreview(src) {
        const mask = el('div', { class: 'modal-mask', style: 'display:flex;align-items:center;justify-content:center;' }, [
            el('div', { style: 'max-width:80%;max-height:90%;position:relative;' }, [
                el('img', { src: src, style: 'max-width:100%;max-height:80vh;border-radius:6px;display:block;' }),
                el('button', { class: 'btn', style: 'margin-top:12px;', onclick: () => mask.remove() }, ['关闭'])
            ])
        ]);
        mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
        document.body.appendChild(mask);
    }

    /* ============ 产品碳模型-实训 模型列表页 ============ */
    function renderTrainModelList(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-model-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹模型']),
                    el('span', { class: 'sep' }, ['/']),
                    '模型列表'
                ]),
                el('div', { class: 'page-title' }, ['模型列表'])
            ]),
        ]);

        // 筛选栏
        let filterCode = '';
        let filterName = '';
        const toolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left', style: 'gap:8px;display:flex;align-items:center;' }, [
                el('input', { type: 'text', class: 'form-control', style: 'width:200px;', placeholder: '模型编码', oninput: (e) => { filterCode = e.target.value; rebuild(); } }),
                el('input', { type: 'text', class: 'form-control', style: 'width:200px;', placeholder: '模型名称', oninput: (e) => { filterName = e.target.value; rebuild(); } })
            ]),
            el('div', {}, [el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['共 ' + trainModels.filter(m => m.status === '已审核' || (m.modelReviewer && !m.status)).length + ' 个模型'])])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        container.appendChild(header);
        container.appendChild(toolbar);
        container.appendChild(tableCard);

        function getFiltered() {
            const kc = filterCode.trim().toLowerCase();
            const kn = filterName.trim().toLowerCase();
            return trainModels.filter(m =>
                (m.status === '已审核' || (m.modelReviewer && !m.status)) &&
                (!kc || m.code.toLowerCase().includes(kc)) &&
                (!kn || m.name.toLowerCase().includes(kn))
            );
        }

        function buildListTable(rows) {
            if (!rows.length) {
                return el('div', { class: 'empty' }, ['暂无已审核的模型']);
            }
            const table = el('table', { class: 'data-table' });
            const thead = el('thead');
            const trh = el('tr');
            ['模型编码', '模型名称', '功能单位', '系统边界', '引用标准', '说明', '操作', '创建人', '审核人', '状态'].forEach(t => trh.appendChild(el('th', {}, [t])));
            thead.appendChild(trh);
            table.appendChild(thead);

            const tbody = el('tbody');
            rows.forEach(m => {
                const tr = el('tr');
                const boundaryLabel = (SYSTEM_BOUNDARIES.find(b => b.value === m.boundary) || {}).label || m.boundary || '';
                tr.appendChild(el('td', {}, [m.code]));
                tr.appendChild(el('td', {}, [m.name]));
                tr.appendChild(el('td', {}, [m.functionalUnit || '']));
                tr.appendChild(el('td', {}, [boundaryLabel]));
                tr.appendChild(el('td', {}, [m.referenceStandard || '']));
                tr.appendChild(el('td', { style: 'max-width:240px;' }, [m.description || '']));
                tr.appendChild(el('td', {}, [
                    el('button', {
                        class: 'btn-link',
                        style: 'color:#0f766e;',
                        onclick: () => navigate('#/train-model-view/' + encodeURIComponent(m.code))
                    }, ['进入模型'])
                ]));
                tr.appendChild(el('td', {}, [m.modelCreator || '']));
                tr.appendChild(el('td', {}, [m.modelReviewer || '']));
                const isReviewed = m.status === '已审核' || (m.modelReviewer && !m.status);
                tr.appendChild(el('td', {}, [
                    el('span', {
                        style: 'font-size:12px;padding:2px 8px;border-radius:4px;' +
                            (isReviewed ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#d97706;')
                    }, [isReviewed ? '已审核' : '待审核'])
                ]));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        }

        let currentTable = null;
        function rebuild() {
            const filtered = getFiltered();
            const newTable = buildListTable(filtered);
            if (currentTable) tableCard.replaceChild(newTable, currentTable);
            else tableCard.appendChild(newTable);
            currentTable = newTable;
            const countEl = toolbar.querySelector('.form-tip');
            if (countEl) countEl.textContent = '共 ' + filtered.length + ' 个模型';
        }

        rebuild();
    }

    /* ============ 产品碳模型-实训 模型定义页（readonly=true 时为只读查看页） ============ */
    function renderTrainModelDefinition(container, modelCode, readonly) {
        const code = modelCode ? decodeURIComponent(modelCode) : '';
        const model = trainModels.find(m => m.code === code);
        if (!model) {
            container.appendChild(el('div', { class: 'page-header' }, [
                el('div', { class: 'page-title' }, ['未找到模型'])
            ]));
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的模型，请从模型列表中进入。']));
            return;
        }

        const stages = model.stages;
        const boundaryLabel = (SYSTEM_BOUNDARIES.find(b => b.value === model.boundary) || {}).label || model.boundary || '';

        // 模型定义被编辑/删除后：若已审核则回退为待审核，并持久化
        function touchModel() {
            if (model.status === '已审核') model.status = '待审核';
            saveTrainModels();
        }

        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-model-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹模型']),
                    el('span', { class: 'sep' }, ['/'])
                ].concat(readonly ? [
                    el('a', { href: '#/train-model-list', style: 'color:#0f766e;text-decoration:none;' }, ['模型列表']),
                    el('span', { class: 'sep' }, ['/']),
                    '模型查看'
                ] : [
                    '模型定义'
                ])),
                el('div', { class: 'page-title' }, [(readonly ? '模型查看' : '模型定义') + ' — ' + model.name])
            ])
        ]);

        // 说明
        const introCard = el('div', { class: 'table-card' });
        introCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:8px;' }, ['说明']));
        introCard.appendChild(el('div', { class: 'form-tip', style: 'line-height:1.7;' }, readonly ? [
            '本页面为只读查看页面。左侧快捷导览栏以阶段为一级、大类为二级，点击阶段或大类可在右侧查看对应数据。'
        ] : [
            '左侧快捷导览栏以阶段为一级、大类为二级，支持名称编辑和删除。点击阶段或大类可在右侧查看对应数据。',
            el('br'),
            '数据行支持新增、编辑和删除操作。'
        ]));
        container.appendChild(header);
        container.appendChild(introCard);

        // 模型信息卡
        const metaCard = el('div', { class: 'table-card' });
        metaCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['模型信息']));
        const metaGrid = el('div', { class: 'result-grid' });
        const modelReviewStatus = (model.status === '已审核' || (model.modelReviewer && !model.status)) ? '已审核' : '待审核';
        const metaItems = [
            ['模型编码', model.code],
            ['模型名称', model.name],
            ['功能单位', model.functionalUnit || ''],
            ['系统边界', boundaryLabel],
            ['引用标准', model.referenceStandard || ''],
            ['创建人', model.modelCreator || ''],
            ['审核人', model.modelReviewer || ''],
            ['核算状态', modelReviewStatus]
        ];
        metaItems.forEach(([label, value]) => {
            const valueContent = (label === '核算状态' && modelReviewStatus === '待审核' && !readonly)
                ? [el('span', {
                    style: 'color:#b45309;text-decoration:underline;cursor:pointer;',
                    onclick: () => {
                        const mmodal = el('div', { class: 'modal-mask' });
                        const mdlg = el('div', { class: 'modal', style: 'width:380px;' });
                        mdlg.appendChild(el('div', { class: 'modal-header' }, ['审核确认']));
                        mdlg.appendChild(el('div', { class: 'modal-body' }, [
                            el('div', { style: 'margin-bottom:10px;color:#374151;' }, ['是否通过审核？']),
                            el('div', { style: 'color:#6b7280;font-size:13px;' }, ['通过后状态将变更为"已审核"，再次编辑/删除需重新审核。'])
                        ]));
                        mdlg.appendChild(el('div', { class: 'modal-footer' }, [
                            el('button', { class: 'btn', onclick: () => document.body.removeChild(mmodal) }, ['取消']),
                            el('button', { class: 'btn btn-primary', onclick: () => {
                                model.status = '已审核';
                                saveTrainModels();
                                document.body.removeChild(mmodal);
                                const pc = document.getElementById('page-container');
                                if (pc) { pc.innerHTML = ''; renderTrainModelDefinition(pc, encodeURIComponent(code), readonly); }
                            } }, ['通过审核'])
                        ]));
                        mmodal.appendChild(mdlg);
                        mmodal.addEventListener('click', e => { if (e.target === mmodal) document.body.removeChild(mmodal); });
                        document.body.appendChild(mmodal);
                    }
                }, [modelReviewStatus])]
                : [value || '—'];
            metaGrid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, [label]),
                el('div', { class: 'value' }, valueContent)
            ]));
        });
        metaCard.appendChild(metaGrid);
        container.appendChild(metaCard);

        // 两栏布局
        let activeStageIdx = 0;
        let activeCatIdx = -1; // -1 表示选中整个阶段（显示所有大类）

        const layout = el('div', { class: 'model-def-layout' });

        // 左侧：快捷导览栏
        const stageList = el('div', { class: 'stage-list' });
        const stageListHeader = el('div', { class: 'stage-list-header' }, ['快捷导览']);
        stageList.appendChild(stageListHeader);
        const navBody = el('div', {});
        stageList.appendChild(navBody);
        if (!readonly) {
            stageList.appendChild(el('button', {
                class: 'btn',
                style: 'width:100%;margin-top:8px;font-size:12px;',
                onclick: () => {
                    stages.push({ stageId: 'stage-' + Date.now(), stageName: '新阶段', categories: [] });
                    activeStageIdx = stages.length - 1;
                    activeCatIdx = -1;
                    touchModel();
                    refreshNav();
                    refreshContent();
                }
            }, ['+ 新增阶段']));
        }

        // 右侧：内容区
        const stageData = el('div', { class: 'stage-data' });

        layout.appendChild(stageList);
        layout.appendChild(stageData);
        container.appendChild(layout);

        // 底部确认按钮（仅编辑模式）
        if (!readonly) {
            const confirmBar = el('div', { class: 'table-card', style: 'margin-top:16px;display:flex;justify-content:flex-end;' }, [
                el('button', {
                    class: 'btn btn-primary',
                    onclick: () => {
                        if (model.status !== '已审核') model.status = '待审核';
                        saveTrainModels();
                        openConfirmModal('确认成功', '模型定义已确认并提交，等待审核人审核。', () => {
                            const pc = document.getElementById('page-container');
                            if (pc) { pc.innerHTML = ''; renderTrainModelDefinition(pc, encodeURIComponent(code), readonly); }
                        });
                    }
                }, ['确认'])
            ]);
            container.appendChild(confirmBar);
        }

        function buildNavActions(onEdit, onDelete) {
            if (readonly) return null;
            return el('span', { class: 'nav-tree-actions' }, [
                el('span', { class: 'nav-edit', title: '编辑名称', onclick: (e) => { e.stopPropagation(); onEdit(); } }, ['✎']),
                el('span', { class: 'nav-delete', title: '删除', onclick: (e) => { e.stopPropagation(); onDelete(); } }, ['✕'])
            ]);
        }

        function startStageRename(stage, refreshNav, refreshContent) {
            const item = navBody.querySelector('[data-stage-idx="' + stages.indexOf(stage) + '"]');
            if (!item) return;
            const nameSpan = item.querySelector('.stage-name-text');
            if (!nameSpan) return;
            const oldName = stage.stageName;
            const input = el('input', { class: 'stage-rename-input', value: oldName });
            nameSpan.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                const v = input.value.trim();
                if (v && v !== oldName) {
                    stage.stageName = v;
                    touchModel();
                }
                refreshNav();
                refreshContent();
            };
            const cancel = () => { refreshNav(); };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
            });
        }

        function startCatRename(stage, cat, refreshNav, refreshContent) {
            const sIdx = stages.indexOf(stage);
            const catIdx = stage.categories.indexOf(cat);
            const stageDiv = navBody.children[sIdx];
            if (!stageDiv) return;
            const item = stageDiv.querySelector('[data-cat-idx="' + catIdx + '"]');
            if (!item) return;
            const nameSpan = item.querySelector('.cat-name-text');
            if (!nameSpan) return;
            const oldName = cat.categoryName;
            const input = el('input', { class: 'nav-tree-rename-input', value: oldName });
            nameSpan.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                const v = input.value.trim();
                if (v && v !== oldName) {
                    cat.categoryName = v;
                    touchModel();
                }
                refreshNav();
                refreshContent();
            };
            const cancel = () => { refreshNav(); };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
            });
        }

        function deleteStage(stage, refreshNav, refreshContent) {
            openConfirmModal('确认删除', '确定要删除阶段「' + stage.stageName + '」及其所有大类和数据行吗？', function () {
                const idx = stages.indexOf(stage);
                if (idx > -1) {
                    stages.splice(idx, 1);
                    touchModel();
                    if (activeStageIdx >= stages.length) activeStageIdx = stages.length - 1;
                    if (activeStageIdx < 0) activeStageIdx = 0;
                    activeCatIdx = -1;
                    refreshNav();
                    refreshContent();
                }
            });
        }

        function deleteCategory(stage, cat, refreshNav, refreshContent) {
            openConfirmModal('确认删除', '确定要删除大类「' + cat.categoryName + '」及其所有数据行吗？', function () {
                const catIdx = stage.categories.indexOf(cat);
                if (catIdx > -1) {
                    stage.categories.splice(catIdx, 1);
                    touchModel();
                    if (activeCatIdx >= stage.categories.length) activeCatIdx = -1;
                    refreshNav();
                    refreshContent();
                }
            });
        }

        function refreshNav() {
            navBody.innerHTML = '';
            if (!stages.length) {
                navBody.appendChild(el('div', { class: 'form-tip', style: 'text-align:center;padding:12px 0;' }, [readonly ? '暂无阶段数据' : '暂无阶段，点击下方按钮新增']));
                return;
            }
            stages.forEach((stage, sIdx) => {
                const stageDiv = el('div', { class: 'nav-tree-item' });

                // 一级：阶段名称
                const stageItem = el('div', {
                    class: 'stage-item' + (sIdx === activeStageIdx && activeCatIdx === -1 ? ' active' : ''),
                    'data-stage-idx': sIdx,
                    onclick: () => {
                        activeStageIdx = sIdx;
                        activeCatIdx = -1;
                        refreshNav();
                        refreshContent();
                    }
                }, [
                    el('span', { class: 'stage-name-text' }, [stage.stageName]),
                    buildNavActions(
                        () => startStageRename(stage, refreshNav, refreshContent),
                        () => deleteStage(stage, refreshNav, refreshContent)
                    )
                ]);
                stageDiv.appendChild(stageItem);

                // 二级：大类名称
                stage.categories.forEach((cat, cIdx) => {
                    const catItem = el('div', {
                        class: 'nav-tree-item-name' + (sIdx === activeStageIdx && cIdx === activeCatIdx ? ' active' : ''),
                        'data-cat-idx': cIdx,
                        onclick: () => {
                            activeStageIdx = sIdx;
                            activeCatIdx = cIdx;
                            refreshNav();
                            refreshContent();
                        }
                    }, [
                        el('span', { class: 'cat-name-text' }, ['└ ' + cat.categoryName]),
                        buildNavActions(
                            () => startCatRename(stage, cat, refreshNav, refreshContent),
                            () => deleteCategory(stage, cat, refreshNav, refreshContent)
                        )
                    ]);
                    stageDiv.appendChild(catItem);
                });

                navBody.appendChild(stageDiv);
            });
        }

        // 行编辑状态
        let editingCatRef = null;
        let editingRowIdx = -1;

        function buildCategoryTable(cat) {
            const block = el('div', { class: 'category-block' });
            block.appendChild(el('div', { class: 'category-header' }, [
                el('div', { class: 'category-title' }, ['大类：' + cat.categoryName]),
                readonly ? null : el('button', {
                    class: 'btn',
                    style: 'font-size:12px;padding:2px 10px;',
                    onclick: () => {
                        cat.rows.push({ rowId: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6), dataName: '', specModel: '', manufacturer: '', emissionCoefficient: '', functionalUnit: '', emissionFactor: '', factorSource: '', dataSource: '' });
                        touchModel();
                        editingCatRef = cat;
                        editingRowIdx = cat.rows.length - 1;
                        refreshContent();
                    }
                }, ['+ 新增数据行'])
            ]));
            const table = el('table', { class: 'data-table' });
            const thead = el('thead');
            const trh = el('tr');
            (readonly
                ? ['数据名称', '规格型号', '生产厂家', '碳足迹因子', '功能单位', '排放因子', '因子来源', '数据来源']
                : ['数据名称', '规格型号', '生产厂家', '碳足迹因子', '功能单位', '排放因子', '因子来源', '数据来源', '操作']
            ).forEach(t => trh.appendChild(el('th', {}, [t])));
            thead.appendChild(trh);
            table.appendChild(thead);

            const ROW_FIELDS = ['dataName', 'specModel', 'manufacturer', 'emissionCoefficient', 'functionalUnit', 'emissionFactor', 'factorSource', 'dataSource'];
            const tbody = el('tbody');
            cat.rows.forEach((r, rIdx) => {
                const tr = el('tr');
                if (readonly) {
                    // 只读模式：无操作列
                    tr.appendChild(el('td', {}, [r.dataName || '']));
                    tr.appendChild(el('td', {}, [r.specModel || '']));
                    tr.appendChild(el('td', {}, [r.manufacturer || '']));
                    tr.appendChild(el('td', {}, [r.emissionCoefficient || '']));
                    tr.appendChild(el('td', {}, [r.functionalUnit || '']));
                    tr.appendChild(el('td', {}, [r.emissionFactor || '']));
                    tr.appendChild(el('td', {}, [r.factorSource || '']));
                    tr.appendChild(el('td', {}, [r.dataSource || '']));
                } else if (cat === editingCatRef && rIdx === editingRowIdx) {
                    // 编辑模式
                    const inputs = {};
                    ROW_FIELDS.forEach(f => {
                        inputs[f] = el('input', {
                            type: 'text',
                            value: r[f] || '',
                            style: 'width:100%;min-width:70px;font-size:12px;padding:2px 4px;border:1px solid #0f766e;border-radius:3px;outline:none;box-sizing:border-box;'
                        });
                        tr.appendChild(el('td', {}, [inputs[f]]));
                    });
                    tr.appendChild(el('td', { style: 'white-space:nowrap;' }, [
                        el('span', { style: 'color:#047857;cursor:pointer;font-size:15px;', title: '保存', onclick: (e) => {
                            e.stopPropagation();
                            ROW_FIELDS.forEach(f => { r[f] = inputs[f].value.trim(); });
                            touchModel();
                            editingCatRef = null;
                            editingRowIdx = -1;
                            refreshContent();
                        } }, ['✓']),
                        el('span', { style: 'color:#dc2626;cursor:pointer;font-size:15px;margin-left:8px;', title: '取消', onclick: (e) => {
                            e.stopPropagation();
                            editingCatRef = null;
                            editingRowIdx = -1;
                            refreshContent();
                        } }, ['✕'])
                    ]));
                    setTimeout(() => inputs.dataName.focus(), 0);
                } else {
                    // 只读模式
                    tr.appendChild(el('td', {}, [r.dataName || '']));
                    tr.appendChild(el('td', {}, [r.specModel || '']));
                    tr.appendChild(el('td', {}, [r.manufacturer || '']));
                    tr.appendChild(el('td', {}, [r.emissionCoefficient || '']));
                    tr.appendChild(el('td', {}, [r.functionalUnit || '']));
                    tr.appendChild(el('td', {}, [r.emissionFactor || '']));
                    tr.appendChild(el('td', {}, [r.factorSource || '']));
                    tr.appendChild(el('td', {}, [r.dataSource || '']));
                    tr.appendChild(el('td', { style: 'white-space:nowrap;' }, [
                        el('span', { style: 'color:#9ca3af;cursor:pointer;font-size:13px;', title: '编辑', onclick: (e) => {
                            e.stopPropagation();
                            editingCatRef = cat;
                            editingRowIdx = rIdx;
                            refreshContent();
                        } }, ['✎']),
                        el('span', { style: 'color:#9ca3af;cursor:pointer;font-size:13px;margin-left:8px;', title: '删除', onclick: (e) => {
                            e.stopPropagation();
                            openConfirmModal('确认删除', '确定要删除数据行「' + (r.dataName || '未命名') + '」吗？', function () {
                                cat.rows.splice(rIdx, 1);
                                touchModel();
                                refreshContent();
                            });
                        } }, ['✕'])
                    ]));
                }
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            block.appendChild(table);
            return block;
        }

        function refreshContent() {
            stageData.innerHTML = '';
            const stage = stages[activeStageIdx];
            if (!stage) {
                stageData.appendChild(el('div', { class: 'placeholder-card' }, [readonly ? '暂无阶段数据' : '暂无数据，请先在左侧新增阶段']));
                return;
            }

            const card = el('div', { class: 'table-card' });
            card.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;' }, [
                el('span', {}, ['阶段：' + stage.stageName]),
                readonly ? null : el('button', {
                    class: 'btn',
                    style: 'font-size:12px;padding:2px 10px;',
                    onclick: () => {
                        stage.categories.push({ categoryName: '新大类', rows: [] });
                        activeCatIdx = stage.categories.length - 1;
                        touchModel();
                        refreshNav();
                        refreshContent();
                    }
                }, ['+ 新增大类'])
            ]));

            if (activeCatIdx >= 0 && stage.categories[activeCatIdx]) {
                // 只显示选中的大类
                card.appendChild(buildCategoryTable(stage.categories[activeCatIdx]));
            } else {
                // 显示所有大类
                if (!stage.categories.length) {
                    card.appendChild(el('div', { class: 'empty' }, [readonly ? '该阶段暂无大类数据' : '该阶段暂无大类数据，点击上方按钮新增']));
                } else {
                    stage.categories.forEach(cat => {
                        card.appendChild(buildCategoryTable(cat));
                    });
                }
            }

            stageData.appendChild(card);
        }

        refreshNav();
        refreshContent();
    }

    /* ============ 产品碳模型-实训 删除 ============ */
    function deleteTrainModel(model, onSaved) {
        openConfirmModal(
            '确认删除',
            '确定要删除模型「' + model.name + '」（编码：' + model.code + '）吗？此操作不可恢复。',
            function onConfirm() {
                const idx = trainModels.indexOf(model);
                if (idx > -1) {
                    trainModels.splice(idx, 1);
                    saveTrainModels();
                }
                if (typeof onSaved === 'function') onSaved();
            }
        );
    }

    /* ============ 产品碳模型-实训 新建模态框 ============ */
    function openTrainCreateModal(onCreated) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const form = {
            code: el('input', { class: 'form-control', placeholder: '如 PCM-2024-T02' }),
            name: el('input', { class: 'form-control', placeholder: '如 光伏发电系统' }),
            functionalUnit: el('input', { class: 'form-control', placeholder: '如 1 kW·h 上网电量' }),
            boundary: el('select', { class: 'form-control' },
                SYSTEM_BOUNDARIES.map(b => {
                    const opt = el('option', { value: b.value }, [b.label]);
                    if (b.value === SYSTEM_BOUNDARIES[0].value) opt.selected = true;
                    return opt;
                })
            ),
            referenceStandard: el('input', { class: 'form-control', placeholder: '如 GB/T 24067-2024, ISO 14067:2018' }),
            description: el('textarea', { class: 'form-control', rows: '3', placeholder: '模型的用途与说明' }),
            modelCreator: el('input', { class: 'form-control', placeholder: '如 张工程师' }),
            modelReviewer: el('input', { class: 'form-control', placeholder: '如 李总工' })
        };
        const diagramUpload = buildDiagramUpload('');

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

        const body = el('div', { class: 'modal-body' });
        [
            ['模型编码', form.code, '唯一标识，不可与已有编码重复'],
            ['模型名称', form.name, ''],
            ['功能单位', form.functionalUnit, '如 1 kW·h 上网电量'],
            ['系统边界', form.boundary, ''],
            ['系统边界示意图', diagramUpload.el, '支持上传 PNG/JPG 等图片，大小不超过 5MB'],
            ['引用标准', form.referenceStandard, '如 GB/T 24067-2024'],
            ['说明', form.description, ''],
            ['模型创建人', form.modelCreator, ''],
            ['模型审核确定人', form.modelReviewer, '']
        ].forEach(([label, ctrl, tip]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() { mask.remove(); }

        function save() {
            const code = form.code.value.trim();
            const name = form.name.value.trim();
            const functionalUnit = form.functionalUnit.value.trim();
            const boundary = form.boundary.value;
            const referenceStandard = form.referenceStandard.value.trim();
            const description = form.description.value.trim();
            const modelCreator = form.modelCreator.value.trim();
            const modelReviewer = form.modelReviewer.value.trim();
            const boundaryDiagram = diagramUpload.getValue();
            const errors = [];
            if (!code) errors.push('模型编码不能为空');
            if (!name) errors.push('模型名称不能为空');
            if (!functionalUnit) errors.push('功能单位不能为空');
            if (!boundary) errors.push('请选择系统边界');
            if (!referenceStandard) errors.push('引用标准不能为空');
            if (code && trainModels.some(x => x.code === code)) errors.push('模型编码已存在，请使用其他编码');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            trainModels.push({
                code: code,
                name: name,
                functionalUnit: functionalUnit,
                boundary: boundary,
                boundaryDiagram: boundaryDiagram,
                referenceStandard: referenceStandard,
                description: description,
                modelCreator: modelCreator,
                modelReviewer: modelReviewer,
                status: modelReviewer ? '已审核' : '待审核',
                stages: []
            });
            saveTrainModels();
            close();
            if (typeof onCreated === 'function') onCreated();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, ['新建模型']),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    /* ============ 产品碳模型-实训 编辑模态框 ============ */
    function openTrainEditModal(model, onSaved) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const form = {
            code: el('input', { class: 'form-control', value: model.code }),
            name: el('input', { class: 'form-control', value: model.name }),
            functionalUnit: el('input', { class: 'form-control', value: model.functionalUnit || '' }),
            boundary: el('select', { class: 'form-control' },
                SYSTEM_BOUNDARIES.map(b => {
                    const opt = el('option', { value: b.value }, [b.label]);
                    if (b.value === model.boundary) opt.selected = true;
                    return opt;
                })
            ),
            referenceStandard: el('input', { class: 'form-control', value: model.referenceStandard || '' }),
            description: el('textarea', { class: 'form-control', rows: '3' }, [model.description || '']),
            modelCreator: el('input', { class: 'form-control', value: model.modelCreator || '' }),
            modelReviewer: el('input', { class: 'form-control', value: model.modelReviewer || '' })
        };
        const diagramUpload = buildDiagramUpload(model.boundaryDiagram || '');

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

        const body = el('div', { class: 'modal-body' });
        [
            ['模型编码', form.code, '唯一标识，保存后不可重复'],
            ['模型名称', form.name, ''],
            ['功能单位', form.functionalUnit, '如 1 kW·h 上网电量'],
            ['系统边界', form.boundary, ''],
            ['系统边界示意图', diagramUpload.el, '支持上传 PNG/JPG 等图片，大小不超过 5MB'],
            ['引用标准', form.referenceStandard, '如 GB/T 24067-2024'],
            ['说明', form.description, ''],
            ['模型创建人', form.modelCreator, ''],
            ['模型审核确定人', form.modelReviewer, '']
        ].forEach(([label, ctrl, tip]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() { mask.remove(); }

        function save() {
            const code = form.code.value.trim();
            const name = form.name.value.trim();
            const functionalUnit = form.functionalUnit.value.trim();
            const boundary = form.boundary.value;
            const referenceStandard = form.referenceStandard.value.trim();
            const description = form.description.value.trim();
            const modelCreator = form.modelCreator.value.trim();
            const modelReviewer = form.modelReviewer.value.trim();
            const boundaryDiagram = diagramUpload.getValue();
            const errors = [];
            if (!code) errors.push('模型编码不能为空');
            if (!name) errors.push('模型名称不能为空');
            if (!functionalUnit) errors.push('功能单位不能为空');
            if (!boundary) errors.push('请选择系统边界');
            if (!referenceStandard) errors.push('引用标准不能为空');
            if (code && trainModels.some(x => x !== model && x.code === code)) errors.push('模型编码已存在，请使用其他编码');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            model.code = code;
            model.name = name;
            model.functionalUnit = functionalUnit;
            model.boundary = boundary;
            model.boundaryDiagram = boundaryDiagram;
            model.referenceStandard = referenceStandard;
            model.description = description;
            model.modelCreator = modelCreator;
            model.modelReviewer = modelReviewer;
            // 编辑前若已审核，修改后需二次审核 → 回退为待审核；否则按审核人判断
            const wasReviewed = model.status === '已审核' || (model.modelReviewer && !model.status);
            if (wasReviewed) {
                model.status = '待审核';
            } else {
                model.status = modelReviewer ? '已审核' : '待审核';
            }
            saveTrainModels();
            close();
            if (typeof onSaved === 'function') onSaved();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, ['编辑模型']),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    /* ============ 新建模型模态框 ============ */
    function openCreateModal(onCreated) {
        // 移除已有模态框
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const currentYear = new Date().getFullYear();

        const form = {
            code: el('input', { class: 'form-control', placeholder: '如 PCM-2024-006' }),
            name: el('input', { class: 'form-control', placeholder: '如 光伏发电' }),
            quantificationPurpose: el('textarea', { class: 'form-control', rows: '3', placeholder: '请描述本次产品碳足迹量化的目的' }),
            functionalUnit: el('input', { class: 'form-control', placeholder: '如 1 kW·h 上网电量' }),
            boundary: el('select', { class: 'form-control' },
                SYSTEM_BOUNDARIES.map(b => {
                    const opt = el('option', { value: b.value }, [b.label]);
                    if (b.value === SYSTEM_BOUNDARIES[0].value) opt.selected = true;
                    return opt;
                })
            ),
            baseYear: el('input', { class: 'form-control', type: 'number', min: '1900', max: currentYear + 1, value: String(currentYear) }),
            scope: el('textarea', { class: 'form-control', placeholder: '覆盖的实景过程阶段' }),
            referenceStandard: el('input', { class: 'form-control', placeholder: '如 GB/T 24067-2024, ISO 14067:2018' })
        };
        const diagramUpload = buildDiagramUpload('');

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

        const body = el('div', { class: 'modal-body' });
        [
            ['模型编码', form.code, '唯一标识，不可与已有编码重复'],
            ['模型名称', form.name, ''],
            ['量化目的', form.quantificationPurpose, '手动编写本次量化的目的与用途'],
            ['功能单位', form.functionalUnit, '如 1 kW·h 上网电量'],
            ['系统边界', form.boundary, ''],
            ['系统边界示意图', diagramUpload.el, '支持上传 PNG/JPG 等图片，大小不超过 5MB'],
            ['基准年', form.baseYear, '年份如 ' + currentYear],
            ['实景过程范围', form.scope, '覆盖的实景过程阶段'],
            ['引用标准', form.referenceStandard, '如 GB/T 24067-2024']
        ].forEach(([label, ctrl, tip]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() { mask.remove(); }

        function save() {
            const code = form.code.value.trim();
            const name = form.name.value.trim();
            const quantificationPurpose = form.quantificationPurpose.value.trim();
            const functionalUnit = form.functionalUnit.value.trim();
            const boundary = form.boundary.value;
            const baseYear = parseInt(form.baseYear.value, 10);
            const scope = form.scope.value.trim();
            const referenceStandard = form.referenceStandard.value.trim();
            const boundaryDiagram = diagramUpload.getValue();
            const errors = [];
            if (!code) errors.push('模型编码不能为空');
            if (!name) errors.push('模型名称不能为空');
            if (!functionalUnit) errors.push('功能单位不能为空');
            if (!boundary) errors.push('请选择系统边界');
            if (!baseYear || isNaN(baseYear) || baseYear < 1900 || baseYear > currentYear + 1) errors.push('基准年无效');
            if (!scope) errors.push('实景过程范围不能为空');
            if (!referenceStandard) errors.push('引用标准不能为空');
            // 编码唯一性校验
            if (code && models.some(x => x.code === code)) errors.push('模型编码已存在，请使用其他编码');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            models.push(normalizeModel({
                code: code,
                name: name,
                boundary: boundary,
                baseYear: baseYear,
                scope: scope,
                referenceStandard: referenceStandard,
                quantificationPurpose: quantificationPurpose,
                functionalUnit: functionalUnit,
                boundaryDiagram: boundaryDiagram
            }));
            saveModels();
            close();
            if (typeof onCreated === 'function') onCreated();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, ['新建模型']),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    /* ============ 编辑模型模态框 ============ */
    function openEditModal(model, onSaved) {
        // 移除已有模态框
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const currentYear = new Date().getFullYear();

        const form = {
            code: el('input', { class: 'form-control', value: model.code }),
            name: el('input', { class: 'form-control', value: model.name }),
            quantificationPurpose: el('textarea', { class: 'form-control', rows: '3' }, [model.quantificationPurpose || '']),
            functionalUnit: el('input', { class: 'form-control', value: model.functionalUnit || '' }),
            boundary: el('select', { class: 'form-control' },
                SYSTEM_BOUNDARIES.map(b => {
                    const opt = el('option', { value: b.value }, [b.label]);
                    if (b.value === model.boundary) opt.selected = true;
                    return opt;
                })
            ),
            baseYear: el('input', { class: 'form-control', type: 'number', min: '1900', max: currentYear + 1, value: String(model.baseYear) }),
            scope: el('textarea', { class: 'form-control' }, [model.scope]),
            referenceStandard: el('input', { class: 'form-control', value: model.referenceStandard || '' })
        };
        const diagramUpload = buildDiagramUpload(model.boundaryDiagram || '');

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

        const body = el('div', { class: 'modal-body' });
        [
            ['模型编码', form.code, '唯一标识，保存后不可重复'],
            ['模型名称', form.name, ''],
            ['量化目的', form.quantificationPurpose, '手动编写本次量化的目的与用途'],
            ['功能单位', form.functionalUnit, '如 1 kW·h 上网电量'],
            ['系统边界', form.boundary, ''],
            ['系统边界示意图', diagramUpload.el, '支持上传 PNG/JPG 等图片，大小不超过 5MB'],
            ['基准年', form.baseYear, '年份如 2024'],
            ['实景过程范围', form.scope, '覆盖的实景过程阶段'],
            ['引用标准', form.referenceStandard, '如 GB/T 24067-2024']
        ].forEach(([label, ctrl, tip]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() { mask.remove(); }

        function save() {
            const code = form.code.value.trim();
            const name = form.name.value.trim();
            const quantificationPurpose = form.quantificationPurpose.value.trim();
            const functionalUnit = form.functionalUnit.value.trim();
            const boundary = form.boundary.value;
            const baseYear = parseInt(form.baseYear.value, 10);
            const scope = form.scope.value.trim();
            const referenceStandard = form.referenceStandard.value.trim();
            const boundaryDiagram = diagramUpload.getValue();
            const errors = [];
            if (!code) errors.push('模型编码不能为空');
            if (!name) errors.push('模型名称不能为空');
            if (!functionalUnit) errors.push('功能单位不能为空');
            if (!boundary) errors.push('请选择系统边界');
            if (!baseYear || isNaN(baseYear) || baseYear < 1900 || baseYear > currentYear + 1) errors.push('基准年无效');
            if (!scope) errors.push('实景过程范围不能为空');
            if (!referenceStandard) errors.push('引用标准不能为空');
            // 编码唯一性校验（排除自身）
            if (code && models.some(x => x !== model && x.code === code)) errors.push('模型编码已存在，请使用其他编码');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            model.code = code;
            model.name = name;
            model.quantificationPurpose = quantificationPurpose;
            model.functionalUnit = functionalUnit;
            model.boundary = boundary;
            model.baseYear = baseYear;
            model.scope = scope;
            model.referenceStandard = referenceStandard;
            model.boundaryDiagram = boundaryDiagram;
            saveModels();
            close();
            if (typeof onSaved === 'function') onSaved();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, ['编辑模型 - ' + (model.name || '')]),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        // 点击遮罩关闭
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    function onBoundaryChange(model, newBoundary) {
        model.boundary = newBoundary;
        saveModels();
        // 这里仅更新内存数据并持久化，真实场景会调用后端接口
    }

    /* ============ 模型定义详情页 ============ */
    function renderModelDefinition(container, code) {
        const key = code ? decodeURIComponent(code) : '';
        const m = models.find(x => x.code === key);
        if (!m) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应模型']));
            return;
        }

        const header = el('div', { class: 'page-header' }, [
            el('div', { class: 'model-def-header' }, [
                el('span', { class: 'back', onclick: () => navigate('#/product-carbon-model') }, ['← 返回列表']),
                el('span', { class: 'model-def-title' }, ['模型定义 - ' + m.name])
            ])
        ]);

        const meta = el('div', { class: 'model-def-meta' });
        [
            ['模型编码', m.code],
            ['模型名称', m.name],
            ['量化目的', m.quantificationPurpose],
            ['功能单位', m.functionalUnit],
            ['系统边界', boundaryLabel(m.boundary)],
            ['基准年', String(m.baseYear)],
            ['实景过程范围', m.scope]
        ].forEach(([label, value]) => {
            meta.appendChild(el('div', { class: 'meta-item' }, [
                el('div', { class: 'label' }, [label]),
                el('div', { class: 'value' }, [value || ''])
            ]));
        });

        // 系统边界示意图（在 meta 之后展示）
        let diagramCard = null;
        if (m.boundaryDiagram) {
            diagramCard = el('div', { class: 'table-card' });
            diagramCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:10px;' }, ['系统边界示意图']));
            diagramCard.appendChild(el('img', {
                src: m.boundaryDiagram,
                style: 'max-width:100%;max-height:360px;border:1px solid #e5e7eb;border-radius:6px;display:block;'
            }));
        }

        // 引用标准 - 可行内编辑，保存后同步到列表页等其他页面
        const refItem = el('div', { class: 'meta-item' });
        meta.appendChild(refItem);
        renderRefItem();

        function renderRefItem() {
            refItem.innerHTML = '';
            refItem.appendChild(el('div', { class: 'label' }, ['引用标准']));
            const valueRow = el('div', { class: 'value', style: 'display:flex;align-items:center;gap:8px;' });
            valueRow.appendChild(el('span', { style: 'flex:1;word-break:break-all;' }, [m.referenceStandard || '（未设置）']));
            const editBtn = el('span', { class: 'stage-edit', title: '编辑引用标准' }, ['✎']);
            editBtn.addEventListener('click', () => renderRefItemEdit());
            valueRow.appendChild(editBtn);
            refItem.appendChild(valueRow);
        }

        function renderRefItemEdit() {
            refItem.innerHTML = '';
            refItem.appendChild(el('div', { class: 'label' }, ['引用标准']));
            const row = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
            const input = el('input', { class: 'stage-rename-input', value: m.referenceStandard || '', style: 'flex:1;', placeholder: '如 GB/T 24067-2024' });
            row.appendChild(input);
            const ok = el('span', { class: 'stage-edit stage-edit-ok', title: '确认' }, ['✓']);
            ok.addEventListener('click', () => saveRef(input.value));
            const cancel = el('span', { class: 'stage-edit stage-edit-cancel', title: '取消' }, ['✗']);
            cancel.addEventListener('click', () => renderRefItem());
            row.appendChild(ok);
            row.appendChild(cancel);
            refItem.appendChild(row);
            input.focus();
            input.select();
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveRef(input.value); }
                else if (e.key === 'Escape') { renderRefItem(); }
            });
        }

        function saveRef(newVal) {
            const v = (newVal || '').trim();
            if (v !== (m.referenceStandard || '')) {
                m.referenceStandard = v;
                saveModels();
            }
            renderRefItem();
        }

        // 两栏布局：左阶段列表 + 右数据表格
        let currentStageId = STAGE_DEFINITIONS[0].id;
        ensureModelStages(m);
        saveModels();

        const layout = el('div', { class: 'model-def-layout' });

        // 左侧阶段列表
        const stageList = el('div', { class: 'stage-list' });

        // 右侧数据区
        const stageData = el('div', { class: 'stage-data' });

        layout.appendChild(stageList);
        layout.appendChild(stageData);

        container.appendChild(header);
        container.appendChild(meta);
        if (diagramCard) container.appendChild(diagramCard);
        container.appendChild(layout);

        renderStageList();
        renderStagePanel();

        function renderStageList() {
            stageList.innerHTML = '';
            stageList.appendChild(el('div', { class: 'stage-list-header' }, ['过程阶段']));
            STAGE_DEFINITIONS.forEach(stage => {
                stageList.appendChild(buildStageItem(stage));
            });
        }

        function buildStageItem(stage) {
            const isActive = stage.id === currentStageId;
            const item = el('div', { class: 'stage-item' + (isActive ? ' active' : '') });
            item.addEventListener('click', () => selectStage(stage.id));
            renderStageItemView(item, stage);
            return item;
        }

        function renderStageItemView(item, stage) {
            item.innerHTML = '';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.appendChild(el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, [getStageName(m, stage.id)]));
            const editBtn = el('span', { class: 'stage-edit', title: '重命名' }, ['✎']);
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); renderStageItemEdit(item, stage); });
            item.appendChild(editBtn);
        }

        function renderStageItemEdit(item, stage) {
            item.innerHTML = '';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            const input = el('input', { class: 'stage-rename-input', value: getStageName(m, stage.id) });
            item.appendChild(input);
            const ok = el('span', { class: 'stage-edit stage-edit-ok', title: '确认' }, ['✓']);
            ok.addEventListener('click', (e) => { e.stopPropagation(); confirmRename(input.value, stage); });
            const cancel = el('span', { class: 'stage-edit stage-edit-cancel', title: '取消' }, ['✗']);
            cancel.addEventListener('click', (e) => { e.stopPropagation(); renderStageItemView(item, stage); });
            item.appendChild(ok);
            item.appendChild(cancel);
            input.focus();
            input.select();
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmRename(input.value, stage); }
                else if (e.key === 'Escape') { renderStageItemView(item, stage); }
            });
        }

        function confirmRename(newName, stage) {
            const n = (newName || '').trim();
            if (n && n !== getStageName(m, stage.id)) {
                if (!m.stageNames) m.stageNames = {};
                m.stageNames[stage.id] = n;
                saveModels();
            }
            renderStageList();
            renderStagePanel();
        }

        function selectStage(stageId) {
            currentStageId = stageId;
            stageList.querySelectorAll('.stage-item').forEach((it, i) => {
                it.classList.toggle('active', STAGE_DEFINITIONS[i].id === stageId);
            });
            renderStagePanel();
        }

        function renderStagePanel() {
            stageData.innerHTML = '';
            const stage = STAGE_DEFINITIONS.find(s => s.id === currentStageId) || STAGE_DEFINITIONS[0];
            const categories = getModelStageCategories(m, stage.id);

            const toolbar = el('div', { class: 'toolbar' }, [
                el('div', { class: 'toolbar-left' }, [
                    el('span', { style: 'font-weight:600;color:#111827;' }, [getStageName(m, stage.id)]),
                    el('span', { style: 'margin-left:8px;color:#9ca3af;font-size:12px;font-weight:400;' }, ['共 ' + categories.length + ' 个大类'])
                ]),
                el('div', {}, [
                    el('button', { class: 'btn btn-primary', onclick: () => openCategoryModal(m, stage.id, renderStagePanel) }, ['+ 新增大类'])
                ])
            ]);
            stageData.appendChild(toolbar);

            if (!categories.length) {
                stageData.appendChild(el('div', { class: 'placeholder-card' }, ['该阶段暂无大类，点击「+ 新增大类」添加']));
                return;
            }

            categories.forEach(cat => {
                stageData.appendChild(buildCategoryBlock(m, stage.id, cat, renderStagePanel));
            });
        }
    }

    /* ============ 大类分块 ============ */
    function buildCategoryBlock(model, stageId, cat, onSaved) {
        const block = el('div', { class: 'category-block' });

        // 大类标题：名称（可编辑）+ 删除
        const header = el('div', { class: 'category-header' });
        const titleWrap = el('div', { class: 'category-title' });
        header.appendChild(titleWrap);
        const delBtn = el('button', { class: 'btn-link btn-danger', style: 'font-size:12px;', onclick: () => deleteCategory(model, stageId, cat, onSaved) }, ['删除大类']);
        header.appendChild(delBtn);
        block.appendChild(header);

        // 大类工具条 + 数据表格
        const body = el('div', { class: 'category-body' });
        const catToolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left' }, []),
            el('div', {}, [
                el('button', { class: 'btn btn-primary', onclick: () => openStageRowModal(model, stageId, cat, null, onSaved) }, ['+ 新增数据'])
            ])
        ]);
        body.appendChild(catToolbar);

        const tableCard = el('div', { class: 'table-card' });
        tableCard.appendChild(buildCategoryTable(model, stageId, cat, onSaved));
        body.appendChild(tableCard);
        block.appendChild(body);

        renderCategoryNameView(titleWrap, model, stageId, cat, onSaved);
        return block;
    }

    function renderCategoryNameView(titleWrap, model, stageId, cat, onSaved) {
        titleWrap.innerHTML = '';
        titleWrap.appendChild(el('span', { style: 'font-weight:600;' }, [cat.name || '（未命名）']));
        const editBtn = el('span', { class: 'stage-edit', title: '重命名大类' }, ['✎']);
        editBtn.addEventListener('click', () => renderCategoryNameEdit(titleWrap, model, stageId, cat, onSaved));
        titleWrap.appendChild(editBtn);
    }

    function renderCategoryNameEdit(titleWrap, model, stageId, cat, onSaved) {
        titleWrap.innerHTML = '';
        const input = el('input', { class: 'stage-rename-input', value: cat.name || '', style: 'width:200px;' });
        titleWrap.appendChild(input);
        const ok = el('span', { class: 'stage-edit stage-edit-ok', title: '确认' }, ['✓']);
        ok.addEventListener('click', () => confirmCategoryRename(input.value, cat, titleWrap, model, stageId, onSaved));
        const cancel = el('span', { class: 'stage-edit stage-edit-cancel', title: '取消' }, ['✗']);
        cancel.addEventListener('click', () => renderCategoryNameView(titleWrap, model, stageId, cat, onSaved));
        titleWrap.appendChild(ok);
        titleWrap.appendChild(cancel);
        input.focus();
        input.select();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirmCategoryRename(input.value, cat, titleWrap, model, stageId, onSaved); }
            else if (e.key === 'Escape') { renderCategoryNameView(titleWrap, model, stageId, cat, onSaved); }
        });
    }

    function confirmCategoryRename(newName, cat, titleWrap, model, stageId, onSaved) {
        const n = (newName || '').trim();
        if (n && n !== (cat.name || '')) {
            cat.name = n;
            saveModels();
        }
        renderCategoryNameView(titleWrap, model, stageId, cat, onSaved);
        if (typeof onSaved === 'function') onSaved();
    }

    /* ============ 大类 新增 / 删除 ============ */
    function openCategoryModal(model, stageId, onSaved) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const input = el('input', { class: 'form-control', placeholder: '请输入大类名称' });
        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });
        const body = el('div', { class: 'modal-body' }, [
            el('div', { class: 'form-group' }, [
                el('label', {}, ['大类名称']),
                input,
                errBox
            ])
        ]);

        function close() { mask.remove(); }

        function save() {
            const name = input.value.trim();
            if (!name) {
                errBox.textContent = '大类名称不能为空';
                errBox.style.display = 'block';
                return;
            }
            if (!model.stages) model.stages = {};
            if (!model.stages[stageId]) model.stages[stageId] = [];
            model.stages[stageId].push({ id: newCatId(), name: name, rows: [] });
            saveModels();
            close();
            if (typeof onSaved === 'function') onSaved();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, ['新增大类']),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);
        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
        input.focus();
    }

    function deleteCategory(model, stageId, cat, onSaved) {
        openConfirmModal(
            '确认删除大类',
            '确定要删除大类「' + (cat.name || '') + '」及其下所有数据吗？',
            function onConfirm() {
                const cats = (model.stages && model.stages[stageId]) || [];
                const idx = cats.indexOf(cat);
                if (idx > -1) cats.splice(idx, 1);
                saveModels();
                if (typeof onSaved === 'function') onSaved();
            }
        );
    }

    /* ============ 大类数据表格 ============ */
    function buildCategoryTable(model, stageId, cat, onSaved) {
        const rows = (cat && cat.rows) || [];
        if (!rows.length) {
            return el('div', { class: 'empty' }, ['该大类暂无数据，点击「+ 新增数据」添加']);
        }
        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['数据名称', '碳排系数(kgCO₂e)', '功能单位', '排放因子', '因子来源', '数据来源', '操作'].forEach(t => {
            trh.appendChild(el('th', {}, [t]));
        });
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        rows.forEach(r => {
            const tr = el('tr');
            tr.appendChild(el('td', {}, [r.dataName || '']));
            tr.appendChild(el('td', {}, [r.emissionCoefficient || '']));
            tr.appendChild(el('td', {}, [r.functionalUnit || '']));
            tr.appendChild(el('td', {}, [r.emissionFactor || '']));
            tr.appendChild(el('td', {}, [r.factorSource || '']));
            tr.appendChild(el('td', {}, [r.dataSource || '']));

            const editBtn = el('button', { class: 'btn-link', onclick: () => openStageRowModal(model, stageId, cat, r, onSaved) }, ['编辑']);
            const sep = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const delBtn = el('button', { class: 'btn-link btn-danger', onclick: () => deleteStageRow(model, stageId, cat, r, onSaved) }, ['删除']);
            tr.appendChild(el('td', {}, [editBtn, sep, delBtn]));

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    function deleteStageRow(model, stageId, cat, row, onSaved) {
        openConfirmModal(
            '确认删除',
            '确定要删除数据「' + (row.dataName || '') + '」吗？',
            function onConfirm() {
                const rows = (cat && cat.rows) || [];
                const idx = rows.indexOf(row);
                if (idx > -1) rows.splice(idx, 1);
                saveModels();
                if (typeof onSaved === 'function') onSaved();
            }
        );
    }

    /* ============ 大类数据 新增/编辑 弹窗 ============ */
    function openStageRowModal(model, stageId, cat, row, onSaved) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const isCreate = !row;
        const form = {
            dataName: el('input', { class: 'form-control', value: isCreate ? '' : (row.dataName || '') }),
            emissionCoefficient: el('input', { class: 'form-control', value: isCreate ? '' : (row.emissionCoefficient || '') }),
            functionalUnit: el('input', { class: 'form-control', value: isCreate ? '' : (row.functionalUnit || ''), placeholder: '如 kg / kWh / t·km' }),
            emissionFactor: el('input', { class: 'form-control', value: isCreate ? '' : (row.emissionFactor || ''), placeholder: '如 2.1 kgCO2e/kg' }),
            factorSource: el('input', { class: 'form-control', value: isCreate ? '' : (row.factorSource || ''), placeholder: '如 CLCD-China / IPCC' }),
            dataSource: el('input', { class: 'form-control', value: isCreate ? '' : (row.dataSource || ''), placeholder: '如 行业文献 / 企业报告' })
        };

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });
        const body = el('div', { class: 'modal-body' });
        [
            ['数据名称', form.dataName, ''],
            ['碳排系数', form.emissionCoefficient, '数值，单位 kgCO₂e，如 2.1'],
            ['功能单位', form.functionalUnit, ''],
            ['排放因子', form.emissionFactor, ''],
            ['因子来源', form.factorSource, ''],
            ['数据来源', form.dataSource, '']
        ].forEach(([label, ctrl, tip]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() { mask.remove(); }

        function save() {
            const values = {
                dataName: form.dataName.value.trim(),
                emissionCoefficient: form.emissionCoefficient.value.trim(),
                functionalUnit: form.functionalUnit.value.trim(),
                emissionFactor: form.emissionFactor.value.trim(),
                factorSource: form.factorSource.value.trim(),
                dataSource: form.dataSource.value.trim()
            };
            const errors = [];
            if (!values.dataName) errors.push('数据名称不能为空');
            if (!values.emissionCoefficient) errors.push('碳排系数不能为空');
            if (!values.functionalUnit) errors.push('功能单位不能为空');
            if (!values.emissionFactor) errors.push('排放因子不能为空');
            if (!values.factorSource) errors.push('因子来源不能为空');
            if (!values.dataSource) errors.push('数据来源不能为空');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            if (!cat.rows) cat.rows = [];
            if (isCreate) {
                cat.rows.push(Object.assign({ id: newRowId() }, values));
            } else {
                Object.assign(row, values);
            }
            saveModels();
            close();
            if (typeof onSaved === 'function') onSaved();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, [isCreate ? '新增数据 · ' + (cat.name || '') : '编辑数据 · ' + (cat.name || '')]),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    /* ============ 产品碳排放核算 列表页 ============ */
    function renderProductCarbonAccounting(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    '产品碳排放'
                ]),
                el('div', { class: 'page-title' }, ['产品碳排放'])
            ]),
            el('div', { class: 'toolbar-left' }, [
                el('button', { class: 'btn btn-primary', onclick: () => openAccountingEditModal(null, rebuildTable) }, ['+ 新建产品'])
            ])
        ]);

        const toolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left' }, [
                el('input', {
                    type: 'text',
                    placeholder: '搜索产品名称 / 企业名称',
                    oninput: (e) => onSearch(e.target.value)
                })
            ]),
            el('div', {}, [
                el('span', { class: 'form-tip', style: 'color:#6b7280;', id: 'accounting-count' }, ['共 ' + accountingRecords.length + ' 条记录'])
            ])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        let currentKeyword = '';

        function onSearch(kw) {
            currentKeyword = (kw || '').trim().toLowerCase();
            rebuildTable();
        }

        function getFiltered() {
            if (!currentKeyword) return accountingRecords;
            return accountingRecords.filter(r =>
                (r.productName || '').toLowerCase().indexOf(currentKeyword) > -1 ||
                (r.enterprise || '').toLowerCase().indexOf(currentKeyword) > -1);
        }

        function rebuildTable() {
            tableCard.innerHTML = '';
            const filtered = getFiltered();
            const countEl = $('#accounting-count');
            if (countEl) countEl.textContent = '共 ' + filtered.length + ' 条记录';
            tableCard.appendChild(buildAccountingTable(filtered, rebuildTable));
        }

        container.appendChild(header);
        container.appendChild(toolbar);
        container.appendChild(tableCard);
        rebuildTable();
    }

    function buildAccountingTable(rows, onChanged) {
        if (!rows.length) {
            return el('div', { class: 'empty' }, ['暂无核算记录']);
        }
        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['产品名称', '规格型号', '装机容量', '企业名称', '核算模型', '数据统计时间段', '创建时间', '操作'].forEach(t => {
            trh.appendChild(el('th', {}, [t]));
        });
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        rows.forEach(r => {
            const tr = el('tr');
            tr.appendChild(el('td', {}, [r.productName || '']));
            tr.appendChild(el('td', {}, [r.specModel || '']));
            tr.appendChild(el('td', { style: 'text-align:right;' }, [r.capacity ? (r.capacity + ' kW') : '']));
            tr.appendChild(el('td', {}, [r.enterprise || '']));
            tr.appendChild(el('td', {}, [r.model || '']));
            tr.appendChild(el('td', {}, [r.period || '']));
            tr.appendChild(el('td', {}, [r.createdAt || '']));

            const calcBtn = el('button', {
                class: 'btn-link',
                onclick: () => navigate('#/carbon-accounting/' + encodeURIComponent(r.id))
            }, ['碳排放核算']);
            const sep1 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const editBtn = el('button', {
                class: 'btn-link',
                onclick: () => openAccountingEditModal(r, onChanged)
            }, ['编辑']);
            const sep2 = el('span', { style: 'color:#d1d5db;margin:0 6px;' }, ['|']);
            const delBtn = el('button', {
                class: 'btn-link btn-danger',
                onclick: () => deleteAccounting(r, onChanged)
            }, ['删除']);
            tr.appendChild(el('td', {}, [calcBtn, sep1, editBtn, sep2, delBtn]));

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    /* ============ 核算记录 新建/编辑 弹窗 ============ */
    function openAccountingEditModal(record, onSaved) {
        const existed = $('.modal-mask');
        if (existed) existed.remove();

        const isCreate = !record;
        const periodParts = isCreate || !(record.period || '') ? ['', ''] : String(record.period).split('~').map(s => s.trim());

        const productName = el('input', {
            class: 'form-control',
            value: isCreate ? '' : (record.productName || ''),
            placeholder: '如 光伏发电系统'
        });
        // 规格型号：input + datalist，根据核算模型动态切换建议选项
        const specListId = 'spec-list-' + Date.now();
        const specModel = el('input', {
            class: 'form-control',
            value: isCreate ? '' : (record.specModel || ''),
            placeholder: '请选择或输入规格型号',
            list: specListId,
            autocomplete: 'off'
        });
        const specList = el('datalist', { id: specListId });
        specModel.parentElement && specModel.parentElement.appendChild(specList);
        // datalist 必须挂到 document 上才能生效
        document.body.appendChild(specList);
        function refreshSpecOptions() {
            specList.innerHTML = '';
            const opts = SPEC_OPTIONS[form.model.value] || [];
            opts.forEach(o => specList.appendChild(el('option', { value: o })));
        }

        const capacity = el('input', {
            class: 'form-control',
            type: 'number',
            min: '0',
            step: '0.01',
            value: isCreate ? '' : (record.capacity || ''),
            placeholder: '请输入装机容量'
        });
        const enterprise = el('input', {
            class: 'form-control',
            value: isCreate ? '' : (record.enterprise || ''),
            placeholder: '请输入企业名称'
        });
        const modelSel = el('select', { class: 'form-control' });
        models.forEach(md => {
            modelSel.appendChild(el('option', { value: md.name }, [md.name]));
        });
        if (!models.length) modelSel.appendChild(el('option', { value: '' }, ['（请先在碳模型中创建）']));
        const dateStart = el('input', {
            class: 'form-control',
            type: 'date',
            value: periodParts[0] || ''
        });
        const dateEnd = el('input', {
            class: 'form-control',
            type: 'date',
            value: periodParts[1] || ''
        });

        const form = { productName, specModel, capacity, enterprise, model: modelSel, dateStart, dateEnd };
        if (isCreate) {
            if (models.length) modelSel.value = models[0].name;
        } else {
            modelSel.value = record.model || (models[0] && models[0].name) || '';
        }
        modelSel.addEventListener('change', refreshSpecOptions);
        refreshSpecOptions();

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });
        const body = el('div', { class: 'modal-body' });
        [
            ['产品名称', productName],
            ['规格型号', specModel],
            ['装机容量（kW）', capacity],
            ['企业名称', enterprise],
            ['核算模型', modelSel],
            ['数据统计开始日期', dateStart],
            ['数据统计结束日期', dateEnd]
        ].forEach(([label, ctrl]) => {
            const group = el('div', { class: 'form-group' });
            group.appendChild(el('label', {}, [label]));
            group.appendChild(ctrl);
            body.appendChild(group);
        });
        body.appendChild(errBox);

        function close() {
            mask.remove();
            // 清理临时 datalist
            if (specList.parentNode) specList.parentNode.removeChild(specList);
        }

        function save() {
            const values = {
                productName: productName.value.trim(),
                specModel: specModel.value.trim(),
                capacity: capacity.value.trim(),
                enterprise: enterprise.value.trim(),
                model: modelSel.value.trim(),
                dateStart: dateStart.value,
                dateEnd: dateEnd.value
            };
            const errors = [];
            if (!values.productName) errors.push('产品名称不能为空');
            if (!values.specModel) errors.push('规格型号不能为空');
            if (values.capacity === '') errors.push('装机容量不能为空');
            else if (isNaN(parseFloat(values.capacity)) || parseFloat(values.capacity) < 0) errors.push('装机容量需为非负数值');
            if (!values.enterprise) errors.push('企业名称不能为空');
            if (!values.model) errors.push('请选择核算模型');
            if (!values.dateStart || !values.dateEnd) errors.push('请选择完整的数据统计起止日期');
            else if (values.dateStart > values.dateEnd) errors.push('开始日期不能晚于结束日期');

            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }

            const period = values.dateStart + ' ~ ' + values.dateEnd;
            if (isCreate) {
                accountingRecords.unshift({
                    id: 'acc-' + Date.now(),
                    productName: values.productName,
                    specModel: values.specModel,
                    capacity: values.capacity,
                    enterprise: values.enterprise,
                    model: values.model,
                    period: period,
                    createdAt: nowText(),
                    stageEmissions: {},
                    status: '未核算',
                    result: null,
                    accountedAt: ''
                });
            } else {
                // 仅更新基础信息，保留已核算的阶段排放量数据
                record.productName = values.productName;
                record.specModel = values.specModel;
                record.capacity = values.capacity;
                record.enterprise = values.enterprise;
                record.model = values.model;
                record.period = period;
            }
            saveAccounting();
            close();
            if (typeof onSaved === 'function') onSaved();
        }

        const mask = el('div', { class: 'modal-mask' }, [
            el('div', { class: 'modal' }, [
                el('div', { class: 'modal-header' }, [
                    el('span', {}, [isCreate ? '新建产品' : '编辑产品']),
                    el('span', { class: 'modal-close', onclick: close }, ['×'])
                ]),
                body,
                el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: close }, ['取消']),
                    el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                ])
            ])
        ]);

        document.body.appendChild(mask);
        mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    }

    function deleteAccounting(record, onChanged) {
        openConfirmModal(
            '确认删除',
            '确定要删除产品「' + (record.productName || '') + '」的核算记录吗？',
            function onConfirm() {
                const idx = accountingRecords.indexOf(record);
                if (idx > -1) accountingRecords.splice(idx, 1);
                saveAccounting();
                if (typeof onChanged === 'function') onChanged();
            }
        );
    }

    /* ============ 碳排放核算 详情页 ============ */
    function renderCarbonAccounting(container, param) {
        const id = param ? decodeURIComponent(param) : '';
        const rec = accountingRecords.find(r => r.id === id);

        if (!rec) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应核算记录']));
            return;
        }

        const header = el('div', { class: 'page-header' }, [
            el('div', { class: 'model-def-header' }, [
                el('span', { class: 'back', onclick: () => navigate('#/product-carbon-accounting') }, ['← 返回列表']),
                el('span', { class: 'model-def-title' }, ['碳排放核算 - ' + rec.productName])
            ])
        ]);

        const meta = el('div', { class: 'model-def-meta' });
        [
            ['产品名称', rec.productName],
            ['规格型号', rec.specModel],
            ['装机容量', rec.capacity ? (rec.capacity + ' kW') : ''],
            ['企业名称', rec.enterprise],
            ['核算模型', rec.model],
            ['数据统计时间段', rec.period],
            ['创建时间', rec.createdAt],
            ['核算状态', rec.status || '未核算']
        ].forEach(([label, value]) => {
            meta.appendChild(el('div', { class: 'meta-item' }, [
                el('div', { class: 'label' }, [label]),
                el('div', { class: 'value' }, [value || ''])
            ]));
        });

        // ============ 核算参数（按阶段排放量录入） ============
        // 核算方法另行说明，本页仅做参数录入与持久化，暂不计算碳足迹
        const STAGE_INPUTS = [
            { key: 'rawMaterial',        label: '原材料及生产设备获取阶段温室气体排放量', unit: 'tCO₂e', hasCalc: true },
            { key: 'transport',          label: '运输阶段温室气体排放量',             unit: 'tCO₂e', hasCalc: true },
            { key: 'facilityConstruction',label: '设施建设阶段温室气体排放量',         unit: 'tCO₂e', hasCalc: true },
            { key: 'productionRetirement',label: '生产及退役阶段温室气体排放量',       unit: 'tCO₂e', hasCalc: true },
            { key: 'powerTransmission',  label: '输配电阶段温室气体排放量',           unit: 'tCO₂e', hasCalc: true },
            { key: 'totalGridSupply',    label: '光伏发电总上网量',                   unit: '万' + (rec.unit || 'kWh'), hasCalc: true, calcRoute: 'grid-supply-calculation' }
        ];

        // 初始化数据容器
        if (!rec.stageEmissions) rec.stageEmissions = {};
        STAGE_INPUTS.forEach(s => {
            if (rec.stageEmissions[s.key] == null) rec.stageEmissions[s.key] = '';
        });

        const calcCard = el('div', { class: 'table-card' });
        calcCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:4px;' }, ['核算参数']));
        calcCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:14px;' }, ['按产品碳足迹量化方法的各阶段录入温室气体排放量，具体核算方法另行说明。']));

        const inputs = {};
        const formGrid = el('div', { class: 'accounting-stage-grid' });
        STAGE_INPUTS.forEach(s => {
            const input = el('input', {
                class: 'form-control',
                type: 'number',
                min: '0',
                step: '0.01',
                value: rec.stageEmissions[s.key],
                placeholder: '请输入数值或点击右侧「计算」',
                oninput: () => { errBox.style.display = 'none'; }
            });
            inputs[s.key] = input;
            const isAuto = !!rec.stageCalcAuto && rec.stageCalcAuto[s.key];
            formGrid.appendChild(el('div', { class: 'form-group' }, [
                el('label', {}, [s.label]),
                el('div', { class: 'input-with-suffix' }, [
                    input,
                    el('span', { class: 'input-suffix' }, [s.unit])
                ]),
                el('div', { style: 'margin-top:6px;display:flex;gap:8px;align-items:center;' }, [
                    s.hasCalc ? el('button', {
                        class: 'btn',
                        style: 'font-size:12px;padding:4px 10px;',
                        onclick: () => {
                            const route = s.calcRoute || 'stage-calculation';
                            const path = s.calcRoute
                                ? '#/' + route + '/' + encodeURIComponent(rec.id)
                                : '#/' + route + '/' + encodeURIComponent(rec.id) + '/' + s.key;
                            navigate(path);
                        }
                    }, ['计算']) : null,
                    isAuto
                        ? el('span', { class: 'form-tip', style: 'color:#0f766e;margin:0;' }, ['（已通过计算得出）'])
                        : null
                ])
            ]));
        });

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });
        const actionRow = el('div', { style: 'display:flex;align-items:center;gap:12px;margin-top:8px;' }, [
            el('button', { class: 'btn btn-primary', onclick: saveParams }, ['保存参数']),
            el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['保存后可继续编辑，核算方法确定后将自动计算光伏发电产品碳足迹。'])
        ]);

        calcCard.appendChild(formGrid);
        calcCard.appendChild(errBox);
        calcCard.appendChild(actionRow);

        function saveParams() {
            const errors = [];
            STAGE_INPUTS.forEach(s => {
                const v = inputs[s.key].value.trim();
                if (v === '') { errors.push(s.label + ' 不能为空'); return; }
                const n = parseFloat(v);
                if (isNaN(n) || n < 0) errors.push(s.label + ' 需为非负数值');
            });
            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }
            errBox.style.display = 'none';
            STAGE_INPUTS.forEach(s => {
                rec.stageEmissions[s.key] = inputs[s.key].value.trim();
            });
            rec.status = '参数已录入';
            rec.accountedAt = nowText();
            saveAccounting();
            // 同步 meta 中的核算状态
            const statusVals = meta.querySelectorAll('.meta-item .value');
            if (statusVals.length >= 8) statusVals[7].textContent = rec.status;
            renderResult();
        }

        // ============ 核算结果 ============
        const resultCard = el('div', { class: 'table-card' });

        function renderResult() {
            resultCard.innerHTML = '';
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['核算结果']));

            // 碳足迹值：核算方法未定，暂显示"待核算"
            const footprintValue = (rec.status === '已核算' && rec.result != null)
                ? Number(rec.result).toFixed(2) + ' tCO₂e'
                : '待核算';

            const grid = el('div', { class: 'result-grid' });
            grid.appendChild(el('div', { class: 'result-item result-item-wide' }, [
                el('div', { class: 'label' }, ['光伏发电产品碳足迹']),
                el('div', { class: 'value result-main' }, [footprintValue])
            ]));
            if (rec.accountedAt) {
                grid.appendChild(el('div', { class: 'result-item' }, [
                    el('div', { class: 'label' }, ['最近保存时间']),
                    el('div', { class: 'value' }, [rec.accountedAt])
                ]));
            }
            resultCard.appendChild(grid);

            resultCard.appendChild(el('div', { class: 'form-tip', style: 'margin-top:12px;color:#6b7280;' }, ['说明：光伏发电产品碳足迹 = 各阶段排放量之和 ÷ 总上网量，具体核算方法另行说明，当前仅完成参数录入。']));
        }

        container.appendChild(header);
        container.appendChild(meta);
        container.appendChild(calcCard);
        container.appendChild(resultCard);
        renderResult();
    }

    /* ============ 阶段计算页面 ============ */
    // stageKey → model definition stageId 映射
    const STAGE_KEY_TO_MODEL_STAGE_ID = {
        rawMaterial: 'raw-materials',
        transport: 'transport',
        facilityConstruction: 'construction',
        productionRetirement: 'production-retirement',
        powerTransmission: 'transmission'
    };

    // stageKey → 阶段中文名
    const STAGE_KEY_LABELS = {
        rawMaterial: '原材料及生产设备获取阶段',
        transport: '运输阶段',
        facilityConstruction: '设施建设阶段',
        productionRetirement: '生产及退役阶段',
        powerTransmission: '输配电阶段'
    };

    // 各阶段计算配置：公式说明、表格列、单行计算逻辑
    // 列类型：text 文本 / input 数值输入 / unitInput 单位输入 / emission 排放量（自动）
    const STAGE_CALC_CONFIG = {
        rawMaterial: {
            formula: 'E = Σ(ADᵢ × EFᵢ)',
            formulaDesc: '其中 ADᵢ 为第 i 种原材料/设备/材料的数量，EFᵢ 为对应的碳足迹因子（kgCO₂e/单位）。每行排放量 = 数量 × 碳足迹因子（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。',
            columns: [
                { key: 'dataName', header: '数据名称', type: 'text' },
                { key: 'quantity', header: '数量', type: 'input', width: '100px', placeholder: '0' },
                { key: 'quantityUnit', header: '单位', type: 'unitInput' },
                { key: 'emissionCoefficient', header: '碳排系数(kgCO₂e)', type: 'text' },
                { key: 'functionalUnit', header: '功能单位', type: 'text' },
                { key: 'emissionFactor', header: '排放因子', type: 'text' },
                { key: 'factorSource', header: '因子来源', type: 'text' },
                { key: 'dataSource', header: '数据来源', type: 'text' },
                { key: '_emission', header: '排放量(kgCO₂e)', type: 'emission' }
            ],
            // 排放量 = 数量 × 碳排系数
            computeRow: function (row) {
                const qty = parseFloat(row.quantity);
                const coef = parseFloat(row.emissionCoefficient);
                if (isNaN(qty) || qty <= 0 || isNaN(coef)) return null;
                return qty * coef;
            }
        },
        transport: {
            formula: 'Em_tr = Σ(ADⱼ × EFⱼ × Dⱼ)',
            formulaDesc: '其中 ADⱼ 为第 j 种运输方式运输重量（t），EFⱼ 为该运输方式碳足迹因子 [kgCO₂e/(t·km)]，Dⱼ 为运输距离（km）。每行排放量 = 运输重量 × 碳足迹因子 × 运输距离（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。',
            columns: [
                { key: 'dataName', header: '数据名称', type: 'text' },
                { key: 'weight', header: '运输重量(t)', type: 'input', width: '100px', placeholder: '0' },
                { key: 'distance', header: '运输距离(km)', type: 'input', width: '100px', placeholder: '0' },
                { key: 'emissionCoefficient', header: '碳足迹因子[kgCO₂e/(t·km)]', type: 'text' },
                { key: 'functionalUnit', header: '功能单位', type: 'text' },
                { key: 'emissionFactor', header: '排放因子', type: 'text' },
                { key: 'factorSource', header: '因子来源', type: 'text' },
                { key: 'dataSource', header: '数据来源', type: 'text' },
                { key: '_emission', header: '排放量(kgCO₂e)', type: 'emission' }
            ],
            // 排放量 = 运输重量 × 因子 × 运输距离
            computeRow: function (row) {
                const weight = parseFloat(row.weight);
                const coef = parseFloat(row.emissionCoefficient);
                const distance = parseFloat(row.distance);
                if (isNaN(weight) || weight <= 0 || isNaN(coef) || isNaN(distance) || distance <= 0) return null;
                return weight * coef * distance;
            }
        },
        facilityConstruction: {
            formula: 'Em_cs = Σ(AD_k × EF_k)',
            formulaDesc: '其中 AD_k 为第 k 种能源消耗量（汽油、柴油等为吨 t，燃气为立方米 m³，电力为千瓦·时 kW·h），EF_k 为该能源碳足迹因子（kgCO₂e/对应单位）。每行排放量 = 能源消耗量 × 碳足迹因子（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。',
            columns: [
                { key: 'dataName', header: '数据名称', type: 'text' },
                { key: 'quantity', header: '能源消耗量', type: 'input', width: '110px', placeholder: '0' },
                { key: 'quantityUnit', header: '单位', type: 'unitInput' },
                { key: 'emissionCoefficient', header: '碳足迹因子(kgCO₂e/单位)', type: 'text' },
                { key: 'functionalUnit', header: '功能单位', type: 'text' },
                { key: 'emissionFactor', header: '排放因子', type: 'text' },
                { key: 'factorSource', header: '因子来源', type: 'text' },
                { key: 'dataSource', header: '数据来源', type: 'text' },
                { key: '_emission', header: '排放量(kgCO₂e)', type: 'emission' }
            ],
            // 排放量 = 数量 × 碳排系数
            computeRow: function (row) {
                const qty = parseFloat(row.quantity);
                const coef = parseFloat(row.emissionCoefficient);
                if (isNaN(qty) || qty <= 0 || isNaN(coef)) return null;
                return qty * coef;
            }
        },
        productionRetirement: {
            formula: 'Em_us = Σ(AD_l × EF_l)',
            formulaDesc: '其中 AD_l 为第 l 种能源消耗量（汽油、柴油等为吨 t，燃气为立方米 m³，电力为千瓦·时 kW·h），EF_l 为该能源碳足迹因子（kgCO₂e/对应单位）。每行排放量 = 能源消耗量 × 碳足迹因子（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。',
            columns: [
                { key: 'dataName', header: '数据名称', type: 'text' },
                { key: 'quantity', header: '能源消耗量', type: 'input', width: '110px', placeholder: '0' },
                { key: 'quantityUnit', header: '单位', type: 'unitInput' },
                { key: 'emissionCoefficient', header: '碳足迹因子(kgCO₂e/单位)', type: 'text' },
                { key: 'functionalUnit', header: '功能单位', type: 'text' },
                { key: 'emissionFactor', header: '排放因子', type: 'text' },
                { key: 'factorSource', header: '因子来源', type: 'text' },
                { key: 'dataSource', header: '数据来源', type: 'text' },
                { key: '_emission', header: '排放量(kgCO₂e)', type: 'emission' }
            ],
            // 排放量 = 数量 × 碳排系数
            computeRow: function (row) {
                const qty = parseFloat(row.quantity);
                const coef = parseFloat(row.emissionCoefficient);
                if (isNaN(qty) || qty <= 0 || isNaN(coef)) return null;
                return qty * coef;
            }
        },
        powerTransmission: {
            formula: 'Em_td = CFP_td × E_oge',
            formulaDesc: '其中 CFP_td 为全国输配电碳足迹因子（不含线损）[kgCO₂e/(kW·h)]，计算直供电产品碳足迹时 CFP_td 取 0；E_oge 为上网电量（kW·h）。每行排放量 = 上网电量 × 输配电碳足迹因子（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。',
            columns: [
                { key: 'dataName', header: '数据名称', type: 'text' },
                { key: 'quantity', header: '上网/自供电量(kW·h)', type: 'input', width: '130px', placeholder: '0' },
                { key: 'quantityUnit', header: '单位', type: 'unitInput' },
                { key: 'emissionCoefficient', header: 'CFP_td(kgCO₂e/kWh)', type: 'text' },
                { key: 'functionalUnit', header: '功能单位', type: 'text' },
                { key: 'emissionFactor', header: '排放因子', type: 'text' },
                { key: 'factorSource', header: '因子来源', type: 'text' },
                { key: 'dataSource', header: '数据来源', type: 'text' },
                { key: '_emission', header: '排放量(kgCO₂e)', type: 'emission' }
            ],
            // 排放量 = 电量 × 输配电碳足迹因子
            computeRow: function (row) {
                const qty = parseFloat(row.quantity);
                const coef = parseFloat(row.emissionCoefficient);
                if (isNaN(qty) || qty <= 0 || isNaN(coef)) return null;
                return qty * coef;
            }
        }
    };

    // 未单独配置的阶段默认按「数量 × 碳排系数」
    function getStageCalcConfig(stageKey) {
        return STAGE_CALC_CONFIG[stageKey] || STAGE_CALC_CONFIG.rawMaterial;
    }

    function renderStageCalculation(container, param) {
        const parts = (param || '').split('/');
        const accId = parts[0] ? decodeURIComponent(parts[0]) : '';
        const stageKey = parts[1] || '';
        const rec = accountingRecords.find(r => r.id === accId);

        if (!rec || !stageKey) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['参数无效，未找到对应核算记录']));
            return;
        }

        const stageId = STAGE_KEY_TO_MODEL_STAGE_ID[stageKey];
        const stageLabel = STAGE_KEY_LABELS[stageKey] || stageKey;
        const calcConfig = getStageCalcConfig(stageKey);

        // 找到对应的模型
        const model = models.find(m => m.name === rec.model);
        if (!model || !stageId) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的核算模型或阶段定义']));
            return;
        }

        // 初始化核算数据容器
        if (!rec.calcRows) rec.calcRows = {};
        if (!rec.stageCalcAuto) rec.stageCalcAuto = {};
        if (!rec.stageEmissions) rec.stageEmissions = {};

        // 从模型定义复制阶段结构（支持增量同步：保留已录入数据，新增行追加）
        function newCalcRow(modelRow, prev) {
            const base = {
                calcId: 'cr-' + Math.random().toString(36).slice(2, 8),
                quantity: '',
                quantityUnit: modelRow.functionalUnit || '',
                weight: '',
                distance: ''
            };
            const merged = Object.assign(base, modelRow);
            if (prev) {
                // 保留已录入的核算数据
                merged.calcId = prev.calcId;
                merged.quantity = prev.quantity || '';
                merged.quantityUnit = prev.quantityUnit || modelRow.functionalUnit || '';
                merged.weight = prev.weight || '';
                merged.distance = prev.distance || '';
            }
            return merged;
        }

        function syncModelCats() {
            const modelCats = getModelStageCategories(model, stageId);
            if (!rec.calcRows[stageKey]) {
                // 首次：全量复制
                rec.calcRows[stageKey] = modelCats.map(cat => ({
                    catId: cat.id,
                    catName: cat.name,
                    rows: (cat.rows || []).map(r => newCalcRow(r))
                }));
            } else {
                // 增量合并：新增的大类/行追加，已有行按 dataName+emissionCoefficient 匹配并保留录入数据
                const existing = rec.calcRows[stageKey];
                const catMap = {};
                existing.forEach(c => { catMap[c.catId] = c; });
                const newCalc = [];
                modelCats.forEach(mcat => {
                    if (catMap[mcat.id]) {
                        const ecat = catMap[mcat.id];
                        const newRows = (mcat.rows || []).map(mr => {
                            const matched = (ecat.rows || []).find(er =>
                                er.dataName === mr.dataName &&
                                er.emissionCoefficient === mr.emissionCoefficient
                            );
                            return newCalcRow(mr, matched || null);
                        });
                        newCalc.push({ catId: mcat.id, catName: mcat.name, rows: newRows });
                    } else {
                        // 新增大类
                        newCalc.push({
                            catId: mcat.id,
                            catName: mcat.name,
                            rows: (mcat.rows || []).map(r => newCalcRow(r))
                        });
                    }
                });
                rec.calcRows[stageKey] = newCalc;
            }
            saveAccounting();
        }
        syncModelCats();

        const header = el('div', { class: 'page-header' }, [
            el('div', { class: 'model-def-header' }, [
                el('span', { class: 'back', onclick: () => navigate('#/carbon-accounting/' + encodeURIComponent(rec.id)) }, ['← 返回碳排放核算']),
                el('span', { class: 'model-def-title' }, [stageLabel + ' 温室气体排放量计算'])
            ])
        ]);

        container.appendChild(header);

        // 公式说明
        const formulaCard = el('div', { class: 'table-card' });
        formulaCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:8px;' }, ['计算方法']));
        formulaCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:6px;' }, ['公式：' + calcConfig.formula]));
        formulaCard.appendChild(el('div', { class: 'form-tip' }, [calcConfig.formulaDesc]));
        container.appendChild(formulaCard);

        // 两栏布局
        const layout = el('div', { class: 'model-def-layout' });
        const catList = el('div', { class: 'stage-list' });
        const catPanel = el('div', { class: 'stage-data' });
        layout.appendChild(catList);
        layout.appendChild(catPanel);
        container.appendChild(layout);

        const calcCats = rec.calcRows[stageKey];
        let currentCatIdx = 0;

        function refresh() {
            renderCatList();
            renderCatPanel();
            renderResult();
        }

        function renderCatList() {
            catList.innerHTML = '';
            catList.appendChild(el('div', { class: 'stage-list-header' }, ['大类']));
            calcCats.forEach((cat, idx) => {
                const isActive = idx === currentCatIdx;
                const item = el('div', { class: 'stage-item' + (isActive ? ' active' : '') });
                item.appendChild(el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, [cat.catName || '（未命名）']));
                item.addEventListener('click', () => { currentCatIdx = idx; refresh(); });
                catList.appendChild(item);
            });
        }

        function renderCatPanel() {
            catPanel.innerHTML = '';
            const cat = calcCats[currentCatIdx];
            if (!cat) {
                catPanel.appendChild(el('div', { class: 'empty' }, ['暂无大类数据']));
                return;
            }

            const block = el('div', { class: 'category-block' });
            block.appendChild(el('div', { class: 'category-header' }, [
                el('div', { class: 'category-title' }, [cat.catName || '（未命名）'])
            ]));

            const body = el('div', { class: 'category-body' });
            body.appendChild(el('div', { class: 'toolbar' }, [
                el('div', { class: 'toolbar-left' }, [
                    el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['引用自模型定义，如需增删数据行请前往「碳模型」的「模型定义」页面。'])
                ])
            ]));

            const tableCard = el('div', { class: 'table-card' });
            tableCard.appendChild(buildCalcTable(cat, catPanel));
            body.appendChild(tableCard);
            block.appendChild(body);
            catPanel.appendChild(block);
        }

        function buildCalcTable(cat, container) {
            const rows = cat.rows || [];
            if (!rows.length) {
                return el('div', { class: 'empty' }, ['该大类暂无数据，引用自模型定义，需在模型定义页面新增。']);
            }

            const table = el('table', { class: 'data-table calc-table' });
            const thead = el('thead');
            const trh = el('tr');
            calcConfig.columns.forEach(col => {
                trh.appendChild(el('th', {}, [col.header]));
            });
            thead.appendChild(trh);
            table.appendChild(thead);

            const tbody = el('tbody');
            rows.forEach(r => {
                const tr = el('tr');
                let emissionSpan = null; // 行级引用：input 变化时更新排放量单元格
                calcConfig.columns.forEach(col => {
                    if (col.type === 'text') {
                        tr.appendChild(el('td', {}, [r[col.key] || '']));
                    } else if (col.type === 'input') {
                        const input = el('input', {
                            class: 'form-control',
                            type: 'number',
                            min: '0',
                            step: '0.01',
                            value: r[col.key] || '',
                            placeholder: col.placeholder || '0',
                            style: 'width:' + (col.width || '100px') + ';',
                            oninput: () => {
                                r[col.key] = input.value.trim();
                                saveAccounting();
                                if (emissionSpan) emissionSpan.textContent = computeRowEmission(r);
                                renderResult();
                            }
                        });
                        tr.appendChild(el('td', {}, [input]));
                    } else if (col.type === 'unitInput') {
                        const unitInput = el('input', {
                            class: 'form-control',
                            value: r[col.key] || '',
                            placeholder: '如 t/台/kW/m',
                            style: 'width:90px;',
                            oninput: () => {
                                r[col.key] = unitInput.value.trim();
                                saveAccounting();
                            }
                        });
                        tr.appendChild(el('td', {}, [unitInput]));
                    } else if (col.type === 'emission') {
                        emissionSpan = el('span', { style: 'font-weight:500;color:#0f766e;' }, [computeRowEmission(r)]);
                        tr.appendChild(el('td', {}, [emissionSpan]));
                    } else {
                        tr.appendChild(el('td', {}, ['']));
                    }
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        }

        // 单行排放量（返回 '--' 表示数据不完整）
        function computeRowEmission(row) {
            const v = calcConfig.computeRow(row);
            return (v == null || isNaN(v)) ? '--' : v.toFixed(2);
        }

        function computeStageTotalKg() {
            let total = 0;
            calcCats.forEach(cat => {
                (cat.rows || []).forEach(r => {
                    const e = computeRowEmission(r);
                    if (e !== '--') total += parseFloat(e);
                });
            });
            return total;
        }

        function renderResult() {
            // 移除旧结果卡（除了 header/formula/layout）
            const existing = container.querySelector('.stage-calc-result');
            if (existing) existing.remove();

            const totalKg = computeStageTotalKg();
            const totalT = totalKg / 1000;

            const resultCard = el('div', { class: 'table-card stage-calc-result' });
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['阶段排放量汇总']));
            const grid = el('div', { class: 'result-grid' });
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['阶段内有效数据行']),
                el('div', { class: 'value' }, [countValidRows() + ' / ' + countAllRows()])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['阶段总排放量']),
                el('div', { class: 'value result-main' }, [totalT.toFixed(4) + ' tCO₂e'])
            ]));
            resultCard.appendChild(grid);
            resultCard.appendChild(el('div', { style: 'margin-top:12px;display:flex;gap:12px;' }, [
                el('button', {
                    class: 'btn btn-primary',
                    onclick: () => confirmAndSave(totalT)
                }, ['确认计算并回写']),
                el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['保存后将自动填入「' + stageLabel + '」的排放量输入框。'])
            ]));
            container.appendChild(resultCard);
        }

        function countAllRows() {
            let n = 0;
            calcCats.forEach(c => { n += (c.rows || []).length; });
            return n;
        }
        function countValidRows() {
            let n = 0;
            calcCats.forEach(c => {
                (c.rows || []).forEach(r => { if (computeRowEmission(r) !== '--') n++; });
            });
            return n;
        }

        function confirmAndSave(totalT) {
            rec.stageEmissions[stageKey] = totalT.toFixed(4);
            rec.stageCalcAuto[stageKey] = true;
            rec.status = '参数已录入';
            rec.accountedAt = nowText();
            saveAccounting();
            // 跳回核算详情页
            navigate('#/carbon-accounting/' + encodeURIComponent(rec.id));
        }

        refresh();
    }

    /* ============ 光伏发电总上网电量计算页面 ============ */
    // E_oge = Σ E_D + W × H × PR × Σ_{t=1}^{RSL}(1-deg)^t
    function renderGridSupplyCalculation(container, param) {
        const accId = (param || '').split('/')[0] ? decodeURIComponent((param || '').split('/')[0]) : '';
        const rec = accountingRecords.find(r => r.id === accId);
        if (!rec) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['参数无效，未找到对应核算记录']));
            return;
        }
        if (!rec.stageEmissions) rec.stageEmissions = {};
        if (!rec.stageCalcAuto) rec.stageCalcAuto = {};

        // 历史上网电量 E_D
        if (!Array.isArray(rec.gridSupplyHistory)) rec.gridSupplyHistory = [];
        // 计算参数
        const DEFAULT_PARAMS = { capacity: rec.capacity || 0, hours: 1200, pr: 80, rsl: 25, deg: 0.5 };
        rec.gridSupplyParams = Object.assign({}, DEFAULT_PARAMS, rec.gridSupplyParams || {});
        const params = rec.gridSupplyParams;

        // 衰减级数 Σ_{t=1}^{RSL} (1-deg/100)^t
        function degradationSum() {
            const rsl = Math.max(0, Math.floor(parseFloat(params.rsl) || 0));
            const deg = Math.max(0, parseFloat(params.deg) || 0) / 100;
            if (rsl <= 0) return 0;
            if (deg <= 0) return rsl;
            const r = 1 - deg;
            // Σ_{t=1}^{RSL} r^t = r*(1-r^RSL)/(1-r)
            return r * (1 - Math.pow(r, rsl)) / (1 - r);
        }

        function computeED() {
            let sum = 0;
            rec.gridSupplyHistory.forEach(h => {
                const v = parseFloat(h.amount);
                if (!isNaN(v)) sum += v;
            });
            return sum;
        }

        function computeTotalKwh() {
            const W = parseFloat(params.capacity) || 0;
            const H = parseFloat(params.hours) || 0;
            const PR = (parseFloat(params.pr) || 0) / 100;
            const future = W * H * PR * degradationSum();
            return computeED() + future;
        }

        container.appendChild(el('div', { class: 'page-header' }, [
            el('div', { class: 'model-def-header' }, [
                el('span', { class: 'back', onclick: () => navigate('#/carbon-accounting/' + encodeURIComponent(rec.id)) }, ['← 返回碳排放核算']),
                el('span', { class: 'model-def-title' }, ['光伏发电总上网电量计算'])
            ])
        ]));

        // 公式说明
        const formulaCard = el('div', { class: 'table-card' });
        formulaCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:8px;' }, ['计算方法']));
        formulaCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:6px;' }, ['公式：E_oge = Σ E_D + W × H × PR × Σ_{t=1}^{RSL}(1-deg)^t']));
        formulaCard.appendChild(el('div', { class: 'form-tip' }, ['其中 E_D 为实际年度上网电量（kW·h），W 为装机容量（kW），H 为满负荷运行小时数（h），PR 为系统能效（%），RSL 为运行年限（a），deg 为系统衰减率（%）。总上网电量 = 历史上网电量合计 + 估算年限内逐年衰减上网电量之和，单位为 kW·h，结果按万 kW·h 回写。']));
        container.appendChild(formulaCard);

        // 参数卡
        const paramCard = el('div', { class: 'table-card' });
        paramCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['计算参数']));
        const paramGrid = el('div', { class: 'accounting-stage-grid' });
        const paramInputs = {};
        [
            { key: 'capacity', label: '装机容量 W(kW)', step: '0.01' },
            { key: 'hours', label: '满负荷运行小时数 H(h)', step: '1' },
            { key: 'pr', label: '系统能效 PR(%)', step: '0.1' },
            { key: 'rsl', label: '运行年限 RSL(a)', step: '1' },
            { key: 'deg', label: '系统衰减率 deg(%)', step: '0.01' }
        ].forEach(p => {
            const inp = el('input', {
                class: 'form-control',
                type: 'number',
                min: '0',
                step: p.step,
                value: params[p.key] == null ? '' : params[p.key],
                oninput: () => {
                    params[p.key] = inp.value.trim();
                    saveAccounting();
                    renderResult();
                }
            });
            paramInputs[p.key] = inp;
            paramGrid.appendChild(el('div', { class: 'form-group' }, [
                el('label', {}, [p.label]),
                inp
            ]));
        });
        paramCard.appendChild(paramGrid);
        container.appendChild(paramCard);

        // 历史上网电量表
        const historyCard = el('div', { class: 'table-card' });
        historyCard.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' }, [
            el('div', { style: 'font-weight:600;font-size:14px;color:#111827;' }, ['历史年度上网电量 E_D']),
            el('button', {
                class: 'btn',
                style: 'font-size:12px;padding:4px 10px;',
                onclick: () => {
                    const nextYear = rec.gridSupplyHistory.length
                        ? Math.max.apply(null, rec.gridSupplyHistory.map(h => parseInt(h.year) || 0)) + 1
                        : new Date().getFullYear();
                    rec.gridSupplyHistory.push({ year: String(nextYear), amount: '' });
                    saveAccounting();
                    renderHistory();
                    renderResult();
                }
            }, ['+ 新增年度'])
        ]));

        const historyTableWrap = el('div');
        historyCard.appendChild(historyTableWrap);
        container.appendChild(historyCard);

        function renderHistory() {
            historyTableWrap.innerHTML = '';
            if (!rec.gridSupplyHistory.length) {
                historyTableWrap.appendChild(el('div', { class: 'empty' }, ['暂无历史上网电量数据，可点击「新增年度」录入。']));
                return;
            }
            const table = el('table', { class: 'data-table' });
            const thead = el('thead');
            const trh = el('tr');
            ['年份', '上网电量 E_D(kW·h)', '操作'].forEach(t => trh.appendChild(el('th', {}, [t])));
            thead.appendChild(trh);
            table.appendChild(thead);

            const tbody = el('tbody');
            rec.gridSupplyHistory.forEach((h, idx) => {
                const tr = el('tr');
                const yearInput = el('input', {
                    class: 'form-control',
                    type: 'number',
                    value: h.year || '',
                    placeholder: '2024',
                    style: 'width:100px;',
                    oninput: () => { h.year = yearInput.value.trim(); saveAccounting(); }
                });
                const amtInput = el('input', {
                    class: 'form-control',
                    type: 'number',
                    min: '0',
                    step: '1',
                    value: h.amount || '',
                    placeholder: '0',
                    style: 'width:160px;',
                    oninput: () => { h.amount = amtInput.value.trim(); saveAccounting(); renderResult(); }
                });
                const delBtn = el('button', {
                    class: 'btn',
                    style: 'font-size:12px;padding:2px 10px;color:#dc2626;',
                    onclick: () => {
                        rec.gridSupplyHistory.splice(idx, 1);
                        saveAccounting();
                        renderHistory();
                        renderResult();
                    }
                }, ['删除']);
                tr.appendChild(el('td', {}, [yearInput]));
                tr.appendChild(el('td', {}, [amtInput]));
                tr.appendChild(el('td', {}, [delBtn]));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            historyTableWrap.appendChild(table);
        }

        // 汇总结果卡
        let resultCard = null;
        function renderResult() {
            if (resultCard) resultCard.remove();
            const sumED = computeED();
            const W = parseFloat(params.capacity) || 0;
            const H = parseFloat(params.hours) || 0;
            const PR = (parseFloat(params.pr) || 0) / 100;
            const degSum = degradationSum();
            const future = W * H * PR * degSum;
            const totalKwh = sumED + future;
            const totalWanKwh = totalKwh / 10000;

            resultCard = el('div', { class: 'table-card' });
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['总上网电量汇总']));
            const grid = el('div', { class: 'result-grid' });
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['历史上网电量 ΣE_D']),
                el('div', { class: 'value' }, [sumED.toFixed(2) + ' kW·h'])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['估算年限内上网电量']),
                el('div', { class: 'value' }, [future.toFixed(2) + ' kW·h'])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['衰减级数 Σ(1-deg)^t']),
                el('div', { class: 'value' }, [degSum.toFixed(4)])
            ]));
            grid.appendChild(el('div', { class: 'result-item result-item-wide' }, [
                el('div', { class: 'label' }, ['光伏发电总上网电量 E_oge']),
                el('div', { class: 'value', style: 'color:#0f766e;font-weight:600;' }, [totalKwh.toFixed(2) + ' kW·h ＝ ' + totalWanKwh.toFixed(4) + ' 万 kW·h'])
            ]));
            resultCard.appendChild(grid);

            resultCard.appendChild(el('div', { style: 'display:flex;justify-content:flex-end;margin-top:16px;' }, [
                el('button', {
                    class: 'btn btn-primary',
                    onclick: () => {
                        rec.stageEmissions.totalGridSupply = totalWanKwh.toFixed(4);
                        rec.stageCalcAuto.totalGridSupply = true;
                        rec.status = '参数已录入';
                        rec.accountedAt = nowText();
                        saveAccounting();
                        navigate('#/carbon-accounting/' + encodeURIComponent(rec.id));
                    }
                }, ['确认计算并回写'])
            ]));
            container.appendChild(resultCard);
        }

        renderHistory();
        renderResult();
    }

    /* ============ 侧边栏折叠 ============ */
    function initSidebar() {
        const title = $('#toggle-pcf');
        const item = document.querySelector('.nav-item[data-module="product-carbon-footprint"]');
        if (title && item) {
            title.addEventListener('click', () => item.classList.toggle('collapsed'));
        }
        // 默认展开
        if (item) item.classList.remove('collapsed');

        // 加载模块启停配置并应用到侧边栏
        loadModuleConfig();
        applyModuleConfig();

        // 管理按钮
        const manageBtn = $('#sidebar-manage-btn');
        if (manageBtn) manageBtn.addEventListener('click', openModuleManageModal);
    }

    /* ============ 产品碳足迹核算-实训 数据 ============ */
    const TRAIN_ACC_STORAGE_KEY = 'cmp:product-carbon-accounting-train:v12';

    // 光伏发电系统案例种子数据
    const TRAIN_ACC_SEED = [
        {
            accId: 'train-acc-001',
            productName: '光伏发电系统',
            specModel: '分布式电站',
            quantity: '1000',
            unit: 'kW',
            enterprise: '绿能新能源有限公司',
            accountingModel: 'PCM-2024-T01',
            periodStart: '2024-01-01',
            periodEnd: '2024-12-31',
            createTime: '2024-01-15 09:30',
            creator: '张工程师',
            reviewer: '李总工',
            reviewStatus: '已审核',
            status: '已核算',
            // 6阶段核算参数：前5阶段从核算模型中选取数据行 + 数量 + 排放量；
            // 光伏发电总上网量阶段由独立计算页计算并回写
            stageData: {
                'raw-materials': [
                    { dataName: '多晶硅', specModel: '太阳能级', manufacturer: '通威股份', emissionCoefficient: '190', functionalUnit: 'kg', quantity: '500', emission: '95000' },
                    { dataName: '硅片', specModel: 'M10(182mm)', manufacturer: '隆基绿能', emissionCoefficient: '35', functionalUnit: 'kg', quantity: '200', emission: '7000' },
                    { dataName: '电池片', specModel: 'PERC 182mm', manufacturer: '通威股份', emissionCoefficient: '42', functionalUnit: 'kg', quantity: '150', emission: '6300' },
                    { dataName: '光伏逆变器', specModel: 'SUN2000-50KTL', manufacturer: '华为', emissionCoefficient: '85', functionalUnit: '台', quantity: '2', emission: '170' },
                    { dataName: '箱式变压器', specModel: 'S13-1000kVA', manufacturer: '特变电工', emissionCoefficient: '320', functionalUnit: '台', quantity: '1', emission: '320' },
                    { dataName: '电缆', specModel: 'ZR-YJV 0.6/1kV', manufacturer: '远东电缆', emissionCoefficient: '3.2', functionalUnit: 'kg', quantity: '5000', emission: '16000' },
                    { dataName: '铝合金支架', specModel: 'A6005', manufacturer: '中信博', emissionCoefficient: '12.5', functionalUnit: 'kg', quantity: '800', emission: '10000' },
                    { dataName: '混凝土', specModel: 'C30', manufacturer: '华润水泥', emissionCoefficient: '0.35', functionalUnit: 'kg', quantity: '50000', emission: '17500' }
                ],
                'transport': [
                    { dataName: '公路货运（柴油重卡）', specModel: 'J6P 420PS', manufacturer: '一汽解放', emissionCoefficient: '0.050', functionalUnit: 't·km', weight: '50', distance: '1000', emission: '2500' }
                ],
                'construction': [
                    { dataName: '柴油', specModel: '0#车用柴油', manufacturer: '中国石化', emissionCoefficient: '3160', functionalUnit: 't', quantity: '0.5', emission: '1580' },
                    { dataName: '施工用电', specModel: '380V三相', manufacturer: '国家电网', emissionCoefficient: '0.5810', functionalUnit: 'kWh', quantity: '10000', emission: '5810' }
                ],
                'production-retirement': [
                    { dataName: '生产用电', specModel: '380V三相', manufacturer: '国家电网', emissionCoefficient: '0.5810', functionalUnit: 'kWh', quantity: '50000', emission: '29050' }
                ],
                'transmission': [
                    { dataName: '上网电量', specModel: '10kV并网', manufacturer: '国家电网', emissionCoefficient: '0.0014', functionalUnit: 'kWh', quantity: '1000000', emission: '1400' },
                    { dataName: '自供电量', specModel: '380V自用', manufacturer: '国家电网', emissionCoefficient: '0.0014', functionalUnit: 'kWh', quantity: '200000', emission: '280' }
                ],
                'grid-supply': [
                    { dataName: '光伏发电总上网电量', specModel: '—', manufacturer: '—', emissionCoefficient: '1', functionalUnit: 'kWh', quantity: '23500644.79', emission: '23500644.79' }
                ]
            },
            // 光伏发电总上网量独立计算页参数
            gridSupplyParams: { capacity: '1000', hours: '1200', pr: '80', rsl: '25', deg: '0.5' },
            gridSupplyHistory: [
                { year: '2024', amount: '1000000' }
            ],
            // 光伏发电产品碳足迹公式(1)参数：总直供电量 E_dps(kWh)、全国电网平均线损率 η(%)（直供电产品 η 取 0）
            cfpParams: { directSupplyKwh: '0', lineLossRate: '5' },
            // 前5阶段排放量单位均为 kgCO₂e（Em_rs=ΣAD×EF / Em_tr=ΣAD×EF×D / Em_cs=ΣAD×EF / Em_us=ΣAD×EF / Em_td=CFP_td×E_oge）；光伏发电总上网量 E_oge 单位为 kWh
            stageEmissions: {
                'raw-materials': '152290.00',
                'transport': '2500.00',
                'construction': '7390.00',
                'production-retirement': '29050.00',
                'transmission': '1680.00',
                'grid-supply': '23500644.79'
            },
            // 各阶段是否通过计算自动得出
            stageCalcAuto: {
                'raw-materials': true,
                'transport': true,
                'construction': true,
                'production-retirement': true,
                'transmission': true,
                'grid-supply': true
            }
        }
    ];

    // 6个阶段定义（对应系统边界）：前5阶段从模型选取数据行核算排放量；
    // 光伏发电总上网量阶段使用独立计算页，按公式(7)计算总上网电量 E_oge（kWh）
    const TRAIN_ACC_STAGES = [
        { stageId: 'raw-materials', stageName: '原材料及生产设备获取', formula: 'Em_rs = Σ(ADᵢ × EFᵢ)', resultUnit: 'kgCO₂e' },
        { stageId: 'transport', stageName: '运输', formula: 'Em_tr = Σ(ADⱼ × EFⱼ × Dⱼ)', qtyMode: 'weight-distance', resultUnit: 'kgCO₂e' },
        { stageId: 'construction', stageName: '设施建设', formula: 'Em_cs = Σ(AD_k × EF_k)', resultUnit: 'kgCO₂e' },
        { stageId: 'production-retirement', stageName: '生产及退役', formula: 'Em_us = Σ(AD_l × EF_l)', resultUnit: 'kgCO₂e' },
        { stageId: 'transmission', stageName: '输配电', formula: 'Em_td = CFP_td × E_oge', resultUnit: 'kgCO₂e' },
        { stageId: 'grid-supply', stageName: '光伏发电总上网量', formula: 'E_oge = Σ E_D + W × H × PR × Σ_{t=1}^{RSL}(1-deg)^t', independentCalc: true, resultUnit: 'kWh' }
    ];

    // 公式(1)光伏发电产品碳足迹统一计算（核算详情页与碳足迹报告共用）
    // 返回 { emFirst4, emTd, eOge, eDps, eta, part1, part2, value }；分母非法时 value 为 null
    function computeTrainCfp(acc) {
        const kg = id => { const n = parseFloat(acc.stageEmissions && acc.stageEmissions[id]); return isNaN(n) ? 0 : n; };
        const emFirst4 = ['raw-materials', 'transport', 'construction', 'production-retirement'].reduce((s, id) => s + kg(id), 0);
        const emTd = kg('transmission');
        const eOge = parseFloat(acc.stageEmissions && acc.stageEmissions['grid-supply']);
        const eDps = parseFloat(acc.cfpParams && acc.cfpParams.directSupplyKwh) || 0;
        const eta = (parseFloat(acc.cfpParams && acc.cfpParams.lineLossRate) || 0) / 100;
        const lossFactor = 1 - eta;
        let value = null, part1 = null, part2 = null;
        if (!isNaN(eOge) && eOge > 0 && lossFactor > 0 && (eOge + eDps) > 0) {
            part1 = emFirst4 / ((eOge + eDps) * lossFactor);
            part2 = emTd / (eOge * lossFactor);
            value = part1 + part2;
        }
        return { emFirst4, emTd, eOge: isNaN(eOge) ? null : eOge, eDps, eta, part1, part2, value };
    }

    function normalizeTrainAcc(acc) {
        if (!acc) return acc;
        if (acc.creator == null) acc.creator = '';
        if (acc.reviewer == null) acc.reviewer = '';
        if (acc.reviewStatus == null) acc.reviewStatus = acc.reviewer ? '已审核' : '待审核';
        if (acc.status == null) acc.status = '待核算';
        if (!acc.stageData) acc.stageData = {};
        if (!acc.stageEmissions) acc.stageEmissions = {};
        if (!acc.stageCalcAuto) acc.stageCalcAuto = {};
        TRAIN_ACC_STAGES.forEach(s => {
            if (!acc.stageData[s.stageId]) acc.stageData[s.stageId] = [];
            if (acc.stageEmissions[s.stageId] == null) acc.stageEmissions[s.stageId] = '';
            if (acc.stageCalcAuto[s.stageId] == null) acc.stageCalcAuto[s.stageId] = false;
        });
        // 光伏发电总上网量独立计算页参数与历史数据
        if (!acc.gridSupplyParams) acc.gridSupplyParams = { capacity: '', hours: '1200', pr: '80', rsl: '25', deg: '0.5' };
        if (!Array.isArray(acc.gridSupplyHistory)) acc.gridSupplyHistory = [];
        // 光伏发电产品碳足迹公式(1)参数：总直供电量 E_dps(kWh)、线损率 η(%)
        if (!acc.cfpParams) acc.cfpParams = {};
        if (acc.cfpParams.directSupplyKwh == null) acc.cfpParams.directSupplyKwh = '0';
        if (acc.cfpParams.lineLossRate == null) acc.cfpParams.lineLossRate = '5';
        return acc;
    }

    function loadTrainAccs() {
        try {
            const raw = localStorage.getItem(TRAIN_ACC_STORAGE_KEY);
            if (!raw) {
                const seed = JSON.parse(JSON.stringify(TRAIN_ACC_SEED));
                seed.forEach(normalizeTrainAcc);
                return seed;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            parsed.forEach(normalizeTrainAcc);
            return parsed;
        } catch (e) {
            return JSON.parse(JSON.stringify(TRAIN_ACC_SEED));
        }
    }

    function saveTrainAccs() {
        localStorage.setItem(TRAIN_ACC_STORAGE_KEY, JSON.stringify(trainAccs));
    }

    const trainAccs = loadTrainAccs();

    /* ============ 产品碳足迹核算-实训 落地页 ============ */
    function renderProductCarbonAccountingTrain(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    '碳足迹核算'
                ]),
                el('div', { class: 'page-title' }, ['碳足迹核算'])
            ])
        ]);

        const cards = el('div', { class: 'flow-cards' }, [
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-accounting-new') }, [
                el('div', { class: 'flow-icon' }, ['📦']),
                el('div', { class: 'flow-title' }, ['新建产品']),
                el('div', { class: 'flow-desc' }, [
                    '以列表形式展示产品信息，支持新建、编辑和删除。',
                    el('br'),
                    '字段包括：产品名称、规格型号、数量、单位、企业名称、核算模型、数据统计时间段、创建时间和操作。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ]),
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-accounting-list') }, [
                el('div', { class: 'flow-icon' }, ['📊']),
                el('div', { class: 'flow-title' }, ['产品列表']),
                el('div', { class: 'flow-desc' }, [
                    '展示所有已创建的产品，',
                    el('br'),
                    '支持查看各产品的碳足迹核算结果。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ])
        ]);

        const notice = el('div', { class: 'train-notice' }, [
            el('h3', {}, ['操作说明']),
            el('ol', {}, [
                el('li', {}, ['点击"新建产品"进行产品创建（例如某分布式光伏发电系统），包括产品名称、型号规格、数量、单位等基本信息；']),
                el('li', {}, ['点击"碳足迹核算"进行全生命周期各阶段温室气体排放量计算和审核；']),
                el('li', {}, ['点击"产品列表"，查看已创建的产品碳足迹数据。'])
            ])
        ]);

        container.appendChild(header);
        container.appendChild(cards);
        container.appendChild(notice);
    }

    /* ============ 产品碳足迹核算-实训 新建产品页 ============ */
    function renderTrainAccountingNew(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-accounting-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    '新建产品'
                ]),
                el('div', { class: 'page-title' }, ['新建产品'])
            ])
        ]);

        const toolbar = el('div', { class: 'toolbar' }, [
            el('div', { class: 'toolbar-left' }, []),
            el('div', { class: 'toolbar-right' }, [
                el('button', { class: 'btn btn-primary', onclick: () => openAccCreateModal() }, ['+ 新建产品'])
            ])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        container.appendChild(header);
        container.appendChild(toolbar);
        container.appendChild(tableCard);

        function buildTable() {
            tableCard.innerHTML = '';
            if (!trainAccs.length) {
                tableCard.appendChild(el('div', { class: 'empty' }, ['暂无产品数据']));
                return;
            }
            const table = el('table', { class: 'data-table' });
            const thead = el('thead');
            const trh = el('tr');
            ['产品名称', '规格型号', '数量', '单位', '企业名称', '核算模型', '数据统计时间段', '创建时间', '操作', '创建人', '审核人', '状态'].forEach(t => trh.appendChild(el('th', {}, [t])));
            thead.appendChild(trh);
            table.appendChild(thead);

            const tbody = el('tbody');
            trainAccs.forEach(acc => {
                const tr = el('tr');
                tr.appendChild(el('td', {}, [acc.productName || '']));
                tr.appendChild(el('td', {}, [acc.specModel || '']));
                tr.appendChild(el('td', {}, [acc.quantity || '']));
                tr.appendChild(el('td', {}, [acc.unit || '']));
                tr.appendChild(el('td', {}, [acc.enterprise || '']));
                // 核算模型显示模型名称
                const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
                tr.appendChild(el('td', {}, [linkedModel ? linkedModel.name : (acc.accountingModel || '')]));
                tr.appendChild(el('td', {}, [(acc.periodStart || '') + ' ~ ' + (acc.periodEnd || '')]));
                tr.appendChild(el('td', {}, [acc.createTime || '']));
                tr.appendChild(el('td', { style: 'white-space:nowrap;' }, [
                    el('button', { class: 'btn-link', style: 'color:#0f766e;margin-right:6px;', onclick: () => navigate('#/train-accounting-detail/' + encodeURIComponent(acc.accId)) }, ['碳足迹核算']),
                    el('button', { class: 'btn-link', style: 'color:#2563eb;margin-right:6px;', onclick: () => openAccEditModal(acc) }, ['编辑']),
                    el('button', { class: 'btn-link', style: 'color:#dc2626;', onclick: () => {
                        openConfirmModal('删除产品', '确定要删除产品「' + acc.productName + '」吗？此操作不可撤销。', () => {
                            const idx = trainAccs.findIndex(a => a.accId === acc.accId);
                            if (idx >= 0) { trainAccs.splice(idx, 1); saveTrainAccs(); buildTable(); }
                        });
                    } }, ['删除'])
                ]));
                tr.appendChild(el('td', {}, [acc.creator || '']));
                tr.appendChild(el('td', {}, [acc.reviewer || '']));
                const isReviewed = acc.reviewStatus === '已审核' || (acc.reviewer && !acc.reviewStatus);
                tr.appendChild(el('td', {}, [
                    el('span', {
                        style: 'font-size:12px;padding:2px 8px;border-radius:4px;' +
                            (isReviewed ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#d97706;')
                    }, [isReviewed ? '已审核' : '待审核'])
                ]));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableCard.appendChild(table);
        }

        function openAccCreateModal() {
            const existed = $('.modal-mask');
            if (existed) existed.remove();

            const form = {
                productName: el('input', { class: 'form-control', placeholder: '如 光伏发电系统' }),
                specModel: el('input', { class: 'form-control', placeholder: '如 分布式电站' }),
                quantity: el('input', { class: 'form-control', type: 'number', min: '0', step: '0.01', placeholder: '如 1000' }),
                unit: el('input', { class: 'form-control', placeholder: '如 kW' }),
                enterprise: el('input', { class: 'form-control', placeholder: '如 绿能新能源有限公司' }),
                accountingModel: el('select', { class: 'form-control' },
                    [el('option', { value: '' }, ['请选择核算模型'])].concat(
                        trainModels.map(m => el('option', { value: m.code }, [m.code + ' — ' + m.name]))
                    )
                ),
                periodStart: el('input', { class: 'form-control', type: 'date' }),
                periodEnd: el('input', { class: 'form-control', type: 'date' }),
                createTime: (function() {
                    const inp = el('input', { class: 'form-control', value: nowText(), style: 'background:#f9fafb;color:#6b7280;' });
                    inp.readOnly = true;
                    return inp;
                })(),
                creator: el('input', { class: 'form-control', placeholder: '如 张工程师' }),
                reviewer: el('input', { class: 'form-control', placeholder: '如 李总工' })
            };

            const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

            const body = el('div', { class: 'modal-body' });
            [
                ['产品名称', form.productName, ''],
                ['规格型号', form.specModel, '如：分布式电站'],
                ['数量', form.quantity, '产品数量（非负数）'],
                ['单位', form.unit, '如 kW、台、套'],
                ['企业名称', form.enterprise, ''],
                ['核算模型', form.accountingModel, '从已创建的碳足迹模型中选取'],
                ['统计开始日期', form.periodStart, ''],
                ['统计结束日期', form.periodEnd, ''],
                ['创建时间', form.createTime, '系统自动生成'],
                ['创建人', form.creator, ''],
                ['审核人', form.reviewer, '']
            ].forEach(([label, ctrl, tip]) => {
                const group = el('div', { class: 'form-group' });
                group.appendChild(el('label', {}, [label]));
                group.appendChild(ctrl);
                if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
                body.appendChild(group);
            });
            body.appendChild(errBox);

            function close() { mask.remove(); }

            function save() {
                const productName = form.productName.value.trim();
                const periodStart = form.periodStart.value;
                const periodEnd = form.periodEnd.value;
                const errors = [];
                if (!productName) errors.push('产品名称不能为空');
                if (periodStart && periodEnd && periodStart > periodEnd) errors.push('统计开始日期不能晚于结束日期');

                if (errors.length) {
                    errBox.textContent = errors.join('；');
                    errBox.style.display = 'block';
                    return;
                }

                const acc = {
                    accId: 'train-acc-' + Date.now(),
                    productName: productName,
                    specModel: form.specModel.value.trim(),
                    quantity: form.quantity.value.trim(),
                    unit: form.unit.value.trim(),
                    enterprise: form.enterprise.value.trim(),
                    accountingModel: form.accountingModel.value,
                    periodStart: periodStart,
                    periodEnd: periodEnd,
                    createTime: form.createTime.value,
                    creator: form.creator.value.trim(),
                    reviewer: form.reviewer.value.trim(),
                    reviewStatus: form.reviewer.value.trim() ? '已审核' : '待审核',
                    status: '待核算',
                    stageData: {}
                };
                TRAIN_ACC_STAGES.forEach(s => { acc.stageData[s.stageId] = []; });
                trainAccs.push(acc);
                saveTrainAccs();
                close();
                buildTable();
            }

            const mask = el('div', { class: 'modal-mask' }, [
                el('div', { class: 'modal' }, [
                    el('div', { class: 'modal-header' }, [
                        el('span', {}, ['新建产品']),
                        el('span', { class: 'modal-close', onclick: close }, ['×'])
                    ]),
                    body,
                    el('div', { class: 'modal-footer' }, [
                        el('button', { class: 'btn', onclick: close }, ['取消']),
                        el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                    ])
                ])
            ]);

            document.body.appendChild(mask);
            mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
        }

        function openAccEditModal(acc) {
            const existed = $('.modal-mask');
            if (existed) existed.remove();

            const form = {
                productName: el('input', { class: 'form-control', value: acc.productName || '' }),
                specModel: el('input', { class: 'form-control', value: acc.specModel || '' }),
                quantity: el('input', { class: 'form-control', type: 'number', min: '0', step: '0.01', value: acc.quantity || '' }),
                unit: el('input', { class: 'form-control', value: acc.unit || '' }),
                enterprise: el('input', { class: 'form-control', value: acc.enterprise || '' }),
                accountingModel: el('select', { class: 'form-control' },
                    [el('option', { value: '' }, ['请选择核算模型'])].concat(
                        trainModels.map(m => {
                            const opt = el('option', { value: m.code }, [m.code + ' — ' + m.name]);
                            if (m.code === acc.accountingModel) opt.selected = true;
                            return opt;
                        })
                    )
                ),
                periodStart: el('input', { class: 'form-control', type: 'date', value: acc.periodStart || '' }),
                periodEnd: el('input', { class: 'form-control', type: 'date', value: acc.periodEnd || '' }),
                creator: el('input', { class: 'form-control', value: acc.creator || '' }),
                reviewer: el('input', { class: 'form-control', value: acc.reviewer || '' })
            };

            const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });

            const body = el('div', { class: 'modal-body' });
            [
                ['产品名称', form.productName, ''],
                ['规格型号', form.specModel, '如：分布式电站'],
                ['数量', form.quantity, '产品数量（非负数）'],
                ['单位', form.unit, '如 kW、台、套'],
                ['企业名称', form.enterprise, ''],
                ['核算模型', form.accountingModel, '从已创建的碳足迹模型中选取'],
                ['统计开始日期', form.periodStart, ''],
                ['统计结束日期', form.periodEnd, ''],
                ['创建人', form.creator, ''],
                ['审核人', form.reviewer, '']
            ].forEach(([label, ctrl, tip]) => {
                const group = el('div', { class: 'form-group' });
                group.appendChild(el('label', {}, [label]));
                group.appendChild(ctrl);
                if (tip) group.appendChild(el('div', { class: 'form-tip' }, [tip]));
                body.appendChild(group);
            });
            body.appendChild(errBox);

            function close() { mask.remove(); }

            function save() {
                const productName = form.productName.value.trim();
                const periodStart = form.periodStart.value;
                const periodEnd = form.periodEnd.value;
                const errors = [];
                if (!productName) errors.push('产品名称不能为空');
                if (periodStart && periodEnd && periodStart > periodEnd) errors.push('统计开始日期不能晚于结束日期');

                if (errors.length) {
                    errBox.textContent = errors.join('；');
                    errBox.style.display = 'block';
                    return;
                }

                acc.productName = productName;
                acc.specModel = form.specModel.value.trim();
                acc.quantity = form.quantity.value.trim();
                acc.unit = form.unit.value.trim();
                acc.enterprise = form.enterprise.value.trim();
                acc.accountingModel = form.accountingModel.value;
                acc.periodStart = periodStart;
                acc.periodEnd = periodEnd;
                acc.creator = form.creator.value.trim();
                acc.reviewer = form.reviewer.value.trim();
                acc.reviewStatus = form.reviewer.value.trim() ? '已审核' : '待审核';
                saveTrainAccs();
                close();
                buildTable();
            }

            const mask = el('div', { class: 'modal-mask' }, [
                el('div', { class: 'modal' }, [
                    el('div', { class: 'modal-header' }, [
                        el('span', {}, ['编辑产品']),
                        el('span', { class: 'modal-close', onclick: close }, ['×'])
                    ]),
                    body,
                    el('div', { class: 'modal-footer' }, [
                        el('button', { class: 'btn', onclick: close }, ['取消']),
                        el('button', { class: 'btn btn-primary', onclick: save }, ['保存'])
                    ])
                ])
            ]);

            document.body.appendChild(mask);
            mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
        }

        buildTable();
    }

    /* ============ 产品碳足迹核算-实训 产品列表页 ============ */
    function renderTrainAccountingList(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-accounting-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    '产品列表'
                ]),
                el('div', { class: 'page-title' }, ['产品列表'])
            ])
        ]);

        const tableCard = el('div', { class: 'table-card' });
        container.appendChild(header);
        container.appendChild(tableCard);

        if (!trainAccs.length) {
            tableCard.appendChild(el('div', { class: 'empty' }, ['暂无产品数据']));
            return;
        }
        // 仅显示已审核状态的产品
        const reviewedAccs = trainAccs.filter(a => a.reviewStatus === '已审核');
        if (!reviewedAccs.length) {
            tableCard.appendChild(el('div', { class: 'empty' }, ['暂无已审核的产品']));
            return;
        }
        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['产品名称', '规格型号', '数量', '单位', '企业名称', '核算模型', '数据统计时间段', '创建时间', '操作', '创建人', '审核人', '状态'].forEach(t => trh.appendChild(el('th', {}, [t])));
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        reviewedAccs.forEach(acc => {
            const tr = el('tr');
            const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
            tr.appendChild(el('td', {}, [acc.productName || '']));
            tr.appendChild(el('td', {}, [acc.specModel || '']));
            tr.appendChild(el('td', {}, [acc.quantity || '']));
            tr.appendChild(el('td', {}, [acc.unit || '']));
            tr.appendChild(el('td', {}, [acc.enterprise || '']));
            tr.appendChild(el('td', {}, [linkedModel ? linkedModel.name : (acc.accountingModel || '')]));
            tr.appendChild(el('td', {}, [(acc.periodStart || '') + ' ~ ' + (acc.periodEnd || '')]));
            tr.appendChild(el('td', {}, [acc.createTime || '']));
            tr.appendChild(el('td', {}, [
                el('button', { class: 'btn-link', style: 'color:#0f766e;', onclick: () => navigate('#/train-accounting-view/' + encodeURIComponent(acc.accId)) }, ['碳足迹核算'])
            ]));
            tr.appendChild(el('td', {}, [acc.creator || '']));
            tr.appendChild(el('td', {}, [acc.reviewer || '']));
            const isReviewed = acc.reviewStatus === '已审核' || (acc.reviewer && !acc.reviewStatus);
            tr.appendChild(el('td', {}, [
                el('span', {
                    style: 'font-size:12px;padding:2px 8px;border-radius:4px;' +
                        (isReviewed ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#d97706;')
                }, [isReviewed ? '已审核' : '待审核'])
            ]));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableCard.appendChild(table);
    }

    /* ============ 产品碳足迹核算-实训 碳足迹核算页 ============ */
    function renderTrainAccountingDetail(container, accId, viewMode) {
        const id = accId ? decodeURIComponent(accId) : '';
        const acc = trainAccs.find(a => a.accId === id);
        if (!acc) {
            container.appendChild(el('div', { class: 'page-header' }, [
                el('div', { class: 'page-title' }, ['未找到产品'])
            ]));
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的产品，请从产品列表中进入。']));
            return;
        }

        const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
        normalizeTrainAcc(acc);

        // 记录进入模式，供阶段计算页判断只读
        try { sessionStorage.setItem('trainDetailMode', viewMode ? 'view' : 'edit'); } catch (e) {}

        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-accounting-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    viewMode ? '查看碳足迹' : '碳足迹核算'
                ]),
                el('div', { class: 'page-title' }, [(viewMode ? '查看碳足迹' : '碳足迹核算') + ' — ' + acc.productName])
            ])
        ]);
        container.appendChild(header);

        // 产品基本信息
        const infoCard = el('div', { class: 'table-card' });
        infoCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['产品基本信息']));
        const metaGrid = el('div', { class: 'result-grid' });
        const reviewStatus = acc.reviewStatus === '已审核' ? '已审核' : '待审核';
        const metaItems = [
            ['产品名称', acc.productName],
            ['规格型号', acc.specModel],
            ['数量', (acc.quantity || '') + ' ' + (acc.unit || '')],
            ['企业名称', acc.enterprise],
            ['核算模型', linkedModel ? (linkedModel.code + ' — ' + linkedModel.name) : acc.accountingModel],
            ['系统边界', linkedModel ? ((SYSTEM_BOUNDARIES.find(b => b.value === linkedModel.boundary) || {}).label || linkedModel.boundary) : ''],
            ['数据统计时间段', (acc.periodStart || '') + ' ~ ' + (acc.periodEnd || '')],
            ['创建时间', acc.createTime],
            ['创建人', acc.creator],
            ['审核人', acc.reviewer],
            ['核算状态', reviewStatus]
        ];
        metaItems.forEach(([label, value]) => {
            const valueContent = (label === '核算状态' && reviewStatus === '待审核' && !viewMode)
                ? [el('span', {
                    style: 'color:#b45309;text-decoration:underline;cursor:pointer;',
                    onclick: () => {
                        const modal = el('div', { class: 'modal-mask' });
                        const dlg = el('div', { class: 'modal', style: 'width:380px;' });
                        dlg.appendChild(el('div', { class: 'modal-header' }, ['审核确认']));
                        dlg.appendChild(el('div', { class: 'modal-body' }, [
                            el('div', { style: 'margin-bottom:10px;color:#374151;' }, ['是否通过审核？']),
                            el('div', { style: 'color:#6b7280;font-size:13px;' }, ['通过后状态将变更为"已审核"，不可再修改核算数据。'])
                        ]));
                        dlg.appendChild(el('div', { class: 'modal-footer' }, [
                            el('button', { class: 'btn', onclick: () => document.body.removeChild(modal) }, ['取消']),
                            el('button', { class: 'btn btn-primary', onclick: () => {
                                acc.reviewStatus = '已审核';
                                saveTrainAccs();
                                document.body.removeChild(modal);
                                // 重新渲染当前页面
                                const pc = document.getElementById('page-container');
                                if (pc) { pc.innerHTML = ''; renderTrainAccountingDetail(pc, encodeURIComponent(acc.accId), viewMode); }
                            } }, ['通过审核'])
                        ]));
                        modal.appendChild(dlg);
                        modal.addEventListener('click', e => { if (e.target === modal) document.body.removeChild(modal); });
                        document.body.appendChild(modal);
                    }
                }, [reviewStatus])]
                : [value || '—'];
            metaGrid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, [label]),
                el('div', { class: 'value' }, valueContent)
            ]));
        });
        infoCard.appendChild(metaGrid);
        container.appendChild(infoCard);

        // ============ 核算参数（按阶段排放量录入，同碳排放核算页面布局） ============
        const isReviewed = acc.reviewStatus === '已审核';
        // 阶段输入：按 TRAIN_ACC_STAGES 生成（含独立计算的"光伏发电总上网量"阶段）
        const STAGE_INPUTS = TRAIN_ACC_STAGES.map(s => ({
            stageId: s.stageId,
            label: s.stageName + (s.independentCalc ? '' : '阶段温室气体排放量'),
            unit: s.resultUnit || 'tCO₂e',
            hasCalc: true,
            calcRoute: s.independentCalc ? 'train-grid-supply-calculation' : 'train-stage-calculation'
        }));

        const calcCard = el('div', { class: 'table-card', style: 'margin-top:16px;' });
        calcCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:4px;' }, ['核算参数']));
        if (!viewMode) {
            calcCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:14px;' }, [
                '按产品碳足迹量化方法的各阶段录入温室气体排放量，点击「计算」进入独立计算页面，从核算模型中选取数据行并录入参数后自动计算并回写。'
            ]));
        }

        const inputs = {};
        const formGrid = el('div', { class: 'accounting-stage-grid' });
        STAGE_INPUTS.forEach(s => {
            const input = el('input', {
                class: 'form-control',
                type: 'number',
                min: '0',
                step: '0.01',
                value: acc.stageEmissions[s.stageId] || '',
                placeholder: '请输入数值或点击右侧「' + (viewMode ? '查看数据' : '计算') + '」',
                oninput: () => {
                    errBox.style.display = 'none';
                    acc.stageCalcAuto[s.stageId] = false;
                }
            });
            input.readOnly = !!viewMode;
            inputs[s.stageId] = input;
            const isAuto = !!acc.stageCalcAuto[s.stageId];
            formGrid.appendChild(el('div', { class: 'form-group' }, [
                el('label', {}, [s.label]),
                el('div', { class: 'input-with-suffix' }, [
                    input,
                    el('span', { class: 'input-suffix' }, [s.unit])
                ]),
                el('div', { style: 'margin-top:6px;display:flex;gap:8px;align-items:center;' }, [
                    s.hasCalc ? el('button', {
                        class: 'btn',
                        style: 'font-size:12px;padding:4px 10px;',
                        onclick: () => {
                            // 新建产品入口 + 已审核 → 二次审核确认
                            if (!viewMode && isReviewed) {
                                const modal = el('div', { class: 'modal-mask' });
                                const dlg = el('div', { class: 'modal', style: 'width:420px;' });
                                dlg.appendChild(el('div', { class: 'modal-header' }, ['二次审核确认']));
                                dlg.appendChild(el('div', { class: 'modal-body' }, [
                                    el('div', { style: 'margin-bottom:10px;color:#374151;' }, ['该产品已审核，进入修改需要二次审核确认。']),
                                    el('div', { style: 'color:#6b7280;font-size:13px;' }, ['修改完成后请审核人重新审核。'])
                                ]));
                                dlg.appendChild(el('div', { class: 'modal-footer' }, [
                                    el('button', { class: 'btn', onclick: () => document.body.removeChild(modal) }, ['取消']),
                                    el('button', { class: 'btn btn-primary', onclick: () => {
                                        document.body.removeChild(modal);
                                        const path = s.calcRoute === 'train-grid-supply-calculation'
                                            ? '#/train-grid-supply-calculation/' + encodeURIComponent(acc.accId)
                                            : '#/train-stage-calculation/' + encodeURIComponent(acc.accId) + '/' + encodeURIComponent(s.stageId);
                                        navigate(path);
                                    } }, ['确认进入'])
                                ]));
                                modal.appendChild(dlg);
                                modal.addEventListener('click', e => { if (e.target === modal) document.body.removeChild(modal); });
                                document.body.appendChild(modal);
                                return;
                            }
                            const path = s.calcRoute === 'train-grid-supply-calculation'
                                ? '#/train-grid-supply-calculation/' + encodeURIComponent(acc.accId)
                                : '#/train-stage-calculation/' + encodeURIComponent(acc.accId) + '/' + encodeURIComponent(s.stageId);
                            navigate(path);
                        }
                    }, [viewMode ? '查看数据' : '计算']) : null,
                    (!viewMode && isAuto)
                        ? el('span', { class: 'form-tip', style: 'color:#0f766e;margin:0;' }, ['（已通过计算得出）'])
                        : null
                ])
            ]));
        });

        // 公式(1)光伏发电产品碳足迹额外参数：E_dps（总直供电量）、η（线损率）
        const CFP_INPUTS = [
            { key: 'directSupplyKwh', label: '光伏发电总直供电量 E_dps', unit: 'kW·h', step: '0.01' },
            { key: 'lineLossRate', label: '全国电网平均线损率 η', unit: '%', step: '0.01' }
        ];
        const cfpInputs = {};
        CFP_INPUTS.forEach(p => {
            const input = el('input', {
                class: 'form-control',
                type: 'number',
                min: '0',
                step: p.step,
                value: acc.cfpParams[p.key] == null ? '' : acc.cfpParams[p.key],
                placeholder: '请输入数值',
                oninput: () => { errBox.style.display = 'none'; }
            });
            input.readOnly = !!viewMode;
            cfpInputs[p.key] = input;
            formGrid.appendChild(el('div', { class: 'form-group' }, [
                el('label', {}, [p.label]),
                el('div', { class: 'input-with-suffix' }, [
                    input,
                    el('span', { class: 'input-suffix' }, [p.unit])
                ])
            ]));
        });

        const errBox = el('div', { class: 'form-tip', style: 'color:#dc2626;display:none;' });
        const actionRow = viewMode ? null : el('div', { style: 'display:flex;align-items:center;gap:12px;margin-top:8px;' }, [
            el('button', { class: 'btn btn-primary', onclick: saveParams }, ['保存参数']),
            el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['保存后可继续编辑，系统将按公式(1)计算光伏发电产品碳足迹。'])
        ]);

        calcCard.appendChild(formGrid);
        if (!viewMode) calcCard.appendChild(errBox);
        if (actionRow) calcCard.appendChild(actionRow);
        container.appendChild(calcCard);

        function saveParams() {
            const errors = [];
            STAGE_INPUTS.forEach(s => {
                const v = inputs[s.stageId].value.trim();
                if (v === '') { errors.push(s.label + ' 不能为空'); return; }
                const n = parseFloat(v);
                if (isNaN(n) || n < 0) errors.push(s.label + ' 需为非负数值');
            });
            CFP_INPUTS.forEach(p => {
                const v = cfpInputs[p.key].value.trim();
                if (v === '') { errors.push(p.label + ' 不能为空'); return; }
                const n = parseFloat(v);
                if (isNaN(n) || n < 0) {
                    errors.push(p.label + ' 需为非负数值');
                } else if (p.key === 'lineLossRate' && n >= 100) {
                    errors.push('全国电网平均线损率 η 需为小于 100 的百分数');
                }
            });
            if (errors.length) {
                errBox.textContent = errors.join('；');
                errBox.style.display = 'block';
                return;
            }
            errBox.style.display = 'none';
            STAGE_INPUTS.forEach(s => {
                acc.stageEmissions[s.stageId] = inputs[s.stageId].value.trim();
            });
            CFP_INPUTS.forEach(p => {
                acc.cfpParams[p.key] = cfpInputs[p.key].value.trim();
            });
            acc.status = '参数已录入';
            saveTrainAccs();
            // 同步基本信息中的状态
            const statusVals = infoCard.querySelectorAll('.result-item .value');
            if (statusVals.length >= 9) statusVals[8].textContent = acc.status;
            renderResult();
            openConfirmModal('保存成功', '核算参数已保存。', () => {});
        }

        // ============ 核算结果 ============
        const resultCard = el('div', { class: 'table-card', style: 'margin-top:16px;' });

        function renderResult() {
            resultCard.innerHTML = '';
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['核算结果']));

            const grid = el('div', { class: 'result-grid' });
            // 各阶段排放量（kgCO₂e）与总上网电量 E_oge（kWh）
            TRAIN_ACC_STAGES.forEach(stage => {
                const val = acc.stageEmissions[stage.stageId] || '';
                const num = parseFloat(val);
                // 光伏发电总上网量 E_oge 显示 kWh（公式(7)结果单位），作为公式(1)分母
                if (stage.independentCalc) {
                    grid.appendChild(el('div', { class: 'result-item' }, [
                        el('div', { class: 'label' }, [stage.stageName]),
                        el('div', { class: 'value', style: 'color:#0f766e;font-weight:600;' }, [(isNaN(num) ? '—' : num.toFixed(2)) + ' ' + (stage.resultUnit || 'kWh')])
                    ]));
                } else if (stage.resultUnit === 'kgCO₂e') {
                    // 前5阶段排放量单位 kgCO₂e
                    grid.appendChild(el('div', { class: 'result-item' }, [
                        el('div', { class: 'label' }, [stage.stageName]),
                        el('div', { class: 'value', style: 'color:#0f766e;font-weight:600;' }, [(isNaN(num) ? '—' : num.toFixed(2)) + ' kgCO₂e'])
                    ]));
                } else {
                    grid.appendChild(el('div', { class: 'result-item' }, [
                        el('div', { class: 'label' }, [stage.stageName]),
                        el('div', { class: 'value', style: 'color:#0f766e;font-weight:600;' }, [(isNaN(num) ? '—' : num.toFixed(4)) + ' tCO₂e'])
                    ]));
                }
            });

            // 公式(1)：CFP_pv = (Em_rs+Em_tr+Em_cs+Em_us)/((E_oge+E_dps)×(1-η)) + Em_td/(E_oge×(1-η))，单位 kgCO₂e/(kW·h)
            const cfpResult = computeTrainCfp(acc);
            const cfpText = cfpResult.value == null ? '—' : cfpResult.value.toFixed(6);
            grid.appendChild(el('div', { class: 'result-item result-item-wide', style: 'grid-column:1 / -1;' }, [
                el('div', { class: 'label', style: 'font-size:14px;font-weight:600;' }, ['光伏发电产品碳足迹 CFP_pv']),
                el('div', { class: 'value', style: 'font-size:20px;font-weight:700;color:#dc2626;' }, [cfpText + ' kgCO₂e/(kW·h)'])
            ]));
            resultCard.appendChild(grid);

            // ============ 排放分布图（生命周期各阶段碳足迹横向柱形图） ============
            const EMOJI_MAP = { 'raw-materials': '🏭', 'transport': '🚚', 'construction': '🏗️', 'production-retirement': '⚙️', 'transmission': '⚡' };
            const emissionStages = TRAIN_ACC_STAGES.filter(s => s.resultUnit === 'kgCO₂e');
            const stageData = emissionStages.map(s => {
                const v = parseFloat(acc.stageEmissions && acc.stageEmissions[s.stageId]);
                return { stageId: s.stageId, stageName: s.stageName, value: isNaN(v) || v < 0 ? 0 : v };
            });
            const totalEmission = stageData.reduce((s, d) => s + d.value, 0);
            const maxValue = Math.max(...stageData.map(d => d.value), 0.001);

            const chartWrap = el('div', { class: 'emission-chart' });
            chartWrap.appendChild(el('div', { class: 'emission-chart-title' }, [
                '生命周期各阶段碳足迹',
                el('span', { class: 'unit' }, ['（单位：kgCO₂e）'])
            ]));

            if (totalEmission > 0) {
                const chartBody = el('div', { class: 'emission-chart-body' });
                stageData.forEach(d => {
                    const row = el('div', { class: 'chart-row' });
                    row.appendChild(el('div', { class: 'chart-row-label' }, [
                        el('span', { class: 'icon' }, [EMOJI_MAP[d.stageId] || '•']),
                        el('span', {}, [d.stageName])
                    ]));
                    const pctOfMax = (d.value / maxValue) * 100;
                    const barWrap = el('div', { class: 'chart-row-bar-wrap' });
                    const bar = el('div', {
                        class: 'chart-row-bar' + (d.value === 0 ? ' zero' : ''),
                        style: 'width:' + pctOfMax + '%;'
                    });
                    const barLabel = el('span', {
                        class: 'chart-row-bar-label' + (pctOfMax < 12 ? ' outside' : '')
                    }, [d.value.toFixed(2)]);
                    bar.appendChild(barLabel);
                    barWrap.appendChild(bar);
                    row.appendChild(barWrap);
                    const pctOfTotal = totalEmission > 0 ? (d.value / totalEmission * 100) : 0;
                    row.appendChild(el('div', { class: 'chart-row-value' }, [
                        el('span', { class: 'num' }, [d.value.toFixed(2)]),
                        el('span', { class: 'unit' }, ['kgCO₂e']),
                        el('span', { class: 'pct' }, [pctOfTotal.toFixed(1) + '%'])
                    ]));
                    chartBody.appendChild(row);
                });
                chartWrap.appendChild(chartBody);
                chartWrap.appendChild(el('div', { class: 'chart-total' }, [
                    el('span', {}, ['5阶段合计']),
                    el('span', { class: 'total-num' }, [totalEmission.toFixed(2) + ' kgCO₂e'])
                ]));
            } else {
                chartWrap.appendChild(el('div', { class: 'chart-empty' }, [
                    '暂无排放数据，请先在各阶段录入或计算排放量。'
                ]));
            }
            resultCard.appendChild(chartWrap);

            resultCard.appendChild(el('div', { class: 'form-tip', style: 'margin-top:12px;color:#6b7280;' }, [
                '说明：光伏发电产品碳足迹按公式(1)计算：CFP_pv = (Em_rs+Em_tr+Em_cs+Em_us) ÷ [(E_oge+E_dps)×(1−η)] + Em_td ÷ [E_oge×(1−η)]，单位为 kgCO₂e/(kW·h)。其中 Em_rs、Em_tr、Em_cs、Em_us、Em_td 为前5阶段温室气体排放量（kgCO₂e）；E_oge 为光伏发电生命周期总上网电量（kW·h，按公式(7)计算）；E_dps 为光伏发电总直供电量（kW·h）；η 为全国电网平均线损率（%）。计算直供电产品碳足迹时，η 取 0、Em_td 取 0。'
            ]));

            // 非 viewMode 时显示确认按钮
            if (!viewMode) {
                resultCard.appendChild(el('div', { style: 'margin-top:16px;display:flex;justify-content:flex-end;' }, [
                    el('button', {
                        class: 'btn btn-primary',
                        onclick: () => {
                            // 保存各阶段排放量
                            STAGE_INPUTS.forEach(s => {
                                acc.stageEmissions[s.stageId] = inputs[s.stageId].value.trim();
                            });
                            // 保存公式(1)参数 E_dps、η
                            CFP_INPUTS.forEach(p => {
                                acc.cfpParams[p.key] = cfpInputs[p.key].value.trim();
                            });
                            acc.status = '参数已录入';
                            if (acc.reviewStatus !== '已审核') acc.reviewStatus = '待审核';
                            saveTrainAccs();
                            openConfirmModal('确认成功', '核算数据已确认并提交，等待审核人审核。', () => {
                                const pc = document.getElementById('page-container');
                                if (pc) { pc.innerHTML = ''; renderTrainAccountingDetail(pc, encodeURIComponent(acc.accId), viewMode); }
                            });
                        }
                    }, ['确认'])
                ]));
            }
        }

        container.appendChild(resultCard);
        renderResult();
    }

    /* ============ 产品碳足迹核算-实训 阶段计算独立页（前5阶段） ============ */
    // 类似 renderStageCalculation，但使用 trainAccs 和 trainModels 数据
    function renderTrainStageCalculation(container, param) {
        const parts = (param || '').split('/');
        const accId = parts[0] ? decodeURIComponent(parts[0]) : '';
        const stageId = parts[1] ? decodeURIComponent(parts[1]) : '';
        const acc = trainAccs.find(a => a.accId === accId);
        if (!acc || !stageId) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['参数无效，未找到对应核算记录或阶段']));
            return;
        }
        normalizeTrainAcc(acc);

        // 只读条件：从产品列表入口（viewMode）进入，且已审核
        const detailMode = (function(){ try { return sessionStorage.getItem('trainDetailMode'); } catch(e) { return null; } })();
        const isReviewed = acc.reviewStatus === '已审核' && detailMode === 'view';

        const stage = TRAIN_ACC_STAGES.find(s => s.stageId === stageId);
        if (!stage) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的阶段定义']));
            return;
        }

        // 找到对应的模型
        const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
        if (!linkedModel || !linkedModel.stages) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的核算模型']));
            return;
        }
        const modelStage = linkedModel.stages.find(s => s.stageId === stageId);
        if (!modelStage) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['核算模型中该阶段暂无数据']));
            return;
        }

        // 已选取的数据行（acc.stageData[stageId]），由用户通过「选取」按钮从模型中选取
        const calcRows = acc.stageData[stageId] || [];

        // 同步已选取数据行：通过 rowId 匹配模型数据行，更新模型中变更的字段（dataName, specModel 等）
        function syncSelectedRows() {
            const modelRowsById = {};
            const modelRowsByKey = {};
            (modelStage.categories || []).forEach(cat => {
                (cat.rows || []).forEach(mr => {
                    if (mr.rowId) modelRowsById[mr.rowId] = mr;
                    modelRowsByKey[(mr.dataName || '') + '|' + (mr.specModel || '')] = mr;
                });
            });
            let changed = false;
            calcRows.forEach(r => {
                let mr = null;
                if (r.rowId && modelRowsById[r.rowId]) {
                    // 通过 rowId 匹配（首选）
                    mr = modelRowsById[r.rowId];
                } else if (!r.rowId) {
                    // 回退：通过 dataName+specModel 匹配，并复制 rowId
                    const key = (r.dataName || '') + '|' + (r.specModel || '');
                    if (modelRowsByKey[key]) {
                        mr = modelRowsByKey[key];
                        r.rowId = mr.rowId || '';
                        changed = true;
                    }
                }
                if (mr) {
                    // 同步模型字段（保留用户录入的数量/重量/距离和 emission）
                    ['dataName', 'specModel', 'manufacturer', 'emissionCoefficient', 'functionalUnit'].forEach(f => {
                        if (r[f] !== (mr[f] || '')) { r[f] = mr[f] || ''; changed = true; }
                    });
                    // 重新计算 emission
                    const ef = parseFloat(r.emissionCoefficient);
                    let newEmission = '';
                    if (stage.qtyMode === 'weight-distance') {
                        const w = parseFloat(r.weight), d = parseFloat(r.distance);
                        if (!isNaN(w) && !isNaN(d) && !isNaN(ef)) newEmission = (w * ef * d).toFixed(2);
                    } else {
                        const qty = parseFloat(r.quantity);
                        if (!isNaN(qty) && !isNaN(ef)) newEmission = (qty * ef).toFixed(2);
                    }
                    if (r.emission !== newEmission) { r.emission = newEmission; changed = true; }
                }
            });
            if (changed) saveTrainAccs();
        }
        syncSelectedRows();

        // 行匹配键：优先用 rowId，兼容旧数据用 dataName+specModel
        function getRowKey(r) {
            return r.rowId || ((r.dataName || '') + '|' + (r.specModel || ''));
        }

        // 运输阶段：Em_tr = 运输重量 AD(t) × 碳足迹因子 EF[kgCO₂e/(t·km)] × 运输距离 D(km)；其余阶段：数量 AD × 因子 EF
        const isWeightDistance = stage.qtyMode === 'weight-distance';
        function calcRowEmissionNum(r) {
            const ef = parseFloat(r.emissionCoefficient);
            if (isWeightDistance) {
                const w = parseFloat(r.weight);
                const d = parseFloat(r.distance);
                if (!isNaN(w) && !isNaN(d) && !isNaN(ef)) return w * ef * d;
                return null;
            }
            const qty = parseFloat(r.quantity);
            if (!isNaN(qty) && !isNaN(ef)) return qty * ef;
            return null;
        }
        function formatRowEmission(r) {
            const v = calcRowEmissionNum(r);
            return v == null ? '' : v.toFixed(2);
        }

        // 面包屑 + 返回
        container.appendChild(el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-accounting-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: (detailMode === 'view' ? '#/train-accounting-view/' : '#/train-accounting-detail/') + encodeURIComponent(acc.accId), style: 'color:#0f766e;text-decoration:none;' }, [detailMode === 'view' ? '查看碳足迹' : '碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    stage.stageName + (detailMode === 'view' ? '数据查看' : '计算')
                ]),
                el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
                    el('span', { style: 'cursor:pointer;color:#0f766e;font-size:13px;', onclick: () => navigate((detailMode === 'view' ? '#/train-accounting-view/' : '#/train-accounting-detail/') + encodeURIComponent(acc.accId)) }, ['← 返回' + (detailMode === 'view' ? '查看碳足迹' : '碳足迹核算')]),
                    el('span', { class: 'page-title' }, [stage.stageName + (detailMode === 'view' ? ' 数据查看' : ' 温室气体排放量计算') + ' — ' + acc.productName])
                ])
            ])
        ]));

        // 公式说明
        const formulaCard = el('div', { class: 'table-card' });
        formulaCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:8px;' }, ['计算方法']));
        formulaCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:6px;background:#f0fdf4;padding:8px 12px;border-radius:6px;' }, ['公式：' + stage.formula]));
        // 公式符号（如 Em_rs / Em_tr / Em_cs），取自阶段公式等号左侧
        const emSymbol = (stage.formula || '').split('=')[0].trim();
        formulaCard.appendChild(el('div', { class: 'form-tip' }, [
            (stage.resultUnit === 'kgCO₂e'
                ? (isWeightDistance
                    ? '每行排放量 = 运输重量 ADⱼ(t) × 碳足迹因子 EFⱼ[kgCO₂e/(t·km)] × 运输距离 Dⱼ(km)（kgCO₂e），阶段总排放量 Em_tr = Σ各行排放量（kgCO₂e）。'
                    : '每行排放量 = 活动数据 AD × 碳足迹因子 EF（kgCO₂e），阶段总排放量 ' + emSymbol + ' = Σ各行排放量（kgCO₂e）。'
                        + (stage.stageId === 'transmission'
                            ? '输配电阶段为简化公式 Em_td = CFP_td × E_oge（检修和退役设备六氟化硫排放数据获取困难时适用）：各行输配电电量 E_oge（上网电量、自供电量，单位 kW·h）均乘以全国输配电碳足迹因子 CFP_td（不含线损，单位 kgCO₂e/(kW·h)，取值见附录A 表A.6），各行求和即 CFP_td × 总输配电电量；计算直供电产品碳足迹时 CFP_td 取 0。'
                            : ((stage.stageId === 'construction' || stage.stageId === 'production-retirement')
                                ? stage.stageName + '阶段 AD 为能源消耗量：汽油、柴油单位为 t，燃气为 m³，电力为 kW·h；EF 对应单位分别为 kgCO₂e/t、kgCO₂e/m³、kgCO₂e/(kW·h)。'
                                : '')))
                : '每行排放量 = 数量 × 碳足迹因子（kgCO₂e），阶段总排放量 = Σ各行排放量 ÷ 1000（tCO₂e）。')
            + '数据行引用自核算模型「' + (linkedModel.code || '') + ' — ' + (linkedModel.name || '') + '」，如需增删请前往模型定义页面。'
        ]));
        container.appendChild(formulaCard);

        // 两栏布局：左侧大类列表，右侧数据表
        const layout = el('div', { class: 'model-def-layout' });
        const catList = el('div', { class: 'stage-list' });
        const catPanel = el('div', { class: 'stage-data' });
        layout.appendChild(catList);
        layout.appendChild(catPanel);
        container.appendChild(layout);

        // 按大类分组（模型中的所有大类，用于左侧导航和右侧选取）
        const catGroups = (modelStage.categories || []).map(cat => ({
            catName: cat.categoryName,
            modelRows: cat.rows || []
        }));

        let currentCatIdx = 0;

        function refresh() {
            renderCatList();
            renderCatPanel();
            renderResult();
        }

        function renderCatList() {
            catList.innerHTML = '';
            catList.appendChild(el('div', { class: 'stage-list-header' }, ['大类']));
            catGroups.forEach((cat, idx) => {
                const isActive = idx === currentCatIdx;
                const item = el('div', { class: 'stage-item' + (isActive ? ' active' : '') });
                item.appendChild(el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, [cat.catName || '（未命名）']));
                item.addEventListener('click', () => { currentCatIdx = idx; refresh(); });
                catList.appendChild(item);
            });
        }

        function renderCatPanel() {
            catPanel.innerHTML = '';
            const cat = catGroups[currentCatIdx];
            if (!cat) {
                catPanel.appendChild(el('div', { class: 'empty' }, ['该大类暂无数据']));
                return;
            }

            const block = el('div', { class: 'category-block' });
            block.appendChild(el('div', { class: 'category-header' }, [
                el('div', { class: 'category-title' }, [cat.catName || '（未命名）'])
            ]));

            const body = el('div', { class: 'category-body' });

            // 该大类下已选取的数据行（通过 rowId 或 dataName+specModel 匹配）
            const selectedInCat = calcRows.filter(r =>
                (cat.modelRows || []).some(mr => getRowKey(r) === getRowKey(mr))
            );
            // 该大类下可选取的模型数据行（未被选取的）
            const availableInCat = (cat.modelRows || []).filter(mr =>
                !calcRows.some(r => getRowKey(r) === getRowKey(mr))
            );

            // —— 已选取数据行表格 ——
            const selectedCard = el('div', { class: 'table-card' });
            selectedCard.appendChild(el('div', { style: 'font-weight:600;font-size:13px;color:#374151;margin-bottom:8px;' }, ['已选取数据行（' + selectedInCat.length + '）']));
            if (!selectedInCat.length) {
                selectedCard.appendChild(el('div', { class: 'empty', style: 'padding:12px;' }, ['暂无已选取数据行，请从下方选取']));
            } else {
                const table = el('table', { class: 'data-table calc-table' });
                const thead = el('thead');
                const trh = el('tr');
                (isWeightDistance
                    ? ['数据名称', '规格型号', '生产厂家', '碳足迹因子', '因子单位', '运输重量(t)', '运输距离(km)', '排放量(kgCO₂e)', '操作']
                    : ['数据名称', '规格型号', '生产厂家', '碳足迹因子', '功能单位', '数量', '排放量(kgCO₂e)', '操作']
                ).forEach(t => trh.appendChild(el('th', {}, [t])));
                thead.appendChild(trh);
                table.appendChild(thead);

                const tbody = el('tbody');
                selectedInCat.forEach(r => {
                    const tr = el('tr');
                    tr.appendChild(el('td', {}, [r.dataName || '']));
                    tr.appendChild(el('td', {}, [r.specModel || '']));
                    tr.appendChild(el('td', {}, [r.manufacturer || '']));
                    tr.appendChild(el('td', {}, [r.emissionCoefficient || '']));
                    tr.appendChild(el('td', {}, [r.functionalUnit || '']));

                    // 录入单元格：运输阶段为 运输重量 + 运输距离；其余阶段为单一数量
                    const refreshRowEmission = () => {
                        r.emission = formatRowEmission(r);
                        const emCell = tr.querySelector('.em-cell');
                        if (emCell) emCell.textContent = r.emission || '—';
                        saveTrainAccs();
                        renderResult();
                    };
                    if (isWeightDistance) {
                        const weightInput = el('input', {
                            class: 'form-control', type: 'number', min: '0', step: '0.0001',
                            value: r.weight || '', placeholder: '0', style: 'width:90px;',
                            oninput: () => { if (isReviewed) return; r.weight = weightInput.value.trim(); refreshRowEmission(); }
                        });
                        weightInput.readOnly = isReviewed;
                        const distanceInput = el('input', {
                            class: 'form-control', type: 'number', min: '0', step: '0.0001',
                            value: r.distance || '', placeholder: '0', style: 'width:90px;',
                            oninput: () => { if (isReviewed) return; r.distance = distanceInput.value.trim(); refreshRowEmission(); }
                        });
                        distanceInput.readOnly = isReviewed;
                        tr.appendChild(el('td', {}, [weightInput]));
                        tr.appendChild(el('td', {}, [distanceInput]));
                    } else {
                        const qtyInput = el('input', {
                            class: 'form-control', type: 'number', min: '0', step: '0.0001',
                            value: r.quantity || '', placeholder: '0', style: 'width:100px;',
                            oninput: () => {
                                if (isReviewed) return;
                                r.quantity = qtyInput.value.trim();
                                refreshRowEmission();
                            }
                        });
                        qtyInput.readOnly = isReviewed;
                        tr.appendChild(el('td', {}, [qtyInput]));
                    }
                    const emCell = el('td', { class: 'em-cell', style: 'font-weight:600;color:#0f766e;' }, [
                        formatRowEmission(r) || '—'
                    ]);
                    tr.appendChild(emCell);
                    tr.appendChild(el('td', {}, isReviewed ? ['—'] : [
                        el('button', {
                            class: 'btn-link', style: 'color:#dc2626;font-size:12px;',
                            onclick: () => {
                                const idx = calcRows.indexOf(r);
                                if (idx >= 0) {
                                    calcRows.splice(idx, 1);
                                    saveTrainAccs();
                                    renderCatPanel();
                                    renderResult();
                                }
                            }
                        }, ['移除'])
                    ]));
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                selectedCard.appendChild(table);
            }
            body.appendChild(selectedCard);

            // —— 可选取数据行列表（只读模式下隐藏） ——
            if (!isReviewed) {
            const availCard = el('div', { class: 'table-card', style: 'margin-top:12px;' });
            availCard.appendChild(el('div', { style: 'font-weight:600;font-size:13px;color:#374151;margin-bottom:8px;' }, ['从模型中选取数据行（' + availableInCat.length + '）']));
            if (!availableInCat.length) {
                availCard.appendChild(el('div', { class: 'empty', style: 'padding:12px;' }, ['该大类数据已全部选取']));
            } else {
                const availTable = el('table', { class: 'data-table' });
                const aThead = el('thead');
                const aTrh = el('tr');
                ['数据名称', '规格型号', '生产厂家', '碳足迹因子', '功能单位', '操作'].forEach(t => aTrh.appendChild(el('th', {}, [t])));
                aThead.appendChild(aTrh);
                availTable.appendChild(aThead);

                const aTbody = el('tbody');
                availableInCat.forEach(mr => {
                    const tr = el('tr');
                    tr.appendChild(el('td', {}, [mr.dataName || '']));
                    tr.appendChild(el('td', {}, [mr.specModel || '']));
                    tr.appendChild(el('td', {}, [mr.manufacturer || '']));
                    tr.appendChild(el('td', {}, [mr.emissionCoefficient || '']));
                    tr.appendChild(el('td', {}, [mr.functionalUnit || '']));
                    tr.appendChild(el('td', {}, [
                        el('button', {
                            class: 'btn btn-sm',
                            style: 'font-size:12px;padding:2px 10px;',
                            onclick: () => {
                                const newRow = {
                                    rowId: mr.rowId || '',
                                    dataName: mr.dataName || '',
                                    specModel: mr.specModel || '',
                                    manufacturer: mr.manufacturer || '',
                                    emissionCoefficient: mr.emissionCoefficient || '',
                                    functionalUnit: mr.functionalUnit || '',
                                    quantity: '',
                                    emission: ''
                                };
                                if (isWeightDistance) { newRow.weight = ''; newRow.distance = ''; }
                                calcRows.push(newRow);
                                saveTrainAccs();
                                renderCatPanel();
                                renderResult();
                            }
                        }, ['+ 选取'])
                    ]));
                    aTbody.appendChild(tr);
                });
                availTable.appendChild(aTbody);
                availCard.appendChild(availTable);
            }
            body.appendChild(availCard);
            } // end if (!isReviewed)

            block.appendChild(body);
            catPanel.appendChild(block);
        }

        function computeStageTotalKg() {
            let total = 0;
            calcRows.forEach(r => {
                const v = calcRowEmissionNum(r);
                if (v != null) total += v;
            });
            return total;
        }

        function countValidRows() {
            let n = 0;
            calcRows.forEach(r => { if (calcRowEmissionNum(r) != null) n++; });
            return n;
        }

        // 阶段结果单位：原材料、运输阶段按公式直接为 kgCO₂e；其余阶段换算为 tCO₂e
        const stageResultUnit = stage.resultUnit || 'tCO₂e';
        const isKgStage = stageResultUnit === 'kgCO₂e';

        function renderResult() {
            const existing = container.querySelector('.stage-calc-result');
            if (existing) existing.remove();

            const totalKg = computeStageTotalKg();
            const totalValue = isKgStage ? totalKg : totalKg / 1000;

            const resultCard = el('div', { class: 'table-card stage-calc-result' });
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['阶段排放量汇总']));
            const grid = el('div', { class: 'result-grid' });
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['阶段内有效数据行']),
                el('div', { class: 'value' }, [countValidRows() + ' / ' + calcRows.length])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['阶段总排放量']),
                el('div', { class: 'value result-main' }, [totalValue.toFixed(isKgStage ? 2 : 4) + ' ' + stageResultUnit])
            ]));
            resultCard.appendChild(grid);
            if (!isReviewed) {
                resultCard.appendChild(el('div', { style: 'margin-top:12px;display:flex;gap:12px;' }, [
                    el('button', {
                        class: 'btn btn-primary',
                        onclick: () => {
                            acc.stageEmissions[stageId] = totalValue.toFixed(isKgStage ? 2 : 4);
                            acc.stageCalcAuto[stageId] = true;
                            acc.status = '参数已录入';
                            // 已审核状态下重新计算，状态回退为待审核
                            if (acc.reviewStatus === '已审核') acc.reviewStatus = '待审核';
                            saveTrainAccs();
                            const backRoute = detailMode === 'view' ? 'train-accounting-view' : 'train-accounting-detail';
                            navigate('#/' + backRoute + '/' + encodeURIComponent(acc.accId));
                        }
                    }, ['确认计算并回写']),
                    el('span', { class: 'form-tip', style: 'color:#6b7280;' }, ['保存后将自动填入「' + stage.stageName + '」的排放量输入框。'])
                ]));
            } else {
                resultCard.appendChild(el('div', { class: 'form-tip', style: 'margin-top:12px;color:#6b7280;' }, ['该产品已审核，数据为只读模式，不可修改。']));
            }
            container.appendChild(resultCard);
        }

        refresh();
    }

    /* ============ 产品碳足迹核算-实训 光伏发电总上网电量独立计算页 ============ */
    // E_oge = Σ E_D + W × H × PR × Σ_{t=1}^{RSL}(1-deg)^t
    function renderTrainGridSupplyCalculation(container, param) {
        const accId = (param || '').split('/')[0] ? decodeURIComponent((param || '').split('/')[0]) : '';
        const acc = trainAccs.find(a => a.accId === accId);
        if (!acc) {
            container.appendChild(el('div', { class: 'placeholder-card' }, ['参数无效，未找到对应核算记录']));
            return;
        }
        normalizeTrainAcc(acc);
        const detailMode = (function(){ try { return sessionStorage.getItem('trainDetailMode'); } catch(e) { return null; } })();
        const isReviewed = acc.reviewStatus === '已审核' && detailMode === 'view';
        const params = acc.gridSupplyParams;
        const history = acc.gridSupplyHistory;

        // 衰减级数 Σ_{t=1}^{RSL} (1-deg/100)^t
        function degradationSum() {
            const rsl = Math.max(0, Math.floor(parseFloat(params.rsl) || 0));
            const deg = Math.max(0, parseFloat(params.deg) || 0) / 100;
            if (rsl <= 0) return 0;
            if (deg <= 0) return rsl;
            const r = 1 - deg;
            // Σ_{t=1}^{RSL} r^t = r*(1-r^RSL)/(1-r)
            return r * (1 - Math.pow(r, rsl)) / (1 - r);
        }

        function computeED() {
            let sum = 0;
            history.forEach(h => {
                const v = parseFloat(h.amount);
                if (!isNaN(v)) sum += v;
            });
            return sum;
        }

        function computeTotalKwh() {
            const W = parseFloat(params.capacity) || 0;
            const H = parseFloat(params.hours) || 0;
            const PR = (parseFloat(params.pr) || 0) / 100;
            const future = W * H * PR * degradationSum();
            return computeED() + future;
        }

        // 面包屑 + 返回
        container.appendChild(el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/product-carbon-accounting-train', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: (detailMode === 'view' ? '#/train-accounting-view/' : '#/train-accounting-detail/') + encodeURIComponent(acc.accId), style: 'color:#0f766e;text-decoration:none;' }, [detailMode === 'view' ? '查看碳足迹' : '碳足迹核算']),
                    el('span', { class: 'sep' }, ['/']),
                    detailMode === 'view' ? '光伏发电总上网电量数据查看' : '光伏发电总上网电量计算'
                ]),
                el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
                    el('span', { class: 'back', style: 'cursor:pointer;color:#0f766e;font-size:13px;', onclick: () => navigate((detailMode === 'view' ? '#/train-accounting-view/' : '#/train-accounting-detail/') + encodeURIComponent(acc.accId)) }, ['← 返回' + (detailMode === 'view' ? '查看碳足迹' : '碳足迹核算')]),
                    el('span', { class: 'page-title' }, [(detailMode === 'view' ? '光伏发电总上网电量数据查看' : '光伏发电总上网电量计算') + ' — ' + acc.productName])
                ])
            ])
        ]));

        // 公式说明
        const formulaCard = el('div', { class: 'table-card' });
        formulaCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:8px;' }, ['计算方法']));
        formulaCard.appendChild(el('div', { class: 'form-tip', style: 'margin-bottom:6px;' }, ['公式：E_oge = Σ E_D + W × H × PR × Σ_{t=1}^{RSL}(1-deg)^t']));
        formulaCard.appendChild(el('div', { class: 'form-tip' }, ['其中 E_D 为实际年度上网电量（kW·h），W 为装机容量（kW），H 为满负荷运行小时数（h），PR 为系统能效（%，录入百分数数值），RSL 为运行年限（a），t 为估算年（a，取值为实际发生年下一年至设计运行年末，即 t=1…RSL），deg 为系统衰减率（%，录入百分数数值）。总上网电量 = 历史实际上网电量合计 ΣE_D + W×H×PR×Σ(1-deg)^t，结果单位为 kW·h（另折算万 kW·h 展示）。计算方法见 GB 50797—2012 中 6.6。']));
        container.appendChild(formulaCard);

        // 参数卡
        const paramCard = el('div', { class: 'table-card' });
        paramCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['计算参数']));
        const paramGrid = el('div', { class: 'accounting-stage-grid' });
        [
            { key: 'capacity', label: '装机容量 W(kW)', step: '0.01' },
            { key: 'hours', label: '满负荷运行小时数 H(h)', step: '1' },
            { key: 'pr', label: '系统能效 PR(%)', step: '0.1' },
            { key: 'rsl', label: '运行年限 RSL(a)', step: '1' },
            { key: 'deg', label: '系统衰减率 deg(%)', step: '0.01' }
        ].forEach(p => {
            const inp = el('input', {
                class: 'form-control',
                type: 'number',
                min: '0',
                step: p.step,
                value: params[p.key] == null ? '' : params[p.key],
                oninput: () => {
                    if (isReviewed) return;
                    params[p.key] = inp.value.trim();
                    saveTrainAccs();
                    renderResult();
                }
            });
            inp.readOnly = isReviewed;
            paramGrid.appendChild(el('div', { class: 'form-group' }, [
                el('label', {}, [p.label]),
                inp
            ]));
        });
        paramCard.appendChild(paramGrid);
        container.appendChild(paramCard);

        // 历史上网电量表
        const historyCard = el('div', { class: 'table-card' });
        historyCard.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' }, [
            el('div', { style: 'font-weight:600;font-size:14px;color:#111827;' }, ['历史年度上网电量 E_D']),
            isReviewed ? null : el('button', {
                class: 'btn',
                style: 'font-size:12px;padding:4px 10px;',
                onclick: () => {
                    const nextYear = history.length
                        ? Math.max.apply(null, history.map(h => parseInt(h.year) || 0)) + 1
                        : new Date().getFullYear();
                    history.push({ year: String(nextYear), amount: '' });
                    saveTrainAccs();
                    renderHistory();
                    renderResult();
                }
            }, ['+ 新增年度'])
        ]));

        const historyTableWrap = el('div');
        historyCard.appendChild(historyTableWrap);
        container.appendChild(historyCard);

        function renderHistory() {
            historyTableWrap.innerHTML = '';
            if (!history.length) {
                historyTableWrap.appendChild(el('div', { class: 'empty' }, ['暂无历史上网电量数据，可点击「新增年度」录入。']));
                return;
            }
            const table = el('table', { class: 'data-table' });
            const thead = el('thead');
            const trh = el('tr');
            ['年份', '上网电量 E_D(kW·h)', '操作'].forEach(t => trh.appendChild(el('th', {}, [t])));
            thead.appendChild(trh);
            table.appendChild(thead);

            const tbody = el('tbody');
            history.forEach((h, idx) => {
                const tr = el('tr');
                const yearInput = el('input', {
                    class: 'form-control',
                    type: 'number',
                    value: h.year || '',
                    placeholder: '2024',
                    style: 'width:100px;',
                    oninput: () => { if (isReviewed) return; h.year = yearInput.value.trim(); saveTrainAccs(); }
                });
                yearInput.readOnly = isReviewed;
                const amtInput = el('input', {
                    class: 'form-control',
                    type: 'number',
                    min: '0',
                    step: '1',
                    value: h.amount || '',
                    placeholder: '0',
                    style: 'width:160px;',
                    oninput: () => { if (isReviewed) return; h.amount = amtInput.value.trim(); saveTrainAccs(); renderResult(); }
                });
                amtInput.readOnly = isReviewed;
                tr.appendChild(el('td', {}, [yearInput]));
                tr.appendChild(el('td', {}, [amtInput]));
                tr.appendChild(el('td', {}, isReviewed ? ['—'] : [
                    el('button', {
                        class: 'btn',
                        style: 'font-size:12px;padding:2px 10px;color:#dc2626;',
                        onclick: () => {
                            history.splice(idx, 1);
                            saveTrainAccs();
                            renderHistory();
                            renderResult();
                        }
                    }, ['删除'])
                ]));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            historyTableWrap.appendChild(table);
        }

        // 汇总结果卡
        let resultCard = null;
        function renderResult() {
            if (resultCard) resultCard.remove();
            const sumED = computeED();
            const W = parseFloat(params.capacity) || 0;
            const H = parseFloat(params.hours) || 0;
            const PR = (parseFloat(params.pr) || 0) / 100;
            const degSum = degradationSum();
            const future = W * H * PR * degSum;
            const totalKwh = sumED + future;
            const totalWanKwh = totalKwh / 10000;

            resultCard = el('div', { class: 'table-card' });
            resultCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['总上网电量汇总']));
            const grid = el('div', { class: 'result-grid' });
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['历史上网电量 ΣE_D']),
                el('div', { class: 'value' }, [sumED.toFixed(2) + ' kW·h'])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['估算年限内上网电量']),
                el('div', { class: 'value' }, [future.toFixed(2) + ' kW·h'])
            ]));
            grid.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, ['衰减级数 Σ(1-deg)^t']),
                el('div', { class: 'value' }, [degSum.toFixed(4)])
            ]));
            grid.appendChild(el('div', { class: 'result-item result-item-wide' }, [
                el('div', { class: 'label' }, ['光伏发电总上网电量 E_oge']),
                el('div', { class: 'value', style: 'color:#0f766e;font-weight:600;' }, [totalKwh.toFixed(2) + ' kW·h ＝ ' + totalWanKwh.toFixed(4) + ' 万 kW·h'])
            ]));
            resultCard.appendChild(grid);

            if (!isReviewed) {
                resultCard.appendChild(el('div', { style: 'display:flex;justify-content:flex-end;margin-top:16px;' }, [
                    el('button', {
                        class: 'btn btn-primary',
                        onclick: () => {
                            // 回写到 acc.stageData['grid-supply']，结果单位为 kWh
                            acc.stageData['grid-supply'] = [{
                                dataName: '光伏发电总上网电量',
                                specModel: '—',
                                manufacturer: '—',
                                emissionCoefficient: '1',
                                functionalUnit: 'kWh',
                                quantity: totalKwh.toFixed(2),
                                emission: totalKwh.toFixed(2)
                            }];
                            // 回写阶段排放量和自动计算标记
                            acc.stageEmissions['grid-supply'] = totalKwh.toFixed(2);
                            acc.stageCalcAuto['grid-supply'] = true;
                            acc.status = '参数已录入';
                            // 已审核状态下重新计算，状态回退为待审核
                            if (acc.reviewStatus === '已审核') acc.reviewStatus = '待审核';
                            saveTrainAccs();
                            // 根据进入模式导航回正确的详情页
                            const backRoute = detailMode === 'view' ? 'train-accounting-view' : 'train-accounting-detail';
                            navigate('#/' + backRoute + '/' + encodeURIComponent(acc.accId));
                        }
                    }, ['确认计算并回写'])
                ]));
            } else {
                resultCard.appendChild(el('div', { class: 'form-tip', style: 'margin-top:12px;color:#6b7280;' }, ['该产品已审核，数据为只读模式，不可修改。']));
            }
            container.appendChild(resultCard);
        }

        renderHistory();
        renderResult();
    }

    /* ============ 产品碳足迹 碳足迹报告 ============ */
    // v2：新版 GB/T 24067—2024 六章节模版，旧 v1 数据 normalize 不出来 → 强制迁移
    const TRAIN_REPORT_STORAGE_KEY = 'cmp:carbon-report-train:v2';

    // 前5个排放阶段（清单表1、汇总表2、封面说明共用）
    const REPORT_EMISSION_STAGES = [
        { stageId: 'raw-materials', cn: '原材料及生产设备获取', short: '原材料及生产设备获取阶段' },
        { stageId: 'transport', cn: '运输', short: '运输阶段' },
        { stageId: 'construction', cn: '设施建设', short: '设施建设阶段' },
        { stageId: 'production-retirement', cn: '生产及退役', short: '生产及退役阶段' },
        { stageId: 'transmission', cn: '输配电', short: '输配电阶段' }
    ];
    const REPORT_SYS_BOUNDARY_CHECKS = [
        { key: 'raw-materials', label: '原材料及生产设备获取阶段' },
        { key: 'transport', label: '运输阶段' },
        { key: 'construction', label: '设施建设阶段' },
        { key: 'production-retirement', label: '生产及退役阶段' },
        { key: 'transmission', label: '输配电阶段' }
    ];

    // 产品基本信息（自动带入核算 acc）
    const REPORT_PRODUCT_FIELDS = [
        { key: 'productName', label: '产品名称', fromAcc: 'productName' },
        { key: 'specModel', label: '产品规格型号', fromAcc: 'specModel' }
    ];
    // 封面 + 报告基本信息（可编辑）
    const REPORT_BASIC_FIELDS = [
        { key: 'enterpriseOrg', label: '生产者名称 / 出具报告机构' },
        { key: 'reportNo', label: '报告编号' },
        { key: 'reportDate', label: '报告日期' }
    ];

    // 报告预置模版（编辑表单 / 预览 / Word、PDF 导出共用同一结构）
    // kind 说明：
    //   'cover'     封面占位符，buildReportDocNode 会先渲染封面再渲染各章节
    //   'text'      普通文本（content[field]）
    //   'inv:<id>'  预留，当前不使用
    //   'checkboxes' 系统边界勾选（content.sysBoundaryChecks[item.key]）
    //   'table1'    清单结果表（生命周期各阶段 活动数据 / 碳足迹因子 / 温室气体量）
    //   'table2'    汇总表（各阶段排放量 tCO₂e、CFP_pv kgCO₂e/(kW·h)、百分比）
    const REPORT_TEMPLATE = [
        { kind: 'cover' },
        {
            kind: 'group', title: '一、概况', children: [
                {
                    kind: 'group', title: '1. 生产单位信息', children: [
                        { kind: 'kv', label: '生产单位名称', field: 'prodUnitName' },
                        { kind: 'kv', label: '地址', field: 'prodAddress' },
                        { kind: 'kv', label: '法定代表人', field: 'prodLegalRep' },
                        { kind: 'kv', label: '授权人(联系人)', field: 'prodContact' },
                        { kind: 'kv', label: '联系电话', field: 'prodPhone' },
                        { kind: 'kv', label: '装机容量(MW)', field: 'prodCapacityMW' }
                    ]
                },
                {
                    kind: 'group', title: '2. 产品信息', children: [
                        { kind: 'kv', label: '产品名称', field: 'productName' },
                        { kind: 'kv', label: '产品规格型号', field: 'specModel' }
                    ]
                },
                {
                    kind: 'group', title: '3. 设备信息', children: [
                        { kind: 'kv', label: '额定功率(MW)', field: 'ratedPowerMW' },
                        { kind: 'kv', label: '光伏组件型号', field: 'pvModuleModel' },
                        { kind: 'kv', label: '逆变器型号', field: 'inverterModel' },
                        { kind: 'kv', label: '变压器型号', field: 'transformerModel' }
                    ]
                },
                {
                    kind: 'group', title: '4. 量化方法', children: [
                        { kind: 'kv', label: '依据标准', field: 'basisStandard', rows: 2 }
                    ]
                }
            ]
        },
        {
            kind: 'group', title: '二、量化目的', children: [
                { kind: 'text', field: 'purpose', rows: 4 }
            ]
        },
        {
            kind: 'group', title: '三、量化范围', children: [
                {
                    kind: 'group', title: '1. 功能单位', children: [
                        { kind: 'text', field: 'funcUnitText', rows: 2, readonly: true, defaultText: '以 1 kW·h 电量为功能单位。' }
                    ]
                },
                {
                    kind: 'group', title: '2. 系统边界', children: [
                        { kind: 'checkboxes', field: 'sysBoundaryChecks', items: REPORT_SYS_BOUNDARY_CHECKS },
                        { kind: 'text', field: 'sysBoundaryDiagram', rows: 3, placeholder: '系统边界图如下图。（可简要说明图示位置或插入截图）' }
                    ]
                },
                {
                    kind: 'group', title: '3. 取舍准则', children: [
                        { kind: 'kv', label: '采用的取舍准则', field: 'cutoffBasis' },
                        { kind: 'text', field: 'cutoffRuleDetail', rows: 4, placeholder: '具体规则如下：……' }
                    ]
                }
            ]
        },
        {
            kind: 'group', title: '四、清单分析', children: [
                {
                    kind: 'group', title: '1. 数据来源说明', children: [
                        { kind: 'kv', label: '活动数据', field: 'dataSourceActivity' },
                        { kind: 'kv', label: '碳因子数据', field: 'dataSourceFactor' }
                    ]
                },
                {
                    kind: 'group', title: '2. 分配原则与程序', children: [
                        { kind: 'kv', label: '分配依据', field: 'allocBasis' },
                        { kind: 'kv', label: '分配程序', field: 'allocProc' }
                    ]
                },
                {
                    kind: 'group', title: '3. 清单结果及计算', children: [
                        { kind: 'text', field: 'listIntro', rows: 2, defaultText: '生命周期各个阶段碳排放计算说明见表 1。' },
                        { kind: 'table1' }
                    ]
                },
                {
                    kind: 'group', title: '4. 数据质量评价', children: [
                        { kind: 'text', field: 'dataQuality', rows: 5, defaultText: '数据质量可从定性和定量两个方面对报告使用的初级数据和次级数据进行评价，具体评价内容包括：完整性、一致性、数据代表性（时间、地理、技术）和准确性。' }
                    ]
                }
            ]
        },
        {
            kind: 'group', title: '五、影响评价', children: [
                {
                    kind: 'group', title: '1. 影响类型和特征因子选择', children: [
                        { kind: 'text', field: 'impactFactor', rows: 3, defaultText: '一般选择政府间气候变化专门委员会 (IPCC) 给出的 100 年全球变暖潜势。' }
                    ]
                },
                {
                    kind: 'group', title: '2. 产品碳足迹结果计算', children: [
                        { kind: 'text', field: 'calc', rows: 10 }
                    ]
                }
            ]
        },
        {
            kind: 'group', title: '六、结果解释', children: [
                {
                    kind: 'group', title: '1. 结果说明', children: [
                        { kind: 'text', field: 'resultIntro', rows: 3 }
                    ]
                },
                { kind: 'table2' },
                {
                    kind: 'group', title: '2. 假设和局限性说明（可选项）', children: [
                        { kind: 'text', field: 'assumptions', rows: 4 }
                    ]
                },
                {
                    kind: 'group', title: '3. 改进建议', children: [
                        { kind: 'text', field: 'improvements', rows: 4 }
                    ]
                }
            ]
        }
    ];

    // 全新 defaultReportContent（标准模版 6 章结构）。
    // 保留 enterpriseIntro / evaluationBasis / inventory 三个旧字段的兜底写回能力，
    // 方便老数据迁移——若旧 report 存在这三个字段则忽略；不存在则用新字段初始化。
    function defaultReportContent() {
        return {
            // 一、概况
            prodUnitName: '', prodAddress: '', prodLegalRep: '', prodContact: '', prodPhone: '', prodCapacityMW: '',
            productName: '', specModel: '',
            ratedPowerMW: '', pvModuleModel: '', inverterModel: '', transformerModel: '',
            basisStandard: '',
            // 二、量化目的
            purpose: '',
            // 三、量化范围
            funcUnitText: '', sysBoundaryChecks: {}, sysBoundaryDiagram: '',
            cutoffBasis: '', cutoffRuleDetail: '',
            // 四、清单分析
            dataSourceActivity: '', dataSourceFactor: '',
            allocBasis: '', allocProc: '',
            listIntro: '',
            dataQuality: '',
            // 五、影响评价
            impactFactor: '',
            calc: '',
            // 六、结果解释
            resultIntro: '', assumptions: '', improvements: ''
        };
    }

    function reportContentGet(content, field) {
        if (!content) return '';
        if (field && field.indexOf('inv:') === 0) return (content.inventory && content.inventory[field.slice(4)]) || '';
        return content[field] || '';
    }
    function reportContentSet(content, field, val) {
        if (!content) return;
        if (field && field.indexOf('inv:') === 0) {
            if (!content.inventory) content.inventory = {};
            content.inventory[field.slice(4)] = val;
        } else content[field] = val;
    }

    // 兼容老数据：旧 v1 报告仅存旧模版字段，升级时将其保留但不会影响新版结构。
    function normalizeTrainReport(r) {
        if (!r) return r;
        if (!r.basic) r.basic = {};
        // 老 basic（含 productName/specModel/orgName/author/phone）会被新 basic 字段覆盖；
        // 保留旧值避免丢失：老 orgName 作为 enterpriseOrg 默认，老 author 作为联系人默认
        if (!r.basic.enterpriseOrg && (r.basic.orgName || r.basic.productName)) {
            r.basic.enterpriseOrg = r.basic.orgName || '';
        }
        REPORT_BASIC_FIELDS.forEach(f => { if (r.basic[f.key] == null) r.basic[f.key] = ''; });
        const base = defaultReportContent();
        if (!r.content) r.content = base;
        Object.keys(base).forEach(k => { if (r.content[k] == null) r.content[k] = base[k]; });
        // 系统边界勾选兜底
        if (!r.content.sysBoundaryChecks) r.content.sysBoundaryChecks = {};
        REPORT_SYS_BOUNDARY_CHECKS.forEach(it => { if (r.content.sysBoundaryChecks[it.key] == null) r.content.sysBoundaryChecks[it.key] = true; });
        // 老数据字段兜底（允许存在但不再使用）
        if (!['草稿', '待审核', '已审核'].includes(r.reviewStatus)) r.reviewStatus = '草稿';
        if (r.reviewer == null) r.reviewer = '';
        if (r.submittedAt == null) r.submittedAt = '';
        if (r.reviewedAt == null) r.reviewedAt = '';
        if (r.createdAt == null) r.createdAt = '';
        return r;
    }

    function loadTrainReports() {
        try {
            const raw = localStorage.getItem(TRAIN_REPORT_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            parsed.forEach(normalizeTrainReport);
            return parsed;
        } catch (e) {
            return [];
        }
    }

    function saveTrainReports() {
        try { localStorage.setItem(TRAIN_REPORT_STORAGE_KEY, JSON.stringify(trainReports)); } catch (e) {}
    }

    let trainReports = loadTrainReports();

    function findReportByAcc(accId) {
        return trainReports.find(r => r.accId === accId);
    }

    function findReportById(reportId) {
        return trainReports.find(r => r.reportId === reportId);
    }

    const rptPad2 = n => ('0' + n).slice(-2);
    function rptToday() {
        const d = new Date();
        return d.getFullYear() + '-' + rptPad2(d.getMonth() + 1) + '-' + rptPad2(d.getDate());
    }
    function rptNow() {
        const d = new Date();
        return rptToday() + ' ' + rptPad2(d.getHours()) + ':' + rptPad2(d.getMinutes());
    }
    function rptFmtNum(n) {
        const v = parseFloat(n);
        return isNaN(v) ? '0.00' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // 预填"碳足迹计算"章节文本（五、2）。新版模版直接引用计算结果与公式，
    // 各阶段具体清单数据由 表 1（table1）自动展示，不再散落在正文中。
    function buildCalcText(acc, cfp) {
        const lines = [];
        lines.push('本报告依据 GB/T 24067—2024《温室气体 产品碳足迹 量化要求和指南》及 ISO 14067:2018，');
        lines.push('光伏发电产品碳足迹按公式（1）量化：');
        lines.push('CFP_pv = (Em_rs+Em_tr+Em_cs+Em_us) ÷ [(E_oge+E_dps)×(1−η)] + Em_td ÷ [E_oge×(1−η)]');
        lines.push('');
        lines.push('式中：Em_rs、Em_tr、Em_cs、Em_us、Em_td 分别为生命周期五个阶段的温室气体排放量（kgCO₂e），');
        lines.push('其计算结果详见清单结果表 1；E_oge 为光伏发电生命周期总上网电量（kW·h），E_dps 为光伏发电总直供电量（kW·h），');
        lines.push('η 为全国电网平均线损率（%）。');
        lines.push('');
        lines.push('1. 输入参数');
        lines.push('　Em_rs = ' + rptFmtNum(acc.stageEmissions && acc.stageEmissions['raw-materials']) + ' kgCO₂e；');
        lines.push('　Em_tr = ' + rptFmtNum(acc.stageEmissions && acc.stageEmissions['transport']) + ' kgCO₂e；');
        lines.push('　Em_cs = ' + rptFmtNum(acc.stageEmissions && acc.stageEmissions['construction']) + ' kgCO₂e；');
        lines.push('　Em_us = ' + rptFmtNum(acc.stageEmissions && acc.stageEmissions['production-retirement']) + ' kgCO₂e；');
        lines.push('　Em_td = ' + rptFmtNum(acc.stageEmissions && acc.stageEmissions['transmission']) + ' kgCO₂e；');
        lines.push('　E_oge = ' + (cfp.eOge == null ? '—' : rptFmtNum(cfp.eOge)) + ' kW·h；E_dps = ' + rptFmtNum(cfp.eDps) + ' kW·h；η = ' +
            ((acc.cfpParams && acc.cfpParams.lineLossRate) || '0') + '%。');
        lines.push('');
        lines.push('2. 计算过程');
        if (cfp.value != null) {
            lines.push('　CFP_pv = ' + rptFmtNum(cfp.emFirst4) + ' ÷ [(' + rptFmtNum(cfp.eOge) + '+' + rptFmtNum(cfp.eDps) + ')×(1−' + cfp.eta + ')] + ' +
                rptFmtNum(cfp.emTd) + ' ÷ [' + rptFmtNum(cfp.eOge) + '×(1−' + cfp.eta + ')]');
            lines.push('　　　　= ' + cfp.part1.toFixed(6) + ' + ' + cfp.part2.toFixed(6) + ' = ' + cfp.value.toFixed(6) + ' kgCO₂e/(kW·h)。');
        } else {
            lines.push('　核算参数不完整，暂无法计算 CFP_pv，请先在"碳足迹核算"模块完成产品核算。');
        }
        return lines.join('\n');
    }

    // 新建报告：按标准模版 6 章结构自动带入核算数据。
    // 保留旧 createReportForAcc 签名（(acc) 单参），内部构造 v2 basic/content 并 normalize。
    function createReportForAcc(acc) {
        const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
        const cfp = computeTrainCfp(acc);
        const period = (acc.periodStart || '') + ' 至 ' + (acc.periodEnd || '');

        // 从光伏产品名称估算装机/设备信息
        const qty = parseFloat(acc.quantity) || 0;
        const spec = (acc.specModel || '').toLowerCase();
        const capacityMW = (acc.unit === 'kW' && qty > 0) ? (qty / 1000).toFixed(1) : '';
        let pvModel = '—', invModel = '—', xfModel = '—';
        if (spec.indexOf('distributed') >= 0 || spec.indexOf('分布式') >= 0) { invModel = 'SUN2000-50KTL'; xfModel = 'S13-1000kVA'; }
        if (acc.stageData && acc.stageData['raw-materials']) {
            const pvRow = acc.stageData['raw-materials'].find(r => /组件|逆变器|变压器/.test(r.dataName || ''));
            if (pvRow) pvModel = pvRow.dataName;
        }

        const content = defaultReportContent();
        // 一、概况
        content.prodUnitName = acc.enterprise || '';
        content.prodAddress = '';
        content.prodLegalRep = '';
        content.prodContact = acc.creator || '';
        content.prodPhone = '';
        content.prodCapacityMW = capacityMW || '';
        content.productName = acc.productName || '';
        content.specModel = acc.specModel || '';
        content.ratedPowerMW = capacityMW || '';
        content.pvModuleModel = pvModel;
        content.inverterModel = invModel;
        content.transformerModel = xfModel;
        content.basisStandard = [
            'GB/T 24067—2024《温室气体 产品碳足迹 量化要求和指南》；',
            'ISO 14067:2018 Greenhouse gases — Carbon footprint of products；',
            'GB 50797—2012《光伏发电站设计规范》；',
            linkedModel && linkedModel.referenceStandard ? linkedModel.referenceStandard + '；' : '',
            '经审核的核算模型（模型编号 ' + (acc.accountingModel || '—') + '）及排放因子数据库。'
        ].filter(Boolean).join('\n');

        // 二、量化目的
        content.purpose = '量化"' + (acc.productName || '光伏发电产品') +
            '"全生命周期温室气体排放，核算单位产品碳足迹 CFP_pv，识别关键排放环节，为绿色电力认证、产品碳标识及企业减碳决策提供数据支撑。';

        // 三、量化范围
        content.sysBoundaryChecks = REPORT_SYS_BOUNDARY_CHECKS.reduce((m, it) => { m[it.key] = true; return m; }, {});
        content.cutoffBasis = 'GB/T 24067 功能单位与系统边界规则，单项贡献占比低于 1% 的辅料可忽略，累计忽略比例不超过 5%。';
        content.cutoffRuleDetail = '具体规则如下：活动数据优先采用企业实测台账（物料、运输、施工、用电等）；' +
            '缺失背景数据采用经审核模型及权威排放因子数据库数据，注明来源与版本；' +
            '生命周期总上网电量按 GB 50797—2012 公式（7）估算，实际电量以并网计量数据为准；' +
            '直供电产品 η = 0、Em_td = 0。';

        // 四、清单分析
        content.dataSourceActivity = '企业提供的物料消耗、运输台账、施工记录及用电台账（数据覆盖时间段：' + period + '）。';
        content.dataSourceFactor = '经审核的排放因子数据库（含中国电网平均排放因子、IPCC 2006 排放因子等）及核算模型内置数据。';
        content.allocBasis = '按工艺流程/物理分配（重量、流量等）或经济分配（产值），优先选择物理分配。';
        content.allocProc = '1) 识别需分配的过程/产品；2) 选择分配准则；3) 计算分配系数；4) 按系数分摊排放至主产品/副产品。';
        content.dataQuality = '（默认文案：详见模版原文，可按需补充时间/地域/技术代表性评价与准确性说明。）';

        // 五、影响评价 & 六、结果解释
        content.calc = buildCalcText(acc, cfp);
        content.resultIntro = cfp.value != null
            ? (acc.enterprise || '本企业') + '生产的 1 kW·h 电量，由原材料及生产设备获取阶段到输配电阶段的全生命周期碳足迹合计为 ' +
                cfp.value.toFixed(6) + ' kgCO₂e/(kW·h)，详见表 2。'
            : '核算参数不完整，暂无法给出 CFP_pv 结果。';
        content.assumptions = '1. 排放因子取自经审核模型及权威数据库，未考虑因子年度波动；\n' +
            '2. 资本品生产、人员通勤等系统边界外排放未计入；\n' +
            '3. 输配电环节按全国电网平均线损率 η = ' + ((acc.cfpParams && acc.cfpParams.lineLossRate) || '0') + '% 处理（直供电产品 η 取 0、Em_td 取 0）。';
        content.improvements = '建议优先从原材料绿色化、组件效率提升、运输路径优化及低碳电力消纳等方面持续降低产品碳足迹，' +
            '并建立年度监测与更新机制，持续改进数据质量与核算精度。';

        const d = new Date();
        const seq = String(trainReports.length + 1).padStart(3, '0');
        const report = {
            reportId: 'train-rpt-' + d.getFullYear() + rptPad2(d.getMonth() + 1) + rptPad2(d.getDate()) + '-' + seq,
            accId: acc.accId,
            basic: {
                enterpriseOrg: acc.enterprise || '',
                reportNo: 'CFPR-' + d.getFullYear() + rptPad2(d.getMonth() + 1) + rptPad2(d.getDate()) + '-' + seq,
                reportDate: rptToday()
            },
            content,
            reviewStatus: '草稿',
            reviewer: '',
            createdAt: rptNow(),
            submittedAt: '',
            reviewedAt: ''
        };
        return normalizeTrainReport(report);
    }

    /* ============ 碳足迹报告 落地页 ============ */
    function renderTrainReportHome(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    '碳足迹报告'
                ]),
                el('div', { class: 'page-title' }, ['碳足迹报告'])
            ])
        ]);

        const cards = el('div', { class: 'flow-cards' }, [
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-report-write') }, [
                el('div', { class: 'flow-icon' }, ['📝'], []),
                el('div', { class: 'flow-title' }, ['报告编写']),
                el('div', { class: 'flow-desc' }, [
                    '从已审核的产品列表中选择产品，',
                    el('br'),
                    '按预置模版填写企业介绍、评价依据、评价过程和方法、碳足迹评价等内容。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ]),
            el('div', { class: 'flow-card', onclick: () => navigate('#/train-report-list') }, [
                el('div', { class: 'flow-icon' }, ['📚'], []),
                el('div', { class: 'flow-title' }, ['报告列表']),
                el('div', { class: 'flow-desc' }, [
                    '查看已完成的产品碳足迹报告，',
                    el('br'),
                    '支持报告预览及 Word、PDF 文档导出。'
                ]),
                el('div', { class: 'flow-arrow' }, ['进入 →'])
            ])
        ]);

        const notice = el('div', { class: 'train-notice' }, [
            el('h3', {}, ['操作说明']),
            el('ol', {}, [
                el('li', {}, ['点击"报告编写"，在产品列表中点击产品对应的"碳足迹报告"入口；']),
                el('li', {}, ['按预置模版填写报告基本信息及各章节内容，内容自动保存，点击"确认提交"后报告变为"待审核"；']),
                el('li', {}, ['点击"待审核"标签完成审核，审核通过后报告在"报告列表"中可预览并导出 Word、PDF 文档。'])
            ])
        ]);

        container.appendChild(header);
        container.appendChild(cards);
        container.appendChild(notice);
    }

    /* ============ 报告编写：产品列表 ============ */
    function renderTrainReportWriteList(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/carbon-footprint-report', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹报告']),
                    el('span', { class: 'sep' }, ['/']),
                    '报告编写'
                ]),
                el('div', { class: 'page-title' }, ['报告编写 — 产品列表'])
            ])
        ]);
        container.appendChild(header);

        const tableCard = el('div', { class: 'table-card' });
        container.appendChild(tableCard);

        const reviewedAccs = trainAccs.filter(a => a.reviewStatus === '已审核');
        if (!trainAccs.length) {
            tableCard.appendChild(el('div', { class: 'empty' }, ['暂无产品数据']));
            return;
        }
        if (!reviewedAccs.length) {
            tableCard.appendChild(el('div', { class: 'empty' }, ['暂无已审核的产品，请先在"碳足迹核算"模块完成产品核算与审核。']));
            return;
        }

        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['产品名称', '规格型号', '数量', '单位', '企业名称', '核算模型', '数据统计时间段', '创建时间', '操作', '碳足迹报告', '创建人', '审核人', '状态'].forEach(t =>
            trh.appendChild(el('th', {}, [t])));
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        reviewedAccs.forEach(acc => {
            const linkedModel = trainModels.find(m => m.code === acc.accountingModel);
            const report = findReportByAcc(acc.accId);
            const tr = el('tr');
            tr.appendChild(el('td', {}, [acc.productName || '']));
            tr.appendChild(el('td', {}, [acc.specModel || '']));
            tr.appendChild(el('td', {}, [acc.quantity || '']));
            tr.appendChild(el('td', {}, [acc.unit || '']));
            tr.appendChild(el('td', {}, [acc.enterprise || '']));
            tr.appendChild(el('td', {}, [linkedModel ? linkedModel.name : (acc.accountingModel || '')]));
            tr.appendChild(el('td', {}, [(acc.periodStart || '') + ' ~ ' + (acc.periodEnd || '')]));
            tr.appendChild(el('td', {}, [acc.createTime || '']));
            tr.appendChild(el('td', {}, [
                el('button', { class: 'btn-link', style: 'color:#0f766e;', onclick: () => navigate('#/train-accounting-view/' + encodeURIComponent(acc.accId)) }, ['碳足迹核算'])
            ]));
            // 碳足迹报告入口：按报告状态显示不同文案
            let entryText = '编写报告';
            if (report) {
                entryText = report.reviewStatus === '草稿' ? '继续编写' : (report.reviewStatus === '已审核' ? '查看报告' : '查看/编辑');
            }
            tr.appendChild(el('td', {}, [
                el('button', {
                    class: 'btn-link',
                    style: 'color:#b45309;font-weight:600;',
                    onclick: () => navigate('#/train-report-edit/' + encodeURIComponent(acc.accId))
                }, [entryText])
            ]));
            tr.appendChild(el('td', {}, [acc.creator || '']));
            tr.appendChild(el('td', {}, [acc.reviewer || '']));
            tr.appendChild(el('td', {}, [
                el('span', {
                    style: 'font-size:12px;padding:2px 8px;border-radius:4px;background:#dcfce7;color:#16a34a;'
                }, ['已审核'])
            ]));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableCard.appendChild(table);
    }

    /* ============ 报告编辑页 ============ */
    function renderTrainReportEdit(container, accIdRaw) {
        const accId = accIdRaw ? decodeURIComponent(accIdRaw) : '';
        const acc = trainAccs.find(a => a.accId === accId);
        if (!acc) {
            container.appendChild(el('div', { class: 'page-header' }, [el('div', { class: 'page-title' }, ['未找到产品'])]));
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的产品，请从报告编写产品列表中进入。']));
            return;
        }
        normalizeTrainAcc(acc);
        let report = findReportByAcc(accId);
        let isNew = false;
        if (!report) {
            report = createReportForAcc(acc);
            trainReports.push(report);
            saveTrainReports();
            isNew = true;
        }
        const readonly = report.reviewStatus === '已审核';
        const linkedModel = trainModels.find(m => m.code === acc.accountingModel);

        const rerender = () => {
            const pc = document.getElementById('page-container');
            if (pc) { pc.innerHTML = ''; renderTrainReportEdit(pc, encodeURIComponent(accId)); }
        };

        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/carbon-footprint-report', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹报告']),
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/train-report-write', style: 'color:#0f766e;text-decoration:none;' }, ['报告编写']),
                    el('span', { class: 'sep' }, ['/']),
                    '报告编辑'
                ]),
                el('div', { class: 'page-title' }, ['碳足迹报告编写 — ' + (acc.productName || '')])
            ])
        ]);
        container.appendChild(header);

        // 报告状态条
        const statusColors = { '草稿': 'background:#f3f4f6;color:#6b7280;', '待审核': 'background:#fef3c7;color:#d97706;', '已审核': 'background:#dcfce7;color:#16a34a;' };
        const statusNode = el('span', { style: 'font-size:12px;padding:3px 10px;border-radius:4px;' + (statusColors[report.reviewStatus] || '') }, [report.reviewStatus]);
        const statusCard = el('div', { class: 'table-card', style: 'display:flex;align-items:center;justify-content:space-between;' }, [
            el('div', { style: 'font-weight:600;font-size:14px;color:#111827;' }, [
                '报告状态：', statusNode,
                el('span', { style: 'font-weight:400;color:#6b7280;margin-left:12px;font-size:12px;' }, [
                    report.submittedAt ? '提交时间：' + report.submittedAt : (isNew ? '已根据核算数据自动带入部分内容，请补充完善' : '内容已自动保存')
                ])
            ]),
            el('div', { style: 'display:flex;gap:8px;' }, [
                el('button', { class: 'btn', style: 'font-size:12px;padding:4px 12px;', onclick: () => navigate('#/train-report-preview/' + encodeURIComponent(report.reportId)) }, ['预览']),
                el('button', { class: 'btn', style: 'font-size:12px;padding:4px 12px;', onclick: () => downloadReportWord(report, acc) }, ['导出 Word']),
                el('button', { class: 'btn', style: 'font-size:12px;padding:4px 12px;', onclick: () => printReportPdf(report, acc) }, ['导出 PDF'])
            ])
        ]);
        container.appendChild(statusCard);

        // 待审核标签可点击通过审核（与核算/模型模块一致）
        if (report.reviewStatus === '待审核') {
            statusNode.style.cursor = 'pointer';
            statusNode.style.textDecoration = 'underline';
            statusNode.addEventListener('click', () => {
                const mask = el('div', { class: 'modal-mask' });
                const dlg = el('div', { class: 'modal', style: 'width:380px;' });
                dlg.appendChild(el('div', { class: 'modal-header' }, ['审核确认']));
                dlg.appendChild(el('div', { class: 'modal-body' }, [
                    el('div', { style: 'margin-bottom:10px;color:#374151;' }, ['是否通过审核？']),
                    el('div', { style: 'color:#6b7280;font-size:13px;' }, ['通过后报告状态将变更为"已审核"，可在报告列表中导出 Word、PDF 文档。'])
                ]));
                dlg.appendChild(el('div', { class: 'modal-footer' }, [
                    el('button', { class: 'btn', onclick: () => mask.remove() }, ['取消']),
                    el('button', {
                        class: 'btn btn-primary', onclick: () => {
                            report.reviewStatus = '已审核';
                            report.reviewer = acc.reviewer || '李总工';
                            report.reviewedAt = rptNow();
                            saveTrainReports();
                            mask.remove();
                            rerender();
                        }
                    }, ['通过审核'])
                ]));
                mask.appendChild(dlg);
                mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
                document.body.appendChild(mask);
            });
        }

        // 报告基本信息（产品信息只读展示）
        const infoCard = el('div', { class: 'table-card' });
        infoCard.appendChild(el('div', { style: 'font-weight:600;font-size:14px;color:#111827;margin-bottom:12px;' }, ['报告基本信息']));
        const productMeta = el('div', { class: 'result-grid' });
        const cfpNow = computeTrainCfp(acc);
        [
            ['产品名称', acc.productName],
            ['规格型号', acc.specModel],
            ['企业名称', acc.enterprise],
            ['核算模型', linkedModel ? (linkedModel.code + ' — ' + linkedModel.name) : (acc.accountingModel || '—')],
            ['数据统计时间段', (acc.periodStart || '') + ' ~ ' + (acc.periodEnd || '')],
            ['产品碳足迹 CFP_pv', cfpNow.value == null ? '—' : (cfpNow.value.toFixed(6) + ' kgCO₂e/(kW·h)')]
        ].forEach(([label, value]) => {
            productMeta.appendChild(el('div', { class: 'result-item' }, [
                el('div', { class: 'label' }, [label]),
                el('div', { class: 'value' }, [value || '—'])
            ]));
        });
        infoCard.appendChild(productMeta);

        const basicGrid = el('div', { class: 'accounting-stage-grid', style: 'margin-top:14px;' });
        REPORT_BASIC_FIELDS.forEach(f => {
            const grp = el('div', { class: 'form-group' });
            grp.appendChild(el('label', {}, [f.label]));
            const input = el('input', {
                class: 'form-control',
                type: f.key === 'reportDate' ? 'date' : 'text',
                value: report.basic[f.key] || '',
                placeholder: '请填写' + f.label,
                oninput: () => { report.basic[f.key] = input.value.trim(); saveTrainReports(); }
            });
            input.readOnly = readonly;
            grp.appendChild(input);
            basicGrid.appendChild(grp);
        });
        infoCard.appendChild(basicGrid);
        container.appendChild(infoCard);

        // 模版章节表单 —— 新版 REPORT_TEMPLATE（kv / text / checkboxes / table1 / table2 多种 kind）
        function bindKv(field) {
            const wrap = el('div', { class: 'form-group' });
            wrap.appendChild(el('label', {}, [field.label || field.title]));
            const multi = field.rows && field.rows >= 2;
            let ctrl;
            if (multi) {
                ctrl = el('textarea', {
                    class: 'form-control',
                    rows: String(field.rows || 3),
                    placeholder: readonly ? '' : ('请填写' + (field.label || field.title)),
                    style: 'width:100%;resize:vertical;line-height:1.6;'
                });
            } else {
                ctrl = el('input', {
                    class: 'form-control',
                    type: 'text',
                    placeholder: readonly ? '' : ('请填写' + (field.label || field.title))
                });
            }
            ctrl.value = reportContentGet(report.content, field.field);
            ctrl.readOnly = readonly;
            ctrl.addEventListener('input', () => {
                reportContentSet(report.content, field.field, ctrl.value); saveTrainReports();
            });
            wrap.appendChild(ctrl);
            return wrap;
        }
        function bindText(field) {
            const wrap = el('div', { style: 'margin-bottom:14px;' });
            wrap.appendChild(el('div', { style: 'font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;' }, [field.title || field.label]));
            const ta = el('textarea', {
                class: 'form-control',
                rows: String(field.rows || 4),
                placeholder: readonly ? '' : (field.placeholder || ('请填写' + (field.title || field.label))),
                style: 'width:100%;resize:vertical;line-height:1.8;font-size:13px;'
            });
            let initial = reportContentGet(report.content, field.field);
            if ((initial == null || initial === '') && field.defaultText) initial = field.defaultText;
            ta.value = initial;
            ta.readOnly = readonly || field.readonly === true;
            ta.addEventListener('input', () => { reportContentSet(report.content, field.field, ta.value); saveTrainReports(); });
            wrap.appendChild(ta);
            return wrap;
        }
        function renderCheckboxes(field) {
            const box = el('div', { style: 'margin-bottom:10px;' });
            (field.items || REPORT_SYS_BOUNDARY_CHECKS).forEach(it => {
                const id = 'sb-chk-' + it.key + '-' + Date.now();
                const cb = el('input', { type: 'checkbox', id: id });
                cb.checked = !!(report.content.sysBoundaryChecks && report.content.sysBoundaryChecks[it.key]);
                cb.disabled = readonly;
                cb.addEventListener('change', () => {
                    report.content.sysBoundaryChecks[it.key] = cb.checked;
                    saveTrainReports();
                });
                const row = el('label', { for: id, style: 'display:inline-flex;align-items:center;gap:5px;margin-right:18px;cursor:pointer;font-size:13px;color:#1f2937;' });
                row.appendChild(cb); row.appendChild(el('span', {}, [it.label]));
                box.appendChild(row);
            });
            box.appendChild(el('div', { style: 'color:#6b7280;font-size:12px;margin-top:4px;' }, ['系统边界图如下：……（请在下方"系统边界图示意"处补充图示位置说明或截图）']));
            return box;
        }

        function buildNode(node, depth) {
            const block = el('div', {});
            // kind='cover' 在编辑页不渲染（封面单独在 buildReportDocNode 里处理）
            if (node.kind === 'cover') return block;

            if (node.title) {
                const hTag = depth === 0 ? 'h3' : (depth === 1 ? 'h4' : 'div');
                const styleMap = {
                    h3: 'font-size:15px;font-weight:700;color:#0f766e;margin:0 0 10px;padding-left:8px;border-left:3px solid #0f766e;',
                    h4: 'font-size:14px;font-weight:700;color:#111827;margin:12px 0 8px;',
                    div: 'font-size:13px;font-weight:600;color:#374151;margin:10px 0 6px;'
                };
                block.appendChild(el(hTag, { style: styleMap[hTag] }, [node.title]));
            }

            if (node.kind === 'kv') block.appendChild(bindKv(node));
            else if (node.kind === 'text') block.appendChild(bindText(node));
            else if (node.kind === 'checkboxes') block.appendChild(renderCheckboxes(node));
            else if (node.kind === 'table1') block.appendChild(buildReportTable1Node(acc));
            else if (node.kind === 'table2') block.appendChild(buildReportTable2Node(acc, cfpNow));
            else if (node.field) block.appendChild(bindText(node));

            if (node.children) {
                const body = el('div', {});
                node.children.forEach(ch => body.appendChild(buildNode(ch, depth + 1)));
                block.appendChild(body);
            }
            return block;
        }

        // 清掉旧版"核算结果只读表"，新版 table1 已在模版中。
        if (document.getElementById('__rpt_old_calc_table__')) {
            document.getElementById('__rpt_old_calc_table__').remove();
        }

        REPORT_TEMPLATE.forEach((node) => {
            const card = el('div', { class: 'table-card' });
            card.appendChild(buildNode(node, 0));
            container.appendChild(card);
        });

        // 底部操作按钮
        const footer = el('div', { class: 'table-card', style: 'display:flex;justify-content:space-between;align-items:center;' }, [
            el('button', { class: 'btn', onclick: () => navigate('#/train-report-write') }, ['← 返回产品列表']),
            el('div', { style: 'display:flex;gap:10px;' })
        ]);
        const rightBtns = footer.lastChild;
        if (readonly) {
            rightBtns.appendChild(el('button', {
                class: 'btn',
                onclick: () => openConfirmModal('重新编辑', '重新编辑后报告将回退为"待审核"，需再次审核。是否继续？', () => {
                    report.reviewStatus = '待审核';
                    report.reviewer = '';
                    report.reviewedAt = '';
                    saveTrainReports();
                    rerender();
                })
            }, ['重新编辑']));
        } else {
            rightBtns.appendChild(el('button', {
                class: 'btn',
                onclick: () => openConfirmModal('保存报告', '报告内容已保存，当前状态保持为"' + report.reviewStatus + '"。', () => {})
            }, ['保存']));
            rightBtns.appendChild(el('button', {
                class: 'btn btn-primary',
                onclick: () => {
                    if (!report.basic.reportName.trim()) {
                        openConfirmModal('提示', '请先填写报告名称。', () => {});
                        return;
                    }
                    openConfirmModal('确认提交', '确认提交本碳足迹报告？提交后状态将变为"待审核"，可点击状态标签完成审核。', () => {
                        report.reviewStatus = '待审核';
                        report.submittedAt = rptNow();
                        saveTrainReports();
                        rerender();
                    });
                }
            }, ['确认提交']));
        }
        container.appendChild(footer);
    }

    /* ============ 报告列表 ============ */
    function renderTrainReportListPage(container) {
        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/carbon-footprint-report', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹报告']),
                    el('span', { class: 'sep' }, ['/']),
                    '报告列表'
                ]),
                el('div', { class: 'page-title' }, ['报告列表'])
            ])
        ]);
        container.appendChild(header);

        const tableCard = el('div', { class: 'table-card' });
        container.appendChild(tableCard);

        // 仅展示已完成编写并提交（待审核/已审核）的报告
        const list = trainReports.filter(r => r.submittedAt).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        if (!list.length) {
            tableCard.appendChild(el('div', { class: 'empty' }, ['暂无已完成的产品碳足迹报告，请先在"报告编写"中编写并提交报告。']));
            return;
        }

        const table = el('table', { class: 'data-table' });
        const thead = el('thead');
        const trh = el('tr');
        ['报告编号', '报告名称', '产品名称', '企业名称', '编制人', '审核人', '提交时间', '状态', '操作'].forEach(t =>
            trh.appendChild(el('th', {}, [t])));
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = el('tbody');
        list.forEach(r => {
            const acc = trainAccs.find(a => a.accId === r.accId);
            const tr = el('tr');
            tr.appendChild(el('td', {}, [r.basic.reportNo || '—']));
            tr.appendChild(el('td', {}, [r.basic.reportName || '—']));
            tr.appendChild(el('td', {}, [acc ? acc.productName : '—']));
            tr.appendChild(el('td', {}, [r.basic.orgName || (acc ? acc.enterprise : '') || '—']));
            tr.appendChild(el('td', {}, [r.basic.author || '—']));
            tr.appendChild(el('td', {}, [r.reviewer || '—']));
            tr.appendChild(el('td', {}, [r.submittedAt || '—']));
            const chipBg = r.reviewStatus === '已审核' ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#d97706;';
            tr.appendChild(el('td', {}, [
                el('span', { style: 'font-size:12px;padding:2px 8px;border-radius:4px;white-space:nowrap;' + chipBg }, [r.reviewStatus])
            ]));
            tr.appendChild(el('td', { style: 'white-space:nowrap;' }, [
                el('button', { class: 'btn-link', style: 'color:#0f766e;', onclick: () => navigate('#/train-report-preview/' + encodeURIComponent(r.reportId)) }, ['预览']),
                el('span', { style: 'color:#d1d5db;margin:0 4px;' }, ['|']),
                el('button', { class: 'btn-link', style: 'color:#2563eb;', onclick: () => downloadReportWord(r, acc) }, ['Word']),
                el('span', { style: 'color:#d1d5db;margin:0 4px;' }, ['|']),
                el('button', { class: 'btn-link', style: 'color:#dc2626;', onclick: () => printReportPdf(r, acc) }, ['PDF'])
            ]));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableCard.appendChild(table);
    }

    /* ============ 报告预览 ============ */
    function renderTrainReportPreview(container, reportIdRaw) {
        const reportId = reportIdRaw ? decodeURIComponent(reportIdRaw) : '';
        const report = findReportById(reportId);
        if (!report) {
            container.appendChild(el('div', { class: 'page-header' }, [el('div', { class: 'page-title' }, ['未找到报告'])]));
            container.appendChild(el('div', { class: 'placeholder-card' }, ['未找到对应的报告，请从报告列表进入。']));
            return;
        }
        const acc = trainAccs.find(a => a.accId === report.accId);

        const header = el('div', { class: 'page-header' }, [
            el('div', {}, [
                el('div', { class: 'breadcrumb' }, [
                    '产品碳足迹',
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/carbon-footprint-report', style: 'color:#0f766e;text-decoration:none;' }, ['碳足迹报告']),
                    el('span', { class: 'sep' }, ['/']),
                    el('a', { href: '#/train-report-list', style: 'color:#0f766e;text-decoration:none;' }, ['报告列表']),
                    el('span', { class: 'sep' }, ['/']),
                    '报告预览'
                ]),
                el('div', { style: 'display:flex;align-items:center;justify-content:space-between;' }, [
                    el('div', { class: 'page-title' }, ['报告预览']),
                    el('div', { style: 'display:flex;gap:8px;' }, [
                        el('button', { class: 'btn', onclick: () => history.back() }, ['← 返回']),
                        el('button', { class: 'btn', style: 'color:#2563eb;', onclick: () => downloadReportWord(report, acc) }, ['导出 Word']),
                        el('button', { class: 'btn btn-primary', onclick: () => printReportPdf(report, acc) }, ['导出 PDF'])
                    ])
                ])
            ])
        ]);
        container.appendChild(header);
        const wrap = el('div', { class: 'report-paper-wrap' });
        wrap.appendChild(buildReportDocNode(report, acc));
        container.appendChild(wrap);
    }

    /* ============ 报告文档构建（预览/导出同源） ============ */
    function escapeReportHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function reportTextHtml(s) {
        const t = escapeReportHtml(s).replace(/\r\n|\r|\n/g, '<br>');
        return t || '—';
    }

    // Word/PDF 字体声明（双重：SimSun/MS Songti/Arial Unicode 覆盖中文，Times New Roman 兜底西文）
    const RPT_FONT_STACK = 'SimSun, "Songti SC", "MS Song", "宋体", Arial Unicode MS, "Times New Roman", serif';
    const RPT_STYLE = {
        wrap: 'font-family:' + RPT_FONT_STACK + ';color:#111;font-size:12pt;line-height:22px;',
        h1: 'font-size:22pt;font-weight:700;text-align:center;margin:0 0 40px;letter-spacing:4px;',
        coverLabel: 'font-size:14px;color:#374151;width:120px;display:inline-block;',
        coverUnderline: 'border-bottom:1px solid #000;display:inline-block;min-width:220px;margin-bottom:14px;padding-bottom:2px;',
        coverRow: 'margin:12px 0;',
        h2: 'font-size:16pt;font-weight:700;margin:22px 0 10px;page-break-before:avoid;',
        h3: 'font-size:14pt;font-weight:700;margin:16px 0 6px;page-break-after:avoid;',
        h4: 'font-size:13pt;font-weight:700;margin:10px 0 4px;page-break-after:avoid;',
        p: 'font-size:12pt;line-height:26px;margin:6px 0;text-align:justify;text-indent:2em;',
        table: 'width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:11pt;page-break-inside:avoid;',
        th: 'border:1px solid #000;padding:4px 6px;background:#f3f4f6;font-weight:600;text-align:center;mso-number-format:"\\@";',
        td: 'border:1px solid #000;padding:4px 6px;mso-number-format:"\\@";',
        tdRight: 'border:1px solid #000;padding:4px 6px;text-align:right;mso-number-format:"\\0";',
        caption: 'font-weight:600;font-size:12pt;margin:6px 0 4px;text-align:left;',
        endLine: 'text-align:center;margin-top:24px;color:#374151;'
    };

    // 表 1 字符串版（buildReportBodyString 使用）
    function buildTable1String(acc) {
        const rows = [
            ['生命周期阶段', '活动数据', '碳足迹因子', '温室气体量 (kgCO₂e)']
        ];
        REPORT_EMISSION_STAGES.forEach(s => {
            const r = (acc.stageData && acc.stageData[s.stageId] && acc.stageData[s.stageId][0]) || {};
            let act = '';
            if (s.stageId === 'transport') {
                const w = r.weight || '—', d = r.distance || '—';
                act = (w !== '—' || d !== '—') ? ('重量 ' + w + ' t × 距离 ' + d + ' km') : '—';
            } else {
                const qty = r.quantity || '—', fu = r.functionalUnit || '—', dname = r.dataName || '';
                act = qty !== '—' ? (qty + ' ' + fu + (dname ? '（' + dname + '）' : '')) : '—';
            }
            const ef = r.emissionCoefficient || '—';
            const em = rptFmtNum(acc.stageEmissions && acc.stageEmissions[s.stageId]);
            rows.push([s.short, act, ef, em]);
        });
        return buildSimpleTableString(rows, '表 1　光伏发电产品生命周期碳排放清单说明');
    }

    // 表 2：各阶段排放量 tCO₂e、CFP_pv kgCO₂e/(kW·h)、百分比
    function buildTable2String(acc, cfp) {
        cfp = cfp || computeTrainCfp(acc);
        const rows = [['生命周期阶段', '温室气体排放量 (tCO₂e)', '碳足迹 [kgCO₂e/(kW·h)]', '百分比 (%)']];
        REPORT_EMISSION_STAGES.forEach(s => {
            const emKg = parseFloat(acc.stageEmissions && acc.stageEmissions[s.stageId]) || 0;
            const emT = (emKg / 1000).toFixed(4);
            const cfpStage = cfp.eOge && cfp.value != null ? (emKg / ((cfp.eOge + cfp.eDps) * (1 - cfp.eta))).toFixed(6) : '—';
            const pct = cfp.emFirst4 + cfp.emTd > 0 ? ((emKg / (cfp.emFirst4 + cfp.emTd)) * 100).toFixed(2) : '0.00';
            rows.push([s.short, emT, cfpStage, pct]);
        });
        // 合计行
        const totalKg = cfp.emFirst4 + cfp.emTd;
        rows.push(['合计', (totalKg / 1000).toFixed(4), cfp.value == null ? '—' : cfp.value.toFixed(6), '100.00']);
        return buildSimpleTableString(rows, '表 2　光伏发电产品生命周期各阶段碳排放情况');
    }

    function buildSimpleTableString(rows, caption) {
        const th = rows[0].map(h => '<th style="border:1px solid #000;padding:5px 8px;background:#f3f4f6;font-weight:600;text-align:center;">' + escapeReportHtml(h) + '</th>').join('');
        const body = rows.slice(1).map(r => {
            return '<tr>' + r.map((c, i) => {
                const isNum = (i === 1 || i === 2 || i === 3);
                const tdStyle = 'border:1px solid #000;padding:4px 8px;' + (isNum ? 'text-align:right;mso-number-format:"\\0.0000";' : '');
                return '<td style="' + tdStyle + '">' + escapeReportHtml(c) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        return '<div style="font-weight:600;font-size:13px;margin:6px 0 4px;">' + escapeReportHtml(caption) + '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12pt;margin-bottom:12px;">' +
            '<thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>';
    }

    // 报告预览（编辑页内、非导出）使用 DOM 版，避免字符串解析差异
    function buildReportTable1Node(acc) {
        const box = el('div', { style: 'margin:6px 0;' });
        box.appendChild(el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:4px;' }, ['表 1　光伏发电产品生命周期碳排放清单说明']));
        const table = el('table', { style: RPT_STYLE.table });
        const headRow = el('tr');
        ['生命周期阶段', '活动数据', '碳足迹因子', '温室气体量 (kgCO₂e)'].forEach(t => headRow.appendChild(el('th', { style: RPT_STYLE.th }, [t])));
        table.appendChild(el('thead').appendChild(headRow) || el('thead').appendChild(headRow));
        const tbody = el('tbody');
        REPORT_EMISSION_STAGES.forEach(s => {
            const r = (acc.stageData && acc.stageData[s.stageId] && acc.stageData[s.stageId][0]) || {};
            let act;
            if (s.stageId === 'transport') act = '重量 ' + (r.weight || '—') + ' t × 距离 ' + (r.distance || '—') + ' km';
            else act = (r.quantity || '—') + ' ' + (r.functionalUnit || '—');
            const tr2 = el('tr');
            tr2.appendChild(el('td', { style: RPT_STYLE.td }, [s.short]));
            tr2.appendChild(el('td', { style: RPT_STYLE.td }, [act]));
            tr2.appendChild(el('td', { style: RPT_STYLE.td }, [r.emissionCoefficient || '—']));
            tr2.appendChild(el('td', { style: RPT_STYLE.tdRight }, [rptFmtNum(acc.stageEmissions && acc.stageEmissions[s.stageId])]));
            tbody.appendChild(tr2);
        });
        table.appendChild(tbody);
        box.appendChild(table);
        return box;
    }
    function buildReportTable2Node(acc, cfp) {
        cfp = cfp || computeTrainCfp(acc);
        const box = el('div', { style: 'margin:6px 0;' });
        box.appendChild(el('div', { style: 'font-weight:600;font-size:13px;margin-bottom:4px;' }, ['表 2　光伏发电产品生命周期各阶段碳排放情况']));
        const table = el('table', { style: RPT_STYLE.table });
        const headRow = el('tr');
        ['生命周期阶段', '温室气体排放量 (tCO₂e)', '碳足迹 [kgCO₂e/(kW·h)]', '百分比 (%)'].forEach(t => headRow.appendChild(el('th', { style: RPT_STYLE.th }, [t])));
        table.appendChild(headRow);
        REPORT_EMISSION_STAGES.forEach(s => {
            const emKg = parseFloat(acc.stageEmissions && acc.stageEmissions[s.stageId]) || 0;
            const emT = (emKg / 1000).toFixed(4);
            const cfpStage = cfp.eOge && cfp.value != null ? (emKg / ((cfp.eOge + cfp.eDps) * (1 - cfp.eta))).toFixed(6) : '—';
            const pct = cfp.emFirst4 + cfp.emTd > 0 ? ((emKg / (cfp.emFirst4 + cfp.emTd)) * 100).toFixed(2) : '0.00';
            const tr = el('tr');
            tr.appendChild(el('td', { style: RPT_STYLE.td }, [s.short]));
            tr.appendChild(el('td', { style: RPT_STYLE.tdRight }, [emT]));
            tr.appendChild(el('td', { style: RPT_STYLE.tdRight }, [cfpStage]));
            tr.appendChild(el('td', { style: RPT_STYLE.tdRight }, [pct]));
            table.appendChild(tr);
        });
        const totalKg = cfp.emFirst4 + cfp.emTd;
        const tr = el('tr');
        tr.appendChild(el('td', { style: RPT_STYLE.td + 'font-weight:700;' }, ['合计']));
        tr.appendChild(el('td', { style: RPT_STYLE.tdRight + 'font-weight:700;' }, [(totalKg / 1000).toFixed(4)]));
        tr.appendChild(el('td', { style: RPT_STYLE.tdRight + 'font-weight:700;' }, [cfp.value == null ? '—' : cfp.value.toFixed(6)]));
        tr.appendChild(el('td', { style: RPT_STYLE.tdRight + 'font-weight:700;' }, ['100.00']));
        table.appendChild(tr);
        box.appendChild(table);
        return box;
    }

    function buildCoverString(report, acc) {
        const r = report.basic || {};
        const todayStr = (r.reportDate || rptToday());
        const mm = todayStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const y = mm ? mm[1] : '';
        const mo = mm ? mm[2] : '';
        const d = mm ? mm[3] : '';
        const productName = (acc && acc.productName) || '';
        const orgName = r.enterpriseOrg || (acc && acc.enterprise) || '';
        const reportTitle = productName + '产品碳足迹报告';
        return '<div style="' + RPT_STYLE.wrap + 'text-align:center;padding:70px 40px 60px;page-break-after:always;">' +
            '<h1 style="' + RPT_STYLE.h1 + '">' + escapeReportHtml(reportTitle) + '</h1>' +
            '<div style="font-size:14pt;margin-bottom:28px;color:#374151;">（模板）</div>' +
            '<div style="height:60px;"></div>' +
            '<div style="font-size:12pt;text-align:left;margin:0 auto;width:420px;line-height:40px;">' +
            '<div><span style="' + RPT_STYLE.coverLabel + '">产 品 名 称：</span><span style="' + RPT_STYLE.coverUnderline + '">' + escapeReportHtml(productName) + '&nbsp;</span></div>' +
            '<div><span style="' + RPT_STYLE.coverLabel + '">产品规格型号：</span><span style="' + RPT_STYLE.coverUnderline + '">' + escapeReportHtml((acc && acc.specModel) || '') + '&nbsp;</span></div>' +
            '<div><span style="' + RPT_STYLE.coverLabel + '">生 产 者 名 称：</span><span style="' + RPT_STYLE.coverUnderline + '">' + escapeReportHtml(orgName) + '&nbsp;</span></div>' +
            '<div><span style="' + RPT_STYLE.coverLabel + '">报 告 编 号：</span><span style="' + RPT_STYLE.coverUnderline + '">' + escapeReportHtml(r.reportNo || '') + '&nbsp;</span></div>' +
            '</div>' +
            '<div style="height:80px;"></div>' +
            '<div style="font-size:12pt;">' +
            '<div style="margin-bottom:18px;"><span style="' + RPT_STYLE.coverLabel + '">出具报告机构：</span><span style="color:#374151;">' + escapeReportHtml(orgName) + '</span><span style="margin-left:18px;color:#374151;">（盖章）</span></div>' +
            '<div><span style="' + RPT_STYLE.coverLabel + '">日　　　期：</span><span style="color:#374151;">' + y + '&nbsp;&nbsp;年&nbsp;&nbsp;' + mo + '&nbsp;&nbsp;月&nbsp;&nbsp;' + d + '&nbsp;&nbsp;日</span></div>' +
            '</div>' +
            '</div>';
    }

    function buildReportBodyString(report, acc) {
        const content = report.content || {};
        const cs = content.sysBoundaryChecks || {};
        const cfp = computeTrainCfp(acc);
        const lines = [];

        function h2(s) { lines.push('<h2 style="' + RPT_STYLE.h2 + '">' + escapeReportHtml(s) + '</h2>'); }
        function h3(s) { lines.push('<h3 style="' + RPT_STYLE.h3 + '">' + escapeReportHtml(s) + '</h3>'); }
        function h4(s) { lines.push('<h4 style="' + RPT_STYLE.h4 + '">' + escapeReportHtml(s) + '</h4>'); }
        function kv(label, val) { lines.push('<p style="' + RPT_STYLE.p + '"><span style="display:inline-block;width:140px;font-weight:600;">' + escapeReportHtml(label + '：') + '</span>' + escapeReportHtml(val || '—') + '</p>'); }
        function p(s) { lines.push('<p style="' + RPT_STYLE.p + '">' + reportTextHtml(s) + '</p>'); }
        function pRaw(s) { lines.push('<p style="' + RPT_STYLE.p + '">' + (s || '—') + '</p>'); }

        // 一、概况
        h2('一、概况');
        h3('1. 生产单位信息');
        kv('生产单位名称', content.prodUnitName);
        kv('地址', content.prodAddress);
        kv('法定代表人', content.prodLegalRep);
        kv('授权人（联系人）', content.prodContact);
        kv('联系电话', content.prodPhone);
        kv('装机容量 (MW)', content.prodCapacityMW);
        h3('2. 产品信息');
        kv('产品名称', content.productName);
        kv('产品规格型号', content.specModel);
        h3('3. 设备信息');
        kv('额定功率 (MW)', content.ratedPowerMW);
        kv('光伏组件型号', content.pvModuleModel);
        kv('逆变器型号', content.inverterModel);
        kv('变压器型号', content.transformerModel);
        h3('4. 量化方法');
        h4('依据标准');
        pRaw(content.basisStandard);

        // 二、量化目的
        h2('二、量化目的');
        p(content.purpose);

        // 三、量化范围
        h2('三、量化范围');
        h3('1. 功能单位');
        p('以 1 kW·h 电量为功能单位。');
        h3('2. 系统边界');
        pRaw('　□ 原材料及生产设备获取阶段　□ 运输阶段　□ 设施建设阶段　□ 生产及退役阶段　□ 输配电阶段');
        if (REPORT_SYS_BOUNDARY_CHECKS.some(it => cs[it.key])) {
            const labelMap = { true: '■', false: '□' };
            const line = REPORT_SYS_BOUNDARY_CHECKS.map(it =>
                labelMap[!!cs[it.key]] + ' ' + it.label
            ).join('　');
            p('　' + line);
        }
        pRaw(content.sysBoundaryDiagram || '系统边界图如下图。');
        h3('3. 取舍准则');
        kv('采用的取舍准则', content.cutoffBasis);
        p(content.cutoffRuleDetail);

        // 四、清单分析
        h2('四、清单分析');
        h3('1. 数据来源说明');
        kv('活动数据', content.dataSourceActivity);
        kv('碳因子数据', content.dataSourceFactor);
        h3('2. 分配原则与程序');
        kv('分配依据', content.allocBasis);
        kv('分配程序', content.allocProc);
        h3('3. 清单结果及计算');
        p(content.listIntro || '生命周期各个阶段碳排放计算说明见表 1。');
        lines.push(buildTable1String(acc));
        h3('4. 数据质量评价');
        p(content.dataQuality);

        // 五、影响评价
        h2('五、影响评价');
        h3('1. 影响类型和特征因子选择');
        p(content.impactFactor);
        h3('2. 产品碳足迹结果计算');
        p(content.calc);

        // 六、结果解释
        h2('六、结果解释');
        h3('1. 结果说明');
        p(content.resultIntro);
        lines.push(buildTable2String(acc, cfp));
        h3('2. 假设和局限性说明（可选项）');
        p(content.assumptions);
        h3('3. 改进建议');
        p(content.improvements);

        return lines.join('\n');
    }

    function buildReportDocNode(report, acc) {
        const cfp = computeTrainCfp(acc);
        const doc = el('div', { style: RPT_STYLE.wrap });
        doc.appendChild(el('div', { style: 'text-align:center;padding:50px 0 60px;page-break-after:always;' }, [
            el('h1', { style: RPT_STYLE.h1 }, [
                (acc && acc.productName ? acc.productName : '') + '产品碳足迹报告'
            ]),
            el('div', { style: 'font-size:14pt;margin-bottom:40px;color:#374151;' }, ['（模板）']),
            el('div', { style: 'height:80px;' }, []),
            // 封面 4 项
            el('div', { style: 'margin:0 auto;display:inline-block;text-align:left;line-height:40px;' }, [
                kvInline('产 品 名 称', (acc && acc.productName) || ''),
                kvInline('产品规格型号', (acc && acc.specModel) || ''),
                kvInline('生 产 者 名 称', report.basic.enterpriseOrg || (acc && acc.enterprise) || ''),
                kvInline('报 告 编 号', report.basic.reportNo || '')
            ]),
            el('div', { style: 'height:60px;' }, []),
            el('div', { style: 'text-align:left;margin:0 auto;display:inline-block;' }, [
                kvInline('出具报告机构', report.basic.enterpriseOrg || (acc && acc.enterprise) || '', true),
                kvInline('日　　　期', (function() {
                    const d = report.basic.reportDate || rptToday();
                    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    return m ? (m[1] + ' 年 ' + m[2] + ' 月 ' + m[3] + ' 日') : d;
                })(), true)
            ])
        ]));

        function kvInline(label, val, noUnderline) {
            const labelTd = el('span', { style: RPT_STYLE.coverLabel }, [label + '：']);
            const valTd = noUnderline
                ? el('span', { style: 'color:#374151;' }, [val || '—'])
                : el('span', { style: RPT_STYLE.coverUnderline }, [val || '—', '　']);
            return el('div', { style: RPT_STYLE.coverRow }, [labelTd, valTd]);
        }

        // 章节
        function renderNode(node, depth) {
            const frag = el('div');
            if (node.title) {
                if (depth === 0) frag.appendChild(el('h2', { style: RPT_STYLE.h2 }, [node.title]));
                else if (depth === 1) frag.appendChild(el('h3', { style: RPT_STYLE.h3 }, [node.title]));
                else frag.appendChild(el('h4', { style: RPT_STYLE.h4 }, [node.title]));
            }
            if (node.kind === 'kv') {
                frag.appendChild(el('div', { style: 'margin:6px 0;' }, [
                    el('span', { style: 'display:inline-block;width:140px;font-weight:600;' }, [node.label + '：']),
                    el('span', {}, [reportContentGet(report.content, node.field) || '—'])
                ]));
            } else if (node.kind === 'text') {
                frag.appendChild(el('p', { style: RPT_STYLE.p, html: reportTextHtml(reportContentGet(report.content, node.field)) }, []));
            } else if (node.kind === 'checkboxes') {
                const line = REPORT_SYS_BOUNDARY_CHECKS.map(it => {
                    const checked = !!(report.content.sysBoundaryChecks && report.content.sysBoundaryChecks[it.key]);
                    return (checked ? '■' : '□') + ' ' + it.label;
                }).join('　');
                frag.appendChild(el('p', { style: RPT_STYLE.p, html: reportTextHtml(line) }, []));
            } else if (node.kind === 'table1') {
                frag.appendChild(buildReportTable1Node(acc));
            } else if (node.kind === 'table2') {
                frag.appendChild(buildReportTable2Node(acc, cfp));
            } else if (node.field) {
                frag.appendChild(el('p', { style: RPT_STYLE.p, html: reportTextHtml(reportContentGet(report.content, node.field)) }, []));
            }
            if (node.children) node.children.forEach(ch => frag.appendChild(renderNode(ch, depth + 1)));
            return frag;
        }
        REPORT_TEMPLATE.forEach(node => { if (node.kind !== 'cover') doc.appendChild(renderNode(node, 0)); });
        return doc;
    }

    function buildReportFullHtml(report, acc, mode) {
        // Word 专用：Office 命名空间 + mso-header/footer + 中文字体 face
        const officeNs = 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"';
        const header = mode === 'word' ? '<html ' + officeNs + '>' : '<html>';
        // DOM 版 body（浏览器预览、Word、PDF 通用）
        const holder = el('div', {});
        holder.appendChild(buildReportDocNode(report, acc));
        const bodyHtml = holder.innerHTML;
        const autoPrint = mode === 'print'
            ? '<script>window.onload=function(){setTimeout(function(){try{window.focus();}catch(e){}window.print();},1200);};<' + '/script>'
            : '';
        const meta1 = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">';
        const meta2 = '<meta charset="utf-8">';
        const title = escapeReportHtml((report.basic && report.basic.reportName) || '产品碳足迹报告');
        const css = (mode === 'word'
            // Word 导出样式（mso- 系列专用属性 + 中文字体名）
            ? '@page{mso-page-orientation:portrait;margin:2.54cm 3.17cm 2.54cm 3.17cm;mso-header-margin:1.2cm;mso-footer-margin:1.2cm;}' +
                'body{font-family:SimSun,"Songti SC","MS Song",serif;color:#000;font-size:12pt;line-height:22px;margin:0;padding:0;mso-line-height-rule:exactly;mso-pagination:widow-orphan;}' +
                'h1{font-size:22pt;text-align:center;mso-line-height-rule:exactly;}' +
                'h2{font-size:16pt;page-break-before:always;margin:18pt 0 8pt;}' +
                'h3{font-size:14pt;margin:12pt 0 6pt;page-break-after:avoid;}' +
                'table{border-collapse:collapse;width:100%;page-break-inside:avoid;font-size:11pt;}' +
                'td,th{border:1px solid #000;padding:5pt 6pt;mso-number-format:"\\@";}' +
                'th{background:#f3f4f6;font-weight:700;text-align:center;}' +
                'p{text-indent:2em;margin:6pt 0;line-height:22px;text-align:justify;}'
            // PDF 打印样式
            : '@page{size:A4;margin:25mm 20mm;}' +
                'body{font-family:SimSun,"Songti SC","MS Song","宋体",Arial Unicode MS,"Times New Roman",serif;color:#111;font-size:12pt;line-height:22px;margin:0;padding:0;}' +
                'h1{font-size:22pt;text-align:center;margin:0 0 12pt;}' +
                'h2{font-size:16pt;font-weight:700;margin:22pt 0 8pt;page-break-before:always;}' +
                'h3{font-size:14pt;font-weight:700;margin:16pt 0 6pt;page-break-after:avoid;}' +
                'h4{font-size:13pt;font-weight:700;margin:10pt 0 4pt;}' +
                'table{border-collapse:collapse;width:100%;page-break-inside:avoid;margin:10pt 0 16pt;}' +
                'td,th{border:1px solid #000;padding:4pt 6pt;}' +
                'th{background:#f3f4f6;font-weight:700;text-align:center;}' +
                'p{text-indent:2em;margin:6pt 0;line-height:22px;text-align:justify;}'
        );
        return '<!DOCTYPE html>' + header + '<head>' + meta1 + meta2 +
            '<title>' + title + '</title>' +
            mode === 'word' ? '<style><!-- /* Word 友好：避免 MSIE 条件注释被解析 */--></style>' : '' +
            '<style>' + css + '</style></head><body>' + bodyHtml + autoPrint + '</body></html>';
    }

    function rptSanitizeFileName(name) {
        return String(name || '碳足迹报告').replace(/[\\/:*?"<>|]/g, '_');
    }

    function downloadReportWord(report, acc) {
        const html = buildReportFullHtml(report, acc, 'word');
        const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rptSanitizeFileName((report.basic && report.basic.reportName) || '碳足迹报告') + '.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function printReportPdf(report, acc) {
        const html = buildReportFullHtml(report, acc, 'print');
        const win = window.open('', '_blank');
        if (!win) {
            openConfirmModal('提示', '浏览器拦截了打印窗口，请允许本页面弹出窗口后重试（在打印对话框中选择"另存为 PDF"即可导出）。', () => {});
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    /* ============ 启动 ============ */
    function init() {
        initSidebar();
        window.addEventListener('hashchange', router);
        router();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
