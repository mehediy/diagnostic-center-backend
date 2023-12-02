const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dqfkiqe.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
    const userCollection = client.db("diagnosticDB").collection("users");
    const testCollection = client.db("diagnosticDB").collection("tests");
    const bookingCollection = client.db("diagnosticDB").collection("bookings");

    //
    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;
      const newUser = {
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        bloodGroup: user.bloodGroup,
        district: user.district,
        upazilla: user.upazilla,
        role: "user",
        status: "active",
      };
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // Add a test
    app.post("/api/v1/tests", async (req, res) => {
      const body = req.body;
      const result = await testCollection.insertOne(body);
      res.send(result);
    });
    // Update test
    app.put("/api/v1/tests/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updated = {
        $set: {
          ...body,
        },
      };
      const result = await testCollection.updateOne(filter, updated, {
        upsert: true,
      });
      res.send(result);
    });

    // Book test
    app.post("/api/v1/bookings", async (req, res) => {
      const body = req.body;

      const existingBooking = await bookingCollection.findOne({
        booking_id: body.booking_id,
        email: body.email,
      });

      if (existingBooking) {
        // If an existing booking is found, return an error response
        res.status(400).send({
          success: false,
          message: "You have already booked",
        });
      } else {
        // decrement the "slots" count

        const result = await testCollection.findOneAndUpdate(
          {
            _id: new ObjectId(body.booking_id),
            slots: { $gte: 1 }, // Check if slots is greater than or equal to 1
          },
          { $inc: { slots: -1 } },
          { returnDocument: "after" } // Ensure the updated document is returned
        );

        if (result) {
          // Insert the booking
          const bookingResult = await bookingCollection.insertOne({
            ...body,
            status: "pending",
          });
          res.send(bookingResult);
        } else {
          res.status(500).send({
            success: false,
            message: "Failed to update slots",
          });
        }
      }
    });

    // Get bookings
    app.get("/api/v1/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });
    // Get tests
    app.get("/api/v1/tests", async (req, res) => {
      const result = await testCollection.find().toArray();
      res.send(result);
    });

    // Get tests featured
    app.get("/api/v1/featured-tests", async (req, res) => {
      const currentDate = new Date();
      const result = await testCollection
        .find({
          date: {
            $gte: currentDate.toISOString(),
          },
        })
        .sort({ slots: -1 })
        .limit(3)
        .toArray();

      res.send(result);
    });

    // Get test
    app.get("/api/v1/tests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.findOne(query);
      res.send(result);
    });
    // Delete test
    app.delete("/api/v1/tests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.deleteOne(query);
      res.send(result);
    });

    // Get users
    app.get("/api/v1/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Check if user is admin
    app.get("/api/v1/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // Update user role
    app.patch("/api/v1/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: body.role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Update user status
    app.patch("/api/v1/users/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: body.status,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running");
});

app.listen(port);
