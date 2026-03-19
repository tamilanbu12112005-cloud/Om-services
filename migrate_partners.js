require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('./models/Partner');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Partner.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Pending', adminNote: '' } }
        );

        console.log(`Updated ${result.modifiedCount} partners to Pending status.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
