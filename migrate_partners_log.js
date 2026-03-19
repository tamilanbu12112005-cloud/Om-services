require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('./models/Partner');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Partner.countDocuments();
        const pendingCount = await Partner.countDocuments({ status: 'Pending' });
        console.log(`TOTAL PARTNERS: ${count}`);
        console.log(`ALREADY PENDING: ${pendingCount}`);
        
        const result = await Partner.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Pending', adminNote: '' } }
        );
        console.log(`UPDATED ${result.modifiedCount} NEW RECORDS.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
migrate();
