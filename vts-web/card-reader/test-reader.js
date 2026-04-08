const pcsclite = require('pcsclite');
const pcsc = pcsclite();

console.log("Waiting for reader...");

pcsc.on('reader', reader => {
  console.log("Reader detected:", reader.name);

  reader.on('error', err => {
    console.error("Reader error:", err.message);
  });

  reader.on('status', status => {
    console.log("Status:", status);
  });

  reader.on('end', () => {
    console.log("Reader removed");
  });
});