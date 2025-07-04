const express = require("express");
const fs = require("fs");
const app = express();
const path = require("path");
require("dotenv").config();
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const port = 3000;

// Static file paths
const config = path.join(__dirname, "configs");
app.use("/configs", express.static(config));

const uploadDir = path.join(__dirname, "imgs");
app.use("/imgs", express.static(uploadDir));

// SSL Certificate for MySQL
const caCert = fs.readFileSync(path.join(__dirname, process.env.DB_SSL_CA));

// DB connection config
const dbOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: caCert,
  },
};

// Create MySQL connection and pool
let connection;
const pool = mysql.createPool(dbOptions);
const sessionStore = new MySQLStore({}, pool);

(async () => {
  try {
    connection = await mysql.createConnection(dbOptions);
    console.log("Connected to the database.");
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
})();

// Session middleware
app.use(
  session({
    key: "session_cookie_namedevmax",
    secret: process.env.SECRET_KEY,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

// Routes
app.get("/style.css", (req, res) => {
  res.sendFile(__dirname + "/style.css");
});

app.get("/signin", (req, res) => {
  res.sendFile(__dirname + "/signin.html");
});

app.post("/user-entry", async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    const [results] = await connection.query(
      "SELECT * FROM users WHERE phone = ? AND pass = ?",
      [phone, password]
    );

    if (results.length > 0) {
      return res.json({ exists: "User already exists" });
    }

    await connection.query(
      "INSERT INTO users (name, phone, email, pass) VALUES (?, ?, ?, ?)",
      [name, phone, email, password]
    );

    req.session.user = phone;
    res.json({ success: "User inserted and session started" });
  } catch (err) {
    console.error("User entry error:", err);
    res.json({ invalid: "error" });
  }
});

app.post("/user-login", async (req, res) => {
  const { phone, password } = req.body;

  try {
    const [results] = await connection.query(
      "SELECT * FROM users WHERE phone = ? AND pass = ?",
      [phone, password]
    );

    if (results.length > 0) {
      req.session.user = phone;
      res.json({ success: "Login successful" });
    } else {
      res.json({ err: "Invalid email or password" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.json({ error: "Internal server error" });
  }
});

app.get("/dashboard", (req, res) => {
  if (req.session.user) {
    res.sendFile(__dirname + "/Dashboard.html");
  } else {
    res.redirect("/signin");
  }
});

app.get("/user-list", async (req, res) => {
  if (!req.session.user) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  try {
    const [results] = await connection.query(
      "SELECT name, phone FROM users WHERE phone = ?",
      [req.session.user]
    );

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: results[0] });
  } catch (err) {
    console.error("User list error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.get("/doctors", (req, res) => {
  if (req.session.user) {
    res.sendFile(__dirname + "/Doctors.html");
  } else {
    res.redirect("/signin");
  }
});

app.get("/Doctor-list", async (req, res) => {
  try {
    const [results] = await connection.query("SELECT * FROM doctors");
    res.json({ success: true, doctors: results });
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.get("/signout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/signin");
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
