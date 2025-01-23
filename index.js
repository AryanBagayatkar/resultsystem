require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Student = require('./models/Studentmodel'); // Assuming you have a Student model in this path
const app = express();

// MongoDB Connection String (Replace with your actual URI)
const MONGO_URI = process.env.MONGO;
// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'my_key';
// Define a route to render the EJS file
app.get('/', (req, res) => {
    res.render('index', { name: 'User' }); // Pass variables to EJS
});

app.post('/', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Admin Login
        if (username === 'admin' && password === 'admin123') {
            const token = jwt.sign({ username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('authToken', token); // Store token in a cookie (Optional)
            return res.redirect('/admin');
        }
        // Student Login
        const student = await Student.findOne({ username });
        if (student && student.password === password) { // Compare password directly
            const token = jwt.sign({ username: student.username, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('authToken', token); // Store token in a cookie (Optional)
            return res.redirect(`/student/${student.username}`);
        }
        // If credentials are invalid
        res.render('index', { error: 'Invalid username or password' });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Server error during login');
    }
});
app.get('/admin', async (req, res) => {
    try {
        const students = await Student.find({}); // Fetch all students
        res.render('admin', { students }); // Pass students to the EJS view
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).send('Error fetching students');
    }
});
app.post('/createStudent', async (req, res) => {
    const { rollno, username, password, subjects, examMonth, IA, TW } = req.body;

    // Calculate percentage from subjects' marks
    const totalMarks = subjects.reduce((sum, subject) => sum + parseFloat(subject.marks), 0); // Ensure marks are numeric
    const percentage = ((totalMarks / (subjects.length * 100)) * 100).toFixed(2); 

    const student = new Student({
        rollno,
        username,
        password,
        percentage,
        examMonth,
        IA,        
        TW,        
        subjects
    });

    try {
        // Save the student to MongoDB
        await student.save();
        res.redirect(`/student/${username}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating student');
    }
});
// Route to render the update form for a specific student
app.get('/admin/updateStudent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const student = await Student.findById(id); // Find the student by ID
        if (!student) {
            return res.status(404).send('Student not found');
        }
        res.render('updateStudent', { student }); // Render the update form
    } catch (error) {
        console.error('Error fetching student for update:', error);
        res.status(500).send('Error fetching student for update');
    }
});
// Route to handle student update
app.post('/admin/updateStudent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rollno, username, password, subjects, examMonth, IA, TW } = req.body;

        // Update the student data
        await Student.findByIdAndUpdate(id, {
            rollno,
            username,
            password,
            examMonth, // Updated examMonth
            IA: parseInt(IA, 10), // Updated Internal Assessment (IA)
            TW: parseInt(TW, 10), // Updated Term Work (TW)
            subjects: subjects.map((subject) => ({
                name: subject.name,
                marks: parseInt(subject.marks, 10),
                grade: subject.grade,
            })),
        });

        res.redirect('/admin'); // Redirect back to the admin dashboard
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).send('Error updating student');
    }
});

app.post('/admin/deleteStudent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Student.findByIdAndDelete(id); // Delete the student by ID
        res.redirect('/admin'); // Redirect back to the admin dashboard
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).send('Error deleting student');
    }
});
// Dynamic route for student profile
app.get('/student/:username', async (req, res) => {
    const { username } = req.params;

    // Find the student by username
    const student = await Student.findOne({ username });

    if (student) {
        // Exclude the password before rendering the student's profile
        const { password, ...studentData } = student.toObject();
        res.render('student', { student: studentData }); // Render student profile page
    } else {
        res.send('Student not found');
    }
});
// Define the port
const PORT = 3700;
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
