/* ============================================================
   kalpacode demo — 交互逻辑
   文章数据 / 筛选搜索 / 悬停预览 / 阅读器 / AI 聊天窗
   ============================================================ */

/* ---------------- 文章数据（模拟 content/blog 下的 Markdown） ---------------- */
const POSTS = [
  {
    slug: "docker-network",
    title: "Docker 网络模式实践：从 bridge 到 host",
    date: "2026-08-10",
    category: "后端",
    tags: ["Docker", "网络"],
    py: "docker wangluo moshi shijian cong bridge dao host",
    summary: "四种网络模式到底怎么选？用一台 2G 内存的小服务器实测 bridge、host 与自定义网络的真实差异。",
    body: `
<p>在只有 2 核 2G 的服务器上跑多个容器，网络模式选错了，后面排查问题会非常痛苦。这篇文章记录我在部署博客 + AI 后端时的完整取舍过程。</p>
<h2 id="s1">四种网络模式速览</h2>
<p>Docker 提供 bridge、host、none、container 四种基础模式。对单机部署而言，真正需要纠结的只有前两个：<code class="inline">bridge</code> 隔离性好但需要端口映射，<code class="inline">host</code> 性能最好但牺牲隔离。</p>
<h2 id="s2">bridge 模式实践</h2>
<p>默认的 bridge 模式下，容器通过 <code class="inline">docker0</code> 网桥与宿主机通信。我的 FastAPI 后端运行在 bridge 网络中，只暴露 8000 端口给 Nginx 反代：</p>
<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">bash</span><button class="copy-btn">复制</button></div><pre><span class="tok-c"># 创建自定义 bridge 网络，容器间可用服务名互访</span>
docker network create <span class="tok-n">blog-net</span>

docker run -d --name <span class="tok-n">api</span> --network <span class="tok-n">blog-net</span> \
  -p <span class="tok-n">127.0.0.1:8000:8000</span> \
  kalpa-api:latest</pre></div>
<p>注意我把端口绑定在 <code class="inline">127.0.0.1</code> 上，这样外网无法绕过 Nginx 直接访问后端，这是一个常被忽略的安全细节。</p>
<h2 id="s3">什么时候用 host</h2>
<p>只有一个场景值得用 host：对网络性能极度敏感且单机只跑一个服务。我的博客场景容器间通信不多，bridge 的少量 NAT 开销完全可接受，隔离性换来的是半夜不会被端口冲突叫醒。</p>
<ul>
<li>多容器、需要隔离：选自定义 bridge 网络</li>
<li>极致性能、独占机器：才考虑 host</li>
<li>无论什么模式，端口只绑定 <code class="inline">127.0.0.1</code></li>
</ul>`
  },
  {
    slug: "astro-zero-js",
    title: "用 Astro 搭建零 JS 博客的完整流程",
    date: "2026-08-02",
    category: "前端",
    tags: ["Astro", "静态站点"],
    py: "yong astro dajian ling js boke de wanzheng liucheng",
    summary: "内容站点为什么不需要一整个 React 应用？Astro 的岛屿架构如何把首页 JS 压到接近零。",
    body: `
<p>这个博客就是 Astro 构建的。首页是零 JS 的静态 HTML，唯一的动态组件——AI 聊天窗——以 React 岛屿的形式按需水合。</p>
<h2 id="s1">为什么是 Astro</h2>
<p>内容站点的本质是 HTML + CSS。传统 SPA 把一个 React 运行时塞给每个读者，只为渲染几段文字，这是巨大的浪费。Astro 默认不发送任何 JS，除非你显式声明一个岛屿。</p>
<h2 id="s2">岛屿架构</h2>
<p>页面上 95% 的内容是静态的，只有聊天窗需要复杂状态管理。Astro 允许我只给这一个组件加上 <code class="inline">client:idle</code> 指令，浏览器空闲时才加载它的 JS。</p>
<h2 id="s3">构建与部署</h2>
<p><code class="inline">astro build</code> 输出纯静态文件，scp 到服务器让 Nginx 直接托管即可，没有 Node 进程要守护。这也是整个站点年成本能压到 500 元以内的关键。</p>`
  },
  {
    slug: "chromadb-local",
    title: "ChromaDB 本地向量库踩坑记录",
    date: "2026-07-25",
    category: "AI",
    tags: ["RAG", "ChromaDB", "Embedding"],
    py: "chromadb bendi xiangliangku cakeng jilu",
    summary: "在 2G 内存的服务器上跑向量数据库：持久化路径、内存占用与三个真实的坑。",
    body: `
<p>给博客做 AI 问答，向量库选型时我放弃了所有云端方案，选择在本机跑 ChromaDB——文章只有几十篇，这个量级杀鸡不需要用牛刀。</p>
<h2 id="s1">为什么不用云端向量库</h2>
<p>云端向量库按读写计费还有网络延迟，而博客知识库总共不到 200 个分块，本地 SQLite 级别的方案就足够。ChromaDB 常驻内存约 200MB，2G 内存加 2G Swap 完全扛得住。</p>
<h2 id="s2">持久化与内存</h2>
<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">python</span><button class="copy-btn">复制</button></div><pre><span class="tok-k">import</span> chromadb

client = chromadb.<span class="tok-f">PersistentClient</span>(path=<span class="tok-s">"./chroma_data"</span>)
collection = client.<span class="tok-f">get_or_create_collection</span>(<span class="tok-s">"blog"</span>)
collection.<span class="tok-f">add</span>(documents=chunks, ids=ids)</pre></div>
<h2 id="s3">三个坑</h2>
<ul>
<li>Embedding 模型要选中文友好的，否则检索命中率直接腰斩</li>
<li>服务重启后首次查询慢，需要预热：启动时跑一次 dummy query</li>
<li>文章删除后记得同步删除向量，否则会检索到「幽灵文章」</li>
</ul>`
  },
  {
    slug: "ecs-99-ops",
    title: "阿里云 99 元 ECS 的极限运维手册",
    date: "2026-07-18",
    category: "运维",
    tags: ["Linux", "Nginx", "Swap"],
    py: "aliyun ecs jixian yunwei shouce",
    summary: "2 核 2G 跑静态博客 + Python 后端 + 向量库，每一 MB 内存都要精打细算。",
    body: `
<p>阿里云经济型 e 实例 99 元/年续费同价，3 年 297 元，是个人博客的性价比之王。代价是内存只有 2G，必须精打细算。</p>
<h2 id="s1">2G 内存怎么活</h2>
<p>静态博客交给 Nginx 几乎不占内存，真正的压力来自 FastAPI + ChromaDB，常驻约 300-500MB。加上系统本身，2G 物理内存很紧张，所以第一件事是加 Swap。</p>
<h2 id="s2">Swap 配置</h2>
<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">bash</span><button class="copy-btn">复制</button></div><pre>sudo fallocate -l <span class="tok-n">2G</span> /swapfile
sudo chmod <span class="tok-n">600</span> /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
<span class="tok-c"># 写入 fstab 保证重启生效</span>
<span class="tok-k">echo</span> <span class="tok-s">'/swapfile none swap sw 0 0'</span> | sudo tee -a /etc/fstab</pre></div>
<h2 id="s3">进程守护</h2>
<p>用 systemd 管理 Python 后端，<code class="inline">Restart=always</code> 保证崩溃自动拉起。再配一个 cron 每天凌晨备份 ChromaDB 数据到对象存储，这台小机器就可以放心跑三年。</p>`
  },
  {
    slug: "sse-fastapi",
    title: "SSE 流式输出：从原理到 FastAPI 实现",
    date: "2026-07-09",
    category: "后端",
    tags: ["SSE", "FastAPI"],
    py: "sse liushi shuchu cong yuanli dao fastapi shixian",
    summary: "AI 回答为什么要逐字返回？Server-Sent Events 比 WebSocket 简单在哪里，FastAPI 里怎么写。",
    body: `
<p>AI 问答的首字响应时间直接决定用户体验。LLM 生成完整回答可能要 10 秒，但首字只要 1 秒——SSE 让用户从第 1 秒就开始读。</p>
<h2 id="s1">SSE 是什么</h2>
<p>Server-Sent Events 是基于 HTTP 的单向推送协议：响应头声明 <code class="inline">text/event-stream</code>，之后服务器可以持续推送 <code class="inline">data:</code> 行。相比 WebSocket 它不需要协议升级，天然支持重连，对「服务器单方面输出」的场景刚刚好。</p>
<h2 id="s2">FastAPI 实现</h2>
<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">python</span><button class="copy-btn">复制</button></div><pre><span class="tok-k">from</span> fastapi <span class="tok-k">import</span> FastAPI
<span class="tok-k">from</span> fastapi.responses <span class="tok-k">import</span> StreamingResponse

<span class="tok-k">@app.post</span>(<span class="tok-s">"/api/chat"</span>)
<span class="tok-k">async def</span> <span class="tok-f">chat</span>(req: ChatRequest):
    <span class="tok-k">async def</span> <span class="tok-f">stream</span>():
        <span class="tok-k">async for</span> token <span class="tok-k">in</span> llm.astream(prompt):
            <span class="tok-k">yield</span> <span class="tok-s">f"data: {token}\n\n"</span>
    <span class="tok-k">return</span> <span class="tok-f">StreamingResponse</span>(stream(),
        media_type=<span class="tok-s">"text/event-stream"</span>)</pre></div>
<h2 id="s3">前端注意点</h2>
<p>EventSource 不支持 POST，所以聊天接口要用 <code class="inline">fetch</code> + ReadableStream 手动解析 SSE 帧。另外 Nginx 反代时必须关掉响应缓冲（<code class="inline">proxy_buffering off</code>），否则流式会变成「一次性返回」。</p>`
  },
  {
    slug: "tailwind-dark-mode",
    title: "Tailwind 暗色模式的三种实现与取舍",
    date: "2026-06-30",
    category: "前端",
    tags: ["Tailwind", "CSS"],
    py: "tailwind anse moshi de sanzhong shixian yu qushe",
    summary: "class 策略、媒体查询、CSS 变量令牌——为什么这个博客选择第三种。",
    body: `
<p>暗色模式是技术博客的标配，但实现方式直接影响后续的维护成本。三种主流方案我都试过，最后选择了 CSS 变量令牌。</p>
<h2 id="s1">三种方案</h2>
<ul>
<li><strong>媒体查询</strong>：跟随系统，用户无法手动切换，第一个排除</li>
<li><strong>class 策略</strong>：每个元素写 <code class="inline">dark:</code> 前缀，灵活但冗长</li>
<li><strong>CSS 变量</strong>：颜色全部定义为变量，暗色只改变量值</li>
</ul>
<h2 id="s2">为什么选 CSS 变量</h2>
<p>设计系统里颜色只有十几个令牌，用变量定义后，Tailwind 的 <code class="inline">theme.extend</code> 直接引用变量名。切换主题时一行 JS 改 <code class="inline">html.dark</code> 类，所有颜色同时反转，组件代码里一个 <code class="inline">dark:</code> 都不用写。</p>
<h2 id="s3">防闪烁</h2>
<p>主题初始化脚本必须内联在 <code class="inline">&lt;head&gt;</code> 最前面，同步读取 localStorage，否则暗色用户每次刷新都会先看到一帧白屏。这是暗色模式最容易被忽略的工程细节。</p>`
  },
  {
    slug: "rag-chunking",
    title: "RAG 检索命中率提升：分块策略实验",
    date: "2026-06-21",
    category: "AI",
    tags: ["RAG", "LangChain"],
    py: "rag jiansuo mingzhonglv tisheng fenkuai celue shiyan",
    summary: "同样的文章，换三种分块方式，检索命中率从 63% 到 87%。分块是 RAG 最被低估的环节。",
    body: `
<p>给博客 AI 助手做验收测试时，我用 30 个预设问题跑了三组分块实验。结论先行：按二级标题切分 + 保留上下文前缀，命中率最高。</p>
<h2 id="s1">三种分块方式</h2>
<ul>
<li>固定长度 500 字硬切：命中率 63%，经常把表格切成两半</li>
<li>按段落递归切分：命中率 74%，仍会出现语义残缺</li>
<li>按二级标题切分（单块 ≤500 字）：命中率 87%</li>
</ul>
<h2 id="s2">关键技巧：上下文前缀</h2>
<p>每个分块写入向量库前，在开头拼上文章标题与所属章节，例如「《Docker 网络模式实践》— bridge 模式实践：……」。检索时向量同时包含内容语义与出处语义，命中率提升明显。</p>
<h2 id="s3">实操建议</h2>
<p>分块规则要跟写作规范绑定：一篇文章的每个二级标题下不超过 500 字，既是好的写作习惯，也让知识库分块天然干净。写作规范本身就是 RAG 工程质量的一部分。</p>`
  },
  {
    slug: "github-actions-deploy",
    title: "用 GitHub Actions 实现 git push 即发布",
    date: "2026-06-12",
    category: "运维",
    tags: ["CI/CD", "GitHub Actions"],
    py: "yong github actions shixian git push ji fabu",
    summary: "写一篇 Markdown，git push，几分钟后文章自动上线并进入 AI 知识库——完整流水线配置。",
    body: `
<p>这个博客的发布流程只有一个动作：<code class="inline">git push</code>。剩下的构建、部署、知识库同步全部由 GitHub Actions 完成。</p>
<h2 id="s1">流水线设计</h2>
<p>工作流分三步：构建静态站点 → rsync 到服务器 → 触发知识库增量更新。第三步通过 SSH 在服务器上执行一个小脚本，检测变更的 Markdown 文件并更新向量库。</p>
<h2 id="s2">workflow 配置</h2>
<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">yaml</span><button class="copy-btn">复制</button></div><pre><span class="tok-k">name:</span> deploy
<span class="tok-k">on:</span>
  <span class="tok-k">push:</span>
    <span class="tok-k">branches:</span> [main]
<span class="tok-k">jobs:</span>
  <span class="tok-k">deploy:</span>
    <span class="tok-k">runs-on:</span> ubuntu-latest
    <span class="tok-k">steps:</span>
      - <span class="tok-k">uses:</span> actions/checkout@v4
      - <span class="tok-k">run:</span> npm ci && npm run build
      - <span class="tok-k">run:</span> rsync -az dist/ server:/var/www/blog
      - <span class="tok-k">run:</span> ssh server <span class="tok-s">"bash /opt/sync_kb.sh"</span></pre></div>
<h2 id="s3">注意事项</h2>
<ul>
<li>服务器 IP 和 SSH 私钥放 GitHub Secrets，绝不进仓库</li>
<li>rsync 加 <code class="inline">--delete</code> 前先空跑一次确认目录写对了</li>
<li>知识库同步失败不应阻塞部署，脚本里做好错误隔离</li>
</ul>`
  }
];

/* 分类色块（品牌紫同色相明度阶梯，用于无封面占位） */
const CAT_COLORS = {
  "后端": "#4b3fe3",
  "前端": "#6d5df0",
  "运维": "#3530a8",
  "AI": "#9b8ffb"
};
const CATS = ["全部", "后端", "前端", "运维", "AI"];

const $ = (s) => document.querySelector(s);

/* ================= 主题切换 ================= */
$("#themeToggle").addEventListener("click", () => {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("kalpa-theme", dark ? "dark" : "light");
});

/* ================= 导航毛玻璃 + 汉堡菜单 ================= */
const nav = $("#nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });
$("#hamburger").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
$("#navLinks").addEventListener("click", (e) => {
  if (e.target.tagName === "A") $("#navLinks").classList.remove("open");
});

/* ================= Hero 逐字入场 ================= */
(function heroReveal() {
  const el = $("#heroTitle");
  const text = el.textContent;
  el.textContent = "";
  [...text].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "ch" + (ch === "K" || ch === "k" && i === 0 ? " accent" : "");
    span.textContent = ch;
    span.style.animationDelay = `${i * 0.04}s`;
    el.appendChild(span);
  });
})();

/* ================= 页脚实时时钟 ================= */
(function clock() {
  const el = $("#clock");
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  const tick = () => { el.textContent = "Beijing — " + fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
})();

/* ================= 文章索引：渲染 / 筛选 / 搜索 ================= */
const state = { cat: "全部", query: "" };

function readingTime(post) {
  const chars = post.body.replace(/<[^>]+>/g, "").length;
  return Math.max(1, Math.ceil(chars / 400));
}

function renderFilterBar() {
  const bar = $("#filterBar");
  bar.querySelectorAll(".cat-filter").forEach((b) => b.remove());
  CATS.forEach((cat) => {
    const n = cat === "全部" ? POSTS.length : POSTS.filter((p) => p.category === cat).length;
    const btn = document.createElement("button");
    btn.className = "cat-filter" + (state.cat === cat ? " active" : "");
    btn.innerHTML = `${cat}<span class="count">${String(n).padStart(2, "0")}</span>`;
    btn.addEventListener("click", () => { state.cat = cat; renderList(); renderFilterBar(); });
    bar.insertBefore(btn, bar.firstChild);
  });
}

function matchQuery(p, q) {
  if (!q) return true;
  const hay = (p.title + p.summary + p.tags.join(" ") + p.category).toLowerCase();
  return hay.includes(q) || p.py.includes(q);
}

function renderList() {
  const list = $("#postList");
  list.innerHTML = "";
  const q = state.query.trim().toLowerCase();
  const shown = POSTS.filter((p) => (state.cat === "全部" || p.category === state.cat) && matchQuery(p, q));
  $("#postCount").textContent = `${String(shown.length).padStart(2, "0")} / ${String(POSTS.length).padStart(2, "0")} POSTS`;
  $("#emptyState").classList.toggle("show", shown.length === 0);

  shown.forEach((p) => {
    const idx = POSTS.indexOf(p) + 1;
    const li = document.createElement("li");
    li.className = "post-row";
    li.innerHTML = `
      <a href="#/posts/${p.slug}" data-slug="${p.slug}">
        <span class="post-index">${String(idx).padStart(3, "0")}</span>
        <h3 class="post-title"><span class="u">${p.title}</span></h3>
        <span class="post-meta"><span class="cat">${p.category}</span> · ${p.date} · ${readingTime(p)} min</span>
      </a>`;
    list.appendChild(li);
  });
}

$("#searchInput").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
renderFilterBar();
renderList();

/* ================= 悬停浮动预览 ================= */
(function preview() {
  const pv = $("#preview");
  const char = pv.querySelector(".pv-char");
  let raf = null, mx = 0, my = 0;
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  function apply() {
    raf = null;
    const x = Math.min(mx + 24, innerWidth - 280);
    const y = Math.min(Math.max(my - 82, 8), innerHeight - 180);
    pv.style.left = x + "px";
    pv.style.top = y + "px";
  }
  $("#postList").addEventListener("mouseover", (e) => {
    const a = e.target.closest("a[data-slug]");
    if (!a) return;
    const p = POSTS.find((x) => x.slug === a.dataset.slug);
    pv.style.background = CAT_COLORS[p.category];
    char.textContent = p.category;
    pv.classList.add("show");
  });
  $("#postList").addEventListener("mouseleave", () => pv.classList.remove("show"));
  $("#postList").addEventListener("mouseout", (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest("a[data-slug]")) pv.classList.remove("show");
  });
})();

/* ================= 阅读器覆盖层 ================= */
const reader = $("#reader");
let currentSlug = null;

function openPost(slug, pushHash = true) {
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return;
  currentSlug = slug;
  const idx = POSTS.indexOf(p);

  $("#readerMeta").textContent =
    `${String(idx + 1).padStart(3, "0")} — ${p.category} · ${p.tags.map((t) => "#" + t).join(" ")} · ${p.date} · ${readingTime(p)} MIN READ`;
  $("#readerTitle").textContent = p.title;
  $("#readerTopTitle").textContent = p.title;
  $("#readerContent").innerHTML = p.body;

  // TOC
  const toc = $("#readerToc");
  toc.innerHTML = '<span class="mono toc-label">Contents</span>';
  $("#readerContent").querySelectorAll("h2").forEach((h) => {
    const a = document.createElement("a");
    a.href = "javascript:void 0";
    a.textContent = h.textContent;
    a.dataset.target = h.id;
    a.addEventListener("click", () => {
      const top = h.getBoundingClientRect().top + reader.scrollTop - 80;
      reader.scrollTo({ top, behavior: "smooth" });
    });
    toc.appendChild(a);
  });

  // 复制按钮
  $("#readerContent").querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.closest(".codeblock").querySelector("pre").innerText;
      try { await navigator.clipboard.writeText(code); } catch { /* 忽略 */ }
      btn.textContent = "已复制";
      btn.classList.add("done");
      setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("done"); }, 2000);
    });
  });

  // 上一篇 / 下一篇（按发布时间倒序，POSTS 已按此排列）
  const prev = POSTS[idx - 1]; // 更新的
  const next = POSTS[idx + 1]; // 更早的
  const pn = $("#prevNext");
  pn.innerHTML = "";
  if (next) pn.insertAdjacentHTML("beforeend",
    `<a class="pn-link" href="javascript:void 0" data-slug="${next.slug}"><span class="pn-dir mono">← 上一篇</span><span class="pn-title">${next.title}</span></a>`);
  else pn.insertAdjacentHTML("beforeend", "<span></span>");
  if (prev) pn.insertAdjacentHTML("beforeend",
    `<a class="pn-link next" href="javascript:void 0" data-slug="${prev.slug}"><span class="pn-dir mono">下一篇 →</span><span class="pn-title">${prev.title}</span></a>`);

  reader.classList.add("open");
  reader.scrollTop = 0;
  document.body.style.overflow = "hidden";
  if (pushHash) history.replaceState(null, "", "#/posts/" + slug);
}

function closeReader() {
  reader.classList.remove("open");
  document.body.style.overflow = "";
  currentSlug = null;
  history.replaceState(null, "", "#posts");
}

$("#readerBack").addEventListener("click", closeReader);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && reader.classList.contains("open")) closeReader(); });

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-slug]");
  if (a) { e.preventDefault(); openPost(a.dataset.slug); }
});

// TOC 滚动高亮
reader.addEventListener("scroll", () => {
  const heads = [...$("#readerContent").querySelectorAll("h2")];
  const links = [...$("#readerToc").querySelectorAll("a")];
  let active = null;
  heads.forEach((h) => { if (h.getBoundingClientRect().top <= 120) active = h.id; });
  links.forEach((l) => l.classList.toggle("active", l.dataset.target === active));
}, { passive: true });

// 支持 #/posts/slug 直达
if (location.hash.startsWith("#/posts/")) openPost(location.hash.slice(8), false);

/* ================= AI 聊天窗 ================= */
const KB = [
  {
    keys: ["docker", "网络", "bridge", "host", "容器"],
    answer: "博主在《Docker 网络模式实践》里实测过：多容器场景选自定义 bridge 网络，容器间用服务名互访；端口只绑定 127.0.0.1，避免外网绕过 Nginx 直连后端[1]。只有极致性能且单机独占时才考虑 host 模式。",
    refs: ["docker-network", "sse-fastapi"]
  },
  {
    keys: ["astro", "博客", "零 js", "静态", "建站", "搭建"],
    answer: "这个站本身就是 Astro 构建的：默认输出零 JS 静态 HTML，AI 聊天窗是唯一的 React 岛屿，client:idle 空闲时才加载[1]。配合 Tailwind 设计自由度很高，部署只需要 Nginx 托管静态文件。",
    refs: ["astro-zero-js", "tailwind-dark-mode"]
  },
  {
    keys: ["rag", "向量", "知识库", "检索", "分块", "embedding", "命中率"],
    answer: "博主做过三组分块实验：按二级标题切分（单块 ≤500 字）+ 每块拼上文章标题前缀，检索命中率从 63% 提到 87%[1]。向量库选的是本地 ChromaDB，几十篇文章的量级完全够用，常驻内存约 200MB[2]。",
    refs: ["rag-chunking", "chromadb-local"]
  },
  {
    keys: ["服务器", "部署", "ecs", "内存", "swap", "nginx", "运维", "99"],
    answer: "博主用的是阿里云经济型 e（2 核 2G，99 元/年续费同价）。关键是购买后立刻配 2G Swap，FastAPI + ChromaDB 常驻约 300-500MB，加 Swap 后共 4G 可用[1]。后端用 systemd 守护，崩溃自动重启。",
    refs: ["ecs-99-ops", "github-actions-deploy"]
  },
  {
    keys: ["sse", "流式", "逐字", "websocket", "fastapi"],
    answer: "AI 回答用 SSE 逐字推送：LLM 完整回答可能要 10 秒，但首字 1 秒就能到，用户从第 1 秒开始读[1]。FastAPI 用 StreamingResponse 即可；注意 EventSource 不支持 POST，前端要用 fetch + ReadableStream 手动解析。",
    refs: ["sse-fastapi"]
  },
  {
    keys: ["暗色", "dark", "主题", "tailwind"],
    answer: "博客的暗色模式用 CSS 变量令牌实现：颜色全部定义为变量，切换时只加 html.dark 类，组件里一个 dark: 前缀都不用写[1]。防闪烁的关键是主题初始化脚本内联在 head 最前面同步执行。",
    refs: ["tailwind-dark-mode", "astro-zero-js"]
  },
  {
    keys: ["发布", "流水线", "actions", "ci", "自动化", "push"],
    answer: "发布流程只有一个动作 git push：GitHub Actions 自动构建 → rsync 到服务器 → SSH 触发知识库增量同步[1]。SSH 私钥放 GitHub Secrets，知识库同步失败不阻塞部署。",
    refs: ["github-actions-deploy", "ecs-99-ops"]
  }
];

const FALLBACK = "站内文章暂时没有覆盖这个问题。我已把它记录给博主——也许下一篇就写它。你也可以通过页脚的 GitHub 联系博主。";
const WELCOME = "你好，我是 kalpacode 的 AI 导览员。站内所有文章我都读过，关于后端、前端、运维和 AI 的问题都可以问我。";
const SUGGESTIONS = ["Docker 网络模式怎么选？", "RAG 检索命中率怎么提升？", "99 元服务器够用吗？"];

const chat = {
  panel: $("#chatPanel"),
  orb: $("#chatOrb"),
  list: $("#msgList"),
  input: $("#chatInput"),
  sendBtn: $("#sendBtn"),
  suggest: $("#suggest"),
  history: [],
  sendTimes: [],
  streaming: false
};

function saveChat() {
  try { localStorage.setItem("kalpa-chat", JSON.stringify(chat.history.slice(-20))); } catch { /* 忽略 */ }
}

function addMsg(role, text, refs = [], persist = true) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = text;
  wrap.appendChild(bubble);
  if (refs.length) wrap.appendChild(renderRelated(refs));
  chat.list.appendChild(wrap);
  chat.list.scrollTop = chat.list.scrollHeight;
  if (persist) {
    chat.history.push({ role, text, refs });
    saveChat();
  }
  return bubble;
}

function renderRelated(slugs) {
  const box = document.createElement("div");
  box.className = "related";
  box.innerHTML = '<span class="related-label">相关文章</span>';
  slugs.slice(0, 2).forEach((slug, i) => {
    const p = POSTS.find((x) => x.slug === slug);
    if (!p) return;
    const a = document.createElement("a");
    a.href = "javascript:void 0";
    a.dataset.slug = slug;
    a.innerHTML = `<span class="r-idx">${String(i + 1).padStart(2, "0")}</span><span>${p.title}</span>`;
    box.appendChild(a);
  });
  return box;
}

function restoreChat() {
  try {
    const saved = JSON.parse(localStorage.getItem("kalpa-chat") || "[]");
    if (saved.length) {
      chat.history = saved;
      saved.forEach((m) => addMsg(m.role, m.text, m.refs || [], false));
      return true;
    }
  } catch { /* 忽略 */ }
  return false;
}

function openChat(prefill) {
  chat.panel.classList.add("open");
  chat.orb.classList.add("hidden");
  if (!chat.list.children.length) {
    addMsg("ai", WELCOME);
    renderSuggestions();
  }
  if (prefill !== undefined) chat.input.value = prefill;
  chat.input.focus();
}

function closeChat() {
  chat.panel.classList.remove("open");
  chat.orb.classList.remove("hidden");
}

function renderSuggestions() {
  chat.suggest.innerHTML = "";
  SUGGESTIONS.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => { chat.input.value = q; $("#chatForm").requestSubmit(); });
    chat.suggest.appendChild(b);
  });
}

chat.orb.addEventListener("click", () => openChat());
$("#heroChatBtn").addEventListener("click", () => openChat());
$("#chatClose").addEventListener("click", closeChat);
$("#emptyAskBtn").addEventListener("click", () => openChat(state.query.trim() ? `站内没有「${state.query.trim()}」相关的文章吗？` : ""));
chat.panel.querySelector("#chatClear").addEventListener("click", () => {
  chat.history = [];
  saveChat();
  chat.list.innerHTML = "";
  addMsg("ai", WELCOME);
});

// 模拟 RAG：关键词匹配知识库，多轮追问时合并上一问
function retrieve(question) {
  const q = question.toLowerCase();
  const lastUser = [...chat.history].reverse().find((m) => m.role === "user");
  const ctx = lastUser ? q + " " + lastUser.text.toLowerCase() : q;
  for (const item of KB) {
    if (item.keys.some((k) => q.includes(k))) return item;
  }
  for (const item of KB) { // 追问兜底：用上一问的命中
    if (item.keys.some((k) => ctx.includes(k))) return item;
  }
  return null;
}

// 模拟 SSE 流式输出
function streamAnswer(item) {
  chat.streaming = true;
  chat.input.disabled = true;
  chat.sendBtn.disabled = true;

  const wrap = document.createElement("div");
  wrap.className = "msg ai";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble cursor";
  wrap.appendChild(bubble);
  chat.list.appendChild(wrap);
  chat.list.scrollTop = chat.list.scrollHeight;

  const full = item ? item.answer : FALLBACK;
  // 把 [1]/[2] 转成上标引用
  const tokens = full.split(/(\[\d\])/g);
  let ti = 0, ci = 0;

  const timer = setInterval(() => {
    if (ti >= tokens.length) {
      clearInterval(timer);
      bubble.classList.remove("cursor");
      const html = full.replace(/\[(\d)\]/g, "<sup>[$1]</sup>");
      bubble.innerHTML = html;
      const refs = item ? item.refs : [];
      if (refs.length) wrap.appendChild(renderRelated(refs));
      chat.history.push({ role: "ai", text: html, refs });
      saveChat();
      chat.list.scrollTop = chat.list.scrollHeight;
      chat.streaming = false;
      chat.input.disabled = false;
      chat.sendBtn.disabled = false;
      chat.input.focus();
      return;
    }
    const token = tokens[ti];
    if (/^\[\d\]$/.test(token)) {
      bubble.innerHTML += `<sup>${token}</sup>`;
      ti++;
    } else {
      bubble.textContent += token[ci];
      ci++;
      if (ci >= token.length) { ti++; ci = 0; }
    }
    chat.list.scrollTop = chat.list.scrollHeight;
  }, 24);
}

$("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (chat.streaming) return;
  const q = chat.input.value.trim();
  if (!q) return;

  // 频控：≤10 次/分钟
  const now = Date.now();
  chat.sendTimes = chat.sendTimes.filter((t) => now - t < 60000);
  if (chat.sendTimes.length >= 10) {
    addMsg("ai", "休息一下再问 ☕（每分钟最多 10 次提问）");
    return;
  }
  chat.sendTimes.push(now);

  addMsg("user", q.replace(/</g, "&lt;"));
  chat.input.value = "";
  chat.suggest.innerHTML = "";
  setTimeout(() => streamAnswer(retrieve(q)), 350);
});

// 恢复历史会话
restoreChat();
