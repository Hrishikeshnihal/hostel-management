const bcrypt = require('bcryptjs');
async function test() {
    console.log(await bcrypt.compare('admin123', '$2b$10$6vnG95mjWSEy79i3YpAhAOsglsDyEHZXDSZ3.W67OHJ.Z0xrWyknm'));
    console.log(await bcrypt.compare('admin123', '$2b$10$m2HBtJVPlXmPYSOqJg3PCOtS5gXfRUtmE6M6pMk4MhAOIfFM8Hlny'));
}
test();
