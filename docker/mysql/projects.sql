-- Portfolio content synchronized from Liucong-JunZi's public GitHub repositories.
-- Safe to run repeatedly. Existing matching records are updated by github_url.

USE personal_website;

UPDATE projects
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
  AND title = '英伟达推理比赛'
  AND deleted_at IS NULL;

UPDATE projects
SET title = 'CUDA 图最短环计算',
    description = '基于 CUDA 的大规模无向图最短环（girth）精确计算工具，使用多源并行 BFS、CSR 图存储和提前终止，在 RTX 3090 上相较 NetworkX 最高获得 4,299 倍加速。',
    content = '这是一个面向大规模无向图的 CUDA 加速精确 girth 计算工具。项目实现了 CSR 图存储、多源锁步 BFS、跨线程块竞态安全的非树边检测和提前终止，并提供 C++、CUDA 与 Python 接口。\n\n基准测试覆盖 56 张图，结果全部通过正确性验证；在 RTX 3090 上相较 NetworkX 的几何平均加速为 121 倍，最高为 4,299 倍。',
    tech_stack = 'CUDA, C++, Python, NetworkX',
    status = 'active',
    sort_order = 1,
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE github_url = 'https://github.com/Liucong-JunZi/cuda-girth';

INSERT INTO projects (title, description, content, github_url, tech_stack, status, sort_order)
SELECT
    'CUDA 图最短环计算',
    '基于 CUDA 的大规模无向图最短环（girth）精确计算工具，使用多源并行 BFS、CSR 图存储和提前终止，在 RTX 3090 上相较 NetworkX 最高获得 4,299 倍加速。',
    '这是一个面向大规模无向图的 CUDA 加速精确 girth 计算工具。项目实现了 CSR 图存储、多源锁步 BFS、跨线程块竞态安全的非树边检测和提前终止，并提供 C++、CUDA 与 Python 接口。\n\n基准测试覆盖 56 张图，结果全部通过正确性验证；在 RTX 3090 上相较 NetworkX 的几何平均加速为 121 倍，最高为 4,299 倍。',
    'https://github.com/Liucong-JunZi/cuda-girth',
    'CUDA, C++, Python, NetworkX',
    'active',
    1
WHERE NOT EXISTS (
    SELECT 1 FROM projects
    WHERE github_url = 'https://github.com/Liucong-JunZi/cuda-girth'
      AND deleted_at IS NULL
);

UPDATE projects
SET title = 'AIMO3 数学奥赛 AI 竞赛 · 铜牌',
    description = '参加 Kaggle AI Mathematical Olympiad - Progress Prize 3，使用 AI 模型解决奥赛数学题，获得铜牌，队伍排名 303/4138。',
    content = 'AIMO3 是面向开源 AI 数学推理模型的 Kaggle 竞赛，题目覆盖代数、组合、几何和数论。我的队伍最终获得铜牌，排名 303/4138。\n\n比赛页面保留了成绩和证书入口。',
    demo_url = 'https://www.kaggle.com/competitions/ai-mathematical-olympiad-progress-prize-3',
    github_url = '',
    tech_stack = 'Python, LLM, Kaggle, 数学推理',
    status = 'completed',
    sort_order = 2,
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE title = 'AIMO3 数学奥赛 AI 竞赛 · 铜牌'
  AND deleted_at IS NULL;

INSERT INTO projects (title, description, content, demo_url, github_url, tech_stack, status, sort_order)
SELECT
    'AIMO3 数学奥赛 AI 竞赛 · 铜牌',
    '参加 Kaggle AI Mathematical Olympiad - Progress Prize 3，使用 AI 模型解决奥赛数学题，获得铜牌，队伍排名 303/4138。',
    'AIMO3 是面向开源 AI 数学推理模型的 Kaggle 竞赛，题目覆盖代数、组合、几何和数论。我的队伍最终获得铜牌，排名 303/4138。\n\n比赛页面保留了成绩和证书入口。',
    'https://www.kaggle.com/competitions/ai-mathematical-olympiad-progress-prize-3',
    '',
    'Python, LLM, Kaggle, 数学推理',
    'completed',
    2
WHERE NOT EXISTS (
    SELECT 1 FROM projects
    WHERE title = 'AIMO3 数学奥赛 AI 竞赛 · 铜牌'
      AND deleted_at IS NULL
);
