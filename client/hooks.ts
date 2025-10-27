import * as anchor from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { MembersClientDapp } from "./members-client-dapp";
import { ControllerClientDapp } from "./controller-client-dapp";
import { PublicKey } from "@solana/web3.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/**
 * 创建 AnchorProvider 实例
 */
export function useAnchorProvider() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    const provider = new anchor.AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    return provider;
  }, [connection, wallet]);
}

/**
 * 创建 MembersClientDapp 实例
 */
export function useMembersClient(programId?: PublicKey) {
  const provider = useAnchorProvider();
  const wallet = useWallet();

  return useMemo(() => {
    if (!provider || !wallet.publicKey) return null;
    return new MembersClientDapp(provider, wallet, programId);
  }, [provider, wallet, programId]);
}

/**
 * 创建 ControllerClientDapp 实例
 */
export function useControllerClient(programId?: PublicKey) {
  const provider = useAnchorProvider();
  const wallet = useWallet();

  return useMemo(() => {
    if (!provider || !wallet.publicKey) return null;
    return new ControllerClientDapp(provider, wallet, programId);
  }, [provider, wallet, programId]);
}

/**
 * 获取 Members 存储信息的 hook
 */
export function useGetMembersStore() {
  const { connection } = useConnection();
  const membersClient = useMembersClient();

  return useQuery({
    queryKey: ["get-members-store", { endpoint: connection.rpcEndpoint }],
    queryFn: async () => {
      if (!membersClient) throw new Error("Members客户端未初始化");
      return await membersClient.getMembersStore();
    },
    enabled: !!membersClient,
  });
}

/**
 * 获取商户列表的 hook
 */
export function useGetMerchants() {
  const { connection } = useConnection();
  const membersClient = useMembersClient();

  return useQuery({
    queryKey: ["get-merchants", { endpoint: connection.rpcEndpoint }],
    queryFn: async () => {
      if (!membersClient) throw new Error("Members客户端未初始化");
      return await membersClient.getMerchants();
    },
    enabled: !!membersClient,
  });
}

/**
 * 初始化 Members 程序的 hook
 */
export function useInitializeMembers() {
  const { connection } = useConnection();
  const membersClient = useMembersClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["initialize-members", { endpoint: connection.rpcEndpoint }],
    mutationFn: async () => {
      if (!membersClient) throw new Error("Members客户端未初始化");
      return await membersClient.initialize();
    },
    onSuccess: (signature) => {
      toast.success(`初始化成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-members-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`初始化失败: ${error}`);
    },
  });
}

/**
 * 添加商户的 hook
 */
export function useAddMerchant() {
  const { connection } = useConnection();
  const membersClient = useMembersClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["add-merchant", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (merchant: PublicKey) => {
      if (!membersClient) throw new Error("Members客户端未初始化");
      return await membersClient.addMerchant(merchant);
    },
    onSuccess: (signature) => {
      toast.success(`添加商户成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-merchants"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["get-members-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`添加商户失败: ${error}`);
    },
  });
}

/**
 * 移除商户的 hook
 */
export function useRemoveMerchant() {
  const { connection } = useConnection();
  const membersClient = useMembersClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["remove-merchant", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (merchant: PublicKey) => {
      if (!membersClient) throw new Error("Members客户端未初始化");
      return await membersClient.removeMerchant(merchant);
    },
    onSuccess: (signature) => {
      toast.success(`移除商户成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-merchants"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["get-members-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`移除商户失败: ${error}`);
    },
  });
}

/**
 * 获取 Controller 存储信息的 hook
 */
export function useGetControllerStore() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();

  return useQuery({
    queryKey: ["get-controller-store", { endpoint: connection.rpcEndpoint }],
    queryFn: async () => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.getControllerStore();
    },
    enabled: !!controllerClient,
  });
}

/**
 * 初始化 Controller 程序的 hook
 */
export function useInitializeController() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [
      "initialize-controller",
      { endpoint: connection.rpcEndpoint },
    ],
    mutationFn: async (tokenMint: PublicKey) => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.initialize(tokenMint);
    },
    onSuccess: (signature) => {
      toast.success(`初始化成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-controller-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`初始化失败: ${error}`);
    },
  });
}

/**
 * 铸造代币的 hook
 */
export function useMintToken() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["mint-token", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (params: {
      amount: anchor.BN;
      destination: PublicKey;
      tokenMint: PublicKey;
    }) => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.mint(
        params.amount,
        params.destination,
        params.tokenMint
      );
    },
    onSuccess: (signature) => {
      toast.success(`铸造代币成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-token-accounts"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`铸造代币失败: ${error}`);
    },
  });
}

/**
 * 销毁代币的 hook
 */
export function useBurnToken() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["burn-token", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (params: { amount: anchor.BN; tokenMint: PublicKey }) => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.burn(params.amount, params.tokenMint);
    },
    onSuccess: (signature) => {
      toast.success(`销毁代币成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-token-accounts"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`销毁代币失败: ${error}`);
    },
  });
}

/**
 * 设置 Members 程序的 hook
 */
export function useSetMembers() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["set-members", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (membersProgram: PublicKey) => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.setMembers(membersProgram);
    },
    onSuccess: (signature) => {
      toast.success(`设置Members程序成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-controller-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`设置Members程序失败: ${error}`);
    },
  });
}

/**
 * 设置 Factory 程序的 hook
 */
export function useSetFactory() {
  const { connection } = useConnection();
  const controllerClient = useControllerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["set-factory", { endpoint: connection.rpcEndpoint }],
    mutationFn: async (factoryProgram: PublicKey) => {
      if (!controllerClient) throw new Error("Controller客户端未初始化");
      return await controllerClient.setFactory(factoryProgram);
    },
    onSuccess: (signature) => {
      toast.success(`设置Factory程序成功: ${signature.slice(0, 8)}...`);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["get-controller-store"],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`设置Factory程序失败: ${error}`);
    },
  });
}
