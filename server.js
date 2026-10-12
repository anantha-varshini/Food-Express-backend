const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
    ],
  })
);

app.use(express.json());

// Test whether the backend is running
app.get("/", (req, res) => {
  res.json({ message: "Food Express API is running" });
});

// Test the PostgreSQL connection
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");

    res.json({
      message: "PostgreSQL connected successfully",
      time: result.rows[0].time,
    });
  } catch (error) {
    console.error("Database test failed:", error.message);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

// Save contact form messages
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject = "", message } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        message: "Name, email and message are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, subject, message, created_at`,
      [name.trim(), email.trim(), subject.trim(), message.trim()]
    );

    res.status(201).json({
      message: "Contact message saved successfully",
      contact: result.rows[0],
    });
  } catch (error) {
    console.error("Contact save failed:", error.message);

    res.status(500).json({
      message: "Could not save contact message",
    });
  }
});

// Synchronize the current Redux cart with PostgreSQL
app.post("/api/cart/sync", async (req, res) => {
  const { cartId, items } = req.body;

  if (
    typeof cartId !== "string" ||
    !cartId.trim() ||
    cartId.length > 100 ||
    !Array.isArray(items)
  ) {
    return res.status(400).json({
      message: "A valid cartId and items array are required",
    });
  }

  if (
    items.length > 200 ||
    items.some(
      (item) =>
        !item ||
        typeof item.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000
    )
  ) {
    return res.status(400).json({
      message: "Cart contains invalid products or quantities",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM cart_items WHERE cart_id = $1",
      [cartId]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO cart_items
          (cart_id, product_id, product_name, price, image_url, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cartId,
          item.productId.trim(),
          item.productName || "",
          item.price ?? 0,
          item.imageUrl || "",
          item.quantity,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "Cart synchronized successfully",
      itemCount: items.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Cart synchronization failed:", error.message);

    res.status(500).json({
      message: "Could not synchronize cart",
    });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Food Express backend running on port ${PORT}`);
});