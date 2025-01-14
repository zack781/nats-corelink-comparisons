const { connect, StringCodec, consumerOpts } = require('nats');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const run = async () => {
  const nc = await connect({ servers: 'nats://localhost:4222' });

  const subject = "benchmarking";
  const totalPackets = 10000;

  const subscriber = async () => {
    const sub = nc.subscribe(subject);
    console.log(`📥 Subscribed to '${subject}'`);

    let receivedCount = 0;
    let totalTransitTime = 0;
    for await (const msg of sub) {
      receivedCount++;
      const fullBuffer = Buffer.from(msg.data);

      // Read header (first 8 bytes)
      const headerType = fullBuffer.readUInt16LE(0);      // 2 bytes
      const dataSize = fullBuffer.readUInt32LE(2);        // 4 bytes
      const timestamp = fullBuffer.readBigUInt64LE(6);            // 2 bytes

      // Read payload after header
      const payload = fullBuffer.slice(14);

      console.log(timestamp);
      console.log('Transit Time = ',  process.hrtime.bigint() / 1000n - timestamp, " us");
      totalTransitTime += Number(process.hrtime.bigint() / 1000n - timestamp);
      if (receivedCount === totalPackets) {
        console.log(`Average Transit Time = ${totalTransitTime / receivedCount} µs`);
        break;
      }
    }
  };

  const publisher = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));  // Ensure subscriber is ready

    // Create payload (binary data)
    const payloadData = new Uint8Array(1024).fill(0xAB);
      for (let i = 0; i <= totalPackets; i++) {
      const bufferData = Buffer.from(payloadData);
      const timestamp = process.hrtime.bigint() / 1000n;

      // Create header (8 bytes)
      const header = Buffer.alloc(14);
      header.writeUInt16LE(1, 0);             // Header Type: 1
      header.writeUInt32LE(bufferData.length, 2); // Payload size: 1024
      header.writeBigUInt64LE(timestamp, 6);

      // Combine header + payload into one buffer
      const message = Buffer.concat([header, bufferData]);

      // Publish the combined buffer
      nc.publish(subject, message);
      await sleep(1);
    }
  };

  subscriber();
  publisher();

  // Graceful shutdown after 5 seconds
  setTimeout(async () => {
    await nc.drain();
  }, 20000);
}

run()
