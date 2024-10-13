# zcash-tx-stats

## Install

``` bash
npm install
```

## Setup

Modify `.env` file as needed for custom LWD servers. 


#### Local LWD 

For use with a local LWD server try the following:

Edit `.env`

``` markdown
LWD_URI = "127.0.0.1:9067"
DUMP_FILE = "transaction_summary.json"
```
Change line 26 of `grpc_connector.js`
``` javascript
return client = new compactTxStreamer(serverUri, grpc.credentials.createInsecure(), options);
```
