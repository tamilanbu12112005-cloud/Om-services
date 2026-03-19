const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    category: { 
        type: String, 
        required: true,
        enum: ['Catering', 'Travels', 'Photography', 'Sweets']
    },
    
    // Common Fields
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    details: { type: String }, // General description/details
    
    // Specific Fields (optional based on category)
    teamSize: { type: String }, // Catering: "how much member you want"
    menuItems: { type: String }, // Catering: "what you will have"
    
    vehicleModel: { type: String }, // Travels: "which model bus"
    
    cameraModel: { type: String }, // Photography: "camera model"
    
    sweetType: { type: String }, // Sweets: "which sweet"
    
    // Images
    images: [{ type: String }], // Array of file paths
    
    // Admin Fields
    status: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending' 
    },
    adminNote: { type: String, default: '' },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the 'updatedAt' field before saving
partnerSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Partner', partnerSchema);
