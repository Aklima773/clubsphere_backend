const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// mongobd info 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vcvzka8.mongodb.net/?appName=Cluster0`;

// middleware
app.use(express.json());
app.use(cors());



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });



//   mongodb function 
  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

     const db = client.db('clubsphere');
     const userCollection = db.collection('users');

    //  users api 

    // create and add users 
     app.post('/users', async (req, res) => {
        const user = req.body;
        user.role = 'user';
        user.createdAt = new Date();
        const email = user.email;
        const userExists = await userCollection.findOne({ email })

        if (userExists) {
            return res.send({ message: 'User altrady Registered' })
        }

        const result = await userCollection.insertOne(user);
        res.send(result);
    })



      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
     
    }
  }
  run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Welcome to ClubSphere!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})