const sequelize = require('./sequelize');
// const { Op } = require('sequelize');

const dotenv = require('dotenv');
dotenv.config();

const lwd_uri = process.env.LWD_URI;

const grpc = require('./grpc_connector');
const lc = grpc.init(lwd_uri);

const SAPLING_ACTIVATION = 419200;
const ORCHARD_ACTIVATION = 1687104;
const SYNC_PERIOD = 1152; // 1152 is roughly a day

let dbSyncLock = false;

console.log(`Checking database connection...`);
sequelize.authenticate().then(() => {
    // If connection is Ok, do initial database sync
    initDb();
}).catch(err => {
    console.log('Unable to connect to the database:', err.message);
    process.exit(1);
});
        
async function initDb() {    
    const latestBlock = await grpc.getLatestBlock(lc);
    // const latestBlock = {height: 1155040};    

    // Get latest synched height from db
    const privacySetModel = sequelize.models.privacyset;
    try {
        const dbHeight = await privacySetModel.findOne({
            order: [['height', 'DESC']] // Order by height in descending order
        });

        if (dbHeight) {
            const lastDbHeight = dbHeight.dataValues.height;
      
            if(latestBlock.height - lastDbHeight > SYNC_PERIOD) {                
                // Skip 1 block to avoid double processing previously synched block
                syncTransactions(lastDbHeight + 1, latestBlock.height, true);
            }
            else {
                console.log('Database is up to date');
            }
        } else {
            console.log('No transactions found. Synching from SAPLING_ACTIVATION');
            syncTransactions(SAPLING_ACTIVATION, latestBlock.height, true);
        }
    } catch (error) {
        console.error('Error finding latest transaction:', error);
    }

    // Register a interval to fetch new transactions
    setInterval(async() => {
        if(dbSyncLock) {
            return;
        }

        const privacySetModel = sequelize.models.privacyset;
        const latestBlock = await grpc.getLatestBlock(lc);        
        try {
            const dbHeight = await privacySetModel.findOne({
                order: [['height', 'DESC']] // Order by height in descending order
            });

            const lastDbHeight = dbHeight.dataValues.height;

            if(latestBlock.height - lastDbHeight > SYNC_PERIOD) {                
                console.log("Updating database");
                syncTransactions(lastDbHeight, latestBlock.height, true);
            }
            else {
                console.log("No need to update db yet ...");
            }
        } catch(e) {
            console.log(e);
        }
    }, 60 * 60 * 1000);
}

async function syncTransactions(start, end, writeDb) {        
    dbSyncLock = true;
    
    let startHeight = start;
    const endHeight = end;
  
    let blocksProcessed = 0;
    // let actionsProcessed = 0;
    // let spendsProcessed = 0;
    // let outputsProcessed = 0;
    let txProcessed = 0;
    let txProcessedFilter = 0;
    let saplingTx = 0;
    let orchardTx = 0;
    let saplingTxFilter = 0;
    let orchardTxFilter = 0;

    spamFilterLimit = 50;
    const batchSize = 1000;
    let latestSynced = startHeight;

    const privacySetModel = sequelize.models.privacyset;
    
    console.log(`Downloading blocks. start: ${startHeight}, end: ${endHeight}. Batch Size: ${batchSize}`);
    
    while(latestSynced < endHeight) {
        const chunk = Math.min(latestSynced + batchSize, endHeight);
        try {
            const blocks = await grpc.getBlockRange(latestSynced, chunk);                
            
            for(const block of blocks) {                          
                for(const vtx of block.vtx) {                                                    
                    let isSpam = false;
                    let txCount = 0;
                    if(vtx.actions.length > spamFilterLimit || vtx.outputs.length > spamFilterLimit) {
                        // console.log(`Transaction is spam ...`);
                        isSpam = true;
                    } 

                    if(block.height >= ORCHARD_ACTIVATION) {
                        if(vtx.actions.length > 0) {
                            // actionsProcessed += vtx.actions.length;
                            orchardTx += 1;
                            if(!isSpam) orchardTxFilter += 1;
                            txCount += 0.5;
                        }
                    }

                    if(vtx.outputs.length > 0 || vtx.spends.length > 0) {
                        // outputsProcessed += vtx.outputs.length;                            
                        saplingTx += 1
                        if(!isSpam) saplingTxFilter += 1;
                        txCount += 0.5;
                    }
                    
                    // spendsProcessed += vtx.spends.length;

                    txProcessed += Math.ceil(txCount);
                    if(!isSpam) txProcessedFilter += Math.ceil(txCount);                   
                }

                // Save sum of transactions to database
                if(block.height % SYNC_PERIOD == 0 && writeDb) {
                    console.log(`Daily report tx total ${txProcessed} transactions\n`)
                    try {                        
                        await privacySetModel.create({
                            height: block.height,
                            sapling: saplingTx,
                            sapling_filter: saplingTxFilter,
                            orchard: orchardTx,
                            orchard_filter: orchardTxFilter,
                            transactions: txProcessed,
                            transactions_filter: txProcessedFilter
                        });
                    } catch(e) {
                        console.log(e)
                    }     
                    txProcessed = 0;
                    txProcessedFilter = 0;
                    saplingTx = 0;
                    orchardTx = 0;
                    saplingTxFilter = 0;
                    orchardTxFilter = 0;           
                }
            }

            blocksProcessed += blocks.length;
            latestSynced = chunk + 1;
        }
        catch(e) {
            console.log(e);
            throw(e);
        }                   
    }  

    dbSyncLock = false;

    console.log(`Done! Processed a total of ${blocksProcessed} blocks`); 
            // console.log(`Total transactions processed: ${txProcessed}\n` +
            // `Total filtered transactions processed: ${txProcessedFilter}\n` +
            // `Total sapling transactions processed: ${saplingTx}\n` +
            // `Total orchard transactions processed: ${orchardTx}\n` +
            // `Total filtered sapling transactions processed: ${saplingTxFilter}\n` +
            // `Total filtered orchard transactions processed: ${orchardTxFilter}\n`
            // `Total orchard actions processed: ${actionsProcessed}\n` +
            // `Total sapling spends processed: ${spendsProcessed}\n` +
            // `Total sapling outputs processed: ${outputsProcessed}`);
    // );
    
    // return {
    //     sapling: saplingTx,
    //     sapling_filter: saplingTxFilter,
    //     orchard: orchardTx,
    //     orchard_filter: orchardTxFilter,
    //     transactions: txProcessed,
    //     transactions_filter: txProcessedFilter
    // }
}