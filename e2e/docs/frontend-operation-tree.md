# Frontend 操作树（固定文档）

最后更新：2026-03-29  
适用范围：`frontend/src` 路由与可交互元素（用于 Playwright 用例设计）

## 1) 状态节点

- `S0 匿名用户`：未登录
- `S1 普通用户`：已登录，`role=user`
- `S2 管理员`：已登录，`role=admin`

## 2) 全局操作树（状态机）

```mermaid
flowchart TD
  S0[S0 匿名用户] -->|点击登录 / OAuth回调成功| S1[S1 普通用户]
  S0 -->|管理员测试登录/正式管理员登录| S2[S2 管理员]

  S1 -->|登出| S0
  S2 -->|登出| S0

  S0 -->|访问 /admin*| L1[/login]
  S1 -->|访问 /admin*| H1[/]
  S2 -->|访问 /admin*| A1[Admin Dashboard]

  S1 -->|发评论| C1[评论待审核]
  S2 -->|审核评论 approved| C2[评论公开可见]
  S2 -->|审核评论 rejected/delete| C3[评论不可见/已删除]

  S2 -->|文章创建/编辑/删除| P1[Posts 变更]
  S2 -->|项目创建/编辑/删除| P2[Projects 变更]
  S2 -->|简历条目创建/编辑/删除| P3[Resume 变更]

  S1 -->|access_token 过期 + refresh 成功| S1
  S2 -->|access_token 过期 + refresh 成功| S2
  S1 -->|refresh 失败| S0
  S2 -->|refresh 失败| S0
```

## 3) 页面级操作节点（可直接映射 Playwright）

### 3.1 公共导航与登录

- `OP-001` 顶部导航：`/`、`/blog`、`/portfolio`、`/resume`
- `OP-002` 顶部主题切换按钮（light/dark/system）
- `OP-003` 未登录点击 `data-testid=login-btn` 跳转 `/login`
- `OP-004` 登录页点击 `data-testid=github-login-btn` 触发 OAuth
- `OP-005` OAuth 回调后 `auth/me` 成功，跳转 `redirectAfterLogin`
- `OP-006` 已登录点击 `data-testid=user-avatar` 打开菜单
- `OP-007` 点击 `data-testid=logout-btn` 登出并回到未登录态
- `OP-008` 管理员点击 `data-testid=dashboard-link` 跳转 `/admin`
- `OP-009` 移动端点击菜单按钮（展开/收起）
- `OP-010` 移动端点击导航项后菜单自动收起
- `OP-011` 移动端点击 `login-btn` / `logout-btn`

### 3.2 首页入口（Home）

- `OP-051` Hero 区点击 `Read Blog`
- `OP-052` Hero 区点击 `View Portfolio`
- `OP-053` Feature 卡片点击 `Read Articles` / `View Projects`
- `OP-054` Feature 卡片点击 `View Resume`

### 3.3 页脚入口（Footer）

- `OP-061` Quick Links：`/`、`/blog`、`/portfolio`、`/resume`
- `OP-062` Categories：`/blog?tag=technology|programming|design|life`
- `OP-063` 社交外链：GitHub / Twitter / LinkedIn
- `OP-064` 邮件入口：`mailto:hello@example.com`

### 3.4 Blog 与文章详情

- `OP-101` Blog 搜索输入 + 提交
- `OP-102` 清空 tag 过滤（Clear filter）
- `OP-103` 点击文章卡片进入 `/blog/:slug`
- `OP-104` Blog 分页 Previous/Next
- `OP-105` 文章页点击 `data-testid=like-btn`
- `OP-106` 已登录填写 `data-testid=comment-textarea`
- `OP-107` 已登录点击 `data-testid=comment-submit-btn` 提交评论
- `OP-108` 未登录点击评论区 login 链接跳转 `/login`
- `OP-109` 评论列表点击 Load More Comments

### 3.5 Portfolio 与详情

- `OP-201` 列表页点击 `Details` 进入 `/portfolio/:id`
- `OP-202` 点击 `Code` 外链 GitHub
- `OP-203` 点击 `Demo` 外链 Demo URL
- `OP-204` 详情页返回 `/portfolio`

### 3.6 Resume（公开）

- `OP-301` 点击 Download 按钮下载 `resume.md`

### 3.7 Admin Dashboard（仅 S2）

- `OP-401` 访问 `/admin` 展示 `data-testid=admin-dashboard`
- `OP-402` 点击 `Create Post` 跳转 `/admin/posts/new`
- `OP-403` 点击 `Manage Posts`（`data-testid=manage-posts-action`）
- `OP-404` 点击 `Manage Projects` / `Manage Comments` / `Edit Resume`

### 3.8 Admin Posts（仅 S2）

- `OP-501` 访问 `/admin/posts` 展示 `data-testid=admin-posts-page`
- `OP-502` 点击 `data-testid=new-post-btn` 新建文章
- `OP-503` 编辑：`data-testid=edit-post-btn-{id}`
- `OP-504` 删除：`data-testid=delete-post-btn-{id}` + confirm
- `OP-505` 预览文章（Eye 按钮）
- `OP-506` 空态点击 `Create your first post`

### 3.9 PostEditor（仅 S2）

- `OP-601` `data-testid=post-title-input` 输入标题
- `OP-602` `data-testid=post-slug-input` 输入 slug（新建时自动生成可验证）
- `OP-603` `data-testid=post-content-input` 输入 Markdown
- `OP-604` `data-testid=post-summary-input` 输入摘要
- `OP-605` `data-testid=post-status-select` 选择 draft/published
- `OP-606` `data-testid=post-save-btn` 保存
- `OP-607` `data-testid=cover-image-upload` 上传封面
- `OP-608` 点击 tag Badge 选择/取消标签
- `OP-609` 点击 `Back to Posts` 返回列表

### 3.10 Admin Comments（仅 S2）

- `OP-701` 访问 `/admin/comments` 展示 `data-testid=admin-comments-page`
- `OP-702` 审核通过：`data-testid=approve-comment-btn-{id}`
- `OP-703` 审核拒绝：`data-testid=reject-comment-btn-{id}`
- `OP-704` 删除：`data-testid=delete-comment-btn-{id}`
- `OP-705` 查看评论状态：`data-testid=comment-status-{id}`
- `OP-706` 分页 Previous/Next
- `OP-707` 点击 `View Post` 跳转对应文章

### 3.11 Admin Projects（仅 S2）

- `OP-801` 访问 `/admin/projects`
- `OP-802` 新建项目 `/admin/projects/new`
- `OP-803` 编辑项目 `/admin/projects/:id`
- `OP-804` 删除项目 + confirm
- `OP-805` 查看公开项目详情（Eye）
- `OP-806` 空态点击 `Create your first project`

### 3.12 ProjectEditor（仅 S2）

- `OP-901` 填写标题/描述/技术栈/demo/github
- `OP-902` 选择状态（active/planning/in_progress/completed/archived）
- `OP-903` 设置 sortOrder
- `OP-904` 上传封面图
- `OP-905` 点击保存（新建或更新）
- `OP-906` 点击 `Back to Projects` 返回列表

### 3.13 Admin Resume（仅 S2）

- `OP-1001` 新增简历条目（表单提交）
- `OP-1002` 编辑条目（Edit）
- `OP-1003` 删除条目（Trash）
- `OP-1004` 取消编辑（Cancel）

### 3.14 404 与回退路径

- `OP-1101` 404 页面点击 `Go Home`
- `OP-1102` 404 页面点击 `Go Back`（`window.history.back()`）

## 4) 建议的 Playwright 优先级映射

- `P0`（每次 PR）：
  - `S0 -> /admin -> /login` 路由保护
  - `S1 -> /admin -> /` 权限拦截
  - `S2` 登录后访问 `/admin/posts` 成功
  - `S2` 登出后 `/api/auth/me` 返回 401
  - `S1` 文章评论提交 201
  - `S2` 评论审核 approved 后公开可见

- `P1`（每日）：
  - token refresh 链路（清 access_token 后页面恢复）
  - PostEditor 创建/更新（含状态切换）
  - Admin Comments reject/delete 分支
  - 移动端导航展开/收起与登录态分支
  - Footer 分类与外链可达性
  - Portfolio/Resume 关键交互（详情、下载）

- `P2`（发布前）：
  - 上传图片链路（post/project）
  - 管理后台分页、空态、边界输入
  - 404 回退与历史栈场景
  - 多角色切换与重定向保持（redirectAfterLogin）

## 5) 固定维护规则

- 本文档是固定路径：`e2e/docs/frontend-operation-tree.md`
- 新增前端交互元素时，必须同步新增 `OP-*` 节点
- 新增 `data-testid` 时，优先绑定到 `OP-*` 节点再写测试
