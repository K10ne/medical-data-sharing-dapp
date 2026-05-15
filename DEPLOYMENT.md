# MedLedger DApp 落地部署说明

## 当前部署

网络：Sepolia  
链 ID：11155111  
部署账户：`0x9fA74A5ae1B9E68BDa86E8655c63Eb4af7f11A90`

| 合约 | 地址 |
| --- | --- |
| IdentityRegistry | `0xe6DF2a398A09c0C0ED23CEF4219322060c35C090` |
| MedicalDataRegistry | `0x037601068F0aAC93FbDb631c746D5f347C999661` |
| ConsentAccessControl | `0xFC96D31921Ea9477B5dC923912e4655f7e5C693f` |

## 本地启动

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

访问：

```text
http://localhost:5173
```

API：

```text
http://localhost:4100/api/health
```

## MetaMask 演示流程

1. 打开 `http://localhost:5173`。
2. 点击“连接 MetaMask”。
3. 点击“切换到 Sepolia”。
4. 当前业务角色选择 `患者 Patient`。
5. 点击“登记链上身份”并确认交易。
6. 点击“加密上传样例血检”，确认链上数据资产登记交易。
7. 如需完整医生授权流程，切换到另一个医生钱包：
   - 选择 `医生 Doctor`。
   - 登记医生链上身份。
   - 需要部署账户或机构管理员调用合约审批医生身份。
   - 医生再发起访问申请。
   - 患者钱包审批授权。

审批医生身份的命令：

```powershell
$env:SEPOLIA_RPC_URL='https://ethereum-sepolia-rpc.publicnode.com'
$env:DEPLOYER_PRIVATE_KEY='0xYOUR_TESTNET_ADMIN_PRIVATE_KEY'
$env:APPROVE_USER_ADDRESS='0xDOCTOR_WALLET_ADDRESS'
npm.cmd --workspace contracts run approve:sepolia
```

## 当前工程边界

1. 合约已经部署到 Sepolia。
2. 前端已接入 MetaMask，并能发起身份登记、数据资产登记、访问申请、授权审批和撤销交易。
3. 后端目前仍是演示索引服务，使用内存存储模拟 IPFS、通知和审计索引。
4. 医生身份链上审批需要管理员钱包执行；前端当前提供身份登记，管理员审批可后续补 UI 或用 Hardhat task 调用。
5. 医疗数据演示使用浏览器 AES-GCM 加密，真实生产还需要独立的密钥备份、ECIES/X25519 密钥封装和持久化 IPFS pinning。

## 安全说明

已经暴露过的私钥只能用于测试网。不要向该钱包转入主网 ETH 或任何真实资产。不要在系统中上传真实医疗数据。
