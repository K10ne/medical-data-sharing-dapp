import type { DemoAccount } from "./types";

export const demoAccounts: DemoAccount[] = [
  {
    address: "0x7a91b554cc4d7c3f4f0890d6b7d0c64bff2b3521",
    label: "Alice Chen 患者",
    role: "patient"
  },
  {
    address: "0x1f9b7c7d233f8b5ad8e2fd61bca12b03aa9f0532",
    label: "Dr. Bob Lin 医生",
    role: "doctor",
    organization: "示例第一医院",
    department: "心内科"
  },
  {
    address: "0xa8a30d7a4f87c4bdb00e5cb192402d7df6c63c77",
    label: "机构管理员",
    role: "admin",
    organization: "示例第一医院"
  },
  {
    address: "0x6b23a4c1098401d5a0f3a857e9b3a1c958b8b1aa",
    label: "审计员",
    role: "auditor"
  }
];

export const categoryLabel: Record<string, string> = {
  LAB_REPORT: "检验报告",
  IMAGING: "影像报告",
  DIAGNOSIS: "诊断记录",
  MEDICATION: "用药记录",
  SURGERY: "手术记录",
  CUSTOM: "自定义文件"
};

export const purposeLabel: Record<string, string> = {
  TREATMENT: "诊疗",
  FOLLOW_UP: "复诊",
  CONSULTATION: "会诊",
  RESEARCH: "科研",
  EMERGENCY: "紧急救治"
};

export const sampleMedicalRecord = {
  resourceType: "ObservationBundle",
  title: "2026-05 血常规报告",
  hospital: "示例第一医院",
  department: "检验科",
  recordDate: "2026-05-01",
  observations: [
    { code: "WBC", display: "白细胞计数", value: 6.2, unit: "10^9/L", range: "3.5-9.5", status: "normal" },
    { code: "HGB", display: "血红蛋白", value: 142, unit: "g/L", range: "130-175", status: "normal" },
    { code: "PLT", display: "血小板计数", value: 216, unit: "10^9/L", range: "125-350", status: "normal" }
  ]
};
