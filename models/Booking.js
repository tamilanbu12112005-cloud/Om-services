const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    email: { type: String, required: true },
    serviceType: { type: String, required: true }, // e.g., 'Catering', 'Travels', 'Photography'
    serviceName: { type: String, required: true }, // e.g., 'Banana Leaf', '54 Seater Bus'
    name: { type: String, required: true },
    age: { type: Number },
    phone: { type: String, required: true },
    address: { type: String },
    date: { type: String, required: true },
    guests: Number, // For catering
    eventDuration: String, // For catering
    mealType: String, // For catering
    cateringStyle: String, // For catering (Banana Leaf / Buffet)
    pickupLocation: String, // For travels
    dropDestination: { type: String }, // For travels
    travelDuration: { type: String }, // For travels
    passengerCount: { type: Number }, // For travels
    eventType: { type: String }, // For photography
    photographyDuration: { type: String }, // For photography
    sweetQuantity: { type: String }, // For sweets
    functionTime: { type: String }, // For sweets
    departureSlot: { type: String }, // For travels (Morning/Afternoon/Evening/Night)
    
    // NEW: Status tracking
    status: { 
        type: String, 
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    
    // NEW: Status history
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: String,
        note: String
    }],
    
    // NEW: Additional metadata
    notes: { type: String }, // Admin notes
    totalAmount: { type: Number }, // Optional pricing
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
