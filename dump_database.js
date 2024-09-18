const sequelize = require('./sequelize');
const fs = require('fs');

const dotenv = require('dotenv');
const { join } = require('path');

dotenv.config();

const dumpFilename = process.env.DUMP_FILE;

const privacySetModel = sequelize.models.privacyset;
privacySetModel.findAll().then((res) => {
    const dataObj = res.map((el) => {
        return {
            height: el.height,
            sapling: el.sapling,
            sapling_filter: el.sapling_filter,
            orchard: el.orchard,
            orchard_filter: el.orchard_filter,
            transactions: el.transactions,
            transactions_filter: el.transactions_filter
        }
    });

    dataJson = JSON.stringify(dataObj, null, 2);  // Pretty-print with 2-space indentation
    fs.writeFile(dumpFilename, dataJson, (err) => {
        if (err) {
            console.error('Error writing to file', err);
        } else {
            console.log('JSON file has been saved at', join(__dirname, dumpFilename));
        }
    });

    
}).catch(e => {console.log(e)});