require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Student = require('./models/Studentmodel'); // Assuming you have a Student model in this path
const path = require('path');
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
app.use('/images', express.static(path.join(__dirname, 'images')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'my_key';
// Define a route to render the EJS file
app.get('/',(req,res)=>{
    res.render('Home');
})
app.get('/login', (req, res) => {
    res.render('index', { name: 'User' }); // Pass variables to EJS
});

app.post('/login', async (req, res) => {
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
    const { rollno, username, password, subjects, examMonth, IA, TW , status  } = req.body;

    // Calculate percentage from subjects' marks
    const totalMarks = subjects.reduce((sum, subject) => sum + parseFloat(subject.marks), 0); // Ensure marks are numeric
    const percentage = ((totalMarks / (subjects.length * 100)) * 100).toFixed(2); 
    const sgpa = (percentage / 10).toFixed(2); // Convert percentage to SGPA (on a scale of 10)
   
    const student = new Student({
        rollno,
        username,
        password,
        percentage,
        sgpa,
        examMonth,
        IA,        
        TW, 
        status,      
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
app.get('/admin/updateStudent/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const student = await Student.findOne({ username });
        if (!student) {
            console.log('Student not found for username:', username);
            return res.status(404).send('Student not found');
        }
        res.render('updateStudent', { student }); // Render the update form
    } catch (error) {
        console.error('Error fetching student for update:', error);
        res.status(500).send('Error fetching student for update');
    }
});

app.post('/admin/updateStudent/:username', async (req, res) => {
    try {
        const { username } = req.params; // Extract username from URL
        const {
            examMonth,
            rollno,
            password,
            subjects,
            status,
        } = req.body; // Extract updated fields from form data

        // Find the student by username
        const student = await Student.findOne({ username });
        if (!student) {
            return res.status(404).send('Student not found');
        }

        // Update the student details
        student.examMonth = examMonth;
        student.rollno = rollno;
        student.password = password;
        student.status = status;

        // Update subjects
        if (subjects) {
            student.subjects = subjects.map((subject) => ({
                name: subject.name,
                marks: parseInt(subject.marks, 10),
                grade: subject.grade,
                IA: parseInt(subject.IA, 10),
                TW: parseInt(subject.TW, 10),
            }));
        }

        // Save the updated student
        await student.save();

        // Redirect to the admin dashboard or another page
        res.redirect('/admin/studentList'); // Adjust this to your desired redirection
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).send('Error updating student');
    }
});
app.get('/admin/studentList', async (req, res) => {
    try {
        const search = req.query.search; // Get search term from query
        let students;

        if (search) {
            // Search for students by username (case-insensitive)
            students = await Student.find({ username: { $regex: search, $options: 'i' } });
        } else {
            // Fetch all students if no search term is provided
            students = await Student.find();
        }

        res.render('studentList', { students, search }); // Pass search term to the view
    } catch (error) {
        console.error('Error fetching student list:', error);
        res.status(500).send('Error fetching student list');
    }
});

app.post('/admin/deleteStudent/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Student.findByIdAndDelete(id); // Delete the student by ID
        res.redirect('/admin/studentList'); // Redirect back to the admin dashboard
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).send('Error deleting student');
    }
});
// Dynamic route for student profile
app.get('/student/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Find the student by username (case-insensitive search)
        const student = await Student.findOne({ username: { $regex: `^${username}$`, $options: 'i' } });

        if (student) {
            // Exclude the password before rendering the student's profile
            const { password, ...studentData } = student.toObject();
            res.render('student', { student: studentData }); // Render student profile page
        } else {
            res.status(404).send('Student not found');
        }
    } catch (error) {
        console.error('Error fetching student:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Define the port
const PORT = process.env.PORT || 3700;
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
