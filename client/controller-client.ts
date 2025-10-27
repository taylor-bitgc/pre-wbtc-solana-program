import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";

// Controller program constants
export const CONTROLLER_SEED = "controller";

export class ControllerClient {
  // Program properties
  readonly program: Program;
  readonly provider: AnchorProvider;
  readonly controllerProgramId: PublicKey;

  // PDA addresses
  controllerStore: PublicKey;
  controllerStoreBump: number;

  /**
   * Constructor for ControllerClient
   * @param provider AnchorProvider instance
   * @param programId PublicKey of the controller program
   */
  constructor(provider: AnchorProvider, programId?: PublicKey) {
    this.provider = provider;
    this.controllerProgramId =
      programId ||
      new PublicKey("2x7Hkd3nSzWQRQtdkjp8uogKXDiZwz7jPZwNNicmx6UP");

    // Import IDL
    const idl = require("../target/idl/controller.json");
    // Set programId in IDL
    idl.metadata = idl.metadata || {};
    idl.metadata.address = this.controllerProgramId.toString();

    // Create program instance with correct parameter order
    this.program = new anchor.Program(idl, this.provider);

    // Derive controller store PDA
    const [controllerStore, controllerStoreBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from(CONTROLLER_SEED)],
        this.controllerProgramId
      );
    this.controllerStore = controllerStore;
    console.log(`Controller Store PDA: ${controllerStore.toString()}`);
    console.log("program id", this.controllerProgramId.toString());
    this.controllerStoreBump = controllerStoreBump;
  }

  /**
   * Initialize the controller program
   * @param tokenMint PublicKey of the token mint
   * @returns Transaction signature
   */
  async initialize(tokenMint: PublicKey): Promise<string> {
    // Calculate Controller token account address
    const controllerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: this.controllerStore,
    });

    return await this.program.methods
      .initialize()
      .accounts({
        payer: this.provider.wallet.publicKey,
        controllerStore: this.controllerStore,
        tokenMint,
        controllerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Set members program
   * @param owner Keypair of the current owner
   * @param membersProgram PublicKey of the members program
   * @returns Transaction signature
   */
  async setMembers(owner: Keypair, membersProgram: PublicKey): Promise<string> {
    return await this.program.methods
      .setMembers({
        members: membersProgram,
      })
      .accounts({
        owner: owner.publicKey,
        controllerStore: this.controllerStore,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Set factory program
   * @param owner Keypair of the current owner
   * @param factoryProgram PublicKey of the factory program
   * @returns Transaction signature
   */
  async setFactory(owner: Keypair, factoryProgram: PublicKey): Promise<string> {
    return await this.program.methods
      .setFactory({
        factory: factoryProgram,
      })
      .accounts({
        owner: owner.publicKey,
        controllerStore: this.controllerStore,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Mint tokens
   * @param amount Amount to mint in smallest units
   * @param destination PublicKey for the destination account
   * @param mintAuthority Keypair with mint authority
   * @param tokenMint PublicKey of the token mint
   * @returns Transaction signature
   */
  async mint(
    amount: anchor.BN,
    destination: PublicKey,
    mintAuthority: Keypair,
    tokenMint: PublicKey
  ): Promise<string> {
    // 获取关联代币账户
    const destinationTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: destination,
    });

    return await this.program.methods
      .mint({
        to: destination,
        amount: amount,
      })
      .accounts({
        controllerStore: this.controllerStore,
        tokenMint,
        tokenAccount: destinationTokenAccount,
        instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([mintAuthority])
      .rpc();
  }

  /**
   * Burn tokens
   * @param amount Amount to burn in smallest units
   * @param tokenMint PublicKey of the token mint
   * @param authority Keypair with authority to sign the transaction
   * @returns Transaction signature
   */
  async burn(
    amount: anchor.BN,
    tokenMint: PublicKey,
    authority: Keypair
  ): Promise<string> {
    // 获取控制器代币账户
    const controllerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: this.controllerStore,
    });

    return await this.program.methods
      .burn({
        amount: amount,
      })
      .accounts({
        controllerStore: this.controllerStore,
        tokenMint,
        controllerTokenAccount,
        instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Transfer ownership of the controller program
   * @param currentOwner Keypair of the current owner
   * @param newOwner PublicKey of the new owner
   * @returns Transaction signature
   */
  async transferOwnership(
    currentOwner: Keypair,
    newOwner: PublicKey
  ): Promise<string> {
    return await this.program.methods
      .transferOwnership({
        newOwner: newOwner,
      })
      .accounts({
        owner: currentOwner.publicKey,
        controllerStore: this.controllerStore,
      })
      .signers([currentOwner])
      .rpc();
  }

  /**
   * Claim ownership of the controller program
   * @param pendingOwner Keypair of the pending owner
   * @returns Transaction signature
   */
  async claimOwnership(pendingOwner: Keypair): Promise<string> {
    return await this.program.methods
      .claimOwnership()
      .accounts({
        pendingOwner: pendingOwner.publicKey,
        controllerStore: this.controllerStore,
      })
      .signers([pendingOwner])
      .rpc();
  }

  /**
   * Transfer mint authority
   * @param owner Keypair of the current owner
   * @param newAuthority PublicKey of the new authority
   * @param tokenMint PublicKey of the token mint
   * @returns Transaction signature
   */
  async transferMintAuthority(
    owner: Keypair,
    newAuthority: PublicKey,
    tokenMint: PublicKey
  ): Promise<string> {
    return await this.program.methods
      .transferMintAuthority({
        newAuthority: newAuthority,
      })
      .accounts({
        owner: owner.publicKey,
        controllerStore: this.controllerStore,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Claim mint authority
   * @param pendingAuthority Keypair of the pending mint authority
   * @param tokenMint PublicKey of the token mint
   * @returns Transaction signature
   */
  async claimMintAuthority(
    pendingAuthority: Keypair,
    tokenMint: PublicKey
  ): Promise<string> {
    return await this.program.methods
      .claimMintAuthority()
      .accounts({
        controllerStore: this.controllerStore,
        pendingAuthority: pendingAuthority.publicKey,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([pendingAuthority])
      .rpc();
  }

  /**
   * Get controller store data
   * @returns Controller store data
   */
  async getControllerStore(): Promise<any> {
    // @ts-ignore - account types would normally be available
    return await this.program.account.controllerStore.fetch(
      this.controllerStore
    );
  }
}
