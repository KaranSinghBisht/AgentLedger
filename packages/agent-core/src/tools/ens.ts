import type { Address } from "viem";
import { normalize } from "viem/ens";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// ENS resolution uses Ethereum mainnet
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

export async function resolveAddress(name: string): Promise<Address | null> {
  try {
    const address = await ensClient.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch {
    return null;
  }
}

export async function resolveName(address: Address): Promise<string | null> {
  try {
    const name = await ensClient.getEnsName({ address });
    return name;
  } catch {
    return null;
  }
}
