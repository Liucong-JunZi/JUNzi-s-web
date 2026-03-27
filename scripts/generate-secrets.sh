#!/bin/bash

# 安全密钥生成脚本
# 用于生成生产环境所需的强密钥

set -e

echo "================================"
echo "安全密钥生成工具"
echo "================================"
echo ""

# 检查 openssl 是否安装
if ! command -v openssl &> /dev/null; then
    echo "错误: 需要安装 openssl"
    echo "macOS: brew install openssl"
    echo "Ubuntu/Debian: sudo apt-get install openssl"
    echo "CentOS/RHEL: sudo yum install openssl"
    exit 1
fi

echo "生成安全密钥..."
echo ""

# 生成密钥
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
MINIO_ACCESS_KEY=$(openssl rand -hex 16)
MINIO_SECRET_KEY=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

echo "将以下内容添加到你的 .env 文件："
echo ""
echo "DB_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo "MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY"
echo "MINIO_SECRET_KEY=$MINIO_SECRET_KEY"
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# 可选：自动更新 .env 文件
if [ -f .env ]; then
    read -p "是否自动更新现有的 .env 文件？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 备份原文件
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

        # 更新密钥
        sed -i.bak "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
        sed -i.bak "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
        sed -i.bak "s/^MINIO_ACCESS_KEY=.*/MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY/" .env
        sed -i.bak "s/^MINIO_SECRET_KEY=.*/MINIO_SECRET_KEY=$MINIO_SECRET_KEY/" .env
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

        # 删除临时备份文件
        rm -f .env.bak

        echo ""
        echo "✓ .env 文件已更新"
        echo "✓ 原文件已备份为 .env.backup.*"
    fi
else
    echo "提示: .env 文件不存在"
    echo "运行 'make init-env' 从 .env.example 创建"
fi

echo ""
echo "================================"
echo "安全建议："
echo "1. 确保 .env 文件不被提交到版本控制"
echo "2. 定期更换这些密钥"
echo "3. 在生产环境中使用不同的密钥"
echo "================================"