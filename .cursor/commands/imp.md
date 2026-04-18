执行tasks任务，具体任务文件在docs/spec/tasks.md，_需求: 相关的需求点的编号，要查阅需求文档docs/spec/requirements.md中的对应需求编号和内容去严格执行。具体要求如下：

 ### 1. 执行前加载上下文：
`docs/spec/constitution.md`(项目宪章)
`docs/spec/requirements.md`（需求内容）
`docs/spec/design.md`（架构约束）
`docs/spec/data.md`和`docs/spec/api.md`（如相关）
### 2.执行中
_需求: 相关的需求点的编号，要查阅需求文档docs/spec/requirements.md中的对应需求编号和内容去严格执行
### 2. 执行后：
#### 错误检查和功能验收
1. 检查本次变更是否语法错误、类型错误、编译错误等。
2. 破坏现有功能（回归问题）。
3. 违反 `constitution.md` 中的规范
4. 进行功能验收，使用单元测试、E2E等方式
#### 文档更新
1.更新 `docs/spec/tasks.md` 状态为 `[x]`
2.数据库结构变更时自动更新data.md文档
3.接口变更时自动更新api.md文档
备注：任务完成后不需要生成新的文档，除非我特别要求。