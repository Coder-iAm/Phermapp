const express = require("express");
const fs = require("fs");
const app = express();
const path = require('path');
require('dotenv').config();
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session); 
const mysql = require('mysql2');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const port = 3000;


const config = path.join(__dirname, 'configs');
app.use('/configs', express.static(config));

const uploadDir = path.join(__dirname, 'imgs');
app.use('/imgs', express.static(uploadDir));

const caCert = fs.readFileSync(path.join(__dirname, process.env.DB_SSL_CA));

const dbOptions = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        ca: caCert
    }
};


const connection = mysql.createConnection(dbOptions);
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ', err);
    } else {
        console.log('Connected to the database.');
    }
});


const sessionStore = new MySQLStore({}, mysql.createPool(dbOptions));


app.use(session({
    key: 'session_cookie_namedevmax',
    secret: process.env.SECRET_KEY,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, 
          maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

// Routers
app.get("/style.css", (req, res) => {
  res.sendFile(__dirname+"/style.css")
}); 

app.get("/signin", (req, res) => {
  res.sendFile(__dirname+"/signin.html")
});



app.post("/user-entry", (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const phone = req.body.phone;
    // Step 1: Check if user exists
    const checkQuery = 'SELECT * FROM users WHERE phone = ? AND pass = ?';
    connection.query(checkQuery, [phone, password], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.json({ invalid: "error" });
        }

        if (results.length > 0) {


            res.json({ exists: "User already exists" });
        }

        else {

            const insertQuery = 'INSERT INTO users (name, phone, email, pass) VALUES (?, ?, ?, ?)';
            connection.query(insertQuery, [name, phone, email, password], (err, result) => {
                if (err) {
                    console.error("Error inserting user:", err);
                    return res.json({ invalid: "error" });
                }

                req.session.user = phone;

                res.json({ success: "User inserted and session started" });
            });
        }
    });
});




app.post("/user-login", (req, res) => {
    const phone = req.body.phone;
    const password = req.body.password;


    const loginQuery = 'SELECT * FROM users WHERE phone = ? AND pass = ?';
    connection.query(loginQuery, [phone, password], (err, results) => {
        if (err) {
            console.error("Error checking login:", err);
            return res.json({ error: "Internal server error" });
        }

        if (results.length > 0) {

            req.session.user = phone;
            res.json({ success: "Login successful" });
        } else {
            // Invalid login
            res.json({ err: "Invalid email or password" });
        }
    });
});





app.get("/dashboard", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/Dashboard.html");
    }
    else {
        res.redirect("/signin");
    }
});




app.get("/user-list", (req, res) => {
    if (req.session.user) {
        const phone = req.session.user;

        connection.query(
            "SELECT name, phone FROM users WHERE phone = ?",
            [phone],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: "Database error" });
                }

                if (results.length === 0) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.json({ success: true, user: results[0] });
            }
        );
    } else {
        res.status(403).json({ success: false, message: "Unauthorized" });
    }
});



app.get("/doctors", (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + "/Doctors.html");
    }
    else {
        res.redirect("/signin");
    }
});

app.get("/Doctor-list", (req, res) => {
    const query = "SELECT * FROM doctors";

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching doctors:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
      
        res.json({
            success: true,
            doctors: results
        });
    });
});



app.get('/signout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.clearCookie('connect.sid');
        res.redirect('/signin');
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
