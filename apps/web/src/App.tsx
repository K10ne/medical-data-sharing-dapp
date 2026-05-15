import {
  Activity,
  BadgeCheck,
  Bell,
  Binary,
  ClipboardCheck,
  Database,
  Eye,
  FileKey,
  FilePlus2,
  History,
  KeyRound,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Wallet
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { api } from "./lib/api";
import { activeDeployment, blockExplorer, connectMetaMask, hasContracts, switchToTargetChain, targetChainId, targetChainName } from "./lib/chain";
import {
  approveRequestOnChain,
  bytes32,
  createAccessRequestOnChain,
  registerDataAssetOnChain,
  registerUserOnChain,
  revokeGrantOnChain
} from "./lib/contracts";
import { decodePayload, decryptJson, encodePayload, encryptJson, sha256Hex } from "./lib/crypto";
import { categoryLabel, demoAccounts, purposeLabel, sampleMedicalRecord } from "./lib/demo";
import type {
  AccessGrant,
  AccessRequest,
  AuditEvent,
  DataAsset,
  DataCategory,
  DemoAccount,
  NotificationItem,
  Role,
  UserProfile
} from "./lib/types";

type View = "dashboard" | "data" | "requests" | "grants" | "doctor" | "audit";

interface WalletState {
  connected: boolean;
  address: string;
  chainId: number;
}

const secretFor = (address: string) => `medledger-demo-secret:${address.toLowerCase()}`;

function shortAddress(address?: string) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (["active", "approved", "normal"].includes(status)) return "success";
  if (["pending"].includes(status)) return "warning";
  if (["revoked", "rejected", "expired", "disabled"].includes(status)) return "danger";
  return "";
}

function normalize(address: string) {
  return address.toLowerCase();
}

export default function App() {
  const [demoAccount, setDemoAccount] = useState<DemoAccount>(demoAccounts[0]);
  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: demoAccounts[0].address, chainId: 0 });
  const [activeRole, setActiveRole] = useState<Role>("patient");
  const [view, setView] = useState<View>("dashboard");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assets, setAssets] = useState<DataAsset[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [txMode, setTxMode] = useState<"chain" | "demo">("chain");

  const accountAddress = wallet.connected ? wallet.address : demoAccount.address;
  const accountLabel = wallet.connected ? `${shortAddress(wallet.address)} MetaMask` : demoAccount.label;
  const isCorrectNetwork = wallet.connected ? wallet.chainId === targetChainId : true;
  const patientAddress = activeRole === "patient" ? accountAddress : demoAccounts[0].address;
  const doctorAddress = activeRole === "doctor" ? accountAddress : demoAccounts[1].address;

  async function refresh() {
    const [nextUsers, nextAssets, nextRequests, nextGrants, nextAudit, nextNotifications] = await Promise.all([
      api.users().catch(() => []),
      api.assets().catch(() => []),
      api.requests().catch(() => []),
      api.grants().catch(() => []),
      api.audit().catch(() => []),
      api.notifications(accountAddress).catch(() => [])
    ]);
    setUsers(nextUsers);
    setAssets(nextAssets);
    setRequests(nextRequests);
    setGrants(nextGrants);
    setAudit(nextAudit);
    setNotifications(nextNotifications);
  }

  useEffect(() => {
    refresh();
  }, [accountAddress]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: unknown) => {
      const first = Array.isArray(accounts) ? accounts[0] : undefined;
      if (typeof first === "string") {
        setWallet((current) => ({ ...current, connected: true, address: first }));
      }
    };
    const onChain = (chainId: unknown) => {
      if (typeof chainId === "string") {
        setWallet((current) => ({ ...current, chainId: Number.parseInt(chainId, 16) }));
      }
    };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const accountRequests = useMemo(() => {
    return requests.filter((request) => request.patient === normalize(accountAddress) || request.requester === normalize(accountAddress));
  }, [requests, accountAddress]);

  const accountGrants = useMemo(() => {
    return grants.filter((grant) => grant.patient === normalize(accountAddress) || grant.grantee === normalize(accountAddress));
  }, [grants, accountAddress]);

  const metrics = [
    { label: "数据资产", value: assets.length, icon: Database },
    { label: "待处理申请", value: requests.filter((item) => item.status === "pending").length, icon: ClipboardCheck },
    { label: "有效授权", value: grants.filter((item) => item.status === "active").length, icon: FileKey },
    { label: "审计事件", value: audit.length, icon: History }
  ];

  async function connectWallet() {
    setLoading(true);
    try {
      const next = await connectMetaMask();
      setWallet({ connected: true, address: next.address, chainId: next.chainId });
      setToast({ title: "MetaMask 已连接", body: `当前账户 ${shortAddress(next.address)}，链 ID ${next.chainId}` });
    } catch (error) {
      setToast({ title: "钱包连接失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function switchNetwork() {
    setLoading(true);
    try {
      await switchToTargetChain();
      const next = await connectMetaMask();
      setWallet({ connected: true, address: next.address, chainId: next.chainId });
      setToast({ title: "网络已切换", body: `当前网络为 ${targetChainName}` });
    } catch (error) {
      setToast({ title: "网络切换失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function registerCurrentUser() {
    if (!wallet.connected) {
      setToast({ title: "需要连接钱包", body: "请先连接 MetaMask，再登记链上身份。" });
      return;
    }
    setLoading(true);
    try {
      const txHash = await registerUserOnChain(activeRole, wallet.address);
      await api.users().catch(() => []);
      setToast({ title: "身份已登记到链上", body: `交易 ${shortAddress(txHash)}` });
    } catch (error) {
      setToast({ title: "身份登记失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function runDemoUpload() {
    setLoading(true);
    try {
      const owner = wallet.connected ? wallet.address : patientAddress;
      const encrypted = await encryptJson(sampleMedicalRecord, secretFor(owner));
      const encoded = encodePayload(encrypted);
      const contentHash = (await sha256Hex(encoded)) as Hex;
      const metadata = {
        title: sampleMedicalRecord.title,
        category: "LAB_REPORT",
        hospital: sampleMedicalRecord.hospital,
        department: sampleMedicalRecord.department,
        recordDate: sampleMedicalRecord.recordDate,
        tags: ["blood", "routine"]
      };
      const metadataHash = (await sha256Hex(JSON.stringify(metadata))) as Hex;
      const blob = await api.uploadBlob({
        bytesBase64: encoded,
        contentType: "application/medledger+json"
      });
      const cidHash = (await sha256Hex(blob.cid)) as Hex;

      let txHash = "";
      if (wallet.connected && txMode === "chain") {
        txHash = await registerDataAssetOnChain({
          cidHash,
          contentHash,
          metadataHash,
          category: "LAB_REPORT"
        });
      }

      await api.createAsset({
        owner,
        title: sampleMedicalRecord.title,
        category: "LAB_REPORT",
        hospital: sampleMedicalRecord.hospital,
        department: sampleMedicalRecord.department,
        recordDate: sampleMedicalRecord.recordDate,
        tags: ["blood", "routine"],
        cid: blob.cid,
        cidHash,
        contentHash,
        metadataHash
      });
      await refresh();
      setToast({
        title: txHash ? "链上登记完成" : "演示上传完成",
        body: txHash ? `合约交易 ${shortAddress(txHash)}，后端索引已同步。` : "密文已写入模拟 IPFS，资产摘要已登记到索引。"
      });
    } catch (error) {
      setToast({ title: "上传失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function createDoctorRequest(assetIds?: string[]) {
    const scope = assetIds?.length ? assetIds : assets.filter((asset) => asset.owner === normalize(patientAddress)).map((asset) => asset.assetId);
    if (scope.length === 0) {
      setToast({ title: "暂无可申请数据", body: "请先以患者身份上传一份医疗数据。" });
      return;
    }
    setLoading(true);
    try {
      let txHash = "";
      if (wallet.connected && txMode === "chain") {
        txHash = await createAccessRequestOnChain({
          patient: patientAddress as Address,
          assetIds: scope.slice(0, 3).map((id) => BigInt(id)),
          purpose: "TREATMENT",
          durationSeconds: 168n * 60n * 60n
        });
      }
      await api.createRequest({
        requester: wallet.connected ? wallet.address : doctorAddress,
        patient: patientAddress,
        assetIds: scope.slice(0, 3),
        purpose: "TREATMENT",
        requestedDurationHours: 168
      });
      await refresh();
      setToast({
        title: txHash ? "链上访问申请已提交" : "访问申请已提交",
        body: txHash ? `交易 ${shortAddress(txHash)}，患者端可审批。` : "患者端可在待处理申请中审批本次请求。"
      });
    } catch (error) {
      setToast({ title: "申请失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function approveRequest(requestId: string) {
    setLoading(true);
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const encryptedKeyRef = `wrapped-key:${requestId}:${doctorAddress}`;
      let txHash = "";
      if (wallet.connected && txMode === "chain") {
        txHash = await approveRequestOnChain({
          requestId: BigInt(requestId),
          encryptedKeyUri: encryptedKeyRef,
          encryptedKeyHash: bytes32(encryptedKeyRef),
          expiresAtSeconds: BigInt(Math.floor(new Date(expiresAt).getTime() / 1000))
        });
      }
      await api.approveRequest(requestId, { encryptedKeyRef, expiresAt });
      await refresh();
      setToast({
        title: txHash ? "链上授权已通过" : "授权已通过",
        body: txHash ? `交易 ${shortAddress(txHash)}，医生可解密查看。` : "医生现在可在授权数据页面解密查看数据。"
      });
    } catch (error) {
      setToast({ title: "审批失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function rejectRequest(requestId: string) {
    setLoading(true);
    try {
      await api.rejectRequest(requestId, accountAddress);
      await refresh();
      setToast({ title: "申请已拒绝", body: "系统已记录拒绝审计事件。" });
    } catch (error) {
      setToast({ title: "拒绝失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  async function revokeGrant(grantId: string) {
    setLoading(true);
    try {
      let txHash = "";
      if (wallet.connected && txMode === "chain") {
        txHash = await revokeGrantOnChain(BigInt(grantId));
      }
      await api.revokeGrant(grantId, accountAddress);
      await refresh();
      setToast({
        title: txHash ? "链上授权已撤销" : "授权已撤销",
        body: txHash ? `交易 ${shortAddress(txHash)}，后续系统内访问会被拒绝。` : "后续系统内访问将被拒绝。"
      });
    } catch (error) {
      setToast({ title: "撤销失败", body: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={23} aria-hidden="true" />
          </div>
          <div>
            <h1>MedLedger</h1>
            <p>隐私医疗数据共享 DApp</p>
          </div>
        </div>

        <div className="account-card">
          <label htmlFor="demoAccount">演示账户</label>
          <select
            id="demoAccount"
            value={demoAccount.address}
            disabled={wallet.connected}
            onChange={(event) => {
              const next = demoAccounts.find((item) => item.address === event.target.value)!;
              setDemoAccount(next);
              setActiveRole(next.role);
            }}
          >
            {demoAccounts.map((item) => (
              <option key={item.address} value={item.address}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="button-row">
            <button className="btn primary" disabled={loading} onClick={connectWallet}>
              <Wallet size={16} aria-hidden="true" />
              {wallet.connected ? "重新连接" : "连接 MetaMask"}
            </button>
            <button className="btn" disabled={loading || !wallet.connected} onClick={switchNetwork}>
              切换网络
            </button>
          </div>
          <div className="meta-row" style={{ marginTop: 10 }}>
            <span className={`pill ${wallet.connected ? "success" : "warning"}`}>
              <Wallet size={14} aria-hidden="true" />
              {shortAddress(accountAddress)}
            </span>
            <span className={`pill ${isCorrectNetwork ? "success" : "danger"}`}>
              {wallet.connected ? `Chain ${wallet.chainId}` : "Demo"}
            </span>
          </div>
        </div>

        <div className="account-card" style={{ marginTop: 12 }}>
          <label htmlFor="role">当前业务角色</label>
          <select id="role" value={activeRole} onChange={(event) => setActiveRole(event.target.value as Role)}>
            <option value="patient">患者 Patient</option>
            <option value="doctor">医生 Doctor</option>
            <option value="researcher">研究人员 Researcher</option>
            <option value="admin">机构管理员 Admin</option>
            <option value="auditor">审计员 Auditor</option>
          </select>
          <div className="button-row">
            <button className="btn" disabled={loading || !wallet.connected || !hasContracts()} onClick={registerCurrentUser}>
              <UserCheck size={16} aria-hidden="true" />
              登记链上身份
            </button>
          </div>
        </div>

        <nav className="nav-group" aria-label="主导航">
          <NavButton view={view} target="dashboard" onClick={setView} icon={Activity} label="工作台" />
          <NavButton view={view} target="data" onClick={setView} icon={FilePlus2} label="患者数据" />
          <NavButton view={view} target="requests" onClick={setView} icon={ClipboardCheck} label="申请审批" />
          <NavButton view={view} target="grants" onClick={setView} icon={FileKey} label="授权管理" />
          <NavButton view={view} target="doctor" onClick={setView} icon={Stethoscope} label="医生访问" />
          <NavButton view={view} target="audit" onClick={setView} icon={History} label="审计中心" />
        </nav>

        <div className="sidebar-note">
          合约目标网络：{targetChainName}。私钥不写入前端；链上交易只由 MetaMask 签名。
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">ETHEREUM PRIVACY WORKSTATION</p>
            <h2>患者控制授权，医生按期限访问，所有关键动作可追溯。</h2>
            <p>
              当前账户：{accountLabel}。合约地址来自部署产物；后端只负责模拟 IPFS、事件索引和通知，不保存医疗明文。
            </p>
          </div>
          <div className="status-strip" aria-label="系统状态">
            <span className={`pill ${hasContracts() ? "success" : "danger"}`}>
              <BadgeCheck size={14} aria-hidden="true" />
              {hasContracts() ? "Contracts Ready" : "No Deployment"}
            </span>
            <span className={`pill ${isCorrectNetwork ? "success" : "danger"}`}>
              <Binary size={14} aria-hidden="true" />
              {targetChainName}
            </span>
            <span className="pill warning">
              <Bell size={14} aria-hidden="true" />
              {notifications.filter((item) => !item.read).length} unread
            </span>
          </div>
        </header>

        <section className="metric-grid" aria-label="系统指标">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div className="metric" key={metric.label}>
                <span>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <strong>{metric.value}</strong>
                <p>{metric.label}</p>
              </div>
            );
          })}
        </section>

        <NetworkPanel
          wallet={wallet}
          txMode={txMode}
          setTxMode={setTxMode}
          onConnect={connectWallet}
          onSwitch={switchNetwork}
          loading={loading}
        />

        {view === "dashboard" && (
          <Dashboard
            accountLabel={accountLabel}
            notifications={notifications}
            audit={audit}
            loading={loading}
            onUpload={runDemoUpload}
            onRequest={() => createDoctorRequest()}
            onRefresh={refresh}
          />
        )}
        {view === "data" && <PatientDataView assets={assets} loading={loading} onUpload={runDemoUpload} onRequest={createDoctorRequest} />}
        {view === "requests" && (
          <RequestView
            requests={accountRequests}
            assets={assets}
            users={users}
            accountAddress={accountAddress}
            loading={loading}
            onApprove={approveRequest}
            onReject={rejectRequest}
          />
        )}
        {view === "grants" && (
          <GrantView grants={accountGrants} assets={assets} users={users} accountAddress={accountAddress} loading={loading} onRevoke={revokeGrant} />
        )}
        {view === "doctor" && (
          <DoctorView
            assets={assets}
            grants={grants}
            accountAddress={accountAddress}
            loading={loading}
            onRequest={createDoctorRequest}
            onToast={setToast}
            onRefresh={refresh}
          />
        )}
        {view === "audit" && <AuditView audit={audit} />}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <strong>{toast.title}</strong>
          <p>{toast.body}</p>
        </div>
      )}
    </div>
  );
}

function NetworkPanel({
  wallet,
  txMode,
  setTxMode,
  onConnect,
  onSwitch,
  loading
}: {
  wallet: WalletState;
  txMode: "chain" | "demo";
  setTxMode: (mode: "chain" | "demo") => void;
  onConnect: () => void;
  onSwitch: () => void;
  loading: boolean;
}) {
  return (
    <section className="panel network-panel">
      <div className="panel-body network-grid">
        <div>
          <p className="eyebrow">DEPLOYMENT</p>
          <h3>链上部署状态</h3>
          <div className="meta-row">
            <span className="pill">Chain {activeDeployment.chainId}</span>
            <span className="pill">Identity {shortAddress(activeDeployment.contracts.IdentityRegistry)}</span>
            <span className="pill">Data {shortAddress(activeDeployment.contracts.MedicalDataRegistry)}</span>
            <span className="pill">Consent {shortAddress(activeDeployment.contracts.ConsentAccessControl)}</span>
          </div>
          {blockExplorer && activeDeployment.contracts.ConsentAccessControl && (
            <a className="btn ghost" href={`${blockExplorer}/address/${activeDeployment.contracts.ConsentAccessControl}`} target="_blank" rel="noreferrer">
              查看区块浏览器
            </a>
          )}
        </div>
        <div className="button-row network-actions">
          <button className="btn primary" disabled={loading} onClick={onConnect}>
            <Wallet size={16} aria-hidden="true" />
            {wallet.connected ? "刷新钱包" : "连接钱包"}
          </button>
          <button className="btn" disabled={loading || !wallet.connected} onClick={onSwitch}>
            切换到 {targetChainName}
          </button>
          <select aria-label="交易模式" value={txMode} onChange={(event) => setTxMode(event.target.value as "chain" | "demo")}>
            <option value="chain">链上交易优先</option>
            <option value="demo">仅演示索引</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function NavButton({
  view,
  target,
  onClick,
  icon: Icon,
  label
}: {
  view: View;
  target: View;
  onClick: (view: View) => void;
  icon: typeof Activity;
  label: string;
}) {
  return (
    <button className={`nav-button ${view === target ? "active" : ""}`} onClick={() => onClick(target)}>
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Dashboard({
  accountLabel,
  notifications,
  audit,
  loading,
  onUpload,
  onRequest,
  onRefresh
}: {
  accountLabel: string;
  notifications: NotificationItem[];
  audit: AuditEvent[];
  loading: boolean;
  onUpload: () => void;
  onRequest: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>快速演示流程</h3>
            <p>按顺序完成上传、申请、审批、解密、撤销和审计查看。</p>
          </div>
          <span className="pill">{accountLabel}</span>
        </div>
        <div className="panel-body">
          <div className="button-row" style={{ marginTop: 0 }}>
            <button className="btn primary" disabled={loading} onClick={onUpload}>
              <LockKeyhole size={17} aria-hidden="true" />
              加密上传样例血检
            </button>
            <button className="btn" disabled={loading} onClick={onRequest}>
              <Stethoscope size={17} aria-hidden="true" />
              医生发起访问申请
            </button>
            <button className="btn ghost" onClick={onRefresh}>
              <RefreshCcw size={17} aria-hidden="true" />
              刷新索引
            </button>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {audit.slice(0, 5).map((event) => (
              <AuditItem key={event.id} event={event} />
            ))}
            {audit.length === 0 && <div className="empty">暂无审计事件。先运行一次上传或访问申请。</div>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>通知</h3>
            <p>由后端根据链上事件或演示索引生成。</p>
          </div>
          <Bell size={18} aria-hidden="true" />
        </div>
        <div className="panel-body request-list">
          {notifications.length === 0 && <div className="empty">暂无通知。</div>}
          {notifications.slice(0, 5).map((item) => (
            <div className="request-card" key={item.id}>
              <h4>{item.title}</h4>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{item.body}</p>
              <div className="meta-row" style={{ marginTop: 10 }}>
                <span>{formatDate(item.createdAt)}</span>
                <span className={`pill ${item.read ? "" : "warning"}`}>{item.read ? "已读" : "未读"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PatientDataView({
  assets,
  loading,
  onUpload,
  onRequest
}: {
  assets: DataAsset[];
  loading: boolean;
  onUpload: () => void;
  onRequest: (assetIds?: string[]) => void;
}) {
  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>患者医疗数据资产</h3>
            <p>链上登记摘要，链下存储密文，页面只展示可审计元数据。</p>
          </div>
          <button className="btn primary" disabled={loading} onClick={onUpload}>
            <FilePlus2 size={17} aria-hidden="true" />
            上传样例
          </button>
        </div>
        <div className="panel-body data-list">
          {assets.length === 0 && <div className="empty">暂无数据资产。上传样例后会生成密文 CID 和哈希。</div>}
          {assets.map((asset) => (
            <DataCard key={asset.assetId} asset={asset} actionLabel="医生申请访问" onAction={() => onRequest([asset.assetId])} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>上传策略</h3>
            <p>AES-GCM 本地加密，DataKey 授权时再封装给医生。</p>
          </div>
          <KeyRound size={18} aria-hidden="true" />
        </div>
        <div className="panel-body">
          <div className="request-list">
            <Policy text="医疗明文不进入后端、IPFS 或链上。" />
            <Policy text="链上只保存 CID 哈希、密文哈希、元数据哈希和资产状态。" />
            <Policy text="下载密文后必须先校验 contentHash，再在浏览器解密。" />
          </div>
        </div>
      </section>
    </div>
  );
}

function DataCard({ asset, actionLabel, onAction }: { asset: DataAsset; actionLabel?: string; onAction?: () => void }) {
  return (
    <article className="data-card">
      <div>
        <h4>{asset.title}</h4>
        <div className="meta-row">
          <span className="pill success">{categoryLabel[asset.category]}</span>
          <span>v{asset.version}</span>
          <span>{asset.hospital}</span>
          <span>{asset.recordDate}</span>
        </div>
        <div className="meta-row" style={{ marginTop: 10 }}>
          <span className="hash">CID Hash {asset.cidHash}</span>
          <span className="hash">Content {asset.contentHash}</span>
        </div>
      </div>
      {actionLabel && (
        <button className="btn" onClick={onAction}>
          <Eye size={16} aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </article>
  );
}

function RequestView({
  requests,
  assets,
  users,
  accountAddress,
  loading,
  onApprove,
  onReject
}: {
  requests: AccessRequest[];
  assets: DataAsset[];
  users: UserProfile[];
  accountAddress: string;
  loading: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>访问申请审批</h3>
          <p>患者可查看申请人身份、目的、范围和期限，再决定授权或拒绝。</p>
        </div>
        <span className="pill">{requests.length} requests</span>
      </div>
      <div className="panel-body request-list">
        {requests.length === 0 && <div className="empty">暂无与你相关的访问申请。</div>}
        {requests.map((request) => {
          const requester = users.find((user) => user.address === request.requester);
          const relatedAssets = assets.filter((asset) => request.assetIds.includes(asset.assetId));
          return (
            <article className="request-card" key={request.requestId}>
              <h4>
                申请 #{request.requestId} · {purposeLabel[request.purpose] ?? request.purpose}
              </h4>
              <div className="meta-row">
                <span className="pill">{requester?.displayName ?? shortAddress(request.requester)}</span>
                <span className={`pill ${statusClass(request.status)}`}>{request.status}</span>
                <span>{request.requestedDurationHours} 小时</span>
                <span>{formatDate(request.createdAt)}</span>
              </div>
              <div className="data-list" style={{ marginTop: 12 }}>
                {relatedAssets.map((asset) => (
                  <DataCard key={asset.assetId} asset={asset} />
                ))}
              </div>
              {normalize(accountAddress) === request.patient && request.status === "pending" && (
                <div className="button-row">
                  <button className="btn primary" disabled={loading} onClick={() => onApprove(request.requestId)}>
                    <BadgeCheck size={16} aria-hidden="true" />
                    授权 7 天
                  </button>
                  <button className="btn danger" disabled={loading} onClick={() => onReject(request.requestId)}>
                    拒绝申请
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GrantView({
  grants,
  assets,
  users,
  accountAddress,
  loading,
  onRevoke
}: {
  grants: AccessGrant[];
  assets: DataAsset[];
  users: UserProfile[];
  accountAddress: string;
  loading: boolean;
  onRevoke: (grantId: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>授权管理</h3>
          <p>撤销只阻止未来系统内访问，已离线复制的数据需要通过审计和责任追溯治理。</p>
        </div>
        <span className="pill">{grants.length} grants</span>
      </div>
      <div className="panel-body request-list">
        {grants.length === 0 && <div className="empty">暂无授权记录。</div>}
        {grants.map((grant) => {
          const grantee = users.find((user) => user.address === grant.grantee);
          return (
            <article className="grant-card" key={grant.grantId}>
              <h4>
                授权 #{grant.grantId} · {grantee?.displayName ?? shortAddress(grant.grantee)}
              </h4>
              <div className="meta-row">
                <span className={`pill ${statusClass(grant.status)}`}>{grant.status}</span>
                <span>到期 {formatDate(grant.expiresAt)}</span>
                <span className="hash">{grant.encryptedKeyRef}</span>
              </div>
              <div className="data-list" style={{ marginTop: 12 }}>
                {assets
                  .filter((asset) => grant.assetIds.includes(asset.assetId))
                  .map((asset) => (
                    <DataCard key={asset.assetId} asset={asset} />
                  ))}
              </div>
              {normalize(accountAddress) === grant.patient && grant.status === "active" && (
                <div className="button-row">
                  <button className="btn danger" disabled={loading} onClick={() => onRevoke(grant.grantId)}>
                    撤销授权
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DoctorView({
  assets,
  grants,
  accountAddress,
  loading,
  onRequest,
  onToast,
  onRefresh
}: {
  assets: DataAsset[];
  grants: AccessGrant[];
  accountAddress: string;
  loading: boolean;
  onRequest: () => void;
  onToast: (toast: { title: string; body: string }) => void;
  onRefresh: () => void;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [record, setRecord] = useState<typeof sampleMedicalRecord | null>(null);

  async function decryptSelected(event: FormEvent) {
    event.preventDefault();
    const asset = assets.find((item) => item.assetId === selectedAssetId);
    if (!asset) {
      onToast({ title: "未选择数据", body: "请选择一份已授权数据。" });
      return;
    }
    const grant = grants.find((item) => item.assetIds.includes(asset.assetId) && item.status === "active" && item.grantee === normalize(accountAddress));
    if (!grant) {
      onToast({ title: "无有效授权", body: "当前账号没有这份数据的有效授权。" });
      return;
    }
    try {
      const blob = await api.getBlob(asset.cid);
      const contentHash = await sha256Hex(blob.bytesBase64);
      if (contentHash !== asset.contentHash) {
        onToast({ title: "完整性校验失败", body: "密文哈希与资产登记记录不一致，已阻止解密。" });
        return;
      }
      const decrypted = await decryptJson<typeof sampleMedicalRecord>(decodePayload(blob.bytesBase64), secretFor(asset.owner));
      await api.recordAccess(grant.grantId, asset.assetId, accountAddress);
      setRecord(decrypted);
      onToast({ title: "已解密查看", body: "系统已记录本次访问审计事件。" });
      await onRefresh();
    } catch (error) {
      onToast({ title: "解密失败", body: error instanceof Error ? error.message : "未知错误" });
    }
  }

  const authorizedAssets = assets.filter((asset) =>
    grants.some((grant) => grant.assetIds.includes(asset.assetId) && grant.status === "active" && grant.grantee === normalize(accountAddress))
  );

  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>医生授权数据</h3>
            <p>解密前校验密文哈希，展示时叠加访问者地址和授权水印。</p>
          </div>
          <button className="btn" disabled={loading} onClick={onRequest}>
            <Stethoscope size={16} aria-hidden="true" />
            发起申请
          </button>
        </div>
        <div className="panel-body">
          <form onSubmit={decryptSelected} className="form-grid">
            <div className="field full">
              <label htmlFor="assetSelect">选择已授权数据</label>
              <select id="assetSelect" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
                <option value="">请选择</option>
                {authorizedAssets.map((asset) => (
                  <option key={asset.assetId} value={asset.assetId}>
                    #{asset.assetId} {asset.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <button className="btn primary" type="submit">
                <Eye size={16} aria-hidden="true" />
                校验并解密
              </button>
            </div>
          </form>

          {record && (
            <div className="viewer" data-watermark={`${shortAddress(accountAddress)} · ${new Date().toLocaleString()}`} style={{ marginTop: 16 }}>
              <h3 style={{ position: "relative", zIndex: 1, marginTop: 0 }}>{record.title}</h3>
              <table className="observation-table">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>结果</th>
                    <th>单位</th>
                    <th>参考范围</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {record.observations.map((item) => (
                    <tr key={item.code}>
                      <td>{item.display}</td>
                      <td>{item.value}</td>
                      <td>{item.unit}</td>
                      <td>{item.range}</td>
                      <td>
                        <span className="pill success">{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>可访问资产</h3>
            <p>只显示当前有效授权范围。</p>
          </div>
          <Eye size={18} aria-hidden="true" />
        </div>
        <div className="panel-body data-list">
          {authorizedAssets.length === 0 && <div className="empty">暂无有效授权。请先发起申请并由患者审批。</div>}
          {authorizedAssets.map((asset) => (
            <DataCard key={asset.assetId} asset={asset} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AuditView({ audit }: { audit: AuditEvent[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>链上审计时间线</h3>
          <p>原型中使用模拟交易哈希和区块高度；真实部署后可由合约事件索引生成。</p>
        </div>
        <span className="pill">{audit.length} events</span>
      </div>
      <div className="panel-body timeline">
        {audit.length === 0 && <div className="empty">暂无审计事件。</div>}
        {audit.map((event) => (
          <AuditItem key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function AuditItem({ event }: { event: AuditEvent }) {
  return (
    <article className="timeline-item">
      <div className="event-dot">
        <History size={15} aria-hidden="true" />
      </div>
      <div>
        <h4>{event.eventType}</h4>
        <p>
          actor {shortAddress(event.actor)}
          {event.target ? ` · target ${shortAddress(event.target)}` : ""}
          {event.assetId ? ` · asset #${event.assetId}` : ""}
          {event.requestId ? ` · request #${event.requestId}` : ""}
          {event.grantId ? ` · grant #${event.grantId}` : ""}
        </p>
        <div className="meta-row" style={{ marginTop: 8 }}>
          <span>{formatDate(event.createdAt)}</span>
          <span className="hash">tx {event.txHash}</span>
          <span>block {event.blockNumber}</span>
        </div>
      </div>
    </article>
  );
}

function Policy({ text }: { text: string }) {
  return (
    <div className="timeline-item">
      <div className="event-dot">
        <UserCheck size={15} aria-hidden="true" />
      </div>
      <div>
        <h4>{text}</h4>
      </div>
    </div>
  );
}
