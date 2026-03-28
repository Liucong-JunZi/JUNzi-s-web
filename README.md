# JUNzi Web

个人网站 — 博客、作品集、简历。基于 React + Go + Docker 的一键部署方案。

## 功能特性

- **博客系统** — Markdown 写作、分类/标签、点赞、评论
- **作品集** — 项目展示与管理
- **简历模块** — 在线简历编辑与展示
- **GitHub OAuth 登录** — 无需注册，GitHub 账号直接登录
- **管理后台** — 文章、项目、评论、分类、标签、站点设置一站式管理
- **图片上传** — MinIO 对象存储，支持图片与文件上传
- **暗黑模式** — 跟随系统或手动切换
- **安全防护** — CSRF、XSS、SQL 注入防护、速率限制、审计日志
- **Docker 一键部署** — Docker Compose 编排，包含完整基础设施

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| 后端 | Go + Gin + GORM |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7.4 |
| 对象存储 | MinIO (S3 兼容) |
| 认证 | GitHub OAuth + JWT (HttpOnly Cookie) |
| 反向代理 | Nginx |
| 部署 | Docker Compose |

## 快速开始

### 环境要求

- Docker & Docker Compose
- (本地开发需要: Go 1.21+, Node.js 20+, pnpm)

### 1. 克隆项目

```bash
git clone https://github.com/liucong/JUNziweb.git
cd JUNziweb
```

### 2. 配置环境变量

```bash
# 从模板创建 .env 文件
make init-env

# 生成随机密钥（复制输出到 .env 文件中替换 <CHANGE_ME>）
make generate-secrets
```

**必须配置的变量：**

| 变量 | 说明 | 生成方式 |
|------|------|----------|
| `DB_PASSWORD` | MySQL 密码 | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis 密码 | `openssl rand -base64 32` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `openssl rand -hex 16` |
| `MINIO_SECRET_KEY` | MinIO 密钥 | `openssl rand -base64 32` |
| `JWT_SECRET` | JWT 签名密钥 (≥32 字符) | `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID | [创建地址](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App 密钥 | 同上 |

**可选配置：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FRONTEND_PORT` | `80` | 前端对外端口 |
| `GIN_MODE` | `release` | Gin 运行模式 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost` | CORS 允许的源（逗号分隔） |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | MinIO 公开访问地址 |

### 3. 配置 GitHub OAuth

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写：
   - **Application name**: `JUNzi Web`
   - **Homepage URL**: `http://your-domain`
   - **Authorization callback URL**: `http://your-domain/api/auth/github/callback`
4. 获取 `Client ID` 和 `Client Secret`，填入 `.env`

### 4. 启动服务

```bash
make deploy
```

服务启动后访问 `http://localhost` 即可。

首次启动需要等待健康检查通过（约 30-60 秒）。

### 5. 设置管理员

首次通过 GitHub OAuth 登录后，需要在数据库中手动将用户角色设为管理员：

```bash
make mysql-cli
```

```sql
UPDATE users SET role = 'admin' WHERE username = 'your-github-username';
```

退出后即可访问管理后台 `http://localhost/admin`。

---

## 本地开发

### 后端

```bash
cd backend
cp .env.example .env   # 编辑配置
go mod tidy
go run cmd/api/main.go
```

后端运行在 `http://localhost:8080`。

### 前端

```bash
cd frontend
cp .env.example .env   # 默认 VITE_API_URL=http://localhost:8080/api
pnpm install
pnpm dev
```

前端运行在 `http://localhost:5173`，API 请求代理到后端。

### 同时开发前后端

需要本地运行 MySQL、Redis、MinIO（可用 Docker 单独启动基础设施）：

```bash
# 只启动数据库、缓存、存储
docker-compose up -d mysql redis minio

# 终端 1 — 后端
cd backend && go run cmd/api/main.go

# 终端 2 — 前端
cd frontend && pnpm dev
```

---

## 生产部署

### HTTPS 配置

项目默认监听 HTTP (80 端口)。生产环境推荐以下方式之一启用 HTTPS：

**方案一：外部反向代理（推荐）**

使用 Cloudflare、AWS ALB、Nginx Proxy Manager 等进行 TLS 终止：

```
用户 ──HTTPS──▸ Cloudflare ──HTTP──▸ 你的服务器:80
```

此方案下 Nginx 的 HSTS 头会确保浏览器始终使用 HTTPS。

**方案二：Nginx 直接启用 HTTPS**

1. 获取 TLS 证书（如 Let's Encrypt）
2. 将证书放入 `docker/nginx/ssl/` 目录
3. 编辑 `docker/nginx/nginx.conf`：取消注释 HTTPS server block 和 HTTP→HTTPS redirect block
4. 在 `docker-compose.yml` 的 frontend 服务中挂载证书：

```yaml
frontend:
  volumes:
    - ./docker/nginx/ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
    - ./docker/nginx/ssl/key.pem:/etc/nginx/ssl/key.pem:ro
  ports:
    - "80:80"
    - "443:443"
```

5. 重新构建并启动：

```bash
make deploy
```

### 环境变量检查清单

生产部署前确认以下配置：

- [ ] 所有 `<CHANGE_ME>` 占位符已替换为真实密钥
- [ ] `GITHUB_CALLBACK_URL` 已改为实际域名
- [ ] `CORS_ALLOWED_ORIGINS` 已改为实际域名
- [ ] `FRONTEND_URL` 已改为实际域名（默认从环境变量读取）
- [ ] `MINIO_PUBLIC_URL` 已改为实际访问地址
- [ ] `JWT_SECRET` 至少 32 字符，包含大小写字母、数字和特殊字符
- [ ] 未使用 `minioadmin` 等默认凭据

### 数据库迁移

生产环境默认**不执行**自动迁移（防止意外变更表结构）。首次部署需要手动初始化：

```bash
# 方式一：启动时显式开启自动迁移
AUTO_MIGRATE=true make deploy

# 方式二：手动导入建表 SQL
make mysql-cli < docker/mysql/init.sql
```

### 备份与恢复

```bash
# 备份数据库
make backup-mysql

# 恢复数据库
docker-compose exec -T mysql mysql -uroot -p<password> personal_website < backup_xxx.sql
```

### 审计日志

后端支持结构化 JSON 审计日志，自动记录安全事件（登录、CSRF 拒绝、越权尝试等）。

**告警规则（内置）：**

| 事件 | 阈值 | 时间窗口 |
|------|------|----------|
| 登录失败 | 5 次 | 5 分钟 |
| CSRF 拒绝 | 10 次 | 5 分钟 |
| 管理员越权 | 3 次 | 10 分钟 |
| 已注销令牌复用 | 1 次 | 1 小时 |
| Origin 拒绝 | 10 次 | 5 分钟 |

**配置方式：**

```bash
# 审计日志落盘（默认只输出到 stdout）
AUDIT_LOG_FILE=/var/log/audit.json

# Webhook 告警通知（触发阈值时 POST JSON 到此 URL）
AUDIT_ALERT_WEBHOOK=https://your-webhook.example.com/alerts
```

---

## Makefile 命令速查

| 命令 | 说明 |
|------|------|
| `make help` | 显示所有可用命令 |
| `make init-env` | 从模板创建 `.env` 文件 |
| `make generate-secrets` | 生成随机密钥 |
| `make deploy` | 构建并启动所有服务 |
| `make build` | 构建所有镜像 |
| `make up` | 启动服务 |
| `make down` | 停止服务 |
| `make logs` | 查看所有日志 |
| `make ps` | 查看服务状态 |
| `make health` | 健康检查 |
| `make clean` | 清理所有容器和卷 |
| `make backup-mysql` | 备份数据库 |
| `make dev-backend` | 本地运行后端 |
| `make dev-frontend` | 本地运行前端 |
| `make mysql-cli` | 进入 MySQL 命令行 |
| `make redis-cli` | 进入 Redis 命令行 |
| `make security-audit` | 运行安全审计 (govulncheck + npm audit) |

---

## 项目结构

```
.
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── api/               # API 请求层
│   │   ├── components/        # 通用组件 + shadcn/ui
│   │   ├── views/             # 页面组件
│   │   │   └── admin/         # 管理后台页面
│   │   ├── store/             # Zustand 状态管理
│   │   ├── hooks/             # 自定义 Hooks
│   │   └── types/             # TypeScript 类型定义
│   └── Dockerfile             # 多阶段构建 (Node → Nginx)
├── backend/                   # Go 后端
│   ├── cmd/api/main.go        # 入口
│   └── internal/
│       ├── audit/             # 审计日志 + 告警
│       ├── cache/             # Redis 缓存
│       ├── config/            # 配置加载与校验
│       ├── controllers/       # 控制器层
│       ├── database/          # 数据库连接
│       ├── middleware/        # 中间件 (Auth, CSRF, 限流, CORS)
│       ├── models/            # 数据模型
│       ├── routes/            # 路由定义
│       └── storage/           # MinIO 存储
├── docker/
│   ├── nginx/nginx.conf       # Nginx 配置
│   ├── mysql/init.sql         # 数据库初始化
│   ├── backend/Dockerfile     # 后端镜像
│   └── frontend/Dockerfile    # 前端镜像
├── docker-compose.yml         # 服务编排
├── Makefile                   # 常用命令
└── .env.example               # 环境变量模板
```

---

## 网络架构

```
                        ┌──────────────┐
                        │   Internet   │
                        └──────┬───────┘
                               │ :80/:443
                        ┌──────▼───────┐
                        │   Frontend   │  (Nginx + React SPA)
                        │  junzi-frontend  │
                        └──────┬───────┘
                               │ junzi-frontend network
                        ┌──────▼───────┐
                        │   Backend    │  (Go API :8080)
                        │  junzi-backend   │
                        └──┬───┬───┬───┘
               junzi-backend network
                  ┌───────┼───┼───┼───────┐
           ┌──────▼──┐ ┌──▼───┐ ┌▼──────┐
           │  MySQL  │ │Redis │ │ MinIO │
           │  :3306  │ │:6379 │ │ :9000 │
           └─────────┘ └──────┘ └───────┘
```

- **junzi-frontend** 网络：前端只能访问后端
- **junzi-backend** 网络：后端访问 MySQL、Redis、MinIO
- 前端容器**无法**直接访问数据库、缓存和对象存储

---

## API 概览

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/posts` | 文章列表（分页） |
| GET | `/api/posts/:slug` | 文章详情 |
| POST | `/api/posts/:id/like` | 点赞文章 |
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:id` | 项目详情 |
| GET | `/api/resume` | 简历列表 |
| GET | `/api/posts/:slug/comments` | 评论列表 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/tags` | 标签列表 |
| GET | `/api/settings/public` | 公开站点设置 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/github` | 跳转 GitHub OAuth |
| GET | `/api/auth/github/callback` | OAuth 回调 |
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/logout` | 登出 |

### 认证用户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/comments` | 发表评论 |

### 管理员接口

需 GitHub OAuth 登录 + admin 角色 + CSRF Token。

| 方法 | 路径 | 说明 |
|------|------|------|
| CRUD | `/api/admin/posts` | 文章管理 |
| CRUD | `/api/admin/projects` | 项目管理 |
| CRUD | `/api/admin/resume` | 简历管理 |
| CRUD | `/api/admin/comments` | 评论管理 |
| CRUD | `/api/admin/categories` | 分类管理 |
| CRUD | `/api/admin/tags` | 标签管理 |
| GET/PUT | `/api/admin/settings` | 站点设置 |
| POST | `/api/admin/upload` | 文件上传 |
| POST | `/api/admin/upload/image` | 图片上传 |

---

## 常见问题

### 登录后没有管理员权限

首次登录需要在数据库手动设置管理员角色：

```bash
make mysql-cli
```

```sql
UPDATE users SET role = 'admin' WHERE username = 'your-github-username';
```

### 如何查看服务日志

```bash
make logs              # 所有服务
make backend-logs      # 仅后端
make frontend-logs     # 仅前端
```

### 如何重置数据

```bash
make clean             # 停止服务并删除所有数据卷
make deploy            # 重新启动
```

### 如何升级依赖

项目配置了 Dependabot，每周自动检查依赖更新。也可手动运行：

```bash
make security-audit    # 检查已知漏洞
```

### MinIO 图片无法访问

检查 `MINIO_PUBLIC_URL` 是否正确配置。Docker 部署时需要设为外部可访问的地址。

---

## License

MIT
