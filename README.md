# zcash-tx-stats

## Install

``` bash
npm install
```

## Setup

Modify `.env` file as needed:
- LWD_URI
  - The lightwalletd server URI, omit the `https://`.
- LOCAL_LWD
  - If using a local lightwalletd server, set `LOCAL_LWD="true"`.
- DUMP_FILE
  - The filename for dumping the transactions data.

## Usage
- Fetching blocks
  > Run `node index.js` and wait for block to be downloaded. When done press `ctrl+c` to break.
- Dumping transactions information
  > Run `node dump_database.js`.