# AGENTS.md — 仓库协作指引

## 技术栈与架构边界（摘要）

| 维度 | 约定 |
| --- | --- |
| 语言 | **TypeScript** 为唯一一等业务源码语言；避免默用 `any`。 |
| 客户端 | **Expo（RN）+ expo-router**；保持 **标准 Expo** 工作流，**不依赖** 需集成 **原生地图 SDK** 的方案。 |
| 地图与导航降级 | **WebView + 平台开放 JS API / HTTP API**（与设计文档一致）；**不采用** 第三方 **原生移动地图 SDK** 作为一期路径。 |
| 后端 | **Supabase**（Postgres、Auth、**Edge Functions**）；一期无强制独立自建后端语言栈。 |
| 敏感能力 | **大模型等需密钥的能力**：客户端 **仅调用** 项目约定的 **Edge Functions**，**禁止**在安装包内持有模型供应商密钥或 **直连** 模型 HTTP。 |
| 标识符 | 数据库表列/函数、Edge 路由片段、对外 JSON 键名与代码模块导出：**English**；SQL 列名倾向 **`snake_case`**（与 `data.md` / `api.md` 一致）。 |

---


##  测试与质量基线

- **合并前**：通过项目已配置的 **ESLint** 与 **TypeScript 检查**（如 `tsc --noEmit`）；不依赖大面积注释关闭规则。  
- **一期不将 Vitest 纳入基线**；自动化以 **Lint、类型检查、Playwright**（若仓库已接 Web/导出路径）及 **关键手工** 为主。  
- **关键路径或视觉敏感变更**：须通过项目已约定的 **E2E / 视觉 / 手工** 之一验证，不得仅依赖本地主观浏览。  
- **重构**：不改变对外行为；行为变更须有测试或验收说明。

---
Always respond in Chinese-simplified。

## 工程化规范

在编写代码时，请务必遵循以下原则：

1. **严禁重复**: 任何重复的代码逻辑都必须被抽象成可复用的单元（函数、类等）。
2. **检查现有代码**：先分析项目中是否已有类似实现
3. **模块化设计**：将功能拆分为独立、可复用的模块
4. **统一接口**：使用一致的参数格式和返回值结构
5. **配置集中管理**：将常量和配置项统一管理
6. **优先封装**: 将相关功能和数据封装在独立的、职责明确的模块中。

## 编码安全

### 1.Row-Level Security 行级安全（让数据库保护你的用户）

```
Implement Row-Level Security in my Supabase database.
Tables: [list them]. Each row only accessible to the user who created it.
Generate SQL policies to enable RLS on all tables.
Restrict access based on auth.uid().
Include policies for SELECT, INSERT, UPDATE, DELETE.
```

### 2. Rate Limiting

```
Add rate limiting to all my API routes. Limit each IP address to
100 requests per hour. Apply globally to all API routes.
Return a clear error message when the limit is exceeded. Show me
where to add this and how it will work.
```

### 3.  将 API 密钥排除在你的代码之外

```
Move all my API keys to environment variables. Find every place
in my code using API keys directly (Stripe, AWS, database URLs,
third-party services). Show me: 1) how to create a .env.local file,
2) how to update code to use process.env, 3) what to add to .gitignore,
3) how to set these in Vercel/my hosting platform.
```

---

## 规格索引（深入时阅读）

| 文档 | 用途 |
| --- | --- |
| `docs/spec/constitution.md` | 仓库最高工程与协作约束 |
| `docs/spec/design.md` | 架构、数据流、目录演进建议、安全摘要 |
| `docs/spec/requirements.md` | 功能与验收 |
| `docs/spec/data.md` | 数据库与 RLS 原则 |
| `docs/spec/api.md` | Auth、PostgREST、Edge、分层职责 |

---


## 仓库与模块结构（演进方向）
当前主要结构保持，建议增量：

```
app/                    # expo-router routes (existing)
components/             # reusable UI (existing)
constants/              # theme, mock → gradually Supabase-backed defaults
lib/
  supabase.ts           # singleton client → add Auth helpers
  auth/                 # optional: session hooks, login gate
  api/                  # optional: Edge client wrapper (timeout T)
hooks/
tests/                  # 所有的测试代码
docs/spec/
  requirements.md
  constitution.md
  design.md
  data.md               # database (authoritative)
  api.md                # API surface (authoritative)
```

