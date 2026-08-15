# 非Dify替代方案：自建轻量 RAG 智能体

| 属性 | 内容 |
|---|---|
| 方案 | FastAPI + LangChain + ChromaDB 自建 |
| 服务器 | 阿里云 ECS 经济型 e 2核2G / 3M / 40G |
| LLM | DeepSeek V4 Flash（对话）+ 通义千问 text-embedding-v2（向量） |
| 更新日期 | 2026-08-15 |

---

## 1. 方案对比总览

| 维度 | Dify 自托管 | 自建轻量 RAG |
|---|---|---|
| 部署复杂度 | 高（15 容器） | 低（1 个 Python 进程 + 1 个数据库） |
| 内存占用 | ~2.0G（优化后） | ~300-500MB |
| 2G 服务器适配 | 勉强可行 | 轻松运行 |
| 功能完整度 | 全功能（可视化、多模型、插件） | 核心 RAG 功能 |
| 知识库管理 | Web 界面 | 脚本/API |
| 可维护性 | 高（成熟项目） | 中（需自建运维） |
| 开发量 | 零代码配置 | 需写后端代码 |
| 扩展性 | 插件生态 | 自由定制 |

---

## 2. 推荐方案：FastAPI + LangChain + ChromaDB

### 2.1 技术选型

| 组件 | 技术 | 说明 |
|---|---|---|
| API 框架 | FastAPI | 高性能异步，自动生成文档 |
| RAG 框架 | LangChain | 文档加载、分块、检索链编排 |
| 向量数据库 | ChromaDB | 纯 Python，嵌入式运行，零运维 |
| Embedding | 通义千问 text-embedding-v2 | 0.07 元/千 token |
| LLM | DeepSeek V4 Flash | 输入 1 元/百万 token（缓存命中 0.02 元），输出 2 元/百万 token |
| 进程守护 | systemd | 崩溃自动重启 |
| 反向代理 | Nginx | 代理 API 请求 |

### 2.2 内存占用预估

| 组件 | 预估占用 |
|---|---|
| FastAPI + Uvicorn | ~80MB |
| LangChain 运行时 | ~50MB |
| ChromaDB（嵌入式） | ~100MB |
| Python 运行时 | ~50MB |
| Nginx | ~20MB |
| **合计** | **~300MB** |

对比 Dify 的 2.0G，自建方案仅占 300MB，2G 服务器毫无压力。

---

## 3. 项目结构

```
blog-agent/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── routes/
│   │   ├── chat.py          # 对话接口
│   │   └── health.py        # 健康检查
│   ├── core/
│   │   ├── rag.py           # RAG 检索链
│   │   ├── embeddings.py    # Embedding 封装
│   │   └── llm.py           # LLM 封装
│   └── models/
│       └── schemas.py       # 请求/响应模型
├── scripts/
│   ├── index_docs.py        # 文档索引脚本
│   └── rebuild_index.py     # 重建索引
├── data/
│   ├── chroma/              # ChromaDB 持久化
│   └── docs/                # 原始文档
├── requirements.txt
├── .env
└── README.md
```

---

## 4. 核心代码设计

### 4.1 依赖

```txt
# requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
langchain==0.3.0
langchain-community==0.3.0
langchain-openai==0.2.0
chromadb==0.5.5
httpx==0.27.0
python-dotenv==1.0.1
sse-starlette==2.1.0
```

### 4.2 配置

```python
# app/config.py
from dotenv import load_dotenv
import os

load_dotenv()

# DeepSeek（对话 LLM）
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
LLM_MODEL = "deepseek-v4-flash"

# 通义千问（Embedding 向量模型）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
EMBEDDING_MODEL = "text-embedding-v2"

CHROMA_PATH = "./data/chroma"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
TOP_K = 5
SCORE_THRESHOLD = 0.5
MAX_HISTORY = 5  # 保留最近5轮对话
```

### 4.3 RAG 核心

```python
# app/core/rag.py
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import HumanMessage, AIMessage
from config import *

# 通义千问 Embedding
embeddings = DashScopeEmbeddings(
    model=EMBEDDING_MODEL,
    dashscope_api_key=DASHSCOPE_API_KEY
)

# DeepSeek LLM（OpenAI 兼容接口）
llm = ChatOpenAI(
    model=LLM_MODEL,
    api_key=DEEPSEEK_API_KEY,
    base_url=DEEPSEEK_BASE_URL,
    temperature=0.3,
    streaming=True
)

vectorstore = Chroma(
    persist_directory=CHROMA_PATH,
    embedding_function=embeddings
)

PROMPT_TEMPLATE = """你是 kalpacode 博客的 AI 导览助手。
基于以下博客内容回答访客的问题。回答时引用文章来源。
如果以下内容不相关，诚实回答"博客中暂无相关内容"。

参考内容：
{context}

对话历史：
{history}

用户问题：{question}
"""

async def chat(query: str, history: list, conversation_id: str):
    # 1. 检索相关文档
    docs = vectorstore.similarity_search_with_score(query, k=TOP_K)
    filtered = [(doc, score) for doc, score in docs if score >= SCORE_THRESHOLD]

    if not filtered:
        yield "博客中暂无与您问题相关的内容。您可以尝试换个关键词提问。"
        return

    # 2. 组装上下文
    context = "\n\n".join([
        f"[来源：{doc.metadata.get('title', '未知')}]\n{doc.page_content}"
        for doc, _ in filtered
    ])

    # 3. 组装历史
    history_text = "\n".join([
        f"用户：{h['question']}\n助手：{h['answer']}"
        for h in history[-MAX_HISTORY:]
    ])

    # 4. 调用 LLM（流式）
    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    chain = prompt | llm

    async for chunk in chain.astream({
        "context": context,
        "history": history_text,
        "question": query
    }):
        yield chunk.content
```

### 4.4 API 接口

```python
# app/routes/chat.py
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from models.schemas import ChatRequest
from core.rag import chat

router = APIRouter()

@router.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    async def event_stream():
        async for chunk in chat(
            query=request.query,
            history=request.history,
            conversation_id=request.conversation_id
        ):
            yield {"data": chunk}
        yield {"data": "[DONE]"}
    
    return EventSourceResponse(event_stream())
```

### 4.5 文档索引脚本

```python
# scripts/index_docs.py
"""将 Markdown 文档索引到 ChromaDB"""
import os
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_community.vectorstores import Chroma

DOCS_DIR = "./data/docs"
CHROMA_PATH = "./data/chroma"

def index_documents():
    # 加载所有 Markdown 文件
    loader = DirectoryLoader(
        DOCS_DIR,
        glob="**/*.md",
        loader_cls=TextLoader
    )
    docs = loader.load()

    # 为每个文档添加元数据
    for doc in docs:
        filename = os.path.basename(doc.metadata['source'])
        doc.metadata['title'] = filename.replace('.md', '')
        doc.metadata['source'] = f"/posts/{filename.replace('.md', '')}"

    # 分块
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", "。", " "]
    )
    chunks = splitter.split_documents(docs)

    # 向量化并存储
    embeddings = DashScopeEmbeddings(model="text-embedding-v2")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_PATH
    )
    vectorstore.persist()

    print(f"索引完成：{len(docs)} 篇文档，{len(chunks)} 个分块")

if __name__ == "__main__":
    index_documents()
```

---

## 5. 部署步骤

### 5.1 环境准备

```bash
# 安装 Python 3.11+
sudo apt install -y python3.11 python3.11-venv

# 创建项目目录
mkdir -p ~/blog-agent && cd ~/blog-agent
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 5.2 配置环境变量

```bash
# .env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

### 5.3 索引文档

```bash
# 将博客 Markdown 文件放入 data/docs/
cp /path/to/blog/posts/*.md data/docs/

# 执行索引
python scripts/index_docs.py
```

### 5.4 启动服务

```bash
# 测试运行
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 生产运行（systemd 守护）
sudo tee /etc/systemd/system/blog-agent.service << 'EOF'
[Unit]
Description=Blog AI Agent
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/blog-agent
EnvironmentFile=/home/ubuntu/blog-agent/.env
ExecStart=/home/ubuntu/blog-agent/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable blog-agent
sudo systemctl start blog-agent
```

### 5.5 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your_domain.com;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;  # SSE 流式响应必须关闭缓冲
    }

    # 博客静态文件
    location / {
        root /var/www/blog;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 6. 两种方案选择建议

### 6.1 选 Dify 的场景

- 不想写代码，用 Web 界面配置智能体
- 需要可视化知识库管理
- 后续可能接入多模型、多工具
- 接受 2G 服务器极限优化

### 6.2 选自建的场景（推荐）

- 2G 服务器想轻松运行，不留内存隐患
- 有一定 Python 基础（代码可由 AI 生成）
- 只需要核心 RAG 功能：文档检索 + LLM 回答
- 追求极致轻量和性能
- 后续与博客发布流程深度集成（git push 自动索引）

### 6.3 成本对比

| 项目 | Dify 自托管 | 自建 RAG |
|---|---|---|
| 平台费 | 0 元 | 0 元 |
| 服务器 | 99 元/年 | 99 元/年 |
| LLM API | ~10-20 元/月 | ~9-14 元/月 |
| 开发成本 | 0（配置即用） | AI 生成代码，~1 天 |
| 运维成本 | 中（15 容器） | 低（1 进程） |
| **年总成本** | **~219-339 元** | **~208-267 元** |

成本相同，但自建方案在 2G 服务器上运行更稳定。

---

## 7. 推荐路径

**建议先自建 RAG → 后续按需迁移 Dify**

1. 先用自建方案快速跑起来，2G 服务器毫无压力
2. 验证智能体效果和用户反馈
3. 如果后续需要更复杂的功能（多模型、工具调用、工作流），再迁移到 Dify
4. 迁移时知识库文档可复用，只需重新索引
