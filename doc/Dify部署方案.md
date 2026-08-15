# Dify 智能体平台部署方案

| 属性 | 内容 |
|---|---|
| 方案 | Dify Community Edition 自托管（极限优化版） |
| 服务器 | 阿里云 ECS 经济型 e 2核2G / 3M / 40G |
| Dify 版本 | 1.16.0（Community Edition） |
| LLM | 通义千问 qwen-plus（外部 API，不在服务器跑模型） |
| 更新日期 | 2026-08-15 |

---

## 1. 方案选型

### 1.1 为什么选 Dify

- 开源免费，Community Edition 无平台费
- 内置 RAG 管道：文档上传 → 分块 → Embedding → 向量检索 → LLM 生成，全流程可视化
- 支持国内模型：通义千问、DeepSeek、智谱、月之暗面等
- 提供嵌入代码和 REST API，可直接集成到博客前端
- 知识库管理界面友好，非技术人员也能维护

### 1.2 2G 服务器可行性分析

Dify 官方最低要求 4GB RAM（全栈 15 容器，空闲占 3.2G）。通过以下优化可将占用压至 ~2.05G，配合 2G Swap 可运行：

| 优化措施 | 节省内存 | 说明 |
|---|---|---|
| pgvector 替代 Weaviate | ~800MB | 复用 PostgreSQL，去掉独立向量数据库容器 |
| 外部 LLM API | ~2GB+ | 不在服务器跑模型推理，只调 API |
| 禁用 sandbox | ~150MB | 不需要代码执行功能 |
| 禁用 SSRF proxy | ~50MB | 不需要出口代理 |
| 限制容器内存 | 防溢出 | docker-compose 中设置 mem_limit |

### 1.3 优化后内存预估

| 组件 | 预估占用 | 说明 |
|---|---|---|
| OS + Docker daemon | ~400MB | 系统 + 容器运行时 |
| Dify API + Worker | ~800MB | Flask API + Celery worker |
| PostgreSQL + pgvector | ~300MB | 主数据库 + 向量存储 |
| Redis | ~100MB | 缓存 + Celery broker |
| Nginx | ~30MB | 反向代理 |
| Web (Next.js) | ~200MB | Dify 控制台前端 |
| Plugin Daemon | ~200MB | 模型供应商插件运行时 |
| **合计** | **~2.03GB** | 2G 物理 + 2G Swap = 4G，余量充足 |

### 1.4 预期性能

| 指标 | 预估值 | 说明 |
|---|---|---|
| 并发用户 | 1-3 人 | 个人博客足够 |
| 文档索引速度 | ~30-45 页/分钟 | 慢于 4G 服务器但不影响使用 |
| 对话 API 响应 | 200-500ms | 主要取决于通义千问 API 延迟 |
| 冷启动 | ~3 分钟 | docker compose up 后全部就绪 |

---

## 2. 部署前准备

### 2.1 服务器初始化

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker + Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 重新登录使 docker 组生效
exit
# 重新 SSH 登录后验证
docker --version
docker compose version
```

### 2.2 配置 Swap

```bash
# 创建 2G Swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 优化 Swap 策略（降低 swappiness，优先用物理内存）
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 验证
free -h
# 应显示 Swap: 2.0Gi
```

---

## 3. Dify 部署

### 3.1 克隆与配置

```bash
# 克隆 Dify 1.16.0
git clone --depth 1 --branch 1.16.0 https://github.com/langgenius/dify.git
cd dify/docker

# 复制环境配置
cp .env.example .env
```

### 3.2 .env 关键配置

```bash
# ===== 安全配置 =====
SECRET_KEY=$(openssl rand -base64 42)
INIT_PASSWORD=YourStrongPassword123

# ===== 数据库密码 =====
DB_PASSWORD=YourDBPassword456
REDIS_PASSWORD=YourRedisPassword789

# ===== 端口配置（避免与 Nginx 冲突）=====
EXPOSE_NGINX_PORT=3000
EXPOSE_NGINX_SSL_PORT=3443

# ===== 迁移 =====
MIGRATION_ENABLED=true

# ===== 访问 URL（后续填域名）=====
CONSOLE_WEB_URL=http://your_server_ip:3000
APP_WEB_URL=http://your_server_ip:3000
```

### 3.3 切换向量数据库为 pgvector

```bash
# 启用 pgvector 配置
cp envs/vectorstores/pgvector.env.example envs/vectorstores/pgvector.env

# 编辑 pgvector.env，确认配置
# VECTOR_STORE=pgvector
# PGVECTOR_HOST=db_postgres
# PGVECTOR_PORT=5432
# PGVECTOR_USER=postgres
# PGVECTOR_PASSWORD=${DB_PASSWORD}
# PGVECTOR_DATABASE=dify
```

### 3.4 禁用非必要服务

编辑 `docker-compose.yaml`，注释或删除以下服务：

```yaml
# 注释掉 sandbox（代码执行沙箱，博客不需要）
# sandbox:
#   ...
#   profiles:
#     - ""

# 注释掉 SSRF 代理
# ssrf_proxy:
#   ...

# 注释掉 agent_backend（1.16.0 新增，个人用不需要）
# agent_backend:
#   ...

# 注释掉 local_sandbox
# local_sandbox:
#   ...
```

同时在 nginx 配置中移除对 ssrf_proxy 的依赖。

### 3.5 限制容器内存

在 `docker-compose.yaml` 中为每个服务添加内存限制：

```yaml
services:
  api:
    # ... 原有配置
    deploy:
      resources:
        limits:
          memory: 512M
  
  worker:
    deploy:
      resources:
        limits:
          memory: 384M
  
  db_postgres:
    deploy:
      resources:
        limits:
          memory: 384M
  
  redis:
    deploy:
      resources:
        limits:
          memory: 128M
  
  web:
    deploy:
      resources:
        limits:
          memory: 256M
  
  plugin_daemon:
    deploy:
      resources:
        limits:
          memory: 256M
  
  nginx:
    deploy:
      resources:
        limits:
          memory: 64M
```

### 3.6 启动

```bash
# 启动所有容器
docker compose up -d

# 查看容器状态
docker compose ps
# 所有服务应为 Up 或 healthy
# init_permissions 显示 Exited (0) 是正常的

# 查看内存占用
docker stats --no-stream
# 总占用应在 2G 左右

# 访问初始化页面
# http://your_server_ip:3000/install
# 设置管理员账号密码
```

---

## 4. 配置 LLM 模型

### 4.1 获取通义千问 API Key

1. 访问阿里云百炼平台：https://bailian.console.aliyun.com/
2. 开通服务 → 创建 API Key
3. 记录 API Key

### 4.2 在 Dify 中配置

1. 进入 Dify 控制台 → Settings → Model Providers
2. 安装 "Tongyi" 插件（Marketplace 搜索）
3. 点击设置 → 填入 API Key
4. 设置默认模型：
   - 系统推理模型：`qwen-plus`
   - Embedding 模型：`text-embedding-v2`

### 4.3 模型费用预估

| 模型 | 用途 | 单价 | 月预估 |
|---|---|---|---|
| qwen-plus | 对话生成 | 0.8 元/百万 token | ~10-20 元 |
| text-embedding-v2 | 文档向量化 | 0.07 元/千 token | ~1-2 元（一次性） |
| **合计** | | | **~10-20 元/月** |

---

## 5. 创建知识库与智能体

### 5.1 创建知识库

1. Knowledge → 创建知识库 → 上传文本文件
2. 支持 .md、.txt、.pdf 格式
3. 分段设置（自定义模式）：
   - 分块大小：800 token
   - 重叠：150 token
   - 分隔符：\n\n（段落）
4. Embedding 模型：text-embedding-v2
5. 检索模式：混合搜索（语义 + 全文）
6. Top K：5
7. Score Threshold：0.5

### 5.2 创建聊天助手

1. Studio → 创建应用 → 聊天助手
2. 关联知识库：Context → Add Context → 选择知识库
3. System Prompt：
   ```
   你是 kalpacode 博客的 AI 导览助手。
   基于博客知识库回答访客的技术问题。
   回答时引用文章来源。
   如果知识库中没有相关内容，诚实回答"博客中暂无相关内容"，不要编造。
   回答保持简洁，技术细节准确。
   ```
4. 模型：qwen-plus
5. Temperature：0.3（偏低，保证回答准确性）

### 5.3 嵌入博客

方式一：聊天气泡（最简单）
```html
<script src="https://your_server_ip:3000/embed.min.js"
  token="YOUR_APP_TOKEN"
  baseUrl="http://your_server_ip:3000"
  defer />
</script>
```

方式二：REST API（后期自定义 UI 时用）
```javascript
// 前端调用示例
const response = await fetch('http://your_server_ip:3000/v1/chat-messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputs: {},
    query: '用户的问题',
    response_mode: 'streaming',
    conversation_id: '',
    user: 'visitor_001'
  })
})
```

---

## 6. 日常运维

### 6.1 监控内存

```bash
# 实时监控
docker stats

# 查看系统内存
free -h

# 查看 Swap 使用情况
swapon --show
```

### 6.2 更新知识库

```bash
# 方式一：Dify 控制台手动上传新文章
# Knowledge → 选择知识库 → 添加文档

# 方式二：API 自动同步（后续与博客发布流程集成）
curl -X POST 'http://your_server_ip:3000/v1/datasets/{dataset_id}/documents/create_by_file' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -F 'file=@/path/to/new-article.md' \
  -F 'data={"name":"new-article","process_rule":{"mode":"automatic"}}'
```

### 6.3 备份

```bash
# 备份数据库
docker exec db_postgres pg_dump -U postgres dify > backup_$(date +%Y%m%d).sql

# 备份配置
cp .env .env.backup.$(date +%Y%m%d)
```

### 6.4 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 容器频繁重启 | 内存不足 OOM | 检查 mem_limit 设置，增大 Swap |
| 文档索引失败 | Embedding API 超时 | 检查通义千问 API Key 和网络 |
| 对话响应慢 | Swap 频繁读写 | 降低 swappiness，或升级到 4G |
| 磁盘满 | 日志/数据膨胀 | `docker system prune` 清理 |

---

## 7. 后续升级路径

| 阶段 | 方案 | 触发条件 | 成本变化 |
|---|---|---|---|
| 当前 | 2G + Swap + 优化 | — | 0 元平台费 |
| 升级 1 | 升级到 ECS 4G | 日活 > 50 或索引慢 | +100 元/年 |
| 升级 2 | 独立向量数据库 | 文章 > 500 篇 | +0（自托管 Qdrant） |
| 升级 3 | 迁移到 K8s | 多服务/高可用需求 | 视方案而定 |
