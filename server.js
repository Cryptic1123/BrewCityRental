

//const express = require("express");
import express from "express";
//const mysql = require("mysql2/promise");
import mysql from "mysql2/promise";
//const bodyParser = require("body-parser");
import bodyParser from "body-parser";
//const cors = require("cors");
import cors from "cors";
//const bcrypt = require("bcryptjs");
import bycrypt from "bcryptjs";
//const crypto = require("crypto");
import crypto from "crypto";
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));


// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool
  .getConnection()
  .then((connection) => {
    console.log("✓ Connected to MySQL database: brewcity");
    connection.release();
  })
  .catch((error) => {
    console.error("✗ Database connection failed:", error.message);
    console.error(
      '  Make sure MySQL is running and the "brewcity" database exists.',
    );
    console.error(
      "  Default connection: localhost, user: root, password: (empty)",
    );
  });

app.get("/", (req, res) => {
  res.send("BCR Prototype Server is running.");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running", database: "brewcity" });
});

app.get("/api/customers", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT CustomerID, FirstName, LastName, Phone, Email, StreetAddress, City, State, ZipCode, RegistrationDate, Verified, CurrentBalance, Active FROM customer LIMIT 100",
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customers/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT CustomerID, FirstName, LastName, Phone, Email, StreetAddress, City, State, ZipCode, RegistrationDate, Verified, CurrentBalance, Active FROM customer WHERE CustomerID = ?",
      [req.params.id],
    );
    connection.release();
    if (rows.length === 0) {
      res.status(404).json({ error: "Customer not found" });
    } else {
      res.json(rows[0]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customerlookup/:search", async (req, res) => {
  try {
    const search = req.params.search;
    const connection = await pool.getConnection();
    let rows;
    if (!isNaN(search)) {
      [rows] = await connection.query(
        `SELECT * FROM vw_customer_management WHERE CustomerID = ?`,
        [search],
      );
    } else {
      [rows] = await connection.query(
        `SELECT * FROM vw_customer_management WHERE CustomerName LIKE ?`,
        [`%${search}%`],
      );
    }
    connection.release();
    if (rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found or Customer is not verified.",
      });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      streetAddress,
      city,
      state,
      zipCode,
      password,
    } = req.body;
    const connection = await pool.getConnection();
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const [result] = await connection.query(
      "INSERT INTO customer (FirstName, LastName, Phone, Email, StreetAddress, City, State, ZipCode, hash, Verified, CurrentBalance, Active, RegistrationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, CURRENT_TIMESTAMP)",
      [
        firstName,
        lastName,
        phone,
        email,
        streetAddress,
        city,
        state,
        zipCode,
        hashed,
        new Date().toISOString().split("T")[0],
      ],
    );

    connection.release();
    res.status(201).json({
      CustomerID: result.insertId,
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      city,
      state,
      zipCode,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/customers/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM customer WHERE Email = ?",
      [email],
    );
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Customer not found" });
    }
    const customer = rows[0];
    const customerID = customer.CustomerID;

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const expiresSql = expiresAt.toISOString().slice(0, 19).replace("T", " ");

    await connection.query(
      "INSERT INTO password_resets (CustomerID, token, expiresAt) VALUES (?, ?, ?)",
      [customerID, token, expiresSql],
    );
    connection.release();

    res.json({
      success: true,
      message: "Password reset token generated",
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/customers/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM password_resets WHERE token = ?",
      [token],
    );
    if (rows.length === 0) {
      connection.release();
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    const reset = rows[0];
    const now = new Date();
    if (new Date(reset.expiresAt) < now) {
      await connection.query("DELETE FROM password_resets WHERE id = ?", [
        reset.id,
      ]);
      connection.release();
      return res.status(400).json({ error: "Token expired" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    const customerID = reset.CustomerID;
    await connection.query(
      "UPDATE customer SET hash = ? WHERE CustomerID = ?",
      [hashed, customerID],
    );

    await connection.query("DELETE FROM password_resets WHERE id = ?", [
      reset.id,
    ]);
    connection.release();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/movies", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM movies LIMIT 100");
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "this is erroring" });
  }
});

app.get("/api/customers_management", async (req, res) => {
  try {
    const search = req.query.search || "";
    const connection = await pool.getConnection();
    let rows;
    if (search === "") {
      [rows] = await connection.query(
        `SELECT * FROM vw_customer_management ORDER BY CustomerName`,
      );
    } else {
      const term = `%${search}%`;
      [rows] = await connection.query(
        `SELECT * FROM vw_customer_management WHERE CustomerName LIKE ? OR Email LIKE ? OR CustomerID LIKE ? ORDER BY CustomerName`,
        [term, term, term],
      );
    }
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
app.put("/api/customers_management/:id/verify", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE customer SET verified=b'1' WHERE CustomerID=?`,
      [req.params.id],
    );
    connection.release();
    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.put("/api/customers_management/:id/activate", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE customer SET Active=b'1' WHERE CustomerID=?`,
      [req.params.id],
    );
    connection.release();
    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.put("/api/customers_management/:id/deactivate", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(
      ` UPDATE customer SET Active=b'0' WHERE CustomerID=?`,
      [req.params.id],
    );
    connection.release();
    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/inventory", async (req, res) => {
  try {
    const search = req.query.search || "";
    const connection = await pool.getConnection();
    let rows;
    if (search === "") {
      [rows] = await connection.query(
        ` SELECT * FROM vw_inventory_managment ORDER BY Title, ItemID`,
      );
    } else {
      const searchTerm = `%${search}%`;
      [rows] = await connection.query(
        ` SELECT * FROM vw_inventory_managment WHERE Title LIKE ? ORDER BY Title, ItemID `,
        [searchTerm],
      );
    }
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
app.post("/api/inventory", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO inventory ( MovieID, PurchaseDate, Cost, Status, WriteOff ) VALUES ( ?,?,?,?,? )`,
      [
        req.body.MovieID,
        req.body.PurchaseDate,
        req.body.Cost,
        req.body.Status,
        false,
      ],
    );
    connection.release();
    res.json({
      success: true,
      ItemID: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/movies/active", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      ` SELECT MovieID, Title FROM movies WHERE Status = 'active' ORDER BY Title`,
    );
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/api/rentals_by_due_date", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("Select * FROM vw_current_rentals");
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/movies/search", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM vw_movie_search WHERE Status = 'active'",
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customer/:id/current-rentals", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM vw_customer_current_rentals WHERE CustomerID = ?",
      [req.params.id],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customer/:id/history", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM vw_customer_rental_history WHERE CustomerID = ?",
      [req.params.id],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customer/:id/account", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM vw_customer_account WHERE CustomerID = ?",
      [req.params.id],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/customers/management", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM vw_movie_search");
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/checkout", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const {
      CustomerID,
      EmployeeID,
      Items,
      PaymentMethod,
      BalancePaid = 0,
    } = req.body;
    if (!CustomerID || !EmployeeID || !Items || Items.length === 0) {
      return res.status(400).json({
        error: "Missing checkout information.",
      });
    }
    const [priceRows] = await connection.query(
      `SELECT inventory.ItemID, rental_categories.RentalPrice FROM inventory
            JOIN movies ON inventory.MovieID = movies.MovieID
            JOIN rental_categories ON movies.RentalCategoryID = rental_categories.RentalCategoryID
            WHERE inventory.ItemID IN (?) AND inventory.Status = 'available'`,
      [Items],
    );
    if (priceRows.length !== Items.length) {
      throw new Error("One or more DVDs are unavailable.");
    }
    const subtotal = priceRows.reduce((sum, row) => {
      return sum + Number(row.RentalPrice);
    }, 0);

    const tax = subtotal * 0.055;

    const total = subtotal + tax + Number(BalancePaid);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const [payment] = await connection.query(
      `INSERT INTO payments (CustomerID, PaymentMethod, PaymentDate, Amount, Type) VALUES (?,?,NOW(),?, ?)`,
      [CustomerID, PaymentMethod, total.toFixed(2), "Rental"],
    );
    if (BalancePaid > 0) {
      await connection.query(
        `UPDATE customer SET CurrentBalance = GREATEST(CurrentBalance - ?, 0) WHERE CustomerID = ?`,
        [BalancePaid, CustomerID],
      );
    }
    const paymentID = payment.insertId;
    const [rental] = await connection.query(
      `INSERT INTO rentals (CustomerID, EmployeeID, RentalDate, DueDate, Tax, RentalCost, PaymentID)
      VALUES (?, ?, NOW(), ?, ?, ?, ?)
      `,
      [CustomerID, EmployeeID, dueDate, tax, subtotal, paymentID],
    );
    const rentalID = rental.insertId;

    for (const item of Items) {
      await connection.query(
        `INSERT INTO rental_item (RentalID, ItemID) VALUES (?, ?)`,
        [rentalID, item],
      );
      await connection.query(
        `UPDATE inventory SET Status='rented' WHERE ItemID=?`,
        [item],
      );
    }
    await connection.commit();

    res.json({
      success: true,
      RentalID: rentalID,
      PaymentID: paymentID,
      Subtotal: subtotal,
      Tax: tax,
      BalancePaid: Number(BalancePaid).toFixed(2),
      Total: total,
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({
      error: err.message,
    });
  } finally {
    connection.release();
  }
});

app.get("/api/returns/item/:id", async (req, res) => {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM vw_return_lookup WHERE ItemID = ?`,
    [req.params.id],
  );
  connection.release();
  if (rows.length === 0) {
    return res.status(404).json({
      error: "DVD not found or not checked out.",
    });
  }
  res.json(rows[0]);
});

app.post("/api/returns", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const { EmployeeID, PaymentMethod, Items } = req.body;
    let totalLateFees = 0;
    for (const item of Items) {
      const [rows] = await connection.query(
        `SELECT rentals.CustomerID, rentals.DueDate FROM rentals JOIN rental_item ON rentals.RentalID = rental_item.RentalID WHERE rental_item.ItemID = ?`,
        [item],
      );
      if (rows.length === 0) {
        throw new Error(`DVD ${item} is not currently rented.`);
      }
      const rental = rows[0];
      const customerID = rental.CustomerID;
      const today = new Date();
      const due = new Date(rental.DueDate);
      const daysLate = Math.max(
        0,
        Math.floor((today - due) / (1000 * 60 * 60 * 24)),
      );
      const lateFee = daysLate * 1.0;
      totalLateFees += lateFee;
      await connection.query(
        `UPDATE inventory SET Status='available' WHERE ItemID=?`,
        [item],
      );
      await connection.query(
        `UPDATE rental_item SET ReturnDate = NOW(), LateFee = ? WHERE ItemID = ?`,
        [lateFee, item],
      );
      if (totalLateFees > 0 && PaymentMethod !== "Account Balance") {
        await connection.query(
          `INSERT INTO payments( CustomerID, PaymentMethod, PaymentDate, Amount, Type) VALUES (?, ?, NOW(), ?, ?)`,
          [customerID, PaymentMethod, totalLateFees, "Late Fee"],
        );
      }
    }
    await connection.commit();
    res.json({
      success: true,
      LateFees: totalLateFees,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    res.status(500).json({
      error: err.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/api/writeoff-report", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "Select * FROM vw_write_off ORDER BY dayslate DESC",
    );

    const totalValue = rows.reduce((sum, row) => {
      return sum + Number(row.cost || 0);
    }, 0);

    connection.release();
    res.json({ rows, totalValue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/movies/management", async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const search = req.query.search || "";
    let rows;

    if (search === "") {
      [rows] = await connection.query(
        "SELECT * FROM vw_moviemanagement ORDER BY Title",
      );
    } else {
      const searchTerm = `%${search}%`;
      [rows] = await connection.query(
        "SELECT * FROM vw_moviemanagement WHERE Title LIKE CONCAT('%', ?, '%') OR Description LIKE CONCAT('%', ?, '%') ORDER BY Title",
        [searchTerm, searchTerm],
      );
    }
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/movies/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM vw_movie_search WHERE MovieID = ?",
      [req.params.id],
    );
    connection.release();
    if (rows.length === 0) {
      res.status(404).json({ error: "Movie not found" });
    } else {
      res.json(rows[0]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/customer/:id/wishlist", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT *
             FROM vw_customer_wishlist
             WHERE CustomerID = ?
             ORDER BY ReservationDate DESC`,
      [req.params.id],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});
app.delete("/api/wishlist/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query("DELETE FROM reservations WHERE ReservationID = ?", [
      req.params.id,
    ]);
    connection.release();
    res.json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/rental-categories", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT RentalCategoryID, CategoryName FROM rental_categories ORDER BY CategoryName`,
    );
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
app.get("/api/rentals", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM rentals LIMIT 100");
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/rentals/customer/:customerID", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM rentals WHERE customer_id = ?",
      [req.params.customerID],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/movie", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO movies (Title, Description, Rating, ReleaseYear, Status, RentalCategoryID ) VALUES ( ?,?,?,?,?,? )`,
      [
        req.body.Title,
        req.body.Description,
        req.body.Rating,
        req.body.ReleaseYear,
        req.body.Status,
        req.body.RentalCategoryID,
      ],
    );
    connection.release();
    res.json({
      success: true,
      MovieID: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/movie/:id", async (req, res) => {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM vw_moviemanagement WHERE MovieID = ?`,
    [req.params.id],
  );
  connection.release();
  if (rows.length === 0) {
    return res.status(404).json({
      error: "Movie not found.",
    });
  }
  res.json(rows[0]);
});

app.put("/api/movie/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "UPDATE movies SET Title = ?, Description = ?, Rating = ?, ReleaseYear = ?, Status = ?, RentalCategoryID = ? WHERE MovieID = ?",
      [
        req.body.Title,
        req.body.Description,
        req.body.Rating,
        req.body.ReleaseYear,
        req.body.Status,
        req.body.RentalCategoryID,
        req.params.id,
      ],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/inventory/item/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM vw_dvd_availablility WHERE ItemID = ?`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        error: "Movie not available.",
      });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.put("/api/inventory/:id/writeoff", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(
      ` UPDATE inventory SET Status='written off', WODate = NOW() WHERE ItemID=? `,
      [req.params.id],
    );
    connection.release();
    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
app.put("/api/movie/:id/inactive", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "UPDATE movies SET Status = 'Inactive' WHERE MovieID = ?",
      [req.params.id],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/rentals", async (req, res) => {
  try {
    const { customer_id, dvd_id, rental_date, due_date } = req.body;
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "INSERT INTO rentals (customer_id, dvd_id, rental_date, due_date) VALUES (?, ?, ?, ?)",
      [customer_id, dvd_id, rental_date, due_date],
    );
    connection.release();
    res.status(201).json({
      id: result.insertId,
      customer_id,
      dvd_id,
      rental_date,
      due_date,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reservations", async (req, res) => {
  try {
    const { customer_id, movie_id, reserved_date } = req.body;
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "INSERT INTO reservations (CustomerID, MovieID, ReservationDate, Status) VALUES (?, ?, ?, ?)",
      [customer_id, movie_id, reserved_date, "Active"],
    );
    connection.release();
    res.status(201).json({
      id: result.insertId,
      customer_id,
      movie_id,
      reserved_date,
      message: "Reservation created successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reservations/customer/:customerID", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM reservations WHERE CustomerID = ?",
      [req.params.customerID],
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/employee/login", async (req, res) => {
  let connection;

  try {
    const { email, password } = req.body;

    connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT 
        employee.EmployeeID,
        employee.FirstName,
        employee.LastName,
        employee.hash,
        roles.Role,
        CAST(roles.Manager AS UNSIGNED) AS Manager,
        CAST(roles.Admin AS UNSIGNED) AS Admin
      FROM employee
      JOIN roles ON employee.EmployeeID = roles.EmployeeID
      WHERE employee.Email = ?`,
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const employee = rows[0];

    const storedHash = employee.hash || employee.Hash || null;

    let passwordMatches = false;

    if (storedHash) {
      try {
        passwordMatches = await bcrypt.compare(password, storedHash);
      } catch (e) {
        passwordMatches = false;
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const safeEmployee = {
      EmployeeID: employee.EmployeeID,
      FirstName: employee.FirstName,
      LastName: employee.LastName,
      Role: employee.Role,
      Manager: Number(employee.Manager),
      Admin: Number(employee.Admin),
    };
    console.log(safeEmployee);
    res.json({
      success: true,
      employee: safeEmployee,
    });
  } catch (error) {
    console.error("Employee login error:", error);

    res.status(500).json({
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/api/employees", async (req, res) => {
  try {
    const search = req.query.search || "";
    const connection = await pool.getConnection();
    let rows;
    if (search === "") {
      [rows] = await connection.query(
        `SELECT * FROM vw_employee_management ORDER BY EmployeeName`,
      );
    } else {
      const term = `%${search}%`;
      [rows] = await connection.query(
        `SELECT * FROM vw_employee_management WHERE EmployeeName LIKE ? OR Email LIKE ? OR EmployeeID LIKE ? ORDER BY EmployeeName`,
        [term, term, term],
      );
    }
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
app.post("/api/employees", async (req, res) => {
  let connection;
  try {
    const {
      FirstName,
      LastName,
      Phone,
      Email,
      HireDate,
      Status,
      ManagerID,
      Role,
      Manager,
      Admin,
      Password,
    } = req.body;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const hashedPassword = await bcrypt.hash(Password, 10);
    const hireDateValue = HireDate || new Date().toISOString().slice(0, 10);
    const statusValue = Status ?? 1;
    const roleID = 1;
    const [employeeResult] = await connection.query(
      `INSERT INTO employee( FirstName, LastName, Phone, Email, HireDate, Status, RoleID, ManagerID, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        FirstName,
        LastName,
        Phone,
        Email,
        hireDateValue,
        statusValue,
        roleID,
        ManagerID,
        hashedPassword,
      ],
    );

    const employeeID = employeeResult.insertId;

    await connection.query(
      `INSERT INTO roles (EmployeeID, Role, Manager, Admin) VALUES (?, ?, ?, ?)`,
      [employeeID, Role, Manager, Admin],
    );
    await connection.commit();
    res.status(201).json({
      success: true,
      EmployeeID: employeeID,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    res.status(500).json({
      error: err.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/api/employee/:id", async (req, res) => {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM vw_employee_management WHERE EmployeeID=?`,
    [req.params.id],
  );
  connection.release();
  if (rows.length == 0) {
    return res.status(404).json({
      error: "Employee not found.",
    });
  }
  res.json(rows[0]);
});
app.put("/api/employee/:id", async (req, res) => {
  console.log("THIS ROUTE IS RUNNING");
  console.log(req.params.id);
  console.log(typeof req.params.id);

  console.log(req.body.Status);
  console.log(typeof req.body.Status);
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(
      `UPDATE employee SET
                FirstName = ?,
                LastName = ?,
                Phone = ?,
                Email = ?,
                Status = ?,
                ManagerID = ?
             WHERE EmployeeID = ?`,
      [
        req.body.FirstName,
        req.body.LastName,
        req.body.Phone,
        req.body.Email,
        req.body.Status,
        req.body.ManagerID,
        req.params.id,
      ],
    );
    await connection.query(
      `UPDATE roles SET Role=?, Manager=?, Admin=? WHERE EmployeeID=?`,
      [req.body.Role, req.body.Manager, req.body.Admin, req.params.id],
    );
    await connection.commit();
    res.json({
      success: true,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.log(err);
    res.status(500).json({
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });
  } finally {
    connection.release();
  }
});

app.post("/api/employees/reset-password", async (req, res) => {
  try {
    const { employeeId, newPassword, createdByEmployeeId } = req.body;
    if (!createdByEmployeeId) {
      return res.status(403).json({ error: "Manager or admin login required" });
    }

    if (!employeeId || !newPassword) {
      return res
        .status(400)
        .json({ error: "Employee ID and new password are required" });
    }

    const connection = await pool.getConnection();
    const [creatorRows] = await connection.query(
      "SELECT * FROM employee WHERE EmployeeID = ?",
      [createdByEmployeeId],
    );
    if (creatorRows.length === 0) {
      connection.release();
      return res.status(403).json({ error: "Invalid creator account" });
    }

    const creator = creatorRows[0];
    const creatorRole = creator.RoleID;
    if (creatorRole !== 1 && creatorRole !== 2) {
      connection.release();
      return res.status(403).json({
        error: "Only admin or manager users may reset employee passwords",
      });
    }

    const [employeeRows] = await connection.query(
      "SELECT * FROM employee WHERE EmployeeID = ?",
      [employeeId],
    );
    if (employeeRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Employee not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await connection.query(
      "UPDATE employee SET hash = ? WHERE EmployeeID = ?",
      [hashedPassword, employeeId],
    );
    connection.release();

    res.json({
      success: true,
      message: "Employee password reset successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/managers", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT EmployeeID, EmployeeName FROM vw_employee_management WHERE Manager = 1 OR Admin = 1 ORDER BY EmployeeName`,
    );
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

app.post("/api/customer/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM customer WHERE Email = ?",
      [email],
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const customer = rows[0];
    const storedHash = customer.hash || customer.Hash || null;

    let passwordMatches = false;
    if (storedHash) {
      try {
        passwordMatches = await bcrypt.compare(password, storedHash);
      } catch (e) {
        passwordMatches = false;
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const safeCustomer = { ...customer };
    delete safeCustomer.hash;
    delete safeCustomer.Hash;

    res.json({ success: true, customer: safeCustomer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║   BCR Prototype Server Running     ║`);
  console.log(
    `║   http://localhost:${PORT}${" ".repeat(13 - PORT.toString().length)}║`,
  );
  console.log(`║   Database: ${process.env.DB_NAME}               ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});

//module.exports = app;
export default {app, pool};