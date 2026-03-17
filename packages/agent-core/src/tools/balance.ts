import type { Address } from "viem";
import { formatUnits } from "viem";
import { getPublicClient } from "../blockchain/clients.js";
import { erc20Abi } from "../blockchain/abis.js";
import { getAddresses } from "../blockchain/addresses.js";

export interface BalanceInfo {
  address: Address;
  balance: bigint;
  formatted: string;
  symbol: string;
  decimals: number;
}

export async function checkBalance(account: Address): Promise<BalanceInfo> {
  const pub = getPublicClient();
  const addr = getAddresses(await pub.getChainId());

  const balance = (await pub.readContract({
    address: addr.paymentToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;

  const symbol = (await pub.readContract({
    address: addr.paymentToken,
    abi: erc20Abi,
    functionName: "symbol",
  })) as string;

  const decimals = (await pub.readContract({
    address: addr.paymentToken,
    abi: erc20Abi,
    functionName: "decimals",
  })) as number;

  return {
    address: account,
    balance,
    formatted: formatUnits(balance, decimals),
    symbol,
    decimals,
  };
}
