# Token 计算器（离线估算）PRD

## 1. 背景与目标
个人在做 prompt/模型选型与成本评估时，需要快速估算：
- 某条 prompt（system + user）与其模型回复（output）的 token 数
- 在不同 provider/模型下的单次调用成本
- 在不同实验次数（例如 1000 次、10000 次）下的总成本

本产品定位：
- 个人成本估算工具（预算参考）
- token 计算尽可能准确（在“纯文本 token”口径下），不追求 100% 复刻各家账单

## 2. 用户画像
- 主要用户：个人开发者 / 产品经理 / 研究人员
- 关键诉求：
  - 本地离线计算 token（不上传 prompt）
  - 模型版本明确（到具体 model id）
  - 支持中文/英文/混合语言
  - 快速对比不同 provider/模型成本

## 3. 范围（MVP）
### 3.1 必做（MVP）
1) Provider 与模型价格表（手动维护）
- 首批 provider：Gemini、Claude（Anthropic）、OpenAI、OpenRouter
- 每家 3–10 个常用模型版本
- 价格统一口径：USD / 1M tokens（input 与 output 分开）

2) Token 计算
- 直接粘贴文本
- 输入拆分为：System（可选） + User
- 输出为：模型回复文本（output）
- 统计 input tokens 与 output tokens

3) 成本估算
- 选择 provider + 模型
- 输入实验次数 runs（例如 1000 / 10000）
- 输出：单次成本（per run）与总成本（total = perRun * runs）

4) 部署形态
- 纯静态网页（Static Export）
- 不保存配置（不写 localStorage）
- 默认不接入任何后端

### 3.2 明确不做（MVP 不包含）
- cached token / cache read/write 计费
- 多模态（图片/音频/视频）
- embeddings / rerank 等非 chat 场景
- 批量导入 prompt（CSV/JSONL）
- 多轮对话 messages 的模板 token 开销（只算纯文本）
- 账号系统/多人协作/分享链接

## 4. 核心口径与计算规则
### 4.1 Token 计算口径
- 只计算“纯文本 token”
  - inputText = systemText + "\n\n" + userText（去掉空段）
  - outputText = 模型回复文本
- 不计算各家 chat 消息结构/模板额外开销（例如 role、header、ChatML 等）
- 不包含任何不可见 token（如推理 token / thinking tokens 等）

### 4.2 费用计算公式
- inputCostPerRun = inputTokens / 1_000_000 * inputPricePer1M
- outputCostPerRun = outputTokens / 1_000_000 * outputPricePer1M
- perRunCost = inputCostPerRun + outputCostPerRun
- totalCost = perRunCost * runs

### 4.3 价格数据维护规则
- 价格由用户手动维护，建议每条模型标注：
  - 来源链接
  - 截止日期（例如“as of 2026-02-03”）
- OpenRouter 使用 OpenRouter 标价（不追溯底层实际 provider）

## 5. 用户流程（单页）
1) 选择 Provider
2) 选择 Model（版本）
3) 粘贴 System（可选）与 User（输入）
4) 粘贴 Output（模型回复）
5) 输入 runs（默认 1000）
6) 点击“计算 token & 费用”
7) 展示：
- input tokens、output tokens
- 单次成本
- 总成本

## 6. 信息架构 / 页面结构
- 单页面（Home）
  - 左侧：配置与输入区
    - Provider 下拉
    - Model 下拉
    - System 文本框
    - User 文本框
    - Output 文本框
    - runs 数值输入
    - 计算按钮
  - 右侧：结果区（KPI）
    - input tokens + input 单价
    - output tokens + output 单价
    - per run cost
    - total cost

## 7. 数据模型（价格表）
建议结构（与代码实现保持一致）：
- provider: openai | claude | gemini | openrouter
- model id：精确到版本/路由（例如 openrouter/anthropic/claude-3.5-sonnet）
- tokenizer：用于离线 token 统计的 tokenizer 类型（gpt4o / claude / gemini）
- inputPer1M, outputPer1M: number
- note?: string（用于标注截至日期与来源）

## 8. 非功能需求
- 隐私：所有 token 计算在浏览器本地完成（不上传文本）
- 体验：计算按钮触发时展示 loading
- 可维护：价格表独立文件，方便后续增删模型
- 可扩展：后续可加入 cached 计费、多轮 messages、批量、导出等

## 9. 风险与已知限制
- 由于各家计费与 tokenizer/模板口径差异，MVP 输出为“预算估算”
- 部分模型的真实账单 token 可能包含不可见开销（MVP 不覆盖）

## 10. 验收标准（MVP）
1) 能选择 4 家 provider，且每家至少 3 个模型项（可先占位价格）
2) system/user/output 三段文本分别计算 token，并展示 input/output token 数
3) 输入 runs 后能展示 per run 与 total 费用
4) 可在本地启动与静态构建（Static Export）
5) 不写入本地存储、不上传文本
