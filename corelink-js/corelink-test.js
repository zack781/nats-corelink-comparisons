const corelink = require('./corelink.lib.js')

const config = {
  ControlPort: 20012,
  /*            ControlIP: '127.0.0.1', */
  ControlIP: '127.0.0.1',

  /*
  autoReconnect: false,
    for service in a local network please replace the certificate with the appropriate version
  cert: '<corelink-tools-repo>/config/ca-crt.pem'
  */
  cert: '/Users/zack/Documents/repos/corelink-server/config/ca-crt.pem'
}

const username = 'Testuser'
const password = 'Testpassword'

const workspace = 'Holodeck'
const protocol = 'tcp'
const datatype = 'benchmarking'

process.on('SIGINT', () => {
  console.log('Disconnect Corelink gracefully...');
  corelink.disconnect();
  process.exit(0);
});

let receivedCount = 0;
let totalTransitTime = 0;

const run = async () => {
    // corelink.setDebug(true);
    if (await corelink.connect({ username, password }, config).catch((err) => { console.log(err) })) {
    sender = await corelink.createSender({
      workspace,
      protocol,
      type: datatype,
      metadata: { name: 'benchmarking' },
    }).catch((err) => { console.log(err) })

    // Provide the sender update callback.
    corelink.on('sender', (data) => {
      console.log('Sender update:', data)

      const intervalId = setInterval(async () => {
        const buffer = Buffer.from(new Uint8Array(1024));
        corelink.send(sender, buffer, { "timestamp":  Number(process.hrtime.bigint() / 1000n) });
      }, 1);

      setTimeout(() => {
        clearInterval(intervalId);
        console.log(`Average Transit Time = ${totalTransitTime / receivedCount} µs`);
      }, 10000);
    })

    await corelink.createReceiver({
      workspace,
      protocol,
      type: datatype,
      echo: true,
      alert: true,
    }).catch((err) => { console.log(err) })

    corelink.on('receiver', async (data) => {
      const options = { streamIDs: [data.streamID] }
      await corelink.subscribe(options)
    })

    corelink.on('data', (streamID, data, header) => {
      console.log(header.timestamp);
      console.log('Transit Time = ',  Number(process.hrtime.bigint() / 1000n) - header.timestamp, " us");
      receivedCount++;
      totalTransitTime += Number(process.hrtime.bigint() / 1000n) - header.timestamp;
    })

  }
}

run()
