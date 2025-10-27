import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionInstruction,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";

// Factory program constants
export const FACTORY_SEED = "factory";
export const CUSTODIAN_BTC_ADDRESS_SEED = "custodian_btc_address";
export const MERCHANT_BTC_ADDRESS_SEED = "merchant_btc_address";
export const MINT_REQUEST_SEED = "mint_request";
export const BURN_REQUEST_SEED = "burn_request";
export const MERCHANT_INFO_SEED = "merchant_info";

export class FactoryClient {
  // Program properties
  readonly program: Program;
  readonly provider: AnchorProvider;
  readonly factoryProgramId: PublicKey;

  // PDA addresses
  factoryStore: PublicKey;
  factoryStoreBump: number;

  /**
   * Constructor for FactoryClient
   * @param provider AnchorProvider instance
   * @param programId PublicKey of the factory program
   */
  constructor(provider: AnchorProvider, programId?: PublicKey) {
    this.provider = provider;
    this.factoryProgramId =
      programId ||
      new PublicKey("2g7G8wYYHEYYsqZZwLzruuVbeggwFWiyC2tE5mCRWptQ");

    // 导入 IDL
    const idl = require("../target/idl/factory.json");
    // 设置 IDL 中的 programId
    idl.metadata = idl.metadata || {};
    idl.metadata.address = this.factoryProgramId.toString();

    // 创建程序实例，使用正确的参数顺序
    this.program = new anchor.Program(idl, this.provider);

    // Derive factory store PDA
    const [factoryStore, factoryStoreBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(FACTORY_SEED)],
      this.factoryProgramId
    );
    this.factoryStore = factoryStore;
    this.factoryStoreBump = factoryStoreBump;
  }

  /**
   * Initialize the factory program
   * @param controller PublicKey of the controller
   * @returns Transaction signature
   */
  async initialize(controller: PublicKey): Promise<string> {
    return await this.program.methods
      .initialize({
        controller,
      })
      .accounts({
        payer: this.provider.wallet.publicKey,
        factoryStore: this.factoryStore,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Set custodian BTC deposit address for a merchant
   * @param custodian PublicKey of the custodian
   * @param merchant PublicKey of the merchant
   * @param btcDepositAddress BTC deposit address as string
   * @param membersProgramId PublicKey of the members program
   * @returns Transaction signature
   */
  async setCustodianBtcDepositAddress(
    custodian: Keypair,
    merchant: PublicKey,
    btcDepositAddress: string,
    membersProgramId: PublicKey
  ): Promise<string> {
    // Derive custodian BTC address account
    const [custodianBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(CUSTODIAN_BTC_ADDRESS_SEED), merchant.toBuffer()],
      this.factoryProgramId
    );

    // Derive merchant info account
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.toBuffer()],
      membersProgramId
    );

    // 获取factory store信息以获取controller
    const factoryStoreInfo = await this.getFactoryStore();
    const controller = factoryStoreInfo.controller;

    // 派生controller store账户
    const [controllerStore] = PublicKey.findProgramAddressSync(
      [Buffer.from("controller")],
      controller
    );

    // Derive members store account
    const [membersStore] = PublicKey.findProgramAddressSync(
      [Buffer.from("members")],
      membersProgramId
    );

    return await this.program.methods
      .setCustodianBtcDepositAddress({
        merchant,
        btcDepositAddress,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore: this.factoryStore,
        controllerStore,
        membersStore,
        merchantInfo,
        custodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([custodian])
      .rpc();
  }

  /**
   * Set merchant BTC deposit address
   * @param merchant Keypair of the merchant
   * @param btcDepositAddress BTC deposit address as string
   * @param membersStore PublicKey of the members store
   * @param membersProgramId PublicKey of the members program
   * @returns Transaction signature
   */
  async setMerchantBtcDepositAddress(
    merchant: Keypair,
    btcDepositAddress: string,
    membersStore: PublicKey,
    membersProgramId: PublicKey
  ): Promise<string> {
    // Derive merchant BTC address account
    const [merchantBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_BTC_ADDRESS_SEED), merchant.publicKey.toBuffer()],
      this.factoryProgramId
    );

    // Derive merchant info account
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgramId
    );

    // 获取factory store信息以获取controller
    const factoryStoreInfo = await this.getFactoryStore();
    const controller = factoryStoreInfo.controller;

    // 派生controller store账户
    const [controllerStore] = PublicKey.findProgramAddressSync(
      [Buffer.from("controller")],
      controller
    );

    return await this.program.methods
      .setMerchantBtcDepositAddress({
        btcDepositAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore: this.factoryStore,
        controllerStore,
        merchantInfo,
        merchantBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();
  }

  /**
   * Get merchant BTC deposit address
   * @param merchant PublicKey of the merchant
   * @returns Merchant BTC deposit address data
   */
  async getMerchantBtcDepositAddress(merchant: PublicKey): Promise<any> {
    // Derive merchant BTC address PDA
    const [merchantBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_BTC_ADDRESS_SEED), merchant.toBuffer()],
      this.factoryProgramId
    );

    try {
      // @ts-ignore - account types would normally be available
      return await this.program.account.merchantBtcDepositAddress.fetch(
        merchantBtcAddress
      );
    } catch (error) {
      throw new Error(`Failed to get merchant BTC deposit address: ${error}`);
    }
  }

  /**
   * Get custodian BTC deposit address for a merchant
   * @param merchant PublicKey of the merchant
   * @returns Custodian BTC deposit address data
   */
  async getCustodianBtcDepositAddress(merchant: PublicKey): Promise<any> {
    // Derive custodian BTC address PDA
    const [custodianBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(CUSTODIAN_BTC_ADDRESS_SEED), merchant.toBuffer()],
      this.factoryProgramId
    );

    try {
      // @ts-ignore - account types would normally be available
      return await this.program.account.custodianBtcDepositAddress.fetch(
        custodianBtcAddress
      );
    } catch (error) {
      throw new Error(`Failed to get custodian BTC deposit address: ${error}`);
    }
  }

  /**
   * Get factory store data
   * @returns Factory store data
   */
  async getFactoryStore(): Promise<any> {
    try {
      // @ts-ignore - account types would normally be available
      return await this.program.account.factoryStore.fetch(this.factoryStore);
    } catch (error) {
      throw new Error(`Failed to get factory store: ${error}`);
    }
  }

  /**
   * Get request by nonce and type
   * @param nonce The nonce of the request
   * @param type The request type ("mint" or "burn")
   * @returns Request data with public key
   */
  async getRequest(nonce: number, type: "mint" | "burn"): Promise<any> {
    try {
      // Select correct seed based on type
      const requestSeed =
        type === "mint" ? MINT_REQUEST_SEED : BURN_REQUEST_SEED;

      // Derive request account using appropriate seed and nonce
      const [requestAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(requestSeed),
          Buffer.from(new Uint8Array(new BN(nonce).toArray("le", 8))),
        ],
        this.factoryProgramId
      );

      try {
        // @ts-ignore - account types would normally be available
        const accountData = await this.program.account.requestAccount.fetch(
          requestAccount
        );

        // Verify account request type matches the expected type
        const requestType = type === "mint" ? { mint: {} } : { burn: {} };
        if (
          JSON.stringify(accountData.requestType) !==
          JSON.stringify(requestType)
        ) {
          throw new Error(
            `Request type mismatch. Expected ${type} but found ${JSON.stringify(
              accountData.requestType
            )}`
          );
        }

        return {
          data: accountData,
          publicKey: requestAccount,
        };
      } catch (error) {
        throw new Error(`Failed to get request data: ${error}`);
      }
    } catch (error) {
      throw new Error(`Failed to get ${type} request: ${error}`);
    }
  }

  /**
   * Get all requests of a specific type
   * @param type The request type ("mint" or "burn")
   * @returns Array of request data with their public keys
   */
  async getAllRequests(type: "mint" | "burn"): Promise<any[]> {
    try {
      // Get factory store to find total request count
      const factoryStore = await this.getFactoryStore();

      // Get total request count based on type
      const requestCounter =
        type === "mint"
          ? factoryStore.mintRequestCounter
          : factoryStore.burnRequestCounter;

      const requests = [];
      // Get each request by nonce
      for (let i = 0; i < requestCounter; i++) {
        try {
          const request = await this.getRequest(i, type);
          requests.push(request);
        } catch (error) {
          console.log(`Warning: Failed to get ${type} request #${i}: ${error}`);
          // Continue with next request
        }
      }

      return requests;
    } catch (error) {
      throw new Error(`Failed to get all ${type} requests: ${error}`);
    }
  }

  /**
   * Get mint request by nonce (For backward compatibility)
   * @param nonce The nonce of the mint request
   * @returns Mint request data
   */
  async getMintRequest(nonce: number): Promise<any> {
    return this.getRequest(nonce, "mint");
  }

  /**
   * Get all mint requests (For backward compatibility)
   * @returns Array of mint request data with their public keys
   */
  async getAllMintRequests(): Promise<any[]> {
    return this.getAllRequests("mint");
  }

  /**
   * Get burn request by nonce
   * @param nonce The nonce of the burn request
   * @returns Burn request data
   */
  async getBurnRequest(nonce: number): Promise<any> {
    return this.getRequest(nonce, "burn");
  }

  /**
   * Get all burn requests
   * @returns Array of burn request data with their public keys
   */
  async getAllBurnRequests(): Promise<any[]> {
    return this.getAllRequests("burn");
  }

  /**
   * Get request PDA for a specific nonce and request type
   * @param nonce The nonce of the request
   * @param isMintRequest Whether the request is a mint request (true) or burn request (false)
   * @returns PublicKey of the request PDA and its bump seed
   */
  async getRequestPDA(
    nonce: number,
    isMintRequest: boolean
  ): Promise<[PublicKey, number]> {
    const requestSeed = isMintRequest ? MINT_REQUEST_SEED : BURN_REQUEST_SEED;
    return PublicKey.findProgramAddressSync(
      [Buffer.from(requestSeed), new BN(nonce).toArrayLike(Buffer, "le", 8)],
      this.factoryProgramId
    );
  }

  /**
   * Get request account for a specific nonce and request type
   * @param nonce The nonce of the request
   * @param isMintRequest Whether the request is a mint request (true) or burn request (false)
   * @returns Request account data
   */
  async getRequestAccount(nonce: number, isMintRequest: boolean): Promise<any> {
    const type = isMintRequest ? "mint" : "burn";
    const result = await this.getRequest(nonce, type);
    return result.data;
  }

  /**
   * Add mint request
   * @param merchant Keypair of the merchant
   * @param amount Amount in satoshis (as BN)
   * @param btcTxId Bitcoin transaction ID as string
   * @param btcDepositAddress BTC deposit address as string
   * @param membersProgramId PublicKey of the members program
   * @returns Transaction signature
   */
  async addMintRequest(
    merchant: Keypair,
    amount: anchor.BN,
    btcTxId: string,
    btcDepositAddress: string,
    membersProgramId: PublicKey
  ): Promise<string> {
    // 获取 factory store 信息来获取当前请求计数器和controller
    const factoryStoreInfo = await this.getFactoryStore();
    const mintRequestCounter = factoryStoreInfo.mintRequestCounter;
    const controller = factoryStoreInfo.controller;

    // Derive controller store账户
    const [controllerStore] = PublicKey.findProgramAddressSync(
      [Buffer.from("controller")],
      controller
    );

    // Derive request account using mint_request_counter
    const [requestAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(MINT_REQUEST_SEED),
        Buffer.from(
          new Uint8Array(new BN(mintRequestCounter).toArray("le", 8))
        ),
      ],
      this.factoryProgramId
    );

    // Derive merchant info account
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgramId
    );

    // Derive custodian BTC address account
    const [custodianBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(CUSTODIAN_BTC_ADDRESS_SEED), merchant.publicKey.toBuffer()],
      this.factoryProgramId
    );

    return await this.program.methods
      .addMintRequest({
        amount,
        btcTxid: btcTxId,
        btcDepositAddress: btcDepositAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore: this.factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        custodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();
  }

  /**
   * Cancel mint request
   * @param merchant Keypair of the merchant
   * @param nonce Request nonce
   * @returns Transaction signature
   */
  async cancelMintRequest(merchant: Keypair, nonce: number): Promise<string> {
    // Convert nonce to BN
    const nonceBN = new BN(nonce);

    // Derive request account using the correct nonce format to match Rust side
    const nonceBuffer = Buffer.from(new Uint8Array(nonceBN.toArray("le", 8)));

    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_REQUEST_SEED), nonceBuffer],
      this.factoryProgramId
    );

    // 首先获取请求账户的详细信息以获取请求哈希
    try {
      // @ts-ignore - account types would normally be available
      const requestData = await this.program.account.requestAccount.fetch(
        requestAccount
      );
      const requestHash = requestData.hash;

      return await this.program.methods
        .cancelMintRequest({
          nonce: new BN(nonce),
          requestHash: requestHash,
        })
        .accounts({
          payer: merchant.publicKey,
          factoryStore: this.factoryStore,
          requestAccount,
        })
        .signers([merchant])
        .rpc();
    } catch (error) {
      throw new Error(`Failed to cancel mint request: ${error}`);
    }
  }

  /**
   * Confirm mint request
   * @param custodian Keypair of the custodian
   * @param merchant PublicKey of the merchant
   * @param nonce Request nonce
   * @param tokenMint PublicKey of the token mint
   * @param controllerProgramId PublicKey of the controller program
   * @param membersProgramId PublicKey of the members program
   * @returns Transaction signature
   */
  async confirmMintRequest(
    custodian: Keypair,
    merchant: PublicKey,
    nonce: number,
    tokenMint: PublicKey,
    controllerProgramId: PublicKey,
    membersProgramId: PublicKey
  ): Promise<string> {
    // Convert nonce to BN
    const nonceBN = new BN(nonce);

    // Derive request account using the correct nonce format to match Rust side
    const nonceBuffer = Buffer.from(new Uint8Array(nonceBN.toArray("le", 8)));

    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_REQUEST_SEED), nonceBuffer],
      this.factoryProgramId
    );

    // Derive token accounts and other needed accounts
    const merchantTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: merchant,
    });

    // 首先获取请求账户的详细信息以获取请求哈希
    try {
      // @ts-ignore - account types would normally be available
      const requestData = await this.program.account.requestAccount.fetch(
        requestAccount
      );
      const requestHash = requestData.hash;

      // Derive members store account
      const [membersStore] = PublicKey.findProgramAddressSync(
        [Buffer.from("members")],
        membersProgramId
      );

      // Derive controller store account
      const [controllerStore] = PublicKey.findProgramAddressSync(
        [Buffer.from("controller")],
        controllerProgramId
      );

      return await this.program.methods
        .confirmMintRequest({
          nonce: nonceBN,
          requestHash: requestHash,
        })
        .accountsStrict({
          payer: custodian.publicKey,
          factoryStore: this.factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
          tokenMint,
          toAddress: merchant,
          tokenAccount: merchantTokenAccount,
          controllerProgram: controllerProgramId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([custodian])
        .rpc();
    } catch (error) {
      throw new Error(`Failed to confirm mint request: ${error}`);
    }
  }

  /**
   * Reject mint request
   * @param custodian Keypair of the custodian
   * @param merchant PublicKey of the merchant
   * @param nonce Request nonce
   * @param membersStore PublicKey of the members store
   * @param controllerStore PublicKey of the controller store
   * @returns Transaction signature
   */
  async rejectMintRequest(
    custodian: Keypair,
    merchant: PublicKey,
    nonce: number,
    membersStore: PublicKey,
    controllerStore: PublicKey
  ): Promise<string> {
    // Convert nonce to BN
    const nonceBN = new BN(nonce);

    // Derive request account using the correct nonce format to match Rust side
    const nonceBuffer = Buffer.from(new Uint8Array(nonceBN.toArray("le", 8)));

    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_REQUEST_SEED), nonceBuffer],
      this.factoryProgramId
    );

    // 首先获取请求账户的详细信息以获取请求哈希
    try {
      // @ts-ignore - account types would normally be available
      const requestData = await this.program.account.requestAccount.fetch(
        requestAccount
      );
      const requestHash = requestData.hash;

      return await this.program.methods
        .rejectMintRequest({
          nonce: new BN(nonce),
          requestHash: requestHash,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore: this.factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
        })
        .signers([custodian])
        .rpc();
    } catch (error) {
      throw new Error(`Failed to reject mint request: ${error}`);
    }
  }

  /**
   * Burn tokens
   * @param merchant Keypair of the merchant
   * @param amount Amount in smallest units (as BN)
   * @param membersStore PublicKey of the members store
   * @param tokenMint PublicKey of the token mint
   * @param membersProgramId PublicKey of the members program
   * @returns Transaction signature
   */
  async burn(
    merchant: Keypair,
    amount: anchor.BN,
    membersStore: PublicKey,
    tokenMint: PublicKey,
    membersProgramId: PublicKey
  ): Promise<string> {
    // 获取当前的 factory store 状态以获取 burn_request_counter 和 controller
    const factoryStoreAccount = await this.getFactoryStore();
    const burnRequestCounter = factoryStoreAccount.burnRequestCounter;
    const controller = factoryStoreAccount.controller;

    // 创建计数器的 Buffer
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64LE(BigInt(burnRequestCounter), 0);

    // 使用与程序端一致的种子列表
    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(BURN_REQUEST_SEED), counterBuffer],
      this.factoryProgramId
    );

    // 派生controller store账户
    const [controllerStore] = PublicKey.findProgramAddressSync(
      [Buffer.from("controller")],
      controller
    );

    // Derive merchant info account
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgramId
    );

    // Derive merchant BTC address account
    const [merchantBtcAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_BTC_ADDRESS_SEED), merchant.publicKey.toBuffer()],
      this.factoryProgramId
    );

    // Derive token account
    const merchantTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: merchant.publicKey,
    });

    // Derive controller token account
    const controllerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: controllerStore,
    });

    return await this.program.methods
      .burn({
        amount,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore: this.factoryStore,
        requestAccount,
        controllerStore,
        membersStore,
        merchantInfo,
        merchantBtcAddress,
        tokenMint,
        tokenAccount: merchantTokenAccount,
        controllerTokenAccount,
        controllerProgram: controller,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([merchant])
      .rpc();
  }

  /**
   * Confirm burn request
   * @param custodian Keypair of the custodian
   * @param merchant PublicKey of the merchant
   * @param btcTxId Bitcoin transaction ID as string
   * @param nonce Request nonce
   * @param membersStore PublicKey of the members store
   * @param controllerStore PublicKey of the controller store
   * @returns Transaction signature
   */
  async confirmBurnRequest(
    custodian: Keypair,
    merchant: PublicKey,
    btcTxId: string,
    nonce: number,
    membersStore: PublicKey,
    controllerStore: PublicKey
  ): Promise<string> {
    // Convert nonce to BN
    const nonceBN = new BN(nonce);

    // Derive request account using the correct nonce format to match Rust side
    const nonceBuffer = Buffer.from(new Uint8Array(nonceBN.toArray("le", 8)));

    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(BURN_REQUEST_SEED), nonceBuffer],
      this.factoryProgramId
    );

    // 首先获取请求账户的详细信息以获取请求哈希
    try {
      // @ts-ignore - account types would normally be available
      const requestData = await this.program.account.requestAccount.fetch(
        requestAccount
      );
      const requestHash = requestData.hash;

      return await this.program.methods
        .confirmBurnRequest({
          btcTxid: btcTxId,
          nonce: new anchor.BN(nonce),
          requestHash: requestHash,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore: this.factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
        })
        .signers([custodian])
        .rpc();
    } catch (error) {
      throw new Error(`Failed to confirm burn request: ${error}`);
    }
  }

  /**
   * Close a mint or burn request account
   * @param payer Keypair of the account that will pay for the transaction
   * @param nonce The nonce of the request to close
   * @param isMintRequest Whether the request is a mint request (true) or burn request (false)
   * @returns Transaction signature
   */
  async closeRequest(
    payer: Keypair,
    nonce: number,
    isMintRequest: boolean
  ): Promise<string> {
    // Determine the request type seed
    const requestSeed = isMintRequest ? MINT_REQUEST_SEED : BURN_REQUEST_SEED;

    // Derive request account address
    const [requestAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(requestSeed), new BN(nonce).toArrayLike(Buffer, "le", 8)],
      this.factoryProgramId
    );

    return await this.program.methods
      .closeRequest({
        nonce: new BN(nonce),
        isMintRequest,
      })
      .accounts({
        payer: payer.publicKey,
        factoryStore: this.factoryStore,
        requestAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
  }

  /**
   * Get all request accounts (mint and burn)
   * @returns Array of all request accounts with their data
   */
  async getAllRequestAccounts(): Promise<
    Array<{
      publicKey: PublicKey;
      account: any;
      isMintRequest: boolean;
    }>
  > {
    const allRequests = [];

    // Get all mint requests
    const mintRequests = await this.getAllMintRequests();
    for (const req of mintRequests) {
      allRequests.push({
        publicKey: req.publicKey,
        account: req.account,
        isMintRequest: true,
      });
    }

    // Get all burn requests
    const burnRequests = await this.getAllBurnRequests();
    for (const req of burnRequests) {
      allRequests.push({
        publicKey: req.publicKey,
        account: req.account,
        isMintRequest: false,
      });
    }

    return allRequests;
  }
}
