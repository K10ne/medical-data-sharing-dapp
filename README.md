# 基于以太坊的去中心化隐私医疗数据共享 DApp

本仓库按毕业设计需求文档实现一个医疗数据共享 DApp 原型：

- `contracts`：Solidity 智能合约、部署脚本、合约测试。
- `apps/api`：非信任后端索引/API 服务，负责事件索引、通知和模拟 IPFS 存储。
- `apps/web`：React + TypeScript 前端 DApp，负责钱包交互、客户端加密、授权和审计体验。

## Sepolia 部署信息

部署网络：Sepolia  
部署钱包：`0x9fA74A5ae1B9E68BDa86E8655c63Eb4af7f11A90`

| 合约 | 地址 |
| --- | --- |
| IdentityRegistry | `0xe6DF2a398A09c0C0ED23CEF4219322060c35C090` |
| MedicalDataRegistry | `0x037601068F0aAC93FbDb631c746D5f347C999661` |
| ConsentAccessControl | `0xFC96D31921Ea9477B5dC923912e4655f7e5C693f` |

Sourcify 源码验证：

- IdentityRegistry：https://repo.sourcify.dev/contracts/full_match/11155111/0xe6DF2a398A09c0C0ED23CEF4219322060c35C090/
- MedicalDataRegistry：https://repo.sourcify.dev/contracts/full_match/11155111/0x037601068F0aAC93FbDb631c746D5f347C999661/
- ConsentAccessControl：https://repo.sourcify.dev/contracts/full_match/11155111/0xFC96D31921Ea9477B5dC923912e4655f7e5C693f/

区块浏览器：

- https://sepolia.etherscan.io/address/0xe6DF2a398A09c0C0ED23CEF4219322060c35C090
- https://sepolia.etherscan.io/address/0x037601068F0aAC93FbDb631c746D5f347C999661
- https://sepolia.etherscan.io/address/0xFC96D31921Ea9477B5dC923912e4655f7e5C693f

## 快速启动

```powershell
npm.cmd install
npm.cmd run dev:api
npm.cmd run dev:web
```

访问前端：

```text
http://localhost:5173
```

API 健康检查：

```text
http://localhost:4100/api/health
```

## MetaMask 使用步骤

1. 浏览器安装 MetaMask。
2. 切换或添加 Sepolia 网络。
3. 导入或使用有 Sepolia 测试 ETH 的钱包。
4. 打开 `http://localhost:5173`。
5. 点击“连接 MetaMask”。
6. 点击“切换到 Sepolia”。
7. 当前业务角色选择 `患者 Patient`，点击“登记链上身份”。
8. 运行“加密上传样例血检”，MetaMask 会弹出合约交易。
9. 如需医生流程，需要切换到医生钱包并先完成医生身份登记和管理员审批。

## 重新部署到 Sepolia

不要把私钥写入仓库文件。用当前进程环境变量临时传入：

```powershell
$env:SEPOLIA_RPC_URL='https://ethereum-sepolia-rpc.publicnode.com'
$env:DEPLOYER_PRIVATE_KEY='0xYOUR_TESTNET_PRIVATE_KEY'
npm.cmd --workspace contracts run deploy:sepolia
```

部署脚本会自动更新：

- `apps/web/src/contracts/deployment.active.json`
- `apps/api/src/contracts/deployment.active.json`

然后重新构建或重启前端：

```powershell
npm.cmd --workspace apps/web run build
npm.cmd run dev:web
```

如果需要本地链流程：

```powershell
npm.cmd run dev:chain
npm.cmd run deploy:local
npm.cmd run dev:api
npm.cmd run dev:web
```

## 安全提醒

本项目只应使用测试网钱包。任何已经暴露过的私钥都不能再用于主网或真实资产。医疗数据演示使用模拟数据，不能上传真实病历或身份信息。

当前版本提供可演示的毕业设计原型：MetaMask 负责链上签名，Sepolia 合约负责身份、资产、授权状态，后端负责模拟 IPFS、索引和通知，前端负责本地加密、解密、授权和审计 UI。
