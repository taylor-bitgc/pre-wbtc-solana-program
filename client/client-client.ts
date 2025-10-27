import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";

// Client program constants
export const CLIENT_SEED = "client";
export const MERCHANT_PDA_SEED = "merchant_pda";

export class ClientClient {
  // Program properties
  readonly program: Program;
  readonly provider: AnchorProvider;
  readonly clientProgramId: PublicKey;

  // PDA addresses
  clientStore: PublicKey;
  clientStoreBump: number;

  /**
   * Constructor for ClientClient
   * @param provider AnchorProvider instance
   * @param programId PublicKey of the client program
   */
  constructor(provider: AnchorProvider, programId?: PublicKey) {
    this.provider = provider;
    this.clientProgramId =
      programId ||
      new PublicKey("J3dKkELGVw5MjUUDoYPeedtpoMeB9U6ZMfSRGveX8W23");

    // Import IDL
    const idl = require("../target/idl/client.json");
    // Set programId in IDL
    idl.metadata = idl.metadata || {};
    idl.metadata.address = this.clientProgramId.toString();

    // Create program instance
    this.program = new anchor.Program(idl, this.provider);

    // Derive client store PDA
    const [clientStore, clientStoreBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(CLIENT_SEED)],
      this.clientProgramId
    );
    this.clientStore = clientStore;
    this.clientStoreBump = clientStoreBump;

    console.log(`Client Store PDA: ${clientStore.toString()}`);
    console.log("Client Program ID:", this.clientProgramId.toString());
  }

  /**
   * Get merchant PDA address
   * @returns Merchant PDA and bump
   */
  getMerchantPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_PDA_SEED), this.clientStore.toBuffer()],
      this.clientProgramId
    );
  }

  /**
   * Initialize the client program
   * @returns Transaction signature
   */
  async initialize(): Promise<string> {
    // @ts-ignore - Anchor auto-generated types may not match exactly
    return await this.program.methods
      .initialize()
      .accounts({
        payer: this.provider.wallet.publicKey,
        clientStore: this.clientStore,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Add mint request through factory
   * @param amount Amount to mint in smallest units
   * @param btcTxid Bitcoin transaction ID
   * @param btcDepositAddress Bitcoin deposit address
   * @param factoryProgram PublicKey of the factory program
   * @param factoryStore PublicKey of the factory store
   * @param requestAccount PublicKey of the request account
   * @param controllerStore PublicKey of the controller store
   * @param merchantInfo PublicKey of the merchant info
   * @param custodianBtcAddress PublicKey of the custodian BTC address
   * @returns Transaction signature
   */
  async addMintRequest(
    amount: anchor.BN,
    btcTxid: string,
    btcDepositAddress: string,
    factoryProgram: PublicKey,
    factoryStore: PublicKey,
    requestAccount: PublicKey,
    controllerStore: PublicKey,
    merchantInfo: PublicKey,
    custodianBtcAddress: PublicKey
  ): Promise<string> {
    const [merchantPda] = this.getMerchantPda();

    // @ts-ignore - Anchor auto-generated types may not match exactly
    return await this.program.methods
      .addMintRequest({
        amount: amount,
        btcTxid,
        btcDepositAddress,
      })
      .accounts({
        payer: this.provider.wallet.publicKey,
        clientStore: this.clientStore,
        merchantPda,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        custodianBtcAddress,
        factoryProgram,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Set merchant BTC deposit address through factory
   * @param btcDepositAddress Bitcoin deposit address
   * @param factoryProgram PublicKey of the factory program
   * @param factoryStore PublicKey of the factory store
   * @param controllerStore PublicKey of the controller store
   * @param merchantInfo PublicKey of the merchant info
   * @param merchantBtcAddress PublicKey of the merchant BTC address
   * @returns Transaction signature
   */
  async setMerchantBtcDepositAddress(
    btcDepositAddress: string,
    factoryProgram: PublicKey,
    factoryStore: PublicKey,
    controllerStore: PublicKey,
    merchantInfo: PublicKey,
    merchantBtcAddress: PublicKey
  ): Promise<string> {
    const [merchantPda] = this.getMerchantPda();

    // @ts-ignore - Anchor auto-generated types may not match exactly
    return await this.program.methods
      .setMerchantBtcDepositAddress({
        btcDepositAddress,
      })
      .accounts({
        payer: this.provider.wallet.publicKey,
        clientStore: this.clientStore,
        merchantPda,
        factoryStore,
        controllerStore,
        merchantInfo,
        merchantBtcAddress,
        factoryProgram,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Burn tokens through factory
   * @param amount Amount to burn in smallest units
   * @param factoryProgram PublicKey of the factory program
   * @param factoryStore PublicKey of the factory store
   * @param requestAccount PublicKey of the burn request account
   * @param controllerStore PublicKey of the controller store
   * @param merchantInfo PublicKey of the merchant info
   * @param merchantBtcAddress PublicKey of the merchant BTC address
   * @param tokenMint PublicKey of the token mint
   * @param tokenAccount PublicKey of the token account
   * @returns Transaction signature
   */
  async burn(
    amount: anchor.BN,
    factoryProgram: PublicKey,
    factoryStore: PublicKey,
    requestAccount: PublicKey,
    controllerStore: PublicKey,
    merchantInfo: PublicKey,
    merchantBtcAddress: PublicKey,
    tokenMint: PublicKey,
    tokenAccount: PublicKey
  ): Promise<string> {
    const [merchantPda] = this.getMerchantPda();

    // @ts-ignore - Anchor auto-generated types may not match exactly
    return await this.program.methods
      .burn({
        amount: amount,
      })
      .accounts({
        payer: this.provider.wallet.publicKey,
        clientStore: this.clientStore,
        merchantPda,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        merchantBtcAddress,
        tokenMint,
        tokenAccount,
        factoryProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Get client store data
   * @returns Client store data
   */
  async getClientStore(): Promise<any> {
    // @ts-ignore - account types would normally be available
    return await this.program.account.clientStore.fetch(this.clientStore);
  }

  /**
   * Get merchant PDA info
   * @returns Merchant PDA account info
   */
  async getMerchantPdaInfo(): Promise<any> {
    const [merchantPda] = this.getMerchantPda();
    return await this.provider.connection.getAccountInfo(merchantPda);
  }
}
