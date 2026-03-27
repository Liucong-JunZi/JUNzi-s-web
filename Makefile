.PHONY: help build up down logs restart clean ps

# 默认目标
.DEFAULT_GOAL := help

# ==================== 帮助信息 ====================
help: ## 显示帮助信息
	@echo "可用命令:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ==================== Docker Compose 命令 ====================
build: ## 构建所有服务
	docker-compose build

up: ## 启动所有服务
	docker-compose up -d

down: ## 停止所有服务
	docker-compose down

logs: ## 查看日志 (Ctrl+C 退出)
	docker-compose logs -f

restart: ## 重启所有服务
	docker-compose restart

ps: ## 查看服务状态
	docker-compose ps

# ==================== 清理命令 ====================
clean: ## 清理所有容器、网络和卷
	docker-compose down -v --remove-orphans
	@echo "清理完成"

# ==================== 单独服务命令 ====================
backend-logs: ## 查看 backend 日志
	docker-compose logs -f backend

frontend-logs: ## 查看 frontend 日志
	docker-compose logs -f frontend

mysql-logs: ## 查看 MySQL 日志
	docker-compose logs -f mysql

redis-logs: ## 查看 Redis 日志
	docker-compose logs -f redis

minio-logs: ## 查看 MinIO 日志
	docker-compose logs -f minio

# ==================== 数据库命令 ====================
mysql-cli: ## 进入 MySQL 命令行
	docker-compose exec mysql mysql -uroot -p$(shell grep DB_PASSWORD .env 2>/dev/null | cut -d'=' -f2 || echo "root123456")

redis-cli: ## 进入 Redis 命令行
	docker-compose exec redis redis-cli

# ==================== 开发命令 ====================
dev-backend: ## 本地开发后端
	cd backend && go run cmd/api/main.go

dev-frontend: ## 本地开发前端
	cd frontend && pnpm dev

# ==================== 构建单独服务 ====================
build-backend: ## 只构建后端
	docker-compose build backend

build-frontend: ## 只构建前端
	docker-compose build frontend

# ==================== 部署命令 ====================
deploy: build up ## 部署 (构建并启动)
	@echo "部署完成"
	@echo "前端: http://localhost"
	@echo "后端 API: http://localhost:8080"
	@echo "MinIO 控制台: http://localhost:9001"

# ==================== 备份命令 ====================
backup-mysql: ## 备份 MySQL 数据
	docker-compose exec mysql mysqldump -uroot -p$(shell grep DB_PASSWORD .env 2>/dev/null | cut -d'=' -f2 || echo "root123456") personal_website > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "备份完成"

# ==================== 健康检查 ====================
health: ## 检查服务健康状态
	@echo "检查服务健康状态..."
	@curl -s http://localhost/health && echo " - Frontend: OK" || echo " - Frontend: FAILED"
	@curl -s http://localhost:8080/health && echo " - Backend: OK" || echo " - Backend: FAILED"
