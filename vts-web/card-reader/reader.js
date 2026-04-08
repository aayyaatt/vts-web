const pcsclite = require('pcsclite');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

let latestCardData = null;

const pcsc = pcsclite();

console.log("Waiting for reader...");

pcsc.on('reader', reader => {
  console.log("Reader detected:", reader.name);

  reader.on('status', status => {
    const changes = reader.state ^ status.state;

    if (changes) {
      if ((changes & reader.SCARD_STATE_PRESENT) && (status.state & reader.SCARD_STATE_PRESENT)) {
        console.log("Card inserted");

        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
          if (err) return console.error(err);

          const command = Buffer.from([0x00, 0xCA, 0x00, 0x00, 0x00]);

          reader.transmit(command, 40, protocol, (err, data) => {
            if (err) return console.error(err);

            const raw = data.toString('hex');
            console.log("Raw Card Data:", raw);

            // Temporary fake parsing
            latestCardData = {
              CPR: "123456789",
              name: "From Card",
              raw: raw
            };
          });
        });
      }

      if ((changes & reader.SCARD_STATE_EMPTY) && (status.state & reader.SCARD_STATE_EMPTY)) {
        console.log("Card removed");
        latestCardData = null;
      }
    }
  });
});

app.get('/card-data', (req, res) => {
  res.json(latestCardData);
});

app.listen(3001, () => {
  console.log(" API running on http://localhost:3001");
});