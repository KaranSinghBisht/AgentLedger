import {
  type Address,
  type Hash,
  keccak256,
  toHex,
  decodeEventLog,
} from "viem";
import { getPublicClient, getWalletClient } from "../blockchain/clients.js";
import { escrowAbi, erc20Abi } from "../blockchain/abis.js";
import { getAddresses } from "../blockchain/addresses.js";
import { getNextNonce, resetNonce } from "../blockchain/nonce-manager.js";

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

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "createJob",
      args: [params.provider, params.evaluator, params.expiredAt, params.description, params.hook],
      nonce,
    });

    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    // Extract jobId from JobCreated event using safe decoding
    let jobId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: escrowAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "JobCreated") {
          jobId = (decoded.args as unknown as { jobId: bigint }).jobId;
          break;
        }
      } catch {
        // Not our event, skip
      }
    }

    if (jobId === null) {
      throw new Error(`createJob tx ${txHash} succeeded but no JobCreated event found — check contract address and ABI`);
    }

    return { jobId, txHash };
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function setProvider(jobId: bigint, provider: Address): Promise<Hash> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  try {
    return await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "setProvider",
      args: [jobId, provider],
      nonce,
    });
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function setBudget(jobId: bigint, amount: bigint): Promise<Hash> {
  const wallet = getWalletClient("worker");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "setBudget",
      args: [jobId, amount, "0x"],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function fundJob(jobId: bigint): Promise<Hash> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const account = wallet.account;

  try {
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
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "fund",
      args: [jobId, "0x"],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(account.address);
    throw err;
  }
}

export async function submitWork(jobId: bigint, deliverable: string): Promise<Hash> {
  const wallet = getWalletClient("worker");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const deliverableHash = keccak256(toHex(deliverable));

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "submit",
      args: [jobId, deliverableHash, "0x"],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function completeJob(jobId: bigint, reason: string): Promise<Hash> {
  const wallet = getWalletClient("sentinel");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const reasonHash = keccak256(toHex(reason));

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "complete",
      args: [jobId, reasonHash, "0x"],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function rejectJob(jobId: bigint, reason: string): Promise<Hash> {
  const wallet = getWalletClient("sentinel");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);
  const reasonHash = keccak256(toHex(reason));

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "reject",
      args: [jobId, reasonHash, "0x"],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
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

  // Viem may return a named object or positional tuple depending on ABI shape
  const r = result as unknown as Record<string, unknown>;
  if (r && typeof r === "object" && "id" in r) {
    return {
      id: r.id as bigint,
      client: r.client as Address,
      provider: r.provider as Address,
      evaluator: r.evaluator as Address,
      hook: r.hook as Address,
      description: r.description as string,
      budget: r.budget as bigint,
      expiredAt: r.expiredAt as bigint,
      status: Number(r.status),
    };
  }
  // Fallback: positional tuple
  const arr = result as unknown as readonly [bigint, Address, Address, Address, Address, string, bigint, bigint, number];
  return {
    id: arr[0],
    client: arr[1],
    provider: arr[2],
    evaluator: arr[3],
    hook: arr[4],
    description: arr[5],
    budget: arr[6],
    expiredAt: arr[7],
    status: Number(arr[8]),
  };
}

export async function claimRefund(jobId: bigint): Promise<Hash> {
  const wallet = getWalletClient("orchestrator");
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());
  const nonce = await getNextNonce(wallet.account.address);

  try {
    const txHash = await wallet.writeContract({
      address: addr.escrow,
      abi: escrowAbi,
      functionName: "claimRefund",
      args: [jobId],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function browseJobs(statusFilter?: number[]): Promise<JobData[]> {
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());

  const count = (await pub.readContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "jobCount",
  })) as bigint;

  // Scan backwards (newest first), collect up to 50 matching jobs.
  // This ensures active jobs aren't silently truncated regardless of total count.
  const limit = 50;
  const jobs: JobData[] = [];
  for (let i = count - 1n; i >= 0n && jobs.length < limit; i--) {
    const job = await getJob(i);
    if (!statusFilter || statusFilter.includes(job.status)) {
      jobs.push(job);
    }
  }

  // Return in ascending order (oldest first)
  return jobs.reverse();
}
