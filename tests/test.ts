import {PublicKey, Connection, Keypair, clusterApiUrl, Transaction, sendAndConfirmTransaction} from "@solana/web3.js";
import {Governance} from "../index";
import secret from "../../../sol/id.json"

const connection = new Connection("");
const devConnection = new Connection(clusterApiUrl("devnet"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));

(async() => {
    const user = new PublicKey("EZLvwGdGyeks3jQLWeBbjL1uGeGbqb2MYU4157pDP9ch")
    const governance = new Governance(devConnection)
    const pythGovernance = new Governance(connection, new PublicKey("pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U"));
    const mangoGovernance = new Governance(connection, new PublicKey("GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J"));

    console.log("Fetching all the DAOs for the user")
    const tors = await fetchDAOs(user, governance)
    console.log(`The user is currently the member of ${tors.length} DAOs.`)

    console.log("---------------------")

    if (tors.length) {
        console.log("Fetching all the governance accounts for the first DAO")
        const governanceAccounts = await fetchGovernances(tors[0].realm, governance)
        console.log(`Fetched ${governanceAccounts.length} governance accounts`)

        console.log("---------------------")

        console.log("Fetching all the proposals for all the governances")
        for (let i = 0; i < governanceAccounts.length; i++) {
            const proposals = await fetchProposal(governanceAccounts[i].pubkey, governance)
            console.log(`Found ${proposals.length} proposals for governance account: ${governanceAccounts[i].pubkey.toBase58()}`)
        }
        console.log("----------------------")
    }

    // Create Cast Vote Transaction Instruction
    const realmAccount = new PublicKey("FfJ8awaN9Ut4d3S82DSaLBcKUV3RfvRACo9D1DyqEXAm")
    const proposalAddress = new PublicKey("2Cbbqw6Rej1oxM6Tm7fQfh5bLXgyCv57hTKAwTiptBcc")
    const proposalAccount = await governance.getProposal(proposalAddress)
    const myTokenOwnerRecordAddress = governance.getTokenOwnerRecordAddress({
        realmAccount,
        governingTokenMintAccount: proposalAccount.governingTokenMint,
        governingTokenOwner: keypair.publicKey
    }).publicKey

    const castVoteIx = await governance.castVoteInstruction(
        {approve : [[{rank: 0, weightPercentage: 100}]]},
        realmAccount, // DAO address
        proposalAccount.governance, // Governance account
        proposalAddress,
        proposalAccount.tokenOwnerRecord, // Proposal owner's TOR
        myTokenOwnerRecordAddress, // voter's TOR
        keypair.publicKey, // authority - the owner of voter TOR (my address except if I delegated my voting power)
        proposalAccount.governingTokenMint, // community / council mint for which the proposal is created
        keypair.publicKey // payer of the tx
    )

    const tx = new Transaction().add(castVoteIx)
    const sig = await sendAndConfirmTransaction(devConnection, tx, [keypair])
    console.log(sig)

    // Create Revoke Vote Transaction Instruction
    const revokeVoteIx = await governance.relinquishVoteInstruction(
        realmAccount, // DAO Address
        proposalAccount.governance, // Governance Account
        proposalAddress, // Proposal Address
        myTokenOwnerRecordAddress, // Voter's TOR
        proposalAccount.governingTokenMint, // community/council mint for which the proposal was created
        keypair.publicKey, // authority only needed if the vote is revoked during the voting so the refund can be made
        keypair.publicKey, // beneficiary account, only needed if the proposal is in the voting stage. The refund is made to this address
    )

    const tx2 = new Transaction().add(revokeVoteIx)
    const sig2 = await sendAndConfirmTransaction(devConnection, tx2, [keypair])
    console.log(sig2)


    // Example 2 - Create Cast Vote Ix for PYTH (with voter weight plugin)
    const pythRealmAddress = new PublicKey("4ct8XU5tKbMNRphWy4rePsS9kBqPhDdvZoGpmprPaug4")
    const pythProposalAddress = new PublicKey("ZoHipBiGnJKykjujYciAkmRS9YcL63XJRYqjVpZFANA")
    const pythProposalAccount = await pythGovernance.getProposal(pythProposalAddress)

    const myTokenOwnerRecordAddressForPyth = pythGovernance.getTokenOwnerRecordAddress({
        realmAccount: pythRealmAddress,
        governingTokenMintAccount: pythProposalAccount.governingTokenMint,
        governingTokenOwner: new PublicKey("DsJMfDK4HQ4ooqepF7XgfUESjNLJjyC3hX6YwZtT8TPy")
    }).publicKey
    
    const voterWeightRecord = new PublicKey("BBzgEJrKXv4Ge3L29g2bRYssTzr244RdbfF1zABFr8Uy")
    const voterMaxWeightRecord = new PublicKey("7JefLeJ5bP1hFtBK6KSiGtuPHXXWEMDh5ggLLdUSkv2Z")

    const castVoteWithPluginIx = await pythGovernance.castVoteInstruction(
        {approve : [[{rank: 0, weightPercentage: 100}]]},
        pythRealmAddress, // DAO address
        pythProposalAccount.governance, // Governance account
        pythProposalAddress,
        pythProposalAccount.tokenOwnerRecord, // Proposal owner's TOR
        myTokenOwnerRecordAddressForPyth, // voter's TOR
        keypair.publicKey, // authority - the owner of voter TOR (my address except if I delegated my voting power)
        pythProposalAccount.governingTokenMint, // community / council mint for which the proposal is created
        keypair.publicKey, // payer of the tx
        voterWeightRecord,
        voterMaxWeightRecord
    )

    console.log(castVoteWithPluginIx)
})()

// Fetch all the DAOs the user has voting power in
async function fetchDAOs(user:PublicKey, governance: Governance) {
    return await governance.getTokenOwnerRecordsFromPubkey(user)
}

// Fetch all the Governance Accounts for the given Realm
async function fetchGovernances(realm:PublicKey, governance: Governance) {
    return await governance.getGovernanceForRealm(realm)
}

// Fetch all the proposals for the given governance account
async function fetchProposal(governanceAccount:PublicKey, governance: Governance) {
    return await governance.getProposalsForGovernance(governanceAccount)
}