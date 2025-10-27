import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// Members program constants
export const MEMBERS_SEED = "members";
export const MERCHANT_INFO_SEED = "merchant_info";

export class MembersClient {
  // Program properties
  readonly program: Program;
  readonly provider: AnchorProvider;
  readonly membersProgramId: PublicKey;

  // PDA addresses
  membersStore: PublicKey;
  membersStoreBump: number;

  /**
   * Constructor for MembersClient
   * @param provider AnchorProvider instance
   * @param programId PublicKey of the members program
   */
  constructor(provider: AnchorProvider, programId?: PublicKey) {
    this.provider = provider;
    this.membersProgramId =
      programId ||
      new PublicKey("5FRR3ef3BU5Ke3ncJ2QvJe9P7xmqwgzNVLEQhr1UPEvx");

    // Initialize program with IDL (will need to import or fetch this)
    // @ts-ignore - We'll assume we're using anchor correctly
    // Import the IDL
    const idl = require("../target/idl/members.json");
    // Set the programId in the IDL
    idl.metadata = idl.metadata || {};
    idl.metadata.address = this.membersProgramId.toString();

    // Create the program instance
    this.program = new anchor.Program(idl, this.provider);

    // Derive members store PDA
    console.log("programId", this.membersProgramId.toString());
    const [membersStore, membersStoreBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MEMBERS_SEED)],
      this.membersProgramId
    );
    console.log("membersStore", membersStore.toString());

    this.membersStore = membersStore;
    this.membersStoreBump = membersStoreBump;
  }

  /**
   * Initialize the members program
   * @returns Transaction signature
   */
  async initialize(): Promise<string> {
    return await this.program.methods
      .initialize()
      .accounts({
        payer: this.provider.wallet.publicKey,
        membersStore: this.membersStore,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Set custodian for the members program
   * @param owner Keypair of the current owner of the members program
   * @param custodian PublicKey of the new custodian
   * @returns Transaction signature
   */
  async setCustodian(owner: Keypair, custodian: PublicKey): Promise<string> {
    return await this.program.methods
      .setCustodian({
        custodian,
      })
      .accounts({
        owner: owner.publicKey,
        membersStore: this.membersStore,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Add a merchant to the members program
   * @param owner Keypair of the current owner of the members program
   * @param merchant PublicKey of the merchant to add
   * @returns Transaction signature
   */
  async addMerchant(owner: Keypair, merchant: PublicKey): Promise<string> {
    // Derive merchant info PDA
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.toBuffer()],
      this.membersProgramId
    );

    return await this.program.methods
      .addMerchant({
        merchant,
      })
      .accounts({
        owner: owner.publicKey,
        membersStore: this.membersStore,
        merchantInfo,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Remove a merchant from the members program
   * @param owner Keypair of the current owner of the members program
   * @param merchant PublicKey of the merchant to remove
   * @returns Transaction signature
   */
  async removeMerchant(owner: Keypair, merchant: PublicKey): Promise<string> {
    // Derive merchant info PDA
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.toBuffer()],
      this.membersProgramId
    );

    return await this.program.methods
      .removeMerchant({
        merchant,
      })
      .accounts({
        owner: owner.publicKey,
        membersStore: this.membersStore,
        merchantInfo,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Transfer ownership of the members program
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
        newOwner,
      })
      .accounts({
        owner: currentOwner.publicKey,
        membersStore: this.membersStore,
        systemProgram: SystemProgram.programId,
      })
      .signers([currentOwner])
      .rpc();
  }

  /**
   * Claim ownership of the members program (must be called by pending owner after transfer)
   * @param pendingOwner Keypair of the pending owner
   * @returns Transaction signature
   */
  async claimOwnership(pendingOwner: Keypair): Promise<string> {
    return await this.program.methods
      .claimOwnership()
      .accounts({
        pendingOwner: pendingOwner.publicKey,
        membersStore: this.membersStore,
        systemProgram: SystemProgram.programId,
      })
      .signers([pendingOwner])
      .rpc();
  }

  /**
   * Get merchant info account data
   * @param merchant PublicKey of the merchant
   * @returns Merchant info data
   */
  async getMerchantInfo(merchant: PublicKey): Promise<any> {
    const [merchantInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.toBuffer()],
      this.membersProgramId
    );

    // @ts-ignore - account types would normally be available
    return await this.program.account.merchantInfo.fetch(merchantInfo);
  }

  /**
   * Get members store data (contains owner, pending owner, custodian)
   * @returns Members store data
   */
  async getMembersStore(): Promise<any> {
    // @ts-ignore - account types would normally be available
    return await this.program.account.membersStore.fetch(this.membersStore);
  }

  /**
   * Get all merchants registered in the members program
   * @param options Optional parameters for query customization
   * @returns Array of merchant info objects with their public keys
   */
  async getAllMerchants(
    options: {
      useCache?: boolean;
      commitment?: anchor.web3.Commitment;
      dataSlice?: { offset: number; length: number };
      withPagination?: boolean;
      limit?: number;
      before?: string;
      until?: string;
    } = {}
  ): Promise<any[]> {
    // First 8 bytes of account data is the account discriminator for Anchor accounts
    // The discriminator is a hash of the account name "merchant_info"

    // Get the account discriminator for MerchantInfo
    // @ts-ignore - account types would normally be available
    const discriminator = bs58.encode(
      this.program.account.merchantInfo._idlAccount.discriminator
    );

    // Configure the query options
    const config: any = {
      filters: [
        {
          // Filter for accounts with the merchant_info discriminator
          memcmp: {
            offset: 0, // Account discriminator is at the beginning
            bytes: discriminator,
          },
        },
        {
          dataSize: 41,
        },
      ],
    };

    // Add optional parameters if provided
    if (options.commitment) {
      config.commitment = options.commitment;
    }

    if (options.dataSlice) {
      config.dataSlice = options.dataSlice;
    }

    if (options.withPagination) {
      config.withPagination = true;
    }

    if (options.limit) {
      config.limit = options.limit;
    }

    if (options.before) {
      config.before = options.before;
    }

    if (options.until) {
      config.until = options.until;
    }

    // Use getProgramAccounts to fetch all merchant info accounts in one call
    const merchantAccounts = await this.provider.connection.getProgramAccounts(
      this.membersProgramId,
      config
    );

    // Process each merchant account
    const merchants = [];
    for (const account of Array.isArray(merchantAccounts)
      ? merchantAccounts
      : merchantAccounts.value) {
      try {
        // If we're using dataSlice, we might not have enough data to decode the account
        if (options.dataSlice) {
          // Just return the public key and raw data
          merchants.push({
            publicKey: account.pubkey,
            data: account.account.data,
          });
          continue;
        }

        // Decode the account data to get the merchant info
        const merchantInfo = this.program.coder.accounts.decode(
          "merchantInfo",
          account.account.data
        );

        // Add the account public key for reference
        merchantInfo.publicKey = account.pubkey;
        merchants.push(merchantInfo);
      } catch (error) {
        console.error("Error decoding merchant account:", error);
        continue;
      }
    }

    return merchants;
  }
}
