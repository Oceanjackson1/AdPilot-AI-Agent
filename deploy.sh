#!/bin/bash
# ============================================
# AdPilot 腾讯云部署脚本
# 在腾讯云服务器上执行此脚本
# ============================================

set -e

echo "=== AdPilot 部署开始 ==="

# ---- 1. 安装 Docker（如果未安装）----
if ! command -v docker &> /dev/null; then
    echo ">> 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo ">> Docker 安装完成"
fi

# ---- 2. 拉取代码 ----
APP_DIR="/opt/adpilot"
if [ -d "$APP_DIR" ]; then
    echo ">> 更新代码..."
    cd "$APP_DIR"
    git pull origin main
else
    echo ">> 克隆代码..."
    git clone https://github.com/Oceanjackson1/AdPilot-AI-Agent.git "$APP_DIR"
    cd "$APP_DIR"
fi

# ---- 3. 检查环境变量 ----
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo ""
    echo "=========================================="
    echo "  请先创建 .env.production 文件！"
    echo "=========================================="
    echo ""
    echo "运行以下命令："
    echo "  nano /opt/adpilot/.env.production"
    echo ""
    echo "写入以下内容（替换为你的真实值）："
    echo "  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co"
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci..."
    echo "  DEEPSEEK_API_KEY=sk-..."
    echo ""
    echo "保存后重新运行此脚本。"
    exit 1
fi

# 加载环境变量
source "$APP_DIR/.env.production"

# ---- 4. 构建 Docker 镜像 ----
echo ">> 构建 Docker 镜像..."
docker build \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -t adpilot:latest .

# ---- 5. 停止旧容器 ----
echo ">> 停止旧容器..."
docker stop adpilot 2>/dev/null || true
docker rm adpilot 2>/dev/null || true

# ---- 6. 启动新容器 ----
echo ">> 启动新容器..."
docker run -d \
    --name adpilot \
    --restart unless-stopped \
    -p 3000:3000 \
    --env-file "$APP_DIR/.env.production" \
    adpilot:latest

echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://$(curl -s ifconfig.me):3000"
echo ""
echo "查看日志: docker logs -f adpilot"
echo ""
