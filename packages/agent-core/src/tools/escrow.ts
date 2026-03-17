import {
  type Address,
  type Hash,
  keccak256,
  toHex,
  formatUnits,
} from "viem";
import { getPublicClient, getWalletClient } from "../blockchain/clients.js";
import { escrowAbi, erc20Abi } from "../blockchain/abis.js";
import { getAddresses } from "../blockchain/addresses.js";
import { getNextNonce } from "../blockchain/nonce-manager.js";

export interface JobData {
  id: bigint;
  client: Address;
  provider: Address;
  evaluator: Address;
  hook: Address;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
}

const STATUS_LABELS = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

export async function createJob(params: {
  provider: Address;
  evaluator: Address;
  expiredAt: bigint;
  description: string;
  hook: Address;
}): Promise<{ jobId: bigint; txHash: Hash }> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  const txHash = await wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "createJob",
    args: [params.provider, params.evaluator, params.expiredAt, params.description, params.hook],
    nonce,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  // Extract jobId from JobCreated event
  const jobCreatedLog = receipt.logs[0];
  const jobId = jobCreatedLog?.topics[1]
    ? BigInt(jobCreatedLog.topics[1])
    : 0n;

  return { jobId, txHash };
}

export async function setProvider(jobId: bigint, provider: Address): Promise<Hash> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "setProvider",
    args: [jobId, provider],
    nonce,
  });
}

export async function setBudget(jobId: bigint, amount: bigint): Promise<Hash> {
  const wallet = getWalletClient("worker");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "setBudget",
    args: [jobId, amount, "0x"],
    nonce,
  });
}

export async function fundJob(jobId: bigint): Promise<Hash> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const account = wallet.account;

  // Check allowance and approve if needed
  const job = await getJob(jobId);
  const allowance = (await pub.readContract({
    address: addr.paymentToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, addr.escrow],
  })) as bigint;

  if (allowance < job.budget) {
    const approveNonce = await getNextNonce(account.address);
    const approveTx = await wallet.writeContract({
      address: addr.paymentToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [addr.escrow, job.budget],
      nonce: approveNonce,
    });
    await pub.waitForTransactionReceipt({ hash: approveTx });
  }

  const nonce = await getNextNonce(account.address);
  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "fund",
    args: [jobId, "0x"],
    nonce,
  });
}

export async function submitWork(jobId: bigint, deliverable: string): Promise<Hash> {
  const wallet = getWalletClient("worker");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const deliverableHash = keccak256(toHex(deliverable));

  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "submit",
    args: [jobId, deliverableHash, "0x"],
    nonce,
  });
}

export async function completeJob(jobId: bigint, reason: string): Promise<Hash> {
  const wallet = getWalletClient("sentinel");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const reasonHash = keccak256(toHex(reason));

  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "complete",
    args: [jobId, reasonHash, "0x"],
    nonce,
  });
}

export async function rejectJob(jobId: bigint, reason: string): Promise<Hash> {
  const wallet = getWalletClient("sentinel");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const reasonHash = keccak256(toHex(reason));

  return wallet.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "reject",
    args: [jobId, reasonHash, "0x"],
    nonce,
  });
}

export async function getJob(jobId: bigint): Promise<JobData> {
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());

  const result = await pub.readContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "getJob",
    args: [jobId],
  });

  return result as unknown as JobData;
}

export async function browseJobs(): Promise<JobData[]> {
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());

  const count = (await pub.readContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "jobCount",
  })) as bigint;

  const jobs: JobData[] = [];
  for (let i = 0n; i < count; i++) {
    const job = await getJob(i);
    jobs.push(job);
  }

  return jobs;
}
