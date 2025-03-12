const mongoose = require('mongoose');

// Subject Schema embedded in Student Schema
const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    marks: { type: Number, required: true },
    grade: { type: String, required: true },
    IA: { type: Number, required: true }, 
    TW: { type: Number, required: true }, 
});

// Student Schema
const studentSchema = new mongoose.Schema({
    rollno: { type: Number, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    percentage: { type: Number },
    sgpa:  Number,
    examMonth: { type: String, required: true }, 
    status: {
        type: String,
        enum: ['pass', 'fail'],
        default: 'pass', // Default value
    },
    subjects: [subjectSchema] 
});

// Create a model based on the schema
const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
