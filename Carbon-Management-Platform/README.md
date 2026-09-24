# 碳管理平台

面向多所学校的碳足迹模型、核算与报告平台。当前已完成基础框架和阶段 3 的身份、学校及平台管理能力。模型、核算、报告仍是空状态页面。业务范围与分期见[实施计划](docs/碳管理平台从零到一开发流程.md)，当前角色规则见[阶段 3 业务决策](docs/阶段3业务决策与权限.md)，目录与模块职责见[项目文件架构图](../项目文件架构图.md)。

## 本地启动

需要 Node 24、npm 和 Docker。项目的 `.nvmrc` 指定 Node 24。

```bash
nvm use
npm ci
cp .env.example .env
```

修改 `.env` 中的 `POSTGRES_PASSWORD`，同步修改 `DATABASE_URL` 中的密码，并将 `BETTER_AUTH_SECRET` 改成至少 32 字符的随机密钥。`BETTER_AUTH_URL` 应与访问地址一致；默认是 `http://localhost:3000`。随后运行：

```bash
docker compose up -d
npm run db:deploy
npm run db:generate
npm run bootstrap:admin -- --email admin@example.com --name 平台管理员
npm run dev
```

首次创建平台管理员时，命令会交互式询问密码，并为该账号写入平台超级管理员角色。打开 [http://localhost:3000/login](http://localhost:3000/login) 登录，然后在“系统管理”中创建学校、学校账号及公共数据版本。管理员若没有学校成员身份，只能进入系统管理；需要进入学校工作台时，应为其显式分配学校归属。

本地 PostgreSQL 仅绑定 `127.0.0.1:5432`，数据保存在 Docker 命名卷 `postgres_data`。`docker compose down` 保留数据卷；`docker compose down -v` 删除数据卷。

## 已实现的管理流程

- 平台超级管理员在“学校与账号”工作区按学校管理成员，或在全部账号视图管理跨校归属；可创建、启停学校和账号、添加或移除学校归属、重置密码，并删除非平台管理员账号。删除会移除登录凭据和学校归属，保留匿名记录供历史审计与资料引用。
- 用户使用邮箱密码登录、退出、修改密码，并在已授权学校之间切换。账号停用或密码重置会使原有会话失效。
- 平台管理员创建和编辑公共数据草稿，发布排放因子、规则配置和报告模板版本。发布后内容冻结；学校用户只能读取已发布版本。
- 服务端检查每次管理请求和学校上下文，记录学校、账号、成员关系及公共数据关键变更的操作者和时间。

校内角色权限矩阵已定义，后续模型、核算和报告接口必须按该矩阵逐项校验。现阶段的公共数据是版本化资料，不会参与核算计算。

## 常用命令

| 命令                                     | 用途                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                            | 启动开发服务器                                                              |
| `npm run bootstrap:admin -- --email ...` | 创建首位平台管理员（交互式输入密码）                                        |
| `npm run db:migrate`                     | 修改 Prisma schema 后生成并应用开发迁移                                     |
| `npm run db:deploy`                      | 应用已有迁移                                                                |
| `npm run db:generate`                    | 生成 Prisma Client                                                          |
| `npm run db:validate`                    | 检查 Prisma schema                                                          |
| `npm run format:check` / `npm run lint`  | 格式和静态检查                                                              |
| `npm test` / `npm run typecheck`         | 单元测试和类型检查                                                          |
| `npm run build`                          | 构建生产包                                                                  |
| `npm run test:integration`               | 在临时数据库运行阶段 3 接口测试；需先 `npm run build` 和启动本地 PostgreSQL |

集成测试会创建并删除一个独立的临时数据库，不修改开发数据库的数据。测试覆盖登录、管理员权限、A/B 学校切换、学校与账号页面、成员归属移除、账号删除、公共数据发布、密码重置、账号停用和审计。CI 运行格式、静态检查、单元测试、类型检查和构建；数据库集成测试需本地 PostgreSQL。

## 环境变量与部署

- `.env.example`：本地开发模板，包含 Compose 的 PostgreSQL 参数。
- `.env.test.example`：独立测试数据库模板。
- `.env.production.example`：生产连接和认证密钥示例。

`DATABASE_URL`、`BETTER_AUTH_URL` 和 `BETTER_AUTH_SECRET` 是运行必需变量。生产环境通过密钥管理器注入真实值，部署前执行 `npm run db:deploy`，再用 `npm run start` 启动 Node 服务。`/api/health` 仅报告应用进程健康，不检查数据库。
