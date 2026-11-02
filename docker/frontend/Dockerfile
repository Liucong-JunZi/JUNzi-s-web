# For supply chain integrity, pin base images with SHA256 digests.
# Run: ./scripts/pin-docker-digests.sh to get current digests.
# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package 文件
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY frontend/ .

# 构建参数 - API URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# 构建生产版本
RUN pnpm build

# ==================== 生产阶段 ====================
FROM nginx:1.27-alpine AS production

# 复制 nginx 配置（含 SSR 反向代理）
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/ssr_proxy.conf /etc/nginx/ssr_proxy.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
